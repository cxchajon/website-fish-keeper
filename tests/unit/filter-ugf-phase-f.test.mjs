// Sponge migration phase F: dedicated undergravel filter (UGF) model, design D12.
// Report: _internal/reports/stocking-advisor-sponge-migration-phase-f-2026-09.md
//   CURRENT catalog: penn-plax-ugf-20-29 has type UGF, capacityMethod tank_compatibility and
//   compatibleTanks ["20l", "29g"]; no gphRated, no generic minGallons / maxGallons, no gallon rating.
//   Evaluation is by the canonical tank preset id only: 20h and 20l are both 20 gallons, only 20l is
//   listed. A UGF is biological filtration with 0 GPH and no turnover.
//   HISTORICAL data (v1 plans, phase A v2 flow entries, stale v3 caches, HOB-900 conflicts, old custom
//   UGFs) keeps its 150 / 900 GPH in the fixtures on purpose: none of it may ever score.
//   Cache: current key ttg.gear.catalog.v4; v3 (phase E) is never read or written by current code.
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
const ugfItems = await import('../../js/stocking-advisor/filtration/ugf-items.js');
const instances = await import('../../js/stocking-advisor/filtration/instances.js');
const { getGearData, filterGearByTank, isUndergravelEligibleForTank } = await import('../../js/gear-data.js');
const { getTankById, TANK_SIZES } = await import('../../js/utils.js');

await compute.initializeCompute();
const RAW = readJson('assets/data/gearCatalog.json');
const CATALOG = await getGearData({ forceRefresh: true });
const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.id, item]));
const OFFLINE = new Map();

const UGF = 'penn-plax-ugf-20-29';
const TETRA = 'tetra-whisper-iq-45';
const AC70 = 'aquaclear-70';
const FLUVAL = 'fluval-307';
const EHEIM = 'eheim-2213';
const HYGGER_S = 'hygger-double-sponge-s';
const AQUANEAT_MIDDLE = 'aquaneat-sponge-20';
const V1 = saved.FILTER_STORAGE_KEY_V1;
const V2 = saved.FILTER_STORAGE_KEY_V2;
const CACHE_KEY = 'ttg.gear.catalog.v4';
const PHASE_E_CACHE_KEY = 'ttg.gear.catalog.v3';

const ALL_PRESETS = ['5g', '10g', '15g', '20h', '20l', '29g', '40b', '55g', '75g', '125g'];
const COMPATIBLE = ['20l', '29g'];
const NOT_LISTED = ALL_PRESETS.filter((id) => !COMPATIBLE.includes(id));
const FLOW_KEYS = ['gphRated', 'rated_gph', 'ratedGph', 'gph'];
const BUCKET_KEYS = ['minGallons', 'maxGallons'];
const RATING_KEYS = ['manufacturerMaxGallons', 'manufacturerMinGallons', 'ratingStatus'];
// Text a UGF option / chip / warning must never show.
const UGF_TEXT_FORBIDDEN = /GPH|150|900|20g–40g|\b20–40\b|turnover|×\/h/;
const PASSING_TEXT = '✓ Undergravel filter rated for this tank';
const NOT_LISTED_TEXT = 'Rating needed — this undergravel filter isn\'t listed for this tank size';

function storageWith(values = {}) {
  const map = new Map(Object.entries(values));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}
const v1Storage = (list) => storageWith({ [V1]: JSON.stringify(list) });
const v2Storage = (filters) => storageWith({ [V2]: JSON.stringify({ v: 2, filters }) });

