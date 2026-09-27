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

No new web research was possible beyond the three reports (the egress proxy blocks the relevant
manufacturer and hobby sites, as recorded in those reports). Evidence grades used below are the
reports' scale: A verified on manufacturer page · B manufacturer/distributor text via search index
· C secondary listing/forum · D derived by repo code · E no source.

---

## 1. Product decision summary

| Question | Sponge audit (proposed) | **This design (recommended)** |
| --- | --- | --- |
| Can one correctly rated sponge pass on its own? | Yes | **Yes** — "Rated for this tank". No evidence that an appropriately sized air-driven sponge is categorically inadequate (section 2.4). |
| Are sponge ratings additive? | Yes, "combined rating" | **No, not as a capacity number.** A tiered, non-additive rule: one sponge rated ≥ tank → *rated*; several sponges whose printed ratings together reach the tank size → a separate, softer **"Likely adequate — several sponges"** status. The sum is used as a *threshold test only* and is never displayed as "combined rating N gal". |
| Sponge + powered filter | Coverage sum (sponge gal + GPH ÷ 2) | **Independent dimensions, either path can satisfy.** Powered filter judged by the unchanged Phase 2C flow floor; sponge judged by its rating; overall passes if **either** path passes on its own. The other device is shown as supplemental. No combined number. |
| Convert powered GPH to gallons? | Yes (GPH ÷ 2) | **No.** It would turn an unvalidated floor (2×) into a capacity equivalence the threshold research shows is contradicted by manufacturers (EHEIM 2213 1.76× at its own max tank). |
| Neither path passes alone (weak HOB + small sponge) | Coverage sum might pass | **"Review" (amber)**, never green, never a combined number. Severity drops from danger to warn because a second biological filter exists. |
| Stocking Load | Never changes capacity | Same. It may only change **copy / severity of a non-passing or "likely" status**, never pass/fail (section 5). |
| Measured GPH for sponges | Optional scored override | **Not scored; omit from first release** (section 6.3). |
| Same product twice | Allow for sponges | **Allow for all filter types** except UGF, with per-instance IDs (section 10). |
| UGF | Rating check, separate type | **Separate rating check, eligibility by tank preset footprint, never combined with sponges** (section 11). |

One-line decision logic (detail in section 4.4):

> **Filtration passes if (a) the powered filters pass the existing flow floor, or (b) one sponge is
> rated for the tank. If neither, several sponges whose ratings together reach the tank size give
> "Likely adequate". Otherwise the result is "Review" (some biological filter present) or the
> existing none / circulation-only states.**

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

### 2.3 Model A — single sponge rating check

Rule: `manufacturerMaxGallons ≥ tank gallons` → **"Rated for this tank"**; otherwise
**"Below manufacturer rating"**.

| Criterion | Assessment |
| --- | --- |
| Transparent? | **Yes.** Both numbers are shown ("Rated up to 20 gal · Tank 29 gal"); the user can check them against the box. No derived number. |
| Overstates precision? | No, provided the word is "rated", not "adequate capacity" or "turnover". |
| Evidence | Strong for the *rule form* — every maker and every hobby source found sizes sponges this way (sponge audit §4–5). Weak for the *numbers* (marketing-grade, brand-inconsistent). |
| Failure mode | Only handles one sponge; on its own it fails two 10-gal sponges on a 20-gal tank, an ordinary setup (section 3). |
| Nominal vs actual gallons | Use the **nominal** tank size the user selected, as makers rate against nominal sizes and Phase 2C turnover already uses nominal gallons. |
| Min rating | Ignored for adequacy. An oversized sponge in a small tank is not a filtration problem (section 7.2). |

**Verdict: production-ready as the core check**, provided (1) it is paired with the multi-sponge
tier and the independent powered path, and (2) the result is labelled "rated", with the rating and
the tank both visible.

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
| **A. Additive** | Status and display use Σ ratings as "combined rating N gal". |
| **B. Largest only** | Only the largest single rating counts. |
| **C. Redundancy, no capacity** | Extra sponges are acknowledged ("additional biological filtration") but never change the status. |
| **D. Tiered** (recommended) | Largest rating ≥ tank → *Rated for this tank* (+ "additional sponge" line). Else Σ ratings ≥ tank → ***Likely adequate — several sponges***, a distinct status that shows each sponge's own rating and never a combined number. Else → *Below manufacturer rating*. |

