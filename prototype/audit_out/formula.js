// File: prototype/js/logic/compute-proxy.js — filtration-only prototype math
const computeBioloadDetails = ({ gallons, speciesLoad, flowGPH }) => {
  const tankGallons = Math.max(0, Number(gallons || 0));
  const flow = Math.max(0, Number(flowGPH || 0));
  const speciesTotal = Math.max(0, Number(speciesLoad || 0));

  const turnoverX = tankGallons > 0 ? flow / tankGallons : 0;
  const filterRelief = clamp(aggregateFilterRelief, 0, MAX_RELIEF);
  const effectiveLoad = speciesTotal * (1 - filterRelief);
  const capBonus = clamp(mapLinear(turnoverX, 5, 10, 0.00, 0.10), 0.00, 0.10);
  const capacity = Math.max(1, tankGallons) * (1 + capBonus);
  const percent = capacity > 0 ? (effectiveLoad / capacity) * 100 : 0;

  return {
    gallons: tankGallons,
    speciesLoad: speciesTotal,
    flowGPH: flow,
    filterRelief,
    effectiveLoad,
    turnoverX,
    capBonus,
    capacity,
    percent,
  };
};

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
