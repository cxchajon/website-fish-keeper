// Filtration model contract (data/stocking-advisor/FILTRATION_MODEL.md). Filtration is reported as its
// own adequacy check and never changes the livestock bioload percentage. Relative/invariant checks only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\//, '');
  return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(readFileSync(ROOT + path, 'utf8')) };
};

const compute = await import('../../js/logic/compute.js');
const math = await import('../../js/stocking-advisor/filtration/math.js');
const { getTankById, canonicalizeFilterType } = await import('../../js/utils.js');

await compute.initializeCompute();

function run(tankId, stock, filters = [], { candidate = null, water = null } = {}) {
  const state = compute.createDefaultState();
  const tank = getTankById(tankId);
  Object.assign(state, {
    tank: { ...tank },
    gallons: tank.gallons,
    selectedTankId: tank.id,
    stock: stock.map(([id, qty]) => ({ id, qty })),
    candidate: candidate ? { id: candidate[0], qty: candidate[1] } : null,
    filters,
  });
  if (water) state.water = { ...state.water, ...water };
  return compute.buildComputedState(state);
}

const f = (type, gph) => ({ type, rated_gph: gph });
const ids = (computed) => computed.status.warnings.map((warning) => warning.id);
const filtrationIds = (computed) => ids(computed).filter((id) => id.startsWith('filtration.'));
const nonFiltrationWarnings = (computed) => computed.status.warnings
  .filter((warning) => !warning.id.startsWith('filtration.'))
  .map((warning) => `${warning.severity}:${warning.id}`);

const BASE_STOCK = [['neon', 10], ['cory_bronze', 6], ['betta_male', 1]];
const CASES = {
  A: [],
  B: [f('Canister', 1)],
  C: [f('HOB', 150)],
  D: [f('Powerhead', 150)],
  E: [f('Sponge', 150)],
  F: [f('Canister', 300)],
  G: [f('HOB', 150), f('Powerhead', 150)],
  H: [f('HOB', 150), f('HOB', 150)],
};

function assertFinite(computed, label) {
  const values = [
    computed.bioload.currentPercent, computed.bioload.proposedPercent, computed.bioload.effectiveCapacity,
    computed.filtering.turnover, computed.filtering.totalTurnover, computed.filtering.gphTotal,
    computed.filtering.biologicalGph, computed.filtering.circulationGph,
  ];
  for (const value of values) {
    assert.ok(Number.isFinite(value) && value >= 0, `${label}: ${value}`);
  }
}

test('raw livestock bioload is identical for every filtration choice (cases A–H)', () => {
  const base = run('29g', BASE_STOCK, CASES.A).bioload;
  for (const [name, filters] of Object.entries(CASES)) {
    const computed = run('29g', BASE_STOCK, filters);
    assert.equal(computed.bioload.proposed, base.proposed, name);
    assert.equal(computed.bioload.proposedPercent, base.proposedPercent, name);
    assert.equal(computed.bioload.effectiveCapacity, base.effectiveCapacity, name);
    assert.equal(computed.bioload.text, base.text, name);
    assertFinite(computed, name);
  }
});

test('cases A–H: filtration outcome and status as specified', () => {
  const expected = {
    A: ['filtration.none'], B: ['filtration.very_low'], C: [], D: ['filtration.circulation_only'],
    E: [], F: [], G: [], H: [],
  };
  const noFilter = run('29g', BASE_STOCK, CASES.A);
  for (const [name, filters] of Object.entries(CASES)) {
    const computed = run('29g', BASE_STOCK, filters);
    assert.deepEqual(filtrationIds(computed), expected[name], name);
    // Only the Phase 2B tank-length warning remains besides filtration.
    assert.deepEqual(nonFiltrationWarnings(computed), nonFiltrationWarnings(noFilter), name);
  }
  assert.equal(noFilter.status.warnings.find((w) => w.id === 'filtration.none').severity, 'warn');
  assert.equal(run('29g', BASE_STOCK, CASES.G).filtering.turnover, run('29g', BASE_STOCK, CASES.C).filtering.turnover);
});

