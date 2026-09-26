# Phase 2G: species predation data fix, batch 1 (Cardinal Tetra, Cherry Barb, Molly)

Date: 2026-09-26 · Branch: `claude/phase-2g-predation-corrections-2uq0ag` · Source of truth: Phase 2F audit
(`species-predation-data-audit-2026-09.md`, §4.3 R1–R3, §11 "Ready for first production data patch").

Scope: data only, three species. Not changed: engine, predation precedence, severity rules, schema, tag
vocabulary, bioload, filtration, water model, warning UI, and every other species.

## 1. Data changes (`data/stocking-advisor/species.v2.json`)

| Species | Old `behavior.predationRisks` | New `behavior.predationRisks` | Direct source (Phase 2F) |
|---|---|---|---|
| Cardinal Tetra | `Shrimp (cherry)` | `Shrimp (juvenile)` | R1, Aquarium Co-Op Cardinal Tetra care guide, https://www.aquariumcoop.com/blogs/aquarium/cardinal-tetra. Adult dwarf shrimp are generally left alone when cover is available; baby shrimp are eaten opportunistically. |
| Cherry Barb | `Shrimp (cherry)`, `Shrimp (amano)` | `Shrimp (cherry)` | R2, Aquarium Co-Op Cherry Barb care guide, https://www.aquariumcoop.com/blogs/aquarium/cherry-barb. Adult Cherry Shrimp may be pursued or eaten; larger Amano Shrimp generally do okay. |
| Molly | `Shrimp (juvenile)` | `Shrimp (cherry)`, `Shrimp (juvenile)` | R3, Aquarium Co-Op Molly care guide, https://www.aquariumcoop.com/blogs/aquarium/molly-fish-care. Larger mollies will most likely eat smaller animals such as Cherry Shrimp. |

All source statements are the reviewer's paraphrase (`reviewer-reported`), not quotations.

### Source provenance

- **Molly** has a `husbandry_review` block, so the claim was added there using the existing convention.
  The new source entry is tier 2, `verification: "reviewer-reported"`, `fields: ["shrimp_risk"]`, and
  carries the exact R3 URL. A `husbandry_review.notes` entry records the size limitation (§4). The entry
  is written by `scripts/data/apply-species-husbandry-2026-09.mjs`, so a re-run keeps it. The script
  is still idempotent, and a re-run produces no further diff.
- **Cardinal Tetra and Cherry Barb** are legacy records with no `husbandry_review`. Adding one would change
  the provenance contract: the "24 newer species" integrity test, and the rule that `min_tank_liters` must be
  source-backed. So the predation source (URL, tier, verification level, date) is recorded in the record's
  existing free-text `behavior.notes`. That field is passed to the engine but never rendered, so there is no
  UI change. The generic `sources` block is unchanged.

### Tags

No tag changes. Neither record has a `shrimp_safe` tag, so no contradiction exists. The adapter already
derives `shrimp_risk` for all three species from their shrimp prey entries, before and after this change.
Adding the raw `shrimp_risk` tag to Cardinal and Cherry Barb (optional in Phase 2F §6.1) was skipped:
it has no engine effect and belongs to the later tag-hygiene pass.

### Adapter / legacy alignment

- `js/stocking-advisor/logic/species-adapter.v2.js`: `LEGACY_BASE` entries for `cardinal-tetra` and
  `cherry-barb` hold no predation data (`behavior: undefined`), and Molly has no entry. The only related value
  is the generic `invert_safe: false` flag, which is explicitly not predation evidence (policy §3). Both
  species still prey on shrimp, so it stays correct. **No change.**
- `js/fish-data.js`: the Cardinal and Cherry Barb records likewise hold only `invert_safe: false` and no prey
  data. Molly is absent. The engine does not read this file for selectable species (integrity test).
  **No change.**

No conflicting predation values remain across the data layers.

## 2. Warning outcomes (Phase 2E engine, before → after)

Same in the candidate preview (before Add) and in the plan (after Add).

