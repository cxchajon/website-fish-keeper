# Stocking Advisor Test Suite

Comprehensive logic and stress testing suite for the Stocking Advisor filtration model, order-independence verification, and UI smoke checks.

## Overview

This test suite validates the Stocking Advisor's filtration logic using headless browser automation with Playwright. It runs against the live page at https://thetankguide.com/stocking-advisor.html to ensure:

- **Filtration never increases bioload** (especially sponge filters)
- **Order-independence**: Adding filters/fish in any sequence yields the same result
- **Monotonicity**: Better filtration = lower adjusted bioload
- **Zero state stability**: Empty tanks behave predictably
- **UI accessibility**: Info buttons, mobile menus, and interactions work correctly

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Playwright browsers installed (run `npm run pw:install` from project root if needed)

### Running the Tests

From the project root:

```bash
node tests/stocking_advisor/scripts/run_tests.mjs
```

### What Gets Tested

**Deterministic Matrix (108 tests):**
- Tank sizes: 5, 10, 20, 29, 40, 55 gallons
- Single filters: Sponge 80 GPH, HOB 200 GPH, Canister 300 GPH
- Multi-filter combos: HOB+Sponge, HOB+HOB, Canister+Sponge
- Scenarios: Each tank × each filter combo

**Random Stress Tests (10,000 scenarios by default):**
- Randomized tank sizes (5–75 gal)
- 0–3 filters per scenario
- Random filter types (Sponge, HOB, Canister, Internal) with GPH 40–700
- 0–35 fish across random species and quantities
- Each scenario runs twice: (tank → filters → fish) vs (tank → fish → filters)

**Logic Assertions:**
1. **Sponge never increases bioload**: Adding any sponge filter must reduce or maintain bioload vs. no-filter baseline
2. **Zero state**: Tanks with no fish should show stable, minimal bioload
3. **Order independence**: Scenarios A and B must match within 0.01% tolerance

**UI Smoke Checks:**
- Default page load
- Adding fish
- Adding filters
- Info button tooltips
- Mobile responsive layout
- Console error tracking

## Configuration

Edit `scripts/run_tests.mjs` to adjust:

- **Random test count**: Change `runRandomStressTests(advisorPage, 100)` to a higher number (default: 100 for quick tests, use 10000 for full stress)
- **Tank sizes**: Modify `DETERMINISTIC_MATRIX.tanks`
- **Filter configurations**: Modify `DETERMINISTIC_MATRIX.filtersSingle` or `filtersMulti`
- **Floating-point tolerance**: Adjust `tolerance` in order-independence checks

## Output Files

All outputs are saved to `tests/stocking_advisor/`:

### Reports (`reports/`)
- **summary.md** — Human-readable summary with pass/fail counts and top failures
- **deterministic.csv** — All deterministic test results with inputs and outputs
- **order_independence.csv** — Scenarios where sequence A ≠ B
- **random_failures.csv** — All random tests that failed assertions
- **metrics.json** — Aggregate stats (% passing, violation rates)

### Screenshots (`screens/`)
- `01-default-load.png` — Initial page state
- `02-fish-added.png` — After adding fish
- `03-filter-added.png` — After adding filter
- `04-mobile-view.png` — Mobile viewport
- `05-info-tooltip.png` — Info popover open
- `06-error-example.png` — Error state (if any)

### Artifacts (`artifacts/`)
- Reserved for filtration constants or debug data dumps

## Interpreting Results

### Summary Report

The `reports/summary.md` file contains:

1. **Overview**: Total test counts
2. **Assertion Results**: Pass/fail for each logic rule
3. **Top 10 Failures**: Detailed scenarios for debugging
4. **UI Checks**: Which smoke tests passed
5. **Console Errors**: Any JavaScript errors encountered
6. **Recommendations**: Suggested fixes if failures detected

### Acceptance Criteria

✅ **Pass** if:
- Sponge assertion: 0 failures
- Order-independence: 0 failures in deterministic; ≤0.5% in random
- Zero state: All tests pass
- UI checks: No critical failures
- No uncaught console errors

⚠️ **Investigate** if:
- Order-independence violations > 0.5% but < 2%
- UI checks partially pass
- Minor console warnings (non-error)

❌ **Fail** if:
- Any sponge filter increases bioload
- Order-independence violations > 2%
- Console errors present
- Multiple UI checks fail

## Common Issues

### "Timeout waiting for selector"
- **Cause**: Page took too long to load or UI element missing
- **Fix**: Check network; increase timeout in `page.waitForSelector()` calls

### "Order-independence violations in deterministic tests"
- **Cause**: Computation order bugs in the page's JS
- **Fix**: Review `js/stocking-advisor/filtration/math.js` and `js/logic/compute.js` for race conditions or mutable state

### "Sponge increases bioload"
- **Cause**: Incorrect RBC math or turnover calculations
- **Fix**: Verify RBC values in `filtration/math.js` and ensure capacity boost is applied correctly

## Advanced Usage

### Run specific test suites

Edit `main()` in `run_tests.mjs` to comment out unwanted suites:

```javascript
// await runDeterministicTests(advisorPage);
await runRandomStressTests(advisorPage, 1000);  // Only random tests
// await runLogicAssertions(advisorPage);
// await runUISmoke(advisorPage);
```

### Debug mode

Launch with `headless: false` to see browser:

```javascript
const browser = await chromium.launch({
  headless: false,  // Change this
  args: ['--no-sandbox']
});
```

### Extract filtration constants

Add after `advisorPage.initialize()`:

```javascript
const constants = await page.evaluate(() => {
  return {
    RBC_TABLE: window.RBC_TABLE || {},
    MAX_CAPACITY_BONUS: window.MAX_CAPACITY_BONUS,
    // Add other exposed constants
  };
});
writeFileSync(join(ARTIFACTS_DIR, 'filtration_constants.json'), JSON.stringify(constants, null, 2));
```

## Troubleshooting

**Playwright not installed:**
```bash
npm run pw:install
```

**Missing dependencies:**
```bash
npm install
```

**Browser crashes:**
- Reduce random test count from 10,000 to 100
- Run tests in smaller batches
- Increase system memory

## Architecture

```
scripts/run_tests.mjs        Main test runner
  ├─ StockingAdvisorPage     Page interaction helpers
  ├─ runDeterministicTests   Predefined matrix tests
  ├─ runRandomStressTests    Randomized scenarios + order checks
  ├─ runLogicAssertions      Sponge/zero-state/monotonicity
  ├─ runUISmoke              Screenshots + interaction tests
  └─ writeReports            CSV/JSON/MD output

reports/                     Human + machine-readable results
screens/                     Visual regression screenshots
artifacts/                   Debug dumps
```

## Contributing

When modifying tests:

1. Update `DETERMINISTIC_MATRIX` for new filter types or tank sizes
2. Add new assertion functions following the pattern in `runLogicAssertions()`
3. Keep floating-point tolerance realistic (0.01% recommended)
4. Update this README if output format changes

## License

Internal tool for The Tank Guide. Not for external distribution.

## Contact

Report issues or suggest improvements via the project's internal feedback channel.
