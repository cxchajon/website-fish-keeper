# Stocking Advisor — Sponge Phase B0: Catalog Rating Evidence Verification (2026-09)

Status: **DATA-EVIDENCE AUDIT ONLY.** No production data, scoring, UI, saved state or tests changed.
`assets/data/gearCatalog.json` is **not** modified by this branch.

Inputs (locked, on `main`):

- `_internal/reports/stocking-advisor-sponge-filter-model-audit-2026-09.md` (the "model audit")
- `_internal/reports/stocking-advisor-sponge-filter-migration-design-2026-09.md` (the "locked design")
- `_internal/reports/stocking-advisor-sponge-migration-phase-a-2026-09.md` (Phase A, live)

---

## 1. Executive summary

| # | id | Proposed rating | Expression | Confidence | Phase B |
| --- | --- | --- | --- | --- | --- |
| 1 | `aquaneat-sponge-10` | max **10** (no min stated) | UP_TO | **SUPPORTED** | B. Supported rating |
| 2 | `aquaneat-sponge-20` | max **20** (no min stated) | UP_TO | **SUPPORTED** | B. Supported rating |
| 3 | `aquaneat-sponge-60` | **40–60** | RANGE | **SUPPORTED** | B. Supported rating |
| 4 | `hygger-double-sponge-s` | **10–40** | RANGE | **VERIFIED** | A. Verified rating |
| 5 | `hygger-double-sponge-m` | **15–55** | RANGE | **VERIFIED** | A. Verified rating |
| 6 | `pawfly-sponge-10` | **5–10** ("up to 10" in title) | RANGE | **SUPPORTED** | B. Supported rating |
| 7 | `powkoo-dual-sponge-40` | **none** | UNKNOWN | **NEEDS_REVIEW** | C. Rating needed |

- **2 VERIFIED, 4 SUPPORTED, 1 NEEDS_REVIEW, 0 UNUSABLE.**
- Six of the seven hypotheses held. The exceptions are:
  - **AQUANEAT Large:** the manufacturer text is a **range, 40–60**, not "up to 60". The max of 60
    holds. The current catalog `maxGallons = 40` is wrong.
  - **Powkoo:** no source for any Powkoo product says **"20–55"**. The runtime record has no
    ASIN or URL, so it cannot be tied to one product. Powkoo sells at least five double-sponge
    filters rated 20, 10–35, 15–55, 40 or 60 gal, and one ASIN is titled differently in different
    marketplaces. The "20–55G" in the name is not evidence (Step 10), so Powkoo is
    **Rating needed**.
- **Every current catalog `minGallons`/`maxGallons` pair disagrees with the evidence**, except
  AQUANEAT Middle's `maxGallons = 20`, which matches by coincidence.
- **A decision is needed before Phase B (§12.3):** the locked design (§7.3) uses a rating for a
  green result only when `ratingStatus: "verified"`. Four of the six usable ratings here are
  SUPPORTED, not VERIFIED. Phase B must decide explicitly whether SUPPORTED maps to a usable
  rating. If it does not, only the two Hygger records can go green.
- **Access limit:** this environment's egress proxy blocked direct page fetches for every product
  site tried (hygger-online.com, hyggeraquarium.com, amazon.com, amzn.to, walmart.com,
  manuals.plus, ebay.com, aquaticmotiv.com). All quotations below come from **search-engine-indexed
  page text** attributed to the URL shown, not from pages loaded here (see §15).

---

## 2. Method and source hierarchy

### 2.1 Tiers (per task Step 3)

| Tier | Source type |
| --- | --- |
| 1 | Official manufacturer product page; official manual / spec sheet |
| 2 | Manufacturer-operated marketplace listing; retailer listing sold/shipped by the brand |
| 3 | Major retailer/distributor listing that clearly identifies the exact variant |
| 4 | Ordinary third-party reseller |
| 5 | Blogs, reviews, search snippets without an attributable page |

### 2.2 How tiers were applied here

- A **Tier 1** claim needs the manufacturer's own domain, with indexed text attributed to that
  URL.
