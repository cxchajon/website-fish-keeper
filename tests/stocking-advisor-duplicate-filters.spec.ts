// Sponge migration phase D on the real page (desktop and mobile): duplicate filter instances. The same
// catalog product can be added more than once; every copy is its own physical filter (own instanceId,
// same productId), scored, saved and removed separately. Part of the Stocking Advisor gate
// (`npm run test:e2e:stocking-gate`). Report: _internal/reports/stocking-advisor-sponge-migration-phase-d-2026-09.md
import { test, expect, type Page } from '@playwright/test';

const V1 = 'ttg.stocking.filters.v1';
const V2 = 'ttg.stocking.filters.v2';
const AC70 = 'aquaclear-70';
const HYGGER_S = 'hygger-double-sponge-s';
const AQUANEAT_MIDDLE = 'aquaneat-sponge-20';
const UGF = 'penn-plax-ugf-20-29';
// Legacy catalog "GPH" of the sponges used here; none may appear in the filtration UI.
const LEGACY_SPONGE_GPH = /\b(80|120) ?GPH\b/;

async function openAdvisor(page: Page, { offline = false } = {}) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (offline && url.pathname.endsWith('/gearCatalog.json')) return route.abort();
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' ? route.fallback() : route.abort();
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

const chips = (page: Page) => page.locator('[data-role="proto-filter-chips"] .proto-filter-chip');
const productChips = (page: Page, id: string) => page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${id}"]`);
const instanceChip = (page: Page, instanceId: string) => page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-instance-id="${instanceId}"]`);
const warning = (page: Page, id: string) => page.locator(`#stock-warnings .status-strip[data-warning-id="${id}"]`);
const productNote = (page: Page) => page.locator('#filter-product-note');
const addSelected = (page: Page) => page.locator('#filter-product-add');

// Each Add Selected click is one new physical filter.
async function addProductTimes(page: Page, id: string, times: number) {
  await expect.poll(() => page.locator(`#filter-product option[value="${id}"]`).count(), { timeout: 10000 }).toBe(1);
  await page.selectOption('#filter-product', id);
  const before = await chips(page).count();
  for (let i = 1; i <= times; i += 1) {
    await expect(addSelected(page)).toBeEnabled();
    await page.click('#filter-product-add');
    await expect(chips(page)).toHaveCount(before + i);
  }
  // The product stays selected and addable; no "Already added".
  await expect(page.locator('#filter-product')).toHaveValue(id);
  await expect(addSelected(page)).toBeEnabled();
  await expect(productNote(page)).not.toContainText('Already added');
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

async function instanceIds(page: Page, productId?: string) {
  const locator = productId ? productChips(page, productId) : chips(page);
  return locator.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.instanceId ?? ''));
}

async function engine(page: Page) {
  return page.evaluate(async () => {
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: Record<string, unknown> & { filters?: Array<Record<string, unknown>> } }).appState;
    const computed = compute.buildComputedState(appState);
    const withoutFilters = compute.buildComputedState({ ...appState, filters: [] });
    const load = (c: { bioload: Record<string, unknown> }) => [c.bioload.currentPercent, c.bioload.proposedPercent, c.bioload.text, c.bioload.severity];
    return {
      level: computed.filtering.level as string,
      adequateBy: computed.filtering.assessment.adequateBy as string | null,
      gph: [computed.filtering.gphTotal, computed.filtering.biologicalGph, computed.filtering.circulationGph] as number[],
      turnover: computed.filtering.turnover as number,
      spongeCount: computed.filtering.assessment.sponge.count as number,
      verifiedCount: computed.filtering.assessment.sponge.verifiedCount as number,
      filters: (appState.filters ?? []).map((filter) => [filter.instanceId, filter.productId ?? filter.id, filter.type, filter.rated_gph, filter.ratingStatus ?? null]),
      load: load(computed),
      loadWithoutFilters: load(withoutFilters),
    };
  });
}

async function filtrationText(page: Page) {
  return page.evaluate(() => [
    document.querySelector('[data-role="proto-filter-chips"]')?.textContent ?? '',
    document.querySelector('[data-role="proto-filter-summary"]')?.textContent ?? '',
    document.querySelector('.filter-flow-meta')?.textContent ?? '',
    document.querySelector('#stock-warnings')?.textContent ?? '',
    document.querySelector('.filtration-chipbar')?.getAttribute('data-total') ?? '',
  ].join(' ').replace(/\s+/g, ' '));
}

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const savedV2 = async (page: Page) => JSON.parse((await stored(page, V2)) ?? 'null');

// Filtration never moves Stocking Load: the same stock with no filters gives the same load.
async function expectLoadUnchanged(page: Page) {
  const state = await engine(page);
  expect(state.load).toEqual(state.loadWithoutFilters);
  return state;
}

