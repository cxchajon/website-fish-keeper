# Stocking Advisor — sponge catalog rating evidence verification (phase B0, 2026-09)

Documentation / evidence only. Resolves (as far as this environment allows) open item 1 of
`stocking-advisor-sponge-filter-migration-design-2026-09.md` §16: *"All seven sponge ratings …
are grade C. Each must be confirmed at A/B before it can produce green; anything not confirmable
ships as `needs_review` (Rating needed)."*

**Nothing in production changed.** `assets/data/gearCatalog.json`, filtration scoring, saved-state
behaviour, the custom sponge UI and every existing sponge `gphRated` value are untouched. No phase B
implementation is started.

Base: `main` @ `062078d`. Research date: 2026-09-28.

---

## 0. Summary

| id | Exact product identity | Rating found | Grade | Identity confidence | Phase B status |
| --- | --- | --- | --- | --- | --- |
| `aquaneat-sponge-60` | AQUANEAT Bio Sponge Filter, **Large up to 60 Gal**, model **SF-A004**, ASIN **B071HVZVMP** | **40–60 gal** (manual) / "up to 60 gal" (title) — max agrees | **B** | High | **Eligible** — `manufacturerMaxGallons: 60`, min 40 display-only |
| `hygger-double-sponge-s` | hygger Aquarium Double Sponge Filter, 2 spare sponges, **(S)**, ASIN **B07RFL4JMM** | **10–40 gal** | **B** (with attribution caveat) | Medium-high | **Eligible, conditional** on the §6 identity check |
| `hygger-double-sponge-m` | hygger Aquarium Double Sponge Filter **(M)**, ASIN **B07RKT6QPV** | **15–55 gal** | **B** (with attribution caveat) | **Medium** (two different affiliate links in repo) | **Eligible, conditional** on the §6 identity check |
| `aquaneat-sponge-20` | AQUANEAT Bio Sponge Filter, **Middle up to 20 Gal**, ASIN **B078Q29JT4** | up to 20 gal | C | High | **Rating needed** under the locked A/B rule (see §5 policy question) |
| `pawfly-sponge-10` | Pawfly Nano Bio Sponge Filter … up to 10 Gallon, ASIN **B09BNCRLZY** | up to 10 gal ("5–10 gal" in description) | C | High | **Rating needed** under the locked A/B rule (see §5) |
| `aquaneat-sponge-10` | **Unresolved.** Catalog name "Single Sponge Filter (Up to 10G)" is not a real listing title; ≥ 5 AQUANEAT 10-gal candidates | up to 10 gal (every candidate) | C | **Low** | **Rating needed** |
| `powkoo-dual-sponge-40` | **Unresolved.** Catalog name "Dual Sponge Filter (20–55G)" is not a real listing title; ≥ 4 Powkoo double-sponge candidates with conflicting ratings | 15–55 / "up to 55" / 10–40 / "up to 40" / "up to 20" depending on listing | C / conflict | **Low** | **Rating needed** |

- **Strict (locked) rule — A/B only:** 3 of 7 can use rating-based evaluation
  (`aquaneat-sponge-60`, `hygger-double-sponge-s`, `hygger-double-sponge-m`), the two hygger ones only
  after the §6 identity check. **4 stay "Rating needed".**
- **No product reaches grade A.** Every direct page fetch was refused by the egress proxy (§1).
- **No evidence found for any sponge water-flow GPH.** The phase B plan to ignore `gphRated` for
  sponges is unaffected.
- Two identity problems were found that the earlier reports did not surface: the AQUANEAT 10 and
  Powkoo catalog names do not match any real listing, and the repo holds **two different affiliate
  short links for hygger (M)**.

---

## 1. Method and limits

### 1.1 What was tried

| Channel | Result |
| --- | --- |
| `curl` via agent proxy: hygger-online.com, theaquaneat.com / aquaneat.com, pawfly.com, powkoo.com, amazon.com, manuals.plus, `amzn.to` short links | **All refused** (`connect_rejected`, organisation egress policy) |
| `WebFetch`: hygger-online.com, `amzn.to`, supplyag.com, reviewaqua.com | **All refused** (`EGRESS_BLOCKED`) |
| `WebSearch` (search-index titles + snippets) | **Works.** All evidence below comes from here. |
| Repo trail (`data/gear_filters_ranges.csv`, `assets/data/gear/filters.json`, `data/filters.json`, `gear/index.html`, earlier reports) | Read in full for the 7 ids |

