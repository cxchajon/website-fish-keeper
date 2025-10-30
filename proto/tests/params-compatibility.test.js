import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpeciesBySlugV2 } from '../logic/species.adapter.v2.js';
import { compatScore } from '../logic/compat.v2.js';

test('Cardinal tetra pH compatibility tiers', () => {
  const cardinal = getSpeciesBySlugV2('cardinal-tetra');
  assert.ok(cardinal, 'Cardinal tetra should load');
  const { pH } = cardinal.protoV2.parameters;
  assert.deepEqual(compatScore(pH, 5.5), { score: 100, status: 'Optimal' });
  assert.deepEqual(compatScore(pH, 7.0), { score: 70, status: 'Tolerable (not ideal)' });
  assert.deepEqual(compatScore(pH, 7.6), { score: 0, status: 'Incompatible' });
});