- A **brand-authored Amazon listing** (the brand has a registered Amazon Brand Store and the
  listing carries the brand's copy) is *probably* Tier 2. I could not load the pages, so I could
  not confirm who the seller of record is. These listings are therefore **scored as Tier 3** for
  confidence, noted as "Tier 2 (unconfirmed)".
- Manual **mirrors** (manuals.plus, device.report) copy the manufacturer's manual but are third
  parties. They are **Tier 3** and used only to corroborate.
- The current catalog `minGallons`/`maxGallons`/`gphRated` and the catalog **names** were **never
  used as evidence** (Step 11). They were written by hand or by GPH bucket (model audit §3).

### 2.3 Confidence rules (per task Step 13)

- **VERIFIED:** exact product, a usable maximum, and strong Tier 1/2 evidence.
- **SUPPORTED:** exact product, a usable maximum, and strong Tier 3 evidence, with no direct
  manufacturer page reached.
- **NEEDS_REVIEW:** some evidence exists, but identity, rating or source quality falls short.
- **UNUSABLE:** no defensible maximum exists.

### 2.4 Identity matching

Where possible, each record was matched on:

- brand and the exact listing title (the runtime `name` is usually the verbatim marketplace title);
- ASIN or model number;
- dimensions;
- sponge configuration (single or double; spares included);
- the affiliate link recorded in `data/gear_filters_ranges.csv`.

The `amzn.to` affiliate short links could not be resolved because amzn.to is blocked.

---

## 3. Exact 7-product inventory (runtime, unchanged)

Values read from `assets/data/gearCatalog.json` on this branch:

| id | brand | runtime `name` | type | `gphRated` (fake) | `minGallons` | `maxGallons` |
| --- | --- | --- | --- | --- | --- | --- |
| `aquaneat-sponge-10` | AQUANEAT | AQUANEAT Single Sponge Filter (Up to 10G) | SPONGE | 60 | 0 | 20 |
| `aquaneat-sponge-20` | AQUANEAT | AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Middle up to 20Gal) | SPONGE | 120 | 0 | 20 |
| `aquaneat-sponge-60` | AQUANEAT | AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Large up to 60Gal) | SPONGE | 200 | 20 | 40 |
| `hygger-double-sponge-s` | Hygger | hygger Aquarium Double Sponge Filter, Comes with 2 Spare Sponges (S) | SPONGE | 80 | 0 | 20 |
| `hygger-double-sponge-m` | Hygger | hygger Aquarium Double Sponge Filter for Fresh Water and Salt-Water Fish Tank (M) | SPONGE | 120 | 0 | 20 |
| `pawfly-sponge-10` | Pawfly | Pawfly Aquarium Nano Bio Sponge Filter Quiet Betta Fry Shrimp and Small Fish Foam Filter for Tiny Fish Tank up to 10 Gallon | SPONGE | 60 | 0 | 20 |
| `powkoo-dual-sponge-40` | Powkoo | Powkoo Dual Sponge Filter (20–55G) | SPONGE | 150 | 20 | 40 |

No products were added or removed.

Repo provenance that helps with identity:

| id | Affiliate link in repo | Origin |
| --- | --- | --- |
| `aquaneat-sponge-10` | **none** | Hand-entered 2025-10-12 (`data/filters.json`) |
| `aquaneat-sponge-20` | `https://amzn.to/4mTK28f` (`data/gear_filters_ranges.csv` `filters-g_10_20-03`) | Affiliate CSV |
| `aquaneat-sponge-60` | `https://amzn.to/3KTUjUi` (`filters-g_40_55-01`) | Affiliate CSV |
| `hygger-double-sponge-s` | `https://amzn.to/46Qxf0a` (`filters-g_5_10-02`) | Affiliate CSV |
| `hygger-double-sponge-m` | `https://amzn.to/3VTKSXo` (`filters-g_10_20-02`), `https://amzn.to/46XUzsV` (`filters-g_20_40-01`) | Affiliate CSV |
| `pawfly-sponge-10` | `https://amzn.to/3IXHtns` (`filters-g_5_10-01`) | Affiliate CSV |
| `powkoo-dual-sponge-40` | **none** | Hand-entered 2025-10-12 (`data/filters.json`) |

`tools/build_filter_catalog.py` gives display names:

- `aquaneat-sponge-10` → "AQUANEAT Single Sponge Filter (Up to **10**G)"
- `aquaneat-sponge-20` → "AQUANEAT Single Sponge Filter (Up to **20**G)"
- `aquaneat-sponge-60` → "AQUANEAT Single Sponge Filter (Up to **60**G)"

So the builder used "Single Sponge Filter" as its label for all three sizes of the AQUANEAT
*Bio Sponge Filter* series (see §5.1).

---

## 4. Product-identity evidence

| id | Matched product | ASIN / model | Identity signals | Identity strength |
| --- | --- | --- | --- | --- |
| `aquaneat-sponge-10` | AQUANEAT Aquarium Bio Sponge Filter … **(Small up to 10Gal)**, single unit | Single-unit ASIN not pinned. 3-pack: B078HDL21V. Walmart single: 711096713 | Same series as the other two AQUANEAT records (builder label "Single Sponge Filter" for all three); 2.0"D × 4.75"H; "Small up to 10Gal" | **Series + size strong; single-unit SKU not pinned** |
| `aquaneat-sponge-20` | AQUANEAT Aquarium Bio Sponge Filter … **(Middle up to 20Gal)** | **B078Q29JT4** | Runtime name is the verbatim listing title; 3.0"D × 6.5"H; affiliate CSV row carries the same title | **Strong** |
| `aquaneat-sponge-60` | AQUANEAT Aquarium Bio Sponge Filter … **(Large up to 60Gal)** | **B071HVZVMP**, model SF-A004 (manual mirror) | Runtime name is the verbatim listing title; 4.5"D × 8.0"H; Walmart 186627441 has the same dimensions; affiliate CSV row has the same title | **Strong** |
| `hygger-double-sponge-s` | hygger Aquarium Double Sponge Filter, Comes with 2 Spare Sponges **(S)** | **B07RFL4JMM**, model **HG-908** | Runtime name is the verbatim amazon.co.uk/.ca title for B07RFL4JMM; 2 spare sponges + bio-ceramic balls; 6" W × 9–13/14" H; hygger family "908" | **Strong** |
| `hygger-double-sponge-m` | hygger Aquarium Double Sponge Filter for Fresh Water and Salt-Water Fish Tank **(M)** | **B07RKT6QPV**, model **HG-908** | Runtime name is the verbatim amazon.com title for B07RKT6QPV; 6.3" W × 9–13/14" H; 60 ppi double sponge; 2 spares | **Strong** |
| `pawfly-sponge-10` | Pawfly Aquarium Nano Bio Sponge Filter … up to 10 Gallon (single) | **B09BNCRLZY** | Runtime name is the verbatim listing title; 2"D × 4.8"H; affiliate CSV row has the same title | **Strong** |
| `powkoo-dual-sponge-40` | **Unresolved.** Candidates: B01N6MJYWC, B01M32L1LC, B01M3VALFU, B01F8PGL6I, B010PRHDWK | none recorded | Runtime name is a hand-written normalised label, not a listing title; no URL or ASIN anywhere in the repo; the model audit's "B07KXDRFXP" returns no Powkoo product in search | **Weak / unresolved** |

