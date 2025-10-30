import * as baseCompute from '../../../js/logic/compute.js?orig';
import { getSpeciesListV2, getSpeciesBySlugV2 } from '../../../proto/logic/species.adapter.v2.js';
import { compatScore } from '../../../proto/logic/compat.v2.js';
import { calcAggression, AGGRESSION_TOKENS } from '../../../proto/logic/aggression.v2.js';
import { formatBioloadPercent } from '../../../js/bioload.js?orig';
import { getBandColor } from '../../../js/logic/utils.js?orig';
import { weightedMixFactor } from '../../../js/utils.js?orig';
import {
  clamp,
  toNum,
  computeTurnover as computeFilterTurnover,
  effectiveCapacity,
  computePercent,
  normalizeFilters,
  getTotalGPH,
  MAX_CAPACITY_BONUS,
} from '../../assets/js/proto-filtration-math.js';

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
  FILTER_TURNOVER_MULTIPLIERS,
  TURNOVER_BANDS,
  MIN_TURNOVER_FLOOR,
} = baseCompute;

const __DEV_BIOLOAD = false;
const DEBUG_FILTERS = Boolean(typeof window !== 'undefined' && window?.TTG?.DEBUG_FILTERS);

const SPECIES_V2 = Object.freeze(getSpeciesListV2().map(({ slug }) => getSpeciesBySlugV2(slug)));
const SPECIES_BY_KEY = (() => {
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
  return map;
})();
const SPECIES_LIST_V2 = Object.freeze(SPECIES_V2.map((species) => ({
  id: species.id,
  name: species.common_name,
  slug: species.slug,
})));
const ALL_SPECIES_V2 = SPECIES_LIST_V2;

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
    if (!result || !result.status || result.status === 'Optimal') continue;
    const tone = result.status === 'Incompatible' ? 'bad' : 'warn';
    const label = PARAMETER_LABELS[key] || key;
    chips.push({ tone, text: `${label}: ${result.status}` });
  }
  return chips;
};

