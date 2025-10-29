import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_CSV_PATH = path.join(ROOT_DIR, 'audit_out', 'filters.csv');
const DEFAULT_TARGET_PATH = path.join(ROOT_DIR, 'prototype', 'assets', 'data', 'filters_catalog.json');
const DEFAULT_FALLBACK_MODULE_PATH = path.join(ROOT_DIR, 'prototype', 'js', 'catalog-fallback.js');

const TYPE_ORDER = Object.freeze({
  CANISTER: 0,
  HOB: 1,
  INTERNAL: 2,
  SPONGE: 3,
  UGF: 4,
  POWERHEAD: 5,
  OTHER: 6,
});

const VALID_TYPES = new Set(Object.keys(TYPE_ORDER));

const TYPE_ALIASES = new Map([
  ['HANG-ON-BACK', 'HOB'],
  ['HANG ON BACK', 'HOB'],
  ['POWER FILTER', 'HOB'],
  ['POWERFILTER', 'HOB'],
  ['HANGONBACK', 'HOB'],
  ['BACKPACK', 'HOB'],
  ['SPONGEFILTER', 'SPONGE'],
  ['UNDERGRAVEL', 'UGF'],
  ['UNDER-GRAVEL', 'UGF'],
  ['UNDER GRAVEL', 'UGF'],
  ['POWERHEAD', 'INTERNAL'],
  ['IN-TANK', 'INTERNAL'],
]);

const TYPE_KEYWORDS = new Map([
  ['CANISTER', ['CANISTER', 'EXTERNAL']],
  ['HOB', ['HANG-ON', 'HANG ON', 'POWER FILTER', 'BACKPACK']],
  ['SPONGE', ['SPONGE']],
  ['INTERNAL', ['INTERNAL', 'POWERHEAD']],
  ['UGF', ['UNDERGRAVEL', 'UNDER-GRAVEL', 'UNDER GRAVEL', 'UGF']],
]);

const PRIMARY_ID_ALIASES = new Map([
  ['B0002566WY', 'aquaclear-50'],
  ['B08N4G6GRH', 'aqueon-quietflow-200'],
  ['B0BR8HH7ND', 'cascade-1500'],
  ['B005QRDCP2', 'eheim-2213'],
  ['B07KXJGDLT', 'fluval-107'],
  ['B09R7MDG8M', 'fluval-fx4'],
  ['B08F2Z4M6W', 'hygger-quiet-power-filter'],
  ['B07PHLZYRZ', 'marineland-penguin-350'],
  ['B01M0N8FPT', 'seachem-tidal-55'],
  ['B081V6B7LN', 'sunsun-hw-3000'],
  ['B0B3QFMG6M', 'tetra-whisper-iq-45'],
  ['filters-g-5-10-01', 'pawfly-sponge-10'],
  ['filters-g-5-10-02', 'hygger-double-sponge-s'],
  ['filters-g-5-10-03', 'aquaclear-30'],
  ['filters-g-10-20-02', 'hygger-double-sponge-m'],
  ['filters-g-10-20-03', 'aquaneat-sponge-20'],
  ['filters-g-20-40-02', 'seachem-tidal-35'],
  ['filters-g-20-40-03', 'fluval-c2'],
  ['filters-g-40-60-01', 'aquaneat-sponge-60'],
  ['filters-g-40-60-02', 'seachem-tidal-55'],
  ['filters-g-40-60-03', 'aquaclear-70'],
  ['filters-g-60-90-01', 'aqueon-quietflow-75'],
  ['filters-g-60-90-02', 'fluval-407'],
  ['filters-g-60-90-03', 'marineland-penguin-350'],
  ['filters-g-90-125-01', 'fluval-fx2'],
  ['filters-g-90-125-03', 'seachem-tidal-110'],
  ['penn-plax-undergravel-aquarium-filter-for-20-long-29-gallon-tanks-two-14-x-11-1-plates', 'penn-plax-ugf-20-29'],
]);

const RATED_GPH_OVERRIDES = new Map([
  ['aquaclear-30', 150],
  ['aquaclear-50', 200],
  ['aquaclear-70', 300],
  ['aquaneat-sponge-10', 60],
  ['aquaneat-sponge-20', 120],
  ['aquaneat-sponge-60', 200],
  ['aqueon-quietflow-75', 400],
  ['aqueon-quietflow-200', 200],
  ['cascade-1500', 350],
  ['eheim-2213', 116],
  ['fluval-107', 145],
  ['fluval-207', 206],
  ['fluval-307', 303],
  ['fluval-407', 383],
  ['fluval-fx2', 475],
  ['fluval-fx4', 700],
  ['fluval-c2', 119],
  ['hygger-double-sponge-s', 80],
  ['hygger-double-sponge-m', 120],
  ['hygger-quiet-power-filter', 260],
  ['marineland-penguin-350', 350],
  ['oase-biomaster-250', 250],
  ['oase-biomaster-600', 320],
  ['pawfly-sponge-10', 60],
  ['penn-plax-ugf-20-29', 150],
  ['powkoo-dual-sponge-40', 150],
  ['seachem-tidal-35', 130],
  ['seachem-tidal-55', 250],
  ['seachem-tidal-75', 350],
  ['seachem-tidal-110', 450],
  ['sunsun-hw-3000', 793],
  ['tetra-whisper-iq-45', 260],
]);

