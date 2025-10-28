import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'audit_out');

const SOURCE_FILES = [
  { path: 'data/filters.json', kind: 'prototype', parser: parsePrototypeCatalog },
  { path: 'data/gear_filtration.csv', kind: 'gear', parser: parseGearFiltrationCsv },
  { path: 'data/gear_filters_ranges.csv', kind: 'gear', parser: parseGearFiltersRangesCsv },
  { path: 'data/gear_filters.csv', kind: 'gear', parser: parseGearFiltersCsv },
  { path: 'data/gear_master.csv', kind: 'gear', parser: parseGearFiltrationCsv },
  { path: 'reports/samples_after.csv', kind: 'reports', parser: parseGearFiltrationCsv },
  { path: 'data/raw/exportedList_1K6C25CO6ESSX.csv', kind: 'raw', parser: parseAmazonExportCsv },
];

const BRAND_SYNONYMS = new Map([
  ['aquaneat', 'AQUANEAT'],
  ['aquaclear', 'AquaClear'],
  ['seachem', 'Seachem'],
  ['sicce', 'Sicce'],
  ['fluval', 'Fluval'],
  ['oase', 'Oase'],
  ['aqueon', 'Aqueon'],
  ['tetra', 'Tetra'],
  ['marineland', 'MarineLand'],
  ['marine land', 'MarineLand'],
  ['sun sun', 'SunSun'],
  ['sunsun', 'SunSun'],
  ['powkoo', 'Powkoo'],
  ['xy', 'XY'],
  ['pawfly', 'Pawfly'],
  ['hygger', 'Hygger'],
  ['cascade', 'Cascade'],
  ['eheim', 'Eheim'],
  ['polar aurora', 'Polar Aurora'],
  ['penn-plax', 'Penn-Plax'],
  ['penn plax', 'Penn-Plax'],
  ['sea chem', 'Seachem'],
]);

const BRAND_TOKENS = new Set(
  Array.from(BRAND_SYNONYMS.keys()).flatMap((key) => key.split(/\s+/)).concat(
    Array.from(BRAND_SYNONYMS.values()).flatMap((value) => value.toLowerCase().split(/\s+/))
  )
);

const TYPE_ALIASES = new Map([
  ['HOB', 'HOB'],
  ['HANG-ON-BACK FILTER', 'HOB'],
  ['HANG ON BACK FILTER', 'HOB'],
  ['HANG-ON FILTER', 'HOB'],
  ['HANG ON FILTER', 'HOB'],
  ['POWER FILTER', 'HOB'],
  ['CANISTER FILTER', 'CANISTER'],
  ['CANISTER', 'CANISTER'],
  ['SPONGE FILTER', 'SPONGE'],
  ['SPONGE', 'SPONGE'],
  ['DUAL SPONGE FILTER', 'SPONGE'],
  ['INTERNAL FILTER', 'INTERNAL'],
  ['INTERNAL', 'INTERNAL'],
  ['UNDERGRAVEL FILTER', 'UGF'],
  ['UNDER-GRAVEL FILTER', 'UGF'],
  ['UNDERGRAVEL', 'UGF'],
  ['UGF', 'UGF'],
  ['POWERHEAD', 'INTERNAL'],
]);

const NAME_STOPWORDS = new Set([
  'aquarium',
  'filter',
  'filters',
  'hang',
  'on',
  'back',
  'power',
  'canister',
  'internal',
  'sponge',
  'undergravel',
  'under',
  'gravel',
  'bio',
  'wheel',
  'external',
  'performance',
  'high',
  'thermo',
  'dual',
  'single',
  'up',
  'to',
  'gallon',
  'gallons',
  'tank',
  'fish',
  'quietflow',
  'quiet',
  'led',
  'foam',
  'nano',
  'kit',
  'system',
  'option',
  'option',
  'option',
  'option',
  'option',
]);

