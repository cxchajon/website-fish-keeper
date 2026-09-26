// Water parameters contract (Phase 2D): the Stocking Advisor never presents an assumed value as the
// user's water. temperature / pH / GH / KH / flow / blackwater are unknown until the user enters them,
// an unknown parameter is not evaluated (no pass, no fail), and species-to-species range conflicts are
// still reported from species data alone.
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
const legacy = await import('../../js/logic/compute.legacy.js');
const { compatScore } = await import('../../js/stocking-advisor/logic/compat.v2.js');
const { evaluateInvertSafety, evaluateFlow } = await import('../../js/logic/conflicts.js');
const { getTankById } = await import('../../js/utils.js');

await compute.initializeCompute();

const DROPDOWN = compute.getSpecies();
const MEASURED_KEYS = ['temperature', 'pH', 'gH', 'kH'];
const WATER_TEXT = /temperature|\bpH\b|\bgH\b|\bkH\b|hardness|flow|tannin|blackwater|shell/i;

function run(tankId, stock, { water = {}, candidate = null, filters = [] } = {}) {
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
  state.water = { ...state.water, ...water };
  return compute.buildComputedState(state);
}

const condition = (computed, key) => computed.conditions.conditions.find((item) => item.key === key);
const waterWarnings = (computed) => computed.status.warnings.filter((w) => String(w.id).startsWith('water.'));
const waterChips = (computed) => computed.chips.filter((chip) => WATER_TEXT.test(chip.text));

function assertNoWaterClaims(computed, label) {
  for (const key of MEASURED_KEYS) {
    const item = condition(computed, key);
    if (!item) continue;
    assert.ok(!['within', 'outside'].includes(item.status), `${label}: ${key} claims ${item.status}`);
    assert.equal(item.measured, false, `${label}: ${key} marked measured`);
  }
  assert.deepEqual(waterWarnings(computed), [], `${label}: water warnings`);
}

test('the default state holds no water measurements', () => {
  const { water } = compute.createDefaultState();
  for (const key of [...MEASURED_KEYS, 'flow', 'blackwater']) {
    assert.equal(water[key], null, `default ${key}`);
  }
  assert.equal(water.salinity, 'fresh', 'freshwater is the tool scope, not a measurement');
  const sanitized = legacy.sanitizeWater(water);
  for (const key of [...MEASURED_KEYS, 'flow', 'blackwater']) {
    assert.equal(sanitized[key], null, `sanitized ${key}`);
    assert.equal(sanitized.entered[key], false, `${key} entered flag`);
  }
});

test('sanitizeWater keeps entered values (including 0 dKH) and drops blanks and nonsense', () => {
  const water = legacy.sanitizeWater({ temperature: '76', pH: 6.8, gH: 0, kH: 0, flow: 'high', blackwater: false });
  assert.deepEqual(
    [water.temperature, water.pH, water.gH, water.kH, water.flow, water.blackwater],
    [76, 6.8, 0, 0, 'high', false],
  );
  assert.ok(MEASURED_KEYS.every((key) => water.entered[key]));
  const blanks = legacy.sanitizeWater({ temperature: '', pH: 'abc', gH: -3, kH: 400, flow: 'fast', blackwater: 'yes' });
  for (const key of [...MEASURED_KEYS, 'flow', 'blackwater']) {
    assert.equal(blanks[key], null, `${key} should be unknown`);
  }
});

test('A: 20 gallon, Neon Tetras, no water entered — no water claims, stocking still works', () => {
  const computed = run('20h', [['neon', 8]]);
  assertNoWaterClaims(computed, 'neon');
  assert.equal(condition(computed, 'pH').actual, 'Not entered');
  assert.equal(condition(computed, 'pH').hint, 'Not entered');
  assert.deepEqual(waterChips(computed), []);
  assert.ok(Number.isFinite(computed.bioload.proposedPercent) && computed.bioload.proposedPercent > 0);
  assert.ok(Array.isArray(computed.conditions.conditions));
  assert.ok(!/pH|gH|kH|Temperature/.test(computed.status.label), computed.status.label);
});

test('B: Neon Tetras with an entered pH inside their range evaluates as within', () => {
  const computed = run('20h', [['neon', 8]], { water: { pH: 6.5 } });
  const ph = condition(computed, 'pH');
  assert.equal(ph.measured, true);
  assert.equal(ph.status, 'within');
  assert.equal(ph.severity, 'ok');
  assert.match(ph.hint, /within the shared range/);
  assert.deepEqual(waterWarnings(computed), []);
});

