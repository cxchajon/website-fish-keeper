# Bioload Post-flight Notes

**Files touched**
- `prototype/stocking-prototype.html` — import map reroutes the prototype to the patched compute logic.
- `prototype/js/logic/compute-proxy.js` — wraps the canonical compute module with the new bioload math.
- `prototype/tests/bioload.turnover.spec.js` — node-based regression covering flow, planted relief, and zero-gallon guard.
- `prototype/audit_out/bioload-preflight.md`, `prototype/audit_out/bioload-tests.txt` — audit artifacts per brief.

**Formula comparison**
- _Before_: `percent = computeBioloadPercent(...) * filtration.totalFactor` → flow multipliers inflated the load.
- _After_: `percent = (speciesLoad * plantedAdj) / (gallons * (1 + flowBonus)) * 100` with `flowBonus` = mapLinear(turnover, 5–10× → 0–10%).

**29g reference (species load = 15)**
- 80 GPH → **51.72 %**
- 260 GPH → **47.92 %** (higher flow yields equal or lower usage, never higher).

Manual sanity reminder: stock plan stays steady or drops when filters are added, turnover badge still reflects raw ×/h, planted toggle lowers percent modestly.
