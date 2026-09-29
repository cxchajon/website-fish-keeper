// Live check of the saved-filter v2 plumbing, the sponge migration phase B rating model, the
// phase C stale-data fallback and phase D duplicate filter instances against production. Each test runs in a fresh browser context, so it
// only touches its own throwaway localStorage. Phase E contract: current saves write
// ttg.stocking.filters.v2 only (no v1 mirror; a historical v1 plan is still read, migrated and then
// removed). Phase F contract: the catalog cache is ttg.gear.catalog.v4 (v3 in phase E), and the
// undergravel filter is evaluated by its listed tank presets (20 Long and 29 Gallon), never by GPH.
import { test, expect, type Page } from '@playwright/test';

const V1 = 'ttg.stocking.filters.v1';
const V2 = 'ttg.stocking.filters.v2';
const CATALOG_CACHE = 'ttg.gear.catalog.v4';
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

test('phases B–F are deployed: saved-state (rating model, no v1 mirror) and catalog cache v4 are served', async ({ request }) => {
  const response = await request.get('/js/stocking-advisor/filtration/saved-state.js');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("'ttg.stocking.filters.v2'");
  expect(body).toContain('CAPACITY_METHODS.MANUFACTURER_RATING');
  // Phase E: the v1 mirror serializer is retired. Phase F: UGF entries are tank_compatibility and the
  // catalog cache generation is v4.
  expect(body).not.toContain('toV1Mirror');
  expect(body).toContain('CAPACITY_METHODS.TANK_COMPATIBILITY');
  const gear = await request.get('/js/gear-data.js');
  expect(gear.status()).toBe(200);
  expect(await gear.text()).toContain("'ttg.gear.catalog.v4'");
});

