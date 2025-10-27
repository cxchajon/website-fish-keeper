import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { computeBioloadPercentForTest } from '../js/logic/compute-proxy.js';

const expect = (actual) => ({
  toBeLessThanOrEqual(expected) {
    assert.ok(actual <= expected + 1e-9, `Expected ${actual} ≤ ${expected}`);
  },
});

describe('bioload percent vs filtration', () => {
  const plan = { gallons: 29, planted: false, speciesLoad: 15, capacity: 30, typeBlend: 'HOB' };

  test('more GPH should not raise percent', () => {
    const p0 = computeBioloadPercentForTest({ ...plan, totalGPH: 0, flowGPH: 0 });
    const p1 = computeBioloadPercentForTest({ ...plan, totalGPH: 150, flowGPH: 150 });
    const p2 = computeBioloadPercentForTest({ ...plan, totalGPH: 300, flowGPH: 300 });
    expect(p1).toBeLessThanOrEqual(p0);
    expect(p2).toBeLessThanOrEqual(p1);
  });

  test('planted reduces percent at same GPH', () => {
    const a = computeBioloadPercentForTest({ ...plan, planted: false, totalGPH: 200, flowGPH: 200 });
    const b = computeBioloadPercentForTest({ ...plan, planted: true, totalGPH: 200, flowGPH: 200 });
    expect(b).toBeLessThanOrEqual(a);
  });
});
