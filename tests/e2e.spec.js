import { test, expect } from '@playwright/test';

const STOCKING_PATH = '/stocking.html';
const SPECIES_QUERY = /neon/i;

async function capture(page, testInfo, filename) {
  const screenshotPath = testInfo.outputPath(filename);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(filename, { path: screenshotPath, contentType: 'image/png' });
}

async function waitForOptions(locator) {
  await expect
    .poll(async () => locator.evaluate((el) => (el && 'options' in el ? el.options.length : 0)))
    .toBeGreaterThan(1);
}

async function selectTank(page, gallons) {
  const control = page.getByTestId('tank-gallons');
  await expect(control).toBeVisible();
  await waitForOptions(control);
  await control.focus();
  await page.keyboard.type(String(gallons));
  const optionValue = await control.evaluate((el, value) => {
    const matcher = new RegExp(String(value));
    const match = Array.from(el.options).find((opt) => matcher.test(opt.textContent || ''));
    return match ? match.value : '';
  }, gallons);
  if (optionValue) {
    await control.selectOption(optionValue);
  }
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('tank-summary')).toContainText(`${gallons}`, { timeout: 6000 });
  return control;
}

async function focusByTab(page, target, { maxTabs = 40, reset = true } = {}) {
  if (reset) {
    await page.locator('body').click({ position: { x: 1, y: 1 } });
  }
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return { testId: null, id: null };
      return {
        testId: el.getAttribute('data-testid'),
        id: el.id || null,
      };
    });
    if (active.testId === target || (!active.testId && active.id === target)) {
      return;
    }
  }
  throw new Error(`Unable to focus element matching ${target}`);
}

async function recordFocusSequence(page, steps) {
  const sequence = [];
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return { testId: null, id: null, label: null };
      return {
        testId: el.getAttribute('data-testid'),
        id: el.id || null,
        label: el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName,
      };
    });
    sequence.push(info.testId || info.id || info.label);
  }
  return sequence;
}

