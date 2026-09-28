// Live check of the saved-filter v2 plumbing and the sponge migration phase B rating model against
// production. Each test runs in a fresh browser context, so it only touches its own throwaway
// localStorage.
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

const chip = (page: Page, id: string) => page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${id}"]`);

async function addProduct(page: Page, id: string) {
  await expect.poll(() => page.locator(`#filter-product option[value="${id}"]`).count(), { timeout: 20000 }).toBe(1);
  await page.selectOption('#filter-product', id);
  await expect(page.locator('#filter-product-add')).toBeEnabled();
  await page.click('#filter-product-add');
  await expect(chip(page, id)).toBeVisible();
}

const settle = (page: Page) => page.waitForTimeout(2000);

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: Record<string, unknown> & { filters?: Array<Record<string, unknown>> } }).appState;
    const computed = compute.buildComputedState(appState);
    const filtering = computed.filtering;
    const text = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector))
      .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    return {
      chips: Array.from(document.querySelectorAll<HTMLElement>('[data-role="proto-filter-chips"] .proto-filter-chip'))
        .map((node) => `${node.dataset.filterId}|${node.textContent?.replace(/\s+/g, ' ').trim()}`),
      scoring: (appState.filters ?? []).map((filter) => [filter.id, filter.type, filter.rated_gph]),
      capacity: (appState.filters ?? []).map((filter) => [filter.id, filter.capacityMethod ?? null, filter.ratingStatus ?? null]),
      level: filtering.level,
      adequateBy: filtering.assessment?.adequateBy ?? null,
      spongeStatus: filtering.assessment?.sponge?.status ?? null,
      spongeRated: filtering.assessment?.sponge?.rated ?? null,
      gph: [filtering.gphTotal, filtering.biologicalGph, filtering.circulationGph],
      turnover: filtering.turnover,
      status: filtering.status,
      filtrationWarnings: (filtering.warnings ?? []).map((warning: { id: string; severity: string }) => [warning.id, warning.severity]),
      warnings: computed.status.warnings.map((warning: { id: string }) => warning.id),
      load: document.querySelector('[data-role="bioload-percent"]')?.textContent?.trim() ?? '',
      summary: document.querySelector('[data-role="proto-filter-summary"]')?.textContent?.trim() ?? '',
      // The filter area and the stock warnings: where a filter's own GPH / rating state is shown. The
      // product <select> is excluded, since its options legitimately list other products' ratings.
      filterText: [
        ...text('[data-role="proto-filter-chips"]'),
        ...text('[data-role="proto-filter-summary"]'),
        ...text('#stock-warnings'),
      ].join(' \n '),
      bodyText: document.body.innerText,
    };
  });
}

type Snapshot = Awaited<ReturnType<typeof snapshot>>;

// Everything that decides the filtration result, without free-running page text.
const evaluation = (state: Snapshot) => {
  const { bodyText: _body, ...rest } = state;
  return rest;
};

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const storedJson = async (page: Page, key: string) => {
  const raw = await stored(page, key);
  return raw === null ? null : JSON.parse(raw);
};

async function reloadWithStock(page: Page, tankId: string) {
  await page.reload();
  await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
  await setUp(page, tankId);
  await settle(page);
}

const filtrationWarningIds = (state: Snapshot) => state.warnings.filter((id: string) => id.startsWith('filtration.'));

