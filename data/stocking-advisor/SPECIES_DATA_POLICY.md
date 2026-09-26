# Stocking Advisor species data — source policy and field semantics

Policy version: 2026-09-26. Applies to `species.v2.json`. The reviewed values for the 24 species that
have no legacy record are written by `scripts/data/apply-species-husbandry-2026-09.mjs`; every
value there cites its source in the record's `husbandry_review`.

## 1. Source-selection policy

Sources are ranked by tier:

| Tier | Kind | Examples |
|---|---|---|
| 1 | Species-specific specialist references with explicit aquarium dimensions | Seriously Fish, PlanetCatfish species profiles (not its forum) |
| 2 | Established aquarium organisations / publications with explicit husbandry recommendations | FishBase, Aquarium Co-Op care guides, AquaInfo, Practical Fishkeeping, TFH, Fishkeeper UK |
| 3 | Established specialist breeders / retailers | The Shrimp Farm |
| 4 | General hobby references and forums — corroboration only | FishLore, Guidarium, Wikipedia, forum threads, general care-guide sites |

Rules:

1. For each field, the value comes from the **highest-tier source that states it explicitly**. A
   lower-tier source is used only when no higher tier gives the field, and the record says so.
2. Where sources genuinely disagree, **one value is selected by rule 1** — never the largest, never
   an average, never a compromise. The disagreement is kept in `husbandry_review.disagreements`.
3. When a single source states a range for a minimum ("a 5- or 10-gallon tank"), the upper figure
   of that source's own range is used and noted. Values from different sources are never combined
   into a new number.
4. Tank volume and tank length are separate fields and may come from different sources of the same
   tier when no one source gives both; the record names each.
5. If a value cannot be verified, it is marked `open_question: true` and listed in the review
   report rather than silently chosen.

## 2. Field semantics

| Field | Meaning |
|---|---|
| `adult_size_in` | Maximum adult length as stated by its source, in inches. `adult_size_basis` records what was measured: `standard_length` (SL, snout to tail base), `total_length` (TL, including tail), `maximum_length_unspecified` (source gives a size without saying SL or TL), `body_length` (shrimp), `shell_length` / `shell_diameter` (snails). Values with different bases are not directly comparable. |
| `min_tank_liters` | The smallest tank the canonical source recommends **for keeping the species at all**, i.e. for its minimum keeping unit. `min_tank_basis` records which unit the source stated it for: `single`, `pair`, `group` (the species' minimum social group), or `unspecified` (source gives one minimum without naming the unit). The engine applies it once per species; it is **not** scaled by the number planned. |
| `min_tank_length_in` | The recommended minimum horizontal length of the tank. `min_tank_length_basis`: `source` (an explicit base/footprint dimension from a cited source), `inferred_standard_tank` (no source gives dimensions; the length of the standard US tank of the canonical volume is used and flagged), or `not_applicable` (crawling snails; value is `null`). |
| `tank_length_not_applicable` | `true` only when `min_tank_length_basis` is `not_applicable`. |
| `behavior.schoolingMinimum` | The genuine social minimum — the smallest group the species should be kept in because it is a shoaling/social species. Sex-ratio advice (e.g. livebearers' "two females per male") is **not** a schooling minimum and lives in `sex_ratio_guidance`, which the engine does not enforce. |
| `blackwater` | Engine meaning: `requires` → red warning when tannins are off; `prefers` → amber; `neutral` → assessed as having no tannin preference. `null` → **not assessed** (no cited source makes a tannin/habitat claim); the engine applies no blackwater rule. "Does not require tannins" is not evidence for `neutral`. |
| Seriously Fish volumes | Seriously Fish states base dimensions (length × width); its quoted litres are length × width × height with height = width unless stated. Where only dimensions were retrievable, the volume is computed the same way. |

## 3. Predation vocabulary

`shrimp_risk` / `snail_risk` mean documented predation. They come only from explicit evidence: the
v2 tag, or a prey entry in `behavior.predationRisks` (entries starting "Predators:" describe what
eats the species and are ignored). The broad legacy `invert_safe` flag is kept as a separate generic
field and is not evidence of predation.

## 4. Bioload

The GE values for newer species are a **provisional calibration bridge** (see
`fitBioloadCalibration` in `js/stocking-advisor/logic/species-adapter.v2.js`), not a validated
model. The original 20 species keep their own GE values.

## 5. Verification methods

Each source records `verification`:

- `direct` — page read directly.
- `search-extract` — the review environment could not open most care-reference sites, so the value
  was read from a search-engine extract that attributed it to that exact page.
- `search-summary` — the claim appeared in a multi-source search summary listing that page; exact
  attribution not confirmed, so it is corroboration only.
- `reviewer-reported` — supplied by the production review.

Anything not `direct` should be confirmed by reading the page before the value is treated as final.
