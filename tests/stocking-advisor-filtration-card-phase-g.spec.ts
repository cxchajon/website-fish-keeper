// Sponge migration phase G on the real page (desktop and mobile): the dedicated filtration status
// card in the filter setup area. It renders computed.filtering (never a second scoring model), lists
// each independent path, marks everything not needed for the verdict as supplemental, never combines
// units, and always carries the permanent Stocking Load sentence. Part of the Stocking Advisor gate
// (`npm run test:e2e:stocking-gate`).
// Report: _internal/reports/stocking-advisor-sponge-migration-phase-g-2026-09.md
import { test, expect, type Page } from '@playwright/test';

const V2 = 'ttg.stocking.filters.v2';
const HYGGER_S = 'hygger-double-sponge-s';
const AQUANEAT_MIDDLE = 'aquaneat-sponge-20';
const UGF = 'penn-plax-ugf-20-29';
const PERMANENT = 'Filtration supports your livestock but does not increase stocking capacity.';
// Claims the card may never make (design D6; phase G step 37). The permanent sentence is excluded.
const FORBIDDEN = /\b80\s*gal|combined (gallons|rating)|double capacity|twice the filtration|extra (stocking )?capacity|capacity bonus/i;

type Entry = Record<string, unknown>;
const custom = (n: number, type: string, gph: number): Entry => ({ instanceId: `f-c${n}`, source: 'custom', id: `c${n}`, type, capacityMethod: 'flow', gph });
const product = (n: number, productId: string, type: string, capacityMethod: string): Entry => ({ instanceId: `f-p${n}`, source: 'product', productId, type, capacityMethod });
const hyggerS = (n: number) => product(n, HYGGER_S, 'SPONGE', 'manufacturer_rating');
const unratedSponge = (n: number) => product(n, AQUANEAT_MIDDLE, 'SPONGE', 'manufacturer_rating');
const ugf = () => product(9, UGF, 'UGF', 'tank_compatibility');
const customSponge = (n: number, gallons: number): Entry => ({ instanceId: `f-s${n}`, source: 'custom', id: `manual-sp${n}`, type: 'SPONGE',
  capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: gallons, ratingStatus: 'verified' });

async function openAdvisor(page: Page, filters: Entry[] = []) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' ? route.fallback() : route.abort();
  });
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.clear();
    localStorage.setItem(seed.key, JSON.stringify({ v: 2, filters: seed.filters }));
  }, { key: V2, filters });
  await page.goto('/stocking-advisor.html');
  await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
}

const settle = (page: Page) => page.waitForTimeout(1200);
const card = (page: Page) => page.locator('[data-role="filtration-status-card"]');
const chips = (page: Page) => page.locator('[data-role="proto-filter-chips"] .proto-filter-chip');

