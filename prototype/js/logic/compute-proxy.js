import * as baseCompute from '../../../js/logic/compute.js?orig';
import { formatBioloadPercent } from '../../../js/bioload.js?orig';
import { getBandColor } from '../../../js/logic/utils.js?orig';
import { weightedMixFactor } from '../../../js/utils.js?orig';
import {
  clamp,
  computeTurnover as computeFilterTurnover,
  computeEfficiency as computeFilterEfficiency,
  computeAdjustedBioload,
  computePercent,
  resolveFilterBaseKey,
  computeAggregateEfficiency,
  mapFiltersForEfficiency,
} from '../../assets/js/proto-filtration-math.js';

const { computeBioload: baseComputeBioload, buildComputedState: baseBuildComputedState, calcTotalGph } = baseCompute;

const __DEV_BIOLOAD = false;
const DEBUG_FILTERS = Boolean(typeof window !== 'undefined' && window?.TTG?.DEBUG_FILTERS);

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

const resolvePlantBonus = ({ planted, plantBonus }) => {
  if (Number.isFinite(plantBonus)) {
    return clamp(plantBonus, 0, 0.2);
  }
  return planted ? 0.1 : 0;
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
  planted,
  speciesLoad,
  flowGPH,
  totalGPH,
  capacity,
  typeBlend,
  mixFactor,
  plantBonus,
  filters,
}) => {
  const tankGallons = Math.max(0, Number(gallons || 0));
  const speciesTotal = Math.max(0, Number(speciesLoad || 0));
  const bonus = resolvePlantBonus({ planted, plantBonus });
  const loadBase = speciesTotal;
  const loadPlanted = loadBase * (1 - bonus);

  const normalizedFilters = mapFiltersForEfficiency(filters);
  const flowFromFilters = normalizedFilters.reduce((sum, filter) => sum + filter.gph, 0);
  const totalFromInput = Number.isFinite(totalGPH) && totalGPH > 0 ? totalGPH : 0;
  const flowInput = Number.isFinite(flowGPH) && flowGPH > 0 ? flowGPH : 0;
  const totalFlow = flowFromFilters > 0 ? flowFromFilters : Math.max(totalFromInput, flowInput);
  const flow = Math.max(flowInput, totalFlow);
  const turnover = totalFlow > 0 ? computeFilterTurnover(totalFlow, tankGallons) : 0;
  const fallbackType = resolveTypeBlend({ typeBlend, mixFactor });

  let efficiencyDetails = [];
  let eff = 0;
  if (normalizedFilters.length) {
    const aggregate = computeAggregateEfficiency(normalizedFilters, turnover);
    efficiencyDetails = aggregate.perFilter;
    eff = aggregate.total;
  }

  if ((!normalizedFilters.length || eff <= 0) && turnover > 0) {
    const blendEff = computeBlendEfficiency({ turnover, typeBlend, mixFactor });
    if (blendEff > eff) {
      eff = blendEff;
      efficiencyDetails = blendEff > 0
        ? [
            {
              id: null,
              type: resolveFilterBaseKey(fallbackType),
              source: 'fallback',
              gph: totalFlow || flow || null,
              efficiency: blendEff,
            },
          ]
        : [];
    }
  }

  eff = clamp(eff, 0, 0.6);

  const effectiveLoad = computeAdjustedBioload(loadPlanted, eff);
  const baseCapacity = Number.isFinite(capacity) && capacity > 0 ? capacity : tankGallons;
  const safeCapacity = Math.max(1, Number(baseCapacity || 0));
  const percent = computePercent(effectiveLoad, safeCapacity);

  if (DEBUG_FILTERS && typeof console !== 'undefined') {
    const debugFilters = normalizedFilters.map((filter) => ({
      id: filter.id ?? null,
      source: filter.source ?? null,
      type: filter.type,
      gph: filter.gph,
    }));
    try {
      console.debug('[Proto] Bioload math snapshot', {
        gallons: tankGallons,
        planted: Boolean(planted),
        baseBioload: loadBase,
        filters: debugFilters,
        totalFlowGPH: totalFlow,
        appliedFlowGPH: flow,
        turnover,
        efficiencyTotal: eff,
        efficiencyPerFilter: efficiencyDetails,
        effectiveBioload: effectiveLoad,
        percent,
      });
    } catch (_error) {
      // ignore console issues in prototype logging
    }
  }

  return {
    gallons: tankGallons,
    planted: Boolean(planted),
    speciesLoad: loadBase,
    flowGPH: flow,
    flowTotalGPH: totalFlow,
    plantBonus: bonus,
    load: loadPlanted,
    turnoverX: turnover,
    efficiency: eff,
    efficiencyDetails,
    effectiveLoad,
    capacity: safeCapacity,
    percent,
  };
};

export const percentBioload = (state) => computeBioloadDetails(state).percent;

export const computeBioloadPercentForTest = (state) => percentBioload(state);

const computeFlowBonus = (gallons, flowGPH) => {
  const tankGallons = Math.max(0, Number(gallons || 0));
  const flow = Math.max(0, Number(flowGPH || 0));
  if (tankGallons <= 0 || flow <= 0) return 0;
  const turnoverX = flow / tankGallons;
  return clamp(mapLinear(turnoverX, 5, 10, 0, 0.10), 0, 0.10);
};

