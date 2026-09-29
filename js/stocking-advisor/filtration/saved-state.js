/**
 * Saved filter list: format v2 (sponge-filter migration phase A).
 * Design: _internal/reports/stocking-advisor-sponge-filter-migration-design-2026-09.md, section 8.
 *
 * Both writers (the filtration controller and js/stocking/tankStore.js) go through this module.
 *
 *   ttg.stocking.filters.v2  {"v":2,"filters":[entry, …]}   authoritative; the only key written
 *   ttg.stocking.filters.v1  [{id, type, rated_gph}, …]    historical: read and migrated, never written
 *
 * A v2 entry records the instance, not a copy of the catalog: a catalog filter is re-resolved from
 * the current catalog by productId when the page restores it (its stored gph is used only when the
 * product can't be found, exactly as v1 does).
 *
 * Sponges (phase B, type wins): every SPONGE entry is written and read as capacityMethod
 * "manufacturer_rating" and never carries gph, whatever an old v1 / phase A entry says.
 *   catalog sponge  {instanceId, source:"product", productId, type:"SPONGE", capacityMethod}
 *                   identity only; the rating is always re-resolved from the current catalog.
 *   custom sponge   {instanceId, source:"custom", label, legacyId, type:"SPONGE", capacityMethod,
 *                    manufacturerMaxGallons, ratingStatus:"verified"}   (user-entered rating), or
 *                   {…, ratingStatus:"needed", legacyGph}   an old custom sponge that only had a GPH:
 *                   legacyGph is kept for one migration cycle, never scored, never shown as flow.
 *
 * v1 (sponge migration phase E): the v1 compatibility mirror written by phases A–D is retired; its
 * grace period (design 8.3) ended with phase E. Current code never writes v1. It still reads a
 * historical v1 plan when v2 is missing or unreadable and migrates it (same rules as before: known
 * sponge ids and fake sponge GPH neutralised, repeated ids become separate instances). A successful
 * save removes the historical v1 key, because v2 then holds the plan; clearing the list removes both
 * keys, so a cleared plan can never come back through the v1 fallback. legacyGph (old custom
 * sponges) is migration metadata of v2 entries and is unaffected.
 *
 * Duplicates (phase D): each entry is one physical filter with its own instanceId; productId may
 * repeat and nothing here de-duplicates by it.
 *
 * Undergravel filters (phase F, type wins as for sponges): every UGF entry is written and read as
 * capacityMethod "tank_compatibility" and never carries gph, a gallon range or compatibleTanks.
 *   catalog UGF  {instanceId, source:"product", productId, type:"UGF", capacityMethod}
 *                identity only; compatibleTanks are re-resolved from the current catalog.
 *   custom UGF   {instanceId, source:"custom", label, legacyId, type:"UGF", capacityMethod}
 *                only from old plans (there is no custom UGF input); its old GPH is dropped and no
 *                compatible tanks are invented, so it stays "not evaluated".
 * A known UGF product id is a UGF whatever type old data stored. One plate set per tank is enforced
 * where filters are restored (controller), not here.
 */
import { canonicalizeFilterType } from '../../utils.js';
import {
  CAPACITY_METHODS,
  MAX_DEVICE_GPH,
  RATING_STATUSES,
  hasUnsupportedCapacityMethod,
  isKnownSpongeProductId,
  isKnownUgfProductId,
  isSpongeFilter,
  isUndergravelFilter,
  pickPassthroughFields,
  resolveCapacityMethod,
  resolveSpongeRating,
} from './math.js';

export const FILTER_STORAGE_KEY_V1 = 'ttg.stocking.filters.v1';
export const FILTER_STORAGE_KEY_V2 = 'ttg.stocking.filters.v2';
export const SAVED_FILTERS_VERSION = 2;

export const SAVED_FILTER_SOURCES = Object.freeze({
  PRODUCT: 'product',
  CUSTOM: 'custom',
});