### 3.2 Identical sponges (Step 4)

| Tank | Setup | A. Additive | B. Largest only | C. Redundancy only | **D. Tiered** |
| --- | --- | --- | --- | --- | --- |
| 10 gal | 2 × 10-gal | ✓ combined 20 gal | ✓ rated (10 ≥ 10) | ✓ rated + additional sponge | **✓ Rated for this tank · + 1 additional sponge** |
| 20 gal | 2 × 10-gal | ✓ combined 20 gal | ⚠ below rating | ⚠ below rating (+ "you have 2 sponges") | **✓ Likely adequate — 2 sponges, each rated up to 10 gal** |
| 29 gal | 2 × 20-gal | ✓ combined 40 gal | ⚠ below rating | ⚠ below rating | **✓ Likely adequate — 2 sponges, each rated up to 20 gal** |
| 55 gal | 2 × 40-gal | ✓ combined 80 gal | ⚠ below rating | ⚠ below rating | **✓ Likely adequate — 2 sponges, each rated up to 40 gal** |

### 3.3 Different sponges (Step 5)

| Tank | Setup | A. Additive | B. Largest only | C. Redundancy only | **D. Tiered** |
| --- | --- | --- | --- | --- | --- |
| 20 gal | 10 + 20 | ✓ combined 30 | ✓ rated (20) | ✓ rated + additional | **✓ Rated for this tank (20-gal sponge) · + additional sponge** |
| 29 gal | 20 + 40 | ✓ combined 60 | ✓ rated (40) | ✓ rated + additional | **✓ Rated for this tank (40-gal sponge) · + additional sponge** |
| 55 gal | 20 + 40 | ✓ combined 60 | ⚠ below rating | ⚠ below rating | **✓ Likely adequate — 2 sponges (up to 40 and up to 20 gal)** |

The same tiered rule works unchanged for mixed sizes: the "rated" tier is decided by the largest
sponge, the "likely" tier by the sum used as a threshold only.

### 3.4 Why tiered, not additive or largest-only

- **Against pure additivity (A):** no manufacturer states that ratings add; the ratings themselves
  are marketing classes that differ by brand for similar sponges (hygger S "10–40" vs AQUANEAT
  nano "≤10"). Displaying "combined rating 80 gal" presents the sum of two marketing figures as a
  measured capacity — exactly the kind of invented precision this migration removes. It is also
  gameable (five 10-gal sponges "rate" a 50-gal tank).
- **Against largest-only (B) and redundancy-only (C):** both fail the most ordinary multi-sponge
  setups (two sponges on a 20-gal breeder; two large sponges on a 55), contradicting the common
  hobby practice the sponge audit documents. They are conservative in a way the evidence does not
  support — colonised surface and airlift count really do scale with the number of sponges.
