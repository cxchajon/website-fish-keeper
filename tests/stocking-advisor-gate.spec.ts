// Production gate for the Stocking Advisor species pipeline (run with
// `npm run test:e2e:stocking-gate`). Uses the page's current selectors; independent of the main suite.
import { test, expect, type Page } from '@playwright/test';

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
const bioloadLabel = (page: Page) => page.locator('[data-role="bioload-percent"]').first();
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
    await expect(page.locator('#plan-species option:not([value=""])')).toHaveCount(44);
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
    await expect(warning(page, 'aggr:freshwater_angelfish:tiger_barb:fin_nip')).toBeVisible();
    await expect(warning(page, 'aggr:bristlenose_pleco:freshwater_angelfish:aggressive_pair')).toBeVisible();
    await expect(warning(page, 'tank.length.tiger_barb')).toBeVisible();
    await expect(bioloadLabel(page)).toHaveText(/tank too small for Freshwater Angelfish/i);
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
    await expect(alert).toContainText('Freshwater Angelfish may eat Neon Tetra');
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

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile checks');

  test('tank-too-small warning is visible on a phone', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '20h');
    await addSpecies(page, 'freshwater_angelfish', 6);
    const alert = warning(page, 'tank.volume.freshwater_angelfish');
    await alert.scrollIntoViewIfNeeded();
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('data-state', 'bad');
    await expect(alert).toBeInViewport();
    await expect(bioloadLabel(page)).toHaveText(/tank too small/i);
  });

  test('fish predation warning is visible on a phone', async ({ page }) => {
    await openAdvisor(page);
    await waitForSpecies(page);
    await selectTank(page, '75g');
    await addSpecies(page, 'freshwater_angelfish', 2);
    await addSpecies(page, 'neon', 10);
    const alert = warning(page, 'predation.fish.freshwater_angelfish.neon');
    await alert.scrollIntoViewIfNeeded();
    await expect(alert).toBeInViewport();
    await expect(alert).toHaveAttribute('data-state', 'bad');
  });

  test('species data failure is visible on a phone', async ({ page }) => {
    await page.route(SPECIES_JSON, (route) => route.fulfill({ status: 503, body: 'unavailable' }));
    await openAdvisor(page);
    const alert = page.locator('#species-data-error');
    await alert.scrollIntoViewIfNeeded();
    await expect(alert).toBeVisible();
    await expect(alert).toBeInViewport();
    await expect(page.locator('#plan-species')).toBeDisabled();
  });
});
