// Sponge migration phase E on the real page (desktop and mobile): the current catalog no longer
// carries legacy sponge GPH or GPH-bucket min/max fields. Sponge options, chips and scoring stay
// rating based; powered filters and the UGF are unchanged. The catalog cache is ttg.gear.catalog.v3 (an
// old v2 cache is ignored) and current saves write ttg.stocking.filters.v2 only (no v1 mirror). Part of the Stocking Advisor gate (`npm run test:e2e:stocking-gate`).
// Report: _internal/reports/stocking-advisor-sponge-migration-phase-e-2026-09.md
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const V1 = 'ttg.stocking.filters.v1';
const V2 = 'ttg.stocking.filters.v2';
const CATALOG_CURRENT = 'ttg.gear.catalog.v3';
const CATALOG_V2 = 'ttg.gear.catalog.v2';
const HYGGER_S = 'hygger-double-sponge-s';
const HYGGER_M = 'hygger-double-sponge-m';
const AQUANEAT_SMALL = 'aquaneat-sponge-10';
const AQUANEAT_MIDDLE = 'aquaneat-sponge-20';
const AQUANEAT_LARGE = 'aquaneat-sponge-60';
const PAWFLY = 'pawfly-sponge-10';
const POWKOO = 'powkoo-dual-sponge-40';
const SPONGE_IDS = [AQUANEAT_SMALL, AQUANEAT_MIDDLE, AQUANEAT_LARGE, HYGGER_S, HYGGER_M, PAWFLY, POWKOO];
const TETRA = 'tetra-whisper-iq-45';
const UGF = 'penn-plax-ugf-20-29';
const CATALOG: Array<Record<string, unknown>> = JSON.parse(readFileSync('assets/data/gearCatalog.json', 'utf8'));
const nameOf = (id: string) => CATALOG.find((item) => item.id === id)?.name as string;
const EXPECTED_DETAILS: Record<string, string> = {
  [HYGGER_S]: 'Sponge • Rated 10–40 gal',
  [HYGGER_M]: 'Sponge • Rated 15–55 gal',
  [AQUANEAT_SMALL]: 'Sponge • Rating needed',
  [AQUANEAT_MIDDLE]: 'Sponge • Rating needed',
  [AQUANEAT_LARGE]: 'Sponge • Rating needed',
  [PAWFLY]: 'Sponge • Rating needed',
  [POWKOO]: 'Sponge • Rating needed',
};
// Any GPH, the historical sponge GPH values, or generic GPH-bucket range text ("0g–20g", "20g–40g").
const FORBIDDEN_SPONGE_TEXT = /GPH|\b\d+g\b|\d+g–|∞|\b(60|80|120|150|200)\b/;
const LEGACY_KEYS = ['gphRated', 'rated_gph', 'ratedGph', 'gph', 'minGallons', 'maxGallons'];

async function openAdvisor(page: Page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
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
const productChips = (page: Page, id: string) => page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${id}"]`);
const warning = (page: Page, id: string) => page.locator(`#stock-warnings .status-strip[data-warning-id="${id}"]`);
const addSelected = (page: Page) => page.locator('#filter-product-add');
const productNote = (page: Page) => page.locator('#filter-product-note');

async function addProductTimes(page: Page, id: string, times: number) {
  await expect.poll(() => page.locator(`#filter-product option[value="${id}"]`).count(), { timeout: 10000 }).toBe(1);
  await page.selectOption('#filter-product', id);
  const before = await chips(page).count();
  for (let i = 1; i <= times; i += 1) {
    await expect(addSelected(page)).toBeEnabled();
    await page.click('#filter-product-add');
    await expect(chips(page)).toHaveCount(before + i);
  }
}

// Every product option: value, text and data attributes.
async function productOptions(page: Page) {
  await expect.poll(() => page.locator('#filter-product').getAttribute('data-catalog-ready'), { timeout: 10000 }).toBe('1');
  return page.locator('#filter-product option:not([value=""])').evaluateAll((els) => els.map((el) => {
    const option = el as HTMLOptionElement;
    return { id: option.value, text: option.textContent ?? '', data: { ...option.dataset } as Record<string, string> };
  }));
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
      filters: (appState.filters ?? []).map((filter) => [filter.productId ?? filter.id, filter.type, filter.rated_gph, filter.ratingStatus ?? null]),
      load: load(computed),
      loadWithoutFilters: load(withoutFilters),
    };
  });
}

async function expectLoadUnchanged(page: Page) {
  const state = await engine(page);
  expect(state.load).toEqual(state.loadWithoutFilters);
  return state;
}

async function filtrationText(page: Page) {
  return page.evaluate(() => [
    document.querySelector('[data-role="proto-filter-chips"]')?.textContent ?? '',
    document.querySelector('[data-role="proto-filter-summary"]')?.textContent ?? '',
    document.querySelector('.filter-flow-meta')?.textContent ?? '',
    document.querySelector('#stock-warnings')?.textContent ?? '',
  ].join(' ').replace(/\s+/g, ' '));
}

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

