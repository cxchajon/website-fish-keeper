/**
 * Undergravel filter items for the filtration controller (sponge migration phase F, design D12).
 * Report: _internal/reports/stocking-advisor-sponge-migration-phase-f-2026-09.md
 *
 * Pure helpers (no DOM) so the controller's UGF rules are unit-tested directly.
 *
 * A UGF item never carries flow: gph is 0 and capacityMethod is "tank_compatibility", whatever the
 * catalog, a cached catalog or saved data says about GPH (type wins, see math.js).
 *   catalog UGF   compatibleTanks come from the current catalog record only
 *   unresolved    a known UGF product id the catalog can't resolve right now: identity kept, no
 *                 compatible tanks → "not evaluated" until the catalog is back
 *   custom UGF    old plans only (there is no custom UGF input): no compatible tanks are invented
 */
import {
  CAPACITY_METHODS,
  formatCompatibleTanks,
  isKnownUgfProductId,
  pickPassthroughFields,
} from './math.js';

export const UGF_TYPE = 'UGF';
export const UGF_ITEM_LABEL = 'Undergravel filter';

export function buildUgfProductItem(product) {
  if (!product || typeof product.id !== 'string' || !product.id) return null;
  const item = {
    id: product.id,
    source: 'product',
    label: product.name ? String(product.name) : product.id,
    gph: 0,
    type: UGF_TYPE,
    efficiencyType: UGF_TYPE,
    capacityMethod: CAPACITY_METHODS.TANK_COMPATIBILITY,
    productId: product.id,
  };
  const { compatibleTanks } = pickPassthroughFields(product);
  if (compatibleTanks) item.compatibleTanks = compatibleTanks;
  return item;
}

/**
 * A saved / app-state UGF entry → controller item.
 * @param {object} entry     saved entry in app-filter shape ({id, type, rated_gph, productId, …})
 * @param {object|null} product  the current catalog record for its id, when found
 */
export function restoreUgfItem(entry, product) {
  if (product) {
    const item = buildUgfProductItem(product);
    if (item && typeof entry?.instanceId === 'string' && entry.instanceId) item.instanceId = entry.instanceId;
    return item;
  }
  const fields = pickPassthroughFields(entry);
  const id = typeof entry?.id === 'string' && entry.id ? entry.id : null;
  const item = {
    id,
    source: 'custom',
    label: UGF_ITEM_LABEL,
    gph: 0,
    type: UGF_TYPE,
    efficiencyType: UGF_TYPE,
    capacityMethod: CAPACITY_METHODS.TANK_COMPATIBILITY,
  };
  if (fields.instanceId) item.instanceId = fields.instanceId;
  // Keep a catalog identity so the next catalog load re-resolves it; stored compatibility, GPH or
  // ranges are never trusted for it, and none are invented for a custom UGF.
  const productId = fields.productId ?? (isKnownUgfProductId(id) ? id : null);
  if (productId) item.productId = productId;
  return item;
}

// Chip badge: "Rated: 20 Long and 29 Gallon" (each listed preset named), else "Rating needed". Never a GPH.
export function ugfChipBadge(item) {
  const text = formatCompatibleTanks(item?.compatibleTanks);
  return text ? `Rated: ${text}` : 'Rating needed';
}

// Product dropdown details: "Undergravel • 20 Long and 29 Gallon". No GPH, no range of any kind.
export function ugfOptionDetails(product) {
  const text = formatCompatibleTanks(product?.compatibleTanks);
  return `Undergravel • ${text ?? 'Rating needed'}`;
}
