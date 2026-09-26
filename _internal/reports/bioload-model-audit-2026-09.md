# Stocking Advisor — Phase 2B bioload model audit and rebuild

Date: 2026-09-26. Branch: `claude/bioload-model-audit-od8sr0`. Scope: the per-species bioload value
only. Filtration bonuses, the hidden 10 % water-displacement assumption, mobile warning presentation,
custom tank sizes, consent/ads and page weight were **not** changed.

The resulting model is documented in `data/stocking-advisor/BIOLOAD_MODEL.md`.

## 1. The model before this work

Calculation path (unchanged parts in *italics*):

1. **Species value.** `js/stocking-advisor/logic/species-adapter.v2.js` gave every species a
   `bioloadGE` (gallon-equivalents per animal):
   - the 20 original species: a hand-entered constant in `LEGACY_BASE` (copied from `js/fish-data.js`);
   - the 24 newer species: the *provisional calibration bridge* — a log-log least-squares fit
     `GE = 0.826 × m^1.288` of the 20 hand values against the v2 `bioload.multiplier` (an unsourced
     0.15–2.5 score), fitted at runtime on every page load and applied to the newer species' multipliers.
   - Adult size, body shape, diet, activity and category were **not** used directly anywhere in the
     calculation. They only entered indirectly through whatever the hand values or the v2 multiplier
     implied. Fish, shrimp and snails were all "GE × quantity" with no category term.
   - `autoBioloadUnit` also held a hidden third model (`adult_size_in³ × 0.01`, default size 2.5 in)
     used if a record lacked `bioloadGE`.
2. **Quantity.** `total GE = Σ bioloadGE × qty` (`getTotalGE` in `js/bioload.js`; a species missing a
   GE would silently count 0).
3. *Capacity.* `effective gallons = nominal gallons × 0.9` (`DEFAULT_DISPLACEMENT` in `js/bioload.js`).
4. *Percentage.* `percent = total GE ÷ effective gallons × 100`, clamped 0–200 in `js/bioload.js`.
5. *Filtration.* `js/logic/compute.js → patchBioload` recomputes the percentage as
   `total GE ÷ (effective gallons × (1 + RBC bonus))`, with the RBC bonus from
   `js/stocking-advisor/filtration/math.js` (sponge 0.2–0.4, HOB 0.15–0.6, canister 0.75–1.25,
   diminishing for extra filters, capped at +60 %), clamped 0–2000. Note: the result's
   `baseProposedPercent` is also computed *with* the filter bonus, so no truly filter-free figure is
   exposed today (for this audit the no-filter case was run explicitly).
6. *Severity.* `> 110 %` bad, `> 90 %` warn (also warn when turnover < 2×). A tank that fails a
   species' minimum volume/length marks the bar red with "(tank too small …)".
7. *Display.* `formatBioloadPercent` clamps to 200 % and shows one decimal (`"<0.1%"` below 0.1);
   the gauge fill is capped at 100 %; a screen-reader message announces the value rounded to 0.1.

## 2. Problems in the original 20 hand-set values

| Species | Adult size (in) | Body build | Legacy GE | GE / inch | × Neon (legacy) | New GE | × Neon (new) |
|---|---:|---|---:|---:|---:|---:|---:|
| Pearl Gourami | 4.5 | deep | 4 | 0.889 | 6.67 | 5.265 | 15.58 |
| Betta (Male) | 2.6 | standard | 2.5 | 0.962 | 4.17 | 1.352 | 4.00 |
| Betta (Female) | 2.25 | standard | 2 | 0.889 | 3.33 | 1.012 | 3.00 |
| Dwarf Gourami | 3.5 | deep | 2 | 0.571 | 3.33 | 3.185 | 9.42 |
| Tiger Barb | 3 | deep | 1.6 | 0.533 | 2.67 | 2.340 | 6.92 |
| Bronze Corydoras | 2.5 | deep | 1.2 | 0.480 | 2.00 | 1.625 | 4.81 |
| Panda Corydoras | 2 | deep | 1 | 0.500 | 1.67 | 1.040 | 3.08 |
| Kuhli Loach | 4 | elongate | 0.8 | 0.200 | 1.33 | 1.600 | 4.73 |
| Rummynose Tetra | 2.5 | standard | 0.8 | 0.320 | 1.33 | 1.250 | 3.70 |
| Zebra Danio | 2 | slender | 0.7 | 0.350 | 1.17 | 0.640 | 1.89 |
| Cardinal Tetra | 2 | standard | 0.6 | 0.300 | 1.00 | 0.800 | 2.37 |
| Cherry Barb | 2 | standard | 0.6 | 0.300 | 1.00 | 0.800 | 2.37 |
| Neon Tetra | 1.3 | standard | 0.6 | 0.462 | 1.00 | 0.338 | 1.00 |
| Guppy (Male) | 1.4 | slender | 0.5 | 0.357 | 0.83 | 0.314 | 0.93 |
| Harlequin Rasbora | 2 | standard | 0.5 | 0.250 | 0.83 | 0.800 | 2.37 |
| Otocinclus | 1.8 | standard | 0.4 | 0.222 | 0.67 | 0.486 | 1.44 |
| Chili Rasbora | 0.8 | standard | 0.3 | 0.375 | 0.50 | 0.128 | 0.38 |
| Nerite Snail | 1.2 | snail | 0.25 | 0.208 | 0.42 | 0.130 | 0.38 |
| Amano Shrimp | 2 | shrimp | 0.12 | 0.060 | 0.20 | 0.240 | 0.71 |
| Cherry Shrimp | 1.2 | shrimp | 0.08 | 0.067 | 0.13 | 0.086 | 0.26 |