const canonicalMap = new Map();
const sourceCounts = new Map();
const nameGroupMap = new Map();
const dropdownRecords = [];
let missingGphEntries = [];
let typeMismatchEntries = [];
let missingFieldEntries = [];

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function slugify(value) {
  if (!value) return '';
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || 'filter-item';
}

function parseGphValue(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return Math.round(value);
    return 0;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) return 0;
    const direct = Number.parseInt(cleaned, 10);
    if (Number.isFinite(direct)) return direct;
    const gphMatch = cleaned.replace(/,/g, '').match(/(\d{2,4})(?=\s*(?:gph|g\/h|gph|gph\b))/i);
    if (gphMatch) {
      return Number.parseInt(gphMatch[1], 10);
    }
    const numbers = cleaned.replace(/,/g, '').match(/\b(\d{2,4})\b/);
    if (numbers) {
      return Number.parseInt(numbers[1], 10);
    }
  }
  return 0;
}

function normalizeType(value) {
  if (typeof value !== 'string') return '';
  const upper = value.trim().toUpperCase();
  if (!upper) return '';
  if (TYPE_ALIASES.has(upper)) {
    return TYPE_ALIASES.get(upper);
  }
  return upper;
}

function inferType(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return 'OTHER';
  }
  const lower = name.toLowerCase();
  if (/canister/.test(lower)) return 'CANISTER';
  if (/\b(hob|hang\s*on|hang-on|power filter)\b/.test(lower)) return 'HOB';
  if (/sponge/.test(lower)) return 'SPONGE';
  if (/internal/.test(lower)) return 'INTERNAL';
  if (/(ugf|under\s*-?gravel)/.test(lower)) return 'UGF';
  return 'OTHER';
}

function normalizeBrand(value) {
  if (!value) return '';
  const trimmed = value.toString().trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (BRAND_SYNONYMS.has(lower)) {
    return BRAND_SYNONYMS.get(lower);
  }
  const cleaned = lower.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (BRAND_SYNONYMS.has(cleaned)) {
    return BRAND_SYNONYMS.get(cleaned);
  }
  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferBrand(name) {
  if (typeof name !== 'string') return '';
  const lower = name.toLowerCase();
  for (const [key, brand] of BRAND_SYNONYMS.entries()) {
    const pattern = key.replace(/\s+/g, '\\s*');
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    if (regex.test(lower)) {
      return brand;
    }
  }
  return '';
}

function tokenizeName(name) {
  if (!name) return [];
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function extractNumberTokens(name) {
  return tokenizeName(name).filter((token) => /\d/.test(token));
}

function normalizeNameForKey(name) {
  const tokens = tokenizeName(name).filter(
    (token) => !NAME_STOPWORDS.has(token) && !BRAND_TOKENS.has(token)
  );
  return tokens.join(' ');
}

function normalizeForComparison(name) {
  const tokens = tokenizeName(name).filter(
    (token) => !NAME_STOPWORDS.has(token) && !BRAND_TOKENS.has(token)
  );
  return tokens.join(' ');
}

function findLineNumber(lines, searchValues) {
  if (!Array.isArray(lines)) return null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (searchValues.some((value) => value && line.includes(value))) {
      return index + 1;
    }
  }
  return null;
}

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  let lineNumber = 1;

  const pushField = () => {
    row.push(field);
    field = '';
  };

  const pushRow = () => {
    rows.push({ fields: row, line: lineNumber });
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        const next = text[index + 1];
        if (next === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n') {
          lineNumber += 1;
        }
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      pushField();
      continue;
    }

    if (char === '\n') {
      pushField();
      pushRow();
      lineNumber += 1;
      continue;
    }

    if (char === '\r') {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }

  return rows;
}

function csvRowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].fields.map((header) => header.trim());
  const dataRows = rows.slice(1);
  return dataRows.map(({ fields, line }) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = fields[index] ?? '';
    });
    return { record, line };
  });
}

