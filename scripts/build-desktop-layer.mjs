import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePath = resolve(root, 'css/ttg-desktop.css');
const targets = [
  resolve(root, 'css/app.bundle.css'),
  resolve(root, 'css/blogs-bundle.min.css'),
  resolve(root, 'css/style.css'),
];
const startMarker = '/* ===== TTG DESKTOP LAYER v1 — generated from css/ttg-desktop.css, do not hand-edit ===== */';
const endMarker = '/* ===== END TTG DESKTOP LAYER ===== */';
const layer = (await readFile(sourcePath, 'utf8')).trim();

for (const targetPath of targets) {
  const current = await readFile(targetPath, 'utf8');
  const startIndex = current.indexOf(startMarker);
  const endIndex = current.indexOf(endMarker);

  if ((startIndex === -1) !== (endIndex === -1)) {
    throw new Error(`Desktop layer markers are incomplete in ${targetPath}`);
  }

  const replacement = `\n\n${startMarker}\n${layer}\n${endMarker}\n`;
  let next;

  if (startIndex === -1) {
    next = `${current.trimEnd()}${replacement}`;
  } else {
    const suffix = current.slice(endIndex + endMarker.length);
    if (suffix.trim()) {
      throw new Error(`Desktop layer must be the final block in ${targetPath}`);
    }
    next = `${current.slice(0, startIndex).trimEnd()}${replacement}`;
  }

  if (next !== current) {
    await writeFile(targetPath, next, 'utf8');
  }
}

console.log('Desktop layer synchronized to the shared shipping stylesheets.');