// --- controller model (createProductFilter / hydrateFromAppState → setFilters), as in phases C–E ---
function productItem(product) {
  if (math.isSpongeFilter(product)) return items.buildSpongeProductItem(product);
  if (math.isUndergravelFilter(product)) return ugfItems.buildUgfProductItem(product);
  return { id: product.id, source: 'product', label: product.name, type: product.type, gph: Math.round(product.gphRated),
    productId: product.id, capacityMethod: 'flow' };
}
function controllerRestore(filters, catalogById = CATALOG_BY_ID) {
  const out = [];
  const plates = new Set();
  for (const entry of filters) {
    const id = typeof entry?.id === 'string' && entry.id ? entry.id : null;
    const product = id ? catalogById.get(id) ?? null : null;
    const kind = items.restoreKind(entry, product);
    if (kind === items.RESTORE_KINDS.DROP) continue;
    // One plate set per tank (controller isUndergravelProduct: type UGF or a known UGF id).
    if ((product ?? entry).type === 'UGF' || math.isKnownUgfProductId(entry.productId ?? id)) {
      const key = product?.id ?? entry.productId ?? id;
      if (plates.has(key)) continue;
      plates.add(key);
    }
    if (kind === items.RESTORE_KINDS.PRODUCT) {
      let item;
      if (math.isSpongeFilter(product)) item = items.restoreSpongeItem(entry, product);
      else if (math.isUndergravelFilter(product)) item = ugfItems.restoreUgfItem(entry, product);
      else item = productItem(product);
      const fields = math.pickPassthroughFields(entry);
      out.push(fields.instanceId ? { ...item, instanceId: fields.instanceId } : item);
      continue;
    }
    if (kind === items.RESTORE_KINDS.SPONGE) {
      out.push(items.restoreSpongeItem(entry, null));
      continue;
    }
    if (kind === items.RESTORE_KINDS.UGF) {
      out.push(ugfItems.restoreUgfItem(entry, null));
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
// controller toAppFilter: sponges and UGFs carry no flow and keep their label.
function toApp(item) {
  const zeroFlow = math.isSpongeFilter({ type: item.type }) || math.isUndergravelFilter({ type: item.type });
  const fields = math.pickPassthroughFields(item);
  if (item.source !== 'product') delete fields.compatibleTanks;
  return {
    id: item.id,
    type: item.type,
    rated_gph: zeroFlow ? 0 : item.gph,
    kind: item.type,
    source: item.source,
    ...fields,
    capacityMethod: math.effectiveCapacityMethod(item),
    ...(item.label && (zeroFlow || item.source === 'custom') ? { label: item.label } : {}),
  };
}
const addProduct = (list, productId) => instances.withUniqueInstanceIds(list.concat([productItem(CATALOG_BY_ID.get(productId))]));
const custom = (type, gph) => ({ id: `manual-${type.toLowerCase()}-${gph}`, source: 'custom', label: `${type} ${gph} GPH`, type, gph, capacityMethod: 'flow' });

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
const warnings = (computed) => computed.filtering.warnings ?? [];
const warningIds = (computed) => warnings(computed).map((w) => w.id);
const ugfOnly = () => addProduct([], UGF);

function pageLoad(storage, { catalogById = CATALOG_BY_ID, tank = '29g' } = {}) {
  const state = saved.readSavedFilterState(storage);
  const preController = run(tank, compute.sanitizeFilterList(state.filters));
  const restored = controllerRestore(state.filters, catalogById);
  const appFilters = restored.map(toApp);
  const computed = run(tank, math.normalizeFilters(appFilters));
  saved.writeSavedFilters(storage, appFilters);
  const written = JSON.parse(storage.map.get(V2) ?? 'null');
  return { state, preController, restored, appFilters, computed, written, v1: storage.map.get(V1) ?? null };
}
// Every view of a UGF has zero flow; saved entries carry no GPH, range or compatibility copy.
function assertUgfNeverFlows(result, label) {
  for (const computed of [result.preController, result.computed]) {
    const ugfFlow = (computed.filtering.filters ?? []).filter((f) => math.isUndergravelFilter(f))
      .reduce((sum, f) => sum + (f.rated_gph || f.ratedGph || 0), 0);
    assert.equal(ugfFlow, 0, `${label}: UGF flow`);
    assert.equal(computed.filtering.assessment.ugf.gph, 0, `${label}: ugf.gph`);
  }
  for (const entry of result.written?.filters ?? []) {
    if (entry.type !== 'UGF') continue;
    assert.equal(entry.capacityMethod, 'tank_compatibility', `${label}: saved method`);
    for (const key of [...FLOW_KEYS, ...BUCKET_KEYS, ...RATING_KEYS, 'compatibleTanks', 'legacyGph']) {
      assert.equal(key in entry, false, `${label}: saved ${key}`);
    }
  }
  assert.equal(result.v1, null, `${label}: no v1 written`);
}

let freshCounter = 0;
async function freshGearData(localValues) {
  const store = storageWith(localValues);
  globalThis.localStorage = store;
  freshCounter += 1;
  const gear = await import(`../../js/gear-data.js?phase-f=${freshCounter}`);
  return { gear, store };
}
const realFetch = async () => ({ ok: true, json: async () => RAW });
const failingFetch = async () => { throw new Error('offline'); };
const STALE_UGF = { id: UGF, brand: 'Penn-Plax', name: 'Penn-Plax UGF', type: 'UGF', gphRated: 150, rated_gph: 150, minGallons: 20, maxGallons: 40 };

// ---------------------------------------------------------------------------------------------
// Tank presets and the catalog record (steps 2–5)

test('tank preset ids confirmed from js/utils.js: 20h and 20l are both 20 gal, 29g is 29 gal', () => {
  assert.deepEqual(TANK_SIZES.map((tank) => tank.id), ALL_PRESETS);
  assert.deepEqual([...math.TANK_PRESET_IDS], ALL_PRESETS);
  assert.equal(getTankById('20h').gallons, 20);
  assert.equal(getTankById('20l').gallons, 20);
  assert.equal(getTankById('29g').gallons, 29);
  assert.match(getTankById('20h').label, /High/);
  assert.match(getTankById('20l').label, /Long/);
});

test('current catalog UGF record: tank_compatibility, compatibleTanks exactly 20l + 29g, no GPH / bucket / gallon rating', () => {
  const record = RAW.find((item) => item.id === UGF);
  assert.equal(record.type, 'UGF');
  assert.equal(record.capacityMethod, 'tank_compatibility');
  assert.deepEqual(record.compatibleTanks, COMPATIBLE);
  for (const key of [...FLOW_KEYS, ...BUCKET_KEYS, ...RATING_KEYS]) assert.equal(key in record, false, key);
  // The product id is unchanged, so every saved plan still resolves it.
  assert.equal(RAW.filter((item) => item.type === 'UGF').length, 1);
  assert.deepEqual([...math.KNOWN_UGF_PRODUCT_IDS], RAW.filter((item) => item.type === 'UGF').map((item) => item.id));
  // The two safety lists never overlap.
  assert.equal(math.KNOWN_UGF_PRODUCT_IDS.some((id) => math.isKnownSpongeProductId(id)), false);
});

test('loader: the UGF survives with no GPH; exact loaded shape; never a synthetic 0 GPH or range', () => {
  const loaded = CATALOG_BY_ID.get(UGF);
  assert.deepEqual(loaded, {
    id: UGF,
    brand: 'Penn-Plax',
    name: RAW.find((item) => item.id === UGF).name,
    type: 'UGF',
    capacityMethod: 'tank_compatibility',
    compatibleTanks: ['20l', '29g'],
  });
  // Powered filters still need their GPH to load; a GPH-less powered record is still dropped.
  assert.equal(CATALOG_BY_ID.get(TETRA).gphRated, 215);
});

test('compatibleTanks sanitiser: array of recognised preset ids only, trimmed, de-duplicated; junk fails closed', () => {
  assert.deepEqual(math.sanitizeCompatibleTanks(['20l', '29g']), ['20l', '29g']);
  assert.deepEqual(math.sanitizeCompatibleTanks(['29g', ' 20l ', '20l', '', '  ', 'junk', 5, null, {}, ['20l'], '29G', '20L', 'g29']), ['20l', '29g']);
  for (const bad of ['20l,29g', '20l', 20, null, undefined, {}, { 0: '20l' }, [], [''], ['20'], [20, 29], ['20 gallon long'], ['<script>'], true]) {
    assert.equal(math.sanitizeCompatibleTanks(bad), null, JSON.stringify(bad));
    assert.equal('compatibleTanks' in math.pickPassthroughFields({ compatibleTanks: bad }), false, JSON.stringify(bad));
  }
  // Gallons never become preset ids.
  assert.equal(math.cleanTankPresetId('20'), null);
  assert.equal(math.cleanTankPresetId(20), null);
  assert.equal(math.cleanTankPresetId(' 20l '), '20l');
});

test('compatibility text: "20 Long–29 gal"; 20 High is never inside it', () => {
  assert.equal(math.formatCompatibleTanks(['20l', '29g']), '20 Long–29 gal');
  assert.equal(math.formatCompatibleTanks(['29g', '20l']), '20 Long–29 gal');
  assert.equal(math.formatCompatibleTanks(['20h', '29g']), '20 High, 29 gal');
  assert.equal(math.formatCompatibleTanks(null), null);
  assert.equal(ugfItems.ugfOptionDetails(CATALOG_BY_ID.get(UGF)), 'Undergravel • 20 Long–29 gal');
  assert.equal(ugfItems.ugfChipBadge(productItem(CATALOG_BY_ID.get(UGF))), 'Rated: 20 Long–29 gal');
  assert.equal(ugfItems.ugfChipBadge({ type: 'UGF' }), 'Rating needed');
  for (const text of [ugfItems.ugfOptionDetails(CATALOG_BY_ID.get(UGF)), ugfItems.ugfChipBadge(productItem(CATALOG_BY_ID.get(UGF)))]) {
    assert.doesNotMatch(text, UGF_TEXT_FORBIDDEN);
    assert.doesNotMatch(text, /Sponge/);
  }
});

// ---------------------------------------------------------------------------------------------
// Cache (steps 6, 37, 38)

test('catalog cache ttg.gear.catalog.v4: network writes v4 with a clean UGF; v3 never written; powered unchanged', async () => {
  const { gear, store } = await freshGearData({});
  assert.equal(gear.CATALOG_CACHE_KEY, CACHE_KEY);
  await gear.getGearData({ forceRefresh: true, fetchImpl: realFetch });
  assert.equal(store.map.has(PHASE_E_CACHE_KEY), false, 'v3 not written');
  const cached = JSON.parse(store.map.get(CACHE_KEY));
  const ugf = cached.find((item) => item.id === UGF);
  for (const key of [...FLOW_KEYS, ...BUCKET_KEYS, ...RATING_KEYS]) assert.equal(key in ugf, false, `cache: ${key}`);
  assert.deepEqual([ugf.type, ugf.capacityMethod, ugf.compatibleTanks], ['UGF', 'tank_compatibility', ['20l', '29g']]);
  const tetra = cached.find((item) => item.id === TETRA);
  assert.deepEqual([tetra.gphRated, tetra.minGallons, tetra.maxGallons], [215, 40, 75]);
  const hygger = cached.find((item) => item.id === HYGGER_S);
  assert.deepEqual([hygger.manufacturerMaxGallons, hygger.ratingStatus, 'gphRated' in hygger], [40, 'verified', false]);
});

test('an old phase E ttg.gear.catalog.v3 (UGF 150 GPH / 20–40) is not the current cache: ignored online and offline, left untouched', async () => {
  const v3 = JSON.stringify(RAW.map((item) => (item.id === UGF ? STALE_UGF : item)));
  {
    const { gear, store } = await freshGearData({ [PHASE_E_CACHE_KEY]: v3, 'ttg.gear.catalog.timestamp': '1' });
    const loaded = await gear.getGearData({ fetchImpl: realFetch });
    assert.equal(gear.getGearDataMeta().source, 'NETWORK');
    assert.deepEqual(loaded.find((item) => item.id === UGF).compatibleTanks, COMPATIBLE);
    assert.equal(store.map.get(PHASE_E_CACHE_KEY), v3, 'v3 left for tabs still running phase E code');
    assert.ok(store.map.has(CACHE_KEY));
  }
  {
    const { gear, store } = await freshGearData({ [PHASE_E_CACHE_KEY]: v3 });
    await assert.rejects(() => gear.getGearData({ fetchImpl: failingFetch }));
    assert.equal(store.map.has(CACHE_KEY), false);
    assert.equal(store.map.get(PHASE_E_CACHE_KEY), v3);
  }
});

test('stale UGF-shaped records fed through the current key are sanitised: 0 GPH, no range, no compatibility', async () => {
  const shapes = {
    'phase E shape (150 GPH, 20–40)': STALE_UGF,
    'typed HOB 900 GPH with a bucket': { ...STALE_UGF, type: 'HOB', gphRated: 900, rated_gph: 900 },
    'missing type': { id: UGF, brand: 'Penn-Plax', name: 'x', gphRated: 150 },
    'nonsense type, flow method': { id: UGF, brand: 'Penn-Plax', name: 'x', type: 'banana', capacityMethod: 'flow', gphRated: 150 },
    'junk compatibility': { ...STALE_UGF, compatibleTanks: '20l,29g' },
  };
  for (const [label, stale] of Object.entries(shapes)) {
    const others = RAW.filter((item) => item.id !== UGF);
    const { gear } = await freshGearData({ [CACHE_KEY]: JSON.stringify([...others, stale]), 'ttg.gear.catalog.timestamp': '1' });
    const loaded = await gear.getGearData({ fetchImpl: failingFetch });
    assert.equal(gear.getGearDataMeta().source, 'CACHE', label);
    const ugf = loaded.find((item) => item.id === UGF);
    assert.equal(ugf.type, 'UGF', label);
    assert.equal(ugf.capacityMethod, 'tank_compatibility', label);
    for (const key of [...FLOW_KEYS, ...BUCKET_KEYS, ...RATING_KEYS, 'compatibleTanks']) assert.equal(key in ugf, false, `${label}: ${key}`);
    // Not offered on any preset (no usable compatibility) and never scored.
    for (const id of ALL_PRESETS) {
      assert.equal(gear.filterGearByTank([ugf], getTankById(id).gallons, id).length, 0, `${label}: ${id} picker`);
      const computed = computeFor(id, [productItem(ugf)]);
      assert.equal(computed.filtering.gphTotal, 0, `${label}: ${id}`);
      assert.equal(computed.filtering.level, 'not-evaluated', `${label}: ${id}`);
    }
  }
  // An explicitly unsupported capacityMethod still fails closed: the record is not loaded at all.
  const { gear } = await freshGearData({ [CACHE_KEY]: JSON.stringify([...RAW.filter((item) => item.id !== UGF), { ...STALE_UGF, capacityMethod: 'banana' }]) });
  assert.equal((await gear.getGearData({ fetchImpl: failingFetch })).some((item) => item.id === UGF), false);
});

// ---------------------------------------------------------------------------------------------
// Capacity method and type wins (steps 9, 10)

test('effectiveCapacityMethod: UGF → tank_compatibility before any GPH is read; SPONGE unchanged; unsupported fails closed', () => {
  const shapes = [
    { type: 'UGF', gph: 150 },
    { type: 'Undergravel', rated_gph: 900 },
    { type: 'undergravel filter', ratedGph: 150 },
    { type: 'UGF', gphRated: 150, capacityMethod: 'flow' },
    { type: 'UGF', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 29, ratingStatus: 'verified' },
  ];
  for (const shape of shapes) {
    assert.equal(math.effectiveCapacityMethod(shape), 'tank_compatibility', JSON.stringify(shape));
    const normalized = math.normalizeFilter(shape);
    assert.deepEqual([normalized.ratedGph, normalized.rated_gph, normalized.capacityMethod], [0, 0, 'tank_compatibility'], JSON.stringify(shape));
    assert.equal(math.normalizeFilters([shape]).length, 1, 'kept with zero flow');
    assert.equal(math.assessFiltration({ filters: [shape], gallons: 29, tankId: '29g', hasStock: true }).biologicalGph, 0);
  }
  assert.equal(math.effectiveCapacityMethod({ type: 'SPONGE', gph: 120, capacityMethod: 'flow' }), 'manufacturer_rating');
  assert.equal(math.effectiveCapacityMethod({ type: 'HOB', gph: 150 }), 'flow');
  // A non-UGF device carrying tank_compatibility is unchanged (phase A: carried, not re-scored).
  assert.equal(math.effectiveCapacityMethod({ type: 'HOB', capacityMethod: 'tank_compatibility', gph: 150 }), 'tank_compatibility');
  assert.equal(math.normalizeFilter({ type: 'HOB', capacityMethod: 'tank_compatibility', gph: 150 }).ratedGph, 150);
  const banana = { type: 'UGF', capacityMethod: 'banana', gph: 150 };
  assert.equal(math.effectiveCapacityMethod(banana), null);
  assert.equal(math.normalizeFilters([banana]).length, 0);
  assert.equal(math.normalizeFilters(compute.sanitizeFilterList([banana])).length, 0, 'compute sanitizer keeps it failing closed');
  assert.equal(math.assessFiltration({ filters: compute.sanitizeFilterList([banana]), gallons: 29, tankId: '29g' }).level, 'none');
});

test('compute sanitizer: a known UGF id is a UGF whatever type / GPH it carries; its GPH never scores', () => {
  for (const type of ['HOB', 'CANISTER', '', 'banana', undefined, 'SPONGE']) {
    for (const gph of [150, 900]) {
      const [entry] = compute.sanitizeFilterList([{ id: UGF, productId: UGF, type, rated_gph: gph, gph, capacityMethod: 'flow' }]);
      assert.deepEqual([entry.type, entry.rated_gph, entry.capacityMethod], ['UGF', 0, 'tank_compatibility'], `${type} ${gph}`);
    }
  }
  // Conversely, a stale UGF type never turns a known sponge into a UGF.
  const [sponge] = compute.sanitizeFilterList([{ id: HYGGER_S, productId: HYGGER_S, type: 'UGF', rated_gph: 80 }]);
  assert.equal(sponge.type, 'SPONGE');
});

// ---------------------------------------------------------------------------------------------
// Evaluation by tank preset (steps 12–18, 39)

test('20 Long and 29: compatible → adequate, "Undergravel filter rated for this tank", 0 GPH, no turnover', () => {
  for (const id of COMPATIBLE) {
    const computed = computeFor(id, ugfOnly());
    const { filtering } = computed;
    assert.equal(filtering.level, 'adequate', id);
    assert.equal(filtering.assessment.adequateBy, 'ugf', id);
    assert.deepEqual(filtering.assessment.passingPaths, ['ugf'], id);
    assert.deepEqual(filtering.assessment.status, { icon: '✓', text: 'Undergravel filter rated for this tank', tone: 'good' }, id);
    assert.deepEqual([filtering.status.tone, filtering.status.text], ['good', 'Undergravel filter rated for this tank'], id);
    assert.deepEqual([filtering.gphTotal, filtering.biologicalGph, filtering.circulationGph, filtering.turnover, filtering.totalTurnover], [0, 0, 0, 0, 0], id);
    assert.equal(filtering.assessment.hasBiologicalFiltration, true, id);
    assert.equal(filtering.assessment.hasBiologicalGph, false, id);
    assert.equal(filtering.chip, null, id);
    const ugf = filtering.assessment.ugf;
    assert.deepEqual([ugf.count, ugf.status, ugf.rated, ugf.gph, ugf.tankId, ugf.capacityMethod], [1, 'compatible', true, 0, id, 'tank_compatibility'], id);
    const [entry] = ugf.entries;
    assert.deepEqual([entry.productId, entry.compatibleTanks, entry.tankId, entry.compatible, entry.compatibilityKnown, entry.status, entry.gph, entry.compatibilityText],
      [UGF, COMPATIBLE, id, true, true, 'compatible', 0, '20 Long–29 gal'], id);
    const note = warnings(computed).find((w) => w.id === 'filtration.ugf_rated');
    assert.equal(note.severity, 'info', id);
    assert.equal(note.title, PASSING_TEXT, id);
    assert.match(note.message, /^Rated for: 20 Long–29 gal tanks · Tank: (20|29) gal\./, id);
    assert.doesNotMatch(note.text, UGF_TEXT_FORBIDDEN, id);
    assert.doesNotMatch(note.text, /Sponge|sponge/, id);
    assert.deepEqual(warningIds(computed), ['filtration.ugf_rated'], id);
  }
});

test('HARD BLOCKER: 20 High vs 20 Long — same 20 gallons, different result', () => {
  const high = computeFor('20h', ugfOnly());
  const long = computeFor('20l', ugfOnly());
  assert.equal(high.tank.gallons, long.tank.gallons);
  assert.notEqual(high.filtering.level, long.filtering.level);
  assert.equal(long.filtering.level, 'adequate');
  assert.equal(high.filtering.level, 'not-evaluated');
  assert.equal(high.filtering.assessment.ugf.status, 'not-listed');
  assert.equal(high.filtering.assessment.ugf.entries[0].compatible, false);
  assert.equal(high.filtering.gphTotal, 0);
  assert.equal(long.filtering.gphTotal, 0);
  // Direct engine call, identical gallons, only the preset id differs.
  const list = ugfOnly().map(toApp);
  const direct = (tankId) => math.assessFiltration({ filters: list, gallons: 20, tankId, hasStock: true });
  assert.equal(direct('20l').level, 'adequate');
  assert.equal(direct('20h').level, 'not-evaluated');
});

test('every preset not listed (5, 10, 15, 20 High, 40 Breeder, 55, 75, 125): not evaluated, neutral, 0 GPH, never red', () => {
  for (const id of NOT_LISTED) {
    const computed = computeFor(id, ugfOnly());
    const { filtering } = computed;
    assert.equal(filtering.level, 'not-evaluated', id);
    assert.equal(filtering.assessment.adequateBy, null, id);
    assert.deepEqual(filtering.assessment.passingPaths, [], id);
    assert.deepEqual(filtering.assessment.status, { icon: '○', text: NOT_LISTED_TEXT, tone: 'neutral' }, id);
    assert.deepEqual([filtering.status.tone, filtering.status.text], ['neutral', NOT_LISTED_TEXT], id);
    assert.equal(filtering.gphTotal, 0, id);
    assert.equal(filtering.chip, null, 'neutral, never the chip');
    assert.equal(filtering.assessment.hasBiologicalFiltration, true, id);
    assert.deepEqual(warningIds(computed), ['filtration.rating_needed'], id);
    const [warning] = warnings(computed);
    assert.equal(warning.severity, 'info', id);
    assert.equal(warning.title, `○ ${NOT_LISTED_TEXT}`, id);
    assert.match(warning.message, /is rated for 20 Long–29 gal tanks, and this tank size isn't listed/, id);
    assert.match(warning.message, /not adequate, not unsafe/, id);
    assert.doesNotMatch(warning.text, /Below manufacturer rating|No biological filter|No filter added/, id);
    assert.doesNotMatch(warning.text, UGF_TEXT_FORBIDDEN, id);
  }
});

test('no gallons arithmetic: 10 ≤ 29 and 20 ≤ 29 never make a preset compatible', () => {
  const list = ugfOnly().map(toApp);
  for (const tank of TANK_SIZES) {
    const byGallons = math.assessFiltration({ filters: list, gallons: tank.gallons, hasStock: true });
    assert.equal(byGallons.level, 'not-evaluated', `${tank.id} without id`);
    const byId = math.assessFiltration({ filters: list, gallons: tank.gallons, tankId: tank.id, hasStock: true });
    assert.equal(byId.level === 'adequate', COMPATIBLE.includes(tank.id), tank.id);
  }
});

test('generic 20 gallons without a canonical tank id never passes (custom gallons / ambiguous tank)', () => {
  const list = ugfOnly().map(toApp);
  for (const tankId of [undefined, null, '', '20', 20, '20 gallon long', '20L', 'g20l', '29', {}]) {
    const assessment = math.assessFiltration({ filters: list, gallons: 20, tankId, hasStock: true });
    assert.equal(assessment.level, 'not-evaluated', String(tankId));
    assert.equal(assessment.tankId, null, String(tankId));
    assert.equal(assessment.ugf.status, 'tank-unknown', String(tankId));
  }
  // Through compute: a state with 20 gallons and no preset id.
  const state = compute.createDefaultState();
  Object.assign(state, { tank: { gallons: 20, id: null }, gallons: 20, stock: STOCK.map(([id, qty]) => ({ id, qty })), filters: math.normalizeFilters(ugfOnly().map(toApp)) });
  const computed = compute.buildComputedState(state);
  assert.equal(computed.filtering.assessment.tankId, null);
  assert.notEqual(computed.filtering.level, 'adequate');
  assert.equal(computed.filtering.gphTotal, 0);
});

// ---------------------------------------------------------------------------------------------
// Mixed setups (steps 27–30)

test('compatible UGF + adequate powered (Tetra IQ 45): adequate by both paths; GPH is Tetra only, never added to the UGF', () => {
  const computed = computeFor('29g', addProduct(ugfOnly(), TETRA));
  const { assessment } = computed.filtering;
  assert.equal(computed.filtering.level, 'adequate');
  assert.deepEqual(assessment.passingPaths, ['powered', 'ugf']);
  assert.equal(assessment.adequateBy, 'powered');
  assert.equal(assessment.biologicalGph, 215);
  assert.equal(assessment.biologicalTurnover, 215 / 29);
  assert.equal(assessment.powered.count, 1);
  assert.deepEqual(warningIds(computed), [], 'no note for a passing powered path');
});

test('compatible UGF + weak powered: adequate from the UGF; the weak powered path stays visible', () => {
  const computed = computeFor('29g', [...ugfOnly(), custom('HOB', 20)]);
  const { assessment } = computed.filtering;
  assert.equal(computed.filtering.level, 'adequate');
  assert.deepEqual([assessment.adequateBy, assessment.passingPaths], ['ugf', ['ugf']]);
  assert.equal(assessment.powered.belowFloor, true);
  assert.equal(assessment.biologicalGph, 20);
  const note = warnings(computed).find((w) => w.id === 'filtration.ugf_rated');
  assert.match(note.message, /powered filter's flow is below the 2× minimum, but the undergravel filter is rated for this tank on its own/);
});

test('compatible UGF + verified sponge / unrated sponge: adequate; no arithmetic between them', () => {
  const verified = computeFor('29g', addProduct(ugfOnly(), HYGGER_S));
  assert.equal(verified.filtering.level, 'adequate');
  assert.deepEqual(verified.filtering.assessment.passingPaths, ['sponge', 'ugf']);
  assert.equal(verified.filtering.gphTotal, 0);
  const unrated = computeFor('29g', addProduct(ugfOnly(), AQUANEAT_MIDDLE));
  assert.equal(unrated.filtering.level, 'adequate');
  assert.deepEqual([unrated.filtering.assessment.adequateBy, unrated.filtering.assessment.passingPaths], ['ugf', ['ugf']]);
  assert.equal(unrated.filtering.assessment.sponge.status, 'rating-needed', 'unrated sponge stays Rating needed');
  assert.match(warnings(unrated).find((w) => w.id === 'filtration.ugf_rated').message, /no verified rating yet/);
  // Hygger S (up to 40) on 55 is below its rating; a UGF not listed for 55 adds nothing to it.
  const below = computeFor('55g', addProduct(ugfOnly(), HYGGER_S));
  assert.equal(below.filtering.level, 'below-rating');
  assert.deepEqual(warningIds(below), ['filtration.below_rating', 'filtration.ugf_not_listed']);
});

test('UGF not listed + verified sponge that covers the tank: adequate from the sponge; UGF a neutral supplemental note', () => {
  const computed = computeFor('20h', addProduct(ugfOnly(), HYGGER_S));
  const { assessment } = computed.filtering;
  assert.equal(computed.filtering.level, 'adequate');
  assert.deepEqual([assessment.adequateBy, assessment.passingPaths], ['sponge', ['sponge']]);
  assert.equal(assessment.ugf.status, 'not-listed');
  assert.deepEqual(warningIds(computed), ['filtration.sponge_rated', 'filtration.ugf_not_listed']);
  const note = warnings(computed).find((w) => w.id === 'filtration.ugf_not_listed');
  assert.equal(note.severity, 'info');
  assert.equal(computed.filtering.chip, null);
});

test('compatible UGF + powerhead: adequate from the UGF; powerhead is circulation only', () => {
  const computed = computeFor('29g', [...ugfOnly(), custom('POWERHEAD', 400)]);
  const { assessment } = computed.filtering;
  assert.equal(computed.filtering.level, 'adequate');
  assert.deepEqual([assessment.adequateBy, assessment.passingPaths], ['ugf', ['ugf']]);
  assert.deepEqual([assessment.biologicalGph, assessment.circulationGph, assessment.biologicalTurnover], [0, 400, 0]);
  assert.equal(assessment.ugf.entries[0].compatible, true);
  // The powerhead does not change compatibility on a preset that isn't listed either.
  assert.equal(computeFor('40b', [...ugfOnly(), custom('POWERHEAD', 1500)]).filtering.assessment.ugf.status, 'not-listed');
});

test('non-passing mixes: UGF only / + powerhead → not evaluated (never "No biological filter"); + weak powered → Review', () => {
  for (const id of ['20h', '40b', '55g']) {
    const only = computeFor(id, ugfOnly());
    assert.equal(only.filtering.level, 'not-evaluated', id);
    const withPowerhead = computeFor(id, [...ugfOnly(), custom('POWERHEAD', 400)]);
    assert.equal(withPowerhead.filtering.level, 'not-evaluated', id);
    assert.equal(warningIds(withPowerhead).includes('filtration.circulation_only'), false, id);
    const weak = computeFor(id, [...ugfOnly(), custom('HOB', 20)]);
    assert.equal(weak.filtering.level, 'review', id);
    assert.equal(weak.filtering.assessment.adequateBy, null, id);
    const [review] = warnings(weak);
    assert.equal(review.id, 'filtration.review', id);
    assert.equal(review.severity, 'warn', 'amber, the weak powered concern is not hidden');
    assert.match(review.message, /^Powered filter: 20 GPH through filter media turns this \d+-gallon tank over about [\d.]+× per hour, below the 2× minimum\./, id);
    assert.match(review.message, /Undergravel filter: .* isn't listed, so it isn't evaluated here\./, id);
    assert.equal(weak.filtering.chip.tone, 'warn', id);
  }
  // Powered-only below the floor stays red (unchanged Phase 2C) when no UGF is present.
  assert.equal(computeFor('40b', [custom('HOB', 20)]).filtering.level, 'very-low');
});

test('adequateBy keeps its phase B meaning for plans without a UGF; passingPaths lists every passing path', () => {
  const powered = computeFor('55g', addProduct([], AC70)).filtering.assessment;
  assert.deepEqual([powered.adequateBy, powered.passingPaths, powered.hasUgf, powered.ugf.count, powered.ugf.status], ['powered', ['powered'], false, 0, 'none']);
  const sponge = computeFor('29g', addProduct([], HYGGER_S)).filtering.assessment;
  assert.deepEqual([sponge.adequateBy, sponge.passingPaths], ['sponge', ['sponge']]);
  const both = computeFor('29g', addProduct(addProduct([], HYGGER_S), AC70)).filtering.assessment;
  assert.deepEqual([both.adequateBy, both.passingPaths], ['both', ['powered', 'sponge']]);
  const three = computeFor('29g', addProduct(addProduct(ugfOnly(), HYGGER_S), AC70)).filtering.assessment;
  assert.deepEqual([three.adequateBy, three.passingPaths], ['both', ['powered', 'sponge', 'ugf']]);
});

// ---------------------------------------------------------------------------------------------
// Picker (steps 19–21)

test('picker: the UGF is offered only on 20 Long and 29, by preset id; other products unchanged', () => {
  for (const tank of TANK_SIZES) {
    const withId = filterGearByTank(CATALOG, tank.gallons, tank.id);
    assert.equal(withId.some((item) => item.id === UGF), COMPATIBLE.includes(tank.id), tank.id);
    // Every other product is filtered exactly as without the id.
    const withoutUgf = (list) => list.filter((item) => item.id !== UGF).map((item) => item.id);
    assert.deepEqual(withoutUgf(withId), withoutUgf(filterGearByTank(CATALOG, tank.gallons)), tank.id);
    // Gallons alone never offer it.
    assert.equal(filterGearByTank(CATALOG, tank.gallons).some((item) => item.id === UGF), false, `${tank.id} gallons only`);
    assert.equal(isUndergravelEligibleForTank(CATALOG_BY_ID.get(UGF), tank.id), COMPATIBLE.includes(tank.id), tank.id);
  }
  assert.equal(isUndergravelEligibleForTank(CATALOG_BY_ID.get(UGF), '20'), false);
  assert.equal(isUndergravelEligibleForTank({ ...CATALOG_BY_ID.get(UGF), compatibleTanks: undefined }, '29g'), false);
});

test('one UGF per tank: repeated saved copies restore one (catalog loaded or offline)', () => {
  const two = [
    { instanceId: 'f-ugf1', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'tank_compatibility' },
    { instanceId: 'f-ugf2', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'tank_compatibility' },
    { instanceId: 'f-ugf3', source: 'product', productId: UGF, type: 'HOB', capacityMethod: 'flow', gph: 900 },
  ];
  for (const catalogById of [CATALOG_BY_ID, OFFLINE]) {
    const result = pageLoad(v2Storage(two), { catalogById });
    assert.deepEqual(result.restored.map((item) => item.instanceId), ['f-ugf1']);
    assert.equal(result.computed.filtering.assessment.ugf.count, 1);
    assertUgfNeverFlows(result, 'duplicates');
  }
});

// ---------------------------------------------------------------------------------------------
// Saved state (steps 20, 23–26)

test('save / reload: a new catalog UGF saves identity only (no GPH, range or compatibleTanks); reload re-resolves it', () => {
  const list = ugfOnly();
  const storage = storageWith();
  saved.writeSavedFilters(storage, list.map(toApp));
  const envelope = JSON.parse(storage.map.get(V2));
  assert.equal(envelope.filters.length, 1);
  const [entry] = envelope.filters;
  assert.deepEqual(Object.keys(entry).sort(), ['capacityMethod', 'instanceId', 'productId', 'source', 'type']);
  assert.deepEqual([entry.source, entry.productId, entry.type, entry.capacityMethod], ['product', UGF, 'UGF', 'tank_compatibility']);
  assert.ok(math.isValidInstanceId(entry.instanceId));
  assert.equal(storage.map.has(V1), false);
  const reload = pageLoad(storage);
  assert.deepEqual(reload.restored.map((item) => [item.instanceId, item.productId, item.compatibleTanks]), [[entry.instanceId, UGF, COMPATIBLE]]);
  assert.equal(reload.computed.filtering.level, 'adequate');
  assert.deepEqual(reload.written, envelope, 'identical after reload');
  assertUgfNeverFlows(reload, 'save/reload');
});

test('saved UGF on a tank it is not listed for (29g → 40b → 29g): kept, same instance, not evaluated, then adequate again', () => {
  const storage = storageWith();
  saved.writeSavedFilters(storage, ugfOnly().map(toApp));
  const instanceId = JSON.parse(storage.map.get(V2)).filters[0].instanceId;
  const onBreeder = pageLoad(storage, { tank: '40b' });
  assert.deepEqual(onBreeder.restored.map((item) => item.instanceId), [instanceId], 'not deleted');
  assert.equal(onBreeder.computed.filtering.level, 'not-evaluated');
  assert.equal(onBreeder.computed.filtering.assessment.ugf.status, 'not-listed');
  const back = pageLoad(storage, { tank: '29g' });
  assert.deepEqual(back.restored.map((item) => item.instanceId), [instanceId]);
  assert.equal(back.computed.filtering.level, 'adequate');
});

test('historical catalog UGF shapes (v1 150 / HOB 150 / HOB 900, phase A v2 flow 150, phase E v2 + stale GPH): current model wins', () => {
  const plans = {
    'v1 150 GPH': v1Storage([{ id: UGF, type: 'UGF', rated_gph: 150 }]),
    'v1 as HOB 150': v1Storage([{ id: UGF, type: 'HOB', rated_gph: 150 }]),
    'v1 as HOB 900': v1Storage([{ id: UGF, type: 'HOB', rated_gph: 900 }]),
    'v1 missing type': v1Storage([{ id: UGF, rated_gph: 150 }]),
    'phase A v2 flow 150': v2Storage([{ instanceId: 'f-a1', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'flow', gph: 150 }]),
    'phase E v2 identity + stale GPH / range': v2Storage([{ instanceId: 'f-e1', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'flow', gph: 150, minGallons: 20, maxGallons: 40 }]),
    'v2 HOB 900 conflict': v2Storage([{ instanceId: 'f-c1', source: 'product', productId: UGF, type: 'HOB', capacityMethod: 'flow', gph: 900 }]),
    'v2 nonsense type': v2Storage([{ instanceId: 'f-n1', source: 'product', productId: UGF, type: 'banana', gph: 150 }]),
    'v2 tampered compatibility': v2Storage([{ instanceId: 'f-t1', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'tank_compatibility', compatibleTanks: ['40b', '55g'] }]),
  };
  for (const [label, storage] of Object.entries(plans)) {
    const snapshot = new Map(storage.map);
    const online = pageLoad(storage, { tank: '29g' });
    assert.equal(online.restored.length, 1, label);
    assert.deepEqual([online.restored[0].type, online.restored[0].capacityMethod, online.restored[0].compatibleTanks], ['UGF', 'tank_compatibility', COMPATIBLE], label);
    assert.equal(online.computed.filtering.level, 'adequate', label);
    assert.equal(online.computed.filtering.adequateBy ?? online.computed.filtering.assessment.adequateBy, 'ugf', label);
    assert.equal(online.preController.filtering.gphTotal, 0, `${label}: pre-controller view`);
    assert.notEqual(online.preController.filtering.level, 'adequate', `${label}: pre-controller has no compatibility yet`);
    assertUgfNeverFlows(online, label);
    // The same plan on 40 Breeder: tampered or stale compatibility never makes it pass there.
    const breeder = pageLoad(storageWith(Object.fromEntries(snapshot)), { tank: '40b' });
    assert.equal(breeder.computed.filtering.level, 'not-evaluated', `${label}: 40b`);
    // Offline (catalog unavailable): the known id still prevents flow; neutral.
    const offline = pageLoad(storageWith(Object.fromEntries(snapshot)), { tank: '29g', catalogById: OFFLINE });
    assert.equal(offline.restored.length, 1, `${label}: offline`);
    assert.deepEqual([offline.restored[0].type, offline.restored[0].productId, 'compatibleTanks' in offline.restored[0]], ['UGF', UGF, false], `${label}: offline`);
    assert.equal(offline.computed.filtering.level, 'not-evaluated', `${label}: offline`);
    assert.equal(offline.computed.filtering.assessment.ugf.status, 'compatibility-unknown', `${label}: offline`);
    assertUgfNeverFlows(offline, `${label}: offline`);
  }
});

test('historical custom UGF (v1 UGF 150, v1 "Undergravel" 900, v2 custom flow 150): 0 GPH, tank_compatibility, compatibility needed', () => {
  const plans = {
    'v1 UGF 150': v1Storage([{ id: 'manual-ugf1', type: 'UGF', rated_gph: 150 }]),
    'v1 Undergravel 900': v1Storage([{ id: 'manual-ugf2', type: 'Undergravel', rated_gph: 900 }]),
    'v2 custom flow 150': v2Storage([{ instanceId: 'f-cu1', source: 'custom', legacyId: 'manual-ugf3', label: 'Undergravel 150 GPH', type: 'UGF', capacityMethod: 'flow', gph: 150 }]),
    'v2 custom with invented compatibility': v2Storage([{ instanceId: 'f-cu2', source: 'custom', legacyId: 'manual-ugf4', type: 'UGF', capacityMethod: 'tank_compatibility', compatibleTanks: ['29g'] }]),
  };
  for (const [label, storage] of Object.entries(plans)) {
    for (const tank of ['29g', '20l', '40b']) {
      const result = pageLoad(storageWith(Object.fromEntries(storage.map)), { tank });
      assert.equal(result.restored.length, 1, label);
      const [item] = result.restored;
      assert.deepEqual([item.type, item.capacityMethod, item.gph, item.label, 'compatibleTanks' in item], ['UGF', 'tank_compatibility', 0, 'Undergravel filter', false], label);
      const { filtering } = result.computed;
      assert.equal(filtering.level, 'not-evaluated', `${label} ${tank}`);
      assert.equal(filtering.assessment.hasBiologicalFiltration, true, label);
      assert.equal(filtering.assessment.ugf.status, 'compatibility-unknown', label);
      assert.match(warnings(result.computed)[0].message, /has no listed compatible tank sizes available/, label);
      assertUgfNeverFlows(result, label);
      const [written] = result.written.filters;
      assert.deepEqual([written.source, written.type, written.capacityMethod], ['custom', 'UGF', 'tank_compatibility'], label);
    }
  }
});

test('catalog type authority: a known powered product saved as UGF restores powered; a known UGF saved as HOB restores UGF', () => {
  const powered = pageLoad(v2Storage([{ instanceId: 'f-p1', source: 'product', productId: AC70, type: 'UGF', capacityMethod: 'tank_compatibility' }]), { tank: '55g' });
  assert.deepEqual([powered.restored[0].type, powered.restored[0].gph], ['HOB', 300]);
  assert.equal(powered.computed.filtering.biologicalGph, 300);
  assert.deepEqual([powered.written.filters[0].type, powered.written.filters[0].gph], ['HOB', 300]);
  const ugf = pageLoad(v2Storage([{ instanceId: 'f-u1', source: 'product', productId: UGF, type: 'HOB', capacityMethod: 'flow', gph: 900 }]), { tank: '29g' });
  assert.deepEqual([ugf.restored[0].type, ugf.computed.filtering.biologicalGph, ugf.computed.filtering.level], ['UGF', 0, 'adequate']);
  assert.equal(items.restoreKind({ id: UGF, type: 'SPONGE', rated_gph: 150 }, null), items.RESTORE_KINDS.UGF, 'known UGF id wins over a stale SPONGE type');
  assert.equal(items.restoreKind({ id: HYGGER_S, type: 'UGF', rated_gph: 80 }, null), items.RESTORE_KINDS.SPONGE, 'known sponge id wins over a stale UGF type');
});

// ---------------------------------------------------------------------------------------------
// Regressions and invariants (steps 40–45)

test('STOCKING LOAD INVARIANT: no filter, UGF (listed / not listed), powered, sponge, UGF + powered / sponge / powerhead', () => {
  const stocks = [STOCK, [['angelfish', 2], ['neon', 12]], [['pea_puffer', 3], ['amano', 4]]];
  const sets = {
    ugf: () => ugfOnly(),
    powered: () => addProduct([], TETRA),
    sponge: () => addProduct([], HYGGER_S),
    ugfPowered: () => addProduct(ugfOnly(), AC70),
    ugfSponge: () => addProduct(ugfOnly(), HYGGER_S),
    ugfPowerhead: () => [...ugfOnly(), custom('POWERHEAD', 400)],
    ugfWeak: () => [...ugfOnly(), custom('HOB', 20)],
  };
  for (const tank of TANK_SIZES) {
    for (const stock of stocks) {
      const baseline = computeFor(tank.id, [], { stock });
      assert.ok(baseline.bioload.proposedPercent > 0, 'non-zero stock');
      for (const [name, build] of Object.entries(sets)) {
        const computed = computeFor(tank.id, build(), { stock });
        assert.equal(load(computed), load(baseline), `${tank.id} ${name}`);
        assert.equal(computed.filtering.assessment.capacityAdjustment, 0);
      }
    }
  }
});

test('powered regression: Tetra IQ 45 215, AquaClear 70 300, Fluval 307 303, EHEIM 2213 116 GPH; 2× floor unchanged', () => {
  const expected = { [TETRA]: 215, [AC70]: 300, [FLUVAL]: 303, [EHEIM]: 116 };
  for (const [id, gph] of Object.entries(expected)) {
    assert.equal(CATALOG_BY_ID.get(id).gphRated, gph, id);
    for (const tank of ['29g', '55g', '75g']) {
      const computed = computeFor(tank, addProduct([], id));
      assert.equal(computed.filtering.biologicalGph, gph, `${id} ${tank}`);
      const turnover = gph / getTankById(tank).gallons;
      assert.equal(computed.filtering.level, turnover >= math.MIN_BIOLOGICAL_TURNOVER ? 'adequate' : 'very-low', `${id} ${tank}`);
    }
  }
  assert.equal(math.MIN_BIOLOGICAL_TURNOVER, 2);
});

test('sponge regression: Hygger S rated on 29, below rating on 55, 2 × likely on 55; AQUANEAT Middle rating needed; 0 GPH', () => {
  const rated = computeFor('29g', addProduct([], HYGGER_S));
  assert.deepEqual([rated.filtering.level, rated.filtering.assessment.adequateBy, rated.filtering.gphTotal], ['adequate', 'sponge', 0]);
  assert.equal(computeFor('55g', addProduct([], HYGGER_S)).filtering.level, 'below-rating');
  assert.equal(computeFor('55g', addProduct(addProduct([], HYGGER_S), HYGGER_S)).filtering.level, 'likely-multi-sponge');
  const middle = computeFor('29g', addProduct([], AQUANEAT_MIDDLE));
  assert.deepEqual([middle.filtering.level, middle.filtering.status.text], ['not-evaluated', 'Not evaluated — rating needed']);
  // Known-sponge safety (phase C) still intact alongside the known-UGF list.
  const offline = pageLoad(v2Storage([{ instanceId: 'f-s1', source: 'product', productId: HYGGER_S, type: 'HOB', capacityMethod: 'flow', gph: 900 }]), { catalogById: OFFLINE });
  assert.deepEqual([offline.restored[0].type, offline.computed.filtering.gphTotal], ['SPONGE', 0]);
});