Consequences:

- **No grade A is possible in this environment.** A product page or manual could not be opened and read.
- Search snippets are paraphrased by the search tool. Where the same figure appears in several
  independent queries and in the indexed page title, that is recorded; where the tool attributed a
  figure to one of two similar pages from the same maker, that is flagged as an **attribution caveat**.
- The six `amzn.to` affiliate links in the repo **could not be resolved** to ASINs. Product identity is
  therefore inferred from **exact title match** between the catalog name and an indexed listing title.

### 1.2 Grade scale (unchanged from the earlier reports)

| Grade | Meaning |
| --- | --- |
| A | Read directly on the manufacturer's page or manual |
| B | Manufacturer or manufacturer-document text via search index (manufacturer domain, or the manufacturer's manual via a manual mirror) |
| C | Retailer / marketplace listing (incl. brand-authored Amazon listings), secondary site, forum |
| D | Derived by repo code |
| E | No source |

### 1.3 Evidence-type separation

Each finding in §3 is tagged:

- **[MFR-SITE]** manufacturer's own domain (hygger-online.com, theaquaneat.com, thepawfly.com)
- **[MFR-DOC]** manufacturer's manual, via a third-party mirror (manuals.plus)
- **[MKT-BRAND]** Amazon/Walmart listing authored by the brand (brand-owned but a retail surface)
- **[RETAIL]** third-party retailer (eBay, Supply AG, Aquatic Motiv, Aquanature, GoSupps, …)
- **[REVIEW]** hobby/review site

All of these were read **via search index**, never by direct fetch.

---

## 2. Repo identity trail for the 7 runtime products

| id | Catalog name (`gearCatalog.json`) | Affiliate link in repo | Where | Other repo copies |
| --- | --- | --- | --- | --- |
| `aquaneat-sponge-10` | AQUANEAT Single Sponge Filter (Up to 10G) | **none** | — | `data/filters.json`, `assets/data/gear/filters.json` (no `url`) |
| `aquaneat-sponge-20` | AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Middle up to 20Gal) | `https://amzn.to/4mTK28f` | `data/gear_filters_ranges.csv:7`, `assets/data/gear/filters.json` | — |
| `aquaneat-sponge-60` | … (Large up to 60Gal) | `https://amzn.to/3KTUjUi` | `data/gear_filters_ranges.csv:11`, `assets/data/gear/filters.json` | — |
| `hygger-double-sponge-s` | hygger Aquarium Double Sponge Filter, Comes with 2 Spare Sponges (S) | `https://amzn.to/46Qxf0a` | `data/gear_filters_ranges.csv:3`, `assets/data/gear/filters.json` | — |
| `hygger-double-sponge-m` | hygger Aquarium Double Sponge Filter for Fresh Water and Salt-Water Fish Tank (M) | **two different links:** `https://amzn.to/3VTKSXo` (10–20 gal row) and `https://amzn.to/46XUzsV` (20–40 gal row) | `data/gear_filters_ranges.csv:6` and `:8`; `assets/data/gear/filters.json` uses `46XUzsV` | — |
| `pawfly-sponge-10` | Pawfly Aquarium Nano Bio Sponge Filter Quiet Betta Fry Shrimp and Small Fish Foam Filter for Tiny Fish Tank up to 10 Gallon | `https://amzn.to/3IXHtns` | `data/gear_filters_ranges.csv:2`, `assets/data/gear/filters.json` | — |
| `powkoo-dual-sponge-40` | Powkoo Dual Sponge Filter (20–55G) | **none** | — | `data/filters.json`, `assets/data/gear/filters.json` (no `url`) |

Notes:

- `aquaneat-sponge-10` and `powkoo-dual-sponge-40` were hand-entered on 2025-10-12 (commit `5a00e35d`,
  per the sponge model audit §3) with **short, invented display names** and no link. Their names
  contain a rating ("Up to 10G", "20–55G") that no source ties to a specific product.
- The two hygger (M) links may resolve to the same ASIN (e.g. one created with a different tag or at a
  different time) or to different products (e.g. the older M and hygger's newer "Upgraded … – M",
  ASIN B0FJCZJ3C3, §3.5). This cannot be decided without resolving the links.
- The earlier sponge audit cited ASINs **B01N7Q0IPR** (AQUANEAT 10) and **B07KXDRFXP** (Powkoo). A
  direct search for each ASIN returned **no listing carrying that ASIN**; neither is corroborated.

