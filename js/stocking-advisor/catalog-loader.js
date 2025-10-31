import {
  getGearData,
  getGearDataMeta,
  filterGearByTank,
  sortGearItems,
  CATALOG_SOURCES,
} from '/js/gear-data.js';

let cachedResult = null;
let inflightPromise = null;

function cloneItems(items) {
  return items.map((item) => ({ ...item }));
}

function cloneResult(result) {
  if (!result || typeof result !== 'object') {
    return { source: CATALOG_SOURCES.FALLBACK, items: [] };
  }
  const source = result.source || CATALOG_SOURCES.FALLBACK;
  const items = Array.isArray(result.items) ? cloneItems(result.items) : [];
  return { source, items };
}

export async function loadFilterCatalog(options = {}) {
  if (cachedResult) {
    return cloneResult(cachedResult);
  }
  if (!inflightPromise) {
    inflightPromise = getGearData(options)
      .then((items) => {
        const sorted = sortGearItems(items);
        const meta = getGearDataMeta();
        const source = meta?.source || CATALOG_SOURCES.NETWORK;
        cachedResult = {
          source,
          items: cloneItems(sorted),
        };
        return cachedResult;
      })
      .catch(() => {
        cachedResult = {
          source: CATALOG_SOURCES.FALLBACK,
          items: [],
        };
        return cachedResult;
      })
      .finally(() => {
        inflightPromise = null;
      });
  }
  const resolved = await inflightPromise;
  return cloneResult(resolved);
}

export const filterByTank = filterGearByTank;
export const sortByTypeBrandGph = sortGearItems;
export const BIG_FALLBACK_LIST = Object.freeze([]);
export { CATALOG_SOURCES };