(“New” columns are the rebuilt model, for comparison.)

Findings:

- **No consistent size relationship.** GE per inch ranges from 0.06 (Amano) to 0.96 (male Betta);
  within fish alone from 0.20 (Kuhli) to 0.96.
- **Bettas are the heaviest fish per inch** (0.89–0.96 GE/in). A 2.6 in male Betta (2.5 GE) outweighs
  a 3.5 in Dwarf Gourami (2.0) and a 3 in Tiger Barb (1.6); a female Betta equals the Dwarf Gourami.
- **Neon Tetra is disproportionately heavy.** At 1.3 in it equals the 2 in Cardinal Tetra and Cherry
  Barb (0.6) and outweighs the 2 in Harlequin Rasbora (0.5) — about 2× the per-inch weight of the
  2 in schooling fish. Chili Rasbora (0.8 in, 0.3 GE) is likewise heavy for its size.
- **Deep-bodied fish are not consistently heavier.** Harlequin (moderately deep) < Neon; Dwarf
  Gourami = female Betta.
- **Pearl Gourami (4.0) is the heaviest legacy fish**, 1.6× a male Betta — plausible direction, but
  inconsistent with the Betta weighting above.
- **Invertebrates:** Nerite (0.25) is 2× the larger Amano Shrimp (0.12); Cherry Shrimp (0.08) is
  reasonable. Shrimp/snail ratios have no stated basis.
- No value has a documented source or method.

## 3. Problems in the 24 provisional (bridge) values

| Species | Adult size (in) | Size basis | V2 multiplier | Bridge GE | × Neon (bridge) | New GE | × Neon (new) |
|---|---:|---|---:|---:|---:|---:|---:|
| Bristlenose Pleco | 5 | total_length | 2.4 | 2.55 | 4.25 | 8.450 | 25.00 |
| Angelfish | 6 | standard_length | 2.2 | 2.28 | 3.80 | 11.520 | 34.08 |
| Kribensis (Krib) | 4 | total_length | 2.2 | 2.28 | 3.80 | 3.200 | 9.47 |
| Molly | 4 | total_length | 2.1 | 2.147 | 3.58 | 4.160 | 12.31 |
| Keyhole Cichlid | 4.7 | total_length | 1.9 | 1.887 | 3.15 | 5.743 | 16.99 |
| Cockatoo Cichlid (Apisto) | 3.5 | total_length | 1.6 | 1.513 | 2.52 | 2.450 | 7.25 |
| Bolivian Ram | 3.2 | maximum_length_unspecified | 1.5 | 1.392 | 2.32 | 2.662 | 7.88 |
| Blue Ram (German Blue Ram) | 3 | total_length | 1.3 | 1.158 | 1.93 | 2.340 | 6.92 |
| Swordtail | 6.3 | total_length | 1.3 | 1.158 | 1.93 | 7.938 | 23.49 |
| Upside-Down Catfish | 3.9 | standard_length | 1.3 | 1.158 | 1.93 | 3.955 | 11.70 |
| Honey Gourami | 2.2 | standard_length | 1.1 | 0.934 | 1.56 | 1.258 | 3.72 |
| Pea Puffer (Dwarf Puffer) | 1 | total_length | 1.1 | 0.934 | 1.56 | 0.338 | 1.00 |
| Platy | 2.8 | total_length | 1.05 | 0.879 | 1.47 | 2.038 | 6.03 |
| Hillstream Loach (Reticulated) | 2.8 | total_length | 1 | 0.826 | 1.38 | 1.254 | 3.71 |
| Glass Catfish | 3.2 | standard_length | 0.95 | 0.773 | 1.29 | 1.638 | 4.85 |
| White Cloud Mountain Minnow | 2 | total_length | 0.85 | 0.67 | 1.12 | 0.640 | 1.89 |
| Mystery Snail | 2.5 | shell_diameter | 0.6 | 0.428 | 0.71 | 0.750 | 2.22 |
| Pygmy Corydoras | 1.2 | total_length | 0.55 | 0.382 | 0.64 | 0.374 | 1.11 |
| Celestial Pearl Danio | 0.8 | standard_length | 0.5 | 0.338 | 0.56 | 0.128 | 0.38 |
| Ember Tetra | 1.2 | total_length | 0.5 | 0.338 | 0.56 | 0.288 | 0.85 |
| Bamboo Shrimp | 3 | body_length | 0.4 | 0.254 | 0.42 | 0.540 | 1.60 |
| Assassin Snail | 1 | shell_length | 0.28 | 0.16 | 0.27 | 0.120 | 0.36 |
| Ramshorn Snail | 1 | shell_diameter | 0.25 | 0.139 | 0.23 | 0.090 | 0.27 |
| Ghost Shrimp | 1.6 | body_length | 0.22 | 0.118 | 0.20 | 0.205 | 0.61 |

