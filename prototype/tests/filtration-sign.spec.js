import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeAdjustedBioload,
  computeAggregateEfficiency,
  computeTurnover,
  mapFiltersForEfficiency,
} from '../assets/js/proto-filtration-math.js';

const BASE = 0.50; // 50%
const DEFAULT_GALLONS = 29;

const mk = (type, ratedGph, gallons = DEFAULT_GALLONS) => ({
  type,
  rated_gph: ratedGph,
  gallons,
});

function computeAdjusted(base, filters, gallons = DEFAULT_GALLONS) {
  const normalized = mapFiltersForEfficiency(filters);
  const totalRated = normalized.reduce((sum, filter) => sum + (filter.ratedGph ?? 0), 0);
  const turnover = totalRated > 0 ? computeTurnover(totalRated, gallons) : 0;
  const { total: equipmentRelief } = computeAggregateEfficiency(filters, turnover);
  return computeAdjustedBioload(base, equipmentRelief);
}

test('sponge reduces vs baseline', () => {
  const sponge = mk('SPONGE', 100);
  const out = computeAdjusted(BASE, [sponge]);
  assert.ok(out < BASE, `expected ${out} to be less than ${BASE}`);
});

test('hob reduces vs baseline with at least sponge relief', () => {
  const sponge = mk('SPONGE', 100);
  const hob = mk('HOB', 200);
  const spongeOut = computeAdjusted(BASE, [sponge]);
  const hobOut = computeAdjusted(BASE, [hob]);
  assert.ok(hobOut < BASE, 'HOB should reduce load versus baseline');
  assert.ok(hobOut <= spongeOut + 1e-6, 'HOB relief should meet or exceed sponge relief');
});

test('canister reduces vs baseline with the strongest relief', () => {
  const hob = mk('HOB', 200);
  const can = mk('CANISTER', 200);
  const hobOut = computeAdjusted(BASE, [hob]);
  const canOut = computeAdjusted(BASE, [can]);
  assert.ok(canOut < BASE, 'Canister should reduce load versus baseline');
  assert.ok(canOut <= hobOut + 1e-6, 'Canister relief should meet or exceed HOB relief');
});

test('adding second filter reduces again with diminishing returns', () => {
  const hob = mk('HOB', 200);
  const sponge = mk('SPONGE', 80);
  const one = computeAdjusted(BASE, [hob]);
  const two = computeAdjusted(BASE, [hob, sponge]);
  assert.ok(two < one, 'Second filter should further reduce load');
  const firstDelta = BASE - one;
  const secondDelta = one - two;
  assert.ok(secondDelta <= firstDelta + 1e-6, 'Second filter relief should be subject to diminishing returns');
});