const buildBehaviorChips = (species) => {
  const behavior = species?.protoV2?.behavior;
  if (!behavior) return [];
  const chips = [];
  if (Array.isArray(behavior.predationRisks)) {
    for (const risk of behavior.predationRisks) {
      if (!risk) continue;
      chips.push({ tone: 'warn', text: `Predation risk: ${risk}` });
    }
  }
  if (Array.isArray(behavior.incompatibilities)) {
    for (const item of behavior.incompatibilities) {
      if (!item) continue;
      chips.push({ tone: 'warn', text: `Incompatibility: ${item}` });
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
    return [{ tone: 'bad', text: ERROR_CHIP_TEXT[AGGRESSION_TOKENS.FATAL_INCOMPATIBLE_BETTA_MALE] }];
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

const TYPE_WEIGHT = Object.freeze({
  CANISTER: 1.12,
  HOB: 1.0,
  INTERNAL: 0.94,
  UGF: 0.9,
  SPONGE: 0.86,
});

const TYPE_THRESHOLDS = Object.freeze({
  CANISTER_MIN: 1.05,
  SPONGE_MAX: 0.95,
});

const FILTER_TYPE_CANON = new Map([
  ['CANISTER', 'CANISTER'],
  ['HOB', 'HOB'],
  ['INTERNAL', 'INTERNAL'],
  ['UGF', 'UGF'],
  ['SPONGE', 'SPONGE'],
  ['MIXED', 'HOB'],
  ['DEFAULT', 'HOB'],
]);

const normalizeTypeBlend = (value) => {
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase();
    if (upper && FILTER_TYPE_CANON.has(upper)) {
      return FILTER_TYPE_CANON.get(upper);
    }
  }
  return null;
};

const typeBlendFromMixFactor = (mixFactor) => {
  if (!Number.isFinite(mixFactor) || mixFactor <= 0) {
    return null;
  }
  if (mixFactor >= TYPE_THRESHOLDS.CANISTER_MIN) {
    return 'CANISTER';
  }
  if (mixFactor <= TYPE_THRESHOLDS.SPONGE_MAX) {
    return 'SPONGE';
  }
  return 'HOB';
};

const resolveTypeBlend = ({ typeBlend, mixFactor }) => {
  const normalized = normalizeTypeBlend(typeBlend);
  if (normalized) {
    return normalized;
  }
  const fromMix = typeBlendFromMixFactor(mixFactor);
  if (fromMix) {
    return fromMix;
  }
  return 'HOB';
};

const computeBlendEfficiency = ({ turnover, typeBlend, mixFactor }) => {
  if (!Number.isFinite(turnover) || turnover <= 0) {
    return 0;
  }
  const blendKey = resolveTypeBlend({ typeBlend, mixFactor });
  const baseKey = resolveFilterBaseKey(blendKey);
  return computeFilterEfficiency(baseKey, turnover);
};

const mapLinear = (value, a, b, min, max) => {
  if (b === a) return min;
  const t = clamp((value - a) / (b - a), 0, 1);
  return min + (max - min) * t;
};

const computeBioloadDetails = ({
  gallons,
  speciesLoad,
  flowGPH,
  totalGPH,
  capacity,
  typeBlend,
  mixFactor,
  filters,
}) => {
  const tankGallons = Math.max(0, toNum(gallons));
  const baseBioload = Math.max(0, toNum(speciesLoad));
  const baseCapacityInput = toNum(capacity);
  const baseCapacity = baseCapacityInput > 0 ? baseCapacityInput : tankGallons;

  const normalizedFilters = normalizeFilters(filters);
  const { rated: totalRatedFromFilters } = getTotalGPH(normalizedFilters, { normalized: true });
  const totalRatedFromInput = Math.max(0, toNum(totalGPH));
  const flowFromInput = Math.max(0, toNum(flowGPH));
  const totalRatedFlow = totalRatedFromFilters > 0
    ? totalRatedFromFilters
    : totalRatedFromInput > 0
      ? totalRatedFromInput
      : flowFromInput;
  const appliedRatedFlow = totalRatedFlow > 0 ? totalRatedFlow : 0;
  const turnover = appliedRatedFlow > 0 && tankGallons > 0
    ? computeFilterTurnover(appliedRatedFlow, tankGallons)
    : 0;

  const capacityDetails = effectiveCapacity(baseCapacity, normalizedFilters, {
    includeBreakdown: true,
    normalized: true,
    cap: MAX_CAPACITY_BONUS,
  });
  const effectiveCap = capacityDetails.effective;
  const capacityModifier = capacityDetails.modifier;
  const percent = computePercent(baseBioload, effectiveCap);

  if ((!Number.isFinite(percent) || Number.isNaN(percent)) && typeof console !== 'undefined') {
    try {
      console.warn('[Filtration] Invalid result — check parsing.', {
        gallons: tankGallons,
        baseBioload,
        baseCapacity,
        effectiveCapacity: effectiveCap,
      });
    } catch (_error) {
      /* noop for console failures */
    }
  }

  return {
    gallons: tankGallons,
    speciesLoad: baseBioload,
    flowGPH: appliedRatedFlow,
    flowRatedGPH: appliedRatedFlow,
    flowTotalGPH: totalRatedFlow,
    flowTotalRatedGPH: totalRatedFlow,
    load: baseBioload,
    turnoverX: turnover,
    efficiency: capacityModifier,
    efficiencyDetails: capacityDetails.filters,
    effectiveCapacity: effectiveCap,
    baseCapacity,
    percent,
    filters: normalizedFilters,
    typeBlend,
    mixFactor,
  };
};

export const percentBioload = (state) => computeBioloadDetails(state).percent;

export const computeBioloadPercentForTest = (state) => percentBioload(state);

const computeFlowBonus = () => 0;

const resolveFlowGph = (tank, filterState = {}, raw) => {
  const filtersList = Array.isArray(filterState.filters) ? filterState.filters : [];
  const totalRatedGph = Number.isFinite(filterState.ratedGph) && filterState.ratedGph > 0
    ? filterState.ratedGph
    : Number.isFinite(filterState.totalGph) && filterState.totalGph > 0
      ? filterState.totalGph
      : calcTotalGph?.(filtersList) ?? 0;
  if (totalRatedGph > 0) {
    return totalRatedGph;
  }
  if (Number.isFinite(filterState.ratedGph) && filterState.ratedGph > 0) {
    return filterState.ratedGph;
  }
  const fromAdjustment = Number.isFinite(raw?.flowAdjustment?.actualGph) && raw.flowAdjustment.actualGph > 0
    ? raw.flowAdjustment.actualGph
    : null;
  if (fromAdjustment) {
    return fromAdjustment;
  }
  if (Number.isFinite(tank?.deliveredGph) && tank.deliveredGph > 0) {
    return tank.deliveredGph;
  }
  if (Number.isFinite(tank?.ratedGph) && tank.ratedGph > 0) {
    return tank.ratedGph;
  }
  const gallons = Number.isFinite(tank?.gallons) && tank.gallons > 0 ? tank.gallons : 0;
  if (gallons > 0 && Number.isFinite(filterState.turnover) && filterState.turnover > 0) {
    return filterState.turnover * gallons;
  }
  return 0;
};

const resolveTurnover = (tank, flowGPH, filterState = {}, raw) => {
  if (Number.isFinite(filterState.turnover) && filterState.turnover > 0) {
    return filterState.turnover;
  }
  if (Number.isFinite(raw?.flowAdjustment?.turnover) && raw.flowAdjustment.turnover > 0) {
    return raw.flowAdjustment.turnover;
  }
  const gallons = Number.isFinite(tank?.gallons) && tank.gallons > 0 ? tank.gallons : 0;
  if (gallons > 0 && flowGPH > 0) {
    const computed = computeFilterTurnover(flowGPH, gallons);
    return computed > 0 ? computed : null;
  }
  if (Number.isFinite(tank?.turnover) && tank.turnover > 0) {
    return tank.turnover;
  }
  return null;
};

const resolveActualGph = (raw, flowGPH, filterState = {}, tank) => {
  if (Number.isFinite(raw?.flowAdjustment?.actualGph) && raw.flowAdjustment.actualGph > 0) {
    return raw.flowAdjustment.actualGph;
  }
  if (Number.isFinite(filterState.totalGph) && filterState.totalGph > 0) {
    return filterState.totalGph;
  }
  if (Number.isFinite(filterState.ratedGph) && filterState.ratedGph > 0) {
    return filterState.ratedGph;
  }
  if (flowGPH > 0) {
    return flowGPH;
  }
  if (Number.isFinite(tank?.deliveredGph) && tank.deliveredGph > 0) {
    return tank.deliveredGph;
  }
  return null;
};

const resolveMixFactor = (filterState, raw) => {
  if (Number.isFinite(filterState?.mixFactor) && filterState.mixFactor > 0) {
    return filterState.mixFactor;
  }
  if (Number.isFinite(raw?.flowAdjustment?.mixFactor) && raw.flowAdjustment.mixFactor > 0) {
    return raw.flowAdjustment.mixFactor;
  }
  const filtersList = Array.isArray(filterState?.filters) ? filterState.filters : [];
  if (filtersList.length === 0) {
    return null;
  }
  const total = Number.isFinite(filterState?.ratedGph) && filterState.ratedGph > 0
    ? filterState.ratedGph
    : Number.isFinite(filterState?.totalGph) && filterState.totalGph > 0
      ? filterState.totalGph
    : filtersList.reduce((sum, filter) => {
        const gph = Number(filter?.rated_gph ?? filter?.gph);
        return Number.isFinite(gph) && gph > 0 ? sum + gph : sum;
      }, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }
  let factor = 0;
  for (const filter of filtersList) {
    const gph = Number(filter?.rated_gph ?? filter?.gph);
    if (!Number.isFinite(gph) || gph <= 0) {
      continue;
    }
    const share = gph / total;
    const rawType = filter?.kind ?? filter?.type ?? filter?.filterType;
    const typeKey = normalizeTypeBlend(rawType) ?? 'HOB';
    const weight = TYPE_WEIGHT[typeKey] ?? TYPE_WEIGHT.HOB;
    factor += weight * share;
  }
  if (factor > 0) {
    return factor;
  }
  const fallback = weightedMixFactor(filtersList, total);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
};

const resolveTypeBlendInput = (filterState, raw) => {
  if (raw?.flowAdjustment?.type) {
    return raw.flowAdjustment.type;
  }
  const filtersList = Array.isArray(filterState?.filters) ? filterState.filters : [];
  if (!filtersList.length) {
    return null;
  }
  const first = filtersList[0];
  const firstType = first?.kind ?? first?.type ?? first?.filterType;
  if (typeof firstType === 'string') {
    return firstType;
  }
  return null;
};

const patchBioload = (raw, { tank, filterState } = {}) => {
  if (!raw || !tank) {
    return raw;
  }
  const gallons = Number.isFinite(tank?.gallons) ? tank.gallons : 0;
  const flowGPH = resolveFlowGph(tank, filterState, raw);
  const mixFactor = resolveMixFactor(filterState, raw);
  const typeBlend = resolveTypeBlendInput(filterState, raw);
  const capacity = Number.isFinite(raw?.capacity) ? raw.capacity : null;
  const totalFromState = Number.isFinite(filterState?.totalGph) && filterState.totalGph > 0
    ? filterState.totalGph
    : null;
  const totalRatedFromState = Number.isFinite(filterState?.ratedGph) && filterState.ratedGph > 0
    ? filterState.ratedGph
    : null;
  const totalRatedForDetails = totalRatedFromState ?? totalFromState ?? flowGPH;
  const totalGph = totalRatedForDetails && totalRatedForDetails > 0 ? totalRatedForDetails : 0;
  const filtersList = Array.isArray(filterState?.filters) ? filterState.filters : [];

  const baseCurrentDetails = computeBioloadDetails({
    gallons,
    speciesLoad: raw.currentLoad ?? 0,
    flowGPH: 0,
    totalGPH: totalRatedForDetails,
    capacity,
    typeBlend,
    mixFactor,
    filters: filtersList,
  });
  const baseProposedDetails = computeBioloadDetails({
    gallons,
    speciesLoad: raw.proposed ?? 0,
    flowGPH: 0,
    totalGPH: totalRatedForDetails,
    capacity,
    typeBlend,
    mixFactor,
    filters: filtersList,
  });
  const currentDetails = computeBioloadDetails({
    gallons,
    speciesLoad: raw.currentLoad ?? 0,
    flowGPH,
    totalGPH: totalRatedForDetails,
    capacity,
    typeBlend,
    mixFactor,
    filters: filtersList,
  });
  const proposedDetails = computeBioloadDetails({
    gallons,
    speciesLoad: raw.proposed ?? 0,
    flowGPH,
    totalGPH: totalRatedForDetails,
    capacity,
    typeBlend,
    mixFactor,
    filters: filtersList,
  });

  const baseCurrentPercentValue = baseCurrentDetails.percent;
  const baseProposedPercentValue = baseProposedDetails.percent;
  const currentPercentValue = currentDetails.percent;
  const proposedPercentValue = proposedDetails.percent;

  const currentPercent = currentPercentValue / 100;
  const proposedPercent = proposedPercentValue / 100;
  const color = getBandColor?.(proposedPercent) ?? raw.color;
  const turnover = resolveTurnover(tank, flowGPH, filterState, raw);
  const turnoverIssue = Number.isFinite(turnover) ? turnover < 2 : false;
  const severity = proposedPercent > 1.1
    ? 'bad'
    : proposedPercent > 0.9
      ? 'warn'
      : turnoverIssue
        ? 'warn'
        : 'ok';
  const text = `${formatBioloadPercent(currentPercentValue)} → ${formatBioloadPercent(proposedPercentValue)} of capacity`;
  const message = turnoverIssue ? 'Turnover below 2× — upgrade filtration' : raw.message;
  const capBonus = 0;
  const capacityMultiplier = 1;
  const totalFactor = 1;

  const resolvedActualGph = proposedDetails.flowGPH ?? resolveActualGph(raw, flowGPH, filterState, tank);

  const flowAdjustment = {
    ...raw.flowAdjustment,
    actualGph: resolvedActualGph,
    turnover: Number.isFinite(turnover) ? turnover : null,
    flowBonus: capBonus,
    capacityMultiplier,
    totalFactor,
    flowFactor: totalFactor,
    capacityBoost: proposedDetails.efficiency,
    effectiveCapacity: proposedDetails.effectiveCapacity,
  };

  if (raw.flowAdjustment?.mixFactor != null && flowAdjustment.mixFactor == null) {
    flowAdjustment.mixFactor = raw.flowAdjustment.mixFactor;
  }

  if (DEBUG_FILTERS && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('ttg:proto:filtration-debug', {
          detail: {
            filters: filterState?.filters ?? [],
            totalGph,
            ratedGph: totalRatedForDetails,
            turnover: proposedDetails.turnoverX,
            mixFactor,
            capacityBoost: proposedDetails.efficiency,
            efficiency: proposedDetails.efficiency,
            efficiencyDetails: proposedDetails.efficiencyDetails,
            capacityDetails: proposedDetails.efficiencyDetails,
            effectiveCapacity: proposedDetails.effectiveCapacity,
            baseBioload: baseProposedDetails.load,
            adjustedBioload: proposedDetails.load,
            bioloadPercent: proposedPercentValue,
          },
        }),
      );
    } catch (_error) {
      /* ignore debug dispatch failures */
    }
  }

  if (DEBUG_FILTERS && typeof console !== 'undefined') {
    const debugPayload = {
      gallons,
      baseBioload: raw.proposed ?? 0,
      filters: filtersList.map((filter) => ({
        id: filter?.id ?? null,
        source: filter?.source ?? null,
        type: filter?.kind ?? filter?.type ?? null,
        gph: Number(filter?.rated_gph ?? filter?.gph ?? 0) || 0,
      })),
      totalFlowGPH: totalGph,
      totalRatedFlowGPH: totalRatedForDetails,
      appliedFlowGPH: proposedDetails.flowGPH,
      appliedRatedFlowGPH: proposedDetails.flowRatedGPH,
      turnover: proposedDetails.turnoverX,
      efficiencyTotal: proposedDetails.efficiency,
      efficiencyPerFilter: proposedDetails.efficiencyDetails,
      effectiveCapacity: proposedDetails.effectiveCapacity,
      percent: proposedPercentValue,
    };
    try {
      console.debug('[Proto] Bioload recompute', debugPayload);
    } catch (_error) {
      // Swallow logging issues quietly for prototype runs
    }
  }

  if (__DEV_BIOLOAD && typeof console !== 'undefined') {
    const debugRow = {
      gallons,
      speciesLoad: proposedDetails.speciesLoad,
      flowGPH,
      turnoverX: proposedDetails.turnoverX,
      efficiencyUsed: Number.isFinite(proposedDetails.efficiency) ? proposedDetails.efficiency : '(none)',
      capacityBonus: '(n/a)',
      numerator_load: proposedDetails.load,
      denominator_capacity: proposedDetails.capacity,
      percent_out: proposedPercentValue,
    };
    try {
      console.table(debugRow);
    } catch (error) {
      console.log('Bioload debug', debugRow, error);
    }
  }

  return {
    ...raw,
    currentPercent,
    proposedPercent,
    color,
    severity,
    text,
    message,
    flowAdjustment,
    adjustedCurrentLoad: currentDetails.load,
    adjustedProposed: proposedDetails.load,
    effectiveCapacity: proposedDetails.effectiveCapacity,
    capacityModifier: proposedDetails.efficiency,
    baseCurrentPercent: baseCurrentPercentValue / 100,
    baseProposedPercent: baseProposedPercentValue / 100,
    baseCurrentPercentValue,
    baseProposedPercentValue,
  };
};

