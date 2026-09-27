// Live check of the saved-filter v2 plumbing (sponge migration phase A) against production. Each test
// runs in a fresh browser context, so it only touches its own throwaway localStorage.
import { test, expect, type Page } from '@playwright/test';

const V1 = 'ttg.stocking.filters.v1';
const V2 = 'ttg.stocking.filters.v2';
const ASSET_PATH = /\/(js|data|assets\/data)\//;

type Errors = { page: string[]; console: string[] };

function trackErrors(page: Page): Errors {
  const errors: Errors = { page: [], console: [] };
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('console', (message) => {
    // Only errors raised from the site's own scripts; third-party ad/analytics noise is out of scope.
    if (message.type() !== 'error') return;
    const source = message.location()?.url ?? '';
    let sameOrigin = false;
    try {
      sameOrigin = new URL(source).origin === new URL(page.url()).origin;
    } catch (_error) {
      sameOrigin = false;
    }
    if (sameOrigin && ASSET_PATH.test(new URL(source).pathname)) {
      errors.console.push(`${message.text()} @ ${source}`);
    }
  });
  return errors;
}

async function seedOnce(page: Page, values: Record<string, string>) {
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('__phaseA_seeded')) return;
    sessionStorage.setItem('__phaseA_seeded', '1');
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
  }, values);
}

async function openAdvisor(page: Page) {
  await page.goto('/stocking-advisor.html');
  await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
}

async function setUp(page: Page, tankId: string) {
  await page.selectOption('#tank-size', tankId);
  await page.selectOption('#plan-species', 'neon');
  await page.fill('#plan-qty', '8');
  await page.click('#plan-add');
  await expect(page.locator('[data-testid="species-row"][data-row-id="neon"]')).toBeVisible();
}

async function addProduct(page: Page, id: string) {
  await expect.poll(() => page.locator(`#filter-product option[value="${id}"]`).count(), { timeout: 20000 }).toBe(1);
  await page.selectOption('#filter-product', id);
  await expect(page.locator('#filter-product-add')).toBeEnabled();
  await page.click('#filter-product-add');
  await expect(page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${id}"]`)).toBeVisible();
}

const settle = (page: Page) => page.waitForTimeout(2000);

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: Record<string, unknown> & { filters?: Array<Record<string, unknown>> } }).appState;
    const computed = compute.buildComputedState(appState);
    return {
      chips: Array.from(document.querySelectorAll<HTMLElement>('[data-role="proto-filter-chips"] .proto-filter-chip'))
        .map((chip) => `${chip.dataset.filterId}|${chip.textContent?.replace(/\s+/g, ' ').trim()}`),
      scoring: (appState.filters ?? []).map((filter) => [filter.id, filter.type, filter.rated_gph]),
      level: computed.filtering.level,
      gph: [computed.filtering.gphTotal, computed.filtering.biologicalGph, computed.filtering.circulationGph],
      turnover: computed.filtering.turnover,
      status: computed.filtering.status,
      warnings: computed.status.warnings.map((warning: { id: string }) => warning.id),
      load: document.querySelector('[data-role="bioload-percent"]')?.textContent?.trim() ?? '',
      summary: document.querySelector('[data-role="proto-filter-summary"]')?.textContent?.trim() ?? '',
      bodyText: document.body.innerText,
    };
  });
}

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

async function reloadWithStock(page: Page, tankId: string) {
  await page.reload();
  await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
  await setUp(page, tankId);
  await settle(page);
}

test('phase A is deployed: the saved-state module is served', async ({ request }) => {
  const response = await request.get('/js/stocking-advisor/filtration/saved-state.js');
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("'ttg.stocking.filters.v2'");
});

test('powered catalog filter (Tetra IQ 45): 215 GPH, load unchanged, v2 + v1 written, identical after reload', async ({ page }) => {
  const errors = trackErrors(page);
  await openAdvisor(page);
  await setUp(page, '55g');
  await settle(page);
  const noFilter = await snapshot(page);
  await addProduct(page, 'tetra-whisper-iq-45');
  await settle(page);
  const before = await snapshot(page);
  expect(before.scoring).toEqual([['tetra-whisper-iq-45', 'HOB', 215]]);
  expect(before.level).toBe('adequate');
  expect(before.gph).toEqual([215, 215, 0]);
  expect(before.turnover).toBeCloseTo(215 / 55, 6);
  expect(before.summary).toBe('Filtration: 215 GPH • 3.9×/h');
  expect(before.load).toBe(noFilter.load);
  expect(before.warnings.filter((id: string) => id.startsWith('filtration.'))).toEqual([]);

  const v2 = JSON.parse((await stored(page, V2)) as string);
  expect(v2.v).toBe(2);
  expect(v2.filters).toHaveLength(1);
  expect(v2.filters[0]).toMatchObject({ source: 'product', productId: 'tetra-whisper-iq-45', type: 'HOB', capacityMethod: 'flow', gph: 215 });
  expect(v2.filters[0].instanceId).toMatch(/^f-/);
  expect(JSON.parse((await stored(page, V1)) as string)).toEqual([{ id: 'tetra-whisper-iq-45', type: 'HOB', rated_gph: 215 }]);

  await reloadWithStock(page, '55g');
  const after = await snapshot(page);
  const { bodyText: _a, ...afterRest } = after;
  const { bodyText: _b, ...beforeRest } = before;
  expect(afterRest).toEqual(beforeRest);
  expect(JSON.parse((await stored(page, V2)) as string).filters[0].instanceId).toBe(v2.filters[0].instanceId);
  expect(errors).toEqual({ page: [], console: [] });
});

