// Saved filter state v2 on the real page (sponge-filter migration phase A). Part of the Stocking
// Advisor gate (`npm run test:e2e:stocking-gate`). Save → reload must give the same chips, the same
// calculator input and the same filtration result as before the reload; v1 plans must still load.
// Sponge expectations follow phase B (rated by tank size, never by GPH): see
// tests/stocking-advisor-sponge-phase-b.spec.ts for the full phase B browser checks.
import { test, expect, type Page } from '@playwright/test';

const V1 = 'ttg.stocking.filters.v1';
const V2 = 'ttg.stocking.filters.v2';

async function openAdvisor(page: Page) {
  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    return hostname === '127.0.0.1' || hostname === 'localhost' ? route.fallback() : route.abort();
  });
  await page.goto('/stocking-advisor.html');
  await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
}

// Seeds storage before any page script runs, on the first load only.
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

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: Record<string, unknown> & { filters?: Array<Record<string, unknown>> } }).appState;
    const computed = compute.buildComputedState(appState);
    const chips = Array.from(document.querySelectorAll<HTMLElement>('[data-role="proto-filter-chips"] .proto-filter-chip'));
    return {
      chips: chips.map((chip) => `${chip.dataset.filterId}|${chip.dataset.source}|${chip.textContent?.replace(/\s+/g, ' ').trim()}`),
      // Calculator input. (role is left out: whether stocking.js or the controller writes the list
      // last on start-up is a load-order race that exists on main too; it is derived from type.)
      scoring: (appState.filters ?? []).map((filter) => [filter.id, filter.type, filter.rated_gph]),
      instanceIds: (appState.filters ?? []).map((filter) => filter.instanceId),
      capacity: (appState.filters ?? []).map((filter) => [filter.capacityMethod, filter.manufacturerMaxGallons ?? null, filter.manufacturerMinGallons ?? null]),
      level: computed.filtering.level,
      gph: [computed.filtering.gphTotal, computed.filtering.biologicalGph, computed.filtering.circulationGph],
      turnover: computed.filtering.turnover,
      status: computed.filtering.status,
      warnings: computed.status.warnings.map((warning: { id: string }) => warning.id),
      bioload: [computed.bioload.currentPercent, computed.bioload.proposedPercent],
      summary: document.querySelector('[data-role="proto-filter-summary"]')?.textContent ?? '',
      stripText: Array.from(document.querySelectorAll('#stock-warnings .status-strip')).map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
      loadLabel: document.querySelector('[data-role="bioload-percent"]')?.textContent ?? '',
    };
  });
}

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

async function setUpTank(page: Page, tankId = '20l') {
  await page.selectOption('#tank-size', tankId);
  await page.selectOption('#plan-species', 'neon');
  await page.fill('#plan-qty', '8');
  await page.click('#plan-add');
  await expect(page.locator('[data-testid="species-row"][data-row-id="neon"]')).toBeVisible();
}

// A custom sponge takes its rated tank size (phase B); every other type takes GPH.
async function addCustom(page: Page, type: string, value: number) {
  await page.selectOption('#fs-type', type);
  await page.fill(type === 'Sponge' ? '#fs-rated-gallons' : '#fs-gph', String(value));
  await page.click('#fs-add-custom');
}

