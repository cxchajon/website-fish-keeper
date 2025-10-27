# Filtration → Bioload Percent Callgraph

1. `setFilters` (`prototype/js/proto-filtration.js`:187-220)
   - Normalizes the chip list after a user adds/edits filtration and calls `render()`.
2. `render` (`prototype/js/proto-filtration.js`:362-403)
   - Re-renders the chip bar + summary and invokes `applyFiltersToApp()`.
3. `applyFiltersToApp` (`prototype/js/proto-filtration.js`:152-169)
   - Copies filters into `window.appState`, persists them, and calls `scheduleRecompute()`.
4. `scheduleRecompute` (`prototype/js/proto-filtration.js`:142-149)
   - Dispatches the `ttg:recompute` custom event on the next animation frame.
5. `window.addEventListener('ttg:recompute', …)` (`js/stocking.js`:2243-2245)
   - Triggers `runRecompute({ skipInputSync: true })`.
6. `runRecompute` → `renderAll` (`js/stocking.js`:2214-2221, 2126-2197)
   - `renderAll` pulls fresh state and calls `buildComputedState(state)`.
7. `buildComputedState` (`js/logic/compute.js`:1338-1383)
   - (Prototype import map is meant to swap this with `compute-proxy`, but the relative specifier keeps the base module.)
   - Calls `computeBioload(tank, entries, candidate, filterState)`.
8. `computeBioload` (`js/logic/compute.js`:720-815)
   - Applies `computeFiltrationFactor` and writes `computed.bioload.currentPercent / proposedPercent`.
9. `renderEnvironmentPanels` → `renderEnvCard` (`js/stocking.js`:2200-2212; `js/logic/envRecommend.js`:280-420)
   - Reads `computed.bioload.currentPercent` to update the gauge text (`data-role="bioload-percent"`).

**Key wiring note:** Because `js/stocking.js` imports `'./logic/compute.js'`, the import map entry for `"/js/logic/compute.js"` never swaps in the prototype proxy, so the UI keeps using the base bioload math.