Findings:

- **Large fish far too light.** A 6 in Angelfish (2.28) was lighter than a 2.6 in male Betta (2.5);
  a 5 in Bristlenose Pleco (2.55) ≈ Betta; a 6.3 in Swordtail (1.16) was *lighter* than a 3.5 in Dwarf
  Gourami (2.0) and only 1.9× a Neon.
- **Kribensis = Angelfish** (both 2.28) despite very different size and body shape.
- **Molly (4 in) vs Swordtail (6.3 in):** Molly 1.85× heavier than the larger Swordtail.
- **Pea Puffer (1 in) = Honey Gourami (2.2 in)** at 0.93, 1.6× a Neon.
- **Nano fish heavy relative to size:** CPD (0.8 in) = Ember (1.2 in) = 0.338, more than a Chili
  Rasbora; Pygmy Cory (1.2 in) 0.38.
- **Glass Catfish, Upside-Down Catfish, Blue Ram, Swordtail** all identical (1.158) from identical
  multipliers, despite 3.0–6.3 in sizes and very different builds.
- **Root cause:** the bridge inherits the inconsistencies of the 20 hand values (it is fitted to them)
  and the v2 multiplier compresses the size range (0.15–2.5) far more than body mass does. The
  multiplier's components (`sizeFactor`, `metabolismFactor`, `dietFactor`) are unsourced.

## 4. What bioload should mean

The relative biological waste-processing burden an animal places on the tank: mainly the ammonia
from its metabolism plus the solids and leftovers of its feeding. At steady state, nitrogen processed
≈ nitrogen fed, and food needed follows metabolic demand. Factors reviewed:

| Factor | Included? | Reason |
|---|---|---|
| Adult size | Yes | Primary driver of body mass. |
| Body mass / depth | Yes (build class) | Same length, very different mass (Kuhli vs Angelfish). |
| Waste production / feeding ecology | Yes, coarse (3 classes) | Biofilm grazers/filter feeders add less new nitrogen; plecos and messy carnivores more. |
| Fish vs shrimp vs snail | Yes (category) | Different body plans and metabolic rates; snail size is shell size. |
| Activity level | No | Differences among these species are smaller than size-data uncertainty; no consistent source. |
| Digestive type | Folded into waste class | Only where it is well established (pleco). |
| Livebearer "high waste" | No | Anecdotal; size and deep build already rank them well above tetras. |

## 5. Model approaches compared

Relative to Neon Tetra (1.3 in), using the recorded maximum adult sizes:

| Approach | Nano fish | Deep-bodied (Angelfish) | Plecos (BN) | Shrimp / snails | False-precision risk | Verdict |
|---|---|---|---|---|---|---|
| 1. Linear length | Over-weights (Chili = 0.6 Neon) | Angelfish 4.6× Neon — far too light | 3.8× — too light | Cherry Shrimp ≈ Ember Tetra — far too heavy | Low, but wrong | Rejected: the known flaw of inch-per-gallon |
| 2. Length² | Sensible | 21× (no shape) | 15× | too heavy without a category term | Low | Good base; needs shape + category |
| 3. Length³ | Very light | 98× (no shape), >190× with shape | 57× | too heavy without category | Medium: amplifies max-size errors | Rejected: 6.3 in Swordtail > Keyhole, max sizes dominate |
| 4. Estimated body mass (L³ × build) | Very light | ~197× | ~85× | depends on invented tissue fractions | High | Rejected: mass is not metabolic load (allometry < 1) |
| 5. Size classes + adjustments | Coarse steps | Depends on class edges | Class edges decide | OK | Medium: cliff effects at class edges | Rejected: arbitrary boundaries |
| 6. Species-specific values (status quo) | Inconsistent (see §2–3) | Inconsistent | Too light | Inconsistent | High: numbers look precise, have no method | Rejected |
| 7. Hybrid: size^k × build × category × waste | Sensible | 34× (k = 2, disc) | 25× (high waste) | Proportionate | Low–medium: few shared classes | **Selected** |

Exponent choice for the hybrid: k = 3 × 0.75 (Kleiber) = 2.25 gave Angelfish ≈ 53× Neon, so either
small fish became nearly weightless or large fish unworkable: keeping Neon at its legacy 0.6 GE put a
common, successful stocking (4 adult Angelfish + 15 Neons in 55 gal) at ~270 % before filtration. k = 2 (mass^(2/3), the lower end of published fish metabolic scaling)
keeps the biological direction and damps maximum-size inputs. See `BIOLOAD_MODEL.md` §2.

## 6. Selected model

