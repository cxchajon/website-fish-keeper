# Stocking Advisor — Phase 2C filtration capacity and filter bonus audit (2026-09)

Scope: whether filtration should raise the advisor's capacity, and replacing the filter bonus with a
defensible model. The Phase 2B species load, hidden-water assumptions (10 % displacement), mobile UI
design, custom tank sizes, consent/ads and page weight are out of scope and unchanged.
New methodology: `data/stocking-advisor/FILTRATION_MODEL.md`.

## 1. Old model (before this phase)

There were **three** filtration calculations, and the one the user saw as a tooltip was not the one
that produced the percentage.

### 1a. Displayed percentage — `js/logic/compute.js → patchBioload`

```
percent = total GE ÷ (effective gallons × (1 + B)) × 100          effective gallons = 0.9 × nominal
B       = min(0.60, Σ_i rbc_i × 0.5^i)   filters sorted by rbc, largest first (i = 0, 1, 2 …)
```

`rbc` came from `filtration/math.js → inferRbcByType`, by **type** only (media volume was never
supplied by the catalog or the form):

| Type as seen by the engine | rbc |
| --- | --- |
| Canister (no "large" hint) | 0.75 (→ capped total 0.60) |
| Canister "large" / media ≥ 3.9 L | 1.25 |
| Sponge / "large" | 0.20 / 0.40 |
| HOB cartridge / basket or "large" | 0.15 / 0.60 |
| Undergravel | 0.35 |
| Internal **or powerhead** | 0.30 |
| Unknown | 0.15 |

The engine read the filters through `compute.legacy.js → sanitizeFilterList`, which ran
`canonicalizeFilterType`. That function mapped Internal, UGF, Powerhead and anything unknown to
**HOB**, so in the displayed percentage a powerhead, internal filter or undergravel filter each got
the HOB value 0.15. **GPH was never an input to B.**

### 1b. Filter summary tooltip — `filtration/controller.js`

Same RBC table but reading the controller's `kind` field, in which Powerhead and Internal both became
`INTERNAL` (0.30) and UGF stayed 0.35. Shown as the `title` "Capacity boost: +N% (RBC)" — which
disagreed with 1a (powerhead: tooltip +30 %, percentage +15 %).

### 1c. Legacy engine — `compute.legacy.js`

`computeFiltrationFactor` multiplied the legacy percentage by a GPH-weighted type factor
(canister 1.1, HOB 1.0, sponge 0.9, clamped 0.9–1.1). `filtrationMultiplier` (canister 0.35 … sponge
0.12 × turnover/5) was computed but unused. 1a overwrote both results, so neither reached the page.

### 1d. Turnover

- Controller summary: Σ rated GPH ÷ **nominal** gallons (what the user saw).
- Engine `buildFilteringState`: Σ `rated_gph` ÷ **effective** gallons, with turnover warnings
  (< 2× red; below the flow band amber). But the controller handed the engine records without a
  `rated_gph` field (`ratedGph` only), so the engine always saw 0 GPH: **the turnover warnings could
  never fire in the browser**, and the env card always showed "Turnover: —".
- The only live signal was a bioload-bar note "Turnover below 2× — upgrade filtration" (via a separate
  fallback path) that also bumped a green bioload severity to amber.
- No filter: `calcTank` silently assumed a HOB at 6× the tank volume (`FILTER_TURNOVER_MULTIPLIERS`),
  so nothing indicated that filtration was absent.

### 1e. Why the reported bugs happened

- *1 GPH canister, full bonus*: B depends on type only; 1 GPH canister → 0.75 → capped +60 %.
- *Powerhead ≈ +30 %*: the controller mapped Powerhead to `INTERNAL`, which the RBC table treats as a
  filter (0.30). The engine's own path mapped it to HOB (+15 %). A powerhead has no media either way.
- Planted tanks, sumps and custom media volumes had no inputs, so no interaction existed.

### 1f. Catalog audit (`assets/data/gearCatalog.json`, 41 items)

Fields: id, brand, name, type, gphRated, minGallons, maxGallons — no media volume, no with-media flow.
Canister 16 (116–793 GPH), HOB 13 (119–400), Sponge 7 (60–200), UGF 1 (150), "OTHER" 4 (Tidal /
Penguin HOBs mislabelled; treated as HOB). All GPH figures are manufacturer ratings (unrestricted
pump output for canisters); sponge figures are tank-size labels, not flows (air-driven). Duplicates
exist (Fluval 107, 407, FX4, AquaClear 70, Tidal 55 listed twice); "Hygger Quiet Aquarium Power
Filter" is typed CANISTER. None of this matters for capacity any more, as type no longer awards any.

