// Sponge migration phase D: duplicate filter instances.
// Report: _internal/reports/stocking-advisor-sponge-migration-phase-d-2026-09.md
//   productId  = which model of filter (repeats for identical filters)
//   instanceId = which physical copy (unique within the list)
// Every physical filter is kept, scored and saved separately; nothing collapses by productId.
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
const { getGearData } = await import('../../js/gear-data.js');
const { getTankById } = await import('../../js/utils.js');

await compute.initializeCompute();
const CATALOG = await getGearData({ forceRefresh: true });
const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.id, item]));
const OFFLINE = new Map();

const HYGGER_S = 'hygger-double-sponge-s';
const AQUANEAT_MIDDLE = 'aquaneat-sponge-20';
const AC70 = 'aquaclear-70';
const TETRA = 'tetra-whisper-iq-45';
const UGF = 'penn-plax-ugf-20-29';
const V1 = saved.FILTER_STORAGE_KEY_V1;
const V2 = saved.FILTER_STORAGE_KEY_V2;

function storageWith(values = {}) {
  const map = new Map(Object.entries(values));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}
const v1Storage = (list) => storageWith({ [V1]: JSON.stringify(list) });
const v2Storage = (filters) => storageWith({ [V2]: JSON.stringify({ v: 2, filters }) });

// --- controller model (hydrateFromAppState → setFilters), as in the phase C harness -----------------
function productItem(product) {
  if (math.isSpongeFilter(product)) return items.buildSpongeProductItem(product);
  return { id: product.id, source: 'product', label: product.name, type: product.type, gph: Math.round(product.gphRated),
    productId: product.id, capacityMethod: 'flow' };
}