---

## 3. Per-product evidence

### 3.1 `aquaneat-sponge-60` — AQUANEAT Bio Sponge Filter (Large up to 60 Gal)

| Item | Finding |
| --- | --- |
| Identity | Title match: Amazon ASIN **B071HVZVMP** "AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Large up to 60Gal)" — identical to the catalog name. Model **SF-A004** (manual). |
| Rating | **[MFR-DOC]** manuals.plus/asin/B071HVZVMP, "AQUANEAT Aquarium Bio Sponge Filter Instruction Manual (Large up to 60 Gallons)": *recommended for 40 to 60-gallon aquariums*; ~4.5" D × 8.0" H. **[MKT-BRAND]** Amazon title "Large up to 60Gal". |
| Other listings | **[MKT-BRAND]** Walmart 186627441 "… Nano Fish Tank 60 gal"; Walmart 5040531230 "… Nano Fish Tank **50 Gal**"; Amazon B07234RMMT 4-pack "(Large up to 60Gal)"; Amazon B07L56LB5G "Air Powered Sponge Filter … (Up to 60Gal)" (different product line). |
| Conflicts | Walmart "50 Gal" listing — a separate listing whose product identity is unknown; not the catalog item. Manual gives a minimum (40) the title omits. |
| Grade | **B** (manufacturer manual text, via mirror, via search index). Consistent with title. |
| Proposed rating | `manufacturerMaxGallons: 60`, `manufacturerMinGallons: 40` (display only), `ratingExpression: "range"` |
| Phase B | **Eligible for rating-based evaluation.** Pre-merge check: resolve `amzn.to/3KTUjUi` → expect B071HVZVMP. |

### 3.2 `hygger-double-sponge-s` — hygger Double Sponge Filter (S)

| Item | Finding |
| --- | --- |
| Identity | Title match: Amazon ASIN **B07RFL4JMM** "Hygger Aquarium Double Sponge Filter, Comes with 2 Spare Sponges, 1 Bag of Bio Ceramic Media Balls, Quiet Submersible Foam Filter for Fresh Water and Salt-Water Fish Tank (S)"; retailer mirror Happy Paws "…(S)" at `/products/b07rfl4jmm`. |
| Rating | **[MFR-SITE]** hygger-online.com "Fish Tank Double Sponge Water Filter" (`/product/fish-tank-water-filter/`): *Small … suggested for 10 to 40 gallon fish tanks*; package *1 double sponge filter with 2 containers, 1 bag of ceramic media balls, 2 spare sponges* (matches the catalog product). **[MKT-BRAND]** Amazon B07RFL4JMM: *6" W, 9"–13" H … suggested for 10 to 40 gallon*. **[RETAIL]** Aquatic Motiv "Hygger Sponge Filter 10 to 40 Gallons". |
| Conflicts | hygger sells **a different product**, "Aquarium (Double) Biochemical Sponge Filter" (`/product/hygger-aquarium-biochemical-sponge-filter/`, `/product/aquarium-biochemical-sponge-filter/`), indexed with **S 5–20 / M 20–55 / L 55–125 gal**, with depth and air-pump limits. In one search the tool attached the 10–40 / 15–55 figures to the "Double Biochemical" name — **attribution caveat**. Across four queries, 10–40 (S) / 15–55 (M) consistently co-occur with the "Double Sponge (Water) Filter" title, the 2-container + ceramic-balls + 2-spare-sponges package, and the ASINs above; 5–20 / 20–55 / 55–125 consistently co-occur with the Biochemical line's S/M/L and depth limits. eBay bundles S+M as "10–55 Gal" (range union, not a rating). Indexed S dimension "6 × 9 × 14 in" looks like a package size, not the unit. |
| Grade | **B** for the rating value (manufacturer domain, via search index), with the attribution caveat above. |
| Proposed rating | `manufacturerMaxGallons: 40`, `manufacturerMinGallons: 10`, `ratingExpression: "range"` |
| Phase B | **Eligible, conditional:** resolve `amzn.to/46Qxf0a` → expect B07RFL4JMM. If it resolves to a Biochemical-line product, the rating becomes **20** (S 5–20) and must be re-sourced. Brand-inconsistency note from the design (§16.2) stands: a 10–40 gal double sponge is generous. |

