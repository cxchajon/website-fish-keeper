# Stocking Advisor — sponge catalog rating evidence verification (phase B0, 2026-09)

Documentation / evidence only. Resolves (as far as the evidence allows) open item 1 of
`stocking-advisor-sponge-filter-migration-design-2026-09.md` §16: *"All seven sponge ratings …
are grade C. Each must be confirmed at A/B before it can produce green; anything not confirmable
ships as `needs_review` (Rating needed)."*

**Nothing in production changed.** `assets/data/gearCatalog.json`, filtration scoring, saved-state
behaviour, the custom sponge UI and every existing sponge `gphRated` value are untouched. No phase B
implementation is started.

Base: `main` @ `062078d`. Research dates: 2026-09-28 (initial pass and final cleanup).

---

## 0. Final classification (phase B0 result — LOCKED)

### 0.1 Two separate concepts: evidence classification vs runtime rating status

Evidence quality and runtime usability are **different questions** and use **different fields**.

**Evidence classification** (`ratingEvidence`) — *how good is the source?* Review metadata; never
read by the calculator.

| `ratingEvidence` | Meaning |
| --- | --- |
| `verified` | Directly defensible **manufacturer** rating: the maker's own official page / manual publishes the number for the exact size variant. |
| `supported` | Strong **exact-product, exact-variant** evidence from retailer / marketplace / distributor / third-party-manual sources, but manufacturer ownership of the source is **not** established (§1.4). |
| `needs_review` | Not strong enough: product identity unresolved, ratings conflict, or provenance too weak. |
| `unusable` | Evidence contradicts the product or is demonstrably wrong (none of the 7 today). |

**Runtime rating status** (`ratingStatus`) — *can the calculator use the rating?* This is the
**existing phase A vocabulary**, unchanged (`KNOWN_RATING_STATUSES` in
`js/stocking-advisor/filtration/math.js:96`). **No new runtime value is proposed** — in particular
there is **no** `ratingStatus: "supported"`.

| `ratingStatus` | Meaning in phase B |
| --- | --- |
| `verified` | Calculator may use `manufacturerMaxGallons` for ✓ Rated for this tank / ⚠ Below manufacturer rating. |
| `needs_review` | A rating number may be stored as review metadata, but the calculator **must not use it**; evaluates as ○ Rating needed. |
| `needed` | No usable rating at all (`manufacturerMaxGallons` null); evaluates as ○ Rating needed. |

**Mapping (locked):**

| Evidence | Runtime `ratingStatus` | Max stored? | Phase B v1 result |
| --- | --- | --- | --- |
| `verified` | `verified` | yes | Rating-based evaluation; may be green |
| `supported` | `needs_review` | yes (review metadata only) | ○ Rating needed |
| `needs_review` | `needed` | **no** (null) | ○ Rating needed |
| `unusable` | `needed` | no | ○ Rating needed |

Engine consequence for phase B: the adequacy check must gate on **`ratingStatus === "verified"`**,
never on the mere presence of `manufacturerMaxGallons` — a SUPPORTED record carries a max it is not
allowed to use.

### 0.2 Green eligibility — LOCKED for the first phase B release

- **Only VERIFIED manufacturer ratings** may independently produce **✓ Rated for this tank**.
- **SUPPORTED ratings do not produce green** in phase B v1. SUPPORTED products stay **selectable** and
  evaluate as **○ Rating needed** (neutral), exactly like unrated products.
- This is intentionally conservative. Promoting a SUPPORTED product later needs either
  manufacturer-controlled evidence (→ `verified`) or a separate, explicit product decision.

### 0.3 Per product

| id | Exact product | Evidence | Runtime `ratingStatus` | Min–max stored | Phase B v1 |
| --- | --- | --- | --- | --- | --- |
| `hygger-double-sponge-s` | ASIN **B07RFL4JMM** (hygger Double Sponge, **S**) | **VERIFIED** | `verified` | 10–40 | **Green-eligible** |
| `hygger-double-sponge-m` | ASIN **B07RKT6QPV** (hygger Double Sponge, **M**) | **VERIFIED** | `verified` | 15–55 | **Green-eligible** |
| `aquaneat-sponge-60` | ASIN **B071HVZVMP**, model **SF-A004** | **SUPPORTED** | `needs_review` | 40–60 (review only) | Rating needed |
| `aquaneat-sponge-20` | ASIN **B078Q29JT4**, model **SF-A001** (owner-supplied) | **SUPPORTED** | `needs_review` | — / 20 (review only) | Rating needed |
| `aquaneat-sponge-10` | **Unresolved** | **NEEDS REVIEW** | `needed` | null / null | Rating needed |
| `pawfly-sponge-10` | ASIN **B09BNCRLZY** | **NEEDS REVIEW** | `needed` | null / null | Rating needed |
| `powkoo-dual-sponge-40` | **Unresolved** | **NEEDS REVIEW** | `needed` | null / null | Rating needed |

### 0.4 Counts (not collapsed)