## 2. Options considered

| Option | For | Against |
| --- | --- | --- |
| 1. Filtration raises capacity | Familiar | Tells beginners a filter purchase makes an overstocked tank safe; needs media data we do not have |
| 2. Warning only | Honest, simple | Needs its own clear signal so "adequate" is still visible |
| 3. Small evidence-bound adjustment | Rewards real flow | No evidence to size it: nitrifiers grow to the ammonia supplied, not the media offered; maturity unknown |
| 4. Hybrid: bioload % + separate adequacy | Shows both without one cancelling the other | Slightly more UI text |

**Chosen: 4 (with option 2's rule that filtration never changes the percentage).** The capacity bonus is
removed entirely.

**Review revision.** The first version of the adequacy check reused the species flow bands (3–5 / 5–8 /
8–12×) as targets for *biological-filter* turnover and raised an amber note when total turnover passed
10× with a low-flow species. Both mixed circulation back into filtration: a high-flow species with a
good 4–5× filter plus a powerhead was told "Filter flow below target", and total GPH ÷ volume does not
say how strong the current is where the fish swim. Both were removed (`filtration.low`,
`filtration.high_flow`). The check is now only: biological filter present, and ≥ 2× through media.

## 3. Comparison cases — 29 gal, 10 Neon Tetra, 6 Bronze Corydoras, 1 Betta (male)

Livestock load 14.48 GE; effective capacity 26.1 gal. Old = page before this change.

| Case | Old displayed % | Old bonus (engine / tooltip) | New % | Filter turnover (total) | Filtration level | Filtration warnings | Final status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A none | 55.5 % | 0 / 0 | 55.5 % | 0 | none | amber `filtration.none` | amber |
| B 1 GPH canister | **34.7 %** | +60 / +60 | 55.5 % | 0.03× | very-low | red `filtration.very_low` | **red** |
| C 150 HOB | 48.2 % | +15 / +15 | 55.5 % | 5.17× | adequate | — | amber (tank length) |
| D 150 powerhead | 48.2 % | +15 / +30 | 55.5 % | 0 (5.17×) | circulation-only | red `filtration.circulation_only` | **red** |
| E 150 sponge | 46.2 % | +20 / +20 | 55.5 % | 5.17× | adequate | — | amber (tank length) |
| F 300 canister | **34.7 %** | +60 / +60 | 55.5 % | 10.34× | adequate | — | amber (tank length) |
| G 150 HOB + 150 powerhead | 45.3 % | +22.5 / +37.5 | 55.5 % | 5.17× (10.34×) | adequate (HOB only) | — | amber (tank length) |
| H 2 × 150 HOB | 45.3 % | +22.5 / +22.5 | 55.5 % | 10.34× | adequate | — | amber (tank length) |

High-flow species check (29 gal, 6 Tiger Barbs, tagged high-flow): 120 GPH HOB alone (4.1×) and the
same HOB + 300 GPH powerhead both pass the filtration check with no filtration warning, the same
status and the same bioload; filter turnover is 4.1× in both, total turnover rises only with the
powerhead.

Raw livestock load is 14.48 GE in every case. Every case also keeps the Phase 2B amber
`tank.length.cory_bronze` warning. Old status was amber (tank length) in all eight; B's only filtration
signal was a bar note.

## 4. Extreme inputs (29 gal, same stock, through the real page)

| Input | Result |
| --- | --- |
| 0 GPH, empty, "abc" | not accepted; `filtration.none`; 55.5 % |
| −50 GPH | previously accepted as **50 GPH** (minus stripped); now rejected |
| 1 / 10 GPH | red `filtration.very_low` (0.03× / 0.34×); 55.5 % |
| 150 GPH HOB | adequate, 5.2×; 55.5 % |
| 580 / 1450 GPH (20× / 50×) | adequate, no warning; 55.5 % |
| 99,999,999 GPH | capped at 1,500 (51.7×), adequate; 55.5 % |
| 3 × 800 GPH powerheads | red circulation-only, "(+2400 GPH circulation only)"; 55.5 % |

No NaN, Infinity or negative value appears in any output (unit test sweeps 16 values × 7 types).

## 5. Remaining limitations

See FILTRATION_MODEL.md §6. Also: `calcTank` still derives an internal `tank.turnover` from a
default 5× / HOB 6× assumption when nothing is entered; it no longer reaches any displayed figure or
warning (used only by an analytics field), and is left for the hidden-assumptions phase.