function parsePrototypeCatalog({ text, lines, relPath }) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const rawId = typeof item?.id === 'string' ? item.id.trim() : '';
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const brand = typeof item?.brand === 'string' ? item.brand.trim() : '';
    const gph = parseGphValue(item?.rated_gph);
    const typeDeclared = normalizeType(item?.type ?? '');
    const searchValues = [];
    if (rawId) searchValues.push(`"${rawId}"`);
    if (name) searchValues.push(name.split(' ')[0]);
    const line = findLineNumber(lines, searchValues);
    return {
      id: rawId || slugify(name),
      name,
      brand,
      gphRated: gph,
      typeDeclared,
      typeInferred: null,
      source: relPath,
      line,
      notes: [],
      originalId: rawId,
    };
  });
}

function isFilterCategory(record) {
  const category = (record.Category || record.category || '').toString().trim().toLowerCase();
  if (!category) return true;
  return category === 'filtration' || category === 'filters';
}

function parseGearFiltrationCsv({ text, relPath }) {
  const rows = csvRowsToObjects(parseCsv(text));
  return rows
    .map(({ record, line }) => {
      if (!isFilterCategory(record)) return null;
      const name = (record['Product_Name'] || record['Product Name'] || '').trim();
      if (!name) return null;
      const asin = (record.ASIN || '').trim();
      const typeDeclared = normalizeType(record['Product_Type'] || record['Product Type'] || '');
      const gph = parseGphValue(record['Recommended_Specs'] || record['Recommended Specs'] || '');
      return {
        id: asin || slugify(name),
        name,
        brand: '',
        gphRated: gph,
        typeDeclared,
        typeInferred: null,
        source: relPath,
        line,
        notes: asin ? [] : ['Missing ASIN'],
        originalId: asin,
      };
    })
    .filter(Boolean);
}

function parseGearFiltersRangesCsv({ text, relPath }) {
  const rows = csvRowsToObjects(parseCsv(text));
  return rows
    .map(({ record, line }) => {
      if (!isFilterCategory(record)) return null;
      const name = (record['Product_Name'] || record['Product Name'] || record['Product'] || '').trim();
      if (!name) return null;
      const id = (record['Item_ID'] || record['Item ID'] || record['Range_ID'] || record['Range ID'] || '').trim();
      const typeDeclared = normalizeType(record['Product_Type'] || record['Product Type'] || '');
      const gph = parseGphValue(record['Recommended_Specs'] || record['Recommended Specs'] || '');
      return {
        id: id || slugify(name),
        name,
        brand: '',
        gphRated: gph,
        typeDeclared,
        typeInferred: null,
        source: relPath,
        line,
        notes: id ? [] : ['Missing Item_ID'],
        originalId: id,
      };
    })
    .filter(Boolean);
}

function parseGearFiltersCsv({ text, relPath }) {
  const rows = csvRowsToObjects(parseCsv(text));
  return rows
    .map(({ record, line }) => {
      const name = (record.title || '').trim();
      if (!name) return null;
      const id = (record.bucket_key || record.bucketKey || '').trim();
      const gph = parseGphValue(record.notes || '');
      const notes = [];
      if ((record.subgroup || '').toLowerCase().includes('media')) {
        notes.push('Filter media entry');
      }
      return {
        id: id || slugify(name),
        name,
        brand: '',
        gphRated: gph,
        typeDeclared: '',
        typeInferred: null,
        source: relPath,
        line,
        notes,
        originalId: id,
      };
    })
    .filter(Boolean);
}

function parseAmazonExportCsv({ text, relPath }) {
  const rows = csvRowsToObjects(parseCsv(text));
  return rows
    .map(({ record, line }) => {
      const name = (record.Title || '').trim();
      if (!name) return null;
      const lower = name.toLowerCase();
      if (!/(filter|sponge|tidal|quietflow|canister)/.test(lower)) {
        return null;
      }
      const asin = (record.ASIN || '').trim();
      return {
        id: asin || slugify(name),
        name,
        brand: '',
        gphRated: 0,
        typeDeclared: '',
        typeInferred: null,
        source: relPath,
        line,
        notes: asin ? [] : ['Missing ASIN'],
        originalId: asin,
      };
    })
    .filter(Boolean);
}