const resolveFlowGph = (tank, filterState = {}, raw) => {
  const filtersList = Array.isArray(filterState.filters) ? filterState.filters : [];
  const totalRatedGph = Number.isFinite(filterState.totalGph) && filterState.totalGph > 0
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
  const total = Number.isFinite(filterState?.totalGph) && filterState.totalGph > 0
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
  const planted = Boolean(tank?.planted);
  const flowGPH = resolveFlowGph(tank, filterState, raw);
  const mixFactor = resolveMixFactor(filterState, raw);
  const typeBlend = resolveTypeBlendInput(filterState, raw);
  const plantBonus = Number.isFinite(raw?.plantBonus) ? raw.plantBonus : null;
  const capacity = Number.isFinite(raw?.capacity) ? raw.capacity : null;
  const totalGph = Number.isFinite(filterState?.totalGph) && filterState.totalGph > 0
    ? filterState.totalGph
    : flowGPH;
  const filtersList = Array.isArray(filterState?.filters) ? filterState.filters : [];

  const baseCurrentDetails = computeBioloadDetails({
    gallons,
    planted,
    speciesLoad: raw.currentLoad ?? 0,
    flowGPH: 0,
    totalGPH: totalGph,
    capacity,
    typeBlend,
    mixFactor,
    plantBonus,
    filters: filtersList,
  });
  const baseProposedDetails = computeBioloadDetails({
    gallons,
    planted,
    speciesLoad: raw.proposed ?? 0,
    flowGPH: 0,
    totalGPH: totalGph,
    capacity,
    typeBlend,
    mixFactor,
    plantBonus,
    filters: filtersList,
  });
  const currentDetails = computeBioloadDetails({
    gallons,
    planted,
    speciesLoad: raw.currentLoad ?? 0,
    flowGPH,
    totalGPH: totalGph,
    capacity,
    typeBlend,
    mixFactor,
    plantBonus,
    filters: filtersList,
  });
  const proposedDetails = computeBioloadDetails({
    gallons,
    planted,
    speciesLoad: raw.proposed ?? 0,
    flowGPH,
    totalGPH: totalGph,
    capacity,
    typeBlend,
    mixFactor,
    plantBonus,
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
  const capBonus = computeFlowBonus(gallons, flowGPH);
  const capacityMultiplier = 1 + capBonus;
  const totalFactor = capacityMultiplier > 0 ? 1 / capacityMultiplier : 1;

  const flowAdjustment = {
    ...raw.flowAdjustment,
    actualGph: resolveActualGph(raw, flowGPH, filterState, tank),
    turnover: Number.isFinite(turnover) ? turnover : null,
    flowBonus: capBonus,
    capacityMultiplier,
    totalFactor,
    flowFactor: totalFactor,
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
            turnover: proposedDetails.turnoverX,
            mixFactor,
            efficiency: proposedDetails.efficiency,
            efficiencyDetails: proposedDetails.efficiencyDetails,
            baseBioload: baseProposedDetails.load,
            adjustedBioload: proposedDetails.effectiveLoad,
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
      planted,
      baseBioload: raw.proposed ?? 0,
      filters: filtersList.map((filter) => ({
        id: filter?.id ?? null,
        source: filter?.source ?? null,
        type: filter?.kind ?? filter?.type ?? null,
        gph: Number(filter?.rated_gph ?? filter?.gph ?? 0) || 0,
      })),
      totalFlowGPH: totalGph,
      appliedFlowGPH: proposedDetails.flowGPH,
      turnover: proposedDetails.turnoverX,
      efficiencyTotal: proposedDetails.efficiency,
      efficiencyPerFilter: proposedDetails.efficiencyDetails,
      effectiveBioload: proposedDetails.effectiveLoad,
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
      planted,
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
    adjustedCurrentLoad: raw.currentLoad,
    adjustedProposed: raw.proposed,
    baseCurrentPercent: baseCurrentPercentValue / 100,
    baseProposedPercent: baseProposedPercentValue / 100,
    baseCurrentPercentValue,
    baseProposedPercentValue,
  };
};

const deriveFilterState = (state, computed) => {
  const filters = computed?.filtering?.filters ?? state?.filters ?? [];
  const totalGph = computed?.filtering?.gphTotal ?? state?.totalGph ?? null;
  const turnover = computed?.filtering?.turnover ?? computed?.bioload?.flowAdjustment?.turnover ?? state?.turnover ?? null;
  const ratedGph = computed?.filtering?.ratedGph ?? state?.ratedGph ?? null;
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

export * from '../../../js/logic/compute.js?orig';

export function computeBioload(tank, entries, candidate, filterState = {}) {
  const raw = baseComputeBioload(tank, entries, candidate, filterState);
  return patchBioload(raw, { tank, filterState });
}

export function buildComputedState(state) {
  const raw = baseBuildComputedState(state);
  return patchComputed(raw, state);
}

if (__DEV_BIOLOAD && typeof window !== 'undefined') {
  const runDevCases = () => {
    const base = { gallons: 29, speciesLoad: 15, planted: false };
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
