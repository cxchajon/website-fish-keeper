// Contract: every species a user can select in the Stocking Advisor must be evaluated by the
// calculation engine — or, if it cannot be, the results must say so loudly. Never silently skipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SPECIES_JSON_PATH = 'data/stocking-advisor/species.v2.json';
const RAW_SPECIES = JSON.parse(readFileSync(ROOT + SPECIES_JSON_PATH, 'utf8'));

// The species adapter fetches its JSON at import time; serve it from disk.
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\//, '');
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => JSON.parse(readFileSync(ROOT + path, 'utf8')),
  };
};

const compute = await import('../../js/logic/compute.js');
const legacy = await import('../../js/logic/compute.legacy.js');
const { validateSpeciesRecord } = await import('../../js/logic/speciesSchema.js');
const { FISH_DB } = await import('../../js/fish-data.js');
const { getTankById } = await import('../../js/utils.js');

await compute.initializeCompute();

// The dropdown is built from this list (js/stocking.js → buildSpeciesOptionsList).
const DROPDOWN = compute.getSpecies();

function stateFor(tankId, stock, candidate = null) {
  const state = compute.createDefaultState();
  const tank = getTankById(tankId);
  state.tank = { ...tank };
  state.gallons = tank.gallons;
  state.selectedTankId = tank.id;
  state.stock = stock.map(([id, qty]) => ({ id, qty }));
  state.candidate = candidate ? { id: candidate[0], qty: candidate[1] } : null;
  return state;
}

test('dropdown offers every record in species.v2.json', () => {
  assert.equal(DROPDOWN.length, RAW_SPECIES.length);
  assert.ok(DROPDOWN.length >= 44, `expected at least 44 species, got ${DROPDOWN.length}`);
});

test('every dropdown species passes validation', () => {
  const failures = DROPDOWN
    .map((species) => ({ id: species.id, verdict: validateSpeciesRecord(species) }))
    .filter((item) => item.verdict !== true);
  assert.deepEqual(failures, [], `species failed validation: ${JSON.stringify(failures)}`);
});

test('every dropdown species has an engine record and none were rejected', () => {
  assert.deepEqual(compute.getRejectedSpecies(), []);
  const missing = DROPDOWN.filter((species) => !legacy.getSpeciesById(species.id)).map((s) => s.id);
  assert.deepEqual(missing, [], `no engine record for: ${missing.join(', ')}`);
  assert.equal(legacy.SPECIES.length, DROPDOWN.length, 'engine dataset size must match the dropdown');
});

test('engine uses the dropdown records, not the legacy js/fish-data.js dataset', () => {
  for (const species of DROPDOWN) {
    const engineRecord = legacy.getSpeciesById(species.id);
    assert.equal(engineRecord.slug, species.slug, `${species.id} engine record is not the v2 record`);
  }
});

test('each dropdown species participates in calculation as stock and as candidate', () => {
  for (const species of DROPDOWN) {
    const stocked = compute.buildComputedState(stateFor('29g', [[species.id, 1]]));
    assert.deepEqual(stocked.entries.map((e) => e.id), [species.id], `${species.id} dropped from stock entries`);
    assert.deepEqual(stocked.unevaluatedSpecies, [], `${species.id} flagged as unevaluated`);
    assert.ok(stocked.bioload.proposedPercent > 0, `${species.id} adds no bioload`);

    const previewed = compute.buildComputedState(stateFor('29g', [], [species.id, 1]));
    assert.equal(previewed.candidate?.id, species.id, `${species.id} dropped as candidate`);
    assert.ok(previewed.bioload.proposedPercent > 0, `${species.id} candidate adds no bioload`);
  }
});

test('species the engine already evaluated keep their bioload values', () => {
  for (const record of FISH_DB) {
    const engineRecord = legacy.getSpeciesById(record.id);
    assert.ok(engineRecord, `${record.id} missing from engine`);
    assert.equal(engineRecord.bioloadGE, record.bioloadGE, `${record.id} bioloadGE changed`);
  }
});

