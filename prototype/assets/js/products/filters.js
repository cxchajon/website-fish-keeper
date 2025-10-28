const CATALOG_URL = '/prototype/assets/data/filters.json';

const TYPE_ALIASES = new Map([
  ['HANG-ON-BACK', 'HOB'],
  ['HANG ON BACK', 'HOB'],
  ['HOB', 'HOB'],
  ['CANISTER', 'CANISTER'],
  ['SPONGE', 'SPONGE'],
  ['INTERNAL', 'INTERNAL'],
  ['POWERHEAD', 'INTERNAL'],
  ['UGF', 'UGF'],
  ['UNDERGRAVEL', 'UGF'],
  ['UNDER-GRAVEL', 'UGF'],
  ['UNDER GRAVEL', 'UGF'],
  ['OTHER', 'OTHER'],
  ['WET/DRY', 'OTHER'],
  ['SUMP', 'OTHER'],
]);

const TYPE_ORDER = new Map([
  ['SPONGE', 0],
  ['INTERNAL', 1],
  ['HOB', 2],
  ['CANISTER', 3],
  ['UGF', 4],
  ['OTHER', 5],
]);

const FALLBACK_PRODUCTS = Object.freeze([
  {
    id: 'fallback-hob-200',
    brand: 'Generic',
    model: 'HOB 200',
    type: 'HOB',
    gphRated: 200,
    minGallons: 20,
    maxGallons: 40,
  },
  {
    id: 'fallback-canister-350',
    brand: 'Generic',
    model: 'Canister 350',
    type: 'CANISTER',
    gphRated: 350,
    minGallons: 40,
    maxGallons: 75,
  },
  {
    id: 'fallback-sponge-120',
    brand: 'Generic',
    model: 'Dual Sponge 120',
    type: 'SPONGE',
    gphRated: 120,
    minGallons: 0,
    maxGallons: 20,
  },
]);

let catalogCache = null;
let pendingLoad = null;
let lastLoadError = null;

export function getCatalogError() {
  return lastLoadError;
}

