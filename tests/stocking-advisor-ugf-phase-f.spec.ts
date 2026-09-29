// Sponge migration phase F on the real page (desktop and mobile): the undergravel filter
// (penn-plax-ugf-20-29) is evaluated by explicit tank compatibility — listed for 20 Long and 29 only —
// never by GPH, turnover or a gallon range. 20 High is also 20 gallons and must not pass. Part of the
// Stocking Advisor gate (`npm run test:e2e:stocking-gate`).
// Report: _internal/reports/stocking-advisor-sponge-migration-phase-f-2026-09.md
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const V1 = 'ttg.stocking.filters.v1';
const V2 = 'ttg.stocking.filters.v2';
const CATALOG_CURRENT = 'ttg.gear.catalog.v4';
const CATALOG_PHASE_E = 'ttg.gear.catalog.v3';
const UGF = 'penn-plax-ugf-20-29';
const TETRA = 'tetra-whisper-iq-45';
const CATALOG: Array<Record<string, unknown>> = JSON.parse(readFileSync('assets/data/gearCatalog.json', 'utf8'));
const nameOf = (id: string) => CATALOG.find((item) => item.id === id)?.name as string;
const OPTION_TEXT = `${nameOf(UGF)} • Undergravel • 20 Long and 29 Gallon`;
const CHIP_TEXT = 'Rated: 20 Long and 29 Gallon';
const PASSING = '✓ Undergravel filter rated for this tank';
const NOT_LISTED = 'Rating needed — this undergravel filter isn\'t listed for this tank size';
// The UGF must never show a GPH, its old 150 GPH, the generic 20–40 bucket or a turnover.
const FORBIDDEN_UGF_TEXT = /150|20g–40g|\b20–40\b/;

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
const ugfChip = (page: Page) => page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${UGF}"]`);
// Phase G: filtration warnings are shown once, in the filtration status card (which lists the engine's
// filtration warning ids in data-warning-ids); every other warning stays a #stock-warnings strip.
const FILTRATION_CARD = '[data-role="filtration-status-card"]';
const warning = (page: Page, id: string) => (id.startsWith('filtration.')
  ? page.locator(`${FILTRATION_CARD}[data-warning-ids~="${id}"]`)
  : page.locator(`#stock-warnings .status-strip[data-warning-id="${id}"]`));
const addSelected = (page: Page) => page.locator('#filter-product-add');
const productNote = (page: Page) => page.locator('#filter-product-note');
const summary = (page: Page) => page.locator('[data-role="proto-filter-summary"]');
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

async function productOptions(page: Page) {
  await expect.poll(() => page.locator('#filter-product').getAttribute('data-catalog-ready'), { timeout: 10000 }).toBe('1');
  return page.locator('#filter-product option:not([value=""])').evaluateAll((els) => els.map((el) => {
    const option = el as HTMLOptionElement;
    return { id: option.value, text: option.textContent ?? '', data: { ...option.dataset } as Record<string, string> };
  }));
}

async function addUgf(page: Page) {
  await expect.poll(() => page.locator(`#filter-product option[value="${UGF}"]`).count(), { timeout: 10000 }).toBe(1);
  await page.selectOption('#filter-product', UGF);
  const before = await chips(page).count();
  await expect(addSelected(page)).toBeEnabled();
  await page.click('#filter-product-add');
  await expect(chips(page)).toHaveCount(before + 1);
}

