import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT_DIR, 'data', 'filters.json');
const TARGET_PATH = path.join(ROOT_DIR, 'prototype', 'assets', 'data', 'filters_catalog.json');
const FALLBACK_MODULE_PATH = path.join(ROOT_DIR, 'prototype', 'js', 'catalog-fallback.js');

function assignRange(gph) {
  const rated = Number(gph) || 0;
  if (rated <= 120) {
    return { min: 0, max: 20 };
  }
  if (rated <= 220) {
    return { min: 20, max: 40 };
  }
  if (rated <= 400) {
    return { min: 40, max: 75 };
  }
  if (rated <= 600) {
    return { min: 55, max: 125 };
  }
  return { min: 75, max: 210 };
}

function normalizeType(value) {
  if (typeof value !== 'string') {
    return 'HOB';
  }
  const upper = value.trim().toUpperCase();
  if (!upper) {
    return 'HOB';
  }
  return upper;
}

async function main() {
  const raw = await readFile(SOURCE_PATH, 'utf8');
  const source = JSON.parse(raw);
  const deduped = new Map();
  source.forEach((entry) => {
    if (!entry || typeof entry.id !== 'string') {
      return;
    }
    const id = entry.id.trim();
    if (!id || deduped.has(id)) {
      return;
    }
    const gph = Number(entry.rated_gph ?? entry.gphRated ?? entry.gph);
    if (!Number.isFinite(gph) || gph <= 0) {
      return;
    }
    const { min, max } = assignRange(gph);
    deduped.set(id, {
      id,
      brand: entry.brand?.trim() || '',
      name: entry.name?.trim() || '',
      type: normalizeType(entry.type),
      gphRated: Math.round(gph),
      minGallons: min,
      maxGallons: max,
    });
  });

  const items = Array.from(deduped.values()).sort((a, b) => {
    const typeCompare = a.type.localeCompare(b.type);
    if (typeCompare !== 0) {
      return typeCompare;
    }
    const brandCompare = a.brand.localeCompare(b.brand);
    if (brandCompare !== 0) {
      return brandCompare;
    }
    const gphCompare = a.gphRated - b.gphRated;
    if (gphCompare !== 0) {
      return gphCompare;
    }
    return a.name.localeCompare(b.name);
  });

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    items,
  };

  await mkdir(path.dirname(TARGET_PATH), { recursive: true });
  await writeFile(TARGET_PATH, `${JSON.stringify(payload, null, 2)}\n`);

  const fallbackModule = [
    '// Auto-generated fallback catalog for the prototype loader.\n',
    '// Derived from prototype/assets/data/filters_catalog.json\n',
    `export const FALLBACK_FILTER_CATALOG_VERSION = ${JSON.stringify(payload.version)};\n`,
    `export const FALLBACK_FILTER_CATALOG_GENERATED_AT = ${JSON.stringify(payload.generatedAt)};\n`,
    `export const FALLBACK_FILTER_CATALOG = ${JSON.stringify(payload.items, null, 2)};\n`,
  ].join('');
  await writeFile(FALLBACK_MODULE_PATH, fallbackModule);

  console.log(`[build-prototype] wrote ${items.length} catalog items to ${TARGET_PATH}`);
  console.log(`[build-prototype] refreshed fallback module at ${FALLBACK_MODULE_PATH}`);
}

main().catch((error) => {
  console.error('[build-prototype] failed:', error);
  process.exitCode = 1;
});
