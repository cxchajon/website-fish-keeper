import test from 'node:test';
import assert from 'node:assert/strict';

import { effectiveCapacity, combinedRbc } from '../assets/js/proto-filtration-math.js';

const sponge = { type: 'sponge', mediaVolumeL: 0.3 };
const hob = { type: 'hob', hasBasket: true, mediaVolumeL: 1.2 };

test('sponge lowers stocking %', () => {
  const baseBioload = 20;
  const gallons = 20;
  const capNone = effectiveCapacity(gallons, []);
  const capSponge = effectiveCapacity(gallons, [sponge]);
  const pctNone = (baseBioload / capNone) * 100;
  const pctSponge = (baseBioload / capSponge) * 100;
  assert.ok(
    pctSponge <= pctNone,
    `Expected sponge-assisted percent <= baseline (baseline=${pctNone.toFixed(2)}, sponge=${pctSponge.toFixed(2)})`,
  );
});

test('diminishing returns & cap', () => {
  const baseCapacity = 40;
  const cap = effectiveCapacity(baseCapacity, [hob, hob, sponge]);
  assert.ok(cap <= baseCapacity * 1.6, 'effective capacity should respect the +60% cap');
  const modifier = combinedRbc([hob, hob, sponge]);
  assert.ok(modifier <= 0.6 + Number.EPSILON, 'capacity modifier should not exceed 0.6');
});
