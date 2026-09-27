/**
 * Stocking Advisor filtration model (Phase 2C). Methodology: data/stocking-advisor/FILTRATION_MODEL.md
 *
 * Filtration does NOT change the bioload percentage. The percentage is livestock load ÷ tank
 * capacity only; filtration is reported as its own adequacy check beside it, so choosing a filter
 * can raise a warning but can never make a heavily stocked tank look lighter.
 *
 * The earlier "Relative Biological Capacity" model multiplied capacity by up to 1.6× from the filter
 * TYPE alone (a canister entered at 1 GPH got the full bonus, a powerhead got +30 %). The tool cannot
 * see media volume, media condition or whether the filter is cycled, so no capacity bonus remains.
 *
 * What the model does use:
 *   - role: a device either holds biological media ("biological") or only moves water
 *     ("circulation": powerheads/wavemakers). Only biological devices count as filtration.
 *   - flow: the manufacturer's rated GPH, treated as an upper-bound estimate of the flow through
 *     the media (real flow is lower once media loads and head loss apply).
 *   - turnover: rated GPH ÷ nominal tank gallons (the size the user selected).
 *
 * Biological-filter adequacy is only a conservative floor on flow through media. It does not use
 * species flow preferences (those describe circulation, which a powerhead can supply), and total
 * turnover is not treated as a measure of the current a fish feels: outlet type, spray bars, baffles
 * and pump direction change local flow at the same turnover.
 */

export const FILTER_ROLES = Object.freeze({
  BIOLOGICAL: 'biological',
  CIRCULATION: 'circulation',
});

// Device types that move water but hold no filter media.
const CIRCULATION_ONLY_TYPES = new Set(['POWERHEAD', 'WAVEMAKER', 'CIRCULATIONPUMP', 'CIRCULATION']);

// Below this many biological-filter tank volumes per hour a stocked tank is treated as effectively
// unfiltered (the long-standing "turnover < 2×" floor of the advisor).
export const MIN_BIOLOGICAL_TURNOVER = 2;

// Per-device input ceiling, matching the entry field.
export const MAX_DEVICE_GPH = 1500;

export const FILTRATION_LEVELS = Object.freeze({
  NONE: 'none', // nothing entered
  CIRCULATION_ONLY: 'circulation-only', // only powerheads entered
  VERY_LOW: 'very-low', // biological turnover below MIN_BIOLOGICAL_TURNOVER
  ADEQUATE: 'adequate', // at or above the floor
});

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function toNum(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const FLOW_KEYS = ['rated_gph', 'ratedGph', 'gph', 'gphRated', 'flow', 'flowGPH'];
const TYPE_KEYS = ['type', 'kind', 'filterType', 'resolvedType'];

function parseFlow(filter) {
  for (const key of FLOW_KEYS) {
    if (filter && key in filter) {
      const candidate = toNum(filter[key], NaN);
      if (Number.isFinite(candidate) && candidate > 0) {
        return Math.min(candidate, MAX_DEVICE_GPH);
      }
    }
  }
  return 0;
}

// Upper-case letters only, e.g. "Hang-on-back" -> "HANGONBACK".
export function filterTypeKey(filter) {
  const source = typeof filter === 'string' ? { type: filter } : filter ?? {};
  for (const key of TYPE_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toUpperCase().replace(/[^A-Z]/g, '');
    }
  }
  return '';
}

export function filterRole(filter) {
  return CIRCULATION_ONLY_TYPES.has(filterTypeKey(filter)) ? FILTER_ROLES.CIRCULATION : FILTER_ROLES.BIOLOGICAL;
}

// How a device's filtration capacity is expressed (sponge-filter migration design, sections 7–9).
// Every filter scores by flow today; the other methods are carried through saved state and the
// compute path but are not read by the scoring below yet (sponge migration phase B).
export const CAPACITY_METHODS = Object.freeze({
  FLOW: 'flow',
  MANUFACTURER_RATING: 'manufacturer_rating',
  TANK_COMPATIBILITY: 'tank_compatibility',
});
const KNOWN_CAPACITY_METHODS = new Set(Object.values(CAPACITY_METHODS));
const KNOWN_RATING_STATUSES = new Set(['verified', 'needs_review', 'needed']);
const MAX_RATED_GALLONS = 10000;
const MAX_ID_LENGTH = 128;

// A known method, or FLOW (the only method scored today) when absent or unrecognised.
export function resolveCapacityMethod(filter) {
  const value = typeof filter?.capacityMethod === 'string' ? filter.capacityMethod.trim() : '';
  return KNOWN_CAPACITY_METHODS.has(value) ? value : CAPACITY_METHODS.FLOW;
}

function cleanId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_ID_LENGTH ? trimmed : null;
}

function cleanGallons(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 && num <= MAX_RATED_GALLONS ? num : null;
}

