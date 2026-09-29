// Sponge migration phase G: the filtration status card's view model (status-view.js).
// Report: _internal/reports/stocking-advisor-sponge-migration-phase-g-2026-09.md
//   Every fixture goes through the real engine (compute.buildComputedState → computed.filtering);
//   the view model only presents it. Checked per fixture: headline, tone, path lines, supplemental
//   lines, redundancy, the permanent Stocking Load sentence and forbidden numerical claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(ROOT + path, 'utf8'));
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\//, '').split('?')[0];
  return { ok: true, status: 200, statusText: 'OK', json: async () => readJson(path) };
};

const compute = await import('../../js/logic/compute.js');
const math = await import('../../js/stocking-advisor/filtration/math.js');
const items = await import('../../js/stocking-advisor/filtration/sponge-items.js');
const ugfItems = await import('../../js/stocking-advisor/filtration/ugf-items.js');
const instances = await import('../../js/stocking-advisor/filtration/instances.js');
const view = await import('../../js/stocking-advisor/filtration/status-view.js');
const { getGearData } = await import('../../js/gear-data.js');
const { getTankById } = await import('../../js/utils.js');

await compute.initializeCompute();
const CATALOG = await getGearData({ forceRefresh: true });
const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.id, item]));

const HYGGER_S = 'hygger-double-sponge-s'; // verified 10–40 gal
const AQUANEAT_MIDDLE = 'aquaneat-sponge-20'; // needs_review → Rating needed
const UGF = 'penn-plax-ugf-20-29'; // compatibleTanks ["20l", "29g"]
const TETRA = 'tetra-whisper-iq-45'; // 215 GPH
const PERMANENT = 'Filtration supports your livestock but does not increase stocking capacity.';

// --- controller model, as in the phase B–F unit tests -------------------------------------------
function productItem(productId) {
  const product = CATALOG_BY_ID.get(productId);
  if (math.isSpongeFilter(product)) return items.buildSpongeProductItem(product);
  if (math.isUndergravelFilter(product)) return ugfItems.buildUgfProductItem(product);
  return { id: product.id, source: 'product', label: product.name, type: product.type, gph: Math.round(product.gphRated),
    productId: product.id, capacityMethod: 'flow' };
}
function toApp(item) {
  const zeroFlow = math.isSpongeFilter({ type: item.type }) || math.isUndergravelFilter({ type: item.type });
  const fields = math.pickPassthroughFields(item);
  if (item.source !== 'product') delete fields.compatibleTanks;
  return {
    id: item.id,
    type: item.type,
    rated_gph: zeroFlow ? 0 : item.gph,
    kind: item.type,
    source: item.source,
    ...fields,
    capacityMethod: math.effectiveCapacityMethod(item),
    ...(item.label && (zeroFlow || item.source === 'custom') ? { label: item.label } : {}),
  };
}
let customSeq = 0;
const product = (id) => productItem(id);
const powered = (type, gph) => ({ id: `manual-${type.toLowerCase()}-${gph}-${++customSeq}`, source: 'custom', label: `${type} ${gph} GPH`, type, gph, capacityMethod: 'flow' });
const customSponge = (gallons) => items.buildCustomSpongeItem({ id: `manual-sp-${++customSeq}`, ratedGallons: gallons });
// An old custom sponge that only ever had a GPH (v1): Rating needed, legacyGph kept for display.
const legacySponge = (gph) => items.restoreSpongeItem({ id: `manual-sponge-${gph}`, source: 'custom', type: 'SPONGE', rated_gph: gph }, null);

const STOCK = [['neon', 10], ['cory_bronze', 6]];
function computeFor(tankId, list, { stock = STOCK } = {}) {
  const state = compute.createDefaultState();
  const tank = getTankById(tankId);
  Object.assign(state, {
    tank: { ...tank },
    gallons: tank.gallons,
    selectedTankId: tank.id,
    stock: stock.map(([id, qty]) => ({ id, qty })),
    filters: math.normalizeFilters(instances.withUniqueInstanceIds(list).map(toApp)),
  });
  return compute.buildComputedState(state);
}
function card(tankId, list, options) {
  const computed = computeFor(tankId, list, options);
  return { computed, model: view.buildFiltrationCardModel(computed.filtering) };
}
const texts = (model) => model.rows.map((line) => line.text);
const pathRows = (model) => model.rows.filter((line) => line.kind === 'path').map((line) => line.text);
const supplementalRows = (model) => model.rows.filter((line) => line.kind === 'supplemental').map((line) => line.text);
const allText = (model) => view.cardText(model).join('\n');
const load = (computed) => JSON.stringify([computed.bioload.currentPercent, computed.bioload.proposedPercent, computed.bioload.text,
  computed.bioload.severity, computed.bioload.proposed, computed.bioload.effectiveCapacity]);

