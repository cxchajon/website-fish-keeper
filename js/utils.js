import { TANK_SIZES, getTankById } from './tankSizes.js';

const FALLBACK_TANK_ID = '29g';
const LEGACY_20_WARNING_KEY = 'legacy-20';
const LEGACY_REMOVED_WARNING_KEY = 'legacy-fallback';
const warningsIssued = new Set();

const AMBIGUOUS_20_TOKENS = new Set([
  '20',
  '20g',
  '20 gallon',
  '20 gallon tank',
  '20-gallon',
  '20 gal',
  '20gal',
  'twenty gallon',
]);

function warnOnce(key, message) {
  if (warningsIssued.has(key)) {
    return;
  }
  warningsIssued.add(key);
  console.warn(message);
}

function normaliseWords(value) {
  return value.replace(/[^a-z0-9]+/gu, ' ').trim();
}

function resolveByGallons(token) {
  const numeric = Number.parseFloat(token);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  if (Math.abs(numeric - 20) < 0.001) {
    warnOnce(LEGACY_20_WARNING_KEY, "Mapped legacy '20 Gallon' to '20 Gallon Long' (20l).");
    return '20l';
  }
  const match = TANK_SIZES.find((tank) => Math.abs(tank.gallons - numeric) < 0.001);
  return match ? match.id : null;
}

export function normalizeLegacyTankSelection(value) {
  if (value == null) {
    return null;
  }
  const raw = typeof value === 'string' ? value : String(value);
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();

  const direct = getTankById(lower);
  if (direct) {
    return direct.id;
  }

  const withoutPrefix = lower.replace(/^g(?=\d)/u, '');
  const prefixMatch = getTankById(withoutPrefix);
  if (prefixMatch) {
    return prefixMatch.id;
  }

  const labelMatch = TANK_SIZES.find((tank) => tank.label.toLowerCase() === lower);
  if (labelMatch) {
    return labelMatch.id;
  }

  const condensed = normaliseWords(lower);
  if (!condensed) {
    return null;
  }

  const condensedLabelMatch = TANK_SIZES.find((tank) => normaliseWords(tank.label.toLowerCase()) === condensed);
  if (condensedLabelMatch) {
    return condensedLabelMatch.id;
  }

  if (condensed.includes('20') && condensed.includes('high')) {
    return '20h';
  }
  if (condensed.includes('20') && condensed.includes('long')) {
    return '20l';
  }

  if (AMBIGUOUS_20_TOKENS.has(lower) || AMBIGUOUS_20_TOKENS.has(condensed)) {
    warnOnce(LEGACY_20_WARNING_KEY, "Mapped legacy '20 Gallon' to '20 Gallon Long' (20l).");
    return '20l';
  }

  const gallonsMatch = resolveByGallons(lower) ?? resolveByGallons(condensed);
  if (gallonsMatch) {
    return gallonsMatch;
  }

  warnOnce(LEGACY_REMOVED_WARNING_KEY, 'Legacy tank removed. Fallback to 29 Gallon (29g).');
  return FALLBACK_TANK_ID;
}
