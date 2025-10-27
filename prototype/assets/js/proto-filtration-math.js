export const FILTER_BASE = Object.freeze({
  Canister: 0.60,
  HOB: 0.50,
  Internal: 0.45,
  UGF: 0.35,
  Sponge: 0.25,
});

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
  return flow / g;
}

export function computeEfficiency(type, turnover) {
  const key = resolveFilterBaseKey(type);
  const base = FILTER_BASE[key] ?? FILTER_BASE.HOB;
  const turnoverFactor = clamp(turnover / 5, 0.4, 1.3);
  return clamp(base * turnoverFactor, 0, 0.6);
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
      const gph = Number(rawGph);
      if (!Number.isFinite(gph) || gph <= 0) {
        return null;
      }

      const rawType =
        filter?.resolvedType ??
        filter?.kind ??
        filter?.type ??
        filter?.filterType ??
        filter?.source;
      const type = resolveFilterBaseKey(rawType);
      const id = typeof filter?.id === 'string' && filter.id ? filter.id : null;
      const source = typeof filter?.source === 'string' && filter.source ? filter.source : null;

      return { id, type, gph, source };
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

  const totalRaw = perFilter.reduce((sum, entry) => sum + entry.efficiency, 0);
  const total = clamp(totalRaw, 0, 0.6);

  return { total, perFilter };
}

export function computeAdjustedBioload(baseBioload, eff) {
  const b = Math.max(0, Number(baseBioload) || 0);
  const efficiency = Math.max(0, Number(eff) || 0);
  return b * (1 - efficiency);
}

export function computePercent(adjustedBioload, capacity) {
  const cap = Math.max(1, Number(capacity) || 0);
  const load = Math.max(0, Number(adjustedBioload) || 0);
  return clamp((load / cap) * 100, 0, 200);
}

export function getTotalGPH(filters) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return 0;
  }
  return filters.reduce((sum, filter) => {
    const raw =
      filter?.rated_gph ??
      filter?.ratedGph ??
      filter?.gph ??
      filter?.flow ??
      filter?.flowGPH ??
      0;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? sum + value : sum;
  }, 0);
}