Two identity corrections to the earlier model audit:

1. The model audit cited `https://www.amazon.com/AQUANEAT-Aquarium-Biochemical-Airline-Suction/dp/B08F79B7MS`
   as "AQUANEAT 10-gal". That ASIN is the AQUANEAT **Air Powered Sponge Filter / Bio Bubble
   Filter (up to 10Gal)**, a different product line from the Bio Sponge Filter series. It
   happens to share the "up to 10" rating but must not be the `ratingSource`.
2. The model audit's "Amazon B01N7Q0IPR" (AQUANEAT small) and "Amazon B07KXDRFXP" (Powkoo) could
   not be matched to any indexed product. They should be treated as unverified.

---

## 5. AQUANEAT findings

AQUANEAT has **no standalone official website** in the search index. Its official presence is an
**Amazon Brand Store**, so its brand-authored Amazon listings are the best available source:
"Tier 2 (unconfirmed)", scored as Tier 3 (§2.2). No AQUANEAT-hosted manual was found. The
manuals.plus mirror is Tier 3.

### 5.1 `aquaneat-sponge-10`: Small, up to 10 gal

- **Evidence (Tier 2 unconfirmed, i.e. Tier 3):**
  - The AQUANEAT Bio Sponge Filter series listing text: "recommended for tank sizes **up to 10
    gallons**"; "2 inches in diameter and 4.75 inches in height"; variant label **"Small up to
    10Gal"**. Sources: 3-pack `https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B078HDL21V`
    and the indexed series text.
  - Walmart single unit "AquaNeat Sponge Filter, Bio Filtration, 10 Gal Fish Tank … 2.0"D x
    4.75"H": `https://www.walmart.com/ip/711096713`.
- **Maximum:** 10 gal. **Minimum:** none stated. **Expression:** UP_TO.
- **Identity caveat:**
  - The runtime record is a display name with no link.
  - Mapping it to the Bio Sponge Filter Small rests on two points. First, the builder labels all
    three AQUANEAT ids "Single Sponge Filter (Up to N G)", and the other two are confirmed Bio
    Sponge Filter listings. Second, the size label matches.
  - Every other AQUANEAT "up to 10 gal" sponge also states **10** as its maximum:
    - Corner filter B078X7H8XG
    - Air-powered bubble filter B08F79B7MS
    - Double bio sponge small B07P5WS1RH / B07KS1Y1JN

    So a wrong SKU pick would not change the number. The SKU should still be pinned before
    shipping (§12.3).
- **Confidence:** **SUPPORTED.** The current `maxGallons = 20` is **wrong** (2× the rating).

### 5.2 `aquaneat-sponge-20`: Middle, up to 20 gal

- **Evidence (Tier 2 unconfirmed, i.e. Tier 3):**
  - Listing B078Q29JT4, `https://www.amazon.com/Aquaneat-Sponge-Filter-Breeding-Aquarium/dp/B078Q29JT4`
    (also indexed as `https://www.amazon.com/clp/B078Q29JT4`).
  - Indexed text: "The recommended tank size is **up to 20 gallons**"; "Dimensions: 3.0"D X 6.5"H".
- **Maximum:** 20 gal. **Minimum:** none stated. **Expression:** UP_TO.
- **Confidence:** **SUPPORTED.** The current `maxGallons = 20` matches only by coincidence (it
  came from a GPH bucket). `minGallons = 0` is not evidence of anything.
- **Different products with the same number (not sources):**
  - AQUANEAT Air Powered Sponge Filter (Up to 20Gal), B07L565N7H
  - AQUANEAT Air Driven Corner Sponge Filter up to 20 Gallon, B079M732S6

### 5.3 `aquaneat-sponge-60`: Large, 40–60 gal

- **Evidence:**
  - Listing B071HVZVMP, `https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B071HVZVMP`
    (Tier 2 unconfirmed). Title "(Large up to 60Gal)". Body text: "The recommended tank size
    is **40 to 60 gallons**"; 4.5"D × 8.0"H.
  - Manual mirror `https://manuals.plus/asin/B071HVZVMP` (Tier 3, model **SF-A004**): "ideal
    for **40 to 60-gallon** aquariums"; ~4.5"D × 8.0"H.
  - Walmart `https://www.walmart.com/ip/186627441`: "AquaNeat, Aquarium Bio Sponge Filter,
    4.5"D X 8.0"H, for 60 gal tank" (Tier 3/4).
- **Maximum:** 60 gal. **Minimum:** 40 gal, stated in both the listing body and the manual.
  **Expression:** RANGE. The title's "up to" wording is the marketing short form; the body and
  manual give the range, and the range is the fuller manufacturer statement.
- **Confidence:** **SUPPORTED.**
- **Current catalog is wrong on both ends:**
  - `minGallons = 20` against a stated 40.
  - `maxGallons = 40` against a stated 60. At that value the product is hidden from the 55-gal
    tanks it is rated for.

---

## 6. Hygger findings

Hygger sells **several different sponge-filter families**. Only the HG-908 family matches the
runtime records.

