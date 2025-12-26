import { evaluateCompatibility, listSpecies } from '../src/engine.js';

function planWithEntries(entries) {
  return {
    id: 'compat-plan',
    name: 'Compatibility case',
    gallons: 40,
    entries,
  };
}

describe('compatibility rules against real species', () => {
  test('fin-nipper vs long-fin yields warning', () => {
    const plan = planWithEntries([
      { speciesId: 'tiger_barb', count: 6 },
      { speciesId: 'betta_male', count: 1 },
    ]);

    const result = evaluateCompatibility(plan);
    expect(result.warnings.some((w) => w.includes('fin-nipper'))).toBe(true);
  });

  test('shrimp unsafe species block shrimp plans', () => {
    const plan = planWithEntries([
      { speciesId: 'betta_male', count: 1 },
      { speciesId: 'neocaridina', count: 10 },
    ]);
    const result = evaluateCompatibility(plan);
    expect(result.blockers.some((b) => b.includes('shrimp predation risk'))).toBe(true);
    expect(result.ok).toBe(false);
  });

  test('temperature and pH mismatches are blockers', () => {
    const zebra = listSpecies().find((s) => s.id === 'zebra');
    const pgourami = listSpecies().find((s) => s.id === 'pgourami');
    if (!zebra || !pgourami) {
      throw new Error('Missing zebra or pgourami');
    }
    const plan = planWithEntries([
      { speciesId: zebra.id, count: 6 },
      { speciesId: pgourami.id, count: 2 },
    ]);

    const result = evaluateCompatibility(plan);
    expect(result.blockers.some((b) => b.includes('temperature mismatch'))).toBe(true);
  });
});
