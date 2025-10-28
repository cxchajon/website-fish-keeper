const CATALOG_URL = '/prototype/assets/data/filters.catalog.json';

const TYPE_ORDER = new Map([
  ['SPONGE', 0],
  ['INTERNAL', 1],
  ['HOB', 2],
  ['CANISTER', 3],
  ['UGF', 4],
  ['OTHER', 5],
]);

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
  const type = typeof raw.type === 'string' && raw.type.trim() ? raw.type.trim().toUpperCase() : 'HOB';
  const gph = coerceNumber(raw.gphRated);
  if (!Number.isFinite(gph) || gph <= 0) {
    return null;
  }
  const minGallons = coerceNumber(raw.minGallons);
  const maxGallons = coerceNumber(raw.maxGallons);
  return {
    id,
    brand,
    model,
    type,
    gphRated: Math.round(gph),
    minGallons: Number.isFinite(minGallons) ? Math.max(0, Math.round(minGallons)) : null,
    maxGallons: Number.isFinite(maxGallons) ? Math.max(0, Math.round(maxGallons)) : null,
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
  const orderA = TYPE_ORDER.get(a.type) ?? TYPE_ORDER.size;
  const orderB = TYPE_ORDER.get(b.type) ?? TYPE_ORDER.size;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  const brandCompare = String(a.brand || '').localeCompare(String(b.brand || ''), undefined, {
    sensitivity: 'base',
    usage: 'sort',
  });
  if (brandCompare !== 0) {
    return brandCompare;
  }
  const modelCompare = String(a.model || '').localeCompare(String(b.model || ''), undefined, {
    sensitivity: 'base',
    usage: 'sort',
  });
  if (modelCompare !== 0) {
    return modelCompare;
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
