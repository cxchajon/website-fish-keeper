# Stocking Advisor bioload model

Model version: 2026-09-26. Implemented in `js/stocking-advisor/logic/bioload-model.js`; inputs live in
`species.v2.json` (`adult_size_in`, `category`, `bioload_profile`). Tests:
`tests/unit/bioload-model.test.mjs`. The audit that led to this model is
`_internal/reports/bioload-model-audit-2026-09.md`.

## 1. What "bioload" means here

Bioload is the **relative biological waste-processing burden** an animal places on the aquarium:
chiefly the ammonia its metabolism excretes, plus the solid waste and leftovers that feed it. At a
steady state the nitrogen the biofilter must process is roughly the nitrogen that enters as food,
and how much food an animal needs follows its metabolic demand. So the model estimates relative
metabolic demand from body size and shape, with a small adjustment for how an animal feeds.

It is an **advisory planning estimate** for comparing stocking plans. It is not a measured carrying
capacity, not a metabolic simulation, and not a welfare rule. A stock under 100 % can still be
unsuitable (tank too small or too short, wrong group size, aggression, predation); those checks are
separate and are never overridden by the bioload figure.

## 2. The formula

```
bioloadGE = 0.2 × adult_size_in² × BUILD[body_build] × CATEGORY[category] × WASTE[waste_class]
```

- **GE** (gallon-equivalents) is the unit the capacity side already uses: the advisor's percentage is
  total GE ÷ effective tank gallons (see §6). The model does not change that side.
- **Quantity** multiplies linearly: *n* animals are *n* × bioloadGE. There is no group or social
  term; group requirements stay separate welfare checks.

### Why length squared

Fish metabolic rate scales with body mass to a power of roughly 0.7–0.9, and body mass scales with
length cubed times a shape factor. Pure length (inch-per-gallon) makes a 6 in fish equal to six 1 in
fish, which badly understates large fish. Pure mass (length cubed) makes a maximum-size angelfish
worth 100–200 neon tetras, which overstates them, because:

- metabolism per gram falls as fish get larger (the allometric exponent is below 1), and
- the recorded adult sizes are **maximum** sizes on mixed bases (standard vs total length). The
  largest species are the furthest above their typical aquarium size (angelfish 150 mm SL max), and
  a cubic term amplifies those errors most.

Length squared equals mass^(2/3), the lower end of the published metabolic range. It keeps the
biological direction (large, deep-bodied fish count several times more than length suggests) while
damping the effect of maximum-size inputs.

### Scale (0.2)

One global constant sets the units. 0.2 GE per square inch keeps the overall level of the 20
original hand-set values (their geometric mean changes by about 3 %), so this phase changes the
*relative* weights between species without silently moving every tank's percentage up or down.

## 3. Inputs and classes

`bioload_profile` in each species record:

| Field | Values | Notes |
|---|---|---|
| `body_build` | `elongate`, `slender`, `standard`, `deep`, `disc` (fish); `null` (shrimp, snails) | Shape class: how much body mass a fish carries for its length. |
| `waste_class` | `low`, `standard`, `high` | Anything other than `standard` needs `rationale`. |
| `rationale` | text | Why a non-standard waste class applies. |

### Body build (fish only)

Factor = relative mass for the same length, raised to the same 2/3 power.

| Class | Relative mass | Factor | Species |
|---|---:|---:|---|
| elongate | ≈ 0.35× | 0.5 | eel-like: Kuhli Loach |
| slender | ≈ 0.7× | 0.8 | Zebra Danio, White Cloud, Glass Catfish, male Guppy, Hillstream Loach |
| standard | 1× | 1.0 | tetras, rasboras, CPD, Cherry Barb, Swordtail, Bettas, Kribensis, Cockatoo Cichlid, Otocinclus |
| deep | ≈ 1.5× | 1.3 | barbs (Tiger), corydoras, gouramis, rams, Keyhole Cichlid, Molly, Platy, Bristlenose Pleco, Upside-Down Catfish, Pea Puffer |
| disc | ≈ 2× | 1.6 | Angelfish |

### Category

| Category | Factor | Reason |
|---|---:|---|
| fish | 1.0 | reference |
| shrimp | 0.4 | slender crustacean body and a lower metabolic rate than a fish of the same length |
| snail | 0.6 | size is shell size of a globular animal (more tissue per inch than a shrimp), offset by inert shell and lower molluscan metabolism |

### Waste class

| Class | Factor | Used for | Reason |
|---|---:|---|---|
| low | 0.75 | Otocinclus, Cherry Shrimp, Amano Shrimp, Bamboo Shrimp, Nerite Snail, Ramshorn Snail | They live mainly on biofilm, algae, detritus or suspended matter already produced in the tank, so they add less *new* nitrogen than a fed animal of the same size. |
| standard | 1.0 | everything else | |
| high | 1.3 | Bristlenose Pleco, Pea Puffer | Pleco: wood/algae grazer with high food throughput and heavy solid waste. Pea puffer: carnivore fed snails and meaty foods, messy feeder. |

Considered and **not** added:

- **Activity level.** Differences in routine activity among these community species are smaller than
  the uncertainty in the size data, and there is no consistent per-species source. (The page used to
  claim activity multipliers; the calculation never had them.)
- **Livebearer "high waste".** The evidence is anecdotal, and mollies/platies already rank well
  above tetras through size and deep build; an extra multiplier would double count.
- **Per-species correction constants.** None. Every factor above is a class shared by several
  species or a category.

## 4. Failure behaviour

`computeSpeciesBioload` returns `NaN` for missing or invalid inputs — never a default. Species
validation (`validateSpeciesRecord`) then rejects the record with a reason (for example
`missing bioload_profile`), and the advisor shows that species as "could not be evaluated" with the
bioload figure marked incomplete. A selectable species cannot silently drop out of, or count as
zero in, the calculation.

## 5. Maintenance

- To add a species: give it `adult_size_in`, `category` and a `bioload_profile`. Pick the build class
  from body shape, not from the answer you want. Use a non-standard waste class only with a written
  rationale that would apply to other species of the same ecology.
- Do not add a per-species multiplier to reach a target number. If a result looks wrong, check the
  adult size and its basis first — most surprises trace back to a maximum or total-length figure.
- The profiles are written by `scripts/data/apply-bioload-profiles-2026-09.mjs` (idempotent).
- The older v2 `bioload` block (`multiplier`, `components`) is retired: no calculation reads it. It
  stays in the JSON because `/js/*` used to be served with a one-year immutable cache: a returning
  browser may run the previous adapter once (which needs that block) before the stale-cache guard in
  `stocking-advisor.html` refreshes its modules. `/js/*` now revalidates (see `_headers`); the block
  can be removed once a year has passed since that change. The 20 hand-set GE values
  remain only in `js/fish-data.js`, the engine's pre-load default dataset, for reference.

## 6. What this model does not cover

- **Tank capacity side.** The percentage divides by effective gallons = 90 % of nominal gallons (a
  fixed substrate/decor displacement assumption) and then applies filtration capacity bonuses. Both
  are outside this model and are scheduled for separate review.
- **Size data quality.** Adult sizes are the record's maximum figures and their basis varies (SL, TL,
  unspecified). Swordtail (6.3 in, female maximum TL) and Angelfish (6 in SL maximum) are the most
  affected. Correcting sizes is a data task, not a model change.
- **Territory and space.** Bioload says nothing about how many territorial fish fit a footprint.
