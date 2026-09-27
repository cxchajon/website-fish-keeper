# Stocking Advisor — verified filter catalog corrections, batch 1 (2026-09)

Scope: **AquaClear AC70, Fluval 307, EHEIM Classic 2213 / Classic 250 only.** Context:
`_internal/reports/stocking-advisor-filter-catalog-audit-2026-09.md` (main @ `af837b3`).

Not changed: any other product, duplicate records (none merged), sponge filters, Tetra Whisper,
filtration scoring, `MIN_BIOLOGICAL_TURNOVER`, the Stocking Advisor UI, the catalog schema, tank
presets. No filtration-status card was added.

> **Manufacturer tank range is metadata used for catalog eligibility.** It decides which products
> the Filter Product picker offers for the selected tank and is printed in the option label.
> **It is NOT the Stocking Advisor's final filtration adequacy judgment.** Adequacy is still decided
> by the Phase 2C filtration engine from the stored GPH alone.

---

## 1. Runtime catalog

- Runtime catalog: **`assets/data/gearCatalog.json`** — loaded only by `js/gear-data.js`
  (`DATA_URL = '/assets/data/gearCatalog.json'`), used by the advisor
  (`js/stocking-advisor/catalog-loader.js` → `filtration/controller.js`) and by the gear page's
  `?filter=<id>` lookup.
- `assets/data/gear/filters.json` is **not** read by any production code (confirmed by search) and
  was **not** edited.

Matching runtime records before this patch:

| ID | Product name | Type | GPH | minGallons | maxGallons |
| --- | --- | --- | --- | --- | --- |
| `aquaclear-70` | AquaClear 70 Power Filter | HOB | 300 | 40 | 75 |
| `aquaclear-70-1` | AquaClear 70 Power Filter, Fish Tank Filter for 40- to 70-Gallon Aquariums, Black | HOB | 300 | 40 | 75 |
| `fluval-307` | Fluval 307 Performance Canister | CANISTER | 303 | 40 | 75 |
| `eheim-2213` | Eheim Classic External Canister Filter 2213 | CANISTER | 116 | 0 | 20 |

All four old ranges were GPH buckets from the deleted `inferRangeFromGph` script (audit §3), not
manufacturer ratings. There is no separate "Classic 250" record; `eheim-2213` is that product.

---

## 2. Corrections

### AquaClear AC70 (`aquaclear-70`, `aquaclear-70-1`)

| | GPH | minGallons | maxGallons |
| --- | --- | --- | --- |
| Old (both records) | 300 | 40 | 75 |
| **New (both records)** | **300** (unchanged) | **40** | **70** |

- Source: AquaClear series page, https://fluvalaquatics.com/us/shop/product/aquaclear (grade A in
  the audit): 40–70 U.S. gal; 300 U.S. GPH.
- Flow meaning: **manufacturer maximum flow specification.** Not a measured with-media figure.
- Duplicates: **2 records updated**, both IDs preserved, specifications now identical. Not merged
  (duplicate removal is a later phase). Saved filters (`localStorage` filter list →
  `findProductById`) and gear-page links (`?filter=<id>`) resolve by id against the full catalog,
  so either ID still resolves to 300 GPH.

### Fluval 307 (`fluval-307`)

| | GPH | minGallons | maxGallons |
| --- | --- | --- | --- |
| Old | 303 | 40 | 75 |
| **New** | **303** (unchanged) | **40** | **70** |

- Source: Fluval canister series, https://fluvalaquatics.com/us/shop/product/107-canister-filter-10-30
  (grade A for 307): 40–70 U.S. gal; pump output 303 U.S. GPH; filter circulation 206 U.S. GPH.
- Flow meaning: the stored `gphRated` = 303 is **PUMP OUTPUT**. Fluval also publishes **206 GPH
  filter circulation**, which the current one-value schema cannot hold. It was **not** substituted
  and no field was added; the future schema / filtration-status phase decides how to represent both.

### EHEIM Classic 2213 / Classic 250 (`eheim-2213`)

| | GPH | minGallons | maxGallons |
| --- | --- | --- | --- |
| Old | 116 | 0 | 20 |
| **New** | **116** (unchanged) | **21** | **66** |