async function addSpecies(page: Page, id: string, qty: number) {
  const row = page.locator(`[data-testid="species-row"][data-row-id="${id}"]`);
  await expect(async () => {
    if (await row.count()) return;
    await page.selectOption('#plan-species', id, { timeout: 2000 });
    await page.fill('#plan-qty', String(qty), { timeout: 2000 });
    await page.click('#plan-add', { timeout: 2000 });
    await expect(row).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
}

async function setUp(page: Page, tankId: string, filters: Entry[] = []) {
  await openAdvisor(page, filters);
  await page.selectOption('#tank-size', tankId);
  await addSpecies(page, 'neon', 8);
  await settle(page);
}

async function addCustomFilter(page: Page, type: string, value: number) {
  await page.selectOption('#fs-type', type);
  await page.fill(type === 'Sponge' ? '#fs-rated-gallons' : '#fs-gph', String(value));
  await page.click('#fs-add-custom');
  await settle(page);
}

// The card as rendered, and the engine result it must agree with.
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('[data-role="filtration-status-card"]');
    const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: Record<string, unknown> }).appState;
    const computed = compute.buildComputedState(appState);
    const withoutFilters = compute.buildComputedState({ ...appState, filters: [] });
    const load = (c: { bioload: Record<string, unknown> }) => [c.bioload.currentPercent, c.bioload.proposedPercent, c.bioload.text, c.bioload.severity];
    return {
      hidden: root?.hidden ?? null,
      state: root?.dataset.state ?? null,
      level: root?.dataset.level ?? null,
      warningIds: (root?.dataset.warningIds ?? '').split(' ').filter(Boolean),
      heading: clean(root?.querySelector('h3')?.textContent),
      headline: clean(root?.querySelector('[data-role="filtration-status-headline-text"]')?.textContent),
      headlineFull: clean(root?.querySelector('[data-role="filtration-status-headline"]')?.textContent),
      rows: Array.from(root?.querySelectorAll<HTMLElement>('[data-role="filtration-status-paths"] li') ?? []).map((li) => ({
        kind: li.dataset.rowKind, path: li.dataset.path, text: clean(li.textContent), instanceId: li.dataset.instanceId ?? null,
      })),
      explanation: clean(root?.querySelector('[data-role="filtration-status-explanation"]')?.textContent),
      redundancy: clean(root?.querySelector('[data-role="filtration-status-redundancy"]')?.textContent) || null,
      note: clean(root?.querySelector('[data-role="filtration-status-note"]')?.textContent),
      text: clean(root?.textContent),
      summary: clean(document.querySelector('[data-role="proto-filter-summary"]')?.textContent),
      stockFiltrationStrips: document.querySelectorAll('#stock-warnings [data-warning-id^="filtration."]').length,
      engine: {
        level: computed.filtering.level,
        tone: computed.filtering.assessment.status.tone,
        text: computed.filtering.assessment.status.text,
        warningIds: (computed.filtering.warnings as Array<{ id: string }>).map((warning) => warning.id),
        statusWarningIds: (computed.status.warnings as Array<{ id: string }>).map((warning) => warning.id).filter((id) => id.startsWith('filtration.')),
      },
      load: load(computed),
      loadWithoutFilters: load(withoutFilters),
      loadText: clean(document.querySelector('[data-role="bioload-percent"]')?.textContent),
    };
  });
}

type Snapshot = Awaited<ReturnType<typeof snapshot>>;
const lines = (state: Snapshot, kind?: string) => state.rows.filter((row) => !kind || row.kind === kind).map((row) => row.text);

// Shared checks for every evaluated card.
function expectCard(state: Snapshot, { tone, headline }: { tone: string; headline: string }) {
  expect(state.hidden).toBe(false);
  expect(state.heading).toBe('Filtration');
  expect(state.state).toBe(tone);
  expect(state.headline).toBe(headline);
  expect(state.note).toBe(PERMANENT);
  // The card renders the engine result: same level, tone, headline and warning ids.
  expect(state.level).toBe(state.engine.level);
  expect(state.state).toBe(state.engine.tone);
  expect(state.headline).toBe(state.engine.text);
  expect(state.warningIds).toEqual(state.engine.warningIds);
  // The warning model is kept in computed state, but not repeated as #stock-warnings strips.
  expect(state.engine.statusWarningIds).toEqual(state.engine.warningIds);
  expect(state.stockFiltrationStrips).toBe(0);
  expect(state.text.replace(PERMANENT, '')).not.toMatch(FORBIDDEN);
  // Filtration never changes Stocking Load.
  expect(state.load).toEqual(state.loadWithoutFilters);
}

