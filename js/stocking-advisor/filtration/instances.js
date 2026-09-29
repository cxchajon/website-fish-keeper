/**
 * Filter instances (sponge migration phase D: duplicate filters).
 *
 *   productId   which model of filter this is (a catalog id; repeats when the user owns two)
 *   instanceId  which physical copy it is (unique within the list)
 *
 * Every operation on one filter (chip key, remove, Add rating) uses instanceId. productId is never a
 * unique key: two AquaClear 70s are two filters with the same productId and different instanceIds.
 */
import { isValidInstanceId } from './math.js';
import { createInstanceId } from './saved-state.js';

// Gives every item a unique, well-formed instanceId. The first use of an id is kept; a missing,
// malformed or repeated id (damaged saved state) gets a new one, so the second filter is repaired
// and kept, never dropped. Items that already have a valid unique id are returned unchanged.
export function withUniqueInstanceIds(items) {
  if (!Array.isArray(items)) return [];
  const taken = new Set();
  return items.map((item) => {
    const current = isValidInstanceId(item?.instanceId) ? item.instanceId : null;
    const instanceId = current && !taken.has(current) ? current : createInstanceId(taken);
    taken.add(instanceId);
    return instanceId === item?.instanceId ? item : { ...item, instanceId };
  });
}

export function findInstance(items, instanceId) {
  if (!Array.isArray(items) || !isValidInstanceId(instanceId)) return null;
  return items.find((item) => item?.instanceId === instanceId) ?? null;
}

// Removes exactly one physical filter. Other copies of the same product stay.
export function removeInstance(items, instanceId) {
  if (!Array.isArray(items)) return [];
  if (!isValidInstanceId(instanceId)) return items.slice();
  let removed = false;
  return items.filter((item) => {
    if (!removed && item?.instanceId === instanceId) {
      removed = true;
      return false;
    }
    return true;
  });
}

// Replaces exactly one physical filter in place; the replacement keeps that filter's instanceId.
export function replaceInstance(items, instanceId, replacement) {
  if (!Array.isArray(items)) return [];
  if (!isValidInstanceId(instanceId) || !replacement) return items.slice();
  let replaced = false;
  return items.map((item) => {
    if (!replaced && item?.instanceId === instanceId) {
      replaced = true;
      return { ...replacement, instanceId };
    }
    return item;
  });
}

// For filters sharing a productId: instanceId → { position, count } (1-based, in list order). Used
// only to tell identical chips apart for screen readers; single products are not listed.
export function duplicatePositions(items) {
  const groups = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const productId = typeof item?.productId === 'string' && item.productId ? item.productId : null;
    if (!productId || !item?.instanceId) return;
    if (!groups.has(productId)) groups.set(productId, []);
    groups.get(productId).push(item.instanceId);
  });
  const positions = new Map();
  groups.forEach((ids) => {
    if (ids.length < 2) return;
    ids.forEach((instanceId, index) => positions.set(instanceId, { position: index + 1, count: ids.length }));
  });
  return positions;
}
