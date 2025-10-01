// Canonical tank size definitions used across stocking, bioload, and gear flows.
// Keep gallons as the numeric source of truth and use label for display strings.
const LITERS_PER_GALLON = 3.78541;

const roundLiters = (gallons, fallback) => {
  if (typeof gallons !== 'number' || !Number.isFinite(gallons)) {
    return typeof fallback === 'number' ? fallback : 0;
  }
  return Math.round(gallons * LITERS_PER_GALLON);
};

export const TANK_SIZES = [
  {
    id: '5g',
    label: '5 Gallon (19 L)',
    gallons: 5,
    liters: roundLiters(5, 19),
    dims: { w: 16, d: 8, h: 10 },
    notes: 'nano / betta',
  },
  {
    id: '10g',
    label: '10 Gallon (38 L)',
    gallons: 10,
    liters: roundLiters(10, 38),
    dims: { w: 20, d: 10, h: 12 },
    notes: 'beginner standard',
  },
  {
    id: '15g',
    label: '15 Gallon (57 L)',
    gallons: 15,
    liters: roundLiters(15, 57),
    dims: { w: 24, d: 12, h: 12 },
    notes: 'small community',
  },
  {
    id: '20h',
    label: '20 Gallon High (75 L)',
    gallons: 20,
    liters: roundLiters(20, 75),
    dims: { w: 24, d: 12, h: 16 },
    notes: 'taller profile',
  },
  {
    id: '20l',
    label: '20 Gallon Long (75 L)',
    gallons: 20,
    liters: roundLiters(20, 75),
    dims: { w: 30, d: 12, h: 12 },
    notes: 'wider footprint',
  },
  {
    id: '29g',
    label: '29 Gallon (110 L)',
    gallons: 29,
    liters: roundLiters(29, 110),
    dims: { w: 30, d: 12, h: 18 },
    notes: 'popular planted / community',
  },
  {
    id: '40b',
    label: '40 Gallon Breeder (151 L)',
    gallons: 40,
    liters: roundLiters(40, 151),
    dims: { w: 36, d: 18, h: 16 },
    notes: 'versatile footprint',
  },
  {
    id: '55g',
    label: '55 Gallon (208 L)',
    gallons: 55,
    liters: roundLiters(55, 208),
    dims: { w: 48, d: 13, h: 20 },
    notes: 'entry-level large',
  },
  {
    id: '75g',
    label: '75 Gallon (284 L)',
    gallons: 75,
    liters: roundLiters(75, 284),
    dims: { w: 48, d: 18, h: 21 },
    notes: 'large community / cichlids',
  },
  {
    id: '125g',
    label: '125 Gallon (473 L)',
    gallons: 125,
    liters: roundLiters(125, 473),
    dims: { w: 72, d: 18, h: 21 },
    notes: 'common showcase size',
  },
];

export function getTankById(id) {
  if (!id) return null;
  const match = TANK_SIZES.find((tank) => tank.id === String(id).toLowerCase());
  return match ?? null;
}

export function listTanks() {
  return TANK_SIZES.slice();
}

export default TANK_SIZES;

const DEV_EXPECTED_IDS = ['5g', '10g', '15g', '20h', '20l', '29g', '40b', '55g', '75g', '125g'];

if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
  if (!window.__TTG_TANK_SIZE_ASSERTED__) {
    window.__TTG_TANK_SIZE_ASSERTED__ = true;
    console.groupCollapsed?.('[TTG] Tank size dataset assertions');
    console.assert(
      TANK_SIZES.length === DEV_EXPECTED_IDS.length,
      `Expected ${DEV_EXPECTED_IDS.length} tank sizes, found ${TANK_SIZES.length}.`,
    );
    DEV_EXPECTED_IDS.forEach((id, index) => {
      const tank = getTankById(id);
      console.assert(Boolean(tank), `Missing tank entry for ${id}.`);
      console.assert(tank?.gallons > 0, `Tank ${id} missing gallons.`);
      console.assert(
        TANK_SIZES[index]?.id === id,
        `Tank order mismatch — expected ${id} at position ${index}.`,
      );
    });
    console.groupEnd?.();
  }
}
