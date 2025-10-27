# Bioload Filtration Fix Notes

- **Root cause:** The prototype aggregated filtration efficiency by taking only the strongest single filter and ignored custom chips when re-computing bioload, leaving additional filters without impact and starving the turnover/flow chain of accurate data.
- **Files touched:**
  - `prototype/assets/js/proto-filtration-math.js`
  - `prototype/js/proto-filtration.js`
  - `prototype/js/logic/compute-proxy.js`
  - `prototype/tests/bioload.spec.js`
  - `prototype/audit_out/bioload-console.txt`
  - `prototype/audit_out/bioload-tests.md`
  - `prototype/audit_out/bioload-fix-notes.md`
- **Before (29g, species load 100, capacity 100):**
  1. No filters → **100%**
  2. Product HOB 206 GPH → **40%**
  3. + Custom HOB 200 GPH → **40%** (no improvement)
  4. + Second custom HOB 200 GPH → **40%** (no improvement)
- **After:**
  1. No filters → **100%**
  2. Product HOB 206 GPH → **40%**
  3. + Custom HOB 200 GPH → **40%** (cap reached, both filters counted)
  4. + Second custom HOB 200 GPH → **40%** (cap maintained, logged with both filters)
  5. Two sponge customs 80 GPH each now drop percent from **86.21% → 44.83%** (previously stuck at ~86%).
- **Aggregation confirmation:** Both product and custom filters are concatenated before computing total flow, turnover, per-filter efficiencies, and the additive efficiency cap (0.6) so that any mix of chips contributes correctly.

