import * as baseCompute from './compute.legacy.js';
import { initializeSpecies, getSpeciesListV2, getSpeciesBySlugV2, getSpeciesLoadStatus } from '../stocking-advisor/logic/species-adapter.v2.js';
import { compatScore } from '../stocking-advisor/logic/compat.v2.js';
import { calcAggression, AGGRESSION_TOKENS } from '../stocking-advisor/logic/aggression.v2.js';
import { evaluateWarningRules } from '../stocking-advisor/logic/warning-rules.js';
import { formatBioloadPercent } from '../bioload.js';
import { getBandColor } from './utils.js';
import { toNum, computePercent } from '../stocking-advisor/filtration/math.js';

const {
  computeBioload: baseComputeBioload,
  buildComputedState: baseBuildComputedState,
  calcTotalGph,
  getDefaultSpeciesId: legacyGetDefaultSpeciesId,
  autoBioloadUnit,
  listSensitiveSpecies,
  normalizeFilterTypeSelection,
  computeFilterFlowStats,
  sanitizeFilterList,
  computeTurnover: baseComputeTurnover,
  runScenario: baseRunScenario,
  runSanitySuite: baseRunSanitySuite,
  runStressSuite: baseRunStressSuite,
  createDefaultState: baseCreateDefaultState,
  overrideSpeciesDataset,
  flagUnevaluatedSpecies,
  flagUnsuitableTank,
  getRejectedSpecies,
  getSpeciesDatasetStatus,
  markSpeciesDatasetUnavailable,
  FILTER_TURNOVER_MULTIPLIERS,
  TURNOVER_BANDS,
  MIN_TURNOVER_FLOOR,
} = baseCompute;


// Species collections - built after initialization for Safari compatibility
let SPECIES_V2 = [];
let SPECIES_BY_KEY = new Map();
let SPECIES_LIST_V2 = [];
let ALL_SPECIES_V2 = [];
let computeInitialized = false;

function buildSpeciesCollections() {
  SPECIES_V2 = Object.freeze(getSpeciesListV2().map(({ slug }) => getSpeciesBySlugV2(slug)));

  const map = new Map();
  for (const species of SPECIES_V2) {
    if (!species) continue;
    if (species.id) {
      map.set(String(species.id).toLowerCase(), species);
    }
    if (species.slug) {
      map.set(String(species.slug).toLowerCase(), species);
    }
  }
  SPECIES_BY_KEY = map;

  SPECIES_LIST_V2 = Object.freeze(SPECIES_V2.map((species) => ({
    id: species.id,
    name: species.common_name,
    slug: species.slug,
  })));
  ALL_SPECIES_V2 = SPECIES_LIST_V2;
  if (typeof overrideSpeciesDataset === 'function' && SPECIES_V2.length > 0) {
    overrideSpeciesDataset(SPECIES_V2);
  }
}

/**
 * Initialize compute module - must be called before using species data
 * Safe to call multiple times (idempotent)
 */
export async function initializeCompute() {
  if (computeInitialized) {
    return;
  }

  await initializeSpecies();
  buildSpeciesCollections();
  // Never fall back to the legacy js/fish-data.js list: if species.v2.json did not load, the engine
  // is put into an explicit unavailable state and every result says so.
  const loadStatus = getSpeciesLoadStatus();
  if (!loadStatus.ok || SPECIES_V2.length === 0) {
    markSpeciesDatasetUnavailable(loadStatus.error || 'species data is empty');
  }
  updateExports();
  computeInitialized = true;
}

const resolveSpeciesById = (id) => {
  if (!id) return null;
  return SPECIES_BY_KEY.get(String(id).toLowerCase()) ?? null;
};

const PARAMETER_LABELS = Object.freeze({
  temperature: 'Temperature',
  pH: 'pH',
  gh: 'General hardness',
  kH: 'Carbonate hardness',
});

const TOKEN_CHIP_TEXT = Object.freeze({
  [AGGRESSION_TOKENS.UNSTABLE_SORORITY]: 'Female betta groups of 2-4 are unstable — keep a single female or 5+ in at least 20 gallons.',
});

const ERROR_CHIP_TEXT = Object.freeze({
  [AGGRESSION_TOKENS.FATAL_INCOMPATIBLE_BETTA_MALE]: 'Male bettas must be housed individually — multiple males are incompatible.',
});

const cloneEntryWithSpecies = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }
  const species = resolveSpeciesById(entry?.species?.id ?? entry?.species?.slug);
  if (!species) {
    return entry;
  }
  return { ...entry, species };
};

