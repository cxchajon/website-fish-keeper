// Bioload model contract (data/stocking-advisor/BIOLOAD_MODEL.md). These are relative and invariant
// checks: they do not lock per-species numbers, which follow from the documented formula and inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RAW_SPECIES = JSON.parse(readFileSync(ROOT + 'data/stocking-advisor/species.v2.json', 'utf8'));

globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\//, '');
  return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(readFileSync(ROOT + path, 'utf8')) };
};

const compute = await import('../../js/logic/compute.js');
const legacy = await import('../../js/logic/compute.legacy.js');
const adapter = await import('../../js/stocking-advisor/logic/species-adapter.v2.js');
const model = await import('../../js/stocking-advisor/logic/bioload-model.js');
const { getTankById } = await import('../../js/utils.js');

await compute.initializeCompute();

const DROPDOWN = compute.getSpecies();
const bySlug = (slug) => legacy.SPECIES.find((species) => species.slug === slug);
const ge = (slug) => bySlug(slug).bioloadGE;

function run(tankId, stock, filters = []) {
  const state = compute.createDefaultState();
  const tank = getTankById(tankId);
  Object.assign(state, {
    tank: { ...tank },
    gallons: tank.gallons,
    selectedTankId: tank.id,
    stock: stock.map(([id, qty]) => ({ id, qty })),
    candidate: null,
    filters,
  });
  return compute.buildComputedState(state);
}

test('all 44 selectable species receive a finite, positive load from the model', () => {
  assert.equal(DROPDOWN.length, 44);
  for (const species of DROPDOWN) {
    const engine = legacy.getSpeciesById(species.id);
    assert.ok(engine, `${species.id} missing from engine`);
    assert.ok(Number.isFinite(engine.bioloadGE) && engine.bioloadGE > 0, `${species.id} bioloadGE ${engine.bioloadGE}`);
  }
});

test('every species record carries valid, documented model inputs', () => {
  for (const record of RAW_SPECIES) {
    const species = bySlug(record.slug);
    const profile = record.bioload_profile;
    assert.ok(profile, `${record.slug} has no bioload_profile`);
    assert.equal(
      model.validateBioloadInputs({ adultSizeIn: species.adult_size_in, category: species.category, profile }),
      true,
      record.slug,
    );
    if (species.category === 'fish') {
      assert.ok(profile.body_build in model.BUILD_FACTORS, `${record.slug} body_build`);
    } else {
      assert.equal(profile.body_build, null, `${record.slug}: body_build applies to fish only`);
    }
    if (profile.waste_class !== 'standard') {
      assert.ok(profile.rationale?.length > 20, `${record.slug}: a non-standard waste class needs a rationale`);
    }
  }
});

test('the engine value is exactly the documented formula applied to the record inputs', () => {
  for (const species of legacy.SPECIES) {
    const profile = species.bioload_profile;
    const build = species.category === 'fish' ? model.BUILD_FACTORS[profile.body_build] : 1;
    const expected = model.BIOLOAD_SCALE
      * species.adult_size_in ** model.LENGTH_EXPONENT
      * build
      * model.CATEGORY_FACTORS[species.category]
      * model.WASTE_FACTORS[profile.waste_class];
    assert.ok(Math.abs(species.bioloadGE - expected) < 1e-9, species.slug);
  }
});

test('the provisional calibration bridge is gone', () => {
  assert.equal(adapter.fitBioloadCalibration, undefined);
  assert.equal(adapter.getBioloadCalibration, undefined);
  const source = readFileSync(ROOT + 'js/stocking-advisor/logic/species-adapter.v2.js', 'utf8');
  assert.doesNotMatch(source, /bioloadGE:\s*[0-9]/, 'no hand-entered GE values in the adapter');
  // The retired v2 multiplier block stays in the JSON only for cached copies of the old adapter.
  assert.doesNotMatch(source, /record\??\.bioload\b/, 'the adapter must not read the retired multiplier block');
});