### 3.3 `hygger-double-sponge-m` — hygger Double Sponge Filter (M)

| Item | Finding |
| --- | --- |
| Identity | Title match: Amazon ASIN **B07RKT6QPV** "hygger Aquarium Double Sponge Filter for Fresh Water and Salt-Water Fish Tank (M)" — identical to catalog name. Same title at Supply AG; Walmart 209243859 "Hygger … Double Sponge Filter, M"; Aquanature "…(M)". |
| Rating | **[MFR-SITE]** hygger-online.com "Fish Tank Double Sponge Water Filter": *Medium … 6.3" × 9" × 14", suggested for 15 to 55 gallon fish tanks*. **[MKT-BRAND]** Amazon B07RKT6QPV (same text per index). |
| Conflicts | Same Biochemical-line conflict as §3.2 (Biochemical **M = 20–55**; max agrees at 55, min differs). hygger's newer **"Upgraded Sponge Filter with Larger Filtration Area … – M"**, ASIN **B0FJCZJ3C3**, is a different product; its rating was not found. **Two different affiliate links** in the repo (§2). |
| Grade | **B** (same caveat as §3.2). |
| Proposed rating | `manufacturerMaxGallons: 55`, `manufacturerMinGallons: 15`, `ratingExpression: "range"` |
| Phase B | **Eligible, conditional:** resolve **both** `amzn.to/3VTKSXo` and `amzn.to/46XUzsV`. If both → B07RKT6QPV: eligible. If either → B0FJCZJ3C3 or a Biochemical item: needs_review until that product's own rating is found. Note that for this product both candidate hygger lines end at 55, so the **maximum** is robust; only identity is open. |

### 3.4 `aquaneat-sponge-20` — AQUANEAT Bio Sponge Filter (Middle up to 20 Gal)

| Item | Finding |
| --- | --- |
| Identity | Title match: Amazon ASIN **B078Q29JT4** "AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Middle up to 20Gal)" — identical to catalog name. eBay 117319977278 same title. |
| Rating | **[MKT-BRAND]** Amazon title "Middle up to 20Gal"; indexed description *recommended tank size is up to 20 gallons*. No manual and no manufacturer-site page found (theaquaneat.com is indexed only at its home page). |
| Conflicts | None on the value. No dimensions found. |
| Grade | **C** (brand-authored marketplace listing only). |
| Proposed rating | `manufacturerMaxGallons: 20`, `ratingExpression: "up_to"` — **if** the §5 policy is amended; otherwise `null` + `needs_review`. |
| Phase B | **Rating needed** under the locked A/B rule. |

### 3.5 `pawfly-sponge-10` — Pawfly Nano Bio Sponge Filter (up to 10 Gallon)

| Item | Finding |
| --- | --- |
| Identity | Title match: Amazon ASIN **B09BNCRLZY** "Pawfly Aquarium Nano Bio Sponge Filter Quiet Betta Fry Shrimp and Small Fish Foam Filter for Tiny Fish Tank up to 10 Gallon" — identical to catalog name (amazon.com and amazon.ca). |
| Rating | **[MKT-BRAND]** title "up to 10 Gallon"; indexed description *2" D × 4.8" H, designed for 5–10 gallon tanks*. **[REVIEW]** reviewaqua.com "… (10 Gallon)". Pawfly's site (thepawfly.com) is indexed but returned no product page for this item. |
| Conflicts | Walmart 1476406157 "… for Fish Tank up to **5–60** Gallon" is a multi-size variant family listing (Pawfly sells separate 20, 50 and 60 gal sponges: B09T928T19, B09GLR2CMP, B098367LTZ), not a rating for this unit. Minimum 5 appears only in description text. Pawfly's 3-pack B0BDDYQQYC is "up to **3** Gallon" — a different (smaller) item; do not confuse. |
| Grade | **C**. |
| Proposed rating | `manufacturerMaxGallons: 10`, `manufacturerMinGallons: null` (or 5 display-only), `ratingExpression: "up_to"` — **if** the §5 policy is amended. |
| Phase B | **Rating needed** under the locked A/B rule. Pre-merge: resolve `amzn.to/3IXHtns` → expect B09BNCRLZY. |

### 3.6 `aquaneat-sponge-10` — "AQUANEAT Single Sponge Filter (Up to 10G)"

