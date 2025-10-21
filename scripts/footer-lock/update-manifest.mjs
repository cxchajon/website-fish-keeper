import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const VERSION = '1.4.6';
const TRACKED_FILES = [
  'footer.html',
  'assets/sprite.socials.svg',
  'js/footer-loader.js',
  'css/site.css',
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const manifestPath = path.join(repoRoot, '.footer.lock.json');

const hashFile = async (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
};

const run = async () => {
  const files = {};
  for (const relativePath of TRACKED_FILES) {
    files[relativePath] = await hashFile(relativePath);
  }

  const manifest = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    files,
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Updated ${manifestPath}`);
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
