import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const auditScreenDir = path.resolve(
  fileURLToPath(new URL('../../AUDIT/screens', import.meta.url))
);

test.beforeAll(() => {
  fs.mkdirSync(auditScreenDir, { recursive: true });
});

test.describe('Navigation and footer smoke checks', () => {
  test('global nav loads and footer trust messaging appears', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('#site-nav');
    await page.waitForSelector('#global-nav .site-links');
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
      'The Tank Guide on Amazon'
    ];
    for (const label of socialLabels) {
      await expect(footer.getByRole('link', { name: label })).toBeVisible();
    }

    await footer.screenshot({ path: path.join(auditScreenDir, 'footer-trust-link.png') });
  });

  test('right click remains available by default when deterrent flag is off', async ({ page }) => {
    await page.goto('/');

    const defaultPrevented = await page.evaluate(() =>
      new Promise((resolve) => {
        const listener = (event) => {
          document.removeEventListener('contextmenu', listener, true);
          resolve(event.defaultPrevented);
        };
        document.addEventListener('contextmenu', listener, true);
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
          document.removeEventListener('contextmenu', listener, true);
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
        const listener = (event) => {
          document.removeEventListener('contextmenu', listener, true);
          resolve(event.defaultPrevented);
        };
        document.addEventListener('contextmenu', listener, true);
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
          document.removeEventListener('contextmenu', listener, true);
          resolve(false);
        }, 100);
      })
    );

    expect(defaultPrevented).toBe(true);
  });
});
