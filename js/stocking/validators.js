export function formatLength(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  const fixed = value.toFixed(2);
  const trimmed = fixed.replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1');
  return `${trimmed}″`;
}

export function tankLengthStatus({ tank, species }) {
  const requiredValue = Number(species?.min_tank_length_in);
  const required = Number.isFinite(requiredValue) && requiredValue > 0 ? requiredValue : null;
  const actualValue = Number(tank?.lengthIn);
  const actual = Number.isFinite(actualValue) && actualValue > 0 ? actualValue : null;

  if (!required) {
    return { show: false, required: null, actual, message: '' };
  }

  if (actual == null) {
    return { show: false, required, actual: null, message: '' };
  }

  const show = actual < required;
  if (!show) {
    return { show: false, required, actual, message: '' };
  }

  const message = `Needs ${formatLength(required)} tank length (yours ${formatLength(actual)})`;
  return { show, required, actual, message };
}
