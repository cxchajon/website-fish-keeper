// Sponge migration phase E: legacy sponge GPH and GPH-bucket fields removed from the current catalog.
// Report: _internal/reports/stocking-advisor-sponge-migration-phase-e-2026-09.md
//   CURRENT catalog data: the seven sponge records carry no gphRated / minGallons / maxGallons; the
//   loader emits no gphRated / rated_gph / minGallons / maxGallons for a sponge.
//   HISTORICAL data (old caches, old saved plans, old custom sponges) keeps its fake GPH in the
//   fixtures below on purpose: the phase B / C protections must still neutralise it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(ROOT + path, 'utf8'));
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\//, '').split('?')[0];
  return { ok: true, status: 200, statusText: 'OK', json: async () => readJson(path) };
};

const compute = await import('../../js/logic/compute.js');
const math = await import('../../js/stocking-advisor/filtration/math.js');
const saved = await import('../../js/stocking-advisor/filtration/saved-state.js');
const items = await import('../../js/stocking-advisor/filtration/sponge-items.js');
const instances = await import('../../js/stocking-advisor/filtration/instances.js');
const { getGearData, filterGearByTank, sortGearItems } = await import('../../js/gear-data.js');
const { getTankById, TANK_SIZES } = await import('../../js/utils.js');

await compute.initializeCompute();
const RAW = readJson('assets/data/gearCatalog.json');
const CATALOG = await getGearData({ forceRefresh: true });
const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.id, item]));

const HYGGER_S = 'hygger-double-sponge-s';
const HYGGER_M = 'hygger-double-sponge-m';
const AQUANEAT_SMALL = 'aquaneat-sponge-10';
const AQUANEAT_MIDDLE = 'aquaneat-sponge-20';
const AQUANEAT_LARGE = 'aquaneat-sponge-60';
const PAWFLY = 'pawfly-sponge-10';
const POWKOO = 'powkoo-dual-sponge-40';
const SPONGE_IDS = [AQUANEAT_SMALL, AQUANEAT_MIDDLE, AQUANEAT_LARGE, HYGGER_S, HYGGER_M, PAWFLY, POWKOO];
const UNVERIFIED = [AQUANEAT_SMALL, AQUANEAT_MIDDLE, AQUANEAT_LARGE, PAWFLY, POWKOO];
const AC70 = 'aquaclear-70';
const TETRA = 'tetra-whisper-iq-45';
const UGF = 'penn-plax-ugf-20-29';
const V1 = saved.FILTER_STORAGE_KEY_V1;
const V2 = saved.FILTER_STORAGE_KEY_V2;
const CACHE_KEY = 'ttg.gear.catalog.v2';

// Every legacy flow / bucket key a sponge record could carry.
const LEGACY_FLOW_KEYS = ['gphRated', 'rated_gph', 'ratedGph', 'gph'];
const LEGACY_BUCKET_KEYS = ['minGallons', 'maxGallons'];
const LEGACY_KEYS = [...LEGACY_FLOW_KEYS, ...LEGACY_BUCKET_KEYS];
// Picker / chip text a sponge must never show.
const SPONGE_TEXT_FORBIDDEN = /GPH|\b\d+ ?g\b|\d+g–|∞|\b(60|80|120|150|200)\b/;

// The runtime (loader) shape of each sponge after phase E: identity + rating metadata, nothing else.
const EXPECTED_LOADED = {
  [AQUANEAT_SMALL]: { capacityMethod: 'manufacturer_rating', ratingStatus: 'needed' },
  [AQUANEAT_MIDDLE]: { capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 20, ratingStatus: 'needs_review' },
  [AQUANEAT_LARGE]: { capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 60, manufacturerMinGallons: 40, ratingStatus: 'needs_review' },
  [HYGGER_S]: { capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 40, manufacturerMinGallons: 10, ratingStatus: 'verified' },
  [HYGGER_M]: { capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 55, manufacturerMinGallons: 15, ratingStatus: 'verified' },
  [PAWFLY]: { capacityMethod: 'manufacturer_rating', ratingStatus: 'needed' },
  [POWKOO]: { capacityMethod: 'manufacturer_rating', ratingStatus: 'needed' },
};
const EXPECTED_BADGE = {
  [HYGGER_S]: 'Rated 10–40 gal',
  [HYGGER_M]: 'Rated 15–55 gal',
  [AQUANEAT_SMALL]: 'Rating needed',
  [AQUANEAT_MIDDLE]: 'Rating needed',
  [AQUANEAT_LARGE]: 'Rating needed',
  [PAWFLY]: 'Rating needed',
  [POWKOO]: 'Rating needed',
};

