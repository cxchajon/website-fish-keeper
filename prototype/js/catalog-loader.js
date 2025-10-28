import {
  FALLBACK_FILTER_CATALOG,
  FALLBACK_FILTER_CATALOG_VERSION,
  FALLBACK_FILTER_CATALOG_GENERATED_AT,
} from './catalog-fallback.js';

const CATALOG_PATH = '/prototype/assets/data/filters_catalog.json';
const CACHE_BUSTER = `${FALLBACK_FILTER_CATALOG_VERSION}-${FALLBACK_FILTER_CATALOG_GENERATED_AT || 'fallback'}`;

const TYPE_ORDER = Object.freeze({
  CANISTER: 0,
  HOB: 1,
  INTERNAL: 2,
  SPONGE: 3,
  UGF: 4,
  POWERHEAD: 5,
  OTHER: 6,
});

let cachedItems = null;
let inflightPromise = null;

function normalizeType(value) {
  if (typeof value !== 'string') {
    return 'HOB';
  }
  const upper = value.trim().toUpperCase();
  if (!upper) {
    return 'HOB';
  }
  if (TYPE_ORDER.hasOwnProperty(upper)) {
    return upper;
  }
  return 'OTHER';
}

function toNumber(value, fallback = NaN) {
  if (Number.isFinite(value)) {
    return Number(value);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) {
    return null;
  }
  const brand = typeof raw.brand === 'string' ? raw.brand.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const type = normalizeType(raw.type);
  const gphRated = toNumber(raw.gphRated ?? raw.rated_gph ?? raw.ratedGph, NaN);
  if (!Number.isFinite(gphRated) || gphRated <= 0) {
    return null;
  }
  const minGallonsRaw = toNumber(raw.minGallons, 0);
  const maxGallonsRaw = toNumber(raw.maxGallons, Infinity);
  const minGallons = Math.max(0, Number.isFinite(minGallonsRaw) ? minGallonsRaw : 0);
  const maxGallons = Number.isFinite(maxGallonsRaw) && maxGallonsRaw > 0 ? maxGallonsRaw : Infinity;
  return {
    id,
    brand,
    name,
    type,
    gphRated,
    minGallons,
    maxGallons,
  };
}

function sortByTypeBrandGphInternal(items) {
  const clone = items.slice();
  clone.sort((a, b) => {
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
  return clone;
}

function sanitizeCatalog(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  const deduped = new Map();
  items.forEach((raw) => {
    const entry = sanitizeItem(raw);
    if (!entry) return;
    if (!deduped.has(entry.id)) {
      deduped.set(entry.id, entry);
    }
  });
  return sortByTypeBrandGphInternal(Array.from(deduped.values()));
}

const FALLBACK_SANITIZED = Object.freeze(
  sanitizeCatalog(FALLBACK_FILTER_CATALOG).map((item) => Object.freeze({ ...item })),
);

function cloneItems(items) {
  return items.map((item) => ({ ...item }));
}

function getFetchImplementation(options = {}) {
  if (options && typeof options.fetchImpl === 'function') {
    return options.fetchImpl;
  }
  if (typeof fetch === 'function') {
    return fetch.bind(globalThis);
  }
  return null;
}

async function requestCatalog(fetchImpl) {
  const response = await fetchImpl(`${CATALOG_PATH}?v=${encodeURIComponent(CACHE_BUSTER)}`, {
    cache: 'no-store',
  });
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response object');
  }
  const { ok, status } = response;
  if (!ok) {
    throw new Error(`HTTP ${status}`);
  }
  if (typeof response.json !== 'function') {
    throw new Error('Response missing json()');
  }
  const payload = await response.json();
  const items = sanitizeCatalog(Array.isArray(payload?.items) ? payload.items : payload);
  if (!items.length) {
    throw new Error('Empty catalog');
  }
  return items;
}

export async function loadFilterCatalog(options = {}) {
  if (cachedItems) {
    return cloneItems(cachedItems);
  }
  if (inflightPromise) {
    const pending = await inflightPromise;
    return cloneItems(pending);
  }
  const fetchImpl = getFetchImplementation(options);
  if (!fetchImpl) {
    cachedItems = FALLBACK_SANITIZED;
    return cloneItems(cachedItems);
  }
  inflightPromise = requestCatalog(fetchImpl)
    .catch((error) => {
      console.warn('[catalog-loader] fetch failed:', error);
      return FALLBACK_SANITIZED;
    })
    .then((items) => {
      cachedItems = items;
      return items;
    })
    .finally(() => {
      inflightPromise = null;
    });
  const resolved = await inflightPromise;
  return cloneItems(resolved);
}

export function filterByTank(items, gallons) {
  const list = Array.isArray(items) ? items : [];
  const volume = toNumber(gallons, NaN);
  if (!Number.isFinite(volume) || volume <= 0) {
    return list.slice();
  }
  return list.filter((item) => {
    const min = Number.isFinite(item.minGallons) ? item.minGallons : 0;
    const max = Number.isFinite(item.maxGallons) ? item.maxGallons : Infinity;
    return volume >= min && volume <= max;
  });
}

export function sortByTypeBrandGph(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return sortByTypeBrandGphInternal(items);
}

export function getFallbackCatalog() {
  return cloneItems(FALLBACK_SANITIZED);
}

export const BIG_FALLBACK_LIST = getFallbackCatalog();