test('no capacity bonus remains in the filtration module', () => {
  for (const name of ['RBC_TABLE', 'MAX_CAPACITY_BONUS', 'effectiveCapacity', 'rbcForFilter', 'describeFilterCapacity']) {
    assert.equal(name in math, false, name);
  }
  assert.equal(math.assessFiltration({ filters: [f('Canister', 1500)], gallons: 10 }).capacityAdjustment, 0);
});

test('a powerhead is circulation only and adds no biological filtration', () => {
  assert.equal(canonicalizeFilterType('Powerhead'), 'POWERHEAD');
  assert.equal(math.filterRole(f('Powerhead', 200)), math.FILTER_ROLES.CIRCULATION);
  const d = run('20h', [['neon', 10]], [f('Powerhead', 200)]);
  assert.equal(d.filtering.level, math.FILTRATION_LEVELS.CIRCULATION_ONLY);
  assert.equal(d.filtering.biologicalGph, 0);
  assert.equal(d.filtering.turnover, 0);
  assert.ok(ids(d).includes('filtration.circulation_only'));
  assert.equal(d.status.warnings.find((w) => w.id === 'filtration.circulation_only').severity, 'danger');
  assert.equal(d.bioload.proposedPercent, run('20h', [['neon', 10]]).bioload.proposedPercent);
});

test('multiple powerheads do not stack into filtration', () => {
  const computed = run('29g', BASE_STOCK, [f('Powerhead', 400), f('Powerhead', 400), f('Powerhead', 400)]);
  assert.equal(computed.filtering.level, math.FILTRATION_LEVELS.CIRCULATION_ONLY);
  assert.equal(computed.filtering.biologicalGph, 0);
  assert.equal(computed.filtering.circulationGph, 1200);
  assert.equal(computed.bioload.proposedPercent, run('29g', BASE_STOCK).bioload.proposedPercent);
});

test('a 1 GPH canister is flagged as effectively unfiltered, unlike a properly flowing canister', () => {
  const trickle = run('20h', [['neon', 10]], [f('Canister', 1)]);
  const flowing = run('20h', [['neon', 10]], [f('Canister', 150)]);
  assert.equal(trickle.filtering.level, math.FILTRATION_LEVELS.VERY_LOW);
  assert.equal(flowing.filtering.level, math.FILTRATION_LEVELS.ADEQUATE);
  assert.ok(filtrationIds(trickle).includes('filtration.very_low'));
  assert.deepEqual(filtrationIds(flowing), []);
  assert.equal(trickle.status.severity, 'bad');
  assert.match(trickle.status.warnings.find((w) => w.id === 'filtration.very_low').message, /less than 0\.1×/);
  // Neither changes the livestock figure.
  assert.equal(trickle.bioload.proposedPercent, flowing.bioload.proposedPercent);
});

test('no filter is reported as absent, with valid numbers', () => {
  const computed = run('20h', [['neon', 10]]);
  assert.equal(computed.filtering.level, math.FILTRATION_LEVELS.NONE);
  assert.ok(ids(computed).includes('filtration.none'));
  assert.equal(computed.filtering.turnover, 0);
  assertFinite(computed, 'no filter');
  // An empty plan is not warned about.
  assert.deepEqual(filtrationIds(run('20h', [])), []);
});

test('a 100 GPH HOB on 20 gallons behaves differently from a 1 GPH canister', () => {
  const hob = run('20h', [['cory_bronze', 6]], [f('HOB', 100)]);
  assert.equal(hob.filtering.level, math.FILTRATION_LEVELS.ADEQUATE);
  assert.ok(Math.abs(hob.filtering.turnover - 5) < 1e-9, 'turnover uses the nominal 20 gallons');
  assert.notEqual(hob.filtering.level, run('20h', [['cory_bronze', 6]], [f('Canister', 1)]).filtering.level);
});