| Classification | Count | ids |
| --- | --- | --- |
| **VERIFIED** | **2** | `hygger-double-sponge-s`, `hygger-double-sponge-m` |
| **SUPPORTED** | **2** | `aquaneat-sponge-60`, `aquaneat-sponge-20` |
| **RATING NEEDED / NEEDS REVIEW** | **3** | `aquaneat-sponge-10`, `pawfly-sponge-10`, `powkoo-dual-sponge-40` |

Green-eligible in phase B v1: **2**. Rating needed in phase B v1: **5** (2 SUPPORTED + 3 NEEDS REVIEW).

- Exact product identity is **unresolved for 2 products** (`aquaneat-sponge-10`, `powkoo-dual-sponge-40`).
- **Two catalog display names embed an unverified gallon claim** ("…(Up to 10G)", "…(20–55G)"); more
  broadly, sponge display names should carry no capacity claim at all (§7).
- No source anywhere publishes a **water-flow GPH** for any of the seven.

### 0.5 Phase B readiness

**Phase B can proceed with the conservative model.** It does **not** require all 7 catalog products
to have verified ratings. Phase B should:

- switch **all** sponge filters away from fake GPH (type-wins / `capacityMethod: "manufacturer_rating"`);
- allow **only the 2 VERIFIED hygger ratings** to green-pass from catalog metadata;
- keep the other **5** products **selectable**;
- show **○ Rating needed** for those 5;
- preserve SUPPORTED rating evidence (AQUANEAT 60 / 20) as **review metadata** (`needs_review` + stored max);
- let custom-sponge users enter their own manufacturer-rated tank size ("Rated for up to ___ gallons",
  labelled user-entered);
- **neutralize gallon claims in sponge display names** (ids unchanged, §7);
- **never fall back to historical sponge GPH** — for any sponge, any status, any saved state.

---
## 1. Method, limits and source rule

### 1.1 What was tried

| Channel | Result |
| --- | --- |
| `curl` via agent proxy: hygger-online.com, theaquaneat.com / aquaneat.com, pawfly.com, powkoo.com, amazon.com, manuals.plus, `amzn.to` short links | **All refused** (`connect_rejected`, organisation egress policy) |
| `WebFetch`: hygger-online.com, `amzn.to`, supplyag.com, reviewaqua.com | **All refused** (`EGRESS_BLOCKED`) |
| `WebSearch` (search-index titles + snippets) | Works; used for every product. |
| **Owner-supplied direct reading** (phase B0 review, 2026-09-28) | hygger official pages (HG256, HG908) read directly by the site owner; exact-ASIN product records for B07RFL4JMM / B07RKT6QPV; AQUANEAT Middle model SF-A001; Pawfly B09BNCRLZY "≈ 20–40 L" text. Recorded as such in §3. |
| Repo trail (`data/gear_filters_ranges.csv`, `assets/data/gear/filters.json`, `data/filters.json`, `gear/index.html`, earlier reports) | Read in full for the 7 ids |

The six `amzn.to` affiliate links in the repo **could not be resolved** from this environment.

### 1.2 Historical grade scale (research notes only — not production metadata)

The earlier reports and the first B0 pass used letter grades. They are kept here only to read that
history; **they are not part of the proposed phase B metadata** (§8), because a letter mixes source
quality with how the source happened to be accessed (e.g. "B" meant "manufacturer text, but only via
search index"). Phase B records explicit provenance instead (`ratingEvidence` + `ratingSourceKind`).

| Grade (historical) | Meaning |
| --- | --- |
| A | Read directly on the manufacturer's page or manual |
| B | Manufacturer or manufacturer-document text via search index |
| C | Retailer / marketplace listing, secondary site, forum |
| D | Derived by repo code |
| E | No source |
### 1.3 Evidence-type tags used in §3

- **[MFR-SITE]** manufacturer's own domain (hygger-online.com, theaquaneat.com, thepawfly.com)
- **[MFR-DOC-MIRROR]** a manufacturer manual hosted by a third party (manuals.plus, device.report)
- **[MKT]** marketplace listing (Amazon, Walmart, eBay) — brand field shown, operator not established
- **[RETAIL]** third-party retailer / distributor
- **[REVIEW]** hobby / review site
- **[OWNER]** read directly by the site owner during phase B0 review

### 1.4 Marketplace source rule — **LOCKED (phase B0 review, 2026-09-28)**

A marketplace listing can count as **manufacturer-grade (Tier 2) evidence only when there is
evidence that all three hold:**

1. the exact product / ASIN is identified;
2. the exact size variant is identified;
3. the listing is operated / published by the manufacturer or brand, or equivalent provenance is clear.

A listing merely showing "Brand: AQUANEAT", "Brand: Pawfly" or "Brand: Powkoo" does **not** prove the
listing itself is manufacturer-operated. Therefore:

- **Search-result text from Amazon alone is never enough for VERIFIED.**
- A strong exact-product, exact-variant retailer / distributor / marketplace listing may support
  **SUPPORTED**, not VERIFIED, unless source ownership is established.
- A catalog display name is **never** evidence (it was written by this site, §2).

This supersedes the initial pass's §5 question ("does a brand-authored listing count as B?"): it does
not, unless ownership is shown.

---

## 2. Repo identity trail for the 7 runtime products

| id | Catalog name (`gearCatalog.json`) | Affiliate link in repo | Where |
| --- | --- | --- | --- |
| `aquaneat-sponge-10` | AQUANEAT Single Sponge Filter (Up to 10G) | **none** | `data/filters.json`, `assets/data/gear/filters.json` (no `url`) |
| `aquaneat-sponge-20` | AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Middle up to 20Gal) | `https://amzn.to/4mTK28f` | `data/gear_filters_ranges.csv:7`, `assets/data/gear/filters.json` |
| `aquaneat-sponge-60` | … (Large up to 60Gal) | `https://amzn.to/3KTUjUi` | `data/gear_filters_ranges.csv:11`, `assets/data/gear/filters.json` |
| `hygger-double-sponge-s` | hygger Aquarium Double Sponge Filter, Comes with 2 Spare Sponges (S) | `https://amzn.to/46Qxf0a` | `data/gear_filters_ranges.csv:3`, `assets/data/gear/filters.json` |
| `hygger-double-sponge-m` | hygger Aquarium Double Sponge Filter for Fresh Water and Salt-Water Fish Tank (M) | **two different links:** `https://amzn.to/3VTKSXo` (10–20 gal row) and `https://amzn.to/46XUzsV` (20–40 gal row) | `data/gear_filters_ranges.csv:6` and `:8`; `assets/data/gear/filters.json` uses `46XUzsV` |
| `pawfly-sponge-10` | Pawfly Aquarium Nano Bio Sponge Filter Quiet Betta Fry Shrimp and Small Fish Foam Filter for Tiny Fish Tank up to 10 Gallon | `https://amzn.to/3IXHtns` | `data/gear_filters_ranges.csv:2`, `assets/data/gear/filters.json` |
| `powkoo-dual-sponge-40` | Powkoo Dual Sponge Filter (20–55G) | **none** | `data/filters.json`, `assets/data/gear/filters.json` (no `url`) |

