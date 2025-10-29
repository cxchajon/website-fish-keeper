# Filtration Order Audit — 2025-01-17

## Compute Sites
- `prototype/js/logic/compute-proxy.js`
  - Wraps `js/logic/compute.js` exports and patches `computeBioload`/`buildComputedState` via `computeBioloadDetails()` to derive percents from immutable base load + `effectiveCapacity()`.
  - Helper `computeBioloadDetails()` invokes:
    - `normalizeFilters()` / `describeFilterCapacity()` / `effectiveCapacity()` from `/prototype/assets/js/proto-filtration-math.js`.
    - Builds base vs adjusted (flow-included) variants and returns percent, capacity modifier, breakdown.
- `prototype/assets/js/proto-filtration-math.js`
  - Provides math primitives (`toNum`, `rbcForFilter`, `combinedRbc`, `effectiveCapacity`, `computePercent`).
  - Handles RBC inference, diminishing weights, clamping, turnover.
- `prototype/js/proto-filtration.js`
  - UI controller for prototype filtration card.
  - Maintains local `state.filters`, mirrors to `window.appState`, computes totals via `computeFilterStats()` (uses math helpers), schedules `ttg:recompute`.
- Legacy base module `js/logic/compute.js`
  - Still computes baseline load + applies `computeFiltrationFactor()` multiplier. Patched results overwritten by proxy.

## State Sources & Flow
- Prototype filtration state:
  - `state.filters` / `state.tankGallons` inside `prototype/js/proto-filtration.js`.
  - Normalized filters persisted to `localStorage` and mirrored to `window.appState`.
  - `applyFiltersToApp()` copies normalized list to `appState.filters` + `appState.filtering` summary (GPH, turnover, RBC boost) then fires `ttg:recompute`.
- Stocking app state:
  - `window.appState` seeded in `js/stocking.js` (`bootstrapStocking()`).
  - `buildComputedState(state)` in `prototype/js/logic/compute-proxy.js` (via import map) reads `state.filters` / `state.filtering` to compute tank + bioload.
- Base bioload values:
  - Derived from species GE totals inside base engine (`js/logic/compute.js`).
  - Proxy re-runs pure math without writing adjusted numbers back to `state` (keeps `raw.proposed` untouched, exposes derived `adjusted*` for compatibility).

## Single Source of Truth Notes
- Bioload percent shown in UI ultimately comes from `computed.bioload.proposedPercent` produced by `computeBioloadDetails()` (proxy) → `renderAll()` in `js/stocking.js`.
- `prototype/js/proto-filtration.js` recalculates totals separately for chip UI but defers actual percent math to global recompute (no direct meter writes).
- No code currently writes adjusted bioload back into `window.appState.stock` — proxy returns derived `adjusted*` values but base loads remain intact.
- Order-dependent bug likely stems from residual multiplier usage (`computeFiltrationFactor`) before proxy rewrite; confirm pure recompute triggered for every change to enforce order independence.
