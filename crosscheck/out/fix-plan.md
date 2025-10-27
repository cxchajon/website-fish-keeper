# Proposed Fix Plan

## 1. Apply realistic flow derating before efficiency math
- **File:** `prototype/assets/js/proto-filtration-math.js`
  - Introduce `const FLOW_DERATE = 0.65;` near the top.
  - In `mapFiltersForEfficiency()`, multiply each normalized `gph` by `FLOW_DERATE` before returning (store both rated and derated if UI still needs rated values).
  - Update `getTotalGPH()` (and any total flow display) to use the derated value when computing turnover but keep a separate rated sum for UI labels.

## 2. Switch aggregation to multiplicative relief with diminishing returns
- **File:** `prototype/assets/js/proto-filtration-math.js`
  - Replace the additive `totalRaw` sum inside `computeAggregateEfficiency()` with `combined = 1 - perFilter.reduce((prod, entry) => prod * (1 - entry.efficiency), 1);`.
  - Clamp `combined` with `MAX_RELIEF = 0.6` (declare once) and return that as `total`.
  - Preserve individual `efficiency` entries so UI chips remain unchanged.

## 3. Separate planted relief from production math
- **File:** `prototype/js/logic/compute-proxy.js`
  - Keep `speciesLoad` untouched by plants; compute `plantRelief = clamp(plantBonus ?? default, 0, 0.15)`.
  - After aggregating equipment efficiency, convert to remaining load via: `const equipmentFactor = 1 - eff; const plantFactor = 1 - plantRelief; const effectiveFactor = Math.max(0, equipmentFactor * plantFactor);`.
  - Feed `effectiveFactor` into `computeAdjustedBioload(loadBase, 1 - effectiveFactor)` so plants act as a parallel sink with smaller relief than equipment.

## 4. Guardrail constants + turnover clamp alignment
- **File:** `prototype/assets/js/proto-filtration-math.js`
  - Expose shared constants (`MAX_RELIEF = 0.6`, `TURNOVER_MIN = 0.4`, `TURNOVER_MAX = 1.3`, `FLOW_DERATE = 0.65`).
  - Ensure `computeEfficiency()` uses these constants (already matching memory, so just centralize).

## 5. Update derived summaries to surface derated totals
- **File:** `prototype/js/proto-filtration.js`
  - Adjust `computeFilterStats()` to capture both rated and derated flow: use derated sum for turnover/efficiency math, but continue showing rated flow in chip summaries.
  - Ensure `appState.filtering.turnover` and `totalGph` reflect derated flow so recompute consumers stay consistent.

## 6. Revisit plant bonus defaults
- **File:** `prototype/js/logic/compute-proxy.js`
  - Lower default planted relief to 0.08 (8%) and clamp custom bonuses to ≤0.15, keeping it below the equipment cap.
  - Document the new behavior in inline comments for future tweaks.

After implementing these changes, rerun the cross-check harness to confirm:
- Flow derating drives turnover ratios ≈0.65.
- Combined relief never exceeds 0.6 and stacking filters shows diminishing returns (second filter delta < first).
- Planted scenarios reduce utilization modestly without altering base species load.