async function engine(page: Page) {
  return page.evaluate(async () => {
    const compute = await import('/js/logic/compute.js');
    const appState = (window as unknown as { appState: Record<string, unknown> & { filters?: Array<Record<string, unknown>> } }).appState;
    const computed = compute.buildComputedState(appState);
    const withoutFilters = compute.buildComputedState({ ...appState, filters: [] });
    const load = (c: { bioload: Record<string, unknown> }) => [c.bioload.currentPercent, c.bioload.proposedPercent, c.bioload.text, c.bioload.severity];
    const { assessment } = computed.filtering;
    return {
      level: computed.filtering.level as string,
      status: computed.filtering.status as { tone: string; text: string },
      adequateBy: assessment.adequateBy as string | null,
      passingPaths: assessment.passingPaths as string[],
      tankId: assessment.tankId as string | null,
      ugf: assessment.ugf as { count: number; status: string; rated: boolean; gph: number; entries: Array<Record<string, unknown>> },
      hasBiologicalFiltration: assessment.hasBiologicalFiltration as boolean,
      gph: [computed.filtering.gphTotal, computed.filtering.biologicalGph, computed.filtering.circulationGph] as number[],
      turnover: [computed.filtering.turnover, computed.filtering.totalTurnover] as number[],
      warnings: (computed.filtering.warnings as Array<{ id: string; severity: string }>).map((w) => [w.id, w.severity]),
      filters: (appState.filters ?? []).map((filter) => [filter.productId ?? filter.id, filter.type, filter.rated_gph, filter.capacityMethod]),
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
    document.querySelector('#stock-warnings')?.textContent ?? '',
    document.querySelector('[data-role="filtration-status-card"]')?.textContent ?? '',
  ].join(' ').replace(/\s+/g, ' ')
    // Phase G: the card's one permitted mention of an old custom sponge's GPH (design 12), never scored.
    .replace(/Old value: \d+ GPH — not used for sponge filters\./g, ''));
}

async function expectPassing(page: Page, tankId: string) {
  await expect(ugfChip(page).locator('.proto-filter-chip__gph')).toHaveText(CHIP_TEXT);
  await expect(ugfChip(page).locator('.proto-filter-chip__gph')).toHaveAttribute('data-rating', 'compatible');
  // Phase G card: the engine headline and the explicit listed-preset line.
  await expect(warning(page, 'filtration.ugf_rated')).toHaveAttribute('data-state', 'good');
  await expect(warning(page, 'filtration.ugf_rated').locator('[data-role="filtration-status-headline"]')).toContainText(PASSING.replace(/^✓ /, ''));
  await expect(warning(page, 'filtration.ugf_rated')).toContainText('Undergravel filter: rated for 20 Long and 29 Gallon — rated for this tank');
  await expect(summary(page)).toContainText('1 undergravel filter (rated for listed tanks)');
  const state = await expectLoadUnchanged(page);
  expect(state.tankId).toBe(tankId);
  expect(state.level).toBe('adequate');
  expect([state.adequateBy, state.passingPaths]).toEqual(['ugf', ['ugf']]);
  expect(state.status).toEqual({ tone: 'good', text: 'Undergravel filter rated for this tank' });
  expect(state.gph).toEqual([0, 0, 0]);
  expect(state.turnover).toEqual([0, 0]);
  expect(state.hasBiologicalFiltration).toBe(true);
  expect([state.ugf.count, state.ugf.status, state.ugf.gph]).toEqual([1, 'compatible', 0]);
  expect(state.filters).toEqual([[UGF, 'UGF', 0, 'tank_compatibility']]);
  expect(await filtrationText(page)).not.toMatch(FORBIDDEN_UGF_TEXT);
  // Compatibility is named preset by preset: never a range, never anything implying 20 High.
  expect(await filtrationText(page)).not.toMatch(/20 High|Long–|20–29/);
  return state;
}

async function expectNotListed(page: Page, tankId: string) {
  await expect(ugfChip(page)).toHaveCount(1);
  await expect(ugfChip(page).locator('.proto-filter-chip__gph')).toHaveText(CHIP_TEXT);
  await expect(ugfChip(page).locator('.proto-filter-chip__gph')).toHaveAttribute('data-rating', 'not-listed');
  await expect(warning(page, 'filtration.rating_needed')).toContainText(NOT_LISTED);
  await expect(warning(page, 'filtration.ugf_rated')).toHaveCount(0);
  const state = await expectLoadUnchanged(page);
  expect(state.tankId).toBe(tankId);
  expect(state.level).toBe('not-evaluated');
  expect(state.adequateBy).toBeNull();
  expect(state.status).toEqual({ tone: 'neutral', text: NOT_LISTED });
  expect(state.gph).toEqual([0, 0, 0]);
  expect([state.ugf.count, state.ugf.status]).toEqual([1, 'not-listed']);
  expect(state.warnings).toEqual([['filtration.rating_needed', 'info']]);
  expect(await filtrationText(page)).not.toMatch(FORBIDDEN_UGF_TEXT);
  return state;
}

test.describe('phase F: undergravel filter by tank compatibility', () => {
  test('A: 20 Long — UGF offered, added: compatibility chip, adequate, 0 GPH / turnover, saved as identity only', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '20l');
    const option = (await productOptions(page)).find((item) => item.id === UGF);
    expect(option?.text).toBe(OPTION_TEXT);
    // The compatibility part of the option (after the catalog name) names 20 Long and 29 Gallon only.
    expect(option?.text.slice(nameOf(UGF).length)).not.toMatch(/High|–/);
    expect(option?.data).toEqual({ filterType: 'UGF', compatibleTanks: '20l 29g' });
    await addUgf(page);
    await settle(page);
    await expectPassing(page, '20l');
    const saved = JSON.parse((await stored(page, V2)) as string);
    expect(saved.filters).toHaveLength(1);
    const [entry] = saved.filters;
    expect(Object.keys(entry).sort()).toEqual(['capacityMethod', 'instanceId', 'productId', 'source', 'type']);
    expect([entry.source, entry.productId, entry.type, entry.capacityMethod]).toEqual(['product', UGF, 'UGF', 'tank_compatibility']);
    expect(await stored(page, V1)).toBeNull();
    // Current catalog cache v4: the UGF record has no GPH / range; v3 is not written.
    const cache = JSON.parse((await stored(page, CATALOG_CURRENT)) as string) as Array<Record<string, unknown>>;
    const record = cache.find((item) => item.id === UGF) as Record<string, unknown>;
    for (const key of ['gphRated', 'rated_gph', 'minGallons', 'maxGallons', 'manufacturerMaxGallons']) expect(key in record, key).toBe(false);
    expect([record.capacityMethod, record.compatibleTanks]).toEqual(['tank_compatibility', ['20l', '29g']]);
    expect(await stored(page, CATALOG_PHASE_E)).toBeNull();
  });

  test('B: 29 gal — same passing result; survives reload with the same instance', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    expect((await productOptions(page)).find((item) => item.id === UGF)?.text).toBe(OPTION_TEXT);
    await addUgf(page);
    await settle(page);
    await expectPassing(page, '29g');
    const before = JSON.parse((await stored(page, V2)) as string);
    await page.reload();
    await expect.poll(() => page.locator('#plan-species option:not([value=""])').count()).toBeGreaterThan(0);
    await setUpTank(page, '29g');
    await settle(page);
    await expectPassing(page, '29g');
    expect(JSON.parse((await stored(page, V2)) as string)).toEqual(before);
  });

  test('C: 20 High — the UGF is not offered in the picker (same 20 gallons as 20 Long)', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '20h');
    expect((await productOptions(page)).some((item) => item.id === UGF)).toBe(false);
  });

  test('C2: 20 High with a saved UGF: kept, not listed for this tank, 0 GPH', async ({ page }) => {
    await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-ugf20h', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'tank_compatibility' },
    ] }) });
    await openAdvisor(page);
    await setUpTank(page, '20h');
    await settle(page);
    await expectNotListed(page, '20h');
    expect((await productOptions(page)).some((item) => item.id === UGF)).toBe(false);
    expect(JSON.parse((await stored(page, V2)) as string).filters.map((e: Record<string, unknown>) => e.instanceId)).toEqual(['f-ugf20h']);
  });

  test('D–E: 29 → 40 Breeder keeps the saved UGF (not listed, not deleted); back to 29 → same instance, adequate', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await addUgf(page);
    await settle(page);
    await expectPassing(page, '29g');
    const instanceId = await ugfChip(page).getAttribute('data-instance-id');
    expect(instanceId).toBeTruthy();
    await page.selectOption('#tank-size', '40b');
    await settle(page);
    await expectNotListed(page, '40b');
    expect(await ugfChip(page).getAttribute('data-instance-id')).toBe(instanceId);
    expect((await productOptions(page)).some((item) => item.id === UGF)).toBe(false);
    expect(JSON.parse((await stored(page, V2)) as string).filters.map((e: Record<string, unknown>) => e.instanceId)).toEqual([instanceId]);
    await page.selectOption('#tank-size', '29g');
    await settle(page);
    await expectPassing(page, '29g');
    expect(await ugfChip(page).getAttribute('data-instance-id')).toBe(instanceId);
  });

  test('F: historical v1 UGF with 150 GPH → current compatibility model, 0 GPH; v2 written without GPH', async ({ page }) => {
    await seedStorage(page, { [V1]: JSON.stringify([{ id: UGF, type: 'UGF', rated_gph: 150 }]) });
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await settle(page);
    await expectPassing(page, '29g');
    const [entry] = JSON.parse((await stored(page, V2)) as string).filters;
    expect([entry.type, entry.capacityMethod, 'gph' in entry]).toEqual(['UGF', 'tank_compatibility', false]);
    expect(await stored(page, V1)).toBeNull();
  });

  test('G: HOB-900 conflict for the UGF product id → UGF, 0 GPH, never powered adequate', async ({ page }) => {
    await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-ugf900', source: 'product', productId: UGF, type: 'HOB', capacityMethod: 'flow', gph: 900 },
    ] }) });
    await openAdvisor(page);
    await setUpTank(page, '40b');
    await settle(page);
    const state = await expectNotListed(page, '40b');
    expect(state.filters).toEqual([[UGF, 'UGF', 0, 'tank_compatibility']]);
    expect(await filtrationText(page)).not.toMatch(/900/);
    const [entry] = JSON.parse((await stored(page, V2)) as string).filters;
    expect([entry.type, entry.capacityMethod, 'gph' in entry]).toEqual(['UGF', 'tank_compatibility', false]);
  });

  test('H: catalog unavailable — a known UGF saved as a 150 GPH flow filter cannot revive its GPH', async ({ page }) => {
    await seedStorage(page, { [V2]: JSON.stringify({ v: 2, filters: [
      { instanceId: 'f-ugfoff', source: 'product', productId: UGF, type: 'UGF', capacityMethod: 'flow', gph: 150 },
    ] }) });
    await openAdvisor(page, { offline: true });
    await setUpTank(page, '29g');
    await settle(page);
    await expect(chips(page)).toHaveCount(1);
    await expect(chips(page).first().locator('.proto-filter-chip__gph')).toHaveText('Rating needed');
    const state = await expectLoadUnchanged(page);
    expect(state.level).toBe('not-evaluated');
    expect(state.gph).toEqual([0, 0, 0]);
    expect(state.ugf.status).toBe('compatibility-unknown');
    expect(state.filters).toEqual([[UGF, 'UGF', 0, 'tank_compatibility']]);
    expect(await filtrationText(page)).not.toMatch(FORBIDDEN_UGF_TEXT);
    expect(await stored(page, CATALOG_CURRENT)).toBeNull();
  });

  test('I: powered regression — Tetra Whisper IQ 45 still 215 GPH beside a UGF (no arithmetic between them)', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '29g');
    await addUgf(page);
    await expect.poll(() => page.locator(`#filter-product option[value="${TETRA}"]`).count(), { timeout: 10000 }).toBe(0);
    // Tetra IQ 45 is offered on 40–75 gal; on 55 the UGF isn't listed, Tetra passes on its own.
    await page.selectOption('#tank-size', '55g');
    await settle(page);
    await expect.poll(() => page.locator(`#filter-product option[value="${TETRA}"]`).count(), { timeout: 10000 }).toBe(1);
    await page.selectOption('#filter-product', TETRA);
    await page.click('#filter-product-add');
    await expect(chips(page)).toHaveCount(2);
    await settle(page);
    await expect(page.locator(`[data-role="proto-filter-chips"] .proto-filter-chip[data-filter-id="${TETRA}"] .proto-filter-chip__gph`)).toHaveText(/215\s*GPH/);
    const state = await expectLoadUnchanged(page);
    expect(state.level).toBe('adequate');
    expect([state.adequateBy, state.passingPaths]).toEqual(['powered', ['powered']]);
    expect(state.gph).toEqual([215, 215, 0]);
    expect(state.ugf.status).toBe('not-listed');
    // Phase G card: green from the powered filter, the unlisted UGF a neutral supplemental line.
    await expect(warning(page, 'filtration.ugf_not_listed')).toContainText('+ Undergravel filter: this tank size isn\'t listed (rated for 20 Long and 29 Gallon)');
    await expect(summary(page)).toContainText('215 GPH');
    await expect(summary(page)).toContainText('1 undergravel filter');
  });

  test('J: phase D guard — a second UGF cannot be added', async ({ page }) => {
    await seedStorage(page, {});
    await openAdvisor(page);
    await setUpTank(page, '20l');
    await addUgf(page);
    await expect(addSelected(page)).toBeDisabled();
    await page.selectOption('#filter-product', '');
    await page.selectOption('#filter-product', UGF);
    await expect(productNote(page)).toContainText('one plate set per tank');
    await expect(addSelected(page)).toBeDisabled();
    await expect(ugfChip(page)).toHaveCount(1);
    await settle(page);
    expect(JSON.parse((await stored(page, V2)) as string).filters).toHaveLength(1);
  });
});