const deriveFilterState = (state, computed) => {
  const filters = computed?.filtering?.filters ?? state?.filters ?? [];
  const totalGph = computed?.filtering?.gphTotal
    ?? state?.actualGph
    ?? state?.totalGph
    ?? null;
  const turnover = computed?.filtering?.turnover ?? computed?.bioload?.flowAdjustment?.turnover ?? state?.turnover ?? null;
  const ratedGph = computed?.filtering?.ratedGph
    ?? state?.ratedGph
    ?? state?.totalGph
    ?? null;
  const mixFactor = computed?.filtering?.mixFactor
    ?? computed?.bioload?.flowAdjustment?.mixFactor
    ?? state?.mixFactor
    ?? null;
  const efficiency = computed?.filtering?.efficiency
    ?? state?.filtering?.efficiency
    ?? state?.efficiency
    ?? null;
  const efficiencyDetails = computed?.filtering?.efficiencyDetails
    ?? state?.filtering?.efficiencyDetails
    ?? state?.efficiencyDetails
    ?? null;
  return { filters, totalGph, turnover, ratedGph, mixFactor, efficiency, efficiencyDetails };
};

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

  return {
    ...computed,
    entries,
    candidate: patchedCandidate,
    chips,
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
  return patchProtoComputed(patchComputed(raw, state));
}