| Family | Official / marketplace | Sizes | Matches runtime? |
| --- | --- | --- | --- |
| **HG-908 double sponge, 2 spare sponges + bio-ceramic balls** | `https://www.hygger-online.com/product/fish-tank-water-filter/` ("Fish Tank Double Sponge Water Filter"); Amazon **B07RFL4JMM (S)**, **B07RKT6QPV (M)** | **S 10–40, M 15–55** | **Yes** |
| HG-908 variant, 4 spare sponges ("Replaceable Media … (S/M)") | Amazon B07VTT5CJM / B07VV89SJY; official page `…/product/hygger-aquarium-biochemical-sponge-filter/` | S 10–40, M 15–55 (same) | Same family, different pack; not the runtime SKU |
| "Upgraded" double sponge, extendable clip, vertical-stripe sponge | Amazon B0FJCZJ3C3 (M) | M 15–55 | **No.** Newer, different family; do not use as source |
| Single large biochemical sponge, 55–125 gal | Amazon B0CSFRMHDK; official `…/product/aquarium-biochemical-sponge-filter/` | 55–125 | **No** |
| USB electric sponge filter | official `…/product/hygger-usb-electric-aquarium-sponge-filter/` | — | **No** (powered) |

### 6.1 `hygger-double-sponge-s`

- **Tier 1 (official, indexed):** `https://www.hygger-online.com/product/fish-tank-water-filter/`
  says: "The small double sponge filter is 6″ x 9″ x 14″ … **suggested for 10 to 40 gallon** fish
  tanks." The package list (1 double sponge filter with 2 containers, 1 bag of ceramic media balls,
  2 spare sponges) matches the runtime title "Comes with 2 Spare Sponges".
- **Tier 2 (unconfirmed), same SKU:** `https://www.amazon.com/Hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RFL4JMM`
  (S): "suggested for 10 to 40 gallon fish tanks … 6 inches in width and 9 to 13 inches in height".
- **Tier 3 corroboration:**
  - `https://aquaticmotiv.com/products/hygger-sponge-filter-10-40-gallons`
  - `https://www.petnannystore.com/products/hygger-aquarium-double-sponge-filter`, which names
    model **"Hygger 908"**
  - eBay HG-908 listing: S 10–40, M 15–55
- The HG-908 manual mirrors (`https://manuals.plus/hygger/hg-908-aquarium-double-sponge-filter-manual`,
  `https://device.report/manual/5309189`) **do not** carry a gallon figure in their indexed text.
  They confirm the model only.
- **Result:** manufacturerMinGallons **10**, manufacturerMaxGallons **40**, **RANGE**,
  **VERIFIED**. The current `0–20` is **wrong**.

### 6.2 `hygger-double-sponge-m`

- **Tier 1 (official, indexed):** same page, "The medium double sponge filter is 6.3″ x 9″ x 14″ …
  **suggested for 15 to 55 gallon** fish tanks."
- **Tier 2 (unconfirmed), same SKU:** `https://www.amazon.com/Hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RKT6QPV`
  (M): "suggested for 15 to 55 gallon fish tanks"; 2 × 60 ppi sponges; 2 spares + bio-ceramic
  balls.
- **Tier 3 corroboration:**
  - Walmart M `https://www.walmart.com/ip/209243859`
  - Supply AG `https://www.supplyag.com/products/hygger-aquarium-double-sponge-filter-for-fresh-water-and-salt-water-fish-tank-m`
  - Marine & Reef `https://www.marineandreef.com/Hygger_Aquarium_Biochemical_Double_Sponge_Filter__p/rhr00908.htm`
    (SKU "rhr00908")
- **Result:** manufacturerMinGallons **15**, manufacturerMaxGallons **55**, **RANGE**,
  **VERIFIED**. The current `0–20` is **wrong**. The same product is also linked in the
  20–40 gallon affiliate band, which already contradicts the catalog's `maxGallons = 20`.

---

## 7. Pawfly findings — `pawfly-sponge-10`

- **Pawfly-controlled sources:**
  - Pawfly has official sites, `https://pawflys.com/` and `https://thepawfly.com/`, and an
    Amazon Brand Store,
    `https://www.amazon.com/stores/Pawfly/page/08B0DBE0-6D17-4822-A29D-3DD167361EF8`.
  - **No product page on either Pawfly site with a tank rating for this SKU was found in the
    index.** Only the home pages are indexed, and fetches are blocked. The best available source
    is the brand's Amazon listing.
- **Tier 2 (unconfirmed), i.e. Tier 3:** `https://www.amazon.com/clp/B09BNCRLZY`.
  - The title is verbatim the runtime name ("… for Tiny Fish Tank **up to 10 Gallon**").
  - The listing body says "measures 2" D x 4.8" H and **fits for 5-10 gallon** small tanks".
- **Tier 3:**
  - Walmart single `https://www.walmart.com/ip/11685800589` ("… up to 10 Gallon")
  - 3-pack `https://www.amazon.com/Pawfly-Aquarium-Sponge-Filter-Shrimp/dp/B098SGW6QS` (same
    text, 2"D × 4.8"H, 5–10 gal)
- **Maximum:** 10 gal, consistent in title and body.
- **Minimum:** **5 gal**, stated in the listing body ("fits for 5-10 gallon"). The same source
  that gives the maximum states it, so it is recorded. Per the locked design, min is display
  metadata only.
- **Expression:** **RANGE** (5–10). The title's "up to 10" is the short form. Adequacy uses only
  the max, so either expression gives the same runtime result.
- **Confidence:** **SUPPORTED.** Only marketplace/retailer evidence exists; no Pawfly-hosted
  rating page was reached. The current `0–20` is **wrong** (max 2× the rating).

