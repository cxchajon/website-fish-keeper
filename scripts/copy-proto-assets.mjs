import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT_DIR, 'prototype', 'assets', 'data', 'filters_catalog.json');
const DEST_PATH = path.join(ROOT_DIR, 'dist', 'prototype', 'assets', 'data', 'filters_catalog.json');

async function ensureSourceExists() {
  try {
    await stat(SOURCE_PATH);
  } catch (error) {
    throw new Error(`filters_catalog.json not found at ${SOURCE_PATH}`);
  }
}

async function main() {
  await ensureSourceExists();
  await mkdir(path.dirname(DEST_PATH), { recursive: true });
  await copyFile(SOURCE_PATH, DEST_PATH);
  console.log(`[copy-proto-assets] copied filters catalog to ${DEST_PATH}`);
}

main().catch((error) => {
  console.error('[copy-proto-assets] failed:', error);
  process.exitCode = 1;
});
