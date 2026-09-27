// Filter catalog corrections, batch 1 (_internal/reports/stocking-advisor-filter-catalog-fix-batch-1-2026-09.md).
// AquaClear AC70, Fluval 307 and EHEIM Classic 2213 carry the manufacturer tank range in
// assets/data/gearCatalog.json. The range only decides which products the picker offers for a tank;
// the stored GPH is the only catalog value that reaches filtration scoring, and it is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\//, '').split('?')[0];
  return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(readFileSync(ROOT + path, 'utf8')) };
};

const RAW = JSON.parse(readFileSync(ROOT + 'assets/data/gearCatalog.json', 'utf8'));
const { getGearData, filterGearByTank } = await import('../../js/gear-data.js');
const compute = await import('../../js/logic/compute.js');
const { getTankById, TANK_SIZES } = await import('../../js/utils.js');

await compute.initializeCompute();
const CATALOG = await getGearData({ forceRefresh: true });

const EXPECTED = {
  'aquaclear-70': { gph: 300, min: 40, max: 70 },
  'aquaclear-70-1': { gph: 300, min: 40, max: 70 },
  'fluval-307': { gph: 303, min: 40, max: 70 },
  'eheim-2213': { gph: 116, min: 21, max: 66 },
};
const raw = (id) => RAW.find((item) => item.id === id);
const loaded = (id) => CATALOG.find((item) => item.id === id);
const offeredFor = (tankId) => filterGearByTank(CATALOG, getTankById(tankId).gallons).map((item) => item.id);

test('corrected records store the manufacturer range and the unchanged GPH', () => {
  for (const [id, spec] of Object.entries(EXPECTED)) {
    const record = raw(id);
    assert.ok(record, `${id} is in the runtime catalog`);
    assert.equal(record.gphRated, spec.gph, `${id} GPH`);
    assert.equal(record.minGallons, spec.min, `${id} minGallons`);
    assert.equal(record.maxGallons, spec.max, `${id} maxGallons`);
    const item = loaded(id);
    assert.ok(item, `${id} survives the loader`);
    assert.equal(item.gphRated, spec.gph, `${id} loaded GPH`);
    assert.equal(item.minGallons, spec.min, `${id} loaded minGallons`);
    assert.equal(item.maxGallons, spec.max, `${id} loaded maxGallons`);
  }
});

test('both AquaClear AC70 records keep their ids and carry identical specifications', () => {
  const ac70 = RAW.filter((item) => /aquaclear\s*(ac)?\s*70\b/i.test(item.name));
  assert.deepEqual(ac70.map((item) => item.id).sort(), ['aquaclear-70', 'aquaclear-70-1']);
  const specs = ac70.map(({ type, gphRated, minGallons, maxGallons }) => ({ type, gphRated, minGallons, maxGallons }));
  assert.deepEqual(specs[0], specs[1]);
  // Saved filters and gear-page links resolve by id against the full catalog.
  assert.ok(loaded('aquaclear-70'));
  assert.ok(loaded('aquaclear-70-1'));
});

test('only one record each for Fluval 307 and EHEIM 2213', () => {
  assert.equal(RAW.filter((item) => /fluval\s*307/i.test(item.name)).length, 1);
  assert.equal(RAW.filter((item) => /2213|classic\s*250/i.test(item.name)).length, 1);
});

test('picker: EHEIM 2213 is offered for mid-size tanks only', () => {
  for (const tankId of ['29g', '40b', '55g']) {
    assert.ok(offeredFor(tankId).includes('eheim-2213'), `EHEIM offered for ${tankId}`);
  }
  for (const tankId of ['5g', '10g', '15g', '20h', '20l', '75g', '125g']) {
    assert.ok(!offeredFor(tankId).includes('eheim-2213'), `EHEIM not offered for ${tankId}`);
  }
});

test('picker: AquaClear AC70 (both ids) and Fluval 307 follow the 40–70 gal range', () => {
  for (const id of ['aquaclear-70', 'aquaclear-70-1', 'fluval-307']) {
    for (const tank of TANK_SIZES) {
      const expected = tank.gallons >= 40 && tank.gallons <= 70;
      assert.equal(offeredFor(tank.id).includes(id), expected, `${id} for ${tank.id}`);
    }
  }
  // Direct edge checks, independent of the preset list.
  for (const id of ['aquaclear-70', 'fluval-307']) {
    const item = [loaded(id)];
    assert.equal(filterGearByTank(item, 39).length, 0);
    assert.equal(filterGearByTank(item, 40).length, 1);
    assert.equal(filterGearByTank(item, 70).length, 1);
    assert.equal(filterGearByTank(item, 71).length, 0);
  }
});

function runWithProduct(tankId, product) {
  const state = compute.createDefaultState();
  const tank = getTankById(tankId);
  Object.assign(state, {
    tank: { ...tank },
    gallons: tank.gallons,
    selectedTankId: tank.id,
    stock: [{ id: 'neon', qty: 10 }, { id: 'cory_bronze', qty: 6 }],
    // Same shape the filtration controller hands the calculator for a catalog product.
    filters: [{ id: product.id, source: 'product', type: product.type, rated_gph: product.gphRated, gph: product.gphRated }],
  });
  return compute.buildComputedState(state).filtering;
}

test('selecting a corrected product sends the unchanged GPH into the Phase 2C calculation', () => {
  for (const [id, spec] of Object.entries(EXPECTED)) {
    for (const tankId of ['29g', '40b', '55g', '75g']) {
      const filtering = runWithProduct(tankId, loaded(id));
      const gallons = getTankById(tankId).gallons;
      assert.equal(filtering.gphTotal, spec.gph, `${id} ${tankId} gphTotal`);
      assert.equal(filtering.assessment.biologicalGph, spec.gph, `${id} ${tankId} biologicalGph`);
      assert.equal(filtering.turnover, spec.gph / gallons, `${id} ${tankId} turnover`);
    }
  }
});

test('the manufacturer range never enters scoring', () => {
  const base = loaded('eheim-2213');
  const wide = { ...base, minGallons: 0, maxGallons: 20 };
  for (const tankId of ['10g', '29g', '55g', '75g']) {
    assert.deepEqual(runWithProduct(tankId, wide), runWithProduct(tankId, base), tankId);
  }
});
