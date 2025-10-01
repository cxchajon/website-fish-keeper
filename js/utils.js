// Canonical tank size helpers shared across pages.
// Each entry represents a common freshwater aquarium with standard manufacturer specs.

const INCH_TO_CM = 2.54;

function liters(gallons) {
  return Math.round(gallons * 3.78541 * 1000) / 1000;
}

function cm(valueInInches) {
  return Math.round(valueInInches * INCH_TO_CM * 100) / 100;
}

export const TANK_SIZES = [
  {
    id: '5g',
    label: '5 Gallon (19 L)',
    gallons: 5,
    liters: liters(5),
    lengthIn: 16.2,
    widthIn: 8.4,
    heightIn: 10.5,
    dimensions_in: { l: 16.2, w: 8.4, h: 10.5 },
    dimensions_cm: { l: cm(16.2), w: cm(8.4), h: cm(10.5) },
    filled_weight_lbs: 62,
    empty_weight_lbs: 7,
  },
  {
    id: '10g',
    label: '10 Gallon (38 L)',
    gallons: 10,
    liters: liters(10),
    lengthIn: 20.25,
    widthIn: 10.5,
    heightIn: 12.6,
    dimensions_in: { l: 20.25, w: 10.5, h: 12.6 },
    dimensions_cm: { l: cm(20.25), w: cm(10.5), h: cm(12.6) },
    filled_weight_lbs: 111,
    empty_weight_lbs: 11,
  },
  {
    id: '15g',
    label: '15 Gallon High (57 L)',
    gallons: 15,
    liters: liters(15),
    lengthIn: 20.25,
    widthIn: 10.5,
    heightIn: 18.75,
    dimensions_in: { l: 20.25, w: 10.5, h: 18.75 },
    dimensions_cm: { l: cm(20.25), w: cm(10.5), h: cm(18.75) },
    filled_weight_lbs: 170,
    empty_weight_lbs: 21,
  },
  {
    id: '20h',
    label: '20 Gallon High (76 L)',
    gallons: 20,
    liters: liters(20),
    lengthIn: 24.25,
    widthIn: 12.5,
    heightIn: 16.75,
    dimensions_in: { l: 24.25, w: 12.5, h: 16.75 },
    dimensions_cm: { l: cm(24.25), w: cm(12.5), h: cm(16.75) },
    filled_weight_lbs: 225,
    empty_weight_lbs: 25,
  },
  {
    id: '20l',
    label: '20 Gallon Long (76 L)',
    gallons: 20,
    liters: liters(20),
    lengthIn: 30.25,
    widthIn: 12.5,
    heightIn: 12.75,
    dimensions_in: { l: 30.25, w: 12.5, h: 12.75 },
    dimensions_cm: { l: cm(30.25), w: cm(12.5), h: cm(12.75) },
    filled_weight_lbs: 225,
    empty_weight_lbs: 25,
  },
  {
    id: '29g',
    label: '29 Gallon (110 L)',
    gallons: 29,
    liters: liters(29),
    lengthIn: 30.25,
    widthIn: 12.5,
    heightIn: 18.75,
    dimensions_in: { l: 30.25, w: 12.5, h: 18.75 },
    dimensions_cm: { l: cm(30.25), w: cm(12.5), h: cm(18.75) },
    filled_weight_lbs: 330,
    empty_weight_lbs: 40,
  },
  {
    id: '40b',
    label: '40 Gallon Breeder (151 L)',
    gallons: 40,
    liters: liters(40),
    lengthIn: 36.25,
    widthIn: 18.25,
    heightIn: 16.75,
    dimensions_in: { l: 36.25, w: 18.25, h: 16.75 },
    dimensions_cm: { l: cm(36.25), w: cm(18.25), h: cm(16.75) },
    filled_weight_lbs: 458,
    empty_weight_lbs: 58,
  },
  {
    id: '55g',
    label: '55 Gallon (208 L)',
    gallons: 55,
    liters: liters(55),
    lengthIn: 48.25,
    widthIn: 12.75,
    heightIn: 21,
    dimensions_in: { l: 48.25, w: 12.75, h: 21 },
    dimensions_cm: { l: cm(48.25), w: cm(12.75), h: cm(21) },
    filled_weight_lbs: 625,
    empty_weight_lbs: 78,
  },
  {
    id: '75g',
    label: '75 Gallon (284 L)',
    gallons: 75,
    liters: liters(75),
    lengthIn: 48.5,
    widthIn: 18.5,
    heightIn: 21.25,
    dimensions_in: { l: 48.5, w: 18.5, h: 21.25 },
    dimensions_cm: { l: cm(48.5), w: cm(18.5), h: cm(21.25) },
    filled_weight_lbs: 850,
    empty_weight_lbs: 140,
  },
  {
    id: '125g',
    label: '125 Gallon (473 L)',
    gallons: 125,
    liters: liters(125),
    lengthIn: 72,
    widthIn: 18,
    heightIn: 21,
    dimensions_in: { l: 72, w: 18, h: 21 },
    dimensions_cm: { l: cm(72), w: cm(18), h: cm(21) },
    filled_weight_lbs: 1206,
    empty_weight_lbs: 206,
  },
];

const CANONICAL_IDS = new Set(TANK_SIZES.map((tank) => tank.id));

const LEGACY_ALIASES = new Map([
  ['g5', '5g'],
  ['g10', '10g'],
  ['g15h', '15g'],
  ['g20h', '20h'],
  ['g20l', '20l'],
  ['g29', '29g'],
  ['g40b', '40b'],
  ['g55', '55g'],
  ['g75', '75g'],
  ['g125', '125g'],
  ['20 gallon high', '20h'],
  ['20 gallon long', '20l'],
  ['20 high', '20h'],
  ['20 long', '20l'],
  ['15 gallon high', '15g'],
  ['40 gallon breeder', '40b'],
  ['55 gallon', '55g'],
  ['75 gallon', '75g'],
  ['125 gallon', '125g'],
  ['29 gallon', '29g'],
  ['10 gallon', '10g'],
  ['5 gallon', '5g'],
  ['15 gallon', '15g'],
]);

let legacyWarningShown = false;

export function getTankById(id) {
  if (!id) return null;
  return TANK_SIZES.find((tank) => tank.id === id) ?? null;
}

export function normalizeLegacyTankSelection(oldValue) {
  const fallback = '29g';
  if (!oldValue) {
    return fallback;
  }

  const value = String(oldValue).trim();
  if (!value) {
    return fallback;
  }

  if (CANONICAL_IDS.has(value)) {
    return value;
  }

  const lowered = value.toLowerCase();

  if (CANONICAL_IDS.has(lowered)) {
    return lowered;
  }

  if (LEGACY_ALIASES.has(lowered)) {
    return LEGACY_ALIASES.get(lowered);
  }

  if (lowered === '20g' || lowered === '20' || (lowered.includes('20') && lowered.includes('gall'))) {
    return '20l';
  }

  if (!legacyWarningShown) {
    legacyWarningShown = true;
    console.warn('Legacy tank removed or ambiguous. Fallback to 29 Gallon (29g).');
  }

  return fallback;
}

export function listTankIds() {
  return TANK_SIZES.map((tank) => tank.id);
}

export default TANK_SIZES;
