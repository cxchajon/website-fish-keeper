// Production gate for the Stocking Advisor species pipeline (run with
// `npm run test:e2e:stocking-gate`). Uses the page's current selectors; independent of the main suite.
import { test, expect, type Locator, type Page } from '@playwright/test';

const SPECIES_JSON = /\/data\/stocking-advisor\/species\.v2\.json$/;

async function openAdvisor(page: Page) {
  // Keep the test hermetic: only the local static server is reachable.
  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    return hostname === '127.0.0.1' || hostname === 'localhost' ? route.fallback() : route.abort();
  });
  await page.goto('/stocking-advisor.html');
}

async function waitForSpecies(page: Page) {
  await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
}

async function selectTank(page: Page, tankId: string) {
  await page.selectOption('#tank-size', tankId);
}

async function addSpecies(page: Page, id: string, qty: number) {
  await page.selectOption('#plan-species', id);
  await page.fill('#plan-qty', String(qty));
  await page.click('#plan-add');
  await expect(page.locator(`[data-testid="species-row"][data-row-id="${id}"]`)).toBeVisible();
}

const warning = (page: Page, id: string) => page.locator(`#stock-warnings .status-strip[data-warning-id="${id}"]`);
// A pair warning names both species in its id; their order follows species ordering (it changed when
// "Freshwater Angelfish" was renamed "Angelfish"), so match the rule and both species, not the order.
const pairWarning = (page: Page, rule: string, a: string, b: string) => page.locator(
  `#stock-warnings .status-strip[data-warning-id^="aggr:"][data-warning-id$=":${rule}"]`
  + `[data-warning-id*=":${a}:"][data-warning-id*=":${b}:"]`,
);

// Adding a species renders at once and again after the debounced recompute (~160 ms), which replaces
// the warning nodes with identical ones. Retry "scroll to it and see it on screen" as a whole until it
// holds for the settled page, instead of acting on a node that may be about to be replaced.
async function expectScrolledIntoView(locator: Locator) {
  await expect(async () => {
    await locator.scrollIntoViewIfNeeded({ timeout: 1000 });
    await expect(locator).toBeInViewport({ timeout: 1000 });
  }).toPass();
}
const bioloadLabel = (page: Page) => page.locator('[data-role="bioload-percent"]').first();

// Phase 2C: filtration is its own check and never changes the bioload figure.
async function addCustomFilter(page: Page, type: string, gph: number) {
  await page.selectOption('#fs-type', type);
  await page.fill('#fs-gph', String(gph));
  await page.click('#fs-add-custom');
}
// Catalog-product filtration: the path a real user takes (product dropdown → Add Selected → chip).
// Visitors often have the filter catalog cached while species data is still downloading, so the
// filtration controller starts before stocking.js. Delaying the species file reproduces that
// start-up order on every run instead of leaving it to chance.
async function delaySpeciesData(page: Page, ms = 1500) {
  await page.route(SPECIES_JSON, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.fallback();
  });
}

const productSelect = (page: Page) => page.locator('#filter-product');

// Pick the first product the dropdown offers, as a user would. If the list is rebuilt under the
// pick (the selection resets), pick again from the list that is now on screen.
async function selectFirstProduct(page: Page): Promise<string> {
  let chosen = '';
  await expect(async () => {
    const id = await productSelect(page).locator('option:not([value=""])').first().getAttribute('value', { timeout: 1000 });
    expect(id).toBeTruthy();
    chosen = id as string;
    await page.selectOption('#filter-product', chosen, { timeout: 1000 });
    await page.waitForTimeout(300);
    await expect(productSelect(page)).toHaveValue(chosen, { timeout: 100 });
    await expect(page.locator('#filter-product-add')).toBeEnabled({ timeout: 100 });
  }).toPass({ timeout: 10000 });
  return chosen;
}

async function addSelectedProduct(page: Page): Promise<string> {
  const id = await selectFirstProduct(page);
  await page.click('#filter-product-add');
  await expect(page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${id}"]`)).toBeVisible();
  return id;
}

// Long enough for the immediate render, the animation-frame ttg:recompute, the 160 ms debounced
// stocking recompute, the filtration render and the filter-catalog refresh that follows it.
async function settle(page: Page) {
  await page.waitForTimeout(1500);
}

// What the calculator itself sees: the shared filter list and the engine's filtration assessment.
async function calculatorFiltration(page: Page) {
  return page.evaluate(async () => {
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: { filters?: Array<{ id?: string | null }> } }).appState;
    const computed = compute.buildComputedState(appState);
    return {
      filterIds: (appState.filters ?? []).map((filter) => filter.id ?? null),
      level: computed?.filtering?.level ?? null,
      chipIds: Array.from(document.querySelectorAll<HTMLElement>('[data-role="proto-filter-chips"] .proto-filter-chip'))
        .map((chip) => chip.dataset.filterId ?? ''),
    };
  });
}

