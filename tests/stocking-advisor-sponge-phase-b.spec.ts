// Sponge migration phase B on the real page (desktop and mobile). Part of the Stocking Advisor gate
// (`npm run test:e2e:stocking-gate`). Report: _internal/reports/stocking-advisor-sponge-migration-phase-b-2026-09.md
// Sponges are evaluated by their manufacturer tank rating; no sponge GPH or turnover is shown or scored.
import { test, expect, type Page } from '@playwright/test';

const V1 = 'ttg.stocking.filters.v1';
const V2 = 'ttg.stocking.filters.v2';
const HYGGER_S = 'hygger-double-sponge-s';
const HYGGER_M = 'hygger-double-sponge-m';
const UNRATED = 'aquaneat-sponge-20';
// Legacy catalog "GPH" of every sponge; none may appear anywhere in the filtration UI.
const LEGACY_SPONGE_GPH = /\b(60|80|120|150|200) ?GPH\b/;

async function openAdvisor(page: Page) {
  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    return hostname === '127.0.0.1' || hostname === 'localhost' ? route.fallback() : route.abort();
  });
  await page.goto('/stocking-advisor.html');
  await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
}

async function seedStorage(page: Page, values: Record<string, string>) {
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.clear();
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
  }, values);
}

async function settle(page: Page) {
  await page.waitForTimeout(1500);
}

// Retried as a whole: on a slow start-up the first Add can land before the plan is ready.
async function setUpTank(page: Page, tankId: string) {
  await page.selectOption('#tank-size', tankId);
  const row = page.locator('[data-testid="species-row"][data-row-id="neon"]');
  await expect(async () => {
    if (await row.count()) return;
    await page.selectOption('#plan-species', 'neon', { timeout: 2000 });
    await page.fill('#plan-qty', '8', { timeout: 2000 });
    await page.click('#plan-add', { timeout: 2000 });
    await expect(row).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
}

async function addProduct(page: Page, id: string) {
  await expect.poll(() => page.locator(`#filter-product option[value="${id}"]`).count(), { timeout: 10000 }).toBe(1);
  await page.selectOption('#filter-product', id);
  await expect(page.locator('#filter-product-add')).toBeEnabled();
  await page.click('#filter-product-add');
  await expect(chip(page, id)).toBeVisible();
}

async function addCustomGph(page: Page, type: string, gph: number) {
  await page.selectOption('#fs-type', type);
  await page.fill('#fs-gph', String(gph));
  await page.click('#fs-add-custom');
}

async function addCustomSponge(page: Page, gallons: number) {
  await page.selectOption('#fs-type', 'Sponge');
  await page.fill('#fs-rated-gallons', String(gallons));
  await page.click('#fs-add-custom');
}

const chips = (page: Page) => page.locator('[data-role="proto-filter-chips"] .proto-filter-chip');
const chip = (page: Page, id: string) => page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${id}"]`);
// Phase G: filtration warnings are shown once, in the filtration status card (which lists the engine's
// filtration warning ids in data-warning-ids); every other warning stays a #stock-warnings strip.
const FILTRATION_CARD = '[data-role="filtration-status-card"]';
const warning = (page: Page, id: string) => (id.startsWith('filtration.')
  ? page.locator(`${FILTRATION_CARD}[data-warning-ids~="${id}"]`)
  : page.locator(`#stock-warnings .status-strip[data-warning-id="${id}"]`));
// A filtration warning is present when the card lists any engine filtration warning id.
const filtrationWarnings = (page: Page) => page.locator(`${FILTRATION_CARD}:not([data-warning-ids=""])`);
const summary = (page: Page) => page.locator('[data-role="proto-filter-summary"]');
const bioloadLabel = (page: Page) => page.locator('[data-role="bioload-percent"]').first();

async function engine(page: Page) {
  return page.evaluate(async () => {
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: Record<string, unknown> & { filters?: Array<Record<string, unknown>> } }).appState;
    const computed = compute.buildComputedState(appState);
    return {
      level: computed.filtering.level as string,
      adequateBy: computed.filtering.assessment.adequateBy as string | null,
      gph: [computed.filtering.gphTotal, computed.filtering.biologicalGph, computed.filtering.circulationGph] as number[],
      turnover: computed.filtering.turnover as number,
      filters: (appState.filters ?? []).map((filter) => [filter.id, filter.type, filter.rated_gph, filter.capacityMethod, filter.ratingStatus ?? null]),
      bioload: [computed.bioload.currentPercent, computed.bioload.proposedPercent, computed.bioload.text],
    };
  });
}

