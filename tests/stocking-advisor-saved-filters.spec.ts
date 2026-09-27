// Saved filter state v2 on the real page (sponge-filter migration phase A). Part of the Stocking
// Advisor gate (`npm run test:e2e:stocking-gate`). Save → reload must give the same chips, the same
// calculator input and the same filtration result as before the reload; v1 plans must still load.
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

async function addCustom(page: Page, type: string, gph: number) {
  await page.selectOption('#fs-type', type);
  await page.fill('#fs-gph', String(gph));
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
    expect(after.scoring.map((row) => [row[1], row[2]])).toEqual([['HOB', 150], ['SPONGE', 60]]);
  });

  test('D: a catalog sponge still scores its current catalog GPH after reload', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '10g');
    await addProduct(page, 'aquaneat-sponge-20');
    const after = await reloadAndCompare(page, '10g');
    expect(after.scoring[0][1]).toBe('SPONGE');
    expect(after.scoring[0][2]).toBeGreaterThan(0);
    expect(after.capacity[0]).toEqual(['flow', null, null]);
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
    expect(first.scoring[0][2]).not.toBe(999);
    expect(first.scoring.slice(1).map((row) => row[2])).toEqual([150, 250]);
    const v2 = JSON.parse((await stored(page, V2)) as string);
    expect(v2.filters.map((entry: { capacityMethod: string }) => entry.capacityMethod)).toEqual(['flow', 'flow', 'flow']);
    expect(JSON.parse((await stored(page, V1)) as string).map((entry: { id: string }) => entry.id))
      .toEqual(['aquaneat-sponge-20', 'manual-old1', 'retired-product']);
    await reloadAndCompare(page);
  });

  test('G + future fields: a v2 fixture loads directly; capacity fields survive but are not scored', async ({ page }) => {
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
    expect(first.capacity).toEqual([['manufacturer_rating', 20, 10], ['flow', null, null]]);
    // The sponge is still scored at the catalog GPH (not the stored 1, not a rating).
    expect(first.scoring[0][2]).toBeGreaterThan(1);
    const saved = JSON.parse((await stored(page, V2)) as string);
    expect(saved.filters[0]).toMatchObject({ instanceId: 'f-fixt01', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 20, manufacturerMinGallons: 10 });
    // Rating-method entries never reach the v1 mirror.
    expect(JSON.parse((await stored(page, V1)) as string).map((entry: { id: string }) => entry.id)).toEqual(['manual-fixt']);
    await reloadAndCompare(page);
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
