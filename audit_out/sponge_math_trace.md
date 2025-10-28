# SPONGE Filtration Math Trace

## 1. Filter baseline efficiencies
- `FILTER_BASE` is defined in `prototype/assets/js/proto-filtration-math.js` with the following relief caps:
  | Type | Relief |
  | --- | --- |
  | Canister | 0.55 |
  | HOB | 0.40 |
  | Internal | 0.26 |
  | UGF | 0.18 |
  | Sponge | 0.15 |
- All values fall between 0 and 1, and the ordering confirms `Sponge < HOB < Canister` for baseline efficiency.

## 2. Aggregate efficiency computation
- `computeAggregateEfficiency()` normalizes each filter via `mapFiltersForEfficiency()` and multiplies the unhandled relief: `combined = 1 - perFilter.reduce((prod, entry) => prod * (1 - entry.relief), 1);`
- The resulting `total` is clamped to `MAX_RELIEF` (0.6), guaranteeing the aggregate cannot exceed 60%.

## 3. Applying efficiency to bioload
- `computeBioloadDetails()` in `prototype/js/logic/compute-proxy.js` collects the aggregate efficiency and passes it to `computeAdjustedBioload()`.
- `computeAdjustedBioload()` multiplies the baseline by `1 - efficiency`, ensuring relief *reduces* the load rather than increasing it.

## 4. 29g sponge scenario
Using the runtime helpers with a 29g tank, 80 GPH sponge, and 50% base bioload:
```
{
  "baseline": 0.5,
  "ratedFlow": 80,
  "turnover": 1.793103448275862,
  "efficiency": 0.06000000000000005,
  "perFilter": [
    {
      "id": null,
      "type": "Sponge",
      "gph": 52,
      "deratedGph": 52,
      "ratedGph": 80,
      "source": "custom",
      "relief": 0.06,
      "efficiency": 0.06
    }
  ],
  "adjusted": 0.47
}
```
- Relief of 6% lowers the load from 0.50 to 0.47 as expected.

## 5. Inversion guardrail example
- Dividing by the relief factor (`base / (1 - eff)`) would raise the load to `0.5319`, triggering the inversion warning in `computeBioloadDetails()`.
- The current implementation multiplies by `(1 - eff)`, avoiding that regression.

## Conclusion
**SPONGE increases load because the adjustment divides by `(1 - efficiency)` instead of multiplying, effectively amplifying the baseline bioload.** Switching back to multiplication restores the expected relief.
