# Stocking Advisor — Tetra Whisper IQ 45 flow correction (2026-09)

Scope: **`tetra-whisper-iq-45` `gphRated` only** (260 → 215). Context:
`_internal/reports/stocking-advisor-filter-catalog-audit-2026-09.md` (flagged 260 vs 215) and
`_internal/reports/stocking-advisor-filter-catalog-fix-batch-1-2026-09.md` (main @ `634f4f2`).

Not changed: any other product, sponge filters, duplicate records, filtration thresholds,
`MIN_BIOLOGICAL_TURNOVER` (still 2×), the filtration UI, the catalog schema, tank presets, and the
Tetra record's `minGallons` / `maxGallons`.

---

## 1. Runtime record

Runtime catalog: **`assets/data/gearCatalog.json`** (loaded only by `js/gear-data.js`).

| | ID | Type | gphRated | minGallons | maxGallons |
| --- | --- | --- | --- | --- | --- |
| Before | `tetra-whisper-iq-45` | HOB | **260** | 40 | 75 |
| **After** | `tetra-whisper-iq-45` | HOB | **215** | 40 | 75 |

This is the only Whisper IQ record in the runtime catalog. Every other record is byte-identical to
main; a unit test pins a SHA-256 fingerprint of the other 40 records.

## 2. Manufacturer source and flow meaning

- Tetra product page: https://www.tetra-fish.com/products/filtration/whisper-iq-power-filters
  (Whisper IQ 45: **215 GPH**).
- Tetra manual: https://www.tetra-fish.com/-/media/project/spectrumcommerce/tetra/files/fish-files/manuals/filters/whisper-iq-power-filters.pdf
  The IQ filters have an adjustable flow control. IQ45: **215 GPH at maximum (the rated flow)**,
  **20 GPH at the lowest setting**.
- Stored value: **215 GPH, the manufacturer's maximum/rated flow**. That matches how every other
  catalog GPH is used (an upper-bound estimate, per `FILTRATION_MODEL.md`). The 20 GPH minimum is
  **not** used for scoring, and no "average operating flow" was invented.
- Verification note: the tetra-fish.com domain is blocked by this build environment's network
  proxy, so these pages could not be fetched again in this phase. The 215 GPH figure is the one the
  filter-catalog audit recorded from the same Tetra page. The flow-control figures come from the
  phase brief's citation of the manual. **Please re-check the page before this goes live.**

## 3. Scoring impact (Phase 2C)

Turnover is rated GPH ÷ nominal preset gallons (`assessFiltration`). "Offered" means the product
picker lists it for that preset (`filterGearByTank`, range 40–75 unchanged).

| Preset | Gallons | Offered | Before (260) | After (215) | Status before → after |
| --- | --- | --- | --- | --- | --- |
| 5 | 5 | – | 52.00× | 43.00× | adequate → adequate |
| 10 | 10 | – | 26.00× | 21.50× | adequate → adequate |
| 15 | 15 | – | 17.33× | 14.33× | adequate → adequate |
| 20 High / 20 Long | 20 | – | 13.00× | 10.75× | adequate → adequate |
| 29 | 29 | – | 8.97× | 7.41× | adequate → adequate |
| **40 Breeder** | 40 | **yes** | 6.50× | **5.38×** | adequate → adequate |
| **55** | 55 | **yes** | 4.73× | **3.91×** | adequate → adequate |
| **75** | 75 | **yes** | 3.47× | **2.87×** | adequate → adequate |
| 125 | 125 | – | 2.08× | **1.72×** | **adequate → very-low** |

- The 2× floor now falls at 107.5 gal (215 ÷ 2); before it fell at 130 gal (260 ÷ 2).
- **On the three presets where the picker offers the product, there are no status changes.** All
  stay above 2×. The smallest margin is on 75 gal, at 2.87×.
- **The one change is on 125 gal.** The product is not offered there, but a filter added on a
  smaller tank stays in the list when the user switches tanks, and saved filters are restored by
  id. With the Tetra alone on 125 gal, the result goes from "adequate" to **very-low**. The
  existing "Filter flow too low" danger warning now fires: "215 GPH through filter media turns this
  125-gallon tank over about 1.7× per hour, below the 2× minimum." This is the intended effect of
  an accurate input. The earlier 2.08× was a pass only because of the overstated 260 GPH.