// computed.water holds only what the user entered (null = not entered), so an unentered parameter is
// scored "Not evaluated" rather than against an assumed value.
const buildCompatibilityMap = (species, water) => {
  if (!species?.protoV2?.parameters) {
    return null;
  }
  const { parameters } = species.protoV2;
  return {
    temperature: parameters.temperature ? compatScore(parameters.temperature, water?.temperature) : null,
    pH: parameters.pH ? compatScore(parameters.pH, water?.pH) : null,
    gh: parameters.gh ? compatScore(parameters.gh, water?.gH) : null,
    kH: parameters.kh ? compatScore(parameters.kh, water?.kH) : null,
  };
};

const buildCompatibilityChips = (compatibility) => {
  if (!compatibility) return [];
  const chips = [];
  for (const [key, result] of Object.entries(compatibility)) {
    if (!result || !result.status || result.status === 'Optimal' || !Number.isFinite(result.score)) continue;
    const incompatible = result.status === 'Incompatible';
    const label = PARAMETER_LABELS[key] || key;
    const text = incompatible
      ? `${label}: your water is outside this species' range`
      : `${label}: your water is tolerable, not ideal`;
    chips.push({ tone: incompatible ? 'bad' : 'warn', text });
  }
  return chips;
};

// "Shrimp (cherry)" → "cherry shrimp", "Shrimp (all sizes)" → "shrimp of all sizes",
// "Small fish (e.g., Neon Tetras)" → "small fish (e.g., Neon Tetras)".
const describeTrait = (text) => {
  const value = String(text).trim();
  const match = value.match(/^([^()]+?)\s*\(([^()]+)\)$/);
  const lower = (part) => part.charAt(0).toLowerCase() + part.slice(1);
  if (match && /^all sizes$/i.test(match[2])) return `${lower(match[1])} of all sizes`;
  if (match && !/[,.]/.test(match[2])) return `${match[2].toLowerCase()} ${lower(match[1])}`;
  return lower(value);
};

// Species-care notes from the record's own behaviour data. They describe the species, not the plan,
// so they are informational: a real predation / compatibility problem with the planned stock is a
// warning from the engine. A prey note is dropped when that warning is shown (covers).
const buildBehaviorChips = (species) => {
  const behavior = species?.protoV2?.behavior;
  if (!behavior) return [];
  const chips = [];
  if (Array.isArray(behavior.predationRisks)) {
    for (const risk of behavior.predationRisks) {
      if (!risk) continue;
      const eatenBy = String(risk).match(/^\s*predators?\s*:\s*(.+)$/i);
      if (eatenBy) {
        chips.push({ tone: 'info', kind: 'trait', text: `Eaten by: ${describeTrait(eatenBy[1])}` });
        continue;
      }
      const category = /shrimp/i.test(risk) ? 'shrimp' : /snail/i.test(risk) ? 'snail' : 'fish';
      chips.push({ tone: 'info', kind: 'trait', text: `May prey on: ${describeTrait(risk)}`, covers: [`predation.${category}.${species.id}.*`] });
    }
  }
  if (Array.isArray(behavior.incompatibilities)) {
    for (const item of behavior.incompatibilities) {
      if (!item) continue;
      chips.push({ tone: 'info', kind: 'trait', text: `Avoid with: ${describeTrait(item)}` });
    }
  }
  return chips;
};

const totalQuantityForSpecies = (entries, candidate) => {
  const speciesId = candidate?.species?.id;
  let total = Number(candidate?.qty) || 0;
  if (!speciesId) return total;
  for (const entry of entries) {
    if (entry?.species?.id === speciesId) {
      total += Number(entry.qty) || 0;
    }
  }
  return total;
};

const toAggressionContext = (tank) => ({
  gallons: Number(tank?.gallons) || Number(tank?.displayGallons) || 0,
  tankGallons: Number(tank?.gallons) || Number(tank?.displayGallons) || 0,
  tank,
});

