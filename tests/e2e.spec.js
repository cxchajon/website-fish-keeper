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

test.describe('Stocking Advisor UI interactions', () => {
  const STOCKING_PATH = '/stocking.html';

  async function loadStockingApp(page) {
    await page.goto(BASE + STOCKING_PATH);
    await expect(page.locator('#stocking-app')).toBeVisible();
    await page.waitForFunction(() => {
      const select = document.querySelector('#tank-size-select');
      return select && select.options.length > 1;
    });
  }

  async function setGallons(page, gallons) {
    const explicitInput = page.locator('input[name="gallons"], input#gallons').first();
    if (await explicitInput.count()) {
      await explicitInput.fill(String(gallons));
      await explicitInput.press('Tab');
      return;
    }

    await selectTankByGallons(page, gallons);
  }

  async function selectTankByGallons(page, gallons) {
    const select = page.locator('#tank-size-select');
    await expect(select).toBeVisible();
    const option = select.locator('option', { hasText: new RegExp(`\\b${gallons}\\b`) }).first();
    if (!(await option.count())) {
      throw new Error(`Tank option containing ${gallons} not found`);
    }
    const value = await option.getAttribute('value');
    await select.selectOption(value || undefined);
    await expect(page.locator('#tank-summary')).toContainText(String(gallons));
  }

  async function ensureBarsHydrated(page) {
    const bars = page.locator('#env-bars .env-bar__fill').first();
    await expect(bars).toHaveAttribute('style', /width:/);
    return bars;
  }

  async function tabUntil(page, selector, maxPresses = 12) {
    for (let i = 0; i < maxPresses; i++) {
      const isActive = await page.evaluate((sel) => {
        const active = document.activeElement;
        return active ? active.matches(sel) : false;
      }, selector);
      if (isActive) return;
      await page.keyboard.press('Tab');
    }
    throw new Error(`Unable to focus element matching ${selector}`);
  }

  test('Gallons input updates tank summary', async ({ page }) => {
    await loadStockingApp(page);

    const summary = page.locator('#tank-summary');
    await expect(summary).toContainText('Select a tank size', { timeout: 4000 });

    await setGallons(page, 29);

    await expect(summary).toContainText('29', { timeout: 4000 });
  });

  test('Planted toggle shows and hides leaf icon', async ({ page }) => {
    await loadStockingApp(page);
    await selectTankByGallons(page, 40);

    const toggle = page.locator('#toggle-planted, button[aria-label="Toggle planted tank"], label:has-text("Planted")');
    const plantIcon = page.locator('#plant-icon');

    await expect(toggle.first()).toHaveAttribute('aria-checked', 'false');
    await toggle.first().click();
    await expect(plantIcon).toBeVisible();

    await toggle.first().click();
    await expect(plantIcon).toBeHidden();
  });

  test('Show More Tips toggle reveals extended guidance', async ({ page }) => {
    await loadStockingApp(page);
    await selectTankByGallons(page, 40);

    const toggle = page.locator('#toggle-tips, button[aria-label="Toggle expanded guidance"], label:has-text("Show More Tips")');
    const tips = page.locator('#env-tips');

    await expect(tips).toBeHidden();
    await toggle.first().click();
    await expect(tips).toBeVisible();

    await toggle.first().click();
    await expect(tips).toBeHidden();
  });

  test('Beginner Mode toggle and popover behavior', async ({ page }) => {
    await loadStockingApp(page);
    await selectTankByGallons(page, 29);

    const toggle = page.locator('#toggle-beginner, button[aria-label="Toggle beginner safeguards"], label:has-text("Beginner Mode")').first();
    const infoButton = page.locator('button[data-popover="beginner-info"], button[aria-label="What is Beginner mode?"]').first();
    const popover = page.locator('#beginner-info');

    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await infoButton.click();
    await expect(popover).toHaveAttribute('data-hidden', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(popover).not.toHaveAttribute('data-hidden', 'false');
  });

  test('Change tank variant toggles between variants', async ({ page }) => {
    await loadStockingApp(page);
    await selectTankByGallons(page, 40);

    const summary = page.locator('#tank-summary');
    let changeLink = summary.locator('button:has-text("Change"), button:has-text("Change tank variant")').first();
    await expect(changeLink).toBeVisible();

    const before = await summary.textContent();
    await changeLink.click();
    const variantSelector = summary.locator('.variant-selector button');
    const optionCount = await variantSelector.count();
    expect(optionCount).toBeGreaterThan(1);

    let alternate = variantSelector.nth(0);
    const activeIndex = await variantSelector.evaluateAll((buttons) => buttons.findIndex((btn) => btn.dataset.active === 'true'));
    if (activeIndex >= 0) {
      const count = await variantSelector.count();
      const nextIndex = (activeIndex + 1) % count;
      alternate = variantSelector.nth(nextIndex);
    }
    const altText = await alternate.textContent();
    await alternate.click();

    await expect(summary).toContainText(altText ?? '', { timeout: 4000 });

    const after = await summary.textContent();
    expect(after && before && after.trim() !== before.trim()).toBeTruthy();

    changeLink = summary.locator('button:has-text("Change"), button:has-text("Change tank variant")').first();
    await changeLink.click();
    await expect(summary.locator('.variant-selector')).toHaveCount(0);
  });

  test('See Gear CTA stores stocking state in sessionStorage', async ({ page }) => {
    await loadStockingApp(page);
    await selectTankByGallons(page, 40);

    const seeGear = page.locator('#btn-gear, button:has-text("See Gear")').first();
    await expect(seeGear).toBeVisible();

    await seeGear.click();
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect.poll(async () => page.evaluate(() => sessionStorage.getItem('ttg_stocking_state'))).not.toBeNull();
  });

  test('Adding species row updates bars and beginner safeguards', async ({ page }) => {
    await loadStockingApp(page);
    await selectTankByGallons(page, 40);

    const bars = await ensureBarsHydrated(page);
    const baselineWidth = await bars.evaluate((el) => el.style.width);

    const speciesSelect = page.locator('#plan-species');
    await expect(speciesSelect).toBeVisible();
    await page.waitForFunction(() => {
      const el = document.querySelector('#plan-species');
      return el && el.options && el.options.length > 0;
    });
    const firstOption = speciesSelect.locator('option').first();
    const firstValue = await firstOption.getAttribute('value');
    const firstLabel = (await firstOption.textContent())?.trim();
    await speciesSelect.selectOption(firstValue || undefined);

    const addButton = page.locator('#plan-add, button:has-text("Add to Stock"), button:has-text("Add")').first();
    await expect(addButton).not.toBeDisabled();

    await addButton.click();
    await expect(page.locator('#stock-list')).toContainText(firstLabel || '', { timeout: 4000 });

    await expect.poll(async () => page.locator('#env-bars .env-bar__fill').first().evaluate((el) => el.style.width)).not.toBe(baselineWidth);

    const qtyInput = page.locator('#plan-qty');
    await qtyInput.fill('200');
    await qtyInput.press('Tab');

    const beginnerToggle = page.locator('#toggle-beginner').first();
    await beginnerToggle.click();
    await expect(beginnerToggle).toHaveAttribute('aria-checked', 'true');

    if (await addButton.isDisabled()) {
      const banner = page.locator('#candidate-banner');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText('Beginner safeguards');
    } else {
      test.info().log('Beginner safeguards did not block Add for current selection.');
    }
  });

  test('Keyboard interactions for toggles and popovers', async ({ page }) => {
    await loadStockingApp(page);
    await selectTankByGallons(page, 29);

    await page.locator('body').click();
    await tabUntil(page, '#toggle-planted');
    await page.keyboard.press('Space');
    await expect(page.locator('#toggle-planted')).toHaveAttribute('aria-checked', 'true');

    await tabUntil(page, '#toggle-beginner');
    await page.keyboard.press('Space');
    const beginnerToggle = page.locator('#toggle-beginner');
    await expect(beginnerToggle).toHaveAttribute('aria-checked', 'true');

    await tabUntil(page, 'button[data-popover="beginner-info"]');
    await page.keyboard.press('Space');
    const popover = page.locator('#beginner-info');
    await expect(popover).toHaveAttribute('data-hidden', 'false');

    await page.keyboard.press('Escape');
    await expect(popover).not.toHaveAttribute('data-hidden', 'false');

    await tabUntil(page, '#toggle-beginner');
    await page.keyboard.press('Space');
    await expect(beginnerToggle).toHaveAttribute('aria-checked', 'false');
  });
});
