import { FLOW_DERATE, TURNOVER_MIN, TURNOVER_MAX, MIN_GALLONS, MAX_GALLONS } from '../proto-filtration-consts.js';

export const CATALOG_URL = '/prototype/assets/data/filters.catalog.json';
export const FALLBACK_LIST = [
  { id: 'fluval-107', brand: 'Fluval', model: '107', type: 'CANISTER', gphRated: 145 },
  { id: 'fluval-207', brand: 'Fluval', model: '207', type: 'CANISTER', gphRated: 206 },
  { id: 'fluval-307', brand: 'Fluval', model: '307', type: 'CANISTER', gphRated: 303 },
  { id: 'fluval-407', brand: 'Fluval', model: '407', type: 'CANISTER', gphRated: 383 },
  { id: 'powkoo-dual-sponge', brand: 'Powkoo', model: 'Dual Sponge (20–55g)', type: 'SPONGE', gphRated: 150 },
  { id: 'pawfly-single-sponge', brand: 'Pawfly', model: 'Single Sponge (≤10g)', type: 'SPONGE', gphRated: 60 },
  { id: 'seachem-tidal35', brand: 'Seachem', model: 'Tidal 35', type: 'HOB', gphRated: 130 },
  { id: 'seachem-tidal55', brand: 'Seachem', model: 'Tidal 55', type: 'HOB', gphRated: 250 },
  { id: 'seachem-tidal75', brand: 'Seachem', model: 'Tidal 75', type: 'HOB', gphRated: 350 },
  { id: 'aqueon-quietflow-20', brand: 'Aqueon', model: 'QuietFlow 20', type: 'HOB', gphRated: 125 },
  { id: 'aqueon-quietflow-30', brand: 'Aqueon', model: 'QuietFlow 30', type: 'HOB', gphRated: 200 },
  { id: 'aquaclear-50', brand: 'AquaClear', model: '50', type: 'HOB', gphRated: 200 },
  { id: 'hydor-pro-250', brand: 'Hydor', model: 'Professional 250', type: 'CANISTER', gphRated: 240 },
];

const KNOWN_TYPES = new Set(['CANISTER', 'HOB', 'INTERNAL', 'UGF', 'SPONGE', 'OTHER']);

let catalogCache = null;
let pendingLoad = null;
let rawCatalogCache = null;
let pendingRawLoad = null;

export async function loadFilterCatalogRaw() {
  if (Array.isArray(rawCatalogCache) && rawCatalogCache.length) {
    return rawCatalogCache.slice();
  }
  if (pendingRawLoad) {
    const list = await pendingRawLoad;
    return Array.isArray(list) ? list.slice() : [];
  }

  const tag = '[catalog-loader]';
  const url = `${CATALOG_URL}?v=${window.__BUILD_HASH__ || Date.now()}`;

  pendingRawLoad = (async () => {
    let payload = null;
    const hasConsoleGroup = typeof console.group === 'function';
    if (hasConsoleGroup) {
      console.group(tag, 'fetch', url);
    }
    try {
      const res = await fetch(url, { cache: 'no-store' });
      console.log('HTTP', res.status);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      console.log('loaded count', Array.isArray(json) ? json.length : 'n/a');
      if (Array.isArray(json) && json.length) {
        payload = json;
      }
    } catch (error) {
      console.warn(`${tag} fetch failed:`, error);
    } finally {
      if (typeof console.groupEnd === 'function') {
        console.groupEnd();
      }
    }

    if (!payload && Array.isArray(window.__FILTER_CATALOG__) && window.__FILTER_CATALOG__.length) {
      console.info(`${tag} using window.__FILTER_CATALOG__ fallback`);
      payload = window.__FILTER_CATALOG__;
    }

    if (!payload || !payload.length) {
      console.info(`${tag} using hardcoded FALLBACK_LIST`);
      payload = FALLBACK_LIST;
    }

    return Array.isArray(payload) ? payload.slice() : [];
  })();

  try {
    const resolved = await pendingRawLoad;
    rawCatalogCache = Array.isArray(resolved) ? resolved.slice() : [];
    return rawCatalogCache.slice();
  } finally {
    pendingRawLoad = null;
  }
}

export async function loadFilterCatalog() {
  if (Array.isArray(catalogCache)) {
    return catalogCache.slice();
  }
  if (pendingLoad) {
    return pendingLoad.then((items) => items.slice());
  }

  pendingLoad = loadFilterCatalogRaw()
    .then((items) => {
      const payload = Array.isArray(items) ? items : [];
      catalogCache = payload.slice();
      return catalogCache.slice();
    })
    .catch((error) => {
      console.warn('[products] catalog load failed:', error);
      catalogCache = FALLBACK_LIST.slice();
      return catalogCache.slice();
    })
    .finally(() => {
      pendingLoad = null;
    });

  const result = await pendingLoad;
  return Array.isArray(result) ? result.slice() : [];
}