function mergeEntry(entry) {
  const nameKey = normalizeNameForKey(entry.name);
  const gph = Number.isFinite(entry.gphRated) ? entry.gphRated : 0;
  const key = `${nameKey}::${gph}`;

  if (!nameGroupMap.has(nameKey)) {
    nameGroupMap.set(nameKey, new Map());
  }
  const gphMap = nameGroupMap.get(nameKey);
  if (!gphMap.has(gph)) {
    gphMap.set(gph, []);
  }
  gphMap.get(gph).push(entry);

  if (!canonicalMap.has(key)) {
    canonicalMap.set(key, {
      id: entry.id,
      name: entry.name,
      brand: entry.brand,
      gphRated: gph,
      typeDeclared: entry.typeDeclared,
      typeInferred: entry.typeInferred,
      notes: new Set(entry.notes || []),
      sources: [
        {
          path: entry.source,
          line: entry.line,
        },
      ],
      comparisonKey: normalizeForComparison(entry.name),
      brandSource: entry.brandSource || '',
    });
    return;
  }

  const existing = canonicalMap.get(key);
  existing.sources.push({ path: entry.source, line: entry.line });
  if (!existing.brand && entry.brand) {
    existing.brand = entry.brand;
    existing.brandSource = entry.brandSource || '';
  }
  if (!existing.typeDeclared && entry.typeDeclared) {
    existing.typeDeclared = entry.typeDeclared;
  }
  if ((!existing.typeInferred || existing.typeInferred === 'OTHER') && entry.typeInferred && entry.typeInferred !== 'OTHER') {
    existing.typeInferred = entry.typeInferred;
  }
  (entry.notes || []).forEach((note) => existing.notes.add(note));
}

function collectDropdownRecord(entry) {
  const tokens = tokenizeName(entry.name);
  dropdownRecords.push({
    id: entry.id,
    name: entry.name,
    brand: entry.brand,
    nameKey: normalizeNameForKey(entry.name),
    tokens: new Set(tokens),
    numbers: new Set(tokens.filter((token) => /\d/.test(token))),
  });
}

