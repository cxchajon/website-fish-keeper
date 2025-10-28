#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const FLOW_DERATE = 0.65;
const TURNOVER_MIN = 4;
const TURNOVER_MAX = 10;
const MIN_GALLONS_FLOOR = 1;

const OUTPUT_DIR = path.join(ROOT_DIR, 'assets', 'data', 'gear');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'filters.json');
const OUTPUT_SCHEMA = path.join(OUTPUT_DIR, 'filters.schema.json');
const OUTPUT_SUMMARY = path.join(OUTPUT_DIR, 'filters.summary.md');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('--check') || args.includes('-n');

const SOURCE_PATHS = {
  inlineGear: path.join(ROOT_DIR, 'gear', 'index.html'),
  dataFiltersJson: path.join(ROOT_DIR, 'data', 'filters.json'),
  gearFiltersCsv: path.join(ROOT_DIR, 'data', 'gear_filters.csv'),
  gearFiltersRangesCsv: path.join(ROOT_DIR, 'data', 'gear_filters_ranges.csv'),
};

const ALLOWED_TYPES = ['CANISTER', 'HOB', 'SPONGE', 'INTERNAL', 'UGF'];
const TYPE_PRIORITY = new Map(ALLOWED_TYPES.map((type, index) => [type, index]));

async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function slugify(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

function normalizeNameKey(value) {
  return slugify(value).replace(/_/g, '');
}

function canonicalNameKey(value) {
  const base = normalizeNameKey(value);
  if (!base) {
    return '';
  }
  const cleaned = base
    .replace(/aquarium/g, '')
    .replace(/filters/g, '')
    .replace(/filter/g, '')
    .replace(/canister/g, '')
    .replace(/hob/g, '')
    .replace(/power/g, '')
    .replace(/performance/g, '')
    .replace(/quietflow/g, '')
    .replace(/hangonback/g, '')
    .replace(/hangon/g, '');
  return cleaned || base;
}

function coerceNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return NaN;
    }
    const normalized = trimmed.replace(/[^0-9.+-]/g, '');
    return normalized ? Number(normalized) : NaN;
  }
  return NaN;
}

function parseCsv(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }
  const rows = [];
  let field = '';
  let inQuotes = false;
  const current = [];
  const pushField = () => {
    current.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(current.splice(0));
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === ',') {
      pushField();
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      pushRow();
      continue;
    }
    field += char;
  }
  pushField();
  if (current.length) {
    rows.push(current.splice(0));
  }
  return rows.filter((row) => row.length);
}

function csvToObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) {
    return [];
  }
  const [header, ...data] = rows;
  return data.map((row) => {
    const record = {};
    header.forEach((key, index) => {
      record[key] = row[index] ?? '';
    });
    return record;
  });
}

async function extractInlineFilters() {
  const html = await readFileSafe(SOURCE_PATHS.inlineGear);
  if (!html) {
    return [];
  }
  const scriptMatch = html.match(/<script[^>]+id=["']filters-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!scriptMatch) {
    return [];
  }
  const payload = scriptMatch[1]?.trim();
  if (!payload) {
    return [];
  }
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[extract] Failed to parse inline filters JSON:', error.message);
    return [];
  }
}

async function loadJsonDataset() {
  const raw = await readFileSafe(SOURCE_PATHS.dataFiltersJson);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[extract] Failed to parse data/filters.json:', error.message);
    return [];
  }
}

async function loadCsvFragments() {
  const [rangesCsv, gearCsv] = await Promise.all([
    readFileSafe(SOURCE_PATHS.gearFiltersRangesCsv),
    readFileSafe(SOURCE_PATHS.gearFiltersCsv),
  ]);
  const fragments = [];
  if (rangesCsv) {
    fragments.push(...csvToObjects(rangesCsv));
  }
  if (gearCsv) {
    fragments.push(...csvToObjects(gearCsv));
  }
  return fragments;
}

function inferType(rawType, haystack) {
  const upper = typeof rawType === 'string' ? rawType.trim().toUpperCase() : '';
  if (ALLOWED_TYPES.includes(upper)) {
    return upper;
  }
  const text = typeof haystack === 'string' ? haystack : '';
  if (/sponge/i.test(text)) {
    return 'SPONGE';
  }
  if (/(canister|fx\d|oase|fluval\s*\d0\d)/i.test(text)) {
    return 'CANISTER';
  }
  if (/(hob|power\s*filter|tidal|aquaclear)/i.test(text)) {
    return 'HOB';
  }
  if (/internal/i.test(text)) {
    return 'INTERNAL';
  }
  if (/(undergravel|\bugf\b)/i.test(text)) {
    return 'UGF';
  }
  if (upper) {
    if (/UNDERGRAVEL/.test(upper)) {
      return 'UGF';
    }
    if (/SPONGE/.test(upper)) {
      return 'SPONGE';
    }
  }
  return 'HOB';
}

