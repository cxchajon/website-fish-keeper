import { FLOW_DERATE } from '../proto-filtration-math.js';

const CATALOG_URL = '/prototype/assets/data/filters.catalog.json';

const TURNOVER_MIN = 4; // 4× turnover guardrail (prototype heuristics)
const TURNOVER_MAX = 10; // 10× turnover guardrail (prototype heuristics)
const MIN_GALLON_BOUND = 5;
const MAX_GALLON_BOUND = 300;

const SPONGE_BRANDS = new Set(['powkoo', 'xy', 'aquaneat', 'uxcell']);
const SPONGE_PATTERNS = [
  /sponge/i,
  /bacto[-\s]?surge/i,
  /hydro\s*sponge/i,
];

let catalogCache = null;
let pendingLoad = null;
let lastLoadError = null;

function coerceNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === 'string' && value.trim()) {
    const normalized = value.replace(/[^0-9.-]/g, '');
    return normalized ? Number(normalized) : NaN;
  }
  return NaN;
}

function clampGallons(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  const bounded = Math.min(Math.max(num, MIN_GALLON_BOUND), MAX_GALLON_BOUND);
  return Math.round(bounded);
}

function inferType(rawType, brand, model, id) {
  const normalized = typeof rawType === 'string' ? rawType.trim().toUpperCase() : '';
  if (normalized === 'SPONGE') {
    return 'SPONGE';
  }
  if (normalized === 'HOB' || normalized === 'CANISTER' || normalized === 'INTERNAL' || normalized === 'UGF') {
    return normalized;
  }
  const haystack = [brand, model, id]
    .map((value) => (typeof value === 'string' ? value.toLowerCase() : ''))
    .filter(Boolean)
    .join(' ');
  if (haystack) {
    if (SPONGE_PATTERNS.some((pattern) => pattern.test(haystack))) {
      return 'SPONGE';
    }
    const brandKey = typeof brand === 'string' ? brand.trim().toLowerCase() : '';
    if (brandKey && SPONGE_BRANDS.has(brandKey)) {
      return 'SPONGE';
    }
  }
  if (normalized) {
    return normalized;
  }
  return 'HOB';
}

// When the catalog omits tank bounds, infer them from derated flow using
// our 4×–10× turnover guardrails so size gating can still function.
function inferGallonsRange({ minGallons, maxGallons, gphRated }) {
  const min = Number.isFinite(minGallons) ? Math.max(0, Math.round(minGallons)) : null;
  const max = Number.isFinite(maxGallons) ? Math.max(0, Math.round(maxGallons)) : null;
  if (min !== null && max !== null) {
    return { min, max };
  }
  if (!Number.isFinite(gphRated) || gphRated <= 0) {
    return { min, max };
  }
  const gphEffective = gphRated * FLOW_DERATE;
  if (!Number.isFinite(gphEffective) || gphEffective <= 0) {
    return { min, max };
  }
  const fallbackMin = clampGallons(Math.floor(gphEffective / TURNOVER_MAX));
  const fallbackMax = clampGallons(Math.ceil(gphEffective / TURNOVER_MIN));
  let nextMin = min ?? fallbackMin;
  let nextMax = max ?? fallbackMax;
  if (Number.isFinite(nextMin) && Number.isFinite(nextMax) && nextMin > nextMax) {
    const low = Math.min(nextMin, nextMax);
    const high = Math.max(nextMin, nextMax);
    nextMin = low;
    nextMax = high;
  }
  return {
    min: nextMin,
    max: nextMax,
  };
}

function sanitizeProduct(raw) {
  if (!raw || typeof raw.id !== 'string') {
    return null;
  }
  const id = raw.id.trim();
  if (!id) {
    return null;
  }
  const brand = typeof raw.brand === 'string' ? raw.brand.trim() : '';
  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : id;
  const type = inferType(raw.type, brand, model, id);
  const gph = coerceNumber(raw.gphRated);
  if (!Number.isFinite(gph) || gph <= 0) {
    return null;
  }
  const minGallons = coerceNumber(raw.minGallons);
  const maxGallons = coerceNumber(raw.maxGallons);
  const range = inferGallonsRange({
    minGallons,
    maxGallons,
    gphRated: gph,
  });
  return {
    id,
    brand,
    model,
    type,
    gphRated: Math.round(gph),
    minGallons: Number.isFinite(range.min) ? range.min : null,
    maxGallons: Number.isFinite(range.max) ? range.max : null,
  };
}

export async function loadFilterCatalog() {
  if (Array.isArray(catalogCache)) {
    return catalogCache.map((item) => ({ ...item }));
  }
  if (pendingLoad) {
    return pendingLoad.then((items) => items.map((item) => ({ ...item })));
  }
  pendingLoad = fetch(CATALOG_URL, { cache: 'no-cache' })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load filter catalog (${response.status})`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Catalog payload must be an array');
      }
      const normalized = data.map((entry) => sanitizeProduct(entry)).filter(Boolean);
      catalogCache = normalized;
      lastLoadError = null;
      return normalized;
    })
    .catch((error) => {
      console.error('[Proto] Unable to load filter catalog. Falling back to empty list.', error);
      lastLoadError = error;
      catalogCache = [];
      return [];
    })
    .finally(() => {
      pendingLoad = null;
    });
  const items = await pendingLoad;
  return items.map((item) => ({ ...item }));
}

export function getLastCatalogError() {
  return lastLoadError;
}

export function filterProductsByTankSize(list, gallons) {
  const items = Array.isArray(list) ? list.filter(Boolean) : [];
  const sortedAll = items.slice().sort(sortByTypeBrandGph);
  if (!Number.isFinite(gallons)) {
    return sortedAll;
  }
  const target = Math.max(0, Number(gallons));
  const matches = sortedAll.filter((product) => fitsTank(product, target));
  return matches.length ? matches : sortedAll;
}

export function sortByTypeBrandGph(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const typeCompare = String(a.type || '').localeCompare(String(b.type || ''), undefined, {
    sensitivity: 'base',
    usage: 'sort',
  });
  if (typeCompare !== 0) {
    return typeCompare;
  }
  const brandCompare = String(a.brand || '').localeCompare(String(b.brand || ''), undefined, {
    sensitivity: 'base',
    usage: 'sort',
  });
  if (brandCompare !== 0) {
    return brandCompare;
  }
  return (a.gphRated ?? 0) - (b.gphRated ?? 0);
}

function fitsTank(product, gallons) {
  if (!product || !Number.isFinite(gallons)) {
    return false;
  }
  const min = Number.isFinite(product.minGallons) ? product.minGallons : -Infinity;
  const max = Number.isFinite(product.maxGallons) ? product.maxGallons : Infinity;
  return gallons >= min && gallons <= max;
}

// Catalog generation infers tank size ranges from rated GPH using heuristic tiers:
// ≤120 GPH → 0–20 gal, 120–220 GPH → 20–40 gal, 220–400 GPH → 40–75 gal, >400 GPH → 75+ gal.
// These bounds are embedded in the dataset so loader consumers do not need to recompute them.