```
bioloadGE = 0.2 × adult_size_in² × BUILD[body_build] × CATEGORY[category] × WASTE[waste_class]
BUILD    elongate 0.5 · slender 0.8 · standard 1.0 · deep 1.3 · disc 1.6   (fish only)
CATEGORY fish 1.0 · shrimp 0.4 · snail 0.6
WASTE    low 0.75 · standard 1.0 · high 1.3   (non-standard needs a rationale)
```

Inputs per species: `adult_size_in`, `category` (both already in the reviewed record, or LEGACY_BASE
for the original 20), and `bioload_profile` in `species.v2.json`. The 0.2 scale keeps the geometric
mean of the 20 original values within ~3 %, so the overall percentage level is preserved while the
relative weights are corrected.

Revision made during validation: the snail factor was first set equal to shrimp (0.4). That made a
1.2 in Nerite equal a 1.2 in Cherry Shrimp, which is wrong — a snail measured by shell is a globular
animal with far more tissue per inch than a slender shrimp. It was raised to 0.6 on that basis (not
to meet a target ratio).

## 7. Relative-load table (all 44 species)

| # | Species | Category | Adult size (in) | Body build | Waste class | New GE | × Neon | Previous GE | Previous source |
|---:|---|---|---:|---|---|---:|---:|---:|---|
| 1 | Angelfish | fish | 6 | disc | standard | 11.520 | 34.08 | 2.28 | bridge |
| 2 | Bristlenose Pleco | fish | 5 | deep | high | 8.450 | 25.00 | 2.55 | bridge |
| 3 | Swordtail | fish | 6.3 | standard | standard | 7.938 | 23.49 | 1.158 | bridge |
| 4 | Keyhole Cichlid | fish | 4.7 | deep | standard | 5.743 | 16.99 | 1.887 | bridge |
| 5 | Pearl Gourami | fish | 4.5 | deep | standard | 5.265 | 15.58 | 4 | hand-set |
| 6 | Molly | fish | 4 | deep | standard | 4.160 | 12.31 | 2.147 | bridge |
| 7 | Upside-Down Catfish | fish | 3.9 | deep | standard | 3.955 | 11.70 | 1.158 | bridge |
| 8 | Kribensis (Krib) | fish | 4 | standard | standard | 3.200 | 9.47 | 2.28 | bridge |
| 9 | Dwarf Gourami | fish | 3.5 | deep | standard | 3.185 | 9.42 | 2 | hand-set |
| 10 | Bolivian Ram | fish | 3.2 | deep | standard | 2.662 | 7.88 | 1.392 | bridge |
| 11 | Cockatoo Cichlid (Apisto) | fish | 3.5 | standard | standard | 2.450 | 7.25 | 1.513 | bridge |
| 12 | Blue Ram (German Blue Ram) | fish | 3 | deep | standard | 2.340 | 6.92 | 1.158 | bridge |
| 13 | Tiger Barb | fish | 3 | deep | standard | 2.340 | 6.92 | 1.6 | hand-set |
| 14 | Platy | fish | 2.8 | deep | standard | 2.038 | 6.03 | 0.879 | bridge |
| 15 | Glass Catfish | fish | 3.2 | slender | standard | 1.638 | 4.85 | 0.773 | bridge |
| 16 | Bronze Corydoras | fish | 2.5 | deep | standard | 1.625 | 4.81 | 1.2 | hand-set |
| 17 | Kuhli Loach | fish | 4 | elongate | standard | 1.600 | 4.73 | 0.8 | hand-set |
| 18 | Betta (Male) | fish | 2.6 | standard | standard | 1.352 | 4.00 | 2.5 | hand-set |
| 19 | Honey Gourami | fish | 2.2 | deep | standard | 1.258 | 3.72 | 0.934 | bridge |
| 20 | Hillstream Loach (Reticulated) | fish | 2.8 | slender | standard | 1.254 | 3.71 | 0.826 | bridge |
| 21 | Rummynose Tetra | fish | 2.5 | standard | standard | 1.250 | 3.70 | 0.8 | hand-set |
| 22 | Panda Corydoras | fish | 2 | deep | standard | 1.040 | 3.08 | 1 | hand-set |
| 23 | Betta (Female) | fish | 2.25 | standard | standard | 1.012 | 3.00 | 2 | hand-set |
| 24 | Cardinal Tetra | fish | 2 | standard | standard | 0.800 | 2.37 | 0.6 | hand-set |
| 25 | Cherry Barb | fish | 2 | standard | standard | 0.800 | 2.37 | 0.6 | hand-set |
| 26 | Harlequin Rasbora | fish | 2 | standard | standard | 0.800 | 2.37 | 0.5 | hand-set |
| 27 | Mystery Snail | snail | 2.5 | — | standard | 0.750 | 2.22 | 0.428 | bridge |
| 28 | White Cloud Mountain Minnow | fish | 2 | slender | standard | 0.640 | 1.89 | 0.67 | bridge |
| 29 | Zebra Danio | fish | 2 | slender | standard | 0.640 | 1.89 | 0.7 | hand-set |
| 30 | Bamboo Shrimp | shrimp | 3 | — | low | 0.540 | 1.60 | 0.254 | bridge |
| 31 | Otocinclus | fish | 1.8 | standard | low | 0.486 | 1.44 | 0.4 | hand-set |
| 32 | Pygmy Corydoras | fish | 1.2 | deep | standard | 0.374 | 1.11 | 0.382 | bridge |
| 33 | Neon Tetra | fish | 1.3 | standard | standard | 0.338 | 1.00 | 0.6 | hand-set |
| 34 | Pea Puffer (Dwarf Puffer) | fish | 1 | deep | high | 0.338 | 1.00 | 0.934 | bridge |
| 35 | Guppy (Male) | fish | 1.4 | slender | standard | 0.314 | 0.93 | 0.5 | hand-set |
| 36 | Ember Tetra | fish | 1.2 | standard | standard | 0.288 | 0.85 | 0.338 | bridge |
| 37 | Amano Shrimp | shrimp | 2 | — | low | 0.240 | 0.71 | 0.12 | hand-set |
| 38 | Ghost Shrimp | shrimp | 1.6 | — | standard | 0.205 | 0.61 | 0.118 | bridge |
| 39 | Nerite Snail | snail | 1.2 | — | low | 0.130 | 0.38 | 0.25 | hand-set |
| 40 | Celestial Pearl Danio | fish | 0.8 | standard | standard | 0.128 | 0.38 | 0.338 | bridge |
| 41 | Chili Rasbora | fish | 0.8 | standard | standard | 0.128 | 0.38 | 0.3 | hand-set |
| 42 | Assassin Snail | snail | 1 | — | standard | 0.120 | 0.36 | 0.16 | bridge |
| 43 | Ramshorn Snail | snail | 1 | — | low | 0.090 | 0.27 | 0.139 | bridge |
| 44 | Cherry Shrimp | shrimp | 1.2 | — | low | 0.086 | 0.26 | 0.08 | hand-set |