function storageWith(values = {}) {
  const map = new Map(Object.entries(values));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}
const v1Storage = (list) => storageWith({ [V1]: JSON.stringify(list) });
const v2Storage = (filters) => storageWith({ [V2]: JSON.stringify({ v: 2, filters }) });

// --- controller model (createProductFilter / hydrateFromAppState → setFilters), as in phases C / D ---
function productItem(product) {
  if (math.isSpongeFilter(product)) return items.buildSpongeProductItem(product);
  return { id: product.id, source: 'product', label: product.name, type: product.type, gph: Math.round(product.gphRated),
    productId: product.id, capacityMethod: 'flow' };
}
function controllerRestore(filters, catalogById = CATALOG_BY_ID) {
  const out = [];
  for (const entry of filters) {
    const id = typeof entry?.id === 'string' && entry.id ? entry.id : null;
    const product = id ? catalogById.get(id) ?? null : null;
    const kind = items.restoreKind(entry, product);
    if (kind === items.RESTORE_KINDS.DROP) continue;
    if (kind === items.RESTORE_KINDS.PRODUCT) {
      const item = math.isSpongeFilter(product) ? items.restoreSpongeItem(entry, product) : productItem(product);
      const fields = math.pickPassthroughFields(entry);
      out.push(fields.instanceId ? { ...item, instanceId: fields.instanceId } : item);
      continue;
    }
    if (kind === items.RESTORE_KINDS.SPONGE) {
      out.push(items.restoreSpongeItem(entry, null));
      continue;
    }
    const gph = Math.min(Math.round(Number(entry.rated_gph ?? entry.gph) || 0), 1500);
    if (gph > 0) {
      out.push({ id, source: 'custom', label: `${entry.type} ${gph} GPH`, type: entry.type, gph,
        ...math.pickPassthroughFields(entry), capacityMethod: math.effectiveCapacityMethod(entry) });
    }
  }
  return instances.withUniqueInstanceIds(out);
}
function toApp(item) {
  const sponge = math.isSpongeFilter({ type: item.type });
  return {
    id: item.id,
    type: item.type,
    rated_gph: sponge ? 0 : item.gph,
    kind: item.type,
    source: item.source,
    ...math.pickPassthroughFields(item),
    capacityMethod: math.effectiveCapacityMethod(item),
    ...(item.label && (sponge || item.source === 'custom') ? { label: item.label } : {}),
  };
}
const addProduct = (list, productId, catalogById = CATALOG_BY_ID) =>
  instances.withUniqueInstanceIds(list.concat([productItem(catalogById.get(productId))]));

const STOCK = [['neon', 10], ['cory_bronze', 6]];
function run(tankId, appFilters, { stock = STOCK } = {}) {
  const state = compute.createDefaultState();
  const tank = getTankById(tankId);
  Object.assign(state, {
    tank: { ...tank },
    gallons: tank.gallons,
    selectedTankId: tank.id,
    stock: stock.map(([id, qty]) => ({ id, qty })),
    filters: appFilters,
  });
  return compute.buildComputedState(state);
}
const computeFor = (tankId, list, options) => run(tankId, math.normalizeFilters(list.map(toApp)), options);
const load = (computed) => JSON.stringify([computed.bioload.currentPercent, computed.bioload.proposedPercent, computed.bioload.text,
  computed.bioload.severity, computed.bioload.proposed, computed.bioload.effectiveCapacity]);
const warningIds = (computed) => (computed.filtering.warnings ?? []).map((w) => w.id);
const assess = (list, gallons) => math.assessFiltration({ filters: list.map(toApp), gallons, hasStock: true });

// One page load through saved state: read → stocking.js view → controller restore → save.
function pageLoad(storage, { catalogById = CATALOG_BY_ID, tank = '29g' } = {}) {
  const state = saved.readSavedFilterState(storage);
  const preController = run(tank, compute.sanitizeFilterList(state.filters));
  const restored = controllerRestore(state.filters, catalogById);
  const appFilters = restored.map(toApp);
  const computed = run(tank, math.normalizeFilters(appFilters));
  saved.writeSavedFilters(storage, appFilters);
  const written = JSON.parse(storage.map.get(V2) ?? 'null');
  const mirror = JSON.parse(storage.map.get(V1) ?? '[]');
  return { state, preController, restored, appFilters, computed, written, mirror };
}
function assertNoSpongeFlow(result, label) {
  for (const computed of [result.preController, result.computed]) {
    const spongeFlow = (computed.filtering.filters ?? [])
      .filter((f) => math.isSpongeFilter(f)).reduce((sum, f) => sum + (f.ratedGph || 0), 0);
    assert.equal(spongeFlow, 0, `${label}: sponge flow`);
  }
  for (const entry of result.written?.filters ?? []) {
    if (entry.type !== 'SPONGE') continue;
    assert.equal(entry.capacityMethod, 'manufacturer_rating', `${label}: saved method`);
    for (const key of LEGACY_KEYS) assert.equal(key in entry, false, `${label}: saved ${key}`);
  }
  for (const entry of result.mirror) assert.notEqual(entry.type, 'SPONGE', `${label}: v1 mirror`);
}

