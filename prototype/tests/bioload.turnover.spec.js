import test from 'node:test';
import assert from 'node:assert/strict';

import { percentBioload } from '../js/logic/compute-proxy.js';

test('adding flow does NOT increase bioload % (same stock)', () => {
  const baseState = { gallons: 29, planted: false, speciesLoad: 15, flowGPH: 120 };
  const p1 = percentBioload(baseState);
  const p2 = percentBioload({ ...baseState, flowGPH: 260 });
  assert.ok(p2 <= p1 + 1e-9, `Expected ${p2} <= ${p1}`);
});

test('planted relief lowers % vs non-planted (same stock & flow)', () => {
  const unplanted = percentBioload({ gallons: 29, planted: false, speciesLoad: 15, flowGPH: 200 });
  const planted = percentBioload({ gallons: 29, planted: true, speciesLoad: 15, flowGPH: 200 });
  assert.ok(planted < unplanted, `Expected planted ${planted} < ${unplanted}`);
});

test('0 capacity guard returns 0 and does not crash', () => {
  const percent = percentBioload({ gallons: 0, planted: false, speciesLoad: 10, flowGPH: 200 });
  assert.equal(percent, 0);
});