test('powered catalog filter (Tetra IQ 45): 215 GPH, load unchanged, v2 written (no v1 mirror), identical after reload', async ({ page }) => {
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
  expect(await stored(page, V1)).toBeNull(); // phase E: v2 only, no v1 mirror

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
  // A review-only 20 gal rating is in the record and must not be used. Since phase E the record carries
  // no legacy sponge GPH (formerly 120) and no GPH-bucket minGallons / maxGallons.
  expect(record).toMatchObject({ type: 'SPONGE', capacityMethod: 'manufacturer_rating', manufacturerMaxGallons: 20, ratingStatus: 'needs_review' });
  for (const key of ['gphRated', 'rated_gph', 'minGallons', 'maxGallons']) expect(record, key).not.toHaveProperty(key);
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

test('an existing v1 plan restores: sponge by rating (0 GPH, Rating needed), powered filters unchanged; v2 written, historical v1 removed', async ({ page }) => {
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
  // Phase E: the plan now lives in v2 only; no v1 mirror is written and the historical v1 is removed,
  // so the sponge's old 120 GPH is never written back anywhere.
  expect(await stored(page, V1)).toBeNull();
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
  expect(await stored(page, V1)).toBeNull(); // phase E: no v1 mirror
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

// Sponge migration phase C (report: _internal/reports/stocking-advisor-sponge-migration-phase-c-2026-09.md).
// The catalog-unavailable fallback: with no catalog to re-resolve the id, a known sponge saved with a
// contradictory powered type and a fake GPH must still restore as a 0-GPH sponge (before phase C it
// restored as a 900 GPH HOB and was saved back that way).
test('phase C: catalog unavailable — a known sponge id saved as a 900 GPH HOB fails safe as a sponge (0 GPH, Rating needed)', async ({ page }) => {
  const errors = trackErrors(page);
  const CATALOG_PATH = '/assets/data/gearCatalog.json';
  let catalogRequests = 0;
  // Only the filter catalog data request fails; the page and every JS module load normally.
  await page.route((url) => url.pathname === CATALOG_PATH, (route) => {
    catalogRequests += 1;
    return route.abort('failed');
  });
  // Fresh context: there is no cached catalog (current ttg.gear.catalog.v4, or an old v3 / v2 / v1) to fall back on either.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__phaseC_seeded')) return;
    sessionStorage.setItem('__phaseC_seeded', '1');
    localStorage.removeItem('ttg.gear.catalog.v4');
    localStorage.removeItem('ttg.gear.catalog.v3');
    localStorage.removeItem('ttg.gear.catalog.v2');
    localStorage.removeItem('ttg.gear.catalog.v1');
    localStorage.removeItem('ttg.stocking.filters.v1');
    localStorage.setItem('ttg.stocking.filters.v2', JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-phasec', source: 'product', productId: 'aquaneat-sponge-20', type: 'HOB', capacityMethod: 'flow', gph: 900 },
    ] }));
  });
  await openAdvisor(page);
  await setUp(page, '10g');
  await settle(page);

  // The fallback path really ran: the catalog request failed and nothing resolved the product.
  expect(catalogRequests).toBeGreaterThan(0);
  await expect(page.locator('#filter-product')).toHaveAttribute('data-catalog-ready', '0');
  expect(await stored(page, CATALOG_CACHE)).toBeNull();
  expect(await stored(page, 'ttg.gear.catalog.v2')).toBeNull();

  const state = await snapshot(page);
  expect(state.scoring).toEqual([['aquaneat-sponge-20', 'SPONGE', 0]]);
  expect(state.capacity).toEqual([['aquaneat-sponge-20', 'manufacturer_rating', 'needed']]);
  // The fake 900 GPH adds nothing: no biological GPH, no turnover, not adequate from flow.
  expect(state.gph).toEqual([0, 0, 0]);
  expect(state.turnover).toBe(0);
  expect(state.level).toBe('not-evaluated');
  expect(state.adequateBy).toBeNull();
  expect(state.spongeStatus).toBe('rating-needed');
  expect(state.spongeRated).toBe(false);
  expect(state.status.tone).not.toBe('good');
  expect(state.filtrationWarnings).toEqual([['filtration.rating_needed', 'info']]);
  // Still biological filtration: never "No biological filter" / "No filter added".
  expect(filtrationWarningIds(state)).not.toContain('filtration.circulation_only');
  expect(filtrationWarningIds(state)).not.toContain('filtration.none');
  const engine = await page.evaluate(async () => {
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: Record<string, unknown> }).appState;
    const computed = compute.buildComputedState(appState);
    const withoutFilters = compute.buildComputedState({ ...appState, filters: [] });
    const load = (c: { bioload: Record<string, unknown> }) => [c.bioload.currentPercent, c.bioload.proposedPercent, c.bioload.text, c.bioload.severity];
    return {
      hasBiologicalFiltration: computed.filtering.assessment?.hasBiologicalFiltration ?? null,
      hasBiologicalGph: computed.filtering.assessment?.hasBiologicalGph ?? null,
      load: load(computed),
      loadWithoutFilters: load(withoutFilters),
    };
  });
  expect(engine.hasBiologicalFiltration).toBe(true);
  expect(engine.hasBiologicalGph).toBe(false);
  // Stocking Load is exactly what the same stock gives with no filter at all.
  expect(engine.load).toEqual(engine.loadWithoutFilters);
  // Nothing shows the fake flow.
  await expect(chip(page, 'aquaneat-sponge-20').locator('.proto-filter-chip__gph')).toHaveText('Rating needed');
  expect(state.summary).toBe('Filtration: 1 sponge filter (rated by tank size)');
  expect(state.filterText).not.toMatch(/900|×\/h/);
  expect(state.bodyText).not.toMatch(/\b900\s*GPH\b/i);

  // Saved back as a rating sponge (identity only), never as a 900 GPH flow filter; no v1 mirror entry.
  const v2 = await storedJson(page, V2);
  expect(v2).toEqual({ v: 2, filters: [
    { instanceId: 'f-phasec', source: 'product', productId: 'aquaneat-sponge-20', type: 'SPONGE', capacityMethod: 'manufacturer_rating' },
  ] });
  expect(await stored(page, V1)).toBeNull();

  // Still offline after a reload: the same fail-safe result, nothing rewritten as flow.
  await reloadWithStock(page, '10g');
  const after = await snapshot(page);
  expect(evaluation(after)).toEqual(evaluation(state));
  expect(await storedJson(page, V2)).toEqual(v2);

  // Removing the sponge leaves the Stocking Load label unchanged.
  const loadWithSponge = after.load;
  await chip(page, 'aquaneat-sponge-20').locator('[data-remove-filter]').click();
  await expect(chip(page, 'aquaneat-sponge-20')).toHaveCount(0);
  await settle(page);
  expect((await snapshot(page)).load).toBe(loadWithSponge);

  // The only allowed console errors are the ones caused by the catalog request this test deliberately
  // failed: the network error itself and stocking.js's own report of it. Anything else fails.
  const inducedByOutage = (message: string) => message.includes(CATALOG_PATH)
    || (message.startsWith('[Stocking] Filter catalog load failed: TypeError: Failed to fetch'));
  expect(errors.page).toEqual([]);
  expect(errors.console.filter((message) => !inducedByOutage(message))).toEqual([]);
});