// Every visible chip must be a filter the calculator counts, and vice versa.
async function expectChipsMatchCalculator(page: Page, expectedIds: string[]) {
  const seen = await calculatorFiltration(page);
  expect(seen.chipIds).toEqual(expectedIds);
  expect(seen.filterIds).toEqual(expectedIds);
  return seen;
}

async function startProductScenario(page: Page, tankId = '10g') {
  await delaySpeciesData(page);
  await openAdvisor(page);
  await waitForSpecies(page);
  await selectTank(page, tankId);
  await addSpecies(page, 'neon', 6);
  await expect(warning(page, 'filtration.none')).toBeVisible();
}

const filterChips = (page: Page) => page.locator('[data-role="proto-filter-chips"] .proto-filter-chip');
const filtrationWarnings = (page: Page) => page.locator('#stock-warnings .status-strip[data-warning-id^="filtration."]');
const bioloadFill = (page: Page) => page.locator('#env-bars .env-bar__fill').first();

// A "normal green" result would have no red warning, a band-coloured bioload bar and no qualifier.
async function expectNotNormalGreen(page: Page, qualifier: RegExp) {
  await expect(page.locator('#stock-warnings .status-strip[data-state="bad"]').first()).toBeVisible();
  await expect(bioloadLabel(page)).toHaveText(qualifier);
  await expect(bioloadFill(page)).toHaveAttribute('style', /background:\s*var\(--bad\)/);
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop checks');

  test('dropdown offers all 44 species', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    const options = page.locator('#plan-species option:not([value=""])');
    await expect(options).toHaveCount(44);
    await expect(options.nth(1)).toHaveText('Angelfish');
    await expect(options.nth(1)).toHaveAttribute('value', 'freshwater_angelfish');
  });

  test('6 angelfish in a 20 gallon is not a normal green result', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await addSpecies(page, 'freshwater_angelfish', 6);
    await expect(warning(page, 'tank.volume.freshwater_angelfish')).toHaveAttribute('data-state', 'bad');
    await expectNotNormalGreen(page, /tank too small/i);
  });

  test('6 bristlenose plecos in a 5 gallon is not a normal green result', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '5g');
    await addSpecies(page, 'bristlenose_pleco', 6);
    await expect(warning(page, 'tank.volume.bristlenose_pleco')).toHaveAttribute('data-state', 'bad');
    await expectNotNormalGreen(page, /tank too small/i);
  });

  test('mixed 20 long audit case counts all four species', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20l');
    const stock: Array<[string, number]> = [
      ['freshwater_angelfish', 2], ['neon', 10], ['tiger_barb', 3], ['bristlenose_pleco', 2],
    ];
    for (const [id, qty] of stock) await addSpecies(page, id, qty);
    await expect(page.locator('[data-testid="species-row"]')).toHaveCount(4);
    // Each species is evaluated: tank, compatibility and group rules fire for every one of them.
    await expect(warning(page, 'tank.volume.freshwater_angelfish')).toBeVisible();
    await expect(pairWarning(page, 'fin_nip', 'freshwater_angelfish', 'tiger_barb')).toHaveCount(1);
    await expect(pairWarning(page, 'fin_nip', 'freshwater_angelfish', 'tiger_barb')).toBeVisible();
    await expect(pairWarning(page, 'aggressive_pair', 'freshwater_angelfish', 'bristlenose_pleco')).toHaveCount(1);
    await expect(pairWarning(page, 'aggressive_pair', 'freshwater_angelfish', 'bristlenose_pleco')).toBeVisible();
    await expect(warning(page, 'tank.length.tiger_barb')).toBeVisible();
    await expect(bioloadLabel(page)).toHaveText(/tank too small for Angelfish/i);
    await expect(page.locator('#stock-warnings [data-warning-id^="species.unevaluated."]')).toHaveCount(0);
  });

  test('angelfish with neon tetras shows a red predation warning', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '75g');
    await addSpecies(page, 'freshwater_angelfish', 2);
    await addSpecies(page, 'neon', 10);
    const alert = warning(page, 'predation.fish.freshwater_angelfish.neon');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('data-state', 'bad');
    await expect(alert).toContainText('Angelfish may eat Neon Tetra');
  });

  test('angelfish with a non-prey tankmate has no predation warning', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '75g');
    await addSpecies(page, 'freshwater_angelfish', 2);
    await addSpecies(page, 'cory_bronze', 6);
    await expect(page.locator('#stock-warnings [data-warning-id^="predation.fish."]')).toHaveCount(0);
  });

  test('an invalid species record produces the red incomplete state', async ({ page }) => {
    await page.route(SPECIES_JSON, async (route) => {
      const response = await route.fetch();
      const records = await response.json();
      const platy = records.find((record: { slug: string }) => record.slug === 'platy');
      platy.adult_size_in = null; // a required husbandry value is missing
      await route.fulfill({ response, json: records });
    });
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '29g');
    await addSpecies(page, 'platy', 3);
    const flagged = warning(page, 'species.unevaluated.platy');
    await expect(flagged).toHaveAttribute('data-state', 'bad');
    await expect(flagged).toContainText('Platy could not be evaluated');
    await expectNotNormalGreen(page, /incomplete/i);
  });

  test('failure to load species data shows the unavailable state', async ({ page }) => {
    await page.route(SPECIES_JSON, (route) => route.fulfill({ status: 503, body: 'unavailable' }));
    await openAdvisor(page);
    const alert = page.locator('#species-data-error');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('data-state', 'bad');
    await expect(alert).toContainText('Species data failed to load');
    await expect(page.locator('#plan-species')).toBeDisabled();
    await expect(page.locator('#plan-add')).toBeDisabled();
    await expect(page.locator('#plan-species option:not([value=""])')).toHaveCount(0);
  });
});