export async function loadProductCatalog() {
  if (catalogCache) {
    return { items: catalogCache.slice(), fallback: Boolean(lastLoadError), error: lastLoadError };
  }
  if (pendingLoad) {
    return pendingLoad;
  }
  pendingLoad = fetch(CATALOG_URL, { cache: 'no-cache' })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load catalog (${response.status})`);
      }
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        const normalized = Array.isArray(data)
          ? data
              .map((entry) => normalizeCatalogItem(entry))
              .filter(Boolean)
          : [];
        if (!normalized.length) {
          throw new Error('Catalog payload empty');
        }
        catalogCache = normalized;
        lastLoadError = null;
        return { items: catalogCache.slice(), fallback: false, error: null };
      } catch (error) {
        throw new Error(`Invalid catalog JSON: ${error.message}`);
      }
    })
    .catch((error) => {
      console.error('[Proto] Failed to load product catalog. Using fallback list.', error);
      lastLoadError = error;
      catalogCache = FALLBACK_PRODUCTS.slice();
      return { items: catalogCache.slice(), fallback: true, error };
    })
    .finally(() => {
      pendingLoad = null;
    });
  return pendingLoad;
}

export function sortProducts(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .slice()
    .sort((a, b) => {
      const typeOrderA = TYPE_ORDER.get(a.type) ?? TYPE_ORDER.size;
      const typeOrderB = TYPE_ORDER.get(b.type) ?? TYPE_ORDER.size;
      if (typeOrderA !== typeOrderB) {
        return typeOrderA - typeOrderB;
      }
      const brandCompare = String(a.brand || '').localeCompare(String(b.brand || ''));
      if (brandCompare !== 0) {
        return brandCompare;
      }
      const modelCompare = String(a.model || '').localeCompare(String(b.model || ''));
      if (modelCompare !== 0) {
        return modelCompare;
      }
      return (a.gphRated ?? 0) - (b.gphRated ?? 0);
    });
}

export function fitsTank(product, gallons) {
  if (!product) {
    return false;
  }
  const min = Number.isFinite(product.minGallons) ? product.minGallons : -Infinity;
  const max = Number.isFinite(product.maxGallons) ? product.maxGallons : Infinity;
  return gallons >= min && gallons <= max;
}

export function filterProductsByTankSize(allProducts, gallons) {
  const sanitizedGallons = Number.isFinite(gallons) ? Math.max(gallons, 0) : null;
  const sortedAll = sortProducts(allProducts);
  if (!Number.isFinite(sanitizedGallons) || sanitizedGallons === null) {
    return { items: sortedAll, fallback: false };
  }
  const matches = sortedAll.filter((product) => fitsTank(product, sanitizedGallons));
  if (matches.length) {
    return { items: matches, fallback: false };
  }
  return { items: sortedAll, fallback: true };
}

export function formatProductDropdownLabel(product) {
  if (!product) return '';
  const brand = product.brand ? String(product.brand).trim() : '';
  const model = product.model ? String(product.model).trim() : '';
  const gph = Number.isFinite(product.gphRated) ? Math.round(product.gphRated) : 0;
  const type = product.type || 'HOB';
  const parts = [];
  if (brand) {
    parts.push(brand);
  }
  if (model) {
    parts.push(model);
  }
  const prefix = parts.length ? parts.join(' ') : product.id;
  return `${prefix} — ${gph} GPH (${type})`;
}

function normalizeCatalogItem(raw) {
  if (!raw || typeof raw.id !== 'string') {
    return null;
  }
  const id = raw.id.trim();
  if (!id) {
    return null;
  }
  const brand = sanitizeBrand(raw.brand);
  const model = deriveModel(raw.model, raw.name, brand);
  const type = deriveType(raw.type ?? raw.typeDeclared ?? raw.typeInferred);
  const gph = deriveGph(raw);
  if (!Number.isFinite(gph) || gph <= 0) {
    return null;
  }
  const { minGallons, maxGallons } = deriveGallonRange(raw, gph);
  return {
    id,
    brand,
    model,
    type,
    gphRated: gph,
    minGallons,
    maxGallons,
  };
}

function sanitizeBrand(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function deriveModel(rawModel, rawName, brand) {
  const direct = typeof rawModel === 'string' ? rawModel.trim() : '';
  if (direct) {
    return direct;
  }
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (!name) {
    return '';
  }
  if (brand) {
    const loweredName = name.toLowerCase();
    const loweredBrand = brand.toLowerCase();
    if (loweredName.startsWith(loweredBrand)) {
      const remainder = name.slice(brand.length).replace(/^[\s-–—]+/, '');
      if (remainder.trim()) {
        return cleanModelText(remainder.trim());
      }
    }
  }
  return cleanModelText(name);
}

function cleanModelText(text) {
  return text.replace(/\b(filter|power filter|aquarium filter|fish tank filter)\b/gi, '').replace(/\s+/g, ' ').trim();
}

function deriveType(value) {
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase();
    if (TYPE_ALIASES.has(upper)) {
      return TYPE_ALIASES.get(upper);
    }
    return upper;
  }
  return 'HOB';
}

function deriveGph(raw) {
  const candidates = [raw.gphRated, raw.rated_gph, raw.ratedGph, raw.gph];
  for (const candidate of candidates) {
    const value = parseNumber(candidate);
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }
  }
  return null;
}

function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.]/g, '');
    if (!normalized) {
      return NaN;
    }
    return Number(normalized);
  }
  return NaN;
}

function deriveGallonRange(raw, gph) {
  const hints = extractRangeHints(raw);
  if (hints.min != null || hints.max != null) {
    return hints;
  }
  return inferRangeFromGph(gph);
}

function extractRangeHints(raw) {
  const candidates = [];
  const textFields = [raw.range, raw.size, raw.name, raw.model, raw.notes]
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());
  textFields.forEach((text) => {
    const normalized = text
      .toLowerCase()
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/-\s*to\s*/g, '-')
      .replace(/\bto\b/g, '-');
    const rangeMatch = normalized.match(/(\d+)\s*[-]\s*(\d+)\s*(?:g|gal|gallon)/i);
    if (rangeMatch) {
      const min = Number(rangeMatch[1]);
      const max = Number(rangeMatch[2]);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        candidates.push({ minGallons: min, maxGallons: max });
        return;
      }
    }
    const upToMatch = normalized.match(/up\s*to\s*(\d+)\s*(?:g|gal|gallon)/i);
    if (upToMatch) {
      const max = Number(upToMatch[1]);
      if (Number.isFinite(max)) {
        candidates.push({ minGallons: null, maxGallons: max });
        return;
      }
    }
    const singleMatch = normalized.match(/for\s*(\d+)\s*(?:gallon|gal)\b/i);
    if (singleMatch) {
      const value = Number(singleMatch[1]);
      if (Number.isFinite(value)) {
        candidates.push({ minGallons: value, maxGallons: value });
      }
    }
  });
  if (candidates.length) {
    const best = candidates.find((entry) => entry.minGallons != null && entry.maxGallons != null) ?? candidates[0];
    return {
      minGallons: normalizeGallonValue(best.minGallons),
      maxGallons: normalizeGallonValue(best.maxGallons),
    };
  }
  return { minGallons: null, maxGallons: null };
}

function normalizeGallonValue(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.max(0, Math.round(value));
  return Number.isFinite(normalized) ? normalized : null;
}

function inferRangeFromGph(gph) {
  if (!Number.isFinite(gph) || gph <= 0) {
    return { minGallons: null, maxGallons: null };
  }
  if (gph <= 120) {
    return { minGallons: 0, maxGallons: 20 };
  }
  if (gph <= 220) {
    return { minGallons: 20, maxGallons: 40 };
  }
  if (gph <= 400) {
    return { minGallons: 40, maxGallons: 75 };
  }
  return { minGallons: 75, maxGallons: null };
}

export function getFallbackProducts() {
  return FALLBACK_PRODUCTS.slice();
}
