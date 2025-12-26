import { computeBioload, listSpecies } from '../src/engine.js';

const [bettaMale, cardinal, cory] = ['betta_male', 'cardinal', 'cory_panda'].map((id) => {
  const species = listSpecies().find((s) => s.id === id);
  if (!species) {
    throw new Error(`Missing species ${id}`);
  }
  return species;
});

describe('bioload calculations with real data', () => {
  test('adding more fish raises total bioload', () => {
    const lightPlan = {
      id: 'plan-light',
      name: 'Light stocking',
      gallons: 29,
      entries: [
        { speciesId: cardinal.id, count: 6 },
        { speciesId: cory.id, count: 6 },
      ],
    };

    const heavyPlan = {
      ...lightPlan,
      id: 'plan-heavy',
      entries: [
        { speciesId: cardinal.id, count: 12 },
        { speciesId: cory.id, count: 10 },
      ],
    };

    const light = computeBioload(lightPlan);
    const heavy = computeBioload(heavyPlan);

    expect(heavy.totalBioload).toBeGreaterThan(light.totalBioload);
    expect(heavy.percent).toBeGreaterThan(light.percent);
  });
});