| Pair | Before (main) | After (this branch) |
|---|---|---|
| Cardinal + Cherry Shrimp | **RED**, "may prey on" (named) | **AMBER**, "may eat juvenile Cherry Shrimp" |
| Cardinal + Amano / Ghost / Bamboo | none | AMBER, juvenile (the engine applies juvenile scope to every shrimp) |
| Cherry Barb + Cherry Shrimp | RED (named) | RED (named), unchanged |
| Cherry Barb + Amano | **RED** (named) | **none** |
| Cherry Barb + Ghost / Bamboo | none | none (Cherry evidence not generalised) |
| Molly + Cherry Shrimp | AMBER (juvenile) | **RED** (named entry outranks juvenile) |
| Molly + Amano / Ghost / Bamboo | AMBER (juvenile) | AMBER (juvenile), unchanged, no new red |

Cardinal is never red against any shrimp. Species notes: Cardinal's candidate note now reads "May prey on:
juvenile shrimp". Molly shows two notes ("cherry shrimp", "juvenile shrimp"). Both are hidden when the
matching predation warning is shown.

## 3. Regression (branch vs main, all 44 species)

Every ordered species pair was run through `buildComputedState` (125 g tank, 800 gph canister, 6 of each),
once as stock + candidate and once with both added. That is 44 singles plus 1,892 × 2 pair runs.

- 44 selectable species on both sides. Derived tags, fish-on-fish prey links, group minimums and aggression
  are identical.
- Bioload (current and proposed %) and filtration output are identical in every run.
- Warning-set differences occur **only** for these 8 relationships, each seen in all 4 orderings:
  `+ danger molly.neocaridina`, `− warn molly.neocaridina`, `− danger cardinal.neocaridina`,
  `+ warn cardinal.{neocaridina, amano, ghost_shrimp, bamboo_shrimp}`, `− danger cherrybarb.amano`.
- No other warning changed: water/range conflicts, tank size and length, group, aggression, fish predation
  and all other shrimp/snail relationships.

## 4. Known schema limitation: Molly size

The source says **larger** mollies will likely eat Cherry Shrimp. The data model has no predator-size
qualifier, and the engine drops unknown qualifiers (Phase 2F §8.8). So the named `Shrimp (cherry)` entry
makes **every** Molly selection red with Cherry Shrimp, including juveniles and small individuals. This
overstates the risk for small mollies. That is accepted as the conservative choice and is recorded in
Molly's `husbandry_review.notes`.

Related, unchanged limitation (Phase 2F §8.4): juvenile entries warn against Amano and Bamboo Shrimp, whose
larvae cannot survive in freshwater. Cardinal therefore gains three ambers of this kind (Amano, Ghost, Bamboo).

## 5. Tests

- `tests/unit/invert-predation.test.mjs`: test B now uses Cardinal as the juvenile-only predator, since
  Molly is no longer juvenile-only. The Cherry Barb + Amano red assertion was removed from C/D because it is
  now covered as "no warning". Seven Phase 2G tests were added: Cardinal amber and never red, Cherry Barb +
  Cherry red, Cherry Barb + Amano/Ghost/Bamboo none, Molly + Cherry red (named beats juvenile), Molly +
  non-Cherry amber only, and source provenance.
- `tests/stocking-advisor-gate.spec.ts` (desktop and mobile):
  - Cardinal + Cherry amber, Cherry Barb + Cherry red and Molly + Cherry red, each visible before and after
    Add.
  - Cherry Barb + Amano has no warning, before and after Add.
  - Neutral-note cases added for Cardinal, Cherry Barb and Molly (named cherry note).
  - The "juvenile-only is amber" row now uses Cardinal.

### Pre-existing gate issues found (not caused by this batch; both reproduce on unmodified main)

1. **Quantity preview race (app bug, `js/stocking.js`).** If the debounced render from a species change
   runs before the quantity is typed, the quantity blur handler sees no change and never recomputes.
   The `input` handler has already stored the new value. The preview then keeps "1 ×" and can show a false
   group warning. Reproduced manually (select Cardinal, wait, type 6 → preview still "Planned: 1") and in the
   existing Tiger Barb neutral-note test on main. The neutral-note tests now force a recompute so they check
   the species notes only. The app bug itself is out of scope here.
2. **Mobile Blue Ram predation test** (`shrimp predation: named, visible …`) occasionally fails
   `toBeVisible` under parallel load: about 1 in 20 on main and on this branch.
