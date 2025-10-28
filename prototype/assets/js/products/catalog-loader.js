import {
  FLOW_DERATE,
  TURNOVER_MIN,
  TURNOVER_MAX,
  MIN_GALLONS,
  MAX_GALLONS,
} from '../proto-filtration-consts.js';

const TAG = '[filters-catalog]';
const TYPE_ORDER = new Map([
  ['SPONGE', 0],
  ['HOB', 1],
  ['CANISTER', 2],
  ['INTERNAL', 3],
  ['UGF', 4],
]);

const CATALOG_SOURCES = [
  { kind: 'json', url: '/assets/data/gear/filters.json', label: 'gear/filters.json' },
  { kind: 'json', url: '/data/products/filters.json', label: 'data/products/filters.json' },
  { kind: 'inline', url: '/gear/index.html', selector: '#filters-data', label: 'gear/index inline' },
];

const FALLBACK_SOURCE = [
  { id: 'fluval-107', brand: 'Fluval', name: 'Fluval 107 Performance Canister Filter', typeDeclared: 'CANISTER', gphRated: 145 },
  { id: 'fluval-207', brand: 'Fluval', name: 'Fluval 207 Performance Canister Filter', typeDeclared: 'CANISTER', gphRated: 206 },
  { id: 'fluval-307', brand: 'Fluval', name: 'Fluval 307 Performance Canister Filter', typeDeclared: 'CANISTER', gphRated: 303 },
  { id: 'fluval-407', brand: 'Fluval', name: 'Fluval 407 Performance Canister Filter', typeDeclared: 'CANISTER', gphRated: 383 },
  { id: 'powkoo-dual-sponge', brand: 'Powkoo', name: 'Powkoo Dual Sponge Filter (20–55g)', typeDeclared: 'SPONGE', gphRated: 150 },
  { id: 'pawfly-single-sponge', brand: 'Pawfly', name: 'Pawfly Single Sponge Filter (≤10g)', typeDeclared: 'SPONGE', gphRated: 60 },
  { id: 'seachem-tidal35', brand: 'Seachem', name: 'Seachem Tidal 35 HOB Filter', typeDeclared: 'HOB', gphRated: 130 },
  { id: 'seachem-tidal55', brand: 'Seachem', name: 'Seachem Tidal 55 HOB Filter', typeDeclared: 'HOB', gphRated: 250 },
  { id: 'seachem-tidal75', brand: 'Seachem', name: 'Seachem Tidal 75 HOB Filter', typeDeclared: 'HOB', gphRated: 350 },
  { id: 'aqueon-quietflow-20', brand: 'Aqueon', name: 'Aqueon QuietFlow 20 Power Filter', typeDeclared: 'HOB', gphRated: 125 },
  { id: 'aqueon-quietflow-30', brand: 'Aqueon', name: 'Aqueon QuietFlow 30 Power Filter', typeDeclared: 'HOB', gphRated: 200 },
  { id: 'aquaclear-50', brand: 'AquaClear', name: 'AquaClear 50 Power Filter', typeDeclared: 'HOB', gphRated: 200 },
  { id: 'hydor-pro-250', brand: 'Hydor', name: 'Hydor Professional 250 Canister Filter', typeDeclared: 'CANISTER', gphRated: 240 },
];

const FALLBACK_LIST = FALLBACK_SOURCE.map((entry) => normalizeItem(entry)).filter(Boolean);

let catalogCache = null;
let loadPromise = null;

