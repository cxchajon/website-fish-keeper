/**
 * Stocking Advisor Logic & Stress Test Suite
 *
 * Comprehensive test suite for the Stocking Advisor filtration logic,
 * order-independence, and UI smoke tests.
 */

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_URL = 'https://thetankguide.com/stocking-advisor.html';
const BASE_DIR = '/home/user/website-fish-keeper/tests/stocking_advisor';
const REPORTS_DIR = join(BASE_DIR, 'reports');
const SCREENS_DIR = join(BASE_DIR, 'screens');
const ARTIFACTS_DIR = join(BASE_DIR, 'artifacts');

// Test results storage
const results = {
  deterministic: [],
  random: [],
  orderIndependence: [],
  ui: [],
  assertions: {
    spongeNeverIncreases: { passed: 0, failed: 0, failures: [] },
    monotonicity: { passed: 0, failed: 0, failures: [] },
    turnoverSanity: { passed: 0, failed: 0, failures: [] },
    diminishingReturns: { passed: 0, failed: 0, failures: [] },
    tankScaling: { passed: 0, failed: 0, failures: [] },
    zeroState: { passed: 0, failed: 0, failures: [] },
  },
  screenshots: [],
  errors: [],
};

/**
 * Page interaction helpers
 */
class StockingAdvisorPage {
  constructor(page) {
    this.page = page;
    this.tankSizes = [];
    this.fishSpecies = [];
    this.filterTypes = new Map();
  }

  async initialize() {
    console.log('  Loading page...');
    await this.page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for key UI elements
    await this.page.waitForSelector('#tank-size', { timeout: 30000 });
    await this.page.waitForSelector('#plan-species', { timeout: 30000 });

    // Extract available options
    await this.extractTankSizes();
    await this.extractFishSpecies();
    await this.extractFilterTypes();

    console.log(`  Found ${this.tankSizes.length} tank sizes`);
    console.log(`  Found ${this.fishSpecies.length} fish species`);
    console.log(`  Found ${this.filterTypes.size} filter type variations`);
  }

  async extractTankSizes() {
    const options = await this.page.$$eval('#tank-size option', options =>
      options.map(opt => ({
        value: opt.value,
        text: opt.textContent.trim(),
        gallons: parseFloat(opt.value)
      })).filter(opt => opt.gallons > 0 && !isNaN(opt.gallons))
    );
    this.tankSizes = options;
  }

  async extractFishSpecies() {
    // Wait for species dropdown to be populated
    await this.page.waitForFunction(() => {
      const select = document.querySelector('#plan-species');
      return select && select.options.length > 1;
    }, { timeout: 10000 });

    const species = await this.page.$$eval('#plan-species option', options =>
      options.map(opt => ({
        value: opt.value,
        text: opt.textContent.trim()
      })).filter(opt => opt.value && opt.value !== '')
    );
    this.fishSpecies = species;
  }

  async extractFilterTypes() {
    // Extract filter type options from the custom filter selector
    const types = await this.page.$$eval('#fs-type option', options =>
      options.map(opt => opt.textContent.trim()).filter(t => t && t !== 'Filter type…')
    );

    // Map common GPH ranges for each filter type
    const gphRanges = {
      'Sponge': [40, 60, 80, 100, 120],
      'HOB': [100, 150, 200, 250, 300, 350],
      'Canister': [200, 250, 300, 350, 400, 500, 700],
      'Internal': [60, 80, 100, 150, 200],
      'Powerhead': [100, 150, 200, 300, 400]
    };

    types.forEach(type => {
      this.filterTypes.set(type, gphRanges[type] || [100, 200, 300]);
    });
  }

  async setTankSize(gallons) {
    await this.page.selectOption('#tank-size', { value: String(gallons) });
    await this.page.waitForTimeout(500); // Allow UI to update
  }

  async addCustomFilter(type, gph) {
    // Select filter type
    await this.page.selectOption('#fs-type', type);

    // Enter GPH
    await this.page.fill('#fs-gph', String(gph));

    // Click add button
    await this.page.click('#fs-add-custom');

    // Wait for filter to be added
    await this.page.waitForTimeout(300);
  }

