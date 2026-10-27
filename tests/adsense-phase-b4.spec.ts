import { expect, test } from '@playwright/test';

const WIDTHS = [320, 360, 390, 430, 520, 650, 768, 810, 1024, 1280, 1440];

const PLACEMENTS = [
  {
    path: '/blogs/',
    ad: '#ad-blog-index-bottom',
    before: '#blogs-faq',
  },
  {
    path: '/community-tanks.html',
    ad: '#ad-community-tanks-bottom',
    before: '#ad-community-tanks-store',
  },
  {
    path: '/submit-your-tank.html',
    ad: '#ad-submit-your-tank-bottom',
    before: '#feature-your-tank-faq',
    outside: 'form',
  },
  {
    path: '/tools/snail-stock-recommender.html',
    ad: '#ad-snail-recommender-google-bottom',
    before: '#ad-snail-recommender-bottom',
  },
];

test.describe('Phase B4 manual Google placements', () => {
  for (const placement of PLACEMENTS) {
    test(`${placement.path}: responsive placement remains contained and separated`, async ({ page }) => {
      // Keep the test deterministic: the page initializer still records its one request against
      // window.adsbygoogle, while no third-party creative can affect the local layout.
      await page.route('https://pagead2.googlesyndication.com/**', (route) => route.fulfill({ status: 204, body: '' }));
      await page.goto(placement.path, { waitUntil: 'domcontentloaded' });

      const ad = page.locator(placement.ad);
      const ins = ad.locator('ins.adsbygoogle');
      await expect(ad).toHaveCount(1);
      await expect(ins).toHaveCount(1);
      await expect
        .poll(() => ins.getAttribute('data-ttg-gad'), { message: 'each unit initializes exactly once' })
        .toBe('requested');

      if (placement.outside) {
        await expect(ad.locator(placement.outside)).toHaveCount(0);
        await expect(page.locator(placement.outside).locator(placement.ad)).toHaveCount(0);
      }

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        const geometry = await page.evaluate(({ adSelector, beforeSelector }) => {
          const adElement = document.querySelector(adSelector) as HTMLElement | null;
          const beforeElement = document.querySelector(beforeSelector) as HTMLElement | null;
          if (!adElement || !beforeElement) return null;
          const adRect = adElement.getBoundingClientRect();
          const beforeRect = beforeElement.getBoundingClientRect();
          return {
            withinViewport: adRect.left >= -1 && adRect.right <= window.innerWidth + 1,
            belowPrecedingContent: adRect.top >= beforeRect.bottom,
            noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 4,
          };
        }, { adSelector: placement.ad, beforeSelector: placement.before });
        expect(geometry, `${width}px geometry is available`).not.toBeNull();
        expect(geometry?.withinViewport, `${width}px ad fits its container`).toBeTruthy();
        expect(geometry?.belowPrecedingContent, `${width}px ad follows the approved content`).toBeTruthy();
        expect(geometry?.noHorizontalOverflow, `${width}px page has no new horizontal overflow`).toBeTruthy();
      }

      await ins.evaluate((element) => element.setAttribute('data-ad-status', 'unfilled'));
      await expect(ad, 'unfilled units collapse').toBeHidden();
    });
  }
});