test('catalog sponge still scores its existing GPH; no "Rating needed"; identical after reload', async ({ page }) => {
  const errors = trackErrors(page);
  await openAdvisor(page);
  const catalogGph = await page.evaluate(async () => {
    const catalog = await (await fetch('/assets/data/gearCatalog.json', { cache: 'no-store' })).json();
    return catalog.find((item: { id: string }) => item.id === 'aquaneat-sponge-20')?.gphRated;
  });
  expect(catalogGph).toBe(120);
  await setUp(page, '10g');
  await addProduct(page, 'aquaneat-sponge-20');
  await settle(page);
  const before = await snapshot(page);
  expect(before.scoring).toEqual([['aquaneat-sponge-20', 'SPONGE', 120]]);
  expect(before.level).toBe('adequate');
  expect(before.gph).toEqual([120, 120, 0]);
  expect(before.summary).toBe('Filtration: 120 GPH • 12.0×/h');
  expect(before.bodyText).not.toMatch(/rating needed/i);
  const v2 = JSON.parse((await stored(page, V2)) as string);
  expect(v2.filters[0]).toMatchObject({ productId: 'aquaneat-sponge-20', type: 'SPONGE', capacityMethod: 'flow', gph: 120 });
  expect(v2.filters[0].manufacturerMaxGallons).toBeUndefined();

  await reloadWithStock(page, '10g');
  const after = await snapshot(page);
  expect(after.scoring).toEqual(before.scoring);
  expect(after.chips).toEqual(before.chips);
  expect([after.level, after.gph, after.turnover, after.summary, after.load, after.warnings])
    .toEqual([before.level, before.gph, before.turnover, before.summary, before.load, before.warnings]);
  expect(after.bodyText).not.toMatch(/rating needed/i);
  expect(errors).toEqual({ page: [], console: [] });
});

test('an existing v1 saved plan restores (identity, type, GPH) and is written back as v2; v1 kept', async ({ page }) => {
  const errors = trackErrors(page);
  const v1 = [
    { id: 'aquaneat-sponge-20', type: 'SPONGE', rated_gph: 120 },
    { id: 'manual-live-a', type: 'HOB', rated_gph: 150 },
    { id: 'manual-live-b', type: 'POWERHEAD', rated_gph: 300 },
  ];
  await seedOnce(page, { [V1]: JSON.stringify(v1) });
  await openAdvisor(page);
  await setUp(page, '29g');
  await settle(page);
  const state = await snapshot(page);
  expect(state.scoring).toEqual([
    ['aquaneat-sponge-20', 'SPONGE', 120],
    ['manual-live-a', 'HOB', 150],
    ['manual-live-b', 'POWERHEAD', 300],
  ]);
  expect(state.gph).toEqual([570, 270, 300]);
  expect(state.turnover).toBeCloseTo(270 / 29, 6);
  expect(state.level).toBe('adequate');
  const v2 = JSON.parse((await stored(page, V2)) as string);
  expect(v2.filters.map((entry: { type: string; gph: number; capacityMethod: string }) => [entry.type, entry.gph, entry.capacityMethod]))
    .toEqual([['SPONGE', 120, 'flow'], ['HOB', 150, 'flow'], ['POWERHEAD', 300, 'flow']]);
  expect(JSON.parse((await stored(page, V1)) as string)).toEqual(v1);
  expect(errors).toEqual({ page: [], console: [] });
});

test('a v2 entry with an unsupported capacityMethod is ignored; the valid filter restores', async ({ page }) => {
  const errors = trackErrors(page);
  await seedOnce(page, { [V2]: JSON.stringify({ v: 2, filters: [
    { instanceId: 'f-live01', source: 'custom', legacyId: 'manual-live-good', type: 'HOB', capacityMethod: 'flow', gph: 150 },
    { instanceId: 'f-live02', source: 'custom', legacyId: 'manual-live-bad', type: 'CANISTER', capacityMethod: 'banana', gph: 900 },
  ] }) });
  await openAdvisor(page);
  await setUp(page, '20l');
  await settle(page);
  const state = await snapshot(page);
  expect(state.chips.map((chip: string) => chip.split('|')[0])).toEqual(['manual-live-good']);
  expect(state.scoring).toEqual([['manual-live-good', 'HOB', 150]]);
  expect(state.gph).toEqual([150, 150, 0]);
  expect(state.turnover).toBeCloseTo(150 / 20, 6);
  expect(state.level).toBe('adequate');
  expect(state.bodyText).not.toMatch(/banana|rating needed|invalid/i);
  const saved = JSON.parse((await stored(page, V2)) as string);
  expect(saved.filters.map((entry: { instanceId: string }) => entry.instanceId)).toEqual(['f-live01']);
  expect(errors).toEqual({ page: [], console: [] });
});

test('regression: 44 species, Tetra IQ 45 at 215 GPH in the live catalog, no errors on load', async ({ page }) => {
  const errors = trackErrors(page);
  await openAdvisor(page);
  await page.waitForLoadState('load');
  await expect(page.locator('#plan-species option:not([value=""])')).toHaveCount(44);
  const iq45 = await page.evaluate(async () => {
    const catalog = await (await fetch('/assets/data/gearCatalog.json', { cache: 'no-store' })).json();
    return catalog.find((item: { id: string }) => item.id === 'tetra-whisper-iq-45');
  });
  expect(iq45).toMatchObject({ type: 'HOB', gphRated: 215, minGallons: 40, maxGallons: 75 });
  expect(errors).toEqual({ page: [], console: [] });
});