test('a sponge filter counts as a biological filter at its entered flow', () => {
  const sponge = math.assessFiltration({ filters: [f('Sponge', 200)], gallons: 20 });
  assert.equal(sponge.level, math.FILTRATION_LEVELS.ADEQUATE);
  assert.equal(sponge.hasSponge, true);
  assert.equal(sponge.biologicalGph, 200);
});

test('the biological floor is 2× through media, whatever the species flow tags', () => {
  // One of each flow tag: low (neon), moderate (bronze cory), high (tiger barb).
  for (const stock of [[['neon', 10]], [['cory_bronze', 6]], [['tiger_barb', 6]]]) {
    const below = run('29g', stock, [f('HOB', 57)]); // 1.97×
    const at = run('29g', stock, [f('HOB', 58)]); // 2.0×
    const label = stock[0][0];
    assert.equal(below.entries.length, 1, `${label} is evaluated`);
    assert.equal(below.filtering.level, math.FILTRATION_LEVELS.VERY_LOW, label);
    assert.ok(filtrationIds(below).includes('filtration.very_low'), label);
    assert.equal(at.filtering.level, math.FILTRATION_LEVELS.ADEQUATE, label);
    assert.deepEqual(filtrationIds(at), [], label);
  }
  assert.equal('LOW' in math.FILTRATION_LEVELS, false, 'no species-target level remains');
});

test('a high-flow species does not need its circulation preference from the filter itself', () => {
  const stock = [['tiger_barb', 6]]; // tagged high-flow (8–12× circulation band)
  const filterOnly = run('29g', stock, [f('HOB', 120)]); // 4.1× through media
  const withPowerhead = run('29g', stock, [f('HOB', 120), f('Powerhead', 300)]);
  assert.equal(filterOnly.entries.length, 1, 'species is evaluated');
  assert.equal(filterOnly.filtering.band.key, 'H', 'species is tagged high-flow');
  for (const computed of [filterOnly, withPowerhead]) {
    assert.equal(computed.filtering.level, math.FILTRATION_LEVELS.ADEQUATE);
    assert.deepEqual(filtrationIds(computed), []);
    assert.ok(Math.abs(computed.filtering.turnover - 120 / 29) < 1e-9, 'filter turnover counts the HOB only');
  }
  assert.ok(withPowerhead.filtering.totalTurnover > filterOnly.filtering.totalTurnover);
  assert.equal(withPowerhead.status.severity, filterOnly.status.severity);
  assert.equal(withPowerhead.bioload.proposedPercent, filterOnly.bioload.proposedPercent);
});

test('multiple real filters add flow through media; duplicates cannot inflate the bioload figure', () => {
  const one = run('29g', BASE_STOCK, [f('HOB', 150)]);
  const two = run('29g', BASE_STOCK, [f('HOB', 150), f('HOB', 150)]);
  const mixed = run('29g', BASE_STOCK, [f('Canister', 150), f('Sponge', 150)]);
  assert.ok(Math.abs(two.filtering.turnover - 2 * one.filtering.turnover) < 1e-9);
  assert.equal(mixed.filtering.biologicalGph, 300);
  const many = run('29g', BASE_STOCK, Array.from({ length: 20 }, () => f('Canister', 1500)));
  for (const computed of [one, two, mixed, many]) {
    assert.equal(computed.bioload.proposedPercent, one.bioload.proposedPercent);
  }
});

test('high total turnover never changes the status or the load, even with gentle-flow species', () => {
  const stock = [['betta_male', 1]];
  const normal = run('10g', stock, [f('HOB', 50)]); // 5×
  for (const filters of [[f('Canister', 500)], [f('Canister', 100), f('Powerhead', 400)]]) { // 50×
    const high = run('10g', stock, filters);
    assert.deepEqual(filtrationIds(high), []);
    assert.equal(high.status.severity, normal.status.severity);
    assert.equal(high.bioload.proposedPercent, normal.bioload.proposedPercent);
  }
});

