import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFilterCatalog, filterByTank, BIG_FALLBACK_LIST } from '../js/catalog-loader.js';

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

test('catalog loads with nonzero items (either JSON or fallback)', async () => {
  const items = await loadFilterCatalog({
    fetchImpl: createFsFetch,
  });
  assert.ok(Array.isArray(items), 'loadFilterCatalog should resolve to an array');
  assert.ok(items.length > 20, 'catalog should include more than 20 entries');
  assert.ok(
    items.every((item) => typeof item.id === 'string' && item.id && Number.isFinite(item.gphRated)),
    'all catalog items should include id and numeric gphRated',
  );
});

test('size filtering differs across tanks', () => {
  const smallTank = filterByTank(BIG_FALLBACK_LIST, 10);
  const mediumTank = filterByTank(BIG_FALLBACK_LIST, 40);
  assert.notStrictEqual(
    smallTank.length,
    mediumTank.length,
    'different tank sizes should yield distinct option counts',
  );
});

test('sponge typed items exist', () => {
  assert.ok(
    BIG_FALLBACK_LIST.some((item) => item.type === 'SPONGE'),
    'fallback catalog should include sponge filters',
  );
});
