import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, buildComputedState } from '../../prototype/js/logic/compute-proxy.js';

test('Predation risk chip appears for betta and cherry shrimp mix', () => {
  const state = createDefaultState();
  state.gallons = 10;
  state.water = { temperature: 78, pH: 7, gH: 6, kH: 3 };
  state.stock = [{ id: 'neocaridina', qty: 10 }];
  state.candidate = { id: 'betta_male', qty: 1 };

  const computed = buildComputedState(state);
  const chipTexts = (computed.chips || []).map((chip) => chip.text);
  assert.ok(
    chipTexts.some((text) => typeof text === 'string' && text.includes('Predation risk')),
    'Predation risk chip should be present',
  );
});

test('Fin-nip warning surfaces for tiger barbs with long-finned tankmates', () => {
  const state = createDefaultState();
  state.gallons = 40;
  state.water = { temperature: 78, pH: 7, gH: 6, kH: 3 };
  state.stock = [{ id: 'betta_male', qty: 1 }];
  state.candidate = { id: 'tiger_barb', qty: 6 };

  const computed = buildComputedState(state);
  const chipTexts = (computed.chips || []).map((chip) => chip.text);
  assert.ok(
    chipTexts.some((text) => typeof text === 'string' && text.includes('Incompatibility: Long-finned species')),
    'Fin-nip incompatibility chip should be present',
  );
});
