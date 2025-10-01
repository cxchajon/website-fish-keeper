export function formatLength(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  const fixed = value.toFixed(2);
  return fixed.replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1');
}

export function tankLengthStatus({ tank, species }) {
  const required = Number(species?.min_tank_length_in);
  const hasRequirement = Number.isFinite(required) && required > 0;
  const actualRaw = Number(tank?.lengthIn);
  const actual = Number.isFinite(actualRaw) && actualRaw > 0 ? actualRaw : 0;

  if (!hasRequirement) {
    return { show: false, required: null, actual, message: '' };
  }

  const show = !Number.isFinite(actualRaw) || actualRaw <= 0 || actualRaw < required;
  const message = `Needs ${formatLength(required)}″ tank length (yours ${formatLength(actual)}″)`;
  return { show, required, actual, message };
}
