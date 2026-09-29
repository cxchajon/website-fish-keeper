// Sponge migration phase B: rating-based sponge engine, catalog metadata, custom sponge input.
// Report: _internal/reports/stocking-advisor-sponge-migration-phase-b-2026-09.md
// Design:  _internal/reports/stocking-advisor-sponge-filter-migration-design-2026-09.md (section 1, LOCKED)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\//, '').split('?')[0];
  return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(readFileSync(ROOT + path, 'utf8')) };
};

const compute = await import('../../js/logic/compute.js');
const math = await import('../../js/stocking-advisor/filtration/math.js');
const saved = await import('../../js/stocking-advisor/filtration/saved-state.js');
const items = await import('../../js/stocking-advisor/filtration/sponge-items.js');
const { getGearData, filterGearByTank } = await import('../../js/gear-data.js');
const { getTankById, TANK_SIZES } = await import('../../js/utils.js');

await compute.initializeCompute();
const RAW = JSON.parse(readFileSync(ROOT + 'assets/data/gearCatalog.json', 'utf8'));
const CATALOG = await getGearData({ forceRefresh: true });
const byId = new Map(CATALOG.map((item) => [item.id, item]));

const HYGGER_S = 'hygger-double-sponge-s';
const HYGGER_M = 'hygger-double-sponge-m';
const UNVERIFIED = ['aquaneat-sponge-10', 'aquaneat-sponge-20', 'aquaneat-sponge-60', 'pawfly-sponge-10', 'powkoo-dual-sponge-40'];
const SPONGE_IDS = [HYGGER_S, HYGGER_M, ...UNVERIFIED];

// What the controller hands the calculator for one item (toAppFilter + normalizeFilters).
function toApp(item) {
  const type = item.type;
  const sponge = math.isSpongeFilter({ type });
  return {
    id: item.id,
    type,
    rated_gph: sponge ? 0 : item.gph,
    kind: type,
    source: item.source,
    ...math.pickPassthroughFields(item),
    capacityMethod: math.effectiveCapacityMethod(item),
    ...(sponge && item.label ? { label: item.label } : {}),
  };
}
const catalogSponge = (id) => items.buildSpongeProductItem(byId.get(id));
const customSponge = (gallons, n = 1) => items.buildCustomSpongeItem({ id: `manual-sp${n}`, ratedGallons: gallons });
const powered = (type, gph, n = 1) => ({ id: `manual-p${n}`, source: 'custom', type, gph, label: `${type} ${gph} GPH` });
const product = (id) => {
  const p = byId.get(id);
  return p.type === 'SPONGE' ? catalogSponge(id) : { id, source: 'product', type: p.type, gph: Math.round(p.gphRated), productId: id };
};

const TANK_BY_GALLONS = { 10: '10g', 20: '20l', 29: '29g', 40: '40b', 55: '55g', 75: '75g' };
const STOCK = [['neon', 10], ['cory_bronze', 6]];

function run(tankId, list, { stock = STOCK, raw = false } = {}) {
  const state = compute.createDefaultState();
  const tank = getTankById(tankId);
  Object.assign(state, {
    tank: { ...tank },
    gallons: tank.gallons,
    selectedTankId: tank.id,
    stock: stock.map(([id, qty]) => ({ id, qty })),
    filters: raw ? list : math.normalizeFilters(list.map(toApp)),
  });
  return compute.buildComputedState(state);
}
const filtrationWarnings = (computed) => computed.status.warnings.filter((w) => w.id.startsWith('filtration.'));
const warningIds = (computed) => filtrationWarnings(computed).map((w) => w.id);
const load = (computed) => [computed.bioload.currentPercent, computed.bioload.proposedPercent, computed.bioload.text,
  computed.bioload.severity, computed.bioload.proposed, computed.bioload.effectiveCapacity];
const nonFiltration = (computed) => computed.status.warnings.filter((w) => !w.id.startsWith('filtration.')).map((w) => `${w.severity}:${w.id}:${w.text}`);

// ---------------------------------------------------------------------------------------------
// Catalog metadata