test('phase B is deployed: the saved-state module is served with the rating model', async ({ request }) => {
  const response = await request.get('/js/stocking-advisor/filtration/saved-state.js');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("'ttg.stocking.filters.v2'");
  expect(body).toContain('CAPACITY_METHODS.MANUFACTURER_RATING');
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
  expect(before.adequateBy).toBe('powered');
  expect(before.gph).toEqual([215, 215, 0]);
  expect(before.turnover).toBeCloseTo(215 / 55, 6);
  expect(before.summary).toBe('Filtration: 215 GPH • 3.9×/h');
  expect(before.load).toBe(noFilter.load);
  expect(filtrationWarningIds(before)).toEqual([]);

  const v2 = await storedJson(page, V2);
  expect(v2.v).toBe(2);
  expect(v2.filters).toHaveLength(1);
  expect(v2.filters[0]).toMatchObject({ source: 'product', productId: 'tetra-whisper-iq-45', type: 'HOB', capacityMethod: 'flow', gph: 215 });
  expect(v2.filters[0].instanceId).toMatch(/^f-/);
  expect(await storedJson(page, V1)).toEqual([{ id: 'tetra-whisper-iq-45', type: 'HOB', rated_gph: 215 }]);

  await reloadWithStock(page, '55g');
  const after = await snapshot(page);
  expect(evaluation(after)).toEqual(evaluation(before));
  expect((await storedJson(page, V2)).filters[0].instanceId).toBe(v2.filters[0].instanceId);
  expect(errors).toEqual({ page: [], console: [] });
});

test('catalog sponge needing review (AQUANEAT 20): 0 GPH, "Rating needed", not evaluated, identical after reload', async ({ page }) => {
  const errors = trackErrors(page);
  await openAdvisor(page);
  const record = await page.evaluate(async () => {
    const catalog = await (await fetch('/assets/data/gearCatalog.json', { cache: 'no-store' })).json();
    return catalog.find((item: { id: string }) => item.id === 'aquaneat-sponge-20');
  });
  // The historical 120 GPH and a review-only 20 gal rating are both still in the record; neither may be used.
  expect(record).toMatchObject({ type: 'SPONGE', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 20, ratingStatus: 'needs_review', gphRated: 120 });
  // A 10 gal tank: the review-only 20 gal number would cover it if it were (wrongly) trusted.
  await setUp(page, '10g');
  await settle(page);
  const noFilter = await snapshot(page);
  await expect(page.locator('#filter-product option[value="aquaneat-sponge-20"]')).toHaveText(/Sponge • Rating needed$/);
  await addProduct(page, 'aquaneat-sponge-20');
  await settle(page);
  const before = await snapshot(page);
  expect(before.scoring).toEqual([['aquaneat-sponge-20', 'SPONGE', 0]]);
  expect(before.capacity).toEqual([['aquaneat-sponge-20', 'manufacturer_rating', 'needs_review']]);
  expect(before.gph).toEqual([0, 0, 0]);
  expect(before.turnover).toBe(0);
  expect(before.level).toBe('not-evaluated');
  expect(before.adequateBy).toBeNull();
  expect(before.spongeStatus).toBe('rating-needed');
  expect(before.spongeRated).toBe(false);
  expect(before.status.tone).not.toBe('good');
  expect(before.filtrationWarnings).toEqual([['filtration.rating_needed', 'info']]);
  await expect(chip(page, 'aquaneat-sponge-20').locator('.proto-filter-chip__gph')).toHaveText('Rating needed');
  expect(before.summary).toBe('Filtration: 1 sponge filter (rated by tank size)');
  expect(before.filterText).not.toMatch(/120\s*GPH|\bGPH\b.*×\/h|Rated for this tank|Rated up to 20/i);
  expect(before.load).toBe(noFilter.load);

  // Saved v2 is identity only: the rating is re-resolved from the catalog, no GPH is written, and a
  // rating-based sponge never reaches the v1 mirror.
  const v2 = await storedJson(page, V2);
  expect(v2.filters).toHaveLength(1);
  expect(v2.filters[0]).toEqual({ instanceId: v2.filters[0].instanceId, source: 'product', productId: 'aquaneat-sponge-20', type: 'SPONGE', capacityMethod: 'manufacturer_rating' });
  expect(v2.filters[0].instanceId).toMatch(/^f-/);
  expect(await stored(page, V1)).toBeNull();

  await reloadWithStock(page, '10g');
  const after = await snapshot(page);
  expect(evaluation(after)).toEqual(evaluation(before));
  expect(await storedJson(page, V2)).toEqual(v2);
  expect(errors).toEqual({ page: [], console: [] });
});

