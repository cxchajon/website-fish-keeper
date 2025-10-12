import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT_DIR, 'data', 'filters.json');
const LOG_DIR = path.join(ROOT_DIR, 'logs');
const OUTPUT_PATH = path.join(LOG_DIR, 'audit_filters_catalog.json');

const VALID_TYPES = new Set(['HOB', 'CANISTER', 'SPONGE']);
const REQUIRED_STRING_FIELDS = ['id', 'name', 'brand'];
const REQUIRED_NUMERIC_FIELDS = ['rated_gph', 'tank_min_g', 'tank_max_g'];

function loadCatalog() {
  const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('Catalog must be an array of products.');
  }
  return data;
}

function normalizeKey(value) {
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  return '';
}

function collectTypeCounts(catalog) {
  const counts = {};
  for (const product of catalog) {
    const type = typeof product?.type === 'string' ? product.type.trim().toUpperCase() : 'UNKNOWN';
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

function auditCatalog(catalog) {
  const missingOrInvalid = [];
  const invalidRanges = [];
  const duplicateIds = [];
  const duplicateNames = [];
  const invalidIndices = new Set();

  const idMap = new Map();
  const nameMap = new Map();

  catalog.forEach((product, index) => {
    const issues = [];

    for (const field of REQUIRED_STRING_FIELDS) {
      const value = product?.[field];
      if (typeof value !== 'string' || !value.trim()) {
        issues.push(`${field} must be a non-empty string`);
      }
    }

    for (const field of REQUIRED_NUMERIC_FIELDS) {
      const value = Number(product?.[field]);
      if (!Number.isFinite(value)) {
        issues.push(`${field} must be a finite number`);
      } else if ((field === 'rated_gph' || field === 'tank_max_g') && value <= 0) {
        issues.push(`${field} must be greater than 0`);
      } else if (field === 'tank_min_g' && value < 0) {
        issues.push(`${field} must be 0 or greater`);
      }
    }

    const type = typeof product?.type === 'string' ? product.type.trim().toUpperCase() : '';
    if (!VALID_TYPES.has(type)) {
      issues.push(`type must be one of ${Array.from(VALID_TYPES).join(', ')}`);
    }

    const min = Number(product?.tank_min_g);
    const max = Number(product?.tank_max_g);
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      invalidRanges.push({
        index,
        id: product?.id ?? null,
        name: product?.name ?? null,
        brand: product?.brand ?? null,
        tank_min_g: min,
        tank_max_g: max,
      });
      invalidIndices.add(index);
    }

    if (issues.length > 0) {
      missingOrInvalid.push({
        index,
        id: product?.id ?? null,
        issues,
      });
      invalidIndices.add(index);
    }

    const idKey = normalizeKey(product?.id);
    if (idKey) {
      if (idMap.has(idKey)) {
        duplicateIds.push({
          id: product?.id ?? null,
          first_index: idMap.get(idKey),
          duplicate_index: index,
        });
        invalidIndices.add(index);
        invalidIndices.add(idMap.get(idKey));
      } else {
        idMap.set(idKey, index);
      }
    }

    const brandKey = normalizeKey(product?.brand);
    const nameKey = normalizeKey(product?.name);
    if (brandKey && nameKey) {
      const combined = `${brandKey}::${nameKey}`;
      if (nameMap.has(combined)) {
        duplicateNames.push({
          brand: product?.brand ?? null,
          name: product?.name ?? null,
          first_index: nameMap.get(combined),
          duplicate_index: index,
        });
        invalidIndices.add(index);
        invalidIndices.add(nameMap.get(combined));
      } else {
        nameMap.set(combined, index);
      }
    }
  });

  const summary = {
    total_products: catalog.length,
    invalid_product_count: invalidIndices.size,
    missing_or_invalid_count: missingOrInvalid.length,
    invalid_range_count: invalidRanges.length,
    duplicate_id_count: duplicateIds.length,
    duplicate_name_count: duplicateNames.length,
    valid_types: Array.from(VALID_TYPES),
    type_counts: collectTypeCounts(catalog),
  };

  return {
    summary,
    issues: {
      missing_or_invalid_fields: missingOrInvalid,
      invalid_ranges: invalidRanges,
      duplicate_ids: duplicateIds,
      duplicate_brand_name: duplicateNames,
    },
  };
}

function writeReport(report) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    catalog_path: path.relative(ROOT_DIR, CATALOG_PATH),
    ...report,
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

function main() {
  try {
    const catalog = loadCatalog();
    const report = auditCatalog(catalog);
    const payload = writeReport(report);
    console.log(`Filter catalog audit written to ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
    console.log(JSON.stringify(payload.summary, null, 2));
  } catch (error) {
    console.error('[audit-filters] Failed:', error.message);
    process.exitCode = 1;
  }
}

main();