- `aquaneat-sponge-10` and `powkoo-dual-sponge-40` were hand-entered on 2025-10-12 (commit `5a00e35d`,
  sponge model audit §3) with **short, invented display names** and no link. The gallon text in those
  names is not tied to any source.
- The earlier sponge audit cited ASINs **B01N7Q0IPR** (AQUANEAT 10) and **B07KXDRFXP** (Powkoo). A
  direct search for each returned **no listing carrying that ASIN**; neither is corroborated, and
  neither is adopted here.

---

## 3. Per-product evidence

### 3.1 `hygger-double-sponge-s` — **VERIFIED, 10–40 gal**

| Item | Finding |
| --- | --- |
| Identity | Catalog ASIN **B07RFL4JMM** — Amazon title "Hygger Aquarium Double Sponge Filter, Comes with 2 Spare Sponges, 1 Bag of Bio Ceramic Media Balls, … (S)". **[OWNER]** independent exact-ASIN product records identify B07RFL4JMM as the **Small / 40-gallon** product. |
| Official evidence 1 | **[MFR-SITE] [OWNER]** https://www.hygger-online.com/product/hygger-aquarium-biochemical-sponge-filter/ — hygger **SKU HG256**, **Small: 10–40 gallons**, Medium: 15–55 gallons. Search index independently corroborates: *"The small double sponge filter is 6″ x 9″ x 14″, suggested for 10 to 40 gallon fish tanks … HG256 … fits tanks with a capacity of 10 to 55 gallons."* |
| Official evidence 2 | **[MFR-SITE] [OWNER]** https://www.hygger-online.com/product/fish-tank-water-filter/ — hygger **HG908** family, **Dual Small: 10–40 gallons**, Dual Medium: 15–55 gallons. Search index: HG-908 "0.5–55 gallons" family text; distributor Isaan Aquatics lists **HG-908-D-S** "Double Sponge Filter" (dual small). |
| Supporting | **[MKT]** Amazon B07RFL4JMM "suggested for 10 to 40 gallon". **[RETAIL]** Aquatic Motiv "Hygger Sponge Filter 10 to 40 Gallons". |
| Earlier conflict — resolved | The initial pass saw an S 5–20 / M 20–55 / L 55–125 range attributed to a "Biochemical" page. That range belongs to hygger's separate **single** "Aquarium Biochemical Sponge Filter" (`/product/aquarium-biochemical-sponge-filter/`, three sizes with depth / air-pump limits), not to HG256 (`/hygger-aquarium-biochemical-sponge-filter/`) or HG908. It is not a rating for the catalog item. |
| SKU mapping | **Not proven** whether historical B07RFL4JMM is HG256 or HG908-D-S. The affiliate link `amzn.to/46Qxf0a` could not be resolved. **This does not affect the rating:** both official families publish the same Small maximum (40) and the same minimum (10). |
| Status | **VERIFIED** (evidence `verified`, runtime `ratingStatus: "verified"`, `ratingSourceKind: "manufacturer_official"`) — `manufacturerMinGallons: 10`, `manufacturerMaxGallons: 40`, `ratingExpression: "range"`. **Green-eligible.** Historical HG256 vs HG908 mapping is a provenance note only; it does not downgrade the rating. |