export async function loadFiltersCatalog({ force = false } = {}) {
  if (!force && Array.isArray(catalogCache) && catalogCache.length) {
    return catalogCache.slice();
  }
  if (loadPromise) {
    const cached = await loadPromise;
    return cached.slice();
  }

  loadPromise = (async () => {
    const records = await loadPreferredDataset();
    const normalized = records.map((entry) => normalizeItem(entry)).filter(Boolean);
    const deduped = dedupeNormalized(normalized);
    const sorted = deduped.sort(sortByTypeBrandGph);
    if (!sorted.length) {
      console.warn(`${TAG} no data sources found; using fallback list`);
      catalogCache = FALLBACK_LIST.slice();
    } else {
      catalogCache = sorted;
    }
    return catalogCache.slice();
  })().catch((error) => {
    console.warn(`${TAG} load failed:`, error);
    catalogCache = FALLBACK_LIST.slice();
    return catalogCache.slice();
  }).finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

export const loadFilterCatalog = loadFiltersCatalog;
export const loadFilterCatalogRaw = loadFiltersCatalog;

export function normalizeItem(item) {
  if (!item) {
    return null;
  }
  const brand = sanitizeString(item.brand) || inferBrand(item.name || item.title || item.model || '');
  const name = sanitizeString(item.name || item.title || item.model || '');
  const typeDeclared = inferType(item.typeDeclared || item.type || item.subgroup || '', `${brand} ${name}`);
  const gph = coerceNumber(item.gphRated ?? item.rated_gph ?? item.ratedGph ?? item.gph ?? item.flow);
  if (!Number.isFinite(gph) || gph <= 0) {
    return null;
  }

  const id = buildId(item.id, brand, name, gph);
  const url = sanitizeString(item.url);
  const image = sanitizeString(item.image);
  const notes = sanitizeString(item.notes);

  let minGallons = coerceNumber(item.minGallons);
  let maxGallons = coerceNumber(item.maxGallons);

  if (!Number.isFinite(minGallons) || minGallons <= 0 || !Number.isFinite(maxGallons) || maxGallons <= 0) {
    const derived = deriveGallonsFromGph(gph);
    if (!Number.isFinite(minGallons) || minGallons <= 0) {
      minGallons = derived.min;
    }
    if (!Number.isFinite(maxGallons) || maxGallons <= 0) {
      maxGallons = derived.max;
    }
  }

  if (Number.isFinite(minGallons) && Number.isFinite(maxGallons) && minGallons > maxGallons) {
    const swappedMin = Math.min(minGallons, maxGallons);
    const swappedMax = Math.max(minGallons, maxGallons);
    minGallons = swappedMin;
    maxGallons = swappedMax;
  }

  const model = deriveModel(brand, name, item.model);

  return {
    id,
    brand,
    name: name || model || id,
    model,
    type: typeDeclared,
    typeDeclared,
    gphRated: Math.round(gph),
    minGallons: Number.isFinite(minGallons) ? clampGallons(minGallons) : null,
    maxGallons: Number.isFinite(maxGallons) ? clampGallons(maxGallons) : null,
    url,
    image,
    notes,
  };
}

export function sortByTypeBrandGph(a, b) {
  const typeA = TYPE_ORDER.has(a?.type) ? TYPE_ORDER.get(a.type) : TYPE_ORDER.size;
  const typeB = TYPE_ORDER.has(b?.type) ? TYPE_ORDER.get(b.type) : TYPE_ORDER.size;
  if (typeA !== typeB) {
    return typeA - typeB;
  }
  const brandCompare = (a?.brand || '').localeCompare(b?.brand || '');
  if (brandCompare !== 0) {
    return brandCompare;
  }
  return (a?.gphRated || 0) - (b?.gphRated || 0);
}

export function filterByGallons(list, gallons, { fallbackCount = 10, withMeta = false } = {}) {
  const collection = Array.isArray(list) ? list.filter(Boolean) : [];
  const sorted = collection.slice().sort(sortByTypeBrandGph);
  if (!sorted.length) {
    return withMeta ? { items: [], fallback: false } : [];
  }
  const numericGallons = Number(gallons);
  if (!Number.isFinite(numericGallons) || numericGallons <= 0) {
    return withMeta ? { items: sorted, fallback: false } : sorted;
  }
  const exactMatches = sorted.filter((item) => fitsTankRange(item, numericGallons));
  if (exactMatches.length) {
    return withMeta ? { items: exactMatches, fallback: false } : exactMatches;
  }
  const idealTurnover = (TURNOVER_MIN + TURNOVER_MAX) / 2;
  const fallbackSize = Math.max(8, Math.min(12, Math.round(Number(fallbackCount) || 10)));
  const scored = sorted
    .map((item) => {
      const turnover = computeTurnover(item, numericGallons);
      const diff = Number.isFinite(turnover) ? Math.abs(turnover - idealTurnover) : Number.POSITIVE_INFINITY;
      return { item, diff };
    })
    .sort((a, b) => a.diff - b.diff);
  const nearest = scored.slice(0, fallbackSize).map((entry) => entry.item);
  return withMeta ? { items: nearest, fallback: true } : nearest;
}

export function computeTurnover(item, gallons) {
  const gph = Number(item?.gphRated);
  const size = Number(gallons);
  if (!Number.isFinite(gph) || gph <= 0 || !Number.isFinite(size) || size <= 0) {
    return NaN;
  }
  return (gph * FLOW_DERATE) / size;
}

function fitsTankRange(item, gallons) {
  if (!item || !Number.isFinite(gallons)) {
    return false;
  }
  const min = Number.isFinite(item.minGallons) ? item.minGallons : null;
  const max = Number.isFinite(item.maxGallons) ? item.maxGallons : null;
  if (min != null && max != null) {
    return gallons >= min && gallons <= max;
  }
  const turnover = computeTurnover(item, gallons);
  return Number.isFinite(turnover) && turnover >= TURNOVER_MIN && turnover <= TURNOVER_MAX;
}

async function loadPreferredDataset() {
  if (typeof fetch !== 'function') {
    return FALLBACK_SOURCE.slice();
  }
  for (const source of CATALOG_SOURCES) {
    try {
      const payload = await loadSource(source);
      if (Array.isArray(payload) && payload.length) {
        return payload;
      }
    } catch (error) {
      console.warn(`${TAG} ${source.label} failed:`, error);
    }
  }
  if (typeof window !== 'undefined' && Array.isArray(window.__FILTER_CATALOG__) && window.__FILTER_CATALOG__.length) {
    console.info(`${TAG} using window.__FILTER_CATALOG__ fallback`);
    return window.__FILTER_CATALOG__;
  }
  return FALLBACK_SOURCE.slice();
}

async function loadSource(source) {
  if (source.kind === 'json') {
    return loadJsonSource(source.url);
  }
  if (source.kind === 'inline') {
    return loadInlineSource(source);
  }
  return [];
}

async function loadJsonSource(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    if (response.status !== 404) {
      console.warn(`${TAG} HTTP ${response.status} loading ${url}`);
    }
    return [];
  }
  try {
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`${TAG} invalid JSON at ${url}:`, error);
    return [];
  }
}

