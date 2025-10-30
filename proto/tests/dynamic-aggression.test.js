import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpeciesBySlugV2 } from '../logic/species.adapter.v2.js';
import { calcAggression, AGGRESSION_TOKENS } from '../logic/aggression.v2.js';

test('Tiger barb group aggression scaling', () => {
  const tiger = getSpeciesBySlugV2('tiger-barb');
  assert.ok(tiger, 'Tiger barb should load');
  const largeGroup = calcAggression(tiger, 12, { gallons: 40 });
  assert.equal(largeGroup.value, 0.45);
  const smallGroup = calcAggression(tiger, 5, { gallons: 30 });
  assert.equal(smallGroup.value, 0.75);
});

test('Female betta sorority handling', () => {
  const female = getSpeciesBySlugV2('betta-female');
  assert.ok(female, 'Female betta should load');
  const solo = calcAggression(female, 1, { gallons: 10 });
  assert.equal(solo.value, 0.3);
  const trio = calcAggression(female, 3, { gallons: 10 });
  assert.equal(trio.value, 0.9);
  assert.ok(trio.tokens.includes(AGGRESSION_TOKENS.UNSTABLE_SORORITY));
  const sorority = calcAggression(female, 6, { gallons: 29 });
  assert.equal(sorority.value, 0.6);
});

test('Male betta incompatibility when qty > 1', () => {
  const male = getSpeciesBySlugV2('betta-male');
  assert.ok(male, 'Male betta should load');
  const result = calcAggression(male, 2, { gallons: 20 });
  assert.deepEqual(result, { error: AGGRESSION_TOKENS.FATAL_INCOMPATIBLE_BETTA_MALE });
});