function controllerRestore(filters, catalogById = CATALOG_BY_ID) {
  const out = [];
  const restoredUndergravel = new Set();
  for (const entry of filters) {
    const id = typeof entry?.id === 'string' && entry.id ? entry.id : null;
    const product = id ? catalogById.get(id) ?? null : null;
    const kind = items.restoreKind(entry, product);
    if (kind === items.RESTORE_KINDS.DROP) continue;
    if ((product ?? entry).type === 'UGF') {
      const plateKey = product?.id ?? entry.productId ?? id;
      if (restoredUndergravel.has(plateKey)) continue;
      restoredUndergravel.add(plateKey);
    }
    if (kind === items.RESTORE_KINDS.PRODUCT) {
      const item = math.isSpongeFilter(product) ? items.restoreSpongeItem(entry, product) : productItem(product);
      const saved = math.pickPassthroughFields(entry);
      out.push(saved.instanceId ? { ...item, instanceId: saved.instanceId } : item);
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
  // setFilters: nothing de-duplicated by product or id; instanceIds made unique.
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

// "Add Selected" on a catalog product: one new item, same productId, new instanceId (setFilters).
function addProduct(list, productId) {
  return instances.withUniqueInstanceIds(list.concat([productItem(CATALOG_BY_ID.get(productId))]));
}
let manualCounter = 0;
const customPowered = (type, gph) => ({ id: `manual-t${(manualCounter += 1)}`, source: 'custom', label: `${type} ${gph} GPH`, type, gph, capacityMethod: 'flow' });
const customSponge = (gallons) => items.buildCustomSpongeItem({ id: `manual-t${(manualCounter += 1)}`, ratedGallons: gallons });
const legacySponge = (legacyGph) => ({ id: `manual-t${(manualCounter += 1)}`, source: 'custom', label: 'Sponge filter', type: 'SPONGE', gph: 0,
  capacityMethod: 'manufacturer_rating', ratingStatus: 'needed', legacyGph });
const withIds = (list) => instances.withUniqueInstanceIds(list);

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
const warningText = (computed, id) => (computed.filtering.warnings ?? []).find((w) => w.id === id)?.text ?? '';
const assess = (list, gallons) => math.assessFiltration({ filters: list.map(toApp), gallons, hasStock: true });

// One page load through saved state: read → stocking.js view → controller restore → save.
function pageLoad(storage, { catalogById = CATALOG_BY_ID, tank = '55g' } = {}) {
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

// ---------------------------------------------------------------------------------------------
test('instanceId format: valid ids kept, malformed ids rejected by every sanitising layer', () => {
  for (const ok of ['f-abc123', 'f-one', 'f-two', 'f-mhz3k9-4', 'x', 'F_9']) {
    assert.equal(math.isValidInstanceId(ok), true, ok);
    assert.equal(math.pickPassthroughFields({ instanceId: ok }).instanceId, ok, ok);
  }
  for (const bad of ['', ' ', ' f-abc', 'f-abc ', 'f abc', '-f', 'f-<script>', 'f-"x"', 'a'.repeat(65), 12, null, {}, ['f-a'], true]) {
    assert.equal(math.isValidInstanceId(bad), false, JSON.stringify(bad));
    assert.equal('instanceId' in math.pickPassthroughFields({ instanceId: bad }), false, JSON.stringify(bad));
  }
});

test('withUniqueInstanceIds: same productId + different instanceIds kept untouched; repeats / gaps / malformed repaired, never dropped', () => {
  const a = { id: AC70, productId: AC70, instanceId: 'f-abc123' };
  const b = { id: AC70, productId: AC70, instanceId: 'f-def456' };
  const out = instances.withUniqueInstanceIds([a, b]);
  assert.equal(out.length, 2);
  assert.equal(out[0], a, 'valid unique id: same object');
  assert.equal(out[1], b);

  const damaged = [
    { productId: AC70, instanceId: 'f-dup' },
    { productId: AC70, instanceId: 'f-dup' },
    { productId: AC70 },
    { productId: AC70, instanceId: 'bad id!' },
    { productId: AC70, instanceId: 42 },
  ];
  const repaired = instances.withUniqueInstanceIds(damaged);
  assert.equal(repaired.length, 5, 'every physical filter kept');
  assert.equal(repaired[0].instanceId, 'f-dup', 'first use kept');
  assert.equal(new Set(repaired.map((item) => item.instanceId)).size, 5);
  repaired.forEach((item) => {
    assert.equal(math.isValidInstanceId(item.instanceId), true);
    assert.equal(item.productId, AC70, 'productId unchanged');
  });
  assert.deepEqual(instances.withUniqueInstanceIds('x'), []);
});

test('remove / replace / find by instanceId touch exactly one physical filter', () => {
  const list = withIds([productItem(CATALOG_BY_ID.get(AC70)), productItem(CATALOG_BY_ID.get(AC70))]);
  const [first, second] = list;
  assert.notEqual(first.instanceId, second.instanceId);
  assert.equal(instances.findInstance(list, second.instanceId), second);
  assert.equal(instances.findInstance(list, 'f-nope'), null);
  assert.equal(instances.findInstance(list, AC70), null, 'a productId is not an instance key');

  const afterFirst = instances.removeInstance(list, first.instanceId);
  assert.deepEqual(afterFirst.map((item) => item.instanceId), [second.instanceId], 'remove first chip: one remains');
  assert.deepEqual(instances.removeInstance(afterFirst, second.instanceId), [], 'remove remaining chip: zero remain');
  assert.equal(instances.removeInstance(list, AC70).length, 2, 'removing by productId removes nothing');
  assert.equal(instances.removeInstance(list, '').length, 2);

  const replaced = instances.replaceInstance(list, second.instanceId, { ...second, label: 'changed', instanceId: 'f-other' });
  assert.equal(replaced[0], first);
  assert.equal(replaced[1].label, 'changed');
  assert.equal(replaced[1].instanceId, second.instanceId, 'replacement keeps the instanceId');
});

test('duplicatePositions: only repeated products are numbered, in list order', () => {
  const list = withIds([productItem(CATALOG_BY_ID.get(AC70)), productItem(CATALOG_BY_ID.get(TETRA)), productItem(CATALOG_BY_ID.get(AC70)), customPowered('HOB', 100)]);
  const positions = instances.duplicatePositions(list);
  assert.deepEqual(positions.get(list[0].instanceId), { position: 1, count: 2 });
  assert.deepEqual(positions.get(list[2].instanceId), { position: 2, count: 2 });
  assert.equal(positions.has(list[1].instanceId), false);
  assert.equal(positions.has(list[3].instanceId), false);
});

test('Add Selected twice: same productId, new unique instanceId each time', () => {
  let list = [];
  for (let i = 0; i < 5; i += 1) list = addProduct(list, HYGGER_S);
  assert.equal(list.length, 5);
  assert.equal(new Set(list.map((item) => item.instanceId)).size, 5);
  list.forEach((item) => {
    assert.equal(item.productId, HYGGER_S);
    assert.notEqual(item.instanceId, item.productId);
    assert.equal(item.instanceId.includes(HYGGER_S), false, 'instanceId never derived from productId');
  });
});

test('serialize: two instances of one product survive as two v2 entries (powered and sponge); v1 mirror repeats the powered id only', () => {
  const list = withIds([
    ...addProduct(addProduct([], AC70), AC70),
    ...addProduct(addProduct([], HYGGER_S), HYGGER_S),
  ]);
  const entries = saved.serializeFilters(list.map(toApp));
  assert.equal(entries.length, 4);
  assert.deepEqual(entries.map((e) => [e.productId, e.type, e.capacityMethod, e.gph ?? null]), [
    [AC70, 'HOB', 'flow', 300], [AC70, 'HOB', 'flow', 300],
    [HYGGER_S, 'SPONGE', 'manufacturer_rating', null], [HYGGER_S, 'SPONGE', 'manufacturer_rating', null],
  ]);
  assert.deepEqual(entries.map((e) => e.instanceId), list.map((item) => item.instanceId), 'instanceIds preserved');
  entries.filter((e) => e.type === 'SPONGE').forEach((e) => {
    assert.deepEqual(Object.keys(e).sort(), ['capacityMethod', 'instanceId', 'productId', 'source', 'type'], 'catalog sponge: identity only');
  });
  const mirror = saved.toV1Mirror(entries);
  assert.deepEqual(mirror, [{ id: AC70, type: 'HOB', rated_gph: 300 }, { id: AC70, type: 'HOB', rated_gph: 300 }]);
});

test('restore: the phase D example v2 plan keeps both hygger S instances, each re-resolved from the current catalog', () => {
  const storage = v2Storage([
    { instanceId: 'f-one', source: 'product', productId: HYGGER_S, type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
    // Stale data on the second copy must not leak into it (current catalog authority).
    { instanceId: 'f-two', source: 'product', productId: HYGGER_S, type: 'HOB', capacityMethod: 'flow', gph: 900,
      manufacturerMaxGallons: 500, ratingStatus: 'verified' },
  ]);
  const result = pageLoad(storage, { tank: '55g' });
  assert.deepEqual(result.state.entries.map((e) => [e.instanceId, e.productId, e.type, e.capacityMethod, e.gph ?? null]), [
    ['f-one', HYGGER_S, 'SPONGE', 'manufacturer_rating', null], ['f-two', HYGGER_S, 'SPONGE', 'manufacturer_rating', null],
  ]);
  assert.deepEqual(result.restored.map((item) => [item.instanceId, item.productId, item.manufacturerMaxGallons, item.manufacturerMinGallons, item.ratingStatus]), [
    ['f-one', HYGGER_S, 40, 10, 'verified'], ['f-two', HYGGER_S, 40, 10, 'verified'],
  ]);
  assert.equal(result.computed.filtering.level, 'likely-multi-sponge');
  assert.deepEqual(result.written.filters.map((e) => e.instanceId), ['f-one', 'f-two']);
  assert.deepEqual(result.written.filters[1], { instanceId: 'f-two', source: 'product', productId: HYGGER_S, type: 'SPONGE', capacityMethod: 'manufacturer_rating' });
  assert.deepEqual(result.mirror, []);
});

test('repeated save / reload never collapses duplicates and is byte-stable (online and offline)', () => {
  for (const catalogById of [CATALOG_BY_ID, OFFLINE]) {
    let list = [];
    list = addProduct(list, AC70);
    list = addProduct(list, AC70);
    list = addProduct(list, HYGGER_S);
    list = addProduct(list, HYGGER_S);
    list = addProduct(list, AQUANEAT_MIDDLE);
    list = addProduct(list, AQUANEAT_MIDDLE);
    list = withIds(list.concat([customPowered('HOB', 150), customPowered('HOB', 150), customSponge(20), customSponge(20)]));
    const storage = storageWith();
    saved.writeSavedFilters(storage, list.map(toApp));
    const first = storage.map.get(V2);
    const ids = list.map((item) => item.instanceId);
    let previous = first;
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const result = pageLoad(storage, { catalogById, tank: '55g' });
      assert.equal(result.restored.length, 10, `cycle ${cycle}`);
      assert.deepEqual(result.restored.map((item) => item.instanceId), ids, `cycle ${cycle}: instanceIds`);
      const now = storage.map.get(V2);
      if (catalogById === CATALOG_BY_ID) assert.equal(now, previous, `cycle ${cycle}: byte-identical`);
      previous = now;
    }
    const final = JSON.parse(previous).filters;
    assert.equal(final.length, 10);
    assert.equal(final.filter((e) => e.productId === AC70).length, 2);
    assert.equal(final.filter((e) => e.productId === HYGGER_S).length, 2);
    assert.equal(final.filter((e) => e.productId === AQUANEAT_MIDDLE).length, 2);
  }
});

test('duplicate instanceId in saved v2 is repaired: both filters kept, first id kept, second re-issued', () => {
  const storage = v2Storage([
    { instanceId: 'f-same', source: 'product', productId: AC70, type: 'HOB', capacityMethod: 'flow', gph: 300 },
    { instanceId: 'f-same', source: 'product', productId: AC70, type: 'HOB', capacityMethod: 'flow', gph: 300 },
    { instanceId: 'bad id', source: 'product', productId: AC70, type: 'HOB', capacityMethod: 'flow', gph: 300 },
    { source: 'product', productId: AC70, type: 'HOB', capacityMethod: 'flow', gph: 300 },
  ]);
  const result = pageLoad(storage, { tank: '75g' });
  const ids = result.restored.map((item) => item.instanceId);
  assert.equal(ids.length, 4);
  assert.equal(ids[0], 'f-same');
  assert.equal(new Set(ids).size, 4);
  ids.forEach((id) => assert.equal(math.isValidInstanceId(id), true));
  assert.equal(result.computed.filtering.biologicalGph, 1200, 'four physical AC70s');
  assert.deepEqual(result.written.filters.map((e) => e.instanceId), ids, 'repair is written back and stable');
  const again = pageLoad(storage, { tank: '75g' });
  assert.deepEqual(again.restored.map((item) => item.instanceId), ids);
});

test('v1 plan with a repeated powered id migrates both copies with distinct instanceIds', () => {
  const result = pageLoad(v1Storage([{ id: TETRA, type: 'HOB', rated_gph: 215 }, { id: TETRA, type: 'HOB', rated_gph: 215 }]), { tank: '125g' });
  assert.equal(result.state.version, 1);
  assert.equal(result.state.entries.length, 2);
  assert.notEqual(result.state.entries[0].instanceId, result.state.entries[1].instanceId);
  assert.deepEqual(result.restored.map((item) => [item.productId, item.gph]), [[TETRA, 215], [TETRA, 215]]);
  assert.equal(result.computed.filtering.biologicalGph, 430);
  assert.equal(result.computed.filtering.level, 'adequate');
  assert.equal(result.preController.filtering.biologicalGph, 430, 'stocking.js view already counted both');
  assert.equal(result.written.filters.length, 2);
  assert.deepEqual(result.mirror, [{ id: TETRA, type: 'HOB', rated_gph: 215 }, { id: TETRA, type: 'HOB', rated_gph: 215 }]);
});

test('v1 plan with a repeated known sponge id migrates two separate sponge instances with zero GPH', () => {
  const result = pageLoad(v1Storage([{ id: HYGGER_S, type: 'SPONGE', rated_gph: 200 }, { id: HYGGER_S, type: 'HOB', rated_gph: 900 }]), { tank: '55g' });
  assert.deepEqual(result.state.entries.map((e) => [e.productId, e.type, e.capacityMethod, 'gph' in e]), [
    [HYGGER_S, 'SPONGE', 'manufacturer_rating', false], [HYGGER_S, 'SPONGE', 'manufacturer_rating', false],
  ]);
  assert.notEqual(result.state.entries[0].instanceId, result.state.entries[1].instanceId);
  for (const computed of [result.preController, result.computed]) {
    assert.equal(computed.filtering.biologicalGph, 0);
    assert.equal(computed.filtering.gphTotal, 0);
  }
  assert.equal(result.computed.filtering.level, 'likely-multi-sponge');
  assert.deepEqual(result.mirror, []);
  // Custom legacy sponges with the same manual id (damaged v1) are two Rating-needed sponges.
  const custom = pageLoad(v1Storage([{ id: 'manual-sp', type: 'SPONGE', rated_gph: 120 }, { id: 'manual-sp', type: 'SPONGE', rated_gph: 120 }]), { tank: '29g' });
  assert.deepEqual(custom.restored.map((item) => [item.ratingStatus, item.gph]), [['needed', 0], ['needed', 0]]);
  assert.equal(new Set(custom.restored.map((item) => item.instanceId)).size, 2);
  assert.equal(custom.computed.filtering.level, 'not-evaluated');
});

test('powered duplicates add their flow: 2 × 150 GPH on 100 gal = 300 GPH, 3.0×/h, passes the unchanged 2× floor', () => {
  assert.equal(math.MIN_BIOLOGICAL_TURNOVER, 2);
  const one = withIds([customPowered('HOB', 150)]);
  const two = withIds([customPowered('HOB', 150), customPowered('HOB', 150)]);
  const single = assess(one, 100);
  const pair = assess(two, 100);
  assert.equal(single.biologicalGph, 150);
  assert.equal(single.level, 'very-low');
  assert.equal(pair.biologicalGph, 300);
  assert.equal(pair.biologicalTurnover, 3);
  assert.equal(pair.level, 'adequate');
  assert.equal(pair.adequateBy, 'powered');
  assert.equal(pair.powered.count, 2);
  // Catalog: Tetra IQ 45 (215 GPH) on the 125-gal preset: 1.72×/h alone, 3.44×/h as a pair.
  const tetra1 = computeFor('125g', addProduct([], TETRA));
  const tetra2 = computeFor('125g', addProduct(addProduct([], TETRA), TETRA));
  assert.equal(tetra1.filtering.level, 'very-low');
  assert.equal(tetra2.filtering.biologicalGph, 430);
  assert.equal(tetra2.filtering.level, 'adequate');
  assert.equal(load(tetra1), load(tetra2), 'Stocking Load unchanged');
});

test('powerhead duplicates add circulation only, never biological filtration', () => {
  const heads = withIds([customPowered('POWERHEAD', 400), customPowered('POWERHEAD', 400)]);
  const alone = assess(heads, 29);
  assert.equal(alone.circulationGph, 800);
  assert.equal(alone.totalGph, 800);
  assert.equal(alone.biologicalGph, 0);
  assert.equal(alone.level, 'circulation-only');
  assert.equal(alone.hasBiologicalFiltration, false);
  const withSponge = assess(withIds([...heads, ...addProduct([], HYGGER_S)]), 29);
  assert.equal(withSponge.circulationGph, 800);
  assert.equal(withSponge.biologicalGph, 0);
  assert.equal(withSponge.level, 'adequate');
  assert.equal(withSponge.adequateBy, 'sponge');
});

test('2 × hygger S on 55 gal: two verified instances → "Likely adequate — multiple sponge filters" (amber, no combined gallons)', () => {
  const list = addProduct(addProduct([], HYGGER_S), HYGGER_S);
  const assessment = assess(list, 55);
  assert.equal(assessment.sponge.count, 2);
  assert.equal(assessment.sponge.verifiedCount, 2);
  assert.equal(assessment.level, 'likely-multi-sponge');
  assert.equal(assessment.status.tone, 'warn');
  assert.equal(assessment.status.text, 'Likely adequate — multiple sponge filters');
  assert.equal(assessment.biologicalGph, 0);
  assert.deepEqual(assessment.sponge.entries.map((s) => [s.instanceId, s.productId, s.ratingText, s.coversTank]),
    list.map((item) => [item.instanceId, HYGGER_S, '10–40 gal', false]));
  const computed = computeFor('55g', list);
  assert.equal(computed.filtering.level, 'likely-multi-sponge');
  assert.deepEqual(warningIds(computed), ['filtration.likely_multi_sponge']);
  const text = warningText(computed, 'filtration.likely_multi_sponge');
  assert.match(text, /\(S\) 1: rated 10–40 gal; .*\(S\) 2: rated 10–40 gal/, 'each rating listed separately');
  assert.doesNotMatch(text, /80/, 'no combined gallons');
  // One copy removed → below rating.
  const one = computeFor('55g', instances.removeInstance(list, list[0].instanceId));
  assert.equal(one.filtering.level, 'below-rating');
  assert.equal(load(one), load(computed));
});

test('2 × hygger S on 29 gal stays "Rated for this tank" — no stronger status for the second copy', () => {
  const one = assess(addProduct([], HYGGER_S), 29);
  const two = assess(addProduct(addProduct([], HYGGER_S), HYGGER_S), 29);
  for (const assessment of [one, two]) {
    assert.equal(assessment.level, 'adequate');
    assert.equal(assessment.adequateBy, 'sponge');
    assert.deepEqual(assessment.status, { icon: '✓', text: 'Rated for this tank', tone: 'good' });
    assert.equal(assessment.capacityAdjustment, 0);
  }
  assert.equal(two.sponge.likelyMulti, false);
  const c1 = computeFor('29g', addProduct([], HYGGER_S));
  const c2 = computeFor('29g', addProduct(addProduct([], HYGGER_S), HYGGER_S));
  assert.deepEqual(warningIds(c1), warningIds(c2));
  assert.equal(load(c1), load(c2));
});

test('duplicate unrated sponges: both kept, zero GPH, quantity is never evidence of adequacy', () => {
  for (const tank of ['10g', '20l', '29g', '55g']) {
    const list = addProduct(addProduct([], AQUANEAT_MIDDLE), AQUANEAT_MIDDLE);
    const assessment = assess(list, getTankById(tank).gallons);
    assert.equal(assessment.sponge.count, 2, tank);
    assert.equal(assessment.sponge.verifiedCount, 0);
    assert.equal(assessment.sponge.unratedCount, 2);
    assert.equal(assessment.biologicalGph, 0);
    assert.equal(assessment.level, 'not-evaluated');
    assert.equal(assessment.adequateBy, null);
    list.forEach((item) => assert.equal(items.spongeChipBadge(item), 'Rating needed'));
    const five = assess(Array.from({ length: 5 }).reduce((acc) => addProduct(acc, AQUANEAT_MIDDLE), []), getTankById(tank).gallons);
    assert.equal(five.level, 'not-evaluated', `${tank}: five unrated`);
  }
  // Another independent filter can still pass.
  const withPowered = assess(withIds([...addProduct(addProduct([], AQUANEAT_MIDDLE), AQUANEAT_MIDDLE), ...addProduct([], AC70)]), 55);
  assert.equal(withPowered.level, 'adequate');
  assert.equal(withPowered.adequateBy, 'powered');
});

test('mixed same-product scenarios keep the phase B independent-path rules', () => {
  const hob = () => addProduct([], TETRA)[0];
  const cases = [
    // [label, list, gallons, level, adequateBy, bioGph, circulationGph]
    ['2 × powered HOB', [hob(), hob()], 125, 'adequate', 'powered', 430, 0],
    ['2 × verified sponge (75: 40 + 40 ≥ 75)', [...addProduct(addProduct([], HYGGER_S), HYGGER_S)], 75, 'likely-multi-sponge', null, 0, 0],
    ['2 × verified sponge (125)', [...addProduct(addProduct([], HYGGER_S), HYGGER_S)], 125, 'below-rating', null, 0, 0],
    ['HOB + duplicate HOB + sponge (55)', [hob(), hob(), addProduct([], HYGGER_S)[0]], 55, 'adequate', 'powered', 430, 0],
    ['2 × weak custom HOB + sponge below rating', [customPowered('HOB', 40), customPowered('HOB', 40), addProduct([], HYGGER_S)[0]], 75, 'review', null, 80, 0],
    ['2 × weak HOB + 2 × verified sponge (likely-multi wins over review)', [customPowered('HOB', 40), customPowered('HOB', 40), ...addProduct(addProduct([], HYGGER_S), HYGGER_S)], 75, 'likely-multi-sponge', null, 80, 0],
    ['powerhead ×2 + verified sponge (29)', [customPowered('POWERHEAD', 300), customPowered('POWERHEAD', 300), addProduct([], HYGGER_S)[0]], 29, 'adequate', 'sponge', 0, 600],
    ['2 × unrated sponge + powered filter', [...addProduct(addProduct([], AQUANEAT_MIDDLE), AQUANEAT_MIDDLE), hob()], 75, 'adequate', 'powered', 215, 0],
    ['2 × unrated sponge + weak powered', [...addProduct(addProduct([], AQUANEAT_MIDDLE), AQUANEAT_MIDDLE), customPowered('HOB', 50)], 75, 'review', null, 50, 0],
  ];
  for (const [label, list, gallons, level, adequateBy, bio, circ] of cases) {
    const assessment = assess(withIds(list), gallons);
    assert.equal(assessment.level, level, label);
    assert.equal(assessment.adequateBy, adequateBy, label);
    assert.equal(assessment.biologicalGph, bio, label);
    assert.equal(assessment.circulationGph, circ, label);
    assert.equal(assessment.capacityAdjustment, 0, label);
  }
});

test('identical custom filters coexist: two custom HOBs, two custom sponges', () => {
  const list = withIds([customPowered('HOB', 150), customPowered('HOB', 150), customSponge(20), customSponge(20)]);
  assert.equal(new Set(list.map((item) => item.instanceId)).size, 4);
  const entries = saved.serializeFilters(list.map(toApp));
  assert.equal(entries.length, 4);
  assert.deepEqual(entries.map((e) => [e.source, e.type, e.gph ?? null, e.manufacturerMaxGallons ?? null]), [
    ['custom', 'HOB', 150, null], ['custom', 'HOB', 150, null], ['custom', 'SPONGE', null, 20], ['custom', 'SPONGE', null, 20],
  ]);
  const assessment = assess(list, 29);
  assert.equal(assessment.biologicalGph, 300);
  assert.equal(assessment.sponge.count, 2);
  const afterRemove = instances.removeInstance(list, list[2].instanceId);
  assert.equal(afterRemove.length, 3);
  assert.equal(afterRemove.filter((item) => item.type === 'SPONGE').length, 1);
});

test('Add rating on one of two unrated legacy custom sponges changes only that instance', () => {
  const list = withIds([legacySponge(120), legacySponge(120)]);
  assert.ok(list.every((item) => items.needsCustomRating(item)));
  const [first, second] = list;
  const rated = items.buildCustomSpongeItem({ id: second.id, ratedGallons: 40 });
  const next = instances.replaceInstance(list, second.instanceId, rated);
  assert.equal(next[0], first, 'the other sponge is untouched');
  assert.equal(items.needsCustomRating(next[0]), true);
  assert.equal(items.spongeChipBadge(next[0]), 'Rating needed');
  assert.equal(next[1].instanceId, second.instanceId, 'same instance');
  assert.equal(items.spongeChipBadge(next[1]), 'Rated up to 40 gal');
  const entries = saved.serializeFilters(next.map(toApp));
  assert.deepEqual(entries.map((e) => [e.instanceId, e.ratingStatus, e.manufacturerMaxGallons ?? null, e.legacyGph ?? null]), [
    [first.instanceId, 'needed', null, 120], [second.instanceId, 'verified', 40, null],
  ]);
  // Even when both legacy sponges share one damaged manual id, targeting by instanceId stays exact.
  const shared = withIds([{ ...legacySponge(120), id: 'manual-same' }, { ...legacySponge(120), id: 'manual-same' }]);
  const one = instances.replaceInstance(shared, shared[0].instanceId, items.buildCustomSpongeItem({ id: 'manual-same', ratedGallons: 30 }));
  assert.deepEqual(one.map((item) => items.spongeChipBadge(item)), ['Rated up to 30 gal', 'Rating needed']);
});

test('compute pipeline never de-duplicates: every physical filter reaches the engine', () => {
  const list = withIds([
    ...addProduct(addProduct([], AC70), AC70),
    ...addProduct(addProduct([], HYGGER_S), HYGGER_S),
    customPowered('POWERHEAD', 200), customPowered('POWERHEAD', 200),
  ]);
  const app = list.map(toApp);
  const sanitized = compute.sanitizeFilterList(app);
  assert.equal(sanitized.length, 6);
  const normalized = math.normalizeFilters(app);
  assert.equal(normalized.length, 6);
  assert.deepEqual(normalized.map((e) => e.instanceId), list.map((item) => item.instanceId));
  const computed = run('75g', normalized);
  assert.equal(computed.filtering.biologicalGph, 600);
  assert.equal(computed.filtering.circulationGph, 400);
  assert.equal(computed.filtering.assessment.sponge.count, 2);
});

test('undergravel plates stay one set per tank: a repeated saved copy is not restored', () => {
  const storage = v2Storage([
    { instanceId: 'f-ugf1', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'flow', gph: 150 },
    { instanceId: 'f-ugf2', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'flow', gph: 150 },
  ]);
  const result = pageLoad(storage, { tank: '29g' });
  assert.deepEqual(result.restored.map((item) => item.instanceId), ['f-ugf1']);
  assert.equal(result.computed.filtering.biologicalGph, 150);
  // Catalog unavailable: the stored-GPH fallback applies the same rule.
  const offline = pageLoad(v2Storage([
    { instanceId: 'f-ugf1', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'flow', gph: 150 },
    { instanceId: 'f-ugf2', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'flow', gph: 150 },
  ]), { tank: '29g', catalogById: OFFLINE });
  assert.deepEqual(offline.restored.map((item) => item.instanceId), ['f-ugf1']);
  assert.equal(offline.computed.filtering.biologicalGph, 150);
});

test('STOCKING LOAD INVARIANT: 0 / 1 / 2 / 5 identical filters never change Stocking Load', () => {
  const stocks = [[], STOCK, [['angelfish', 2], ['neon', 12]], [['pea_puffer', 3], ['amano', 4]]];
  const builders = {
    powered: () => addProduct([], AC70)[0],
    tetra: () => addProduct([], TETRA)[0],
    sponge: () => addProduct([], HYGGER_S)[0],
    unrated: () => addProduct([], AQUANEAT_MIDDLE)[0],
    customHob: () => customPowered('HOB', 150),
    customSponge: () => customSponge(20),
    powerhead: () => customPowered('POWERHEAD', 400),
  };
  for (const tank of ['10g', '29g', '55g', '75g', '125g']) {
    for (const stock of stocks) {
      const baseline = load(computeFor(tank, [], { stock }));
      for (const [name, build] of Object.entries(builders)) {
        for (const count of [1, 2, 5]) {
          const list = withIds(Array.from({ length: count }, build));
          assert.equal(load(computeFor(tank, list, { stock })), baseline, `${tank} ${JSON.stringify(stock)} ${count} × ${name}`);
        }
      }
    }
  }
});
