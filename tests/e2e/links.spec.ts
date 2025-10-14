import { test, expect } from '@playwright/test';

const INTERNAL_PREFIXES = ['/', 'index.html'];

test.describe('Primary link integrity', () => {
  test('main navigation and footer internal links resolve', async ({ page, baseURL }) => {
    await page.goto('/');

    await page.waitForSelector('#global-nav .site-links a');
    await page.waitForSelector('footer.site-footer');

    const anchors = await page.$$eval('#global-nav a, footer.site-footer a', (els) =>
      els
        .map((el) => el.getAttribute('href') || '')
        .filter((href) => Boolean(href))
    );

    const uniqueInternal = Array.from(
      new Set(
        anchors.filter((href) => {
          if (!href) return false;
          if (href.startsWith('mailto:') || href.startsWith('https://') || href.startsWith('http://')) {
            try {
              const url = new URL(href, baseURL ?? 'http://localhost:8080');
              return url.origin === new URL(baseURL ?? 'http://localhost:8080').origin;
            } catch (error) {
              return false;
            }
          }
          return INTERNAL_PREFIXES.some((prefix) => href.startsWith(prefix));
        })
      )
    );

    for (const href of uniqueInternal) {
      const url = new URL(href, baseURL ?? 'http://localhost:8080');
      const response = await page.request.get(url.toString());
      expect(response.ok()).toBeTruthy();
    }
  });
});