test('invertebrates are categorised as shrimp or snail, not fish', () => {
  const expected = {
    amano: 'shrimp', neocaridina: 'shrimp', bamboo_shrimp: 'shrimp', ghost_shrimp: 'shrimp',
    nerite: 'snail', mystery_snail: 'snail', ramshorn_snail: 'snail', assassin_snail: 'snail',
  };
  for (const [id, category] of Object.entries(expected)) {
    assert.equal(legacy.getSpeciesById(id)?.category, category, `${id} category`);
  }
});

test('audit case A: 6 bristlenose plecos in a 5 gallon are counted', () => {
  const computed = compute.buildComputedState(stateFor('5g', [['bristlenose_pleco', 6]]));
  assert.deepEqual(computed.entries.map((e) => e.id), ['bristlenose_pleco']);
  assert.ok(computed.bioload.proposedPercent > 1, 'expected the tank to be over capacity');
  assert.equal(computed.bioload.severity, 'bad');
});

test('audit case B: 6 angelfish in a 20 gallon are counted', () => {
  const computed = compute.buildComputedState(stateFor('20h', [['freshwater_angelfish', 6]]));
  assert.deepEqual(computed.entries.map((e) => e.id), ['freshwater_angelfish']);
  assert.ok(computed.bioload.proposedPercent > 0);
});

test('audit case C: all four species in a 20 long reach the engine', () => {
  const stock = [['freshwater_angelfish', 2], ['neon', 10], ['tiger_barb', 3], ['bristlenose_pleco', 2]];
  const computed = compute.buildComputedState(stateFor('20l', stock));
  assert.deepEqual(computed.entries.map((e) => e.id).sort(), stock.map(([id]) => id).sort());
  assert.deepEqual(computed.unevaluatedSpecies, []);
  const onlyLegacy = compute.buildComputedState(stateFor('20l', [['neon', 10], ['tiger_barb', 3]]));
  assert.ok(computed.bioload.proposedPercent > onlyLegacy.bioload.proposedPercent);
});

test('species relying on default size data are called out', () => {
  const computed = compute.buildComputedState(stateFor('20h', [['freshwater_angelfish', 6]]));
  const notice = computed.status.warnings.find((w) => w.id === 'species.dataGaps');
  assert.ok(notice, 'expected a limited-data notice');
  assert.match(notice.message, /Freshwater Angelfish/);
});

test('a selected species with no engine record produces a red warning, not a silent drop', () => {
  const computed = compute.buildComputedState(stateFor('29g', [['neon', 10], ['not_a_real_species', 3]]));
  assert.deepEqual(computed.unevaluatedSpecies.map((s) => s.id), ['not_a_real_species']);
  const warning = computed.status.warnings.find((w) => w.id === 'species.unevaluated.not_a_real_species');
  assert.ok(warning, 'expected an unevaluated-species warning');
  assert.equal(warning.severity, 'danger');
  assert.equal(computed.status.severity, 'bad');
  assert.equal(computed.bioload.incomplete, true);
  assert.match(computed.bioload.text, /\(incomplete\)$/);
});

test('a species that fails validation is named in the red warning', () => {
  const broken = DROPDOWN.map((species) => (
    species.id === 'platy' ? { ...species, tags: [...species.tags, 'not_a_known_tag'] } : species
  ));
  try {
    legacy.overrideSpeciesDataset(broken);
    assert.deepEqual(compute.getRejectedSpecies().map((s) => s.id), ['platy']);
    const computed = compute.buildComputedState(stateFor('29g', [['platy', 4]]));
    assert.deepEqual(computed.entries, []);
    const warning = computed.status.warnings.find((w) => w.id === 'species.unevaluated.platy');
    assert.ok(warning, 'expected an unevaluated-species warning for platy');
    assert.equal(warning.severity, 'danger');
    assert.match(warning.title, /Platy could not be evaluated/);
    assert.match(warning.message, /failed validation \(bad tag:not_a_known_tag\)/);
    assert.equal(computed.status.severity, 'bad');
  } finally {
    legacy.overrideSpeciesDataset(DROPDOWN);
  }
  assert.deepEqual(compute.getRejectedSpecies(), []);
});
