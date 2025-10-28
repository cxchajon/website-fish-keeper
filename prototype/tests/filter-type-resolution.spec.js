import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { mapFiltersForEfficiency, resolveFilterType, FLOW_DERATE } from '../assets/js/proto-filtration-math.js';

describe('prototype filter type resolution', () => {
  test('respects explicit product type', () => {
    const filters = [
      {
        id: 'prod-explicit',
        source: 'product',
        type: 'SPONGE',
        rated_gph: 100,
      },
    ];

    const normalized = mapFiltersForEfficiency(filters);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].type, 'Sponge');
    assert.equal(normalized[0].ratedGph, 100);
    assert.equal(normalized[0].deratedGph, 100 * FLOW_DERATE);
  });

  test('infers type from product name keywords', () => {
    const filters = [
      {
        id: 'prod-sponge-name',
        source: 'product',
        name: 'Powkoo Dual Sponge Filter (20–55G)',
        rated_gph: 150,
      },
    ];

    const normalized = mapFiltersForEfficiency(filters);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].type, 'Sponge');
  });

  test('falls back to default type with single warning when missing', () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => {
      warnings.push(args.join(' '));
    };

    try {
      const product = {
        id: 'prod-mystery',
        source: 'product',
        name: 'Mystery Flow Filter 200',
        rated_gph: 200,
      };

      const firstPass = resolveFilterType(product);
      assert.equal(firstPass, 'HOB');
      const normalized = mapFiltersForEfficiency([product]);
      assert.equal(normalized.length, 1);
      assert.equal(normalized[0].type, 'HOB');

      mapFiltersForEfficiency([product]);
      assert.equal(warnings.length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });
});
