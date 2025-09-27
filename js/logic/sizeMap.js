const SIZE_MAP = new Map([
  [10, [
    { id: '10-standard', name: '10 Gallon Standard', length: 20, width: 10, height: 12, profile: 'standard', default: true },
  ]],
  [20, [
    { id: '20-high', name: '20 Gallon High', length: 24, width: 12, height: 16, profile: 'standard', default: true },
    { id: '20-long', name: '20 Gallon Long', length: 30, width: 12, height: 12, profile: 'long' },
  ]],
  [29, [
    { id: '29-standard', name: '29 Gallon', length: 30, width: 12, height: 18, profile: 'standard', default: true },
  ]],
  [30, [
    { id: '30-breeder', name: '30 Gallon Breeder', length: 36, width: 18, height: 12, profile: 'breeder', default: true },
  ]],
  [37, [
    { id: '37-portrait', name: '37 Gallon Tall', length: 36, width: 12.5, height: 20, profile: 'tall', default: true },
  ]],
  [38, [
    { id: '38-portrait', name: '38 Gallon Tall', length: 36, width: 13, height: 22, profile: 'tall', default: true },
  ]],
  [40, [
    { id: '40-breeder', name: '40 Gallon Breeder', length: 36, width: 18, height: 16, profile: 'breeder', default: true },
    { id: '40-long', name: '40 Gallon Long', length: 48, width: 12, height: 16.5, profile: 'long' },
  ]],
  [55, [
    { id: '55-standard', name: '55 Gallon', length: 48, width: 13, height: 21, profile: 'standard', default: true },
  ]],
  [75, [
    { id: '75-standard', name: '75 Gallon', length: 48, width: 18, height: 21, profile: 'standard', default: true },
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
