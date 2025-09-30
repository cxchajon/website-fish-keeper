import { test, expect, devices } from '@playwright/test';
import { mkdirSync } from 'fs';

mkdirSync('test-artifacts', { recursive: true });

const url = '/stocking.html';

test.describe('Stocking Advisor — Env. Recommendations unified info icon', () => {
  test('desktop: single icon shows popover then toggles tips', async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle' });

    const icon = page.locator('#env-info-toggle');
    const panel = page.locator('#env-more-tips');

    await expect(icon).toBeVisible();
    await expect(panel).toBeHidden();

    // 1st click → popover
    await icon.click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'test-artifacts/env-desktop-popover.png', fullPage: false });

    // 2nd click → expand panel
    await icon.click();
    await expect(panel).toBeVisible();
    await page.screenshot({ path: 'test-artifacts/env-desktop-expanded.png', fullPage: false });

    // 3rd click → collapse panel
    await icon.click();
    await expect(panel).toBeHidden();
    await page.screenshot({ path: 'test-artifacts/env-desktop-collapsed.png', fullPage: false });
  });
});

test.use({ ...devices['iPhone 12'] });

test.describe('Stocking Advisor — Env. Recommendations unified info icon (mobile)', () => {
  test('mobile: single icon works and aligns', async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle' });

    const icon = page.locator('#env-info-toggle');
    const panel = page.locator('#env-more-tips');

    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute('aria-expanded', 'false');

    await icon.click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'test-artifacts/env-mobile-popover.png', fullPage: false });

    await icon.click();
    await expect(panel).toBeVisible();
    await expect(icon).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: 'test-artifacts/env-mobile-expanded.png', fullPage: false });
  });
});
