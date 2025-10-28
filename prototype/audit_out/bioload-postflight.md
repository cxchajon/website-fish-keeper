# Bioload Post-flight Report

## Files touched
- `prototype/js/logic/compute-proxy.js` — removed the planted relief branch so filtration efficiency is the only load reducer.
- `prototype/tests/bioload.turnover.spec.js`, `prototype/tests/bioload.inversion.test.js`, `prototype/tests/bioload.spec.js` — refreshed regression coverage for filtration math without planted toggles.
- `prototype/stocking-prototype.html`, `prototype/js/stocking-prototype.js` — pruned planted UI, inserted maturity note, and adjusted copy.

## Formula snapshot
- **Final math** (`computeBioloadDetails` → `percentBioload`):
  ```js
  const load = speciesLoad;
  const efficiency = clamp(aggregateFilterRelief, 0, MAX_RELIEF);
  const effectiveLoad = load * (1 - efficiency);
  const turnoverX = gallons > 0 ? appliedRatedFlow / gallons : 0;
  const capBonus = clamp(mapLinear(turnoverX, 5, 10, 0.00, 0.10), 0.00, 0.10);
  const capacity = Math.max(1, baseCapacity) * (1 + capBonus);
  const percent = capacity > 0 ? (effectiveLoad / capacity) * 100 : 0;
  ```
  Only equipment/filtration adjusts the numerator now; plant relief is intentionally absent.

## Validation
- `node --test prototype/tests/bioload.turnover.spec.js`
- `node --test prototype/tests/bioload.inversion.test.js`
- `node --test prototype/tests/bioload.spec.js`
- Manual check confirms inline maturity note renders near filtration summary and FAQ entry matches provided copy.