let freshCounter = 0;
async function freshGearData(localValues) {
  const store = storageWith(localValues);
  globalThis.localStorage = store;
  freshCounter += 1;
  const gear = await import(`../../js/gear-data.js?phase-e=${freshCounter}`);
  return { gear, store };
}
const realFetch = async () => ({ ok: true, json: async () => RAW });
const failingFetch = async () => { throw new Error('offline'); };
const catalogOf = (list) => new Map(list.map((item) => [item.id, item]));

// ---------------------------------------------------------------------------------------------
// Current catalog data (steps 4–6)

test('current catalog: the seven sponge records carry no legacy GPH, GPH bucket or legacy note', () => {
  const sponges = RAW.filter((item) => item.type === 'SPONGE');
  assert.deepEqual(sponges.map((item) => item.id).sort(), [...SPONGE_IDS].sort());
  assert.deepEqual([...math.KNOWN_SPONGE_PRODUCT_IDS].sort(), [...SPONGE_IDS].sort(), 'known-sponge safety list kept');
  for (const item of sponges) {
    for (const key of [...LEGACY_KEYS, 'legacyFieldsNote']) {
      assert.equal(key in item, false, `${item.id}: ${key}`);
    }
  }
});

test('current catalog: manufacturer rating metadata is exactly as phase B locked it', () => {
  const expected = {
    [AQUANEAT_SMALL]: [null, null, 'needed', 'unclear'],
    [AQUANEAT_MIDDLE]: [null, 20, 'needs_review', 'up_to'],
    [AQUANEAT_LARGE]: [40, 60, 'needs_review', 'range'],
    [HYGGER_S]: [10, 40, 'verified', 'range'],
    [HYGGER_M]: [15, 55, 'verified', 'range'],
    [PAWFLY]: [null, null, 'needed', 'unclear'],
    [POWKOO]: [null, null, 'needed', 'unclear'],
  };
  for (const [id, [min, max, status, expression]] of Object.entries(expected)) {
    const record = RAW.find((item) => item.id === id);
    assert.equal(record.capacityMethod, 'manufacturer_rating', id);
    assert.deepEqual([record.manufacturerMinGallons, record.manufacturerMaxGallons, record.ratingStatus, record.ratingExpression],
      [min, max, status, expression], id);
  }
});

test('current catalog: powered records and the UGF keep their GPH and tank range (unchanged in phase E)', () => {
  const expected = {
    [TETRA]: ['HOB', 215, 40, 75],
    [AC70]: ['HOB', 300, 40, 70],
    'fluval-307': ['CANISTER', 303, 40, 70],
    'eheim-2213': ['CANISTER', 116, 21, 66],
    [UGF]: ['UGF', 150, 20, 40],
  };
  for (const [id, [type, gph, min, max]] of Object.entries(expected)) {
    const record = RAW.find((item) => item.id === id);
    assert.deepEqual([record.type, record.gphRated, record.minGallons, record.maxGallons], [type, gph, min, max], id);
    const loaded = CATALOG_BY_ID.get(id);
    assert.deepEqual([loaded.type, loaded.gphRated, loaded.rated_gph, loaded.minGallons, loaded.maxGallons], [type, gph, gph, min, max], `${id} loaded`);
  }
  // Every non-sponge record still has a positive GPH and a tank range.
  for (const record of RAW.filter((item) => item.type !== 'SPONGE')) {
    assert.ok(record.gphRated > 0, record.id);
    assert.ok(Number.isFinite(record.minGallons) && Number.isFinite(record.maxGallons), record.id);
  }
  assert.equal(CATALOG.length, RAW.length, 'no record dropped by the loader');
});

// ---------------------------------------------------------------------------------------------
// Loader / sanitizer (step 7) and current catalog cache (step 16)