const MANUAL_ID_PREFIX = 'manual-';
const SPONGE_TYPE = 'SPONGE';
const UGF_TYPE = 'UGF';
const MAX_LABEL_LENGTH = 120;

function clampGph(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.min(Math.round(num), MAX_DEVICE_GPH);
}

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function isManualId(id) {
  return typeof id === 'string' && id.startsWith(MANUAL_ID_PREFIX);
}

// A stable per-instance id, separate from the catalog productId (which repeats for identical filters).
export function createInstanceId(taken = new Set()) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `f-${Math.random().toString(36).slice(2, 8)}`;
    if (candidate.length === 8 && !taken.has(candidate)) {
      return candidate;
    }
  }
  let counter = taken.size;
  while (taken.has(`f-${Date.now().toString(36)}-${counter}`)) counter += 1;
  return `f-${Date.now().toString(36)}-${counter}`;
}

// Gives every entry a unique instanceId: keeps the first use of an id, re-issues repeats and gaps.
function assignInstanceIds(entries) {
  const taken = new Set();
  return entries.map((entry) => {
    const current = entry.instanceId;
    const instanceId = current && !taken.has(current) ? current : createInstanceId(taken);
    taken.add(instanceId);
    return instanceId === current ? entry : { ...entry, instanceId };
  });
}

// productId for a catalog-backed entry: explicit productId, else a non-manual id (the v1 rule: any id
// that isn't a custom "manual-…" id is looked up in the catalog on restore).
function resolveProductId(filter, extra) {
  if (extra.productId) return extra.productId;
  const id = cleanString(filter?.id, 128);
  if (!id || isManualId(id)) return null;
  if (filter?.source === SAVED_FILTER_SOURCES.CUSTOM || filter?.source === 'manual') return null;
  return id;
}

function buildEntry(filter, { typeValue, gphValue }) {
  // A missing capacityMethod means flow (legacy data). An explicitly unsupported one is malformed:
  // the entry is dropped rather than turned into a flow filter; the rest of the list is kept.
  if (hasUnsupportedCapacityMethod(filter)) {
    return null;
  }
  const extra = pickPassthroughFields(filter);
  const productId = resolveProductId(filter, extra);
  const gph = clampGph(gphValue);
  const entry = {
    instanceId: extra.instanceId ?? null,
    source: productId ? SAVED_FILTER_SOURCES.PRODUCT : SAVED_FILTER_SOURCES.CUSTOM,
  };
  if (productId) {
    entry.productId = productId;
  } else {
    const label = cleanString(filter?.label, MAX_LABEL_LENGTH);
    if (label) entry.label = label;
    const legacyId = cleanString(filter?.id, 128);
    if (isManualId(legacyId)) entry.legacyId = legacyId;
  }
  // A known catalog sponge id stays a sponge (phase C), and a known UGF id a UGF (phase F), whatever
  // type old data stored.
  if (productId && isKnownSpongeProductId(productId)) entry.type = SPONGE_TYPE;
  else if (productId && isKnownUgfProductId(productId)) entry.type = UGF_TYPE;
  else entry.type = canonicalizeFilterType(typeValue);
  if (isSpongeFilter({ type: entry.type })) {
    return buildSpongeEntry(entry, extra, gph);
  }
  if (isUndergravelFilter({ type: entry.type })) {
    return buildUgfEntry(entry);
  }
  entry.capacityMethod = resolveCapacityMethod(filter);
  if (gph > 0) entry.gph = gph;
  if (extra.manufacturerMaxGallons !== undefined) entry.manufacturerMaxGallons = extra.manufacturerMaxGallons;
  if (extra.manufacturerMinGallons !== undefined) entry.manufacturerMinGallons = extra.manufacturerMinGallons;
  if (extra.ratingStatus !== undefined) entry.ratingStatus = extra.ratingStatus;
  // Same "meaningful" rule as v1 (an id or a flow), plus a stated rating for future entries.
  if (!entry.productId && !(gph > 0) && entry.manufacturerMaxGallons === undefined) {
    return null;
  }
  return entry;
}

