import speciesData from '../../data/species.v2.json' with { type: 'json' };

const FIN_NIPPER_TAG = 'fin_nipper';
const FEMALE_BETTA_ID = 'betta_female';
const MALE_BETTA_ID = 'betta_male';

function normalizeId(value) {
  if (value == null) return '';
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return normalized.replace(/^_+|_+$/g, '');
}

function dedupeTags(tags) {
  const result = [];
  const seen = new Set();
  for (const tag of Array.isArray(tags) ? tags : []) {
    if (typeof tag !== 'string') continue;
    const key = normalizeId(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function numericOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function buildCatalog(records = speciesData) {
  const byId = Object.create(null);
  const bySlug = Object.create(null);
  const list = [];

  for (const record of Array.isArray(records) ? records : []) {
    if (!record) continue;
    const canonicalId = normalizeId(record.id || record.slug);
    if (!canonicalId) continue;
    const tags = dedupeTags(record.tags);
    const sororityMin = numericOrNull(record.sorority_min);
    const schoolingMin = numericOrNull(record.schooling_min ?? record?.behavior?.schoolingMinimum);

    const entry = Object.freeze({
      id: canonicalId,
      slug: record.slug,
      name: record.name,
      tags: Object.freeze(tags),
      sorority_min: sororityMin ?? null,
      schooling_min: schoolingMin ?? null,
      record,
    });

    list.push(entry);
    byId[canonicalId] = entry;
    const slugKey = normalizeId(record.slug);
    if (slugKey && !(slugKey in byId)) {
      byId[slugKey] = entry;
    }
    if (slugKey && !(slugKey in bySlug)) {
      bySlug[slugKey] = entry;
    }
    if (typeof record.slug === 'string') {
      const rawSlug = record.slug.toLowerCase();
      if (!(rawSlug in bySlug)) {
        bySlug[rawSlug] = entry;
      }
    }
  }

  return Object.freeze({ byId, bySlug, list: Object.freeze(list) });
}

const DEFAULT_CATALOG = buildCatalog();

function resolveCatalog(catalog) {
  if (catalog && typeof catalog === 'object' && catalog.byId) {
    return catalog;
  }
  return DEFAULT_CATALOG;
}

export function mockState(overrides = {}) {
  const state = { stock: [], tank: { gallons: 0 } };
  if (overrides && typeof overrides === 'object') {
    if (Array.isArray(overrides.stock)) {
      state.stock = [...overrides.stock];
    }
    if (overrides.tank && typeof overrides.tank === 'object') {
      state.tank = { ...overrides.tank };
    }
    for (const key of Object.keys(overrides)) {
      if (key === 'stock' || key === 'tank') continue;
      state[key] = overrides[key];
    }
  }
  return state;
}

function gatherStock(state, catalog) {
  const entries = [];
  const stock = Array.isArray(state?.stock) ? state.stock : [];
  for (const item of stock) {
    if (!item) continue;
    const id = normalizeId(item.speciesId ?? item.id ?? item.slug ?? item?.species?.id ?? item?.species?.slug);
    const quantity = Number(item.quantity ?? item.qty ?? item.count ?? 0);
    if (!id || !Number.isFinite(quantity) || quantity <= 0) continue;
    const species = catalog.byId[id] || null;
    entries.push({ id, quantity, species });
  }
  return entries;
}

function hasTag(species, tag) {
  if (!species || !Array.isArray(species.tags)) return false;
  return species.tags.includes(tag);
}

function qtyOf(entries, id) {
  const needle = normalizeId(id);
  let total = 0;
  for (const entry of entries) {
    if (entry.id === needle) {
      total += entry.quantity;
    }
  }
  return total;
}

function hasFinNipper(entries, excludeIds = []) {
  const exclusions = new Set(excludeIds.map(normalizeId));
  for (const entry of entries) {
    if (exclusions.has(entry.id)) continue;
    if (entry.quantity <= 0) continue;
    if (hasTag(entry.species, FIN_NIPPER_TAG)) {
      return true;
    }
  }
  return false;
}

function createSororityWarning() {
  return {
    id: 'betta_female_sorority_min',
    severity: 'warn',
    kind: 'behavior',
    text: 'Sororities are high-risk. If attempting, keep **≥5 females** in **20+ gallons** with heavy cover; otherwise keep a single female.',
  };
}

function createFinNipperWarning(id) {
  return {
    id,
    severity: 'warn',
    kind: 'compatibility',
    text: 'Fin-nippers may harass Bettas and damage fins. Avoid this combination.',
  };
}

export function runAllWarnings(state, catalogInput) {
  const catalog = resolveCatalog(catalogInput);
  const entries = gatherStock(state, catalog);
  const warnings = [];

  const femaleQty = qtyOf(entries, FEMALE_BETTA_ID);
  if (femaleQty > 1) {
    const sororityMin = Number(catalog.byId[FEMALE_BETTA_ID]?.sorority_min ?? 5);
    if (femaleQty < sororityMin) {
      warnings.push(createSororityWarning());
    }
  }

  const finNipperPresent = hasFinNipper(entries, [FEMALE_BETTA_ID, MALE_BETTA_ID]);
  if (finNipperPresent) {
    if (femaleQty > 0) {
      warnings.push(createFinNipperWarning('betta_female_finnipper_conflict'));
    }
    const maleQty = qtyOf(entries, MALE_BETTA_ID);
    if (maleQty > 0) {
      warnings.push(createFinNipperWarning('betta_male_finnipper_conflict'));
    }
  }

  return warnings;
}

export default {
  buildCatalog,
  mockState,
  runAllWarnings,
};