async function addProduct(page: Page, id: string) {
  await expect.poll(() => page.locator(`#filter-product option[value="${id}"]`).count(), { timeout: 10000 }).toBe(1);
  await page.selectOption('#filter-product', id);
  await expect(page.locator('#filter-product-add')).toBeEnabled();
  await page.click('#filter-product-add');
  await expect(page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${id}"]`)).toBeVisible();
}

// The species list isn't saved across a reload (it never was), so the same stock is added again
// before comparing; the filters must come back on their own.
async function reloadAndCompare(page: Page, tankId: string | null = null) {
  await settle(page);
  const before = await snapshot(page);
  await page.reload();
  await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
  if (tankId) {
    await setUpTank(page, tankId);
  }
  await settle(page);
  const after = await snapshot(page);
  expect(after).toEqual(before);
  return after;
}

test.describe('saved filters v2', () => {
  test('A + C: catalog and custom filters survive save → reload unchanged, in order', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '55g');
    await addProduct(page, 'tetra-whisper-iq-45');
    await addCustom(page, 'Canister', 180);
    await addCustom(page, 'Powerhead', 400);
    const after = await reloadAndCompare(page, '55g');
    expect(after.scoring.map((row) => row[0])[0]).toBe('tetra-whisper-iq-45');
    expect(after.scoring[0][2]).toBe(215);
    expect(new Set(after.instanceIds).size).toBe(3);
    expect(after.capacity.map((row) => row[0])).toEqual(['flow', 'flow', 'flow']);
    const v2 = JSON.parse((await stored(page, V2)) as string);
    expect(v2.v).toBe(2);
    expect(v2.filters.map((entry: { source: string; type: string }) => `${entry.source}:${entry.type}`))
      .toEqual(['product:HOB', 'custom:CANISTER', 'custom:POWERHEAD']);
    const v1 = JSON.parse((await stored(page, V1)) as string);
    expect(v1.map((entry: object) => Object.keys(entry).sort().join(','))).toEqual(['id,rated_gph,type', 'id,rated_gph,type', 'id,rated_gph,type']);
  });

  test('B + E: custom powered and custom sponge filters survive save → reload', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page);
    await addCustom(page, 'HOB', 150);
    await addCustom(page, 'Sponge', 60);
    const after = await reloadAndCompare(page, '20l');
    // Phase B: the custom sponge is rated "up to 60 gal" and carries no GPH.
    expect(after.scoring.map((row) => [row[1], row[2]])).toEqual([['HOB', 150], ['SPONGE', 0]]);
    expect(after.capacity[1]).toEqual(['manufacturer_rating', 60, null]);
  });

  test('D: a catalog sponge is re-resolved by rating after reload (phase B: never its catalog GPH)', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '10g');
    await addProduct(page, 'aquaneat-sponge-20');
    const after = await reloadAndCompare(page, '10g');
    expect(after.scoring[0]).toEqual(['aquaneat-sponge-20', 'SPONGE', 0]);
    // The catalog's review-only max (needs_review) rides along as metadata; it is not scored.
    expect(after.capacity[0]).toEqual(['manufacturer_rating', 20, null]);
    expect(after.level).toBe('not-evaluated');
  });

  test('F: an old v1 plan loads, scores as before and is written back as v2 (v1 kept)', async ({ page }) => {
    const v1 = [
      { id: 'aquaneat-sponge-20', type: 'SPONGE', rated_gph: 999 },
      { id: 'manual-old1', type: 'HOB', rated_gph: 150 },
      { id: 'retired-product', type: 'CANISTER', rated_gph: 250 },
    ];
    await seedStorage(page, { [V1]: JSON.stringify(v1) });
    await openAdvisor(page);
    await settle(page);
    const first = await snapshot(page);
    expect(first.scoring.map((row) => row[0])).toEqual(['aquaneat-sponge-20', 'manual-old1', 'retired-product']);
    expect(first.scoring[0][2]).toBe(0);
    expect(first.scoring.slice(1).map((row) => row[2])).toEqual([150, 250]);
    const v2 = JSON.parse((await stored(page, V2)) as string);
    expect(v2.filters.map((entry: { capacityMethod: string }) => entry.capacityMethod)).toEqual(['manufacturer_rating', 'flow', 'flow']);
    // Phase B: the v1 mirror keeps the powered filters only.
    expect(JSON.parse((await stored(page, V1)) as string).map((entry: { id: string }) => entry.id))
      .toEqual(['manual-old1', 'retired-product']);
    await reloadAndCompare(page);
  });

  test('G + capacity fields: a v2 fixture loads directly; a catalog sponge takes the catalog rating, not saved fields', async ({ page }) => {
    const fixture = {
      v: 2,
      filters: [
        { instanceId: 'f-fixt01', source: 'product', productId: 'aquaneat-sponge-20', type: 'SPONGE',
          capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 20, manufacturerMinGallons: 10, gph: 1 },
        { instanceId: 'f-fixt02', source: 'custom', legacyId: 'manual-fixt', type: 'HOB', capacityMethod: 'flow', gph: 120 },
      ],
    };
    await seedStorage(page, { [V2]: JSON.stringify(fixture), [V1]: JSON.stringify([{ id: 'manual-ignored', type: 'HOB', rated_gph: 5 }]) });
    await openAdvisor(page);
    await settle(page);
    const first = await snapshot(page);
    expect(first.scoring.map((row) => row[0])).toEqual(['aquaneat-sponge-20', 'manual-fixt']);
    expect(first.instanceIds).toEqual(['f-fixt01', 'f-fixt02']);
    // Phase B: the catalog sponge's rating comes from the current catalog (max 20, needs_review),
    // not the saved max 20 / min 10; it scores no GPH.
    expect(first.capacity).toEqual([['manufacturer_rating', 20, null], ['flow', null, null]]);
    expect(first.scoring[0][2]).toBe(0);
    const saved = JSON.parse((await stored(page, V2)) as string);
    expect(saved.filters[0]).toEqual({ instanceId: 'f-fixt01', source: 'product', productId: 'aquaneat-sponge-20', type: 'SPONGE', capacityMethod: 'manufacturer_rating' });
    // Rating-method entries never reach the v1 mirror.
    expect(JSON.parse((await stored(page, V1)) as string).map((entry: { id: string }) => entry.id)).toEqual(['manual-fixt']);
    await reloadAndCompare(page);
  });

  test('a v2 entry with an unsupported capacityMethod is dropped; the valid entry is kept', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-good01', source: 'custom', legacyId: 'manual-good', type: 'HOB', capacityMethod: 'flow', gph: 150 },
      { instanceId: 'f-bad001', source: 'custom', legacyId: 'manual-bad', type: 'CANISTER', capacityMethod: 'banana', gph: 900 },
    ] }) });
    await openAdvisor(page);
    await setUpTank(page);
    await settle(page);
    const state = await snapshot(page);
    expect(state.chips.map((chip) => chip.split('|')[0])).toEqual(['manual-good']);
    expect(state.scoring).toEqual([['manual-good', 'HOB', 150]]);
    expect(state.gph).toEqual([150, 150, 0]);
    const saved = JSON.parse((await stored(page, V2)) as string);
    expect(saved.filters.map((entry: { instanceId: string }) => entry.instanceId)).toEqual(['f-good01']);
    expect(errors).toEqual([]);
  });

  test('malformed or hostile saved data never breaks the page or invents a filter', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await seedStorage(page, { [V2]: '{"v":2,"filters":[{"source":"custom","type":"BANANA"},{"instanceId":"x","gph":"lots"},', [V1]: 'not json' });
    await openAdvisor(page);
    await settle(page);
    const state = await snapshot(page);
    expect(state.chips).toEqual([]);
    expect(state.level).toBe('none');
    await page.selectOption('#tank-size', '20l');
    await addCustom(page, 'HOB', 150);
    await settle(page);
    expect((await snapshot(page)).scoring.map((row) => row[2])).toEqual([150]);
    expect(errors).toEqual([]);
  });

  test('the page still works with localStorage unavailable', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const failing = {
        getItem() { throw new Error('denied'); },
        setItem() { throw new Error('denied'); },
        removeItem() { throw new Error('denied'); },
        clear() { throw new Error('denied'); },
        key() { return null; },
        length: 0,
      };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => failing });
    });
    await openAdvisor(page);
    await setUpTank(page);
    await addCustom(page, 'HOB', 150);
    await settle(page);
    const state = await snapshot(page);
    expect(state.scoring.map((row) => row[2])).toEqual([150]);
    expect(state.level).toBe('adequate');
    expect(errors.filter((message) => /filter|saved-state|denied/i.test(message))).toEqual([]);
  });
});