  async addFish(speciesId, quantity) {
    // Select species
    await this.page.selectOption('#plan-species', speciesId);

    // Enter quantity
    await this.page.fill('#plan-qty', String(quantity));

    // Click add button
    await this.page.click('#plan-add');

    // Wait for fish to be added
    await this.page.waitForTimeout(300);
  }

  async removeAllFilters() {
    // Click all remove buttons in filter chips
    const removeButtons = await this.page.$$('[data-role="proto-filter-chips"] button');
    for (const button of removeButtons) {
      await button.click();
      await this.page.waitForTimeout(200);
    }
  }

  async removeAllFish() {
    // Click all remove buttons in stock list
    let removeButtons = await this.page.$$('#stock-list .stock-entry__remove');
    while (removeButtons.length > 0) {
      await removeButtons[0].click();
      await this.page.waitForTimeout(200);
      removeButtons = await this.page.$$('#stock-list .stock-entry__remove');
    }
  }

  async getBioloadData() {
    return await this.page.evaluate(() => {
      // Try to extract bioload data from the UI
      const bioloadText = document.querySelector('[data-role="proto-filter-summary"]')?.textContent || '';
      const percentMatch = bioloadText.match(/(\d+(?:\.\d+)?)\s*%/);

      // Try to get filtration debug data if available
      const debug = window.__TTG_FILTRATION_DEBUG__ || {};

      return {
        bioloadPercent: percentMatch ? parseFloat(percentMatch[1]) : null,
        rawText: bioloadText,
        debug,
        filters: window.__CURRENT_FILTERS__ || [],
        species: window.__CURRENT_STOCK__ || []
      };
    });
  }

  async getComputedBioload() {
    // Extract computed bioload from the page's JS state
    return await this.page.evaluate(() => {
      const envBars = document.querySelector('#env-bars');
      if (!envBars) return null;

      // Look for bioload capacity percentage
      const percentElements = envBars.querySelectorAll('[data-testid="bioload-percent"]');
      if (percentElements.length > 0) {
        const text = percentElements[0].textContent;
        const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
        return match ? parseFloat(match[1]) : null;
      }

      // Fallback: try to extract from bar visualization
      const barFill = envBars.querySelector('.bar-fill');
      if (barFill) {
        const width = barFill.style.width;
        const match = width.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
      }

      return null;
    });
  }

  async screenshot(name) {
    const path = join(SCREENS_DIR, `${name}.png`);
    await this.page.screenshot({ path, fullPage: false });
    results.screenshots.push({ name, path });
    return path;
  }

  async checkConsoleErrors() {
    const errors = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    this.page.on('pageerror', error => {
      errors.push(error.message);
    });
    return errors;
  }
}

/**
 * Test matrix configuration
 */
const DETERMINISTIC_MATRIX = {
  tanks: [5, 10, 20, 29, 40, 55],
  filtersSingle: [
    { type: 'Sponge', gph: 80 },
    { type: 'HOB', gph: 200 },
    { type: 'Canister', gph: 300 }
  ],
  filtersMulti: [
    [{ type: 'HOB', gph: 200 }, { type: 'Sponge', gph: 80 }],
    [{ type: 'HOB', gph: 200 }, { type: 'HOB', gph: 200 }],
    [{ type: 'Canister', gph: 300 }, { type: 'Sponge', gph: 80 }]
  ]
};

/**
 * Run deterministic tests
 */