test('catalog: the seven sponge records carry the locked metadata; ids unchanged; no legacy GPH (phase E)', () => {
  const expected = {
    [HYGGER_S]: [10, 40, 'verified', 'verified'],
    [HYGGER_M]: [15, 55, 'verified', 'verified'],
    'aquaneat-sponge-60': [40, 60, 'needs_review', 'supported'],
    'aquaneat-sponge-20': [null, 20, 'needs_review', 'supported'],
    'aquaneat-sponge-10': [null, null, 'needed', 'needs_review'],
    'pawfly-sponge-10': [null, null, 'needed', 'needs_review'],
    'powkoo-dual-sponge-40': [null, null, 'needed', 'needs_review'],
  };
  const sponges = RAW.filter((item) => item.type === 'SPONGE');
  assert.deepEqual(sponges.map((item) => item.id).sort(), Object.keys(expected).sort());
  for (const item of sponges) {
    const [min, max, status, evidence] = expected[item.id];
    assert.equal(item.capacityMethod, 'manufacturer_rating', item.id);
    assert.equal(item.manufacturerMinGallons, min, item.id);
    assert.equal(item.manufacturerMaxGallons, max, item.id);
    assert.equal(item.ratingStatus, status, item.id);
    assert.equal(item.ratingEvidence, evidence, item.id);
    // Phase E removed the legacy compatibility fields (GPH and GPH-bucket range) from the catalog.
    for (const key of ['gphRated', 'rated_gph', 'ratedGph', 'gph', 'minGallons', 'maxGallons', 'legacyFieldsNote']) {
      assert.equal(key in item, false, `${item.id} has no ${key}`);
    }
  }
  assert.equal(RAW.find((item) => item.id === HYGGER_S).ratingSourceKind, 'manufacturer_official');
  assert.deepEqual(RAW.find((item) => item.id === 'aquaneat-sponge-60').ratingSourceKind, ['retailer_exact_product', 'third_party_manual']);
  assert.equal(RAW.find((item) => item.id === 'aquaneat-sponge-20').ratingExpression, 'up_to');
});

test('catalog: sponge display names carry no capacity claim', () => {
  const names = Object.fromEntries(RAW.filter((item) => item.type === 'SPONGE').map((item) => [item.id, item.name]));
  assert.equal(names['aquaneat-sponge-10'], 'AQUANEAT Single Sponge Filter');
  assert.equal(names['aquaneat-sponge-20'], 'AQUANEAT Bio Sponge Filter — Middle');
  assert.equal(names['aquaneat-sponge-60'], 'AQUANEAT Bio Sponge Filter — Large');
  assert.equal(names['pawfly-sponge-10'], 'Pawfly Nano Bio Sponge Filter');
  assert.equal(names['powkoo-dual-sponge-40'], 'Powkoo Dual Sponge Filter');
  for (const [id, name] of Object.entries(names)) {
    assert.doesNotMatch(name, /\d+\s*(g\b|gal|G\b|Gal)|up to/i, id);
  }
});

// ---------------------------------------------------------------------------------------------
// Type wins / stale GPH

test('SPONGE forces the manufacturer-rating path, whatever stale data says', () => {
  const stale = [
    { type: 'SPONGE', gphRated: 120 },
    { type: 'SPONGE', rated_gph: 120, capacityMethod: 'flow' },
    { type: 'Sponge', gph: 150 },
    { type: 'sponge filter', ratedGph: 200 },
  ];
  for (const entry of stale) {
    assert.equal(math.effectiveCapacityMethod(entry), 'manufacturer_rating', JSON.stringify(entry));
    const normalized = math.normalizeFilter(entry);
    assert.equal(normalized.ratedGph, 0);
    assert.equal(normalized.capacityMethod, 'manufacturer_rating');
    assert.equal(compute.sanitizeFilterList([entry])[0].rated_gph, 0);
    assert.equal(compute.calcTotalGph([entry]), 0);
    const assessment = math.assessFiltration({ filters: [entry], gallons: 20, hasStock: true });
    assert.equal(assessment.level, 'not-evaluated', JSON.stringify(entry));
    assert.equal(assessment.biologicalGph, 0);
    assert.equal(assessment.totalGph, 0);
    assert.equal(assessment.biologicalTurnover, 0);
  }
  // An unsupported method still fails closed, sponge or not.
  assert.equal(math.effectiveCapacityMethod({ type: 'SPONGE', capacityMethod: 'banana' }), null);
  const banana = { type: 'SPONGE', capacityMethod: 'banana', gph: 100 };
  assert.deepEqual(math.normalizeFilters([banana]), []);
  assert.deepEqual(math.normalizeFilters(compute.sanitizeFilterList([banana])), [], 'still dropped after compute sanitizing');
  assert.equal(math.assessFiltration({ filters: compute.sanitizeFilterList([banana]), gallons: 20 }).level, 'none');
});

test('a stale cached catalog sponge (only type + fake GPH) is "Rating needed", never old turnover', () => {
  const staleRecord = { id: HYGGER_S, brand: 'Hygger', name: 'hygger … (S)', type: 'SPONGE', gphRated: 80, minGallons: 0, maxGallons: 20 };
  const item = items.buildSpongeProductItem(staleRecord);
  assert.equal(item.gph, 0);
  assert.equal(item.ratingStatus, undefined);
  assert.equal(items.spongeChipBadge(item), 'Rating needed');
  const computed = run('20l', [item]);
  assert.equal(computed.filtering.level, 'not-evaluated');
  assert.equal(computed.filtering.gphTotal, 0);
  assert.equal(computed.filtering.turnover, 0);
  assert.deepEqual(warningIds(computed), ['filtration.rating_needed']);
  // With the current catalog the same product is rated.
  assert.equal(run('20l', [catalogSponge(HYGGER_S)]).filtering.level, 'adequate');
});

