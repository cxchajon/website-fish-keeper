import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFilterCatalog } from './make-filter-catalog.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function main() {
  const payload = await generateFilterCatalog({
    csvPath: path.join(ROOT_DIR, 'audit_out', 'filters.csv'),
    targetPath: path.join(ROOT_DIR, 'prototype', 'assets', 'data', 'filters_catalog.json'),
    fallbackModulePath: path.join(ROOT_DIR, 'prototype', 'js', 'catalog-fallback.js'),
  });
  console.log(`[build-prototype] wrote ${payload.items.length} catalog items to prototype/assets/data/filters_catalog.json`);
  console.log('[build-prototype] refreshed fallback module at prototype/js/catalog-fallback.js');
}

main().catch((error) => {
  console.error('[build-prototype] failed:', error);
  process.exitCode = 1;
});
