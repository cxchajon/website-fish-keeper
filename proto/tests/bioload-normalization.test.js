import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpeciesBySlugV2 } from '../logic/species.adapter.v2.js';

test('Cardinal baseline equals 1.0', () => {
  const cardinal = getSpeciesBySlugV2('cardinal-tetra');
  assert.ok(cardinal, 'Cardinal tetra should load');
  assert.equal(cardinal.protoV2.normalizedBioload, 1);
});

test('Neon tetra normalization around 0.95', () => {
  const neon = getSpeciesBySlugV2('neon-tetra');
  assert.ok(neon, 'Neon tetra should load');
  assert.ok(neon.protoV2.normalizedBioload >= 0.9 && neon.protoV2.normalizedBioload <= 1);
});

test('Bronze corydoras normalization around 1.9', () => {
  const bronze = getSpeciesBySlugV2('bronze-corydoras');
  assert.ok(bronze, 'Bronze corydoras should load');
  assert.ok(bronze.protoV2.normalizedBioload >= 1.8 && bronze.protoV2.normalizedBioload <= 2.0);
});

test('Pearl gourami normalization around 2.5', () => {
  const pearl = getSpeciesBySlugV2('pearl-gourami');
  assert.ok(pearl, 'Pearl gourami should load');
  assert.ok(pearl.protoV2.normalizedBioload >= 2.3 && pearl.protoV2.normalizedBioload <= 2.7);
});