test('rating only counts when VERIFIED: a positive max alone never green-passes', () => {
  for (const status of [undefined, 'needs_review', 'needed', 'supported', 'bogus']) {
    const entry = { type: 'SPONGE', manufacturerMaxGallons: 500, ...(status ? { ratingStatus: status } : {}) };
    const rating = math.resolveSpongeRating(entry);
    assert.equal(rating.maxGallons, null, String(status));
    assert.equal(math.assessFiltration({ filters: [entry], gallons: 10, hasStock: true }).level, 'not-evaluated', String(status));
  }
  assert.equal(math.resolveSpongeRating({ ratingStatus: 'verified' }).status, 'needed', 'verified without a max is not usable');
  assert.equal(math.resolveSpongeRating({ ratingStatus: 'verified', manufacturerMaxGallons: 0 }).status, 'needed');
  assert.equal(math.resolveSpongeRating({ ratingStatus: 'verified', manufacturerMaxGallons: 40 }).maxGallons, 40);
});

// ---------------------------------------------------------------------------------------------
// Verified Hygger matrix (step 26)

test('Hygger Small (10–40 gal): green to 40 gal, amber below rating at 55 and 75', () => {
  const expected = { 10: 'adequate', 20: 'adequate', 29: 'adequate', 40: 'adequate', 55: 'below-rating', 75: 'below-rating' };
  for (const [gallons, level] of Object.entries(expected)) {
    const computed = run(TANK_BY_GALLONS[gallons], [catalogSponge(HYGGER_S)]);
    assert.equal(computed.filtering.level, level, `${gallons} gal`);
    const [warning] = filtrationWarnings(computed);
    if (level === 'adequate') {
      assert.equal(computed.filtering.assessment.adequateBy, 'sponge');
      assert.equal(warning.id, 'filtration.sponge_rated');
      assert.equal(warning.severity, 'info');
      assert.equal(warning.title, '✓ Rated for this tank');
      assert.match(warning.message, /Manufacturer rating: 10–40 gal · Tank: \d+ gal/);
      assert.equal(computed.filtering.status.tone, 'good');
    } else {
      assert.equal(warning.id, 'filtration.below_rating');
      assert.equal(warning.severity, 'warn', 'amber, never red');
      assert.equal(warning.title, 'Below manufacturer rating');
      assert.match(warning.message, new RegExp(`Filter rating: 10–40 gal · Tank: ${gallons} gal`));
    }
    assert.doesNotMatch(JSON.stringify(filtrationWarnings(computed)), /GPH|turnover|×/i, 'no GPH or turnover for a sponge');
  }
});

test('Hygger Medium (15–55 gal): green to 55 gal incl. 10 gal (minimum is informational), amber at 75', () => {
  const expected = { 10: 'adequate', 20: 'adequate', 29: 'adequate', 40: 'adequate', 55: 'adequate', 75: 'below-rating' };
  for (const [gallons, level] of Object.entries(expected)) {
    const computed = run(TANK_BY_GALLONS[gallons], [catalogSponge(HYGGER_M)]);
    assert.equal(computed.filtering.level, level, `${gallons} gal`);
    assert.ok(filtrationWarnings(computed).every((w) => w.severity !== 'danger'));
  }
});

// ---------------------------------------------------------------------------------------------
// Five non-verified products (step 27)

test('the five non-verified sponges: selectable, "Rating needed", never scored by GPH or review numbers', () => {
  for (const id of UNVERIFIED) {
    const item = catalogSponge(id);
    assert.equal(item.gph, 0, id);
    assert.equal(items.spongeChipBadge(item), 'Rating needed', id);
    assert.equal(items.spongeOptionDetails(byId.get(id)), 'Sponge • Rating needed', id);
    for (const tank of TANK_SIZES) {
      assert.ok(filterGearByTank(CATALOG, tank.gallons).some((entry) => entry.id === id), `${id} offered for ${tank.id}`);
      const computed = run(tank.id, [item]);
      assert.equal(computed.filtering.level, 'not-evaluated', `${id} ${tank.id}`);
      assert.equal(computed.filtering.gphTotal, 0);
      assert.deepEqual(warningIds(computed), ['filtration.rating_needed']);
      assert.equal(filtrationWarnings(computed)[0].severity, 'info');
      assert.equal(filtrationWarnings(computed)[0].title, '○ Not evaluated — rating needed');
      assert.ok(computed.status.warnings.filter((w) => w.id.startsWith('filtration.')).every((w) => w.severity === 'info'),
        'never unsafe (or even amber) for an unknown rating');
      assert.deepEqual(nonFiltration(computed), nonFiltration(run(tank.id, [])));
    }
  }
  // Supported review metadata (AQUANEAT Large 40–60, Middle 20) does not score: two of them on a
  // 20-gal tank are not "likely adequate" even though 20 + 60 ≥ 20.
  const both = run('20l', [catalogSponge('aquaneat-sponge-20'), catalogSponge('aquaneat-sponge-60')]);
  assert.equal(both.filtering.level, 'not-evaluated');
  assert.equal(both.filtering.assessment.sponge.verifiedCount, 0);
});

