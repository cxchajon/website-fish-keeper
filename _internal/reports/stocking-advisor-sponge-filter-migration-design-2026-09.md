# Stocking Advisor — sponge-filter migration design (2026-09)

Design / simulation report only. **No catalog data, filtration scoring, `MIN_BIOLOGICAL_TURNOVER`,
saved-state format, UI or runtime code was changed.** Nothing here is implemented.

Base: `main` @ `f45e17a` (after the sponge-filter model audit, #2221). Builds on:

- `stocking-advisor-sponge-filter-model-audit-2026-09.md` (**sponge audit**): all 8 air-driven GPH
  values are unsupported; makers rate sponges by tank size; recommended "model F".
- `stocking-advisor-filter-catalog-audit-2026-09.md` (**catalog audit**).
- `stocking-advisor-filtration-threshold-research-2026-09.md` (**threshold research**).

Accepted starting point (not re-argued here): the 8 air-driven GPH values are unsupported and must
stop being treated as water flow; ordinary sponges must not need a GPH; the manufacturer tank
rating is the practical user-facing number.

This report resolves the three rules the sponge audit proposed but that were **not approved**:
adding sponge ratings together, converting powered GPH into "covered gallons", and adding sponge
gallons to powered-filter gallons. **It revises the sponge audit on all three** (section 1).

**Status: final product decisions locked (2026-09-27 review).** Section 1 is the authoritative
decision record. Where the analysis sections compare options, the locked decision is marked
**LOCKED**. Nothing is implemented; production work follows the phase order in section 15.

No new web research was possible beyond the three reports (the egress proxy blocks the relevant
manufacturer and hobby sites, as recorded in those reports). Evidence grades used below are the
reports' scale: A verified on manufacturer page · B manufacturer/distributor text via search index
· C secondary listing/forum · D derived by repo code · E no source.

---

## 1. Product decision summary (LOCKED)

### 1.1 Locked decisions

| # | Decision | Locked rule |
| --- | --- | --- |
| D1 | **One rated sponge can pass alone** | If **one** sponge has a verified manufacturer maximum tank rating ≥ the nominal tank size, overall filtration may pass from that sponge alone: **✓ Rated for this tank** (green). No powered filter is required. No turnover is shown for the sponge. The rating is never converted into GPH. |
| D2 | **Multiple undersized sponges** | If no single sponge is rated for the tank but two or more sponge ratings together are ≥ the tank size: **⚠ Likely adequate — multiple sponge filters** (**amber**, intermediate). Each sponge's own rating is listed. **No combined gallon number is displayed.** Not green / not "verified adequate"; not red / not a failure. The sum is an acknowledged heuristic used only as a yes/no test. |
| D3 | **Below rating** | If the only known sponge filtration is below the tank size (and D2 does not apply): **⚠ Below manufacturer rating** (**amber**), showing "Filter rating: Up to X gal · Tank: Y gal". Never red on the manufacturer rating alone. |
| D4 | **Unknown rating** | A sponge with no usable rating: **○ Rating needed** (**neutral**, not evaluated). Never "adequate", never "unsafe". If it is the only biological filtration, overall filtration = **Not evaluated — rating needed**, neither green nor red. |
| D5 | **Mixed powered + sponge** | Powered filters: existing Phase 2C flow model, unchanged. Sponges: manufacturer rating. Powered passes on its own → overall **adequate**, sponge supplemental. One sponge covers the tank on its own → overall **adequate**, powered filter supplemental. Neither passes on its own → **⚠ Review filtration** (amber) with each device's individual reason. |
| D6 | **No GPH → gallons conversion, ever** | No "GPH ÷ 2 = gallons covered" or any other exchange rate. No adding powered-filter gallons to sponge gallons. No combined numerical capacity. The 2× floor is a Phase 2C powered-filter rule only, not a unit conversion. |
| D7 | **Stocking Load** | In the first implementation Stocking Load changes **neither** sponge pass/fail **nor** warning severity. Filtration adequacy and Stocking Load stay separate. May be revisited with evidence. |
| D8 | **Custom sponge input** | Type = Sponge asks **"Rated for up to ___ gallons"**. No GPH field. **No measured-GPH override** in the first implementation. |
| D9 | **"X gallons and up" wording** | A minimum-only rating does **not** establish a maximum and is never stored as `manufacturerMaxGallons`. Such a product stays **NEEDS SOURCE / PRODUCT REVIEW** (runtime: Rating needed) until a usable maximum or another defensible capacity method is established. No invented maximum. |
| D10 | **Saved state / stale cache** | v2 + type-wins strategy (sections 8–9) kept. Known sponge ids ignore historical GPH; type / `capacityMethod` wins over any stale `gphRated`; stale cached fake sponge GPH is never scored as turnover after migration; old custom sponges with only a GPH become Rating needed; historical GPH may be shown once as "old value — not used", never trusted as measured flow. |
| D11 | **Duplicate instances** | Later phase (D). Multiple instances of the same catalog product, each with a unique instance id and the same product id; most important for sponges. Not built in the initial plumbing phase except where migration safety needs it (section 10). |
| D12 | **UGF** | Separate dedicated tank-compatibility rule; no fake GPH; never combined arithmetically with sponge ratings; saved product id remains resolvable. Not forced into the sponge model. |

"Verified" in D1 means the catalog rating has been confirmed at grade A or B (manufacturer page /
manual or manufacturer-distributor text) during the catalog data batch. A catalog sponge whose
maximum cannot be confirmed carries `ratingStatus: "needs_review"` and is treated as **Rating
needed** (D4), not as rated. For a **custom** sponge the user's entry of the number printed on
the box is the rating; it is labelled as user-entered.

### 1.2 Status and colour summary

| Situation | Status | Tone |
| --- | --- | --- |
| One sponge rated ≥ tank | ✓ Rated for this tank | **Green** |
| Powered filter passes Phase 2C floor on its own | ✓ Filtration appears adequate | **Green** |
| Several undersized sponges, ratings together ≥ tank | ⚠ Likely adequate — multiple sponge filters | **Amber** |
| Sponge(s) only, below rating, D2 not met | ⚠ Below manufacturer rating | **Amber** |
| Powered and sponge both present, neither passes alone | ⚠ Review filtration | **Amber** |
| Only biological filtration is an unrated sponge | ○ Not evaluated — rating needed | **Neutral** |
| Powered filters only, below the 2× floor | Filter flow too low (existing) | **Red** (unchanged Phase 2C) |
| Powerheads only | No biological filter (existing) | **Red** (unchanged) |
| Nothing entered | No filter added (existing) | existing warn (unchanged) |

### 1.3 Changes from the sponge audit's proposal

| Question | Sponge audit (proposed) | Locked here |
| --- | --- | --- |
| Sponge ratings additive? | Yes, "combined rating" | No. Sum used only as the D2 threshold; amber; never displayed. |
| Sponge + powered filter | Coverage sum (sponge gal + GPH ÷ 2) | Independent paths, either may pass (D5); no combined number (D6). |
| Powered GPH to gallons | GPH ÷ 2 | Never (D6). |
| Measured GPH for sponges | Optional scored override | Not in first implementation (D8). |
| Same product twice | Allow for sponges | Allow for all filter types except UGF, later phase (D11). |

### 1.4 Decision logic in one line

> **Green** if the powered filters pass the existing flow floor, or one sponge is rated for the
> tank (or the UGF is compatible with the tank). Otherwise **amber** "Likely adequate — multiple
> sponge filters" when several sponge ratings together reach the tank size; otherwise **amber**
> "Review filtration" (powered + sponge) or "Below manufacturer rating" (sponges only); **neutral**
> "Rating needed" when the only biological filtration is unrated; existing **red** states for
> powered-only below the floor and for no biological filtration.

---

## 2. Concepts and the single-sponge model

### 2.1 Four concepts that must not be interchanged

| Concept | What it is | Known for sponges? | Used for |
| --- | --- | --- | --- |
| **A. Manufacturer rating** | Printed marketing size class: "up to 20 gal", "10–40 gal", "40 gal and up". | Yes, for every catalog sponge (grade C, section 2.2). Inconsistent between brands. | The only input the adequacy check uses. |
| **B. Measured water flow** | Water actually lifted through the sponge, GPH. | No. Depends on air pump, lift tube, depth, bubble size, clogging (sponge audit §6–7). | Nothing. Never estimated, never shown as turnover. |
| **C. Biological filtration adequacy** | Whether the colonised media is plausibly sufficient for the stock. The advisor's actual question. | Not directly measurable by the advisor for any filter type. | The output. For sponges, **inferred from A** — "the maker sells it for a tank this size". |
| **D. Redundancy** | More than one independent filter / airlift / media mass. | Yes (count of devices). | A qualitative positive: resilience to cleaning, airline failure, one clogged sponge. **Not** a capacity multiplier. |

Consequences for wording: the advisor can say "rated for this tank" (A) and "you have a backup
sponge" (D). It must not say "X× turnover" (B) or "N gallons of biological capacity" (C as a number).

### 2.2 The seven catalog sponges (not edited)

Current values from `assets/data/gearCatalog.json`; ratings from the sponge audit §2 / §14.

| id | Manufacturer | Model | Fake `gphRated` | Current `minGallons`–`maxGallons` (GPH-bucket derived) | Manufacturer rating found | Expression | Confidence | Proposed `manufacturerMaxGallons` | Usable today? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aquaneat-sponge-10` | AQUANEAT | Single sponge (Up to 10G) | 60 | 0–20 | up to 10 gal | **up to X** | C (product title) | 10 | **Yes** |
| `aquaneat-sponge-20` | AQUANEAT | Bio sponge, Middle | 120 | 0–20 | up to 20 gal | **up to X** | C (product title) | 20 | **Yes** |
| `aquaneat-sponge-60` | AQUANEAT | Bio sponge, Large (SF-A004) | 200 | 20–40 | "up to 60" (title) / 40–60 (manual mirror) | **range** | C | 60 | **Yes** (max agrees across sources) |
| `hygger-double-sponge-s` | hygger | Double sponge (S) | 80 | 0–20 | 10–40 gal | **range** | C | 40 | **Yes, with caution** — generous vs. similar-size sponges from other brands |
| `hygger-double-sponge-m` | hygger | Double sponge (M) | 120 | 0–20 | 15–55 gal | **range** | C | 55 | **Yes, with caution** (same) |
| `pawfly-sponge-10` | Pawfly | Nano bio sponge | 60 | 0–20 | up to 10 gal (some listings "5–10") | **up to X** (range on some listings) | C | 10 | **Yes** (max agrees) |
| `powkoo-dual-sponge-40` | Powkoo | Dual sponge (20–55G) | 150 | 20–40 | 20–55 (name) / 15–55 (other listings) | **range** | C | 55 | **Yes** (max agrees; min conflicts) |

- **All 7 have a usable upper rating** — every source for a product agrees on the maximum; only
  minimums conflict (Powkoo 15 vs 20, Pawfly 0 vs 5). None is "unclear" and none is a min-only
  ("X gal and up") rating. None is above grade C; each should be re-checked against a manufacturer
  page before the data batch (section 16).
- The current `minGallons`/`maxGallons` are wrong for every sponge (they are GPH buckets): e.g. the
  AQUANEAT Large (up to 60) is hidden from 55-gal tanks, while the 10-gal sponges are offered on 20.
- The hygger ranges are the widest in the set (a double sponge "10–40") and are the main example of
  brand inconsistency. The design does not correct maker ratings; it states them as the maker's.

### 2.3 Model A — single sponge rating check (LOCKED as D1 / D3)

Rule: verified `manufacturerMaxGallons ≥ nominal tank gallons` → **✓ Rated for this tank**
(green); otherwise **⚠ Below manufacturer rating** (amber) unless the multi-sponge tier (D2) or
another device applies.

| Criterion | Assessment |
| --- | --- |
| Transparent? | **Yes.** Both numbers are shown ("Rated up to 20 gal · Tank 29 gal"); the user can check them against the box. No derived number. |
| Overstates precision? | No, provided the word is "rated", not "adequate capacity" or "turnover". |
| Evidence | Strong for the *rule form* — every maker and every hobby source found sizes sponges this way (sponge audit §4–5). Weak for the *numbers* (marketing-grade, brand-inconsistent), hence the "verified" requirement in D1. |
| Failure mode | Handles one sponge only; the multi-sponge amber tier (section 3) covers ordinary multi-sponge setups. |
| Nominal vs actual gallons | Use the **nominal** tank size the user selected, as makers rate against nominal sizes and Phase 2C turnover already uses nominal gallons. |
| Min rating | Ignored for adequacy. An oversized sponge in a small tank is not a filtration problem (section 7.2). A *minimum-only* rating is not a maximum (D9, section 7.4). |
| Severity when below | Amber, never red on the rating alone (D3): ratings are marketing-grade and a shortfall is a margin question, not "effectively unfiltered". |

**Verdict: locked as the core check.**

### 2.4 Should a sponge alone be able to pass? (Step 8)

**Yes.** Reasons found, and why none of them is categorical:

| Possible objection | Assessment |
| --- | --- |
| "No trustworthy GPH, so it can't be checked" | That is a limitation of the advisor's input, not of the filter. The sponge audit shows GPH is not how sponges are specified; failing them for lacking one would be the same error as inventing one. |
| Biological capacity is weak | The opposite: capacity follows colonised surface area and oxygen (threshold research §6, §11); sponges have large foam surface and are strongly oxygenated. They are the standard filter in breeding, fry, shrimp and hospital tanks. |
| Low flow means poor nitrification | Aquaculture evidence: single-pass removal *falls* as flow rises and extra flow adds little capacity beyond a modest minimum (threshold research §11). Low flow is not by itself inadequate. |
| Weak mechanical filtration / surface agitation | Real but secondary: solids capture is weaker than a HOB/canister and circulation is local. These are comfort and appearance points (debris, dead spots in long tanks), not a biological-filtration failure. Worth a copy note for large or messy-fish tanks at most. |
| Depends on an air pump | True of every filter's power supply. Air pumps are, if anything, the simplest and most redundant drive. |
| Large tanks | A sponge rated for the tank is by definition sold for that size; beyond that, section 3 handles multiples. |

No husbandry or scientific reason was found to treat an appropriately rated air-driven sponge as
categorically inadequate. **A correctly rated sponge should be able to produce the passing
filtration state by itself.** The UI word should be "Rated for this tank" rather than a bare
"Adequate", so it does not claim more than the rating supports.

---

## 3. Multiple-sponge analysis (Steps 4, 5, 10)

### 3.1 The four candidate rules

| Rule | Definition |
| --- | --- |
| **A. Additive** | Status and display use Σ ratings as "combined rating N gal"; passing = green. |
| **B. Largest only** | Only the largest single rating counts. |
| **C. Redundancy, no capacity** | Extra sponges are acknowledged ("additional biological filtration") but never change the status. |
| **D. Tiered** (**LOCKED**, D1 + D2) | Largest rating ≥ tank → **✓ Rated for this tank** (green, + "additional sponge" line). Else Σ ratings ≥ tank → **⚠ Likely adequate — multiple sponge filters** (**amber**), listing each sponge's own rating and never a combined number. Else → **⚠ Below manufacturer rating** (amber). |

### 3.2 Identical sponges (Step 4)

| Tank | Setup | A. Additive | B. Largest only | C. Redundancy only | **D. Tiered (locked)** |
| --- | --- | --- | --- | --- | --- |
| 10 gal | 2 × 10-gal | ✓ combined 20 gal | ✓ rated (10 ≥ 10) | ✓ rated + additional sponge | **✓ Rated for this tank (green) · + 1 additional sponge** |
| 20 gal | 2 × 10-gal | ✓ combined 20 gal | ⚠ below rating | ⚠ below rating (+ "you have 2 sponges") | **⚠ Likely adequate — multiple sponge filters (amber); each rated up to 10 gal** |
| 29 gal | 2 × 20-gal | ✓ combined 40 gal | ⚠ below rating | ⚠ below rating | **⚠ Likely adequate — multiple sponge filters (amber); each rated up to 20 gal** |
| 55 gal | 2 × 40-gal | ✓ combined 80 gal | ⚠ below rating | ⚠ below rating | **⚠ Likely adequate — multiple sponge filters (amber); each rated up to 40 gal** |

### 3.3 Different sponges (Step 5)

| Tank | Setup | A. Additive | B. Largest only | C. Redundancy only | **D. Tiered (locked)** |
| --- | --- | --- | --- | --- | --- |
| 20 gal | 10 + 20 | ✓ combined 30 | ✓ rated (20) | ✓ rated + additional | **✓ Rated for this tank (20-gal sponge) · + additional sponge** |
| 29 gal | 20 + 40 | ✓ combined 60 | ✓ rated (40) | ✓ rated + additional | **✓ Rated for this tank (40-gal sponge) · + additional sponge** |
| 55 gal | 20 + 40 | ✓ combined 60 | ⚠ below rating | ⚠ below rating | **⚠ Likely adequate — multiple sponge filters (amber); up to 40 gal and up to 20 gal** |

The same tiered rule works unchanged for mixed sizes: the green tier is decided by the largest
sponge, the amber "likely" tier by the sum used as a threshold only.

### 3.4 Why tiered, and why the multi-sponge tier is amber

- **Against pure additivity (A):** no manufacturer states that ratings add; the ratings themselves
  are marketing classes that differ by brand for similar sponges (hygger S "10–40" vs AQUANEAT
  nano "≤10"). Displaying "combined rating 80 gal" presents the sum of two marketing figures as a
  measured capacity — exactly the kind of invented precision this migration removes. It is also
  gameable (five 10-gal sponges "rate" a 50-gal tank).
- **Against largest-only (B) and redundancy-only (C):** both treat the most ordinary multi-sponge
  setups (two sponges on a 20-gal breeder; two large sponges on a 55) exactly like a single
  undersized sponge, ignoring that each extra sponge really adds colonised media, an airlift and
  redundancy.
- **Why amber, not green (D2):** summing nominal ratings is an acknowledged heuristic; it is **not
  validated as additive biological capacity**. The tier exists because multiple sponges clearly
  add media and redundancy, while the exact biological capacity is unknown. Amber says "probably
  fine, not confirmed" — the honest level of evidence. It is deliberately **not red**: nothing
  suggests such setups fail, and hobby practice uses them routinely.
- The sum is used only as a yes/no threshold, the display lists each sponge's own rating, and
  nothing claims a combined capacity.

Guard against stacking many tiny sponges: **no numeric coefficient** (none has a source). The
amber tier always lists every sponge and its rating, so five 10-gal sponges on a 50 read as exactly
that. A copy-only note for many small sponges is a later option, not part of the first
implementation (section 16).

### 3.5 Maintenance and redundancy (Step 10)

Two sponges have legitimate advantages that do not require a capacity number:

- **Alternating cleaning** — rinse one sponge per maintenance, so most of the colony is never
  disturbed at once. This is the most-cited practical reason for two sponges.
- **Biological redundancy** — one clogged sponge, kinked airline, failed check valve or dead air
  stone leaves the other running.
- **More colonised surface** — real, but not quantifiable from the rating.
- **More distributed flow** — two intakes reduce dead spots in long tanks.

**The UI should recognise this**, as a line, not a status change:
"+ Additional sponge filter — a second sponge adds backup; rinse them on different weeks."
It appears under green and amber multi-sponge states and never changes the status by itself (the
tier rule decides the status).

---

## 4. Mixed filtration analysis (Steps 6, 7)

### 4.1 Candidate structures

| Model | Definition | Assessment |
| --- | --- | --- |
| **A. Independent dimensions** | Powered path judged by the Phase 2C flow floor; sponge path by rating; both reported side by side; no overall verdict rule of its own. | Transparent, but needs a rule for the headline status. |
| **B. Either path can satisfy** | Overall passes if the powered path passes *or* the sponge path passes. The non-deciding device is shown as supplemental. | Matches how hobbyists reason ("the HOB handles it, the sponge is extra"; "the sponge alone is rated for it"). No new number. |
| **C. Combined capacity** | One number, e.g. sponge gal + GPH ÷ 2 ("covered gallons"). | **Not supported.** The GPH ÷ 2 equivalence makes an unvalidated floor into a capacity exchange rate; the threshold research shows the 2× floor already contradicts a manufacturer rating (EHEIM 2213, 1.76× at 66 gal) and treats 2×–4× as an open "low" band. Adding the result to a marketing-grade sponge rating stacks two unrelated uncertainties into one confident-looking figure. |

**Recommended: B for the verdict, presented as A.** One headline status; underneath it, one line
per path with its own evidence (GPH and rated turnover for powered filters, "rated up to N gal"
for sponges).

### 4.2 Should powered GPH ever be converted into gallon capacity? — LOCKED as D6: never

**No.** No "GPH ÷ 2 = gallons covered" or any other exchange rate, no adding powered-filter gallons
to sponge gallons, and no combined numerical capacity. The 2× floor is a Phase 2C rule for powered
filters only; it is a pass/fail floor, not a unit conversion, and it is itself weakly evidenced
(the threshold research shows it contradicts EHEIM's own 2213 rating at 1.76×).

If powered and sponge filters are ever compared on a common basis, the only candidate is the
powered filters' own **manufacturer tank ratings** (catalog fix batch 1 recorded real ranges for
AC70, Fluval 307, EHEIM 2213) — a separate future research question with the same additivity
problem as sponges, and still not a GPH conversion. Until then the two paths stay independent.

### 4.3 When neither path passes alone (LOCKED as D5 / D6)

Example: 29 gal, 40 GPH HOB (1.4×, below the floor) + one 20-gal sponge (below rating).

- No combined number is computed; GPH is never converted into gallons (D6).
- Status: **⚠ Review filtration** (amber), listing each device's individual reason. Today's
  powered-only `very-low` is red; with a second, independent biological filter present the result
  is amber — justified by the presence of that filter, not by any arithmetic.
- Copy: "Neither filter is sized for a 29-gal tank on its own: the HOB's 40 GPH is 1.4× / hour
  (rated), below the 2× minimum; the sponge is rated up to 20 gal. A filter rated for this tank is
  the safer choice."

### 4.4 Locked overall decision logic (pseudo-code, not implemented)

```text
bio      = biological devices (not powerheads/wavemakers)
powered  = bio with capacityMethod 'flow'   (HOB, CANISTER, INTERNAL, OTHER, custom powered)
sponges  = bio of type SPONGE with a usable (verified or user-entered) ratedMaxGallons
unrated  = bio of rating-method type with no usable rating   ("rating needed")
ugf      = bio of type UGF (own compatibility rule, section 11)

poweredPass  = powered non-empty and Σ powered GPH ÷ nominal gal ≥ MIN_BIOLOGICAL_TURNOVER (unchanged 2)
spongeRated  = any sponge.ratedMaxGallons ≥ nominal gal
spongeLikely = !spongeRated and sponges.length ≥ 2 and Σ sponge.ratedMaxGallons ≥ nominal gal
ugfRated     = ugf compatible with the selected tank preset

if no devices                              → NONE              "No filter added"            (existing)
else if bio is empty                       → CIRCULATION_ONLY  "No biological filter"       red (existing)
else if poweredPass or spongeRated or ugfRated
                                           → ADEQUATE          green; headline names the passing path
else if spongeLikely                       → LIKELY            amber "Likely adequate — multiple sponge filters"
else if powered non-empty and (sponges or ugf) non-empty
                                           → REVIEW            amber "Review filtration" + individual reasons
else if powered non-empty                  → VERY_LOW          red "Filter flow too low" (existing Phase 2C; powered-only)
else if sponges non-empty                  → BELOW_RATING      amber "Below manufacturer rating"
else                                       → NOT_EVALUATED     neutral "Rating needed" (only unrated rating-method devices)
```

- Unrated devices never pass and never fail; they appear as a neutral "rating needed" line under
  whatever headline the evaluable devices produce (D4). A powered filter below the floor next to
  an unrated sponge is still `VERY_LOW` for the powered filter, shown with the unrated sponge line;
  whether an unrated sponge should soften that to amber is left open (section 16).
- The powered floor, its value and its copy are **unchanged** by this design (threshold research
  questions remain open separately).
- Sponges never contribute GPH to `biologicalGph` / turnover; they are removed from the flow sum.
- `capacityAdjustment` stays 0. Nothing here touches the bioload percentage, and no branch reads
  Stocking Load (D7).
- Supplemental lines: every device not needed for the verdict is listed ("+ Additional sponge
  filter: rated up to 20 gal"); a supplemental sponge below its own rating is **not** flagged.

### 4.5 Common-case simulations (Step 7)

Powered turnover uses the unchanged 2× rated floor. "Additive" = sponge-audit coverage model
(sponge gal + GPH ÷ 2) — **rejected (D6)**, shown for comparison only. "Largest only +
independent" = either path, no multi-sponge tier.

| # | Tank | Setup | Today (fake GPH) | Additive coverage (rejected) | Largest only + independent | **Locked model** |
| --- | --- | --- | --- | --- | --- | --- |
| A | 29 | 150 GPH HOB | 5.2× adequate | 75/29 ✓ | ✓ (HOB) | **✓ adequate — green (HOB)** |
| B | 29 | 150 HOB + 20-gal sponge | 9.3× adequate | 95/29 ✓ | ✓ (HOB) | **✓ adequate — green (HOB); sponge supplemental** |
| C | 29 | 100 HOB + 40-gal sponge | 10.3× adequate | 90/29 ✓ | ✓ (both) | **✓ adequate — green (HOB 3.4× and sponge rated)** |
| D | 55 | 200 canister + 40-gal sponge | 7.3× adequate | 140/55 ✓ | ✓ (canister) | **✓ adequate — green (canister); sponge supplemental** |
| E | 55 | one 40-gal sponge | 3.6× adequate | 40/55 ✗ | ⚠ below | **⚠ Below manufacturer rating — amber** |
| F | 55 | two 40-gal sponges | 7.3× adequate | 80/55 ✓ | ⚠ below | **⚠ Likely adequate — multiple sponge filters — amber** |
| G | 20 | one 20-gal sponge | 6.0× adequate | 20/20 ✓ | ✓ rated | **✓ Rated for this tank — green** |
| H* | 29 | 40 HOB + 20-gal sponge | 5.5× adequate | 40/29 ✓ | ⚠ review | **⚠ Review filtration — amber** |
| U* | 20 | one sponge, rating unknown | depends on old GPH | — | — | **○ Not evaluated — rating needed — neutral** |

(* extra cases.) Case B–H "today" figures use the catalog's fake sponge GPH (AQUANEAT Large 200
standing in for a "40-gal" sponge; AQUANEAT Middle 120 for "20-gal").

**Exactly what the user would see (locked model; UI not built, wording from section 12):**

```
A  29 gal · HOB 150 GPH
   ✓ Filtration appears adequate
   Powered filter: 150 GPH · 5.2× / hour (rated)
   Filtration supports your livestock but does not increase stocking capacity.

B  29 gal · HOB 150 GPH + sponge (up to 20 gal)
   ✓ Filtration appears adequate
   Powered filter: 150 GPH · 5.2× / hour (rated)
   + Additional sponge filter: rated up to 20 gal
   Filtration supports your livestock but does not increase stocking capacity.

C  29 gal · HOB 100 GPH + sponge (up to 40 gal)
   ✓ Filtration appears adequate
   Powered filter: 100 GPH · 3.4× / hour (rated)
   Sponge filter: rated up to 40 gal — rated for this tank
   Filtration supports your livestock but does not increase stocking capacity.

D  55 gal · canister 200 GPH + sponge (up to 40 gal)
   ✓ Filtration appears adequate
   Powered filter: 200 GPH · 3.6× / hour (rated)
   + Additional sponge filter: rated up to 40 gal
   Filtration supports your livestock but does not increase stocking capacity.

E  55 gal · sponge (up to 40 gal)                              [amber]
   ⚠ Below manufacturer rating
   Filter rating: up to 40 gal
   Tank: 55 gal
   Add a second sponge or a filter rated for this tank.
   Filtration supports your livestock but does not increase stocking capacity.

F  55 gal · 2 × sponge (up to 40 gal each)                     [amber]
   ⚠ Likely adequate — multiple sponge filters
   Sponge 1: rated up to 40 gal
   Sponge 2: rated up to 40 gal
   Tank: 55 gal
   No single sponge is rated for this tank. Several sponges add media and backup,
   but their combined capacity isn't verified.
   Filtration supports your livestock but does not increase stocking capacity.

G  20 gal · sponge (up to 20 gal)
   ✓ Rated for this tank
   Manufacturer rating: up to 20 gal
   Tank: 20 gal
   Sponge filters are sized by tank; water flow isn't estimated.
   Filtration supports your livestock but does not increase stocking capacity.

H  29 gal · HOB 40 GPH + sponge (up to 20 gal)                 [amber]
   ⚠ Review filtration
   Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× minimum
   Sponge filter: rated up to 20 gal — below this 29 gal tank
   Neither filter is sized for this tank on its own. A filter rated for this tank is the safer choice.
   Filtration supports your livestock but does not increase stocking capacity.

U  20 gal · sponge, rating unknown                             [neutral]
   ○ Not evaluated — rating needed
   Enter the tank size this sponge is rated for (printed on the box).
   Filtration supports your livestock but does not increase stocking capacity.
```

Case-by-case notes: C passes on *both* paths — the headline stays one line. D's sponge is below
its own rating for 55 gal but is not flagged, because it is not carrying the tank. No sponge result
is red; red remains only for the existing powered-only-below-floor and no-biological-filter states.

---

## 5. Stocking Load interaction (Step 9) — LOCKED as D7

**First implementation: Stocking Load changes neither sponge pass/fail nor any filtration warning
severity.** Filtration adequacy and Stocking Load remain separate outputs.

Reason: there is not enough evidence to define how a manufacturer sponge rating should scale with
stocking level. The threshold research (§11) supports only the *direction* (more waste → more
media / flow), not numbers; the manufacturer ratings themselves carry no stated stocking
assumption; and the threshold research's own candidate load band (70 %) is unapproved.

What stays true regardless:

- Filtration never changes Stocking Load, never adds capacity, never gives a bonus
  (`capacityAdjustment: 0`).
- The existing over-capacity / high-load messaging is the Stocking Load card's job and is unchanged.
- The permanent line "Filtration supports your livestock but does not increase stocking capacity."
  appears on every filtration state.

Considered and **deferred** (not in the first implementation): a neutral maintenance note for
green sponge states at high load, and raising the amber multi-sponge tier's wording at high load.
Revisit only with evidence (section 16).

---

## 6. Custom input design (Step 11) — LOCKED as D8

### 6.1 Flow (not built)

```
Filter type:  [ Sponge ▾ ]

Rated for up to:  [ 20 ] gallons        ← required, integer 1–300
Hint: the tank size printed on the box or in the listing title, e.g. "up to 20 gallons".
      If it gives a range like "10–40 gal", enter the larger number.

[ Add filter ]
```

- Selecting **Sponge** swaps the GPH field for the rating field (same position, same Add button).
  Every other type keeps the GPH field unchanged.
- **No GPH is asked for a sponge. No measured-GPH / advanced override** in the first
  implementation.
- Label on the chip: "Sponge · rated up to 20 gal (entered)".
- Validation copy: "Enter the tank size the sponge is rated for (the number on the box)."
- The `canAddManual` rule becomes type-aware: Sponge requires a rating, not a GPH.
- A box that says only "X gallons and up" gives no maximum (D9). The hint must not tell users to
  enter that number as "up to". First implementation: the field is optional-to-leave-empty for such
  users — they can add the sponge with no rating and get **Rating needed** (neutral). Wording for
  this case is a copy decision for the UI phase.

### 6.2 Custom UGF

The custom type list has no UGF option today; do not add one (section 11).

### 6.3 Measured water flow override — not in the first implementation

| For | Against |
| --- | --- |
| Real jug-and-timer data is valid. | Very few users measure it; it changes weekly with clogging. |
| Engages advanced users. | There is **no validated turnover threshold for sponges**. A real measured 30 GPH on a 20-gal tank (1.5×) would fail the powered floor while the sponge is rated for the tank — a contradiction the advisor cannot resolve. |
| | A GPH box next to a sponge invites users to paste a listing or air-pump number, recreating the problem being removed. |
| | Old saved custom sponges carry exactly such a GPH (section 9); a measured-GPH field would blur that migration. |

**Locked: excluded from the first implementation.** If ever added it would be display-only
("Measured flow: 30 GPH — not used for the rating check"); revisit only if users ask.

---

## 7. Catalog schema (Step 12)

### 7.1 Catalog sponge — no user input

The user picks the product; the catalog supplies the rating. Chip / card line:
"AQUANEAT Bio Sponge (Middle) · rated up to 20 gal".

### 7.2 Is `minGallons` needed for sponges?

**No, not for adequacy and not for picker eligibility.**

- An oversized sponge in a small tank is not a filtration problem (it may simply not fit — a
  physical question the advisor doesn't model).
- An undersized sponge must stay **selectable**: two 10-gal sponges on a 20-gal tank is a supported
  (amber) configuration (section 3). Today `filterGearByTank` would hide it.
- Recommended picker behaviour for sponges: show all sponges on every tank, grouped
  "Rated for this tank" first, then "Smaller than this tank".
- Keep the maker's printed minimum as **display metadata only** (`manufacturerMinGallons`), so a
  range like hygger's "10–40 gal" can be shown as printed.

### 7.3 Proposed fields (additive; nothing removed in the first data release)

```jsonc
{
  "id": "aquaneat-sponge-20",                 // unchanged, never renamed
  "brand": "AQUANEAT",
  "name": "…(Middle up to 20Gal)",
  "type": "SPONGE",                           // SPONGE | UGF are rating-method types
  "capacityMethod": "manufacturer_rating",    // "flow" is the default when absent
  "manufacturerMaxGallons": 20,               // the only number used for adequacy; null if none
  "manufacturerMinGallons": null,             // display only; null when the maker gives none
  "ratingExpression": "up_to",                // up_to | range | min_only | unclear
  "ratingStatus": "verified",                 // verified | needs_review
  "ratingSource": "https://…",                // required for new rating-method records
  "ratingConfidence": "B",                    // report grade; review-only, not shown to users

  // legacy, retained until phase E so an old JS bundle still loads the record (section 9.3);
  // ignored by new code for every capacityMethod "manufacturer_rating" record:
  "gphRated": 120,
  "minGallons": 0,
  "maxGallons": 20
}
```

- A rating is used for green (D1) only when `ratingStatus` is `verified` and
  `manufacturerMaxGallons` is a positive number. Anything else is **Rating needed**.
- Powered filters: unchanged. `capacityMethod` may be omitted (defaults to `flow`).

### 7.4 Non-maximum wording ("20 gallons and up") — LOCKED as D9

| Wording | Meaning | Stored as |
| --- | --- | --- |
| "Up to 20 gal" | maximum | `manufacturerMaxGallons: 20`, `ratingExpression: "up_to"` |
| "10–40 gal" | range with maximum | `manufacturerMinGallons: 10`, `manufacturerMaxGallons: 40`, `"range"` |
| "20 gallons and up" (e.g. Aquarium Co-Op size classes) | **minimum only — no maximum** | `manufacturerMinGallons: 20`, **`manufacturerMaxGallons: null`**, `"min_only"`, `ratingStatus: "needs_review"` |
| no size stated / contradictory | unclear | `manufacturerMaxGallons: null`, `"unclear"`, `ratingStatus: "needs_review"` |

- "And up" is **never** reinterpreted as a maximum and no maximum is invented.
- Such a record is **NEEDS SOURCE / PRODUCT REVIEW**; at runtime it is **Rating needed** (neutral)
  until a usable maximum rating or another defensible capacity method is established.
- None of the 7 current catalog sponges uses "and up" wording (section 2.2); the rule governs
  future products and custom-entry copy.

---

## 8. Saved-state v2 (Step 13)

### 8.1 Current structure (traced)

| Where | Shape | Notes |
| --- | --- | --- |
| `localStorage['ttg.stocking.filters.v1']` written by the filtration controller (`persistAppFilters`, `js/stocking-advisor/filtration/controller.js:322`) | `[{id, type, rated_gph}]` | Drops entries with neither id nor GPH. |
| Same key written by `saveFilterSnapshot` (`js/stocking/tankStore.js:221`), called from `js/stocking.js:544` | `[{id, type, rated_gph}]` via `normalizeStoredFilter` | **Second writer of the same key**; must be changed in the same release. |
| Readers: `hydrateFromAppState` (controller :1002), `loadFilterSnapshot` (tankStore :207) | | Controller: id found in catalog → rebuilt from catalog (stored GPH ignored); id not found → **custom filter with the stored GPH**; GPH 0 → dropped. |
| `appState.filters` → `compute.legacy.js` `sanitizeFilter` (:253) | `{id, type, rated_gph}` | **Strips every other field** before `assessFiltration`; a rating would be lost here. |
| `sessionStorage['ttg:filter_id' / 'ttg:filter_type' / 'ttg:rated_gph']` (gear page) | | Only the id is read; `ttg:rated_gph` has no reader. |
| Report / export object (`js/stocking.js` ~2525) | `filter.rated_gph`, `filtration.rated_gph` | Single legacy filter snapshot; ignore sponge GPH there too. |

Identity today is `id` (product id, or `manual-…` for custom). There is no instance id, so the same
product cannot appear twice (`setFilters` de-duplicates on `${source}:${id}`, `removeFilterById`
removes every entry with the id).

### 8.2 v2 representation

Key: `ttg.stocking.filters.v2`. Envelope with a version so later changes don't need a new key:

```jsonc
{
  "v": 2,
  "filters": [
    // powered catalog filter
    { "instanceId": "f-7k2p", "source": "product", "productId": "aquaclear-70",
      "type": "HOB", "capacityMethod": "flow", "gph": 300 },

    // powered custom filter
    { "instanceId": "f-9q1z", "source": "custom", "label": "Old canister",
      "type": "CANISTER", "capacityMethod": "flow", "gph": 180 },

    // catalog sponge — rating is NOT stored; always re-resolved from the catalog by productId
    { "instanceId": "f-3m8a", "source": "product", "productId": "aquaneat-sponge-20",
      "type": "SPONGE", "capacityMethod": "manufacturer_rating" },
    { "instanceId": "f-3m8b", "source": "product", "productId": "aquaneat-sponge-20",
      "type": "SPONGE", "capacityMethod": "manufacturer_rating" },   // same product, 2nd instance

    // custom sponge — the user's rating is the data
    { "instanceId": "f-5c0d", "source": "custom", "label": "Sponge",
      "type": "SPONGE", "capacityMethod": "manufacturer_rating", "ratedMaxGallons": 20 },

    // migrated v1 custom sponge that only had a GPH
    { "instanceId": "f-2x4e", "source": "custom", "label": "Sponge",
      "type": "SPONGE", "capacityMethod": "manufacturer_rating",
      "ratedMaxGallons": null, "ratingStatus": "needed", "legacyGph": 120 }
  ]
}
```

Rules:

- `gph` exists **only** on `capacityMethod: "flow"` entries. Rating-method entries never carry it.
- Catalog entries store identity, not data: rating (and powered GPH) come from the current catalog,
  as v1 already does for GPH. So a later rating correction reaches saved plans automatically.
- `legacyGph` is kept only for a one-time "previously entered … (not used)" note; it is never read
  by the engine.
- `instanceId`: short random id, unique within the list; `productId` may repeat. Phase A only
  reserves the field (one instance per product, as today); repeats arrive in phase D (section 10).

### 8.3 Compatibility

- **Read:** prefer v2; if absent, read v1 and migrate in memory (section 9.2); write v2.
- **Write:** v2 is authoritative. Also keep writing a v1 mirror **containing only `flow`-method
  filters** (and nothing for sponges) for one or two releases, so a stale old page still sees the
  powered filters and can never read a sponge GPH written by new code. Then retire v1 writes.
- Both writers (controller and `tankStore`) move to one shared serializer in the same release.
- `compute.legacy.js` `sanitizeFilter` and `math.js` `normalizeFilter` must pass through
  `instanceId`, `capacityMethod`, `ratedMaxGallons`, `ratingStatus`.
- No migration runs until the release that ships v2 (not in this phase).

---

## 9. Stale-cache and old-saved-filter protection (Steps 14, 15)

### 9.0 Locked rules (D10)

1. **Known catalog sponge ids ignore historical GPH** — they are re-resolved from current catalog
   rating metadata.
2. **Filter type / `capacityMethod` wins over any stale `gphRated`** — from the catalog, a cached
   catalog, saved state, `appState` or session storage.
3. **Stale cached fake sponge GPH is never scored as turnover** once the new model ships.
4. **Old custom sponges with only a GPH become Rating needed** (neutral).
5. **Historical GPH** may be shown once as "old value — not used"; it is **never** treated as a
   trusted measured flow, never converted to gallons and never read by the engine.

### 9.1 Principle: type wins over GPH, everywhere

Once the new model ships, **any device whose type is `SPONGE` or `UGF` is a rating-method device
and has zero flow for filtration, whatever GPH field it carries** — from a fresh catalog, a stale
`ttg.gear.catalog.v1` cache, `ttg.stocking.filters.v1`, `appState.filters`, or session storage.

```text
RATING_TYPES = {SPONGE, UGF}

capacityMethodOf(entry):
    t = filterTypeKey(entry)
    if t in RATING_TYPES:           return 'manufacturer_rating'   // before any GPH is parsed
    if t in CIRCULATION_ONLY_TYPES: return 'circulation'
    return entry.capacityMethod == 'manufacturer_rating' ? 'manufacturer_rating' : 'flow'

normalizeFilter(entry):
    method = capacityMethodOf(entry)
    ratedGph        = method == 'manufacturer_rating' ? 0 : parseFlow(entry)
    ratedMaxGallons = method == 'manufacturer_rating'
                        ? positiveInt(entry.ratedMaxGallons ?? entry.manufacturerMaxGallons) ?? null
                        : null
    ratingStatus    = method == 'manufacturer_rating' && ratedMaxGallons == null ? 'needed' : 'ok'
```

- A stale cached catalog record `{type:"SPONGE", gphRated:120}` with no rating field therefore
  becomes "rating needed" for one page load, never 6× turnover. The background refresh (network
  fetch is `cache: 'no-store'`) then supplies the rating.
- The rule keys on **type**, not only `capacityMethod`, precisely because stale records predate the
  new field.
- A catalog record that is not typed SPONGE/UGF but carries `capacityMethod: "manufacturer_rating"`
  (a future product) is also rating-method.

### 9.2 Old saved filters (v1 → v2 migration, in memory)

| v1 entry | Behaviour |
| --- | --- |
| Known catalog sponge id + any GPH | Re-resolve from the current catalog by id; **ignore stored GPH**. Becomes a catalog sponge instance with the catalog rating. |
| Known catalog UGF id | Same, via the UGF check. |
| Unknown id, `type: SPONGE` (custom, or a product since removed) + GPH | **"Rating needed"**: kept as a chip "Sponge — rating needed"; not scored as adequate, low or none; inline "Enter the tank size it's rated for". GPH kept only as `legacyGph`. |
| Unknown id, `type: UGF` | Same as above. |
| Powered (catalog or custom) | Unchanged (catalog id re-resolved; custom keeps GPH). |
| Entry with `rated_gph: 0` | Today dropped. v2: a rating-method type is **kept** (rating needed); a flow type is still dropped. |

Evaluation of "rating needed":

- **Safe**: the old number is never trusted and never silently reinterpreted — not as measured flow
  (it may be a copied listing figure or a guess), and not converted to gallons.
- **Not destructive**: the user's sponge stays visible; they are asked one question they can answer.
- **Scoring**: if another path passes, the headline passes and the unrated sponge is a neutral line.
  If the unrated sponge is the only biological device, overall filtration is **Not evaluated —
  rating needed** (neutral): never "No filter added", never "adequate", never "unsafe" (D4).
- **Accepted cost**: a user who really did measure their sponge's flow loses that number from
  scoring. That is the correct trade (section 6.3), and the note shows the old value once as
  "old value — not used".

### 9.3 Deployment-order protections

Every place that gates on GPH must learn the rating path in the same release, or rating-method
records vanish (`gear-data.js` drops GPH ≤ 0, and old-id-not-found → custom-with-old-GPH is the
exact failure the sponge audit §15 warns about):

| Gate | File |
| --- | --- |
| `sanitizeItem` drops `gphRated ≤ 0` (also applied to the **cached** catalog on read) | `js/gear-data.js:57` |
| `filterGearByTank` hides out-of-range items (sponge picker should not) | `js/gear-data.js:236` |
| `setFilterCatalogData` drops `rated_gph ≤ 0` (legacy picker path) | `js/stocking.js:624` |
| `sumGph` / `isValidFilterProduct` | `js/utils.js` (~373, ~395) |
| `createProductFilter` returns null without GPH | controller `:722` |
| `setFilters` drops GPH ≤ 0; de-dupes on `source:id` | controller `:676` |
| `hydrateFromAppState` drops GPH 0; unknown id → custom with old GPH | controller `:1002` |
| `canAddManual` requires GPH; `addManualFilter` | controller `:290, :746` |
| `canAddProduct` blocks repeat ids | controller `:283` |
| `persistAppFilters` / `saveFilterSnapshot` / `normalizeStoredFilter` | controller `:322`; tankStore `:195, :221` |
| `sanitizeFilter` strips non-GPH fields | `js/logic/compute.legacy.js:253` |
| `normalizeFilters` drops `ratedGph ≤ 0` | `math.js:104` |
| Warning copy "Filter flow too low … GPH through filter media" | `compute.legacy.js:1041` |

Additional protections:

1. **Code before data.** v2 plumbing (phase A) ships first; the runtime (type-wins, rating path)
   ships in the same release as the rating fields (phase B).
2. **Keep legacy `gphRated` in the data until phase E**, at least one release after phase B. New
   code ignores it for rating-method records; an old JS bundle still in a tab (JS and `/data` are
   `must-revalidate`, so this window is short) keeps today's behaviour instead of dropping sponges
   or turning saved sponges into custom-with-old-GPH.
3. **Then (phase E)** remove `gphRated` from the 8 records and bump the catalog cache key to
   `ttg.gear.catalog.v2` (belt and braces — type-wins already neutralises the old cache).
4. Tests: stale cached sponge with GPH and no rating → rating needed; v1 catalog sponge id → catalog
   rating; v1 custom sponge → rating needed + `legacyGph`; sponge GPH never appears in
   `biologicalGph`; `capacityAdjustment` stays 0; Stocking Load identical with and without sponges.

---

## 10. Duplicate-instance design (Step 16) — LOCKED as D11, later phase

**Allow the same catalog product more than once for all filter types, except UGF — in phase D,
not in the initial plumbing phase.**

- Sponges: two identical sponges is the canonical multi-sponge setup (section 3); most important
  case.
- Powered filters: two identical HOBs on a large tank is also normal, and Phase 2C already sums
  powered GPH, so a repeat is simply counted.
- Powerheads: repeats are normal (circulation, not scored).
- UGF: one plate set per tank; keep the block.

Design (phase D):

- State holds **instances**: `{instanceId, productId, …}`. `instanceId` is unique within the list
  (`f-` + short random, checked); `productId` repeats.
- Every identity operation moves from `id` to `instanceId`: `setFilters` de-dupe, `removeFilterById`
  (remove **one** instance), chip keys, saved state.
- UI: identical products render as one chip with a count, "AQUANEAT Middle ×2", with a remove-one
  control; Add Selected on an already-added product increments instead of saying "Already added".
- Gear-page `?filter=<id>` hand-off adds one instance, unchanged.

What phase A does and does not do:

- Migration safety does **not** require duplicates: v1 cannot hold repeats, so no collision exists.
- Phase A may **reserve** the `instanceId` field in the v2 format (written for each entry, one per
  product as today) so phase D does not need a second saved-state format change. The picker's
  "Already added" block and id-based de-duplication stay exactly as they are until phase D.

Interim consequence (accepted): between phases B and D the amber multi-sponge tier is reachable
only with two different sponge products or custom sponges.

---

## 11. UGF recommendation (Step 17) — LOCKED as D12

`penn-plax-ugf-20-29`: rated "20 Long – 29 gal", two 14" × 11.1" plates (28" × 11.1" total), two
lift tubes, air pump not included (sponge audit §11, grade C). Stored GPH 150 is unsupported.

| Option | Assessment |
| --- | --- |
| A. Manufacturer-rating model like sponges (`maxGallons 29 ≥ tank`) | Wrong in both directions: a 20 High (24" × 12") is ≤ 29 gal yet the 28" plates don't fit; a 10-gal passes the gallon test but the plates can't fit either. UGF capacity is plate/bed **area**, not volume. **Not used.** |
| **B. Dedicated UGF model: stated tank compatibility** (**locked**) | Matches the product: rated for specific tank footprints. The advisor's tank presets have ids such as `20l` and `29g`, so compatibility is a preset list. |

Locked near-term treatment:

- `type: "UGF"`, `capacityMethod: "manufacturer_rating"` (so type-wins removes the fake GPH), plus
  `compatibleTanks: ["20l", "29g"]` (preset ids to be confirmed in phase F).
- **No fake GPH**, and **never combined arithmetically** with sponge ratings (a UGF is a
  whole-bottom filter; the multi-sponge tier is sponge-only). It is its own passing path in 4.4.
- Status: "✓ Undergravel filter rated for this tank (20 Long–29 gal)" (green) on a compatible
  preset; neutral "Rating needed — this undergravel filter isn't listed for this tank size" otherwise.
- **The saved product id stays resolvable** in every phase, so saved plans never turn it into a
  custom filter with 150 GPH.
- Between phase B (type-wins live) and phase F (UGF rule built), the UGF resolves as a
  rating-method device with no usable rating → **Rating needed**. That is the safe interim state.
- No custom UGF option; powerhead-driven UGFs are not modelled.

---

## 12. Status-language examples (Step 18) — wording proposals, no card built

Rules: say "rated" for manufacturer ratings and "(rated)" beside GPH-based turnover; never show a
turnover or GPH for a sponge; **never show a combined gallon figure**; list each sponge's own
rating; keep the permanent line "Filtration supports your livestock but does not increase stocking
capacity." on every state.

```
SPONGE FILTER                                  ✓ Rated for this tank            [green]
Manufacturer rating: up to 40 gal
Tank: 29 gal
Sponge filters are sized by tank; water flow isn't estimated.
```

```
SPONGE FILTERS                                 ⚠ Likely adequate — multiple sponge filters   [amber]
Sponge 1: rated up to 20 gal
Sponge 2: rated up to 20 gal
Tank: 29 gal
No single sponge is rated for this tank. Several sponges add media and backup,
but their combined capacity isn't verified.
```

(Alternative headline, same meaning: "⚠ Multiple sponge filters may provide adequate filtration".)

```
SPONGE FILTER                                  ⚠ Below manufacturer rating      [amber]
Filter rating: up to 20 gal
Tank: 29 gal
Add a second sponge or a filter rated for this tank.
```

```
SPONGE FILTER                                  ○ Rating needed                  [neutral]
Filtration not evaluated.
Enter the tank size this sponge is rated for (printed on the box).
Old value 120 GPH — not used for sponge filters.
```

```
FILTRATION                                     ✓ Filtration appears adequate    [green]
Powered filter: 150 GPH · 5.2× / hour (rated)
+ Additional sponge filter: rated up to 20 gal
Filtration supports your livestock but does not increase stocking capacity.
```

```
FILTRATION                                     ⚠ Review filtration              [amber]
Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× minimum
Sponge filter: rated up to 20 gal — below this 29 gal tank
Neither filter is sized for this tank on its own. A filter rated for this tank is the safer choice.
```

```
UNDERGRAVEL FILTER                             ✓ Rated for this tank            [green]
Rated for: 20 Long – 29 gal tanks · Tank: 29 gal
```

Warning ids (for `compute.legacy.js`, future): `filtration.likely_multi_sponge` (warn / amber),
`filtration.below_rating` (warn / amber), `filtration.review` (warn / amber),
`filtration.rating_needed` (info / neutral, not a warning). Existing `filtration.none`,
`filtration.circulation_only`, `filtration.very_low` unchanged; `very_low` applies only when
powered filters are the only evaluable biological devices.

---

## 13. Decision matrix (Step 19)

### 13.1 Final decisions by situation (LOCKED)

| Situation | Result | Tone |
| --- | --- | --- |
| ONE appropriately (verified) rated sponge | Rated for this tank / adequate | **GREEN** |
| Multiple undersized sponges whose nominal ratings together cover the tank | Likely adequate — multiple sponge filters | **AMBER** |
| Sponge below rating (and the above does not apply) | Below manufacturer rating | **AMBER** |
| Unknown sponge rating (only biological filtration) | Not evaluated — rating needed | **NEUTRAL** |
| Powered filter independently adequate | Filtration appears adequate | **GREEN** |
| Sponge independently adequate (with or without a powered filter) | Filtration appears adequate / rated for this tank | **GREEN** |
| Neither powered nor sponge independently adequate | Review filtration | **AMBER** |
| Powered filters only, below the 2× floor | Filter flow too low (existing Phase 2C) | **RED** (unchanged) |
| No biological filtration (powerheads only) | No biological filter (existing) | **RED** (unchanged) |
| Nothing entered | No filter added (existing) | existing (unchanged) |

### 13.2 Option comparison (why the tiered rule was locked)

Qualitative scores: ●●● strong / good, ●● moderate, ● weak / poor.

| Criterion | 1. Additive ratings | 2. Largest sponge only | 3. Independent, non-additive | 4. **Tiered, amber multi-sponge tier (locked)** |
| --- | --- | --- | --- | --- |
| Evidence strength | ● no maker states additivity; sums marketing figures | ●● rule form well supported; ignores real multi-sponge practice | ●●● only claims what each rating says | ●●● green = rule makers use; amber = honestly unverified |
| User clarity | ●● one number, but a misleading one | ●● clear, but "below rating" on normal setups confuses | ●● clear per device; no answer for 2 × undersized | ●●● one headline; each sponge's own rating shown |
| Mathematical honesty | ● presents Σ marketing classes as capacity | ●●● no invented arithmetic | ●●● none | ●●● sum only a yes/no threshold for an amber state; never displayed, never green |
| Common hobby setups | ●●● passes all | ● fails 2 × 10 on 20, 2 × 40 on 55 | ● same as 2 | ●●● amber "likely", not failure |
| Saved-state complexity | ●● needs instances + rating | ●● same | ●● same | ●● same |
| Ease of implementation | ●●● | ●●● | ●● | ●● one extra level and copy |
| Gaming resistance (many tiny sponges) | ● | ●●● | ●●● | ●● amber only; listed per sponge |

Coding simplicity alone would pick 1 or 2. Option 4 was locked because it is both honest about
precision (the unverified case is amber) and fair to ordinary setups.

---

## 14. Common-case simulations (summary, locked model)

Full user-facing output is in section 4.5; multi-sponge cases in 3.2–3.3.

| Case | Tank | Setup | Result | Tone |
| --- | --- | --- | --- | --- |
| A | 29 | 150 GPH HOB | Filtration appears adequate (HOB) | green |
| B | 29 | 150 HOB + 20-gal sponge | adequate (HOB) + sponge supplemental | green |
| C | 29 | 100 HOB + 40-gal sponge | adequate (both paths) | green |
| D | 55 | 200 canister + 40-gal sponge | adequate (canister) + sponge supplemental | green |
| E | 55 | 1 × 40-gal sponge | Below manufacturer rating | amber |
| F | 55 | 2 × 40-gal sponges | Likely adequate — multiple sponge filters | amber |
| G | 20 | 1 × 20-gal sponge | Rated for this tank | green |
| H | 29 | 40 HOB + 20-gal sponge | Review filtration | amber |
| U | 20 | 1 sponge, rating unknown | Not evaluated — rating needed | neutral |
| 4a | 10 | 2 × 10-gal | Rated for this tank + additional sponge | green |
| 4b | 20 | 2 × 10-gal | Likely adequate — multiple sponge filters | amber |
| 4c | 29 | 2 × 20-gal | Likely adequate — multiple sponge filters | amber |
| 4d | 55 | 2 × 40-gal | Likely adequate — multiple sponge filters | amber |
| 5a | 20 | 10 + 20 | Rated (20) + additional | green |
| 5b | 29 | 20 + 40 | Rated (40) + additional | green |
| 5c | 55 | 20 + 40 | Likely adequate — multiple sponge filters | amber |
| M1 | any | v1 custom sponge, 120 GPH only | Rating needed; "old value 120 GPH — not used" | neutral |
| M2 | any | v1 catalog sponge id + fake GPH | re-resolved from catalog rating | per rating |
| M3 | 29 | stale cached sponge record, no rating field | Rating needed for one load, then per rating | neutral → per rating |
| M4 | any | future "20 gal and up" product | Rating needed (needs source/product review) | neutral |

Compared with today: every "adequate" that today depends on an invented sponge GPH (sponge audit
§8) is replaced by a rating statement; no sponge result is red.

---

## 15. Final implementation sequence (Step 20) — LOCKED order

Each phase is a separate PR with tests; none changes Stocking Load. **None is implemented yet.**

| Phase | Content | User-visible? | Depends on |
| --- | --- | --- | --- |
| **A. Saved-state v2 plumbing + capacity-method support** | Shared v2 serializer for both writers (controller, `tankStore`); v1 → v2 read/migrate; `capacityMethod` / `ratedMaxGallons` / `ratingStatus` recognised and passed through `normalizeFilter`, `sanitizeFilter`, persistence; `instanceId` field reserved (one per product). No scoring change; sponges still score as today. | No | — |
| **B. Rating-based sponge engine + catalog metadata + custom sponge input** (one coordinated release) | Type-wins rule; locked decision logic (4.4) and levels; warning copy; every GPH gate in 9.3 so rating-method records neither disappear nor become fake-GPH custom filters; catalog rating fields for the 7 sponges with **verified** ratings (unverifiable → `needs_review`); legacy `gphRated` **retained but ignored**; custom Sponge input "Rated for up to ___ gallons"; UGF resolves as rating-method (Rating needed until F). | Yes | A |
| **C. Stale-cache / legacy saved-state migration validation** | Tests and manual checks: stale cached catalog with fake GPH; v1 catalog sponge ids; v1 custom sponges → Rating needed + old value note; unknown/removed ids; UGF id; old-JS + new-data window; `capacityAdjustment` 0 and Stocking Load identical with/without sponges. Fixes only if gaps are found. | No | B |
| **D. Same-product multiple instances** | Instance ids in the picker and chips; grouped ×N chip; remove-one; sponge picker stops hiding undersized sponges. Not UGF. | Yes | A–C |
| **E. Remove legacy sponge GPH** | Remove `gphRated` and GPH-bucket `minGallons`/`maxGallons` from the air-driven records once B–C protection is live for ≥ 1 release; bump catalog cache key; stop v1 mirror writes after grace period; correct `FILTRATION_MODEL.md` §6. | No | B, C |
| **F. UGF model** | `compatibleTanks` rule, status copy, picker eligibility; id stays resolvable. | Yes | B |
| **G. Filtration-status UI** | The card in section 12 (per-path lines, supplemental lines, redundancy line). | Yes | B, D, F |

Phase B cannot be split: shipping the engine without the data makes every sponge "rating needed";
shipping the data without the engine lets old gates drop null-GPH sponges or restore saved ones as
custom filters carrying the fake GPH; shipping either without the custom input strands old custom
sponges with no way to enter a rating.

---

## 16. Remaining uncertainties / open items

Locked decisions are not re-opened here; these are inputs or copy still needed.

1. **Rating verification (blocks phase B data).** All seven sponge ratings and the UGF
   compatibility are grade C. Each must be confirmed at A/B before it can produce green; anything
   not confirmable ships as `needs_review` (Rating needed).
2. **Brand inconsistency.** hygger's ranges are generous relative to similar sponges; the design
   reports the maker's number and does not correct it.
3. **Unrated sponge beside a failing powered filter** (4.4): the locked logic shows red for the
   powered path with a neutral unrated-sponge line; whether that should read amber "Review" is a
   minor open call.
4. **Many tiny sponges** copy note — deferred; not in the first implementation.
5. **Stocking Load coupling** — deferred (D7); revisit only with evidence.
6. **"And up" products** — stay needs-review (D9) until a maximum or another defensible capacity
   method exists; custom-input wording for them is a UI-phase copy decision.
7. **Powered-filter path is unchanged** and inherits the open threshold questions (2× floor vs.
   EHEIM 2213 at 1.76×; the 2×–4× "low" band). This design does not resolve them.
8. **UGF preset ids** for compatible tanks to be confirmed against the tank preset list in phase F.
9. **Legacy picker / drawer code** (`js/stocking.js` product picker, `js/ui/filter-drawer.js`) is
    disabled while the controller owns filters; phase B must confirm neither path can still write
    sponge GPH into `appState.filters`.

---

## Files changed

- `_internal/reports/stocking-advisor-sponge-filter-migration-design-2026-09.md` (this report).

No production code, catalog data, tests, saved-state format or UI changed.