test('an existing v1 plan restores: sponge by rating (0 GPH, Rating needed), powered filters unchanged; v2 written, v1 flow only', async ({ page }) => {
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
    ['aquaneat-sponge-20', 'SPONGE', 0],
    ['manual-live-a', 'HOB', 150],
    ['manual-live-b', 'POWERHEAD', 300],
  ]);
  expect(state.capacity[0]).toEqual(['aquaneat-sponge-20', 'manufacturer_rating', 'needs_review']);
  // The old 120 GPH adds nothing: biological flow and turnover come from the HOB alone.
  expect(state.gph).toEqual([450, 150, 300]);
  expect(state.turnover).toBeCloseTo(150 / 29, 6);
  expect(state.level).toBe('adequate');
  expect(state.adequateBy).toBe('powered');
  expect(state.spongeStatus).toBe('rating-needed');
  expect(state.spongeRated).toBe(false);
  await expect(chip(page, 'aquaneat-sponge-20').locator('.proto-filter-chip__gph')).toHaveText('Rating needed');
  expect(state.summary).toBe('Filtration: 150 GPH • 5.2×/h + 1 sponge filter (rated by tank size) (+300 GPH circulation only)');
  expect(state.filterText).not.toMatch(/120\s*GPH|570|270/);

  const v2 = await storedJson(page, V2);
  expect(v2.v).toBe(2);
  expect(v2.filters.map((entry: Record<string, unknown>) => [entry.type, entry.gph, entry.capacityMethod]))
    .toEqual([['SPONGE', undefined, 'manufacturer_rating'], ['HOB', 150, 'flow'], ['POWERHEAD', 300, 'flow']]);
  expect(v2.filters[0]).toMatchObject({ source: 'product', productId: 'aquaneat-sponge-20' });
  expect(v2.filters[0]).not.toHaveProperty('manufacturerMaxGallons');
  expect(v2.filters[0]).not.toHaveProperty('legacyGph');
  // The v1 mirror now holds the flow devices only; the sponge is not written back as fake GPH.
  expect(await storedJson(page, V1)).toEqual([
    { id: 'manual-live-a', type: 'HOB', rated_gph: 150 },
    { id: 'manual-live-b', type: 'POWERHEAD', rated_gph: 300 },
  ]);
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
  expect(state.chips.map((entry: string) => entry.split('|')[0])).toEqual(['manual-live-good']);
  expect(state.scoring).toEqual([['manual-live-good', 'HOB', 150]]);
  expect(state.gph).toEqual([150, 150, 0]);
  expect(state.turnover).toBeCloseTo(150 / 20, 6);
  expect(state.level).toBe('adequate');
  expect(state.summary).toBe('Filtration: 150 GPH • 7.5×/h');
  // Scoped to the filter area and warnings: the product picker legitimately lists catalog sponges as
  // "Rating needed", so the whole page is not searched for that text.
  expect(state.filterText).not.toMatch(/banana|900|rating needed|invalid/i);
  expect(state.bodyText).not.toMatch(/banana/i);
  expect(state.bodyText).not.toMatch(/invalid (filter|capacity)/i);
  expect(filtrationWarningIds(state)).toEqual([]);
  const saved = await storedJson(page, V2);
  expect(saved.filters.map((entry: { instanceId: string }) => entry.instanceId)).toEqual(['f-live01']);
  expect(saved.filters[0]).toMatchObject({ source: 'custom', legacyId: 'manual-live-good', type: 'HOB', capacityMethod: 'flow', gph: 150 });
  expect(await storedJson(page, V1)).toEqual([{ id: 'manual-live-good', type: 'HOB', rated_gph: 150 }]);
  expect(errors).toEqual({ page: [], console: [] });
});

