import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const INPUT_PATH = path.join(ROOT_DIR, 'data', 'gear_stands.csv');
const OUTPUT_PATH = path.join(ROOT_DIR, 'assets', 'js', 'generated', 'gear-stands.json');

const GROUP_METADATA = new Map([
  ['5-10', { min: 5, max: 10 }],
  ['10-20', { min: 10, max: 20 }],
  ['20-40', { min: 20, max: 40 }],
  [
    '40-55',
    {
      min: 40,
      max: 55,
      id: 'stands_40_55',
      label: 'Recommended Stands for 40–55 Gallons',
      intro:
        'Choose a stand rated for your filled tank weight (~8.3 lbs/gal) plus your aquascape. Opt for reinforced frames and confirm everything is level before filling.',
      introText:
        'Choose a stand rated for your filled tank weight (~8.3 lbs/gal) plus your aquascape. Opt for reinforced frames and confirm everything is level before filling.'
    }
  ],
  [
    '55-75',
    {
      min: 55,
      max: 75,
      id: 'stands_55_75',
      label: 'Recommended Stands for 55–75 Gallon Tanks',
      intro:
        'For 55–75 gallon tanks, choose a stand rated for at least 75 gallons. Larger setups with substrate, décor, and rockwork can exceed 900 lbs—always add a safety margin.',
      introText:
        'For 55–75 gallon tanks, choose a stand rated for at least 75 gallons. Larger setups with substrate, décor, and rockwork can exceed 900 lbs—always add a safety margin.',
      infoButtonKey: 'stands_55_75_info',
      infoButtonText:
        'A filled 55-gallon tank can weigh over 600 lbs; a 75-gallon can exceed 900 lbs. Choose a stand whose capacity is greater than the full tank weight, match the footprint exactly, and confirm the stand is level before filling.',
      infoButtonLabel: 'Stand safety guidance for 55–75 gallon tanks'
    }
  ],
  ['75-125', { min: 75, max: 125 }]
]);

const ALLOWED_GROUPS = GROUP_METADATA;

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

function getField(row, ...keys) {
  for (const key of keys) {
    if (key in row && row[key] !== undefined) return row[key];
    const lower = key.toLowerCase();
    if (lower in row && row[lower] !== undefined) return row[lower];
    const upper = key.toUpperCase();
    if (upper in row && row[upper] !== undefined) return row[upper];
  }
  return '';
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatDimensions(length, width, height) {
  const parts = [length, width, height]
    .map((value) => (Number.isFinite(value) ? Number(value).toFixed(2).replace(/\.00$/, '') : ''))
    .filter((value) => value !== '');
  return parts.length === 3 ? parts.join('×') : '';
}

function createStandId(range, title, existingIds) {
  const safeRange = sanitizeText(range || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const baseTitle = sanitizeText(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '') || 'stand';
  const base = [safeRange || 'stand', baseTitle].filter(Boolean).join('-');
  let candidate = base;
  let suffix = 1;
  while (existingIds.has(candidate) || !candidate) {
    candidate = `${base}-${suffix += 1}`;
  }
  existingIds.add(candidate);
  return candidate;
}

async function build() {
  const csvRaw = await fs.readFile(INPUT_PATH, 'utf8');
  const rows = parseCSV(csvRaw);
  const items = [];
  const seenIds = new Set();

  rows.forEach((row) => {
    const range = sanitizeText(
      getField(row, 'tank_range', 'range', 'group', 'Group', 'Tank_Range')
    ).toLowerCase();
    const meta = ALLOWED_GROUPS.get(range);
    const title = sanitizeText(getField(row, 'title', 'Product_Name', 'product', 'Title'));
    if (!title || !meta) {
      const reason = !title ? 'missing title' : 'invalid group';
      console.warn(`[build-gear-stands] Skipping row (${reason}):`, title || range || '');
      return;
    }

    const metaConfig = meta || {};
    const groupLabel = sanitizeText(getField(row, 'group_label', 'Group_Label', 'header')) || metaConfig.label || '';
    const groupTip = sanitizeText(getField(row, 'group_tip', 'Group_Tip')) || metaConfig.tip || '';
    const introText = sanitizeText(getField(row, 'intro_text', 'Intro_Text')) || metaConfig.introText || '';
    const infoButtonKey = sanitizeText(getField(row, 'info_button_key')) || metaConfig.infoButtonKey || '';
    const infoButtonText = sanitizeText(getField(row, 'info_button_text')) || metaConfig.infoButtonText || '';
    const infoButtonLabel = sanitizeText(getField(row, 'info_button_label')) || metaConfig.infoButtonLabel || '';
    const subgroup = sanitizeText(getField(row, 'subgroup', 'Subgroup'));
    const notes = sanitizeText(getField(row, 'notes', 'Notes', 'benefit'));
    const material = sanitizeText(getField(row, 'material', 'Material'));
    const color = sanitizeText(getField(row, 'color', 'Color'));
    const brand = sanitizeText(getField(row, 'brand', 'Brand'));
    const affiliate = sanitizeText(getField(row, 'affiliate')) || 'amazon';
    const tag = sanitizeText(getField(row, 'tag')) || 'fishkeepingli-20';

    const lengthIn = toNumber(getField(row, 'length_in', 'Length_in', 'length'));
    const widthIn = toNumber(getField(row, 'width_in', 'Width_in', 'width'));
    const heightIn = toNumber(getField(row, 'height_in', 'Height_in', 'height'));
    const dimensionsIn = sanitizeDimensions(
      getField(row, 'dimensions_in', 'Dimensions_in', 'dimensions') || formatDimensions(lengthIn, widthIn, heightIn)
    );
    const capacityLbs = parseCapacity(getField(row, 'capacity_lbs', 'Capacity_Lbs', 'capacity'));

    const rawUrl = String(getField(row, 'amazon_url', 'Amazon_Link', 'url') || '').trim();
    const amazonUrl = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
    if (rawUrl && !amazonUrl) {
      console.warn('[build-gear-stands] Dropping invalid Amazon URL for', title, rawUrl);
    }

    const rawId = sanitizeText(getField(row, 'id', 'ID'));
    const id = rawId || createStandId(range, title, seenIds);

    items.push({
      id,
      group: range,
      groupLabel,
      groupTip,
      introText,
      infoButtonKey,
      infoButtonText,
      infoButtonLabel,
      subgroup,
      title,
      notes,
      amazonUrl,
      dimensionsIn,
      capacityLbs,
      brand,
      material,
      color,
      affiliate,
      tag,
      lengthIn,
      widthIn,
      heightIn,
      minGallons: metaConfig.min,
      maxGallons: metaConfig.max
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
