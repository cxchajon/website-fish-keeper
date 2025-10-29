const DATA_URL = '/assets/data/gearCatalog.json';
const STORAGE_KEY = 'ttg.gear.catalog.v1';
const STORAGE_TIMESTAMP_KEY = 'ttg.gear.catalog.timestamp';

export const CATALOG_SOURCES = Object.freeze({
  NETWORK: 'NETWORK',
  CACHE: 'CACHE',
  MEMORY: 'MEMORY',
  FALLBACK: 'FALLBACK',
});

let memoryCatalog = null;
let memorySource = CATALOG_SOURCES.MEMORY;
let memoryTimestamp = 0;
let inflightPromise = null;

function cloneItem(item) {
  return { ...item };
}

function cloneItems(items) {
  return items.map((item) => cloneItem(item));
}

function toNumber(value, fallback = NaN) {
  if (Number.isFinite(value)) {
    return Number(value);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const TYPE_ORDER = Object.freeze({
  CANISTER: 0,
  HOB: 1,
  INTERNAL: 2,
  SPONGE: 3,
  UGF: 4,
  POWERHEAD: 5,
  OTHER: 6,
});

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
  const entry = {
    id,
    brand,
    name,
    type,
    gphRated,
    rated_gph: gphRated,
    minGallons,
    maxGallons,
  };
  if (raw?.links && typeof raw.links === 'object') {
    entry.links = { ...raw.links };
  }
  if (raw?.tags && Array.isArray(raw.tags)) {
    entry.tags = raw.tags.slice();
  }
  return entry;
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

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch (_error) {
    return null;
  }
}

function readCachedCatalog() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const cached = safeParse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(cached) || !cached.length) {
      return null;
    }
    const sanitized = sanitizeCatalog(cached);
    if (!sanitized.length) {
      return null;
    }
    const timestamp = Number(localStorage.getItem(STORAGE_TIMESTAMP_KEY));
    return {
      items: sanitized,
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    };
  } catch (_error) {
    return null;
  }
}

function writeCachedCatalog(items) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(memoryTimestamp));
  } catch (_error) {
    // Silently ignore storage errors (quota, privacy mode, etc.)
  }
}

function resolveFetch(options = {}) {
  if (options && typeof options.fetchImpl === 'function') {
    return options.fetchImpl;
  }
  if (typeof fetch === 'function') {
    return fetch.bind(globalThis);
  }
  return null;
}

async function fetchCatalogFromNetwork(options = {}) {
  const fetchImpl = resolveFetch(options);
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation available');
  }
  const response = await fetchImpl(DATA_URL, { cache: 'no-store' });
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response');
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  const sourceItems = Array.isArray(payload?.items) ? payload.items : payload;
  const sanitized = sanitizeCatalog(sourceItems);
  if (!sanitized.length) {
    throw new Error('Catalog empty');
  }
  memoryCatalog = sanitized;
  memorySource = CATALOG_SOURCES.NETWORK;
  memoryTimestamp = Date.now();
  writeCachedCatalog(memoryCatalog);
  return memoryCatalog;
}

function restoreFromStorage() {
  if (memoryCatalog && memoryCatalog.length) {
    return memoryCatalog;
  }
  const cached = readCachedCatalog();
  if (cached && cached.items.length) {
    memoryCatalog = cached.items;
    memorySource = CATALOG_SOURCES.CACHE;
    memoryTimestamp = cached.timestamp || 0;
  }
  return memoryCatalog;
}

export function getGearDataMeta() {
  return {
    source: memorySource,
    timestamp: memoryTimestamp,
  };
}

export function sortGearItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return sortByTypeBrandGphInternal(items);
}

export function filterGearByTank(items, gallons) {
  const list = Array.isArray(items) ? items : [];
  const g = Number(gallons);
  const canFilter = Number.isFinite(g) && g > 0;
  if (!canFilter) {
    return list.slice();
  }
  return list.filter((item) => {
    const minRaw = Number(item?.minGallons ?? 0);
    const maxRaw = Number(item?.maxGallons ?? Infinity);
    const min = Number.isFinite(minRaw) ? minRaw : 0;
    const max = Number.isFinite(maxRaw) ? maxRaw : Infinity;
    return g >= min && g <= max;
  });
}