function processSources() {
  SOURCE_FILES.forEach((source) => {
    const fullPath = path.join(ROOT_DIR, source.path);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[audit] Skipping missing file: ${source.path}`);
      return;
    }
    const text = fs.readFileSync(fullPath, 'utf8');
    const lines = text.split(/\r?\n/);
    const entries = source.parser({ text, lines, relPath: source.path });
    sourceCounts.set(source.path, entries.length);

    entries.forEach((rawEntry) => {
      const entry = { ...rawEntry };
      entry.name = (entry.name || '').trim();
      if (!entry.name) {
        return;
      }
      const normalizedBrand = normalizeBrand(entry.brand || '') || '';
      const inferredBrand = inferBrand(entry.name);
      if (!normalizedBrand && inferredBrand) {
        entry.brand = inferredBrand;
        entry.brandSource = 'inferred';
        entry.notes = [...(entry.notes || []), 'Brand inferred from name'];
      } else if (normalizedBrand) {
        entry.brand = normalizedBrand;
        if (entry.brand && inferredBrand && entry.brand !== inferredBrand) {
          entry.notes = [...(entry.notes || []), `Brand differs from inferred (${inferredBrand})`];
        }
      } else {
        entry.brand = '';
      }

      entry.gphRated = Number.isFinite(entry.gphRated) ? Math.round(entry.gphRated) : parseGphValue(entry.gphRated);
      if (!Number.isFinite(entry.gphRated)) {
        entry.gphRated = parseGphValue(entry.gphRated);
      }
      if (!Number.isFinite(entry.gphRated)) {
        entry.gphRated = 0;
      }

      entry.typeDeclared = normalizeType(entry.typeDeclared || '');
      entry.typeInferred = entry.typeInferred || inferType(entry.name);

      if (entry.gphRated <= 0) {
        entry.notes = [...(entry.notes || []), 'Missing rated_gph'];
      }

      if (!entry.originalId) {
        entry.notes = [...(entry.notes || []), 'Generated id from name'];
      }

      if (source.path === 'data/filters.json') {
        collectDropdownRecord({
          id: entry.id,
          name: entry.name,
          brand: entry.brand,
        });
      }

      mergeEntry(entry);
    });
  });
}

function buildCanonicalList() {
  return Array.from(canonicalMap.values()).map((entry) => ({
    id: entry.id,
    name: entry.name,
    brand: entry.brand || '',
    gphRated: entry.gphRated,
    typeDeclared: entry.typeDeclared || '',
    typeInferred: entry.typeInferred || inferType(entry.name),
    sources: entry.sources,
    sourcePaths: entry.sources.map((source) =>
      source.line ? `${source.path}:${source.line}` : source.path
    ),
    notes: Array.from(entry.notes || []),
    comparisonKey: entry.comparisonKey,
  }));
}

function buildDropdownCoverage(canonicalList) {
  const dropdownNameKeys = new Set(dropdownRecords.map((record) => record.nameKey));
  return canonicalList.map((entry) => {
    const entryKey = normalizeNameForKey(entry.name);
    const inDropdown = entry.sourcePaths.some((source) => source.startsWith('data/filters.json'))
      || dropdownNameKeys.has(entryKey)
      || isCoveredByDropdown(entry);
    return { ...entry, inDropdown };
  });
}

function isCoveredByDropdown(entry) {
  const entryTokens = new Set(tokenizeName(entry.name));
  const entryNumbers = new Set(Array.from(entryTokens).filter((token) => /\d/.test(token)));
  const entryBrand = entry.brand ? entry.brand.toLowerCase() : '';
  for (const record of dropdownRecords) {
    const brandMatch = !entryBrand || !record.brand || record.brand.toLowerCase() === entryBrand;
    const numberOverlap = Array.from(entryNumbers).some((token) => record.numbers.has(token));
    if (brandMatch && numberOverlap) {
      return true;
    }
    const entryKey = entry.comparisonKey || normalizeForComparison(entry.name);
    const recordKey = normalizeForComparison(record.name);
    if (entryKey && recordKey && (entryKey.includes(recordKey) || recordKey.includes(entryKey))) {
      return true;
    }
  }
  return false;
}

function buildTypeCounts(entries, field) {
  const counts = new Map();
  entries.forEach((entry) => {
    const value = entry[field] ? entry[field] : 'UNKNOWN';
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
}

function buildBrandCounts(entries) {
  const counts = new Map();
  entries.forEach((entry) => {
    const brand = entry.brand ? entry.brand : 'Unknown';
    counts.set(brand, (counts.get(brand) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([brand, count]) => ({ brand, count }));
}

function buildDuplicateIssues() {
  const duplicates = [];
  nameGroupMap.forEach((gphMap, nameKey) => {
    if (gphMap.size <= 1) return;
    const variants = Array.from(gphMap.entries()).map(([gph, entries]) => ({ gph, entries }));
    duplicates.push({
      nameKey,
      variants,
    });
  });
  return duplicates;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function writeCsv(filePath, entries) {
  const headers = ['id', 'name', 'gphRated', 'typeDeclared', 'typeInferred', 'brand', 'sourcePaths'];
  const rows = [headers.join(',')];
  entries.forEach((entry) => {
    const values = headers.map((header) => {
      if (header === 'sourcePaths') {
        return escapeCsv(entry.sourcePaths.join(' | '));
      }
      return escapeCsv(entry[header] ?? '');
    });
    rows.push(values.join(','));
  });
  fs.writeFileSync(filePath, `${rows.join('\n')}\n`, 'utf8');
}

function formatMarkdownTable(rows, headers) {
  if (!rows.length) {
    return 'None\n';
  }
  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return `${headerRow}\n${separator}\n${body}\n`;
}

function writeSummary(entries, coverage) {
  const summaryLines = [];
  const typeDeclared = buildTypeCounts(entries, 'typeDeclared');
  const typeInferred = buildTypeCounts(entries, 'typeInferred');
  const brandCounts = buildBrandCounts(entries);
  const missingDropdown = coverage.filter((entry) => !entry.inDropdown);

  summaryLines.push('# Filter Inventory Summary');
  summaryLines.push('');
  summaryLines.push(`- Total unique products: **${entries.length}**`);
  summaryLines.push(`- Source files processed: **${SOURCE_FILES.length}**`);
  summaryLines.push(`- Products missing rated GPH: **${missingGphEntries.length}**`);
  summaryLines.push(`- Type mismatches (declared vs inferred): **${typeMismatchEntries.length}**`);
  summaryLines.push(`- Products not wired to prototype dropdown: **${missingDropdown.length}**`);
  summaryLines.push('');
  summaryLines.push('## Counts by Declared Type');
  summaryLines.push(formatMarkdownTable(typeDeclared.map(({ type, count }) => [type, String(count)]), ['Type', 'Count']));
  summaryLines.push('');
  summaryLines.push('## Counts by Inferred Type');
  summaryLines.push(formatMarkdownTable(typeInferred.map(({ type, count }) => [type, String(count)]), ['Type', 'Count']));
  summaryLines.push('');
  summaryLines.push('## Brand Coverage');
  summaryLines.push(formatMarkdownTable(brandCounts.map(({ brand, count }) => [brand, String(count)]), ['Brand', 'Count']));
  summaryLines.push('');
  summaryLines.push('## Key Findings');
  summaryLines.push('- Highlighted issues are detailed in `issues.md` (duplicates, missing GPH, type mismatches, missing fields).');
  summaryLines.push('- `missing_in_dropdown.md` lists catalog entries absent from the prototype UI dropdown.');
  summaryLines.push('');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.md'), `${summaryLines.join('\n')}\n`, 'utf8');
}

function writeMissingDropdown(coverage) {
  const missing = coverage.filter((entry) => !entry.inDropdown);
  const lines = ['# Products Missing from Prototype Dropdown', ''];
  if (!missing.length) {
    lines.push('All products are available in the prototype dropdown.');
  } else {
    const rows = missing.map((entry) => [
      entry.name,
      entry.brand || 'Unknown',
      entry.gphRated ? String(entry.gphRated) : '0',
      entry.sourcePaths.join('<br>'),
    ]);
    lines.push(
      formatMarkdownTable(rows, ['Name', 'Brand', 'GPH Rated', 'Sources'])
    );
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'missing_in_dropdown.md'), `${lines.join('\n')}\n`, 'utf8');
}

function writeIssues(entries) {
  const lines = ['# Filter Inventory Issues', ''];

  const duplicates = buildDuplicateIssues();
  lines.push('## Duplicate Products with Conflicting GPH');
  if (!duplicates.length) {
    lines.push('None.');
  } else {
    duplicates.forEach((group) => {
      lines.push(`- **${group.nameKey}**`);
      group.variants.forEach((variant) => {
        const sourceList = variant.entries
          .map((entry) => `${entry.source}${entry.line ? `:${entry.line}` : ''}`)
          .join(', ');
        lines.push(`  - ${variant.gph || 0} GPH — ${sourceList}`);
      });
    });
  }
  lines.push('');

  lines.push('## Missing or Zero Rated GPH');
  if (!missingGphEntries.length) {
    lines.push('None.');
  } else {
    missingGphEntries.forEach((item) => {
      const sourceText = Array.isArray(item.sources) && item.sources.length ? item.sources.join(', ') : 'Unknown source';
      lines.push(`- ${item.name} (${item.brand || 'Unknown'}) — ${sourceText}`);
    });
  }
  lines.push('');

  lines.push('## Type Mismatches (Declared vs Inferred)');
  if (!typeMismatchEntries.length) {
    lines.push('None.');
  } else {
    typeMismatchEntries.forEach((item) => {
      const sourceText = Array.isArray(item.sources) && item.sources.length ? item.sources.join(', ') : 'Unknown source';
      lines.push(`- ${item.name} — Declared: ${item.declared || 'N/A'}, Inferred: ${item.inferred || 'N/A'} (${sourceText})`);
    });
  }
  lines.push('');

  lines.push('## Missing Fields');
  if (!missingFieldEntries.length) {
    lines.push('None.');
  } else {
    missingFieldEntries.forEach((item) => {
      const sourceText = Array.isArray(item.sources) && item.sources.length ? item.sources.join(', ') : 'Unknown source';
      lines.push(`- ${item.name} — Missing ${item.field} (${sourceText})`);
    });
  }
  lines.push('');

  fs.writeFileSync(path.join(OUTPUT_DIR, 'issues.md'), `${lines.join('\n')}\n`, 'utf8');
}

function writeSources() {
  const rows = Array.from(sourceCounts.entries()).map(([file, count]) => [file, String(count)]);
  const lines = ['# Source Files Scanned', '', formatMarkdownTable(rows, ['File', 'Entries Found'])];
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sources.md'), `${lines.join('\n')}\n`, 'utf8');
}

function collectIssueSummaries(entries) {
  missingGphEntries = entries
    .filter((entry) => entry.gphRated <= 0)
    .map((entry) => ({
      name: entry.name,
      brand: entry.brand,
      sources: entry.sourcePaths,
    }));

  typeMismatchEntries = entries
    .filter((entry) => entry.typeDeclared && entry.typeInferred && entry.typeDeclared !== entry.typeInferred)
    .map((entry) => ({
      name: entry.name,
      declared: entry.typeDeclared,
      inferred: entry.typeInferred,
      sources: entry.sourcePaths,
    }));

  missingFieldEntries = entries
    .filter((entry) => !entry.brand)
    .map((entry) => ({
      name: entry.name,
      field: 'brand',
      sources: entry.sourcePaths,
    }));
}

function writeBrandsFile(entries) {
  const brandCounts = buildBrandCounts(entries);
  const lines = ['# Brand Coverage', '', formatMarkdownTable(brandCounts.map(({ brand, count }) => [brand, String(count)]), ['Brand', 'Count'])];
  fs.writeFileSync(path.join(OUTPUT_DIR, 'brands.md'), `${lines.join('\n')}\n`, 'utf8');
}

function writeTypeCoverage(entries) {
  const typeDeclared = buildTypeCounts(entries, 'typeDeclared');
  const typeInferred = buildTypeCounts(entries, 'typeInferred');
  const lines = ['# Filter Type Coverage', ''];
  lines.push('## Declared Types');
  lines.push(formatMarkdownTable(typeDeclared.map(({ type, count }) => [type, String(count)]), ['Type', 'Count']));
  lines.push('');
  lines.push('## Inferred Types');
  lines.push(formatMarkdownTable(typeInferred.map(({ type, count }) => [type, String(count)]), ['Type', 'Count']));
  lines.push('');
  lines.push('**Recommendation:** Ensure INTERNAL and UGF categories have at least one curated product in the prototype dropdown for completeness.');
  lines.push('');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'type-coverage.md'), `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  ensureOutputDir();
  processSources();
  const canonicalList = buildCanonicalList();
  const coverage = buildDropdownCoverage(canonicalList);
  collectIssueSummaries(coverage);
  writeJson(path.join(OUTPUT_DIR, 'filters.json'), coverage.map(({ comparisonKey, ...rest }) => rest));
  writeCsv(path.join(OUTPUT_DIR, 'filters.csv'), coverage.map(({ comparisonKey, ...rest }) => rest));
  writeSummary(canonicalList, coverage);
  writeMissingDropdown(coverage);
  writeIssues(canonicalList);
  writeSources();
  writeBrandsFile(canonicalList);
  writeTypeCoverage(canonicalList);
}

main();
