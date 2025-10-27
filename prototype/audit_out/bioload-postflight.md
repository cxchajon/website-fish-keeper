# Bioload Post-flight Report

## Files touched
- `prototype/js/logic/compute-proxy.js` — adds dev flag, detailed percent math helper, UI-bound console diagnostics, and dev harness.
- `prototype/tests/bioload.turnover.spec.js` — restructures into `describe` suite with Jest-style expectations.
- `prototype/audit_out/bioload-callchain.md`, `prototype/audit_out/bioload-preflight-console.txt`, `prototype/audit_out/bioload-tests.txt` — updated audit artifacts per brief.

## Formula snapshot
- **Final math** (`computeBioloadDetails` → `percentBioload`):
  ```js
  const load = speciesLoad * (planted ? 0.90 : 1.00);
  const turnoverX = gallons > 0 ? flowGPH / gallons : 0;
  const capBonus = clamp(mapLinear(turnoverX, 5, 10, 0.00, 0.10), 0.00, 0.10);
  const capacity = gallons * (1 + capBonus);
  const percent = capacity > 0 ? (load / capacity) * 100 : 0;
  ```
  Flow only expands the denominator; no multipliers touch the numerator.

## Monotonic check (species load ≈ 15 GE)
| Case | Flow (GPH) | Turnover× | Percent |
|------|------------|-----------|---------|
| A    | 80         | 2.76×     | 51.72% |
| B    | 200        | 6.90×     | 49.83% |
| C    | 260        | 8.97×     | 47.92% |

Higher flow keeps the same stock at or below the previous capacity usage.

## Validation
- `node --test prototype/tests/bioload.turnover.spec.js`
- Manual harness (`window.__runBioloadDevCases`) echoes the monotonic table above.
- Planted toggle observed to lower percent while flag disabled.