test('C: Neon Tetras with an entered pH far outside their range warns', () => {
  const computed = run('20h', [['neon', 8]], { water: { pH: 8.5 } });
  const ph = condition(computed, 'pH');
  assert.equal(ph.status, 'outside');
  assert.equal(ph.severity, 'bad');
  const [warning] = waterWarnings(computed);
  assert.equal(warning?.id, 'water.pH.outside');
  assert.equal(warning.severity, 'danger');
  assert.match(warning.message, /You entered pH 8\.5/);
  assert.match(warning.message, /Shared species range: 4\.8–7\.2/);
  assert.equal(computed.status.severity, 'bad');
});

test('clearing an entered value returns it to unknown and removes the warning', () => {
  for (const cleared of [null, undefined, '']) {
    const computed = run('20h', [['neon', 8]], { water: { pH: cleared } });
    assert.equal(condition(computed, 'pH').status, 'not-entered', String(cleared));
    assert.deepEqual(waterWarnings(computed), []);
  }
});

test('D: species with no shared temperature range conflict without any user temperature', () => {
  const computed = run('75g', [['white_cloud_mountain_minnow', 6], ['blue_ram', 2]]);
  const temp = condition(computed, 'temperature');
  assert.equal(temp.status, 'species-conflict');
  assert.equal(temp.severity, 'bad');
  assert.equal(temp.measured, false);
  assert.match(temp.hint, /No shared range between these species/);
  assert.deepEqual(waterWarnings(computed), [], 'a species conflict is not a claim about the user water');
  assert.equal(computed.status.severity, 'bad');
});

test('E: compatible species overlap, entered temperature outside it — user-water warning', () => {
  const unknown = run('29g', [['neon', 8], ['cory_bronze', 6]]);
  assert.equal(condition(unknown, 'temperature').status, 'not-entered');
  assert.deepEqual(condition(unknown, 'temperature').range, [70, 80], 'highest minimum → lowest maximum');

  const computed = run('29g', [['neon', 8], ['cory_bronze', 6]], { water: { temperature: 86 } });
  const temp = condition(computed, 'temperature');
  assert.equal(temp.status, 'outside');
  assert.equal(temp.severity, 'bad');
  assert.equal(waterWarnings(computed)[0]?.id, 'water.temperature.outside');
  assert.match(waterWarnings(computed)[0].message, /Shared species range: 70–80°F/);
});

test('F: Molly with no GH/KH entered — no claim that the water is too soft', () => {
  const computed = run('29g', [['molly', 3]], { candidate: ['molly', 1] });
  assertNoWaterClaims(computed, 'molly');
  assert.deepEqual(waterChips(computed), []);
  for (const result of Object.values(computed.candidate.protoV2State.compatibility)) {
    if (result) assert.equal(result.status, 'Not evaluated');
  }
});

test('G: Molly with a very soft entered GH gets a hardness warning', () => {
  const computed = run('29g', [['molly', 3]], { water: { gH: 3 }, candidate: ['molly', 1] });
  const gh = condition(computed, 'gH');
  assert.equal(gh.status, 'outside');
  assert.equal(gh.severity, 'bad');
  const warning = waterWarnings(computed).find((w) => w.id === 'water.gH.outside');
  assert.ok(warning, 'expected a GH warning');
  assert.match(warning.title, /GH \(general hardness\)/);
  assert.equal(computed.candidate.protoV2State.compatibility.gh.status, 'Incompatible');
  assert.equal(computed.candidate.protoV2State.compatibility.pH.status, 'Not evaluated');
});

test('H: a blackwater-preferring species is never failed for missing tannins', () => {
  for (const blackwater of [null, false]) {
    const computed = run('29g', [['cardinal', 8]], { water: { blackwater }, candidate: ['cardinal', 2] });
    assert.equal(computed.conditions.blackwaterCheck.severity, 'ok', String(blackwater));
    assert.ok(!computed.chips.some((chip) => /tannin/i.test(chip.text) && chip.tone !== 'ok'), String(blackwater));
  }
});

