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

import { TANK_SIZES } from '../../utils.js';

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
  VERY_LOW: 'very-low', // powered filters only, below MIN_BIOLOGICAL_TURNOVER
  ADEQUATE: 'adequate', // powered filters meet the floor, one verified sponge is rated for the tank, or the UGF is listed for the tank preset
  // Sponge migration phase B (design report sections 1, 4.4):
  LIKELY_MULTI_SPONGE: 'likely-multi-sponge', // amber: no single sponge rated, verified ratings together reach the tank
  BELOW_RATING: 'below-rating', // amber: rated sponge(s) only, below the tank size
  REVIEW: 'review', // amber: powered filter below the floor next to a sponge / UGF that doesn't carry the tank
  // neutral: the only biological filtration is a sponge without a usable rating, or an undergravel
  // filter not listed for this tank preset (phase F: the status text then names the UGF)
  NOT_EVALUATED: 'not-evaluated',
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
// Powered filters score by flow. Since phase B every SPONGE scores by its manufacturer tank rating,
// and since phase F every UGF by its listed tank presets (tank_compatibility), whatever its data
// says (see effectiveCapacityMethod). Any other device carrying tank_compatibility is unchanged.
export const CAPACITY_METHODS = Object.freeze({
  FLOW: 'flow',
  MANUFACTURER_RATING: 'manufacturer_rating',
  TANK_COMPATIBILITY: 'tank_compatibility',
});
const KNOWN_CAPACITY_METHODS = new Set(Object.values(CAPACITY_METHODS));
export const RATING_STATUSES = Object.freeze({
  VERIFIED: 'verified', // the rating may be used for evaluation
  NEEDS_REVIEW: 'needs_review', // a number may be stored as review metadata; never used for evaluation
  NEEDED: 'needed', // no usable rating
});
const KNOWN_RATING_STATUSES = new Set(Object.values(RATING_STATUSES));
const MAX_RATED_GALLONS = 10000;
const MAX_LEGACY_GPH = MAX_DEVICE_GPH;
const MAX_ID_LENGTH = 128;
// instanceId (phase D): which physical copy of a filter an entry is. Letters, digits, "-" and "_",
// up to 64 characters (createInstanceId writes "f-" + base 36). Anything else is malformed and is
// re-issued, like a missing or repeated id.
const INSTANCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function isValidInstanceId(value) {
  return typeof value === 'string' && INSTANCE_ID_PATTERN.test(value);
}

function hasCapacityMethod(filter) {
  return Boolean(filter) && filter.capacityMethod !== undefined && filter.capacityMethod !== null;
}

// An explicitly stated method this code doesn't support (e.g. "banana", or one from a newer
// release). Such a device fails closed: it is never treated as a flow filter and adds no GPH.
export function hasUnsupportedCapacityMethod(filter) {
  if (!hasCapacityMethod(filter)) return false;
  const value = typeof filter.capacityMethod === 'string' ? filter.capacityMethod.trim() : '';
  return !KNOWN_CAPACITY_METHODS.has(value);
}

// A known method; FLOW when absent (every legacy/v1 filter); null when explicitly unsupported.
// Type-blind: use effectiveCapacityMethod for anything that decides how a device is evaluated.
export function resolveCapacityMethod(filter) {
  if (!hasCapacityMethod(filter)) return CAPACITY_METHODS.FLOW;
  return hasUnsupportedCapacityMethod(filter) ? null : filter.capacityMethod.trim();
}

// Sponge filters are air-driven: their catalog / saved "GPH" is not a water flow (sponge audit).
// Canonical type SPONGE only; an undergravel filter is not a sponge (it has its own model, phase F).
const SPONGE_TYPE_KEYS = new Set(['SPONGE', 'SPONGEFILTER']);

export function isSpongeFilter(filter) {
  return SPONGE_TYPE_KEYS.has(filterTypeKey(filter));
}

