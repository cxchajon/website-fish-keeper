import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { FISH_DB } from '../../js/fish-data.js';

function numberOrNaN(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function buildRange(record, minKeys, maxKeys) {
  let min = NaN;
  let max = NaN;
  if (record && typeof record === 'object') {
    for (const key of minKeys) {
      const value = numberOrNaN(record[key]);
      if (Number.isFinite(value)) {
        min = value;
        break;
      }
    }
    for (const key of maxKeys) {
      const value = numberOrNaN(record[key]);
      if (Number.isFinite(value)) {
        max = value;
        break;
      }
    }
  }
  return { min, max };
}

function isRangeValid(range) {
  return Number.isFinite(range.min) && Number.isFinite(range.max) && range.min < range.max;
}

function resolveActivity(tags, flow) {
  if (tags.includes('fast_swimmer')) return 'high';
  if (tags.includes('aggressive') || tags.includes('semi_aggressive')) return 'high';
  const flowStr = typeof flow === 'string' ? flow.toLowerCase() : '';
  if (flowStr === 'high') return 'high';
  if (tags.includes('slow_long_fins') || tags.includes('long_fins')) return 'low';
  if (tags.includes('bottom_dweller')) return 'low';
  if (flowStr === 'low') return 'low';
  return 'moderate';
}

function resolveBioload(record) {
  const direct = numberOrNaN(record.bioloadGE ?? record.bioload_unit);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }
  const size = numberOrNaN(record.adult_size_in);
  const density = numberOrNaN(record.density_factor);
  const baseSize = Number.isFinite(size) ? size : 2.5;
  const baseDensity = Number.isFinite(density) ? density : 0.01;
  return Number((baseSize ** 3) * baseDensity);
}

function booleanFlag(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeBehavior(behavior) {
  if (Array.isArray(behavior)) {
    return behavior.filter((entry) => typeof entry === 'string');
  }
  return [];
}

function detectShoalMin(record) {
  const { group, min_group } = record;
  if (group && typeof group === 'object') {
    const min = numberOrNaN(group.min);
    if (Number.isFinite(min) && min > 0) {
      return min;
    }
  }
  const fallback = numberOrNaN(min_group);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}

const normalizedSpecies = [];
const adapterIssues = [];

for (const record of FISH_DB) {
  const tags = Array.isArray(record.tags) ? [...record.tags] : [];
  const issues = [];
  const temperature = buildRange(record.temperature, ['min_f', 'min', 'min_c'], ['max_f', 'max', 'max_c']);
  if (!isRangeValid(temperature)) {
    issues.push('invalid temperature range');
  }

  const ph = buildRange(record.ph, ['min'], ['max']);
  if (!isRangeValid(ph)) {
    issues.push('invalid pH range');
  }

  const gH = buildRange(record.gH, ['min_dGH', 'min'], ['max_dGH', 'max']);
  if (!isRangeValid(gH)) {
    issues.push('invalid gH range');
  }

  const kH = buildRange(record.kH, ['min_dKH', 'min'], ['max_dKH', 'max']);
  if (!isRangeValid(kH)) {
    issues.push('invalid kH range');
  }

  const salinity = typeof record.salinity === 'string' ? record.salinity : 'fresh';
  if (!['fresh', 'brackish-low', 'brackish-high', 'dual'].includes(salinity)) {
    issues.push(`unsupported salinity:${String(record.salinity)}`);
  }

  const behaviorTags = sanitizeBehavior(record.behavior);
  const finNipper = tags.includes('fin_nipper') || behaviorTags.some((tag) => tag.toLowerCase().includes('nip'));
  const longFin = tags.includes('long_fins') || tags.includes('slow_long_fins') || behaviorTags.some((tag) => tag.toLowerCase().includes('long_fin'));
  const invertSafeFlag = booleanFlag(record.invert_safe, true);
  const shrimpUnsafe = !invertSafeFlag || tags.includes('predator_shrimp') || tags.includes('predator_snail');
  if (invertSafeFlag && shrimpUnsafe) {
    issues.push('conflicting invert safety flags');
  }

  const shoalMin = detectShoalMin(record);
  const minGroup = numberOrNaN(record.min_group);
  if (shoalMin !== null && Number.isFinite(minGroup) && shoalMin > 0 && minGroup > 0 && Math.abs(shoalMin - minGroup) > 0.1) {
    issues.push('min_group mismatch between fields');
  }

  const aggression = numberOrNaN(record.aggression);
  if (!Number.isFinite(aggression)) {
    issues.push('missing aggression score');
  }

  const baseBioload = resolveBioload(record);
  if (!(baseBioload > 0)) {
    issues.push('bioload unresolved');
  }

  const activity = resolveActivity(tags, record.flow);

  normalizedSpecies.push({
    id: String(record.id ?? ''),
    commonName: String(record.common_name ?? record.name ?? record.id ?? 'unknown'),
    scientificName: String(record.scientific_name ?? ''),
    category: ['fish', 'shrimp', 'snail'].includes(record.category) ? record.category : 'fish',
    temperature,
    ph,
    gH,
    kH,
    salinity: ['fresh', 'brackish-low', 'brackish-high', 'dual'].includes(salinity) ? salinity : 'fresh',
    aggression: Number.isFinite(aggression) ? aggression : 0,
    finNipper,
    longFin,
    shrimpUnsafe,
    invertSafe: invertSafeFlag,
    activity,
    baseBioload,
    behaviorTags,
    tags,
    shoalMin,
    minGroup: Number.isFinite(minGroup) && minGroup > 0 ? minGroup : null,
  });

  if (issues.length) {
    adapterIssues.push({ id: String(record.id ?? 'unknown'), issues });
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../out');
mkdirSync(outDir, { recursive: true });

writeFileSync(path.join(outDir, 'adapter_issues.json'), JSON.stringify(adapterIssues, null, 2));

const summaryLines = [
  '# Adapter Issues',
  '',
  `Total species: ${normalizedSpecies.length}`,
  `Species with issues: ${adapterIssues.length}`,
  '',
];

for (const entry of adapterIssues.slice(0, 50)) {
  summaryLines.push(`- **${entry.id}**: ${entry.issues.join('; ')}`);
}

writeFileSync(path.join(outDir, 'adapter_issues.md'), summaryLines.join('\n'));

export const speciesList = normalizedSpecies;
export const issues = adapterIssues;
