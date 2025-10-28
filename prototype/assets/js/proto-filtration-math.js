export const FILTER_BASE = Object.freeze({
  Canister: 0.60,
  HOB: 0.50,
  Internal: 0.45,
  UGF: 0.35,
  Sponge: 0.25,
});

export const FLOW_DERATE = 0.65; // Crosscheck Fix — Oct 2025
export const MAX_RELIEF = 0.6; // Crosscheck Fix — Oct 2025
export const TURNOVER_MIN = 0.4; // Crosscheck Fix — Oct 2025
export const TURNOVER_MAX = 1.3; // Crosscheck Fix — Oct 2025

const FILTER_TYPE_LOOKUP = Object.freeze({
  CANISTER: 'Canister',
  HOB: 'HOB',
  INTERNAL: 'Internal',
  UGF: 'UGF',
  SPONGE: 'Sponge',
});

export function resolveFilterBaseKey(type) {
  if (typeof type === 'string') {
    const upper = type.trim().toUpperCase();
    if (upper && FILTER_TYPE_LOOKUP[upper]) {
      return FILTER_TYPE_LOOKUP[upper];
    }
  }
  return 'HOB';
}

export function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}

export function computeTurnover(totalGPH, gallons) {
  const g = Math.max(1, Number(gallons) || 0);
  const flow = Math.max(0, Number(totalGPH) || 0);
  return (flow * FLOW_DERATE) / g; // Crosscheck Fix — Oct 2025
}

export function computeEfficiency(type, turnover) {
  const key = resolveFilterBaseKey(type);
  const base = FILTER_BASE[key] ?? FILTER_BASE.HOB;
  const turnoverFactor = clamp(turnover / 5, TURNOVER_MIN, TURNOVER_MAX);
  return clamp(base * turnoverFactor, 0, MAX_RELIEF);
}

export function mapFiltersForEfficiency(filters) {
  if (!Array.isArray(filters) || !filters.length) {
    return [];
  }

  return filters
    .map((filter) => {
      const rawGph =
        filter?.rated_gph ??
        filter?.ratedGph ??
        filter?.gph ??
        filter?.flow ??
        filter?.flowGPH ??
        0;
      const ratedGph = Number(rawGph);
      if (!Number.isFinite(ratedGph) || ratedGph <= 0) {
        return null;
      }
      const deratedGph = ratedGph * FLOW_DERATE; // Crosscheck Fix — Oct 2025

      const rawType =
        filter?.resolvedType ??
        filter?.kind ??
        filter?.type ??
        filter?.filterType ??
        filter?.source;
      const type = resolveFilterBaseKey(rawType);
      const id = typeof filter?.id === 'string' && filter.id ? filter.id : null;
      const source = typeof filter?.source === 'string' && filter.source ? filter.source : null;

      return { id, type, gph: deratedGph, ratedGph, source };
    })
    .filter(Boolean);
}

export function computeAggregateEfficiency(filters, turnover) {
  const normalized = mapFiltersForEfficiency(filters);
  if (!normalized.length) {
    return { total: 0, perFilter: [] };
  }

  const perFilter = normalized.map((filter) => {
    const efficiency = computeEfficiency(filter.type, turnover);
    return {
      ...filter,
      efficiency: Number.isFinite(efficiency) && efficiency > 0 ? efficiency : 0,
    };
  });

  const combined = 1 - perFilter.reduce((prod, entry) => prod * (1 - entry.efficiency), 1); // Crosscheck Fix — Oct 2025
  const total = clamp(combined, 0, MAX_RELIEF);

  return { total, perFilter };
}

export function computeAdjustedBioload(baseBioload, eff) {
  const b = Math.max(0, Number(baseBioload) || 0);
  const efficiency = Math.max(0, Number(eff) || 0);
  // Bugfix: sponge add raised bioload — Oct 2025
  const reliefFactor = Math.max(0, 1 - efficiency);
  return b * reliefFactor;
}

export function computePercent(adjustedBioload, capacity) {
  const cap = Math.max(1, Number(capacity) || 0);
  const load = Math.max(0, Number(adjustedBioload) || 0);
  return clamp((load / cap) * 100, 0, 200);
}

export function getTotalGPH(filters) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return { rated: 0, derated: 0 };
  }
  return filters.reduce(
    (acc, filter) => {
      const raw =
        filter?.rated_gph ??
        filter?.ratedGph ??
        filter?.gph ??
        filter?.flow ??
        filter?.flowGPH ??
        0;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        return acc;
      }
      acc.rated += value;
      acc.derated += value * FLOW_DERATE; // Crosscheck Fix — Oct 2025
      return acc;
    },
    { rated: 0, derated: 0 },
  );
}
