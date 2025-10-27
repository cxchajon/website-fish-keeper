# Prototype Filtration & Bioload Formulas

## Base Bioload (Species Production)
```js
export function getTotalGE(currentStock = [], speciesMap) {
  return currentStock.reduce((sum, item) => {
    const s = lookupSpecies(speciesMap, item?.speciesId);
    const ge = Number.isFinite(s?.bioloadGE) ? s.bioloadGE : 0;
    const count = toNumber(item?.count);
    return sum + ge * Math.max(0, count);
  }, 0);
}
```
*Source: `js/bioload.js`* — sums each species’ gallon-equivalent (bioloadGE).

## Plant Adjustment
```js
const resolvePlantBonus = ({ planted, plantBonus }) => {
  if (Number.isFinite(plantBonus)) {
    return clamp(plantBonus, 0, 0.2);
  }
  return planted ? 0.1 : 0;
};
```
```js
const loadPlanted = loadBase * (1 - bonus);
```
*Source: `prototype/js/logic/compute-proxy.js`* — planted toggle applies a 10% load reduction (clamped to ≤20%).

## Filter Efficiency per Unit
```js
export function computeEfficiency(type, turnover) {
  const key = resolveFilterBaseKey(type);
  const base = FILTER_BASE[key] ?? FILTER_BASE.HOB;
  const turnoverFactor = clamp(turnover / 5, 0.4, 1.3);
  return clamp(base * turnoverFactor, 0, 0.6);
}
```
*Source: `prototype/assets/js/proto-filtration-math.js`* — base relief × normalized turnover, hard-capped at 60%.

## Multiple Filters Aggregation
```js
export function computeAggregateEfficiency(filters, turnover) {
  const normalized = mapFiltersForEfficiency(filters);
  if (!normalized.length) {
    return { total: 0, perFilter: [] };
  }

  const perFilter = normalized.map((filter) => {
    const efficiency = computeEfficiency(filter.type, turnover);
    return {
      ...filter,
      efficiency: Number.isFinite(efficiency) && efficiency > 0 ? efficiency : 0,
    };
  });

  const totalRaw = perFilter.reduce((sum, entry) => sum + entry.efficiency, 0);
  const total = clamp(totalRaw, 0, 0.6);

  return { total, perFilter };
}
```
*Source: `prototype/assets/js/proto-filtration-math.js`* — sums efficiencies then clamps combined relief to ≤0.6.

## Adjusted Bioload & Percent Utilization
```js
export function computeAdjustedBioload(baseBioload, eff) {
  const b = Math.max(0, Number(baseBioload) || 0);
  const efficiency = Math.max(0, Number(eff) || 0);
  return b * (1 - efficiency);
}

export function computePercent(adjustedBioload, capacity) {
  const cap = Math.max(1, Number(capacity) || 0);
  const load = Math.max(0, Number(adjustedBioload) || 0);
  return clamp((load / cap) * 100, 0, 200);
}
```
*Source: `prototype/assets/js/proto-filtration-math.js`* — applies efficiency as a multiplier and converts to percent of capacity.

## Bioload Meter Binding
```js
function computeBioloadPct(computed) {
  const percent = computed?.bioload?.currentPercent;
  if (!Number.isFinite(percent)) {
    return 0;
  }
  return clamp(percent * 100, 0, 200);
}
```
```js
const bioloadDisplay = formatBioloadPercent(Math.max(0, Math.min(200, rawBioloadPct)));
...
<div class="env-bar__fill" style="width:${bioloadPct}%; ..."></div>
```
*Source: `js/logic/envRecommend.js`* — the meter reads `computed.bioload.currentPercent`, converts to 0–200%, and uses it for text + bar width.
