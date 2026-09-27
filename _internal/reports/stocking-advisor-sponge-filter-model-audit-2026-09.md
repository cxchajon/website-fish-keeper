# Stocking Advisor — sponge-filter model audit (2026-09)

Research / model-decision report only. **No catalog data, filtration scoring, thresholds,
`MIN_BIOLOGICAL_TURNOVER`, UI or saved-state code was changed.**
Base: `main` @ `dfe5b9c` (after the Tetra Whisper IQ 45 flow fix, #2220). Builds on
`stocking-advisor-filter-catalog-audit-2026-09.md` (catalog audit) and
`stocking-advisor-filtration-threshold-research-2026-09.md` (threshold research).

Evidence grades (same scale as the catalog audit):

| Grade | Meaning |
| --- | --- |
| **A** | Directly verified on the manufacturer page / manual. |
| **B** | Manufacturer or established distributor text read from **search-indexed** snippets (direct page fetches are blocked by this environment's egress proxy for every site tried: aquariumcoop.com, hygger-online.com, manuals.plus, swisstropicals.com, aquariumscience.org, americanaquariumproducts.com, globalseafood.org). |
| **C** | Secondary: marketplace listing titles, review sites, forums, manual mirrors. |
| **D** | Derived by this repo's code. |
| **E** | No source. |

**No source in this report is grade A.** Nothing needed for the recommendation depends on an
A-grade number, because the recommendation is to stop using a number nobody publishes.

---

## 1. Executive summary

- The runtime catalog (`assets/data/gearCatalog.json`, 41 records) has **8 air-driven records**:
  **7 sponge filters** (`type: "SPONGE"`) and **1 air-driven undergravel filter** (`type: "UGF"`).
  No other record is air-driven (the 4 `OTHER` records are Seachem Tidal / MarineLand Penguin HOBs).
- **0 of 8 have a manufacturer-published water-flow GPH.** All 8 stored GPH values
  (60, 120, 200, 80, 120, 60, 150, 150) are **UNSUPPORTED**. They were typed in by hand in two
  commits in October 2025 with no citation, no formula and no air-pump conversion (section 3).
- **Air-pump output (L/min of air) cannot be reliably converted to water GPH** without the
  airlift's geometry and operating point (tube diameter, lift, submergence, diffuser, sponge
  resistance/clogging). Engineering literature can predict airlift flow for a *specified* airlift;
  no ordinary user knows those inputs, and no sponge maker publishes them (sections 6–7).
- **Sponge makers rate by tank size**, never by water flow (AQUANEAT, hygger, Pawfly, Powkoo,
  Hikari, ATI Hydro-Sponge, Aquarium Co-Op). Only engineered airlift products (Swiss Tropicals
  Jetlifter/Superlifter) publish water flow, for their specific lifter.
- **The invented numbers decide the result today.** They are ~6× the rated gallons for half the
  records, so a catalog sponge only reads "Filter flow too low" once the tank is about **3×** the
  sponge's rating (the 10-gal sponges pass up to 30 gal; the 20-gal ones up to 60 gal). A custom
  sponge left without GPH reads **"No filter added"**. Replace the invented number with a
  plausible real one (e.g. 30 GPH) and the same sponge in its own rated tank flips to
  **very-low** (section 8).
- **Recommended model: F (hybrid)** — sponge adequacy is a *manufacturer tank-rating* check, not
  turnover. Catalog sponges carry `manufacturerMaxGallons`; custom sponges ask "What size tank is
  it rated for?"; an optional, clearly labelled measured-GPH override may exist for advanced users
  but is never required and never defaulted. Multiple sponges combine ratings (labelled as a
  combined rating); sponge + powered filter combine by *coverage*; powerheads remain circulation.
- **The UGF does not fit the sponge model cleanly**; recommendation is to treat it as
  "rated for tank size (plate coverage)" using the same rating check, but flagged as a separate
  type — or remove it from the catalog (section 11).
- **Enough evidence exists to implement the correction** (section 18), provided the code change
  lands *before or with* the data change; removing GPH from data alone would silently turn saved
  sponges into custom filters carrying the old invented GPH, or into "No filter added" (section 15).
- Sponge filtration contributes **only** to filtration adequacy. It never reduces Stocking Load,
  never raises capacity, never gives a bonus (section 12 of this report restates the separation).

---

## 2. Complete air-driven catalog inventory

Source file: `assets/data/gearCatalog.json`. "Mfr rating" is the manufacturer / listing tank
rating; stored min/max are the GPH-bucket values from the deleted `inferRangeFromGph`
(catalog audit §3), not ratings.

| # | id | Brand | Product (short) | Type | Stored `gphRated` | Stored min–max gal | Mfr rating | Rating source (grade) | Mfr water-flow GPH published? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `aquaneat-sponge-10` | AQUANEAT | Single sponge (up to 10 G) — Amazon B01N7Q0IPR | SPONGE | 60 | 0–20 | ≤ 10 gal; small model 2.0" D × 4.75" H | product title / listing (C) | **No** |
| 2 | `aquaneat-sponge-20` | AQUANEAT | Bio sponge "Middle up to 20 Gal" | SPONGE | 120 | 0–20 | ≤ 20 gal | product title (C) | **No** |
| 3 | `aquaneat-sponge-60` | AQUANEAT | Bio sponge "Large up to 60 Gal" (model SF-A004) | SPONGE | 200 | 20–40 | 40–60 gal; ~4.5" D × 8" H | manual mirror manuals.plus/asin/B071HVZVMP (C, search-indexed) | **No** |
| 4 | `hygger-double-sponge-s` | Hygger | Double sponge (S) | SPONGE | 80 | 0–20 | 10–40 gal | hygger listing / retailers (C) | **No** |
| 5 | `hygger-double-sponge-m` | Hygger | Double sponge (M) | SPONGE | 120 | 0–20 | 15–55 gal | hygger listing / retailers (C) | **No** |
| 6 | `pawfly-sponge-10` | Pawfly | Nano bio sponge (up to 10 gal) | SPONGE | 60 | 0–20 | ≤ 10 gal ("5–10 gallon"); 2" D × 4.8" H | product title / listing (C) | **No** |
| 7 | `powkoo-dual-sponge-40` | Powkoo | Dual sponge "(20–55G)" — Amazon B07KXDRFXP | SPONGE | 150 | 20–40 | 20–55 gal (name) / 15–55 gal (other Powkoo listings) | listing (C) | **No** |
| 8 | `penn-plax-ugf-20-29` | Penn-Plax | Clear-Free Premium UGF, 20 L–29 gal, two 14" × 11.1" plates, 2 lift tubes | UGF | 150 | 20–40 | 20 L–29 gal (plate footprint 28" × 11.1") | product title / retailer copy (C) | **No** |

Counts: **7 sponge**, **1 other air-driven (UGF)**, **0 verified water-flow GPH**,
**8 unsupported GPH**. None of these products ships with an air pump (all say "air pump not
included" or sell it as a separate kit), so no air-pump output is tied to any record either.

---

## 3. Origin of the current GPH values

Git history (unshallowed for this audit) shows two hand-authored insertions:

| Commit | Date | What happened | Records |
| --- | --- | --- | --- |
| `5a00e35d` "Finalize filter catalog handoff" | 2025-10-12 | First `data/filters.json` hand-written with `rated_gph`, tank bands and marketing notes ("Gentle air-driven sponge that pairs with small nano air pumps."). The activity log for that commit says "Real filter products + **manual GPH**". No source field, no citation. | `aquaneat-sponge-10` = 60, `powkoo-dual-sponge-40` = 150 |
| `22d39d88` (#1034) "integrated full site-wide filter catalog (53 total)" | 2025-10-28 | `tools/build_filter_catalog.py` added. Its input `audit_out/filters.csv` (#1033) lists the other six air-driven products with **`gphRated` = 0** (they came from the affiliate CSVs, which carry no flow). The script replaces 0 with the hard-coded `RATED_GPH_OVERRIDES` table. No comment, citation or formula accompanies the table. | `aquaneat-sponge-20` = 120, `aquaneat-sponge-60` = 200, `hygger-double-sponge-s` = 80, `hygger-double-sponge-m` = 120, `pawfly-sponge-10` = 60, `penn-plax-ugf-20-29` = 150 (the table also re-states 60 and 150 for the two above) |
| `d84030ac` (#1046) → `gearCatalog.json` (#1048) | 2025-10-28 | `scripts/make-filter-catalog.mjs` copied those GPH values into the runtime catalog and derived `minGallons`/`maxGallons` from GPH (`inferRangeFromGph`). Script deleted in #1091. | all 8 |

Checks performed:

- **Manually assigned?** Yes — both insertions are literal numbers typed into source.
- **Calculated from tank size?** Not by any stated or reproducible rule. Four values equal
  exactly 6 × the rated gallons (10 → 60, 10 → 60, 20 → 120, and hygger M's CSV band 10–20 → 120),
  which *looks like* a 6×-turnover guess, but the other four break it (hygger S 80 for a 10–40 gal
  sponge; AQUANEAT Large 200 for 40–60 gal ≈ 3.3×; Powkoo 150 for 20–55 gal ≈ 2.7×; UGF 150 for
  29 gal ≈ 5.2×). So there is no derivation to reproduce.
- **Air-pump LPM converted?** No. No record, CSV, script or commit mentions L/min, air pump model
  or any air-to-water factor.
- **Source ever cited?** No. The affiliate CSVs (`data/gear_filters*.csv`) have no GPH column
  values for these products; `audit_out/filters.csv` had 0; the override table has no comments.
- **Correction to earlier reports:** the threshold research (§7) and `FILTRATION_MODEL.md` say the
  sponge GPH values "come from Amazon listing copy". The repo trail does not support that — no
  listing found in this audit publishes those numbers; they were entered by hand.

Classification (per requested scale):

| id | Value | Classification | Reason |
| --- | --- | --- | --- |
| `aquaneat-sponge-10` | 60 | **UNSUPPORTED** | hand-entered 2025-10-12, no source, maker publishes no flow |
| `aquaneat-sponge-20` | 120 | **UNSUPPORTED** | override table, no source |
| `aquaneat-sponge-60` | 200 | **UNSUPPORTED** | override table, no source |
| `hygger-double-sponge-s` | 80 | **UNSUPPORTED** | override table, no source |
| `hygger-double-sponge-m` | 120 | **UNSUPPORTED** | override table, no source |
| `pawfly-sponge-10` | 60 | **UNSUPPORTED** | override table, no source |
| `powkoo-dual-sponge-40` | 150 | **UNSUPPORTED** | hand-entered 2025-10-12, no source |
| `penn-plax-ugf-20-29` | 150 | **UNSUPPORTED** | override table, no source |

VERIFIED 0 · DERIVED 0 · ASSUMED 0 (none has a documented assumption; "assumed" would require a
stated rule) · UNSUPPORTED 8.

Also noted: the gear page writes the product's GPH to `sessionStorage['ttg:rated_gph']`
(`assets/js/gear.v2.js`), but **nothing reads that key** — it is dead data, not a second path
into scoring.

---

## 4. Manufacturer findings

| Maker (catalog) | Rates by | Water-flow GPH? | Air requirement published? | URL(s) (grade) |
| --- | --- | --- | --- | --- |
| AQUANEAT | Tank size ("up to 10 / 20 / 60 gal"; Large 40–60) + physical size | No | No (air pump sold separately) | https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B071HVZVMP ; manual mirror https://manuals.plus/asin/B071HVZVMP (C; fetch blocked, search-indexed) |
| hygger | Tank-size range (S 10–40, M 15–55) + dimensions; "water flow is adjustable, small and slow" | No | No | https://www.hygger-online.com/product/fish-tank-water-filter/ (C; fetch blocked) ; https://www.amazon.com/Hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RKT6QPV (C) |
| Pawfly | Tank size (≤10 gal / "5–10 gal") + 2" × 4.8" | No | Separate pump kit rated "3–10 gal" | https://www.amazon.com/clp/B09BNCRLZY ; https://www.amazon.com/Pawfly-Aquarium-Control-Airline-Accessories/dp/B0C5R4HWXK (C) |
| Powkoo | Tank size (5–20, 10–20, 15–55, "up to 60" depending on listing) + sponge PPI | No (search result explicitly: no GPH/LPM) | No | https://www.amazon.com/Powkoo-Double-Biochemical-Aquarium-Gallons-x/dp/B01N6MJYWC (C) |
| Penn-Plax (UGF) | Tank footprint (20 L–29 gal; plates 28" × 11.1"; lift tubes 13–16") | No | "Air pump not included"; air stones + 2 lift tubes | https://www.amazon.com/Penn-Plax-Premium-Gravel-Filter/dp/B005Q4900Q ; https://www.marineandreef.com/Penn_Plax_Premium_Undergravel_Filter_20L_29_Gallon_p/RPE39082.htm (C) |

Reference makers not in the catalog:

| Maker | Rates by | Water-flow GPH? | URL (grade) |
| --- | --- | --- | --- |
| Hikari Bacto-Surge | Tank size (Mini ≤10, Small ≤40, Large ≤75, XL ≤125) | No | https://westlakeaquatics.com/products/hikari-sponge-filter-xl ; https://www.rainbowriveraquatics.com/product-page/hikari-bacto-surge-sponge-filter-kit-4-up-to-75-gallons (B/C) |
| ATI Hydro-Sponge | Tank size (Mini ≤7 … #5 ≤125); 1" lift tube; "longer lift tube … better draw" | No | https://kensfish.com/products/ati-hydro-sponge-pro-filter-4 (C) |
| Aquarium Co-Op | Tank size as a *minimum* ("Nano 5 gal and up … Large 40 gal and up"); ≥3 W air pump for the coarse sponge | No | https://www.aquariumcoop.com/blogs/faqs/sponge-filter-sizes (B) |
| Swiss Tropicals (engineered airlifts) | Lifter size; **publishes water flow**: Jetlifter 25 mm 300–500 L/h (75–125 GPH), Superlifter 32 mm 1500–2000 L/h, "more for longer models but requiring more air pressure" | **Yes, per lifter** | https://www.swisstropicals.com/faq/ ; https://www.swisstropicals.com/library/swisstropicals-poret-foam/ (B, fetch blocked) |

Conclusion: **no catalog sponge maker publishes water flow; all rate by tank size.** The one maker
that does publish airlift flow ties it to a specific engineered lifter and warns that it varies
with length and air pressure — which proves the point that the number belongs to the airlift, not
the sponge.

---

## 5. Hobby-source findings

| Source | Sizing basis | GPH assigned? | Grade |
| --- | --- | --- | --- |
| Aquarium Co-Op sizes FAQ | Rated tank size (as a minimum: "20 gallons and up") | No | B |
| Aquarium Co-Op Easy Flow blog / forum | Flow improved by lift-tube shape, even bubbles, stacking sponges on one line; pump ≥3 W | No numeric flow | B/C |
| aquariumscience.org 8.4 | Most sponges use a simple hole producing very large bubbles; putting a powerhead on the lift "takes the flow rate up" | No | B |
| Retailer blogs (tropicaltreasureswyo, expertaquarist) | "Match the sponge filter's rating to your tank volume … when in doubt, size up" | No | C |
| fishlore / MonsterFishKeepers / Aquarium Advice threads on "GPH of a sponge filter" | "The actual GPH is ALL on the air pump"; measure with a jug and timer | Measured anecdotes only | C |
| pickcomfort.com | "typically 20–80 GPH depending on filter size, air pump strength and sponge porosity" | Unsourced range | C (weak) |
| Air-pump guides (aquariumia) | Pump sized by tank: ~1–2 L/min < 20 gal, 2–3 L/min 30–50 gal | Air, not water | C |

Findings:

- Established sources size sponges by **rated aquarium size** (sometimes framed as "size up"),
  secondarily by sponge/physical size, and discuss air pumps only as "strong enough to drive it".
- **Multiple sponges** are common practice for larger tanks and breeding racks, but no source
  gives a formal additive rule.
- **No credible hobby source assigns a reliable water-throughput GPH to ordinary sponge
  filters.** The only numbers are measurement anecdotes and one unsourced 20–80 GPH range.

---

## 6. Airlift engineering findings

Literature (search-indexed abstracts; B):

- Loyless & Malone (1998), *Aquacultural Engineering* 18:117–133 — empirical equations for a
  **specific** 5.08 cm (2") airlift, 91.4 cm submergence, 15.2 cm lift, 28–142 L/min air.
  https://www.sciencedirect.com/science/article/abs/pii/S0144860998000259
- Parker & Suttle (1987), "Design of airlift pumps for water circulation and aeration in
  aquaculture", *Aquacultural Engineering* — flow rises with pipe length, diameter and submergence
  ratio. https://www.sciencedirect.com/science/article/abs/pii/0144860987900082
- Global Seafood Alliance, "Airlifts combine pumping, water treatment in recirculation systems" —
  keep submergence > ~80 %; very restricted flow below that; large-diameter pipes lose far more
  flow with added lift than small ones.
  https://www.globalseafood.org/advocate/airlifts-combine-pumping-water-treatment-recirculation-systems/
- "Effects of tube diameter and submergence ratio on bubble pattern and performance of air-lift
  pump" (Int. J. Multiphase Flow, 2013) — efficiency depends on flow regime (bubbly / slug /
  churn); bubbly flow is inefficient except at high submergence.
  https://www.sciencedirect.com/science/article/abs/pii/S0301932213001420
- Univ. of Guelph thesis "Improving the airlift pump prediction model for aquaculture
  applications" — prediction models exist but need calibration.
  https://atrium.lib.uoguelph.ca/server/api/core/bitstreams/1f0381c2-4fa6-4d2d-a888-4b142126010f/content
- Wikipedia, Airlift pump (overview). https://en.wikipedia.org/wiki/Airlift_pump

What water flow depends on:

| Variable | Effect | Known to a normal user? |
| --- | --- | --- |
| Air volume (L/min actually delivered at depth) | Water flow rises with air, **peaks, then falls** | Pump label only (at zero back-pressure); unknown after splitters, valves, depth |
| Bubble size / diffuser | Fine bubbles (air stone) vs coarse hole change flow regime and efficiency | No |
| Uplift-tube diameter | Larger → more flow potential, but more sensitive to lift | No (not published for catalog sponges) |
| Uplift-tube height above water / lift | More lift → less flow | No |
| Water depth / submergence ratio | Higher submergence → much more flow; < ~80 % → very restricted | Tank height only, roughly |
| Sponge resistance, PPI, clogging | Adds head loss; flow falls between cleanings | No; changes weekly |
| Filter design (single vs double, corner, curved outlet) | Changes losses | No |

---

## 7. Why air LPM does or does not translate cleanly to water GPH

- It is **technically calculable** for a *characterised* airlift (known diameter, submergence,
  lift, diffuser, operating point) using empirical models like Loyless & Malone — and even those
  are fitted per geometry and not transferable to a 1/2"–1" hobby lift tube with a coarse hole.
- For an ordinary sponge filter, **none of the geometry is published**, air delivered is not the
  pump's label figure (depth, splitting, valves, pump ageing), and sponge resistance drifts with
  clogging. The only maker-published ratio found (~4:1 water:air, Swiss Tropicals' optimised
  lifter) is a best case for a different design.
- Illustration of the uncertainty: a 1 L/min pump at 4:1 → ~63 GPH; the same pump through a
  coarse-hole lift at, say, 1:1 → ~16 GPH. Both are plausible; the advisor cannot tell which.
- **Conclusion: no conversion formula should be created.** Air-pump LPM is not a reliable proxy
  for water GPH, and asking users for tube geometry is not a realistic input (**practical user
  input ≠ technical calculability**).

---

## 8. Current scoring impact (Phase 2C, today)

Trace (`js/stocking-advisor/filtration/controller.js` → `js/stocking-advisor/filtration/math.js`
→ `js/logic/compute.legacy.js`):

1. Catalog load (`js/gear-data.js`): records with GPH ≤ 0 are **dropped**; min/max decide which
   products are offered for the chosen tank (`filterGearByTank`).
2. Add Selected → `createProductFilter` copies `gphRated` into `gph`; a product with no GPH
   returns `null` (cannot be added).
3. `assessFiltration`: every non-powerhead device is "biological"; biological turnover = Σ GPH ÷
   nominal gallons; `< MIN_BIOLOGICAL_TURNOVER` (2) → `very-low` ("Filter flow too low", danger);
   no devices with GPH > 0 → `none` ("No filter added"); powerheads only → `circulation-only`.
   `hasSponge` is computed but only read by a unit test.
4. Stocking Load is independent (`capacityAdjustment: 0`).

Every air-driven record × every preset tank (turnover, status; "hidden" = not offered in the
dropdown for that tank, but still reachable via saved state, the gear page `?filter=` link, or the
whole-catalog fallback):

| id | GPH | 5 gal | 10 gal | 15 gal | 20 gal | 29 gal | 40 gal | 55 gal | 75 gal | 125 gal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aquaneat-sponge-10` | 60 | 12.0× OK | 6.0× OK | 4.0× OK | 3.0× OK | 2.1× OK (hidden) | 1.5× LOW (hidden) | 1.1× LOW (hidden) | 0.8× LOW (hidden) | 0.5× LOW (hidden) |
| `aquaneat-sponge-20` | 120 | 24.0× OK | 12.0× OK | 8.0× OK | 6.0× OK | 4.1× OK (hidden) | 3.0× OK (hidden) | 2.2× OK (hidden) | 1.6× LOW (hidden) | 1.0× LOW (hidden) |
| `aquaneat-sponge-60` | 200 | 40.0× OK (hidden) | 20.0× OK (hidden) | 13.3× OK (hidden) | 10.0× OK | 6.9× OK | 5.0× OK | 3.6× OK (hidden) | 2.7× OK (hidden) | 1.6× LOW (hidden) |
| `hygger-double-sponge-s` | 80 | 16.0× OK | 8.0× OK | 5.3× OK | 4.0× OK | 2.8× OK (hidden) | 2.0× OK (hidden) | 1.5× LOW (hidden) | 1.1× LOW (hidden) | 0.6× LOW (hidden) |
| `hygger-double-sponge-m` | 120 | 24.0× OK | 12.0× OK | 8.0× OK | 6.0× OK | 4.1× OK (hidden) | 3.0× OK (hidden) | 2.2× OK (hidden) | 1.6× LOW (hidden) | 1.0× LOW (hidden) |
| `pawfly-sponge-10` | 60 | 12.0× OK | 6.0× OK | 4.0× OK | 3.0× OK | 2.1× OK (hidden) | 1.5× LOW (hidden) | 1.1× LOW (hidden) | 0.8× LOW (hidden) | 0.5× LOW (hidden) |
| `powkoo-dual-sponge-40` | 150 | 30.0× OK (hidden) | 15.0× OK (hidden) | 10.0× OK (hidden) | 7.5× OK | 5.2× OK | 3.8× OK | 2.7× OK (hidden) | 2.0× OK (hidden) | 1.2× LOW (hidden) |
| `penn-plax-ugf-20-29` | 150 | 30.0× OK (hidden) | 15.0× OK (hidden) | 10.0× OK (hidden) | 7.5× OK | 5.2× OK | 3.8× OK | 2.7× OK (hidden) | 2.0× OK (hidden) | 1.2× LOW (hidden) |

(Produced by running the real `assessFiltration` and `filterGearByTank`; OK = `adequate`,
LOW = `very-low`.)

How much the invented number matters:

- **adequate outcomes beyond the manufacturer rating:** a 10-gal sponge scores adequate in 20 and
  29 gal (2–3× its rating); the 20-gal AQUANEAT Middle scores adequate up to 55 gal; the UGF
  (29-gal plates) and Powkoo (≤55) score adequate at 75 gal. The break-even tank is simply
  GPH ÷ 2 = 30, 60, 100, 40, 60, 30, 75, 75 gal — a property of the invented number, not of the
  product.
- **very-low outcomes:** only when the tank exceeds that break-even, e.g. `aquaneat-sponge-10`
  at 40 gal. Never inside a manufacturer rating — so the numbers err generous, not harsh.
- **no-filter outcome:** a *custom* sponge cannot be added without a GPH (`canAddManual`), and a
  saved/custom sponge with 0 GPH is dropped → "No filter added" even though a sponge is running.
- **Sensitivity:** with a plausible real airlift flow of 30 GPH (inside the 20–80 GPH hobby
  anecdote range), a sponge in its own rated 20-gal tank becomes 1.5× → **very-low**; the 40-gal
  sponge on a 29-gal tank becomes 1.0× → very-low. The status is decided entirely by a number no
  one measured.

---

## 9. Model A–F comparison

| Model | Idea | Evidence support | Pros | Cons | Verdict |
| --- | --- | --- | --- | --- | --- |
| **A — keep GPH** | Keep an estimated GPH per sponge and score turnover | **None**: no maker GPH, no conversion, current numbers unsourced | No code change | Outcome decided by an invented number; either flatters (today) or fails sponges in their own rated tanks (with realistic numbers); shows a false turnover to users | **Reject** |
| **B — manufacturer tank rating** | Store `manufacturerMaxGallons` (+ min); adequate if a sponge is rated ≥ tank | Strong: every maker rates this way; hobby sources size this way | Uses a number printed on the box; simple; honest | Single-sponge only; ignores multiple sponges (case C, F); ratings are marketing-grade and inconsistent between brands (hygger S "10–40" vs AQUANEAT nano "≤10") | **Core of the recommendation** |
| **C — sponge capacity units** | Each sponge's rating = capacity; sum across sponges | Moderate: sponge capacity scales with colonised surface area and each sponge brings its own airlift; common practice uses multiple sponges on large tanks. No maker states ratings are additive | Handles C and F naturally; no invented coefficient | Can be gamed with many tiny sponges (five 10-gal sponges "cover" 50 gal); additivity is an assumption | **Accept, with a distinct "combined rating" label** |
| **D — user air-pump LPM** | Ask LPM (+ outlets) and convert | **None** for conversion (section 7) | Users can often read LPM off the pump | Needs an invented factor → Model A with extra steps; outlet splitting, depth and valves make it worse; adds a field most beginners can't answer | **Reject** (at most an informational "air pump connected?" checkbox, not scored) |
| **E — user measured GPH** | Advanced users enter jug-and-timer flow | Real measurement is valid data | Honest when present; engages advanced users | Few users measure; varies with clogging; should never be required; turnover threshold for a sponge is itself not validated | **Accept only as optional override**, labelled "measured" |
| **F — hybrid** | Catalog: B/C by rating. Custom: ask rated tank size. Optional measured-GPH override (E) | Combines the supported parts | Simplest accurate input; no invented numbers; supports multiples and mixes | More states to design; a small migration | **Recommended** |

---

## 10. Multiple-filter behaviour

Proposed rule set (for review — not implemented). Each biological device contributes
**coverage in gallons**:

- Sponge (catalog or custom): coverage = `manufacturerMaxGallons` (the rating).
- Powered filter (HOB/canister/internal): coverage = `GPH ÷ MIN_BIOLOGICAL_TURNOVER` (i.e. the
  tank size at which it would just meet today's 2× floor). This reuses the existing threshold;
  it does **not** change it.
- Sponge with an optional measured GPH: evaluate it like a powered filter using that measured
  GPH, labelled "measured".
- Powerhead / wavemaker: coverage 0 (circulation only), unchanged.

Status = adequate when Σ coverage ≥ tank gallons; otherwise "under-rated for this tank" (the sponge
equivalent of very-low, worded as a rating, not a flow).

| Situation | Treatment | Label |
| --- | --- | --- |
| Two identical sponges | Additive (two sponges = two media volumes + two airlifts) | "Combined sponge rating 20 gal (2 sponges)" |
| Two different sponges | Additive | as above |
| One sponge + HOB | HOB judged on its GPH; sponge adds rated coverage | "HOB meets 2× on its own" or "Combined coverage" |
| Sponge + canister | Same as HOB | same |
| Sponge + sump | Sump is outside the catalog (custom, GPH); same coverage sum | same |
| Sponge + powerhead | Powerhead contributes nothing to filtration; sponge rating decides | "Powerhead adds circulation only" |

Additive vs partially additive vs redundancy:

- **Fully additive** is the only option without an invented coefficient, and has a physical
  argument (each sponge doubles colonised surface and has its own airlift). Weakness: no maker
  states it, and small-sponge stacking can overstate capacity.
- **Partially additive** (e.g. largest + 50 % of the rest) has **no source** for any coefficient;
  reject.
- **Redundancy only** (largest single sponge decides) is the most conservative but contradicts
  common practice (two 10-gal sponges on a 20-gal breeder is ordinary and fine).
- Recommendation: **additive, but surfaced with a "combined" label** so the result is transparent,
  and optionally a soft note when any single sponge is rated for less than half the tank
  ("several small sponges — make sure each has good air flow"). Never a stocking bonus.

---

## 11. Air-driven undergravel filter findings (`penn-plax-ugf-20-29`)

- Stored GPH 150 is unsupported (section 3). Penn-Plax publishes **no flow**; the product is rated
  by tank footprint (20 L / 29 gal; two 14" × 11.1" plates = 28" × 11.1"; 2 lift tubes; air pump
  not included). The affiliate CSV even says "pair with powerhead **or** airlift" — the drive is
  the user's choice, so a flow figure cannot belong to the product.
- Airlift flow through a UGF has the same unknowns as a sponge plus the gravel bed's resistance.
- Filtration capacity is tied to **plate/substrate area and gravel depth** more than raw GPH.
  Hobby guidance for powerhead-driven UGFs quotes ~60–90 GPH per ft² of plate (C, single source);
  air-driven figures ("50–120 GPH per 10 gal") are unsourced (C).
- Fit: the same *tank-rating check* works (rated for 20 L–29 gal ↔ covers the footprint), but it
  is a **different type**: coverage depends on the plates covering the tank bottom, not on a
  volume rating, and a UGF can be powerhead-driven.
- Recommendation: keep `type: "UGF"`, `gphRated: null`, use `manufacturerMaxGallons` (29) with the
  same rating check, and do **not** combine it additively with sponges by default (it is one
  whole-bottom filter; two sets of plates cannot fit one tank). Offer it only for tanks it
  physically fits (20 L and 29 gal). Alternatively drop the record — it is the only UGF, it is a
  legacy technology, and the custom-filter UI has no UGF option at all today.

---

## 12. Recommended future sponge model

**Model F (hybrid)**:

1. Sponge filters have **no GPH and no turnover** (flow = not applicable).
2. Adequacy = rating check: Σ coverage (section 10) ≥ tank gallons.
3. Catalog sponges carry `manufacturerMaxGallons` (and `manufacturerMinGallons` where the maker
   gives one, used only for the dropdown).
4. Custom sponges ask for the rated tank size.
5. Optional advanced override: a *measured* water-flow GPH, clearly labelled; never required,
   never pre-filled, never inferred.
6. Separation is kept: **Stocking Load** (livestock ÷ tank capacity — sponge never touches it),
   **Filtration adequacy** (this model), **Circulation** (powerheads + powered-filter flow, shown,
   not scored; sponges add none). A sponge must never reduce Stocking Load, increase livestock
   capacity or give a stocking bonus.

Status wording proposal (UI not built): "Sponge filter rated for up to 20 gal on a 20-gal tank —
sponge filters are sized by tank, so water flow isn't estimated."

---

## 13. Recommended user input

| Question | Can a beginner answer? | Verdict |
| --- | --- | --- |
| "What is your sponge filter's GPH?" | No — not on the box, not on the maker's page; they will guess or copy an unrelated number | Remove |
| "What size aquarium is your sponge filter rated for?" | Yes — printed on the box/listing title ("up to 20 gal") | **Use** |
| "What is your air pump's L/min?" | Sometimes, but it cannot be scored | Do not ask |
| "Measured flow (optional, advanced)" | Few, but valid when given | Optional, collapsed |

- **Catalog sponge:** no input — the rating comes from the catalog (count via Add Selected; adding
  the same product twice should be allowed for sponges, which `canAddProduct` currently blocks).
- **Custom sponge:** type = Sponge switches the numeric field from "GPH" to "Rated for up to __ gal"
  (placeholder "e.g. 20"), with a hint "printed on the box". Optional "I measured the flow" link.

---

## 14. Proposed catalog schema (minimum)

Keep it small and backward compatible:

```jsonc
{
  "id": "aquaneat-sponge-20",            // unchanged
  "brand": "AQUANEAT",
  "name": "AQUANEAT … (Middle up to 20Gal)",
  "type": "SPONGE",                      // SPONGE | UGF for air-driven
  "gphRated": null,                      // flow not applicable
  "capacityMethod": "manufacturer_rating", // vs "flow" for powered filters (default when absent)
  "manufacturerMinGallons": null,        // only if the maker states one
  "manufacturerMaxGallons": 20,
  "ratingSource": "<url>"                // optional but recommended; grade kept in the report
}
```

Not needed now: `flowMeasurementType` (implied by `capacityMethod`), `airPumpRequirementLpm`
(no catalog maker publishes one; add only if a future product does, display-only).

Loader implications (future): `js/gear-data.js` currently **drops records with GPH ≤ 0**; it must
keep `capacityMethod: "manufacturer_rating"` records. `minGallons`/`maxGallons` for the dropdown
should come from the manufacturer fields.

Proposed data (from section 2, C-grade, to confirm at implementation):

| id | manufacturerMin | manufacturerMax |
| --- | --- | --- |
| `aquaneat-sponge-10` | — | 10 |
| `aquaneat-sponge-20` | — | 20 |
| `aquaneat-sponge-60` | 40 | 60 |
| `hygger-double-sponge-s` | 10 | 40 |
| `hygger-double-sponge-m` | 15 | 55 |
| `pawfly-sponge-10` | — (5 on some listings) | 10 |
| `powkoo-dual-sponge-40` | 20 (15 on other listings) | 55 |
| `penn-plax-ugf-20-29` (UGF) | 20 | 29 |

---

## 15. Saved-state migration considerations

Current behaviour (traced in code):

| Store | Shape | Today on restore | Risk if sponge GPH is removed from data only |
| --- | --- | --- | --- |
| `localStorage['ttg.stocking.filters.v1']` | `[{id, type, rated_gph}]` | `hydrateFromAppState`: id found in catalog → rebuilt from **catalog** GPH (stored GPH ignored); id not found → restored as a **custom** filter with the **stored** GPH; `rated_gph` 0 → dropped | If `gphRated` becomes null, `gear-data.js` drops the record → id not found → the old invented GPH is **silently re-labelled as a user-entered custom GPH** (the exact thing to avoid). If the record is kept but `createProductFilter` still requires GPH → sponge vanishes → "No filter added". |
| Custom sponges `{id:"manual-…", type:"SPONGE", rated_gph:N}` | user-typed GPH | Restored as custom with N | No rated size exists; N may itself be a copied marketing number |
| `localStorage['ttg.gear.catalog.v1']` (catalog cache) | old catalog | Shown for one load, refreshed in background | New code + stale cache sees old sponge GPH |
| `sessionStorage['ttg:filter_id' / 'ttg:filter_type' / 'ttg:rated_gph']` (gear page) | id/type/GPH | Only the id is used; `ttg:rated_gph` has no reader | Harmless if new code ignores GPH for sponges |

Proposed strategy:

1. **Code before data.** Ship model F logic that decides by `type`/`capacityMethod`: any
   `SPONGE` (and `UGF`) ignores `gphRated` wherever it comes from (catalog, stale cache, saved
   state, session). Then remove the GPH values. Stale caches become harmless.
2. **Keep all 8 ids.** Catalog sponges re-hydrate from the catalog rating; nothing old is trusted.
3. **Saved-state v2.** Read `v1`; write `ttg.stocking.filters.v2` with
   `{id, type, source, ratedMaxGallons?, measuredGph?}`. Migration of `v1` entries:
   - catalog sponge id → catalog rating (drop stored GPH);
   - unknown id or custom `SPONGE` → restore as **"Sponge filter — rating needed"**: kept in the
     list, not scored as adequate or low, with an inline prompt for the rated size. The old GPH is
     **not** converted to gallons and **not** promoted to `measuredGph`; at most shown once as
     "previously entered 120 GPH (not used)".
   - powered filters → unchanged.
4. **Unknown-rating sponge scoring**: status "Sponge filter added — enter its rated tank size to
   check it", tone neutral/warn, never "No filter added" and never "adequate".
5. **Loader**: stop dropping `capacityMethod: "manufacturer_rating"` records with null GPH; bump
   catalog cache key (`v2`) or rely on step 1.
6. Tests: unit tests for v1→v2 migration (catalog sponge, custom sponge, unknown id, powered),
   stale-cache sponge with GPH, and "sponge never changes Stocking Load".

---

## 16. Simulation results (step 13)

Assumptions: sponge ratings as stated; Model A uses today's dominant pattern (GPH = 6 × rating)
and, for sensitivity, a realistic-but-unknown 30 GPH per sponge; "today custom" = a custom sponge
entered without GPH (the honest entry today); G uses a 20-gal-rated sponge + 150 GPH HOB; H a
20-gal-rated sponge + 400 GPH powerhead. Model D cannot classify without an invented factor
(= Model A). Model E = user-measured GPH, so it equals whatever is measured; with no measurement it
falls back to F.

| Case | Tank | Setup | Today (catalog-style GPH, A @ 6×) | A @ 30 GPH/sponge | Today, custom sponge with no GPH | B (single rating) | C (additive ratings) | **F (coverage)** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 10 | 1 × 10-gal sponge | 6.0× adequate | 3.0× adequate | No filter added | rated ✔ | adequate | **10/10 → adequate** |
| B | 20 | 1 × 20-gal sponge | 6.0× adequate | 1.5× very-low | No filter added | rated ✔ | adequate | **20/20 → adequate** |
| C | 20 | 2 × 10-gal sponges | 6.0× adequate | 3.0× adequate | No filter added | under-rated ✘ | adequate | **20/20 → adequate (combined)** |
| D | 29 | 1 × 40-gal sponge | 8.3× adequate | 1.0× very-low | No filter added | rated ✔ | adequate | **40/29 → adequate** |
| E | 55 | 1 × 40-gal sponge | 4.4× adequate | 0.5× very-low | No filter added | under-rated ✘ | under-rated | **40/55 → under-rated** |
| F | 55 | 2 × 40-gal sponges | 8.7× adequate | 1.1× very-low | No filter added | under-rated ✘ | adequate | **80/55 → adequate (combined)** |
| G | 29 | 1 × 20-gal sponge + 150 GPH HOB | 9.3× adequate | 6.2× adequate | 5.2× adequate (HOB alone) | under-rated ✘ (sponge alone) | under-rated (sponge alone) | **20 + 75 = 95/29 → adequate (HOB meets 2× alone)** |
| H | 29 | 1 × 20-gal sponge + powerhead | 4.1× adequate | 1.0× very-low | circulation-only ("No biological filter") | under-rated ✘ | under-rated | **20/29 → under-rated; powerhead = circulation only** |

Reading:

- Model A's answer flips between "adequate" and "very-low" in 6 of 8 cases depending only on the
  assumed GPH — it is not a model, it is the assumption.
- Today, an honest custom sponge produces "No filter added" or "No biological filter" — wrong.
- Model B wrongly fails C and F (ordinary multi-sponge setups).
- Model F flags only E and H — the two cases where the sponge really is under its maker's rating
  and nothing else carries the tank. That matches hobby sizing advice.

---

## 17. Uncertainties

- All manufacturer ratings are grade B/C (search-indexed; direct fetches blocked). Several
  products have conflicting ratings across listings (Powkoo 15–55 vs 20–55; Pawfly 5–10 vs ≤10).
- Manufacturer ratings are themselves marketing figures, inconsistent across brands (a hygger S
  "10–40" vs a same-sized AQUANEAT nano "≤10"). Model F inherits that, but at least uses the
  number on the box rather than one invented here.
- Additivity of sponge ratings is an assumption (physically argued, not published).
- The powered-filter coverage `GPH ÷ 2` reuses the current threshold as an equivalence; it is a
  modelling choice and inherits the threshold's own weak evidence (threshold research).
- Aquarium Co-Op phrases sizes as minimums ("20 gal and up"), unlike most makers' maximums; a
  Co-Op-style custom entry may need "recommended tank size" wording.
- The earlier reports' claim that sponge GPH came from "listing copy" is contradicted by the git
  trail (hand-entered); the exact intent of the author is unknowable.
- UGF: the only flow-per-area guidance is a single forum-grade source.

---

## 18. Recommended implementation steps (not started)

1. **Decision review** of this report (model F, additive-with-label, coverage rule, UGF choice).
2. **Code (no data change yet):** in `math.js`, give `normalizeFilter` a `capacityMethod` /
   `ratedMaxGallons` path; sponges/UGF ignore GPH; implement coverage; add an
   "unknown rating" level. `gear-data.js`: keep null-GPH rating records. Controller: allow
   repeat-adding sponges; custom field switches to rated gallons for Sponge; saved-state v2
   migration. `compute.legacy.js`: new warning copy for "under-rated". Unit tests.
3. **Data batch:** set `gphRated: null`, `capacityMethod: "manufacturer_rating"`,
   `manufacturerMin/MaxGallons` for the 7 sponges (+ UGF decision), with source URLs; derive
   `minGallons`/`maxGallons` for the dropdown from those fields. Keep ids.
4. **Docs:** correct `FILTRATION_MODEL.md` §6 and the threshold report's "listing copy" statement.
5. **Then** the filtration-status UI can be built on data that is not invented.
6. Separately (already queued): legacy `tools/build_filter_catalog.py` / `data/filters.json`
   retirement so the override table cannot be resurrected.

---

## Sources

Manufacturer / listing (grade B/C, search-indexed):
- AQUANEAT Large listing — https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B071HVZVMP
- AQUANEAT Large manual mirror — https://manuals.plus/asin/B071HVZVMP
- AQUANEAT 10-gal — https://www.amazon.com/AQUANEAT-Aquarium-Biochemical-Airline-Suction/dp/B08F79B7MS
- AQUANEAT corner up to 20 gal — https://www.walmart.com/ip/476980764
- hygger double sponge — https://www.hygger-online.com/product/fish-tank-water-filter/ ; https://www.amazon.com/Hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RKT6QPV ; https://aquaticmotiv.com/products/hygger-sponge-filter-10-40-gallons
- Pawfly nano — https://www.amazon.com/clp/B09BNCRLZY ; kit https://www.amazon.com/Pawfly-Aquarium-Control-Airline-Accessories/dp/B0C5R4HWXK
- Powkoo — https://www.amazon.com/Powkoo-Double-Biochemical-Aquarium-Gallons-x/dp/B01N6MJYWC
- Penn-Plax UGF — https://www.amazon.com/Penn-Plax-Premium-Gravel-Filter/dp/B005Q4900Q ; https://www.marineandreef.com/Penn_Plax_Premium_Undergravel_Filter_20L_29_Gallon_p/RPE39082.htm
- Hikari Bacto-Surge — https://westlakeaquatics.com/products/hikari-sponge-filter-xl ; https://www.rainbowriveraquatics.com/product-page/hikari-bacto-surge-sponge-filter-kit-4-up-to-75-gallons
- ATI Hydro-Sponge — https://kensfish.com/products/ati-hydro-sponge-pro-filter-4
- Swiss Tropicals — https://www.swisstropicals.com/faq/ ; https://www.swisstropicals.com/library/swisstropicals-poret-foam/

Hobby:
- Aquarium Co-Op sizes — https://www.aquariumcoop.com/blogs/faqs/sponge-filter-sizes
- Aquarium Co-Op Easy Flow — https://www.aquariumcoop.com/blogs/aquarium/easy-flow
- Aquarium Co-Op coarse sponge — https://www.aquariumcoop.com/products/aquarium-co-op-coarse-sponge-filter
- aquariumscience.org 8.4 — https://aquariumscience.org/index.php/8-4-sponge-filters/
- American Aquarium Products — https://www.americanaquariumproducts.com/sponge-filtration.html
- fishlore "GPH of sponge filter" — https://www.fishlore.com/aquariumfishforum/threads/gph-of-sponge-filter.428970/
- Pick Comfort flow range (weak) — https://www.pickcomfort.com/how-much-water-can-a-sponge-filter-in-one-minute/
- Air-pump sizing (weak) — https://aquariumia.com/what-size-air-pump-for-sponge-filter/
- UGF flow per ft² (forum) — https://forum.aquariumcoop.com/topic/12331-undergravel-filter-flow-requirements/

Engineering:
- Loyless & Malone 1998 — https://www.sciencedirect.com/science/article/abs/pii/S0144860998000259
- Parker & Suttle 1987 — https://www.sciencedirect.com/science/article/abs/pii/0144860987900082
- Global Seafood Alliance — https://www.globalseafood.org/advocate/airlifts-combine-pumping-water-treatment-recirculation-systems/
- Tube diameter & submergence (2013) — https://www.sciencedirect.com/science/article/abs/pii/S0301932213001420
- Univ. of Guelph thesis — https://atrium.lib.uoguelph.ca/server/api/core/bitstreams/1f0381c2-4fa6-4d2d-a888-4b142126010f/content
- Airlift pump overview — https://en.wikipedia.org/wiki/Airlift_pump

Repository evidence: `assets/data/gearCatalog.json`; `tools/build_filter_catalog.py`
(`RATED_GPH_OVERRIDES`); commits `5a00e35d`, `1e4d9074`, `22d39d88`, `d84030ac`, `7890cb94`;
`js/gear-data.js`; `js/stocking-advisor/filtration/{controller,math}.js`;
`js/logic/compute.legacy.js`; `assets/js/gear.v2.js`; `stocking-advisor.html` (custom filter row).