test.describe('sponge phase E: legacy sponge GPH / bucket fields removed', () => {
  test('A–E: all seven sponge options on every tank size — rating text only, no GPH or bucket text; clean catalog cache', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    for (const tank of ['5g', '10g', '29g', '55g', '75g', '125g']) {
      await page.selectOption('#tank-size', tank);
      await settle(page);
      const options = await productOptions(page);
      const sponges = options.filter((option) => SPONGE_IDS.includes(option.id));
      expect(sponges.map((option) => option.id), tank).toEqual(SPONGE_IDS);
      for (const option of sponges) {
        // B–E: exact labels; the name plus the rating state.
        expect(option.text, `${tank} ${option.id}`).toBe(`${nameOf(option.id)} • ${EXPECTED_DETAILS[option.id]}`);
        expect(option.text.slice(nameOf(option.id).length)).not.toMatch(FORBIDDEN_SPONGE_TEXT);
        expect(option.data).toEqual({ filterType: 'SPONGE', ratingStatus: EXPECTED_DETAILS[option.id].includes('Rated') ? 'verified' : 'needed' });
      }
    }
    // The current catalog cache (v3) holds no legacy sponge fields; v2 is not written.
    expect(await stored(page, CATALOG_V2)).toBeNull();
    const cache = JSON.parse((await stored(page, CATALOG_CURRENT)) as string) as Array<Record<string, unknown>>;
    for (const id of SPONGE_IDS) {
      const record = cache.find((item) => item.id === id) as Record<string, unknown>;
      for (const key of LEGACY_KEYS) expect(key in record, `${id}: ${key}`).toBe(false);
    }
    expect(cache.find((item) => item.id === TETRA)).toMatchObject({ gphRated: 215, rated_gph: 215, minGallons: 40, maxGallons: 75 });
  });

  test('B–E: each sponge chip shows its rating state; unverified sponges are not evaluated; no GPH anywhere', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    for (const id of SPONGE_IDS) {
      await addProductTimes(page, id, 1);
      await expect(productChips(page, id).locator('.proto-filter-chip__gph')).toHaveText(EXPECTED_DETAILS[id].replace('Sponge • ', ''));
      await settle(page);
      const state = await expectLoadUnchanged(page);
      expect(state.gph).toEqual([0, 0, 0]);
      const verified = id === HYGGER_S || id === HYGGER_M;
      expect([state.level, state.adequateBy], id).toEqual(verified ? ['adequate', 'sponge'] : ['not-evaluated', null]);
      expect(await filtrationText(page)).not.toMatch(/GPH|\b\d+g–/);
      const v2 = JSON.parse((await stored(page, V2)) as string);
      expect(Object.keys(v2.filters[0]).sort()).toEqual(['capacityMethod', 'instanceId', 'productId', 'source', 'type']);
      await productChips(page, id).locator('[data-remove-filter]').click();
      await expect(chips(page)).toHaveCount(0);
    }
  });

  test('F: 55 gal + 2 × hygger S → "Likely adequate — multiple sponge filters", 0 GPH, independent instances', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '55g');
    await addProductTimes(page, HYGGER_S, 2);
    const ids = await productChips(page, HYGGER_S).evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.instanceId ?? ''));
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    await expect(productChips(page, HYGGER_S).locator('.proto-filter-chip__gph')).toHaveText(['Rated 10–40 gal', 'Rated 10–40 gal']);
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect(state.level).toBe('likely-multi-sponge');
    expect(state.gph).toEqual([0, 0, 0]);
    await expect(warning(page, 'filtration.likely_multi_sponge')).toContainText('Likely adequate — multiple sponge filters');
    expect(await filtrationText(page)).not.toMatch(/GPH|80 ?gal/);
    expect(await stored(page, V1)).toBeNull();
  });

  test('G: powered Tetra Whisper IQ 45 still shows and scores 215 GPH with its 40–75 gal range', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '55g');
    const options = await productOptions(page);
    const tetra = options.find((option) => option.id === TETRA);
    expect(tetra?.text).toBe(`${nameOf(TETRA)} • 215 GPH • HOB • 40g–75g`);
    expect(tetra?.data).toEqual({ minGallons: '40', maxGallons: '75', gph: '215', filterType: 'HOB' });
    await addProductTimes(page, TETRA, 1);
    await expect(productChips(page, TETRA).locator('.proto-filter-chip__gph')).toHaveText('215 GPH');
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect(state.filters).toEqual([[TETRA, 'HOB', 215, null]]);
    expect(state.gph).toEqual([215, 215, 0]);
    expect(state.level).toBe('adequate');
    // Phase E: v2 only, no v1 mirror.
    expect(JSON.parse((await stored(page, V2)) as string).filters.map((e: Record<string, unknown>) => [e.productId, e.gph])).toEqual([[TETRA, 215]]);
    expect(await stored(page, V1)).toBeNull();
  });

  test('H: UGF unchanged — 150 GPH, offered on its 20–40 gal range, one plate set per tank', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '55g');
    expect((await productOptions(page)).some((option) => option.id === UGF)).toBe(false);
    await page.selectOption('#tank-size', '29g');
    await settle(page);
    const ugf = (await productOptions(page)).find((option) => option.id === UGF);
    expect(ugf?.text).toBe(`${nameOf(UGF)} • 150 GPH • UGF • 20g–40g`);
    await addProductTimes(page, UGF, 1);
    await expect(productChips(page, UGF).locator('.proto-filter-chip__gph')).toHaveText('150 GPH');
    await expect(addSelected(page)).toBeDisabled();
    await page.selectOption('#filter-product', '');
    await page.selectOption('#filter-product', UGF);
    await expect(productNote(page)).toContainText('one plate set per tank');
    await expect(addSelected(page)).toBeDisabled();
    await settle(page);
    const state = await expectLoadUnchanged(page);
    expect(state.gph).toEqual([150, 150, 0]);
    expect(state.level).toBe('adequate');
  });

  test('an old ttg.gear.catalog.v2 (legacy sponge GPH / buckets, tampered rating) is ignored: network catalog used, v3 written clean', async ({ page }) => {
    // What the phases B–D loader cached, plus a tampered verified rating that must not surface.
    const LEGACY: Record<string, [number, number, number]> = {
      [AQUANEAT_SMALL]: [60, 0, 20], [AQUANEAT_MIDDLE]: [120, 0, 20], [AQUANEAT_LARGE]: [200, 20, 40],
      [HYGGER_S]: [80, 0, 20], [HYGGER_M]: [120, 0, 20], [PAWFLY]: [60, 0, 20], [POWKOO]: [150, 20, 40],
    };
    const oldCache = CATALOG.map((item) => {
      const legacy = LEGACY[item.id as string];
      if (!legacy) return item;
      const { ratingEvidence, ratingSourceKind, ratingSource, productRef, ratingNote, ratingCheckedAt, ratingExpression, ...runtime } = item;
      return { ...runtime, gphRated: legacy[0], rated_gph: legacy[0], minGallons: legacy[1], maxGallons: legacy[2],
        ...(item.id === POWKOO ? { ratingStatus: 'verified', manufacturerMaxGallons: 500 } : {}) };
    });
    const oldJson = JSON.stringify(oldCache);
    await seedStorage(page, {
      [CATALOG_V2]: oldJson,
      'ttg.gear.catalog.timestamp': '1',
      [V2]: JSON.stringify({ v: 2, filters: [
        { instanceId: 'f-olde01', source: 'product', productId: HYGGER_S, type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
        { instanceId: 'f-olde02', source: 'product', productId: POWKOO, type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
      ] }),
    });
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await settle(page);
    const options = await productOptions(page);
    for (const id of SPONGE_IDS) {
      expect(options.find((option) => option.id === id)?.text).toBe(`${nameOf(id)} • ${EXPECTED_DETAILS[id]}`);
    }
    await expect(productChips(page, HYGGER_S).locator('.proto-filter-chip__gph')).toHaveText('Rated 10–40 gal');
    await expect(productChips(page, POWKOO).locator('.proto-filter-chip__gph')).toHaveText('Rating needed');
    const state = await expectLoadUnchanged(page);
    expect(state.gph).toEqual([0, 0, 0]);
    expect([state.level, state.adequateBy]).toEqual(['adequate', 'sponge']);
    expect(await filtrationText(page)).not.toMatch(/GPH|\b(60|80|120|150|200|500)\b/);
    // v2 is left for tabs still running older code; the current generation is v3, clean.
    expect(await stored(page, CATALOG_V2)).toBe(oldJson);
    const v3 = JSON.parse((await stored(page, CATALOG_CURRENT)) as string) as Array<Record<string, unknown>>;
    for (const id of SPONGE_IDS) {
      for (const key of LEGACY_KEYS) expect(key in (v3.find((item) => item.id === id) as object), `${id}: ${key}`).toBe(false);
    }
  });

  test('clearing every filter removes v2 and a historical v1: the old plan does not return after reload', async ({ page }) => {
    await seedStorage(page, { [V1]: JSON.stringify([{ id: TETRA, type: 'HOB', rated_gph: 215 }, { id: HYGGER_S, type: 'SPONGE', rated_gph: 120 }]) });
    await openAdvisor(page);
    await setUpTank(page, '55g');
    await settle(page);
    // Historical v1 migrated: both restored, the sponge by rating; saved as v2 only.
    await expect(chips(page)).toHaveCount(2);
    expect((await engine(page)).filters).toEqual([[TETRA, 'HOB', 215, null], [HYGGER_S, 'SPONGE', 0, 'verified']]);
    expect(await stored(page, V1)).toBeNull();
    while (await chips(page).count()) {
      await chips(page).first().locator('[data-remove-filter]').click();
    }
    await settle(page);
    expect([await stored(page, V2), await stored(page, V1)]).toEqual([null, null]);
    await page.reload();
    await setUpTank(page, '55g');
    await settle(page);
    await expect(chips(page)).toHaveCount(0);
    expect((await engine(page)).level).toBe('none');
  });
});
