import { computeBioload, evaluateCompatibility } from '../src/engine.js';

const plans = [
  {
    id: 'tropical-peaceful',
    name: 'Tropical peaceful community',
    gallons: 36,
    entries: [
      { speciesId: 'cardinal', count: 12 },
      { speciesId: 'cory_panda', count: 8 },
      { speciesId: 'otocinclus', count: 6 },
    ],
  },
  {
    id: 'semi-aggressive',
    name: 'Semi-aggressive schooling tank',
    gallons: 55,
    entries: [
      { speciesId: 'tiger_barb', count: 12 },
      { speciesId: 'zebra', count: 10 },
    ],
  },
  {
    id: 'shrimp-nano',
    name: 'Shrimp nano',
    gallons: 10,
    entries: [
      { speciesId: 'neocaridina', count: 20 },
      { speciesId: 'chili', count: 12 },
    ],
  },
];

describe('integration scenarios', () => {
  for (const plan of plans) {
    test(`${plan.name} produces sensible bioload and compatibility`, () => {
      const bioload = computeBioload(plan);
      expect(bioload.capacity).toBeGreaterThan(0);
      expect(bioload.totalBioload).toBeGreaterThan(0);

      const compat = evaluateCompatibility(plan);
      if (plan.id === 'semi-aggressive') {
        expect(compat.warnings.length).toBeGreaterThanOrEqual(0);
      } else {
        expect(compat.blockers).toHaveLength(0);
      }
    });
  }
});