// Identity and future capacity fields that must survive every sanitising step unchanged. Only valid
// values are copied, so an entry without them keeps its current shape. Nothing here is scored.
export function pickPassthroughFields(filter) {
  const out = {};
  if (!filter || typeof filter !== 'object') return out;
  const instanceId = cleanId(filter.instanceId);
  if (instanceId) out.instanceId = instanceId;
  const productId = cleanId(filter.productId);
  if (productId) out.productId = productId;
  const method = typeof filter.capacityMethod === 'string' ? filter.capacityMethod.trim() : '';
  if (KNOWN_CAPACITY_METHODS.has(method)) out.capacityMethod = method;
  const maxGallons = cleanGallons(filter.manufacturerMaxGallons ?? filter.ratedMaxGallons);
  if (maxGallons !== null) out.manufacturerMaxGallons = maxGallons;
  const minGallons = cleanGallons(filter.manufacturerMinGallons);
  if (minGallons !== null) out.manufacturerMinGallons = minGallons;
  if (KNOWN_RATING_STATUSES.has(filter.ratingStatus)) out.ratingStatus = filter.ratingStatus;
  return out;
}

export function normalizeFilter(filter) {
  if (!filter || typeof filter !== 'object') {
    return null;
  }
  const ratedGph = parseFlow(filter);
  return {
    id: typeof filter.id === 'string' && filter.id ? filter.id : null,
    source: typeof filter.source === 'string' && filter.source ? filter.source : null,
    label: typeof filter.label === 'string' && filter.label ? filter.label : null,
    type: filterTypeKey(filter) || null,
    role: filterRole(filter),
    ratedGph,
    rated_gph: ratedGph,
    ...pickPassthroughFields(filter),
  };
}

// Devices without a positive flow are dropped: they cannot be assessed.
export function normalizeFilters(filters) {
  if (!Array.isArray(filters)) {
    return [];
  }
  return filters.map(normalizeFilter).filter((entry) => entry && entry.ratedGph > 0);
}

export function getTotalGPH(filters, { normalized = false } = {}) {
  const list = normalized && Array.isArray(filters) ? filters : normalizeFilters(filters);
  const totals = { rated: 0, biological: 0, circulation: 0 };
  for (const entry of list) {
    const gph = entry.ratedGph > 0 ? entry.ratedGph : 0;
    totals.rated += gph;
    if (entry.role === FILTER_ROLES.CIRCULATION) {
      totals.circulation += gph;
    } else {
      totals.biological += gph;
    }
  }
  return totals;
}

// Tank volumes per hour; 0 when either value is missing or not positive.
export function turnoverX(totalGph, gallons) {
  const flow = toNum(totalGph);
  const volume = toNum(gallons);
  if (!(flow > 0) || !(volume > 0)) {
    return 0;
  }
  return flow / volume;
}

export const computeTurnover = turnoverX;

// Bioload percentage: livestock load ÷ capacity. Filtration is deliberately not an input.
export function computePercent(baseBioload, capacity) {
  const load = Math.max(0, toNum(baseBioload));
  const cap = toNum(capacity);
  if (!(cap > 0)) {
    return 0;
  }
  return clamp((load / cap) * 100, 0, 2000);
}

/**
 * Filtration adequacy for a tank and stock. Never changes the bioload percentage.
 *
 * @param {object} input
 * @param {Array} input.filters  devices as entered (any shape normalizeFilter accepts)
 * @param {number} input.gallons nominal tank gallons
 * @param {boolean} input.hasStock at least one species is planned
 */
export function assessFiltration({ filters = [], gallons = 0, hasStock = false } = {}) {
  const list = normalizeFilters(filters);
  const totals = getTotalGPH(list, { normalized: true });
  const biologicalTurnover = turnoverX(totals.biological, gallons);
  const totalTurnover = turnoverX(totals.rated, gallons);
  const biologicalCount = list.filter((entry) => entry.role === FILTER_ROLES.BIOLOGICAL).length;
  const circulationCount = list.length - biologicalCount;
  const hasSponge = list.some((entry) => entry.role === FILTER_ROLES.BIOLOGICAL && entry.type?.startsWith('SPONGE'));

  let level;
  if (list.length === 0) {
    level = FILTRATION_LEVELS.NONE;
  } else if (biologicalCount === 0) {
    level = FILTRATION_LEVELS.CIRCULATION_ONLY;
  } else if (biologicalTurnover < MIN_BIOLOGICAL_TURNOVER) {
    level = FILTRATION_LEVELS.VERY_LOW;
  } else {
    level = FILTRATION_LEVELS.ADEQUATE;
  }

  return {
    level,
    gallons: Math.max(0, toNum(gallons)),
    filters: list,
    totalGph: totals.rated,
    biologicalGph: totals.biological,
    circulationGph: totals.circulation,
    biologicalTurnover,
    // Circulation estimate (all devices); shown, never scored.
    totalTurnover,
    biologicalCount,
    circulationCount,
    hasSponge,
    hasStock: Boolean(hasStock),
    // Nothing here scales the bioload percentage.
    capacityAdjustment: 0,
  };
}

export function toTurnoverLabel(totalGph, gallons) {
  const ratio = turnoverX(totalGph, gallons);
  return ratio > 0 ? ratio.toFixed(1) : '0.0';
}
