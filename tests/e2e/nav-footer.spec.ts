import { test, expect } from '@playwright/test';

test.describe('Navigation and footer smoke checks', () => {
  test('global nav loads and footer trust messaging appears', async ({ page }, testInfo) => {
    await page.goto('/');

    // nav.js swaps the #site-nav placeholder for the shared #global-nav header.
    await page.waitForSelector('#global-nav .site-links');
    await expect(page.locator('#site-nav')).toHaveCount(0);
    const navLinks = page.locator('#global-nav .site-links a');
    expect(await navLinks.count()).toBeGreaterThan(3);

    const footer = page.locator('footer.site-footer');
    await footer.waitFor();
    await expect(footer).toContainText('As an Amazon Associate');
    await expect(footer.getByRole('link', { name: 'Trust & Security' })).toBeVisible();
    await expect(footer.getByRole('link', { name: /Privacy/i })).toBeVisible();
    await expect(footer.getByRole('link', { name: /Terms/i })).toBeVisible();

    const socialLabels = [
      'The Tank Guide on Instagram',
      'The Tank Guide on TikTok',
      'The Tank Guide on Facebook',
      'The Tank Guide on X (Twitter)',
      'The Tank Guide on YouTube',
      'The Tank Guide Assistant on ChatGPT',
      'Shop our books on Amazon (opens in a new tab)',
      'Shop FishKeepingLifeCo on Etsy (opens in a new tab)'
    ];
    for (const label of socialLabels) {
      await expect(footer.getByRole('link', { name: label })).toBeVisible();
    }

    await footer.screenshot({ path: testInfo.outputPath('footer-trust-link.png') });
  });

  test('right click remains available by default when deterrent flag is off', async ({ page }) => {
    await page.goto('/');

    const defaultPrevented = await page.evaluate(() =>
      new Promise((resolve) => {
        // Listen on window, after the event has bubbled past the site's document-level handler.
        const listener = (event) => {
          window.removeEventListener('contextmenu', listener);
          resolve(event.defaultPrevented);
        };
        window.addEventListener('contextmenu', listener);
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2
        });
        if (!document.body) {
          resolve(false);
          return;
        }
        document.body.dispatchEvent(event);
        setTimeout(() => {
          window.removeEventListener('contextmenu', listener);
          resolve(false);
        }, 100);
      })
    );

    expect(defaultPrevented).toBe(false);
  });

  test('right click is blocked when deterrent flag is enabled', async ({ page }) => {
    await page.addInitScript(() => {
      window.__RIGHT_CLICK_DETERRENT__ = true;
    });

    await page.goto('/');

    const defaultPrevented = await page.evaluate(() =>
      new Promise((resolve) => {
        // Listen on window, after the event has bubbled past the site's document-level handler.
        const listener = (event) => {
          window.removeEventListener('contextmenu', listener);
          resolve(event.defaultPrevented);
        };
        window.addEventListener('contextmenu', listener);
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2
        });
        if (!document.body) {
          resolve(false);
          return;
        }
        document.body.dispatchEvent(event);
        setTimeout(() => {
          window.removeEventListener('contextmenu', listener);
          resolve(false);
        }, 100);
      })
    );

    expect(defaultPrevented).toBe(true);
  });
});