test('the model never returns a number for invalid inputs', () => {
  const profile = { body_build: 'standard', waste_class: 'standard' };
  for (const bad of [
    { adultSizeIn: 0, category: 'fish', profile },
    { adultSizeIn: NaN, category: 'fish', profile },
    { adultSizeIn: Infinity, category: 'fish', profile },
    { adultSizeIn: 2, category: 'reptile', profile },
    { adultSizeIn: 2, category: 'fish', profile: null },
    { adultSizeIn: 2, category: 'fish', profile: { body_build: 'blob', waste_class: 'standard' } },
    { adultSizeIn: 2, category: 'fish', profile: { body_build: 'standard', waste_class: 'high' } },
    { adultSizeIn: 2, category: 'shrimp', profile: { body_build: 'standard', waste_class: 'standard' } },
  ]) {
    assert.ok(Number.isNaN(model.computeSpeciesBioload(bad)), JSON.stringify(bad));
  }
});

test('invariant: a fish that is no smaller, no slimmer and no cleaner never scores lower', () => {
  const build = model.BUILD_FACTORS;
  const waste = model.WASTE_FACTORS;
  const fish = legacy.SPECIES.filter((species) => species.category === 'fish');
  for (const a of fish) {
    for (const b of fish) {
      if (a.adult_size_in >= b.adult_size_in
        && build[a.bioload_profile.body_build] >= build[b.bioload_profile.body_build]
        && waste[a.bioload_profile.waste_class] >= waste[b.bioload_profile.waste_class]) {
        assert.ok(a.bioloadGE >= b.bioloadGE, `${a.slug} scores below ${b.slug}`);
      }
    }
  }
});

test('larger and high-waste fish are not below nano fish', () => {
  const nano = ['neon-tetra', 'ember-tetra', 'chili-rasbora', 'celestial-pearl-danio', 'pygmy-corydoras'];
  const large = [
    'freshwater-angelfish', 'bristlenose-pleco', 'molly', 'swordtail', 'pearl-gourami', 'keyhole-cichlid',
    'kribensis', 'bolivian-ram', 'blue-ram', 'tiger-barb', 'dwarf-gourami', 'upside-down-catfish',
  ];
  for (const big of large) {
    for (const small of nano) {
      assert.ok(ge(big) > 3 * ge(small), `${big} should be well above ${small}`);
    }
  }
  assert.ok(ge('bristlenose-pleco') > ge('bronze-corydoras') * 3, 'plecos are not treated lightly');
  assert.ok(ge('freshwater-angelfish') > ge('tiger-barb') * 3);
  assert.ok(ge('pea-puffer') >= ge('neon-tetra') - 1e-9, 'high-waste puffer not below a similar-size tetra');
});

test('relative checks from the audit brief keep a biologically sensible order', () => {
  // Neon Tetra comparisons
  assert.ok(ge('ember-tetra') < ge('neon-tetra'));
  assert.ok(ge('cardinal-tetra') > ge('neon-tetra'));
  for (const slug of ['tiger-barb', 'molly', 'swordtail', 'freshwater-angelfish', 'bristlenose-pleco']) {
    assert.ok(ge(slug) > ge('cardinal-tetra'), slug);
  }
  // Labyrinth fish
  assert.ok(ge('honey-gourami') <= ge('betta-male'));
  assert.ok(ge('betta-male') < ge('dwarf-gourami'));
  assert.ok(ge('dwarf-gourami') < ge('pearl-gourami'));
  // Bottom dwellers
  assert.ok(ge('pygmy-corydoras') < ge('panda-corydoras'));
  assert.ok(ge('panda-corydoras') < ge('bronze-corydoras'));
  assert.ok(ge('bronze-corydoras') < ge('bristlenose-pleco'));
  assert.ok(ge('kuhli-loach') < ge('bristlenose-pleco'));
});

test('invertebrates stay proportionally reasonable', () => {
  const inverts = legacy.SPECIES.filter((species) => species.category !== 'fish');
  assert.equal(inverts.length, 8);
  const smallestMidSizeFish = Math.min(...legacy.SPECIES
    .filter((species) => species.category === 'fish' && species.adult_size_in >= 3)
    .map((species) => species.bioloadGE));
  for (const invert of inverts) {
    assert.ok(invert.bioloadGE < smallestMidSizeFish, `${invert.slug} outweighs a 3 in+ fish`);
    assert.ok(invert.bioloadGE < 3 * ge('neon-tetra'), `${invert.slug} too heavy`);
  }
  assert.ok(ge('cherry-shrimp') < ge('neon-tetra') / 2, 'dwarf shrimp are a small fraction of a neon');
  assert.ok(ge('cherry-shrimp') < ge('amano-shrimp'));
  assert.ok(ge('amano-shrimp') < ge('bamboo-shrimp'));
  assert.ok(ge('cherry-shrimp') < ge('nerite-snail'));
  assert.ok(ge('nerite-snail') < ge('mystery-snail'));
  assert.ok(ge('assassin-snail') < ge('mystery-snail'));
});

