import { mapLightToTanks } from './lightingMap.js';
import { mapHeaterToTanks } from './heaterSizing.js';

const QUIET_BRANDS = ['Fluval', 'Oase', 'Eheim'];
const BEGINNER_BRANDS = ['AquaClear', 'Aqueon QuietFlow', 'NICREW Classic', 'Eheim Jager'];

const TANK_ALIASES = new Map([
  ['5 gallon', '5g'],
  ['5g', '5g'],
  ['10 gallon', '10g'],
  ['20 gallon', '20g'],
  ['20 long', '20 Long'],
  ['29 gallon', '29g'],
  ['30 gallon', '29g'],
  ['37 gallon', '29g'],
  ['40 breeder', '40 Breeder'],
  ['55 gallon', '55g'],
  ['75 gallon', '75g'],
  ['90 gallon', '90g'],
  ['110 gallon', '110g'],
  ['125 gallon', '125g'],
]);

export const CONTEXT_DEFAULTS = {
  tankSize: '20g',
  planted: false,
  bioLoad: 'Moderate',
  budget: 'Any',
};

function normalisePrice(value = '') {
  if (!value) {
    return 'Any';
  }
  if (/budget/i.test(value)) {
    return 'Budget';
  }
  if (/mid/i.test(value)) {
    return 'Mid';
  }
  if (/premium/i.test(value)) {
    return 'Premium';
  }
  return 'Any';
}

function extractNumbers(value = '') {
  return Array.from(value.matchAll(/(\d{1,3})/g)).map((match) => Number.parseInt(match[1], 10));
}

export function getTankLabels(row) {
  const labels = new Set();
  const raw = row.Tank_Size ?? '';
  raw
    .split(/[\/,&]/)
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
    .forEach((segment) => {
      const alias = TANK_ALIASES.get(segment) ?? TANK_ALIASES.get(`${segment} gallon`);
      if (alias) {
        labels.add(alias);
      }
      if (/\d+/.test(segment)) {
        const numbers = extractNumbers(segment);
        numbers.forEach((num) => {
          const label = TANK_ALIASES.get(`${num} gallon`) ?? `${num}g`;
          labels.add(label);
        });
      }
    });
  return Array.from(labels);
}

function tankMatchScore(row, context) {
  const labels = getTankLabels(row);
  if (row.Category === 'Lighting') {
    const { matchedTankLabels } = mapLightToTanks(row.Recommended_Specs ?? '', labels[0]);
    labels.push(...matchedTankLabels);
  }
  if (row.Category === 'Heating') {
    const { matchedTankLabels } = mapHeaterToTanks(row.Recommended_Specs ?? '');
    labels.push(...matchedTankLabels);
  }

  const unique = new Set(labels);
  const { tankSize } = context;
  if (unique.has(tankSize)) {
    return 50;
  }
  if (tankSize === '20 Long' && unique.has('29g')) {
    return 35;
  }
  if (tankSize === '29g' && (unique.has('20 Long') || unique.has('40 Breeder'))) {
    return 30;
  }
  if (tankSize === '75g' && unique.has('55g')) {
    return 28;
  }
  return unique.size ? 12 : 0;
}

function plantedScore(row, context) {
  if (!context.planted) {
    return 0;
  }
  if (/yes/i.test(row.Plant_Ready ?? '')) {
    return 15;
  }
  if (/limited/i.test(row.Plant_Ready ?? '')) {
    return 8;
  }
  if (row.Category === 'Filtration' || row.Category === 'Heating') {
    return 10;
  }
  return 0;
}

function budgetScore(row, context) {
  const rowBudget = normalisePrice(row.Price_Range);
  if (context.budget === 'Any') {
    if (rowBudget === 'Budget') {
      return 6;
    }
    if (rowBudget === 'Premium') {
      return 4;
    }
    return 2;
  }
  return rowBudget === context.budget ? 18 : 4;
}

function bioLoadScore(row, context) {
  if (row.Category !== 'Filtration') {
    return 0;
  }
  const filterType = row.Filter_Type ?? row.Product_Type ?? '';
  const specs = row.Recommended_Specs ?? '';
  const gphNumbers = extractNumbers(specs).filter((value) => value > 20);
  const highFlow = gphNumbers.some((value) => value >= 250);
  if (context.bioLoad === 'Heavy') {
    if (/canister/i.test(filterType) || highFlow) {
      return 20;
    }
    return 5;
  }
  if (context.bioLoad === 'Light' && /sponge/i.test(filterType)) {
    return 12;
  }
  return 8;
}

function brandScore(row) {
  const product = row.Product_Name ?? '';
  const quiet = QUIET_BRANDS.some((brand) => product.includes(brand));
  const beginner = BEGINNER_BRANDS.some((brand) => product.includes(brand));
  let score = 0;
  if (quiet) {
    score += 8;
  }
  if (beginner) {
    score += 6;
  }
  return score;
}

function futureProofScore(row) {
  const price = normalisePrice(row.Price_Range);
  const notes = row.Notes ?? '';
  if (price === 'Premium' || /dual|expand|high par|flagship/i.test(notes)) {
    return 10;
  }
  if (/controller|oversize|larger/i.test(notes)) {
    return 6;
  }
  return 0;
}

export function scoreItem(row, context) {
  let score = 10;
  score += tankMatchScore(row, context);
  score += plantedScore(row, context);
  score += budgetScore(row, context);
  score += bioLoadScore(row, context);
  score += brandScore(row);
  score += futureProofScore(row);
  return score;
}

export function getNormalizedBudget(row) {
  return normalisePrice(row.Price_Range);
}

export function inferBadges(row, context) {
  const badges = [];
  if (context.planted && /yes/i.test(row.Plant_Ready ?? '') && row.Category === 'Lighting') {
    badges.push('Plant-Ready');
  } else if (row.Category !== 'Lighting') {
    badges.push('Plant-Ready');
  }
  if (QUIET_BRANDS.some((brand) => (row.Product_Name ?? '').includes(brand))) {
    badges.push('Quiet');
  }
  if (getNormalizedBudget(row) === 'Budget') {
    badges.push('Budget');
  }
  if (BEGINNER_BRANDS.some((brand) => (row.Product_Name ?? '').includes(brand))) {
    badges.push('Beginner-Friendly');
  }
  if (futureProofScore(row) >= 6) {
    badges.push('Future-Proof');
  }
  return Array.from(new Set(badges));
}
