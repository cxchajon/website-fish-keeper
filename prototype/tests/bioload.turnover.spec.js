import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { percentBioload } from '../js/logic/compute-proxy.js';

const expect = (actual) => ({
  toBeLessThanOrEqual(expected) {
    assert.ok(actual <= expected + 1e-9, `Expected ${actual} ≤ ${expected}`);
  },
  toBeLessThan(expected) {
    assert.ok(actual < expected, `Expected ${actual} < ${expected}`);
  },
  toBe(expected) {
    assert.equal(actual, expected);
  },
});

describe('bioload percent & turnover relationship', () => {
  const base = { gallons: 29, speciesLoad: 15 };

  test('more flow does NOT increase percent', () => {
    const low = percentBioload({ ...base, flowGPH: 80 });
    const mid = percentBioload({ ...base, flowGPH: 200 });
    const high = percentBioload({ ...base, flowGPH: 260 });
    expect(mid).toBeLessThanOrEqual(low);
    expect(high).toBeLessThanOrEqual(mid);
  });

  test('zero-capacity guard saturates at clamp', () => {
    const percent = percentBioload({ gallons: 0, speciesLoad: 10, flowGPH: 200 });
    expect(percent).toBe(200);
  });
});
