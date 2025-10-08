import { parseCSV } from '../utils/csvLoader.js';
import { bucketizeByLength, resolveBucketId } from './grouping.js';

const DEFAULT_REL = 'sponsored noopener noreferrer';
const CSV_URL = new URL('../../data/gear_lighting.csv', import.meta.url);

function normaliseCell(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function adaptRow(entry) {
  const lengthRange = resolveBucketId(entry.length_range ?? entry.lengthRange ?? entry.range_id ?? '');
  if (!lengthRange) {
    return null;
  }

  const productId = normaliseCell(entry.product_id ?? entry.Product_ID ?? entry.Item_ID ?? '');
  const title = normaliseCell(entry.title ?? entry.Product_Name ?? entry.Option_Label ?? '');
  if (!productId || !title) {
    return null;
  }

  const notes = normaliseCell(entry.notes ?? entry.Notes ?? '');
  const amazonUrl = normaliseCell(entry.amazon_url ?? entry.Amazon_Link ?? entry.amazonUrl ?? '');
  const rel = normaliseCell(entry.rel ?? entry.Rel ?? DEFAULT_REL) || DEFAULT_REL;

  return {
    product_id: productId,
    title,
    notes,
    amazon_url: amazonUrl,
    length_range: lengthRange,
    rel,
  };
}

export function parseLights(text) {
  const rows = parseCSV(text);
  return rows
    .map(adaptRow)
    .filter((entry) => entry && entry.product_id && entry.title);
}

export async function loadLights() {
  if (CSV_URL.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    const text = await readFile(CSV_URL, 'utf8');
    return parseLights(text);
  }
  if (typeof fetch === 'function') {
    const response = await fetch(CSV_URL);
    if (!response.ok) {
      throw new Error(`Failed to load lights CSV: ${response.status}`);
    }
    const text = await response.text();
    return parseLights(text);
  }
  throw new Error('Unable to load lights CSV in this environment.');
}

export async function loadLightsByLength() {
  const lights = await loadLights();
  return bucketizeByLength(lights);
}