test.describe('desktop: space and cache', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop checks');

  test('6 pea puffers in a 5 gallon fail on space, not on bioload', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '5g');
    await addSpecies(page, 'pea_puffer', 6);
    const alert = warning(page, 'tank.group_volume.pea_puffer');
    await expect(alert).toHaveAttribute('data-state', 'bad');
    await expect(alert).toContainText('Not enough space for 6 × Pea Puffer');
    await expect(alert).toContainText('not a waste (bioload) limit');
    await expect(bioloadLabel(page)).toHaveText(/^45\.1%/);
  });

  test('6 pea puffers in a 20 gallon pass the space rule', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await addSpecies(page, 'pea_puffer', 6);
    await expect(page.locator('#stock-warnings [data-warning-id^="tank."]')).toHaveCount(0);
  });

  test('current calculator modules do not trigger the stale-cache reload', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await page.waitForLoadState('load');
    const state = await page.evaluate(() => ({
      marks: (window as unknown as { __ttgRevalidatedModules?: Record<string, boolean> }).__ttgRevalidatedModules,
      refreshed: sessionStorage.getItem('ttg-advisor-cache-refresh'),
    }));
    expect(state).toEqual({ marks: { 'species-adapter': true, 'compute-legacy': true }, refreshed: null });
  });
});

test.describe('desktop: filtration', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop checks');

  test('a powerhead alone adds no biological filtration and leaves bioload unchanged', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await addSpecies(page, 'neon', 10);
    await expect(warning(page, 'filtration.none')).toBeVisible();
    const before = await bioloadLabel(page).textContent();
    await addCustomFilter(page, 'Powerhead', 200);
    await expect(filterChips(page)).toHaveCount(1);
    await expect(filterChips(page).first()).toContainText('Powerhead 200');
    const alert = warning(page, 'filtration.circulation_only');
    await expect(alert).toHaveAttribute('data-state', 'bad');
    await expect(alert).toContainText('No biological filter');
    await expect(page.locator('[data-role="proto-filter-summary"]')).toHaveText(/^Filtration: 0 GPH • 0\.0×\/h \(\+200 GPH circulation only\)$/);
    await expect(bioloadLabel(page)).toHaveText(before ?? '');
  });

  test('a 1 GPH canister is not treated like a properly flowing canister', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await addSpecies(page, 'neon', 10);
    const before = await bioloadLabel(page).textContent();
    await addCustomFilter(page, 'Canister', 1);
    const alert = warning(page, 'filtration.very_low');
    await expect(alert).toHaveAttribute('data-state', 'bad');
    await expect(alert).toContainText('Filter flow too low');
    await expect(bioloadLabel(page)).toHaveText(before ?? '');
    await page.click('[data-role="proto-filter-chips"] [data-remove-filter]');
    await expect(filterChips(page)).toHaveCount(0);
    await addCustomFilter(page, 'Canister', 150);
    await expect(filterChips(page)).toHaveCount(1);
    await expect(page.locator('[data-role="proto-filter-summary"]')).toHaveText('Filtration: 150 GPH • 7.5×/h');
    await expect(filtrationWarnings(page)).toHaveCount(0);
    await expect(bioloadLabel(page)).toHaveText(before ?? '');
  });

  test('a large filter does not clear a red tank-size result', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await addSpecies(page, 'freshwater_angelfish', 6);
    await addCustomFilter(page, 'Canister', 1500);
    await expect(filterChips(page)).toHaveCount(1);
    await expect(warning(page, 'tank.volume.freshwater_angelfish')).toHaveAttribute('data-state', 'bad');
    await expectNotNormalGreen(page, /tank too small/i);
  });
});

