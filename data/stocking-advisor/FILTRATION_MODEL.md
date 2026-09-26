# Stocking Advisor filtration model (Phase 2C)

Code: `js/stocking-advisor/filtration/math.js` (model), `js/logic/compute.legacy.js → buildFilteringState`
(warnings), `js/stocking-advisor/filtration/controller.js` (entry and summary line).
Tests: `tests/unit/filtration-model.test.mjs`, `tests/stocking-advisor-gate.spec.ts` ("filtration").
Audit that led here: `_internal/reports/filtration-model-audit-2026-09.md`.

## 1. Rule

**Filtration does not change the bioload percentage.**

```
bioload % = livestock load (GE, BIOLOAD_MODEL.md) ÷ effective gallons × 100
```

Filtration is a separate check shown beside it. A missing, weak or circulation-only setup produces a
warning; an adequate filter clears that warning; no filter, however large, lowers the percentage or
clears a tank-size, space, social, aggression, predation, water-parameter or data-load problem.

There is no biological-capacity bonus. The tool cannot see media volume, media condition, flow through
loaded media or whether the filter is cycled, and nitrifying bacteria grow to match the ammonia they
receive rather than the media available (§5). A bonus would therefore claim knowledge the tool does not
have, and it would tell beginners that buying a bigger filter makes a crowded tank safe.

## 2. Inputs

| Input | Source | Treated as |
| --- | --- | --- |
| Device type | catalog `type` or the custom "Filter type" menu | role only (below) |
| Rated GPH | catalog `gphRated` or the custom GPH field | manufacturer's estimate; an upper bound on real flow |
| Tank gallons | the selected tank's nominal gallons | turnover denominator |
| Stock flow needs | species `flow` (low / moderate / high) | turnover target and high-flow note |

Role: **circulation** for Powerhead (and Wavemaker); **biological** for every other type (HOB, canister,
internal, sponge, undergravel). Nothing else about the type is used: a canister and a HOB with the
same flow are assessed identically.

Flow per device is capped at 1,500 GPH (the entry field's limit). Zero, negative, missing and
non-numeric values are rejected and the device is not counted.

## 3. Calculation

```
biological GPH   = Σ rated GPH of biological devices
turnover (filter) = biological GPH ÷ tank gallons          (shown as "Filtration: X GPH • Y×/h")
total turnover    = Σ rated GPH of all devices ÷ tank gallons (circulation shown as "+N GPH circulation only")
target            = turnover band of the stock: high-flow species present → 8–12×; else moderate → 5–8×; else low → 3–5×
```

| Level | Condition (only when species are planned) | Warning id | Severity |
| --- | --- | --- | --- |
| none | no device entered | `filtration.none` | amber |
| circulation-only | devices entered, none biological | `filtration.circulation_only` | red |
| very-low | filter turnover < 2× | `filtration.very_low` | red |
| low | filter turnover below the stock target | `filtration.low` | amber |
| adequate | otherwise | — | — |

Additionally `filtration.high_flow` (amber) when the stock includes a low-flow species and total
turnover exceeds 10× (twice the top of the low-flow band), with a spray bar / baffle suggestion.

"No filter entered" is amber rather than red because the page starts with no filter and the user may
simply not have entered it yet. Entering equipment that provides under 2× flow through media (a
powerhead alone, a 1 GPH canister) is red, because the user has told the tool that the stock has
effectively no biological filter.

Multiple filters: flow through media adds (two 150 GPH HOBs = 300 GPH). Because no capacity is
awarded, duplicates cannot inflate anything; more flow can only clear the "low" warnings. Circulation
devices never count toward filter turnover and never stack into filtration.

## 4. Maturity

The percentage assumes an established (cycled) filter; the page says so beside the filter summary and
in the bioload guide. A new filter needs weeks to grow nitrifying bacteria, so no equipment choice is
credited as instant capacity. There is no cycling questionnaire.

## 5. Evidence

Full-text pages could not be fetched from the build environment (network policy); claims below were
checked against the publication abstracts and search-indexed text.

| Claim | Source |
| --- | --- |
| Nitrifier abundance follows the ammonia supplied: more TAN, more nitrifiers; a biofilter needs ≥ 6 weeks to fully develop its nitrifying biofilm | Dynamics of Microbial Community During Nitrification Biofilter Acclimation with Low and High Ammonia — https://pubmed.ncbi.nlm.nih.gov/34414527/ |
| Home-aquarium biofilters took 3 to 8 weeks to bring ammonia and nitrite to undetectable | Microbial community succession of home aquarium biofilters — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12704419/ |
| Biofilter start-up practice: bacteria establish over weeks and should be loaded gradually | SRAC Publication 4502, *How to Start a Biofilter* (DeLong & Losordo 2012) — https://thefishsite.com/articles/how-to-start-a-biofilter |
| Removal capacity depends on colonised surface **and** hydraulic performance (void space, flow through media) | Rating fixed film nitrifying biofilters used in RAS — https://www.sciencedirect.com/science/article/abs/pii/S0144860905001160 ; Recirculating aquaculture technology, part 1 — https://www.globalseafood.org/advocate/recirculating-aquaculture-technology-part-1/ |
| Nitrification consumes ~4.57 g O₂ per g NH₄-N, so oxygen supply, not only media, can limit it | Daigger 2014, *Water Environment Research* — https://onlinelibrary.wiley.com/doi/10.2175/106143013X13807328849459 |
| AOB and NOB are distinct, slow-growing populations | Hagopian & Riley 1998, *A closer look at the bacteriology of nitrification*, Aquacultural Engineering 18 — https://www.sciencedirect.com/science/article/abs/pii/S0144860998000326 |
| Manufacturers distinguish unrestricted pump output from filter circulation with media (e.g. Fluval 405: 340 vs 225 GPH) | https://www.aquariacentral.com/forums/threads/canister-filter-whats-the-real-flow-rate.122347/ ; Fluval 07-series product pages, e.g. https://fluvalaquatics.com/us/shop/product/307-canister-filter-40-70-us-gal-90-330-l |
| Sponge-filter flow is set by the air pump, not by the sponge's label | https://www.fishlore.com/aquariumfishforum/threads/gph-of-sponge-filter.428970/ ; airlift behaviour: https://arxiv.org/pdf/2302.12655 |
| Hobby turnover guidance: roughly 4–10× per hour for community tanks, less for bettas and long-finned fish | https://theaquariumguide.com/articles/filter-flow-rate-guide ; https://www.marineandreef.com/Articles.asp?ID=391 |

Hobby sources support only the order of magnitude of turnover targets; the advisor's existing bands
(3–5 / 5–8 / 8–12×) and 2× floor were kept rather than re-tuned.

## 6. Limitations

- Rated GPH overstates real flow; the model does not derate it (any fixed derating would be invented
  precision). The warning text says so.
- Sponge-filter GPH figures in the catalog (60–200) are tank-size marketing, not measured flow.
- Species `flow` tags are broad (24 of 44 species are "low", including Neon Tetra), so the
  high-flow note appears often.
- Media quantity, maintenance, clogging and maturity are unknown and not modelled.
- A sump or a planted-tank effect is not modelled (neither is selectable).
