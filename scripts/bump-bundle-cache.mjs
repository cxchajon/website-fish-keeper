import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const version = process.argv[2];

if (!version) {
  throw new Error('Usage: node scripts/bump-bundle-cache.mjs <version>');
}

const root = resolve(import.meta.dirname, '..');
const bundlePatterns = [
  /app\.bundle\.css\?v=[^"'\s>]+/g,
  /blogs-bundle\.min\.css\?v=[^"'\s>]+/g,
  /style\.css\?v=[^"'\s>]+/g,
];

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(filePath));
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(filePath);
  }

  return files;
}

let updated = 0;

for (const filePath of await htmlFiles(root)) {
  const current = await readFile(filePath, 'utf8');
  const next = bundlePatterns.reduce(
    (html, pattern) => html.replace(pattern, (match) => `${match.split('?')[0]}?v=${version}`),
    current,
  );

  if (next !== current) {
    await writeFile(filePath, next, 'utf8');
    updated += 1;
  }
}

console.log(`Updated bundle cache version in ${updated} HTML files.`);