// Numerical claims the card may never make (design D6, sections 4.2, 12; phase G step 37).
// The permanent sentence ("… does not increase stocking capacity") is checked on its own.
function assertNoForbiddenClaims(model, label) {
  const text = view.cardText(model).filter((line) => line !== PERMANENT).join('\n');
  assert.doesNotMatch(text, /\b80\s*gal/i, `${label}: combined sponge gallons`);
  assert.doesNotMatch(text, /combined (capacity|gallons|rating)\b(?! isn't verified)/i, `${label}: combined figure`);
  assert.doesNotMatch(text, /double capacity|twice the filtration|extra (stocking )?capacity|capacity bonus|increases? (stocking )?capacity|more capacity/i, `${label}: capacity claim`);
  assert.doesNotMatch(text, /gallons? (covered|of capacity)|covers? \d+ gal/i, `${label}: GPH to gallons`);
  for (const line of model.rows) {
    if (line.path === 'sponge' && line.kind !== 'legacy') assert.doesNotMatch(line.text, /GPH|×|turnover/i, `${label}: sponge flow in "${line.text}"`);
    if (line.kind === 'legacy') assert.match(line.text, /^Old value: \d+ GPH — not used for sponge filters\.$/, `${label}: legacy line`);
    if (line.path === 'ugf') assert.doesNotMatch(line.text, /GPH|×|turnover|150|\b20–40\b|–/i, `${label}: UGF flow / range in "${line.text}"`);
    if (line.path === 'circulation') assert.doesNotMatch(line.text, /×/, `${label}: powerhead turnover`);
  }
}
function assertCommon(model, label) {
  assert.equal(model.note, PERMANENT, `${label}: permanent sentence`);
  assert.equal(view.cardText(model).at(-1), PERMANENT, `${label}: permanent sentence is the last line`);
  assert.ok(model.headline.text, `${label}: headline`);
  assert.ok(model.headline.icon, `${label}: icon`);
  assert.ok(model.headline.iconLabel, `${label}: status in words`);
  assertNoForbiddenClaims(model, label);
}

test('A: no filter with stock → amber "No filter added", no GPH claimed, permanent sentence', () => {
  const { computed, model } = card('29g', []);
  assert.equal(computed.filtering.level, 'none');
  assert.equal(model.headline.text, 'No filter added');
  assert.equal(model.tone, 'warn');
  assert.deepEqual(model.rows, []);
  assert.match(model.explanation.join(' '), /Add your filter/);
  assert.doesNotMatch(allText(model), /GPH|×/);
  assert.equal(model.showTurnover, false);
  assert.deepEqual(model.warningIds, ['filtration.none']);
  assertCommon(model, 'A');
});

test('B: powered adequate → green, one powered line with rated GPH and turnover', () => {
  const { computed, model } = card('29g', [powered('HOB', 150)]);
  assert.equal(computed.filtering.assessment.adequateBy, 'powered');
  assert.deepEqual(model.headline, { tone: 'good', icon: '✓', iconLabel: 'OK', text: 'Filtration appears adequate' });
  assert.deepEqual(texts(model), ['Powered filter: 150 GPH · 5.2× / hour (rated)']);
  assert.equal(model.redundancy, null);
  assert.equal(model.showTurnover, true);
  assertCommon(model, 'B');
});

test('C: powered very low → red "Filter flow too low", below the 2× minimum', () => {
  const { computed, model } = card('29g', [powered('HOB', 40)]);
  assert.equal(computed.filtering.level, 'very-low');
  assert.equal(model.tone, 'bad');
  assert.equal(model.headline.text, 'Filter flow too low');
  assert.equal(model.headline.icon, '✖');
  assert.deepEqual(texts(model), ['Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× minimum']);
  assert.deepEqual(model.warningIds, ['filtration.very_low']);
  assertCommon(model, 'C');
});

test('D: powerhead only → red "No biological filter", circulation only, no turnover', () => {
  const { computed, model } = card('29g', [powered('Powerhead', 300)]);
  assert.equal(computed.filtering.level, 'circulation-only');
  assert.equal(model.tone, 'bad');
  assert.equal(model.headline.text, 'No biological filter');
  assert.deepEqual(texts(model), ['Powerhead: 300 GPH circulation only']);
  assert.equal(model.showTurnover, false);
  assert.equal(model.redundancy, null);
  assert.doesNotMatch(allText(model), /×/);
  assertCommon(model, 'D');
});

test('E: single verified sponge rated for the tank → green "Rated for this tank", no GPH / turnover', () => {
  const { computed, model } = card('29g', [product(HYGGER_S)]);
  assert.equal(computed.filtering.assessment.adequateBy, 'sponge');
  assert.deepEqual(model.headline, { tone: 'good', icon: '✓', iconLabel: 'OK', text: 'Rated for this tank' });
  assert.deepEqual(texts(model), ['Sponge filter: rated 10–40 gal — rated for this tank', 'Tank: 29 gal']);
  assert.ok(model.explanation.includes('Sponge filters are sized by tank; water flow isn\'t estimated.'));
  assert.equal(model.showTurnover, false);
  assertCommon(model, 'E');
});

test('F: single verified sponge below rating → amber, rating and tank listed, never red', () => {
  const { computed, model } = card('55g', [product(HYGGER_S)]);
  assert.equal(computed.filtering.level, 'below-rating');
  assert.equal(model.tone, 'warn');
  assert.equal(model.headline.text, 'Below manufacturer rating');
  assert.deepEqual(texts(model), ['Sponge filter: rated 10–40 gal', 'Tank: 55 gal']);
  assert.deepEqual(model.explanation, ['Add another sponge or a filter rated for this tank.']);
  assertCommon(model, 'F');
});

test('G: two undersized verified sponges → amber likely-multi, one line per physical sponge, no 80 gal', () => {
  const { computed, model } = card('55g', [product(HYGGER_S), product(HYGGER_S)]);
  assert.equal(computed.filtering.level, 'likely-multi-sponge');
  assert.equal(model.tone, 'warn');
  assert.equal(model.headline.text, 'Likely adequate — multiple sponge filters');
  assert.deepEqual(texts(model), ['Sponge 1: rated 10–40 gal', 'Sponge 2: rated 10–40 gal', 'Tank: 55 gal']);
  // Same productId, two instances: two rows with distinct instance ids.
  const spongeRows = model.rows.filter((line) => line.path === 'sponge');
  assert.equal(new Set(spongeRows.map((line) => line.instanceId)).size, 2);
  assert.ok(model.explanation.includes('No single sponge is rated for this tank. Several sponges add media and backup, but their combined capacity isn\'t verified.'));
  assert.equal(model.redundancy, 'Redundancy: 2 biological filters provide backup during maintenance.');
  assert.doesNotMatch(allText(model), /80/);
  assertCommon(model, 'G');
});

test('H: unrated sponge → neutral "Not evaluated — rating needed"', () => {
  const { computed, model } = card('20l', [product(AQUANEAT_MIDDLE)]);
  assert.equal(computed.filtering.level, 'not-evaluated');
  assert.equal(model.tone, 'neutral');
  assert.equal(model.headline.text, 'Not evaluated — rating needed');
  assert.equal(model.headline.icon, '○');
  assert.deepEqual(texts(model), ['Sponge filter: Rating needed']);
  assert.match(model.explanation.join(' '), /not adequate, not unsafe/);
  // A catalog sponge: the custom-rating hint is not shown (the user can't enter a rating for it).
  assert.doesNotMatch(model.explanation.join(' '), /custom sponge/);
  assertCommon(model, 'H');
});

test('I: powered passes + undersized sponge → green, sponge supplemental and not flagged', () => {
  const { model } = card('29g', [powered('HOB', 150), customSponge(20)]);
  assert.equal(model.headline.text, 'Filtration appears adequate');
  assert.deepEqual(pathRows(model), ['Powered filter: 150 GPH · 5.2× / hour (rated)']);
  assert.deepEqual(supplementalRows(model), ['+ Additional sponge filter: rated up to 20 gal']);
  assert.doesNotMatch(allText(model), /below/i);
  assert.equal(model.redundancy, 'Redundancy: 2 biological filters provide backup during maintenance.');
  assertCommon(model, 'I');
});

test('J: powered and sponge both pass → one green headline, both path lines, no hybrid figure', () => {
  const { computed, model } = card('29g', [powered('HOB', 100), customSponge(40)]);
  assert.equal(computed.filtering.assessment.adequateBy, 'both');
  assert.equal(model.headline.text, 'Filtration appears adequate');
  assert.deepEqual(pathRows(model), ['Powered filter: 100 GPH · 3.4× / hour (rated)', 'Sponge filter: rated up to 40 gal — rated for this tank']);
  assert.deepEqual(supplementalRows(model), []);
  assert.doesNotMatch(allText(model), /140|combined/);
  assertCommon(model, 'J');
});

test('K: powered below the floor + sponge passes → green from the sponge, weak powered fact shown', () => {
  const { computed, model } = card('29g', [powered('HOB', 40), product(HYGGER_S)]);
  assert.equal(computed.filtering.assessment.adequateBy, 'sponge');
  assert.equal(model.tone, 'good');
  assert.equal(model.headline.text, 'Rated for this tank');
  assert.deepEqual(pathRows(model), ['Sponge filter: rated 10–40 gal — rated for this tank']);
  assert.deepEqual(supplementalRows(model), ['+ Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× powered-filter minimum']);
  assertCommon(model, 'K');
});

test('L: powered below + sponge below → amber "Review filtration", each path on its own', () => {
  const { computed, model } = card('29g', [powered('HOB', 40), customSponge(20)]);
  assert.equal(computed.filtering.level, 'review');
  assert.equal(model.tone, 'warn');
  assert.equal(model.headline.text, 'Review filtration');
  assert.deepEqual(texts(model), [
    'Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× minimum',
    'Sponge filter: rated up to 20 gal — below this 29 gal tank',
  ]);
  assert.equal(model.explanation[0], 'Neither filter is shown to be sized for this tank on its own. A filter rated for this tank is the safer choice.');
  assert.doesNotMatch(allText(model), /60|combined/);
  assertCommon(model, 'L');
});

test('M: powered below + unrated sponge → current engine result (Review), sponge "Rating needed", no green', () => {
  const { computed, model } = card('29g', [powered('HOB', 40), product(AQUANEAT_MIDDLE)]);
  assert.equal(computed.filtering.level, 'review');
  assert.equal(model.headline.text, 'Review filtration');
  assert.notEqual(model.tone, 'good');
  assert.deepEqual(texts(model), [
    'Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× minimum',
    'Sponge filter: Rating needed',
  ]);
  assertCommon(model, 'M');
});

test('N: compatible UGF (29g and 20l) → green, literal preset set, no GPH / turnover / range', () => {
  for (const tankId of ['29g', '20l']) {
    const { computed, model } = card(tankId, [product(UGF)]);
    assert.equal(computed.filtering.assessment.adequateBy, 'ugf', tankId);
    assert.deepEqual(model.headline, { tone: 'good', icon: '✓', iconLabel: 'OK', text: 'Undergravel filter rated for this tank' });
    assert.deepEqual(texts(model), ['Undergravel filter: rated for 20 Long and 29 Gallon — rated for this tank']);
    assert.ok(model.explanation.includes('Undergravel filters are checked by the tank sizes the manufacturer lists; water flow isn\'t estimated.'));
    assert.equal(model.showTurnover, false);
    assert.doesNotMatch(allText(model), /GPH|150|20–40|20 Long–29|×/);
    assertCommon(model, `N ${tankId}`);
  }
});

test('O: UGF on an unlisted preset (20h) → neutral "isn\'t listed", never unsafe / below rating / GPH', () => {
  const { computed, model } = card('20h', [product(UGF)]);
  assert.equal(computed.filtering.level, 'not-evaluated');
  assert.equal(model.tone, 'neutral');
  assert.equal(model.headline.text, 'Rating needed — this undergravel filter isn\'t listed for this tank size');
  assert.deepEqual(texts(model), ['Undergravel filter: rated for 20 Long and 29 Gallon', 'Current tank: 20 High']);
  assert.doesNotMatch(allText(model), /unsafe(?!\.)|below manufacturer rating|GPH/i);
  assert.match(model.explanation.join(' '), /not adequate, not unsafe/);
  assertCommon(model, 'O');
});

test('O2: UGF not listed + weak powered → current engine result (Review), UGF line says it isn\'t listed', () => {
  const { computed, model } = card('20h', [product(UGF), powered('HOB', 20)]);
  assert.equal(computed.filtering.level, 'review');
  assert.equal(model.headline.text, 'Review filtration');
  assert.deepEqual(texts(model), [
    'Powered filter: 20 GPH · 1.0× / hour (rated) — below the 2× minimum',
    'Undergravel filter: this tank size isn\'t listed (rated for 20 Long and 29 Gallon)',
  ]);
  assertCommon(model, 'O2');
});

test('P: compatible UGF + weak powered → green from the UGF, weak powered supplemental', () => {
  const { computed, model } = card('29g', [product(UGF), powered('HOB', 20)]);
  assert.deepEqual(computed.filtering.assessment.passingPaths, ['ugf']);
  assert.equal(model.headline.text, 'Undergravel filter rated for this tank');
  assert.deepEqual(pathRows(model), ['Undergravel filter: rated for 20 Long and 29 Gallon — rated for this tank']);
  assert.deepEqual(supplementalRows(model), ['+ Powered filter: 20 GPH · 0.7× / hour (rated) — below the 2× powered-filter minimum']);
  assertCommon(model, 'P');
});

test('P2: compatible UGF + adequate powered → green, both passing paths, GPH is the powered filter only', () => {
  const { computed, model } = card('29g', [product(UGF), product(TETRA)]);
  assert.deepEqual(computed.filtering.assessment.passingPaths, ['powered', 'ugf']);
  assert.equal(model.headline.text, 'Filtration appears adequate');
  assert.deepEqual(pathRows(model), ['Powered filter: 215 GPH · 7.4× / hour (rated)', 'Undergravel filter: rated for 20 Long and 29 Gallon — rated for this tank']);
  assertCommon(model, 'P2');
});

test('Q: UGF not listed + powered pass → green from powered, UGF neutral supplemental', () => {
  const { model } = card('20h', [product(UGF), product(TETRA)]);
  assert.equal(model.tone, 'good');
  assert.equal(model.headline.text, 'Filtration appears adequate');
  assert.deepEqual(pathRows(model), ['Powered filter: 215 GPH · 10.8× / hour (rated)']);
  assert.deepEqual(supplementalRows(model), ['+ Undergravel filter: this tank size isn\'t listed (rated for 20 Long and 29 Gallon)']);
  assertCommon(model, 'Q');
});

test('R: compatible UGF + verified sponge (both pass), and + unrated sponge (supplemental)', () => {
  const both = card('29g', [product(UGF), product(HYGGER_S)]).model;
  assert.equal(both.tone, 'good');
  assert.deepEqual(pathRows(both), ['Sponge filter: rated 10–40 gal — rated for this tank', 'Undergravel filter: rated for 20 Long and 29 Gallon — rated for this tank']);
  assertCommon(both, 'R both');
  const unrated = card('29g', [product(UGF), product(AQUANEAT_MIDDLE)]).model;
  assert.equal(unrated.tone, 'good');
  assert.equal(unrated.headline.text, 'Undergravel filter rated for this tank');
  assert.deepEqual(pathRows(unrated), ['Undergravel filter: rated for 20 Long and 29 Gallon — rated for this tank']);
  assert.deepEqual(supplementalRows(unrated), ['+ Additional sponge filter: Rating needed']);
  assertCommon(unrated, 'R unrated');
});

test('S: UGF + powerhead → green from the UGF, powerhead circulation line, no turnover', () => {
  const { model } = card('29g', [product(UGF), powered('Powerhead', 300)]);
  assert.equal(model.headline.text, 'Undergravel filter rated for this tank');
  assert.deepEqual(pathRows(model), ['Undergravel filter: rated for 20 Long and 29 Gallon — rated for this tank']);
  assert.deepEqual(supplementalRows(model), ['+ Powerhead: 300 GPH circulation only']);
  assert.equal(model.showTurnover, false);
  assert.equal(model.redundancy, null, 'a powerhead is not a biological filter');
  assertCommon(model, 'S');
});

test('S2: powerhead with a biological filter is supplemental and not added to the powered GPH', () => {
  const { model } = card('29g', [powered('HOB', 150), powered('Powerhead', 300)]);
  assert.deepEqual(texts(model), ['Powered filter: 150 GPH · 5.2× / hour (rated)', '+ Powerhead: 300 GPH circulation only']);
  assert.doesNotMatch(allText(model), /450|15\.5/);
  assertCommon(model, 'S2');
});

test('T: redundancy counts every biological instance (duplicates included), qualitatively only', () => {
  const three = card('29g', [product(HYGGER_S), product(HYGGER_S), powered('HOB', 150)]).model;
  assert.equal(three.redundancy, 'Redundancy: 3 biological filters provide backup during maintenance.');
  assert.doesNotMatch(three.redundancy, /capacity|double|twice|gal/i);
  const twoPowered = card('55g', [powered('Canister', 200), powered('HOB', 150)]).model;
  assert.deepEqual(pathRows(twoPowered), ['Powered filters (2): 350 GPH total · 6.4× / hour (rated)']);
  assert.equal(twoPowered.redundancy, 'Redundancy: 2 biological filters provide backup during maintenance.');
  assertCommon(three, 'T three');
  assertCommon(twoPowered, 'T two powered');
});

test('U: powerheads never count toward biological redundancy', () => {
  const model = card('29g', [powered('HOB', 150), powered('Powerhead', 300), powered('Powerhead', 200)]).model;
  assert.equal(model.redundancy, null);
  const circulationOnly = card('29g', [powered('Powerhead', 300), powered('Powerhead', 200)]).model;
  assert.equal(circulationOnly.redundancy, null);
  assert.deepEqual(texts(circulationOnly), ['Powerhead: 300 GPH circulation only', 'Powerhead: 200 GPH circulation only']);
});

test('V: legacy custom sponge with legacyGph → "Old value" line, never scored or shown as turnover', () => {
  const legacy = legacySponge(120);
  assert.equal(legacy.legacyGph, 120, 'fixture carries legacyGph');
  const { computed, model } = card('29g', [legacy]);
  assert.equal(computed.filtering.level, 'not-evaluated');
  assert.equal(computed.filtering.biologicalGph, 0);
  assert.deepEqual(texts(model), ['Sponge filter: Rating needed', 'Old value: 120 GPH — not used for sponge filters.']);
  assert.match(model.explanation.join(' '), /For a custom sponge, enter the tank size/);
  assert.equal(model.showTurnover, false);
  assertCommon(model, 'V');
  // Without legacyGph there is no "Old value" line.
  assert.doesNotMatch(allText(card('29g', [customSponge(20)]).model), /Old value/);
  // Beside a passing powered filter the old value stays next to its (supplemental) sponge line.
  const mixed = card('29g', [powered('HOB', 150), legacySponge(120)]).model;
  assert.deepEqual(texts(mixed), ['Powered filter: 150 GPH · 5.2× / hour (rated)', '+ Additional sponge filter: Rating needed', 'Old value: 120 GPH — not used for sponge filters.']);
});

test('W: filters but no stock → neutral "checked once species are added", devices listed without a verdict', () => {
  const { computed, model } = card('55g', [powered('HOB', 150), product(HYGGER_S), powered('Powerhead', 300)], { stock: [] });
  assert.deepEqual(computed.filtering.warnings, []);
  assert.equal(model.state, 'no-stock');
  assert.equal(model.tone, 'neutral');
  assert.equal(model.headline.text, 'Filtration is checked once species are added');
  assert.deepEqual(texts(model), ['Powered filter: 150 GPH · 2.7× / hour (rated)', 'Sponge filter: rated 10–40 gal', 'Powerhead: 300 GPH circulation only']);
  assert.ok(model.rows.every((line) => line.kind === 'device'));
  assert.doesNotMatch(allText(model), /adequate|below|rated for this tank|minimum/i);
  assert.equal(model.evaluated, false);
  assertCommon(model, 'W');
  // A UGF without stock: its listed presets, no verdict.
  const ugf = card('29g', [product(UGF)], { stock: [] }).model;
  assert.deepEqual(texts(ugf), ['Undergravel filter: rated for 20 Long and 29 Gallon']);
  assert.equal(ugf.tone, 'neutral');
  // Nothing entered and no stock: a neutral prompt, not "No filter added".
  const empty = card('29g', [], { stock: [] }).model;
  assert.equal(empty.state, 'empty');
  assert.equal(empty.tone, 'neutral');
  assertCommon(empty, 'W empty');
});

test('X: no tank → neutral "Select a tank", permanent sentence still present', () => {
  const model = view.buildFiltrationCardModel(null);
  assert.equal(model.state, 'no-tank');
  assert.equal(model.tone, 'neutral');
  assert.equal(model.headline.text, 'Select a tank to check filtration');
  assertCommon(model, 'X');
});

test('the headline, tone and level are the engine\'s own (no second scoring model)', () => {
  const setups = [
    ['29g', []], ['29g', [powered('HOB', 150)]], ['29g', [powered('HOB', 40)]], ['29g', [powered('Powerhead', 300)]],
    ['29g', [product(HYGGER_S)]], ['55g', [product(HYGGER_S)]], ['55g', [product(HYGGER_S), product(HYGGER_S)]],
    ['29g', [product(AQUANEAT_MIDDLE)]], ['29g', [powered('HOB', 40), customSponge(20)]], ['29g', [product(UGF)]],
    ['20h', [product(UGF)]], ['20h', [product(UGF), powered('HOB', 20)]], ['29g', [product(UGF), powered('HOB', 20)]],
  ];
  for (const [tankId, list] of setups) {
    const { computed, model } = card(tankId, list);
    const assessment = computed.filtering.assessment;
    assert.equal(model.level, assessment.level, `${tankId} level`);
    assert.equal(model.headline.text, assessment.status.text, `${tankId} headline`);
    assert.equal(model.tone, assessment.status.tone, `${tankId} tone`);
    assert.equal(model.adequateBy, assessment.adequateBy, `${tankId} adequateBy`);
    assert.deepEqual(model.passingPaths, assessment.passingPaths, `${tankId} passingPaths`);
    assert.deepEqual(model.warningIds, computed.filtering.warnings.map((warning) => warning.id), `${tankId} warning ids`);
    // Building the card leaves the engine result untouched.
    const snapshot = JSON.stringify(computed.filtering);
    view.buildFiltrationCardModel(computed.filtering);
    assert.equal(JSON.stringify(computed.filtering), snapshot, `${tankId} not mutated`);
    assertCommon(model, `engine ${tankId}`);
  }
});

test('Stocking Load is identical with and without every card scenario\'s filters', () => {
  const setups = [
    [], [powered('HOB', 150)], [product(HYGGER_S)], [product(HYGGER_S), product(HYGGER_S)], [product(UGF)],
    [powered('HOB', 150), product(HYGGER_S)], [product(UGF), product(TETRA)], [powered('Powerhead', 300)],
  ];
  for (const tankId of ['20h', '20l', '29g', '55g']) {
    const baseline = load(computeFor(tankId, []));
    for (const list of setups) {
      const { computed } = card(tankId, list);
      assert.equal(load(computed), baseline, `${tankId} ${list.map((item) => item.id).join('+')}`);
      assert.equal(computed.filtering.assessment.capacityAdjustment, 0);
    }
  }
});

test('the redundancy line and the permanent sentence never claim capacity', () => {
  for (let count = 2; count <= 4; count += 1) {
    const list = Array.from({ length: count }, () => product(HYGGER_S));
    const { model } = card('75g', list);
    assert.equal(model.redundancy, `Redundancy: ${count} biological filters provide backup during maintenance.`);
    assert.doesNotMatch(allText(model), /\b(80|120|160) ?gal/);
  }
  assert.doesNotMatch(PERMANENT, /bonus/);
});