test('verified sponge (hygger Double Sponge S) on 29 gal: Rated 10–40 gal, 0 GPH, rated for this tank, identical after reload', async ({ page }) => {
  const errors = trackErrors(page);
  await openAdvisor(page);
  await setUp(page, '29g');
  await settle(page);
  const noFilter = await snapshot(page);
  const option = page.locator('#filter-product option[value="hygger-double-sponge-s"]');
  await expect(option).toHaveText(/Sponge • Rated 10–40 gal$/);
  await expect(option).not.toHaveText(/GPH|\b80\b/);
  await addProduct(page, 'hygger-double-sponge-s');
  await settle(page);
  const before = await snapshot(page);
  await expect(chip(page, 'hygger-double-sponge-s').locator('.proto-filter-chip__gph')).toHaveText('Rated 10–40 gal');
  expect(before.scoring).toEqual([['hygger-double-sponge-s', 'SPONGE', 0]]);
  expect(before.capacity).toEqual([['hygger-double-sponge-s', 'manufacturer_rating', 'verified']]);
  expect(before.gph).toEqual([0, 0, 0]);
  expect(before.turnover).toBe(0);
  expect(before.level).toBe('adequate');
  expect(before.adequateBy).toBe('sponge');
  expect(before.spongeStatus).toBe('rated');
  expect(before.status).toEqual({ tone: 'good', text: 'Rated for this tank' });
  expect(before.filtrationWarnings).toEqual([['filtration.sponge_rated', 'info']]);
  await expect(page.locator('#stock-warnings .status-strip[data-warning-id="filtration.sponge_rated"]')).toContainText('Rated for this tank');
  expect(before.summary).toBe('Filtration: 1 sponge filter (rated by tank size)');
  expect(before.filterText).not.toMatch(/80\s*GPH|×\/h/);
  expect(before.load).toBe(noFilter.load);

  const v2 = await storedJson(page, V2);
  expect(v2.filters).toEqual([{ instanceId: v2.filters[0].instanceId, source: 'product', productId: 'hygger-double-sponge-s', type: 'SPONGE', capacityMethod: 'manufacturer_rating' }]);
  expect(await stored(page, V1)).toBeNull();

  await reloadWithStock(page, '29g');
  const after = await snapshot(page);
  expect(evaluation(after)).toEqual(evaluation(before));
  expect(await storedJson(page, V2)).toEqual(v2);
  expect(errors).toEqual({ page: [], console: [] });
});

test('verified sponge (hygger Double Sponge S) on 55 gal: below manufacturer rating, amber not red, 80 GPH ignored', async ({ page }) => {
  const errors = trackErrors(page);
  await openAdvisor(page);
  await setUp(page, '55g');
  await settle(page);
  const noFilter = await snapshot(page);
  await addProduct(page, 'hygger-double-sponge-s');
  await settle(page);
  const state = await snapshot(page);
  await expect(chip(page, 'hygger-double-sponge-s').locator('.proto-filter-chip__gph')).toHaveText('Rated 10–40 gal');
  expect(state.scoring).toEqual([['hygger-double-sponge-s', 'SPONGE', 0]]);
  expect(state.gph).toEqual([0, 0, 0]);
  expect(state.turnover).toBe(0);
  expect(state.level).toBe('below-rating');
  expect(state.adequateBy).toBeNull();
  expect(state.spongeStatus).toBe('below-rating');
  expect(state.status).toEqual({ tone: 'warn', text: 'Below manufacturer rating' });
  expect(state.filtrationWarnings).toEqual([['filtration.below_rating', 'warn']]);
  const strip = page.locator('#stock-warnings .status-strip[data-warning-id="filtration.below_rating"]');
  await expect(strip).toHaveAttribute('data-state', 'warn');
  await expect(strip).toContainText('Filter rating: 10–40 gal · Tank: 55 gal.');
  await expect(page.locator('#stock-warnings .status-strip[data-state="bad"][data-warning-id^="filtration."]')).toHaveCount(0);
  expect(state.filterText).not.toMatch(/80\s*GPH|×\/h/);
  expect(state.load).toBe(noFilter.load);
  expect(errors).toEqual({ page: [], console: [] });
});

