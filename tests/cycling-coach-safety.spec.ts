import { expect, test } from '@playwright/test';

const COACH_PATH = '/cycling-coach/';

async function assess(page, method: 'fishless' | 'fish-in', ammonia: string, nitrite: string, nitrate: string) {
  await page.locator('#cycle-method').selectOption(method);
  await page.locator('#ammonia').fill(ammonia);
  await page.locator('#nitrite').fill(nitrite);
  await page.locator('#nitrate').fill(nitrate);
  await page.locator('#check-button').click();
}

function fishInActions(page) {
  return page.locator('#actions-list');
}

test.describe('Cycling Coach fish-in safety guidance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(COACH_PATH);
    await expect(page.locator('#coach-form')).toBeVisible();
  });

  test('gives cautious established-cycle guidance to fish-in systems with zero ammonia and nitrite', async ({ page }) => {
    await assess(page, 'fish-in', '0', '0', '10');

    await expect(page.locator('#status-badge')).toContainText('Cycled (likely)');
    await expect(fishInActions(page)).toContainText(/biofilter is currently processing livestock waste/i);
    await expect(fishInActions(page)).toContainText(/Do not dose ammonia while fish, shrimp, snails, or other livestock are present/i);
    await expect(fishInActions(page)).toContainText(/Continue testing ammonia and nitrite daily for at least a week/i);
    await expect(fishInActions(page)).not.toContainText(/24-hour challenge|Start the 24-hour challenge/i);
    await expect(page.locator('#challengeCard')).toBeHidden();
  });

  test('uses urgent fish-in guidance for ammonia at the urgent threshold', async ({ page }) => {
    await assess(page, 'fish-in', '0.25', '0', '10');

    await expect(page.locator('#status-badge')).toContainText('Urgent');
    await expect(fishInActions(page)).toContainText(/Do a 25–50% water change now/i);
    await expect(fishInActions(page)).toContainText(/test every 12 hours/i);
  });

  test('uses urgent fish-in guidance for nitrite at the urgent threshold', async ({ page }) => {
    await assess(page, 'fish-in', '0', '0.25', '10');

    await expect(page.locator('#status-badge')).toContainText('Urgent');
    await expect(fishInActions(page)).toContainText(/Do a 25–50% water change now/i);
    await expect(fishInActions(page)).toContainText(/test every 12 hours/i);
  });

  test('keeps fish-in readings below urgent thresholds in monitoring guidance', async ({ page }) => {
    await assess(page, 'fish-in', '0.24', '0', '10');

    await expect(page.locator('#status-badge')).toContainText('In Progress');
    await expect(fishInActions(page)).toContainText(/Test ammonia and nitrite daily/i);
    await expect(fishInActions(page)).not.toContainText(/water change now/i);
  });

  test('never recommends ammonia dosing in any fish-in action branch', async ({ page }) => {
    const fishInReadings = [
      ['0', '0', '10'],
      ['0.25', '0', '10'],
      ['0', '0.25', '10'],
      ['0.24', '0', '10'],
    ] as const;

    for (const [ammonia, nitrite, nitrate] of fishInReadings) {
      await assess(page, 'fish-in', ammonia, nitrite, nitrate);
      const actionItems = await fishInActions(page).locator('li').allTextContents();
      expect(actionItems).not.toEqual(expect.arrayContaining([
        expect.stringMatching(/^(Dose ammonia|Keep dosing ammonia|Start the 24-hour challenge)/i),
      ]));
    }
  });
});

test.describe('Cycling Coach fishless completion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(COACH_PATH);
    await expect(page.locator('#coach-form')).toBeVisible();
  });

  test('preserves the fishless completion action set and 24-hour challenge', async ({ page }) => {
    await assess(page, 'fishless', '0', '0', '10');

    await expect(page.locator('#status-badge')).toContainText('Cycled (likely)');
    await expect(page.locator('#actions-list')).toContainText(/Dose ammonia up to ~2 ppm/i);
    await expect(page.locator('#challengeCard')).toBeVisible();

    await page.locator('#challenge-start').click();
    await page.locator('#challengeAmmonia').fill('0');
    await page.locator('#challengeNitrite').fill('0');
    await page.locator('#challenge-check').click();

    await expect(page.locator('#challenge-results')).toBeVisible();
    await expect(page.locator('#challenge-list')).toContainText(/processed 2 ppm of ammonia in 24 hours/i);
  });
});