test('extreme and invalid flow values stay finite and cannot create capacity', () => {
  const values = [0, 1, 10, 145, 580, 1450, -50, NaN, Infinity, -Infinity, 1e12, '', null, undefined, 'abc', '150gph'];
  const reference = run('29g', BASE_STOCK).bioload.proposedPercent;
  for (const value of values) {
    for (const type of ['Canister', 'HOB', 'Sponge', 'Powerhead', 'Internal', 'UGF', 'mystery']) {
      const computed = run('29g', BASE_STOCK, [{ type, rated_gph: value }]);
      assertFinite(computed, `${type} ${String(value)}`);
      assert.equal(computed.bioload.proposedPercent, reference, `${type} ${String(value)}`);
      assert.ok(computed.filtering.gphTotal <= math.MAX_DEVICE_GPH, `${type} ${String(value)}`);
    }
  }
  const assessment = math.assessFiltration({ filters: [f('HOB', -5), f('HOB', 0), f('HOB', NaN)], gallons: 29 });
  assert.equal(assessment.level, math.FILTRATION_LEVELS.NONE);
  assert.equal(math.turnoverX(100, 0), 0);
  assert.equal(math.turnoverX(-5, 29), 0);
  assert.equal(math.computePercent(10, 0), 0);
});

test('filtration can never clear or soften a Phase 2B welfare or compatibility result', () => {
  const scenarios = [
    ['20h', [['freshwater_angelfish', 6]]], // minimum volume and length
    ['5g', [['bristlenose_pleco', 6]]],
    ['5g', [['pea_puffer', 6]]], // quantity-space rule
    ['75g', [['freshwater_angelfish', 2], ['neon', 10]]], // predation
    ['20l', [['freshwater_angelfish', 2], ['neon', 10], ['tiger_barb', 3], ['bristlenose_pleco', 2]]], // aggression
    ['29g', [['neon', 10], ['kribensis', 2]]], // territory crowding
    ['29g', [['molly', 6]]], // length
  ];
  const filterSets = [[], [f('Canister', 1500), f('Canister', 1500)], [f('HOB', 300)], [f('Sponge', 200)], [f('Powerhead', 800)]];
  for (const [tank, stock] of scenarios) {
    const reference = run(tank, stock, [f('Canister', 1500)]);
    for (const filters of filterSets) {
      const computed = run(tank, stock, filters);
      const label = `${tank} ${JSON.stringify(stock)} ${JSON.stringify(filters)}`;
      assert.deepEqual(nonFiltrationWarnings(computed), nonFiltrationWarnings(reference), label);
      assert.equal(computed.bioload.severity, reference.bioload.severity, label);
      assert.equal(computed.bioload.text, reference.bioload.text, label);
      if (reference.status.severity === 'bad') assert.equal(computed.status.severity, 'bad', label);
    }
  }
  // Water-parameter incompatibility and candidate-time group/aggression rules are unaffected too.
  const water = { pH: 9.0, temperature: 90 };
  for (const filters of filterSets) {
    const computed = run('29g', [['neon', 10], ['neocaridina', 10]], filters, { water });
    assert.equal(computed.status.severity, 'bad');
    assert.ok(computed.conditions.conditions.some((item) => item.severity === 'bad'));
    const candidate = run('29g', [['betta_male', 1]], filters, { candidate: ['betta_male', 1] });
    const noFilterCandidate = run('29g', [['betta_male', 1]], [], { candidate: ['betta_male', 1] });
    assert.deepEqual(candidate.chips.filter((chip) => chip.tone === 'bad' && !/filter/i.test(chip.text)),
      noFilterCandidate.chips.filter((chip) => chip.tone === 'bad' && !/filter/i.test(chip.text)));
  }
});