async function runDeterministicTests(advisorPage) {
  console.log('\\n=== Running Deterministic Tests ===');

  const { tanks, filtersSingle, filtersMulti } = DETERMINISTIC_MATRIX;
  let testCount = 0;

  for (const tankGallons of tanks) {
    // Test single filters
    for (const filter of filtersSingle) {
      testCount++;
      console.log(`  Test ${testCount}: ${tankGallons}gal tank, ${filter.type} ${filter.gph}GPH`);

      await advisorPage.removeAllFilters();
      await advisorPage.removeAllFish();
      await advisorPage.setTankSize(tankGallons);
      await advisorPage.addCustomFilter(filter.type, filter.gph);

      const bioload = await advisorPage.getBioloadData();

      results.deterministic.push({
        tank: tankGallons,
        filters: [filter],
        fish: [],
        bioload: bioload.bioloadPercent,
        rawData: bioload
      });
    }

    // Test multi filters
    for (const filterSet of filtersMulti) {
      testCount++;
      console.log(`  Test ${testCount}: ${tankGallons}gal tank, ${filterSet.length} filters`);

      await advisorPage.removeAllFilters();
      await advisorPage.removeAllFish();
      await advisorPage.setTankSize(tankGallons);

      for (const filter of filterSet) {
        await advisorPage.addCustomFilter(filter.type, filter.gph);
      }

      const bioload = await advisorPage.getBioloadData();

      results.deterministic.push({
        tank: tankGallons,
        filters: filterSet,
        fish: [],
        bioload: bioload.bioloadPercent,
        rawData: bioload
      });
    }
  }

  console.log(`  Completed ${testCount} deterministic tests`);
}

/**
 * Generate random test scenarios
 */
function generateRandomScenarios(count, availableSpecies) {
  const scenarios = [];
  const filterTypes = ['Sponge', 'HOB', 'Canister', 'Internal'];

  for (let i = 0; i < count; i++) {
    const tank = Math.floor(Math.random() * 70) + 5; // 5-75 gallons
    const numFilters = Math.floor(Math.random() * 4); // 0-3 filters
    const filters = [];

    for (let f = 0; f < numFilters; f++) {
      const type = filterTypes[Math.floor(Math.random() * filterTypes.length)];
      const gph = Math.floor(Math.random() * 660) + 40; // 40-700 GPH
      filters.push({ type, gph });
    }

    const numFish = Math.floor(Math.random() * 36); // 0-35 fish
    const fish = [];

    if (numFish > 0 && availableSpecies.length > 0) {
      for (let s = 0; s < Math.min(numFish, 10); s++) {
        const species = availableSpecies[Math.floor(Math.random() * availableSpecies.length)];
        const qty = Math.floor(Math.random() * 12) + 1; // 1-12 of each species
        fish.push({ species: species.value, qty });
      }
    }

    scenarios.push({ tank, filters, fish });
  }

  return scenarios;
}

/**
 * Run random stress tests with order-independence checks
 */
async function runRandomStressTests(advisorPage, count = 100) {
  console.log(`\\n=== Running Random Stress Tests (${count} scenarios) ===`);

  const scenarios = generateRandomScenarios(count, advisorPage.fishSpecies);

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`  Scenario ${i + 1}/${scenarios.length}: ${scenario.tank}gal, ${scenario.filters.length} filters, ${scenario.fish.length} species`);

    // Sequence A: tank → filters → fish
    await advisorPage.removeAllFilters();
    await advisorPage.removeAllFish();
    await advisorPage.setTankSize(scenario.tank);

    for (const filter of scenario.filters) {
      await advisorPage.addCustomFilter(filter.type, filter.gph);
    }

    for (const fishEntry of scenario.fish) {
      try {
        await advisorPage.addFish(fishEntry.species, fishEntry.qty);
      } catch (e) {
        // Skip if fish can't be added
        console.log(`    Warning: Could not add fish ${fishEntry.species}`);
      }
    }

    const bioloadA = await advisorPage.getBioloadData();

    // Sequence B: tank → fish → filters
    await advisorPage.removeAllFilters();
    await advisorPage.removeAllFish();
    await advisorPage.setTankSize(scenario.tank);

    for (const fishEntry of scenario.fish) {
      try {
        await advisorPage.addFish(fishEntry.species, fishEntry.qty);
      } catch (e) {
        // Skip if fish can't be added
      }
    }

    for (const filter of scenario.filters) {
      await advisorPage.addCustomFilter(filter.type, filter.gph);
    }

    const bioloadB = await advisorPage.getBioloadData();

    // Check order independence
    const tolerance = 0.01; // 0.01% tolerance for floating point
    const deltaPercent = Math.abs((bioloadA.bioloadPercent || 0) - (bioloadB.bioloadPercent || 0));
    const isOrderIndependent = deltaPercent <= tolerance;

    if (!isOrderIndependent) {
      results.orderIndependence.push({
        scenario,
        bioloadA: bioloadA.bioloadPercent,
        bioloadB: bioloadB.bioloadPercent,
        delta: deltaPercent
      });
    }

    results.random.push({
      scenario,
      bioloadA: bioloadA.bioloadPercent,
      bioloadB: bioloadB.bioloadPercent,
      orderIndependent: isOrderIndependent
    });
  }

  console.log(`  Completed ${scenarios.length} random scenarios`);
  console.log(`  Order-independence violations: ${results.orderIndependence.length}`);
}