test.describe('desktop: catalog product filter', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop checks');

  test('a catalog product added with Add Selected is counted by the calculator', async ({ page }) => {
    await startProductScenario(page);
    const before = await bioloadLabel(page).textContent();
    const id = await addSelectedProduct(page);
    await settle(page);
    const seen = await expectChipsMatchCalculator(page, [id]);
    expect(seen.level).toBe('adequate');
    await expect(warning(page, 'filtration.none')).toHaveCount(0);
    await expect(filtrationWarnings(page)).toHaveCount(0);
    await expect(bioloadLabel(page)).toHaveText(before ?? '');
    // Later recomputes (another stock change) must not drop it either.
    await addSpecies(page, 'cory_bronze', 3);
    await settle(page);
    await expectChipsMatchCalculator(page, [id]);
    await expect(warning(page, 'filtration.none')).toHaveCount(0);
  });

  test('removing the only product filter brings back "No filter added"', async ({ page }) => {
    await startProductScenario(page);
    const id = await addSelectedProduct(page);
    await settle(page);
    await expectChipsMatchCalculator(page, [id]);
    await page.click(`[data-role="proto-filter-chips"] [data-remove-filter="${id}"]`);
    await expect(filterChips(page)).toHaveCount(0);
    await settle(page);
    const seen = await expectChipsMatchCalculator(page, []);
    expect(seen.level).toBe('none');
    await expect(warning(page, 'filtration.none')).toBeVisible();
  });

  test('a product and a custom filter both stay in the calculation', async ({ page }) => {
    await startProductScenario(page);
    const id = await addSelectedProduct(page);
    await addCustomFilter(page, 'Sponge', 40);
    await expect(filterChips(page)).toHaveCount(2);
    await settle(page);
    const seen = await calculatorFiltration(page);
    expect(seen.filterIds).toHaveLength(2);
    expect(seen.filterIds[0]).toBe(id);
    expect(seen.chipIds).toEqual(seen.filterIds);
    await expect(filtrationWarnings(page)).toHaveCount(0);
  });

  test('a product filter survives a reload', async ({ page }) => {
    await startProductScenario(page);
    const id = await addSelectedProduct(page);
    await settle(page);
    await page.reload();
    await waitForSpecies(page);
    await expect(page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${id}"]`)).toBeVisible();
    await settle(page);
    const seen = await expectChipsMatchCalculator(page, [id]);
    expect(seen.level).toBe('adequate');
    await expect(filtrationWarnings(page)).toHaveCount(0);
  });
});

// Phase 2D: water parameters are unknown until the user enters them. The page has no water inputs
// yet, so values are entered the way a future input would: on the calculator state, then recompute.
async function setWater(page: Page, water: Record<string, number | string | boolean | null>) {
  await page.evaluate((values) => {
    const w = window as unknown as { appState: { water: Record<string, unknown> }; recomputeAll: () => void };
    Object.assign(w.appState.water, values);
    w.recomputeAll();
  }, water);
}
const waterWarnings = (page: Page) => page.locator('#stock-warnings .status-strip[data-warning-id^="water."]');
const WATER_CHIP_TEXT = /\bpH\b|\bgH\b|\bkH\b|temperature|hardness|tannin|flow|your water/i;

// Previewing a species (selected, not yet added) is where the candidate chips list water checks.
async function previewSpecies(page: Page, id: string, qty: number) {
  await page.selectOption('#plan-species', id);
  await page.fill('#plan-qty', String(qty));
  await page.locator('#plan-qty').blur();
  await expect(page.locator('#candidate-chips')).not.toBeEmpty();
  await settle(page);
}

async function expectNoWaterChips(page: Page) {
  const texts = await page.locator('#candidate-chips').allInnerTexts();
  expect(texts.join(' ')).not.toMatch(WATER_CHIP_TEXT);
}

