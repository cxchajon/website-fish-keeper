// One blackwater vocabulary: requires / prefers / neutral, or null (not assessed). Both consumers —
// the conditions rule (conflicts.js) and the environment card (envRecommend.js) — must use it.
import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateBlackwater } from '../../js/logic/conflicts.js';
import { buildBlackwater } from '../../js/logic/envRecommend.js';
import { validateSpeciesRecord } from '../../js/logic/speciesSchema.js';
import { FISH_DB } from '../../js/fish-data.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\//, '');
  return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(readFileSync(ROOT + path, 'utf8')) };
};
const compute = await import('../../js/logic/compute.js');
const legacy = await import('../../js/logic/compute.legacy.js');
const adapter = await import('../../js/stocking-advisor/logic/species-adapter.v2.js');
await compute.initializeCompute();

const candidate = (blackwater) => ({ species: { blackwater } });
const entries = (...values) => values.map((blackwater) => ({ species: { blackwater } }));
const TANNINS_OFF = { blackwater: false };
const TANNINS_ON = { blackwater: true };
const TANNINS_NOT_ENTERED = { blackwater: null };

// The "requires" rule, exercised directly: no selectable species currently has a sourced "requires"
// value (see the species tests below), and none is invented to cover it.
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
  const record = FISH_DB.find((item) => validateSpeciesRecord(item) === true);
  assert.ok(record, 'fixture: a valid species record');
  assert.equal(validateSpeciesRecord({ ...record, blackwater: 'requires' }), true);
  assert.equal(validateSpeciesRecord({ ...record, blackwater: 'required' }), 'bad blackwater');
  assert.equal(validateSpeciesRecord({ ...record, blackwater: 'recommended' }), 'bad blackwater');
  assert.equal(buildBlackwater(entries('required')).status, 'off', 'old spelling must not be half-supported');
});

// Rummynose: Seriously Fish describes a blackwater habitat and biotope set-up but says the fish also
// does well in a standard planted aquarium — a preference, not a captive requirement. The modern
// record is authoritative and every layer must agree with it.
test('Rummynose Tetra prefers blackwater in every data layer (not requires)', () => {
  const raw = JSON.parse(readFileSync(ROOT + 'data/stocking-advisor/species.v2.json', 'utf8'));
  const record = raw.find((item) => item.slug === 'rummynose-tetra');
  assert.equal(record.blackwater, 'prefers', 'species.v2.json states it explicitly');
  assert.equal(FISH_DB.find((item) => item.id === 'rummynose').blackwater, 'prefers', 'js/fish-data.js');
  assert.equal(adapter.getSpeciesBySlugV2('rummynose-tetra').blackwater, 'prefers', 'adapter output');
  assert.equal(legacy.getSpeciesById('rummynose').blackwater, 'prefers', 'engine record');
});

test('Rummynose is never failed for tannins: unknown, off and on are all neutral', () => {
  const rummynose = { species: legacy.getSpeciesById('rummynose') };
  for (const water of [TANNINS_NOT_ENTERED, {}, TANNINS_OFF, TANNINS_ON]) {
    const result = evaluateBlackwater(rummynose, water);
    assert.equal(result.severity, 'ok', JSON.stringify(water));
    assert.doesNotMatch(result.reason ?? '', /require|needs/i);
  }
});

test('every selectable "requires" species (if any) follows the unknown / off / on rule', () => {
  const requiring = compute.getSpecies().filter((species) => species.blackwater === 'requires');
  for (const species of requiring) {
    const candidate = { species };
    assert.equal(evaluateBlackwater(candidate, TANNINS_NOT_ENTERED).severity, 'warn', species.id);
    assert.equal(evaluateBlackwater(candidate, TANNINS_OFF).severity, 'bad', species.id);
    assert.equal(evaluateBlackwater(candidate, TANNINS_ON).severity, 'ok', species.id);
  }
  // Documented in WATER_MODEL.md: currently none of the 44 species has a sourced "requires" value.
  assert.deepEqual(requiring.map((species) => species.id), []);
});