test('loader: a current sponge record is identity + rating metadata only (no synthetic 0 GPH, no bucket)', () => {
  for (const id of SPONGE_IDS) {
    const item = CATALOG_BY_ID.get(id);
    const { brand, name } = RAW.find((record) => record.id === id);
    assert.deepEqual(item, { id, brand, name, type: 'SPONGE', ...EXPECTED_LOADED[id] }, id);
  }
});

test('current catalog cache (ttg.gear.catalog.v2) holds no sponge GPH or bucket fields, written and re-read', async () => {
  try {
    const { gear, store } = await freshGearData({});
    await gear.getGearData({ fetchImpl: realFetch });
    const cached = JSON.parse(store.map.get(CACHE_KEY));
    for (const id of SPONGE_IDS) {
      const record = cached.find((item) => item.id === id);
      for (const key of LEGACY_KEYS) assert.equal(key in record, false, `cached ${id}: ${key}`);
      assert.equal(record.capacityMethod, 'manufacturer_rating', id);
    }
    // Powered records in the cache keep their GPH and range.
    assert.deepEqual(['gphRated', 'rated_gph', 'minGallons', 'maxGallons'].map((key) => cached.find((item) => item.id === TETRA)[key]), [215, 215, 40, 75]);
    // Served from that cache on the next load (offline): the same clean records.
    const again = await freshGearData({ [CACHE_KEY]: store.map.get(CACHE_KEY), 'ttg.gear.catalog.timestamp': '1' });
    const fromCache = await again.gear.getGearData({ fetchImpl: failingFetch });
    assert.equal(again.gear.getGearDataMeta().source, 'CACHE');
    for (const id of SPONGE_IDS) {
      const record = fromCache.find((item) => item.id === id);
      assert.deepEqual(record, CATALOG_BY_ID.get(id), `re-read ${id}`);
    }
  } finally {
    delete globalThis.localStorage;
  }
});

test('picker order is unchanged without sponge GPH (sponges ordered by manufacturer size within a brand)', () => {
  const order = sortGearItems(CATALOG).filter((item) => item.type === 'SPONGE').map((item) => item.id);
  // The order the legacy sponge GPH (60 / 120 / 200, 80 / 120) produced before phase E.
  assert.deepEqual(order, [AQUANEAT_SMALL, AQUANEAT_MIDDLE, AQUANEAT_LARGE, HYGGER_S, HYGGER_M, PAWFLY, POWKOO]);
  // Powered filters: still by type, brand, then rated GPH.
  const powered = sortGearItems(CATALOG).filter((item) => item.type !== 'SPONGE');
  for (let i = 1; i < powered.length; i += 1) {
    const [a, b] = [powered[i - 1], powered[i]];
    if (a.type === b.type && a.brand === b.brand) assert.ok(a.gphRated <= b.gphRated, `${a.id} before ${b.id}`);
  }
});

// ---------------------------------------------------------------------------------------------
// Stale cache compatibility (step 15): OLD cached sponge records still carrying fake GPH / buckets

test('stale cache, pre-phase-B shape (fake GPH + bucket, no rating): harmless — 0 GPH, Rating needed, bucket never a rating', async () => {
  const OLD = { [HYGGER_S]: [80, 0, 20], [HYGGER_M]: [120, 0, 20], [AQUANEAT_MIDDLE]: [120, 0, 20], [AQUANEAT_LARGE]: [200, 20, 40],
    [AQUANEAT_SMALL]: [60, 0, 20], [PAWFLY]: [60, 0, 20], [POWKOO]: [150, 20, 40] };
  const stale = RAW.map((record) => (OLD[record.id]
    ? { id: record.id, brand: record.brand, name: `${record.name} (Up to ${OLD[record.id][2]}G)`, type: 'SPONGE',
      gphRated: OLD[record.id][0], rated_gph: OLD[record.id][0], minGallons: OLD[record.id][1], maxGallons: OLD[record.id][2], capacityMethod: 'flow' }
    : record));
  try {
    const { gear } = await freshGearData({ [CACHE_KEY]: JSON.stringify(stale) });
    const list = await gear.getGearData({ fetchImpl: failingFetch });
    for (const id of SPONGE_IDS) {
      const record = list.find((item) => item.id === id);
      assert.equal(record.type, 'SPONGE', id);
      for (const key of LEGACY_KEYS) assert.equal(key in record, false, `stale ${id}: ${key} dropped by the loader`);
      assert.equal(record.manufacturerMaxGallons, undefined, `${id}: old maxGallons is not a rating`);
      const item = items.buildSpongeProductItem(record);
      assert.deepEqual([item.gph, item.capacityMethod, items.spongeChipBadge(item)], [0, 'manufacturer_rating', 'Rating needed'], id);
      assert.doesNotMatch(items.spongeOptionDetails(record), SPONGE_TEXT_FORBIDDEN, id);
    }
    // Every tank: sponges offered; filtration never evaluated from the old GPH.
    for (const tank of TANK_SIZES) {
      assert.equal(filterGearByTank(list, tank.gallons).filter((item) => item.type === 'SPONGE').length, 7, tank.id);
      for (const id of SPONGE_IDS) {
        const computed = computeFor(tank.id, addProduct([], id, catalogOf(list)));
        assert.deepEqual([computed.filtering.level, computed.filtering.gphTotal, computed.filtering.turnover], ['not-evaluated', 0, 0], `${tank.id} ${id}`);
      }
    }
    // A saved plan restored against the stale cache.
    const plan = pageLoad(v1Storage(SPONGE_IDS.map((id) => ({ id, type: 'SPONGE', rated_gph: OLD[id][0] }))), { catalogById: catalogOf(list) });
    assert.equal(plan.computed.filtering.level, 'not-evaluated');
    assertNoSpongeFlow(plan, 'stale pre-B cache');
  } finally {
    delete globalThis.localStorage;
  }
});

