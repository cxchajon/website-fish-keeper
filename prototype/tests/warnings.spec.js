import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, buildComputedState } from '../js/logic/compute-proxy.js';

const collectWarningById = (warnings = []) => {
  const map = new Map();
  for (const warning of warnings) {
    if (!warning?.id) continue;
    map.set(warning.id, warning);
  }
  return map;
};

test('Female betta sorority warnings trigger for low counts and undersized tanks', () => {
  const state = createDefaultState();
  state.gallons = 10;
  state.stock = [{ id: 'betta_female', qty: 2 }];

  const computed = buildComputedState(state);
  const warnings = collectWarningById(computed.status?.warnings);

  const lowCount = warnings.get('betta_female_sorority_lowcount');
  assert.ok(lowCount, 'Low-count sorority warning should appear');
  assert.equal(lowCount.severity, 'danger');

  const tankTooSmall = warnings.get('betta_female_sorority_tank_too_small');
  assert.ok(tankTooSmall, 'Tank size warning should appear when sorority >=5 in sub-20g tank');
  assert.equal(tankTooSmall.severity, 'warn');
});

test('Adequate female betta sorority avoids sorority warnings', () => {
  const state = createDefaultState();
  state.gallons = 29;
  state.stock = [{ id: 'betta_female', qty: 5 }];

  const computed = buildComputedState(state);
  const warnings = collectWarningById(computed.status?.warnings);

  assert.ok(!warnings.has('betta_female_sorority_lowcount'), 'Low-count warning should not appear for 5 bettas in 29g');
  assert.ok(!warnings.has('betta_female_sorority_tank_too_small'), 'Tank-size warning should not appear for >=20g sorority');
});

test('Female bettas warn when housed with fin nippers', () => {
  const state = createDefaultState();
  state.gallons = 29;
  state.stock = [
    { id: 'betta_female', qty: 1 },
    { id: 'tiger_barb', qty: 6 },
  ];

  const computed = buildComputedState(state);
  const warnings = collectWarningById(computed.status?.warnings);

  const conflict = warnings.get('betta_female_finnipper_conflict');
  assert.ok(conflict, 'Fin-nipper conflict warning should appear');
  assert.equal(conflict.severity, 'warn');
});

test('Communities without female bettas avoid new warnings', () => {
  const state = createDefaultState();
  state.gallons = 29;
  state.stock = [{ id: 'tiger_barb', qty: 6 }];

  const computed = buildComputedState(state);
  const warnings = collectWarningById(computed.status?.warnings);

  assert.ok(!warnings.has('betta_female_sorority_lowcount'));
  assert.ok(!warnings.has('betta_female_sorority_tank_too_small'));
  assert.ok(!warnings.has('betta_female_finnipper_conflict'));
});
