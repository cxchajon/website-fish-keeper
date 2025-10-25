import { computeBioload, listSpecies } from '../src/engine.js';

const [bettaMale, cardinal, cory] = ['betta_male', 'cardinal', 'cory_panda'].map((id) => {
  const species = listSpecies().find((s) => s.id === id);
  if (!species) {
    throw new Error(`Missing species ${id}`);
  }
  return species;
});

describe('bioload calculations with real data', () => {
  test('planted tanks increase capacity headroom', () => {
    const basePlan = {
      id: 'plan-1',
      name: 'Betta and cardinals',
      gallons: 20,
      planted: false,
      entries: [
        { speciesId: bettaMale.id, count: 1 },
        { speciesId: cardinal.id, count: 8 },
      ],
    };

    const plantedPlan = { ...basePlan, planted: true };

    const base = computeBioload(basePlan);
    const planted = computeBioload(plantedPlan);

    expect(planted.capacity).toBeGreaterThan(base.capacity);
    expect(planted.percent).toBeLessThan(base.percent);
  });

  test('adding more fish raises total bioload', () => {
    const lightPlan = {
      id: 'plan-light',
      name: 'Light stocking',
      gallons: 29,
      planted: true,
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
