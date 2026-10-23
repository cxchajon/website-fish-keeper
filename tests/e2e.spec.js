import { test, expect } from '@playwright/test';

const STOCKING_PATH = '/stocking-advisor.html';
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
  await expect(page.locator('[data-role="tank-spec"]')).toContainText(`${gallons}`, { timeout: 6000 });
  return control;
}

async function selectSpecies(page, query) {
  const speciesInput = page.getByTestId('species-search');
  await waitForOptions(speciesInput);
  await speciesInput.focus();
  await page.keyboard.type('neon');
  const optionValue = await speciesInput.evaluate((el, source) => {
    const matcher = new RegExp(source, 'i');
    const match = Array.from(el.options).find((opt) => matcher.test(opt.textContent || ''));
    return match ? match.value : '';
  }, query.source);
  if (optionValue) {
    await speciesInput.selectOption(optionValue);
  }
}

async function addSpecies(page, query) {
  await selectSpecies(page, query);
  await page.getByTestId('btn-add-species').click();
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

  test('Tank selection updates summary and stock meters', async ({ page }, testInfo) => {
    await selectTank(page, 40);

    const facts = page.locator('[data-role="tank-spec"]');
    await expect(facts).toContainText(/40/);

    // The stock meters stay collapsed until the first species is added.
    const bars = page.locator('[data-testid="stock-bars"] .env-bar__fill').first();
    await expect(bars).toBeHidden();
    await addSpecies(page, SPECIES_QUERY);
    await expect(bars).toBeVisible();
    await capture(page, testInfo, 'tank-selection.png');
  });

  test('Species add/remove flow updates state visually', async ({ page }, testInfo) => {
    await selectTank(page, 29);

    const bars = page.locator('[data-testid="stock-bars"] .env-bar__fill').first();
    await expect(bars).toBeHidden();
    const baselineWidth = await bars.evaluate((el) => el.style.width || '');

    await addSpecies(page, SPECIES_QUERY);

    const list = page.getByTestId('species-list');
    await expect(list.locator('[data-testid="species-row"]').first()).toContainText(/neon/i, {
      timeout: 6000,
    });
    await expect(bars).toBeVisible();
    await expect.poll(async () => bars.evaluate((el) => el.style.width || '')).not.toBe(baselineWidth);
    await capture(page, testInfo, 'species-added.png');

    await focusByTab(page, 'btn-remove-species');
    const removeButton = page.getByTestId('btn-remove-species').first();
    await expect(removeButton).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(list.locator('[data-testid="species-row"]')).toHaveCount(0);
    await expect(list).toContainText(/No stock yet/i);
    await expect(bars).toBeHidden();
    await capture(page, testInfo, 'species-removed.png');
  });

  test('Contextual info buttons reveal guidance on demand', async ({ page }) => {
    await selectTank(page, 29);
    // The bioload guide lives on the stock meters, which render once stock exists.
    await addSpecies(page, SPECIES_QUERY);

    const targets = [
      { name: 'Tank Size header', panel: '#pop-tank-size', text: 'Tank size picker' },
      { name: 'Filter product', panel: '#pop-filter-product', text: 'Picking a filter' },
      { name: 'Turnover', panel: '#turnover-tip', text: 'Estimated turnover' },
      { name: 'Stocking checklist', panel: '#pop-stocking-checklist', text: 'Responsible Stocking Checklist' },
      { name: 'Environmental Recommendations header', panel: '#pop-env-info', text: 'Environmental Card Guide' },
      { name: 'Bioload gauge', panel: '#bioload-info-panel', text: 'Bioload capacity guide' },
    ];

    for (const target of targets) {
      const trigger = page.locator(`.info-btn[aria-controls="${target.panel.slice(1)}"]`);
      const panel = page.locator(target.panel);
      await expect.soft(trigger, `${target.name} info button`).toBeVisible();
      await expect(panel).toBeHidden();

      for (const key of ['Enter', 'Space']) {
        await trigger.focus();
        await page.keyboard.press(key);
        await expect(panel, `${target.name} opens with ${key}`).toBeVisible();
        await expect(panel).toContainText(target.text);
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');

        await page.keyboard.press('Escape');
        await expect(panel, `${target.name} closes with Escape`).toBeHidden();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      }
    }
  });

  test('Add to Stock stays clickable while the recompute spinner shows', async ({ page }) => {
    // Each edit shows a short "is-loading" spinner on Add until the recompute runs. A click in that
    // window must still reach the button; it used to fall through to the row behind it.
    const add = page.getByTestId('btn-add-species');
    await add.scrollIntoViewIfNeeded();
    await add.evaluate((button) => {
      window.__addBusyHits = [];
      new MutationObserver(() => {
        if (!button.classList.contains('is-loading')) return;
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        window.__addBusyHits.push(hit === button || button.contains(hit));
      }).observe(button, { attributes: true, attributeFilter: ['class'] });
    });
    await selectSpecies(page, SPECIES_QUERY);
    await page.locator('#plan-qty').fill('8');
    await expect.poll(() => page.evaluate(() => window.__addBusyHits.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__addBusyHits)).not.toContain(false);
  });

  test('Gear CTA stores payload and navigates with keyboard activation', async ({ page }) => {
    await selectTank(page, 40);

    await focusByTab(page, 'btn-gear');
    const cta = page.getByTestId('btn-gear');
    await expect(cta).toBeFocused();

    await expect(cta).toHaveAttribute('href', /\/gear\/\?tank_g=40(&|$)/);
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/gear\/\?tank_g=40(&|$)/);

    const payloadRaw = await page.evaluate(() => sessionStorage.getItem('ttg_stocking_state'));
    expect(payloadRaw).toBeTruthy();
    const payload = JSON.parse(payloadRaw || '{}');
    expect(payload?.v).toBe('1.0');
    expect(payload?.tank?.gallons_total).toBe(40);
    expect(payload?.targets?.turnover_band).toBeTruthy();
    expect(payload?.flags).toBeDefined();

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/stocking-advisor\.html$/);
  });

  test('Tab order includes primary interactive controls', async ({ page }, testInfo) => {
    // "Add to Stock" stays disabled (and out of the tab order) until a species is chosen.
    await expect(page.getByTestId('btn-add-species')).toBeDisabled();
    await selectSpecies(page, SPECIES_QUERY);
    await expect(page.getByTestId('btn-add-species')).toBeEnabled();

    // The shared site navigation comes first in the tab order, ahead of the tool's controls.
    const sequence = await recordFocusSequence(page, 60);
    await testInfo.attach('focus-sequence.json', {
      body: JSON.stringify(sequence, null, 2),
      contentType: 'application/json',
    });
    const normalized = sequence.filter(Boolean);
    const expected = ['tank-gallons', 'species-search', 'btn-add-species', 'btn-gear'];
    for (const id of expected) {
      expect(normalized).toContain(id);
    }
    const positions = expected.map((id) => normalized.indexOf(id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

test.describe('Contact & Feedback page', () => {
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xnngnwld';
  let formspreeRequests = [];

  // Never let a test reach the real Formspree service: every Formspree request is recorded
  // and aborted unless a test registers its own mocked response.
  test.beforeEach(async ({ page }) => {
    formspreeRequests = [];
    await page.route(/^https:\/\/([a-z0-9-]+\.)*formspree\.io\//, async (route) => {
      formspreeRequests.push(route.request());
      await route.abort('blockedbyclient');
    });
    await page.goto('/contact-feedback.html');
    await expect(page.getByRole('main')).toBeVisible();
  });

  const nameInput = (page) => page.getByRole('textbox', { name: /^Name/ });
  const emailInput = (page) => page.getByRole('textbox', { name: /^Email/ });
  const subjectSelect = (page) => page.getByRole('combobox', { name: /^Subject/ });
  const messageInput = (page) => page.getByRole('textbox', { name: /^Message/ });
  const permissionCheckbox = (page) => page.getByRole('checkbox', { name: /okay to email me back/i });
  const newsletterCheckbox = (page) => page.getByRole('checkbox', { name: /occasional email updates/i });
  const submitButton = (page) => page.locator('#contact-form').getByRole('button', { name: 'Contact & Feedback' });

  test('Page surface matches naming and exposes form semantics', async ({ page }) => {
    await expect(page).toHaveTitle('Contact & Feedback — Fishkeeping Questions | The Tank Guide');
    await expect(page.getByRole('heading', { level: 1, name: 'Contact & Feedback for Fishkeeping Guides' })).toBeVisible();

    const form = page.locator('#contact-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('action', FORMSPREE_ENDPOINT);
    await expect(form).toHaveAttribute('method', /post/i);

    const requiredControls = [
      [nameInput(page), 'help-name'],
      [emailInput(page), 'help-email'],
      [subjectSelect(page), 'help-subject'],
      [messageInput(page), 'help-message'],
      [permissionCheckbox(page), 'help-contact-permission'],
    ];
    for (const [control, helpId] of requiredControls) {
      await expect(control).toBeVisible();
      await expect(control).toHaveAttribute('required', '');
      await expect(control).toHaveAttribute('aria-describedby', helpId);
    }
    await expect(emailInput(page)).toHaveAttribute('type', 'email');
    await expect(newsletterCheckbox(page)).toBeVisible();
    await expect(newsletterCheckbox(page)).not.toHaveAttribute('required', '');
    await expect(submitButton(page)).toBeVisible();

    const successBanner = page.locator('#success-message');
    await expect(successBanner).toHaveAttribute('role', 'status');
    await expect(successBanner).toBeHidden();

    const errorSummary = page.locator('#error-summary');
    await expect(errorSummary).toHaveAttribute('role', 'alert');
    await expect(errorSummary).toBeHidden();
  });

  test('Keyboard tab order reaches the form and follows its controls then submit', async ({ page }) => {
    // The global navigation comes first; the form must still be reachable from the top by keyboard alone.
    await focusByTab(page, 'contact-name', { maxTabs: 100 });
    await expect(nameInput(page)).toBeFocused();

    const order = [
      emailInput(page),
      subjectSelect(page),
      messageInput(page),
      permissionCheckbox(page),
      newsletterCheckbox(page),
      submitButton(page),
    ];
    for (const control of order) {
      await page.keyboard.press('Tab');
      await expect(control).toBeFocused();
    }
  });

  test('Invalid submission surfaces the error summary and field help without sending', async ({ page }) => {
    await submitButton(page).click();

    const errorSummary = page.locator('#error-summary');
    await expect(errorSummary).toBeVisible();
    await expect(errorSummary).toBeFocused();
    await expect(page.locator('#error-list li')).toHaveText([
      'Name is required.',
      'Email is required.',
      'Subject is required.',
      'Message is required.',
      'Email permission is required.',
    ]);

    const fieldHelp = [
      [nameInput(page), '#help-name', 'Name is required.'],
      [emailInput(page), '#help-email', 'Email is required.'],
      [subjectSelect(page), '#help-subject', 'Subject is required.'],
      [messageInput(page), '#help-message', 'Message is required.'],
      [permissionCheckbox(page), '#help-contact-permission', 'Email permission is required.'],
    ];
    for (const [control, helpSelector, message] of fieldHelp) {
      await expect(control).toHaveClass(/has-error/);
      await expect(page.locator(helpSelector)).toHaveClass(/visible/);
      await expect(page.locator(helpSelector)).toHaveText(message);
    }

    await expect(page.locator('#success-message')).toBeHidden();
    expect(formspreeRequests).toHaveLength(0);
  });

  test('Successful submission (mocked Formspree) resets the form and shows confirmation', async ({ page }) => {
    const submitted = [];
    await page.route(FORMSPREE_ENDPOINT, async (route) => {
      submitted.push(route.request());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await nameInput(page).fill('Jordan Tester');
    await emailInput(page).fill('jordan@example.com');
    await subjectSelect(page).selectOption('logic');
    await messageInput(page).fill('Found a small logic issue in the stocking advisor.');
    await permissionCheckbox(page).check();

    await submitButton(page).click();

    const successBanner = page.locator('#success-message');
    await expect(successBanner).toBeVisible();
    await expect(successBanner).toBeFocused();
    await expect(successBanner).toHaveText('Thanks! Your message was sent to the team.');
    await expect(page.locator('#error-summary')).toBeHidden();

    expect(submitted).toHaveLength(1);
    const request = submitted[0];
    expect(request.method()).toBe('POST');
    expect(request.headers()['accept']).toBe('application/json');
    const body = request.postData() || '';
    expect(body).toContain('Jordan Tester');
    expect(body).toContain('jordan@example.com');
    expect(body).toContain('logic');
    expect(body).toContain('Found a small logic issue in the stocking advisor.');
    expect(formspreeRequests).toHaveLength(0);

    await expect(nameInput(page)).toHaveValue('');
    await expect(emailInput(page)).toHaveValue('');
    await expect(subjectSelect(page)).toHaveValue('');
    await expect(messageInput(page)).toHaveValue('');
    await expect(permissionCheckbox(page)).not.toBeChecked();
    await expect(nameInput(page)).not.toHaveClass(/has-error/);
    await expect(submitButton(page)).toBeEnabled();
  });
});