test.describe('phase D: duplicate filter instances', () => {
  test('A–C: same powered catalog filter twice → two chips; remove one → one remains; reload keeps that instance', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '55g');
    await addProductTimes(page, AC70, 2);
    await expect(productNote(page)).toContainText('Filter added.');
    await expect(productChips(page, AC70)).toHaveCount(2);
    await expect(productChips(page, AC70).locator('.proto-filter-chip__label')).toHaveText(['AquaClear 70 Power Filter', 'AquaClear 70 Power Filter']);
    await expect(productChips(page, AC70).locator('.proto-filter-chip__gph')).toHaveText(['300 GPH', '300 GPH']);
    const [first, second] = await instanceIds(page, AC70);
    expect(first).toMatch(/^f-/);
    expect(second).toMatch(/^f-/);
    expect(first).not.toBe(second);
    // Screen readers can tell the two × buttons apart; the instanceId itself is never shown.
    await expect(instanceChip(page, first).locator('[data-remove-filter]')).toHaveAttribute('aria-label', 'Remove AquaClear 70 Power Filter (1 of 2)');
    await expect(instanceChip(page, second).locator('[data-remove-filter]')).toHaveAttribute('aria-label', 'Remove AquaClear 70 Power Filter (2 of 2)');
    expect(await filtrationText(page)).not.toContain(first);
    await settle(page);
    let state = await expectLoadUnchanged(page);
    expect(state.filters).toEqual([[first, AC70, 'HOB', 300, null], [second, AC70, 'HOB', 300, null]]);
    expect(state.gph).toEqual([600, 600, 0]);
    expect(state.level).toBe('adequate');
    await expect(page.locator('[data-role="proto-filter-summary"]')).toContainText('600 GPH');
    const v2 = await savedV2(page);
    expect(v2.filters.map((e: Record<string, unknown>) => [e.instanceId, e.productId, e.gph])).toEqual([[first, AC70, 300], [second, AC70, 300]]);
    expect(JSON.parse((await stored(page, V1)) as string)).toEqual([{ id: AC70, type: 'HOB', rated_gph: 300 }, { id: AC70, type: 'HOB', rated_gph: 300 }]);

    // B: remove the first chip only.
    await instanceChip(page, first).locator('[data-remove-filter]').click();
    await expect(productChips(page, AC70)).toHaveCount(1);
    await expect(instanceChip(page, second)).toBeVisible();
    await expect(instanceChip(page, second).locator('[data-remove-filter]')).toHaveAttribute('aria-label', 'Remove AquaClear 70 Power Filter');
    await settle(page);
    state = await expectLoadUnchanged(page);
    expect(state.filters).toEqual([[second, AC70, 'HOB', 300, null]]);
    expect(state.gph).toEqual([300, 300, 0]);

    // C: reload keeps the remaining instance.
    await page.reload();
    await setUpTank(page, '55g');
    await settle(page);
    await expect(chips(page)).toHaveCount(1);
    expect(await instanceIds(page)).toEqual([second]);
    expect((await expectLoadUnchanged(page)).filters).toEqual([[second, AC70, 'HOB', 300, null]]);

    // Remove the remaining chip: zero remain.
    await instanceChip(page, second).locator('[data-remove-filter]').click();
    await expect(chips(page)).toHaveCount(0);
    await settle(page);
    expect((await engine(page)).level).toBe('none');
    expect(await stored(page, V2)).toBeNull();
  });

  test('D–F: 55 gal + 2 × hygger S → "Likely adequate — multiple sponge filters"; remove one → below rating; reload keeps it', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '55g');
    await addProductTimes(page, HYGGER_S, 2);
    await expect(productChips(page, HYGGER_S)).toHaveCount(2);
    await expect(productChips(page, HYGGER_S).locator('.proto-filter-chip__gph')).toHaveText(['Rated 10–40 gal', 'Rated 10–40 gal']);
    const [first, second] = await instanceIds(page, HYGGER_S);
    expect(first).not.toBe(second);
    await settle(page);
    let state = await expectLoadUnchanged(page);
    expect(state.level).toBe('likely-multi-sponge');
    expect([state.spongeCount, state.verifiedCount]).toEqual([2, 2]);
    expect(state.gph).toEqual([0, 0, 0]);
    const multi = warning(page, 'filtration.likely_multi_sponge');
    await expect(multi).toHaveAttribute('data-state', 'warn');
    await expect(multi).toContainText('Likely adequate — multiple sponge filters');
    await expect(multi).toContainText('(S) 1: rated 10–40 gal');
    await expect(multi).toContainText('(S) 2: rated 10–40 gal');
    const text = await filtrationText(page);
    expect(text).not.toMatch(/80 ?gal/);
    expect(text).not.toMatch(LEGACY_SPONGE_GPH);
    await expect(page.locator('[data-role="proto-filter-summary"]')).toHaveText('Filtration: 2 sponge filters (rated by tank size)');
    const v2 = await savedV2(page);
    expect(v2.filters).toEqual([
      { instanceId: first, source: 'product', productId: HYGGER_S, type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
      { instanceId: second, source: 'product', productId: HYGGER_S, type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
    ]);
    expect(await stored(page, V1)).toBeNull();

    // F: one removed → below the manufacturer rating.
    await instanceChip(page, second).locator('[data-remove-filter]').click();
    await expect(productChips(page, HYGGER_S)).toHaveCount(1);
    await settle(page);
    state = await expectLoadUnchanged(page);
    expect(state.level).toBe('below-rating');
    await expect(warning(page, 'filtration.below_rating')).toContainText('Below manufacturer rating');
    await page.reload();
    await setUpTank(page, '55g');
    await settle(page);
    expect(await instanceIds(page)).toEqual([first]);
    expect((await engine(page)).level).toBe('below-rating');
  });

  test('2 × hygger S on 29 gal stays "Rated for this tank"', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await addProductTimes(page, HYGGER_S, 2);
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect([state.level, state.adequateBy]).toEqual(['adequate', 'sponge']);
    await expect(warning(page, 'filtration.sponge_rated')).toContainText('Rated for this tank');
    await expect(warning(page, 'filtration.likely_multi_sponge')).toHaveCount(0);
  });

  test('G: two identical unrated catalog sponges → both visible, Rating needed, no GPH, not evaluated', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await addProductTimes(page, AQUANEAT_MIDDLE, 2);
    await expect(productChips(page, AQUANEAT_MIDDLE)).toHaveCount(2);
    await expect(productChips(page, AQUANEAT_MIDDLE).locator('.proto-filter-chip__gph')).toHaveText(['Rating needed', 'Rating needed']);
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect(state.level).toBe('not-evaluated');
    expect(state.gph).toEqual([0, 0, 0]);
    expect([state.spongeCount, state.verifiedCount]).toEqual([2, 0]);
    await expect(warning(page, 'filtration.rating_needed')).toContainText('These sponge filters have no verified manufacturer tank rating');
    expect(await filtrationText(page)).not.toMatch(LEGACY_SPONGE_GPH);
  });

  test('H: two identical custom powered filters coexist, both count, remove one', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '125g');
    await addCustomGph(page, 'HOB', 150);
    await expect(chips(page)).toHaveCount(1);
    await addCustomGph(page, 'HOB', 150);
    await expect(chips(page)).toHaveCount(2);
    const ids = await instanceIds(page);
    expect(new Set(ids).size).toBe(2);
    await settle(page);
    let state = await expectLoadUnchanged(page);
    expect(state.gph).toEqual([300, 300, 0]);
    expect(state.level).toBe('adequate'); // 300 / 125 = 2.4×/h
    await instanceChip(page, ids[0]).locator('[data-remove-filter]').click();
    await expect(chips(page)).toHaveCount(1);
    expect(await instanceIds(page)).toEqual([ids[1]]);
    await settle(page);
    state = await expectLoadUnchanged(page);
    expect(state.gph).toEqual([150, 150, 0]);
    expect(state.level).toBe('very-low');
  });

  test('I: two identical custom sponges coexist and count as two sponge instances', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await addCustomSponge(page, 20);
    await expect(chips(page)).toHaveCount(1);
    await addCustomSponge(page, 20);
    await expect(chips(page)).toHaveCount(2);
    await expect(chips(page).locator('.proto-filter-chip__gph')).toHaveText(['Rated up to 20 gal', 'Rated up to 20 gal']);
    const ids = await instanceIds(page);
    expect(new Set(ids).size).toBe(2);
    await settle(page);
    let state = await expectLoadUnchanged(page);
    expect(state.level).toBe('likely-multi-sponge');
    await instanceChip(page, ids[1]).locator('[data-remove-filter]').click();
    await expect(chips(page)).toHaveCount(1);
    await settle(page);
    state = await expectLoadUnchanged(page);
    expect(state.level).toBe('below-rating');
    await page.reload();
    await setUpTank(page, '29g');
    await settle(page);
    expect(await instanceIds(page)).toEqual([ids[0]]);
  });

  test('J: Add rating on one of two unrated legacy custom sponges changes only that instance', async ({ page }) => {
    await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-leg001', source: 'custom', label: 'Sponge filter', legacyId: 'manual-leg1', type: 'SPONGE', capacityMethod: 'manufacturer_rating', ratingStatus: 'needed', legacyGph: 120 },
      { instanceId: 'f-leg002', source: 'custom', label: 'Sponge filter', legacyId: 'manual-leg1', type: 'SPONGE', capacityMethod: 'manufacturer_rating', ratingStatus: 'needed', legacyGph: 120 },
    ] }) });
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await settle(page);
    await expect(chips(page)).toHaveCount(2);
    expect(await instanceIds(page)).toEqual(['f-leg001', 'f-leg002']);
    await expect(chips(page).locator('[data-rate-filter]')).toHaveCount(2);
    // Both share one (damaged) legacy id; targeting is by instance.
    await instanceChip(page, 'f-leg002').locator('[data-rate-filter]').click();
    await expect(page.locator('#fs-type')).toHaveValue('Sponge');
    await page.fill('#fs-rated-gallons', '30');
    await page.click('#fs-add-custom');
    await expect(chips(page)).toHaveCount(2);
    await expect(instanceChip(page, 'f-leg002')).toContainText('Rated up to 30 gal');
    await expect(instanceChip(page, 'f-leg002').locator('[data-rate-filter]')).toHaveCount(0);
    await expect(instanceChip(page, 'f-leg001')).toContainText('Rating needed');
    await expect(instanceChip(page, 'f-leg001').locator('[data-rate-filter]')).toHaveCount(1);
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect(state.filters.map((row) => [row[0], row[4]])).toEqual([['f-leg001', 'needed'], ['f-leg002', 'verified']]);
    expect([state.level, state.adequateBy]).toEqual(['adequate', 'sponge']);
    const v2 = await savedV2(page);
    expect(v2.filters.map((e: Record<string, unknown>) => [e.instanceId, e.ratingStatus, e.manufacturerMaxGallons ?? null, e.legacyGph ?? null]))
      .toEqual([['f-leg001', 'needed', null, 120], ['f-leg002', 'verified', 30, null]]);
  });

  test('saved duplicates: repeated and malformed instanceIds are repaired, every filter kept, stable across reloads', async ({ page }) => {
    await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-same01', source: 'product', productId: HYGGER_S, type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
      { instanceId: 'f-same01', source: 'product', productId: HYGGER_S, type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
      { instanceId: '<bad id>', source: 'product', productId: AC70, type: 'HOB', capacityMethod: 'flow', gph: 300 },
      { source: 'product', productId: AC70, type: 'HOB', capacityMethod: 'flow', gph: 300 },
    ] }) });
    await openAdvisor(page);
    await setUpTank(page, '55g');
    await settle(page);
    await expect(chips(page)).toHaveCount(4);
    const ids = await instanceIds(page);
    expect(ids[0]).toBe('f-same01');
    expect(new Set(ids).size).toBe(4);
    ids.forEach((id) => expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]*$/));
    const state = await expectLoadUnchanged(page);
    expect(state.gph).toEqual([600, 600, 0]);
    expect(state.spongeCount).toBe(2);
    const first = await savedV2(page);
    expect(first.filters.map((e: Record<string, unknown>) => e.instanceId)).toEqual(ids);
    await page.reload();
    await setUpTank(page, '55g');
    await settle(page);
    expect(await instanceIds(page)).toEqual(ids);
    expect(await savedV2(page)).toEqual(first);
  });

  test('undergravel plates stay one set per tank', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await expect.poll(() => page.locator(`#filter-product option[value="${UGF}"]`).count(), { timeout: 10000 }).toBe(1);
    await page.selectOption('#filter-product', UGF);
    await page.click('#filter-product-add');
    await expect(productChips(page, UGF)).toHaveCount(1);
    await expect(addSelected(page)).toBeDisabled();
    await page.selectOption('#filter-product', '');
    await page.selectOption('#filter-product', UGF);
    await expect(productNote(page)).toContainText('one plate set per tank');
    await expect(addSelected(page)).toBeDisabled();
    await settle(page);
    expect((await expectLoadUnchanged(page)).gph).toEqual([150, 150, 0]);
  });

  for (const offline of [false, true]) {
    test(`a saved plan with two undergravel copies restores one (catalog ${offline ? 'unavailable' : 'loaded'})`, async ({ page }) => {
      await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
        { instanceId: 'f-ugf001', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'flow', gph: 150 },
        { instanceId: 'f-ugf002', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'flow', gph: 150 },
      ] }) });
      await openAdvisor(page, { offline });
      await setUpTank(page, '29g');
      await settle(page);
      expect(await instanceIds(page)).toEqual(['f-ugf001']);
      expect((await expectLoadUnchanged(page)).gph).toEqual([150, 150, 0]);
    });
  }
});
