/**
 * Sponge filter items for the filtration controller (sponge migration phase B).
 * Report: _internal/reports/stocking-advisor-sponge-migration-phase-b-2026-09.md
 *
 * Pure helpers (no DOM) so the controller's sponge rules are unit-tested directly.
 *
 * A sponge item never carries flow: gph is 0 and capacityMethod is "manufacturer_rating", whatever
 * the catalog, a cached catalog or saved data says about GPH (type wins, see math.js).
 *   catalog sponge  rating fields come from the current catalog record only
 *   custom sponge   the user-entered "Rated for up to ___ gallons" value, ratingStatus "verified"
 *   old custom sponge (only a GPH) → ratingStatus "needed"; the GPH is kept as legacyGph, never used
 */
import { canonicalizeFilterType } from '../../utils.js';
import {
  CAPACITY_METHODS,
  RATING_STATUSES,
  formatSpongeRating,
  hasUnsupportedCapacityMethod,
  isKnownSpongeProductId,
  isSpongeFilter,
  pickPassthroughFields,
  resolveSpongeRating,
} from './math.js';

export const SPONGE_TYPE = 'SPONGE';
export const SPONGE_ITEM_LABEL = 'Sponge filter';
// Same ceiling as the tank size the calculator accepts (compute.legacy.js clamps gallons to 999).
export const MAX_CUSTOM_RATED_GALLONS = 999;

export { isSpongeFilter };

// "Rated for up to ___ gallons": a whole number of gallons, 1–999. Anything else is invalid (null);
// values are never clamped into range, so a typo is reported rather than silently changed.
export function parseRatedGallons(value) {
  let num = NaN;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) num = Number(trimmed);
  }
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  return rounded >= 1 && rounded <= MAX_CUSTOM_RATED_GALLONS ? rounded : null;
}

// Rating fields of a catalog record: only what the current catalog states. A record without them
// (an old cached catalog) resolves to "Rating needed".
function catalogRatingFields(product) {
  const fields = pickPassthroughFields(product);
  const out = {};
  ['manufacturerMaxGallons', 'manufacturerMinGallons', 'ratingStatus'].forEach((key) => {
    if (fields[key] !== undefined) out[key] = fields[key];
  });
  return out;
}

export function buildSpongeProductItem(product) {
  if (!product || typeof product.id !== 'string' || !product.id) return null;
  return {
    id: product.id,
    source: 'product',
    label: product.name ? String(product.name) : product.id,
    gph: 0,
    type: SPONGE_TYPE,
    efficiencyType: SPONGE_TYPE,
    capacityMethod: CAPACITY_METHODS.MANUFACTURER_RATING,
    productId: product.id,
    ...catalogRatingFields(product),
  };
}

export function buildCustomSpongeItem({ id, ratedGallons }) {
  const max = parseRatedGallons(ratedGallons);
  if (!max || typeof id !== 'string' || !id) return null;
  return {
    id,
    source: 'custom',
    label: SPONGE_ITEM_LABEL,
    gph: 0,
    type: SPONGE_TYPE,
    efficiencyType: SPONGE_TYPE,
    capacityMethod: CAPACITY_METHODS.MANUFACTURER_RATING,
    manufacturerMaxGallons: max,
    ratingStatus: RATING_STATUSES.VERIFIED,
  };
}

/**
 * A saved / app-state sponge entry → controller item.
 * @param {object} entry     saved entry in app-filter shape ({id, type, rated_gph, productId, …})
 * @param {object|null} product  the current catalog record for its id, when found
 */
