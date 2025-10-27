// File: prototype/js/logic/compute-proxy.js:17-43
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

// File: prototype/js/logic/compute-proxy.js:155-166
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