test('stale cache, phase B–D shape (fake GPH + bucket + rating metadata, as main wrote it): rating used, GPH never', async () => {
  // Exactly what the pre-phase-E loader wrote to ttg.gear.catalog.v2 for a returning visitor.
  const LEGACY = { [AQUANEAT_SMALL]: [60, 0, 20], [AQUANEAT_MIDDLE]: [120, 0, 20], [AQUANEAT_LARGE]: [200, 20, 40],
    [HYGGER_S]: [80, 0, 20], [HYGGER_M]: [120, 0, 20], [PAWFLY]: [60, 0, 20], [POWKOO]: [150, 20, 40] };
  const stale = CATALOG.map((item) => (LEGACY[item.id]
    ? { ...item, gphRated: LEGACY[item.id][0], rated_gph: LEGACY[item.id][0], minGallons: LEGACY[item.id][1], maxGallons: LEGACY[item.id][2] }
    : item));
  try {
    const { gear, store } = await freshGearData({ [CACHE_KEY]: JSON.stringify(stale) });
    let refreshed;
    const refreshDone = new Promise((resolve) => { refreshed = resolve; });
    const fetchImpl = async (...args) => { const res = await realFetch(...args); setTimeout(refreshed, 0); return res; };
    const list = await gear.getGearData({ fetchImpl });
    assert.equal(gear.getGearDataMeta().source, 'CACHE');
    for (const id of SPONGE_IDS) {
      assert.deepEqual(list.find((item) => item.id === id), CATALOG_BY_ID.get(id), `${id}: stale legacy fields dropped, rating kept`);
    }
    const hyggerOn29 = computeFor('29g', addProduct([], HYGGER_S, catalogOf(list)));
    assert.deepEqual([hyggerOn29.filtering.level, hyggerOn29.filtering.gphTotal], ['adequate', 0]);
    const twoOn55 = computeFor('55g', addProduct(addProduct([], HYGGER_S, catalogOf(list)), HYGGER_S, catalogOf(list)));
    assert.deepEqual([twoOn55.filtering.level, twoOn55.filtering.gphTotal], ['likely-multi-sponge', 0]);
    const middle = computeFor('10g', addProduct([], AQUANEAT_MIDDLE, catalogOf(list)));
    assert.deepEqual([middle.filtering.level, middle.filtering.gphTotal], ['not-evaluated', 0], 'review-only max 20 never scores');
    // The background refresh replaces the stale cache with clean records.
    await refreshDone;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const cached = JSON.parse(store.map.get(CACHE_KEY));
    for (const id of SPONGE_IDS) {
      const record = cached.find((item) => item.id === id);
      for (const key of LEGACY_KEYS) assert.equal(key in record, false, `refreshed ${id}: ${key}`);
    }
  } finally {
    delete globalThis.localStorage;
  }
});