// Type wins: a sponge is a rating-method entry whatever capacityMethod / gph the input carried. Its
// stored GPH (from v1, phase A v2, an old tab) is never written back as gph.
function buildSpongeEntry(entry, extra, gph) {
  entry.capacityMethod = CAPACITY_METHODS.MANUFACTURER_RATING;
  if (entry.productId) {
    // Catalog sponge: identity only. The current catalog supplies the rating on restore; stored
    // rating fields are not trusted.
    return entry;
  }
  // Custom sponge: the user-entered rating is its data. Only a verified (user-entered) rating is
  // kept as usable; anything else is a sponge that still needs a rating.
  const rating = resolveSpongeRating(extra);
  if (rating.status === RATING_STATUSES.VERIFIED) {
    entry.manufacturerMaxGallons = rating.maxGallons;
    if (rating.minGallons !== null) entry.manufacturerMinGallons = rating.minGallons;
    entry.ratingStatus = RATING_STATUSES.VERIFIED;
  } else {
    entry.ratingStatus = RATING_STATUSES.NEEDED;
  }
  // An old custom sponge's GPH is kept once as legacy metadata (never scored, never converted to
  // gallons); it is dropped as soon as the sponge has a rating.
  const legacyGph = extra.legacyGph ?? (gph > 0 ? gph : undefined);
  if (entry.ratingStatus === RATING_STATUSES.NEEDED && legacyGph !== undefined) {
    entry.legacyGph = Math.min(Math.round(legacyGph), MAX_DEVICE_GPH);
  }
  // A custom sponge is kept even with no numbers at all: it is still a biological filter.
  return entry;
}

// Type wins (phase F): a UGF is a tank_compatibility entry with no gph, whatever capacityMethod /
// gph / range the input carried. Catalog UGF: identity only (the current catalog supplies
// compatibleTanks). Custom UGF (old plans only): kept as a biological filter with no numbers; its
// stored GPH is not kept (it is never scored or shown) and no compatible tanks are stored for it.
function buildUgfEntry(entry) {
  entry.capacityMethod = CAPACITY_METHODS.TANK_COMPATIBILITY;
  return entry;
}

// App filters ({id, type, rated_gph, …} as the controller or appState holds them) → v2 entries.
export function serializeFilters(filters) {
  if (!Array.isArray(filters)) return [];
  const entries = filters
    .filter((filter) => filter && typeof filter === 'object')
    .map((filter) => buildEntry(filter, {
      typeValue: filter.type ?? filter.kind ?? filter.filterType,
      gphValue: filter.rated_gph ?? filter.gph,
    }))
    .filter(Boolean);
  return assignInstanceIds(entries);
}

// v2 entry → the app-filter shape both readers (controller, stocking.js) already consume.
function toAppFilter(entry) {
  const appFilter = {
    id: entry.productId ?? entry.legacyId ?? `${MANUAL_ID_PREFIX}${entry.instanceId}`,
    type: entry.type,
    rated_gph: entry.gph ?? 0,
    source: entry.source,
    instanceId: entry.instanceId,
    capacityMethod: entry.capacityMethod,
  };
  if (entry.productId) appFilter.productId = entry.productId;
  if (entry.label) appFilter.label = entry.label;
  if (entry.legacyGph !== undefined) appFilter.legacyGph = entry.legacyGph;
  if (entry.manufacturerMaxGallons !== undefined) appFilter.manufacturerMaxGallons = entry.manufacturerMaxGallons;
  if (entry.manufacturerMinGallons !== undefined) appFilter.manufacturerMinGallons = entry.manufacturerMinGallons;
  if (entry.ratingStatus !== undefined) appFilter.ratingStatus = entry.ratingStatus;
  return appFilter;
}