// Phase C (stale / legacy data): the catalog products typed SPONGE, by id. A saved or cached record
// with one of these ids is a sponge whatever type it carries (stale "HOB", a missing or nonsense
// type), so its historical GPH can never be scored — even when the catalog can't be loaded to say
// so. Identity only: no rating or other metadata comes from here. Must equal the SPONGE ids of
// assets/data/gearCatalog.json (unit-tested).
export const KNOWN_SPONGE_PRODUCT_IDS = Object.freeze([
  'aquaneat-sponge-10',
  'aquaneat-sponge-20',
  'aquaneat-sponge-60',
  'hygger-double-sponge-s',
  'hygger-double-sponge-m',
  'pawfly-sponge-10',
  'powkoo-dual-sponge-40',
]);
const KNOWN_SPONGE_PRODUCT_ID_SET = new Set(KNOWN_SPONGE_PRODUCT_IDS);

export function isKnownSpongeProductId(id) {
  return typeof id === 'string' && KNOWN_SPONGE_PRODUCT_ID_SET.has(id.trim());
}

// Undergravel filters (phase F, design D12): plates under the gravel bed, sized by tank footprint.
// A UGF is evaluated only by the tank presets its manufacturer lists (compatibleTanks), never by a
// GPH, a turnover or a gallon range. Canonical type UGF (and the spellings utils.js maps to it).
const UGF_TYPE_KEYS = new Set(['UGF', 'UNDERGRAVEL', 'UNDERGRAVELFILTER']);

export function isUndergravelFilter(filter) {
  return UGF_TYPE_KEYS.has(filterTypeKey(filter));
}

// Phase F (stale / legacy data): the catalog products typed UGF, by id — the undergravel twin of
// KNOWN_SPONGE_PRODUCT_IDS. A saved or cached record with one of these ids is a UGF whatever type it
// carries (stale "HOB", missing or nonsense type), so its historical 150 / 900 GPH can never be
// scored, even when the catalog can't be loaded. Identity only: its compatible tanks come from the
// current catalog, never from here. Must equal the UGF ids of assets/data/gearCatalog.json (tested).
export const KNOWN_UGF_PRODUCT_IDS = Object.freeze([
  'penn-plax-ugf-20-29',
]);
const KNOWN_UGF_PRODUCT_ID_SET = new Set(KNOWN_UGF_PRODUCT_IDS);

export function isKnownUgfProductId(id) {
  return typeof id === 'string' && KNOWN_UGF_PRODUCT_ID_SET.has(id.trim());
}

// The advisor's tank presets (js/utils.js TANK_SIZES), in their list order. A UGF can only be
// checked against one of these canonical ids; gallons alone never identify a preset (20h and 20l are
// both 20 gallons).
export const TANK_PRESET_IDS = Object.freeze(TANK_SIZES.map((tank) => tank.id));
const TANK_PRESET_ID_SET = new Set(TANK_PRESET_IDS);

// A canonical tank preset id, or null. Exact ids only (after trimming): no gallons, labels or aliases.
export function cleanTankPresetId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return TANK_PRESET_ID_SET.has(trimmed) ? trimmed : null;
}

// compatibleTanks metadata: an array of recognised preset ids, trimmed, de-duplicated, in preset
// order. Anything that is not an array (a string "20l,29g", an object, a number) is malformed and
// gives null; inside an array, non-strings, empty values and unknown ids are dropped. An empty result
// is null. Compatibility is never inferred from gallons.
export function sanitizeCompatibleTanks(value) {
  if (!Array.isArray(value)) return null;
  const ids = new Set();
  value.forEach((candidate) => {
    const id = cleanTankPresetId(candidate);
    if (id) ids.add(id);
  });
  const ordered = TANK_PRESET_IDS.filter((id) => ids.has(id));
  return ordered.length ? ordered : null;
}

// Short names for compatibility text: "20 Long", "29 gal". The preset label is the source; the
// qualifier (High / Long / Breeder) is kept because it is what separates same-gallon presets.
const TANK_SHORT_NAMES = Object.freeze(Object.fromEntries(TANK_SIZES.map((tank) => {
  const qualifier = /Gallon (High|Long|Breeder)\b/.exec(tank.label ?? '')?.[1];
  return [tank.id, qualifier ? `${tank.gallons} ${qualifier}` : `${tank.gallons} gal`];
})));