---

## 8. Powkoo findings — `powkoo-dual-sponge-40`

- **No official Powkoo website** was found. Powkoo appears to sell only through Amazon and
  resellers.
- **The runtime record cannot be tied to a product:**
  - Its name "Powkoo Dual Sponge Filter (20–55G)" is a hand-written label from the 2025-10-12
    hand-entered catalog. It is not a listing title.
  - No URL or ASIN exists for it anywhere in the repo, including the affiliate CSVs.
- **Candidate Powkoo double-sponge products and their stated ratings (all Tier 2-unconfirmed /
  Tier 3):**

| ASIN | Listing title (indexed) | Stated rating |
| --- | --- | --- |
| B01N6MJYWC | Powkoo Aquarium Double Sponge Filter … Comes with 1 Bag Bio Media | "fits fish tank sizes from **15 to 55** gallon". Also indexed under a URL slug "…Aquarium-Gallons-x" with the title "Up to 55 Gallon" |
| B01M32L1LC | Powkoo Sponge Filter for Aquarium Double Bio Sponge Filter with 2 Media Cups … **Up to 55 Gallon** (amazon.com) | Body "15 to 55"; **amazon.ca title "… Up to 40 Gallon"**; another indexed version "10 to 40"; importer title "Max Aquarium fish Tank **60 Gallons**"; model HJK90048 |
| B01M3VALFU | Powkoo Double Sponge Filter … with 2 Media Chambers | "10 to 35 gallons" |
| B01F8PGL6I | Powkoo Double Bio Sponge Filter … **Up to 20 Gallon** | "10 to 20 gallon" |
| B010PRHDWK | Powkoo Air Pump Sponge Filter Bio Filter … **Up to 60 Gallons** | up to 60 |

- **"20–55" appears in no source for any Powkoo product.** It exists only in the runtime name. The
  model audit's "20–55 (name) / 15–55 (other listings)" confirms that 20 came from the name
  alone.
- Even the two strongest candidates (B01N6MJYWC and B01M32L1LC, both "15–55") do not settle it.
  **B01M32L1LC carries 40, 55 and 60 gal ratings in different marketplaces**, which is a
  documented rating conflict within a single ASIN.
- **Result:** manufacturerMinGallons **null**, manufacturerMaxGallons **null**, **UNKNOWN**,
  **NEEDS_REVIEW**. At runtime this is **○ Rating needed** (neutral), per locked decisions D4
  and D9.
- **Path to a rating (not done here):**
  1. The owner identifies the exact Powkoo product that was originally meant, by ASIN or a
     purchase/affiliate record.
  2. If it is B01N6MJYWC, "15–55" would be a Tier 3 SUPPORTED candidate after a human check of
     the live page.
  3. If it is B01M32L1LC, the 40/55/60 conflict must be resolved first.

  Alternatively, replace the product in a later phase (that is a product change, out of scope).

---

## 9. Conflicting evidence

| Product | Claim A (tier) | Claim B (tier) | Winner and reason |
| --- | --- | --- | --- |
| AQUANEAT Large | Title "up to 60" (T2u) | Body + manual "40 to 60" (T2u + T3) | **40–60 (RANGE).** Same max. The body/manual is the fuller manufacturer statement and adds a stated min. No numeric conflict on the max. |
| AQUANEAT Large | "60 gal", 4.5"×8" (Walmart 186627441, T3/4; Amazon B071HVZVMP, T2u) | "50 Gal" (Walmart 5040531230, T4 reseller; **no dimensions**; identity not established) | **60.** The 50 gal listing cannot be shown to be the same variant and ranks lower. It is not averaged, and it is not ignored silently. |
| AQUANEAT Small | "up to 10" (series listings) | "5–10"-style wording **not found** for AQUANEAT | No conflict. |
| Hygger S/M | S 10–40, M 15–55 (official T1; Amazon T2u) | "10–55 gal" (eBay 187341969631 / 156894464570, T4) | **Official per-size ranges win.** "10–55" is a reseller merging both sizes into one family range, not a per-variant rating. |
| Hygger S | 10–40 (T1) | "15–40" | **Not found** in any source. No conflict. |
| Hygger M | 15–55 (T1) | "20–55" | **Not found** for Hygger. No conflict. |
| Pawfly | "up to 10" (title, T2u) | "5–10" (body, same listing) | **Consistent.** Same source, same max; the min is recorded as stated. |
| Pawfly | "up to 10" (B09BNCRLZY) | "up to 5–60 Gallon" (Walmart 1476406157, T4) | **10.** The Walmart listing is a multi-size or garbled title with no single variant; it cannot be the same SKU. |
| Powkoo | "20–55" (runtime name only, **not a source**) | "15–55" (B01N6MJYWC, B01M32L1LC US body) | Name rejected (Step 10). |
| Powkoo | "Up to 55" (B01M32L1LC .com) | "Up to 40" (.ca), "10–40", "Max 60" (importer) | **Unresolved.** Same ASIN, three maxima; no tier outranks the others. **NEEDS_REVIEW.** |

No rating was averaged. No larger value was chosen for being more generous.

---

## 10. Current catalog vs proposed values

`minGallons`/`maxGallons`/`gphRated` are the **current picker values**: GPH-bucket or hand
derived, and not evidence. The `manufacturer*` columns are the **proposed future rating**.

