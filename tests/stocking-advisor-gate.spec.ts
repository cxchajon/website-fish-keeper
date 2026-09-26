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

  test('species data failure is visible on a phone', async ({ page }) => {
    await page.route(SPECIES_JSON, (route) => route.fulfill({ status: 503, body: 'unavailable' }));
    await openAdvisor(page);
    const alert = page.locator('#species-data-error');
    await expectScrolledIntoView(alert);
    await expect(page.locator('#plan-species')).toBeDisabled();
  });
});
