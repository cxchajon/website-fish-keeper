// One blackwater vocabulary: requires / prefers / neutral, or null (not assessed). Both consumers —
// the conditions rule (conflicts.js) and the environment card (envRecommend.js) — must use it.
import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateBlackwater } from '../../js/logic/conflicts.js';
import { buildBlackwater } from '../../js/logic/envRecommend.js';
import { validateSpeciesRecord } from '../../js/logic/speciesSchema.js';
import { FISH_DB } from '../../js/fish-data.js';

const candidate = (blackwater) => ({ species: { blackwater } });
const entries = (...values) => values.map((blackwater) => ({ species: { blackwater } }));
const TANNINS_OFF = { blackwater: false };
const TANNINS_ON = { blackwater: true };
const TANNINS_NOT_ENTERED = { blackwater: null };

test('"requires" is red when the user says tannins are off and shown as Required', () => {
  assert.equal(evaluateBlackwater(candidate('requires'), TANNINS_OFF).severity, 'bad');
  assert.equal(evaluateBlackwater(candidate('requires'), TANNINS_ON).severity, 'ok');
  // Not entered: still a requirement to plan for, but not a claim that the user's tank lacks tannins.
  assert.equal(evaluateBlackwater(candidate('requires'), TANNINS_NOT_ENTERED).severity, 'warn');
  assert.equal(evaluateBlackwater(candidate('requires'), {}).severity, 'warn');
  const card = buildBlackwater(entries('requires'));
  assert.equal(card.condition.value, 'Required');
  assert.equal(card.status, 'req');
});

test('"prefers" is a tip, never a failure, and shown as Recommended', () => {
  for (const water of [TANNINS_OFF, TANNINS_ON, TANNINS_NOT_ENTERED, {}]) {
    assert.equal(evaluateBlackwater(candidate('prefers'), water).severity, 'ok', JSON.stringify(water));
  }
  assert.match(evaluateBlackwater(candidate('prefers'), TANNINS_NOT_ENTERED).tip, /benefits from tannins/);
  const card = buildBlackwater(entries('prefers'));
  assert.equal(card.condition.value, 'Recommended');
  assert.equal(card.status, 'pref');
});

test('null (not assessed) and "neutral" add no blackwater requirement', () => {
  for (const value of [null, 'neutral']) {
    assert.equal(evaluateBlackwater(candidate(value), TANNINS_OFF).severity, 'ok', String(value));
    const card = buildBlackwater(entries(value));
    assert.equal(card.condition.value, 'Off', String(value));
    assert.equal(card.status, 'off', String(value));
  }
});

test('"requires" outranks "prefers" in a mixed stock', () => {
  assert.equal(buildBlackwater(entries('prefers', 'requires', null)).status, 'req');
});

test('the retired spellings are not part of the vocabulary', () => {
  const record = FISH_DB.find((item) => item.blackwater === 'requires');
  assert.ok(record, 'fixture: a species that requires blackwater');
  assert.equal(validateSpeciesRecord({ ...record, blackwater: 'required' }), 'bad blackwater');
  assert.equal(validateSpeciesRecord({ ...record, blackwater: 'recommended' }), 'bad blackwater');
  assert.equal(buildBlackwater(entries('required')).status, 'off', 'old spelling must not be half-supported');
});