test('stale / damaged cache typing a known sponge as a 900 GPH HOB with a bucket is still a GPH-less sponge', async () => {
  const damaged = CATALOG.map((item) => (item.id === HYGGER_S
    ? { ...item, type: 'HOB', gphRated: 900, rated_gph: 900, minGallons: 0, maxGallons: 20, capacityMethod: 'flow' }
    : item));
  try {
    const { gear } = await freshGearData({ [CACHE_KEY]: JSON.stringify(damaged) });
    const list = await gear.getGearData({ fetchImpl: failingFetch });
    const record = list.find((item) => item.id === HYGGER_S);
    assert.equal(record.type, 'SPONGE');
    for (const key of LEGACY_KEYS) assert.equal(key in record, false, key);
    const plan = pageLoad(v2Storage([{ instanceId: 'f-dmg001', source: 'product', productId: HYGGER_S, type: 'HOB', capacityMethod: 'flow', gph: 900 }]),
      { catalogById: catalogOf(list) });
    assert.equal(plan.computed.filtering.gphTotal, 0);
    assertNoSpongeFlow(plan, 'damaged cache');
  } finally {
    delete globalThis.localStorage;
  }
});

test('malformed stale sponge records (junk GPH / bucket values) never crash and never produce a rating', async () => {
  const junk = [
    { gphRated: 'huge', minGallons: 'x', maxGallons: null },
    { gphRated: -5, minGallons: -10, maxGallons: -1 },
    { gphRated: Infinity, maxGallons: Infinity },
    { gphRated: { a: 1 }, maxGallons: [40] },
    { rated_gph: 1e9, ratedGph: 1e9, gph: 1e9, minGallons: 1e9, maxGallons: 1e9 },
  ];
  try {
    for (const fields of junk) {
      const stale = [{ id: AQUANEAT_LARGE, brand: 'AQUANEAT', name: 'Old', type: 'SPONGE', ...fields }, RAW.find((item) => item.id === TETRA)];
      const { gear } = await freshGearData({ [CACHE_KEY]: JSON.stringify(stale) });
      const list = await gear.getGearData({ fetchImpl: failingFetch });
      const record = list.find((item) => item.id === AQUANEAT_LARGE);
      assert.ok(record, JSON.stringify(fields));
      for (const key of LEGACY_KEYS) assert.equal(key in record, false, `${JSON.stringify(fields)}: ${key}`);
      assert.equal(items.spongeChipBadge(record), 'Rating needed');
      const computed = computeFor('40b', addProduct([], AQUANEAT_LARGE, catalogOf(list)));
      assert.deepEqual([computed.filtering.level, computed.filtering.gphTotal], ['not-evaluated', 0]);
    }
  } finally {
    delete globalThis.localStorage;
  }
});

// ---------------------------------------------------------------------------------------------
// Picker (step 8), option labels (step 9) and chips (step 10)

test('picker: all seven sponges offered on every tank size without generic buckets; powered picker unchanged', () => {
  const sample = [...TANK_SIZES.map((tank) => tank.gallons), 1, 2.5, 3, 12, 33, 90, 150, 300, 999];
  for (const gallons of sample) {
    const offered = filterGearByTank(CATALOG, gallons);
    assert.deepEqual(offered.filter((item) => item.type === 'SPONGE').map((item) => item.id).sort(), [...SPONGE_IDS].sort(), `${gallons} gal`);
    const powered = offered.filter((item) => item.type !== 'SPONGE').map((item) => item.id);
    const expected = CATALOG.filter((item) => item.type !== 'SPONGE' && gallons >= item.minGallons && gallons <= item.maxGallons).map((item) => item.id);
    assert.deepEqual(powered, expected, `${gallons} gal powered`);
  }
  // No usable tank size: the whole list, sponges included.
  assert.equal(filterGearByTank(CATALOG, 0).length, CATALOG.length);
  assert.equal(filterGearByTank(CATALOG, NaN).length, CATALOG.length);
  // The controller's whole-catalog fallback counts powered matches only; every preset has one.
  for (const tank of TANK_SIZES) {
    assert.ok(filterGearByTank(CATALOG, tank.gallons).some((item) => item.type !== 'SPONGE'), tank.id);
  }
});

test('option details and chip badges: rating based; no GPH, no 0 GPH, no legacy GPH, no generic bucket text', () => {
  for (const id of SPONGE_IDS) {
    const record = CATALOG_BY_ID.get(id);
    assert.equal(items.spongeOptionDetails(record), `Sponge • ${EXPECTED_BADGE[id]}`, id);
    const item = productItem(record);
    assert.equal(items.spongeChipBadge(item), EXPECTED_BADGE[id], id);
    assert.doesNotMatch(items.spongeOptionDetails(record), SPONGE_TEXT_FORBIDDEN, id);
    assert.doesNotMatch(items.spongeChipBadge(item), SPONGE_TEXT_FORBIDDEN, id);
  }
});