const NAME_OVERRIDES = new Map([
  ['aquaclear-30', 'AquaClear 30 Power Filter'],
  ['aquaclear-50', 'AquaClear 50 Power Filter'],
  ['aquaclear-70', 'AquaClear 70 Power Filter'],
  ['aquaneat-sponge-10', 'AQUANEAT Single Sponge Filter (Up to 10G)'],
  ['aquaneat-sponge-20', 'AQUANEAT Single Sponge Filter (Up to 20G)'],
  ['aquaneat-sponge-60', 'AQUANEAT Single Sponge Filter (Up to 60G)'],
  ['aqueon-quietflow-75', 'Aqueon QuietFlow 75 LED PRO HOB Filter'],
  ['aqueon-quietflow-200', 'Aqueon QuietFlow Canister Filter 200'],
  ['cascade-1500', 'Cascade 1500 Canister Filter'],
  ['eheim-2213', 'Eheim Classic 2213 Canister Filter'],
  ['fluval-107', 'Fluval 107 Performance Canister'],
  ['fluval-207', 'Fluval 207 Performance Canister'],
  ['fluval-307', 'Fluval 307 Performance Canister'],
  ['fluval-407', 'Fluval 407 Performance Canister'],
  ['fluval-fx2', 'Fluval FX2 High Performance Canister'],
  ['fluval-fx4', 'Fluval FX4 High Performance Canister'],
  ['fluval-c2', 'Fluval C2 Power Filter'],
  ['hygger-double-sponge-s', 'Hygger Dual Sponge Filter (Small)'],
  ['hygger-double-sponge-m', 'Hygger Dual Sponge Filter (Medium)'],
  ['hygger-quiet-power-filter', 'Hygger Quiet Aquarium Power Filter'],
  ['marineland-penguin-350', 'Marineland Penguin 350 BIO-Wheel Filter'],
  ['oase-biomaster-250', 'Oase BioMaster Thermo 250'],
  ['oase-biomaster-600', 'Oase BioMaster Thermo 600'],
  ['pawfly-sponge-10', 'Pawfly Nano Sponge Filter (Up to 10G)'],
  ['penn-plax-ugf-20-29', 'Penn-Plax Undergravel Filter (20–29G)'],
  ['powkoo-dual-sponge-40', 'Powkoo Dual Sponge Filter (20–55G)'],
  ['seachem-tidal-35', 'Seachem Tidal 35 HOB Filter'],
  ['seachem-tidal-55', 'Seachem Tidal 55 HOB Filter'],
  ['seachem-tidal-75', 'Seachem Tidal 75 HOB Filter'],
  ['seachem-tidal-110', 'Seachem Tidal 110 HOB Filter'],
  ['sunsun-hw-3000', 'SunSun HW-3000 Canister Filter'],
  ['tetra-whisper-iq-45', 'Tetra Whisper IQ Power Filter 45'],
]);

const BRAND_OVERRIDES = new Map([
  ['', 'Unbranded'],
]);

function slugify(value) {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'filter';
}

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    rows.push(row);
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
  const headers = rows[0].map((header) => header.trim());
  const dataRows = rows.slice(1);
  return dataRows.map((fields) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = fields[index] ?? '';
    });
    return record;
  });
}