async function loadInlineSource({ url, selector }) {
  if (typeof DOMParser === 'undefined') {
    return [];
  }
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const script = doc.querySelector(selector || '#filters-data');
  if (!script) {
    return [];
  }
  const payload = script.textContent?.trim();
  if (!payload) {
    return [];
  }
  try {
    const data = JSON.parse(payload);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`${TAG} inline JSON parse error:`, error);
    return [];
  }
}

function dedupeNormalized(records) {
  const map = new Map();
  for (const record of records) {
    if (!record) {
      continue;
    }
    const nameKey = canonicalNameKey(record.name) || canonicalNameKey(record.id);
    const key = `${slugify(record.brand)}|${nameKey}|${record.gphRated}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...record });
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
    if ((!Number.isFinite(merged.minGallons) || merged.minGallons == null) && Number.isFinite(record.minGallons)) {
      merged.minGallons = record.minGallons;
    }
    if ((!Number.isFinite(merged.maxGallons) || merged.maxGallons == null) && Number.isFinite(record.maxGallons)) {
      merged.maxGallons = record.maxGallons;
    }
    map.set(key, merged);
  }
  return Array.from(map.values());
}

function deriveGallonsFromGph(gph) {
  const effective = gph * FLOW_DERATE;
  const min = clampGallons(Math.floor(effective / TURNOVER_MAX));
  const max = clampGallons(Math.ceil(effective / TURNOVER_MIN));
  return { min, max };
}

function clampGallons(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const clamped = Math.max(MIN_GALLONS, Math.min(MAX_GALLONS, Math.round(value)));
  return clamped;
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

function sanitizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function slugify(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
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

function buildId(rawId, brand, name, gph) {
  if (rawId && typeof rawId === 'string' && rawId.trim()) {
    const slug = slugify(rawId);
    if (slug) {
      return slug;
    }
  }
  const parts = [slugify(brand), slugify(name), String(Math.round(gph))].filter(Boolean);
  if (!parts.length) {
    return `filter_${Math.round(Math.max(gph || 0, 0))}`;
  }
  return parts.join('_');
}

function inferBrand(name) {
  if (typeof name !== 'string') {
    return 'Unknown';
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Unknown';
  }
  const match = trimmed.match(/^[^\s\-–—]+/);
  return match ? match[0] : 'Unknown';
}

function deriveModel(brand, name, model) {
  const provided = sanitizeString(model);
  if (provided) {
    return provided;
  }
  const cleanBrand = sanitizeString(brand);
  const cleanName = sanitizeString(name);
  if (!cleanName) {
    return cleanBrand;
  }
  const lowerBrand = cleanBrand.toLowerCase();
  if (lowerBrand && cleanName.toLowerCase().startsWith(lowerBrand)) {
    const stripped = cleanName.slice(lowerBrand.length).trim();
    return stripped.replace(/^[\s-–—]+/, '').trim() || cleanName;
  }
  return cleanName;
}

function inferType(rawType, haystack) {
  const type = typeof rawType === 'string' ? rawType.trim().toUpperCase() : '';
  if (TYPE_ORDER.has(type)) {
    return type;
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
  return 'HOB';
}

export { FALLBACK_LIST };
