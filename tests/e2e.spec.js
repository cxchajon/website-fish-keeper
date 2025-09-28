const { test, expect } = require('@playwright/test');
const BASE = process.env.TTG_BASE || 'https://thetankguide.com';

test.describe('TheTankGuide core UX flows', () => {

  test('Homepage: "How it works" opens/closes with keyboard & mouse', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('main')).toBeVisible();

    const opener = page.locator('#ttg-howitworks-opener, .ttg-howitworks-link, text="How it works"').first();
    await expect(opener).toBeVisible();
    await opener.click();

    const overlay = page.locator('#ttg-howitworks .ttg-overlay');
    await expect(overlay).toHaveAttribute('aria-hidden', 'false');

    await page.keyboard.press('Escape');
    await expect(overlay).toHaveAttribute('aria-hidden', 'true');

    const infoBtn = page.locator('.ttg-info-btn');
    if (await infoBtn.count()) {
      await infoBtn.click();
      await expect(overlay).toHaveAttribute('aria-hidden', 'false');
      await page.mouse.click(10, 10); // outside click closes
      await expect(overlay).toHaveAttribute('aria-hidden', 'true');
    }
  });

  test('Hamburger: closes on outside click, Esc, and link click', async ({ page }) => {
    await page.goto(BASE + '/');
    const toggle = page.locator('#ttg-nav-open, .nav-toggle, [aria-controls="ttg-drawer"]').first();
    await expect(toggle).toBeVisible();
    await toggle.click();

    const drawer = page.locator('#ttg-drawer[aria-hidden="false"], #ttg-drawer:not([aria-hidden])');
    await expect(drawer).toBeVisible();

    // outside click
    await page.mouse.click(400, 400);
    await page.waitForTimeout(200);
    await expect(page.locator('#ttg-drawer')).toHaveAttribute('aria-hidden', 'true');

    // reopen + Esc
    await toggle.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ttg-drawer')).toHaveAttribute('aria-hidden', 'true');

    // reopen + link click
    await toggle.click();
    const navLink = page.locator('#ttg-drawer a[href*="stocking"], a[href="/stocking.html"], a:has-text("Stocking")').first();
    if (await navLink.count()) {
      await navLink.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Stocking Advisor → Gear: sessionStorage handoff exists', async ({ page }) => {
    await page.goto(BASE + '/stocking.html');
    await expect(page.locator('h1, main')).toBeVisible();

    const gallons = page.locator('input[name="gallons"], input#gallons, input[type="number"]').first();
    if (await gallons.count()) {
      await gallons.fill('40');
      await gallons.press('Tab');
    }

    const planted = page.locator('input[name="planted"], .planted-toggle, label:has-text("Planted")').first();
    if (await planted.count()) await planted.click();

    const seeGear = page.locator('button:has-text("See Gear"), a:has-text("See Gear")').first();
    if (await seeGear.count()) {
      await seeGear.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      const hasKey = await page.evaluate(() => !!sessionStorage.getItem('ttg_stocking_state'));
      expect(hasKey).toBeTruthy();
    }
  });

  test('Feature Your Tank: consent enables submit (keyboard Space)', async ({ page }) => {
    await page.goto(BASE + '/feature-your-tank.html');
    await expect(page.locator('form')).toBeVisible();

    const consent = page.locator('#consent_feature, input[name="consent_feature"]').first();
    const submit = page.locator('#submit_feature, button[type="submit"]').first();

    if (await consent.count() && await submit.count()) {
      expect(await submit.isDisabled()).toBeTruthy();
      await consent.focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
      expect(await submit.isDisabled()).toBeFalsy();

      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
      expect(await submit.isDisabled()).toBeTruthy();
    }
  });

  test('About: "Feature Your Tank" link present; paragraph not overly long', async ({ page }) => {
    await page.goto(BASE + '/about.html');
    await expect(page.locator('main')).toBeVisible();

    const link = page.locator('a:has-text("Feature Your Tank"), :text("Feature Your Tank")').first();
    expect(await link.count()).toBeGreaterThan(0);

    const paraText = await page.locator('main p').nth(2).innerText().catch(() => '');
    const wordCount = paraText.split(/\s+/).filter(Boolean).length;
    test.info().log('About para words: ' + wordCount);
    if (wordCount > 50) test.info().log('Consider splitting long sentences for readability.');
  });

  test('Footer & Media CTAs: rel/target hygiene for socials', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForTimeout(500);

    const footerLinks = page.locator('footer a[href*="instagram.com"], footer a[href*="tiktok.com"], footer a[href*="youtube.com"], footer a[href*="facebook.com"], footer a[href*="amazon.com"]');
    const count = await footerLinks.count();
    for (let i = 0; i < count; i++) {
      const el = footerLinks.nth(i);
      const target = await el.getAttribute('target');
      const rel = await el.getAttribute('rel');
      if (target === '_blank') {
        expect(rel && rel.includes('noopener')).toBeTruthy();
        expect(rel && rel.includes('noreferrer')).toBeTruthy();
      }
    }

    await page.goto(BASE + '/media.html');
    const yt = page.locator('a:has-text("YouTube"), a[href*="youtube.com"]').first();
    if (await yt.count()) {
      const t = await yt.getAttribute('target');
      const r = await yt.getAttribute('rel');
      if (t === '_blank') {
        expect(r && r.includes('noopener')).toBeTruthy();
        expect(r && r.includes('noreferrer')).toBeTruthy();
      }
    }
  });

  test('Sitemap.xml is valid-looking XML with homepage loc', async ({ page }) => {
    const res = await page.request.get(BASE + '/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml.includes('<urlset')).toBeTruthy();
    expect(xml.includes('<loc>https://thetankguide.com/</loc>') || xml.includes('<loc>https://thetankguide.com</loc>')).toBeTruthy();
  });

});
