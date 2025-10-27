# UI Binding Summary (Prototype Stocking Advisor)

## Bioload Meter
- `renderAll()` in `js/stocking.js` rebuilds computed state and calls `renderEnvironmentPanels()` after every recompute (`window.addEventListener('ttg:recompute', ...)`). 【F:js/stocking.js†L2142-L2183】【F:js/stocking.js†L2208-L2245】
- `renderEnvironmentPanels()` delegates to `renderEnvCard()` which injects the percent into the DOM. 【F:js/logic/envRecommend.js†L113-L158】
- `renderBars()` reads `computed.bioload.currentPercent`, converts it to percent with `computeBioloadPct()`, and updates both the text (`data-role="bioload-percent"`) and the fill width/ARIA on the progress bar. 【F:js/logic/envRecommend.js†L280-L318】【F:js/logic/envRecommend.js†L491-L548】【F:js/logic/envRecommend.js†L900-L908】

## Filter UI → Logic Bridge
- `setFilters()` in `prototype/js/proto-filtration.js` sanitizes product/custom entries, updates the local state, re-renders chips, and calls `applyFiltersToApp()`. 【F:prototype/js/proto-filtration.js†L560-L648】
- `applyFiltersToApp()` copies normalized filters onto `window.appState`, computes totals (`computeFilterStats()`), and dispatches `ttg:recompute` via `scheduleRecompute()`. 【F:prototype/js/proto-filtration.js†L232-L320】
- `computeFilterStats()` assembles turnover, mix, and efficiency for the recompute payload using `getTotalGPH()`, `computeTurnover()`, and `computeAggregateEfficiency()`. 【F:prototype/js/proto-filtration.js†L244-L317】

## Event Handlers
- **Product filters:** `refs.productSelect` listens for `change` events to fetch catalog data (`handleProductChange()`), while `refs.productAddBtn` adds the selected product via `tryAddProduct()` → `setFilters()`. 【F:prototype/js/proto-filtration.js†L734-L808】
- **Custom filters:**
  - `refs.manualInput` handles `keydown` (Enter) and `input` to add or validate manual entries. 【F:prototype/js/proto-filtration.js†L780-L827】
  - `refs.manualAddBtn` click triggers `tryAddCustom()` → `addManualFilter()` → `setFilters()`. 【F:prototype/js/proto-filtration.js†L828-L860】
  - `refs.manualType` change updates validation hints before dispatching `setFilters()`. 【F:prototype/js/proto-filtration.js†L814-L827】
- **Removing filters:** Chip container (`refs.chips`) listens for `click` events with `data-remove-filter` to call `removeFilterById()` → `setFilters()`. 【F:prototype/js/proto-filtration.js†L708-L776】

## Recompute Loop
- After `applyFiltersToApp()` updates `window.appState`, `scheduleRecompute()` (inside `setFilters`) triggers `window.dispatchEvent(new CustomEvent('ttg:recompute'))`, which `js/stocking.js` handles to call `runRecompute()` and refresh the bioload meter. 【F:prototype/js/proto-filtration.js†L216-L233】【F:js/stocking.js†L2230-L2245】
