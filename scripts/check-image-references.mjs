import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'playwright-report', 'test-results']);
const failures = [];
let referenceCount = 0;

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : htmlFiles(resolve(directory, entry.name));
    }
    return entry.isFile() && entry.name.endsWith('.html') ? [resolve(directory, entry.name)] : [];
  });
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function checkReference(value, file, source, offset, attribute) {
  const url = value.replace(/&amp;/g, '&').split(/[?#]/, 1)[0];
  if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) return;

  referenceCount += 1;
  const decodedUrl = decodeURIComponent(url);
  const asset = decodedUrl.startsWith('/')
    ? resolve(root, `.${decodedUrl}`)
    : resolve(dirname(file), decodedUrl);

  if (!asset.startsWith(`${root}/`) || !existsSync(asset) || !statSync(asset).isFile()) {
    failures.push(`${relative(root, file)}:${lineNumber(source, offset)} ${attribute}="${value}"`);
  }
}

for (const file of htmlFiles(root)) {
  const source = readFileSync(file, 'utf8');
  const elements = source.matchAll(/<(?:img|source)\b[^>]*>/gi);

  for (const element of elements) {
    const markup = element[0];
    for (const attribute of markup.matchAll(/(?:^|\s)(src|srcset)\s*=\s*(["'])(.*?)\2/gi)) {
      const [, name, , value] = attribute;
      const candidates = name.toLowerCase() === 'srcset'
        ? value.split(',').map((candidate) => candidate.trim().split(/\s+/, 1)[0])
        : [value.trim()];

      for (const candidate of candidates) {
        checkReference(candidate, file, source, element.index + attribute.index, name.toLowerCase());
      }
    }
  }
}

if (failures.length) {
  console.error('Missing local image references:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Checked ${referenceCount} local image references; every asset exists.`);
}