const buildAggressionChips = (result, species) => {
  if (!result) return [];
  if (result.error === AGGRESSION_TOKENS.FATAL_INCOMPATIBLE_BETTA_MALE) {
    return [{ tone: 'bad', text: ERROR_CHIP_TEXT[AGGRESSION_TOKENS.FATAL_INCOMPATIBLE_BETTA_MALE], covers: ['betta.multipleMales'] }];
  }
  const chips = [];
  if (Array.isArray(result.tokens)) {
    for (const token of result.tokens) {
      if (token === AGGRESSION_TOKENS.UNSTABLE_SORORITY) {
        chips.push({ tone: 'warn', text: TOKEN_CHIP_TEXT[token] });
      }
    }
  }
  if (Number.isFinite(result.value) && Number.isFinite(result.base) && Math.abs(result.value - result.base) > 0.01) {
    const display = Math.round(result.value * 100);
    const tone = result.value >= 0.8 ? 'bad' : 'warn';
    const speciesName = species?.common_name || 'species';
    chips.push({ tone, text: `Aggression adjusted to ${display}% risk for ${speciesName}.` });
  }
  return chips;
};

// Bioload percentage = livestock load ÷ tank capacity. Filtration is deliberately not an input: it is
// assessed separately (computed.filtering, see js/stocking-advisor/filtration/math.js) so choosing a
// filter can never make a heavily stocked tank look lighter.
const computeBioloadDetails = ({ gallons, speciesLoad, capacity }) => {
  const tankGallons = Math.max(0, toNum(gallons));
  const load = Math.max(0, toNum(speciesLoad));
  const capacityInput = toNum(capacity);
  const baseCapacity = capacityInput > 0 ? capacityInput : tankGallons;
  return {
    gallons: tankGallons,
    load,
    baseCapacity,
    percent: computePercent(load, baseCapacity),
  };
};

export const percentBioload = (state) => computeBioloadDetails(state).percent;

export const computeBioloadPercentForTest = (state) => percentBioload(state);

const patchBioload = (raw, { tank, filterState } = {}) => {
  if (!raw || !tank) {
    return raw;
  }
  const gallons = Number.isFinite(tank?.gallons) ? tank.gallons : 0;
  const capacity = Number.isFinite(raw?.capacity) ? raw.capacity : null;
  const currentDetails = computeBioloadDetails({ gallons, speciesLoad: raw.currentLoad ?? 0, capacity });
  const proposedDetails = computeBioloadDetails({ gallons, speciesLoad: raw.proposed ?? 0, capacity });

  const currentPercentValue = currentDetails.percent;
  const proposedPercentValue = proposedDetails.percent;
  const currentPercent = currentPercentValue / 100;
  const proposedPercent = proposedPercentValue / 100;
  const color = getBandColor?.(proposedPercent) ?? raw.color;
  const severity = proposedPercent > 1.1 ? 'bad' : proposedPercent > 0.9 ? 'warn' : 'ok';
  const text = `${formatBioloadPercent(currentPercentValue)} → ${formatBioloadPercent(proposedPercentValue)} of capacity`;

  const totalGph = Number.isFinite(filterState?.totalGph) && filterState.totalGph > 0 ? filterState.totalGph : null;
  const turnover = Number.isFinite(filterState?.turnover) ? filterState.turnover : null;
  const flowAdjustment = {
    ...raw.flowAdjustment,
    actualGph: totalGph,
    turnover,
  };

  return {
    ...raw,
    currentPercent,
    proposedPercent,
    color,
    severity,
    text,
    message: undefined,
    flowAdjustment,
    adjustedCurrentLoad: currentDetails.load,
    adjustedProposed: proposedDetails.load,
    effectiveCapacity: proposedDetails.baseCapacity,
    baseCurrentPercent: currentPercent,
    baseProposedPercent: proposedPercent,
    baseCurrentPercentValue: currentPercentValue,
    baseProposedPercentValue: proposedPercentValue,
  };
};

const deriveFilterState = (state, computed) => ({
  filters: computed?.filtering?.filters ?? state?.filters ?? [],
  totalGph: computed?.filtering?.gphTotal ?? null,
  turnover: computed?.filtering?.turnover ?? null,
});

const patchComputed = (computed, state) => {
  if (!computed || typeof computed !== 'object') {
    return computed;
  }
  const filterState = deriveFilterState(state, computed);
  const patchedBioload = patchBioload(computed.bioload, { tank: computed.tank, filterState });
  if (patchedBioload === computed.bioload) {
    return computed;
  }
  return { ...computed, bioload: patchedBioload };
};

