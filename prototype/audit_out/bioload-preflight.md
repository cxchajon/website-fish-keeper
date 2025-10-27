# Bioload Pre-flight Audit

| File | Key functions | Bioload % handling | Flow/turnover applied to |
| --- | --- | --- | --- |
| `/js/logic/compute.js` | `computeBioload`, `buildComputedState` | Calls `computeBioloadPercent` then multiplies result by `filtration.totalFactor`, inflating % when filters add flow. | ❌ Numerator (load) via `value * filtration.totalFactor` |
| `/js/bioload.js` | `computeBioloadPercent`, `computeFiltrationFactor` | Percent = `totalGE / effectiveGallons * 100`; filtration helper returns multiplier (0.9–1.1) used upstream. | ❌ Intended multiplier feeds numerator when consumed by `computeBioload`. |
| `/js/logic/envRecommend.js` | `computeBioloadPct`, `computeBioloadLabel` | Reads `computed.bioload.currentPercent` / `proposedPercent` (already flow-adjusted) to render meter/badges. | ❌ Receives numerator-inflated percent from compute module. |
| `/js/stocking.js` | `renderAll`, gear payload helpers | Uses `computed.bioload.proposedPercent` to announce status and set UI states. | ❌ Flow multiplier already baked into provided percent. |
| `/prototype/js/proto-filtration.js` | `renderFiltration`, `computeTurnover` usage | Displays total rated GPH and turnover chip; does not adjust bioload math itself. | ✅ Only denominator context (turnover display), no load multiplier applied. |
