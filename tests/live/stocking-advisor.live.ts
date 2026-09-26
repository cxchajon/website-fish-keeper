// Read-only behaviour check against production (run by playwright.live.config.ts from the manual
// Stocking Advisor live-verify workflow). Named *.live.ts so the regular suites never pick it up.
import { test, expect, type Page } from '@playwright/test';

const fatalErrors: string[] = [];

async function openAdvisor(page: Page) {
  fatalErrors.length = 0;
  page.on('pageerror', (error) => fatalErrors.push(error.message));
  await page.goto('/stocking-advisor.html');
  await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
}

async function addSpecies(page: Page, id: string, qty: number) {
  await page.selectOption('#plan-species', id);
  await page.fill('#plan-qty', String(qty));
  await page.click('#plan-add');
  await expect(page.locator(`[data-testid="species-row"][data-row-id="${id}"]`)).toBeVisible();
}

const warning = (page: Page, id: string) => page.locator(`#stock-warnings .status-strip[data-warning-id="${id}"]`);

test('page loads with all species and no uncaught JavaScript error', async ({ page }) => {
  await openAdvisor(page);
  await page.waitForLoadState('load');
  await expect(page.locator('#species-data-error')).toBeHidden();
  const options = page.locator('#plan-species option:not([value=""])');
  await expect(options).toHaveCount(44);
  expect(fatalErrors).toEqual([]);
});

test('Angelfish is in the species picker', async ({ page }) => {
  await openAdvisor(page);
  await expect(page.locator('#plan-species option[value="freshwater_angelfish"]')).toHaveText('Angelfish');
});

test('6 Angelfish in a 20 gallon is unsafe', async ({ page }) => {
  await openAdvisor(page);
  await page.selectOption('#tank-size', '20h');
  await addSpecies(page, 'freshwater_angelfish', 6);
  await expect(warning(page, 'tank.volume.freshwater_angelfish')).toHaveAttribute('data-state', 'bad');
  await expect(page.locator('[data-role="bioload-percent"]').first()).toHaveText(/tank too small/i);
  expect(fatalErrors).toEqual([]);
});

test('Angelfish with Neon Tetra shows the predation warning', async ({ page }) => {
  await openAdvisor(page);
  await page.selectOption('#tank-size', '75g');
  await addSpecies(page, 'freshwater_angelfish', 2);
  await addSpecies(page, 'neon', 10);
  const alert = warning(page, 'predation.fish.freshwater_angelfish.neon');
  await expect(alert).toHaveAttribute('data-state', 'bad');
  await expect(alert).toContainText('Angelfish may eat Neon Tetra');
});

test('6 Pea Puffers in a 5 gallon shows the quantity-space warning', async ({ page }) => {
  await openAdvisor(page);
  await page.selectOption('#tank-size', '5g');
  await addSpecies(page, 'pea_puffer', 6);
  const alert = warning(page, 'tank.group_volume.pea_puffer');
  await expect(alert).toHaveAttribute('data-state', 'bad');
  await expect(alert).toContainText('Not enough space for 6 × Pea Puffer');
});