test('custom sponge: rated-gallons field replaces GPH; saved as a verified rating, no GPH; survives reload', async ({ page }) => {
  const errors = trackErrors(page);
  await openAdvisor(page);
  await setUp(page, '29g');
  await settle(page);
  const noFilter = await snapshot(page);
  await expect(page.locator('#fs-gph')).toBeVisible();
  await page.selectOption('#fs-type', 'Sponge');
  await expect(page.locator('#fs-gph')).toBeHidden();
  await expect(page.locator('[data-role="fs-rating-field"]')).toBeVisible();
  await expect(page.locator('[data-role="fs-rating-field"]')).toContainText('Rated for up to');
  await page.fill('#fs-rated-gallons', '40');
  await expect(page.locator('#fs-add-custom')).toBeEnabled();
  await page.click('#fs-add-custom');
  const custom = page.locator('[data-role="proto-filter-chips"] .proto-filter-chip[data-source="custom"]');
  await expect(custom).toHaveCount(1);
  await expect(custom.locator('.proto-filter-chip__gph')).toHaveText('Rated up to 40 gal');
  await settle(page);
  const before = await snapshot(page);
  const id = await custom.getAttribute('data-filter-id');
  expect(id).toMatch(/^manual-/);
  expect(before.scoring).toEqual([[id, 'SPONGE', 0]]);
  expect(before.capacity).toEqual([[id, 'manufacturer_rating', 'verified']]);
  expect(before.gph).toEqual([0, 0, 0]);
  expect(before.level).toBe('adequate');
  expect(before.adequateBy).toBe('sponge');
  expect(before.status).toEqual({ tone: 'good', text: 'Rated for this tank' });
  expect(before.load).toBe(noFilter.load);

  const v2 = await storedJson(page, V2);
  expect(v2.filters).toHaveLength(1);
  expect(v2.filters[0]).toEqual({
    instanceId: v2.filters[0].instanceId,
    source: 'custom',
    label: 'Sponge filter',
    legacyId: id,
    type: 'SPONGE',
    capacityMethod: 'manufacturer_rating',
    manufacturerMaxGallons: 40,
    ratingStatus: 'verified',
  });
  expect(await stored(page, V1)).toBeNull();

  await reloadWithStock(page, '29g');
  const after = await snapshot(page);
  expect(evaluation(after)).toEqual(evaluation(before));
  expect(await storedJson(page, V2)).toEqual(v2);
  expect(errors).toEqual({ page: [], console: [] });
});

test('a phase A v2 catalog sponge (capacityMethod flow, gph 120) restores by rating: Rating needed, no turnover; v2 rewritten', async ({ page }) => {
  const errors = trackErrors(page);
  await seedOnce(page, { [V2]: JSON.stringify({ v: 2, filters: [
    { instanceId: 'f-phasea', source: 'product', productId: 'aquaneat-sponge-20', type: 'SPONGE', capacityMethod: 'flow', gph: 120 },
  ] }) });
  await openAdvisor(page);
  await setUp(page, '10g');
  await settle(page);
  const state = await snapshot(page);
  expect(state.scoring).toEqual([['aquaneat-sponge-20', 'SPONGE', 0]]);
  expect(state.capacity).toEqual([['aquaneat-sponge-20', 'manufacturer_rating', 'needs_review']]);
  expect(state.gph).toEqual([0, 0, 0]);
  expect(state.turnover).toBe(0);
  expect(state.level).toBe('not-evaluated');
  expect(state.spongeStatus).toBe('rating-needed');
  expect(state.filtrationWarnings).toEqual([['filtration.rating_needed', 'info']]);
  await expect(chip(page, 'aquaneat-sponge-20').locator('.proto-filter-chip__gph')).toHaveText('Rating needed');
  expect(state.summary).toBe('Filtration: 1 sponge filter (rated by tank size)');
  expect(state.filterText).not.toMatch(/120\s*GPH|×\/h/);
  expect(await storedJson(page, V2)).toEqual({ v: 2, filters: [
    { instanceId: 'f-phasea', source: 'product', productId: 'aquaneat-sponge-20', type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
  ] });
  expect(await stored(page, V1)).toBeNull();
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