test.describe('desktop: water parameters', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop checks');

  test('a new session with fish and no water entered makes no water claim', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await previewSpecies(page, 'neon', 8);
    await expectNoWaterChips(page);
    await page.click('#plan-add');
    await settle(page);
    const water = await page.evaluate(() => (window as unknown as { appState: { water: Record<string, unknown> } }).appState.water);
    expect([water.temperature, water.pH, water.gH, water.kH]).toEqual([null, null, null, null]);
    await expect(waterWarnings(page)).toHaveCount(0);
    await expectNoWaterChips(page);
    await expect(bioloadLabel(page)).toHaveText(/%/);
    // Shared species range is still shown from species data alone.
    await expect(page.locator('#env-reco')).toContainText('4.8–7.2');
  });

  test('an entered incompatible pH warns, and clearing it returns pH to unknown', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await addSpecies(page, 'neon', 8);
    const before = await bioloadLabel(page).textContent();
    await setWater(page, { pH: 8.5 });
    const alert = warning(page, 'water.pH.outside');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('data-state', 'bad');
    await expect(alert).toContainText('Your pH is outside this stock');
    await expect(alert).toContainText('You entered pH 8.5');
    await expect(bioloadLabel(page)).toHaveText(before ?? '');
    await setWater(page, { pH: null });
    await expect(waterWarnings(page)).toHaveCount(0);
    const status = await page.evaluate(async () => {
      const compute = await import('/js/logic/compute.js');
      const w = window as unknown as { appState: Record<string, unknown> };
      const computed = compute.buildComputedState(w.appState);
      return computed.conditions.conditions.find((item: { key: string }) => item.key === 'pH')?.status;
    });
    expect(status).toBe('not-entered');
    await expect(bioloadLabel(page)).toHaveText(before ?? '');
  });

  test('Molly with no GH entered gets no false hardness warning', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '29g');
    await previewSpecies(page, 'molly', 3);
    await expectNoWaterChips(page);
    await setWater(page, { gH: 3 });
    // Phase 2E: the preview shows this as a candidate warning strip, not a repeated chip.
    const preview = page.locator('#candidate-warnings .status-strip[data-warning-id="water.gH.outside"]');
    await expect(preview).toHaveAttribute('data-state', 'bad');
    await expect(preview).toContainText('Your GH (general hardness) is outside this stock');
    await setWater(page, { gH: null });
    await expect(preview).toHaveCount(0);
    await expectNoWaterChips(page);
    await page.click('#plan-add');
    await settle(page);
    await expect(waterWarnings(page)).toHaveCount(0);
    await setWater(page, { gH: 3 });
    await expect(warning(page, 'water.gH.outside')).toHaveAttribute('data-state', 'bad');
    await expect(warning(page, 'water.gH.outside')).toContainText('Your GH (general hardness) is outside this stock');
  });

  test('entered water is not persisted across a reload', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await addSpecies(page, 'neon', 8);
    await setWater(page, { pH: 8.5 });
    await expect(warning(page, 'water.pH.outside')).toBeVisible();
    await page.reload();
    await waitForSpecies(page);
    const water = await page.evaluate(() => (window as unknown as { appState: { water: Record<string, unknown> } }).appState.water);
    expect(water.pH).toBeNull();
    await expect(waterWarnings(page)).toHaveCount(0);
  });
});

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile checks');

  test('tank-too-small warning is visible on a phone', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await addSpecies(page, 'freshwater_angelfish', 6);
    const alert = warning(page, 'tank.volume.freshwater_angelfish');
    await expectScrolledIntoView(alert);
    await expect(alert).toHaveAttribute('data-state', 'bad');
    await expect(bioloadLabel(page)).toHaveText(/tank too small/i);
  });

  test('fish predation warning is visible on a phone', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '75g');
    await addSpecies(page, 'freshwater_angelfish', 2);
    await addSpecies(page, 'neon', 10);
    const alert = warning(page, 'predation.fish.freshwater_angelfish.neon');
    await expectScrolledIntoView(alert);
    await expect(alert).toHaveAttribute('data-state', 'bad');
  });

  test('a critical filtration warning is visible on a phone', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await addSpecies(page, 'neon', 10);
    await addCustomFilter(page, 'Canister', 1);
    const alert = warning(page, 'filtration.very_low');
    await expectScrolledIntoView(alert);
    await expect(alert).toHaveAttribute('data-state', 'bad');
  });

  test('a catalog product filter clears "No filter added" on a phone', async ({ page }) => {
    await startProductScenario(page);
    const id = await addSelectedProduct(page);
    await settle(page);
    await expectChipsMatchCalculator(page, [id]);
    await expect(warning(page, 'filtration.none')).toHaveCount(0);
  });

  test('species data failure is visible on a phone', async ({ page }) => {
    await page.route(SPECIES_JSON, (route) => route.fulfill({ status: 503, body: 'unavailable' }));
    await openAdvisor(page);
    const alert = page.locator('#species-data-error');
    await expectScrolledIntoView(alert);
    await expect(page.locator('#plan-species')).toBeDisabled();
  });
});

// Phase 2E: what a user sees for each warning category, on desktop AND on a phone. Every case checks
// the warning id, its engine severity (data-state), that it is on screen, that it survives the
// debounced recompute, and that it clears when the condition is resolved.
const candidateWarning = (page: Page, id: string) => page.locator(`#candidate-warnings .status-strip[data-warning-id="${id}"]`);
const anyWarning = (page: Page, id: string) => page.locator(`.status-strip[data-warning-id="${id}"]`);