| Item | Finding |
| --- | --- |
| Identity | **Unresolved.** No AQUANEAT listing is titled "Single Sponge Filter". No affiliate link. ASIN B01N7Q0IPR (earlier audit) not corroborated. Candidates, all AQUANEAT and all "up to 10 gal": **B078HDL21V** (Bio Sponge Filter, Small up to 10Gal, 3-pack), **B078X7H8XG** (Bio **Corner** Sponge Filter, up to 10Gal, 2.25" × 2.25" × 5.00"), **B07P5WS1RH** / **B07KS1Y1JN** (**Double** Bio Sponge Filter, Small up to 10 Gal), **B08F79B7MS** (earlier audit), Walmart 711096713 (Bio Oxygen Sponge Filter 10 gal, **2.0" D × 4.75" H**), Walmart 964127842 (up to 10Gal with accessories). |
| Rating | Every candidate: **up to 10 gal** [MKT-BRAND]. The earlier audit's "2.0" D × 4.75" H" matches the Walmart "Bio Oxygen" listing, i.e. the single round "Small" sponge — the most likely match, but not proven. |
| Conflicts | Identity only; the value is consistent across candidates. |
| Grade | **C**; identity **low**. |
| Phase B | **Rating needed.** To become eligible: pick the exact product (ASIN + affiliate link) and source it; if the owner confirms it is the single round Small sponge (the Middle/Large family's small size), the value 10 is consistent, but a grade A/B source is still missing. |

### 3.7 `powkoo-dual-sponge-40` — "Powkoo Dual Sponge Filter (20–55G)"

| Item | Finding |
| --- | --- |
| Identity | **Unresolved.** No Powkoo listing is titled "Dual Sponge Filter (20–55G)". No affiliate link. ASIN B07KXDRFXP (earlier audit) not corroborated. Candidates: **B01M32L1LC** "Double Bio Sponge Filter with 2 Media Cups … Up to 55 Gallon" (amazon.com) but "Large … Up to **40** Gallon" / "**10 to 40** gallons" on **amazon.ca** for the **same ASIN**; **B01N6MJYWC** "Aquarium Double Sponge Filter … 1 Bag Bio Media" (no rating in title; earlier audit cited it); **B01M3VALFU** "Double Sponge Filter … 2 Media Chambers"; **B07MYTKZT5** "… 2 Media Chambers and 2 Bag Bio Balls"; **B01F8PGL6I** "Up to 20 Gallon". An indexed Powkoo description says *fits fish tank sizes from 15 to 55 gallons* (80 ppi) without a clear ASIN. eBay "up to 60 Gallons". |
| Rating | 15–55, up to 55, 10–40, up to 40, up to 20, up to 60 — depending on listing and marketplace. **No "20–55" found anywhere**; the catalog's "20–55G" appears to be invented or a mis-copy of 15–55. |
| Conflicts | **Material**: the same ASIN carries a 55-gal maximum in the US and a 40-gal maximum in Canada. |
| Grade | **C / conflicting**; identity **low**. |
| Phase B | **Rating needed.** Do not ship 55 as a verified maximum. |

---

## 4. Eligibility for rating-based evaluation (locked rule D1: A/B only)

| id | Grade | Identity | `ratingStatus` for phase B | Runtime result |
| --- | --- | --- | --- | --- |
| `aquaneat-sponge-60` | B | High | `verified` | Rating-based (max 60) |
| `hygger-double-sponge-s` | B | Medium-high | `verified` **after** §6 check 2 passes; else `needs_review` | Rating-based (max 40) |
| `hygger-double-sponge-m` | B | Medium | `verified` **after** §6 check 3 passes; else `needs_review` | Rating-based (max 55) |
| `aquaneat-sponge-20` | C | High | `needs_review` | **Rating needed** |
| `pawfly-sponge-10` | C | High | `needs_review` | **Rating needed** |
| `aquaneat-sponge-10` | C | Low | `needs_review` | **Rating needed** |
| `powkoo-dual-sponge-40` | C / conflict | Low | `needs_review` | **Rating needed** |

Effect on users under this outcome: the two ~10-gal nano sponges and the 20-gal AQUANEAT — the ones
most often chosen for nano/betta/shrimp tanks — would all show neutral **"Rating needed"** in phase B.
That is the honest reading of the evidence under the locked rule, but it is a noticeable UX cost;
§5 sets out the one decision that changes it.

---

## 5. Decision needed: does a brand-authored marketplace listing count as grade B?

AQUANEAT, Pawfly and Powkoo are essentially **Amazon-native brands**: their manufacturer sites index
little or no product detail, and the brand-authored Amazon listing (title + "About this item") is the
manufacturer's primary published specification. The earlier reports and this one grade that as **C**.

| Option | 3.4 AQUANEAT 20 | 3.5 Pawfly 10 | 3.6 AQUANEAT 10 | 3.7 Powkoo | Risk |
| --- | --- | --- | --- | --- | --- |
| **Keep strict (current lock)** | Rating needed | Rating needed | Rating needed | Rating needed | Nano sponges unrated; users can still enter the box number via the custom input |
| **Accept brand listing as B *only when* identity is high, the rating is in the title, and no conflict exists** (recommended if a change is wanted) | Eligible (20) | Eligible (10) | Rating needed (identity) | Rating needed (identity + conflict) | Relies on text that can change; title ratings are marketing figures (already true for every maker) |
| Accept any listing | Eligible | Eligible | Eligible (10) | Eligible (55?) | **Not recommended** — ships an unproven identity and a known US/CA conflict |

Recommendation: **either** keep strict **or** adopt the narrow middle option; in both cases
`aquaneat-sponge-10` and `powkoo-dual-sponge-40` stay "Rating needed" until their identity is fixed.
This is a product decision for the owner; it does not re-open the locked decisions, it only defines
what "manufacturer text" means for Amazon-native brands.

---

## 6. Checks that must happen before phase B data lands (need a normal browser)

These cannot be done from this environment (all fetches blocked) and are cheap for a human:

1. Resolve `amzn.to/3KTUjUi` → expect **B071HVZVMP** (AQUANEAT Large up to 60). Open the manual if
   linked from the listing; confirm "40–60".
2. Resolve `amzn.to/46Qxf0a` → expect **B07RFL4JMM** (hygger Double Sponge S). On the listing or
   hygger-online.com `/product/fish-tank-water-filter/`, confirm "S … 10 to 40 gallon". **→ grade A.**
3. Resolve **both** `amzn.to/3VTKSXo` and `amzn.to/46XUzsV` → expect **B07RKT6QPV** (hygger M).
   Confirm "M … 15 to 55 gallon". If one points to B0FJCZJ3C3 (Upgraded M) or a Biochemical item,
   decide which product the catalog id represents and fix the link (content change, separate PR).
4. Resolve `amzn.to/4mTK28f` → expect **B078Q29JT4** and `amzn.to/3IXHtns` → expect **B09BNCRLZY**.
5. `aquaneat-sponge-10`: choose the exact product (most likely the single round Small, 2.0" × 4.75")
   and add an ASIN + link; otherwise leave it Rating needed.
6. `powkoo-dual-sponge-40`: choose the exact product (B01M32L1LC is the only double-sponge listing
   carrying 55) and read its **US** listing; given the amazon.ca "up to 40" conflict, it should stay
   `needs_review` unless the maker's own text (packaging/manual photo) states 55.
7. Record, per product, the URL read, the date, and a verbatim quote — that turns B into **A**.

---

## 7. Proposed phase B rating metadata

The design's §7.3 fields are kept as-is. This report proposes three **additive, review-only** fields so
the evidence trail travels with the data (none is read by the engine; the engine reads only
`capacityMethod`, `manufacturerMaxGallons`, `ratingStatus`):

| Field | Type | Purpose |
| --- | --- | --- |
| `productRef` | `{ "asin": string \| null, "model": string \| null }` | The exact product the rating belongs to. Missing → identity unresolved → `needs_review`. |
| `ratingSourceKind` | `"manufacturer_site" \| "manufacturer_manual" \| "brand_listing" \| "retailer" \| "user"` | Section 1.3 evidence type, so a grade can be audited without this report. |
| `ratingCheckedAt` | ISO date | When the source was last read; ratings on marketplace text can drift. |

Proposed values (strict outcome; legacy `gphRated` / `minGallons` / `maxGallons` retained unchanged
per design §7.3 and phase E):

```jsonc
// aquaneat-sponge-60
{ "capacityMethod": "manufacturer_rating", "manufacturerMaxGallons": 60, "manufacturerMinGallons": 40,
  "ratingExpression": "range", "ratingStatus": "verified", "ratingConfidence": "B",
  "ratingSource": "https://manuals.plus/asin/B071HVZVMP", "ratingSourceKind": "manufacturer_manual",
  "productRef": { "asin": "B071HVZVMP", "model": "SF-A004" }, "ratingCheckedAt": "2026-09-28" }

// hygger-double-sponge-s   (verified only after §6 check 2)
{ "capacityMethod": "manufacturer_rating", "manufacturerMaxGallons": 40, "manufacturerMinGallons": 10,
  "ratingExpression": "range", "ratingStatus": "verified", "ratingConfidence": "B",
  "ratingSource": "https://www.hygger-online.com/product/fish-tank-water-filter/",
  "ratingSourceKind": "manufacturer_site",
  "productRef": { "asin": "B07RFL4JMM", "model": null }, "ratingCheckedAt": "2026-09-28" }

// hygger-double-sponge-m   (verified only after §6 check 3)
{ "capacityMethod": "manufacturer_rating", "manufacturerMaxGallons": 55, "manufacturerMinGallons": 15,
  "ratingExpression": "range", "ratingStatus": "verified", "ratingConfidence": "B",
  "ratingSource": "https://www.hygger-online.com/product/fish-tank-water-filter/",
  "ratingSourceKind": "manufacturer_site",
  "productRef": { "asin": "B07RKT6QPV", "model": null }, "ratingCheckedAt": "2026-09-28" }

// aquaneat-sponge-20   (strict: needs_review; the listed max is kept as a candidate, not used)
{ "capacityMethod": "manufacturer_rating", "manufacturerMaxGallons": null, "manufacturerMinGallons": null,
  "ratingExpression": "up_to", "ratingStatus": "needs_review", "ratingConfidence": "C",
  "ratingSource": "https://www.amazon.com/dp/B078Q29JT4", "ratingSourceKind": "brand_listing",
  "productRef": { "asin": "B078Q29JT4", "model": null }, "ratingCheckedAt": "2026-09-28" }
  // candidate max if §5 middle option is adopted: 20

// pawfly-sponge-10     (strict: needs_review; candidate max 10)
{ "capacityMethod": "manufacturer_rating", "manufacturerMaxGallons": null, "manufacturerMinGallons": null,
  "ratingExpression": "up_to", "ratingStatus": "needs_review", "ratingConfidence": "C",
  "ratingSource": "https://www.amazon.com/dp/B09BNCRLZY", "ratingSourceKind": "brand_listing",
  "productRef": { "asin": "B09BNCRLZY", "model": null }, "ratingCheckedAt": "2026-09-28" }

// aquaneat-sponge-10   (identity unresolved)
{ "capacityMethod": "manufacturer_rating", "manufacturerMaxGallons": null, "manufacturerMinGallons": null,
  "ratingExpression": "unclear", "ratingStatus": "needs_review", "ratingConfidence": "C",
  "ratingSource": null, "ratingSourceKind": "brand_listing",
  "productRef": { "asin": null, "model": null }, "ratingCheckedAt": "2026-09-28" }

// powkoo-dual-sponge-40 (identity unresolved + conflicting ratings)
{ "capacityMethod": "manufacturer_rating", "manufacturerMaxGallons": null, "manufacturerMinGallons": null,
  "ratingExpression": "unclear", "ratingStatus": "needs_review", "ratingConfidence": "C",
  "ratingSource": null, "ratingSourceKind": "brand_listing",
  "productRef": { "asin": null, "model": null }, "ratingCheckedAt": "2026-09-28" }
```

Notes for phase B (not done here):

- Keep a candidate maximum out of `manufacturerMaxGallons` whenever `ratingStatus` is `needs_review`,
  so no code path can accidentally read it. If it is useful to keep, put it in the report, not the data.
- Two catalog **display names** embed an unverified rating ("…(Up to 10G)", "…(20–55G)"). Once the
  status shows "Rating needed", the name would contradict it; phase B should either rename these two
  to the real listing title after identity is fixed, or show the name without the parenthetical.
  (Ids never change.)
- `data/gear_filters_ranges.csv` places hygger (S) in the 5–10 gal range and hygger (M) in both 10–20
  and 20–40; those gear-page placements are unrelated to the advisor but are inconsistent with the
  maker's ranges. Out of scope; noted for a gear-page content pass.

---

## 8. What this report does not change

- No edits to `assets/data/gearCatalog.json`, `assets/data/gear/filters.json`, `data/filters.json`
  or any CSV.
- No change to filtration scoring, thresholds, saved state v1/v2, the custom sponge input, or
  Stocking Load.
- Every existing sponge `gphRated` value stays in place (to be ignored in phase B, removed in phase E).
- No phase B code.

---

## 9. Sources (all read via search index on 2026-09-28; direct fetch blocked)

Manufacturer / manufacturer document:
- hygger — Fish Tank Double Sponge Water Filter: https://www.hygger-online.com/product/fish-tank-water-filter/
- hygger — Aquarium Double Biochemical Sponge Filter (conflicting line): https://www.hygger-online.com/product/hygger-aquarium-biochemical-sponge-filter/
- hygger — Aquarium Biochemical Sponge Filter: https://www.hygger-online.com/product/aquarium-biochemical-sponge-filter/
- AQUANEAT Large manual (SF-A004) mirror: https://manuals.plus/asin/B071HVZVMP
- AQUANEAT official site (home page only indexed): https://theaquaneat.com/
- Pawfly official site (no product page indexed): https://thepawfly.com/

Brand-authored marketplace listings:
- AQUANEAT Large up to 60: https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B071HVZVMP
- AQUANEAT Middle up to 20: https://www.amazon.com/Aquaneat-Sponge-Filter-Breeding-Aquarium/dp/B078Q29JT4
- AQUANEAT 10-gal candidates: https://www.amazon.com/clp/B078HDL21V · https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B078X7H8XG · https://www.amazon.com/Aquaneat-Sponge-Filter-Aquarium-Accessories/dp/B07P5WS1RH · https://amazon.com/Aquaneat-Sponge-Filter-Aquarium-Accessories/dp/B07KS1Y1JN · https://www.walmart.com/ip/Aquaneat-Aquarium-Bio-Oxygen-Sponge-Filter-Breeding-Fry-Betta-Shrimp-Nano-Fish-Tank-10-gal/711096713
- AQUANEAT 50 gal Walmart listing: https://www.walmart.com/ip/Aquaneat-Aquarium-Bio-Sponge-Filter-Breeding-Fry-Betta-Shrimp-Nano-Fish-Tank-50-Gal/5040531230
- hygger S: https://www.amazon.com/Hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RFL4JMM
- hygger M: https://www.amazon.com/Hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RKT6QPV
- hygger Upgraded M: https://www.amazon.com/hygger-Aquarium-Double-Sponge-Filter/dp/B0FJCZJ3C3
- Pawfly nano: https://www.amazon.com/clp/B09BNCRLZY · https://www.amazon.ca/Pawfly-Biochemical-Sponge-Filter-Breeding/dp/B09BNCRLZY
- Pawfly Walmart variant family: https://www.walmart.com/ip/Pawfly-Aquarium-Nano-Bio-Sponge-Filter-Quiet-Betta-Fry-Shrimp-and-Small-Fish-Foam-Filter-for-Fish-Tank-up-to-5-60-Gallon/1476406157
- Powkoo candidates: https://www.amazon.com/Powkoo-Double-Biochemical-Aquarium-Gallons/dp/B01M32L1LC · https://www.amazon.ca/Powkoo-Biochemical-Pre-Filter-Canister-Aquarium/dp/B01M32L1LC · https://www.amazon.com/Powkoo-Double-Sponge-Filter-Aquarium/dp/B01N6MJYWC · https://www.amazon.com/Powkoo-Double-Biochemical-Aquarium-Gallons/dp/B01M3VALFU · https://www.amazon.com/Powkoo-Aquarium-Filters-Sponge-Container/dp/B07MYTKZT5 · https://www.amazon.com/Powkoo-Sponge-Filter-Aquarium-Gallons/dp/B01F8PGL6I

Retailer / review:
- Aquatic Motiv (hygger 10–40): https://aquaticmotiv.com/products/hygger-sponge-filter-10-40-gallons
- Supply AG (hygger M): https://www.supplyag.com/products/hygger-aquarium-double-sponge-filter-for-fresh-water-and-salt-water-fish-tank-m
- Happy Paws (hygger S): https://www.happypawsboutiqueshop.com/products/b07rfl4jmm
- eBay hygger "10–55 Gal": https://www.ebay.com/itm/187341969631
- reviewaqua (Pawfly 10): https://www.reviewaqua.com/aquarium-pumps/aquarium-sponge-filter/pawfly-nano-bio-sponge-filter-quiet-foam-filter-for-tiny-fish-tank-10-gallon/