function extractGph(record) {
  const candidates = [
    record?.gphRated,
    record?.rated_gph,
    record?.ratedGph,
    record?.gph,
    record?.flow,
    record?.max_flow,
  ];
  for (const value of candidates) {
    const num = coerceNumber(value);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
  }
  const textFields = [record?.name, record?.model, record?.title, record?.Product_Name, record?.Notes];
  for (const field of textFields) {
    if (typeof field !== 'string') {
      continue;
    }
    const match = field.match(/(\d+(?:\.\d+)?)\s*(?:gph|gal\s*\/\s*hr|gallon(?:s)?\s*per\s*hour)/i);
    if (match) {
      const num = Number(match[1]);
      if (Number.isFinite(num) && num > 0) {
        return num;
      }
    }
  }
  return NaN;
}

function computeGallonsRange(gph) {
  if (!Number.isFinite(gph) || gph <= 0) {
    return { min: null, max: null };
  }
  const effective = gph * FLOW_DERATE;
  const min = Math.floor(effective / TURNOVER_MAX);
  const max = Math.ceil(effective / TURNOVER_MIN);
  const boundedMin = Number.isFinite(min) ? Math.max(MIN_GALLONS_FLOOR, min) : null;
  const boundedMax = Number.isFinite(max) ? Math.max(boundedMin ?? MIN_GALLONS_FLOOR, max) : null;
  return { min: boundedMin, max: boundedMax };
}

function buildLookupMaps(fragments) {
  const byName = new Map();
  const byId = new Map();
  for (const fragment of fragments) {
    if (!fragment) {
      continue;
    }
    const candidates = [];
    if (typeof fragment.Item_ID === 'string') {
      candidates.push(fragment.Item_ID);
    }
    if (typeof fragment.title === 'string') {
      candidates.push(fragment.title);
    }
    if (typeof fragment.Product_Name === 'string') {
      candidates.push(fragment.Product_Name);
    }
    if (typeof fragment.name === 'string') {
      candidates.push(fragment.name);
    }
    const url = fragment.Amazon_Link || fragment.amazon_url || fragment.url || '';
    const notes = fragment.Notes || fragment.Use_Case || fragment.notes || '';
    const image = fragment.Image_URL || fragment.image || '';
    const payload = {
      url: url ? url.trim() : '',
      notes: notes ? notes.trim() : '',
      image: image ? image.trim() : '',
    };
    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate.trim()) {
        continue;
      }
      const normalizedKey = normalizeNameKey(candidate);
      if (normalizedKey) {
        const existing = byName.get(normalizedKey) || {};
        byName.set(normalizedKey, {
          url: payload.url || existing.url || '',
          notes: payload.notes || existing.notes || '',
          image: payload.image || existing.image || '',
        });
      }
      const idKey = slugify(candidate);
      if (idKey) {
        const existingId = byId.get(idKey) || {};
        byId.set(idKey, {
          url: payload.url || existingId.url || '',
          notes: payload.notes || existingId.notes || '',
          image: payload.image || existingId.image || '',
        });
      }
    }
  }
  return { byName, byId };
}

function mergeRecordDetails(base, lookup) {
  if (!lookup) {
    return base;
  }
  const merged = { ...base };
  if (!merged.url && lookup.url) {
    merged.url = lookup.url;
  }
  if (!merged.notes && lookup.notes) {
    merged.notes = lookup.notes;
  }
  if (!merged.image && lookup.image) {
    merged.image = lookup.image;
  }
  return merged;
}

function normalizeRecord(record, lookupMaps) {
  if (!record) {
    return null;
  }
  const { byName, byId } = lookupMaps;
  const brand = typeof record.brand === 'string' && record.brand.trim()
    ? record.brand.trim()
    : typeof record.Brand === 'string' && record.Brand.trim()
      ? record.Brand.trim()
      : inferBrand(record?.name || record?.title || record?.Product_Name || '');
  const nameRaw = record?.name || record?.model || record?.title || record?.Product_Name || '';
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
  const haystack = [brand, name, record?.type, record?.Product_Type, record?.notes].filter(Boolean).join(' ');
  const typeDeclared = inferType(record?.type || record?.Product_Type || record?.subgroup, haystack);
  const gph = extractGph(record);
  if (!Number.isFinite(gph) || gph <= 0) {
    return null;
  }

  const { min, max } = computeGallonsRange(gph);
  const canonicalId = buildCanonicalId(brand, name, gph);
  const normalizedNameKey = normalizeNameKey(name || canonicalId);
  const lookupDetail = (normalizedNameKey && byName.get(normalizedNameKey)) || byId.get(slugify(record?.id || '')) || null;
  const normalized = mergeRecordDetails(
    {
      id: canonicalId,
      brand: brand || 'Unknown',
      name: name || canonicalId,
      typeDeclared,
      gphRated: Math.round(gph),
      minGallons: Number.isFinite(min) ? min : null,
      maxGallons: Number.isFinite(max) ? max : null,
      url: typeof record.url === 'string' ? record.url.trim() : '',
      image: typeof record.image === 'string' ? record.image.trim() : '',
      notes: typeof record.notes === 'string' ? record.notes.trim() : '',
    },
    lookupDetail,
  );
  return normalized;
}