- The same thing happens with the Tetra plus other filters wherever the total biological GPH drops
  below 2 × gallons. The change is always the 45 GPH difference.

## 4. Stocking Load unaffected

For a fixed stock (10 neon + 6 bronze cory), I captured the full `buildComputedState` output on all
10 presets before and after the edit, then diffed them:

- `bioload` is **identical** on every preset: current/proposed load, capacity, effective capacity,
  percents, severity and text. The only field that differs is `bioload.flowAdjustment`, which just
  echoes the entered GPH/turnover and is not used in the percentage.
- Filtration gives no capacity bonus. The unit test checks that the load and capacity with the
  Tetra match the values with no filter at all.
- Species warnings on 40 Breeder, 55 and 75 are identical. The only warning change anywhere is the
  filtration warning on 125 gal described in §3.
- Other flow echoes that change: `tank.deliveredGph`, `tank.ratedGph`, `tank.turnover`,
  `tank.filterFlow.*` and the legacy `tank.multiplier` (from `interpolateMultiplier`). Nothing reads
  `tank.multiplier` into capacity; the only other reference is a debug string in
  `compute.legacy.js`. Capacity is unchanged, which confirms this.

## 5. Tank range: not changed (open metadata issue)

`minGallons` 40 / `maxGallons` 75 are **unchanged**. The audit classes them as GPH-bucket values
from the retired `inferRangeFromGph` script, not a manufacturer rating. The audit recorded the
Tetra page as saying the IQ 45 is for aquariums **up to 45 gallons**. No direct Tetra minimum was
found, and the "45" in the model name is not treated as evidence of one. As a result the picker
still offers the product for 55 and 75 gal. **This needs review before any range change.**

## 6. Non-runtime copies (not edited)

These files still say 260, and none is read by the Stocking Advisor:
- `assets/data/gear/filters.json` (written by `npm run sync:filters`)
- `data/filters.json` (a prototype source for that script)

The sync script writes only `assets/data/gear/filters.json`, so it cannot revert the runtime
catalog. `data/gear_filtration.csv` (gear page) has no GPH for this product.

## 7. Tests

New: `tests/unit/filter-catalog-tetra-iq45.test.mjs` (7 tests):
- record exists, type HOB, gphRated 215 (not 260), range still 40–75, one Whisper IQ record, and
  the loader returns the same values;
- no other catalog record changed (41 records; SHA-256 of the other 40; batch 1 GPH pinned);
- picker eligibility unchanged (offered for 40 Breeder, 55 and 75 only);
- the product sends exactly 215 GPH into Phase 2C (`gphTotal`, `biologicalGph`), with
  `turnover = 215 / gallons` on every preset;
- status stays adequate on 40 Breeder, 55 and 75 (75 gal ≈ 2.867×);
- Stocking Load is identical at 215 and 260 GPH, and equal to the no-filter load (no bonus);
- species warnings are unchanged on the presets that offer the product.

Against the old catalog value (260), tests 1, 4 and 5 fail and the rest pass, as intended.

Results:
- Unit suite **126/126 pass**.
- Filtration + filter-catalog tests **29/29 pass**.
- Stocking Advisor production gate (`npm run test:e2e:stocking-gate`, run with `PW_CHROMIUM_PATH`
  set to the preinstalled Chromium): **95 passed, 27 skipped (desktop/mobile split), 0 failed**.
  That is the same as the batch 1 baseline. It covers the 44 species, the quantity-preview fix,
  the water model, warning visibility, Phase 2G predation cases, filtration thresholds and filter
  scoring. Batch 1 ranges and the AC70 / Fluval 307 / EHEIM 2213 GPH are also pinned by
  `filter-catalog-batch-1.test.mjs`.

## 8. Rollout note

`js/gear-data.js` serves a returning visitor's cached catalog first and refreshes it in the
background. For one page load after deploy, that visitor may still score the Tetra at 260 GPH.
Saved filters are rebuilt from the catalog by id, so they pick up 215 once the cache refreshes.
