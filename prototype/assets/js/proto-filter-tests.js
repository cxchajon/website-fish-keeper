import {
  computeTurnover,
  computeEfficiency,
  computeAdjustedBioload,
  computePercent,
  getTotalGPH,
  resolveFilterBaseKey,
} from './proto-filtration-math.js';

const DEBUG_TESTS = false;

if (DEBUG_TESTS) {
  const gallons = 29;
  const base = 50;
  const cap = 100;

  const pct0 = (() => {
    const total = 0;
    const turn = computeTurnover(total, gallons);
    const eff = 0;
    const adjusted = computeAdjustedBioload(base, eff);
    return computePercent(adjusted, cap);
  })();

  const filters = [{ source: 'custom', type: 'HOB', gph: 200 }];
  const totals = getTotalGPH(filters);
  const turnover = computeTurnover(totals.rated, gallons);
  const eff = computeEfficiency(resolveFilterBaseKey('HOB'), turnover);
  const adjusted = computeAdjustedBioload(base, eff);
  const pct1 = computePercent(adjusted, cap);

  // eslint-disable-next-line no-console
  console.table({ pct0, pct1, ratedTotal: totals.rated, deratedTotal: totals.derated, turnover, eff });

  if (!(pct1 < pct0)) {
    // eslint-disable-next-line no-console
    console.warn('[Proto Tests] Expected pct1 < pct0 for custom filter guard.');
  }
}