function parseV2Entry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw.source === SAVED_FILTER_SOURCES.PRODUCT || raw.source === SAVED_FILTER_SOURCES.CUSTOM
    ? raw.source
    : null;
  const filter = {
    ...raw,
    // v2 names the catalog identity productId; never read a stray id as one.
    id: source === SAVED_FILTER_SOURCES.PRODUCT ? raw.productId : raw.legacyId,
    source: source ?? (raw.productId ? SAVED_FILTER_SOURCES.PRODUCT : SAVED_FILTER_SOURCES.CUSTOM),
  };
  if (filter.source === SAVED_FILTER_SOURCES.CUSTOM) {
    delete filter.productId;
  }
  return buildEntry(filter, { typeValue: raw.type ?? raw.filterType, gphValue: raw.gph ?? raw.rated_gph });
}

// v1 {id, type, rated_gph} → v2 entry. A powered entry keeps its meaning exactly: a flow filter with
// its stored GPH; a known product is re-resolved from the catalog on restore, an unknown id falls
// back to its stored GPH, as v1 does. A SPONGE entry becomes a rating-method entry (buildEntry):
// a catalog id is re-resolved from the catalog, a custom one needs a rating; its GPH is not scored.
export function migrateV1Entry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const filter = {
    id: raw.id,
    label: raw.label,
    capacityMethod: CAPACITY_METHODS.FLOW,
  };
  return buildEntry(filter, { typeValue: raw.type ?? raw.kind ?? raw.filterType, gphValue: raw.rated_gph ?? raw.gph });
}

function parseJson(raw) {
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return undefined;
  }
}

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function readV2(storage) {
  const parsed = parseJson(safeGet(storage, FILTER_STORAGE_KEY_V2));
  if (!parsed || typeof parsed !== 'object' || parsed.v !== SAVED_FILTERS_VERSION || !Array.isArray(parsed.filters)) {
    return null;
  }
  const entries = parsed.filters.map(parseV2Entry).filter(Boolean);
  return assignInstanceIds(entries);
}

function readV1(storage) {
  const parsed = parseJson(safeGet(storage, FILTER_STORAGE_KEY_V1));
  if (!Array.isArray(parsed)) return [];
  const entries = parsed.map(migrateV1Entry).filter(Boolean);
  return assignInstanceIds(entries);
}

function defaultStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (_error) {
    return null;
  }
}

/**
 * Reads v2 when it is present and well formed; otherwise migrates v1 in memory (it is written back
 * as v2 on the next save). Never throws: unreadable storage gives an empty list.
 * @returns {{ version: 2 | 1 | 0, entries: object[], filters: object[] }}
 */
export function readSavedFilterState(storage = defaultStorage()) {
  if (!storage) {
    return { version: 0, entries: [], filters: [] };
  }
  const v2 = readV2(storage);
  if (v2) {
    return { version: 2, entries: v2, filters: v2.map(toAppFilter) };
  }
  const v1 = readV1(storage);
  return { version: v1.length ? 1 : 0, entries: v1, filters: v1.map(toAppFilter) };
}

export function readSavedFilters(storage = defaultStorage()) {
  return readSavedFilterState(storage).filters;
}

// Writes v2 only (phase E: no v1 mirror). After a successful v2 write the historical v1 key is
// removed: v2 now holds the plan, and a stale v1 must not return if v2 is later lost. An empty list
// removes both keys, so a cleared plan cannot be resurrected by the v1 fallback. If the v2 write
// fails, v1 is left alone (nothing is lost). Storage errors are ignored.
export function writeSavedFilters(storage = defaultStorage(), filters = []) {
  if (!storage) return false;
  try {
    const entries = serializeFilters(filters);
    if (!entries.length) {
      storage.removeItem(FILTER_STORAGE_KEY_V2);
      storage.removeItem(FILTER_STORAGE_KEY_V1);
      return true;
    }
    storage.setItem(FILTER_STORAGE_KEY_V2, JSON.stringify({ v: SAVED_FILTERS_VERSION, filters: entries }));
    storage.removeItem(FILTER_STORAGE_KEY_V1);
    return true;
  } catch (_error) {
    return false;
  }
}
