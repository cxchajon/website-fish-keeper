# Stocking Tests (Real Library)

This harness consumes the production `FISH_DB` dataset and normalizes it for Jest-based regression tests. The adapter loads the source records read-only and writes reporting artifacts into `out/`.

## Fallback assumptions
- Bioload math mirrors the production gallon-equivalent model: base bioload derives from `bioloadGE` when present; otherwise a size³ × density heuristic. Effective capacity applies a 10% displacement loss, matching `js/bioload.js` constants.
- Compatibility rules evaluate thermal, pH, and gH range overlaps; aggression gaps; invert safety; fin-nipping vs. long-fin risk; and salinity tolerance. These mirrors the production heuristics but run entirely in-node without UI dependencies.
- Turnover guidance uses a 4×–8× gallons-per-hour recommendation band, consistent with stocking tips used on the site.

All generated reports live under `out/` to avoid polluting the main repository.
