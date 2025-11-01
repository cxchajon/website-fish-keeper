import { test, expect, devices } from '@playwright/test';
import { mkdirSync } from 'fs';

mkdirSync('test-artifacts', { recursive: true });

const url = '/stocking-advisor.html';

test.describe('Stocking Advisor — Env. Recommendations unified info icon', () => {
  test('desktop: single icon toggles environmental legend', async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle' });

    const icon = page.locator('#env-info-toggle');
    const panel = page.locator('#env-more-tips');

    await expect(icon).toBeVisible();
    await expect(panel).toBeHidden();

    // 1st click → expand panel
    await icon.click();
    await expect(panel).toBeVisible();
    await expect(icon).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: 'test-artifacts/env-desktop-expanded.png', fullPage: false });

    // 2nd click → collapse panel
    await icon.click();
    await expect(panel).toBeHidden();
    await expect(icon).toHaveAttribute('aria-expanded', 'false');

    // 3rd click → expand again
    await icon.click();
    await expect(panel).toBeVisible();
    await expect(icon).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: 'test-artifacts/env-desktop-reopened.png', fullPage: false });
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
    await expect(panel).toBeVisible();
    await expect(icon).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: 'test-artifacts/env-mobile-expanded.png', fullPage: false });
  });
});
