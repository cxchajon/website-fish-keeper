const OPTIMAL_STATUS = Object.freeze({ score: 100, status: 'Optimal' });
const TOLERABLE_STATUS = Object.freeze({ score: 70, status: 'Tolerable (not ideal)' });
const INCOMPATIBLE_STATUS = Object.freeze({ score: 0, status: 'Incompatible' });

function toRange(range) {
  if (!Array.isArray(range) || range.length !== 2) {
    return null;
  }
  const [rawMin, rawMax] = range;
  const min = Number(rawMin);
  const max = Number(rawMax);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }
  if (min <= max) {
    return [min, max];
  }
  return [max, min];
}

function valueFromInput(input) {
  if (Array.isArray(input) && input.length === 2) {
    const mid = (Number(input[0]) + Number(input[1])) / 2;
    return Number.isFinite(mid) ? mid : NaN;
  }
  if (input && typeof input === 'object') {
    if (Number.isFinite(input.value)) return Number(input.value);
    if (Number.isFinite(input.min) && Number.isFinite(input.max)) {
      return (Number(input.min) + Number(input.max)) / 2;
    }
  }
  const numeric = Number(input);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function inRange(value, range) {
  if (!range) return false;
  const [min, max] = range;
  return value >= min && value <= max;
}

export function compatScore(specParam, tankValue) {
  const optimalRange = toRange(specParam?.optimal);
  const tolerableRange = toRange(specParam?.tolerable);
  const value = valueFromInput(tankValue);

  if (!Number.isFinite(value)) {
    return OPTIMAL_STATUS;
  }

  if (optimalRange && inRange(value, optimalRange)) {
    return OPTIMAL_STATUS;
  }

  if (tolerableRange && inRange(value, tolerableRange)) {
    return TOLERABLE_STATUS;
  }

  return INCOMPATIBLE_STATUS;
}