// Everything the filtration area and warnings show, as text.
async function filtrationText(page: Page) {
  return page.evaluate(() => [
    document.querySelector('.filter-flow-meta')?.textContent ?? '',
    document.querySelector('#stock-warnings')?.textContent ?? '',
    document.querySelector('[data-role="filtration-status-card"]')?.textContent ?? '',
    document.querySelector('.filtration-chipbar')?.getAttribute('data-total') ?? '',
  ].join(' ').replace(/\s+/g, ' ')
    // Phase G: the card's one permitted mention of an old custom sponge's GPH (design 12), never scored.
    .replace(/Old value: \d+ GPH — not used for sponge filters\./g, ''));
}

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

test.describe('sponge phase B', () => {
  test('custom input switches GPH ↔ rated gallons; values never carry over; messages match the field', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    const gph = page.locator('#fs-gph');
    const rated = page.locator('#fs-rated-gallons');
    const add = page.locator('#fs-add-custom');
    const hint = page.locator('#fs-gph-hint');

    // HOB → Sponge
    await page.selectOption('#fs-type', 'HOB');
    await expect(gph).toBeVisible();
    await expect(rated).toBeHidden();
    await gph.fill('150');
    await expect(add).toBeEnabled();
    await page.selectOption('#fs-type', 'Sponge');
    await expect(gph).toBeHidden();
    await expect(rated).toBeVisible();
    await expect(rated).toHaveValue('', { timeout: 1000 });
    await expect(page.locator('[data-role="fs-rating-field"]')).toContainText('Rated for up to');
    await expect(page.locator('[data-role="fs-rating-field"]')).toContainText('gallons');
    await expect(hint).toContainText('manufacturer rates this sponge for');
    await expect(add).toBeDisabled();
    // Invalid rating: the error is about gallons, not GPH.
    await rated.fill('0');
    await rated.press('Enter');
    await expect(hint).toContainText('whole number of gallons from 1 to 999');
    await expect(rated).toHaveAttribute('aria-invalid', 'true');
    await expect(chips(page)).toHaveCount(0);
    await rated.fill('40');
    await expect(add).toBeEnabled();

    // Sponge → Canister: the gallons value is not carried into GPH.
    await page.selectOption('#fs-type', 'Canister');
    await expect(rated).toBeHidden();
    await expect(gph).toBeVisible();
    await expect(gph).toHaveValue('');
    await expect(add).toBeDisabled();
    await expect(hint).not.toContainText('gallons from 1 to 999');
    await gph.press('Enter');
    await expect(hint).toContainText('positive flow value (GPH)');

    // Sponge → Powerhead, Powerhead → Sponge
    await page.selectOption('#fs-type', 'Sponge');
    await rated.fill('35');
    await page.selectOption('#fs-type', 'Powerhead');
    await expect(gph).toHaveValue('');
    await gph.fill('300');
    await page.selectOption('#fs-type', 'Sponge');
    await expect(rated).toHaveValue('');
    await expect(add).toBeDisabled();

    // A valid custom sponge: chip shows the rating, never GPH.
    await rated.fill('40');
    await add.click();
    await expect(chips(page)).toHaveCount(1);
    await expect(chips(page).first()).toContainText('Sponge filter');
    await expect(chips(page).first()).toContainText('Rated up to 40 gal');
    await expect(chips(page).first()).not.toContainText('GPH');
    await settle(page);
    const state = await engine(page);
    expect(state.level).toBe('adequate');
    expect(state.adequateBy).toBe('sponge');
    expect(state.gph).toEqual([0, 0, 0]);
    await expect(warning(page, 'filtration.sponge_rated')).toContainText('Rated for this tank');
    await expect(summary(page)).toHaveText('Filtration: 1 sponge filter (rated by tank size)');
  });

  test('verified Hygger: picker and chip show the rating; green on 29 gal, amber below rating on 55 gal', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    const before = await bioloadLabel(page).textContent();
    await expect.poll(() => page.locator(`#filter-product option[value="${HYGGER_S}"]`).count(), { timeout: 10000 }).toBe(1);
    await expect(page.locator(`#filter-product option[value="${HYGGER_S}"]`)).toHaveText(/• Sponge • Rated 10–40 gal$/);
    await expect(page.locator(`#filter-product option[value="${HYGGER_M}"]`)).toHaveText(/• Sponge • Rated 15–55 gal$/);
    await addProduct(page, HYGGER_S);
    await expect(chip(page, HYGGER_S)).toContainText('Rated 10–40 gal');
    await settle(page);
    let state = await engine(page);
    expect(state.level).toBe('adequate');
    expect(state.gph).toEqual([0, 0, 0]);
    const rated = warning(page, 'filtration.sponge_rated');
    // Phase G card: green (was a neutral "ok" note strip), the rating line and the tank.
    await expect(rated).toHaveAttribute('data-state', 'good');
    await expect(rated).toContainText('Rated for this tank');
    await expect(rated).toContainText('Sponge filter: rated 10–40 gal — rated for this tank');
    await expect(rated).toContainText('Tank: 29 gal');
    await expect(bioloadLabel(page)).toHaveText(before ?? '');
    expect(await filtrationText(page)).not.toMatch(LEGACY_SPONGE_GPH);

    await page.selectOption('#tank-size', '55g');
    await settle(page);
    state = await engine(page);
    expect(state.level).toBe('below-rating');
    const below = warning(page, 'filtration.below_rating');
    await expect(below).toHaveAttribute('data-state', 'warn');
    await expect(below).toContainText('Below manufacturer rating');
    await expect(below).toContainText('Sponge filter: rated 10–40 gal');
    await expect(below).toContainText('Tank: 55 gal');
    // The sponge stays chosen and selectable on the bigger tank.
    await expect(chip(page, HYGGER_S)).toBeVisible();
    await expect(page.locator(`#filter-product option[value="${HYGGER_S}"]`)).toHaveCount(1);
  });

  test('rating-needed product: selectable on any tank, "Rating needed", not evaluated, no GPH', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '75g');
    for (const id of ['aquaneat-sponge-10', 'aquaneat-sponge-20', 'aquaneat-sponge-60', 'pawfly-sponge-10', 'powkoo-dual-sponge-40']) {
      await expect.poll(() => page.locator(`#filter-product option[value="${id}"]`).count(), { timeout: 10000 }).toBe(1);
      await expect(page.locator(`#filter-product option[value="${id}"]`)).toHaveText(/• Sponge • Rating needed$/);
    }
    const options = await page.locator('#filter-product option').allTextContents();
    expect(options.filter((text) => /Sponge •/.test(text)).join(' ')).not.toMatch(/GPH|\d+ ?g\b|20 gal|60 gal/);
    await addProduct(page, UNRATED);
    await expect(chip(page, UNRATED)).toContainText('AQUANEAT Bio Sponge Filter — Middle');
    await expect(chip(page, UNRATED)).toContainText('Rating needed');
    await settle(page);
    const state = await engine(page);
    expect(state.level).toBe('not-evaluated');
    expect(state.gph).toEqual([0, 0, 0]);
    const note = warning(page, 'filtration.rating_needed');
    await expect(note).toHaveAttribute('data-state', 'neutral');
    await expect(note).toContainText('Not evaluated — rating needed');
    await expect(warning(page, 'filtration.none')).toHaveCount(0);
    await expect(page.locator(`${FILTRATION_CARD}[data-state="bad"]`)).toHaveCount(0);
    expect(await filtrationText(page)).not.toMatch(LEGACY_SPONGE_GPH);
  });

  test('save → reload: verified catalog sponge and custom sponge keep their rating; no GPH is stored', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '55g');
    await addProduct(page, HYGGER_M);
    await addCustomSponge(page, 30);
    await settle(page);
    const before = await engine(page);
    expect(before.level).toBe('adequate');
    const v2 = JSON.parse((await stored(page, V2)) as string);
    expect(v2.filters).toEqual([
      { instanceId: expect.stringMatching(/^f-/), source: 'product', productId: HYGGER_M, type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
      { instanceId: expect.stringMatching(/^f-/), source: 'custom', label: 'Sponge filter', legacyId: expect.stringMatching(/^manual-/), type: 'SPONGE',
        capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 30, ratingStatus: 'verified' },
    ]);
    expect(await stored(page, V1)).toBeNull();
    const chipText = await chips(page).allTextContents();
    await page.reload();
    await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
    await setUpTank(page, '55g');
    await settle(page);
    expect(await chips(page).allTextContents()).toEqual(chipText);
    const after = await engine(page);
    expect(after.filters).toEqual(before.filters);
    expect(after.level).toBe('adequate');
    await expect(chips(page).nth(0)).toContainText('Rated 15–55 gal');
    await expect(chips(page).nth(1)).toContainText('Rated up to 30 gal');
  });

  test('old v1 plan: catalog sponges re-resolve by rating; an old custom sponge needs a rating and can get one', async ({ page }) => {
    await seedStorage(page, { [V1]: JSON.stringify([
      { id: HYGGER_S, type: 'SPONGE', rated_gph: 120 },
      { id: 'pawfly-sponge-10', type: 'SPONGE', rated_gph: 60 },
      { id: 'manual-oldsp', type: 'SPONGE', rated_gph: 120 },
      { id: 'manual-oldhob', type: 'HOB', rated_gph: 110 },
    ]) });
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await settle(page);
    let state = await engine(page);
    expect(state.filters).toEqual([
      [HYGGER_S, 'SPONGE', 0, 'manufacturer_rating', 'verified'],
      ['pawfly-sponge-10', 'SPONGE', 0, 'manufacturer_rating', 'needed'],
      ['manual-oldsp', 'SPONGE', 0, 'manufacturer_rating', 'needed'],
      ['manual-oldhob', 'HOB', 110, 'flow', null],
    ]);
    expect(state.gph).toEqual([110, 110, 0]);
    await expect(chip(page, HYGGER_S)).toContainText('Rated 10–40 gal');
    await expect(chip(page, 'pawfly-sponge-10')).toContainText('Rating needed');
    await expect(chip(page, 'manual-oldsp')).toContainText('Sponge filter');
    await expect(chip(page, 'manual-oldsp')).toContainText('Rating needed');
    expect(await filtrationText(page)).not.toMatch(LEGACY_SPONGE_GPH);
    // Phase E: migrated into v2 only; no v1 mirror, and the historical v1 key is removed.
    expect(await stored(page, V1)).toBeNull();
    const saved = JSON.parse((await stored(page, V2)) as string);
    expect(saved.filters[2]).toMatchObject({ source: 'custom', type: 'SPONGE', capacityMethod: 'manufacturer_rating', ratingStatus: 'needed', legacyGph: 120 });
    expect(saved.filters[2].gph).toBeUndefined();

    // "Add rating" gives the old custom sponge its rating in place.
    await chip(page, 'manual-oldsp').locator('[data-rate-filter]').click();
    await expect(page.locator('#fs-type')).toHaveValue('Sponge');
    await expect(page.locator('#fs-rated-gallons')).toBeFocused();
    await page.fill('#fs-rated-gallons', '20');
    await page.click('#fs-add-custom');
    await expect(chips(page)).toHaveCount(4);
    await expect(chip(page, 'manual-oldsp')).toContainText('Rated up to 20 gal');
    await expect(chip(page, 'manual-oldsp').locator('[data-rate-filter]')).toHaveCount(0);
    await settle(page);
    state = await engine(page);
    expect(state.filters[2]).toEqual(['manual-oldsp', 'SPONGE', 0, 'manufacturer_rating', 'verified']);
    const resaved = JSON.parse((await stored(page, V2)) as string);
    expect(resaved.filters[2]).toMatchObject({ manufacturerMaxGallons: 20, ratingStatus: 'verified' });
    expect(resaved.filters[2].legacyGph).toBeUndefined();
  });

  test('old phase-A v2 plan: flow sponge entries are re-read as rating sponges; GPH never scored', async ({ page }) => {
    await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-olda01', source: 'product', productId: HYGGER_M, type: 'SPONGE', capacityMethod: 'flow', gph: 120 },
      { instanceId: 'f-olda02', source: 'product', productId: 'powkoo-dual-sponge-40', type: 'SPONGE', capacityMethod: 'flow', gph: 150 },
      { instanceId: 'f-olda03', source: 'custom', label: 'Sponge 90 GPH', legacyId: 'manual-olda', type: 'SPONGE', capacityMethod: 'flow', gph: 90 },
    ] }) });
    await openAdvisor(page);
    await setUpTank(page, '75g');
    await settle(page);
    const state = await engine(page);
    expect(state.filters.map((row) => [row[0], row[2], row[3], row[4]])).toEqual([
      [HYGGER_M, 0, 'manufacturer_rating', 'verified'],
      ['powkoo-dual-sponge-40', 0, 'manufacturer_rating', 'needed'],
      ['manual-olda', 0, 'manufacturer_rating', 'needed'],
    ]);
    expect(state.gph).toEqual([0, 0, 0]);
    // 75 gal > Hygger M's 55: the only verified sponge is below its rating.
    expect(state.level).toBe('below-rating');
    await expect(chip(page, 'manual-olda')).not.toContainText('90');
    expect(await filtrationText(page)).not.toMatch(/\b(90|120|150) ?GPH\b/);
  });

  test('mixed powered + sponge: powered pass, review, and sponge carrying a weak powered filter', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    const before = await bioloadLabel(page).textContent();

    // Weak HOB alone: existing red.
    await addCustomGph(page, 'HOB', 40);
    await expect(warning(page, 'filtration.very_low')).toHaveAttribute('data-state', 'bad');
    // + an unrated sponge: amber "Review filtration", not red.
    await addProduct(page, UNRATED);
    await settle(page);
    expect((await engine(page)).level).toBe('review');
    const review = warning(page, 'filtration.review');
    await expect(review).toHaveAttribute('data-state', 'warn');
    await expect(review).toContainText('Review filtration');
    await expect(review).toContainText('below the 2× minimum');
    await expect(review).toContainText('Sponge filter: Rating needed');
    await expect(warning(page, 'filtration.very_low')).toHaveCount(0);
    await expect(summary(page)).toHaveText('Filtration: 40 GPH • 1.4×/h + 1 sponge filter (rated by tank size)');

    // + a verified sponge rated for the tank: adequate from the sponge.
    await addProduct(page, HYGGER_S);
    await settle(page);
    let state = await engine(page);
    expect(state.level).toBe('adequate');
    expect(state.adequateBy).toBe('sponge');
    expect(state.gph).toEqual([40, 40, 0]);
    await expect(warning(page, 'filtration.sponge_rated')).toContainText('+ Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× powered-filter minimum');

    // Replace the weak HOB with a strong one: adequate from the powered filter, sponges supplemental.
    await page.click(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id^="manual-"] [data-remove-filter]`);
    await addCustomGph(page, 'HOB', 150);
    await settle(page);
    state = await engine(page);
    expect(state.level).toBe('adequate');
    expect(state.adequateBy).toBe('both');
    await expect(filtrationWarnings(page)).toHaveCount(0);
    await expect(summary(page)).toHaveText('Filtration: 150 GPH • 5.2×/h + 2 sponge filters (rated by tank size)');
    await expect(bioloadLabel(page)).toHaveText(before ?? '');
  });

  test('powerhead + sponge: a verified sponge is biological filtration; an unrated one is not evaluated', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await addCustomGph(page, 'Powerhead', 300);
    await expect(warning(page, 'filtration.circulation_only')).toBeVisible();
    await addProduct(page, UNRATED);
    await settle(page);
    expect((await engine(page)).level).toBe('not-evaluated');
    await expect(warning(page, 'filtration.circulation_only')).toHaveCount(0);
    await expect(warning(page, 'filtration.rating_needed')).toBeVisible();
    await expect(summary(page)).toHaveText('Filtration: 1 sponge filter (rated by tank size) (+300 GPH circulation only)');
    await addCustomSponge(page, 40);
    await settle(page);
    const state = await engine(page);
    expect(state.level).toBe('adequate');
    expect(state.gph).toEqual([300, 0, 300]);
  });
});
