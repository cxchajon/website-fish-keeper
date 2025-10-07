import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const INPUT_PATH = path.join(ROOT_DIR, 'data', 'gear_stands.csv');
const OUTPUT_PATH = path.join(ROOT_DIR, 'assets', 'js', 'generated', 'gear-stands.json');

const ALLOWED_GROUPS = new Map([
  ['5-10', { min: 5, max: 10 }],
  ['10-20', { min: 10, max: 20 }],
  ['20-40', { min: 20, max: 40 }],
  ['40-55', { min: 40, max: 55 }],
  ['55-75', { min: 55, max: 75 }],
  ['75-125', { min: 75, max: 125 }]
]);

const URL_PATTERN = /https?:\/\/\S+/gi;

function parseCSV(text) {
  const rows = [];
  const headers = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '\r') continue;

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(current);
      if (!headers.length) {
        row.forEach((header) => headers.push(String(header || '').trim()));
      } else if (row.some((cell) => cell && cell.length > 0)) {
        const entry = {};
        headers.forEach((header, index) => {
          entry[header] = row[index] !== undefined ? row[index] : '';
        });
        rows.push(entry);
      }
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    if (!headers.length) {
      row.forEach((header) => headers.push(String(header || '').trim()));
    } else if (row.some((cell) => cell && cell.length > 0)) {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = row[index] !== undefined ? row[index] : '';
      });
      rows.push(entry);
    }
  }

  return rows;
}

function sanitizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(URL_PATTERN, ' ')
    .replace(/\\x/gi, '×')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeDimensions(value) {
  const text = sanitizeText(value);
  if (!text) return '';
  return text
    .replace(/[xX]/g, '×')
    .replace(/\s*×\s*/g, '×');
}

function parseCapacity(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

async function build() {
  const csvRaw = await fs.readFile(INPUT_PATH, 'utf8');
  const rows = parseCSV(csvRaw);
  const items = [];

  rows.forEach((row) => {
    const id = sanitizeText(row.id || row.ID || '');
    const group = sanitizeText(row.group || row.Group || '').toLowerCase();
    const normalizedGroup = group;
    const meta = ALLOWED_GROUPS.get(normalizedGroup);
    const skipReason = (!id && !sanitizeText(row.title)) ? 'missing id/title' : !meta ? 'invalid group' : null;
    if (skipReason) {
      console.warn(`[build-gear-stands] Skipping row (${skipReason}):`, id || sanitizeText(row.title || ''));
      return;
    }

    const title = sanitizeText(row.title || row.Title || '');
    if (!title) {
      console.warn('[build-gear-stands] Skipping row (missing title):', id);
      return;
    }

    const groupLabel = sanitizeText(row.group_label || row.groupLabel || '');
    const notes = sanitizeText(row.notes || row.Notes || '');
    const dimensionsIn = sanitizeDimensions(row.dimensions_in || row.dimensions || '');
    const capacityLbs = parseCapacity(row.capacity_lbs || row.capacity || '');
    const brand = sanitizeText(row.brand || row.Brand || '');
    const rawUrl = String(row.amazon_url || row.url || '').trim();
    const amazonUrl = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
    if (rawUrl && !amazonUrl) {
      console.warn('[build-gear-stands] Dropping invalid Amazon URL for', id || title, rawUrl);
    }

    items.push({
      id,
      group: normalizedGroup,
      groupLabel,
      title,
      notes,
      amazonUrl,
      dimensionsIn,
      capacityLbs,
      brand,
      minGallons: meta.min,
      maxGallons: meta.max
    });
  });

  const json = JSON.stringify(items, null, 2);
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${json}\n`, 'utf8');
  return items.length;
}

build()
  .then((count) => {
    console.log(`[build-gear-stands] Wrote ${count} stand entries to ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
  })
  .catch((error) => {
    console.error('[build-gear-stands] Failed:', error);
    process.exitCode = 1;
  });