// "20 Long–29 gal" for the Penn-Plax plates. Presets that are neighbours in the preset list are
// written as a run "first–last" (20l and 29g are adjacent; 20h comes before 20l, so it is not inside
// the run; "5–15 gal" when both ends are plain gallons); separate runs are joined with ", ".
// null without usable metadata.
export function formatCompatibleTanks(value) {
  const ids = sanitizeCompatibleTanks(value);
  if (!ids) return null;
  const runs = [];
  ids.forEach((id) => {
    const index = TANK_PRESET_IDS.indexOf(id);
    const last = runs[runs.length - 1];
    if (last && last.end + 1 === index) {
      last.end = index;
      last.ids.push(id);
    } else {
      runs.push({ end: index, ids: [id] });
    }
  });
  return runs.map((run) => {
    const first = TANK_SHORT_NAMES[run.ids[0]];
    const lastName = TANK_SHORT_NAMES[run.ids[run.ids.length - 1]];
    if (run.ids.length === 1) return first;
    const plain = / gal$/;
    return plain.test(first) && plain.test(lastName) ? `${first.replace(plain, '')}–${lastName}` : `${first}–${lastName}`;
  }).join(', ');
}

// TYPE WINS (phase B): a SPONGE is always evaluated by its manufacturer tank rating, even when
// stale data (an old catalog cache, a v1 plan, a phase A v2 plan, an old tab) says capacityMethod
// "flow" or carries gph / rated_gph / gphRated. Those GPH values are never read for a sponge.
// Phase F: likewise a UGF is always tank_compatibility, before any GPH field is read.
// An explicitly unsupported method still fails closed (null), as in phase A.
export function effectiveCapacityMethod(filter) {
  if (hasUnsupportedCapacityMethod(filter)) return null;
  if (isSpongeFilter(filter)) return CAPACITY_METHODS.MANUFACTURER_RATING;
  if (isUndergravelFilter(filter)) return CAPACITY_METHODS.TANK_COMPATIBILITY;
  return resolveCapacityMethod(filter);
}

// A UGF counted as biological filtration without flow, evaluated by tank compatibility.
// Unsupported-method entries are not (they fail closed).
export function isCompatibilityBasedUgf(filter) {
  return isUndergravelFilter(filter) && effectiveCapacityMethod(filter) === CAPACITY_METHODS.TANK_COMPATIBILITY;
}

// Either zero-flow biological model: kept in the device list with 0 GPH.
function isZeroFlowBiological(filter) {
  return isRatingBasedSponge(filter) || isCompatibilityBasedUgf(filter);
}

// A sponge counted as biological filtration without flow. Unsupported-method entries are not.
export function isRatingBasedSponge(filter) {
  return isSpongeFilter(filter) && effectiveCapacityMethod(filter) === CAPACITY_METHODS.MANUFACTURER_RATING;
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
  if (isValidInstanceId(filter.instanceId)) out.instanceId = filter.instanceId;
  const productId = cleanId(filter.productId);
  if (productId) out.productId = productId;
  const method = typeof filter.capacityMethod === 'string' ? filter.capacityMethod.trim() : '';
  if (KNOWN_CAPACITY_METHODS.has(method)) out.capacityMethod = method;
  const maxGallons = cleanGallons(filter.manufacturerMaxGallons ?? filter.ratedMaxGallons);
  if (maxGallons !== null) out.manufacturerMaxGallons = maxGallons;
  const minGallons = cleanGallons(filter.manufacturerMinGallons);
  if (minGallons !== null) out.manufacturerMinGallons = minGallons;
  if (KNOWN_RATING_STATUSES.has(filter.ratingStatus)) out.ratingStatus = filter.ratingStatus;
  // An old custom sponge's historical GPH, kept for one migration cycle only. Never a flow input:
  // it is not one of the keys parseFlow reads, and sponges never parse a flow anyway.
  const legacyGph = cleanGallons(filter.legacyGph);
  if (legacyGph !== null && legacyGph <= MAX_LEGACY_GPH) out.legacyGph = legacyGph;
  // A UGF's listed tank presets (phase F), sanitised; malformed metadata is left out (fails closed).
  const compatibleTanks = sanitizeCompatibleTanks(filter.compatibleTanks);
  if (compatibleTanks) out.compatibleTanks = compatibleTanks;
  return out;
}