function inferBrand(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return 'Unknown';
  }
  const trimmed = name.trim();
  const match = trimmed.match(/^[^\s\-–—]+/);
  if (!match) {
    return 'Unknown';
  }
  return match[0].replace(/[^A-Za-z0-9]/g, '') || 'Unknown';
}

function buildCanonicalId(brand, name, gph) {
  const brandSlug = slugify(brand || '');
  const nameSlug = slugify(name || '');
  const gphSlug = Number.isFinite(gph) && gph > 0 ? String(Math.round(gph)) : 'unknown';
  const parts = [brandSlug, nameSlug, gphSlug].filter(Boolean);
  if (!parts.length) {
    return `filter_${gphSlug}`;
  }
  return parts.join('_');
}

function dedupeRecords(records) {
  const map = new Map();
  for (const record of records) {
    if (!record) {
      continue;
    }
    const nameKey = canonicalNameKey(record.name) || canonicalNameKey(record.id);
    const key = `${slugify(record.brand)}|${nameKey}|${record.gphRated}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, record);
      continue;
    }
    const merged = { ...existing };
    if (!merged.url && record.url) {
      merged.url = record.url;
    }
    if (!merged.notes && record.notes) {
      merged.notes = record.notes;
    }
    if (!merged.image && record.image) {
      merged.image = record.image;
    }
    if ((!merged.minGallons || !Number.isFinite(merged.minGallons)) && Number.isFinite(record.minGallons)) {
      merged.minGallons = record.minGallons;
    }
    if ((!merged.maxGallons || !Number.isFinite(merged.maxGallons)) && Number.isFinite(record.maxGallons)) {
      merged.maxGallons = record.maxGallons;
    }
    map.set(key, merged);
  }
  return Array.from(map.values());
}

function sortCatalog(records) {
  return records.slice().sort((a, b) => {
    const typeA = TYPE_PRIORITY.has(a?.typeDeclared) ? TYPE_PRIORITY.get(a.typeDeclared) : TYPE_PRIORITY.size;
    const typeB = TYPE_PRIORITY.has(b?.typeDeclared) ? TYPE_PRIORITY.get(b.typeDeclared) : TYPE_PRIORITY.size;
    if (typeA !== typeB) {
      return typeA - typeB;
    }
    const brandCompare = (a?.brand || '').localeCompare(b?.brand || '');
    if (brandCompare !== 0) {
      return brandCompare;
    }
    return (a?.gphRated || 0) - (b?.gphRated || 0);
  });
}

function createSummary(catalog, sources) {
  const lines = [];
  const total = catalog.length;
  const gphValues = catalog.map((item) => item.gphRated).filter((value) => Number.isFinite(value));
  const minGph = gphValues.length ? Math.min(...gphValues) : null;
  const maxGph = gphValues.length ? Math.max(...gphValues) : null;
  const brandCounts = new Map();
  const typeCounts = new Map();
  for (const item of catalog) {
    if (item?.brand) {
      const key = item.brand;
      brandCounts.set(key, (brandCounts.get(key) || 0) + 1);
    }
    if (item?.typeDeclared) {
      const key = item.typeDeclared;
      typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
    }
  }
  const sortedBrands = Array.from(brandCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const sortedTypes = Array.from(typeCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  lines.push('# Filter Catalog Summary');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Sources: ${sources.join(', ') || 'unknown'}`);
  lines.push(`- Total filters: ${total}`);
  if (minGph != null && maxGph != null) {
    lines.push(`- Flow range: ${minGph}–${maxGph} GPH`);
  }
  lines.push('');
  lines.push('## Brands');
  if (sortedBrands.length) {
    sortedBrands.forEach(([brand, count]) => {
      lines.push(`- ${brand}: ${count}`);
    });
  } else {
    lines.push('- None');
  }
  lines.push('');
  lines.push('## Types');
  if (sortedTypes.length) {
    sortedTypes.forEach(([type, count]) => {
      lines.push(`- ${type}: ${count}`);
    });
  } else {
    lines.push('- None');
  }
  return `${lines.join('\n')}\n`;
}

