/**
 * Developer Note — Gemini RBC Rollout (Oct 2025)
 *
 * The previous prototype math reduced "bioload" by subtracting a filter relief
 * factor from the numerator. That approach was fragile — it compounded string
 * concatenation bugs, made sponge filters appear to raise stocking %, and was
 * impossible to reason about when multiple filters stacked. The Gemini rebuild
 * flips the model to biological capacity boosts: we always recalc stocking from
 * the immutable base load and expand the tank's effective capacity via Relative
 * Biological Capacity (RBC) modifiers.
 */

export const RBC_TABLE = Object.freeze({
  SPONGE_SMALL: 0.2,
  SPONGE_LARGE: 0.4,
  HOB_SMALL_CARTRIDGE: 0.15,
  HOB_LARGE_BASKET: 0.6,
  CANISTER_MID: 0.75,
  CANISTER_LARGE: 1.25,
});

export const MAX_CAPACITY_BONUS = 0.6; // Cap total filtration benefit at +60%

const DIMINISHING_WEIGHT_BASE = 2;
const DEFAULT_RBC = RBC_TABLE.HOB_SMALL_CARTRIDGE;
const MAX_SINGLE_RBC = RBC_TABLE.CANISTER_LARGE;

const MEDIA_VOLUME_KEYS = [
  'mediaVolumeL',
  'mediaVolume',
  'media_volume_l',
  'mediaVolumeLiters',
  'media_l',
];

const FLOW_KEYS = ['rated_gph', 'ratedGph', 'gph', 'flow', 'flowGPH', 'gphRated'];