/**
 * The tank rating a sponge may be evaluated with. VERIFIED only: a positive manufacturerMaxGallons
 * alone is not enough (SUPPORTED catalog records store review numbers with status needs_review).
 * Stale flow data (gph, rated_gph, gphRated) is never consulted.
 *
 * @returns {{ status: 'verified'|'needs_review'|'needed', maxGallons: number|null, minGallons: number|null }}
 *   maxGallons / minGallons are null unless status is 'verified'; minGallons is display-only.
 */
export function resolveSpongeRating(filter) {
  const fields = pickPassthroughFields(filter);
  const max = fields.manufacturerMaxGallons ?? null;
  const min = fields.manufacturerMinGallons ?? null;
  // A minimum above the maximum is a damaged rating (no writer produces one): fail closed (phase C).
  if (fields.ratingStatus === RATING_STATUSES.VERIFIED && max !== null && (min === null || min <= max)) {
    return { status: RATING_STATUSES.VERIFIED, maxGallons: max, minGallons: min };
  }
  const status = fields.ratingStatus === RATING_STATUSES.NEEDS_REVIEW ? RATING_STATUSES.NEEDS_REVIEW : RATING_STATUSES.NEEDED;
  return { status, maxGallons: null, minGallons: null };
}

function roundGallons(value) {
  return Math.round(value * 10) / 10;
}

// "10–40 gal" when a verified minimum exists, else "up to 40 gal"; null without a verified rating.
export function formatSpongeRating(rating, { withUpTo = true } = {}) {
  if (!rating || rating.status !== RATING_STATUSES.VERIFIED || !(rating.maxGallons > 0)) return null;
  const max = roundGallons(rating.maxGallons);
  if (rating.minGallons > 0) return `${roundGallons(rating.minGallons)}–${max} gal`;
  return withUpTo ? `up to ${max} gal` : `${max} gal`;
}

export function normalizeFilter(filter) {
  if (!filter || typeof filter !== 'object') {
    return null;
  }
  // An unsupported capacity method contributes no flow (normalizeFilters then leaves it out).
  // A sponge never contributes flow: type wins over any stored GPH (phase B). Nor does a UGF
  // (phase F): its catalog / saved GPH was never a measured flow.
  const sponge = isRatingBasedSponge(filter);
  const ugf = isCompatibilityBasedUgf(filter);
  const ratedGph = sponge || ugf || hasUnsupportedCapacityMethod(filter) ? 0 : parseFlow(filter);
  const entry = {
    id: typeof filter.id === 'string' && filter.id ? filter.id : null,
    source: typeof filter.source === 'string' && filter.source ? filter.source : null,
    label: typeof filter.label === 'string' && filter.label ? filter.label : null,
    type: filterTypeKey(filter) || null,
    role: filterRole(filter),
    ratedGph,
    rated_gph: ratedGph,
    ...pickPassthroughFields(filter),
  };
  if (sponge) {
    entry.capacityMethod = CAPACITY_METHODS.MANUFACTURER_RATING;
  }
  if (ugf) {
    entry.capacityMethod = CAPACITY_METHODS.TANK_COMPATIBILITY;
  }
  return entry;
}