| ID | Current minGallons | Current maxGallons | Current fake gphRated | Proposed manufacturerMinGallons | Proposed manufacturerMaxGallons | Expression | Confidence | Best source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aquaneat-sponge-10` | 0 | **20** ✗ | 60 | null | **10** | UP_TO | supported | amazon.com/…/dp/B078HDL21V (series "Small up to 10Gal") |
| `aquaneat-sponge-20` | 0 | 20 (coincidental) | 120 | null | **20** | UP_TO | supported | amazon.com/…/dp/B078Q29JT4 |
| `aquaneat-sponge-60` | **20** ✗ | **40** ✗ | 200 | **40** | **60** | RANGE | supported | amazon.com/…/dp/B071HVZVMP |
| `hygger-double-sponge-s` | **0** ✗ | **20** ✗ | 80 | **10** | **40** | RANGE | **verified** | hygger-online.com/product/fish-tank-water-filter/ |
| `hygger-double-sponge-m` | **0** ✗ | **20** ✗ | 120 | **15** | **55** | RANGE | **verified** | hygger-online.com/product/fish-tank-water-filter/ |
| `pawfly-sponge-10` | **0** ✗ | **20** ✗ | 60 | **5** | **10** | RANGE | supported | amazon.com/clp/B09BNCRLZY |
| `powkoo-dual-sponge-40` | 20 (unsupported) | 40 (unsupported) | 150 | null | **null** | UNKNOWN | needs_review | — (no defensible source) |

✗ = contradicted by the evidence. The `minGallons = 0` values for the AQUANEAT Small and Middle
are not "wrong" in the sense of contradicting a stated minimum (none is stated), but they are
not evidence either. Every `gphRated` above is fake and unsupported (model audit §3); none of
it is used here.

---

## 11. Confidence classifications

| Class | Count | Products |
| --- | --- | --- |
| VERIFIED | **2** | `hygger-double-sponge-s`, `hygger-double-sponge-m` |
| SUPPORTED | **4** | `aquaneat-sponge-10`, `aquaneat-sponge-20`, `aquaneat-sponge-60`, `pawfly-sponge-10` |
| NEEDS_REVIEW | **1** | `powkoo-dual-sponge-40` |
| UNUSABLE | **0** | — |

Why the AQUANEAT and Pawfly records are not VERIFIED:

- Neither brand has a reachable first-party product page carrying the rating.
- Their Amazon listings are probably brand-operated, but the seller of record could not be
  confirmed.
- Each product's rating comes from one listing family plus retailer copies.

Why Hygger is VERIFIED:

- The official Hygger product page states the per-size ranges.
- The exact SKUs and model match.
- The package contents and dimensions agree.
- The page was reached through indexed text, not a live fetch (§15).

---

## 12. Proposed Phase B metadata (NOT applied)

These are proposals for review. **`gearCatalog.json` is not edited in this branch.**

Enum spelling:

- `ratingExpression`: the locked design (§7.3) uses lower-case `up_to | range | min_only |
  unclear`. This task's UP_TO / RANGE / MINIMUM_ONLY / UNKNOWN map to those one-to-one
  (UNKNOWN → `unclear`).
- `ratingConfidence`: shown in this task's vocabulary.

### 12.1 Per-product proposal

```jsonc
// aquaneat-sponge-10
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": null, "manufacturerMaxGallons": 10,
  "ratingExpression": "up_to", "ratingConfidence": "supported",
  "ratingSource": "https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B078HDL21V" }
  // precondition: pin the single-unit ASIN (§12.3); swap ratingSource to it

// aquaneat-sponge-20
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": null, "manufacturerMaxGallons": 20,
  "ratingExpression": "up_to", "ratingConfidence": "supported",
  "ratingSource": "https://www.amazon.com/Aquaneat-Sponge-Filter-Breeding-Aquarium/dp/B078Q29JT4" }

// aquaneat-sponge-60
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": 40, "manufacturerMaxGallons": 60,
  "ratingExpression": "range", "ratingConfidence": "supported",
  "ratingSource": "https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B071HVZVMP" }

// hygger-double-sponge-s
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": 10, "manufacturerMaxGallons": 40,
  "ratingExpression": "range", "ratingConfidence": "verified",
  "ratingSource": "https://www.hygger-online.com/product/fish-tank-water-filter/" }
  // SKU: Amazon B07RFL4JMM, hygger model HG-908 (S)

// hygger-double-sponge-m
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": 15, "manufacturerMaxGallons": 55,
  "ratingExpression": "range", "ratingConfidence": "verified",
  "ratingSource": "https://www.hygger-online.com/product/fish-tank-water-filter/" }
  // SKU: Amazon B07RKT6QPV, hygger model HG-908 (M)

// pawfly-sponge-10
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": 5, "manufacturerMaxGallons": 10,
  "ratingExpression": "range", "ratingConfidence": "supported",
  "ratingSource": "https://www.amazon.com/clp/B09BNCRLZY" }

// powkoo-dual-sponge-40
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": null, "manufacturerMaxGallons": null,
  "ratingExpression": "unclear", "ratingConfidence": "needs_review",
  "ratingSource": null }            // runtime: ○ Rating needed