function parseNumber(value) {
  if (value === null || value === undefined) {
    return NaN;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    const normalized = trimmed.replace(/,/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    const match = normalized.match(/(-?\d+(?:\.\d+)?)/);
    if (match) {
      return Number(match[1]);
    }
  }
  return NaN;
}

function clampGph(id, rawValue) {
  const value = parseNumber(rawValue);
  if (Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  return RATED_GPH_OVERRIDES.get(id) ?? 0;
}

function normalizeBrand(value) {
  const raw = (value || '').trim();
  return BRAND_OVERRIDES.get(raw) ?? (raw || 'Unknown');
}

function normalizeType(declared, inferred, name) {
  const normalize = (input) => {
    if (typeof input !== 'string') return '';
    const upper = input.trim().toUpperCase();
    if (!upper) return '';
    if (VALID_TYPES.has(upper)) return upper;
    if (TYPE_ALIASES.has(upper)) return TYPE_ALIASES.get(upper);
    return '';
  };
  const decl = normalize(declared);
  if (decl) return decl;
  const inf = normalize(inferred);
  if (inf) return inf;
  if (typeof name === 'string' && name) {
    const upperName = name.toUpperCase();
    for (const [type, keywords] of TYPE_KEYWORDS.entries()) {
      if (keywords.some((keyword) => upperName.includes(keyword))) {
        return type;
      }
    }
  }
  return 'OTHER';
}

function inferRangeFromGph(gph) {
  if (!Number.isFinite(gph) || gph <= 0) {
    return { min: 0, max: 9999 };
  }
  if (gph <= 120) {
    return { min: 0, max: 20 };
  }
  if (gph <= 220) {
    return { min: 20, max: 40 };
  }
  if (gph <= 400) {
    return { min: 40, max: 75 };
  }
  if (gph <= 650) {
    return { min: 55, max: 125 };
  }
  return { min: 75, max: 210 };
}

function parseRange(record, gph) {
  const minRaw = parseNumber(record.minGallons ?? record.min_gallons);
  const maxRaw = parseNumber(record.maxGallons ?? record.max_gallons);
  const inferred = inferRangeFromGph(gph);
  let min = Number.isFinite(minRaw) && minRaw >= 0 ? Math.round(minRaw) : inferred.min;
  let max = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.round(maxRaw) : inferred.max;
  if (!Number.isFinite(min) || min < 0) {
    min = 0;
  }
  if (!Number.isFinite(max) || max <= 0) {
    max = 9999;
  }
  if (max < min) {
    const tmp = min;
    min = max;
    max = tmp;
  }
  return { min, max };
}

function sortCatalogItems(items) {
  const copy = items.slice();
  copy.sort((a, b) => {
    const typeWeightA = TYPE_ORDER[a.type] ?? TYPE_ORDER.OTHER;
    const typeWeightB = TYPE_ORDER[b.type] ?? TYPE_ORDER.OTHER;
    if (typeWeightA !== typeWeightB) {
      return typeWeightA - typeWeightB;
    }
    const brandCompare = (a.brand || '').localeCompare(b.brand || '');
    if (brandCompare !== 0) {
      return brandCompare;
    }
    const gphCompare = (a.gphRated ?? 0) - (b.gphRated ?? 0);
    if (gphCompare !== 0) {
      return gphCompare;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
  return copy;
}

export async function generateFilterCatalog({
  csvPath = DEFAULT_CSV_PATH,
  targetPath = DEFAULT_TARGET_PATH,
  fallbackModulePath = DEFAULT_FALLBACK_MODULE_PATH,
} = {}) {
  const csvText = await readFile(csvPath, 'utf8');
  const records = csvRowsToObjects(parseCsv(csvText));

  const entries = [];
  const usedIds = new Set();
  const duplicateCounters = new Map();
  const seenLabelCombo = new Set();

  for (const record of records) {
    const rawId = (record.id || '').trim();
    const rawName = (record.name || '').trim();
    if (!rawId && !rawName) {
      continue;
    }
    const aliasTarget = PRIMARY_ID_ALIASES.get(rawId) ?? rawId;
    const baseId = slugify(aliasTarget || rawName);
    if (!baseId) {
      continue;
    }
    const brand = normalizeBrand(record.brand);
    const gphRated = clampGph(baseId, record.gphRated);
    if (!Number.isFinite(gphRated) || gphRated <= 0) {
      continue;
    }
    const nameOverride = NAME_OVERRIDES.get(baseId);
    const isAlias = PRIMARY_ID_ALIASES.has(rawId);
    const name = isAlias && rawName ? rawName : nameOverride ?? rawName ?? baseId;
    const type = normalizeType(record.typeDeclared, record.typeInferred, name);
    const labelKey = `${name}|${gphRated}`;
    if (seenLabelCombo.has(labelKey) && gphRated > 0) {
      continue;
    }
    seenLabelCombo.add(labelKey);

    let id = baseId;
    if (usedIds.has(id)) {
      const current = duplicateCounters.get(baseId) ?? 0;
      const next = current + 1;
      duplicateCounters.set(baseId, next);
      id = `${baseId}-${next}`;
    }
    usedIds.add(id);

    const { min, max } = parseRange(record, gphRated);

    entries.push({
      id,
      brand,
      name,
      type,
      gphRated,
      minGallons: min,
      maxGallons: max,
    });
  }

  const items = sortCatalogItems(entries);
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    items,
  };

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`);

  const fallbackModule = [
    '// Auto-generated fallback catalog for the prototype loader.\n',
    '// Derived from prototype/assets/data/filters_catalog.json\n',
    `export const FALLBACK_FILTER_CATALOG_VERSION = ${JSON.stringify(payload.version)};\n`,
    `export const FALLBACK_FILTER_CATALOG_GENERATED_AT = ${JSON.stringify(payload.generatedAt)};\n`,
    `export const FALLBACK_FILTER_CATALOG = ${JSON.stringify(payload.items, null, 2)};\n`,
  ].join('');
  await writeFile(fallbackModulePath, fallbackModule);

  return payload;
}

async function main() {
  const result = await generateFilterCatalog();
  console.log(`[make-filter-catalog] wrote ${result.items.length} items to ${DEFAULT_TARGET_PATH}`);
}

if (import.meta.url === `file://${__filename}`) {
  main().catch((error) => {
    console.error('[make-filter-catalog] failed:', error);
    process.exitCode = 1;
  });
}
