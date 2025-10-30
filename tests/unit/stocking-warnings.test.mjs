import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultState, buildComputedState } from '../../js/logic/compute.js';

function mapWarnings(list = []) {
  const map = new Map();
  for (const warning of Array.isArray(list) ? list : []) {
    if (!warning?.id) continue;
    map.set(warning.id, warning);
  }
  return map;
}

test('female betta pairs trigger sorority warning', () => {
  const state = createDefaultState();
  state.stock = [{ id: 'betta_female', qty: 2 }];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = mapWarnings(computed.status?.warnings);

  const warning = warnings.get('betta.femaleGroupTooSmall');
  assert.ok(warning, 'expected female sorority warning to be present');
  assert.equal(warning.severity, 'danger');
});

test('five female bettas avoid the sorority warning', () => {
  const state = createDefaultState();
  state.stock = [{ id: 'betta_female', qty: 5 }];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = mapWarnings(computed.status?.warnings);

  assert.ok(!warnings.has('betta.femaleGroupTooSmall'));
});

test('fin-nipper conflict fires for female betta + tiger barbs', () => {
  const state = createDefaultState();
  state.stock = [
    { id: 'betta_female', qty: 1 },
    { id: 'tiger_barb', qty: 6 },
  ];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = mapWarnings(computed.status?.warnings);

  const warning = warnings.get('betta.finNippers');
  assert.ok(warning, 'expected fin-nipper warning');
  assert.equal(warning.severity, 'danger');
});

test('fin-nipper conflict also fires for male betta + tiger barbs', () => {
  const state = createDefaultState();
  state.stock = [
    { id: 'betta_male', qty: 1 },
    { id: 'tiger_barb', qty: 6 },
  ];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = mapWarnings(computed.status?.warnings);

  const warning = warnings.get('betta.finNippers');
  assert.ok(warning, 'expected shared fin-nipper warning');
  assert.equal(warning.severity, 'danger');
});

test('communities without bettas do not receive new warnings', () => {
  const state = createDefaultState();
  state.stock = [{ id: 'tiger_barb', qty: 6 }];
  state.candidate = null;

  const computed = buildComputedState(state);
  const warnings = mapWarnings(computed.status?.warnings);

  assert.ok(!warnings.has('betta.femaleGroupTooSmall'));
  assert.ok(!warnings.has('betta.finNippers'));
});