test('load scales linearly with quantity', () => {
  for (const [id, many] of [['neon', 10], ['freshwater_angelfish', 6], ['bristlenose_pleco', 6], ['molly', 6], ['neocaridina', 20]]) {
    const one = run('125g', [[id, 1]]).bioload;
    const group = run('125g', [[id, many]]).bioload;
    assert.ok(Math.abs(group.proposed - one.proposed * many) < 1e-9, `${id} GE`);
    assert.ok(Math.abs(group.proposedPercent - one.proposedPercent * many) < 1e-9, `${id} percent`);
    const more = run('125g', [[id, many + 1]]).bioload;
    assert.ok(more.proposedPercent > group.proposedPercent, `${id} adding one more must raise the load`);
  }
});

test('filtration changes neither the species load nor the bioload figure (Phase 2C)', () => {
  const stock = [['neon', 10], ['cory_bronze', 6], ['betta_male', 1]];
  const base = run('29g', stock).bioload;
  const filtered = run('29g', stock, [{ id: 'hob', type: 'HOB', rated_gph: 145 }]).bioload;
  assert.equal(filtered.proposed, base.proposed);
  assert.equal(filtered.proposedPercent, base.proposedPercent);
});

test('safety scenarios A–F: tank suitability and compatibility still act independently of bioload', () => {
  const ids = (computed) => computed.status.warnings.map((warning) => warning.id);

  const a = run('5g', [['bristlenose_pleco', 6]]);
  assert.equal(a.status.severity, 'bad');
  assert.equal(a.bioload.severity, 'bad');
  assert.ok(ids(a).includes('tank.volume.bristlenose_pleco'));

  const b = run('20h', [['freshwater_angelfish', 6]]);
  assert.equal(b.status.severity, 'bad');
  assert.ok(ids(b).includes('tank.volume.freshwater_angelfish'));
  assert.ok(ids(b).includes('tank.length.freshwater_angelfish'));

  const c = run('20l', [['freshwater_angelfish', 2], ['neon', 10], ['tiger_barb', 3], ['bristlenose_pleco', 2]]);
  assert.equal(c.status.severity, 'bad');
  assert.ok(ids(c).includes('predation.fish.freshwater_angelfish.neon'));
  assert.ok(ids(c).includes('aggr:freshwater_angelfish:tiger_barb:fin_nip'));
  assert.ok(ids(c).includes('tank.volume.freshwater_angelfish'));

  // D: moderate load, but the bronze corydoras tank-length rule still reports.
  const d = run('29g', [['neon', 10], ['cory_bronze', 6], ['betta_male', 1]]);
  assert.equal(d.bioload.severity, 'ok');
  assert.ok(ids(d).includes('tank.length.cory_bronze'));

  // E: bioload alone does not decide the outcome — the molly length rule still reports.
  const e = run('29g', [['molly', 6]]);
  assert.ok(ids(e).includes('tank.length.molly'));
  assert.ok(e.bioload.proposedPercent > d.bioload.proposedPercent);

  // F: a light invertebrate stock stays light.
  const f = run('10g', [['neocaridina', 10], ['mystery_snail', 1]]);
  assert.equal(f.bioload.severity, 'ok');
  assert.ok(f.bioload.proposedPercent < 0.3);
});

test('a record whose model inputs are missing is rejected and flagged, never counted as zero', () => {
  const broken = DROPDOWN.map((species) => (
    species.id === 'molly' ? { ...species, bioload_profile: null, bioloadGE: NaN } : species
  ));
  try {
    legacy.overrideSpeciesDataset(broken);
    assert.deepEqual(compute.getRejectedSpecies(), [{ id: 'molly', name: 'Molly', reason: 'missing bioload_profile' }]);
    const computed = run('29g', [['neon', 10], ['molly', 3]]);
    assert.equal(computed.bioload.incomplete, true);
    assert.ok(computed.status.warnings.some((w) => w.id === 'species.unevaluated.molly' && w.severity === 'danger'));
  } finally {
    legacy.overrideSpeciesDataset(DROPDOWN);
  }
  assert.deepEqual(compute.getRejectedSpecies(), []);
});