## 8. Required relative comparisons

**Neon Tetra** (new 0.338 GE)

| Compared with | New GE | New ratio | Previous ratio |
|---|---:|---:|---:|
| Cardinal Tetra | 0.800 | 2.37× | 1.00× |
| Ember Tetra | 0.288 | 0.85× | 0.56× |
| Tiger Barb | 2.340 | 6.92× | 2.67× |
| Molly | 4.160 | 12.31× | 3.58× |
| Swordtail | 7.938 | 23.49× | 1.93× |
| Angelfish | 11.520 | 34.08× | 3.80× |
| Bristlenose Pleco | 8.450 | 25.00× | 4.25× |

**Betta (Male)** (new 1.352 GE)

| Compared with | New GE | New ratio | Previous ratio |
|---|---:|---:|---:|
| Honey Gourami | 1.258 | 0.93× | 0.37× |
| Dwarf Gourami | 3.185 | 2.36× | 0.80× |
| Pearl Gourami | 5.265 | 3.89× | 1.60× |

**Bronze Corydoras** (new 1.625 GE)

| Compared with | New GE | New ratio | Previous ratio |
|---|---:|---:|---:|
| Pygmy Corydoras | 0.374 | 0.23× | 0.32× |
| Kuhli Loach | 1.600 | 0.98× | 0.67× |
| Bristlenose Pleco | 8.450 | 5.20× | 2.13× |

**Neon Tetra** (new 0.338 GE)

| Compared with | New GE | New ratio | Previous ratio |
|---|---:|---:|---:|
| Cherry Shrimp | 0.086 | 0.26× | 0.13× |
| Amano Shrimp | 0.240 | 0.71× | 0.20× |
| Bamboo Shrimp | 0.540 | 1.60× | 0.42× |
| Nerite Snail | 0.130 | 0.38× | 0.42× |
| Mystery Snail | 0.750 | 2.22× | 0.71× |
| Assassin Snail | 0.120 | 0.36× | 0.27× |

Assessment:

- **Neon comparisons** now follow size and shape. Ember < Neon < Cardinal < Tiger Barb < Molly <
  Bristlenose ≈ Swordtail < Angelfish. Cardinal 2.4× Neon comes from the data (Cardinal 2.0 in max TL
  vs Neon 1.3 in); the old 1.0× had no size basis.
- **Swordtail 23× Neon, ~1.9× Molly**: follows from the recorded 6.3 in (16 cm female maximum TL).
  Biologically consistent with that size, but the size is a record maximum — see limitations.
- **Labyrinth fish:** Honey (0.93×) < Betta < Dwarf (2.4×) < Pearl (3.9×). The old values had the
  Betta above the Dwarf Gourami.
- **Bottom dwellers:** Pygmy (0.23×) < Panda < Bronze; Kuhli ≈ Bronze (a 4 in eel-like loach vs a
  2.5 in stocky cory — defensible, slightly high); Bristlenose 5.2× Bronze (was 2.1×).
- **Invertebrates:** Cherry Shrimp 0.26×, Assassin 0.36×, Nerite 0.38×, Amano 0.71×, Bamboo 1.6×,
  Mystery 2.2× a Neon. Order follows size and body plan; the two large animals (Bamboo 3 in,
  golf-ball Mystery) exceed a Neon, which matches hobby experience that Mystery snails are messy.

## 9. Quantity scaling