// ---------------------------------------------------------------------------------------------
// Step 25 scenarios A–J

test('step 25 scenarios A–J', () => {
  const unrated = catalogSponge('aquaneat-sponge-20');
  const hob150 = powered('HOB', 150);
  const hobLow = powered('HOB', 40); // 1.4× on 29 gal
  const powerhead = powered('POWERHEAD', 300, 9);
  const v40 = customSponge(40, 1);
  const v55 = customSponge(55, 2);
  const v30 = customSponge(30, 3);

  const A = run('29g', [hob150]);
  assert.equal(A.filtering.level, 'adequate');
  assert.equal(A.filtering.assessment.adequateBy, 'powered');
  assert.deepEqual(warningIds(A), []);

  const B = run('29g', [hob150, unrated]);
  assert.equal(B.filtering.level, 'adequate');
  assert.equal(B.filtering.assessment.adequateBy, 'powered');
  assert.equal(B.filtering.assessment.sponge.status, 'rating-needed');
  assert.deepEqual(warningIds(B), [], 'supplemental unrated sponge: chip shows "Rating needed", no warning');
  assert.equal(B.filtering.gphTotal, 150);

  const C = run('29g', [catalogSponge(HYGGER_S)]);
  assert.equal(C.filtering.level, 'adequate');
  assert.equal(filtrationWarnings(C)[0].title, '✓ Rated for this tank');

  const D = run('55g', [v40]);
  assert.equal(D.filtering.level, 'below-rating');
  assert.match(filtrationWarnings(D)[0].message, /Filter rating: up to 40 gal · Tank: 55 gal/);

  const E = run('55g', [v40, v55]);
  assert.equal(E.filtering.level, 'adequate');
  assert.equal(filtrationWarnings(E)[0].title, '✓ Rated for this tank');
  assert.match(filtrationWarnings(E)[0].message, /up to 55 gal/);

  const F = run('55g', [catalogSponge(HYGGER_S), v30]);
  assert.equal(F.filtering.level, 'likely-multi-sponge');
  const [likely] = filtrationWarnings(F);
  assert.equal(likely.severity, 'warn');
  assert.equal(likely.title, 'Likely adequate — multiple sponge filters');
  assert.match(likely.message, /rated 10–40 gal/);
  assert.match(likely.message, /rated up to 30 gal/);
  assert.doesNotMatch(likely.message, /70/, 'no combined gallon figure');

  const G = run('29g', [hobLow, unrated]);
  assert.equal(G.filtering.level, 'review');
  const [review] = filtrationWarnings(G);
  assert.equal(review.severity, 'warn', 'amber, not the powered-only red');
  assert.equal(review.title, 'Review filtration');
  assert.match(review.message, /40 GPH through filter media .* below the 2× minimum/);
  assert.match(review.message, /rating needed/);
  assert.ok(!warningIds(G).includes('filtration.very_low'));

  const H = run('29g', [hobLow, v40]);
  assert.equal(H.filtering.level, 'adequate');
  assert.equal(H.filtering.assessment.adequateBy, 'sponge');
  assert.match(filtrationWarnings(H)[0].message, /below the 2× minimum, but the sponge is rated for this tank/);

  const I = run('29g', [powerhead, v40]);
  assert.equal(I.filtering.level, 'adequate');
  assert.equal(I.filtering.biologicalGph, 0, 'powerhead GPH never becomes biological');
  assert.equal(I.filtering.circulationGph, 300);

  const J = run('29g', [powerhead, unrated]);
  assert.equal(J.filtering.level, 'not-evaluated');
  assert.deepEqual(warningIds(J), ['filtration.rating_needed']);
  assert.ok(!warningIds(J).includes('filtration.circulation_only'), 'not "No biological filter"');
  assert.ok(!warningIds(J).includes('filtration.none'), 'not "No filter added"');
  assert.equal(J.filtering.assessment.hasBiologicalFiltration, true);
  assert.equal(J.filtering.assessment.hasBiologicalGph, false);
});

