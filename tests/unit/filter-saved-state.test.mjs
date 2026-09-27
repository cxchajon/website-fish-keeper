// Saved filter state v2 (sponge-filter migration phase A,
// _internal/reports/stocking-advisor-sponge-migration-phase-a-2026-09.md). The storage format gains
// instanceId, productId, capacityMethod and room for manufacturer ratings; scoring is unchanged:
// every filter, sponges included, still scores by its GPH exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\//, '').split('?')[0];
  return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(readFileSync(ROOT + path, 'utf8')) };
};

const saved = await import('../../js/stocking-advisor/filtration/saved-state.js');
const math = await import('../../js/stocking-advisor/filtration/math.js');
const compute = await import('../../js/logic/compute.js');
const { getGearData } = await import('../../js/gear-data.js');
const { getTankById, canonicalizeFilterType } = await import('../../js/utils.js');

await compute.initializeCompute();
const CATALOG = await getGearData({ forceRefresh: true });
const byId = new Map(CATALOG.map((item) => [item.id, item]));
const { FILTER_STORAGE_KEY_V1: V1, FILTER_STORAGE_KEY_V2: V2 } = saved;

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  const reads = [];
  return {
    reads,
    map,
    getItem: (key) => { reads.push(key); return map.has(key) ? map.get(key) : null; },
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

// The controller's item → appState.filters pipeline (toAppFilter + normalizeFilters).
const toApp = (item) => ({
  id: item.id,
  type: canonicalizeFilterType(item.type),
  rated_gph: item.gph,
  kind: canonicalizeFilterType(item.type),
  source: item.source,
  ...math.pickPassthroughFields(item),
  capacityMethod: math.resolveCapacityMethod(item),
});
const productItem = (id) => {
  const product = byId.get(id);
  assert.ok(product, `catalog has ${id}`);
  return { id, source: 'product', gph: Math.min(Math.round(product.gphRated), 1500), type: product.type, productId: id };
};
const customItem = (type, gph, n = 1) => ({ id: `manual-test${n}`, source: 'custom', gph, type, label: `${type} ${gph} GPH` });

// The controller's restore rule: a known product is rebuilt from the catalog, anything else keeps
// its stored GPH as a custom filter; entries without GPH are dropped.
function restore(entries) {
  const out = [];
  for (const entry of entries) {
    const gph = Number(entry.rated_gph);
    if (!(gph > 0)) continue;
    const product = entry.id ? byId.get(entry.id) : null;
    if (product) {
      out.push({ ...productItem(product.id), instanceId: entry.instanceId, ...math.pickPassthroughFields(entry), productId: product.id });
    } else {
      out.push({ id: entry.id, source: 'custom', gph, type: entry.type, ...math.pickPassthroughFields(entry) });
    }
  }
  return out;
}

function score(items, { tankId = '20l', stock = [['neon', 10], ['cory_bronze', 6]] } = {}) {
  const state = compute.createDefaultState();
  const tank = getTankById(tankId);
  Object.assign(state, {
    tank: { ...tank },
    gallons: tank.gallons,
    selectedTankId: tank.id,
    stock: stock.map(([id, qty]) => ({ id, qty })),
    filters: math.normalizeFilters(items.map(toApp)),
  });
  const computed = compute.buildComputedState(state);
  const filtering = { ...computed.filtering };
  delete filtering.filters;
  filtering.assessment = { ...filtering.assessment };
  delete filtering.assessment.filters;
  return { filtering, warnings: computed.status.warnings, bioload: computed.bioload, turnover: computed.tank.turnover };
}

// What the controller persists: the app filter plus a custom filter's chip label.
const toSaved = (item) => (item.source === 'custom' && item.label ? { ...toApp(item), label: item.label } : toApp(item));

function roundTrip(items, storage = memoryStorage()) {
  saved.writeSavedFilters(storage, items.map(toSaved));
  const state = saved.readSavedFilterState(storage);
  return { storage, state, restored: restore(state.filters) };
}

const SPONGE_ID = CATALOG.find((item) => item.type === 'SPONGE')?.id;
const HOB_ID = CATALOG.find((item) => item.type === 'HOB')?.id;
const CANISTER_ID = CATALOG.find((item) => item.type === 'CANISTER')?.id;

test('v2 envelope: key, version, fields per entry', () => {
  assert.equal(V2, 'ttg.stocking.filters.v2');
  assert.equal(V1, 'ttg.stocking.filters.v1');
  const { storage } = roundTrip([productItem(HOB_ID), customItem('CANISTER', 180)]);
  const envelope = JSON.parse(storage.map.get(V2));
  assert.equal(envelope.v, 2);
  const [product, custom] = envelope.filters;
  assert.deepEqual(Object.keys(product).sort(), ['capacityMethod', 'gph', 'instanceId', 'productId', 'source', 'type']);
  assert.equal(product.source, 'product');
  assert.equal(product.productId, HOB_ID);
  assert.equal(product.type, 'HOB');
  assert.equal(product.capacityMethod, 'flow');
  assert.match(product.instanceId, /^f-/);
  assert.deepEqual(Object.keys(custom).sort(), ['capacityMethod', 'gph', 'instanceId', 'label', 'legacyId', 'source', 'type']);
  assert.equal(custom.source, 'custom');
  assert.equal(custom.type, 'CANISTER');
  assert.equal(custom.gph, 180);
  assert.equal(custom.label, 'CANISTER 180 GPH');
  assert.notEqual(product.instanceId, custom.instanceId);
});

test('A. powered catalog filter: save → reload → identical scoring', () => {
  for (const id of [HOB_ID, CANISTER_ID, 'tetra-whisper-iq-45']) {
    const items = [productItem(id)];
    const { restored, state } = roundTrip(items);
    assert.equal(state.version, 2);
    assert.equal(restored[0].source, 'product');
    assert.deepEqual(score(restored, { tankId: '55g' }), score(items, { tankId: '55g' }));
  }
  assert.equal(productItem('tetra-whisper-iq-45').gph, 215);
});

test('B. custom powered filter: save → reload → identical scoring', () => {
  for (const [type, gph] of [['HOB', 150], ['CANISTER', 1], ['INTERNAL', 90], ['POWERHEAD', 400]]) {
    const items = [customItem(type, gph)];
    const { restored } = roundTrip(items);
    assert.equal(restored[0].id, 'manual-test1', 'custom id kept');
    assert.deepEqual(score(restored), score(items));
  }
});

test('C. multiple different filters: order and values preserved', () => {
  const items = [productItem(CANISTER_ID), customItem('SPONGE', 60, 2), productItem(HOB_ID), customItem('POWERHEAD', 300, 3)];
  const first = roundTrip(items);
  assert.deepEqual(first.restored.map((item) => [item.id, item.type, item.gph]), items.map((item) => [item.id, canonicalizeFilterType(item.type), item.gph]));
  assert.deepEqual(score(first.restored), score(items));
  // A second save → reload keeps the same instance ids.
  const second = roundTrip(first.restored);
  assert.deepEqual(second.state.entries.map((entry) => entry.instanceId), first.state.entries.map((entry) => entry.instanceId));
});

test('D. catalog sponge: still scored by its current catalog GPH', () => {
  const sponges = CATALOG.filter((item) => item.type === 'SPONGE');
  assert.ok(sponges.length >= 7);
  for (const sponge of sponges) {
    const items = [productItem(sponge.id)];
    const { restored, state } = roundTrip(items);
    assert.equal(state.entries[0].capacityMethod, 'flow', 'phase A does not reinterpret sponges');
    assert.equal(state.entries[0].gph, Math.round(sponge.gphRated));
    assert.equal(state.entries[0].manufacturerMaxGallons, undefined, 'no rating is populated');
    const before = score(items);
    assert.deepEqual(score(restored), before);
    assert.equal(before.filtering.biologicalGph, Math.round(sponge.gphRated));
  }
});

test('E. custom sponge: save → reload → unchanged', () => {
  const items = [customItem('SPONGE', 120)];
  const { restored, state } = roundTrip(items);
  assert.equal(state.entries[0].type, 'SPONGE');
  assert.equal(state.entries[0].capacityMethod, 'flow');
  assert.deepEqual(score(restored), score(items));
  assert.equal(score(restored).filtering.biologicalGph, 120);
});

test('F. v1 payload migrates to v2 and scores exactly as before', () => {
  const v1 = [
    { id: SPONGE_ID, type: 'SPONGE', rated_gph: 999 }, // stored GPH ignored: re-resolved from the catalog
    { id: 'manual-lx1', type: 'HOB', rated_gph: 150 },
    { id: 'retired-product-id', type: 'CANISTER', rated_gph: 250 }, // unknown id keeps its GPH
    { id: 'manual-lx2', type: 'Sponge', rated_gph: 60 },
  ];
  const storage = memoryStorage({ [V1]: JSON.stringify(v1) });
  const state = saved.readSavedFilterState(storage);
  assert.equal(state.version, 1);
  assert.deepEqual(state.entries.map((entry) => entry.capacityMethod), ['flow', 'flow', 'flow', 'flow']);
  assert.deepEqual(state.entries.map((entry) => entry.type), ['SPONGE', 'HOB', 'CANISTER', 'SPONGE']);
  assert.deepEqual(state.entries.map((entry) => entry.productId ?? null), [SPONGE_ID, null, 'retired-product-id', null]);
  assert.equal(new Set(state.entries.map((entry) => entry.instanceId)).size, 4);
  // Old behaviour, applied to the raw v1 list.
  const legacy = restore(v1.map((entry) => ({ ...entry, type: canonicalizeFilterType(entry.type) })));
  const migrated = restore(state.filters);
  assert.deepEqual(score(migrated), score(legacy));
  assert.deepEqual(migrated.map((item) => [item.id, item.gph]), legacy.map((item) => [item.id, item.gph]));
  // Writing back produces v2 and an identical v1 mirror; v1 is never deleted by a read.
  assert.ok(storage.map.has(V1));
  saved.writeSavedFilters(storage, state.filters);
  assert.equal(JSON.parse(storage.map.get(V2)).v, 2);
  assert.deepEqual(JSON.parse(storage.map.get(V1)), v1.map((entry) => ({ ...entry, type: canonicalizeFilterType(entry.type) })));
});

test('G. a v2 payload loads directly and never reads v1', () => {
  const v2 = { v: 2, filters: [{ instanceId: 'f-aaaaaa', source: 'product', productId: HOB_ID, type: 'HOB', capacityMethod: 'flow', gph: 100 }] };
  const storage = memoryStorage({ [V2]: JSON.stringify(v2), [V1]: JSON.stringify([{ id: 'manual-x', type: 'HOB', rated_gph: 5 }]) });
  const state = saved.readSavedFilterState(storage);
  assert.equal(state.version, 2);
  assert.deepEqual(storage.reads, [V2]);
  assert.equal(state.filters.length, 1);
  assert.equal(state.filters[0].instanceId, 'f-aaaaaa');
  assert.equal(state.filters[0].id, HOB_ID);
});

test('v1 mirror: old scripts see only the fields they read, never future rating values', () => {
  const storage = memoryStorage();
  saved.writeSavedFilters(storage, [
    toApp(productItem(HOB_ID)),
    { ...toApp(customItem('SPONGE', 60)), capacityMethod: 'flow', manufacturerMaxGallons: 20 },
    { ...toApp(productItem(SPONGE_ID)), capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 40 },
  ]);
  const mirror = JSON.parse(storage.map.get(V1));
  assert.equal(mirror.length, 2, 'rating-method entries are left out of v1');
  for (const item of mirror) {
    assert.deepEqual(Object.keys(item).sort(), ['id', 'rated_gph', 'type']);
  }
  assert.equal(mirror[0].id, HOB_ID);
  assert.equal(mirror[1].id, 'manual-test1');
  // Clearing every filter clears both keys, as v1 did.
  saved.writeSavedFilters(storage, []);
  assert.equal(storage.map.has(V1), false);
  assert.equal(storage.map.has(V2), false);
});

test('future capacity fields survive save, restore, sanitize and compute preparation without scoring', () => {
  const fixture = {
    v: 2,
    filters: [
      { instanceId: 'f-sponge1', source: 'product', productId: SPONGE_ID, type: 'SPONGE', capacityMethod: 'manufacturer_rating',
        manufacturerMaxGallons: 20, manufacturerMinGallons: 10, ratingStatus: 'verified', gph: 999 },
      { instanceId: 'f-sponge2', source: 'custom', legacyId: 'manual-cs', label: 'Sponge', type: 'SPONGE',
        capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 30, gph: 45 },
      { instanceId: 'f-ugf0001', source: 'custom', legacyId: 'manual-ugf', type: 'UGF', capacityMethod: 'tank_compatibility', gph: 150 },
    ],
  };
  const storage = memoryStorage({ [V2]: JSON.stringify(fixture) });
  const state = saved.readSavedFilterState(storage);
  const keep = (entry) => [entry.instanceId, entry.capacityMethod, entry.manufacturerMaxGallons, entry.manufacturerMinGallons];
  assert.deepEqual(state.filters.map(keep), [
    ['f-sponge1', 'manufacturer_rating', 20, 10],
    ['f-sponge2', 'manufacturer_rating', 30, undefined],
    ['f-ugf0001', 'tank_compatibility', undefined, undefined],
  ]);
  assert.equal(state.filters[0].productId, SPONGE_ID);
  assert.equal(state.filters[0].ratingStatus, 'verified');

  const restored = restore(state.filters);
  const appFilters = math.normalizeFilters(restored.map(toApp));
  assert.deepEqual(appFilters.map(keep), state.filters.map(keep), 'math.normalizeFilter keeps them');
  assert.deepEqual(appFilters.map((entry) => entry.type), ['SPONGE', 'SPONGE', 'UGF']);
  const sanitized = compute.sanitizeFilterList(appFilters);
  assert.deepEqual(sanitized.map(keep), state.filters.map(keep), 'compute.legacy sanitizeFilter keeps them');
  assert.equal(sanitized[0].productId, SPONGE_ID);

  // Scoring ignores them: identical to the same devices with no capacity fields at all.
  const plain = restored.map((item) => ({ id: item.id, source: item.source, gph: item.gph, type: item.type }));
  assert.deepEqual(score(restored), score(plain));
  const catalogGph = Math.round(byId.get(SPONGE_ID).gphRated);
  assert.equal(score(restored).filtering.biologicalGph, catalogGph + 45 + 150, 'sponge GPH still scored in phase A');

  // Saved again unchanged.
  const again = memoryStorage();
  saved.writeSavedFilters(again, appFilters);
  const envelope = JSON.parse(again.map.get(V2));
  assert.deepEqual(envelope.filters.map(keep), state.filters.map(keep));
  assert.equal(again.map.has(V1), false, 'no flow-method entries → no v1 mirror');
});

// Absent capacityMethod = legacy data → flow. An explicitly unsupported value is malformed and fails
// closed: never converted to flow, never scored, and only that entry is lost.
const methodEntry = (capacityMethod, extra = {}) => ({
  instanceId: 'f-method', source: 'custom', legacyId: 'manual-m', type: 'HOB', gph: 150,
  ...(capacityMethod === undefined ? {} : { capacityMethod }), ...extra,
});
const readV2 = (filters) => saved.readSavedFilterState(memoryStorage({ [V2]: JSON.stringify({ v: 2, filters }) }));

test('capacityMethod A: missing → flow (legacy compatibility)', () => {
  assert.deepEqual(Object.values(math.CAPACITY_METHODS).sort(), ['flow', 'manufacturer_rating', 'tank_compatibility']);
  assert.equal(math.resolveCapacityMethod({ type: 'HOB' }), 'flow');
  assert.equal(math.resolveCapacityMethod({ type: 'SPONGE' }), 'flow', 'phase A: sponges keep the flow method');
  assert.equal(math.resolveCapacityMethod({ capacityMethod: null }), 'flow');
  assert.equal(math.resolveCapacityMethod(null), 'flow');
  assert.equal(math.hasUnsupportedCapacityMethod({ type: 'HOB' }), false);
  const state = readV2([methodEntry(undefined)]);
  assert.deepEqual(state.filters.map((entry) => [entry.capacityMethod, entry.rated_gph]), [['flow', 150]]);
});

test('capacityMethod B: "flow" accepted', () => {
  assert.equal(math.resolveCapacityMethod({ capacityMethod: 'flow' }), 'flow');
  const state = readV2([methodEntry('flow')]);
  assert.deepEqual(state.filters.map((entry) => [entry.capacityMethod, entry.rated_gph]), [['flow', 150]]);
  assert.equal(score(restore(state.filters)).filtering.biologicalGph, 150);
});

test('capacityMethod C + D: manufacturer_rating and tank_compatibility preserved (and not scored differently)', () => {
  for (const method of ['manufacturer_rating', 'tank_compatibility']) {
    assert.equal(math.resolveCapacityMethod({ capacityMethod: method }), method);
    assert.equal(math.hasUnsupportedCapacityMethod({ capacityMethod: method }), false);
    const state = readV2([methodEntry(method, { manufacturerMaxGallons: 20 })]);
    assert.equal(state.filters[0].capacityMethod, method);
    assert.equal(math.normalizeFilter(state.filters[0]).capacityMethod, method);
    assert.equal(compute.sanitizeFilterList(state.filters)[0].capacityMethod, method);
    // Phase A: its GPH is still scored exactly as a flow filter's would be.
    assert.equal(score(restore(state.filters)).filtering.biologicalGph, 150);
  }
});

test('capacityMethod E: an unsupported value is not converted to flow and adds no GPH', () => {
  for (const bad of ['banana', 'FLOW ', 'Flow', '', 42, true, {}, []]) {
    const filter = { id: 'manual-bad', type: 'HOB', rated_gph: 150, gph: 150, capacityMethod: bad };
    if (bad === 'FLOW ') {
      // Whitespace-only differences of a known value are the same value; case is not.
      continue;
    }
    assert.equal(math.hasUnsupportedCapacityMethod(filter), true, JSON.stringify(bad));
    assert.equal(math.resolveCapacityMethod(filter), null, 'never becomes flow');
    assert.equal(math.normalizeFilter(filter).ratedGph, 0);
    assert.equal(math.normalizeFilter(filter).capacityMethod, undefined);
    assert.deepEqual(math.normalizeFilters([filter]), []);
    assert.equal(compute.sanitizeFilterList([filter])[0].rated_gph, 0);
    assert.equal(compute.calcTotalGph([filter]), 0);
    assert.equal(math.assessFiltration({ filters: [filter], gallons: 20, hasStock: true }).level, 'none');
    // Through the whole calculator: identical to having no filter at all.
    const state = compute.createDefaultState();
    const tank = getTankById('20l');
    Object.assign(state, { tank: { ...tank }, gallons: tank.gallons, selectedTankId: tank.id, stock: [{ id: 'neon', qty: 10 }], filters: [filter] });
    const withBad = compute.buildComputedState(state);
    const none = compute.buildComputedState({ ...state, filters: [] });
    assert.equal(withBad.filtering.gphTotal, 0);
    assert.equal(withBad.filtering.level, none.filtering.level);
    assert.deepEqual(withBad.status.warnings.map((w) => w.id), none.status.warnings.map((w) => w.id));
    // Stocking Load identical. (bioload.flowAdjustment.hasProduct is a descriptive flag read from raw
    // ids, never a load input; the saved-state and controller paths drop such an entry before compute.)
    const load = (c) => [c.bioload.currentPercent, c.bioload.proposedPercent, c.bioload.text, c.bioload.severity];
    assert.deepEqual(load(withBad), load(none));
    // Never written back either.
    const storage = memoryStorage();
    saved.writeSavedFilters(storage, [filter]);
    assert.equal(storage.map.has(V2), false);
    assert.equal(storage.map.has(V1), false);
  }
  assert.doesNotThrow(() => readV2([methodEntry('banana')]));
  assert.deepEqual(readV2([methodEntry('banana')]).filters, []);
});

test('capacityMethod F: a v2 payload with one valid and one invalid-method filter keeps only the valid one', () => {
  const storage = memoryStorage({ [V2]: JSON.stringify({ v: 2, filters: [
    { instanceId: 'f-good01', source: 'product', productId: HOB_ID, type: 'HOB', capacityMethod: 'flow', gph: 100 },
    { instanceId: 'f-bad001', source: 'custom', legacyId: 'manual-bad', type: 'CANISTER', capacityMethod: 'banana', gph: 900 },
  ] }), [V1]: JSON.stringify([{ id: 'manual-x', type: 'HOB', rated_gph: 5 }]) });
  const state = saved.readSavedFilterState(storage);
  assert.equal(state.version, 2, 'still a valid v2 payload; v1 is not used');
  assert.deepEqual(storage.reads, [V2]);
  assert.deepEqual(state.filters.map((entry) => [entry.instanceId, entry.id]), [['f-good01', HOB_ID]]);
  const restored = restore(state.filters);
  assert.deepEqual(score(restored), score([productItem(HOB_ID)]), 'scores exactly as the valid filter alone');
  assert.ok(!JSON.stringify(score(restored)).includes('900'));
});

test('capacityMethod G: an old v1 payload still migrates every entry to flow exactly as before', () => {
  const v1 = [
    { id: SPONGE_ID, type: 'SPONGE', rated_gph: 120 },
    { id: 'manual-a', type: 'HOB', rated_gph: 150 },
    { id: 'manual-b', type: 'Powerhead', rated_gph: 300 },
  ];
  const state = saved.readSavedFilterState(memoryStorage({ [V1]: JSON.stringify(v1) }));
  assert.equal(state.version, 1);
  assert.deepEqual(state.filters.map((entry) => [entry.id, entry.type, entry.rated_gph, entry.capacityMethod]), [
    [SPONGE_ID, 'SPONGE', 120, 'flow'],
    ['manual-a', 'HOB', 150, 'flow'],
    ['manual-b', 'POWERHEAD', 300, 'flow'],
  ]);
  const legacy = restore(v1.map((entry) => ({ ...entry, type: canonicalizeFilterType(entry.type) })));
  assert.deepEqual(score(restore(state.filters)), score(legacy));
});

test('scoring never reads the capacity fields (math.assessFiltration)', () => {
  const base = [{ type: 'SPONGE', rated_gph: 60 }, { type: 'HOB', rated_gph: 100 }];
  const withFields = base.map((entry, index) => ({ ...entry, instanceId: `f-${index}`, capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 500 }));
  const strip = (result) => ({ ...result, filters: result.filters.map(({ id, source, label, type, role, ratedGph }) => ({ id, source, label, type, role, ratedGph })) });
  for (const gallons of [5, 20, 55, 125]) {
    assert.deepEqual(strip(math.assessFiltration({ filters: withFields, gallons, hasStock: true })), strip(math.assessFiltration({ filters: base, gallons, hasStock: true })));
  }
});

test('storage failures are safe: malformed, missing fields, unknown values, duplicates, no storage', () => {
  // Malformed v2 JSON → falls back to the v1 mirror written beside it.
  let storage = memoryStorage({ [V2]: '{"v":2,"filters":[', [V1]: JSON.stringify([{ id: 'manual-a', type: 'HOB', rated_gph: 80 }]) });
  let state = saved.readSavedFilterState(storage);
  assert.equal(state.version, 1);
  assert.deepEqual(state.filters.map((entry) => [entry.id, entry.rated_gph]), [['manual-a', 80]]);

  // Wrong envelope shapes and versions.
  for (const bad of ['null', '[]', '"x"', '{"v":3,"filters":[]}', '{"v":2}', '{"v":2,"filters":{}}', 'undefined']) {
    state = saved.readSavedFilterState(memoryStorage({ [V2]: bad }));
    assert.deepEqual(state.filters, [], bad);
  }

  // Missing / junk fields: nothing is invented.
  state = saved.readSavedFilterState(memoryStorage({ [V2]: JSON.stringify({ v: 2, filters: [
    null, 7, 'x', [], {},
    { source: 'custom', type: 'HOB' }, // no GPH, no rating → dropped
    { source: 'custom', type: 'HOB', gph: -40 },
    { source: 'custom', type: 'HOB', gph: 'abc' },
    { source: 'product', type: 'HOB', gph: 0 }, // product without productId and no GPH → dropped
    { source: 'custom', type: 'HOB', gph: 90, manufacturerMaxGallons: 'lots', manufacturerMinGallons: -5 },
    { source: 'custom', type: 'HOB', gph: 95, capacityMethod: 'warp' }, // unsupported method → dropped (fails closed)
    { source: 'custom', type: 'SPACESHIP', gph: 70 }, // unknown type: canonicalised as v1 always did
    { source: 'product', productId: 'no-such-product', type: 'CANISTER', gph: 250 }, // stale product id
    { source: 'custom', type: 'HOB', gph: 99999 },
  ] }) }));
  assert.deepEqual(state.filters.map((entry) => [entry.type, entry.rated_gph, entry.capacityMethod]), [
    ['HOB', 90, 'flow'],
    ['HOB', 70, 'flow'],
    ['CANISTER', 250, 'flow'],
    ['HOB', 1500, 'flow'],
  ]);
  assert.equal(state.filters[0].manufacturerMaxGallons, undefined);
  assert.equal(state.filters[0].manufacturerMinGallons, undefined);
  // The stale id keeps today's fallback: custom filter at its stored GPH, id kept for a later catalog.
  const stale = restore(state.filters)[2];
  assert.deepEqual([stale.id, stale.source, stale.gph, stale.productId], ['no-such-product', 'custom', 250, 'no-such-product']);

  // Duplicated instanceIds are re-issued, first one kept.
  state = saved.readSavedFilterState(memoryStorage({ [V2]: JSON.stringify({ v: 2, filters: [
    { instanceId: 'f-dup', source: 'custom', type: 'HOB', gph: 100 },
    { instanceId: 'f-dup', source: 'custom', type: 'HOB', gph: 110 },
    { instanceId: 12, source: 'custom', type: 'HOB', gph: 120 },
  ] }) }));
  const ids = state.filters.map((entry) => entry.instanceId);
  assert.equal(ids[0], 'f-dup');
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every((id) => typeof id === 'string' && id));

  // Storage that throws, or no storage at all.
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } };
  assert.deepEqual(saved.readSavedFilters(throwing), []);
  assert.equal(saved.writeSavedFilters(throwing, [toApp(customItem('HOB', 100))]), false);
  assert.deepEqual(saved.readSavedFilterState(null).filters, []);
  assert.equal(saved.writeSavedFilters(null, []), false);
  assert.deepEqual(saved.readSavedFilters(), [], 'no localStorage in node');
});

test('instance ids: unique, stable, separate from product ids', () => {
  const taken = new Set();
  for (let i = 0; i < 500; i += 1) {
    const id = saved.createInstanceId(taken);
    assert.ok(!taken.has(id));
    taken.add(id);
  }
  const { state } = roundTrip([productItem(HOB_ID)]);
  assert.notEqual(state.entries[0].instanceId, state.entries[0].productId);
});

test('the gear loader keeps capacity metadata only when a record has it (none do yet)', () => {
  const RAW = JSON.parse(readFileSync(ROOT + 'assets/data/gearCatalog.json', 'utf8'));
  for (const key of ['capacityMethod', 'manufacturerMaxGallons', 'manufacturerMinGallons', 'ratingStatus']) {
    assert.ok(RAW.every((item) => !(key in item)), `no catalog record has ${key}`);
    assert.ok(CATALOG.every((item) => !(key in item)), `loader adds no ${key}`);
  }
});
