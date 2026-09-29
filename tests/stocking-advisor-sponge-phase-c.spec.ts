// Sponge migration phase C on the real page (desktop and mobile): old saved / cached data can never
// resurrect the retired sponge-GPH model. Part of the Stocking Advisor gate
// (`npm run test:e2e:stocking-gate`). Report: _internal/reports/stocking-advisor-sponge-migration-phase-c-2026-09.md
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const V1 = 'ttg.stocking.filters.v1';
const V2 = 'ttg.stocking.filters.v2';
// Current catalog cache key (v3 in phase E, v4 since phase F). Stale-shaped records are fed through
// it so the loader's historical-record sanitising stays covered; retired generations must stay unused.
const CATALOG_CURRENT = 'ttg.gear.catalog.v4';
const CATALOG_V2 = 'ttg.gear.catalog.v2';
const CATALOG_V1 = 'ttg.gear.catalog.v1';
const HYGGER_S = 'hygger-double-sponge-s';
const HYGGER_M = 'hygger-double-sponge-m';
// Historical fake sponge GPH used in the fixtures; none may appear in the filtration UI.
const FAKE_GPH = /\b(60|90|120|200|250|900) ?GPH\b/;

const RAW = JSON.parse(readFileSync(new URL('../assets/data/gearCatalog.json', import.meta.url), 'utf8'));
const RAW_ITEMS: Array<Record<string, unknown>> = Array.isArray(RAW) ? RAW : RAW.items;
// A catalog cache as code before phase B wrote it: sponge records with fake GPH, no rating metadata.
const STALE_CATALOG = RAW_ITEMS.map((item) => (item.type === 'SPONGE'
  ? { id: item.id, brand: item.brand, name: `${item.name} (Up to 40G)`, type: 'SPONGE', gphRated: 120, rated_gph: 120, minGallons: 0, maxGallons: 40, capacityMethod: 'flow' }
  : { ...item }));

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
const chip = (page: Page, id: string) => page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${id}"]`);

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
      filters: (appState.filters ?? []).map((filter) => [filter.id, filter.type, filter.rated_gph, filter.capacityMethod, filter.ratingStatus ?? null]),
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
  ].join(' ').replace(/\s+/g, ' ')
    // Phase G: the card's one permitted mention of an old custom sponge's GPH (design 12), never scored.
    .replace(/Old value: \d+ GPH — not used for sponge filters\./g, ''));
}

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const savedV2 = async (page: Page) => JSON.parse((await stored(page, V2)) ?? 'null');

// Filtration never moves Stocking Load: the same stock with no filters gives the same load.
async function expectLoadUnchanged(page: Page) {
  const state = await engine(page);
  expect(state.load).toEqual(state.loadWithoutFilters);
  return state;
}