const fallbackDefaultSpeciesId = (() => {
  const legacyId = typeof legacyGetDefaultSpeciesId === 'function' ? legacyGetDefaultSpeciesId() : null;
  return SPECIES_LIST_V2.find((item) => item.id === legacyId)?.id ?? SPECIES_LIST_V2[0]?.id ?? legacyId;
})();

export const SPECIES = SPECIES_V2;
export const SPECIES_LIST = SPECIES_LIST_V2;
export const ALL_SPECIES = ALL_SPECIES_V2;

export function getSpeciesById(id) {
  return resolveSpeciesById(id);
}

export function getDefaultSpeciesId() {
  return fallbackDefaultSpeciesId;
}

export {
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

if (__DEV_BIOLOAD && typeof window !== 'undefined') {
  const runDevCases = () => {
    const base = { gallons: 29, speciesLoad: 15 };
    const variants = [
      { ...base, flowGPH: 80, label: 'Case A (80 GPH)' },
      { ...base, flowGPH: 200, label: 'Case B (200 GPH)' },
      { ...base, flowGPH: 260, label: 'Case C (260 GPH)' },
    ];
    const rows = variants.map((variant) => {
      const details = computeBioloadDetails(variant);
      return {
        label: variant.label,
        percent: Number(details.percent.toFixed(4)),
        turnoverX: details.turnoverX,
        efficiency: Number(details.efficiency?.toFixed?.(4) ?? details.efficiency ?? 0),
      };
    });
    try {
      console.table(rows);
    } catch (error) {
      console.log('Bioload dev cases', rows, error);
    }
    return rows;
  };

  window.__runBioloadDevCases = runDevCases;

  const attachDevButton = () => {
    if (!document?.body || document.getElementById('dev-bioload-trigger')) {
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'dev-bioload-trigger';
    button.textContent = 'Run Bioload DEV Cases';
    button.style.position = 'fixed';
    button.style.bottom = '1rem';
    button.style.right = '1rem';
    button.style.zIndex = '9999';
    button.addEventListener('click', () => {
      runDevCases();
    });
    document.body.appendChild(button);
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    attachDevButton();
  } else {
    window.addEventListener('DOMContentLoaded', attachDevButton, { once: true });
  }
}
