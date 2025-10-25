import { speciesList as baseSpecies, issues as adapterIssues } from '../../stocking-tests-real/src/adapter.js';

function isFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function deriveSpecies(entry) {
  const temperature = entry.temperature ?? {};
  const ph = entry.ph ?? {};
  const gH = entry.gH ?? {};
  const tags = Array.isArray(entry.tags) ? entry.tags.map(String) : [];
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));
  const salinity = typeof entry.salinity === 'string' ? entry.salinity : 'fresh';
  const aggression = isFiniteNumber(entry.aggression);
  const minTemp = isFiniteNumber(temperature.min);
  const maxTemp = isFiniteNumber(temperature.max);
  const minPh = isFiniteNumber(ph.min);
  const maxPh = isFiniteNumber(ph.max);
  const minGh = isFiniteNumber(gH.min);
  const maxGh = isFiniteNumber(gH.max);
  const shrimpUnsafe = Boolean(entry.shrimpUnsafe);
  const invertSafe = Boolean(entry.invertSafe);
  const snailUnsafe = shrimpUnsafe || tagSet.has('predator_snail');
  const finNipper = Boolean(entry.finNipper);
  const longFin = Boolean(entry.longFin);

  return {
    ...entry,
    tags,
    tagSet,
    salinity,
    aggression,
    minTemp,
    maxTemp,
    minPh,
    maxPh,
    minGh,
    maxGh,
    shrimpUnsafe,
    snailUnsafe,
    invertSafe,
    finNipper,
    longFin,
  };
}

const derivedSpecies = baseSpecies.map(deriveSpecies);
const speciesIndex = new Map(derivedSpecies.map((species) => [species.id, species]));

export function allSpecies() {
  return derivedSpecies;
}

export function getSpeciesById(id) {
  return speciesIndex.get(id) ?? null;
}

export function listSpeciesIds() {
  return derivedSpecies.map((species) => species.id);
}

export function isBrackish(species) {
  if (!species) return false;
  return species.salinity === 'brackish-low' || species.salinity === 'brackish-high';
}

export function isDualSalinity(species) {
  return species?.salinity === 'dual';
}

export function isColdwater(species) {
  if (!species) return false;
  return Number.isFinite(species.maxTemp) && species.maxTemp <= 74;
}

export function isTropical(species) {
  if (!species) return false;
  return Number.isFinite(species.minTemp) && species.minTemp >= 75;
}

export function isShrimpUnsafe(species) {
  return Boolean(species?.shrimpUnsafe);
}

export function isSnailUnsafe(species) {
  return Boolean(species?.snailUnsafe);
}

export function speciesCount() {
  return derivedSpecies.length;
}

export { adapterIssues };