- Sources: EHEIM Classic 250 product page,
  https://eheim.com/en_GB/spare-parts/technology/external-filters/classic/classic-250 (aquarium size
  from approx. 80 L, up to approx. 250 L; pump output 440 L/h), and the official 2213 manual,
  https://eheim.com/media/pdf/ab/d6/bb/2213_classic_07-20.pdf (U.S. equivalents ≈ 21–66 gal,
  116 GPH).
- Range: **rounded whole-gallon conversions of approximately 80–250 L** (80 L ≈ 21.1 gal,
  250 L ≈ 66.0 gal), matching the catalog's whole-gallon convention.
- Flow meaning: 116 GPH is **PUMP OUTPUT** (440 L/h). It is not a with-media flow.

---

## 3. Product-picker behavior (actual Stocking Advisor presets)

Presets (unchanged): 5, 10, 15, 20 High, 20 Long, 29, 40 Breeder, 55, 75, 125 gal. Eligibility is
`filterGearByTank` (`min ≤ gallons ≤ max`), the function the filtration controller uses.

| Tank | Offered before → after | EHEIM 2213 | AC70 (both ids) | Fluval 307 |
| --- | --- | --- | --- | --- |
| 5 gal | 7 → 6 | offered → **hidden** | hidden | hidden |
| 10 gal | 7 → 6 | offered → **hidden** | hidden | hidden |
| 15 gal | 7 → 6 | offered → **hidden** | hidden | hidden |
| 20 High / 20 Long | 19 → 18 | offered → **hidden** | hidden | hidden |
| 29 gal | 12 → 13 | hidden → **offered** | hidden | hidden |
| 40 Breeder | 29 → 30 | hidden → **offered** | offered | offered |
| 55 gal | 19 → 20 | hidden → **offered** | offered | offered |
| 75 gal | 22 → 19 | hidden | offered → **hidden** | offered → **hidden** |
| 125 gal | 5 → 5 | hidden | hidden | hidden |

Confirmed in the real page (Chromium, every preset): option labels now read
"… 116 GPH • CANISTER • 21g–66g" and "… 300/303 GPH • … • 40g–70g".

Side effect: the gate's catalog-product tests pick the *first* product offered for 10 gal. That was
EHEIM 2213 (116 GPH canister); it is now Fluval C2 (119 GPH HOB). Both are adequate there; the
gate passes unchanged.

A user who already saved one of these filters for a tank now outside its range (e.g. AC70 on a
75 gal) keeps it: saved filters resolve by id and still count 300 GPH. Only new picks are affected.

---

## 4. Scoring unchanged

GPH values sent into the Phase 2C calculation: AC70 **300**, Fluval 307 **303**, EHEIM 2213
**116** — identical before and after.

Verified explicitly: the full `buildComputedState` output (`filtering`, `bioload`, all warnings)
for each of the 4 records on all 10 presets with the same stock was captured before the edit and
after it; the two outputs are **byte-identical**. The range fields are never read by
`assessFiltration`, bioload, warnings or validation (audit §9); a unit test also proves that
changing the range on a product leaves its filtration result unchanged.

---

## 5. Tests

New: `tests/unit/filter-catalog-batch-1.test.mjs` (7 tests)

- stored + loaded ranges/GPH for all four records (AC70 40–70/300 ×2, 307 40–70/303, 2213 21–66/116);
- both AC70 ids present, identical specs, both resolve through the loader;
- one record each for Fluval 307 and EHEIM 2213 (no accidental duplicates);
- picker: EHEIM offered for 29/40/55, not 5/10/15/20/75/125; AC70 (both ids) and 307 offered
  exactly for presets inside 40–70, plus 39/40/70/71 edge checks;
- each corrected product sends its unchanged GPH into Phase 2C (`gphTotal`, `biologicalGph`,
  `turnover = GPH / gallons`);
- range never enters scoring.

Against the old catalog the three range/picker tests fail and the GPH/scoring tests pass, as
intended.

Results: unit suite **119/119 pass**; Stocking Advisor production gate
(`npm run test:e2e:stocking-gate`) **95 passed, 27 skipped (desktop-only/mobile-only split), 0
failed** — 44 species, Stocking Load, filtration thresholds, filter scoring, powerhead handling,
water model, warning UI, quantity-preview fix and Phase 2G predation cases all green.

---

## 6. Rollout note

`js/gear-data.js` serves a returning visitor's `localStorage` copy of the catalog first and refreshes
it from the network in the background (`cache: 'no-store'`). For one page load after deploy a
returning visitor may still see the old ranges in the picker; scoring is unaffected either way
because GPH did not change.