function toLowerSafe(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeType(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function toNum(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMediaVolume(filter) {
  for (const key of MEDIA_VOLUME_KEYS) {
    if (key in (filter ?? {})) {
      const candidate = toNum(filter[key]);
      if (Number.isFinite(candidate) && candidate > 0) {
        return candidate;
      }
    }
  }
  return 0;
}

function hasLargeHint(typeText, sizeText) {
  const type = toLowerSafe(typeText);
  const size = toLowerSafe(sizeText);
  return type.includes('large') || size.includes('large') || type.includes('xl');
}

function inferRbcFromVolume(volumeL) {
  if (!Number.isFinite(volumeL) || volumeL <= 0) {
    return 0;
  }
  if (volumeL >= 3.9) {
    return RBC_TABLE.CANISTER_LARGE;
  }
  if (volumeL >= 1.8) {
    return RBC_TABLE.CANISTER_MID;
  }
  if (volumeL >= 1.0) {
    return RBC_TABLE.HOB_LARGE_BASKET;
  }
  if (volumeL >= 0.8) {
    return RBC_TABLE.SPONGE_LARGE;
  }
  if (volumeL >= 0.3) {
    return RBC_TABLE.SPONGE_SMALL;
  }
  return RBC_TABLE.HOB_SMALL_CARTRIDGE;
}

function inferRbcByType(filter) {
  const rawType =
    normalizeType(filter?.archetype)
    ?? normalizeType(filter?.resolvedType)
    ?? normalizeType(filter?.kind)
    ?? normalizeType(filter?.type)
    ?? normalizeType(filter?.filterType)
    ?? normalizeType(filter?.sourceType);

  const type = toLowerSafe(rawType);
  const size = filter?.size;
  const volume = parseMediaVolume(filter);
  const hasBasket = Boolean(filter?.hasBasket || filter?.basket || filter?.mediaBasket);

  if (type.includes('canister')) {
    return hasLargeHint(rawType, size) || volume >= 3.9
      ? RBC_TABLE.CANISTER_LARGE
      : RBC_TABLE.CANISTER_MID;
  }
  if (type.includes('sponge')) {
    return hasLargeHint(rawType, size) || volume >= 0.8
      ? RBC_TABLE.SPONGE_LARGE
      : RBC_TABLE.SPONGE_SMALL;
  }
  if (type.includes('hob') || type.includes('hang')) {
    if (hasBasket || type.includes('basket') || hasLargeHint(rawType, size) || volume >= 1.0) {
      return RBC_TABLE.HOB_LARGE_BASKET;
    }
    if (volume > 0) {
      return volume >= 1.0 ? RBC_TABLE.HOB_LARGE_BASKET : RBC_TABLE.HOB_SMALL_CARTRIDGE;
    }
    return RBC_TABLE.HOB_SMALL_CARTRIDGE;
  }
  if (type.includes('ugf') || type.includes('undergravel')) {
    return 0.35;
  }
  if (type.includes('internal') || type.includes('powerhead')) {
    return 0.3;
  }
  if (volume > 0) {
    return inferRbcFromVolume(volume);
  }
  if (!type) {
    return volume > 0 ? inferRbcFromVolume(volume) : DEFAULT_RBC;
  }
  return DEFAULT_RBC;
}

export function rbcForFilter(filter) {
  if (!filter) {
    return 0;
  }
  const direct = toNum(filter?.rbc ?? filter?.RBC);
  if (Number.isFinite(direct) && direct > 0) {
    return clamp(direct, 0, MAX_SINGLE_RBC);
  }
  const volume = parseMediaVolume(filter);
  const inferred = inferRbcByType({ ...filter, mediaVolumeL: volume });
  return clamp(inferred || DEFAULT_RBC, 0, MAX_SINGLE_RBC);
}

function parseFlow(filter) {
  for (const key of FLOW_KEYS) {
    if (key in (filter ?? {})) {
      const candidate = toNum(filter[key]);
      if (Number.isFinite(candidate) && candidate > 0) {
        return candidate;
      }
    }
  }
  return 0;
}

export function normalizeFilter(filter) {
  if (!filter) {
    return null;
  }
  const id = typeof filter?.id === 'string' && filter.id ? filter.id : null;
  const source = typeof filter?.source === 'string' && filter.source ? filter.source : null;
  const label = typeof filter?.label === 'string' && filter.label ? filter.label : null;
  const type =
    normalizeType(filter?.archetype)
    ?? normalizeType(filter?.resolvedType)
    ?? normalizeType(filter?.kind)
    ?? normalizeType(filter?.type)
    ?? normalizeType(filter?.filterType)
    ?? null;
  const mediaVolumeL = parseMediaVolume(filter);
  const rbc = rbcForFilter({ ...filter, mediaVolumeL });
  const ratedGph = parseFlow(filter);
  return {
    id,
    source,
    label,
    type,
    mediaVolumeL,
    ratedGph,
    rbc,
  };
}

export function normalizeFilters(filters) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return [];
  }
  const normalized = [];
  for (const filter of filters) {
    const entry = normalizeFilter(filter);
    if (!entry) {
      continue;
    }
    if (entry.rbc <= 0 && entry.ratedGph <= 0) {
      continue;
    }
    normalized.push(entry);
  }
  return normalized;
}

function diminishingWeight(index) {
  if (index <= 0) {
    return 1;
  }
  return 1 / DIMINISHING_WEIGHT_BASE ** index;
}

export function describeFilterCapacity(filters, { cap = MAX_CAPACITY_BONUS, normalized = false } = {}) {
  const list = normalized ? filters.slice() : normalizeFilters(filters);
  if (!list.length) {
    return { total: 0, breakdown: [] };
  }
  const sorted = [...list].sort((a, b) => {
    if (b.rbc === a.rbc) {
      return (b.ratedGph || 0) - (a.ratedGph || 0);
    }
    return b.rbc - a.rbc;
  });
  const contributions = [];
  let rawTotal = 0;
  sorted.forEach((entry, index) => {
    const weight = diminishingWeight(index);
    const weighted = entry.rbc * weight;
    rawTotal += weighted;
    contributions.push({ ...entry, weight, weighted });
  });
  const capped = clamp(rawTotal, 0, cap);
  const scale = rawTotal > 0 ? capped / rawTotal : 1;
  const breakdown = contributions.map((entry) => ({
    id: entry.id,
    source: entry.source,
    type: entry.type,
    label: entry.label,
    mediaVolumeL: entry.mediaVolumeL,
    ratedGph: entry.ratedGph,
    rbc: entry.rbc,
    weight: entry.weight,
    weighted: entry.weighted,
    applied: entry.weighted * scale,
  }));
  return { total: capped, breakdown };
}

export function combinedRbc(filters, options = {}) {
  const { cap = MAX_CAPACITY_BONUS, normalized = false, includeBreakdown = false } = options;
  const details = describeFilterCapacity(filters, { cap, normalized });
  return includeBreakdown ? details : details.total;
}

export function effectiveCapacity(baseCapacity, filters, options = {}) {
  const base = Math.max(0, toNum(baseCapacity));
  const { cap = MAX_CAPACITY_BONUS, normalized = false, includeBreakdown = false } = options;
  const details = describeFilterCapacity(filters, { cap, normalized });
  const effective = base * (1 + details.total);
  if (includeBreakdown) {
    return {
      base,
      effective,
      modifier: details.total,
      filters: details.breakdown,
    };
  }
  return effective;
}

export function turnoverX(totalGph, gallons) {
  const flow = Math.max(0, toNum(totalGph));
  const volume = Math.max(1, toNum(gallons));
  return flow / volume;
}

export const computeTurnover = turnoverX; // Backwards-compatible alias

export function getTotalGPH(filters, { normalized = false } = {}) {
  const list = normalized ? filters.slice() : normalizeFilters(filters);
  if (!list.length) {
    return { rated: 0, actual: 0 };
  }
  return list.reduce(
    (acc, entry) => {
      const rated = entry.ratedGph > 0 ? entry.ratedGph : 0;
      acc.rated += rated;
      acc.actual += rated;
      return acc;
    },
    { rated: 0, actual: 0 },
  );
}

export function computePercent(baseBioload, capacity) {
  const load = Math.max(0, toNum(baseBioload));
  const cap = Math.max(1, toNum(capacity));
  const percent = (load / cap) * 100;
  return clamp(percent, 0, 2000);
}

export function stockingPercent(baseBioload, capacity) {
  return computePercent(baseBioload, capacity);
}

export function toTurnoverLabel(totalGph, gallons) {
  const ratio = turnoverX(totalGph, gallons);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return '0.0';
  }
  return ratio.toFixed(1);
}
