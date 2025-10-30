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

test('Female betta sorority warnings trigger for low counts', () => {
  const state = createDefaultState();
  state.gallons = 10;
  state.stock = [{ id: 'betta_female', qty: 2 }];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = collectWarningById(computed.status?.warnings);

  const lowCount = warnings.get('betta.femaleGroupTooSmall');
  assert.ok(lowCount, 'Low-count sorority warning should appear');
  assert.equal(lowCount.severity, 'danger');
  assert.match(lowCount.text, /Female bettas: group too small/i);
});

test('Adequate female betta sorority avoids sorority warnings', () => {
  const state = createDefaultState();
  state.gallons = 29;
  state.stock = [{ id: 'betta_female', qty: 5 }];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = collectWarningById(computed.status?.warnings);

  assert.ok(!warnings.has('betta.femaleGroupTooSmall'), 'Low-count warning should not appear for 5 bettas in 29g');
});

test('Female bettas warn when housed with fin nippers', () => {
  const state = createDefaultState();
  state.gallons = 29;
  state.stock = [
    { id: 'betta_female', qty: 1 },
    { id: 'tiger_barb', qty: 6 },
  ];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = collectWarningById(computed.status?.warnings);

  const conflict = warnings.get('betta.finNippers');
  assert.ok(conflict, 'Fin-nipper conflict warning should appear');
  assert.equal(conflict.severity, 'danger');
  assert.match(conflict.text, /Fin-nippers present with betta/i);
});

test('Communities without female bettas avoid new warnings', () => {
  const state = createDefaultState();
  state.gallons = 29;
  state.stock = [{ id: 'tiger_barb', qty: 6 }];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = collectWarningById(computed.status?.warnings);

  assert.ok(!warnings.has('betta.femaleGroupTooSmall'));
  assert.ok(!warnings.has('betta.finNippers'));
});

test('Single female betta does not trigger sorority warning', () => {
  const state = createDefaultState();
  state.gallons = 10;
  state.stock = [{ id: 'betta_female', qty: 1 }];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = collectWarningById(computed.status?.warnings);

  assert.ok(!warnings.has('betta.femaleGroupTooSmall'));
});

test('Male bettas also warn when housed with fin nippers', () => {
  const state = createDefaultState();
  state.gallons = 29;
  state.stock = [
    { id: 'betta_male', qty: 1 },
    { id: 'tiger_barb', qty: 6 },
  ];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = collectWarningById(computed.status?.warnings);

  const conflict = warnings.get('betta.finNippers');
  assert.ok(conflict, 'Shared fin-nipper conflict warning should appear for male bettas');
  assert.equal(conflict.severity, 'danger');
});
