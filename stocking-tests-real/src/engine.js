import { randomInt } from 'crypto';
import { speciesList } from './adapter.js';

export const DEFAULT_DISPLACEMENT = 0.1;
export const PLANTED_CAPACITY_BONUS = 0.15;
export const TURNOVER_RECOMMENDATION = { min: 4, max: 8 };

const speciesMap = new Map(speciesList.map((s) => [s.id, s]));

export function getSpeciesById(id) {
  return speciesMap.get(id);
}

export function listSpecies() {
  return speciesList;
}

function activityMultiplier(species) {
  switch (species.activity) {
    case 'high':
      return 1.15;
    case 'low':
      return 0.9;
    default:
      return 1.0;
  }
}

function effectiveCapacity(plan) {
  const base = Math.max(0, plan.gallons) * (1 - DEFAULT_DISPLACEMENT);
  return plan.planted ? base * (1 + PLANTED_CAPACITY_BONUS) : base;
}

export function computeBioload(plan) {
  let total = 0;
  for (const entry of plan.entries) {
    const species = getSpeciesById(entry.speciesId);
    if (!species) continue;
    const qty = Math.max(0, entry.count);
    total += species.baseBioload * qty * activityMultiplier(species);
  }
  const capacity = effectiveCapacity(plan);
  const percent = capacity > 0 ? (total / capacity) * 100 : 0;
  return { totalBioload: total, capacity, percent };
}

function overlap(rangeA, rangeB) {
  if (!Number.isFinite(rangeA?.min) || !Number.isFinite(rangeA?.max) || !Number.isFinite(rangeB?.min) || !Number.isFinite(rangeB?.max)) {
    return false;
  }
  return rangeA.max >= rangeB.min && rangeB.max >= rangeA.min;
}

function salinityCompatible(a, b) {
  if (a.salinity === b.salinity) return true;
  if (a.salinity === 'dual' && (b.salinity === 'fresh' || b.salinity === 'brackish-low' || b.salinity === 'dual')) return true;
  if (b.salinity === 'dual' && (a.salinity === 'fresh' || a.salinity === 'brackish-low' || a.salinity === 'dual')) return true;
  return false;
}

export function evaluateCompatibility(plan) {
  const warnings = [];
  const blockers = [];
  const entries = plan.entries
    .map((entry) => ({ entry, species: getSpeciesById(entry.speciesId) }))
    .filter((x) => x.species);

  for (const { entry, species } of entries) {
    if (species?.shoalMin && entry.count < species.shoalMin) {
      warnings.push(`${species.commonName}: planned ${entry.count}, needs ${species.shoalMin}+`);
    }
  }

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i].species;
      const b = entries[j].species;
      const label = `${a.commonName} ↔ ${b.commonName}`;

      if (!overlap(a.temperature, b.temperature)) {
        blockers.push(`${label}: temperature mismatch`);
      }
      if (!overlap(a.ph, b.ph)) {
        blockers.push(`${label}: pH mismatch`);
      }
      if (!overlap(a.gH, b.gH)) {
        warnings.push(`${label}: gH range narrow`);
      }
      if (!salinityCompatible(a, b)) {
        blockers.push(`${label}: salinity mismatch`);
      }
      if (a.finNipper && b.longFin) {
        warnings.push(`${label}: fin-nipper vs. long-fin`);
      }
      if (b.finNipper && a.longFin) {
        warnings.push(`${label}: fin-nipper vs. long-fin`);
      }
      if (a.shrimpUnsafe && b.category === 'shrimp') {
        blockers.push(`${label}: shrimp predation risk`);
      }
      if (b.shrimpUnsafe && a.category === 'shrimp') {
        blockers.push(`${label}: shrimp predation risk`);
      }
      const aggressionGap = Math.abs(a.aggression - b.aggression);
      if (aggressionGap > 45) {
        blockers.push(`${label}: aggression gap`);
      } else if (aggressionGap > 25) {
        warnings.push(`${label}: temperament gap`);
      }
    }
  }

  return { ok: blockers.length === 0, warnings, blockers };
}

export function computeTurnover(gallons, gph) {
  const sanitizedGallons = Math.max(0, gallons);
  const sanitizedGph = Math.max(0, gph);
  const turnover = sanitizedGallons > 0 ? sanitizedGph / sanitizedGallons : 0;
  return {
    gallons: sanitizedGallons,
    gph: sanitizedGph,
    turnoverX: Number(turnover.toFixed(2)),
    recommendation: {
      min: sanitizedGallons * TURNOVER_RECOMMENDATION.min,
      max: sanitizedGallons * TURNOVER_RECOMMENDATION.max,
    },
  };
}

export function randomSpeciesPair() {
  const list = speciesList;
  const aIndex = randomInt(list.length);
  let bIndex = randomInt(list.length);
  while (bIndex === aIndex && list.length > 1) {
    bIndex = randomInt(list.length);
  }
  return [list[aIndex], list[bIndex]];
}

export function randomSpeciesTriple() {
  const list = speciesList;
  if (list.length < 3) {
    return [list[0], list[0], list[0]];
  }
  const indexes = new Set();
  while (indexes.size < 3) {
    indexes.add(randomInt(list.length));
  }
  const [a, b, c] = Array.from(indexes).map((idx) => list[idx]);
  return [a, b, c];
}