### 3.2 `hygger-double-sponge-m` — **VERIFIED, 15–55 gal**

| Item | Finding |
| --- | --- |
| Identity | Catalog ASIN **B07RKT6QPV** — Amazon title "hygger Aquarium Double Sponge Filter for Fresh Water and Salt-Water Fish Tank (M)", identical to the catalog name. **[OWNER]** independent exact-ASIN product records identify B07RKT6QPV as the **Medium / 55-gallon** product. |
| Official evidence | **[MFR-SITE] [OWNER]** HG256 page: **Medium: 15–55 gallons**. HG908 page: **Dual Medium: 15–55 gallons**. Search index: *"The medium double sponge filter is 6.3″ x 9″ x 14″, suggested for 15 to 55 gallon fish tanks."* |
| Supporting | **[MKT]** Amazon B07RKT6QPV; Walmart 209243859 "… Double Sponge Filter, M"; **[RETAIL]** Supply AG, Aquanature (same title). |
| Open items | (a) HG256 vs HG908-D-M mapping not proven — same maximum either way. (b) The repo holds **two different affiliate links** for this id (§2). If either resolves to hygger's newer "Upgraded … – M" (ASIN B0FJCZJ3C3) or to a different product, that link should be corrected in a separate content change; the catalog id's rating stays tied to B07RKT6QPV. |
| Status | **VERIFIED** (evidence `verified`, runtime `ratingStatus: "verified"`, `ratingSourceKind: "manufacturer_official"`) — `manufacturerMinGallons: 15`, `manufacturerMaxGallons: 55`, `ratingExpression: "range"`. **Green-eligible.** SKU mapping and the duplicate link are provenance notes only; they do not downgrade the rating. |

### 3.3 `aquaneat-sponge-60` — **SUPPORTED, 40–60 gal (Rating needed in phase B v1)**

| Item | Finding |
| --- | --- |
| Identity | ASIN **B071HVZVMP** "AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Large up to 60Gal)" — identical to catalog name. Model **SF-A004**. |
| Rating | **[MFR-DOC-MIRROR]** manuals.plus/asin/B071HVZVMP "AQUANEAT Aquarium Bio Sponge Filter Instruction Manual (Large up to 60 Gallons)": *recommended for 40 to 60-gallon aquariums*; ~4.5" D × 8.0" H. **[MKT]** Amazon title "Large up to 60Gal". |
| Other listings | **[MKT]** Walmart 186627441 "… 60 gal"; Walmart 5040531230 "… **50 Gal**" (identity unknown — not the catalog item); Amazon B07234RMMT 4-pack "(Large up to 60Gal)". |
| Why not VERIFIED | No AQUANEAT-controlled source was read. theaquaneat.com indexes only its home page; the manual was seen only through a third-party mirror via search index; Amazon provenance not established (§1.4). |
| Status | **SUPPORTED** (evidence `supported`, runtime `ratingStatus: "needs_review"`, `ratingSourceKind: retailer_exact_product + third_party_manual`) — `manufacturerMinGallons: 40`, `manufacturerMaxGallons: 60` kept as review metadata, `ratingExpression: "range"`. **Not green-eligible in phase B v1** → ○ Rating needed. |

### 3.4 `aquaneat-sponge-20` — **SUPPORTED, up to 20 gal (Rating needed in phase B v1)**

| Item | Finding |
| --- | --- |
| Identity | ASIN **B078Q29JT4** "AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Middle up to 20Gal)" — identical to catalog name. Model **SF-A001** **[OWNER]** (not found by model number in the search index). |
| Rating | **[MKT]** title "Middle up to 20Gal"; indexed description *recommended tank size: up to 20 gallons*; 3.0" D × 6.5" H. No manual or AQUANEAT-site page found. |
| Conflicts | None on the value. Several *other* AQUANEAT products are also "up to 20 gal" (corner B079M732S6, air-powered B07L565N7H) — different products, not substitutes. |
| Why not VERIFIED | Marketplace text only; provenance not established (§1.4). |
| Status | **SUPPORTED** (evidence `supported`, runtime `ratingStatus: "needs_review"`, `ratingSourceKind: retailer_exact_product`) — `manufacturerMinGallons: null`, `manufacturerMaxGallons: 20` kept as review metadata, `ratingExpression: "up_to"`. **Not green-eligible in phase B v1** → ○ Rating needed. |

### 3.5 `aquaneat-sponge-10` — **NEEDS REVIEW → Rating needed**