test.describe('sponge phase C: stale / legacy data', () => {
  test('old v1 catalog sponges with fake GPH: catalog rating wins, GPH never shown or scored, stable on reload', async ({ page }) => {
    await seedStorage(page, { [V1]: JSON.stringify([
      { id: HYGGER_S, type: 'SPONGE', rated_gph: 900 },
      { id: 'aquaneat-sponge-60', type: 'SPONGE', rated_gph: 200 },
      { id: 'powkoo-dual-sponge-40', type: 'SPONGE', rated_gph: 250 },
    ]) });
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect(state.filters).toEqual([
      [HYGGER_S, 'SPONGE', 0, 'manufacturer_rating', 'verified'],
      ['aquaneat-sponge-60', 'SPONGE', 0, 'manufacturer_rating', 'needs_review'],
      ['powkoo-dual-sponge-40', 'SPONGE', 0, 'manufacturer_rating', 'needed'],
    ]);
    expect(state.gph).toEqual([0, 0, 0]);
    expect([state.level, state.adequateBy]).toEqual(['adequate', 'sponge']);
    await expect(chip(page, HYGGER_S)).toContainText('Rated 10–40 gal');
    await expect(chip(page, 'aquaneat-sponge-60')).toContainText('Rating needed');
    expect(await filtrationText(page)).not.toMatch(FAKE_GPH);
    const first = await savedV2(page);
    expect(first.filters.map((e: Record<string, unknown>) => Object.keys(e).sort().join(','))).toEqual(Array(3).fill('capacityMethod,instanceId,productId,source,type'));
    expect(await stored(page, V1)).toBeNull();
    await page.reload();
    await setUpTank(page, '29g');
    await settle(page);
    expect(await savedV2(page)).toEqual(first);
    expect((await engine(page)).filters).toEqual(state.filters);
  });

  test('old phase-A v2 catalog sponges (capacityMethod flow + gph): rewritten as identity, no flow', async ({ page }) => {
    await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-pha001', source: 'product', productId: HYGGER_M, type: 'SPONGE', capacityMethod: 'flow', gph: 200 },
      { instanceId: 'f-pha002', source: 'product', productId: 'pawfly-sponge-10', type: 'SPONGE', capacityMethod: 'flow', gph: 60 },
    ] }) });
    await openAdvisor(page);
    await setUpTank(page, '40b');
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect(state.gph).toEqual([0, 0, 0]);
    expect([state.level, state.adequateBy]).toEqual(['adequate', 'sponge']);
    expect(await savedV2(page)).toEqual({ v: 2, filters: [
      { instanceId: 'f-pha001', source: 'product', productId: HYGGER_M, type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
      { instanceId: 'f-pha002', source: 'product', productId: 'pawfly-sponge-10', type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
    ] });
    expect(await filtrationText(page)).not.toMatch(FAKE_GPH);
  });

  test('old custom GPH-only sponges (several historical shapes): Rating needed, then Add rating upgrades in place', async ({ page }) => {
    await seedStorage(page, {
      [V2]: '{broken json',
      [V1]: JSON.stringify([
        { id: 'manual-shape1', type: 'SPONGE', rated_gph: 120 },
        { id: 'manual-shape2', type: 'Sponge', gph: 90 },
        { id: 'manual-shape3', filterType: 'SPONGE', rated_gph: 200 },
      ]),
    });
    await openAdvisor(page);
    await setUpTank(page, '10g');
    await settle(page);
    let state = await expectLoadUnchanged(page);
    expect(state.filters.map((row) => [row[0], row[1], row[2], row[4]])).toEqual([
      ['manual-shape1', 'SPONGE', 0, 'needed'],
      ['manual-shape2', 'SPONGE', 0, 'needed'],
      ['manual-shape3', 'SPONGE', 0, 'needed'],
    ]);
    expect(state.level).toBe('not-evaluated');
    await expect(chips(page)).toHaveCount(3);
    for (const id of ['manual-shape1', 'manual-shape2', 'manual-shape3']) {
      await expect(chip(page, id)).toContainText('Rating needed');
      await expect(chip(page, id).locator('[data-rate-filter]')).toHaveCount(1);
    }
    expect(await filtrationText(page)).not.toMatch(FAKE_GPH);
    expect((await savedV2(page)).filters.map((e: { legacyGph?: number; gph?: number }) => [e.legacyGph, e.gph])).toEqual([[120, undefined], [90, undefined], [200, undefined]]);

    await chip(page, 'manual-shape3').locator('[data-rate-filter]').click();
    await expect(page.locator('#fs-rated-gallons')).toBeFocused();
    await page.fill('#fs-rated-gallons', '15');
    await page.click('#fs-add-custom');
    await expect(chips(page)).toHaveCount(3);
    await expect(chip(page, 'manual-shape3')).toContainText('Rated up to 15 gal');
    await settle(page);
    state = await expectLoadUnchanged(page);
    expect([state.level, state.adequateBy]).toEqual(['adequate', 'sponge']);
    const upgraded = (await savedV2(page)).filters[2];
    expect(upgraded).toMatchObject({ legacyId: 'manual-shape3', manufacturerMaxGallons: 15, ratingStatus: 'verified' });
    expect(upgraded.legacyGph).toBeUndefined();
    expect(upgraded.gph).toBeUndefined();
  });

  test('stale type conflicts: a known sponge saved as HOB is a sponge; a known HOB saved as SPONGE is the HOB', async ({ page }) => {
    await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-conf01', source: 'product', productId: HYGGER_S, type: 'HOB', capacityMethod: 'flow', gph: 900 },
      { instanceId: 'f-conf02', source: 'product', productId: 'aquaneat-sponge-20', gph: 250 },
      { instanceId: 'f-conf03', source: 'product', productId: 'aquaclear-70', type: 'SPONGE', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 500, ratingStatus: 'verified' },
    ] }) });
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect(state.filters).toEqual([
      [HYGGER_S, 'SPONGE', 0, 'manufacturer_rating', 'verified'],
      ['aquaneat-sponge-20', 'SPONGE', 0, 'manufacturer_rating', 'needs_review'],
      ['aquaclear-70', 'HOB', 300, 'flow', null],
    ]);
    expect(state.gph).toEqual([300, 300, 0]);
    expect([state.level, state.adequateBy]).toEqual(['adequate', 'both']);
    await expect(chip(page, 'aquaclear-70')).toContainText('300 GPH');
    expect(await filtrationText(page)).not.toMatch(FAKE_GPH);
    expect((await savedV2(page)).filters.map((e: Record<string, unknown>) => [e.productId, e.type, e.capacityMethod, e.gph])).toEqual([
      [HYGGER_S, 'SPONGE', 'manufacturer_rating', undefined],
      ['aquaneat-sponge-20', 'SPONGE', 'manufacturer_rating', undefined],
      ['aquaclear-70', 'HOB', 'flow', 300],
    ]);
    expect(await stored(page, V1)).toBeNull(); // phase E: no v1 mirror
  });

  test('stale type conflict with the catalog unavailable: the known sponge still scores 0 GPH (Rating needed)', async ({ page }) => {
    await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-off001', source: 'product', productId: HYGGER_S, type: 'HOB', capacityMethod: 'flow', gph: 900 },
      { instanceId: 'f-off002', source: 'product', productId: 'tetra-whisper-iq-45', type: 'HOB', capacityMethod: 'flow', gph: 215 },
    ] }) });
    await openAdvisor(page, { offline: true });
    await setUpTank(page, '29g');
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect(state.filters).toEqual([
      [HYGGER_S, 'SPONGE', 0, 'manufacturer_rating', 'needed'],
      ['tetra-whisper-iq-45', 'HOB', 215, 'flow', null],
    ]);
    expect(state.gph).toEqual([215, 215, 0]);
    expect(await filtrationText(page)).not.toMatch(/\b900 ?GPH\b/);
    expect((await savedV2(page)).filters[0]).toEqual({ instanceId: 'f-off001', source: 'product', productId: HYGGER_S, type: 'SPONGE', capacityMethod: 'manufacturer_rating' });
  });

  test('stale catalog cache (GPH-only sponges in the current key, plus old v2 / v1 caches): Rating needed, then verified after refresh', async ({ page }) => {
    const oldV2 = JSON.stringify(STALE_CATALOG.map((item) => (item.id === HYGGER_S ? { ...item, type: 'HOB', gphRated: 700 } : item)));
    await seedStorage(page, {
      [CATALOG_CURRENT]: JSON.stringify(STALE_CATALOG),
      [CATALOG_V2]: oldV2,
      [CATALOG_V1]: JSON.stringify(STALE_CATALOG.map((item) => (item.id === HYGGER_M ? { ...item, type: 'HOB', gphRated: 900 } : item))),
      [V1]: JSON.stringify([{ id: HYGGER_S, type: 'SPONGE', rated_gph: 120 }]),
    });
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await settle(page);
    let state = await expectLoadUnchanged(page);
    // First load uses the stale cache: no rating metadata (no ratingStatus at all) → Rating needed,
    // never 120 GPH.
    expect(state.filters).toEqual([[HYGGER_S, 'SPONGE', 0, 'manufacturer_rating', null]]);
    expect([state.level, state.gph, state.turnover]).toEqual(['not-evaluated', [0, 0, 0], 0]);
    await expect(chip(page, HYGGER_S)).toContainText('Rating needed');
    expect(await filtrationText(page)).not.toMatch(FAKE_GPH);
    // The background refresh has rewritten the current cache with current metadata; the old v2 and v1
    // caches are neither used nor touched.
    await expect.poll(async () => JSON.parse((await stored(page, CATALOG_CURRENT)) as string).find((i: { id: string }) => i.id === HYGGER_S).ratingStatus).toBe('verified');
    expect(await stored(page, CATALOG_V2)).toBe(oldV2);
    expect(JSON.parse((await stored(page, CATALOG_V1)) as string).find((i: { id: string }) => i.id === HYGGER_M).gphRated).toBe(900);
    await page.reload();
    await setUpTank(page, '29g');
    await settle(page);
    state = await expectLoadUnchanged(page);
    expect(state.filters).toEqual([[HYGGER_S, 'SPONGE', 0, 'manufacturer_rating', 'verified']]);
    expect([state.level, state.adequateBy, state.gph]).toEqual(['adequate', 'sponge', [0, 0, 0]]);
    await expect(chip(page, HYGGER_S)).toContainText('Rated 10–40 gal');
    // The v1 cache's "HOB 900 GPH" Hygger M never reaches the picker.
    await expect(page.locator(`#filter-product option[value="${HYGGER_M}"]`)).toContainText('Sponge');
    await expect(page.locator(`#filter-product option[value="${HYGGER_M}"]`)).not.toContainText('GPH');
  });

  test('offline with a stale cache: stale sponge GPH harmless, no fake adequate result, page works', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await seedStorage(page, {
      [CATALOG_CURRENT]: JSON.stringify(STALE_CATALOG),
      [CATALOG_V2]: JSON.stringify(STALE_CATALOG.map((item) => (item.id === HYGGER_S ? { ...item, type: 'HOB', gphRated: 900 } : item))),
      [V1]: JSON.stringify([{ id: HYGGER_S, type: 'SPONGE', rated_gph: 120 }, { id: 'manual-oldsp', type: 'SPONGE', rated_gph: 200 }]),
    });
    await openAdvisor(page, { offline: true });
    await setUpTank(page, '20l');
    await settle(page);
    const state = await expectLoadUnchanged(page);
    // The stale cached record has no rating (null); the custom sponge needs one.
    expect(state.filters.map((row) => [row[0], row[2], row[4]])).toEqual([[HYGGER_S, 0, null], ['manual-oldsp', 0, 'needed']]);
    expect([state.level, state.gph, state.turnover]).toEqual(['not-evaluated', [0, 0, 0], 0]);
    await expect(chip(page, HYGGER_S)).toContainText('Rating needed');
    expect(await filtrationText(page)).not.toMatch(FAKE_GPH);
    // The (stale) cached catalog still serves the picker.
    await expect(page.locator(`#filter-product option[value="${HYGGER_M}"]`)).toContainText('Rating needed');
    // Offline with no current cache (only the obsolete v2 generation): the catalog is unavailable —
    // v2 is not a fallback — and the sponges stay Rating needed.
    await page.evaluate((key) => localStorage.removeItem(key), CATALOG_CURRENT);
    await page.reload();
    await setUpTank(page, '20l');
    await settle(page);
    const noCache = await expectLoadUnchanged(page);
    expect(noCache.filters.map((row) => [row[0], row[2], row[4]])).toEqual([[HYGGER_S, 0, 'needed'], ['manual-oldsp', 0, 'needed']]);
    expect(noCache.level).toBe('not-evaluated');
    expect(errors).toEqual([]);
  });

  test('mixed valid / malformed v2 entries: valid peers survive, v1 is not used, nothing fake-passes', async ({ page }) => {
    await seedStorage(page, {
      [V2]: JSON.stringify({ v: 2, filters: [
        { instanceId: 'f-mix001', source: 'product', productId: 'tetra-whisper-iq-45', type: 'HOB', capacityMethod: 'flow', gph: 215 },
        { instanceId: 'f-mix002', source: 'custom', label: 'Sponge filter', legacyId: 'manual-mixok', type: 'SPONGE', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 30, ratingStatus: 'verified' },
        { instanceId: 'f-mix003', source: 'custom', legacyId: 'manual-mixbad', type: 'SPONGE', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: -5, ratingStatus: 'verified', gph: 900 },
        { instanceId: 'f-mix004', source: 'custom', legacyId: 'manual-mixrev', type: 'SPONGE', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 500, ratingStatus: 'needs_review' },
        { instanceId: 'f-mix005', source: 'custom', legacyId: 'manual-mixmeth', type: 'CANISTER', capacityMethod: 'turbo', gph: 900 },
        'garbage',
        { nonsense: true },
      ] }),
      [V1]: JSON.stringify([{ id: 'manual-v1only', type: 'HOB', rated_gph: 999 }]),
    });
    await openAdvisor(page);
    await setUpTank(page, '55g');
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect(state.filters.map((row) => [row[0], row[1], row[2], row[4]])).toEqual([
      ['tetra-whisper-iq-45', 'HOB', 215, null],
      ['manual-mixok', 'SPONGE', 0, 'verified'],
      ['manual-mixbad', 'SPONGE', 0, 'needed'],
      ['manual-mixrev', 'SPONGE', 0, 'needed'],
    ]);
    expect(state.gph).toEqual([215, 215, 0]);
    // 215 GPH on 55 gal is 3.9×: the powered filter carries it; no sponge passes (30 < 55, others unrated).
    expect([state.level, state.adequateBy]).toEqual(['adequate', 'powered']);
    await expect(chips(page)).toHaveCount(4);
    expect(await filtrationText(page)).not.toMatch(FAKE_GPH);
    expect(await stored(page, V1)).toBeNull(); // phase E: no v1 mirror; the stale v1 is removed on save
  });
});
