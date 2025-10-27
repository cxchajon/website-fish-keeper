import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { computeBioloadPercentForTest } from '../js/logic/compute-proxy.js';

const expect = (actual) => ({
  toBeLessThanOrEqual(expected) {
    assert.ok(actual <= expected + 1e-9, `Expected ${actual} ≤ ${expected}`);
  },
  toBeGreaterThanOrEqual(expected) {
    assert.ok(actual + 1e-9 >= expected, `Expected ${actual} ≥ ${expected}`);
  },
  toBe(expected) {
    assert.equal(actual, expected);
  },
  toBeFinite() {
    assert.ok(Number.isFinite(actual), `Expected ${actual} to be finite`);
  },
});

describe('prototype bioload filtration aggregation', () => {
  const basePlan = { gallons: 29, speciesLoad: 100, capacity: 100, planted: false };

  test('custom-only filters aggregate with monotonic percent', () => {
    const baseline = computeBioloadPercentForTest({ ...basePlan, flowGPH: 0, totalGPH: 0, filters: [] });
    const hobA = { id: 'custom-a', source: 'custom', kind: 'HOB', rated_gph: 200 };
    const afterOne = computeBioloadPercentForTest({
      ...basePlan,
      flowGPH: 200,
      totalGPH: 200,
      filters: [hobA],
    });
    const hobB = { id: 'custom-b', source: 'custom', kind: 'HOB', rated_gph: 200 };
    const afterTwo = computeBioloadPercentForTest({
      ...basePlan,
      flowGPH: 400,
      totalGPH: 400,
      filters: [hobA, hobB],
    });

    expect(afterOne).toBeLessThanOrEqual(baseline);
    expect(afterTwo).toBeLessThanOrEqual(afterOne);
  });

  test('product + custom combo never increases percent', () => {
    const product = { id: 'prod-206', source: 'product', kind: 'HOB', rated_gph: 206 };
    const custom = { id: 'custom-200', source: 'custom', kind: 'HOB', rated_gph: 200 };

    const productOnly = computeBioloadPercentForTest({
      ...basePlan,
      flowGPH: 206,
      totalGPH: 206,
      filters: [product],
    });
    const combo = computeBioloadPercentForTest({
      ...basePlan,
      flowGPH: 406,
      totalGPH: 406,
      filters: [product, custom],
    });

    expect(combo).toBeLessThanOrEqual(productOnly);
  });

  test('zero filters retains baseline percent and stays finite', () => {
    const speciesLoad = 80;
    const capacity = 100;
    const baseline = (speciesLoad / capacity) * 100;
    const percent = computeBioloadPercentForTest({
      gallons: 29,
      speciesLoad,
      capacity,
      planted: false,
      flowGPH: 0,
      totalGPH: 0,
      filters: [],
    });

    expect(percent).toBeFinite();
    expect(percent).toBeGreaterThanOrEqual(0);
    expect(percent).toBeLessThanOrEqual(200);
    expect(Number(percent.toFixed(6))).toBe(Number(baseline.toFixed(6)));
  });
});
