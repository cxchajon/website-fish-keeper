import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog, mockState, runAllWarnings } from '../logic/rules/warnings.js';

const catalog = buildCatalog();

const hasWarning = (warnings, id) => warnings.some((warning) => warning?.id === id);

test('flags female betta sorority when 2–4 present (<5)', () => {
  const state = mockState({
    stock: [{ speciesId: 'betta_female', quantity: 3 }],
    tank: { gallons: 20 },
  });
  const warnings = runAllWarnings(state, catalog);
  assert.ok(hasWarning(warnings, 'betta.femaleGroupTooSmall'));
});

test('does NOT flag sorority when >=5 females', () => {
  const state = mockState({
    stock: [{ speciesId: 'betta_female', quantity: 5 }],
    tank: { gallons: 29 },
  });
  const warnings = runAllWarnings(state, catalog);
  assert.ok(!hasWarning(warnings, 'betta.femaleGroupTooSmall'));
});

test('flags fin-nipper conflict for betta female + tiger barbs', () => {
  const state = mockState({
    stock: [
      { speciesId: 'betta_female', quantity: 1 },
      { speciesId: 'tiger_barb', quantity: 8 },
    ],
  });
  const warnings = runAllWarnings(state, catalog);
  assert.ok(hasWarning(warnings, 'betta.finNippers'));
});

test('flags fin-nipper conflict for betta male + tiger barbs', () => {
  const state = mockState({
    stock: [
      { speciesId: 'betta_male', quantity: 1 },
      { speciesId: 'tiger_barb', quantity: 10 },
    ],
  });
  const warnings = runAllWarnings(state, catalog);
  assert.ok(hasWarning(warnings, 'betta.finNippers'));
});

test('zebra danio is NOT treated as fin-nipper, only active swimmer', () => {
  const zebra = catalog.byId['zebra_danio'];
  assert.ok(zebra, 'catalog entry should exist for zebra danio');
  assert.equal(zebra.tags.includes('fin_nipper'), false);
  assert.ok(zebra.tags.includes('active_swimmer'));
});
