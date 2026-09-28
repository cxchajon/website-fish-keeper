# Stocking Advisor — sponge migration phase B: rating-based engine, catalog metadata, custom sponge input (2026-09)

Implements phase **B** of `stocking-advisor-sponge-filter-migration-design-2026-09.md` (section 15)
using the locked decisions of its section 1 and the locked catalog values of
`stocking-advisor-sponge-rating-verification-2026-09.md` (§0, §8.2). Builds on phase A
(`stocking-advisor-sponge-migration-phase-a-2026-09.md`).

Base: `main` @ `f24098e`. Branch: `claude/stocking-advisor-sponge-phase-b-kckzw9`.

Out of scope and **not done**: identical duplicate filters (phase D), removing legacy sponge
`gphRated` / `minGallons` / `maxGallons` (phase E), the UGF compatibility model (phase F), the final
filtration-status card (phase G). The existing filtration UI and warning area are used.

---

## 0. Baseline trace (step 1)

Paths traced on `main` before editing (all confirmed as listed in the phase A report §0, plus):

| Path | Where | Baseline behaviour for a sponge |
| --- | --- | --- |
| Catalog load | `js/gear-data.js` `sanitizeItem`, cache key `ttg.gear.catalog.v1` | kept only because `gphRated > 0` (fake 60–200 GPH) |
| Tank filtering | `gear-data.js` `filterGearByTank` | hidden by GPH-bucket `minGallons`/`maxGallons` (e.g. none on 55/75/125 gal) |
| Picker label | controller `formatProductOption` | `name • 120 GPH • SPONGE • 0g–20g` |
| Product selection | controller `createProductFilter` | item with `gph` = catalog fake GPH |
| Custom input | controller `addManualFilter` | Sponge asked for GPH; label `Sponge 120 GPH` |
| Controller state / `setFilters` / restore | controller | dropped anything with GPH ≤ 0 |
| Saved state v2 / v1 migration | `saved-state.js` | sponge saved as `capacityMethod:"flow"` with `gph`; v1 mirror included it |
| compute sanitisation | `compute.legacy.js` `sanitizeFilter` | `rated_gph` = fake GPH |
| Filtration math | `math.js` `assessFiltration` | sponge GPH counted in biological GPH / turnover |
| Warnings | `compute.legacy.js` `buildFiltrationWarnings` | Phase 2C only (`none`, `circulation_only`, `very_low`) |
| Chips | controller `renderChips` | `120 GPH` badge |

Baseline test results on `main`: unit **146 / 146**; stocking gate **111 passed, 27 skipped**.

## 1. Old sponge behaviour

A sponge was a flow filter: its catalog `gphRated` (60–200, unsupported by any source — sponge audit)
or the user-entered GPH was added to biological GPH and compared to the 2× turnover floor. A catalog
sponge could only be picked on tanks inside its GPH-bucket range; names carried gallon claims.

## 2. New sponge evaluation model

`js/stocking-advisor/filtration/math.js` `assessFiltration` evaluates two independent paths and
never adds or converts them:

- **Powered** (HOB, canister, internal, custom powered, UGF — unchanged Phase 2C): biological GPH ÷
  nominal gallons ≥ `MIN_BIOLOGICAL_TURNOVER` (2, unchanged).
- **Sponge**: manufacturer tank rating, **`ratingStatus === "verified"` and a positive
  `manufacturerMaxGallons` only** (`resolveSpongeRating`). The minimum is display-only.

Decision order (design 4.4, with the step 9 lock for the mixed unknown case):

```text
no devices                                 → none              "No filter added"          (existing)
no biological device                       → circulation-only  "No biological filter"     (existing, red)
powered passes OR one verified sponge ≥ tank → adequate
≥2 verified sponges, none ≥ tank, Σmax ≥ tank → likely-multi-sponge (amber)
powered present AND any sponge present     → review            (amber)
powered only                               → very-low          "Filter flow too low"      (existing, red)
verified sponge(s) only                    → below-rating      (amber)
otherwise (only unrated sponges)           → not-evaluated     (neutral)
```