// ---------------------------------------------------------------------------------------------
// Scoring and saved state (steps 13, 19, 20)

test('five non-verified sponges never score; the two hygger ratings do', () => {
  for (const id of UNVERIFIED) {
    for (const tank of TANK_SIZES) {
      const assessment = assess(addProduct([], id), tank.gallons);
      assert.deepEqual([assessment.level, assessment.biologicalGph, assessment.sponge.verifiedCount], ['not-evaluated', 0, 0], `${id} ${tank.id}`);
    }
  }
  // Review-only AQUANEAT Middle max 20 does not score even on a 10 gal tank; nor Large 40–60 on 40.
  assert.equal(assess(addProduct([], AQUANEAT_MIDDLE), 10).level, 'not-evaluated');
  assert.equal(assess(addProduct([], AQUANEAT_LARGE), 40).level, 'not-evaluated');
  assert.equal(assess(addProduct([], HYGGER_S), 40).level, 'adequate');
  assert.equal(assess(addProduct([], HYGGER_S), 55).level, 'below-rating');
  assert.equal(assess(addProduct([], HYGGER_M), 55).level, 'adequate');
  assert.equal(assess(addProduct([], HYGGER_M), 75).level, 'below-rating');
});

test('new catalog sponge selection saves identity + instanceId + manufacturer_rating only; re-resolved from the catalog', () => {
  const list = SPONGE_IDS.reduce((acc, id) => addProduct(acc, id), []);
  const storage = storageWith();
  saved.writeSavedFilters(storage, list.map(toApp));
  const written = JSON.parse(storage.map.get(V2));
  assert.equal(written.filters.length, 7);
  written.filters.forEach((entry, index) => {
    assert.deepEqual(Object.keys(entry).sort(), ['capacityMethod', 'instanceId', 'productId', 'source', 'type'], SPONGE_IDS[index]);
    assert.deepEqual([entry.productId, entry.type, entry.capacityMethod, entry.instanceId], [SPONGE_IDS[index], 'SPONGE', 'manufacturer_rating', list[index].instanceId]);
  });
  assert.equal(storage.map.has(V1), false, 'sponge-only plan: no v1 mirror');
  const reload = pageLoad(storage, { tank: '29g' });
  assert.deepEqual(reload.restored.map((item) => [item.productId, item.instanceId, items.spongeChipBadge(item)]),
    list.map((item) => [item.productId, item.instanceId, EXPECTED_BADGE[item.productId]]));
  assertNoSpongeFlow(reload, 'current selection');
});

test('duplicates after cleanup: 2 × hygger S → likely-multi on 55, rated on 29; independent instanceIds; 0 GPH', () => {
  const list = addProduct(addProduct([], HYGGER_S), HYGGER_S);
  assert.notEqual(list[0].instanceId, list[1].instanceId);
  assert.ok(list.every((item) => item.productId === HYGGER_S && item.gph === 0));
  const on55 = assess(list, 55);
  assert.deepEqual([on55.level, on55.status.text, on55.biologicalGph], ['likely-multi-sponge', 'Likely adequate — multiple sponge filters', 0]);
  const on29 = assess(list, 29);
  assert.deepEqual([on29.level, on29.status.text, on29.biologicalGph], ['adequate', 'Rated for this tank', 0]);
  const reload = pageLoad(v2Storage(list.map(toApp).map((app) => ({ ...app }))), { tank: '55g' });
  assert.deepEqual(reload.restored.map((item) => item.instanceId), list.map((item) => item.instanceId));
  assert.equal(reload.computed.filtering.level, 'likely-multi-sponge');
});

test('2 × AQUANEAT Middle: both kept, Rating needed, 0 GPH, not evaluated unless another filter passes', () => {
  const list = addProduct(addProduct([], AQUANEAT_MIDDLE), AQUANEAT_MIDDLE);
  for (const tank of TANK_SIZES) {
    const computed = computeFor(tank.id, list);
    assert.deepEqual([computed.filtering.level, computed.filtering.gphTotal, warningIds(computed).join()],
      ['not-evaluated', 0, 'filtration.rating_needed'], tank.id);
  }
  list.forEach((item) => assert.equal(items.spongeChipBadge(item), 'Rating needed'));
  const withAc70 = assess(addProduct(list, AC70), 55);
  assert.deepEqual([withAc70.level, withAc70.adequateBy], ['adequate', 'powered']);
});