test.describe('phase G: filtration status card — locked common cases (design 4.5)', () => {
  test('A: 29g + 150 GPH HOB → green, powered line with rated turnover', async ({ page }) => {
    await setUp(page, '29g', [custom(1, 'HOB', 150)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'good', headline: 'Filtration appears adequate' });
    expect(lines(state)).toEqual(['Powered filter: 150 GPH · 5.2× / hour (rated)']);
    expect(state.headlineFull).toContain('OK:');
    expect(state.summary).toBe('Filtration: 150 GPH • 5.2×/h');
  });

  test('B: 29g + passing HOB + undersized sponge → green, sponge supplemental and not flagged', async ({ page }) => {
    await setUp(page, '29g', [custom(1, 'HOB', 150), customSponge(1, 20)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'good', headline: 'Filtration appears adequate' });
    expect(lines(state, 'path')).toEqual(['Powered filter: 150 GPH · 5.2× / hour (rated)']);
    expect(lines(state, 'supplemental')).toEqual(['+ Additional sponge filter: rated up to 20 gal']);
    expect(state.text).not.toMatch(/below/i);
    expect(state.redundancy).toBe('Redundancy: 2 biological filters provide backup during maintenance.');
  });

  test('D: 55g + 200 GPH canister + 40-gal sponge → green, sponge supplemental', async ({ page }) => {
    await setUp(page, '55g', [custom(2, 'Canister', 200), customSponge(2, 40)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'good', headline: 'Filtration appears adequate' });
    expect(lines(state, 'path')).toEqual(['Powered filter: 200 GPH · 3.6× / hour (rated)']);
    expect(lines(state, 'supplemental')).toEqual(['+ Additional sponge filter: rated up to 40 gal']);
  });

  test('C: 29g + 100 GPH HOB + 40-gal sponge → one green headline, both path lines, no hybrid figure', async ({ page }) => {
    await setUp(page, '29g', [custom(1, 'HOB', 100), customSponge(1, 40)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'good', headline: 'Filtration appears adequate' });
    expect(lines(state, 'path')).toEqual(['Powered filter: 100 GPH · 3.4× / hour (rated)', 'Sponge filter: rated up to 40 gal — rated for this tank']);
    expect(state.text).not.toMatch(/140|combined/);
  });

  test('E: 55g + one Hygger Small → amber "Below manufacturer rating"', async ({ page }) => {
    await setUp(page, '55g', [hyggerS(1)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'warn', headline: 'Below manufacturer rating' });
    expect(lines(state)).toEqual(['Sponge filter: rated 10–40 gal', 'Tank: 55 gal']);
    expect(state.explanation).toBe('Add another sponge or a filter rated for this tank.');
    expect(state.warningIds).toEqual(['filtration.below_rating']);
    expect(state.text).not.toMatch(/GPH|×/);
  });

  test('F: 55g + two Hygger Small → amber likely-multi, two separate rating lines, no 80-gallon figure', async ({ page }) => {
    await setUp(page, '55g', [hyggerS(1), hyggerS(2)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'warn', headline: 'Likely adequate — multiple sponge filters' });
    expect(lines(state)).toEqual(['Sponge 1: rated 10–40 gal', 'Sponge 2: rated 10–40 gal', 'Tank: 55 gal']);
    expect(state.rows.filter((row) => row.path === 'sponge').map((row) => row.instanceId)).toEqual(['f-p1', 'f-p2']);
    expect(state.explanation).toContain('No single sponge is rated for this tank. Several sponges add media and backup, but their combined capacity isn\'t verified.');
    expect(state.redundancy).toBe('Redundancy: 2 biological filters provide backup during maintenance.');
    expect(state.text).not.toMatch(/\b80\b|GPH|×/);
  });

  test('G: 29g + Hygger Small → green "Rated for this tank", no GPH or turnover anywhere in the filter area', async ({ page }) => {
    await setUp(page, '29g', [hyggerS(1)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'good', headline: 'Rated for this tank' });
    expect(lines(state)).toEqual(['Sponge filter: rated 10–40 gal — rated for this tank', 'Tank: 29 gal']);
    expect(state.explanation).toContain('Sponge filters are sized by tank; water flow isn\'t estimated.');
    expect(state.summary).toBe('Filtration: 1 sponge filter (rated by tank size)');
    expect(`${state.text} ${state.summary}`).not.toMatch(/GPH|×/);
  });

  test('H: 29g + weak powered + undersized sponge → amber "Review filtration", each path on its own', async ({ page }) => {
    await setUp(page, '29g', [custom(1, 'HOB', 40), customSponge(1, 20)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'warn', headline: 'Review filtration' });
    expect(lines(state)).toEqual([
      'Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× minimum',
      'Sponge filter: rated up to 20 gal — below this 29 gal tank',
    ]);
    expect(state.explanation).toContain('Neither filter is shown to be sized for this tank on its own. A filter rated for this tank is the safer choice.');
  });

  test('U: unrated sponge → neutral "Not evaluated — rating needed"', async ({ page }) => {
    await setUp(page, '29g', [unratedSponge(1)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'neutral', headline: 'Not evaluated — rating needed' });
    expect(lines(state)).toEqual(['Sponge filter: Rating needed']);
    expect(state.explanation).toMatch(/not adequate, not unsafe/);
  });

  test('powered below the floor + passing sponge → green, weak powered fact shown as supplemental', async ({ page }) => {
    await setUp(page, '29g', [custom(1, 'HOB', 40), hyggerS(1)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'good', headline: 'Rated for this tank' });
    expect(lines(state, 'supplemental')).toEqual(['+ Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× powered-filter minimum']);
  });
});

