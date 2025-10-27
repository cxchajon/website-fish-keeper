import * as baseCompute from '../../../js/logic/compute.js?orig';
import { formatBioloadPercent } from '../../../js/bioload.js?orig';
import { getBandColor } from '../../../js/logic/utils.js?orig';

const { computeBioload: baseComputeBioload, buildComputedState: baseBuildComputedState, calcTotalGph } = baseCompute;

const __DEV_BIOLOAD = false;

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

const mapLinear = (value, a, b, min, max) => {
  if (b === a) return min;
  const t = clamp((value - a) / (b - a), 0, 1);
  return min + (max - min) * t;
};

const computeBioloadDetails = ({ gallons, planted, speciesLoad, flowGPH }) => {
  const tankGallons = Math.max(0, Number(gallons || 0));
  const plantedAdj = planted ? 0.90 : 1.00;
  const flow = Math.max(0, Number(flowGPH || 0));
  const speciesTotal = Math.max(0, Number(speciesLoad || 0));

  const load = speciesTotal * plantedAdj;
  const baseCapacity = tankGallons * 1.0;
  const turnoverX = tankGallons > 0 ? flow / tankGallons : 0;
  const rawBonus = mapLinear(turnoverX, 5, 10, 0.00, 0.10);
  const capBonus = clamp(rawBonus, 0.00, 0.10);
  const capacity = baseCapacity * (1 + capBonus);
  const percent = capacity > 0 ? (load / capacity) * 100 : 0;

  return {
    gallons: tankGallons,
    planted: Boolean(planted),
    speciesLoad: speciesTotal,
    flowGPH: flow,
    plantedAdj,
    load,
    baseCapacity,
    turnoverX,
    rawBonus,
    capBonus,
    capacity,
    percent,
  };
};

export const percentBioload = (state) => computeBioloadDetails(state).percent;

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

  const baseCurrentDetails = computeBioloadDetails({ gallons, planted, speciesLoad: raw.currentLoad ?? 0, flowGPH: 0 });
  const baseProposedDetails = computeBioloadDetails({ gallons, planted, speciesLoad: raw.proposed ?? 0, flowGPH: 0 });
  const currentDetails = computeBioloadDetails({ gallons, planted, speciesLoad: raw.currentLoad ?? 0, flowGPH });
  const proposedDetails = computeBioloadDetails({ gallons, planted, speciesLoad: raw.proposed ?? 0, flowGPH });

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

  if (__DEV_BIOLOAD && typeof console !== 'undefined') {
    const debugRow = {
      gallons,
      speciesLoad: proposedDetails.speciesLoad,
      planted,
      flowGPH,
      turnoverX: proposedDetails.turnoverX,
      efficiencyUsed: '(none)',
      capacityBonus: Number.isFinite(proposedDetails.capBonus) ? proposedDetails.capBonus : '(none)',
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
        capacityBonus: details.capBonus,
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