test('multiple verified undersized sponges: amber only with ≥ 2 verified ratings reaching the tank', () => {
  // Two different verified sponges: 30 + 30 on 55 gal.
  const pair = run('55g', [customSponge(30, 1), customSponge(30, 2)]);
  assert.equal(pair.filtering.level, 'likely-multi-sponge');
  // Sum below the tank → below rating.
  assert.equal(run('75g', [customSponge(30, 1), customSponge(30, 2)]).filtering.level, 'below-rating');
  // One verified + one unrated: the unrated sponge never enters the sum.
  const mixed = run('55g', [customSponge(40, 1), catalogSponge('aquaneat-sponge-60')]);
  assert.equal(mixed.filtering.level, 'below-rating');
  assert.match(filtrationWarnings(mixed)[0].message, /One sponge has no verified rating yet/);
  // Powered below the floor + likely multi-sponge → the amber multi-sponge tier (design 4.4 order).
  const withPowered = run('55g', [powered('HOB', 50), customSponge(30, 1), customSponge(30, 2)]);
  assert.equal(withPowered.filtering.level, 'likely-multi-sponge');
});

test('mixed powered + sponge: independent paths, never a combined number', () => {
  const pass = run('29g', [powered('HOB', 150), customSponge(20)]);
  assert.equal(pass.filtering.level, 'adequate');
  assert.equal(pass.filtering.assessment.adequateBy, 'powered');
  assert.equal(pass.filtering.turnover, 150 / 29, 'turnover counts the powered filter only');
  const both = run('29g', [powered('HOB', 100), customSponge(40)]);
  assert.equal(both.filtering.assessment.adequateBy, 'both');
  const reviewVerified = run('29g', [powered('HOB', 40), customSponge(20)]);
  assert.equal(reviewVerified.filtering.level, 'review');
  assert.match(filtrationWarnings(reviewVerified)[0].message, /rated up to 20 gal — below this 29-gallon tank/);
  // Powered-only below 2× stays the existing red state.
  const poweredOnly = run('29g', [powered('HOB', 40)]);
  assert.equal(poweredOnly.filtering.level, 'very-low');
  assert.equal(filtrationWarnings(poweredOnly)[0].severity, 'danger');
  assert.equal(filtrationWarnings(poweredOnly)[0].title, 'Filter flow too low');
});

test('circulation: powerhead alone is still "No biological filter"; a sponge makes biological filtration', () => {
  const alone = run('29g', [powered('POWERHEAD', 300)]);
  assert.equal(alone.filtering.level, 'circulation-only');
  assert.deepEqual(warningIds(alone), ['filtration.circulation_only']);
  assert.equal(run('29g', []).filtering.level, 'none');
});

