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

      // /blogs/ loads its page bundle asynchronously (preload, then rel="stylesheet" on load). Until it
      // applies, the card thumbnails render at natural size and the page is ~2760px wide with or without
      // the unit, so measure only once every same-origin stylesheet has applied.
      await page.waitForLoadState('load');
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const sameOrigin = (link: HTMLLinkElement) => new URL(link.href, location.href).origin === location.origin;
              const pending = [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="style"]')].filter(sameOrigin);
              const sheets = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].filter(sameOrigin);
              return pending.length === 0 && sheets.every((link) => link.sheet !== null);
            }),
          { message: 'page stylesheets applied before measuring' },
        )
        .toBe(true);

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
          const root = document.documentElement;
          const scrollWidth = root.scrollWidth;
          // Baseline: the same page at the same width without the unit. Overflow that predates Phase B4
          // (e.g. the site navigation between ~1024px and 1290px) is not the unit's; anything above it is.
          const display = adElement.style.display;
          adElement.style.display = 'none';
          const baselineScrollWidth = root.scrollWidth;
          adElement.style.display = display;
          return {
            withinViewport: adRect.left >= -1 && adRect.right <= window.innerWidth + 1,
            belowPrecedingContent: adRect.top >= beforeRect.bottom,
            clientWidth: root.clientWidth,
            scrollWidth,
            baselineScrollWidth,
            noNewHorizontalOverflow: scrollWidth <= Math.max(root.clientWidth + 4, baselineScrollWidth),
          };
        }, { adSelector: placement.ad, beforeSelector: placement.before });
        expect(geometry, `${width}px geometry is available`).not.toBeNull();
        expect(geometry?.withinViewport, `${width}px ad fits its container`).toBeTruthy();
        expect(geometry?.belowPrecedingContent, `${width}px ad follows the approved content`).toBeTruthy();
        if (geometry && geometry.baselineScrollWidth > geometry.clientWidth + 4) {
          test.info().annotations.push({
            type: 'pre-existing overflow',
            description: `${placement.path} @ ${width}px: ${geometry.baselineScrollWidth}px wide without the unit (viewport ${geometry.clientWidth}px)`,
          });
        }
        expect(
          geometry?.noNewHorizontalOverflow,
          `${width}px page has no new horizontal overflow (scrollWidth ${geometry?.scrollWidth}, without the unit ${geometry?.baselineScrollWidth}, viewport ${geometry?.clientWidth})`,
        ).toBeTruthy();
      }

      await ins.evaluate((element) => element.setAttribute('data-ad-status', 'unfilled'));
      await expect(ad, 'unfilled units collapse').toBeHidden();
    });
  }
});