async function expectShown(locator: Locator, state: 'bad' | 'warn') {
  await expectScrolledIntoView(locator);
  await expect(locator).toHaveAttribute('data-state', state);
  // Severity in words, not colour alone.
  await expect(locator.locator('.warning-severity')).toHaveText(state === 'bad' ? '✖ Problem:' : '⚠ Warning:');
  // Readable: the strip text is not the old dark-on-dark colour, and nothing is clipped.
  const box = await locator.evaluate((el) => ({
    color: getComputedStyle(el).color,
    clipped: el.scrollWidth > el.clientWidth + 1,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  expect(box.color).not.toBe('rgb(11, 18, 40)');
  expect(box.clipped).toBe(false);
  expect(box.overflowX).toBe(false);
}

// Still the same, still on screen after the debounced recompute has run again.
async function expectPersists(page: Page, locator: Locator, state: 'bad' | 'warn') {
  await settle(page);
  await page.evaluate(() => (window as unknown as { recomputeAll: () => void }).recomputeAll());
  await settle(page);
  await expect(locator).toHaveCount(1);
  await expectShown(locator, state);
}

async function previewCandidate(page: Page, id: string, qty: number) {
  await page.selectOption('#plan-species', id);
  await page.fill('#plan-qty', String(qty));
  await page.locator('#plan-qty').blur();
}

async function clickQty(page: Page, id: string, direction: 'plus' | 'minus', times = 1) {
  for (let i = 0; i < times; i += 1) {
    await page.click(`[data-qty-${direction}="${id}"]`);
    await page.waitForTimeout(250);
  }
}

test.describe('warnings (desktop and mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
  });

  test('group minimum: amber before and after Add, updates with quantity, clears at the minimum', async ({ page }) => {
    await selectTank(page, '20h');
    await previewCandidate(page, 'neon', 3);
    await expectShown(candidateWarning(page, 'group.min.neon'), 'warn');
    await expect(candidateWarning(page, 'group.min.neon')).toContainText('Neon Tetra needs a group of at least 6. Planned: 3.');
    await page.click('#plan-add');
    const alert = warning(page, 'group.min.neon');
    await expectPersists(page, alert, 'warn');
    await expect(candidateWarning(page, 'group.min.neon')).toHaveCount(0);
    await clickQty(page, 'neon', 'plus');
    await expect(alert).toContainText('Planned: 4.');
    await expectPersists(page, alert, 'warn');
    await clickQty(page, 'neon', 'plus', 2);
    await settle(page);
    await expect(anyWarning(page, 'group.min.neon')).toHaveCount(0);
    await clickQty(page, 'neon', 'minus');
    await expectShown(warning(page, 'group.min.neon'), 'warn');
    await expect(warning(page, 'group.min.neon')).toContainText('Planned: 5.');
  });

  test('tank length: amber in the shared warning style, never a separate chip', async ({ page }) => {
    await selectTank(page, '29g');
    await previewCandidate(page, 'cory_bronze', 6);
    await expectShown(candidateWarning(page, 'tank.length.cory_bronze'), 'warn');
    await expect(page.locator('[data-role="stock-warning-length"], [data-testid="tank-length-warning"]')).toHaveCount(0);
    await page.click('#plan-add');
    const alert = warning(page, 'tank.length.cory_bronze');
    await expectPersists(page, alert, 'warn');
    await expect(alert).toContainText('Bronze Corydoras needs a tank at least 36″ long');
    await selectTank(page, '40b');
    await settle(page);
    await expect(anyWarning(page, 'tank.length.cory_bronze')).toHaveCount(0);
    await selectTank(page, '29g');
    await expectShown(warning(page, 'tank.length.cory_bronze'), 'warn');
  });

  test('shrimp predation: named, visible before and after Add, clears on removal', async ({ page }) => {
    await selectTank(page, '29g');
    await addSpecies(page, 'neocaridina', 10);
    await previewCandidate(page, 'blue_ram', 1);
    const id = 'predation.shrimp.blue_ram.neocaridina';
    // Blue Ram's own data: "Shrimp (all sizes)" → red.
    await expectShown(candidateWarning(page, id), 'bad');
    await expect(candidateWarning(page, id)).toContainText('may eat Cherry Shrimp');
    await expect(candidateWarning(page, id)).toContainText('shrimp of all sizes');
    await page.click('#plan-add');
    await expectPersists(page, warning(page, id), 'bad');
    // The Environmental card no longer repeats it (or hides it behind "more").
    await expect(page.locator('#env-warnings')).not.toContainText('predation');
    await page.click('[data-remove-id="blue_ram"]');
    await settle(page);
    await expect(anyWarning(page, id)).toHaveCount(0);
  });

  // Severity follows each predator's own predationRisks entry.
  for (const [label, stockId, qty, predatorId, predatorQty, id, state, text] of [
    ['juvenile-only shrimp risk is amber', 'neocaridina', 10, 'cardinal', 6, 'predation.shrimp.cardinal.neocaridina', 'warn', 'may eat juvenile Cherry Shrimp'],
    ['a named shrimp type is red for that type', 'neocaridina', 10, 'betta_male', 1, 'predation.shrimp.betta_male.neocaridina', 'bad', 'may prey on Cherry Shrimp'],
    ['Pea Puffer is caught from its explicit shrimp data', 'neocaridina', 10, 'pea_puffer', 1, 'predation.shrimp.pea_puffer.neocaridina', 'bad', 'shrimp of all sizes'],
    ['Assassin Snail with another snail is red', 'nerite', 2, 'assassin_snail', 2, 'predation.snail.assassin_snail.nerite', 'bad', 'lists snails as prey'],
  ] as const) {
    test(`invert predation: ${label}, before and after Add`, async ({ page }) => {
      await selectTank(page, '75g');
      await addSpecies(page, stockId, qty);
      await previewCandidate(page, predatorId, predatorQty);
      await expectShown(candidateWarning(page, id), state);
      await expect(candidateWarning(page, id)).toContainText(text);
      await page.click('#plan-add');
      await expectPersists(page, warning(page, id), state);
    });
  }

  test('invert predation: cherry-specific data is not applied to Amano Shrimp', async ({ page }) => {
    await selectTank(page, '75g');
    await addSpecies(page, 'amano', 6);
    await addSpecies(page, 'betta_male', 1);
    await settle(page);
    await expect(anyWarning(page, 'predation.shrimp.betta_male.amano')).toHaveCount(0);
  });

  // Species traits (behavior.predationRisks / incompatibilities) are neutral notes; only a real
  // predation or compatibility problem with the planned stock is a red / amber warning.
  const note = (page: Page, text: string) => page.locator('#candidate-chips .chip[data-tone="info"]', { hasText: text });
  const activeChip = (page: Page, text: RegExp) => page.locator('#candidate-chips .chip[data-tone="warn"], #candidate-chips .chip[data-tone="bad"]', { hasText: text });
  const noPlanWarnings = async (page: Page) => {
    await expect(page.locator('#candidate-warnings .status-strip, #stock-warnings .status-strip')).toHaveCount(0);
  };
  const withFilter = async (page: Page) => {
    await selectTank(page, '75g');
    await addCustomFilter(page, 'Canister', 400);
  };

  for (const [label, speciesId, qty, noteText] of [
    ['Betta with no shrimp', 'betta_male', 1, 'May prey on: cherry shrimp'],
    ['Molly with no shrimp', 'molly', 3, 'May prey on: juvenile shrimp'],
    ['Molly with no shrimp (named cherry note)', 'molly', 3, 'May prey on: cherry shrimp'],
    ['Cardinal Tetra with no shrimp', 'cardinal', 6, 'May prey on: juvenile shrimp'],
    ['Cherry Barb with no shrimp', 'cherrybarb', 6, 'May prey on: cherry shrimp'],
    ['Tiger Barb with no long-finned fish', 'tiger_barb', 8, 'Avoid with: long-finned species'],
  ] as const) {
    test(`species trait: ${label} is a neutral note, not a warning`, async ({ page }) => {
      await withFilter(page);
      await previewCandidate(page, speciesId, qty);
      // Known app race (not covered here): if the species-change render runs before the quantity is
      // typed, blurring the quantity does not recompute, so the preview can keep qty 1 and show a
      // group warning. Recompute explicitly so this test checks the species notes only.
      await settle(page);
      await page.evaluate(() => (window as unknown as { recomputeAll: () => void }).recomputeAll());
      await expect(note(page, noteText)).toBeVisible();
      await expect(note(page, noteText)).toContainText('Species note');
      await expect(activeChip(page, /prey|avoid|predation|incompatib/i)).toHaveCount(0);
      await settle(page);
      await noPlanWarnings(page);
    });
  }

  test('species trait: Betta + Cherry Shrimp shows the red warning without a duplicate prey note', async ({ page }) => {
    await withFilter(page);
    await addSpecies(page, 'neocaridina', 10);
    await previewCandidate(page, 'betta_male', 1);
    await expectShown(candidateWarning(page, 'predation.shrimp.betta_male.neocaridina'), 'bad');
    await expect(note(page, 'cherry shrimp')).toHaveCount(0);
    await expect(activeChip(page, /prey|predation/i)).toHaveCount(0);
    await page.click('#plan-add');
    await expectPersists(page, warning(page, 'predation.shrimp.betta_male.neocaridina'), 'bad');
  });

  test('species trait: Betta + Amano keeps only the neutral note', async ({ page }) => {
    await withFilter(page);
    await addSpecies(page, 'amano', 6);
    await previewCandidate(page, 'betta_male', 1);
    await expect(note(page, 'May prey on: cherry shrimp')).toBeVisible();
    await settle(page);
    await noPlanWarnings(page);
  });

  // Phase 2G batch 1: predation data corrected from directly reviewed sources.
  for (const [label, predatorId, predatorQty, id, state, text] of [
    ['Cardinal Tetra + Cherry Shrimp is an amber juvenile warning', 'cardinal', 6, 'predation.shrimp.cardinal.neocaridina', 'warn', 'Cardinal Tetra may eat juvenile Cherry Shrimp'],
    ['Cherry Barb + Cherry Shrimp is red', 'cherrybarb', 6, 'predation.shrimp.cherrybarb.neocaridina', 'bad', 'Cherry Barb may prey on Cherry Shrimp'],
    ['Molly + Cherry Shrimp is red', 'molly', 3, 'predation.shrimp.molly.neocaridina', 'bad', 'Molly may prey on Cherry Shrimp'],
  ] as const) {
    test(`species trait: ${label}, before and after Add`, async ({ page }) => {
      await withFilter(page);
      await addSpecies(page, 'neocaridina', 10);
      await previewCandidate(page, predatorId, predatorQty);
      await expectShown(candidateWarning(page, id), state);
      await expect(candidateWarning(page, id)).toContainText(text);
      // The warning replaces the species' own prey notes; nothing is shown as a coloured chip.
      await expect(note(page, 'May prey on')).toHaveCount(0);
      await expect(activeChip(page, /prey|predation/i)).toHaveCount(0);
      await page.click('#plan-add');
      await expectPersists(page, warning(page, id), state);
      await expect(page.locator(`.status-strip[data-warning-id^="predation.shrimp.${predatorId}."]`)).toHaveCount(1);
    });
  }

  test('species trait: Cherry Barb + Amano Shrimp has no Cherry Barb predation warning', async ({ page }) => {
    await withFilter(page);
    await addSpecies(page, 'amano', 6);
    await previewCandidate(page, 'cherrybarb', 6);
    await expect(note(page, 'May prey on: cherry shrimp')).toBeVisible();
    await settle(page);
    await expect(anyWarning(page, 'predation.shrimp.cherrybarb.amano')).toHaveCount(0);
    await page.click('#plan-add');
    await settle(page);
    await expect(anyWarning(page, 'predation.shrimp.cherrybarb.amano')).toHaveCount(0);
    await expect(page.locator('.status-strip[data-warning-id^="predation."]')).toHaveCount(0);
  });

  test('hard compatibility conflict: red before and after Add, never a gray chip', async ({ page }) => {
    await selectTank(page, '29g');
    await addSpecies(page, 'betta_male', 1);
    await previewCandidate(page, 'tiger_barb', 8);
    const preview = page.locator('#candidate-warnings .status-strip[data-warning-id$=":hard_pair"][data-warning-id*=":betta_male:"][data-warning-id*=":tiger_barb:"]');
    await expectShown(preview, 'bad');
    await expect(page.locator('#candidate-chips .chip:not([data-tone])', { hasText: /aggression|conflict/i })).toHaveCount(0);
    await page.click('#plan-add');
    const alert = pairWarning(page, 'hard_pair', 'betta_male', 'tiger_barb');
    await expectPersists(page, alert, 'bad');
    await expect(alert).toContainText('Betta (Male) and Tiger Barb');
    await expect(alert).toHaveAttribute('role', 'alert');
    await page.click('[data-remove-id="tiger_barb"]');
    await settle(page);
    await expect(page.locator('.status-strip[data-warning-id$=":hard_pair"]')).toHaveCount(0);
  });

  test('quantity-space: red, persistent, clears when the quantity fits', async ({ page }) => {
    await selectTank(page, '5g');
    await addSpecies(page, 'pea_puffer', 6);
    const alert = warning(page, 'tank.group_volume.pea_puffer');
    await expectPersists(page, alert, 'bad');
    await clickQty(page, 'pea_puffer', 'minus', 5);
    await settle(page);
    await expect(anyWarning(page, 'tank.group_volume.pea_puffer')).toHaveCount(0);
    await clickQty(page, 'pea_puffer', 'plus', 5);
    await expectShown(warning(page, 'tank.group_volume.pea_puffer'), 'bad');
  });

  test('filtration: no filter amber, 1 GPH red, both clear with a real filter', async ({ page }) => {
    await selectTank(page, '20h');
    await addSpecies(page, 'neon', 10);
    await expectPersists(page, warning(page, 'filtration.none'), 'warn');
    await addCustomFilter(page, 'Canister', 1);
    await expectPersists(page, warning(page, 'filtration.very_low'), 'bad');
    await page.click('[data-role="proto-filter-chips"] [data-remove-filter]');
    await expectShown(warning(page, 'filtration.none'), 'warn');
    await addCustomFilter(page, 'Canister', 150);
    await settle(page);
    await expect(filtrationWarnings(page)).toHaveCount(0);
  });

  test('safe stock leaves no warning nodes behind', async ({ page }) => {
    await selectTank(page, '29g');
    await addSpecies(page, 'freshwater_angelfish', 1);
    await expect(warning(page, 'tank.volume.freshwater_angelfish')).toBeVisible();
    await page.click('[data-remove-id="freshwater_angelfish"]');
    await addSpecies(page, 'neon', 8);
    await addCustomFilter(page, 'Canister', 200);
    await settle(page);
    await expect(page.locator('#stock-warnings .status-strip, #candidate-warnings .status-strip')).toHaveCount(0);
    await expect(page.locator('#stock-warnings')).toBeHidden();
    await expect(page.locator('#candidate-warnings')).toBeHidden();
  });

  test('a recompute does not re-create (re-announce) an unchanged warning', async ({ page }) => {
    await selectTank(page, '20h');
    await addSpecies(page, 'neon', 3);
    await settle(page);
    const alert = warning(page, 'group.min.neon');
    await alert.evaluate((el) => { (el as HTMLElement & { __marker?: boolean }).__marker = true; });
    await page.evaluate(() => (window as unknown as { recomputeAll: () => void }).recomputeAll());
    await settle(page);
    expect(await alert.evaluate((el) => (el as HTMLElement & { __marker?: boolean }).__marker === true)).toBe(true);
  });
});