```

Legacy `gphRated`, `minGallons` and `maxGallons` stay on every record, retained but ignored, per
the locked design §7.3 / §9.3. Nothing here proposes removing them.

### 12.2 Phase B eligibility (Step 18)

| id | Class |
| --- | --- |
| `hygger-double-sponge-s` | **A. VERIFIED RATING** |
| `hygger-double-sponge-m` | **A. VERIFIED RATING** |
| `aquaneat-sponge-10` | **B. SUPPORTED RATING** (after the ASIN is pinned) |
| `aquaneat-sponge-20` | **B. SUPPORTED RATING** |
| `aquaneat-sponge-60` | **B. SUPPORTED RATING** |
| `pawfly-sponge-10` | **B. SUPPORTED RATING** |
| `powkoo-dual-sponge-40` | **C. RATING NEEDED** |

### 12.3 Preconditions and open decisions for Phase B

1. **SUPPORTED → runtime mapping (decision required).**
   - Locked design §7.3 says a rating produces green "only when `ratingStatus` is `verified`".
     The design's `ratingStatus` has only `verified | needs_review`.
   - Phase B must choose one of two options:
     - (a) Map SUPPORTED to `ratingStatus: "verified"` and keep the finer grade in the review-only
       `ratingConfidence` field. Then **6 of 7** are rating-based.
     - (b) Keep SUPPORTED as not-yet-usable. Then only the **2 Hygger** records are rating-based
       and the other five are Rating needed.
   - This report does not make that choice.
2. **Pin `aquaneat-sponge-10` to a single-unit ASIN.** The record has no link. Resolve it from the
   owner's Amazon Associates history or by adding the intended listing. The rating (10) is the
   same for every AQUANEAT "up to 10" candidate, but `ratingSource` should point at the exact
   SKU.
3. **Human spot-check of the live pages** for the six usable ratings. This environment could not
   load any product page (§15). One browser pass over the six URLs in §12.1 would confirm the
   indexed text still appears and, for AQUANEAT and Pawfly, who the seller of record is. If the
   seller is the brand, those four records could be upgraded to VERIFIED.
4. **Powkoo** needs a product decision (identify the ASIN or replace the product), not a data fix.

---

## 13. Products that must remain Rating Needed

- **`powkoo-dual-sponge-40`.** The only product in this set without a defensible rating:
  - The identity is unresolved.
  - "20–55" has no source.
  - The candidate ASINs carry conflicting 40/55/60 maxima.

  It stays selectable and evaluates as **○ Rating needed** (neutral, never adequate, never
  unsafe), per locked decisions D4/D9.
- **Conditional:** if decision §12.3-1 goes to option (b), the four SUPPORTED records
  (`aquaneat-sponge-10`, `aquaneat-sponge-20`, `aquaneat-sponge-60`, `pawfly-sponge-10`) also
  ship as Rating needed until upgraded.

---

## 14. Direct URLs

**Official manufacturer (Tier 1)**

- hygger HG-908 double sponge (S 10–40 / M 15–55): https://www.hygger-online.com/product/fish-tank-water-filter/
- hygger double biochemical sponge (4-sponge pack, same ratings): https://www.hygger-online.com/product/hygger-aquarium-biochemical-sponge-filter/
- hygger single biochemical sponge (different family, 55–125; not a source): https://www.hygger-online.com/product/aquarium-biochemical-sponge-filter/
- hygger sponge-filter category: https://www.hygger-online.com/product-category/aquarium-filters/sponge-filter/
- Pawfly official sites (no rated product page found): https://pawflys.com/ , https://thepawfly.com/

**Brand-authored marketplace listings (Tier 2, unconfirmed)**

- AQUANEAT Small 3-pack (series "Small up to 10Gal"): https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B078HDL21V
- AQUANEAT Middle: https://www.amazon.com/Aquaneat-Sponge-Filter-Breeding-Aquarium/dp/B078Q29JT4 (also https://www.amazon.com/clp/B078Q29JT4)
- AQUANEAT Large: https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B071HVZVMP (also https://www.amazon.com/clp/B071HVZVMP)
- AQUANEAT Amazon Brand Store: https://www.amazon.com/stores/Aquaneat/page/FF4D67E9-A0FF-4541-ABBE-3F42DC41AE02
- hygger S: https://www.amazon.com/Hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RFL4JMM (also https://www.amazon.com/clp/B07RFL4JMM, https://www.amazon.co.uk/hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RFL4JMM)
- hygger M: https://www.amazon.com/Hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RKT6QPV
- Pawfly single: https://www.amazon.com/clp/B09BNCRLZY
- Pawfly 3-pack: https://www.amazon.com/Pawfly-Aquarium-Sponge-Filter-Shrimp/dp/B098SGW6QS
- Pawfly Amazon Brand Store: https://www.amazon.com/stores/Pawfly/page/08B0DBE0-6D17-4822-A29D-3DD167361EF8
- Powkoo candidates:
  - https://www.amazon.com/Powkoo-Double-Sponge-Filter-Aquarium/dp/B01N6MJYWC
  - https://www.amazon.com/Powkoo-Double-Biochemical-Aquarium-Gallons/dp/B01M32L1LC
  - https://www.amazon.ca/Powkoo-Biochemical-Pre-Filter-Canister-Aquarium/dp/B01M32L1LC
  - https://www.amazon.com/Powkoo-Double-Biochemical-Aquarium-Gallons/dp/B01M3VALFU
  - https://www.amazon.com/Powkoo-Sponge-Filter-Aquarium-Gallons/dp/B01F8PGL6I
  - https://www.amazon.com/General-Double-Biochemical-Powered-Aquarium/dp/B010PRHDWK

**Manual mirrors / retailers (Tier 3–4)**

- AQUANEAT Large manual (SF-A004, 40–60): https://manuals.plus/asin/B071HVZVMP
- hygger HG-908 manual (no gallon figure indexed): https://manuals.plus/hygger/hg-908-aquarium-double-sponge-filter-manual , https://device.report/manual/5309189
- AQUANEAT Large, Walmart 60 gal: https://www.walmart.com/ip/Aquaneat-Aquarium-Bio-Sponge-Filter-Breeding-Fry-Betta-Shrimp-Nano-Fish-Tank-60-gal/186627441
- AQUANEAT "50 Gal", Walmart (identity unestablished): https://www.walmart.com/ip/Aquaneat-Aquarium-Bio-Sponge-Filter-Breeding-Fry-Betta-Shrimp-Nano-Fish-Tank-50-Gal/5040531230
- AQUANEAT Small, Walmart 10 gal 2.0"×4.75": https://www.walmart.com/ip/Aquaneat-Aquarium-Bio-Oxygen-Sponge-Filter-Breeding-Fry-Betta-Shrimp-Nano-Fish-Tank-10-gal/711096713
- hygger M, Walmart: https://www.walmart.com/ip/Hygger-Fish-Tank-Aquarium-Submersible-Foam-Filter-Double-Sponge-Filter-M/209243859
- hygger 10–40, Aquatic Motiv: https://aquaticmotiv.com/products/hygger-sponge-filter-10-40-gallons
- hygger 908, Petnanny: https://www.petnannystore.com/products/hygger-aquarium-double-sponge-filter
- hygger M, Marine & Reef: https://www.marineandreef.com/Hygger_Aquarium_Biochemical_Double_Sponge_Filter__p/rhr00908.htm
- hygger M, Supply AG: https://www.supplyag.com/products/hygger-aquarium-double-sponge-filter-for-fresh-water-and-salt-water-fish-tank-m
- hygger "10–55" eBay (family range, T4): https://www.ebay.com/itm/187341969631 , https://www.ebay.com/itm/156894464570
- hygger HG-908 eBay: https://www.ebay.com/itm/205125983210
- Pawfly single, Walmart: https://www.walmart.com/ip/Pawfly-Aquarium-Nano-Bio-Sponge-Filter-Quiet-Betta-Fry-Shrimp-and-Small-Fish-Foam-Filter-for-Tiny-Fish-Tank-up-to-10-Gallon/11685800589
- Pawfly "5–60", Walmart (not same SKU): https://www.walmart.com/ip/Pawfly-Aquarium-Nano-Bio-Sponge-Filter-Quiet-Betta-Fry-Shrimp-and-Small-Fish-Foam-Filter-for-Fish-Tank-up-to-5-60-Gallon/1476406157
- Powkoo "Max 60" importer (B01M32L1LC): https://www.importitall.co.za/Powkoo-Double-Super-Biochemical-Sponge-Filter-Max-Aquarium-fish-Tank-60-Gallons-Filter-ap-B01M32L1LC.html

**Explicitly NOT sources for these records (different products)**

- AQUANEAT Air Powered Sponge Filter up to 10Gal, B08F79B7MS (cited in the model audit as "AQUANEAT 10-gal"): https://www.amazon.com/AQUANEAT-Aquarium-Biochemical-Airline-Suction/dp/B08F79B7MS
- AQUANEAT Air Powered up to 20Gal, B07L565N7H: https://www.amazon.com/clp/B07L565N7H
- hygger Upgraded double sponge (M), B0FJCZJ3C3: https://www.amazon.com/hygger-Aquarium-Double-Sponge-Filter/dp/B0FJCZJ3C3
- hygger 55–125 gal single sponge, B0CSFRMHDK: https://www.amazon.com/hygger-Aquarium-Breeding-Air-Powered-Biochemical/dp/B0CSFRMHDK

---

## 15. Evidence limitations

1. **No live page loads.**
   - Every product domain tried was blocked by this environment's egress proxy (connect
     rejected): hygger-online.com, hyggeraquarium.com, amazon.com, amzn.to, walmart.com,
     manuals.plus, ebay.com, aquaticmotiv.com.
   - All quoted text is **search-engine-indexed text attributed to the listed URL**. Indexed
     text can be stale: listings get edited, variants get merged, and ASINs get reused.
2. **Seller of record unconfirmed.** Amazon listings were not scored as confirmed Tier 2,
   because the seller could not be checked (§2.2). This is the only thing separating the four
   SUPPORTED records from VERIFIED.
3. **Affiliate short links unresolved.** The `amzn.to` links in `data/gear_filters_ranges.csv`
   could not be expanded. Identity for those records rests on verbatim title matches, not on the
   link.
4. **Two records have no link at all** (`aquaneat-sponge-10`, `powkoo-dual-sponge-40`). Both were
   hand-entered on 2025-10-12. For AQUANEAT Small this does not change the number; for Powkoo it
   is decisive.
5. **Manufacturer ratings are marketing figures** (model audit §6). A "verified" rating means
   "the manufacturer says so for this exact SKU", not "independently tested". The Hygger ranges
   in particular are generous compared with similarly sized sponges from other brands.
6. **Secondary dataset divergence (out of scope).** `assets/data/gear/filters.json` carries yet
   another set of hand bands for some of these products. Examples: AQUANEAT Small 3–10, Middle
   7–20, Powkoo 9–25. They are recorded here only as further evidence that none of the existing
   min/max values are sourced. They were not used and not changed.
7. The task's Step 4 hypothesis "Small up to 10Gal" wording is confirmed for the 3-pack / series
   listing. A single-unit AQUANEAT Amazon listing with that exact wording was not indexed (§12.3-2).

---

*Scope check: this branch changes only this file. No production code, catalog data, tests, UI or
saved-state logic was modified.*
