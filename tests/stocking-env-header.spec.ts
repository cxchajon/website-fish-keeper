import { test, expect, devices } from '@playwright/test';

const url = '/stocking-advisor.html';

// iPhone 12 viewport and touch settings without forcing WebKit, so each browser project runs it.
const { defaultBrowserType: _iphoneBrowser, ...iPhone12 } = devices['iPhone 12'];

test.describe('Stocking Advisor — Env. Recommendations unified info icon', () => {
  test('desktop: single icon toggles the environmental card guide', async ({ page }, testInfo) => {
    await page.goto(url, { waitUntil: 'networkidle' });

    const icon = page.locator('#env-info-btn');
    const popover = page.locator('#pop-env-info');

    await expect(page.locator('[data-role="env-info"]')).toHaveCount(1);
    await expect(icon).toBeVisible();
    await expect(popover).toBeHidden();

    // 1st click → open the guide
    await icon.click();
    await expect(popover).toBeVisible();
    await expect(icon).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: testInfo.outputPath('env-desktop-expanded.png'), fullPage: false });

    // Close button → hide the guide
    await popover.locator('[data-close]').click();
    await expect(popover).toBeHidden();
    await expect(icon).toHaveAttribute('aria-expanded', 'false');

    // 2nd click → open again, Escape closes it
    await icon.click();
    await expect(popover).toBeVisible();
    await expect(icon).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: testInfo.outputPath('env-desktop-reopened.png'), fullPage: false });
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(icon).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Stocking Advisor — Env. Recommendations unified info icon (mobile)', () => {
  test.use(iPhone12);

  test('mobile: single icon works and aligns', async ({ page }, testInfo) => {
    await page.goto(url, { waitUntil: 'networkidle' });

    const icon = page.locator('#env-info-btn');
    const popover = page.locator('#pop-env-info');

    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute('aria-expanded', 'false');

    // The icon sits on the card title row, beside the heading.
    const [iconBox, titleBox] = await Promise.all([
      icon.boundingBox(),
      page.locator('#env-card .card-title').boundingBox(),
    ]);
    expect(iconBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    if (iconBox && titleBox) {
      expect(iconBox.y).toBeLessThan(titleBox.y + titleBox.height);
      expect(iconBox.y + iconBox.height).toBeGreaterThan(titleBox.y);
    }

    await icon.click();
    await expect(popover).toBeVisible();
    await expect(icon).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: testInfo.outputPath('env-mobile-expanded.png'), fullPage: false });
  });
});
