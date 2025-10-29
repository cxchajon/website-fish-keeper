# Filter Dropdown Reliability Report

## Root Cause Analysis
- **Fragmented data sources:** Prototype scripts fetched `/prototype/assets/data/filters_catalog.json` while production pages requested `/data/filters.json`. Only the prototype path contained the full catalog; the production JSON was stale and frequently absent in deploy bundles, yielding 404s and empty dropdowns.
- **Inconsistent loaders:** Each page implemented bespoke fetch logic without shared caching or error handling. Failed network requests left selects populated with no options, causing the “Filter Product” dropdown to appear empty.
- **No resilient fallback:** When fetches failed, UI code neither disabled the select nor surfaced a status message, leaving users with an unusable control.

## Fixes Implemented
- Consolidated all filter catalog entries into `/assets/data/gearCatalog.json`, eliminating redundant JSON artifacts.
- Introduced a shared loader (`js/gear-data.js`) that sanitizes entries, caches them in `localStorage`, supports custom fetch implementations for tests, and exposes reusable helpers (`getGearData`, `filterGearByTank`, `populateFilterDropdown`).
- Updated stocking advisor, gear page, and prototype modules to consume the shared loader, remove bespoke fetch logic, and surface clear fallback messaging when data is unavailable.
- Rebuilt dropdown rendering to batch option insertion, preserve selections when possible, and disable controls with a “Filters unavailable” notice on error.
- Refreshed prototype tests to reflect the unified catalog and new source metadata, ensuring continuous coverage of filtering behavior.

## Modified Files
- `assets/data/gearCatalog.json`
- `js/gear-data.js`
- `js/stocking.js`
- `assets/js/gear.v2.js`
- `prototype/js/catalog-loader.js`
- `prototype/js/proto-filtration.js`
- `prototype/tests/filters.spec.js`
- `prototype/tests/filters.smoke.spec.js`
- `codex_reports/filter_fix_report.md`

## Verification
- Dropdown initialization now defers until catalog data resolves; selectors remain disabled with messaging if the fetch fails, protecting both desktop and mobile flows.
- Shared loader caches successful responses and will reuse cached data offline, keeping filter selection functional after the first load.
- Prototype smoke tests updated to reflect the unified dataset and continue to validate filtering heuristics.