test('Rummynose (prefers blackwater) gets no tannin failure whether tannins are unknown, off or on', () => {
  for (const blackwater of [null, false, true]) {
    const computed = run('55g', [], { water: { blackwater }, candidate: ['rummynose', 8] });
    assert.equal(computed.conditions.blackwaterCheck.severity, 'ok', String(blackwater));
    assert.ok(!computed.chips.some((chip) => /tannin|blackwater/i.test(chip.text) && chip.tone !== 'ok'), String(blackwater));
    assert.ok(!/tannin|blackwater/i.test(computed.status.label), computed.status.label);
  }
});

test('snails get no shell-health warning until a low GH is entered', () => {
  const mystery = legacy.getSpeciesById('mystery_snail');
  assert.equal(evaluateInvertSafety(mystery, { water: legacy.sanitizeWater({}) }).severity, 'ok');
  assert.equal(evaluateInvertSafety(mystery, { water: legacy.sanitizeWater({ gH: 4 }) }).severity, 'warn');
  const computed = run('29g', [], { candidate: ['mystery_snail', 2] });
  assert.equal(computed.invertCheck.severity, 'ok');
});

test('flow preference is not compared with an assumed tank flow', () => {
  const tiger = { species: legacy.getSpeciesById('tiger_barb') };
  assert.equal(evaluateFlow(tiger, legacy.sanitizeWater({})).severity, 'ok');
  assert.equal(evaluateFlow(tiger, legacy.sanitizeWater({ flow: 'low' })).severity, 'bad');
});

test('compatScore does not pass or fail a parameter that was not entered', () => {
  const spec = { optimal: [6.5, 7.0], tolerable: [6.0, 7.5] };
  for (const value of [null, undefined, '', NaN]) {
    assert.equal(compatScore(spec, value).status, 'Not evaluated', String(value));
  }
  assert.equal(compatScore(spec, 6.8).status, 'Optimal');
  assert.equal(compatScore(spec, 7.3).status, 'Tolerable (not ideal)');
  assert.equal(compatScore(spec, 8.4).status, 'Incompatible');
});

test('every species, alone and as a candidate, makes no water claim when nothing is entered', () => {
  assert.equal(DROPDOWN.length, 44);
  for (const species of DROPDOWN) {
    const engine = legacy.getSpeciesById(species.id);
    const qty = engine.group?.min || 1;
    const computed = run('125g', [[species.id, qty]], { candidate: [species.id, 1] });
    assertNoWaterClaims(computed, species.id);
    for (const key of MEASURED_KEYS) {
      assert.notEqual(condition(computed, key)?.status, 'species-conflict', `${species.id} conflicts with itself on ${key}`);
    }
    const falseWaterChips = computed.chips.filter((chip) => /your water|Outside range|Slightly outside|Adjust flow|Flow rate|Prefers tannin|Low gH/i.test(chip.text));
    assert.deepEqual(falseWaterChips, [], species.id);
    assert.ok(Number.isFinite(computed.bioload.proposedPercent), `${species.id} bioload`);
    for (const item of computed.conditions.conditions) {
      assert.ok(typeof item.hint === 'string', `${species.id} ${item.key} hint`);
    }
  }
});

test('entering water never changes the bioload % or the filtration assessment (Phase 2B / 2C)', () => {
  const filters = [{ id: 'custom-1', type: 'hob', gph: 150 }];
  const stock = [['neon', 10], ['cory_bronze', 6], ['molly', 3]];
  const water = { temperature: 90, pH: 9, gH: 1, kH: 0, flow: 'high', blackwater: false };
  for (const tankId of ['20h', '29g', '55g']) {
    for (const f of [[], filters]) {
      const without = run(tankId, stock, { filters: f });
      const withWater = run(tankId, stock, { filters: f, water });
      assert.equal(withWater.bioload.proposedPercent, without.bioload.proposedPercent, `${tankId} bioload`);
      assert.equal(withWater.bioload.currentPercent, without.bioload.currentPercent, `${tankId} bioload`);
      assert.equal(withWater.filtering.level, without.filtering.level, `${tankId} filtration level`);
      assert.equal(withWater.filtering.turnover, without.filtering.turnover, `${tankId} turnover`);
      assert.deepEqual(
        withWater.filtering.warnings.map((w) => w.id),
        without.filtering.warnings.map((w) => w.id),
        `${tankId} filtration warnings`,
      );
    }
  }
});
