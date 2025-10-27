import * as baseCompute from '../../../js/logic/compute.js?orig';
import { formatBioloadPercent } from '../../../js/bioload.js?orig';
import { getBandColor } from '../../../js/logic/utils.js?orig';

const { computeBioload: baseComputeBioload, buildComputedState: baseBuildComputedState, calcTotalGph } = baseCompute;

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

const mapLinear = (value, a, b, min, max) => {
  if (b === a) return min;
  const t = clamp((value - a) / (b - a), 0, 1);
  return min + (max - min) * t;
};

export const percentBioload = ({ gallons, planted, speciesLoad, flowGPH }) => {
  const tankGallons = Math.max(0, Number(gallons || 0));
  const plantedAdj = planted ? 0.9 : 1.0;
  const load = Math.max(0, Number(speciesLoad || 0)) * plantedAdj;
  const flow = Math.max(0, Number(flowGPH || 0));

  const baseCapacity = tankGallons * 1.0;
  const turnoverX = tankGallons > 0 ? flow / tankGallons : 0;
  const flowBonus = mapLinear(turnoverX, 5, 10, 0, 0.10);
  const capacity = baseCapacity * (1 + clamp(flowBonus, 0, 0.10));

  return capacity > 0 ? (load / capacity) * 100 : 0;
};

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
    return flowGPH / gallons;
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

const patchBioload = (raw, { tank, filterState } = {}) => {
  if (!raw || !tank) {
    return raw;
  }
  const gallons = Number.isFinite(tank?.gallons) ? tank.gallons : 0;
  const planted = Boolean(tank?.planted);
  const flowGPH = resolveFlowGph(tank, filterState, raw);
  const baseCurrentPercentValue = percentBioload({ gallons, planted, speciesLoad: raw.currentLoad ?? 0, flowGPH: 0 });
  const baseProposedPercentValue = percentBioload({ gallons, planted, speciesLoad: raw.proposed ?? 0, flowGPH: 0 });
  const currentPercentValue = percentBioload({ gallons, planted, speciesLoad: raw.currentLoad ?? 0, flowGPH });
  const proposedPercentValue = percentBioload({ gallons, planted, speciesLoad: raw.proposed ?? 0, flowGPH });

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
  const flowBonus = computeFlowBonus(gallons, flowGPH);
  const capacityMultiplier = 1 + flowBonus;
  const totalFactor = capacityMultiplier > 0 ? 1 / capacityMultiplier : 1;

  const flowAdjustment = {
    ...raw.flowAdjustment,
    actualGph: resolveActualGph(raw, flowGPH, filterState, tank),
    turnover: Number.isFinite(turnover) ? turnover : null,
    flowBonus,
    capacityMultiplier,
    totalFactor,
    flowFactor: totalFactor,
  };

  if (raw.flowAdjustment?.mixFactor != null && flowAdjustment.mixFactor == null) {
    flowAdjustment.mixFactor = raw.flowAdjustment.mixFactor;
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
  return { filters, totalGph, turnover, ratedGph };
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
