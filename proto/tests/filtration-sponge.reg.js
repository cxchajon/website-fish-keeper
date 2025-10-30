import { computeBioloadPercentForTest } from '../../prototype/js/logic/compute-proxy.js';

const basePlan = { gallons: 29, speciesLoad: 15, capacity: 29 };

const sponge = { id: 'reg-sponge', source: 'custom', kind: 'SPONGE', rated_gph: 80 };
const hob = { id: 'reg-hob', source: 'custom', kind: 'HOB', rated_gph: 200 };

const baseline = computeBioloadPercentForTest({ ...basePlan, flowGPH: 0, totalGPH: 0, filters: [] });
const withSponge = computeBioloadPercentForTest({
  ...basePlan,
  flowGPH: sponge.rated_gph,
  totalGPH: sponge.rated_gph,
  filters: [sponge],
});
const withSpongeAndHob = computeBioloadPercentForTest({
  ...basePlan,
  flowGPH: sponge.rated_gph + hob.rated_gph,
  totalGPH: sponge.rated_gph + hob.rated_gph,
  filters: [sponge, hob],
});
const hobAfterFish = computeBioloadPercentForTest({
  ...basePlan,
  flowGPH: hob.rated_gph,
  totalGPH: hob.rated_gph,
  filters: [hob],
});

const firstDrop = baseline - withSponge;
const secondDrop = withSponge - withSpongeAndHob;

function fail(message, details) {
  console.error('[filtration-sponge.reg] FAIL:', message);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

if (!(withSponge < baseline)) {
  fail('Adding a sponge filter should reduce bioload percent', { baseline, withSponge });
}

if (!(withSpongeAndHob < withSponge)) {
  fail('Adding a HOB after a sponge should further reduce percent', { withSponge, withSpongeAndHob });
}

if (!(secondDrop > 0 && secondDrop < firstDrop)) {
  fail('Second filter should have diminishing returns', { firstDrop, secondDrop });
}

if (!(hobAfterFish < baseline)) {
  fail('Adding a filter after stocking fish should still reduce percent', { baseline, hobAfterFish });
}

console.log('[filtration-sponge.reg] PASS');