| Item | Finding |
| --- | --- |
| Identity | **Unresolved.** No AQUANEAT listing is titled "Single Sponge Filter". No affiliate link. ASIN B01N7Q0IPR (earlier audit) not corroborated. Candidates include B078HDL21V (Small, 3-pack), B078X7H8XG (corner, 2.25" × 2.25" × 5.00"), B07P5WS1RH / B07KS1Y1JN (double, small), B08F79B7MS, Walmart 711096713 (2.0" D × 4.75" H), Walmart 964127842. |
| Rating | Each candidate is marketed "up to 10 gal". **This is not used**: the exact product must not be inferred from the fact that every candidate appears to share a rating, and the catalog display name "(Up to 10G)" is not evidence. |
| Status | **NEEDS REVIEW → Rating needed** (evidence `needs_review`, runtime `ratingStatus: "needed"`) — `manufacturerMinGallons: null`, `manufacturerMaxGallons: null`. To change: the owner selects the exact product (ASIN + link), then it is sourced under §1.4. |

### 3.6 `pawfly-sponge-10` — **NEEDS REVIEW → Rating needed (pending stronger source provenance)**

| Item | Finding |
| --- | --- |
| Identity | ASIN **B09BNCRLZY** "Pawfly Aquarium Nano Bio Sponge Filter Quiet Betta Fry Shrimp and Small Fish Foam Filter for Tiny Fish Tank up to 10 Gallon" (amazon.com and amazon.ca). |
| Evidence under review (not metadata) | **[MKT]** title "up to 10 Gallon"; description "2" D × 4.8" H, designed for 5–10 gallon tanks". **[OWNER]** listings describing approximately **20–40 L** (≈ 5–10.5 gal). **[REVIEW]** reviewaqua "(10 Gallon)". Likely maximum ≈ **10 gal**. |
| Inconsistencies | Search-index title text varies across listings for the family: Walmart 1476406157 "… up to **5–60** Gallon" (variant family), 3-pack B0BDDYQQYC "up to **3** Gallon" (different item), B098SGW6QS 3-pack "up to 10 Gallon". thepawfly.com indexed, no product page found. |
| Why not SUPPORTED | Provenance weaker than the AQUANEAT items and titles inconsistent within the family; no Pawfly-controlled listing established. |
| Status | **NEEDS REVIEW → Rating needed** (evidence `needs_review`, runtime `ratingStatus: "needed"`) — `manufacturerMinGallons: null`, `manufacturerMaxGallons: null`. The ≈ 10 gal figure stays in these research notes only and is **not** used for phase B scoring. |

### 3.7 `powkoo-dual-sponge-40` — **NEEDS REVIEW → Rating needed (pending exact product identity)**

| Item | Finding |
| --- | --- |
| Identity | **Unresolved.** No Powkoo listing is titled "Dual Sponge Filter (20–55G)". No affiliate link. ASIN B07KXDRFXP (earlier audit) not corroborated. |
| Conflicting Powkoo listings | B01M32L1LC "… Up to 55 Gallon" on amazon.com but "Large … Up to **40** Gallon" / "10 to 40 gallons" on **amazon.ca** (same ASIN); B01N6MJYWC (no rating in title); B01M3VALFU; B07MYTKZT5; B01F8PGL6I "Up to 20 Gallon"; an indexed Powkoo description "15 to 55 gallons" with no clear ASIN; eBay "up to 60 Gallons". **"20–55" appears in no source.** |
| Rule | Do not encode 20–55; do not substitute another Powkoo ASIN because it looks similar. |
| Status | **NEEDS REVIEW → Rating needed** (evidence `needs_review`, runtime `ratingStatus: "needed"`) — `manufacturerMinGallons: null`, `manufacturerMaxGallons: null`. Do not encode 20–55. |

---

## 4. Eligibility for rating-based evaluation (phase B v1)

| id | Evidence | Runtime `ratingStatus` | Max the engine may use | Green-eligible in phase B v1 |
| --- | --- | --- | --- | --- |
| `hygger-double-sponge-s` | VERIFIED | `verified` | 40 | **Yes** |
| `hygger-double-sponge-m` | VERIFIED | `verified` | 55 | **Yes** |
| `aquaneat-sponge-60` | SUPPORTED | `needs_review` | none (60 stored, not used) | **No** — Rating needed |
| `aquaneat-sponge-20` | SUPPORTED | `needs_review` | none (20 stored, not used) | **No** — Rating needed |
| `aquaneat-sponge-10` | NEEDS REVIEW | `needed` | none | **No** — Rating needed |
| `pawfly-sponge-10` | NEEDS REVIEW | `needed` | none | **No** — Rating needed |
| `powkoo-dual-sponge-40` | NEEDS REVIEW | `needed` | none | **No** — Rating needed |

All seven remain selectable. Users can enter the number printed on their own box through the phase B
custom sponge input ("Rated for up to ___ gallons"), labelled as user-entered; that path is
unaffected by these statuses.

---

## 5. SUPPORTED and green — decision LOCKED

Decided at the phase B0 review (2026-09-28): **SUPPORTED does not produce green in the first phase B
release.** It maps to runtime `needs_review` (§0.1) and evaluates as ○ Rating needed. The earlier
options (SUPPORTED passes with a qualifier; SUPPORTED amber-only) are **not adopted** for v1. Any later
change requires either manufacturer-controlled evidence that moves the product to `verified`, or a
new explicit product decision recorded in a report.

---
## 6. Checks still worth doing (normal browser; not blocking the B0 report)

1. Resolve `amzn.to/46Qxf0a` (expect B07RFL4JMM) and **both** `amzn.to/3VTKSXo` / `amzn.to/46XUzsV`
   (expect B07RKT6QPV); note whether each maps to HG256 or HG908-D-S / -M. Correct any link that
   points to a different product in a separate content change.
2. Resolve `amzn.to/3KTUjUi` (expect B071HVZVMP) and `amzn.to/4mTK28f` (expect B078Q29JT4). Look for an
   AQUANEAT-controlled source (brand store ownership, official manual PDF, packaging) — that would move
   either to VERIFIED.
3. Resolve `amzn.to/3IXHtns` (expect B09BNCRLZY); look for a Pawfly-controlled source.
4. `aquaneat-sponge-10` / `powkoo-dual-sponge-40`: the owner decides which exact product each id
   represents (or retires / renames it); only then can a rating be sourced.
5. For every product record URL, date and a verbatim quote.

---

## 7. Product display names — phase B recommendation

### 7.1 Finding

Two current display names **contain an unverified gallon claim** that no source ties to the product:

| id | Display name | Evidence | Problem |
| --- | --- | --- | --- |
| `aquaneat-sponge-10` | AQUANEAT Single Sponge Filter **(Up to 10G)** | NEEDS REVIEW | Name asserts a rating for a product whose identity is unknown. |
| `powkoo-dual-sponge-40` | Powkoo Dual Sponge Filter **(20–55G)** | NEEDS REVIEW | Name asserts a range **found in no source**; Powkoo listings say 55, 40, 20 or 60. |

The other names are real listing titles, but four of them also carry capacity text
("Middle up to 20Gal", "Large up to 60Gal", "up to 10 Gallon") on products that will show
**○ Rating needed** in phase B v1.

### 7.2 Recommendation (for phase B)

**Sponge-filter display names should not carry tank-capacity claims.** The tank rating is shown only
through structured rating metadata (the status line, driven by `ratingStatus` and
`manufacturerMaxGallons`). This removes contradictions such as:

> AQUANEAT … (Middle up to 20Gal) — ○ Rating needed
>
> Powkoo Dual Sponge Filter (20–55G) — ○ Rating needed

Phase B should neutralize gallon claims in every sponge display name, **keeping product ids
unchanged**. Conceptual examples (exact wording is a phase B edit):

| id | Current name | Neutral name (concept) |
| --- | --- | --- |
| `aquaneat-sponge-10` | AQUANEAT Single Sponge Filter (Up to 10G) | AQUANEAT Single Sponge Filter |
| `aquaneat-sponge-20` | AQUANEAT … Nano Fish Tank (Middle up to 20Gal) | AQUANEAT Bio Sponge Filter — Middle |
| `aquaneat-sponge-60` | AQUANEAT … Nano Fish Tank (Large up to 60Gal) | AQUANEAT Bio Sponge Filter — Large |
| `pawfly-sponge-10` | Pawfly … Foam Filter for Tiny Fish Tank up to 10 Gallon | Pawfly Nano Bio Sponge Filter |
| `powkoo-dual-sponge-40` | Powkoo Dual Sponge Filter (20–55G) | Powkoo Dual Sponge Filter |
| `hygger-double-sponge-s` | hygger … Comes with 2 Spare Sponges (S) | unchanged (no capacity claim; size letter only) |
| `hygger-double-sponge-m` | hygger … Salt-Water Fish Tank (M) | unchanged (no capacity claim; size letter only) |

- Size / variant words (S, M, Middle, Large) stay: they identify the product, not its capacity.
- **Ids never change** — saved state, links and phase A v2 entries resolve by id.
- The catalog is **not** edited in phase B0.

Related, out of scope: `data/gear_filters_ranges.csv` places hygger (S) in the 5–10 gal range and
hygger (M) in both 10–20 and 20–40; inconsistent with hygger's 10–40 / 15–55. Gear-page content pass.

---

## 8. Proposed phase B rating metadata (final)

### 8.1 Fields

Runtime fields (already recognised and passed through by phase A — `pickPassthroughFields` in
`math.js`, catalog copy in `js/gear-data.js:101`):

| Field | Values | Read by engine? |
| --- | --- | --- |
| `capacityMethod` | `"manufacturer_rating"` for every sponge | yes |
| `manufacturerMinGallons` | number \| null | display only |
| `manufacturerMaxGallons` | number \| null | **only when `ratingStatus === "verified"`** |
| `ratingStatus` | `"verified" \| "needs_review" \| "needed"` (existing enum, **not extended**) | yes |
| `ratingExpression` | `"range" \| "up_to" \| "min_only" \| "unclear"` | no |

Review-only provenance fields (not read by the engine; phase A's catalog loader does not copy them
into runtime entries, which is fine):

| Field | Values | Purpose |
| --- | --- | --- |
| `ratingEvidence` | `"verified" \| "supported" \| "needs_review" \| "unusable"` | Evidence classification (§0.1). |
| `ratingSourceKind` | `"manufacturer_official" \| "third_party_manual" \| "retailer_exact_product" \| "search_index_only" \| "none"` (array allowed when several apply) | Explicit provenance — replaces letter grades. |
| `ratingSource` | URL \| null | Primary source. |
| `productRef` | `{ "asin": string \| null, "model": string \| null }` | Exact product the rating belongs to. |
| `ratingCheckedAt` | ISO date | Marketplace text can drift. |
| `ratingNote` | string (optional) | Provenance caveats (e.g. SKU mapping). |

**No letter grades** (`A/B/C`, the design's former `ratingConfidence`) in the proposed production
metadata.

Rules:

- `ratingStatus: "verified"` requires `ratingEvidence: "verified"` and a positive `manufacturerMaxGallons`.
- `ratingStatus: "needs_review"` may carry a stored max (SUPPORTED evidence); the engine ignores it.
- `ratingStatus: "needed"` → `manufacturerMinGallons` and `manufacturerMaxGallons` are **null**.
- Legacy `gphRated` / `minGallons` / `maxGallons` stay in the data until phase E (design §7.3) and are
  **never** read for a `manufacturer_rating` record.

### 8.2 Values (locked)

```jsonc
// hygger-double-sponge-s — VERIFIED → green-eligible
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": 10, "manufacturerMaxGallons": 40, "ratingExpression": "range",
  "ratingStatus": "verified",
  "ratingEvidence": "verified", "ratingSourceKind": "manufacturer_official",
  "ratingSource": "https://www.hygger-online.com/product/hygger-aquarium-biochemical-sponge-filter/",
  "productRef": { "asin": "B07RFL4JMM", "model": null },
  "ratingNote": "Official hygger HG256 and HG908 pages both publish Small 10–40 gal; historical HG256 vs HG908-D-S mapping of this ASIN not proven.",
  "ratingCheckedAt": "2026-09-28" }

// hygger-double-sponge-m — VERIFIED → green-eligible
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": 15, "manufacturerMaxGallons": 55, "ratingExpression": "range",
  "ratingStatus": "verified",
  "ratingEvidence": "verified", "ratingSourceKind": "manufacturer_official",
  "ratingSource": "https://www.hygger-online.com/product/hygger-aquarium-biochemical-sponge-filter/",
  "productRef": { "asin": "B07RKT6QPV", "model": null },
  "ratingNote": "Official hygger HG256 and HG908 pages both publish Medium 15–55 gal; HG256 vs HG908-D-M mapping not proven; repo has two affiliate links for this id.",
  "ratingCheckedAt": "2026-09-28" }

// aquaneat-sponge-60 — SUPPORTED → Rating needed in phase B v1
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": 40, "manufacturerMaxGallons": 60, "ratingExpression": "range",
  "ratingStatus": "needs_review",
  "ratingEvidence": "supported", "ratingSourceKind": ["retailer_exact_product", "third_party_manual"],
  "ratingSource": "https://manuals.plus/asin/B071HVZVMP",
  "productRef": { "asin": "B071HVZVMP", "model": "SF-A004" },
  "ratingCheckedAt": "2026-09-28" }

// aquaneat-sponge-20 — SUPPORTED → Rating needed in phase B v1
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": null, "manufacturerMaxGallons": 20, "ratingExpression": "up_to",
  "ratingStatus": "needs_review",
  "ratingEvidence": "supported", "ratingSourceKind": "retailer_exact_product",
  "ratingSource": "https://www.amazon.com/dp/B078Q29JT4",
  "productRef": { "asin": "B078Q29JT4", "model": "SF-A001" },
  "ratingNote": "Model SF-A001 is owner-supplied provenance.",
  "ratingCheckedAt": "2026-09-28" }

// aquaneat-sponge-10 — NEEDS REVIEW → Rating needed (identity unresolved)
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": null, "manufacturerMaxGallons": null, "ratingExpression": "unclear",
  "ratingStatus": "needed",
  "ratingEvidence": "needs_review", "ratingSourceKind": "none",
  "ratingSource": null, "productRef": { "asin": null, "model": null },
  "ratingNote": "Exact product unresolved; catalog display-name rating is not evidence.",
  "ratingCheckedAt": "2026-09-28" }

// pawfly-sponge-10 — NEEDS REVIEW → Rating needed (provenance); ≈10 gal kept in research notes only
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": null, "manufacturerMaxGallons": null, "ratingExpression": "unclear",
  "ratingStatus": "needed",
  "ratingEvidence": "needs_review", "ratingSourceKind": "search_index_only",
  "ratingSource": null, "productRef": { "asin": "B09BNCRLZY", "model": null },
  "ratingCheckedAt": "2026-09-28" }

// powkoo-dual-sponge-40 — NEEDS REVIEW → Rating needed (identity unresolved; do not encode 20–55)
{ "capacityMethod": "manufacturer_rating",
  "manufacturerMinGallons": null, "manufacturerMaxGallons": null, "ratingExpression": "unclear",
  "ratingStatus": "needed",
  "ratingEvidence": "needs_review", "ratingSourceKind": "none",
  "ratingSource": null, "productRef": { "asin": null, "model": null },
  "ratingNote": "Exact product unresolved; conflicting Powkoo listings; 20–55 appears in no source.",
  "ratingCheckedAt": "2026-09-28" }
```

---
## 9. What this report does not change

- No edits to `assets/data/gearCatalog.json`, `assets/data/gear/filters.json`, `data/filters.json`
  or any CSV; no display name is renamed.
- No change to filtration scoring, thresholds, saved state v1/v2, the custom sponge input, or
  Stocking Load.
- Every existing sponge `gphRated` value stays in place (ignored in phase B, removed in phase E).
- No phase B code.

---

## 10. Sources

Manufacturer (hygger official):
- hygger HG256 — Aquarium Double Biochemical Sponge Filter: https://www.hygger-online.com/product/hygger-aquarium-biochemical-sponge-filter/ **[MFR-SITE][OWNER]**
- hygger HG908 — Fish Tank Double Sponge Water Filter: https://www.hygger-online.com/product/fish-tank-water-filter/ **[MFR-SITE][OWNER]**
- hygger single Aquarium Biochemical Sponge Filter (the 5–20 / 20–55 / 55–125 line; not a catalog item): https://www.hygger-online.com/product/aquarium-biochemical-sponge-filter/
- hygger HG-908 manual mirror: https://manuals.plus/hygger/hg-908-aquarium-double-sponge-filter-manual

Manufacturer sites with no usable product page indexed:
- AQUANEAT: https://theaquaneat.com/ · Pawfly: https://thepawfly.com/

Manual mirror:
- AQUANEAT Large (SF-A004): https://manuals.plus/asin/B071HVZVMP

Marketplace listings (provenance not established):
- AQUANEAT Large: https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B071HVZVMP
- AQUANEAT Middle: https://www.amazon.com/Aquaneat-Sponge-Filter-Breeding-Aquarium/dp/B078Q29JT4
- AQUANEAT 10-gal candidates (unresolved): https://www.amazon.com/clp/B078HDL21V · https://www.amazon.com/Aquaneat-Aquarium-Sponge-Filter-Breeding/dp/B078X7H8XG · https://www.amazon.com/Aquaneat-Sponge-Filter-Aquarium-Accessories/dp/B07P5WS1RH · https://amazon.com/Aquaneat-Sponge-Filter-Aquarium-Accessories/dp/B07KS1Y1JN · https://www.walmart.com/ip/Aquaneat-Aquarium-Bio-Oxygen-Sponge-Filter-Breeding-Fry-Betta-Shrimp-Nano-Fish-Tank-10-gal/711096713
- AQUANEAT 50 gal Walmart listing: https://www.walmart.com/ip/Aquaneat-Aquarium-Bio-Sponge-Filter-Breeding-Fry-Betta-Shrimp-Nano-Fish-Tank-50-Gal/5040531230
- hygger S: https://www.amazon.com/Hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RFL4JMM
- hygger M: https://www.amazon.com/Hygger-Aquarium-Sponges-Submersible-Salt-Water/dp/B07RKT6QPV
- hygger Upgraded M (different product): https://www.amazon.com/hygger-Aquarium-Double-Sponge-Filter/dp/B0FJCZJ3C3
- Pawfly nano: https://www.amazon.com/clp/B09BNCRLZY · https://www.amazon.ca/Pawfly-Biochemical-Sponge-Filter-Breeding/dp/B09BNCRLZY
- Pawfly Walmart variant family: https://www.walmart.com/ip/Pawfly-Aquarium-Nano-Bio-Sponge-Filter-Quiet-Betta-Fry-Shrimp-and-Small-Fish-Foam-Filter-for-Fish-Tank-up-to-5-60-Gallon/1476406157
- Powkoo candidates (unresolved): https://www.amazon.com/Powkoo-Double-Biochemical-Aquarium-Gallons/dp/B01M32L1LC · https://www.amazon.ca/Powkoo-Biochemical-Pre-Filter-Canister-Aquarium/dp/B01M32L1LC · https://www.amazon.com/Powkoo-Double-Sponge-Filter-Aquarium/dp/B01N6MJYWC · https://www.amazon.com/Powkoo-Double-Biochemical-Aquarium-Gallons/dp/B01M3VALFU · https://www.amazon.com/Powkoo-Aquarium-Filters-Sponge-Container/dp/B07MYTKZT5 · https://www.amazon.com/Powkoo-Sponge-Filter-Aquarium-Gallons/dp/B01F8PGL6I

Retailer / distributor / review:
- Isaan Aquatics (HG-908-D-S): https://www.isaanaquatics.com/product-page/aquarium-biochemical-sponge-filter-dual-small
- Aquatic Motiv (hygger 10–40): https://aquaticmotiv.com/products/hygger-sponge-filter-10-40-gallons
- Supply AG (hygger M): https://www.supplyag.com/products/hygger-aquarium-double-sponge-filter-for-fresh-water-and-salt-water-fish-tank-m
- Happy Paws (hygger S): https://www.happypawsboutiqueshop.com/products/b07rfl4jmm
- reviewaqua (Pawfly 10): https://www.reviewaqua.com/aquarium-pumps/aquarium-sponge-filter/pawfly-nano-bio-sponge-filter-quiet-foam-filter-for-tiny-fish-tank-10-gallon/