test.describe('phase G: filtration status card — undergravel filter', () => {
  for (const tankId of ['29g', '20l']) {
    test(`${tankId} + Penn-Plax UGF → green, explicit preset set, no GPH / turnover / range`, async ({ page }) => {
      await setUp(page, tankId, [ugf()]);
      const state = await snapshot(page);
      expectCard(state, { tone: 'good', headline: 'Undergravel filter rated for this tank' });
      expect(lines(state)).toEqual(['Undergravel filter: rated for 20 Long and 29 Gallon — rated for this tank']);
      expect(`${state.text} ${state.summary}`).not.toMatch(/GPH|150|20–40|20 Long–29|×/);
    });
  }

  test('20h + saved Penn-Plax UGF → neutral "not listed", no GPH, never unsafe or below rating', async ({ page }) => {
    await setUp(page, '20h', [ugf()]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'neutral', headline: 'Rating needed — this undergravel filter isn\'t listed for this tank size' });
    expect(lines(state)).toEqual(['Undergravel filter: rated for 20 Long and 29 Gallon', 'Current tank: 20 High']);
    expect(state.text).not.toMatch(/GPH|below manufacturer rating/i);
    expect(state.text.replace(/not unsafe/g, '')).not.toMatch(/unsafe/i);
  });

  test('UGF + powerhead → green from the UGF, powerhead circulation line; UGF + weak powered → green, weak line supplemental', async ({ page }) => {
    await setUp(page, '29g', [ugf(), custom(1, 'Powerhead', 300)]);
    let state = await snapshot(page);
    expectCard(state, { tone: 'good', headline: 'Undergravel filter rated for this tank' });
    expect(lines(state, 'supplemental')).toEqual(['+ Powerhead: 300 GPH circulation only']);
    expect(state.redundancy).toBeNull();
    await page.click('[data-role="proto-filter-chips"] .proto-filter-chip[data-instance-id="f-c1"] [data-remove-filter]');
    await addCustomFilter(page, 'HOB', 20);
    state = await snapshot(page);
    expectCard(state, { tone: 'good', headline: 'Undergravel filter rated for this tank' });
    expect(lines(state, 'path')).toEqual(['Undergravel filter: rated for 20 Long and 29 Gallon — rated for this tank']);
    expect(lines(state, 'supplemental')).toEqual(['+ Powered filter: 20 GPH · 0.7× / hour (rated) — below the 2× powered-filter minimum']);
  });

  test('UGF not listed + passing powered → green from powered, UGF neutral supplemental line', async ({ page }) => {
    await setUp(page, '20h', [ugf(), custom(1, 'HOB', 150)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'good', headline: 'Filtration appears adequate' });
    expect(lines(state, 'supplemental')).toEqual(['+ Undergravel filter: this tank size isn\'t listed (rated for 20 Long and 29 Gallon)']);
  });
});

test.describe('phase G: filtration status card — red and empty states', () => {
  test('powered-only below the floor → red "Filter flow too low", severity in words', async ({ page }) => {
    await setUp(page, '29g', [custom(1, 'HOB', 40)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'bad', headline: 'Filter flow too low' });
    expect(state.headlineFull).toContain('Problem:');
    expect(lines(state)).toEqual(['Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× minimum']);
  });

  test('powerhead only → red "No biological filter", no turnover shown', async ({ page }) => {
    await setUp(page, '29g', [custom(1, 'Powerhead', 300)]);
    const state = await snapshot(page);
    expectCard(state, { tone: 'bad', headline: 'No biological filter' });
    expect(lines(state)).toEqual(['Powerhead: 300 GPH circulation only']);
    expect(state.summary).toBe('Filtration: no biological filter (+300 GPH circulation only)');
    expect(`${state.text} ${state.summary}`).not.toMatch(/×/);
  });

  test('no filter with stock → amber "No filter added", no 0 GPH claim; no stock → neutral, no verdict', async ({ page }) => {
    await setUp(page, '29g', []);
    let state = await snapshot(page);
    expectCard(state, { tone: 'warn', headline: 'No filter added' });
    expect(state.rows).toEqual([]);
    expect(state.summary).toBe('Filtration: no filter added');
    expect(`${state.text} ${state.summary}`).not.toMatch(/GPH|×/);
    // Remove the stock: filters entered, nothing to judge yet.
    await addCustomFilter(page, 'HOB', 150);
    await page.click('[data-remove-id="neon"]');
    await settle(page);
    state = await snapshot(page);
    expect(state.state).toBe('neutral');
    expect(state.headline).toBe('Filtration is checked once species are added');
    expect(lines(state)).toEqual(['Powered filter: 150 GPH · 5.2× / hour (rated)']);
    expect(state.text).not.toMatch(/adequate|minimum/i);
    expect(state.note).toBe(PERMANENT);
  });
});

