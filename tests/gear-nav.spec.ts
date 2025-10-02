import { test, expect } from '@playwright/test';

test.describe('Gear page navigation landmarks', () => {
  test('renders only the global navigation', async ({ page }) => {
    await page.goto('/gear/', { waitUntil: 'networkidle' });
    const navs = await page.getByRole('navigation').all();
    expect(navs.length).toBe(1);
  });
});