| Stock | Tank | 1 animal | Group | Ratio |
|---|---|---:|---:|---:|
| Neon Tetra ×10 | 20l | 0.338 GE · 1.9% | 3.38 GE · 18.8% | 10.00× |
| Angelfish ×6 | 75g | 11.520 GE · 17.1% | 69.12 GE · 102.4% | 6.00× |
| Bristlenose Pleco ×6 | 75g | 8.450 GE · 12.5% | 50.70 GE · 75.1% | 6.00× |
| Molly ×6 | 29g | 4.160 GE · 15.9% | 24.96 GE · 95.6% | 6.00× |
| Cherry Shrimp ×20 | 10g | 0.086 GE · 1.0% | 1.73 GE · 19.2% | 20.00× |

Load is exactly linear in quantity (tested). No group/social term exists in the bioload calculation;
group minimums remain separate welfare checks.

## 10. Required safety scenarios (A–F)

"Base" = no filter selected. "HOB" = one hang-on-back rated 5× tank volume (RBC +15 %).
"Canister" = one canister rated 5× (RBC capped at +60 %). Filtration code is unchanged; the
filter-adjusted figures show what the current bonus does to the new species load.

| | Stock | Total GE (new / old) | Base % new (old) | HOB % | Canister % | Tank-suitability warnings | Compatibility warnings | Final status |
|---|---|---:|---:|---:|---:|---|---|---|
| A | 5 gal, 6 Bristlenose Pleco | 50.70 / 15.30 | 1126.7 (340.0) bad | 979.7 bad | 704.2 bad | danger: volume; warn: length | Territory crowding among Bristlenose Pleco | **bad** (bar shows 200 %, "tank too small") |
| B | 20 gal, 6 Angelfish | 69.12 / 13.68 | 384.0 (76.0) bad | 333.9 bad | 240.0 bad | danger: volume; warn: length | Territory crowding among Angelfish | **bad** |
| C | 20 long, 2 Angelfish + 10 Neon + 3 Tiger Barb + 2 Bristlenose | 50.34 / 20.46 | 279.7 (113.7) bad | 243.2 bad | 174.8 bad | danger: Angelfish volume; warn: Angelfish length, Tiger Barb length | danger: Angelfish preys on Neon; danger: Tiger Barb fin-nips Angelfish; warn: Angelfish ↔ Bristlenose aggressive pair | **bad** |
| D | 29 gal, 10 Neon + 6 Bronze Cory + 1 male Betta | 14.48 / 15.70 | 55.5 (60.2) ok | 48.2 ok | 34.7 ok | warn: Bronze Cory needs 36 in length | none | **warn** |
| E | 29 gal, 6 Molly | 24.96 / 12.88 | 95.6 (49.4) warn | 83.2 ok | 59.8 ok | warn: Molly needs 36 in length | none | **bad** (gH/kH too low for mollies at default water) |
| F | 10 gal, 10 Cherry Shrimp + 1 Mystery Snail | 1.61 / 1.23 | 17.9 (13.6) ok | 15.6 ok | 11.2 ok | none | none | **warn** (gH at default water) |

Observations:

- A, B, C are unambiguous overloads under the new model even with the maximum filter bonus, and the
  independent tank-size, predation and aggression checks still fire on their own.
- E moves from a comfortable 49 % to 96 % base (warn), 60–83 % with a filter: six 4 in mollies in a
  29 gal is a heavy stocking and now reads that way; the length rule still reports separately.
- D and F change little.

## 11. Tank suitability kept separate

No tank-size, length, group, aggression or predation rule reads bioload, and bioload does not read
them. The only coupling is the pre-existing display rule that marks the bar red "(tank too small …)"
when a minimum-size rule fails. Verified by scenario tests (A–F) and the existing suite.

**Gap exposed (not caused) by the new model:** six Pea Puffers in a 5 gal was previously red only
because the bridge gave a 1 in puffer ~3 Neons of load (124 %). Honest load is 45 % (six 1 in fish).
The real issue is territorial crowding, and the sourced "2–3 gal per puffer" group guidance is not
encoded as a tank rule (the minimum-tank rule covers a single puffer; the territory-crowding rule only
fires when the tank is shorter than the 12 in minimum). Result today: status **ok**. Recorded as a
`todo` test and as a deployment blocker; the bioload value was deliberately not inflated to hide it.

## 12. Tests

`tests/unit/bioload-model.test.mjs` (new, 13 tests) and updates to
`tests/unit/species-integrity.test.mjs`:

- all 44 species get a finite, positive load; invalid inputs return NaN, never a number;
- every record has valid `bioload_profile`; non-standard waste classes carry a rationale;
  invertebrates have no body build;
- engine value = documented formula applied to the record inputs (model contract, not fixed numbers);
- the calibration bridge and hand-entered GE values are gone from the adapter; the adapter does not
  read the retired multiplier block;
