// Sponge migration phase C: stale-cache + legacy migration validation.
// Report: _internal/reports/stocking-advisor-sponge-migration-phase-c-2026-09.md
// Invariant: NO historical or stale sponge GPH may ever become trusted filtration flow again.
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
const { getGearData, CATALOG_CACHE_KEY } = await import('../../js/gear-data.js');
const { getTankById } = await import('../../js/utils.js');

await compute.initializeCompute();
const RAW = readJson('assets/data/gearCatalog.json');
const RAW_ITEMS = Array.isArray(RAW) ? RAW : RAW.items;
const CATALOG = await getGearData({ forceRefresh: true });
const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.id, item]));
const OFFLINE = new Map();

const HYGGER_S = 'hygger-double-sponge-s';
const HYGGER_M = 'hygger-double-sponge-m';
const VERIFIED_IDS = [HYGGER_S, HYGGER_M];
const UNVERIFIED = ['aquaneat-sponge-10', 'aquaneat-sponge-20', 'aquaneat-sponge-60', 'pawfly-sponge-10', 'powkoo-dual-sponge-40'];
const SPONGE_IDS = [...VERIFIED_IDS, ...UNVERIFIED];
const FAKE_GPH = [60, 120, 200, 900, 1500];
const V1 = saved.FILTER_STORAGE_KEY_V1;
const V2 = saved.FILTER_STORAGE_KEY_V2;
// The cache key the loader reads (ttg.gear.catalog.v3 since phase E). Stale-record fixtures below are
// fed through it so the historical-record sanitising stays covered whatever the key generation is.
const CACHE = CATALOG_CACHE_KEY;

function storageWith(values = {}) {
  const map = new Map(Object.entries(values));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}
const v1Storage = (list) => storageWith({ [V1]: JSON.stringify(list) });
const v2Storage = (filters) => storageWith({ [V2]: JSON.stringify({ v: 2, filters }) });

