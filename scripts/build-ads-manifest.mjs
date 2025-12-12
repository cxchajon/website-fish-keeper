import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const ADS_IMG_DIR = path.join(ROOT_DIR, 'assets', 'img', 'ads');
const ADS_MANIFEST_DIR = path.join(ROOT_DIR, 'assets', 'ads');
const LINKS_CSV_PATH = path.join(ADS_MANIFEST_DIR, 'links.csv');
const MANIFEST_PATH = path.join(ADS_MANIFEST_DIR, 'manifest.json');
const DEFAULT_HREF = '/store.html';
const DEFAULT_ALT = 'FishKeepingLifeCo promo';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.PNG', '.JPG', '.JPEG', '.WEBP']);

function parseCsv(content) {
  const lines = content.split(/\r?\n/);
  const mapping = new Map();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(',');
    if (parts.length < 3) continue;

    const [filename, href, alt, id] = parts.map((part) => part.trim());
    if (!filename) continue;

    mapping.set(filename, {
      href: href || DEFAULT_HREF,
      alt: alt || DEFAULT_ALT,
      id: id || undefined
    });
  }

  return mapping;
}

async function readLinksMapping() {
  try {
    const content = await fs.readFile(LINKS_CSV_PATH, 'utf8');
    return parseCsv(content);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Unable to read links.csv; falling back to defaults.', error);
    }
    return new Map();
  }
}

function isValidImage(filename) {
  return IMAGE_EXTENSIONS.has(path.extname(filename));
}

async function buildManifest() {
  const links = await readLinksMapping();
  const entries = await fs.readdir(ADS_IMG_DIR, { withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && isValidImage(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const manifest = files.map((filename) => {
    const link = links.get(filename) || {};
    return {
      id: link.id,
      src: `/assets/img/ads/${filename}`,
      href: link.href || DEFAULT_HREF,
      alt: link.alt || DEFAULT_ALT
    };
  });

  await fs.mkdir(ADS_MANIFEST_DIR, { recursive: true });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

buildManifest()
  .then((manifest) => {
    console.log(`Wrote ${manifest.length} entries to ${path.relative(ROOT_DIR, MANIFEST_PATH)}`);
  })
  .catch((error) => {
    console.error('Failed to build ads manifest', error);
    process.exit(1);
  });
