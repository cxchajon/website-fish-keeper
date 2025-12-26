import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateCompatibility, listSpecies } from '../src/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../out');
mkdirSync(outDir, { recursive: true });

const failingLines = ['species_a,species_b,issue'];

function randomEntry() {
  const species = listSpecies();
  const pick = species[Math.floor(Math.random() * species.length)];
  return pick;
}

describe('fuzzed compatibility checks', () => {
  test('random pairs and triples evaluate without throwing', () => {
    for (let i = 0; i < 200; i += 1) {
      const a = randomEntry();
      const b = randomEntry();
      const plan = {
        id: `pair-${i}`,
        name: 'Random pair',
        gallons: 29,
        entries: [
          { speciesId: a.id, count: 2 },
          { speciesId: b.id, count: 2 },
        ],
      };
      const result = evaluateCompatibility(plan);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.blockers)).toBe(true);
      if (result.blockers.length > 0) {
        failingLines.push(`${a.id},${b.id},${result.blockers[0].replace(/,/g, ';')}`);
      }
    }
  });

  test('shoaling requirements trigger warnings when understocked', () => {
    const shoaling = listSpecies().find((s) => s.shoalMin && s.shoalMin > 2);
    if (!shoaling) {
      return;
    }
    const plan = {
      id: 'shoal-test',
      name: 'Shoal minimum test',
      gallons: 20,
      entries: [
        { speciesId: shoaling.id, count: Math.max(1, Math.floor((shoaling.shoalMin ?? 3) / 2)) },
      ],
    };
    const result = evaluateCompatibility(plan);
    expect(result.warnings.some((w) => w.includes('needs'))).toBe(true);
  });

  test('salinity mismatches flagged when brackish species exist', () => {
    const brackish = listSpecies().find((s) => s.salinity && s.salinity.startsWith('brackish'));
    if (!brackish) {
      failingLines.push('none,none,no brackish species available');
      expect(true).toBe(true);
      return;
    }
    const fresh = listSpecies().find((s) => s.salinity === 'fresh');
    if (!fresh) {
      expect(true).toBe(true);
      return;
    }
    const plan = {
      id: 'salinity-test',
      name: 'Salinity mismatch',
      gallons: 15,
      entries: [
        { speciesId: brackish.id, count: 3 },
        { speciesId: fresh.id, count: 3 },
      ],
    };
    const result = evaluateCompatibility(plan);
    expect(result.blockers.some((b) => b.includes('salinity mismatch'))).toBe(true);
  });
});

afterAll(() => {
  writeFileSync(path.join(outDir, 'failing_combos.csv'), failingLines.join('\n'));
});
