import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { loadFilterCatalog, filterByTank } from '../js/catalog-loader.js';
import {
  effectiveCapacity,
  computePercent
} from '../assets/js/proto-filtration-math.js';
import { getShouldRestoreVariantFocus } from '../../js/focus-restore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prototypeDir = path.resolve(__dirname, '..');
const catalogPath = path.join(prototypeDir, 'assets', 'data', 'filters_catalog.json');

async function createFsFetch() {
  const raw = await readFile(catalogPath, 'utf8');
  const json = JSON.parse(raw);
  return {
    ok: true,
    status: 200,
    json: async () => json,
  };
}

async function loadCatalogFromDisk() {
  return loadFilterCatalog({ fetchImpl: createFsFetch });
}

function computeBioloadPercent(filters, gallons, baseBioload, capacity) {
  const baseCapacity = Number.isFinite(capacity) && capacity > 0 ? capacity : gallons;
  const effectiveCap = effectiveCapacity(baseCapacity, filters);
  return computePercent(baseBioload, effectiveCap);
}

test('catalog smoke: >30 items and source tagged', async () => {
  const payload = await loadCatalogFromDisk();
  assert.ok(payload && typeof payload === 'object', 'payload should be an object');
  assert.ok(Array.isArray(payload.items), 'payload.items should be an array');
  assert.ok(payload.items.length > 30, 'catalog should expose more than 30 items');
  assert.ok(
    ['NETWORK', 'CACHE', 'FALLBACK'].includes(payload.source),
    'payload should include a source indicator',
  );
});

test('tank size filtering returns distinct counts', async () => {
  const payload = await loadCatalogFromDisk();
  const small = filterByTank(payload.items, 10);
  const medium = filterByTank(payload.items, 40);
  assert.notStrictEqual(
    small.length,
    medium.length,
    '10 gallon and 40 gallon tanks should yield distinct option counts',
  );
});

test('adding a sponge filter never increases bioload percent', () => {
  const gallons = 40;
  const baseBioload = 80;
  const capacity = 120;
  const hobOnly = [{ type: 'HOB', rated_gph: 200 }];
  const hobPlusSponge = [
    { type: 'HOB', rated_gph: 200 },
    { type: 'SPONGE', rated_gph: 120 },
  ];
  const percentHob = computeBioloadPercent(hobOnly, gallons, baseBioload, capacity);
  const percentWithSponge = computeBioloadPercent(hobPlusSponge, gallons, baseBioload, capacity);
  assert.ok(
    percentWithSponge <= percentHob,
    `bioload percent should not increase when adding sponge support (was ${percentHob} now ${percentWithSponge})`,
  );
});

test('focus-restorer shim provides safe fallback', () => {
  const fallback = getShouldRestoreVariantFocus({});
  assert.equal(typeof fallback, 'function', 'fallback should be a function');
  assert.doesNotThrow(() => fallback(), 'calling fallback should not throw');

  let invoked = false;
  const customGlobal = {
    shouldRestoreVariantFocus() {
      invoked = true;
      return true;
    },
  };
  const restorer = getShouldRestoreVariantFocus(customGlobal);
  assert.strictEqual(restorer, customGlobal.shouldRestoreVariantFocus, 'custom helper should be returned directly');
  assert.equal(restorer(), true, 'custom helper should run and return its result');
  assert.ok(invoked, 'custom helper should be invoked');
});