export function restoreSpongeItem(entry, product) {
  if (product) {
    const item = buildSpongeProductItem(product);
    if (item && typeof entry?.instanceId === 'string' && entry.instanceId) item.instanceId = entry.instanceId;
    return item;
  }
  const fields = pickPassthroughFields(entry);
  const id = typeof entry?.id === 'string' && entry.id ? entry.id : null;
  const item = {
    id,
    source: 'custom',
    label: SPONGE_ITEM_LABEL,
    gph: 0,
    type: SPONGE_TYPE,
    efficiencyType: SPONGE_TYPE,
    capacityMethod: CAPACITY_METHODS.MANUFACTURER_RATING,
  };
  if (fields.instanceId) item.instanceId = fields.instanceId;
  const productId = fields.productId ?? (isKnownSpongeProductId(id) ? id : null);
  if (productId) {
    // A catalog id the catalog can't resolve right now (removed product, catalog not loaded): keep
    // the identity so it re-resolves later, and never trust a stored rating or GPH for it.
    item.productId = productId;
    item.ratingStatus = RATING_STATUSES.NEEDED;
    return item;
  }
  // Custom sponge: a user-entered (verified) rating is its data; anything else needs a rating.
  const rating = resolveSpongeRating(fields);
  if (rating.status === RATING_STATUSES.VERIFIED) {
    item.manufacturerMaxGallons = rating.maxGallons;
    if (rating.minGallons !== null) item.manufacturerMinGallons = rating.minGallons;
    item.ratingStatus = RATING_STATUSES.VERIFIED;
  } else {
    item.ratingStatus = RATING_STATUSES.NEEDED;
    // An old custom sponge's GPH: legacy metadata for one migration cycle only.
    const legacy = fields.legacyGph ?? legacyFlowValue(entry);
    if (legacy) item.legacyGph = legacy;
  }
  return item;
}

export const RESTORE_KINDS = Object.freeze({
  PRODUCT: 'product', // rebuilt from the current catalog record (its type, GPH, rating)
  SPONGE: 'sponge', // restoreSpongeItem without a catalog record: custom, or unresolved product id
  FLOW: 'flow', // custom / unresolved powered filter at its stored GPH (still needs GPH > 0)
  DROP: 'drop',
});

/**
 * How a saved entry is restored (phase C source-of-truth order):
 *   1. an unsupported capacityMethod fails closed (dropped);
 *   2. a product the current catalog resolves is that catalog record: catalog type wins over the
 *      saved type, capacityMethod, GPH and rating, in both directions;
 *   3. otherwise a sponge (saved type SPONGE, or a known catalog sponge id) is a rating sponge whose
 *      stored GPH is never scored;
 *   4. otherwise a powered filter keeps its stored GPH (legacy behaviour).
 * @param {object} entry  saved entry in app-filter shape ({id, type, rated_gph, productId, …})
 * @param {object|null} product  the current catalog record for its id, when found
 */
export function restoreKind(entry, product) {
  if (!entry || typeof entry !== 'object' || hasUnsupportedCapacityMethod(entry)) return RESTORE_KINDS.DROP;
  if (product) return RESTORE_KINDS.PRODUCT;
  if (isSpongeFilter({ type: canonicalizeFilterType(entry.type ?? 'HOB') })
    || isKnownSpongeProductId(entry.productId ?? entry.id)) {
    return RESTORE_KINDS.SPONGE;
  }
  return RESTORE_KINDS.FLOW;
}

function legacyFlowValue(entry) {
  for (const key of ['rated_gph', 'gph', 'gphRated', 'ratedGph']) {
    const num = Number(entry?.[key]);
    if (Number.isFinite(num) && num > 0) return Math.min(Math.round(num), 1500);
  }
  return null;
}

// True when the item is a custom sponge the user can still give a rating to.
export function needsCustomRating(item) {
  return isSpongeFilter(item) && item?.source === 'custom' && !item?.productId
    && resolveSpongeRating(item).status !== RATING_STATUSES.VERIFIED;
}

// Chip badge: "Rated 10–40 gal" / "Rated up to 40 gal" for a verified rating, else "Rating needed".
// Never a GPH.
export function spongeChipBadge(item) {
  const text = formatSpongeRating(resolveSpongeRating(item));
  return text ? `Rated ${text}` : 'Rating needed';
}

// Product dropdown details for a sponge: "Sponge • Rated 10–40 gal" or "Sponge • Rating needed".
// Review-only numbers (needs_review) and the legacy GPH / GPH-bucket values are never shown.
export function spongeOptionDetails(product) {
  return `Sponge • ${spongeChipBadge(product)}`;
}
