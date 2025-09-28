// Preset tank size data derived from common manufacturer specs.
// Source: SaltwaterAquarium "Standard Aquariums: Weights & Sizes"; Aqueon spec variations noted in dataset.
export const TANK_SIZES = [
  {
    id: 'g5',
    label: '5 Gallon (Standard)',
    gallons: 5,
    liters: 18.927,
    dimensions_in: { l: 16, w: 8, h: 10 },
    dimensions_cm: { l: 40.64, w: 20.32, h: 25.4 },
    filled_weight_lbs: 62,
    empty_weight_lbs: 7,
    footprint_in: '16 × 8',
    category: 'Nano',
    notes: 'Typical 5.5g rect.; dims ~16×8×10 in; values vary by brand.',
  },
  {
    id: 'g90',
    label: '90 Gallon (Standard)',
    gallons: 90,
    liters: 340.687,
    dimensions_in: { l: 48, w: 18, h: 24 },
    dimensions_cm: { l: 121.92, w: 45.72, h: 60.96 },
    filled_weight_lbs: 1050,
    empty_weight_lbs: 160,
    footprint_in: '48 × 18',
    category: 'Large',
    notes: 'Common 90g dimensions; check stand/floor ratings.',
  },
  {
    id: 'g125',
    label: '125 Gallon (Standard)',
    gallons: 125,
    liters: 473.176,
    dimensions_in: { l: 72, w: 18, h: 21 },
    dimensions_cm: { l: 182.88, w: 45.72, h: 53.34 },
    filled_weight_lbs: 1206,
    empty_weight_lbs: 206,
    footprint_in: '72 × 18',
    category: 'XL',
    notes: 'Standard 125g long; some manufacturers list 22" height and slightly different weights.',
  },
];

export function getTankById(id) {
  if (!id) return null;
  return TANK_SIZES.find((tank) => tank.id === id) ?? null;
}

export function listTanks() {
  return TANK_SIZES.slice();
}

export default TANK_SIZES;