test('powered filters score as before: Tetra IQ 45 215, AquaClear 70 300, Fluval 307 303, EHEIM 2213 116 GPH', () => {
  const expected = { [TETRA]: 215, [AC70]: 300, 'fluval-307': 303, 'eheim-2213': 116 };
  for (const [id, gph] of Object.entries(expected)) {
    for (const tank of TANK_SIZES) {
      const computed = computeFor(tank.id, addProduct([], id));
      assert.equal(computed.filtering.gphTotal, gph, `${id} ${tank.id}`);
      assert.equal(computed.filtering.level, gph / tank.gallons >= 2 ? 'adequate' : 'very-low', `${id} ${tank.id}`);
    }
  }
});

test('UGF unchanged in phase E: flow-scored at its legacy 150 GPH, offered on its 20–40 gal range', () => {
  const ugf = CATALOG_BY_ID.get(UGF);
  assert.equal(math.isSpongeFilter(ugf), false);
  assert.equal(math.effectiveCapacityMethod(ugf), 'flow');
  assert.deepEqual(TANK_SIZES.filter((tank) => filterGearByTank([ugf], tank.gallons).length).map((tank) => tank.id), ['20h', '20l', '29g', '40b']);
  const computed = computeFor('29g', addProduct([], UGF));
  assert.deepEqual([computed.filtering.gphTotal, computed.filtering.level], [150, 'adequate']);
});

// ---------------------------------------------------------------------------------------------
// Old saved state (steps 11, 14): migration support kept

test('old saved sponge GPH is still neutralised: v1, phase A v2, known sponge saved as a 900 GPH HOB', () => {
  for (const id of SPONGE_IDS) {
    for (const gph of [60, 120, 200, 900, 1500]) {
      const v1 = pageLoad(v1Storage([{ id, type: 'SPONGE', rated_gph: gph }]));
      assertNoSpongeFlow(v1, `v1 ${id} ${gph}`);
      const phaseA = pageLoad(v2Storage([{ instanceId: 'f-olda01', source: 'product', productId: id, type: 'SPONGE', capacityMethod: 'flow', gph }]));
      assertNoSpongeFlow(phaseA, `phase A ${id} ${gph}`);
      assert.equal(phaseA.restored[0].instanceId, 'f-olda01');
    }
    // Contradictory saved type, catalog loaded and unavailable.
    for (const catalogById of [CATALOG_BY_ID, new Map()]) {
      const conflict = pageLoad(v2Storage([{ instanceId: 'f-conf01', source: 'product', productId: id, type: 'HOB', capacityMethod: 'flow', gph: 900 }]), { catalogById });
      assert.equal(conflict.computed.filtering.gphTotal, 0, id);
      assertNoSpongeFlow(conflict, `conflict ${id}`);
    }
  }
});

test('legacyGph is kept for old custom GPH-only sponges (one migration cycle; never scored or shown)', () => {
  const result = pageLoad(v1Storage([{ id: 'manual-old1', type: 'SPONGE', rated_gph: 120 }]));
  assert.equal(result.restored[0].legacyGph, 120);
  assert.equal(items.spongeChipBadge(result.restored[0]), 'Rating needed');
  assert.equal(result.written.filters[0].legacyGph, 120);
  assert.equal(result.written.filters[0].ratingStatus, 'needed');
  assertNoSpongeFlow(result, 'old custom sponge');
  assert.equal(result.computed.filtering.level, 'not-evaluated');
});

// ---------------------------------------------------------------------------------------------
// Stocking Load (step 21)

test('STOCKING LOAD: no filter = verified sponge = duplicate verified sponges = unrated sponge = powered filter', () => {
  const stocks = [STOCK, [['neon', 30], ['cory_bronze', 12], ['otocinclus', 6]], [['betta_male', 1]]];
  for (const tank of TANK_SIZES) {
    for (const stock of stocks) {
      const noFilter = computeFor(tank.id, [], { stock });
      assert.ok(noFilter.bioload.currentPercent > 0, `${tank.id}: the stock produces a load`);
      const reference = load(noFilter);
      const cases = {
        verified: addProduct([], HYGGER_S),
        duplicate: addProduct(addProduct([], HYGGER_S), HYGGER_S),
        unrated: addProduct([], AQUANEAT_MIDDLE),
        powered: addProduct([], TETRA),
      };
      for (const [label, list] of Object.entries(cases)) {
        const computed = computeFor(tank.id, list, { stock });
        assert.equal(load(computed), reference, `${tank.id} ${label}`);
        assert.equal(computed.filtering.assessment?.capacityAdjustment ?? 0, 0);
      }
    }
  }
});