export async function getGearData(options = {}) {
  const forceRefresh = Boolean(options?.forceRefresh);
  if (!forceRefresh && memoryCatalog && memoryCatalog.length) {
    return cloneItems(memoryCatalog);
  }

  restoreFromStorage();

  if (!forceRefresh && memoryCatalog && memoryCatalog.length && !inflightPromise) {
    // Kick off a background refresh but return cached data immediately.
    inflightPromise = fetchCatalogFromNetwork(options)
      .catch((error) => {
        console.warn('[gear-data] background refresh failed:', error);
        return memoryCatalog;
      })
      .finally(() => {
        inflightPromise = null;
      });
    return cloneItems(memoryCatalog);
  }

  if (!inflightPromise) {
    inflightPromise = fetchCatalogFromNetwork(options)
      .catch((error) => {
        if (memoryCatalog && memoryCatalog.length) {
          memorySource = memorySource === CATALOG_SOURCES.NETWORK
            ? CATALOG_SOURCES.NETWORK
            : CATALOG_SOURCES.CACHE;
          return memoryCatalog;
        }
        throw error;
      })
      .finally(() => {
        inflightPromise = null;
      });
  }

  try {
    const result = await inflightPromise;
    if (Array.isArray(result) && result.length) {
      memoryCatalog = result;
      return cloneItems(memoryCatalog);
    }
    if (memoryCatalog && memoryCatalog.length) {
      return cloneItems(memoryCatalog);
    }
    throw new Error('Gear catalog unavailable');
  } catch (error) {
    if (memoryCatalog && memoryCatalog.length) {
      console.warn('[gear-data] using cached gear catalog after failure:', error);
      return cloneItems(memoryCatalog);
    }
    memorySource = CATALOG_SOURCES.FALLBACK;
    throw error;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toDataAttributeName(key) {
  return String(key)
    .replace(/([A-Z])/g, '-$1')
    .replace(/\s+/g, '-')
    .replace(/_{1,}/g, '-')
    .toLowerCase();
}

function defaultMapOption(item) {
  return {
    value: item?.id ?? '',
    label: item?.name ?? item?.id ?? '',
    dataset: {},
    disabled: false,
  };
}

export function populateFilterDropdown(target, data, config = null) {
  const dropdown = typeof target === 'string' ? document.getElementById(target) : target;
  if (!dropdown) {
    return { hasOptions: false, selected: '' };
  }
  const options = typeof config === 'function'
    ? { filterFn: config }
    : (config && typeof config === 'object'
      ? config
      : {});
  const {
    filterFn = null,
    placeholder = null,
    placeholderValue = '',
    emptyMessage = 'Filters unavailable',
    mapOption = defaultMapOption,
    selectedValue,
    preserveValue = true,
    defaultValue = '',
  } = options;

  const list = Array.isArray(data) ? data.slice() : [];
  const filtered = filterFn ? list.filter((item) => filterFn(item)) : list;
  const previousValue = dropdown.value;

  dropdown.disabled = true;
  dropdown.setAttribute('aria-disabled', 'true');

  if (!filtered.length) {
    dropdown.innerHTML = `<option value="">${escapeHtml(emptyMessage)}</option>`;
    dropdown.value = '';
    return { hasOptions: false, selected: '' };
  }

  const optionHtml = filtered.map((item) => {
    const entry = mapOption(item) || defaultMapOption(item);
    const value = entry?.value ?? '';
    const label = entry?.label ?? '';
    const disabled = entry?.disabled ? ' disabled' : '';
    const dataset = entry?.dataset && typeof entry.dataset === 'object'
      ? entry.dataset
      : {};
    const dataAttributes = Object.entries(dataset)
      .filter(([, attributeValue]) => attributeValue !== null && attributeValue !== undefined && attributeValue !== '')
      .map(([key, attributeValue]) => ` data-${toDataAttributeName(key)}="${escapeHtml(attributeValue)}"`)
      .join('');
    return `<option value="${escapeHtml(value)}"${disabled}${dataAttributes}>${escapeHtml(label)}</option>`;
  }).join('');

  const placeholderHtml = placeholder
    ? `<option value="${escapeHtml(placeholderValue)}">${escapeHtml(placeholder)}</option>`
    : '';

  dropdown.innerHTML = `${placeholderHtml}${optionHtml}`;
  dropdown.disabled = false;
  dropdown.removeAttribute('aria-disabled');

  let nextValue = selectedValue !== undefined ? selectedValue : (preserveValue ? previousValue : defaultValue);
  if (nextValue) {
    dropdown.value = String(nextValue);
  }
  if (!dropdown.value && defaultValue) {
    dropdown.value = String(defaultValue);
  }

  return { hasOptions: true, selected: dropdown.value };
}

if (typeof window !== 'undefined') {
  const registry = window.TTG || (window.TTG = {});
  registry.gearData = {
    getGearData,
    getGearDataMeta,
    filterGearByTank,
    sortGearItems,
    populateFilterDropdown,
    CATALOG_SOURCES,
  };
}

export default {
  getGearData,
  getGearDataMeta,
  filterGearByTank,
  sortGearItems,
  populateFilterDropdown,
  CATALOG_SOURCES,
};