Structured output added (Stocking Load untouched, `capacityAdjustment` stays 0): `status`
(`icon`/`text`/`tone`), `adequateBy` (`powered` | `sponge` | `both`), `hasBiologicalFiltration`,
`hasBiologicalGph`, `powered {count, gph, turnover, passes, belowFloor}`, `sponge {count,
verifiedCount, unratedCount, status, rated, likelyMulti, entries[] }` where each entry lists its own
`ratingStatus`, verified max/min, `ratingText` and `coversTank`. **No combined gallon figure is
computed for display** (the Σ is a yes/no threshold only) and no hybrid turnover exists.

Sponge contribution to `ratedGph`, `biologicalGph`, `circulationGph`: **0**. A sponge is biological
filtration without biological GPH, so it can never produce "No filter added" or "No biological filter".

## 3. Stale-GPH protection (type wins)

The exact runtime rule: **`isSpongeFilter(entry)` (canonical type `SPONGE`) ⇒
`effectiveCapacityMethod(entry) = "manufacturer_rating"` and flow = 0**, evaluated from the type
before any GPH key is read. It is applied at every layer:

| Layer | Rule |
| --- | --- |
| `math.normalizeFilter` / `normalizeFilters` | sponge → `ratedGph 0`, `capacityMethod` forced; kept despite 0 GPH |
| `compute.legacy.js` `sanitizeFilter` | sponge → `rated_gph 0`, `capacityMethod` forced |
| `saved-state.js` `buildEntry` (write, v2 read, v1 migration) | sponge → `manufacturer_rating`, **no `gph` written**; catalog sponge = identity only |
| controller `toAppFilter`, `setFilters`, `createProductFilter`, restore | sponge item `gph 0`; `appState.ratedGph` null for a sponge |
| `sponge-items.js` | catalog rating from the current catalog record only; custom rating only when user-entered (`verified`) |

So neither `capacityMethod:"flow"`, `gph`, `rated_gph`, `gphRated`, a stale cached catalog, a v1
plan, a phase A v2 plan nor an old tab can make a sponge score GPH. An explicitly unsupported
`capacityMethod` still fails closed (phase A §6.1); compute marks such a sponge `capacityMethod:
"unsupported"` so it cannot re-enter as a rating sponge after sanitising.

## 4. Catalog changes

`assets/data/gearCatalog.json`: only the seven `SPONGE` records changed. Each gained
`capacityMethod`, `manufacturerMinGallons`, `manufacturerMaxGallons`, `ratingStatus`,
`ratingExpression`, and review-only `ratingEvidence`, `ratingSourceKind`, `ratingSource`,
`productRef`, `ratingNote`, `ratingCheckedAt`, plus `legacyFieldsNote`. **Legacy `gphRated`,
`minGallons`, `maxGallons` are kept unchanged** (compatibility baggage for old cached scripts until
phase E; `legacyFieldsNote` says so in each record); new code ignores them for `SPONGE`. The loader
copies only the runtime fields (`capacityMethod`, max, min, `ratingStatus`). The 34 non-sponge records
are byte-identical (fingerprint test updated to cover them).

`ratingExpression` uses the report's lower-case enum (`range`, `up_to`, `unclear`). Review-only; not read.

## 5. Final seven-product metadata