- **For tiered (D):** it keeps the only strongly supported statement ("this sponge is sold for this
  tank") as the top tier, and gives multi-sponge setups a positive but honestly softer status. The
  sum is used only as a yes/no threshold, the display lists each sponge's own rating, and nothing
  claims a combined capacity.

Guard against stacking many tiny sponges: **no numeric coefficient** (none has a source). The
"likely" tier always lists every sponge and its rating, so five 10-gal sponges on a 50 read as
exactly that. Optional copy-only note when the largest sponge is rated for well under the tank
("Several small sponges: make sure each one gets good air flow") — the cut-off (e.g. under half the
tank) is a judgement call and is listed as an open decision (section 16).

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
It appears under any passing or "likely" state, and never raises a below-rating result to passing
on its own (the tier rule does that, or nothing does).

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

### 4.2 Should powered GPH ever be converted into gallon capacity?

**Not now, and not via turnover.** The only defensible future route to putting powered filters and
sponges on one scale is the **manufacturer tank rating** that powered filters also carry (catalog
fix batch 1 recorded real manufacturer ranges for AC70, Fluval 307, EHEIM 2213). That is a
separate, future research question (does "rated for 70 gal" + "rated for 20 gal" mean anything
together?) and it has the same additivity problem as sponges. Until then the two paths stay
independent.

### 4.3 When neither path passes alone

Example: 29 gal, 40 GPH HOB (1.4×, below the floor) + one 20-gal sponge (below rating).

- No combined number is computed.
- Status: **"⚠ Review filtration"** (warn). Today's `very-low` is danger; the downgrade to warn is
  justified only by the presence of a second, independent biological filter, not by any arithmetic.
- Copy: "Neither filter is sized for a 29-gal tank on its own. Together they may be enough for light
  stock; a filter rated for this tank is the safer choice."

### 4.4 Recommended overall decision logic (pseudo-code, not implemented)

```text
bio      = biological devices (not powerheads/wavemakers)
powered  = bio with capacityMethod 'flow'      (HOB, CANISTER, INTERNAL, OTHER, custom powered)
sponges  = bio with capacityMethod 'manufacturer_rating' and type SPONGE, rating known
unrated  = bio with capacityMethod 'manufacturer_rating' and rating unknown   ("rating needed")
ugf      = bio with type UGF (own check, section 11)

poweredPass  = powered.length > 0 and Σ powered GPH ÷ nominal gal ≥ MIN_BIOLOGICAL_TURNOVER (unchanged 2)
spongeRated  = any sponge.ratedMaxGallons ≥ nominal gal
spongeLikely = !spongeRated and sponges.length ≥ 2 and Σ sponge.ratedMaxGallons ≥ nominal gal
ugfRated     = ugf compatible with the selected tank preset

if no devices                          → NONE                ("No filter added")          unchanged
else if bio is empty                   → CIRCULATION_ONLY     ("No biological filter")     unchanged
else if poweredPass or spongeRated or ugfRated
                                       → ADEQUATE / RATED     (headline names the path that passes)
else if spongeLikely                   → LIKELY               ("Likely adequate — several sponges")
else if unrated non-empty and nothing else passes
                                       → RATING_NEEDED        ("Sponge filter — rating needed")
else if bio.length ≥ 2                 → REVIEW (warn)        (several filters, none sized alone)
else if only powered                   → VERY_LOW (danger)    unchanged Phase 2C
else (only sponges, below rating)      → BELOW_RATING (warn)
```

- The powered floor, its value and its copy are **unchanged** by this design (threshold research
  questions remain open separately).
- Sponges never contribute GPH to `biologicalGph` / turnover; they are removed from the flow sum.
- `capacityAdjustment` stays 0. Nothing here touches the bioload percentage.
- Supplemental lines: every device not needed for the verdict is listed ("Additional sponge
  filter: rated up to 20 gal"); an unrated sponge next to a passing powered filter shows "rating
  needed" as a neutral line, not a warning.
- Severity of `BELOW_RATING`: **warn**, not danger — the ratings are marketing-grade and a 40-gal
  sponge on a 55 is a margin question, not "effectively unfiltered". Red stays for no filter /
  circulation only / powered-only below the floor.

### 4.5 Common-case simulations (Step 7)

Powered turnover uses the unchanged 2× rated floor. "Additive" = sponge-audit coverage model
(sponge gal + GPH ÷ 2). "Independent (no tiers)" = model B without the "likely" tier.

| # | Tank | Setup | Today (fake GPH) | Additive coverage | Largest only + independent | Independent, no tiers | **Recommended (B + tiers)** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 29 | 150 GPH HOB | 5.2× adequate | 75/29 ✓ | ✓ (HOB) | ✓ (HOB) | **✓ adequate (HOB)** |
| B | 29 | 150 HOB + 20-gal sponge | 9.3× adequate | 95/29 ✓ | ✓ (HOB) | ✓ (HOB) | **✓ adequate (HOB) + sponge supplemental** |
| C | 29 | 100 HOB + 40-gal sponge | 10.3× adequate | 90/29 ✓ | ✓ (both) | ✓ | **✓ adequate (HOB 3.4× and sponge rated)** |
| D | 55 | 200 canister + 40-gal sponge | 7.3× adequate | 140/55 ✓ | ✓ (canister) | ✓ | **✓ adequate (canister) + sponge supplemental** |
| E | 55 | one 40-gal sponge | 3.6× adequate (fake 200) | 40/55 ✗ | ⚠ below | ⚠ below | **⚠ Below manufacturer rating** |
| F | 55 | two 40-gal sponges | 7.3× adequate | 80/55 ✓ | ⚠ below | ⚠ below | **✓ Likely adequate — 2 sponges** |
| G | 20 | one 20-gal sponge | 6.0× adequate | 20/20 ✓ | ✓ rated | ✓ rated | **✓ Rated for this tank** |
| H* | 29 | 40 HOB + 20-gal sponge | 5.5× adequate | 40/29 ✓ | ⚠ review | ⚠ review | **⚠ Review filtration** |

(* extra case, section 4.3.) Case B/C/D/E/F "today" figures use the catalog's fake sponge GPH
(AQUANEAT Large 200 standing in for a "40-gal" sponge; AQUANEAT Middle 120 for "20-gal").

**Exactly what the user would see (recommended model; UI not built, wording from section 12):**

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

E  55 gal · sponge (up to 40 gal)
   ⚠ Below manufacturer rating
   Sponge filter rating: up to 40 gal · Tank: 55 gal
   Add a second sponge or a filter rated for this tank.
   Filtration supports your livestock but does not increase stocking capacity.

F  55 gal · 2 × sponge (up to 40 gal each)
   ✓ Likely adequate — 2 sponge filters
   Each sponge is rated up to 40 gal · Tank: 55 gal
   No single sponge is rated for this tank, but together they cover its size.
   Two sponges also give backup — rinse them on different weeks.
   Filtration supports your livestock but does not increase stocking capacity.

G  20 gal · sponge (up to 20 gal)
   ✓ Rated for this tank
   Sponge filter rating: up to 20 gal · Tank: 20 gal
   Sponge filters are sized by tank; water flow isn't estimated.
   Filtration supports your livestock but does not increase stocking capacity.
```

Case-by-case notes: C passes on *both* paths — the headline stays one line. D's sponge is below
its own rating for 55 gal but is not flagged, because it is not carrying the tank. E is the only
sponge-alone warning, and it is amber, not red.

---

## 5. Stocking Load interaction (Step 9)

Rule kept from all three reports: **filtration never changes Stocking Load, never adds capacity,
never gives a bonus.** Stocking Load may only change *how loudly* a non-certain filtration result is
worded — the threshold research's "severity only" use (§11, §17).

| Filtration result | Low / moderate Stocking Load | High Stocking Load | Over capacity |
| --- | --- | --- | --- |
| Rated for this tank / powered passes | ✓ no note | ✓ + neutral note: "Heavily stocked: rinse sponges regularly; a second filter adds headroom." | ✓ status unchanged; the existing over-capacity warning carries the message |
| Likely adequate — several sponges | ✓ (info) | **amber candidate**: "Several sponges at a high stocking level — a filter rated for this tank adds margin." | as left |
| Below rating / review | ⚠ warn | ⚠ warn, stronger copy | ⚠ warn |

- No evidence supports changing pass/fail by load (sponge audit, threshold research §11: direction
  supported, numbers not). So load never turns a pass into a fail or vice versa.
- The "high" band edge is not chosen here. The threshold research's candidate (70 %) is itself
  unapproved; implementation should reuse whatever band the advisor already displays rather than
  introduce a new one. Listed as an open decision.
- If the product owner prefers zero load coupling in the first release, the table collapses to the
  left column plus the existing over-capacity warning; nothing else in the design depends on it.

---

## 6. Custom input design (Step 11)

### 6.1 Flow (not built)

```
Filter type:  [ Sponge ▾ ]

What size aquarium is this sponge filter rated for?
Rated for up to [ 20 ] gal          ← required, integer 1–300
Hint: printed on the box or in the listing title, e.g. "up to 20 gallons".
      If it gives a range like "10–40 gal", enter the larger number.

[ Add filter ]
```

- Selecting **Sponge** swaps the GPH field for the rating field (same position, same Add button).
  Every other type keeps the GPH field unchanged.
- Label on the chip: "Sponge · rated up to 20 gal".
- Validation copy: "Enter the tank size the sponge is rated for (the number on the box)."
- The `canAddManual` rule becomes type-aware: Sponge requires a rating, not a GPH.
- "X gal and up" ratings (Aquarium Co-Op style minimum sizes): not in the catalog today; the hint
  cannot turn a minimum into a maximum. First release: no special handling beyond the hint;
  listed as an open item (section 16).

### 6.2 Custom UGF

The custom type list has no UGF option today; do not add one in the first release (section 11).

### 6.3 Optional "measured water flow" override — recommendation: omit

| For | Against |
| --- | --- |
| Real jug-and-timer data is valid. | Very few users measure it; it changes weekly with clogging. |
| Engages advanced users. | There is **no validated turnover threshold for sponges**. A real measured 30 GPH on a 20-gal tank (1.5×) would fail the powered floor while the sponge is rated for the tank — the override would create a contradiction the advisor cannot resolve. |
| | A GPH box next to a sponge invites users to paste a listing or air-pump number, recreating the problem being removed. |
| | Old saved custom sponges carry exactly such a GPH (section 9); a measured-GPH field would blur that migration. |

**Recommendation: do not include a measured-flow field in the first release.** If ever added, it
should be display-only ("Measured flow: 30 GPH — not used for the rating check"), which makes its
value marginal. Revisit only if users ask for it.

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
  configuration (section 3). Today `filterGearByTank` would hide it.
- Recommended picker behaviour for sponges: show all sponges on every tank, grouped
  "Rated for this tank" first, then "Smaller than this tank (use more than one)".
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
  "manufacturerMaxGallons": 20,               // the only number used for adequacy
  "manufacturerMinGallons": null,             // display only; null when the maker gives none
  "ratingExpression": "up_to",                // up_to | range | min_only
  "ratingSource": "https://…",                // required for new rating-method records
  "ratingConfidence": "C",                    // report grade; review-only, not shown to users

  // legacy, retained for ONE release so an old JS bundle still loads the record (section 9.3);
  // ignored by new code for every capacityMethod "manufacturer_rating" record:
  "gphRated": 120,
  "minGallons": 0,
  "maxGallons": 20
}
```

Powered filters: unchanged. `capacityMethod` may be omitted (defaults to `flow`).

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
- `instanceId`: short random id, unique within the list; `productId` may repeat.

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
  If the unrated sponge is the only biological device, headline "Sponge filter added — enter its
  rated tank size to check it" (info/warn tone), never "No filter added", never "adequate".
- **Accepted cost**: a user who really did measure their sponge's flow loses that number from
  scoring. That is the correct trade (section 6.3), and the note shows the old value once.

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

1. **Code before data.** The runtime (type-wins, rating path, v2) ships first or in the same release
   as the rating fields.
2. **Keep legacy `gphRated` in the data for one release** after the rating fields are added. New
   code ignores it for rating-method records; an old JS bundle still in a tab (JS and `/data` are
   `must-revalidate`, so this window is short) keeps today's behaviour instead of dropping sponges
   or turning saved sponges into custom-with-old-GPH.
3. **Then** remove `gphRated` from the 8 records and bump the catalog cache key to
   `ttg.gear.catalog.v2` (belt and braces — type-wins already neutralises the old cache).
4. Tests: stale cached sponge with GPH and no rating → rating needed; v1 catalog sponge id → catalog
   rating; v1 custom sponge → rating needed + `legacyGph`; sponge GPH never appears in
   `biologicalGph`; `capacityAdjustment` stays 0; Stocking Load identical with and without sponges.

---

## 10. Duplicate-instance design (Step 16)

**Recommendation: allow the same catalog product more than once for all filter types, except UGF.**

- Sponges: two identical sponges is the canonical multi-sponge setup (section 3).
- Powered filters: two identical HOBs on a large tank is also normal, and Phase 2C already sums
  powered GPH, so a repeat is simply counted. Blocking it today forces users into custom entries.
- Powerheads: repeats are normal (circulation, not scored).
- UGF: one plate set per tank; keep the block.

Design:

- State holds **instances**: `{instanceId, productId, …}`. `instanceId` is generated on add
  (`f-` + short random, checked unique in the list); `productId` repeats.
- Every identity operation moves from `id` to `instanceId`: `setFilters` de-dupe, `removeFilterById`
  (remove **one** instance), chip keys, saved state.
- UI: identical products render as one chip with a count, "AQUANEAT Middle ×2", with a remove-one
  control; Add Selected on an already-added product increments instead of saying "Already added".
- v1 → v2 migration assigns fresh instanceIds; since v1 could not hold repeats, no collision exists.
- Gear-page `?filter=<id>` hand-off adds one instance, unchanged.

Because the "likely" tier (section 3) is otherwise reachable only with custom entries or two
different products, duplicate support should ship **with or immediately after** the rating model,
not at the end (section 15).

---

## 11. UGF recommendation (Step 17)

`penn-plax-ugf-20-29`: rated "20 Long – 29 gal", two 14" × 11.1" plates (28" × 11.1" total), two
lift tubes, air pump not included (sponge audit §11, grade C). Stored GPH 150 is unsupported.

| Option | Assessment |
| --- | --- |
| **A. Manufacturer-rating model like sponges** (`maxGallons 29 ≥ tank`) | Simple, but wrong in both directions: a 20 High (24" × 12") is ≤ 29 gal yet the 28" plates don't fit; a 10-gal passes the gallon test but the plates can't fit either. UGF capacity is plate/bed **area**, not volume. |
| **B. Dedicated UGF model: stated tank compatibility / footprint** | Matches the product: rated for specific tank footprints. The advisor's tank presets carry ids like `20l`, `29g` and dimensions, so compatibility can be a preset list (`compatibleTanks: ["20l","29g"]`) or a plate-footprint check. |

**Recommended near-term treatment:** B in its simplest form.

- `type: "UGF"`, `capacityMethod: "manufacturer_rating"` (so type-wins removes the fake GPH),
  plus `compatibleTanks: ["20l", "29g"]`.
- Status: "✓ Undergravel filter rated for this tank (20 Long–29 gal)" on a compatible preset;
  "Rating needed / not rated for this tank size" otherwise. Offered in the picker only for
  compatible presets.
- **Never combined** with sponge ratings (a UGF is a whole-bottom filter; the tiers in section 3
  are sponge-only). It is its own passing path in section 4.4.
- No custom UGF option; powerhead-driven UGFs are not modelled.
- If the product owner would rather not maintain a one-record special case, **removing the record**
  is equally safe — provided the id remains resolvable so saved plans show "rating needed" instead
  of a custom filter with 150 GPH.

---

## 12. Status-language examples (Step 18) — proposals only, no card built

Rules: say "rated" for manufacturer ratings and "rated" for GPH-based turnover; never show a
turnover or GPH for a sponge; never show a combined gallon figure; keep the permanent line
"Filtration supports your livestock but does not increase stocking capacity." on every state.

```
SPONGE FILTER                                  ✓ Rated for this tank
Manufacturer rating: up to 40 gal
Tank: 29 gal
Sponge filters are sized by tank; water flow isn't estimated.
```

```
SPONGE FILTER                                  ⚠ Below manufacturer rating
Filter rating: up to 20 gal
Tank: 29 gal
Add a second sponge or a filter rated for this tank.
```

```
SPONGE FILTERS                                 ✓ Likely adequate — 2 sponges
Each rated up to 20 gal · Tank: 29 gal
No single sponge is rated for this tank, but together they cover its size.
Two sponges also give backup — rinse them on different weeks.
```

```
FILTRATION                                     ✓ Filtration appears adequate
Powered filter: 150 GPH · 5.2× / hour (rated)
+ Additional sponge filter: rated up to 20 gal
Filtration supports your livestock but does not increase stocking capacity.
```

```
FILTRATION                                     ⚠ Review filtration
Powered filter: 40 GPH · 1.4× / hour (rated)
Sponge filter: rated up to 20 gal · Tank: 29 gal
Neither filter is sized for this tank on its own. Together they may be enough for light stock;
a filter rated for this tank is the safer choice.
```

```
SPONGE FILTER                                  ○ Rating needed
Sponge — rating needed
Enter the tank size this sponge is rated for (printed on the box).
Previously entered 120 GPH — no longer used for sponge filters.
```

```
UNDERGRAVEL FILTER                             ✓ Rated for this tank
Rated for: 20 Long – 29 gal tanks · Tank: 29 gal
```

Warning ids (for `compute.legacy.js`, future): `filtration.below_rating` (warn),
`filtration.review` (warn), `filtration.rating_needed` (info), `filtration.likely` (info, no
warning by default). Existing `filtration.none`, `filtration.circulation_only`,
`filtration.very_low` unchanged; `very_low` applies only when powered filters are the only
biological devices.

---

## 13. Decision matrix (Step 19)

Qualitative scores: ●●● strong / good, ●● moderate, ● weak / poor.

| Criterion | 1. Additive ratings | 2. Largest sponge only | 3. Independent, non-additive | 4. **Tiered combined interpretation** |
| --- | --- | --- | --- | --- |
| Evidence strength | ● no maker states additivity; sums marketing figures | ●● rule form well supported; ignores real multi-sponge practice | ●●● only claims what each rating says | ●●● top tier = rule makers use; lower tier explicitly softer |
| User clarity | ●● one number, but a misleading one | ●● clear, but "below rating" on normal setups confuses | ●● clear per device; no answer for 2 × undersized | ●●● one headline; each sponge's own rating shown |
| Mathematical honesty | ● presents Σ marketing classes as capacity | ●●● no invented arithmetic | ●●● none | ●● sum used only as a yes/no threshold, never displayed |
| Common hobby setups | ●●● passes all | ● fails 2 × 10 on 20, 2 × 40 on 55 | ● same as 2 | ●●● passes them, as "likely" |
| Saved-state complexity | ●● needs instances + rating | ●● same | ●● same | ●● same (all four need instances and ratings) |
| Ease of implementation | ●●● | ●●● | ●● | ●● one extra level and copy |
| Gaming resistance (many tiny sponges) | ● | ●●● | ●●● | ●● listed per sponge; optional copy note |

Coding simplicity alone would pick 1 or 2. **4 is recommended**: the only option that is both
honest about precision and correct on ordinary setups. Saved-state cost is identical for all four.

---

## 14. Common-case simulations (summary)

Full user-facing output is in section 4.5; multi-sponge cases in 3.2–3.3.

| Case | Tank | Setup | Recommended result |
| --- | --- | --- | --- |
| A | 29 | 150 GPH HOB | ✓ adequate (HOB) |
| B | 29 | 150 HOB + 20-gal sponge | ✓ adequate (HOB) + sponge supplemental |
| C | 29 | 100 HOB + 40-gal sponge | ✓ adequate (both paths) |
| D | 55 | 200 canister + 40-gal sponge | ✓ adequate (canister) + sponge supplemental |
| E | 55 | 1 × 40-gal sponge | ⚠ below manufacturer rating (warn) |
| F | 55 | 2 × 40-gal sponges | ✓ likely adequate — 2 sponges |
| G | 20 | 1 × 20-gal sponge | ✓ rated for this tank |
| H | 29 | 40 HOB + 20-gal sponge | ⚠ review filtration (warn) |
| 4a | 10 | 2 × 10-gal | ✓ rated + additional sponge |
| 4b | 20 | 2 × 10-gal | ✓ likely adequate |
| 4c | 29 | 2 × 20-gal | ✓ likely adequate |
| 4d | 55 | 2 × 40-gal | ✓ likely adequate |
| 5a | 20 | 10 + 20 | ✓ rated (20) + additional |
| 5b | 29 | 20 + 40 | ✓ rated (40) + additional |
| 5c | 55 | 20 + 40 | ✓ likely adequate |
| M1 | any | v1 custom sponge 120 GPH only | ○ rating needed |
| M2 | any | v1 catalog sponge id + fake GPH | re-resolved from catalog rating |
| M3 | 29 | stale cached sponge record, no rating field | ○ rating needed for one load, then rated |

Compared with today: every "adequate" that today depends on an invented sponge GPH (sponge audit
§8) is replaced by a rating statement; the only sponge-alone warnings are E-type cases where the
sponge really is under its maker's rating and nothing else carries the tank.

---

## 15. Recommended rollout phases (Step 20)

The suggested A–G order is adjusted: saved-state plumbing and duplicates move earlier (the new
model needs instances and a place to store a rating), and legacy GPH removal moves later (old-JS
safety). Each phase is a separate PR with tests; none changes Stocking Load.

| Phase | Content | User-visible? | Depends on |
| --- | --- | --- | --- |
| **1. Plumbing** | Shared v2 serializer (both writers), v1 → v2 read/migrate, `instanceId`s, pass-through of new fields in `sanitizeFilter` / `normalizeFilter`. Engine and scoring unchanged; sponges still use GPH. | No | — |
| **2. Rating engine + data fields (switch-over release)** | Type-wins rule; rating path; tiered sponge logic; either-path verdict; new levels + warning copy; every GPH gate in §9.3; custom Sponge input asks rated gallons; v1 custom sponges → rating needed; catalog gets `capacityMethod`, `manufacturerMaxGallons`, `manufacturerMinGallons`, `ratingExpression`, `ratingSource` for the 7 sponges (**legacy `gphRated` retained, ignored**). UGF typed rating-method with `compatibleTanks`. Ratings re-verified before merge. | Yes | 1 |
| **3. Duplicate instances** | Same product more than once (not UGF); grouped chip ×N; remove-one. Sponge picker stops hiding undersized sponges. | Yes | 1, 2 |
| **4. Legacy GPH removal** | Remove `gphRated` and GPH-bucket `minGallons`/`maxGallons` from the 8 air-driven records; bump catalog cache key; stop v1 mirror writes after a grace period; correct `FILTRATION_MODEL.md` §6. | No | 2 shipped ≥ 1 release |
| **5. Filtration status card** | The card in section 12 (per-path lines, supplemental lines, redundancy line, Stocking Load copy). | Yes | 2, 3 |
| **6. Follow-ups** | Min-only ("X and up") ratings; optional measured-flow display; retire `tools/build_filter_catalog.py` override table (already queued). | — | — |

Phase 2 is necessarily one release: splitting the engine from the data would make every sponge
"rating needed" for a release, and splitting the custom input from the engine would strand old
custom sponges with no way to enter a rating.

---

## 16. Remaining uncertainties

1. **Ratings are grade C.** All seven sponge ratings and the UGF compatibility come from listing
   titles / mirrors. Re-verify each against a manufacturer page (A/B) before phase 2 merges.
2. **Brand inconsistency.** hygger's ranges are generous relative to similar sponges; the design
   reports the maker's number and does not correct it.
3. **"Likely adequate" tier** rests on a physical argument (more sponges = more media and more
   airlifts) and hobby practice, not on published additivity. It is labelled accordingly.
4. **Many tiny sponges**: whether to add the copy-only note, and its cut-off, is a product call.
5. **Severity choices**: below-rating = warn (not danger); review = warn; rating-needed = info.
   These are judgement calls to confirm.
6. **Stocking Load coupling**: whether to include the high-load copy / amber candidate at all, and
   which existing band to reuse.
7. **Min-only ratings** (Aquarium Co-Op "40 gal and up") have no maximum; not in the catalog, but a
   custom entry or future product needs a rule.
8. **Powered-filter path is unchanged** and inherits the open threshold questions (2× floor vs.
   EHEIM 2213 at 1.76×; the 2×–4× "low" band). This design does not resolve them.
9. **UGF footprint**: preset ids for compatible tanks must be confirmed against the tank preset
   list; powerhead-driven UGFs are unmodelled.
10. **Legacy picker / drawer code** (`js/stocking.js` product picker, `js/ui/filter-drawer.js`) is
    disabled while the controller owns filters; phase 2 must confirm neither path can still write
    sponge GPH into `appState.filters`.

---

## Files changed

- `_internal/reports/stocking-advisor-sponge-filter-migration-design-2026-09.md` (this report, new).

No production code, catalog data, tests, saved-state format or UI changed.