// The controller's restore (hydrateFromAppState): restoreKind decides, then the catalog record, the
// sponge restore or the stored-GPH powered fallback builds the item.
function controllerRestore(filters, catalogById = CATALOG_BY_ID) {
  const out = [];
  for (const entry of filters) {
    const id = typeof entry?.id === 'string' && entry.id ? entry.id : null;
    const product = id ? catalogById.get(id) ?? null : null;
    const kind = items.restoreKind(entry, product);
    if (kind === items.RESTORE_KINDS.DROP) continue;
    if (kind === items.RESTORE_KINDS.PRODUCT) {
      if (math.isSpongeFilter(product)) {
        out.push(items.restoreSpongeItem(entry, product));
      } else {
        out.push({ id: product.id, source: 'product', label: product.name, type: product.type, gph: Math.round(product.gphRated),
          productId: product.id, capacityMethod: 'flow', ...(entry.instanceId ? { instanceId: entry.instanceId } : {}) });
      }
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
  return out;
}

// What the controller hands the calculator / saved state for one item (toAppFilter).
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
const load = (computed) => JSON.stringify([computed.bioload.currentPercent, computed.bioload.proposedPercent, computed.bioload.text,
  computed.bioload.severity, computed.bioload.proposed, computed.bioload.effectiveCapacity]);

// One page load: saved state → stocking.js pre-controller view (sanitizeFilterList) → controller
// restore → calculator → save. Returns every stage.
function pageLoad(storage, { catalogById = CATALOG_BY_ID, tank = '29g' } = {}) {
  const state = saved.readSavedFilterState(storage);
  const preController = run(tank, compute.sanitizeFilterList(state.filters));
  const restored = controllerRestore(state.filters, catalogById);
  const appFilters = restored.map(toApp);
  const computed = run(tank, math.normalizeFilters(appFilters));
  // The engine's own assessment of the same input (adequateBy, hasBiologicalFiltration, …).
  const assessment = math.assessFiltration({ filters: compute.sanitizeFilterList(math.normalizeFilters(appFilters)),
    gallons: getTankById(tank).gallons, hasStock: true });
  assert.equal(assessment.level, computed.filtering.level, 'engine and calculator agree');
  saved.writeSavedFilters(storage, appFilters);
  const written = JSON.parse(storage.map.get(V2) ?? 'null');
  const mirror = JSON.parse(storage.map.get(V1) ?? '[]');
  return { state, preController, restored, appFilters, computed, assessment, written, mirror };
}

function assertNoSpongeGph(result, label) {
  for (const computed of [result.preController, result.computed]) {
    const spongeFlow = computed.filtering.filters
      ? computed.filtering.filters.filter((f) => math.isSpongeFilter(f)).reduce((sum, f) => sum + (f.ratedGph || 0), 0)
      : 0;
    assert.equal(spongeFlow, 0, `${label}: sponge flow`);
  }
  for (const entry of result.written?.filters ?? []) {
    if (entry.type === 'SPONGE') {
      assert.equal(entry.capacityMethod, 'manufacturer_rating', `${label}: saved method`);
      assert.equal('gph' in entry, false, `${label}: saved gph`);
    }
  }
  for (const entry of result.mirror) {
    assert.notEqual(entry.type, 'SPONGE', `${label}: v1 mirror`);
  }
}

// ---------------------------------------------------------------------------------------------
// Known sponge product ids (the offline type-authority list)

test('KNOWN_SPONGE_PRODUCT_IDS equals the SPONGE ids of the shipped catalog', () => {
  const catalogSponges = RAW_ITEMS.filter((item) => String(item.type).toUpperCase() === 'SPONGE').map((item) => item.id).sort();
  assert.deepEqual([...math.KNOWN_SPONGE_PRODUCT_IDS].sort(), catalogSponges);
  assert.deepEqual([...SPONGE_IDS].sort(), catalogSponges);
  for (const id of SPONGE_IDS) assert.equal(math.isKnownSpongeProductId(id), true);
  for (const id of ['tetra-whisper-iq-45', 'aquaclear-70', 'penn-plax-ugf-20-29', 'manual-abc', '', null, 42]) {
    assert.equal(math.isKnownSpongeProductId(id), false, String(id));
  }
});

// ---------------------------------------------------------------------------------------------
// Step 5 — old v1 catalog sponges

test('v1 sponge fake GPH ignored: every catalog sponge id, every historical GPH', () => {
  for (const id of SPONGE_IDS) {
    for (const gph of FAKE_GPH) {
      const result = pageLoad(v1Storage([{ id, type: 'SPONGE', rated_gph: gph }]));
      assert.equal(result.state.version, 1);
      assert.deepEqual(result.state.entries.map((e) => [e.productId, e.type, e.capacityMethod, e.gph]), [[id, 'SPONGE', 'manufacturer_rating', undefined]]);
      const [item] = result.restored;
      assert.deepEqual([item.productId, item.type, item.gph], [id, 'SPONGE', 0]);
      assert.equal(item.ratingStatus, CATALOG_BY_ID.get(id).ratingStatus, 'current catalog metadata wins');
      const verified = VERIFIED_IDS.includes(id);
      assert.equal(items.spongeChipBadge(item), verified ? `Rated ${math.formatSpongeRating(math.resolveSpongeRating(CATALOG_BY_ID.get(id)))}` : 'Rating needed');
      for (const computed of [result.preController, result.computed]) {
        assert.equal(computed.filtering.gphTotal, 0);
        assert.equal(computed.filtering.turnover, 0);
      }
      // Pre-controller (no catalog yet): Rating needed. After restore: the catalog rating.
      assert.equal(result.preController.filtering.level, 'not-evaluated');
      assert.equal(result.computed.filtering.level, verified ? 'adequate' : 'not-evaluated', `${id} ${gph}`);
      assert.deepEqual(result.written.filters.map((e) => Object.keys(e).sort().join(',')), ['capacityMethod,instanceId,productId,source,type']);
      assert.deepEqual(result.mirror, []);
      assertNoSpongeGph(result, `${id}@${gph}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Step 6 — old phase-A v2 catalog sponges

test('Phase A v2 sponge fake GPH ignored: flow method and GPH dropped, rewritten as identity', () => {
  for (const id of SPONGE_IDS) {
    const result = pageLoad(v2Storage([{ instanceId: 'f-phasea', source: 'product', productId: id, type: 'SPONGE', capacityMethod: 'flow', gph: 120 }]));
    assert.equal(result.state.version, 2);
    assert.deepEqual(result.written.filters, [{ instanceId: 'f-phasea', source: 'product', productId: id, type: 'SPONGE', capacityMethod: 'manufacturer_rating' }]);
    assert.equal(result.computed.filtering.level, VERIFIED_IDS.includes(id) ? 'adequate' : 'not-evaluated');
    assert.equal(result.computed.filtering.gphTotal, 0);
    assertNoSpongeGph(result, id);
  }
});

// ---------------------------------------------------------------------------------------------
// Steps 7 / 20 — type conflicts: current catalog type is authoritative for resolved product ids

const CONFLICTS = {
  'A: known sponge id stored as HOB + flow + 900 GPH': { source: 'product', productId: HYGGER_S, type: 'HOB', capacityMethod: 'flow', gph: 900 },
  'A2: known sponge id stored as OTHER + 300 GPH': { source: 'product', productId: 'aquaneat-sponge-20', type: 'OTHER', gph: 300 },
  'C: known sponge id, missing type, stored GPH': { source: 'product', productId: 'pawfly-sponge-10', gph: 120 },
  'D: known sponge id, nonsense type': { source: 'product', productId: 'powkoo-dual-sponge-40', type: 'BANANA', capacityMethod: 'flow', gph: 250 },
};

test('current catalog type overrides stale saved type: a known sponge never restores as a powered filter', () => {
  for (const [label, entry] of Object.entries(CONFLICTS)) {
    for (const catalogById of [CATALOG_BY_ID, OFFLINE]) {
      const online = catalogById === CATALOG_BY_ID;
      const result = pageLoad(v2Storage([entry]), { catalogById });
      assert.equal(result.state.entries[0].type, 'SPONGE', `${label}: saved-state type`);
      const [item] = result.restored;
      assert.deepEqual([item.type, item.gph, item.productId], ['SPONGE', 0, entry.productId], label);
      assert.equal(result.preController.filtering.gphTotal, 0, `${label}: pre-controller`);
      assert.equal(result.computed.filtering.gphTotal, 0, `${label}: restored`);
      const expected = online && VERIFIED_IDS.includes(entry.productId) ? 'adequate' : 'not-evaluated';
      assert.equal(result.computed.filtering.level, expected, `${label} online=${online}`);
      assertNoSpongeGph(result, label);
    }
  }
  // The same conflicts as v1 entries (type / kind / missing).
  for (const raw of [{ id: HYGGER_M, type: 'HOB', rated_gph: 900 }, { id: HYGGER_M, rated_gph: 900 }, { id: HYGGER_M, kind: 'canister', rated_gph: 900 }]) {
    const result = pageLoad(v1Storage([raw]), { catalogById: OFFLINE });
    assert.equal(result.computed.filtering.gphTotal, 0, JSON.stringify(raw));
    assert.equal(result.computed.filtering.level, 'not-evaluated');
    assertNoSpongeGph(result, JSON.stringify(raw));
  }
  // Legacy compute input carrying only the id (no productId) is still recognised.
  const [sanitized] = compute.sanitizeFilterList([{ id: HYGGER_S, type: 'HOB', rated_gph: 900 }]);
  assert.deepEqual([sanitized.type, sanitized.rated_gph, sanitized.capacityMethod], ['SPONGE', 0, 'manufacturer_rating']);
});

test('B: a known powered product saved as SPONGE is restored as that powered product from the catalog', () => {
  const entry = { instanceId: 'f-typeb1', source: 'product', productId: 'aquaclear-70', type: 'SPONGE', capacityMethod: 'manufacturer_rating',
    manufacturerMaxGallons: 500, ratingStatus: 'verified' };
  const kind = items.restoreKind(saved.readSavedFilterState(v2Storage([entry])).filters[0], CATALOG_BY_ID.get('aquaclear-70'));
  assert.equal(kind, items.RESTORE_KINDS.PRODUCT);
  const online = pageLoad(v2Storage([entry]));
  assert.deepEqual(online.restored.map((i) => [i.type, i.gph, i.instanceId]), [['HOB', 300, 'f-typeb1']]);
  assert.equal(online.computed.filtering.level, 'adequate');
  assert.equal(online.assessment.adequateBy, 'powered');
  assert.deepEqual(online.written.filters, [{ instanceId: 'f-typeb1', source: 'product', productId: 'aquaclear-70', type: 'HOB', capacityMethod: 'flow', gph: 300 }]);
  assert.deepEqual(online.mirror, [], 'phase E: no v1 mirror is written');
  // Offline the catalog can't say it is powered: it stays a sponge that needs a rating (fails
  // closed) — the stored 500-gallon "verified" rating is never trusted for a product entry.
  const offline = pageLoad(v2Storage([entry]), { catalogById: OFFLINE });
  assert.equal(offline.computed.filtering.level, 'not-evaluated');
  assert.equal(offline.restored[0].ratingStatus, 'needed');
  assert.equal(offline.restored[0].productId, 'aquaclear-70', 'identity kept, re-resolves when the catalog loads');
  const reOnline = pageLoad(storageWith({ [V2]: JSON.stringify(offline.written) }));
  assert.deepEqual(reOnline.restored.map((i) => [i.type, i.gph]), [['HOB', 300]]);
});

test('current catalog rating overrides stale saved rating for a product sponge', () => {
  const stale = [
    { productId: HYGGER_S, manufacturerMaxGallons: 500, manufacturerMinGallons: 1, ratingStatus: 'verified' },
    { productId: 'aquaneat-sponge-60', manufacturerMaxGallons: 500, ratingStatus: 'verified' },
    { productId: 'aquaneat-sponge-10', manufacturerMaxGallons: 75, ratingStatus: 'verified', capacityMethod: 'flow', gph: 200 },
  ];
  for (const fields of stale) {
    const result = pageLoad(v2Storage([{ source: 'product', type: 'SPONGE', ...fields }]), { tank: '75g' });
    const product = CATALOG_BY_ID.get(fields.productId);
    const [item] = result.restored;
    assert.equal(item.ratingStatus, product.ratingStatus);
    assert.equal(item.manufacturerMaxGallons, product.manufacturerMaxGallons);
    // Hygger S is rated to 40: amber below rating on 75; unverified products: not evaluated.
    assert.equal(result.computed.filtering.level, fields.productId === HYGGER_S ? 'below-rating' : 'not-evaluated');
    assert.equal('manufacturerMaxGallons' in result.written.filters[0], false, 'a catalog sponge stores identity only');
  }
});

test('restoreKind: the documented source-of-truth order', () => {
  const K = items.RESTORE_KINDS;
  const hob = CATALOG_BY_ID.get('tetra-whisper-iq-45');
  const sponge = CATALOG_BY_ID.get(HYGGER_S);
  assert.equal(items.restoreKind(null, null), K.DROP);
  assert.equal(items.restoreKind({ id: HYGGER_S, type: 'SPONGE', capacityMethod: 'banana' }, sponge), K.DROP, 'unsupported method fails closed first');
  assert.equal(items.restoreKind({ id: HYGGER_S, type: 'HOB', rated_gph: 900 }, sponge), K.PRODUCT);
  assert.equal(items.restoreKind({ id: 'tetra-whisper-iq-45', type: 'SPONGE' }, hob), K.PRODUCT);
  assert.equal(items.restoreKind({ id: HYGGER_S, type: 'HOB', rated_gph: 900 }, null), K.SPONGE);
  assert.equal(items.restoreKind({ id: 'x', productId: HYGGER_M, type: 'CANISTER', rated_gph: 900 }, null), K.SPONGE);
  assert.equal(items.restoreKind({ id: 'manual-a', type: 'Sponge', rated_gph: 120 }, null), K.SPONGE);
  assert.equal(items.restoreKind({ id: 'manual-b', type: 'HOB', rated_gph: 120 }, null), K.FLOW);
  assert.equal(items.restoreKind({ id: 'retired-hob-1', productId: 'retired-hob-1', type: 'HOB', rated_gph: 150 }, null), K.FLOW);
  // An id-only known sponge (no productId) still keeps its product identity.
  const item = items.restoreSpongeItem({ id: HYGGER_S, type: 'HOB', rated_gph: 900 }, null);
  assert.deepEqual([item.productId, item.ratingStatus, item.gph, 'legacyGph' in item], [HYGGER_S, 'needed', 0, false]);
});

// ---------------------------------------------------------------------------------------------
// Step 8 — product ids the current catalog no longer has

test('unresolved legacy sponge cannot score GPH; unresolved powered filter keeps its legacy GPH', () => {
  const sponge = { instanceId: 'f-gone01', source: 'product', productId: 'discontinued-sponge-x', type: 'SPONGE', capacityMethod: 'flow', gph: 400,
    manufacturerMaxGallons: 200, ratingStatus: 'verified' };
  const hob = { instanceId: 'f-gone02', source: 'product', productId: 'discontinued-hob-y', type: 'HOB', capacityMethod: 'flow', gph: 150 };
  for (const storage of [v2Storage([sponge, hob]), v1Storage([{ id: 'discontinued-sponge-x', type: 'SPONGE', rated_gph: 400 }, { id: 'discontinued-hob-y', type: 'HOB', rated_gph: 150 }])]) {
    const result = pageLoad(storage);
    const [restoredSponge, restoredHob] = result.restored;
    assert.deepEqual([restoredSponge.type, restoredSponge.gph, restoredSponge.productId, restoredSponge.ratingStatus], ['SPONGE', 0, 'discontinued-sponge-x', 'needed']);
    assert.equal('manufacturerMaxGallons' in restoredSponge, false, 'a stored product rating is never trusted');
    assert.equal('legacyGph' in restoredSponge, false, 'product entries carry no legacy GPH');
    assert.deepEqual([restoredHob.type, restoredHob.gph, restoredHob.productId], ['HOB', 150, 'discontinued-hob-y']);
    assert.equal(result.computed.filtering.biologicalGph, 150, 'only the powered legacy filter counts');
    assert.deepEqual(result.written.filters.map((e) => [e.productId, e.type, e.capacityMethod, e.gph]),
      [['discontinued-sponge-x', 'SPONGE', 'manufacturer_rating', undefined], ['discontinued-hob-y', 'HOB', 'flow', 150]]);
    assert.deepEqual(result.mirror, [], 'phase E: no v1 mirror; a historical v1 input is removed once v2 holds the plan');
    assertNoSpongeGph(result, 'unresolved');
  }
  // Alone on a tank, the unresolved sponge is "Not evaluated — rating needed", never adequate/red.
  const alone = pageLoad(v2Storage([sponge]), { tank: '10g' });
  assert.equal(alone.computed.filtering.level, 'not-evaluated');
});

// ---------------------------------------------------------------------------------------------
// Step 9 — old custom sponges, every historical shape

const OLD_CUSTOM = {
  'v1 type SPONGE + rated_gph': { v1: { id: 'manual-c1', type: 'SPONGE', rated_gph: 120 } },
  'v1 type Sponge + gph': { v1: { id: 'manual-c2', type: 'Sponge', gph: 90 } },
  'v1 filterType SPONGE + GPH': { v1: { id: 'manual-c3', filterType: 'SPONGE', rated_gph: 200 } },
  'v1 kind sponge + GPH': { v1: { id: 'manual-c4', kind: 'sponge', rated_gph: 60 } },
  'v2 capacityMethod flow + GPH': { v2: { instanceId: 'f-c5', source: 'custom', label: 'Sponge 150 GPH', legacyId: 'manual-c5', type: 'SPONGE', capacityMethod: 'flow', gph: 150 } },
  'v2 missing capacityMethod + GPH': { v2: { instanceId: 'f-c6', source: 'custom', legacyId: 'manual-c6', type: 'SPONGE', gph: 75 } },
  'v2 filterType SPONGE + rated_gph': { v2: { instanceId: 'f-c7', source: 'custom', legacyId: 'manual-c7', filterType: 'SPONGE', rated_gph: 110 } },
  'Phase A v2 custom sponge': { v2: { instanceId: 'f-c8', source: 'custom', label: 'Sponge 120 GPH', legacyId: 'manual-c8', type: 'SPONGE', capacityMethod: 'flow', gph: 120 } },
  'Phase B unrated custom sponge': { v2: { instanceId: 'f-c9', source: 'custom', label: 'Sponge filter', legacyId: 'manual-c9', type: 'SPONGE', capacityMethod: 'manufacturer_rating', ratingStatus: 'needed', legacyGph: 120 } },
};

test('old custom GPH-only sponges: biological sponge, Rating needed, Add rating, GPH legacy only', () => {
  for (const [label, fixture] of Object.entries(OLD_CUSTOM)) {
    const storage = fixture.v1 ? v1Storage([fixture.v1]) : v2Storage([fixture.v2]);
    const result = pageLoad(storage, { tank: '10g' });
    const [item] = result.restored;
    assert.deepEqual([item.type, item.gph, item.source, item.label, item.ratingStatus], ['SPONGE', 0, 'custom', 'Sponge filter', 'needed'], label);
    assert.equal(items.needsCustomRating(item), true, `${label}: Add rating available`);
    assert.equal(items.spongeChipBadge(item), 'Rating needed');
    assert.ok(item.legacyGph > 0, `${label}: legacyGph kept internally`);
    assert.equal('manufacturerMaxGallons' in item, false, `${label}: GPH never converted to gallons`);
    assert.equal(result.computed.filtering.level, 'not-evaluated', label);
    assert.equal(result.assessment.hasBiologicalFiltration, true);
    assert.equal(result.computed.filtering.gphTotal, 0);
    // legacyGph never appears as a flow anywhere the user sees.
    const visible = JSON.stringify([result.computed.status.warnings, result.computed.filtering.status, items.spongeChipBadge(item)]);
    assert.doesNotMatch(visible, new RegExp(`\\b${item.legacyGph}\\b`), label);
    assertNoSpongeGph(result, label);

    // Entering a rating upgrades the same filter in place (same id / instanceId), legacy GPH dropped.
    const rated = { ...items.buildCustomSpongeItem({ id: item.id, ratedGallons: 20 }), instanceId: item.instanceId, legacyGph: item.legacyGph };
    const after = pageLoad(storageWith({ [V2]: JSON.stringify({ v: 2, filters: saved.serializeFilters([toApp(rated)]) }) }), { tank: '10g' });
    assert.deepEqual([after.restored[0].id, after.restored[0].instanceId], [item.id, item.instanceId]);
    assert.equal(after.computed.filtering.level, 'adequate');
    assert.equal(after.assessment.adequateBy, 'sponge');
    assert.equal('legacyGph' in after.written.filters[0], false);
    assert.equal(after.written.filters[0].manufacturerMaxGallons, 20);
  }
});

test('current Phase B verified custom sponge is unchanged by migration', () => {
  const entry = { instanceId: 'f-cb1', source: 'custom', label: 'Sponge filter', legacyId: 'manual-cb1', type: 'SPONGE', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 40, ratingStatus: 'verified' };
  const result = pageLoad(v2Storage([entry]));
  assert.deepEqual(result.written.filters, [entry]);
  assert.equal(result.computed.filtering.level, 'adequate');
});

// ---------------------------------------------------------------------------------------------
// Step 10 — malformed rating data fails closed

test('malformed verified rating fails closed; needs_review / needed / unknown status + max cannot score', () => {
  const base = { source: 'custom', legacyId: 'manual-bad', type: 'SPONGE', capacityMethod: 'manufacturer_rating' };
  const malformed = {
    'verified, max missing': { ratingStatus: 'verified' },
    'verified, max 0': { ratingStatus: 'verified', manufacturerMaxGallons: 0 },
    'verified, negative max': { ratingStatus: 'verified', manufacturerMaxGallons: -40 },
    'verified, NaN max': { ratingStatus: 'verified', manufacturerMaxGallons: Number.NaN },
    'verified, garbage max': { ratingStatus: 'verified', manufacturerMaxGallons: 'forty' },
    'verified, boolean max': { ratingStatus: 'verified', manufacturerMaxGallons: true },
    'verified, object max': { ratingStatus: 'verified', manufacturerMaxGallons: { v: 40 } },
    'verified, absurd max': { ratingStatus: 'verified', manufacturerMaxGallons: 1e9 },
    'needs_review + max': { ratingStatus: 'needs_review', manufacturerMaxGallons: 500 },
    'needed + max': { ratingStatus: 'needed', manufacturerMaxGallons: 500 },
    'unknown status + max': { ratingStatus: 'approved', manufacturerMaxGallons: 500 },
    'upper-case VERIFIED + max': { ratingStatus: 'VERIFIED', manufacturerMaxGallons: 500 },
    'no status + max': { manufacturerMaxGallons: 500 },
    'min greater than max': { ratingStatus: 'verified', manufacturerMinGallons: 600, manufacturerMaxGallons: 500 },
  };
  for (const [label, fields] of Object.entries(malformed)) {
    const entry = { ...base, ...fields };
    assert.notEqual(math.resolveSpongeRating(entry).status, 'verified', label);
    for (const tank of ['5g', '10g', '29g', '55g']) {
      const direct = math.assessFiltration({ filters: [entry], gallons: getTankById(tank).gallons, hasStock: true });
      assert.equal(direct.level, 'not-evaluated', `${label} @${tank}`);
    }
    const result = pageLoad(v2Storage([entry]), { tank: '10g' });
    assert.equal(result.computed.filtering.level, 'not-evaluated', label);
    assert.equal(result.computed.filtering.status.tone !== 'good', true, label);
    assert.equal(result.written.filters[0].ratingStatus, 'needed', `${label}: re-saved as needing a rating`);
    assert.equal('manufacturerMaxGallons' in result.written.filters[0], false, label);
  }
  // Only verified + a valid positive max counts.
  assert.equal(math.assessFiltration({ filters: [{ ...base, ratingStatus: 'verified', manufacturerMaxGallons: 20 }], gallons: 10 }).level, 'adequate');
  assert.equal(math.assessFiltration({ filters: [{ ...base, ratingStatus: 'verified', manufacturerMinGallons: 10, manufacturerMaxGallons: 20 }], gallons: 10 }).level, 'adequate');
});

test('unsupported capacityMethod on a sponge is dropped, never flow, never a rating sponge', () => {
  for (const method of ['banana', '', 'Flow', 42, true, { x: 1 }]) {
    const entry = { source: 'custom', legacyId: 'manual-u', type: 'SPONGE', capacityMethod: method, gph: 900, manufacturerMaxGallons: 999, ratingStatus: 'verified' };
    assert.equal(items.restoreKind(entry, null), items.RESTORE_KINDS.DROP);
    const direct = math.assessFiltration({ filters: compute.sanitizeFilterList([entry]), gallons: 10 });
    assert.equal(direct.level, 'none', String(method));
    const result = pageLoad(v2Storage([entry]));
    assert.equal(result.state.version, 2);
    assert.deepEqual(result.state.entries, []);
  }
});

// ---------------------------------------------------------------------------------------------
// Steps 11–13 — stale catalog caches and failed network (fresh gear-data module per case)

let freshCounter = 0;
async function freshGearData(localValues) {
  const store = storageWith(localValues);
  globalThis.localStorage = store;
  freshCounter += 1;
  const gear = await import(`../../js/gear-data.js?phase-c=${freshCounter}`);
  return { gear, store };
}
const failingFetch = async () => { throw new Error('offline'); };
const realFetch = async () => ({ ok: true, json: async () => RAW });
function catalogOf(list) {
  return new Map(list.map((item) => [item.id, item]));
}
const OLD_SPONGE_RECORD = (id, gph) => ({ id, brand: 'Old', name: `Old ${id} (Up to 40G)`, type: 'SPONGE', gphRated: gph, minGallons: 0, maxGallons: 40 });

test('stale ttg.gear.catalog.v1 is never read as the catalog; v1-shaped sponges would still score zero', async () => {
  const staleV1 = [OLD_SPONGE_RECORD(HYGGER_S, 200), { id: 'evil-hob', brand: 'X', name: 'X', type: 'HOB', gphRated: 900 }];
  try {
    // Offline with only a v1 cache: no catalog at all (v1 is not a fallback).
    const offline = await freshGearData({ 'ttg.gear.catalog.v1': JSON.stringify(staleV1) });
    await assert.rejects(() => offline.gear.getGearData({ fetchImpl: failingFetch }));
    // Online: the network catalog; nothing from v1.
    const online = await freshGearData({ 'ttg.gear.catalog.v1': JSON.stringify(staleV1) });
    const list = await online.gear.getGearData({ fetchImpl: realFetch });
    assert.equal(list.some((item) => item.id === 'evil-hob'), false);
    assert.equal(list.find((item) => item.id === HYGGER_S).ratingStatus, 'verified');
    assert.equal(online.store.map.get('ttg.gear.catalog.v1'), JSON.stringify(staleV1), 'old tabs keep their own v1 cache');
    // If a v1-shaped record entered through any path, SPONGE still scores zero: Rating needed.
    const item = items.buildSpongeProductItem(OLD_SPONGE_RECORD(HYGGER_S, 200));
    assert.deepEqual([item.gph, item.ratingStatus ?? 'needed', items.spongeChipBadge(item)], [0, 'needed', 'Rating needed']);
    const computed = run('29g', math.normalizeFilters([toApp(item)]));
    assert.deepEqual([computed.filtering.level, computed.filtering.gphTotal, computed.filtering.turnover], ['not-evaluated', 0, 0]);
  } finally {
    delete globalThis.localStorage;
  }
});

test('stale cached catalog sponge (gphRated 120, capacityMethod flow, no rating): zero GPH, Rating needed; refresh restores the verified rating', async () => {
  const staleCatalog = CATALOG.map((item) => (item.id === HYGGER_S
    ? { id: HYGGER_S, brand: item.brand, name: item.name, type: 'SPONGE', gphRated: 120, minGallons: 0, maxGallons: 20, capacityMethod: 'flow' }
    : item));
  try {
    const { gear, store } = await freshGearData({ [CACHE]: JSON.stringify(staleCatalog) });
    // The cached catalog is served first; the network refresh runs in the background.
    let refreshed;
    const refreshDone = new Promise((resolve) => { refreshed = resolve; });
    const fetchImpl = async (...args) => { const res = await realFetch(...args); setTimeout(refreshed, 0); return res; };
    const first = await gear.getGearData({ fetchImpl });
    assert.equal(gear.getGearDataMeta().source, 'CACHE');
    const staleHygger = first.find((item) => item.id === HYGGER_S);
    assert.equal(staleHygger.capacityMethod, 'flow');
    const item = items.buildSpongeProductItem(staleHygger);
    assert.deepEqual([item.gph, item.capacityMethod, items.spongeChipBadge(item)], [0, 'manufacturer_rating', 'Rating needed']);
    const computed = run('29g', math.normalizeFilters([toApp(item)]));
    assert.deepEqual([computed.filtering.level, computed.filtering.gphTotal, computed.filtering.turnover], ['not-evaluated', 0, 0]);
    // A saved plan restored against the stale catalog: Rating needed, never 120 GPH.
    const plan = pageLoad(v1Storage([{ id: HYGGER_S, type: 'SPONGE', rated_gph: 120 }]), { catalogById: catalogOf(first) });
    assert.equal(plan.computed.filtering.level, 'not-evaluated');
    assertNoSpongeGph(plan, 'stale v2 cache');

    await refreshDone;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const cached = JSON.parse(store.map.get(CACHE));
    const refreshedRecord = cached.find((record) => record.id === HYGGER_S);
    assert.deepEqual([refreshedRecord.ratingStatus, refreshedRecord.manufacturerMaxGallons, refreshedRecord.capacityMethod], ['verified', 40, 'manufacturer_rating']);
    const next = await gear.getGearData({ fetchImpl });
    const nextPlan = pageLoad(v1Storage([{ id: HYGGER_S, type: 'SPONGE', rated_gph: 120 }]), { catalogById: catalogOf(next) });
    assert.equal(nextPlan.computed.filtering.level, 'adequate');
    assert.equal(nextPlan.assessment.adequateBy, 'sponge');
    assert.equal(nextPlan.computed.filtering.gphTotal, 0, 'rating-based, old GPH not restored');
  } finally {
    delete globalThis.localStorage;
  }
});

test('stale / damaged cached record typing a known sponge as HOB is still a sponge', async () => {
  const damaged = CATALOG.map((item) => (item.id === HYGGER_M ? { ...item, type: 'HOB', gphRated: 200, rated_gph: 200 } : item));
  try {
    const { gear } = await freshGearData({ [CACHE]: JSON.stringify(damaged) });
    const list = await gear.getGearData({ fetchImpl: failingFetch });
    const record = list.find((item) => item.id === HYGGER_M);
    assert.equal(record.type, 'SPONGE');
    const plan = pageLoad(v2Storage([{ source: 'product', productId: HYGGER_M, type: 'SPONGE', capacityMethod: 'manufacturer_rating' }]), { catalogById: catalogOf(list) });
    assert.equal(plan.computed.filtering.gphTotal, 0);
    assertNoSpongeGph(plan, 'damaged cache');
  } finally {
    delete globalThis.localStorage;
  }
});

test('offline: failed network with stale, verified or no cache never produces a fake adequate result', async () => {
  const plan = () => v1Storage([{ id: HYGGER_S, type: 'SPONGE', rated_gph: 200 }, { id: 'aquaneat-sponge-60', type: 'SPONGE', rated_gph: 200 }]);
  try {
    // Stale GPH-only cache → Rating needed.
    const staleCatalog = CATALOG.map((item) => (math.isSpongeFilter(item) ? OLD_SPONGE_RECORD(item.id, 200) : item));
    const stale = await freshGearData({ [CACHE]: JSON.stringify(staleCatalog) });
    const staleList = await stale.gear.getGearData({ fetchImpl: failingFetch });
    const staleResult = pageLoad(plan(), { catalogById: catalogOf(staleList) });
    assert.equal(staleResult.computed.filtering.level, 'not-evaluated');
    assert.equal(staleResult.computed.filtering.gphTotal, 0);
    assertNoSpongeGph(staleResult, 'offline stale');
    // A cache that stored verified rating metadata may be used (it is the catalog's own rating).
    const good = await freshGearData({ [CACHE]: JSON.stringify(CATALOG) });
    const goodList = await good.gear.getGearData({ fetchImpl: failingFetch });
    const goodResult = pageLoad(plan(), { catalogById: catalogOf(goodList) });
    assert.equal(goodResult.computed.filtering.level, 'adequate');
    assert.equal(goodResult.assessment.adequateBy, 'sponge');
    assert.equal(goodResult.computed.filtering.gphTotal, 0);
    // No cache at all: the catalog is unavailable; saved sponges are Rating needed, nothing crashes.
    const none = await freshGearData({});
    await assert.rejects(() => none.gear.getGearData({ fetchImpl: failingFetch }));
    const noneResult = pageLoad(plan(), { catalogById: OFFLINE });
    assert.equal(noneResult.computed.filtering.level, 'not-evaluated');
    assert.deepEqual(noneResult.restored.map((i) => i.productId), [HYGGER_S, 'aquaneat-sponge-60']);
    assertNoSpongeGph(noneResult, 'offline, no cache');
  } finally {
    delete globalThis.localStorage;
  }
});

// ---------------------------------------------------------------------------------------------
// Step 14 — old open tab / mixed versions

test('valid v2 remains authoritative over a stale v1 written later by an old tab', () => {
  const v2 = { v: 2, filters: [{ instanceId: 'f-new001', source: 'product', productId: HYGGER_S, type: 'SPONGE', capacityMethod: 'manufacturer_rating' }] };
  const oldTabV1 = [{ id: HYGGER_S, type: 'SPONGE', rated_gph: 200 }, { id: 'manual-old', type: 'SPONGE', rated_gph: 900 }, { id: 'aquaclear-70', type: 'HOB', rated_gph: 300 }];
  const storage = storageWith({ [V2]: JSON.stringify(v2), [V1]: JSON.stringify(oldTabV1) });
  const result = pageLoad(storage);
  assert.equal(result.state.version, 2);
  assert.deepEqual(result.restored.map((i) => i.id), [HYGGER_S]);
  assert.equal(result.computed.filtering.gphTotal, 0);
  assert.equal(result.computed.filtering.level, 'adequate');
  assert.equal(result.assessment.adequateBy, 'sponge');
});

test('malformed v2 falls back to v1, and every v1 sponge still migrates to rating (never GPH)', () => {
  const v1 = [{ id: HYGGER_S, type: 'SPONGE', rated_gph: 200 }, { id: 'manual-old', type: 'SPONGE', rated_gph: 900 }, { id: 'tetra-whisper-iq-45', type: 'HOB', rated_gph: 215 }];
  for (const badV2 of ['{not json', '[]', '{"v":1,"filters":[]}', '{"v":3,"filters":[]}', '{"v":2,"filters":{}}', '{"v":2}', 'null', '"text"']) {
    const result = pageLoad(storageWith({ [V2]: badV2, [V1]: JSON.stringify(v1) }));
    assert.equal(result.state.version, 1, badV2);
    assert.deepEqual(result.restored.map((i) => [i.id, i.type, i.gph]), [[HYGGER_S, 'SPONGE', 0], ['manual-old', 'SPONGE', 0], ['tetra-whisper-iq-45', 'HOB', 215]]);
    assert.equal(result.restored[1].ratingStatus, 'needed');
    assert.equal(result.computed.filtering.biologicalGph, 215, 'only the powered filter');
    assertNoSpongeGph(result, badV2);
  }
});

// ---------------------------------------------------------------------------------------------
// Step 15 — malformed-entry isolation inside one v2 payload

test('mixed valid / malformed v2 entries: bad entries fail independently, valid peers survive, no v1 fallback', () => {
  const filters = [
    { instanceId: 'f-ok0001', source: 'product', productId: 'tetra-whisper-iq-45', type: 'HOB', capacityMethod: 'flow', gph: 215 },
    { instanceId: 'f-ok0002', source: 'custom', label: 'Sponge filter', legacyId: 'manual-ok2', type: 'SPONGE', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 30, ratingStatus: 'verified' },
    { instanceId: 'f-bad001', source: 'custom', legacyId: 'manual-bad1', type: 'SPONGE', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 'huge', ratingStatus: 'verified', gph: 900 },
    { instanceId: 'f-bad002', source: 'custom', legacyId: 'manual-bad2', type: 'CANISTER', capacityMethod: 'turbo', gph: 900 },
    { nonsense: true },
    'garbage',
    null,
    42,
    [],
  ];
  const storage = storageWith({ [V2]: JSON.stringify({ v: 2, filters }), [V1]: JSON.stringify([{ id: 'manual-v1', type: 'HOB', rated_gph: 999 }]) });
  const result = pageLoad(storage);
  assert.equal(result.state.version, 2, 'v1 is not consulted');
  assert.deepEqual(result.restored.map((i) => [i.id, i.type, i.gph]), [
    ['tetra-whisper-iq-45', 'HOB', 215],
    ['manual-ok2', 'SPONGE', 0],
    ['manual-bad1', 'SPONGE', 0],
  ]);
  assert.equal(result.restored[1].ratingStatus, 'verified');
  assert.equal(result.restored[2].ratingStatus, 'needed', 'malformed rating → Rating needed, not a pass');
  assert.equal(result.computed.filtering.biologicalGph, 215);
  assert.equal(result.written.filters.length, 3);
});

// ---------------------------------------------------------------------------------------------
// Step 16 — v1 mirror safety (phase E: the mirror is retired; current saves never write v1)

test('current saves write no v1 mirror: HOB, powerhead, verified catalog / custom sponge, unrated legacy sponge', () => {
  const tetra = CATALOG_BY_ID.get('tetra-whisper-iq-45');
  const plan = [
    { id: tetra.id, source: 'product', type: 'HOB', gph: 215, productId: tetra.id },
    { id: 'manual-ph1', source: 'custom', label: 'Powerhead 400 GPH', type: 'POWERHEAD', gph: 400 },
    items.buildSpongeProductItem(CATALOG_BY_ID.get(HYGGER_M)),
    items.buildCustomSpongeItem({ id: 'manual-sp1', ratedGallons: 40 }),
    items.restoreSpongeItem({ id: 'manual-sp2', type: 'SPONGE', rated_gph: 120 }, null),
  ];
  const store = storageWith({});
  saved.writeSavedFilters(store, plan.map(toApp));
  assert.equal(store.map.has(V1), false);
  const v2 = JSON.parse(store.map.get(V2)).filters;
  assert.equal(v2.length, 5);
  assert.equal(v2[4].legacyGph, 120);
  // A historical v1 key is removed once v2 holds the plan (sponge-only and mixed plans alike).
  for (const list of [plan, plan.slice(2)]) {
    const withOld = storageWith({ [V1]: '[{"id":"x","type":"HOB","rated_gph":1}]' });
    saved.writeSavedFilters(withOld, list.map(toApp));
    assert.equal(withOld.map.has(V1), false);
    assert.equal(JSON.parse(withOld.map.get(V2)).filters.length, list.length);
  }
});

// ---------------------------------------------------------------------------------------------
// Steps 17 / 18 / 19 — canonicalisation, Stocking Load, powered regression

const LEGACY_FIXTURES = {
  'v1 catalog sponges': () => v1Storage(SPONGE_IDS.map((id) => ({ id, type: 'SPONGE', rated_gph: 120 }))),
  'Phase A v2 catalog sponges': () => v2Storage(SPONGE_IDS.map((id) => ({ source: 'product', productId: id, type: 'SPONGE', capacityMethod: 'flow', gph: 120 }))),
  'type conflicts': () => v2Storage(Object.values(CONFLICTS).concat([{ source: 'product', productId: 'aquaclear-70', type: 'SPONGE' }])),
  'old custom sponges v1': () => v1Storage(Object.values(OLD_CUSTOM).filter((f) => f.v1).map((f) => f.v1)),
  'old custom sponges v2': () => v2Storage(Object.values(OLD_CUSTOM).filter((f) => f.v2).map((f) => f.v2)),
  'unresolved ids': () => v2Storage([{ source: 'product', productId: 'gone-sponge', type: 'SPONGE', gph: 300 }, { source: 'product', productId: 'gone-hob', type: 'HOB', gph: 150 }]),
  'mixed valid + malformed': () => v2Storage([{ source: 'custom', legacyId: 'manual-m1', type: 'SPONGE', ratingStatus: 'needs_review', manufacturerMaxGallons: 99 }, { source: 'product', productId: 'fluval-307', type: 'CANISTER', gph: 303 }, { bad: 1 }]),
  'malformed v2 + v1 fallback': () => storageWith({ [V2]: '{oops', [V1]: JSON.stringify([{ id: HYGGER_M, type: 'SPONGE', rated_gph: 200 }, { id: 'manual-x', type: 'SPONGE', rated_gph: 150 }]) }),
  'powered legacy': () => v1Storage([{ id: 'tetra-whisper-iq-45', type: 'HOB', rated_gph: 215 }, { id: 'aquaclear-70', type: 'HOB', rated_gph: 300 }, { id: 'manual-can', type: 'CANISTER', rated_gph: 180 }, { id: 'manual-ph', type: 'POWERHEAD', rated_gph: 400 }]),
};

test('save / reload canonicalisation is stable: identity for catalog sponges, rating for custom, no oscillation', () => {
  for (const [label, make] of Object.entries(LEGACY_FIXTURES)) {
    for (const catalogById of [CATALOG_BY_ID, OFFLINE]) {
      const storage = make();
      const first = pageLoad(storage, { catalogById });
      const snapshots = [JSON.stringify(first.written)];
      const levels = [first.computed.filtering.level];
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const next = pageLoad(storage, { catalogById });
        snapshots.push(JSON.stringify(next.written));
        levels.push(next.computed.filtering.level);
        assertNoSpongeGph(next, `${label} cycle ${cycle}`);
      }
      assert.equal(new Set(snapshots).size, 1, `${label} online=${catalogById === CATALOG_BY_ID}: saved v2 stable`);
      assert.equal(new Set(levels).size, 1, `${label}: level stable`);
      for (const entry of first.written?.filters ?? []) {
        if (entry.type === 'SPONGE' && entry.source === 'product') {
          assert.deepEqual(Object.keys(entry).sort(), ['capacityMethod', 'instanceId', 'productId', 'source', 'type'], `${label}: identity only`);
        }
        if (entry.type === 'SPONGE' && entry.source === 'custom') {
          const allowed = entry.ratingStatus === 'verified'
            ? ['capacityMethod', 'instanceId', 'label', 'legacyId', 'manufacturerMaxGallons', 'manufacturerMinGallons', 'ratingStatus', 'source', 'type']
            : ['capacityMethod', 'instanceId', 'label', 'legacyGph', 'legacyId', 'ratingStatus', 'source', 'type'];
          for (const key of Object.keys(entry)) assert.ok(allowed.includes(key), `${label}: ${key}`);
        }
      }
    }
  }
});

test('Stocking Load is identical before and after every legacy restore / save / reload', () => {
  const stocks = [STOCK, [['freshwater_angelfish', 2], ['neon', 12]], [['pea_puffer', 3]], []];
  for (const [label, make] of Object.entries(LEGACY_FIXTURES)) {
    for (const tank of ['5g', '10g', '29g', '55g', '125g']) {
      for (const stock of stocks) {
        const baseline = load(run(tank, [], { stock }));
        const storage = make();
        const state = saved.readSavedFilterState(storage);
        assert.equal(load(run(tank, compute.sanitizeFilterList(state.filters), { stock })), baseline, `${label} ${tank}: pre-controller`);
        const first = pageLoad(storage, { tank });
        assert.equal(load(run(tank, math.normalizeFilters(first.appFilters), { stock })), baseline, `${label} ${tank}: restored`);
        const second = pageLoad(storage, { tank });
        assert.equal(load(run(tank, math.normalizeFilters(second.appFilters), { stock })), baseline, `${label} ${tank}: reloaded`);
        assert.equal(first.assessment.capacityAdjustment, 0);
      }
    }
  }
});

test('powered filters are untouched by the hardening: legitimate GPH intact through v1 and v2', () => {
  const powered = [
    ['tetra-whisper-iq-45', 'HOB', 215],
    ['aquaclear-70', 'HOB', 300],
    ['fluval-307', 'CANISTER', 303],
    ['eheim-2213', 'CANISTER', 116],
  ];
  for (const [id, type, gph] of powered) {
    for (const storage of [v1Storage([{ id, type, rated_gph: gph }]), v2Storage([{ source: 'product', productId: id, type, capacityMethod: 'flow', gph }])]) {
      const result = pageLoad(storage, { tank: '55g' });
      assert.deepEqual(result.restored.map((i) => [i.id, i.type, i.gph]), [[id, type, gph]]);
      assert.equal(result.computed.filtering.biologicalGph, gph);
      assert.deepEqual(result.written.filters.map((e) => [e.productId, e.type, e.capacityMethod, e.gph]), [[id, type, 'flow', gph]]);
      assert.deepEqual(result.mirror, [], 'phase E: no v1 mirror');
    }
  }
  // Tetra IQ 45 stays 215 GPH even if old data stored another number: the catalog wins.
  const stale = pageLoad(v1Storage([{ id: 'tetra-whisper-iq-45', type: 'HOB', rated_gph: 450 }]));
  assert.equal(stale.restored[0].gph, 215);
  const custom = [['manual-hob', 'HOB', 150, 150, 0], ['manual-can', 'CANISTER', 180, 180, 0], ['manual-ph', 'POWERHEAD', 400, 0, 400]];
  for (const [id, type, gph, bio, circ] of custom) {
    for (const storage of [v1Storage([{ id, type, rated_gph: gph }]), v2Storage([{ source: 'custom', legacyId: id, type, capacityMethod: 'flow', gph }])]) {
      const result = pageLoad(storage, { tank: '55g' });
      assert.deepEqual(result.restored.map((i) => [i.id, i.type, i.gph]), [[id, type, gph]]);
      assert.deepEqual([result.computed.filtering.biologicalGph, result.computed.filtering.circulationGph], [bio, circ]);
      assert.deepEqual(result.mirror, [], 'phase E: no v1 mirror');
    }
  }
});