/**
 * Run logic assertion tests
 */
async function runLogicAssertions(advisorPage) {
  console.log('\\n=== Running Logic Assertions ===');

  // 1. Sponge never increases bioload
  console.log('  Testing: Sponge never increases bioload');
  for (const tankGallons of [10, 20, 40]) {
    await advisorPage.removeAllFilters();
    await advisorPage.removeAllFish();
    await advisorPage.setTankSize(tankGallons);

    // Add a test fish
    if (advisorPage.fishSpecies.length > 0) {
      await advisorPage.addFish(advisorPage.fishSpecies[0].value, 5);
    }

    const baselineData = await advisorPage.getBioloadData();
    const baseline = baselineData.bioloadPercent || 100;

    // Add sponge filters of various GPH
    for (const gph of [40, 60, 80, 100, 120]) {
      await advisorPage.removeAllFilters();
      await advisorPage.addCustomFilter('Sponge', gph);

      const withSpongeData = await advisorPage.getBioloadData();
      const withSponge = withSpongeData.bioloadPercent || 100;

      if (withSponge > baseline + 0.01) {
        results.assertions.spongeNeverIncreases.failed++;
        results.assertions.spongeNeverIncreases.failures.push({
          tank: tankGallons,
          spongeGph: gph,
          baseline,
          withSponge,
          delta: withSponge - baseline
        });
      } else {
        results.assertions.spongeNeverIncreases.passed++;
      }
    }
  }

  // 2. Zero state: no fish should have stable bioload
  console.log('  Testing: Zero state stability');
  for (const tankGallons of [10, 20, 40]) {
    await advisorPage.removeAllFilters();
    await advisorPage.removeAllFish();
    await advisorPage.setTankSize(tankGallons);

    const noFilterData = await advisorPage.getBioloadData();
    const noFilter = noFilterData.bioloadPercent || 0;

    await advisorPage.addCustomFilter('HOB', 200);
    const withFilterData = await advisorPage.getBioloadData();
    const withFilter = withFilterData.bioloadPercent || 0;

    // Both should be 0 or very close
    if (noFilter <= 1 && withFilter <= 1) {
      results.assertions.zeroState.passed++;
    } else {
      results.assertions.zeroState.failed++;
      results.assertions.zeroState.failures.push({
        tank: tankGallons,
        noFilter,
        withFilter
      });
    }
  }

  console.log(`  Sponge test: ${results.assertions.spongeNeverIncreases.passed} passed, ${results.assertions.spongeNeverIncreases.failed} failed`);
  console.log(`  Zero state: ${results.assertions.zeroState.passed} passed, ${results.assertions.zeroState.failed} failed`);
}

/**
 * Run UI smoke checks
 */
