import {
  combinedRbc,
  computePercent,
  effectiveCapacity,
  normalizeFilters,
} from './proto-filtration-math.js';

const DEBUG_TESTS = false;

if (DEBUG_TESTS) {
  const baseCapacity = 100;
  const baseLoad = 50;
  const filters = [
    { source: 'custom', type: 'HOB', rated_gph: 200 },
    { source: 'custom', type: 'SPONGE', rated_gph: 80 },
  ];
  const normalized = normalizeFilters(filters);
  const capacityBoost = combinedRbc(normalized, { normalized: true });
  const effectiveCap = effectiveCapacity(baseCapacity, normalized, { normalized: true });
  const percent = computePercent(baseLoad, effectiveCap);

  // eslint-disable-next-line no-console
  console.table({
    baseCapacity,
    baseLoad,
    capacityBoost,
    effectiveCapacity: effectiveCap,
    percent,
  });
}