| id | min | max | ratingStatus | ratingEvidence | ratingSourceKind | expression | Phase B result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hygger-double-sponge-s` | 10 | 40 | verified | verified | manufacturer_official | range | **green-eligible** |
| `hygger-double-sponge-m` | 15 | 55 | verified | verified | manufacturer_official | range | **green-eligible** |
| `aquaneat-sponge-60` | 40 | 60 | needs_review | supported | retailer_exact_product, third_party_manual | range | Rating needed |
| `aquaneat-sponge-20` | null | 20 | needs_review | supported | retailer_exact_product | up_to | Rating needed |
| `aquaneat-sponge-10` | null | null | needed | needs_review | none | unclear | Rating needed |
| `pawfly-sponge-10` | null | null | needed | needs_review | search_index_only | unclear | Rating needed |
| `powkoo-dual-sponge-40` | null | null | needed | needs_review | none | unclear | Rating needed |

## 6. Display-name changes (ids unchanged)

| id | Old name | New name |
| --- | --- | --- |
| `aquaneat-sponge-10` | AQUANEAT Single Sponge Filter (Up to 10G) | AQUANEAT Single Sponge Filter |
| `aquaneat-sponge-20` | AQUANEAT Aquarium Bio Sponge Filter … (Middle up to 20Gal) | AQUANEAT Bio Sponge Filter — Middle |
| `aquaneat-sponge-60` | AQUANEAT Aquarium Bio Sponge Filter … (Large up to 60Gal) | AQUANEAT Bio Sponge Filter — Large |
| `pawfly-sponge-10` | Pawfly … for Tiny Fish Tank up to 10 Gallon | Pawfly Nano Bio Sponge Filter |
| `powkoo-dual-sponge-40` | Powkoo Dual Sponge Filter (20–55G) | Powkoo Dual Sponge Filter |
| `hygger-double-sponge-s` / `-m` | unchanged (S / M are variant labels) | unchanged |

## 7. Picker behaviour

- `filterGearByTank` no longer filters `SPONGE` items by the legacy GPH-bucket range: all seven
  sponges are offered on every tank (5 → 7 on 5/10/15 gal, 2 → 7 on 29/40, 0 → 7 on 55/75/125).
- The controller's "fall back to the whole catalog" decision now counts powered matches only, so the
  powered list is exactly as before (every preset has ≥ 1 powered match; verified in the UI
  differential on all 10 presets).
- Labels: `name • Sponge • Rated 10–40 gal` (Hygger S), `… Rated 15–55 gal` (Hygger M),
  `name • Sponge • Rating needed` (the other five). No GPH, no bucket range, no review-only 20/60.
  Sponge `<option>`s carry `data-rating-status` instead of `data-gph` / range attributes.
- Powered labels unchanged. Same-product duplicates still blocked ("Already added").

## 8. Chips and summary

- Sponge chip badge: `Rated 10–40 gal`, `Rated up to 40 gal` (custom), or `Rating needed`. Never GPH.
  The badge is exposed to assistive tech for sponges (it is `aria-hidden` for GPH badges, as before).
- An old custom sponge with no rating gets an **Add rating** button on its chip: it switches the
  custom row to Sponge, focuses the rating field, and Add then rates that sponge in place (same chip
  id and instanceId).
- Summary line: powered-only unchanged (`Filtration: 150 GPH • 5.2×/h`); with sponges
  `Filtration: 150 GPH • 5.2×/h + 1 sponge filter (rated by tank size)` or
  `Filtration: 1 sponge filter (rated by tank size)`; the circulation suffix is unchanged.

## 9. Custom sponge input

`stocking-advisor.html` adds `<span data-role="fs-rating-field">Rated for up to [#fs-rated-gallons]
gallons</span>` next to the GPH field (existing `fs-input fs-gph` styling; no CSS change).

- Type **Sponge** shows the rating field and hides GPH; every other type shows GPH. Switching type
  clears the hidden field (a GPH is never carried into gallons or back) and resets the note to the
  active field.
- Validation: whole gallons **1–999** (the calculator's tank-gallon ceiling); decimals round; values
  outside are rejected, not clamped. Error: "Enter the tank size this sponge is rated for: a whole
  number of gallons from 1 to 999." Powered error unchanged.
- Hint: "Rated for up to ___ gallons: enter the tank size the manufacturer rates this sponge for
  (printed on the box or listing, e.g. “up to 20 gallons”; for a range like 10–40 gal, enter 40).
  Sponge filters are checked by this rating; water flow isn’t estimated." No flow estimate, no
  measured-GPH override.
- Saved as `{type:"SPONGE", capacityMethod:"manufacturer_rating", manufacturerMaxGallons:N,
  ratingStatus:"verified", source:"custom", label:"Sponge filter", instanceId, legacyId}` — no GPH.

## 10. Saved-state migration behaviour

| Input | Result |
| --- | --- |
| v1 `{id:<catalog sponge>, type:"SPONGE", rated_gph:120}` | `{productId, type, capacityMethod:"manufacturer_rating"}`; rating from the current catalog; GPH dropped. Hygger S/M rated, the other five Rating needed |
| phase A v2 `{productId, type:"SPONGE", capacityMethod:"flow", gph:120}` | same; `instanceId` kept |
| v2 catalog sponge carrying saved rating fields | ignored; the catalog wins (a missing catalog record → Rating needed, never the saved rating) |
| v1 / phase A v2 custom sponge with only a GPH | custom sponge, `ratingStatus:"needed"`, `legacyGph` kept for one migration cycle (never scored, never shown, never converted to gallons), label `Sponge filter` (the old "Sponge 120 GPH" label is replaced); **Add rating** available |
| custom sponge with a user-entered rating | kept (`verified`); `legacyGph` dropped once rated |
| unknown / unresolvable product id typed SPONGE | kept with its productId, Rating needed, re-resolves when the catalog knows it |
| a `rated_gph: 0` SPONGE entry | kept (Rating needed), no longer dropped |
| powered entries | unchanged |

## 11. v1 compatibility behaviour

The v1 mirror (`ttg.stocking.filters.v1`) is written with **flow-method entries only**: powered
filters (catalog and custom) and powerheads. Every sponge is `manufacturer_rating` and is **never
written to v1**; manufacturer gallons never go into `rated_gph`. A plan with only sponges removes the
v1 key. v2 stays authoritative. Consequence (accepted, design 8.3): a still-open old tab sees only
the powered filters of a new plan.

## 12. Multiple-sponge logic

Only when no verified sponge covers the tank, at least two sponges are **verified**, and the sum of
their verified maxima ≥ tank: **⚠ Likely adequate — multiple sponge filters** (amber). The message
lists each sponge's own rating (repeated names numbered: "Sponge filter 1 … Sponge filter 2") and the
tank size, and never a combined number. `needs_review` / `needed` ratings never enter the sum.
Reachable in phase B with different catalog sponges or custom sponges (duplicates are phase D).

## 13. Mixed powered + sponge logic

Independent paths, either may pass (D5). Powered passes → adequate (`adequateBy: powered`), sponges
supplemental with no warning. One verified sponge covers the tank → adequate (`sponge`), with a
note that the powered filter is below 2× when it is. Both → `both`. Powered below 2× plus a sponge
that doesn't carry the tank (unrated or below rating) → **⚠ Review filtration** (amber), stating the
powered flow sentence and the sponge fact separately; the powered-only red "Filter flow too low" is
not used there. Powered-only below 2× stays red. Powerheads stay circulation only.

## 14. Status wording

| Level | Warning id | Severity (strip) | Title |
| --- | --- | --- | --- |
| adequate via sponge only | `filtration.sponge_rated` | info (ℹ Note) | ✓ Rated for this tank |
| likely-multi-sponge | `filtration.likely_multi_sponge` | warn (amber) | Likely adequate — multiple sponge filters |
| below-rating | `filtration.below_rating` | warn (amber) | Below manufacturer rating |
| review | `filtration.review` | warn (amber) | Review filtration |
| not-evaluated | `filtration.rating_needed` | info (ℹ Note) | ○ Not evaluated — rating needed |
| none / circulation-only / very-low | unchanged | unchanged | No filter added / No biological filter / Filter flow too low |

The warn strips already render a "⚠ Warning:" badge, so their titles omit the ⚠; the info strips
carry ✓ / ○ in the title. Chips show "○"-state as "Rating needed". Info notes are **not** status
issues (the `filtrationIssues` mapping now maps `info` → `ok`; before, anything non-danger was
`warn` — only warn/danger existed) and never become the filtration chip. `filtering.status` gives
"Rated for this tank" (good) / "Not evaluated — rating needed" (neutral) for those levels.
No sponge state is red.

## 15. Cache / versioning

- Catalog cache key bumped **`ttg.gear.catalog.v1` → `ttg.gear.catalog.v2`** (narrow): the cached
  catalog is served first for the whole page load, so without the bump a returning visitor would see
  Hygger S/M as "Rating needed" for one load. Old JS keeps using its own v1 key.
- Independent of the key, new JS is safe with stale records: a `{type:"SPONGE", gphRated:80}` record
  without rating fields is **Rating needed**, never turnover (unit-tested).
- `gear-data.js` keeps a SPONGE record even with no GPH (ready for phase E); powered records without
  GPH are still dropped.
- No `?v=` change is needed (`/js/*` and `/data/*` are `must-revalidate`; modules import by plain path,
  phase A §12). No other storage key changed.

## 16. Stocking Load differential

Compute differential (node, both trees): 10 tank presets × 4 stock lists (empty, community, heavy
+ candidate, predation + water + candidate) × 55 filter sets (none, all 41 catalog products, custom
HOB/canister/internal/powerhead variants, custom sponges, mixed, two sponges, Tetra + sponge +
powerhead) = **2,200 scenarios**. Stocking Load (every `bioload` field except the descriptive
`flowAdjustment`), species entries, conditions, water, aggression, invert checks, tank suitability,
non-filtration warnings: **0 differences in all 2,200**. Unit test "Stocking Load is identical
before filter, with powered, verified sponge and unrated sponge" covers 10 tanks × 5 stocks × 16
filter lists.

## 17. Powered-filter differential

Non-sponge scenarios (1,680 of the 2,200): **0 differences in every field**, filtration included
(GPH, turnover, level, warnings, chips, status, tank flow fields). Tetra Whisper IQ 45 = 215 GPH;
AquaClear 70 = 300, Fluval 307 = 303, EHEIM 2213 = 116; levels = GPH ÷ gallons ≥ 2 on every preset.

UI differential (Playwright, `main` and branch served side by side, 26 scenarios: picker on all 10
presets, none, custom HOB / 1 GPH canister / powerhead / mixed, Tetra, AC70, Fluval 307, EHEIM
2213, UGF, removal, tank changes, too-small angelfish, pea puffer quantity, seeded v1 powered plan):
chip text, summary, chipbar, warnings (id/state/text), Stocking Load label and bars, **powered picker
options**, product note, v1/v2 storage — **0 differences** (one earlier run differed only in the
product note "Loading filter catalog…", the pre-existing start-up race noted in phase A; it did not
reproduce).

## 18. Test results

| Suite | Result |
| --- | --- |
| `npm run test:unit` | **172 / 172** (146 existing, 26 new in `filter-sponge-phase-b.test.mjs`) |
| filter saved-state (`filter-saved-state.test.mjs`) | 20 / 20 (sponge expectations updated to phase B) |
| filtration model (`filtration-model.test.mjs`) | 15 / 15 (3 sponge-GPH assertions updated) |
| filter catalog (`filter-catalog-batch-1`, `-tetra-iq45`) | 7 / 7, 7 / 7 (fingerprint now covers the 34 non-sponge records) |
| species integrity (44 species) | 30 / 30 |
| `npm run test:stocking:extended` | 105 pairs, 0 failures (generated report not committed) |
| Stocking gate `npm run test:e2e:stocking-gate` (desktop + mobile) | **127 passed, 0 failed, 27 skipped** (111 existing + 16 new phase B runs; skips are the gate's desktop/mobile splits) |
| `guard:live`, `audit:controls` | pass |

Tests changed intentionally: the phase A sponge expectations (sponge scored by GPH, sponge in the v1
mirror, sponge label with GPH) and the gate's custom-filter helper (Sponge now takes gallons).

New browser spec `tests/stocking-advisor-sponge-phase-b.spec.ts` (desktop + mobile): custom input
switching HOB → Sponge → Canister, Sponge → Powerhead → Sponge with validation; verified Hygger
(picker, chip, green on 29, amber on 55); Rating-needed products on 75 gal; save / reload of catalog
and custom sponges; old v1 plan (incl. Add rating); old phase A v2 plan; mixed powered + sponge
(red → review → sponge-carried → powered pass); powerhead + sponge; no legacy sponge GPH anywhere
in the filtration UI.

## 19. Intentional behaviour changes (main → branch)

1. Sponges contribute 0 GPH; filtration GPH / turnover / summary exclude them.
2. Sponge filtration status comes from the manufacturer rating (new levels and warnings in §14).
3. Powered below 2× + sponge → amber "Review filtration" instead of red "Filter flow too low".
4. Sponge-only plans no longer show red "Filter flow too low" (e.g. a 60 "GPH" sponge on 40 gal).
5. Hygger S/M can be green by rating; the other five are "Rating needed".
6. All seven sponges are offered on every tank; sponge picker labels and chip badges show the rating.
7. Five sponge display names neutralised.
8. Custom Sponge asks "Rated for up to ___ gallons" instead of GPH; old custom sponges → Rating needed + Add rating.
9. Saved state: sponges saved as `manufacturer_rating` without GPH; sponges left out of the v1 mirror.
10. Catalog cache key `ttg.gear.catalog.v2`.
11. Intro copy of the custom row mentions that sponges are checked by their tank rating.
12. Descriptive/legacy fields derived from filter flow change for sponge plans only: `tank.turnover`,
    `tank.deliveredGph`, `computed.turnover` band, `bioload.flowAdjustment` (none is a Stocking Load
    input; the gear-page session payload built from them has no reader).

## 20. Known deferred items

- **Phase C**: further stale-cache / legacy validation (old-JS + new-data window in a real browser).
- **Phase D**: same-product duplicates (the multi-sponge tier is reachable only with different
  products or custom sponges until then).
- **Phase E**: remove sponge `gphRated` / `minGallons` / `maxGallons`, stop v1 mirror writes, drop
  `legacyGph`, correct `FILTRATION_MODEL.md` §6.
- **Phase F**: UGF. **Current UGF behaviour (unchanged):** `penn-plax-ugf-20-29` is a flow filter
  scored at its catalog 150 GPH, offered on 20–40 gal by its range, chip "150 GPH"; it is not a
  sponge and not affected by phase B.
- **Phase G**: the filtration-status card (per-path lines, supplemental lines, redundancy line,
  permanent "does not increase stocking capacity" line on every state — phase B puts it only on the
  sponge-rated note so Phase 2E warning copy stays unchanged).
- The gear page (`assets/js/gear.v2.js`) still writes a sponge's legacy `rated_gph` into
  `sessionStorage['ttg:rated_gph']`, which has no reader; the legacy `stocking.js` picker/drawer is
  disabled while the controller owns filters, and anything it could write is zeroed for sponges by
  `sanitizeFilter`.
- `data/gear_filters_ranges.csv`, `assets/data/gear/filters.json`, `data/filters.json` and gear-page
  copy still carry old sponge names/ranges (gear-page content pass).
- `npm run lint:css` reports pre-existing errors on `main`; no CSS changed here.

## Files changed

- `assets/data/gearCatalog.json` — seven sponge records (metadata, names).
- `js/stocking-advisor/filtration/math.js` — type-wins rule, rating resolution, new levels / status, two-path `assessFiltration`.
- `js/stocking-advisor/filtration/sponge-items.js` (new) — pure sponge item helpers (catalog, custom, restore, badges, input parsing).
- `js/stocking-advisor/filtration/controller.js` — sponge items, chips, picker labels/filtering, summary, custom rating input, Add rating, restore.
- `js/stocking-advisor/filtration/saved-state.js` — sponge entries as `manufacturer_rating`, no GPH, `legacyGph`.
- `js/logic/compute.legacy.js` — sponge sanitising, new warnings/status, info notes not issues.
- `js/gear-data.js` — cache key v2, GPH-less sponge records kept, sponges not tank-filtered.
- `stocking-advisor.html` — rated-gallons field; custom-row intro copy.
- Tests: `tests/unit/filter-sponge-phase-b.test.mjs` (new), `tests/stocking-advisor-sponge-phase-b.spec.ts` (new),
  `tests/unit/filter-saved-state.test.mjs`, `tests/unit/filtration-model.test.mjs`,
  `tests/unit/filter-catalog-tetra-iq45.test.mjs`, `tests/stocking-advisor-saved-filters.spec.ts`,
  `tests/stocking-advisor-gate.spec.ts`, `playwright.stocking-gate.config.ts`.
- `_internal/reports/stocking-advisor-sponge-migration-phase-b-2026-09.md` (this report).
