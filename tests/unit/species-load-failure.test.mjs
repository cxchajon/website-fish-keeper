// If data/stocking-advisor/species.v2.json cannot be loaded, the advisor must fail visibly: no
// species, every result marked unavailable, and no quiet fallback to the legacy js/fish-data.js set.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.fetch = async () => ({ ok: false, status: 404, statusText: 'Not Found', json: async () => null });

const compute = await import('../../js/logic/compute.js');
const legacy = await import('../../js/logic/compute.legacy.js');
const { getTankById } = await import('../../js/utils.js');
const { FISH_DB } = await import('../../js/fish-data.js');

// Suppress the expected load-failure console noise.
const originalError = console.error;
console.error = () => {};
await compute.initializeCompute();
console.error = originalError;

function stateFor(tankId, stock) {
  const state = compute.createDefaultState();
  const tank = getTankById(tankId);
  state.tank = { ...tank };
  state.gallons = tank.gallons;
  state.selectedTankId = tank.id;
  state.stock = stock.map(([id, qty]) => ({ id, qty }));
  state.candidate = null;
  return state;
}

test('the engine reports the dataset as unavailable', () => {
  const status = compute.getSpeciesDatasetStatus();
  assert.equal(status.state, 'unavailable');
  assert.match(status.error, /404/);
});

test('no species are offered and the legacy dataset is not used', () => {
  assert.equal(compute.getSpecies().length, 0, 'dropdown must be empty');
  assert.equal(legacy.SPECIES.length, 0, 'engine must not keep the legacy records');
  for (const record of FISH_DB) {
    assert.equal(legacy.getSpeciesById(record.id), null, `${record.id} still evaluable from fish-data.js`);
  }
});

test('a previously saved stock is shown as unevaluable, not calculated from legacy data', () => {
  const computed = compute.buildComputedState(stateFor('29g', [['neon', 10], ['cory_panda', 6]]));
  assert.deepEqual(computed.entries, []);
  assert.deepEqual(computed.unevaluatedSpecies.map((item) => item.id), ['neon', 'cory_panda']);
  assert.match(computed.unevaluatedSpecies[0].reason, /could not be loaded/);
  assert.equal(computed.status.severity, 'bad');
  assert.equal(computed.status.unavailable, true);
  assert.ok(computed.status.warnings.some((w) => w.id === 'species.dataUnavailable' && w.severity === 'danger'));
  assert.equal(computed.bioload.incomplete, true);
});

test('even an empty plan is marked unavailable rather than "looks good"', () => {
  const computed = compute.buildComputedState(stateFor('29g', []));
  assert.equal(computed.status.severity, 'bad');
  assert.match(computed.status.label, /Species data failed to load/);
});