- monotonic invariant: a fish no smaller, no slimmer and no cleaner than another never scores lower;
- large / high-waste fish are > 3× every nano fish; pleco > 3× Bronze Cory; Angelfish > 3× Tiger Barb;
- the Step 7 orderings; invertebrates below every 3 in+ fish and < 3× Neon, Cherry < Nerite < Mystery;
- load and percentage scale linearly with quantity (1 vs 10 Neon, 1 vs 6 Angelfish/Bristlenose/Molly,
  1 vs 20 Cherry Shrimp) and rise with one more animal;
- a filter rescales the percentage but not the species load;
- scenarios A–F: tank-size, length, predation and fin-nipping warnings still fire;
- a record with missing model inputs is rejected and flagged (red warning, bioload "incomplete").

Replaced: "species keep their legacy bioload values" (it locked the hand values) and the
"provisional bridge" sanity test. The Pea Puffer bioload assertion in "6 of each species in a 5 gal"
was moved to a `todo` test (see §11).

## 13. UI wording

The page claimed the calculation used "activity level, feeding response, and habitat preference"
and "activity multipliers … fast swimmers (like danios) add more load than slow cruisers (like
gouramis)". It never did, and under the new model danios are lighter than gouramis. Corrected:
FAQ "How is aquarium bioload calculated?" and "…inch-per-gallon rule?" (visible text and the
matching FAQPage JSON-LD), the "Bioload, not inches per gallon" paragraph, and the bioload tooltip
(now "Estimates … It is a planning estimate, not a measurement."). Filtration wording was left alone.

Not changed (recommended for the UI phase): renaming the gauge label "Bioload" → "Estimated bioload".
Tried; on a phone the label wraps to two lines and strands the info button, which is a mobile
presentation change outside this phase. The one-decimal percentage (e.g. "55.5 %") also implies more
precision than the model has; whole percent would be more honest.

## 14. Bridge and legacy values

- **Provisional calibration bridge: removed.** `fitBioloadCalibration`, `getBioloadCalibration`, the
  flat ×0.6 fallback and the runtime fit are gone. The adapter derives every species' `bioloadGE`
  from `computeSpeciesBioload`.
- **The 20 hand-set GE values** were removed from `LEGACY_BASE` (the adapter). They remain only in
  `js/fish-data.js`, the engine's pre-load default dataset (used before `species.v2.json` loads and in
  direct/unit use; production never falls back to it — `species-load-failure.test.mjs`), and in this
  report for reference.
- **The hidden size³ fallback** in `autoBioloadUnit` was removed: a record without a valid
  `bioloadGE` is rejected by validation instead of receiving an invented value.
- **The v2 `bioload` multiplier block** stays in the JSON, unread, for cache compatibility (§16).

## 15. Known limitations of the new model

1. **Adult sizes are maxima on mixed bases.** The model is only as good as `adult_size_in`. Angelfish
   (150 mm SL maximum) and Swordtail (16 cm female maximum TL) are the most inflated relative to
   typical aquarium adults; Cardinal Tetra's 2.0 in is a maximum TL. The original 20 species' sizes
   have no recorded basis. Length² amplifies a 10 % size error to ~21 %.
2. **Classes are coarse and judgement-based.** Build and waste classes are assigned from body shape
   and feeding ecology, not measured. They are few and documented, but a borderline species (e.g.
   Kribensis standard vs deep, Kuhli elongate) can move by ~30 %.
3. **Category factors are approximate.** Shrimp 0.4 and snail 0.6 reflect body plan and metabolic
   differences qualitatively; there is no per-species invertebrate data behind them.
4. **No activity, temperature or feeding-regime term.** A heavily fed tank or a warm tank carries more
   load than the model assumes.
5. **The percentage still depends on the unreviewed capacity side** (fixed 10 % displacement, filter
   bonuses up to +60 %). The rebuilt species values should be re-checked once those are reworked.
6. **Absolute calibration** is inherited from the legacy scale (0.2 keeps its overall level). Nothing
   anchors "100 %" to an external measure; it remains an advisory threshold.

## 16. Items that should block production deployment