test.describe('phase G: filtration status card — reactivity, instances, layout', () => {
  test('updates immediately on add / duplicate / remove / tank / stock changes and sponge rating repair (no reload)', async ({ page }) => {
    await setUp(page, '55g', []);
    await expect(card(page)).toHaveAttribute('data-level', 'none');
    // Add one sponge (below rating), then a second (likely-multi), then remove one.
    await addCustomFilter(page, 'Sponge', 40);
    await expect(card(page)).toHaveAttribute('data-level', 'below-rating');
    await addCustomFilter(page, 'Sponge', 40);
    await expect(card(page)).toHaveAttribute('data-level', 'likely-multi-sponge');
    await expect(card(page).locator('[data-role="filtration-status-paths"] li[data-path="sponge"]')).toHaveCount(2);
    await chips(page).first().locator('[data-remove-filter]').click();
    await expect(card(page)).toHaveAttribute('data-level', 'below-rating');
    // Tank change: 55 → 29 makes the 40-gal sponge rated for the tank.
    await page.selectOption('#tank-size', '29g');
    await expect(card(page)).toHaveAttribute('data-level', 'adequate');
    await expect(card(page).locator('[data-role="filtration-status-headline"]')).toContainText('Rated for this tank');
    // Powered flow change through custom filters: add a weak HOB (still green from the sponge).
    await addCustomFilter(page, 'HOB', 20);
    await expect(card(page).locator('[data-row-kind="supplemental"][data-path="powered"]')).toContainText('below the 2× powered-filter minimum');
    // Stock added / removed.
    await addSpecies(page, 'cory_bronze', 4);
    await expect(card(page)).toHaveAttribute('data-level', 'adequate');
    await page.click('[data-remove-id="neon"]');
    await page.click('[data-remove-id="cory_bronze"]');
    await expect(card(page)).toHaveAttribute('data-card-state', 'no-stock');
    await addSpecies(page, 'neon', 8);
    await expect(card(page)).toHaveAttribute('data-level', 'adequate');
    const state = await snapshot(page);
    expect(state.load).toEqual(state.loadWithoutFilters);
  });

  test('old custom sponge: "Rating needed" with its old value, then Add rating repairs it in place', async ({ page }) => {
    await setUp(page, '29g', [{ instanceId: 'f-old1', source: 'custom', id: 'manual-old1', type: 'SPONGE', capacityMethod: 'manufacturer_rating', ratingStatus: 'needed', legacyGph: 120 }]);
    let state = await snapshot(page);
    expectCard(state, { tone: 'neutral', headline: 'Not evaluated — rating needed' });
    expect(lines(state)).toEqual(['Sponge filter: Rating needed', 'Old value: 120 GPH — not used for sponge filters.']);
    expect(state.explanation).toMatch(/For a custom sponge, enter the tank size/);
    await chips(page).first().locator('[data-rate-filter]').click();
    await page.fill('#fs-rated-gallons', '30');
    await page.click('#fs-add-custom');
    await settle(page);
    state = await snapshot(page);
    expectCard(state, { tone: 'good', headline: 'Rated for this tank' });
    expect(lines(state)).toEqual(['Sponge filter: rated up to 30 gal — rated for this tank', 'Tank: 29 gal']);
    expect(state.text).not.toMatch(/Old value|120/);
  });

  test('UGF: compatible → not listed → compatible again as the tank changes (same instance)', async ({ page }) => {
    await setUp(page, '29g', [ugf()]);
    await expect(card(page)).toHaveAttribute('data-state', 'good');
    await page.selectOption('#tank-size', '20h');
    await expect(card(page)).toHaveAttribute('data-state', 'neutral');
    await expect(card(page).locator('[data-role="filtration-status-headline"]')).toContainText('isn\'t listed for this tank size');
    await page.selectOption('#tank-size', '20l');
    await expect(card(page)).toHaveAttribute('data-state', 'good');
    await expect(card(page).locator('li[data-path="ugf"]')).toHaveAttribute('data-instance-id', 'f-p9');
  });

  test('non-filtration warnings stay in #stock-warnings; filtration warnings are not duplicated there', async ({ page }) => {
    await setUp(page, '20h', [custom(1, 'Canister', 1)]);
    await addSpecies(page, 'freshwater_angelfish', 6);
    await settle(page);
    await expect(page.locator('#stock-warnings .status-strip[data-warning-id="tank.volume.freshwater_angelfish"]')).toHaveAttribute('data-state', 'bad');
    await expect(page.locator('#stock-warnings [data-warning-id^="filtration."]')).toHaveCount(0);
    await expect(card(page)).toHaveAttribute('data-state', 'bad');
    await expect(card(page)).toHaveAttribute('data-warning-ids', 'filtration.very_low');
  });

  test('accessibility and layout: heading, polite status, text meaning, no overflow, readable note', async ({ page }) => {
    await setUp(page, '55g', [hyggerS(1), hyggerS(2), custom(1, 'Powerhead', 300)]);
    const root = card(page);
    await root.scrollIntoViewIfNeeded();
    await expect(root).toBeVisible();
    await expect(root.getByRole('heading', { name: 'Filtration' })).toBeVisible();
    await expect(root).toHaveAttribute('aria-labelledby', 'filtration-status-title');
    const headline = root.locator('[data-role="filtration-status-headline"]');
    await expect(headline).toHaveAttribute('role', 'status');
    await expect(headline).toContainText('Warning:');
    // Only the headline is a live region inside the card (no announcement storm), and the card is not
    // inside another live region.
    expect(await root.locator('[aria-live], [role="status"], [role="alert"]').count()).toBe(1);
    expect(await root.evaluate((el) => Boolean(el.parentElement?.closest('[aria-live]')))).toBe(false);
    await expect(root.locator('[data-role="filtration-status-note"]')).toBeVisible();
    await expect(root.locator('[data-role="filtration-status-redundancy"]')).toBeVisible();
    const metrics = await root.evaluate((el) => {
      const note = el.querySelector('[data-role="filtration-status-note"]') as HTMLElement;
      const rows = Array.from(el.querySelectorAll('li')) as HTMLElement[];
      return {
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
        cardClipped: el.scrollWidth > el.clientWidth + 1,
        rowsClipped: rows.some((row) => row.scrollWidth > row.clientWidth + 1),
        noteFont: parseFloat(getComputedStyle(note).fontSize),
        rowFont: parseFloat(getComputedStyle(rows[0]).fontSize),
        cardRight: el.getBoundingClientRect().right,
        viewport: window.innerWidth,
      };
    });
    expect(metrics.pageOverflow).toBe(false);
    expect(metrics.cardClipped).toBe(false);
    expect(metrics.rowsClipped).toBe(false);
    expect(metrics.noteFont).toBeGreaterThanOrEqual(14);
    expect(metrics.rowFont).toBeGreaterThanOrEqual(14);
    expect(metrics.cardRight).toBeLessThanOrEqual(metrics.viewport);
    // Chip remove buttons stay usable beside the card.
    await chips(page).last().locator('[data-remove-filter]').click();
    await expect(card(page).locator('li[data-path="circulation"]')).toHaveCount(0);
  });

  test('a recompute with an unchanged result does not rebuild (re-announce) the card', async ({ page }) => {
    await setUp(page, '29g', [custom(1, 'HOB', 150)]);
    await page.evaluate(() => {
      const node = document.querySelector('[data-role="filtration-status-headline"]');
      (node as HTMLElement & { __marker?: boolean }).__marker = true;
    });
    await page.evaluate(() => (window as unknown as { recomputeAll: () => void }).recomputeAll());
    await settle(page);
    expect(await page.evaluate(() => Boolean((document.querySelector('[data-role="filtration-status-headline"]') as HTMLElement & { __marker?: boolean })?.__marker))).toBe(true);
  });
});
