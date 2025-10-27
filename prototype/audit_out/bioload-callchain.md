# Bioload Meter Call Chain

1. `renderAll` (`/js/stocking.js`)
   - Calls `buildComputedState(state)` to refresh computed metrics.
2. `buildComputedState` (`/prototype/js/logic/compute-proxy.js`)
   - Delegates to base compute and pipes the result through `patchComputed`.
3. `patchComputed` → `patchBioload` (`/prototype/js/logic/compute-proxy.js`)
   - Recomputes `currentPercent` / `proposedPercent` via `percentBioload` and hands the percent + text back on `computed.bioload`.
4. `renderEnvironmentPanels` (`/js/stocking.js`)
   - Passes the updated `computed` object into `renderEnvCard`.
5. `renderEnvCard` (`/js/logic/envRecommend.js`)
   - Uses `computeBioloadPct(computed)` and `computeBioloadLabel(computed, entries.length)` to build the UI payload.
6. Template rendering inside `renderEnvCard` (`/js/logic/envRecommend.js`)
   - Writes `bioloadPct` to the meter width/ARIA (`<div class="env-bar__fill" style="width:${bioloadPct}%">`) and shows the formatted percent text (`data-role="bioload-percent"`).
