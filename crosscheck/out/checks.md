# Static Cross-Checks

## Q1. Does any path reduce `base_bioload` when filters are added?
**Answer:** No. `computeBioloadDetails()` keeps `speciesLoad` (`loadBase`) separate and only applies filtration via `computeAdjustedBioload(loadPlanted, eff)`; filters never mutate the base species total. 【F:prototype/js/logic/compute-proxy.js†L104-L189】【F:prototype/assets/js/proto-filtration-math.js†L95-L117】

## Q2. Is the planted effect applied as a parallel sink (reduce utilization) rather than reducing fish production?
**Answer:** No. The planted toggle multiplies the base load (`loadBase`) by `(1 - bonus)` before filtration, effectively lowering the numerator instead of increasing capacity or adding a parallel sink. 【F:prototype/js/logic/compute-proxy.js†L112-L134】

## Q3. Are custom filters mapped through the same normalize → derate → efficiency pipeline as catalog filters?
**Answer:** Yes. `setFilters()` stores custom entries with `source: 'custom'`, but `mapFiltersForEfficiency()` reads `rated_gph`/`gph` without regard to source and feeds everything into `computeAggregateEfficiency()`. 【F:prototype/js/proto-filtration.js†L560-L648】【F:prototype/assets/js/proto-filtration-math.js†L49-L93】

## Q4. Is total relief correctly capped with diminishing returns?
**Answer:** Partially. The aggregate clamps to ≤0.6, but it simply sums per-filter efficiencies, so multiple filters add linearly until the hard cap—no multiplicative diminishing returns. 【F:prototype/assets/js/proto-filtration-math.js†L69-L93】

## Q5. Does the UI meter label/tooltip describe capacity used (not "bioload decreased by filters")?
**Answer:** Yes. `computeBioloadPct()` reads `computed.bioload.currentPercent`, and the label text comes from `computeBioloadLabel()` which defaults to the "X → Y of capacity" string supplied by the compute engine. The meter itself is titled "Bioload" with progressbar semantics. 【F:js/logic/envRecommend.js†L280-L318】【F:js/logic/envRecommend.js†L491-L548】【F:js/stocking.js†L2142-L2183】