async function validateCatalog(catalog) {
  const schemaRaw = await readFileSafe(OUTPUT_SCHEMA);
  if (!schemaRaw) {
    throw new Error(`Schema not found at ${path.relative(ROOT_DIR, OUTPUT_SCHEMA)}`);
  }
  let schema;
  try {
    schema = JSON.parse(schemaRaw);
  } catch (error) {
    throw new Error(`Invalid JSON schema at ${OUTPUT_SCHEMA}: ${error.message}`);
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(catalog);
  if (!valid) {
    const messages = (validate.errors || []).map((err) => `${err.instancePath || '(root)'} ${err.message}`);
    throw new Error(`Catalog validation failed:\n${messages.join('\n')}`);
  }
}

function toSerializable(record) {
  const output = {
    id: record.id,
    brand: record.brand,
    name: record.name,
    typeDeclared: record.typeDeclared,
    gphRated: record.gphRated,
    minGallons: record.minGallons,
    maxGallons: record.maxGallons,
  };
  if (record.url) {
    output.url = record.url;
  }
  if (record.image) {
    output.image = record.image;
  }
  if (record.notes) {
    output.notes = record.notes;
  }
  return output;
}

async function scrapeGearFallback() {
  const html = await readFileSafe(SOURCE_PATHS.inlineGear);
  if (!html) {
    return [];
  }
  const itemRegex = /<li[^>]*data-product[^>]*>([\s\S]*?)<\/li>/gi;
  const items = [];
  let match = itemRegex.exec(html);
  while (match) {
    const block = match[1];
    const nameMatch = block.match(/<h[34][^>]*>(.*?)<\/h[34]>/i);
    const brandMatch = block.match(/data-brand=["']([^"']+)["']/i);
    const gphMatch = block.match(/(\d+(?:\.\d+)?)\s*(?:gph|gal\s*\/\s*hr)/i);
    const urlMatch = block.match(/href=["']([^"']+)["']/i);
    const name = nameMatch ? stripHtml(nameMatch[1]) : '';
    const brand = brandMatch ? brandMatch[1] : inferBrand(name);
    const gph = gphMatch ? Number(gphMatch[1]) : NaN;
    const url = urlMatch ? urlMatch[1] : '';
    if (!name || !Number.isFinite(gph) || gph <= 0) {
      match = itemRegex.exec(html);
      continue;
    }
    items.push({
      brand,
      name,
      gphRated: gph,
      url,
    });
    match = itemRegex.exec(html);
  }
  return items;
}

function stripHtml(value) {
  return typeof value === 'string' ? value.replace(/<[^>]+>/g, '').trim() : '';
}

async function main() {
  const sourcesUsed = [];
  let rawRecords = await extractInlineFilters();
  if (rawRecords.length) {
    sourcesUsed.push('gear/index inline JSON');
  }

  const fragments = await loadCsvFragments();
  const lookupMaps = buildLookupMaps(fragments);

  if (!rawRecords.length) {
    const jsonDataset = await loadJsonDataset();
    if (jsonDataset.length) {
      sourcesUsed.push('data/filters.json');
      rawRecords = rawRecords.concat(jsonDataset);
    }
    if (fragments.length) {
      sourcesUsed.push('data/gear_filters*.csv');
      rawRecords = rawRecords.concat(fragments);
    }
  }

  if (!rawRecords.length) {
    const scraped = await scrapeGearFallback();
    if (scraped.length) {
      sourcesUsed.push('scraped gear page');
      rawRecords = scraped;
    }
  }

  const normalized = rawRecords
    .map((record) => normalizeRecord(record, lookupMaps))
    .filter(Boolean);
  const deduped = dedupeRecords(normalized);
  const sorted = sortCatalog(deduped);

  if (!sorted.length) {
    console.warn('[extract] No filter records could be normalized.');
  }

  await validateCatalog(sorted.map(toSerializable));

  const summary = createSummary(sorted, sourcesUsed);

  console.log(`Normalized ${sorted.length} filter products.`);
  console.log(summary);

  if (isDryRun) {
    console.log('[extract] Dry run mode — no files written.');
    return;
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPayload = JSON.stringify(sorted.map(toSerializable), null, 2);
  await fs.writeFile(OUTPUT_JSON, `${jsonPayload}\n`, 'utf8');
  await fs.writeFile(OUTPUT_SUMMARY, summary, 'utf8');
  console.log(`[extract] Wrote catalog to ${path.relative(ROOT_DIR, OUTPUT_JSON)}`);
  console.log(`[extract] Wrote summary to ${path.relative(ROOT_DIR, OUTPUT_SUMMARY)}`);
}

main().catch((error) => {
  console.error('[extract] Fatal error:', error.message);
  process.exitCode = 1;
});