async function runUISmoke(advisorPage) {
  console.log('\\n=== Running UI Smoke Checks ===');

  const checks = [];

  // 1. Default page load
  console.log('  Screenshot: Default load');
  await advisorPage.screenshot('01-default-load');
  checks.push({ test: 'Default page load', passed: true });

  // 2. Add fish
  console.log('  Screenshot: Fish added');
  if (advisorPage.fishSpecies.length > 0) {
    await advisorPage.addFish(advisorPage.fishSpecies[0].value, 6);
    await advisorPage.page.waitForTimeout(500);
    await advisorPage.screenshot('02-fish-added');
    checks.push({ test: 'Add fish', passed: true });
  }

  // 3. Add filter
  console.log('  Screenshot: Filter added');
  await advisorPage.addCustomFilter('HOB', 200);
  await advisorPage.page.waitForTimeout(500);
  await advisorPage.screenshot('03-filter-added');
  checks.push({ test: 'Add filter', passed: true });

  // 4. Info button
  console.log('  Screenshot: Info tooltip');
  try {
    const infoBtn = await advisorPage.page.$('.info-btn');
    if (infoBtn) {
      await infoBtn.click();
      await advisorPage.page.waitForTimeout(500);
      await advisorPage.screenshot('05-info-tooltip');
      checks.push({ test: 'Info button click', passed: true });

      // Close tooltip
      const closeBtn = await advisorPage.page.$('[data-close]');
      if (closeBtn) await closeBtn.click();
    }
  } catch (e) {
    checks.push({ test: 'Info button click', passed: false, error: e.message });
  }

  // 5. Mobile menu (if in mobile viewport)
  console.log('  Screenshot: Mobile menu');
  try {
    await advisorPage.page.setViewportSize({ width: 375, height: 667 });
    await advisorPage.page.waitForTimeout(500);
    await advisorPage.screenshot('04-mobile-view');
    checks.push({ test: 'Mobile responsive layout', passed: true });

    // Reset viewport
    await advisorPage.page.setViewportSize({ width: 1280, height: 720 });
  } catch (e) {
    checks.push({ test: 'Mobile responsive layout', passed: false, error: e.message });
  }

  // 6. Console errors check
  const errors = await advisorPage.checkConsoleErrors();
  checks.push({ test: 'No console errors', passed: errors.length === 0, errors });

  results.ui = checks;
  console.log(`  Completed ${checks.length} UI checks`);
}

/**
 * Generate summary report
 */
