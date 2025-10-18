import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const manifestPath = path.join(repoRoot, '.footer.lock.json');

const loadManifest = async () => {
  try {
    const raw = await readFile(manifestPath, 'utf8');
    const data = JSON.parse(raw);
    if (!data.files || typeof data.files !== 'object') {
      throw new Error('Manifest missing "files" map.');
    }
    return data;
  } catch (error) {
    throw new Error(`Unable to read footer lock manifest at ${manifestPath}: ${error.message}`);
  }
};

const sha256 = async (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  try {
    const buffer = await readFile(filePath);
    return createHash('sha256').update(buffer).digest('hex');
  } catch (error) {
    throw new Error(`Failed to hash ${relativePath}: ${error.message}`);
  }
};

const run = async () => {
  const manifest = await loadManifest();
  const mismatches = [];

  for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
    const actualHash = await sha256(relativePath);
    if (actualHash !== expectedHash) {
      mismatches.push({ relativePath, expectedHash, actualHash });
    }
  }

  if (mismatches.length === 0) {
    return;
  }

  const bypass = process.env.APPROVED_FOOTER_CHANGE === '1';
  const header = ['Footer integrity check failed.'];
  mismatches.forEach(({ relativePath, expectedHash, actualHash }) => {
    header.push(` - ${relativePath}: expected ${expectedHash}, saw ${actualHash}`);
  });
  header.push('Footer is LOCKED. Do not modify without explicit approval. To proceed, set APPROVED_FOOTER_CHANGE=1.');

  const message = header.join('\n');

  if (bypass) {
    console.warn(message);
    return;
  }

  console.error(message);
  process.exitCode = 1;
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
