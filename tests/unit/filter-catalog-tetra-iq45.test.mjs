// Tetra Whisper IQ 45 flow correction (_internal/reports/stocking-advisor-tetra-iq45-flow-fix-2026-09.md).
// assets/data/gearCatalog.json now stores Tetra's published 215 GPH (was 260). The GPH is the only
// catalog value that reaches filtration scoring; the tank range (40–75) is deliberately unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
const { MIN_BIOLOGICAL_TURNOVER, FILTRATION_LEVELS } = await import('../../js/stocking-advisor/filtration/math.js');
const { getTankById, TANK_SIZES } = await import('../../js/utils.js');

await compute.initializeCompute();
const CATALOG = await getGearData({ forceRefresh: true });

const ID = 'tetra-whisper-iq-45';
const GPH = 215;
const raw = RAW.find((item) => item.id === ID);
const loaded = CATALOG.find((item) => item.id === ID);

function runWith(tankId, filters) {
  const state = compute.createDefaultState();
  const tank = getTankById(tankId);
  Object.assign(state, {
    tank: { ...tank },
    gallons: tank.gallons,
    selectedTankId: tank.id,
    stock: [{ id: 'neon', qty: 10 }, { id: 'cory_bronze', qty: 6 }],
    filters,
  });
  return compute.buildComputedState(state);
}
// Same shape the filtration controller hands the calculator for a catalog product.
const asFilter = (product) => [{ id: product.id, source: 'product', type: product.type, rated_gph: product.gphRated, gph: product.gphRated }];

test('tetra-whisper-iq-45 stores the manufacturer 215 GPH, type HOB, range unchanged', () => {
  assert.ok(raw, 'record is in the runtime catalog');
  assert.equal(raw.type, 'HOB');
  assert.equal(raw.gphRated, GPH);
  assert.notEqual(raw.gphRated, 260);
  // Range left as-is pending a direct manufacturer min/max (see report).
  assert.equal(raw.minGallons, 40);
  assert.equal(raw.maxGallons, 75);
  assert.equal(RAW.filter((item) => /whisper\s*iq/i.test(item.name)).length, 1);
  assert.ok(loaded, 'record survives the loader');
  assert.equal(loaded.type, 'HOB');
  assert.equal(loaded.gphRated, GPH);
});

test('no other runtime catalog record changed', () => {
  const others = RAW.filter((item) => item.id !== ID);
  assert.equal(RAW.length, 41);
  // Fingerprint of every other record as of main @ 634f4f2. An intentional catalog edit elsewhere
  // must update this value in the same change.
  const digest = createHash('sha256').update(JSON.stringify(others)).digest('hex');
  assert.equal(digest, 'a13a41ebfad28b795fadfce3efda676f17d802c6f1c1e707a597006357fc14d1');
  // Batch 1 values stay pinned.
  const gph = (id) => RAW.find((item) => item.id === id).gphRated;
  assert.equal(gph('aquaclear-70'), 300);
  assert.equal(gph('aquaclear-70-1'), 300);
  assert.equal(gph('fluval-307'), 303);
  assert.equal(gph('eheim-2213'), 116);
});

test('picker eligibility is unchanged: offered for 40 Breeder, 55 and 75 gal only', () => {
  for (const tank of TANK_SIZES) {
    const offered = filterGearByTank(CATALOG, tank.gallons).some((item) => item.id === ID);
    assert.equal(offered, ['40b', '55g', '75g'].includes(tank.id), tank.id);
  }
});

test('selecting the product sends exactly 215 GPH into Phase 2C and turnover is 215 / gallons', () => {
  for (const tank of TANK_SIZES) {
    const { filtering } = runWith(tank.id, asFilter(loaded));
    assert.equal(filtering.gphTotal, GPH, `${tank.id} gphTotal`);
    assert.equal(filtering.assessment.biologicalGph, GPH, `${tank.id} biologicalGph`);
    assert.equal(filtering.turnover, GPH / tank.gallons, `${tank.id} turnover`);
  }
});

test('filtration status on the presets that offer the product stays adequate', () => {
  for (const tankId of ['40b', '55g', '75g']) {
    const { filtering } = runWith(tankId, asFilter(loaded));
    assert.ok(filtering.turnover >= MIN_BIOLOGICAL_TURNOVER, tankId);
    assert.equal(filtering.assessment.level, FILTRATION_LEVELS.ADEQUATE, tankId);
  }
  // 75 gal: 215 / 75 ≈ 2.87× (was 3.47×).
  assert.ok(Math.abs(runWith('75g', asFilter(loaded)).filtering.turnover - 2.8667) < 1e-3);
});

test('Stocking Load is identical at 215 and 260 GPH; only filtration output differs', () => {
  const old = { ...loaded, gphRated: 260 };
  for (const tank of TANK_SIZES) {
    const now = runWith(tank.id, asFilter(loaded)).bioload;
    const before = runWith(tank.id, asFilter(old)).bioload;
    // flowAdjustment only echoes the entered GPH; every load/capacity/percent field must match.
    const { flowAdjustment: _a, ...nowLoad } = now;
    const { flowAdjustment: _b, ...beforeLoad } = before;
    assert.deepEqual(nowLoad, beforeLoad, tank.id);
    // Filtration never lowers the load: same as with no filter at all.
    const { flowAdjustment: _c, ...noFilterLoad } = runWith(tank.id, []).bioload;
    assert.equal(nowLoad.currentPercent, noFilterLoad.currentPercent, `${tank.id} no filter bonus`);
    assert.equal(nowLoad.proposedPercent, noFilterLoad.proposedPercent, `${tank.id} no filter bonus`);
    assert.equal(nowLoad.capacity, noFilterLoad.capacity, `${tank.id} capacity`);
  }
});

test('species warnings are unchanged on the presets that offer the product', () => {
  const old = { ...loaded, gphRated: 260 };
  for (const tankId of ['40b', '55g', '75g']) {
    const ids = (result) => result.status.warnings.map((warning) => warning.id);
    assert.deepEqual(ids(runWith(tankId, asFilter(loaded))), ids(runWith(tankId, asFilter(old))), tankId);
  }
});