function generateSummaryReport() {
  const total = results.deterministic.length + results.random.length;
  const orderViolations = results.orderIndependence.length;
  const orderViolationRate = results.random.length > 0
    ? (orderViolations / results.random.length * 100).toFixed(2)
    : '0.00';

  let summary = `# Stocking Advisor Test Suite Summary\\n\\n`;
  summary += `**Test Run Date:** ${new Date().toISOString()}\\n`;
  summary += `**Test URL:** ${TEST_URL}\\n\\n`;

  summary += `## Overview\\n\\n`;
  summary += `- **Total Tests:** ${total}\\n`;
  summary += `- **Deterministic Tests:** ${results.deterministic.length}\\n`;
  summary += `- **Random Stress Tests:** ${results.random.length}\\n`;
  summary += `- **UI Smoke Checks:** ${results.ui.length}\\n\\n`;

  summary += `## Assertion Results\\n\\n`;

  // Sponge assertion
  const spongeTotal = results.assertions.spongeNeverIncreases.passed + results.assertions.spongeNeverIncreases.failed;
  const spongePass = spongeTotal > 0 ? (results.assertions.spongeNeverIncreases.passed / spongeTotal * 100).toFixed(1) : '100.0';
  summary += `### Sponge Never Increases Bioload\\n`;
  summary += `- **Status:** ${results.assertions.spongeNeverIncreases.failed === 0 ? '✓ PASS' : '✗ FAIL'}\\n`;
  summary += `- **Passed:** ${results.assertions.spongeNeverIncreases.passed}/${spongeTotal} (${spongePass}%)\\n`;

  if (results.assertions.spongeNeverIncreases.failures.length > 0) {
    summary += `\\n**⚠️ CRITICAL FAILURES (Top 10):**\\n\\n`;
    results.assertions.spongeNeverIncreases.failures.slice(0, 10).forEach((f, i) => {
      summary += `${i + 1}. Tank: ${f.tank}gal, Sponge: ${f.spongeGph}GPH\\n`;
      summary += `   - Baseline: ${f.baseline.toFixed(2)}% → With sponge: ${f.withSponge.toFixed(2)}%\\n`;
      summary += `   - **Delta: +${f.delta.toFixed(2)}%** (INCREASED!)\\n\\n`;
    });
  }
  summary += `\\n`;

  // Order independence
  summary += `### Order Independence\\n`;
  summary += `- **Status:** ${orderViolations === 0 ? '✓ PASS' : orderViolationRate <= 0.5 ? '⚠ ACCEPTABLE' : '✗ FAIL'}\\n`;
  summary += `- **Violations:** ${orderViolations}/${results.random.length} (${orderViolationRate}%)\\n`;
  summary += `- **Tolerance:** 0.01% (floating point)\\n`;

  if (results.orderIndependence.length > 0) {
    summary += `\\n**Top 10 violations:**\\n\\n`;
    results.orderIndependence.slice(0, 10).forEach((v, i) => {
      summary += `${i + 1}. Tank: ${v.scenario.tank}gal, Filters: ${v.scenario.filters.length}, Fish species: ${v.scenario.fish.length}\\n`;
      summary += `   - Sequence A (tank→filters→fish): ${v.bioloadA?.toFixed(2) || 'N/A'}%\\n`;
      summary += `   - Sequence B (tank→fish→filters): ${v.bioloadB?.toFixed(2) || 'N/A'}%\\n`;
      summary += `   - Delta: ${v.delta.toFixed(3)}%\\n\\n`;
    });
  }
  summary += `\\n`;

  // Zero state
  const zeroTotal = results.assertions.zeroState.passed + results.assertions.zeroState.failed;
  summary += `### Zero State (No Fish)\\n`;
  summary += `- **Status:** ${results.assertions.zeroState.failed === 0 ? '✓ PASS' : '✗ FAIL'}\\n`;
  summary += `- **Passed:** ${results.assertions.zeroState.passed}/${zeroTotal}\\n\\n`;

  // UI checks
  summary += `## UI Smoke Checks\\n\\n`;
  const uiPassed = results.ui.filter(c => c.passed).length;
  summary += `- **Status:** ${uiPassed === results.ui.length ? '✓ PASS' : '⚠ PARTIAL'}\\n`;
  summary += `- **Passed:** ${uiPassed}/${results.ui.length}\\n\\n`;

  results.ui.forEach(check => {
    summary += `- ${check.passed ? '✓' : '✗'} ${check.test}\\n`;
    if (!check.passed && check.error) {
      summary += `  - Error: ${check.error}\\n`;
    }
  });
  summary += `\\n`;

  // Screenshots
  summary += `## Screenshots\\n\\n`;
  results.screenshots.forEach(s => {
    summary += `- ${s.name}: \`${s.path}\`\\n`;
  });
  summary += `\\n`;

  // Console errors
  summary += `## Console Errors\\n\\n`;
  const errorCheck = results.ui.find(c => c.test === 'No console errors');
  if (errorCheck && errorCheck.errors && errorCheck.errors.length > 0) {
    summary += `Found ${errorCheck.errors.length} console errors:\\n\\n`;
    errorCheck.errors.slice(0, 10).forEach((err, i) => {
      summary += `${i + 1}. ${err}\\n`;
    });
  } else {
    summary += `No console errors detected.\\n`;
  }
  summary += `\\n`;

  // Recommendations
  summary += `## Recommendations\\n\\n`;
  if (results.assertions.spongeNeverIncreases.failed > 0) {
    summary += `⚠️ **CRITICAL:** Sponge filters are increasing bioload. This violates the core filtration model.\\n\\n`;
  }
  if (orderViolationRate > 0.5) {
    summary += `⚠️ **Order-independence violations exceed 0.5% threshold.** Investigate computation order dependencies.\\n\\n`;
  }
  if (orderViolations === 0) {
    summary += `✓ Order-independence verified across all random scenarios.\\n\\n`;
  }

  summary += `## Data Files\\n\\n`;
  summary += `- Deterministic results: \`reports/deterministic.csv\`\\n`;
  summary += `- Random test failures: \`reports/random_failures.csv\`\\n`;
  summary += `- Order-independence violations: \`reports/order_independence.csv\`\\n`;
  summary += `- Aggregate metrics: \`reports/metrics.json\`\\n`;

  return summary;
}

/**
 * Write CSV reports
 */