// Phase D: the same catalog product twice is two physical filters (same productId, own instanceId).
test('phase D: hygger Double Sponge S added twice on 55 gal: two instances, likely-multi, saved, remove one by instance', async ({ page }) => {
  const HYGGER_S = 'hygger-double-sponge-s';
  const INSTANCE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
  const errors = trackErrors(page);
  const hyggerChips = chip(page, HYGGER_S);
  const instanceIds = () => hyggerChips.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.instanceId ?? ''));
  const engineLoad = () => page.evaluate(async () => {
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: Record<string, unknown> }).appState;
    const load = (c: { bioload: Record<string, unknown> }) => [c.bioload.currentPercent, c.bioload.proposedPercent, c.bioload.text, c.bioload.severity];
    return { load: load(compute.buildComputedState(appState)), withoutFilters: load(compute.buildComputedState({ ...appState, filters: [] })) };
  });
  const expectLoadUnchanged = async (state: Snapshot, noFilterLoad: string) => {
    expect(state.load).toBe(noFilterLoad);
    const engine = await engineLoad();
    expect(engine.load).toEqual(engine.withoutFilters);
  };

  await openAdvisor(page);
  await setUp(page, '55g');
  await settle(page);
  const noFilter = await snapshot(page);

  // Real UI: select once, Add Selected twice.
  await expect.poll(() => page.locator(`#filter-product option[value="${HYGGER_S}"]`).count(), { timeout: 20000 }).toBe(1);
  await page.selectOption('#filter-product', HYGGER_S);
  const add = page.locator('#filter-product-add');
  await expect(add).toBeEnabled();
  await add.click();
  await expect(hyggerChips).toHaveCount(1);
  await expect(add).toBeEnabled();
  await add.click();
  await expect(hyggerChips).toHaveCount(2);
  await settle(page);

  const [first, second] = await instanceIds();
  expect(first).toMatch(INSTANCE_ID);
  expect(second).toMatch(INSTANCE_ID);
  expect(first).not.toBe(second);
  await expect(page.locator('[data-role="proto-filter-chips"] .proto-filter-chip')).toHaveCount(2);
  await expect(hyggerChips.locator('.proto-filter-chip__gph')).toHaveText(['Rated 10–40 gal', 'Rated 10–40 gal']);
  for (const text of await hyggerChips.allTextContents()) expect(text).not.toMatch(/GPH|\b80\b/);
  const pair = await snapshot(page);
  expect(pair.scoring).toEqual([[HYGGER_S, 'SPONGE', 0], [HYGGER_S, 'SPONGE', 0]]);
  expect(pair.capacity).toEqual([[HYGGER_S, 'manufacturer_rating', 'verified'], [HYGGER_S, 'manufacturer_rating', 'verified']]);
  expect(pair.gph).toEqual([0, 0, 0]);
  expect(pair.turnover).toBe(0);
  expect(pair.level).toBe('likely-multi-sponge');
  expect(pair.spongeStatus).toBe('likely-multi');
  expect(pair.status).toEqual({ tone: 'warn', text: 'Likely adequate — multiple sponge filters' });
  expect(pair.filtrationWarnings).toEqual([['filtration.likely_multi_sponge', 'warn']]);
  const multi = page.locator('#stock-warnings .status-strip[data-warning-id="filtration.likely_multi_sponge"]');
  await expect(multi).toHaveAttribute('data-state', 'warn');
  await expect(multi).toContainText('Likely adequate — multiple sponge filters');
  expect(pair.summary).toBe('Filtration: 2 sponge filters (rated by tank size)');
  expect(pair.filterText).not.toMatch(/80\s*gal|GPH|×\/h/);
  await expectLoadUnchanged(pair, noFilter.load);

  const identity = (instanceId: string) => ({ instanceId, source: 'product', productId: HYGGER_S, type: 'SPONGE', capacityMethod: 'manufacturer_rating' });
  expect((await storedJson(page, V2)).filters).toEqual([identity(first), identity(second)]);
  expect(await stored(page, V1)).toBeNull();

  // Reload: both instances keep their instanceIds.
  await reloadWithStock(page, '55g');
  await expect(hyggerChips).toHaveCount(2);
  expect(await instanceIds()).toEqual([first, second]);
  const reloaded = await snapshot(page);
  expect(evaluation(reloaded)).toEqual(evaluation(pair));
  expect((await storedJson(page, V2)).filters).toEqual([identity(first), identity(second)]);
  expect(await stored(page, V1)).toBeNull();
  await expectLoadUnchanged(reloaded, noFilter.load);

  // Remove the first chip only: the second instance remains, not a recreated filter.
  await page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-instance-id="${first}"] [data-remove-filter]`).click();
  await expect(hyggerChips).toHaveCount(1);
  await settle(page);
  expect(await instanceIds()).toEqual([second]);
  const one = await snapshot(page);
  expect(one.scoring).toEqual([[HYGGER_S, 'SPONGE', 0]]);
  expect(one.gph).toEqual([0, 0, 0]);
  expect(one.level).toBe('below-rating');
  expect(one.status).toEqual({ tone: 'warn', text: 'Below manufacturer rating' });
  expect(one.filtrationWarnings).toEqual([['filtration.below_rating', 'warn']]);
  expect(one.filterText).not.toMatch(/80\s*gal|GPH|×\/h/);
  await expectLoadUnchanged(one, noFilter.load);
  expect((await storedJson(page, V2)).filters).toEqual([identity(second)]);
  expect(await stored(page, V1)).toBeNull();

  // Reload: the remaining instance survives with the same instanceId.
  await reloadWithStock(page, '55g');
  await expect(hyggerChips).toHaveCount(1);
  expect(await instanceIds()).toEqual([second]);
  const remaining = await snapshot(page);
  expect(evaluation(remaining)).toEqual(evaluation(one));
  expect((await storedJson(page, V2)).filters).toEqual([identity(second)]);
  expect(await stored(page, V1)).toBeNull();
  await expectLoadUnchanged(remaining, noFilter.load);
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

// Phase F: the dedicated undergravel filter model. penn-plax-ugf-20-29 is listed for the 20 Long and
// 29 Gallon presets only; it is never scored by GPH. 20 High is also 20 gallons and must not pass.
const UGF = 'penn-plax-ugf-20-29';
const UGF_CHIP = 'Rated: 20 Long and 29 Gallon';
const UGF_RATED = 'Undergravel filter rated for this tank';
const UGF_NOT_LISTED = 'Rating needed — this undergravel filter isn\'t listed for this tank size';
const UGF_FORBIDDEN = /150|GPH|20g–40g|20–40|20 High/;

async function ugfState(page: Page) {
  return page.evaluate(async () => {
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: Record<string, unknown> & { filters?: Array<Record<string, unknown>> } }).appState;
    const computed = compute.buildComputedState(appState);
    const withoutFilters = compute.buildComputedState({ ...appState, filters: [] });
    const load = (c: { bioload: Record<string, unknown> }) => [c.bioload.currentPercent, c.bioload.proposedPercent, c.bioload.text, c.bioload.severity];
    const { assessment } = computed.filtering;
    const node = document.querySelector<HTMLElement>('[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="penn-plax-ugf-20-29"]');
    return {
      tankId: assessment.tankId ?? null,
      level: computed.filtering.level,
      adequateBy: assessment.adequateBy,
      passingPaths: assessment.passingPaths ?? null,
      statusText: computed.filtering.status?.text ?? null,
      hasBiologicalFiltration: assessment.hasBiologicalFiltration,
      // Optional chaining: before phase F there is no ugf section, and the test must fail on a UGF
      // assertion rather than inside this helper.
      ugf: [assessment.ugf?.count ?? null, assessment.ugf?.status ?? null, assessment.ugf?.rated ?? null, assessment.ugf?.gph ?? null],
      compatibilityText: assessment.ugf?.entries?.[0]?.compatibilityText ?? null,
      gph: [computed.filtering.gphTotal, computed.filtering.biologicalGph, computed.filtering.circulationGph],
      turnover: [computed.filtering.turnover, computed.filtering.totalTurnover],
      filters: (appState.filters ?? []).map((filter) => [filter.productId ?? filter.id, filter.type, filter.rated_gph, filter.capacityMethod]),
      filtrationWarnings: (computed.filtering.warnings ?? []).map((warning: { id: string; severity: string }) => [warning.id, warning.severity]),
      chipCount: document.querySelectorAll('[data-role="proto-filter-chips"] .proto-filter-chip').length,
      chipInstance: node?.dataset.instanceId ?? null,
      chipBadge: node?.querySelector<HTMLElement>('.proto-filter-chip__gph')?.textContent?.trim() ?? null,
      chipRating: node?.querySelector<HTMLElement>('.proto-filter-chip__gph')?.dataset.rating ?? null,
      offered: Boolean(document.querySelector('#filter-product option[value="penn-plax-ugf-20-29"]')),
      load: load(computed),
      loadWithoutFilters: load(withoutFilters),
      loadText: document.querySelector('[data-role="bioload-percent"]')?.textContent?.trim() ?? '',
      filterText: ['[data-role="proto-filter-chips"]', '[data-role="proto-filter-summary"]', '#stock-warnings']
        .map((selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '').join(' \n '),
    };
  });
}

async function switchTank(page: Page, tankId: string) {
  await page.selectOption('#tank-size', tankId);
  await settle(page);
}

function expectUgfPasses(state: Awaited<ReturnType<typeof ugfState>>, tankId: string, instanceId: string) {
  expect(state.tankId).toBe(tankId);
  expect(state.level).toBe('adequate');
  expect(state.adequateBy).toBe('ugf');
  expect(state.passingPaths).toEqual(['ugf']);
  expect(state.statusText).toBe(UGF_RATED);
  expect(state.hasBiologicalFiltration).toBe(true);
  expect(state.ugf).toEqual([1, 'compatible', true, 0]);
  expect(state.compatibilityText).toBe('20 Long and 29 Gallon');
  expect(state.gph).toEqual([0, 0, 0]);
  expect(state.turnover).toEqual([0, 0]);
  expect(state.filters).toEqual([[UGF, 'UGF', 0, 'tank_compatibility']]);
  // Only the neutral "rated for this tank" note: no inadequacy warning.
  expect(state.filtrationWarnings).toEqual([['filtration.ugf_rated', 'info']]);
  expect([state.chipCount, state.chipInstance, state.chipBadge, state.chipRating]).toEqual([1, instanceId, UGF_CHIP, 'compatible']);
  expect(state.load).toEqual(state.loadWithoutFilters);
  expect(state.filterText).toContain(`✓ ${UGF_RATED}`);
  expect(state.filterText).not.toMatch(UGF_FORBIDDEN);
}

async function expectIdentityOnlyV2(page: Page, instanceId: string | null) {
  const v2 = await storedJson(page, V2);
  expect(v2.v).toBe(2);
  expect(v2.filters).toHaveLength(1);
  const [entry] = v2.filters;
  expect(Object.keys(entry).sort()).toEqual(['capacityMethod', 'instanceId', 'productId', 'source', 'type']);
  expect(entry).toMatchObject({ source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'tank_compatibility' });
  expect(entry.instanceId).toMatch(/^f-/);
  if (instanceId) expect(entry.instanceId).toBe(instanceId);
  expect(JSON.stringify(v2)).not.toMatch(/150|gph|minGallons|maxGallons|compatibleTanks/i);
  expect(await stored(page, V1)).toBeNull();
  return entry.instanceId as string;
}

test('phase F: Penn-Plax UGF by tank compatibility — passes on 29 and 20 Long, not on 20 High (same instance, 0 GPH, load unchanged)', async ({ page }) => {
  const errors = trackErrors(page);
  await openAdvisor(page);
  await setUp(page, '29g');
  await settle(page);
  const baseline = await ugfState(page);
  expect(baseline.chipCount).toBe(0);

  // 29 Gallon: offered through the real picker with compatibility wording, no GPH or range.
  await expect.poll(() => page.locator(`#filter-product option[value="${UGF}"]`).count(), { timeout: 20000 }).toBe(1);
  const option = (await page.locator(`#filter-product option[value="${UGF}"]`).textContent()) ?? '';
  expect(option).toContain('Undergravel • 20 Long and 29 Gallon');
  const optionName = await page.evaluate(async (id) => {
    const catalog = await (await fetch('/assets/data/gearCatalog.json', { cache: 'no-store' })).json();
    return catalog.find((item: { id: string }) => item.id === id);
  }, UGF);
  // The compatibility part (after the manufacturer's own product title) names the presets only.
  expect(option.slice(String(optionName.name).length)).not.toMatch(UGF_FORBIDDEN);

  // Current catalog contract (phase F): v4 cache, UGF record by compatibility only.
  expect(optionName).toMatchObject({ type: 'UGF', capacityMethod: 'tank_compatibility', compatibleTanks: ['20l', '29g'] });
  for (const key of ['gphRated', 'rated_gph', 'minGallons', 'maxGallons']) expect(key in optionName, key).toBe(false);
  const cached = (await storedJson(page, CATALOG_CACHE) as Array<Record<string, unknown>>).find((item) => item.id === UGF) as Record<string, unknown>;
  expect(cached).toMatchObject({ type: 'UGF', capacityMethod: 'tank_compatibility', compatibleTanks: ['20l', '29g'] });
  for (const key of ['gphRated', 'rated_gph', 'minGallons', 'maxGallons']) expect(key in cached, `cache ${key}`).toBe(false);

  await addProduct(page, UGF);
  await settle(page);
  const onTwentyNine = await ugfState(page);
  const instanceId = onTwentyNine.chipInstance as string;
  expect(instanceId).toMatch(/^f-/);
  expectUgfPasses(onTwentyNine, '29g', instanceId);
  expect(onTwentyNine.loadText).toBe(baseline.loadText);
  await expect(page.locator('#filter-product-add')).toBeDisabled(); // one plate set per tank
  await expectIdentityOnlyV2(page, instanceId);

  // Reload on 29: same instance, same result.
  await reloadWithStock(page, '29g');
  expectUgfPasses(await ugfState(page), '29g', instanceId);
  await expectIdentityOnlyV2(page, instanceId);

  // 20 High (also 20 gallons): not listed — kept, neutral, never adequate, not offered.
  await switchTank(page, '20h');
  const onTwentyHigh = await ugfState(page);
  expect(onTwentyHigh.tankId).toBe('20h');
  expect(onTwentyHigh.level).toBe('not-evaluated');
  expect(onTwentyHigh.adequateBy).toBeNull();
  expect(onTwentyHigh.passingPaths).toEqual([]);
  expect(onTwentyHigh.statusText).toBe(UGF_NOT_LISTED);
  expect(onTwentyHigh.hasBiologicalFiltration).toBe(true);
  expect(onTwentyHigh.ugf).toEqual([1, 'not-listed', false, 0]);
  expect(onTwentyHigh.compatibilityText).toBe('20 Long and 29 Gallon');
  expect(onTwentyHigh.gph).toEqual([0, 0, 0]);
  expect(onTwentyHigh.turnover).toEqual([0, 0]);
  expect(onTwentyHigh.filtrationWarnings).toEqual([['filtration.rating_needed', 'info']]);
  expect([onTwentyHigh.chipCount, onTwentyHigh.chipInstance, onTwentyHigh.chipBadge, onTwentyHigh.chipRating]).toEqual([1, instanceId, UGF_CHIP, 'not-listed']);
  expect(onTwentyHigh.offered).toBe(false);
  expect(onTwentyHigh.load).toEqual(onTwentyHigh.loadWithoutFilters);
  expect(onTwentyHigh.filterText).toContain(UGF_NOT_LISTED);
  expect(onTwentyHigh.filterText).not.toMatch(/No biological filter|150|GPH|20 High|20–40/);
  await expectIdentityOnlyV2(page, instanceId);

  // 20 Long (same 20 gallons): listed — adequate again, same instance.
  await switchTank(page, '20l');
  const onTwentyLong = await ugfState(page);
  expectUgfPasses(onTwentyLong, '20l', instanceId);
  expect(onTwentyLong.offered).toBe(true);
  expect(onTwentyHigh.level).not.toBe(onTwentyLong.level);

  // Reload on 20 Long.
  await reloadWithStock(page, '20l');
  expectUgfPasses(await ugfState(page), '20l', instanceId);
  await expectIdentityOnlyV2(page, instanceId);
  expect(errors).toEqual({ page: [], console: [] });
});
