const SIZE_MAP = new Map([
  [5, [
    { id: '5-standard', name: '5 Gallon Standard', length: 16.2, width: 8.4, height: 10.5, profile: 'standard', default: true },
  ]],
  [10, [
    { id: '10-standard', name: '10 Gallon Standard', length: 20.25, width: 10.5, height: 12.6, profile: 'standard', default: true },
  ]],
  [15, [
    { id: '15-standard', name: '15 Gallon', length: 20.25, width: 10.5, height: 18.75, profile: 'standard', default: true },
  ]],
  [20, [
    { id: '20-high', name: '20 Gallon High', length: 24.25, width: 12.5, height: 16.75, profile: 'standard', default: true },
    { id: '20-long', name: '20 Gallon Long', length: 30.25, width: 12.5, height: 12.75, profile: 'long' },
  ]],
  [29, [
    { id: '29-standard', name: '29 Gallon', length: 30.25, width: 12.5, height: 18.75, profile: 'standard', default: true },
  ]],
  [40, [
    { id: '40-breeder', name: '40 Gallon Breeder', length: 36.25, width: 18.25, height: 16.75, profile: 'breeder', default: true },
  ]],
  [55, [
    { id: '55-standard', name: '55 Gallon', length: 48.25, width: 12.75, height: 21, profile: 'standard', default: true },
  ]],
  [75, [
    { id: '75-standard', name: '75 Gallon', length: 48.5, width: 18.5, height: 21.25, profile: 'standard', default: true },
  ]],
  [125, [
    { id: '125-standard', name: '125 Gallon', length: 72, width: 18, height: 21, profile: 'standard', default: true },
  ]],
]);

function getDefaultVariant(gallons) {
  const variants = SIZE_MAP.get(gallons);
  if (!variants) return null;
  return variants.find((variant) => variant.default) ?? variants[0];
}

export function getTankVariants(gallons) {
  return SIZE_MAP.get(gallons) ?? [];
}

function pickVariantForBehavior(variants, context) {
  if (!variants.length) return null;
  const {
    maxLengthRequirement = 0,
    wantsLong = false,
    wantsBreeder = false,
    manualSelection,
  } = context;

  if (manualSelection) {
    const manual = variants.find((item) => item.id === manualSelection);
    if (manual) {
      return manual;
    }
  }

  let candidate = variants.find((variant) => variant.default) ?? variants[0];

  if (maxLengthRequirement && candidate.length < maxLengthRequirement) {
    const longer = [...variants]
      .filter((variant) => variant.length >= maxLengthRequirement)
      .sort((a, b) => a.length - b.length)[0];
    if (longer) {
      candidate = longer;
    }
  }

  if (wantsLong) {
    const longVariant = variants.find((variant) => variant.profile === 'long');
    if (longVariant) {
      candidate = longVariant;
    }
  }

  if (wantsBreeder) {
    const breeder = variants.find((variant) => variant.profile === 'breeder');
    if (breeder) {
      candidate = breeder;
    }
  }

  return candidate;
}

export function pickTankVariant({ gallons, speciesEntries = [], manualSelection = null }) {
  const variants = getTankVariants(gallons);
  if (!variants.length) {
    return null;
  }

  let maxLengthRequirement = 0;
  let wantsLong = false;
  let wantsBreeder = false;

  for (const entry of speciesEntries) {
    const { species, qty = 1 } = entry;
    if (!species) continue;
    if (species.min_tank_length_in) {
      maxLengthRequirement = Math.max(maxLengthRequirement, species.min_tank_length_in);
    }
    const tags = new Set(species.tags ?? []);
    if (tags.has('shoaler') || tags.has('nippy') || tags.has('fast_swimmer')) {
      wantsLong = true;
    }
    if (tags.has('bottom_territorial') || tags.has('floor_spreader')) {
      wantsBreeder = true;
    }
    if (qty >= 6 && tags.has('shoaler')) {
      wantsLong = true;
    }
  }

  return pickVariantForBehavior(variants, { maxLengthRequirement, wantsLong, wantsBreeder, manualSelection });
}

export function formatVariant(variant) {
  if (!variant) return '—';
  const { length, width, height } = variant;
  const dims = [length, width, height].filter((value) => Number.isFinite(value));
  if (!dims.length) {
    return '—';
  }
  return `${length}″ × ${width}″ × ${height}″`;
}

export function describeVariant(variant) {
  if (!variant) return '—';
  return `${variant.name} (${formatVariant(variant)})`;
}
