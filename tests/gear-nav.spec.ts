import { test, expect } from '@playwright/test';

test.describe('Gear page navigation landmarks', () => {
  test('renders only the global navigation', async ({ page }) => {
    await page.goto('/gear/', { waitUntil: 'networkidle' });
    // The shared header carries the primary nav (plus its mobile drawer) and the shared footer its
    // links; the page itself must not add a navigation landmark of its own.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(1);
    await expect(page.locator('main').getByRole('navigation')).toHaveCount(0);
  });
});