// Flow devices without a positive flow are dropped: they cannot be assessed. A sponge is kept with
// zero flow: it is biological filtration evaluated by its tank rating, not by GPH. So is a UGF,
// evaluated by its listed tank presets (phase F).
export function normalizeFilters(filters) {
  if (!Array.isArray(filters)) {
    return [];
  }
  // The sponge / UGF test reads the input (not the normalized copy), so one with an unsupported
  // capacityMethod still fails closed.
  const out = [];
  for (const filter of filters) {
    const entry = normalizeFilter(filter);
    if (entry && (entry.ratedGph > 0 || isZeroFlowBiological(filter))) out.push(entry);
  }
  return out;
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

// Headline wording per level (locked in the design report, section 1.2 / 12). The engine warnings
// in compute.legacy.js and the filtration summary use these.
export const FILTRATION_STATUS = Object.freeze({
  [FILTRATION_LEVELS.NONE]: { icon: '', text: 'No filter added', tone: 'warn' },
  [FILTRATION_LEVELS.CIRCULATION_ONLY]: { icon: '', text: 'No biological filter', tone: 'bad' },
  [FILTRATION_LEVELS.VERY_LOW]: { icon: '', text: 'Filter flow too low', tone: 'bad' },
  POWERED_ADEQUATE: { icon: '✓', text: 'Filtration appears adequate', tone: 'good' },
  SPONGE_RATED: { icon: '✓', text: 'Rated for this tank', tone: 'good' },
  [FILTRATION_LEVELS.LIKELY_MULTI_SPONGE]: { icon: '⚠', text: 'Likely adequate — multiple sponge filters', tone: 'warn' },
  [FILTRATION_LEVELS.BELOW_RATING]: { icon: '⚠', text: 'Below manufacturer rating', tone: 'warn' },
  [FILTRATION_LEVELS.REVIEW]: { icon: '⚠', text: 'Review filtration', tone: 'warn' },
  [FILTRATION_LEVELS.NOT_EVALUATED]: { icon: '○', text: 'Not evaluated — rating needed', tone: 'neutral' },
  RATING_NEEDED: { icon: '○', text: 'Rating needed', tone: 'neutral' },
  // Phase F (design sections 11–12). UGF_NOT_LISTED is carried by the NOT_EVALUATED level when an
  // undergravel filter is the only device that can't be evaluated: it means "can't be evaluated for
  // this preset from its stated compatibility", not "unsafe".
  UGF_RATED: { icon: '✓', text: 'Undergravel filter rated for this tank', tone: 'good' },
  UGF_NOT_LISTED: { icon: '○', text: 'Rating needed — this undergravel filter isn\'t listed for this tank size', tone: 'neutral' },
});

// How an undergravel filter relates to the selected tank (phase F).
export const UGF_STATUSES = Object.freeze({
  COMPATIBLE: 'compatible', // the tank preset is in the product's compatibleTanks
  NOT_LISTED: 'not-listed', // compatibleTanks known, this preset is not in it
  TANK_UNKNOWN: 'tank-unknown', // compatibleTanks known, but no canonical tank preset id to check
  COMPATIBILITY_UNKNOWN: 'compatibility-unknown', // no usable compatibleTanks (custom / offline / stale)
});

// One undergravel filter as the evaluation sees it. Only explicit preset ids decide compatibility:
// no gallons arithmetic, no footprint maths, no GPH.
function describeUgf(entry, tankId) {
  const compatibleTanks = sanitizeCompatibleTanks(entry.compatibleTanks);
  const compatibilityKnown = compatibleTanks !== null;
  const compatible = compatibilityKnown && tankId !== null && compatibleTanks.includes(tankId);
  let status = UGF_STATUSES.COMPATIBILITY_UNKNOWN;
  if (compatible) status = UGF_STATUSES.COMPATIBLE;
  else if (compatibilityKnown) status = tankId === null ? UGF_STATUSES.TANK_UNKNOWN : UGF_STATUSES.NOT_LISTED;
  return {
    id: entry.id ?? null,
    instanceId: entry.instanceId ?? null,
    productId: entry.productId ?? null,
    label: entry.label ?? null,
    capacityMethod: CAPACITY_METHODS.TANK_COMPATIBILITY,
    compatibleTanks: compatibleTanks ?? [],
    compatibilityText: formatCompatibleTanks(compatibleTanks),
    tankId,
    compatibilityKnown,
    compatible,
    status,
    gph: 0,
  };
}

// One sponge as the evaluation sees it. Only a verified rating carries numbers.
function describeSponge(entry, gallons) {
  const rating = resolveSpongeRating(entry);
  const verified = rating.status === RATING_STATUSES.VERIFIED;
  return {
    id: entry.id ?? null,
    instanceId: entry.instanceId ?? null,
    productId: entry.productId ?? null,
    label: entry.label ?? null,
    ratingStatus: rating.status,
    manufacturerMaxGallons: rating.maxGallons,
    manufacturerMinGallons: rating.minGallons,
    ratingText: formatSpongeRating(rating),
    // The manufacturer minimum is informational: a sponge is never failed for a small tank.
    coversTank: verified && gallons > 0 && rating.maxGallons >= gallons,
  };
}

/**
 * Filtration adequacy for a tank and stock. Never changes the bioload percentage.
 *
 * Three independent paths (design D5/D6/D12), never added together and never converted into each
 * other:
 *   powered  HOB / canister / internal / custom powered: Phase 2C flow floor, unchanged
 *            (biological GPH ÷ nominal gallons ≥ MIN_BIOLOGICAL_TURNOVER).
 *   sponge   manufacturer tank rating, VERIFIED ratings only; sponges contribute 0 GPH.
 *   ugf      the tank preset id is in the product's compatibleTanks; UGFs contribute 0 GPH.
 * Powerheads stay circulation only.
 *
 * @param {object} input
 * @param {Array} input.filters  devices as entered (any shape normalizeFilter accepts)
 * @param {number} input.gallons nominal tank gallons
 * @param {boolean} input.hasStock at least one species is planned
 * @param {string|null} input.tankId canonical tank preset id (js/utils.js TANK_SIZES). Only the UGF
 *   path reads it; it is never inferred from gallons, so without it a UGF cannot pass.
 */
export function assessFiltration({ filters = [], gallons = 0, hasStock = false, tankId = null } = {}) {
  const list = normalizeFilters(filters);
  const totals = getTotalGPH(list, { normalized: true });
  const tankGallons = Math.max(0, toNum(gallons));
  const presetId = cleanTankPresetId(tankId);
  // Sponges and UGFs carry 0 GPH, so the biological flow is the powered filters' flow only.
  const biologicalTurnover = turnoverX(totals.biological, gallons);
  const totalTurnover = turnoverX(totals.rated, gallons);
  const biological = list.filter((entry) => entry.role === FILTER_ROLES.BIOLOGICAL);
  const biologicalCount = biological.length;
  const circulationCount = list.length - biologicalCount;
  const spongeEntries = biological.filter((entry) => isRatingBasedSponge(entry));
  const ugfEntries = biological.filter((entry) => isCompatibilityBasedUgf(entry));
  const poweredEntries = biological.filter((entry) => !isZeroFlowBiological(entry));
  const hasSponge = spongeEntries.length > 0;
  const ugfs = ugfEntries.map((entry) => describeUgf(entry, presetId));
  const ugfRated = ugfs.some((ugf) => ugf.compatible);

  const poweredPasses = poweredEntries.length > 0 && biologicalTurnover >= MIN_BIOLOGICAL_TURNOVER;
  const sponges = spongeEntries.map((entry) => describeSponge(entry, tankGallons));
  const verified = sponges.filter((sponge) => sponge.ratingStatus === RATING_STATUSES.VERIFIED);
  const unrated = sponges.filter((sponge) => sponge.ratingStatus !== RATING_STATUSES.VERIFIED);
  const spongeRated = verified.some((sponge) => sponge.coversTank);
  // Heuristic only (D2): the sum decides yes/no for the amber tier and is never reported.
  const verifiedSum = verified.reduce((sum, sponge) => sum + sponge.manufacturerMaxGallons, 0);
  const spongeLikely = !spongeRated && verified.length >= 2 && tankGallons > 0 && verifiedSum >= tankGallons;

  let spongeStatus = 'none';
  if (sponges.length) {
    if (spongeRated) spongeStatus = 'rated';
    else if (spongeLikely) spongeStatus = 'likely-multi';
    else if (verified.length) spongeStatus = 'below-rating';
    else spongeStatus = 'rating-needed';
  }

  let level;
  if (list.length === 0) {
    level = FILTRATION_LEVELS.NONE;
  } else if (biologicalCount === 0) {
    level = FILTRATION_LEVELS.CIRCULATION_ONLY;
  } else if (poweredPasses || spongeRated || ugfRated) {
    level = FILTRATION_LEVELS.ADEQUATE;
  } else if (spongeLikely) {
    level = FILTRATION_LEVELS.LIKELY_MULTI_SPONGE;
  } else if (poweredEntries.length && (sponges.length || ugfs.length)) {
    // A weak powered filter next to a sponge or UGF that can't carry the tank (design 4.4).
    level = FILTRATION_LEVELS.REVIEW;
  } else if (poweredEntries.length) {
    level = FILTRATION_LEVELS.VERY_LOW;
  } else if (verified.length) {
    level = FILTRATION_LEVELS.BELOW_RATING;
  } else {
    level = FILTRATION_LEVELS.NOT_EVALUATED;
  }

  // Every path that passes on its own, in a fixed order. adequateBy keeps its phase B meaning
  // ('powered' | 'sponge' | 'both' = powered and sponge) whenever one of those paths passes; it is
  // 'ugf' only when the undergravel filter is the sole passing path. passingPaths is the complete
  // structured answer (phase F; the phase G card reads it).
  const passingPaths = [];
  if (level === FILTRATION_LEVELS.ADEQUATE) {
    if (poweredPasses) passingPaths.push('powered');
    if (spongeRated) passingPaths.push('sponge');
    if (ugfRated) passingPaths.push('ugf');
  }
  let adequateBy = null;
  if (level === FILTRATION_LEVELS.ADEQUATE) {
    if (poweredPasses || spongeRated) {
      adequateBy = poweredPasses && spongeRated ? 'both' : poweredPasses ? 'powered' : 'sponge';
    } else {
      adequateBy = 'ugf';
    }
  }
  let status = FILTRATION_STATUS[level];
  if (level === FILTRATION_LEVELS.ADEQUATE) {
    status = adequateBy === 'sponge'
      ? FILTRATION_STATUS.SPONGE_RATED
      : adequateBy === 'ugf' ? FILTRATION_STATUS.UGF_RATED : FILTRATION_STATUS.POWERED_ADEQUATE;
  } else if (level === FILTRATION_LEVELS.NOT_EVALUATED && ugfs.length && !sponges.length) {
    // Only undergravel filter(s) that aren't listed for this tank: say so, neutrally.
    status = FILTRATION_STATUS.UGF_NOT_LISTED;
  }

  let ugfStatus = 'none';
  if (ugfs.length) {
    if (ugfRated) ugfStatus = UGF_STATUSES.COMPATIBLE;
    else if (ugfs.some((ugf) => ugf.status === UGF_STATUSES.NOT_LISTED)) ugfStatus = UGF_STATUSES.NOT_LISTED;
    else if (ugfs.some((ugf) => ugf.status === UGF_STATUSES.TANK_UNKNOWN)) ugfStatus = UGF_STATUSES.TANK_UNKNOWN;
    else ugfStatus = UGF_STATUSES.COMPATIBILITY_UNKNOWN;
  }

  return {
    level,
    status: { ...status },
    adequateBy,
    passingPaths,
    gallons: tankGallons,
    tankId: presetId,
    filters: list,
    totalGph: totals.rated,
    biologicalGph: totals.biological,
    circulationGph: totals.circulation,
    biologicalTurnover,
    // Circulation estimate (all devices); shown, never scored.
    totalTurnover,
    biologicalCount,
    circulationCount,
    // "Has biological filtration" is not "has biological GPH": a sponge or a UGF is the first
    // without the second.
    hasBiologicalFiltration: biologicalCount > 0,
    hasBiologicalGph: totals.biological > 0,
    hasSponge,
    hasUgf: ugfs.length > 0,
    powered: {
      count: poweredEntries.length,
      gph: totals.biological,
      turnover: biologicalTurnover,
      passes: poweredPasses,
      belowFloor: poweredEntries.length > 0 && !poweredPasses,
    },
    sponge: {
      count: sponges.length,
      verifiedCount: verified.length,
      unratedCount: unrated.length,
      status: spongeStatus,
      rated: spongeRated,
      likelyMulti: spongeLikely,
      entries: sponges,
    },
    // Undergravel filters (phase F): compatibility with the tank preset only. No GPH, no turnover,
    // no gallons of capacity, never combined with the other paths.
    ugf: {
      count: ugfs.length,
      capacityMethod: CAPACITY_METHODS.TANK_COMPATIBILITY,
      tankId: presetId,
      status: ugfStatus,
      rated: ugfRated,
      gph: 0,
      entries: ugfs,
    },
    hasStock: Boolean(hasStock),
    // Nothing here scales the bioload percentage.
    capacityAdjustment: 0,
  };
}

export function toTurnoverLabel(totalGph, gallons) {
  const ratio = turnoverX(totalGph, gallons);
  return ratio > 0 ? ratio.toFixed(1) : '0.0';
}