1. **Stale-module caching.** `/js/*` is served `Cache-Control: public, max-age=31536000, immutable`,
   and nested ES-module imports (`compute.js → compute.legacy.js → species-adapter.v2.js`, and the new
   `bioload-model.js`) carry no version string; only the top-level `<script>` tags do. Returning
   visitors can keep running the previous adapter (with the bridge) for up to a year. This change is
   made backward-compatible (old cached code still works with the new JSON; the retired `bioload`
   block was kept for that), but returning users would keep seeing the old numbers. Versioned module
   URLs or a shorter cache policy for the advisor's modules is needed before this model reliably
   reaches users. (Same exposure applied to #2206.)
2. **Pea Puffer group crowding (§11).** Six Pea Puffers in a 5 gal now reads "ok" overall. It was red
   before only because of the bridge's inflated value. A per-fish group-volume/territory rule is needed
   (tracked by a `todo` unit test).
3. **Pre-existing browser-test failures (not caused by this change; identical on `main`):**
   see §17. The gate's 20-long test expects warning id
   `aggr:bristlenose_pleco:freshwater_angelfish:aggressive_pair`, but after #2207 renamed
   "Freshwater Angelfish" to "Angelfish" the pair id is `aggr:freshwater_angelfish:bristlenose_pleco:…`.
   These should be green before any Stocking Advisor deploy.
4. **Review of the relative table (§7)** by the site owner, especially Swordtail, Angelfish, Kuhli
   Loach and Mystery Snail, which move most and depend on size data.

## 17. Test results

- Unit (`npm run test:unit`): 57 pass, 0 fail, 1 todo (Pea Puffer crowding gap, §11).
- `guard:live`, `audit:controls`: pass. FAQPage JSON-LD parses.
- Stocking gate (`test:e2e:stocking-gate`, desktop + mobile Chromium): 9–10 of 11 pass on this branch.
  The same two tests fail on unmodified `main`: the 20-long test (stale warning ID after #2207,
  verified against commit 7e3f0f9) and an intermittent mobile "tank-too-small visible" check.
- `tests/e2e.spec.js` + `tests/stocking-env-header.spec.ts` (Chromium): 11 of 12 fail, and the
  **same 11 fail on `main`**, including the unrelated Contact & Feedback tests. The suite is stale
  and was not changed here.
- Old cached JS + new JSON was checked: the previous adapter still loads and calculates.

## 18. Follow-up: release blockers fixed (same branch)

### Stale JavaScript caching

- **Confirmed bug.** `_headers` served `/js/*` with `Cache-Control: public, max-age=31536000, immutable`.
  No file under `/js/` is content-hashed; 209 of 212 `<script src="/js/…">` tags carry a `?v=` query
  but it is not maintained (`stocking.js?v=2024-09-01` although the file changed in 2026), and all 52
  static ES-module imports use plain paths, which a query on the importing script does not change.
  A returning browser therefore kept every previously fetched module for up to a year after a deploy.
  Reproduced with a real HTTP cache: old deploy with the immutable header, then the new deploy — the
  browser requested **0** JS files and still showed the bridge value (10 Pea Puffers / 29 gal: 35.8 %).
- **Fix.** `/js/*` → `Cache-Control: public, max-age=0, must-revalidate` (Cloudflare Pages' own default
  for assets: stored, revalidated on each use, 304 when unchanged). New explicit `/data/*` rule with
  the same value. Security headers, CSS, image, font and HTML rules unchanged. No path receives two
  `Cache-Control` values (Cloudflare comma-joins repeats). Guarded by `tests/unit/cache-headers.test.mjs`.
- **Species JSON.** `/data/*` previously had no rule, so it already got the Pages default
  (revalidate every use); it is now explicit. The JSON was never the stale half.
- **Browsers already holding immutable copies.** A header change cannot reach them (they do not
  re-request). `stocking-advisor.html` (revalidated hourly) now carries a small guard: the current
  `species-adapter.v2.js` and `compute.legacy.js` set a fixed marker; if it is missing after load, the
  page re-fetches every `/js/` URL it loaded with `fetch(url, { cache: 'reload' })` (which overwrites the
  HTTP cache entry) and reloads once per session. No version numbers, no module list. Same real-cache
  test: returning visit then showed the new value (13.0 %); without the guard it stayed at 35.8 %.

### Pea Puffer group space

- `quantity_space` (optional, sourced) on the species record: `{ liters_per_fish, source, basis }`.
  Required volume = max(`min_tank_liters`, quantity × `liters_per_fish`), checked in
  `evaluateTankSuitability` with stock and preview quantities summed. Shortfall → red
  `tank.group_volume.<id>` "Not enough space for N × <species>", message stating it is a space limit,
  not a bioload limit. Bioload inputs, formula and filtration untouched.
- Pea Puffer: Seriously Fish (tier 1) "groups need 2–3 gal per puffer" → upper figure 3 US gal =
  11.36 L (policy rule 3). Aquarium Co-Op (tier 2, reviewer-reported) corroborates via its examples.

| Case | Required | Tank | Result | Bioload (unchanged) |
|---|---:|---:|---|---:|
| 1 / 5 gal | 13 L | 19 L | pass | 7.5 % |
| 3 / 5 gal | 34 L | 19 L | **red: Not enough space for 3 × Pea Puffer** | 22.5 % |
| 6 / 5 gal | 69 L | 19 L | **red: Not enough space for 6 × Pea Puffer** | 45.1 % |
| 6 / 20 gal | 69 L | 76 L | pass | 11.3 % |
| 3 / 10 gal · 4 / 10 gal | 34 L · 46 L | 38 L | pass · red | — |

### Dedicated gate

- 20-long test: exact pair ids replaced by an order-independent match (rule + both species).
- Mobile flake: diagnosed as a race, not a UI bug. Adding a species renders immediately and again
  after the 160 ms debounced recompute, replacing the warning nodes once with identical ones (measured:
  one replacement 250–320 ms after the add, then stable). The test scrolled a node that was about to
  be replaced ("Element is not attached to the DOM", 2 of 12 runs). The scroll-and-see-in-viewport
  check is now retried as a whole with `expect(...).toPass()`.
- Added gate tests: Pea Puffer space warning (5 gal) and pass (20 gal); current modules set the cache
  marker and never trigger the guard reload.
