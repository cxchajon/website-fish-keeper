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
const { deriveEnv } = await import('../../js/logic/envRecommend.js');

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

// Canonical identity = slug (the v2 record key). The engine keys records by id, so both are checked.
const idsOf = (list, key) => list.map((item) => item[key]);
const duplicates = (list) => list.filter((value, index) => list.indexOf(value) !== index);

test('dropdown offers exactly the records in species.v2.json', () => {
  const jsonSlugs = idsOf(RAW_SPECIES, 'slug');
  const dropdownSlugs = idsOf(DROPDOWN, 'slug');
  assert.deepEqual(duplicates(jsonSlugs), [], 'duplicate slugs in species.v2.json');
  assert.deepEqual(duplicates(dropdownSlugs), [], 'duplicate species in the dropdown');
  assert.deepEqual([...dropdownSlugs].sort(), [...jsonSlugs].sort());
  assert.equal(DROPDOWN.length, 44);
});

test('engine species set matches the dropdown exactly by identity', () => {
  const dropdownIds = idsOf(DROPDOWN, 'id');
  const engineIds = idsOf(legacy.SPECIES, 'id');
  assert.deepEqual(duplicates(dropdownIds), [], 'two dropdown species map to the same engine id');
  assert.deepEqual(duplicates(engineIds), [], 'duplicate engine ids');
  assert.deepEqual([...engineIds].sort(), [...dropdownIds].sort());
  assert.deepEqual(
    [...idsOf(legacy.SPECIES, 'slug')].sort(),
    [...idsOf(DROPDOWN, 'slug')].sort(),
    'engine records must be the dropdown records',
  );
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

test('no selectable species is calculated with placeholder husbandry data', () => {
  const legacyIds = new Set(FISH_DB.map((record) => record.id));
  for (const species of DROPDOWN) {
    const raw = RAW_SPECIES.find((record) => record.slug === species.slug);
    assert.ok(species.scientific_name, `${species.id} scientific_name`);
    assert.ok(Number.isFinite(species.adult_size_in) && species.adult_size_in > 0, `${species.id} adult_size_in`);
    assert.ok(['fish', 'shrimp', 'snail'].includes(species.category), `${species.id} category`);
    assert.ok(['requires', 'prefers', 'neutral'].includes(species.blackwater), `${species.id} blackwater`);
    if (species.tank_length_not_applicable) {
      assert.equal(species.category, 'snail', `${species.id}: only crawling snails may skip tank length`);
    } else {
      assert.ok(Number.isFinite(species.min_tank_length_in) && species.min_tank_length_in > 0, `${species.id} min_tank_length_in`);
    }
    if (!legacyIds.has(species.id)) {
      // Newer species: every value must come from the reviewed v2 record, never an adapter default.
      for (const key of ['scientific_name', 'adult_size_in', 'category', 'blackwater', 'min_tank_liters']) {
        assert.equal(species[key], raw[key], `${species.id} ${key} must come from species.v2.json`);
      }
      assert.ok(raw.husbandry_review?.sources?.length >= 2, `${species.id} needs documented sources`);
      assert.ok(Number.isFinite(raw.min_tank_liters) && raw.min_tank_liters > 0, `${species.id} min_tank_liters`);
    }
  }
});

test('a record missing a required husbandry value is rejected and flagged, not defaulted', () => {
  const broken = DROPDOWN.map((species) => (
    species.id === 'molly' ? { ...species, adult_size_in: null } : species
  ));
  try {
    legacy.overrideSpeciesDataset(broken);
    assert.deepEqual(compute.getRejectedSpecies(), [{ id: 'molly', name: 'Molly', reason: 'bad adult_size_in' }]);
    const computed = compute.buildComputedState(stateFor('29g', [['molly', 3]]));
    const warning = computed.status.warnings.find((w) => w.id === 'species.unevaluated.molly');
    assert.equal(warning?.severity, 'danger');
    assert.equal(computed.status.severity, 'bad');
  } finally {
    legacy.overrideSpeciesDataset(DROPDOWN);
  }
});

test('newer species bioload sits on the calibrated scale of the original species', () => {
  const ge = (id) => legacy.getSpeciesById(id).bioloadGE;
  // A 6" angelfish or 5" pleco must outweigh a 3" tiger barb; nano fish stay near neon tetras.
  assert.ok(ge('freshwater_angelfish') > ge('tiger_barb'));
  assert.ok(ge('bristlenose_pleco') > ge('tiger_barb'));
  assert.ok(ge('molly') > ge('guppy_male') * 3);
  assert.ok(ge('ember_tetra') <= ge('neon'));
  assert.ok(ge('ramshorn_snail') < ge('nerite'));
});

test('predation uses one vocabulary: shrimp_risk / snail_risk', () => {
  const tags = (id) => legacy.getSpeciesById(id).tags;
  for (const species of legacy.SPECIES) {
    assert.ok(!species.tags.some((tag) => tag.startsWith('predator_')), `${species.id} uses retired predator_* tag`);
    assert.ok(!(species.tags.includes('shrimp_risk') && species.tags.includes('shrimp_safe')), `${species.id} shrimp contradiction`);
    assert.ok(!(species.tags.includes('snail_risk') && species.tags.includes('snail_safe')), `${species.id} snail contradiction`);
    assert.equal(species.invert_safe, !species.tags.includes('shrimp_risk') && !species.tags.includes('snail_risk'));
  }
  assert.ok(tags('pea_puffer').includes('snail_risk') && tags('pea_puffer').includes('shrimp_risk'));
  assert.ok(tags('assassin_snail').includes('snail_risk'));
  assert.ok(!tags('assassin_snail').includes('shrimp_risk'), 'assassin snails are not shrimp predators');
  for (const id of ['molly', 'platy', 'swordtail', 'guppy_male']) assert.ok(tags(id).includes('livebearer'), id);
  assert.ok(tags('freshwater_angelfish').includes('cichlid'));
});

test('invert predation is reported for shrimp and snails', () => {
  const stock = [['pea_puffer', 1], ['mystery_snail', 1], ['neocaridina', 10]];
  const computed = compute.buildComputedState(stateFor('29g', stock));
  const env = deriveEnv(stock.map(([id, qty]) => ({ species: legacy.getSpeciesById(id), qty })), { computed });
  const texts = env.warnings.map((warning) => warning.text);
  assert.ok(texts.some((text) => /Shrimp predation risk: Pea Puffer/.test(text)), texts.join(' | '));
  assert.ok(texts.some((text) => /Snail predation risk: Pea Puffer/.test(text)), texts.join(' | '));
});

const warningIds = (computed) => computed.status.warnings.map((warning) => warning.id);

test('safety case: 6 angelfish in a 20 gallon is not a normal result', () => {
  const computed = compute.buildComputedState(stateFor('20h', [['freshwater_angelfish', 6]]));
  assert.equal(computed.status.severity, 'bad');
  assert.ok(warningIds(computed).includes('tank.volume.freshwater_angelfish'));
  assert.ok(warningIds(computed).includes('tank.length.freshwater_angelfish'));
  assert.equal(computed.bioload.tankUnsuitable, true);
  assert.equal(computed.bioload.severity, 'bad');
  assert.match(computed.aggression.label, /Territory crowding among Freshwater Angelfish/);
});

test('safety cases: 6 of each species in a 5 gallon fail tank suitability', () => {
  for (const id of ['bristlenose_pleco', 'molly', 'swordtail', 'platy']) {
    const computed = compute.buildComputedState(stateFor('5g', [[id, 6]]));
    assert.equal(computed.status.severity, 'bad', id);
    assert.ok(warningIds(computed).includes(`tank.volume.${id}`), id);
    assert.equal(computed.bioload.severity, 'bad', id);
  }
  const puffers = compute.buildComputedState(stateFor('5g', [['pea_puffer', 6]]));
  assert.equal(puffers.bioload.severity, 'bad', 'six pea puffers overload a 5 gallon');
  const onePuffer = compute.buildComputedState(stateFor('5g', [['pea_puffer', 1]]));
  assert.ok(!warningIds(onePuffer).includes('tank.volume.pea_puffer'), 'one pea puffer fits a 5 gallon minimum');
});

test('livebearers get hardness warnings in soft water', () => {
  for (const id of ['molly', 'swordtail', 'platy']) {
    const computed = compute.buildComputedState(stateFor('29g', [[id, 3]]));
    const gh = computed.conditions.conditions.find((item) => item.key === 'gH' || /gH/.test(item.label));
    assert.equal(gh?.severity, 'bad', `${id} at the default gH 6`);
  }
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
