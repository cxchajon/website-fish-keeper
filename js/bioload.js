export const DEFAULT_DISPLACEMENT = 0.10;       // 10% volume lost to substrate/scape
export const PLANTED_CAPACITY_BONUS = 0.15;     // +15% effective capacity when "Planted" is ON
export const MIN_RENDERED_PERCENT = 0.1;        // floor for display; values below still show as "<0.1%"

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function getEffectiveGallons(rawGallons, { planted = false, displacement = DEFAULT_DISPLACEMENT } = {}) {
  const gallons = Math.max(0, toNumber(rawGallons));
  const base = Math.max(0, gallons * (1 - displacement));
  const withPlants = planted ? base * (1 + PLANTED_CAPACITY_BONUS) : base;
  return withPlants;
}

function lookupSpecies(speciesMap, speciesId) {
  if (!speciesMap) return undefined;
  if (typeof speciesMap.get === 'function') {
    return speciesMap.get(speciesId);
  }
  if (typeof speciesMap === 'object') {
    return speciesMap[speciesId];
  }
  return undefined;
}

// sum up gallon-equivalents (GE) across the current stock
export function getTotalGE(currentStock = [], speciesMap) {
  return currentStock.reduce((sum, item) => {
    const s = lookupSpecies(speciesMap, item?.speciesId);
    const ge = Number.isFinite(s?.bioloadGE) ? s.bioloadGE : 0;
    const count = toNumber(item?.count);
    return sum + ge * Math.max(0, count);
  }, 0);
}

export function computeBioloadPercent({ gallons, planted = false, currentStock = [], speciesMap, displacement } = {}) {
  const eff = getEffectiveGallons(gallons, { planted, displacement });
  const totalGE = getTotalGE(currentStock, speciesMap);
  if (eff <= 0) return 0;
  const pct = (totalGE / eff) * 100;
  return Math.max(0, Math.min(200, pct));
}

export function formatBioloadPercent(pct) {
  if (!Number.isFinite(pct) || pct <= 0) {
    return '0.0%';
  }
  const clamped = Math.max(0, Math.min(200, pct));
  if (clamped > 0 && clamped < MIN_RENDERED_PERCENT) {
    return '<0.1%';
  }
  return `${clamped.toFixed(1)}%`;
}

const TYPE_FACTORS = Object.freeze({
  CANISTER: 1.10,
  HOB: 1.00,
  SPONGE: 0.90,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeTypeFactor(filterType, hasProduct) {
  if (!hasProduct) {
    return 1;
  }
  const key = String(filterType || '').toUpperCase();
  return TYPE_FACTORS[key] ?? 1;
}

export function computeFiltrationFactor({ filterType, hasProduct = false, turnover = null } = {}) {
  const typeFactor = computeTypeFactor(filterType, hasProduct);
  const flowFactor = 1;
  const combined = clamp(typeFactor * flowFactor, 0.9, 1.1);
  return {
    typeFactor,
    flowFactor,
    totalFactor: combined,
  };
}