test.describe('Stocking Advisor accessibility flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STOCKING_PATH);
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('Page load renders hero and main landmark', async ({ page }, testInfo) => {
    await expect(page).toHaveTitle(/Stocking Advisor/i);
    await expect(page.getByRole('heading', { level: 1, name: /Stocking Advisor/i })).toBeVisible();
    await capture(page, testInfo, 'stocking-load.png');
  });

  test('Planted mode toggle supports mouse and keyboard', async ({ page }, testInfo) => {
    const toggle = page.getByTestId('toggle-planted');
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await capture(page, testInfo, 'toggle-planted-pointer.png');

    await focusByTab(page, 'toggle-planted');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await capture(page, testInfo, 'toggle-planted-keyboard.png');
  });

  test('Tank selection updates summary and stock meters', async ({ page }, testInfo) => {
    await selectTank(page, 40);

    const summary = page.getByTestId('tank-summary');
    await expect(summary).toContainText(/40/);

    const bars = page.locator('[data-testid="stock-bars"] .env-bar__fill').first();
    await expect(bars).toBeVisible();
    await capture(page, testInfo, 'tank-selection.png');
  });

  test('Variant selector works with mouse and restores focus', async ({ page }, testInfo) => {
    await selectTank(page, 40);

    const toggle = page.getByTestId('variant-toggle');
    await expect(toggle).toBeVisible();

    await toggle.click();
    const options = page.getByTestId('variant-option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);

    let target = options.nth(0);
    for (let i = 0; i < optionCount; i += 1) {
      const option = options.nth(i);
      if ((await option.getAttribute('data-active')) === 'false') {
        target = option;
        break;
      }
    }
    const targetText = (await target.textContent())?.trim() || '';
    await target.click();

    await expect(toggle).toBeFocused();
    await expect(page.getByTestId('tank-summary')).toContainText(targetText, { timeout: 6000 });
    await expect(page.getByTestId('variant-selector')).toHaveCount(0);
    await capture(page, testInfo, 'variant-selector.png');
  });

  test('Species add/remove flow updates state visually', async ({ page }, testInfo) => {
    await selectTank(page, 29);

    const bars = page.locator('[data-testid="stock-bars"] .env-bar__fill').first();
    await expect(bars).toBeVisible();
    const baselineWidth = await bars.evaluate((el) => el.style.width || '');

    const speciesInput = page.getByTestId('species-search');
    await waitForOptions(speciesInput);
    await speciesInput.focus();
    await page.keyboard.type('neon');
    const optionValue = await speciesInput.evaluate((el, query) => {
      const matcher = new RegExp(query, 'i');
      const match = Array.from(el.options).find((opt) => matcher.test(opt.textContent || ''));
      return match ? match.value : '';
    }, SPECIES_QUERY.source);
    if (optionValue) {
      await speciesInput.selectOption(optionValue);
    }

    await page.getByTestId('btn-add-species').click();

    const list = page.getByTestId('species-list');
    await expect(list.locator('[data-testid="species-row"]').first()).toContainText(/neon/i, {
      timeout: 6000,
    });
    await expect.poll(async () => bars.evaluate((el) => el.style.width || '')).not.toBe(baselineWidth);
    await capture(page, testInfo, 'species-added.png');

    await focusByTab(page, 'btn-remove-species');
    const removeButton = page.getByTestId('btn-remove-species').first();
    await expect(removeButton).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(list.locator('[data-testid="species-row"]')).toHaveCount(0);
    await expect(list).toContainText(/No stock yet/i);
    await capture(page, testInfo, 'species-removed.png');
  });

  test('Contextual info buttons reveal guidance on demand', async ({ page }) => {
    await selectTank(page, 29);

    const popover = page.locator('.ttg-popover');
    await expect(popover).not.toBeVisible();

    const targets = [
      {
        name: 'Tank Size header',
        locator: page.locator('#tank-size-card .card-title .info-btn'),
        text: 'Pick a standard tank size to get accurate capacity, footprint, and weight.',
      },
      {
        name: 'Planted toggle',
        locator: page.locator('#tank-size-card .toggle-title .info-btn'),
        text: 'Planted tanks allow higher bioload and provide stability. Toggle ON if you keep live plants.',
      },
      {
        name: 'Current Stock header',
        locator: page.locator('#stock-list-card .card__hd .info-btn'),
        text: 'This list shows species you’ve added and their quantities. Use +/− to adjust and Remove to clear.',
      },
      {
        name: 'Environmental Recommendations header',
        locator: page.locator('#env-card .card__title-stack .info-btn'),
        text: 'Derived from your selected stock. Ranges reflect compatible overlaps across all species.',
      },
      {
        name: 'Bioload bar',
        locator: page.locator('#env-bars .env-bar__label .info-btn').first(),
        text: 'Approximate stocking level for your tank size. Stay in green for better stability.',
      },
      {
        name: 'Aggression bar',
        locator: page.locator('#env-bars .env-bar__label .info-btn').nth(1),
        text: 'Estimated compatibility risk. Adding aggressive or territorial species will raise this.',
      },
    ];

    for (const target of targets) {
      await expect.soft(target.locator, `${target.name} info button`).toBeVisible();

      await target.locator.click();
      await expect(popover).toBeVisible();
      await expect(popover).toContainText(target.text);

      await page.keyboard.press('Escape');
      await expect(popover).not.toBeVisible();

      await target.locator.click();
      await expect(popover).toBeVisible();
      await expect(popover).toContainText(target.text);

      await page.locator('body').click({ position: { x: 4, y: 4 } });
      await expect(popover).not.toBeVisible();
    }
  });

  test('Gear CTA navigates with keyboard activation', async ({ page }) => {
    await focusByTab(page, 'btn-gear');
    const cta = page.getByTestId('btn-gear');
    await expect(cta).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/gear\.html$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/stocking\.html$/);
  });

  test('Tab order includes primary interactive controls', async ({ page }, testInfo) => {
    const sequence = await recordFocusSequence(page, 12);
    await testInfo.attach('focus-sequence.json', {
      body: JSON.stringify(sequence, null, 2),
      contentType: 'application/json',
    });
    const normalized = sequence.filter(Boolean);
    const expected = ['toggle-planted', 'tank-gallons', 'species-search', 'btn-add-species', 'btn-gear'];
    for (const id of expected) {
      expect(normalized).toContain(id);
    }
  });
});
