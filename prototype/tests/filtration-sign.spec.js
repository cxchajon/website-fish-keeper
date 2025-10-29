import { effectiveCapacity, computePercent } from '../assets/js/proto-filtration-math.js';
import { getTotalGE } from '../../js/bioload.js';
import { FISH_DB } from '../../js/fish-data.js';

const speciesMap = new Map(FISH_DB.map((species) => [species.id, species]));

function toStockEntries(stock) {
  return stock.map((entry) => ({ speciesId: entry.id, count: entry.count }));
}

function toFilterEntries(filters) {
  return filters.map((filter) => ({
    type: filter.type,
    rated_gph: filter.gph,
  }));
}


function computePercentUsed({ gallons, stock, filters }) {
  const load = getTotalGE(toStockEntries(stock), speciesMap);
  const normalizedFilters = toFilterEntries(filters);
  const effectiveCap = effectiveCapacity(gallons, normalizedFilters);
  return computePercent(load, effectiveCap);
}

const failures = [];

function recordResult(name, passed, detail) {
  const label = passed ? 'PASS' : 'FAIL';
  const parts = [`[${label}] ${name}`];
  if (detail) {
    parts.push(detail);
  }
  console.log(parts.join(' — '));
  if (!passed) {
    failures.push(name);
  }
}

function assertPercentDoesNotIncrease({ gallons, stock, filtersBefore, filterAdded }) {
  const before = computePercentUsed({ gallons, stock, filters: filtersBefore });
  const after = computePercentUsed({ gallons, stock, filters: [...filtersBefore, filterAdded] });
  const epsilon = 0.01;
  const passed = after <= before + epsilon;
  const detail = `before=${before.toFixed(4)} after=${after.toFixed(4)}`;
  recordResult('Adding a filter never raises percent used', passed, detail);
}

function assertMonotonicity({ gallons, stock, filters }) {
  let previous = null;
  let passed = true;
  const readings = [];
  const epsilon = 0.01;
  filters.forEach((filterSet, index) => {
    const percent = computePercentUsed({ gallons, stock, filters: filterSet });
    readings.push(percent);
    if (previous != null && percent > previous + epsilon) {
      passed = false;
    }
    previous = percent;
  });
  const detail = readings.map((value, index) => `step${index + 1}=${value.toFixed(4)}`).join(' ');
  recordResult('Bioload percent is monotonic with added flow', passed, detail);
}

assertPercentDoesNotIncrease({
  gallons: 29,
  stock: [
    { id: 'betta_male', count: 1 },
    { id: 'cory_panda', count: 12 },
  ],
  filtersBefore: [
    { type: 'HOB', gph: 200 },
  ],
  filterAdded: { type: 'SPONGE', gph: 80 },
});

assertMonotonicity({
  gallons: 29,
  stock: [
    { id: 'betta_male', count: 1 },
  ],
  filters: [
    [
      { type: 'HOB', gph: 200 },
    ],
    [
      { type: 'HOB', gph: 200 },
      { type: 'SPONGE', gph: 80 },
    ],
  ],
});

if (failures.length > 0) {
  process.exitCode = 1;
}