test('no sponge state is red, and neutral notes never become a status issue or chip', () => {
  const cases = [
    [customSponge(40)], [customSponge(10)], [customSponge(30, 1), customSponge(30, 2)],
    [catalogSponge('pawfly-sponge-10')], [powered('HOB', 40), catalogSponge('pawfly-sponge-10')],
  ];
  for (const list of cases) {
    for (const tankId of ['10g', '29g', '55g', '75g']) {
      const computed = run(tankId, list);
      assert.ok(filtrationWarnings(computed).every((w) => w.severity !== 'danger'), `${tankId} ${JSON.stringify(list)}`);
      if (filtrationWarnings(computed).every((w) => w.severity === 'info')) {
        assert.equal(computed.filtering.chip, null);
        assert.deepEqual(nonFiltration(computed), nonFiltration(run(tankId, [powered('CANISTER', 1500)])));
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Stocking Load (step 28): hard blocker

test('Stocking Load is identical before filter, with powered, verified sponge and unrated sponge', () => {
  const stocks = [
    STOCK,
    [['neon', 10], ['cory_bronze', 6], ['betta_male', 1]],
    [['freshwater_angelfish', 2], ['neon', 10]],
    [['pea_puffer', 6]],
    [['tiger_barb', 6], ['bristlenose_pleco', 1]],
  ];
  const lists = [
    [],
    [powered('HOB', 150)],
    [catalogSponge(HYGGER_S)],
    [catalogSponge(HYGGER_M)],
    [catalogSponge('aquaneat-sponge-20')],
    [customSponge(40)],
    [customSponge(10), customSponge(10, 2)],
    [powered('HOB', 40), catalogSponge('powkoo-dual-sponge-40')],
    [powered('POWERHEAD', 400), customSponge(40)],
    ...SPONGE_IDS.map((id) => [catalogSponge(id)]),
  ];
  for (const tank of TANK_SIZES) {
    for (const stock of stocks) {
      const reference = run(tank.id, [], { stock });
      for (const list of lists) {
        const computed = run(tank.id, list, { stock });
        const label = `${tank.id} ${JSON.stringify(stock)} ${list.map((item) => item.id).join(',')}`;
        assert.deepEqual(load(computed), load(reference), label);
        assert.equal(computed.filtering.assessment.capacityAdjustment, 0);
        // Filtration only changes filtration warnings.
        assert.deepEqual(nonFiltration(computed), nonFiltration(reference), label);
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Powered regression (step 29)

test('powered catalog filters are unchanged: GPH, turnover, level; Tetra IQ 45 stays 215 GPH', () => {
  const expectedGph = { 'tetra-whisper-iq-45': 215, 'aquaclear-70': 300, 'fluval-307': 303, 'eheim-2213': 116 };
  for (const [id, gph] of Object.entries(expectedGph)) {
    assert.equal(byId.get(id).gphRated, gph, id);
    for (const tank of TANK_SIZES) {
      const computed = run(tank.id, [product(id)]);
      assert.equal(computed.filtering.gphTotal, gph, `${id} ${tank.id}`);
      assert.equal(computed.filtering.turnover, gph / tank.gallons);
      assert.equal(computed.filtering.level, gph / tank.gallons >= 2 ? 'adequate' : 'very-low', `${id} ${tank.id}`);
    }
  }
  // Picker eligibility for powered products still follows their tank range.
  for (const tank of TANK_SIZES) {
    const offered = filterGearByTank(CATALOG, tank.gallons).filter((item) => item.type !== 'SPONGE').map((item) => item.id);
    const expected = CATALOG.filter((item) => item.type !== 'SPONGE' && tank.gallons >= item.minGallons && tank.gallons <= item.maxGallons).map((item) => item.id);
    assert.deepEqual(offered, expected, tank.id);
  }
});

test('undergravel filter is unchanged in phase B: flow-scored, not a sponge', () => {
  const ugf = product('penn-plax-ugf-20-29');
  assert.equal(math.isSpongeFilter(ugf), false);
  assert.equal(math.effectiveCapacityMethod(ugf), 'flow');
  const computed = run('29g', [ugf]);
  assert.equal(computed.filtering.gphTotal, 150);
  assert.equal(computed.filtering.level, 'adequate');
});

// ---------------------------------------------------------------------------------------------
// Picker, labels, chips (steps 13–15)

test('picker: every sponge is offered on every tank; labels show rating, never GPH or bucket range', () => {
  for (const tank of TANK_SIZES) {
    const offered = new Set(filterGearByTank(CATALOG, tank.gallons).map((item) => item.id));
    for (const id of SPONGE_IDS) assert.ok(offered.has(id), `${id} on ${tank.id}`);
  }
  assert.equal(items.spongeOptionDetails(byId.get(HYGGER_S)), 'Sponge • Rated 10–40 gal');
  assert.equal(items.spongeOptionDetails(byId.get(HYGGER_M)), 'Sponge • Rated 15–55 gal');
  for (const id of UNVERIFIED) {
    const text = items.spongeOptionDetails(byId.get(id));
    assert.equal(text, 'Sponge • Rating needed', id);
    assert.doesNotMatch(text, /GPH|20 gal|60 gal/);
  }
});

test('chips: verified sponges show their rating, others "Rating needed"; never GPH', () => {
  assert.equal(items.spongeChipBadge(catalogSponge(HYGGER_S)), 'Rated 10–40 gal');
  assert.equal(items.spongeChipBadge(catalogSponge(HYGGER_M)), 'Rated 15–55 gal');
  assert.equal(items.spongeChipBadge(customSponge(40)), 'Rated up to 40 gal');
  for (const id of UNVERIFIED) assert.equal(items.spongeChipBadge(catalogSponge(id)), 'Rating needed');
  assert.equal(items.spongeChipBadge({ type: 'SPONGE', gph: 120 }), 'Rating needed');
});

// ---------------------------------------------------------------------------------------------
// Custom sponge input (steps 16–17)

test('custom sponge rating input: positive whole gallons 1–999, no GPH written', () => {
  for (const [input, expected] of [['40', 40], [' 55 ', 55], ['20.4', 20], [75, 75], ['999', 999], ['1', 1]]) {
    assert.equal(items.parseRatedGallons(input), expected, JSON.stringify(input));
  }
  for (const bad of ['', '0', '0.4', '-5', '1000', 'abc', '40gal', '1e3', NaN, Infinity, null, undefined, {}, true]) {
    assert.equal(items.parseRatedGallons(bad), null, JSON.stringify(bad));
  }
  const item = customSponge(40);
  assert.deepEqual(item, {
    id: 'manual-sp1', source: 'custom', label: 'Sponge filter', gph: 0, type: 'SPONGE', efficiencyType: 'SPONGE',
    capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 40, ratingStatus: 'verified',
  });
  assert.equal(items.buildCustomSpongeItem({ id: 'manual-x', ratedGallons: '0' }), null);
});

test('custom sponge serialization: {type, capacityMethod, manufacturerMaxGallons, ratingStatus, source} and no GPH', () => {
  const storage = new Map();
  const store = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };
  saved.writeSavedFilters(store, [{ ...toApp(customSponge(40)), label: 'Sponge filter' }]);
  const [entry] = JSON.parse(storage.get(saved.FILTER_STORAGE_KEY_V2)).filters;
  assert.equal(entry.source, 'custom');
  assert.equal(entry.type, 'SPONGE');
  assert.equal(entry.capacityMethod, 'manufacturer_rating');
  assert.equal(entry.manufacturerMaxGallons, 40);
  assert.equal(entry.ratingStatus, 'verified');
  assert.equal(entry.label, 'Sponge filter');
  assert.match(entry.instanceId, /^f-/);
  assert.equal('gph' in entry, false);
  assert.equal('legacyGph' in entry, false);
  assert.equal(storage.has(saved.FILTER_STORAGE_KEY_V1), false, 'v1 mirror excludes rating sponges');
});

// ---------------------------------------------------------------------------------------------
// Saved-state migration (steps 18–20, 33)

function storageWith(initial) {
  const map = new Map(Object.entries(initial));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}
const restore = (entry) => items.restoreSpongeItem(entry, byId.get(entry.id)?.type === 'SPONGE' ? byId.get(entry.id) : null);

test('old v1 catalog sponge {id, type:"SPONGE", rated_gph:120}: catalog metadata wins, GPH ignored', () => {
  for (const id of SPONGE_IDS) {
    const state = saved.readSavedFilterState(storageWith({ [saved.FILTER_STORAGE_KEY_V1]: JSON.stringify([{ id, type: 'SPONGE', rated_gph: 120 }]) }));
    const [entry] = state.entries;
    assert.deepEqual([entry.productId, entry.capacityMethod, entry.gph], [id, 'manufacturer_rating', undefined]);
    const item = restore(state.filters[0]);
    assert.equal(item.gph, 0);
    assert.equal(item.ratingStatus, byId.get(id).ratingStatus);
    const level = run('29g', [item]).filtering.level;
    assert.equal(level, [HYGGER_S, HYGGER_M].includes(id) ? 'adequate' : 'not-evaluated', id);
  }
});

test('old phase-A v2 catalog sponge {productId, capacityMethod:"flow", gph:120}: flow and GPH ignored', () => {
  for (const id of SPONGE_IDS) {
    const payload = { v: 2, filters: [{ instanceId: 'f-old001', source: 'product', productId: id, type: 'SPONGE', capacityMethod: 'flow', gph: 120 }] };
    const state = saved.readSavedFilterState(storageWith({ [saved.FILTER_STORAGE_KEY_V2]: JSON.stringify(payload) }));
    const [entry] = state.entries;
    assert.deepEqual(entry, { instanceId: 'f-old001', source: 'product', productId: id, type: 'SPONGE', capacityMethod: 'manufacturer_rating' });
    const item = restore(state.filters[0]);
    assert.equal(item.instanceId, 'f-old001');
    const computed = run('29g', [item]);
    assert.equal(computed.filtering.gphTotal, 0);
    assert.equal(computed.filtering.level, [HYGGER_S, HYGGER_M].includes(id) ? 'adequate' : 'not-evaluated', id);
  }
});

test('old custom sponge with only a GPH (v1 and phase-A v2): Rating needed, GPH kept as legacy only', () => {
  const fromV1 = saved.readSavedFilterState(storageWith({ [saved.FILTER_STORAGE_KEY_V1]: JSON.stringify([{ id: 'manual-old1', type: 'SPONGE', rated_gph: 120 }]) }));
  const fromV2 = saved.readSavedFilterState(storageWith({ [saved.FILTER_STORAGE_KEY_V2]: JSON.stringify({ v: 2, filters: [
    { instanceId: 'f-old002', source: 'custom', label: 'Sponge 120 GPH', legacyId: 'manual-old2', type: 'SPONGE', capacityMethod: 'flow', gph: 120 },
  ] }) }));
  for (const state of [fromV1, fromV2]) {
    const [entry] = state.entries;
    assert.equal(entry.capacityMethod, 'manufacturer_rating');
    assert.equal(entry.ratingStatus, 'needed');
    assert.equal(entry.legacyGph, 120);
    assert.equal('gph' in entry, false);
    assert.equal('manufacturerMaxGallons' in entry, false, 'GPH is never converted into gallons');
    const item = restore(state.filters[0]);
    assert.equal(item.label, 'Sponge filter', 'old "Sponge 120 GPH" label is not shown');
    assert.equal(item.gph, 0);
    assert.equal(items.needsCustomRating(item), true, 'the user can enter its rating');
    assert.equal(items.spongeChipBadge(item), 'Rating needed');
    const computed = run('20l', [item]);
    assert.equal(computed.filtering.level, 'not-evaluated');
    assert.equal(computed.filtering.gphTotal, 0);
    assert.doesNotMatch(JSON.stringify(filtrationWarnings(computed)), /120/);
  }
  // Once rated, the legacy value is dropped on the next save.
  const rated = { ...items.buildCustomSpongeItem({ id: 'manual-old1', ratedGallons: 20 }), legacyGph: 120 };
  const [entry] = saved.serializeFilters([toApp(rated)]);
  assert.equal(entry.ratingStatus, 'verified');
  assert.equal('legacyGph' in entry, false);
});

test('rating-only sponge survives every sanitizer / normalizer into compute', () => {
  const item = customSponge(40);
  const app = toApp(item);
  const normalized = math.normalizeFilters([app]);
  assert.equal(normalized.length, 1, 'normalizeFilters keeps a 0-GPH sponge');
  const sanitized = compute.sanitizeFilterList(normalized);
  const [entry] = sanitized;
  assert.equal(entry.rated_gph, 0);
  assert.equal(entry.capacityMethod, 'manufacturer_rating');
  assert.equal(entry.manufacturerMaxGallons, 40);
  assert.equal(entry.ratingStatus, 'verified');
  assert.equal(entry.label, 'Sponge filter');
  // instanceId / productId / min survive too.
  const full = { ...app, instanceId: 'f-keep01', productId: HYGGER_S, manufacturerMinGallons: 10 };
  const through = compute.sanitizeFilterList(math.normalizeFilters([full]))[0];
  assert.deepEqual([through.instanceId, through.productId, through.manufacturerMinGallons], ['f-keep01', HYGGER_S, 10]);
  // Powered filters still need a positive GPH.
  assert.deepEqual(math.normalizeFilters([{ type: 'HOB', rated_gph: 0 }]), []);
});

test('v1 mirror: powered filters kept, rating sponges excluded, no gallons in rated_gph', () => {
  const store = storageWith({});
  saved.writeSavedFilters(store, [
    toApp(product('tetra-whisper-iq-45')),
    toApp(catalogSponge(HYGGER_M)),
    { ...toApp(customSponge(40)), label: 'Sponge filter' },
    toApp(powered('CANISTER', 180)),
  ]);
  const mirror = JSON.parse(store.map.get(saved.FILTER_STORAGE_KEY_V1));
  assert.deepEqual(mirror, [
    { id: 'tetra-whisper-iq-45', type: 'HOB', rated_gph: 215 },
    { id: 'manual-p1', type: 'CANISTER', rated_gph: 180 },
  ]);
  const v2 = JSON.parse(store.map.get(saved.FILTER_STORAGE_KEY_V2)).filters;
  assert.equal(v2.length, 4, 'v2 stays authoritative');
});

// ---------------------------------------------------------------------------------------------
// Catalog loader / cache (step 34)

test('catalog cache key is v2; the loader keeps a GPH-less sponge record and drops a GPH-less powered one', async () => {
  const src = readFileSync(ROOT + 'js/gear-data.js', 'utf8');
  assert.match(src, /STORAGE_KEY = 'ttg\.gear\.catalog\.v2'/);
  const gear = await import('../../js/gear-data.js');
  const fetchImpl = async () => ({ ok: true, json: async () => ([
    { id: 'future-sponge', brand: 'X', name: 'X Sponge', type: 'SPONGE', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 20, ratingStatus: 'verified' },
    { id: 'no-flow-hob', brand: 'X', name: 'X HOB', type: 'HOB' },
    { id: 'ok-hob', brand: 'X', name: 'X HOB 2', type: 'HOB', gphRated: 100 },
  ]) });
  const loaded = await gear.getGearData({ forceRefresh: true, fetchImpl });
  assert.deepEqual(loaded.map((item) => item.id).sort(), ['future-sponge', 'ok-hob']);
  const sponge = loaded.find((item) => item.id === 'future-sponge');
  // No synthetic flow or bucket fields on a sponge (phase E).
  for (const key of ['gphRated', 'rated_gph', 'minGallons', 'maxGallons']) assert.equal(key in sponge, false, key);
  assert.equal(sponge.ratingStatus, 'verified');
  // Restore the real catalog for any later test.
  await gear.getGearData({ forceRefresh: true });
});
