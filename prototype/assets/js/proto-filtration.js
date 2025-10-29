import { normalizeFilters, effectiveCapacity, computePercent, toNum } from './proto-filtration-math.js';

function cloneArray(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((item) => (item && typeof item === 'object' ? { ...item } : item));
}

export function makeState({ gallons = 0, tankGallons = undefined, stock = [], stockList = [], filters = [], selectedFilters = [] } = {}) {
  const volume = Number.isFinite(toNum(tankGallons)) && toNum(tankGallons) > 0 ? toNum(tankGallons) : toNum(gallons);
  return {
    tankGallons: Math.max(0, volume),
    stockList: cloneArray(stockList.length ? stockList : stock),
    selectedFilters: cloneArray(selectedFilters.length ? selectedFilters : filters),
  };
}

export function computeBaseBioload(stockEntries = []) {
  if (!Array.isArray(stockEntries) || stockEntries.length === 0) {
    return 0;
  }
  return stockEntries.reduce((sum, entry) => {
    if (!entry || typeof entry !== 'object') {
      return sum;
    }
    const directTotal = toNum(
      entry.total ?? entry.totalLoad ?? entry.totalBioload ?? entry.bioload ?? entry.load ?? entry.geTotal ?? entry.totalGE,
    );
    if (directTotal > 0) {
      return sum + directTotal;
    }
    const perUnit = toNum(
      entry.perUnit
        ?? entry.unit
        ?? entry.ge
        ?? entry.bioloadUnit
        ?? entry.geEach
        ?? entry.perFish
        ?? entry.per
        ?? entry.loadEach,
    );
    const quantity = toNum(
      entry.qty ?? entry.count ?? entry.quantity ?? entry.units ?? entry.total ?? entry.stock ?? entry.num ?? entry.q ?? 0,
    );
    if (perUnit > 0 && quantity > 0) {
      return sum + perUnit * quantity;
    }
    return sum;
  }, 0);
}

export function computeCapacitySnapshot(gallonsInput, filtersInput = []) {
  const gallons = Math.max(0, toNum(gallonsInput));
  const normalizedFilters = normalizeFilters(filtersInput);
  const capacityDetails = effectiveCapacity(gallons, normalizedFilters, {
    normalized: true,
    includeBreakdown: true,
  });
  return {
    gallons,
    normalizedFilters: cloneArray(normalizedFilters),
    effectiveCapacity: capacityDetails.effective,
    capacityModifier: capacityDetails.modifier,
    filters: cloneArray(capacityDetails.filters),
  };
}

export function recompute(state = {}) {
  const gallons = Math.max(0, toNum(state?.tankGallons));
  const stockList = Array.isArray(state?.stockList) ? state.stockList : [];
  const selectedFilters = Array.isArray(state?.selectedFilters) ? state.selectedFilters : [];
  const baseBioload = computeBaseBioload(stockList);
  const capacitySnapshot = computeCapacitySnapshot(gallons, selectedFilters);
  const percent = capacitySnapshot.effectiveCapacity > 0
    ? computePercent(baseBioload, capacitySnapshot.effectiveCapacity)
    : 0;
  return {
    gallons,
    baseBioload,
    effectiveCapacity: capacitySnapshot.effectiveCapacity,
    capacityModifier: capacitySnapshot.capacityModifier,
    filters: capacitySnapshot.filters,
    normalizedFilters: capacitySnapshot.normalizedFilters,
    percent,
  };
}

export function percent(state = {}) {
  return recompute(state).percent;
}

export function recomputeAndRender(state = {}, hooks = {}) {
  const result = recompute(state);
  if (hooks && typeof hooks.renderBioloadMeter === 'function') {
    hooks.renderBioloadMeter(result.percent);
  }
  if (hooks && typeof hooks.renderBioload === 'function') {
    hooks.renderBioload(result.percent);
  }
  if (hooks && typeof hooks.renderFiltrationSummary === 'function') {
    hooks.renderFiltrationSummary(state.selectedFilters ?? [], result.gallons, result.effectiveCapacity);
  }
  if (hooks && typeof hooks.renderWarnings === 'function') {
    hooks.renderWarnings(state, result.percent);
  }
  return result;
}