export function normalizeItem(item) {
  if (!item) {
    return null;
  }

  const brand = typeof item.brand === 'string' && item.brand.trim() ? item.brand.trim() : 'Unknown';
  const model = typeof item.model === 'string' ? item.model.trim() : '';
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  const typeToken = typeof item.type === 'string' ? item.type.trim().toUpperCase() : '';
  const gphRated = coerceNumber(item.gphRated ?? item.gph ?? item.flow ?? item.ratedGph);

  if (!Number.isFinite(gphRated) || gphRated <= 0) {
    return null;
  }

  const slugParts = [];
  if (brand && brand !== 'Unknown') {
    slugParts.push(slugify(brand));
  }
  if (model) {
    slugParts.push(slugify(model));
  } else if (name) {
    slugParts.push(slugify(name));
  }
  if (!slugParts.length) {
    slugParts.push(`filter-${Math.round(Math.max(gphRated, 0))}`);
  }
  const fallbackId = slugParts.filter(Boolean).join('-');
  const rawId = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : fallbackId;
  const id = slugify(rawId);

  if (!id) {
    return null;
  }

  let type = typeToken || 'UNKNOWN';
  const haystack = [model, name, brand].filter(Boolean).join(' ');
  if (type === 'UNKNOWN' && /sponge/i.test(haystack)) {
    type = 'SPONGE';
  }
  if (!KNOWN_TYPES.has(type)) {
    type = type === 'UNKNOWN' ? 'OTHER' : type;
    if (!KNOWN_TYPES.has(type)) {
      type = 'OTHER';
    }
  }

  let minGallons = coerceNumber(item.minGallons);
  let maxGallons = coerceNumber(item.maxGallons);

  if (Number.isFinite(minGallons)) {
    minGallons = clampGallons(minGallons);
  } else {
    minGallons = null;
  }
  if (Number.isFinite(maxGallons)) {
    maxGallons = clampGallons(maxGallons);
  } else {
    maxGallons = null;
  }

  if (gphRated > 0 && (minGallons == null || maxGallons == null)) {
    const eff = gphRated * FLOW_DERATE;
    const derivedMin = clampGallons(Math.floor(eff / TURNOVER_MAX));
    const derivedMax = clampGallons(Math.ceil(eff / TURNOVER_MIN));
    const lo = Math.min(derivedMin ?? MIN_GALLONS, derivedMax ?? MAX_GALLONS);
    const hi = Math.max(derivedMin ?? MIN_GALLONS, derivedMax ?? MAX_GALLONS);
    if (minGallons == null) {
      minGallons = lo;
    }
    if (maxGallons == null) {
      maxGallons = hi;
    }
  }

  if (Number.isFinite(minGallons) && Number.isFinite(maxGallons) && minGallons > maxGallons) {
    const low = Math.min(minGallons, maxGallons);
    const high = Math.max(minGallons, maxGallons);
    minGallons = low;
    maxGallons = high;
  }

  return {
    id,
    brand,
    model,
    type,
    gphRated: Math.round(gphRated),
    minGallons: Number.isFinite(minGallons) ? minGallons : null,
    maxGallons: Number.isFinite(maxGallons) ? maxGallons : null,
  };
}

export function filterByGallons(list, gallons) {
  const collection = Array.isArray(list) ? list.filter(Boolean) : [];
  const sorted = collection.slice().sort(sortByTypeBrandGph);
  if (!Number.isFinite(gallons)) {
    return sorted;
  }
  const target = Number(gallons);
  const filtered = sorted.filter((item) => {
    const min = Number.isFinite(item.minGallons) ? item.minGallons : -Infinity;
    const max = Number.isFinite(item.maxGallons) ? item.maxGallons : Infinity;
    return target >= min && target <= max;
  });
  return filtered.length ? filtered : sorted;
}

export function sortByTypeBrandGph(a, b) {
  return (a?.type || '').localeCompare(b?.type || '')
    || (a?.brand || '').localeCompare(b?.brand || '')
    || (a?.gphRated || 0) - (b?.gphRated || 0);
}

function clampGallons(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  return Math.max(MIN_GALLONS, Math.min(MAX_GALLONS, Math.round(num)));
}

function slugify(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
    const digits = trimmed.replace(/[^0-9.-]/g, '');
    return digits ? Number(digits) : NaN;
  }
  return NaN;
}