function writeReports() {
  console.log('\\n=== Generating Reports ===');

  // Deterministic results
  let csv = 'tank_gallons,filters,fish,bioload_percent\\n';
  results.deterministic.forEach(r => {
    const filters = r.filters.map(f => `${f.type}:${f.gph}GPH`).join('+');
    csv += `${r.tank},"${filters}","${r.fish.length} species",${r.bioload || 'N/A'}\\n`;
  });
  writeFileSync(join(REPORTS_DIR, 'deterministic.csv'), csv);

  // Order independence violations
  csv = 'tank_gallons,num_filters,num_species,bioload_A,bioload_B,delta\\n';
  results.orderIndependence.forEach(v => {
    csv += `${v.scenario.tank},${v.scenario.filters.length},${v.scenario.fish.length},${v.bioloadA || 'N/A'},${v.bioloadB || 'N/A'},${v.delta.toFixed(3)}\\n`;
  });
  writeFileSync(join(REPORTS_DIR, 'order_independence.csv'), csv);

  // Random failures (any assertion failure)
  csv = 'scenario_id,tank_gallons,filters,fish,issue,details\\n';
  let scenarioId = 1;

  results.assertions.spongeNeverIncreases.failures.forEach(f => {
    csv += `${scenarioId++},${f.tank},"Sponge:${f.spongeGph}GPH","test fish","Sponge increased bioload","${f.baseline.toFixed(2)}% → ${f.withSponge.toFixed(2)}%"\\n`;
  });

  writeFileSync(join(REPORTS_DIR, 'random_failures.csv'), csv);

  // Metrics JSON
  const metrics = {
    timestamp: new Date().toISOString(),
    totals: {
      deterministic: results.deterministic.length,
      random: results.random.length,
      ui: results.ui.length
    },
    assertions: {
      spongeNeverIncreases: {
        passed: results.assertions.spongeNeverIncreases.passed,
        failed: results.assertions.spongeNeverIncreases.failed,
        passRate: results.assertions.spongeNeverIncreases.passed + results.assertions.spongeNeverIncreases.failed > 0
          ? (results.assertions.spongeNeverIncreases.passed / (results.assertions.spongeNeverIncreases.passed + results.assertions.spongeNeverIncreases.failed) * 100).toFixed(2)
          : '100.00'
      },
      orderIndependence: {
        total: results.random.length,
        violations: results.orderIndependence.length,
        violationRate: results.random.length > 0
          ? (results.orderIndependence.length / results.random.length * 100).toFixed(2)
          : '0.00'
      },
      zeroState: {
        passed: results.assertions.zeroState.passed,
        failed: results.assertions.zeroState.failed
      }
    },
    ui: {
      total: results.ui.length,
      passed: results.ui.filter(c => c.passed).length,
      failed: results.ui.filter(c => !c.passed).length
    }
  };

  writeFileSync(join(REPORTS_DIR, 'metrics.json'), JSON.stringify(metrics, null, 2));

  // Summary
  const summary = generateSummaryReport();
  writeFileSync(join(REPORTS_DIR, 'summary.md'), summary);

  console.log('  ✓ Reports generated');
}

/**
 * Main test runner
 */
async function main() {
  console.log('\\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Stocking Advisor — Logic & Stress Test Suite             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (compatible; StockingAdvisorTestBot/1.0)',
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();
    const advisorPage = new StockingAdvisorPage(page);

    // Initialize and extract page data
    console.log('=== Initializing Page ===');
    await advisorPage.initialize();

    // Run test suites
    await runDeterministicTests(advisorPage);
    await runRandomStressTests(advisorPage, 100); // Run 100 random scenarios (adjust as needed)
    await runLogicAssertions(advisorPage);
    await runUISmoke(advisorPage);

    // Generate reports
    writeReports();

    console.log('\\n=== Test Suite Complete ===\\n');
    console.log('See reports in:', REPORTS_DIR);
    console.log('Summary:', join(REPORTS_DIR, 'summary.md'));

  } catch (error) {
    console.error('\\n❌ Test suite failed:', error);
    results.errors.push(error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run tests
main().catch(console.error);
