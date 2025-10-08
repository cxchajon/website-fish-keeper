import { readFile } from 'node:fs/promises';

const REQUIRED_COLUMNS = ['product_id', 'title', 'notes', 'amazon_url', 'length_range', 'rel'];
const LENGTH_VALUES = ['12-20', '20-24', '24-30', '30-36', '36-48', '48-up'];
const AFFILIATE_TAG = 'fishkeepingli-20';

function parseCsv(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      current.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      current.push(field);
      rows.push(current);
      current = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows.filter((row) => row.length > 0 && !(row.length === 1 && row[0].trim() === ''));
}

function normalizeRow(row) {
  return row.map((value) => value.trim());
}

function hasAffiliateTag(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'amzn.to') {
      return true;
    }
    return parsed.searchParams.get('tag') === AFFILIATE_TAG;
  } catch (error) {
    return false;
  }
}

async function main() {
  const csvPath = new URL('../data/gear_lighting.csv', import.meta.url);
  const text = await readFile(csvPath, 'utf8');
  const [headerRow, ...dataRows] = parseCsv(text).map(normalizeRow);
  const headerSet = new Set(headerRow);
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !headerSet.has(col));

  const errors = [];
  if (missingColumns.length > 0) {
    errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  const counts = Object.fromEntries(LENGTH_VALUES.map((value) => [value, 0]));

  dataRows.forEach((row, index) => {
    if (row.length === 1 && row[0].trim() === '') {
      return;
    }
    const record = Object.fromEntries(
      headerRow.map((col, idx) => [col, row[idx] ?? ''])
    );
    const productId = record.product_id || `row ${index + 2}`;

    const lengthRange = record.length_range;
    if (!LENGTH_VALUES.includes(lengthRange)) {
      errors.push(`Row ${productId}: invalid length_range "${lengthRange}"`);
    } else {
      counts[lengthRange] += 1;
    }

    const amazonUrl = record.amazon_url;
    if (!amazonUrl) {
      errors.push(`Row ${productId}: missing amazon_url`);
    } else if (!amazonUrl.startsWith('https://')) {
      errors.push(`Row ${productId}: amazon_url must start with https://`);
    } else {
      try {
        new URL(amazonUrl);
        if (!hasAffiliateTag(amazonUrl)) {
          errors.push(`Row ${productId}: amazon_url missing affiliate tag "${AFFILIATE_TAG}"`);
        }
      } catch (error) {
        errors.push(`Row ${productId}: invalid amazon_url`);
      }
    }

    const rel = record.rel;
    if (!rel) {
      errors.push(`Row ${productId}: missing rel value`);
    }
  });

  console.log('Length bucket counts:');
  LENGTH_VALUES.forEach((value) => {
    console.log(`  ${value}: ${counts[value]}`);
  });

  if (errors.length > 0) {
    console.error('\nFound CSV issues:');
    errors.forEach((err) => console.error(`- ${err}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