const patchProtoComputed = (computed) => {
  if (!computed || typeof computed !== 'object') {
    return computed;
  }
  const entries = Array.isArray(computed.entries) ? computed.entries.map(cloneEntryWithSpecies) : [];
  const candidate = computed.candidate ? cloneEntryWithSpecies(computed.candidate) : null;
  const chips = Array.isArray(computed.chips) ? [...computed.chips] : [];

  let candidateExtras = null;
  if (candidate?.species) {
    const compatibility = buildCompatibilityMap(candidate.species, computed.water);
    const compatibilityChips = buildCompatibilityChips(compatibility);
    const behaviorChips = buildBehaviorChips(candidate.species);
    const totalQty = totalQuantityForSpecies(entries, candidate);
    const aggression = calcAggression(candidate.species, totalQty, toAggressionContext(computed.tank));
    const aggressionChips = buildAggressionChips(aggression, candidate.species);
    chips.push(...compatibilityChips, ...behaviorChips, ...aggressionChips);
    candidateExtras = { compatibility, aggression };
  }

  const patchedCandidate = candidateExtras
    ? { ...candidate, protoV2State: candidateExtras }
    : candidate;

  const baseWarnings = Array.isArray(computed.status?.warnings) ? computed.status.warnings : [];
  const ruleWarnings = evaluateWarningRules({ entries, candidate: patchedCandidate, tank: computed.tank });
  let status = computed.status;
  if (Array.isArray(ruleWarnings) && ruleWarnings.length > 0) {
    const seen = new Set(baseWarnings.map((warning) => warning?.id));
    const additions = [];
    for (const warning of ruleWarnings) {
      if (!warning || typeof warning !== 'object') continue;
      const id = warning.id;
      if (!id || seen.has(id)) continue;
      additions.push(warning);
      seen.add(id);
    }
    if (additions.length > 0) {
      status = { ...(computed.status || {}), warnings: [...baseWarnings, ...additions] };
    }
  }

  return {
    ...computed,
    entries,
    candidate: patchedCandidate,
    chips,
    status,
    protoV2: {
      candidate: candidateExtras,
      tokens: AGGRESSION_TOKENS,
    },
  };
};

export function computeBioload(tank, entries, candidate, filterState = {}) {
  const raw = baseComputeBioload(tank, entries, candidate, filterState);
  return patchBioload(raw, { tank, filterState });
}

export function buildComputedState(state) {
  const raw = baseBuildComputedState(state);
  // Re-flag after patching: patchBioload rebuilds the bioload text/severity from scratch.
  return flagUnevaluatedSpecies(flagUnsuitableTank(patchProtoComputed(patchComputed(raw, state))));
}

let fallbackDefaultSpeciesId = null;

// Getter functions that return current species data (after initialization)
export function getSpecies() {
  return SPECIES_V2;
}

export function getSpeciesList() {
  return SPECIES_LIST_V2;
}

export function getAllSpecies() {
  return ALL_SPECIES_V2;
}

// Update the exported binding after initialization
function updateExports() {
  SPECIES = SPECIES_V2;
  SPECIES_LIST = SPECIES_LIST_V2;
  ALL_SPECIES = ALL_SPECIES_V2;
}

// Legacy exports - use 'let' for live bindings that update after initialization
// Note: These will be empty until initializeCompute() is called
export let SPECIES = [];
export let SPECIES_LIST = [];
export let ALL_SPECIES = [];

export function getSpeciesById(id) {
  return resolveSpeciesById(id);
}

export function getDefaultSpeciesId() {
  if (fallbackDefaultSpeciesId === null && SPECIES_LIST_V2.length > 0) {
    const legacyId = typeof legacyGetDefaultSpeciesId === 'function' ? legacyGetDefaultSpeciesId() : null;
    fallbackDefaultSpeciesId = SPECIES_LIST_V2.find((item) => item.id === legacyId)?.id ?? SPECIES_LIST_V2[0]?.id ?? legacyId;
  }
  return fallbackDefaultSpeciesId;
}

export {
  getRejectedSpecies,
  getSpeciesDatasetStatus,
  autoBioloadUnit,
  listSensitiveSpecies,
  normalizeFilterTypeSelection,
  computeFilterFlowStats,
  sanitizeFilterList,
  calcTotalGph,
  baseComputeTurnover as computeTurnover,
  baseRunScenario as runScenario,
  baseRunSanitySuite as runSanitySuite,
  baseRunStressSuite as runStressSuite,
  baseCreateDefaultState as createDefaultState,
  FILTER_TURNOVER_MULTIPLIERS,
  TURNOVER_BANDS,
  MIN_TURNOVER_FLOOR,
};

export { AGGRESSION_TOKENS };
