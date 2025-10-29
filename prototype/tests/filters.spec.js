import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFilterCatalog, filterByTank } from '../js/catalog-loader.js';

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

async function loadCatalogItems() {
  const result = await loadFilterCatalog({
    fetchImpl: createFsFetch,
  });
  return result;
}

test('catalog loads with nonzero items (either JSON or fallback)', async () => {
  const result = await loadCatalogItems();
  assert.ok(result && typeof result === 'object', 'loadFilterCatalog should resolve to an object payload');
  assert.ok(Array.isArray(result.items), 'payload should include an items array');
  assert.ok(result.items.length > 20, 'catalog should include more than 20 entries');
  assert.ok(
    ['NETWORK', 'CACHE', 'FALLBACK'].includes(result.source),
    'payload should include a recognized source tag',
  );
  assert.ok(
    result.items.every((item) => typeof item.id === 'string' && item.id && Number.isFinite(item.gphRated)),
    'all catalog items should include id and numeric gphRated',
  );
});

test('size filtering differs across tanks', async () => {
  const { items } = await loadCatalogItems();
  const smallTank = filterByTank(items, 10);
  const mediumTank = filterByTank(items, 40);
  assert.notStrictEqual(
    smallTank.length,
    mediumTank.length,
    'different tank sizes should yield distinct option counts',
  );
});

test('sponge typed items exist', async () => {
  const { items } = await loadCatalogItems();
  assert.ok(
    items.some((item) => item.type === 'SPONGE'),
    'catalog should include sponge filters',
  );
});
