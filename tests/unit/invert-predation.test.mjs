// Phase 2E: shrimp / snail predation severity comes from each predator's explicit
// behavior.predationRisks; the generic shrimp_risk / snail_risk tag is only a fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\//, '');
  return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(readFileSync(ROOT + path, 'utf8')) };
};

const compute = await import('../../js/logic/compute.js');
const { getTankById } = await import('../../js/utils.js');
await compute.initializeCompute();
const RAW = JSON.parse(readFileSync(`${ROOT}data/stocking-advisor/species.v2.json`, 'utf8'));

function run(stock, candidate = null) {
  const state = compute.createDefaultState();
  const tank = getTankById('125g');
  Object.assign(state, {
    tank: { ...tank }, gallons: tank.gallons, selectedTankId: tank.id,
    stock: stock.map(([id, qty]) => ({ id, qty })),
    candidate: candidate ? { id: candidate[0], qty: candidate[1] } : null,
    filters: [{ type: 'Canister', rated_gph: 800 }],
  });
  return compute.buildComputedState(state);
}
const find = (computed, id) => computed.status.warnings.find((w) => w.id === id);
const risks = (slug) => RAW.find((r) => r.slug === slug).behavior.predationRisks;

test('A: Blue Ram ("Shrimp (all sizes)") + Cherry Shrimp is red, before and after Add', () => {
  assert.ok(risks('blue-ram').includes('Shrimp (all sizes)'));
  for (const computed of [run([['neocaridina', 10]], ['blue_ram', 1]), run([['neocaridina', 10], ['blue_ram', 1]])]) {
    const w = find(computed, 'predation.shrimp.blue_ram.neocaridina');
    assert.equal(w.severity, 'danger');
    assert.match(w.title, /may eat Cherry Shrimp/);
    assert.match(w.message, /shrimp of all sizes/);
    assert.equal(computed.status.severity, 'bad');
  }
});

test('B: juvenile-only data ("Shrimp (juvenile)") is amber and says juvenile', () => {
  assert.ok(risks('molly').includes('Shrimp (juvenile)'));
  const w = find(run([['neocaridina', 10], ['molly', 3]]), 'predation.shrimp.molly.neocaridina');
  assert.equal(w.severity, 'warn');
  assert.match(w.title, /may eat juvenile Cherry Shrimp/);
  assert.match(w.message, /Adult Cherry Shrimp may coexist, but shrimplets are at risk/);
  assert.doesNotMatch(w.text, /all sizes|all shrimp/i);
});

test('C/D: a named shrimp type is red for that type only', () => {
  assert.deepEqual(risks('betta-male').filter((r) => /shrimp/i.test(r)), ['Shrimp (cherry)']);
  const cherry = find(run([['neocaridina', 10], ['betta_male', 1]]), 'predation.shrimp.betta_male.neocaridina');
  assert.equal(cherry.severity, 'danger');
  assert.match(cherry.title, /Betta \(Male\) may prey on Cherry Shrimp/);
  // Cherry-specific evidence says nothing about Amano: not promoted, and the derived tag does not
  // turn it back into a generic warning.
  const amano = run([['amano', 6], ['betta_male', 1]]);
  assert.equal(find(amano, 'predation.shrimp.betta_male.amano'), undefined);
  // Cherry Barb names both types.
  assert.equal(find(run([['amano', 6], ['cherrybarb', 6]]), 'predation.shrimp.cherrybarb.amano').severity, 'danger');
});

test('E: Pea Puffer is caught from its explicit data although its raw tags lack shrimp_risk', () => {
  const raw = RAW.find((r) => r.slug === 'pea-puffer');
  assert.ok(!raw.tags.includes('shrimp_risk'));
  assert.ok(raw.behavior.predationRisks.includes('Shrimp (all sizes)'));
  assert.equal(find(run([['neocaridina', 10], ['pea_puffer', 1]]), 'predation.shrimp.pea_puffer.neocaridina').severity, 'danger');
  assert.equal(find(run([['nerite', 2], ['pea_puffer', 1]]), 'predation.snail.pea_puffer.nerite').severity, 'danger');
});

test('F: Assassin Snail ("Snails") with another snail is red; never against itself', () => {
  const w = find(run([['nerite', 2], ['assassin_snail', 2]]), 'predation.snail.assassin_snail.nerite');
  assert.equal(w.severity, 'danger');
  assert.match(w.message, /lists snails as prey/);
  assert.equal(find(run([['assassin_snail', 4]]), 'predation.snail.assassin_snail.assassin_snail'), undefined);
});

test('explicit data beats a contradictory shrimp_safe tag; a tag alone stays amber', () => {
  const zebra = RAW.find((r) => r.slug === 'zebra-danio');
  assert.ok(zebra.tags.includes('shrimp_safe') && zebra.behavior.predationRisks.includes('Shrimp (juvenile)'));
  assert.equal(find(run([['neocaridina', 10], ['zebra', 6]]), 'predation.shrimp.zebra.neocaridina').severity, 'warn');
  const ghost = RAW.find((r) => r.slug === 'ghost-shrimp');
  assert.ok(ghost.tags.includes('shrimp_risk') && !(ghost.behavior?.predationRisks ?? []).some((r) => /shrimp/i.test(r)));
  const tagOnly = find(run([['neocaridina', 10], ['ghost_shrimp', 3]]), 'predation.shrimp.ghost_shrimp.neocaridina');
  assert.equal(tagOnly.severity, 'warn');
  assert.match(tagOnly.message, /no detail on which sizes/);
});

test('species with no shrimp/snail data or tag produce no invert predation warning', () => {
  const computed = run([['neocaridina', 10], ['nerite', 2], ['otocinclus', 6], ['cory_panda', 6]]);
  assert.equal(computed.status.warnings.filter((w) => /^predation\.(shrimp|snail)\./.test(w.id)).length, 0);
});
