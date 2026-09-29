# Stocking Advisor — sponge migration phase F: dedicated undergravel filter model (2026-09)

Phase **F** of `stocking-advisor-sponge-filter-migration-design-2026-09.md` (section 15), implementing the
locked decision **D12**: an undergravel filter (UGF) is evaluated by **explicit tank compatibility** —
the tank presets its maker lists — never by GPH, turnover, a generic gallon range or sponge
manufacturer-max-gallons logic. Builds on phases A–E (`…-phase-a-2026-09.md` … `…-phase-e-2026-09.md`).

Base: `main` @ `a4bc40f` (phase E). Branch: `claude/stocking-advisor-ugf-phase-f`.

Not changed: Stocking Load, the powered-filter 2× floor (`MIN_BIOLOGICAL_TURNOVER`), sponge rating
logic, duplicate-filter behaviour (UGF stays the one-per-tank exception), v2 saved-state format for
non-UGF devices, v1 read / migration, species / water / compatibility / predation / quantity-space
rules. **Phase G (filtration-status card) was not started.**

### Baseline on `main` (step 1, before editing)

Confirmed on `main` @ `a4bc40f`: phase E clean sponge catalog; `ttg.gear.catalog.v3`; v2-only filter
saves; historical v1 reads; phase C stale-cache protections (`KNOWN_SPONGE_PRODUCT_IDS`, sanitisers);
phase D instances; UGF still `gphRated 150`, `minGallons 20`, `maxGallons 40`, flow-scored.

| Suite | Baseline (`main`) |
| --- | --- |
| `npm run test:unit` | 245 / 245 |
| Stocking gate (`CI=1`, desktop + mobile, clean `main` worktree) | 179 passed, 0 failed, 27 skipped |
| `npm run test:stocking:extended` | 105 pairs, 0 failures |

(The container's Playwright download was missing; every browser run used the pre-installed Chromium
via the configs' `PW_CHROMIUM_PATH`.)

---

## 1. Purpose

Replace the placeholder UGF data (a flow filter at 150 GPH with a 20–40 gal bucket) with the locked D12
model: the Penn-Plax plates are **listed for specific tank presets**, and the advisor says "rated for
this tank" only on those presets.

## 2. Old UGF behaviour (phases A–E)

`penn-plax-ugf-20-29`: `type UGF`, `gphRated 150`, `minGallons 20`, `maxGallons 40`. Loaded as a
powered flow filter, scored at 150 GPH (29 gal → 5.2× → adequate), chip "150 GPH", option
"… • 150 GPH • UGF • 20g–40g", offered on 20h / 20l / 29g / 40b by gallons. Only the one-per-tank rule
(phase D) was UGF-specific.

## 3. Why 150 GPH was removed

It was never a measured or published flow: the sponge audit (§11) graded it unsupported. A UGF is
driven by lift tubes on an air pump or powerheads (neither is included); water flow through the bed
depends on that drive, not on the plates. Scoring it gave a 20 High and a 40 Breeder "adequate" from an
invented number. The field is **removed** (not set to 0): the current UGF record has no `gphRated`.

## 4. Why the generic gallon range was removed

`minGallons 20` / `maxGallons 40` was the catalog's GPH-bucket range, not the product claim. Undergravel
capacity is plate / bed **area** (footprint), not volume (design §11 option A): a 20 High (24" × 12½")
is inside 20–40 gal but the 28" plate set doesn't fit it; a 40 Breeder (36" × 18") is inside the range
but is not what the product is sold for. The range is replaced by `compatibleTanks`.

## 5. Confirmed compatible tank ids

Source of truth: `js/utils.js` `TANK_SIZES` (the ids the tank store, `#tank-size` and compute use):
`5g, 10g, 15g, 20h, 20l, 29g, 40b, 55g, 75g, 125g`. **20 Gallon High = `20h`, 20 Gallon Long = `20l`,
29 Gallon = `29g`** — confirmed. `compatibleTanks: ["20l", "29g"]`.

## 6. Why 20h differs from 20l

Both are 20 gallons. The product claim is "for 20 **(Long)** – 29 gallon tanks" with two 14" × 11.1"
plates (≈ 28" × 11.1" installed). The 20 Long and 29 share a 30¼" × 12½" footprint; the 20 High is
24¼" × 12½". Any gallons-based rule would treat them identically, which is why the engine receives the
preset id and never infers it (sections 12, 16).

## 7. capacityMethod decision

`capacityMethod: "tank_compatibility"` — reserved by phase A (`CAPACITY_METHODS.TANK_COMPATIBILITY`)
and semantically what D12 describes. This is a **representation refinement** of the design, which
(written before phase A's plumbing) sketched the UGF as `manufacturer_rating` + `compatibleTanks`. The
product behaviour is exactly the locked D12 behaviour; only the method name is the more precise one
phase A already reserved. The UGF has **no** `manufacturerMaxGallons` and is never routed through the
sponge rating path: no numerical manufacturer gallon rating is used.

## 8. Catalog record before / after

```jsonc
// before (main @ a4bc40f)
{ "id": "penn-plax-ugf-20-29", "brand": "Penn-Plax", "name": "…", "type": "UGF",
  "gphRated": 150, "minGallons": 20, "maxGallons": 40 }

// after
{ "id": "penn-plax-ugf-20-29", "brand": "Penn-Plax", "name": "…", "type": "UGF",
  "capacityMethod": "tank_compatibility", "compatibleTanks": ["20l", "29g"],
  "compatibilityExpression": "listed_tanks", "compatibilitySourceKind": "product_title",
  "compatibilityNote": "…", "compatibilityCheckedAt": "2026-09-29" }   // last four: review-only

// loaded (sanitised) record = what ttg.gear.catalog.v4 holds
{ "id", "brand", "name", "type": "UGF", "capacityMethod": "tank_compatibility", "compatibleTanks": ["20l", "29g"] }
```

The id and name are unchanged, so every saved plan still resolves the product. The other 40 records
are byte-identical (the 32 powered / other records' fingerprint is identical on `main` and the branch;
`filter-catalog-tetra-iq45.test.mjs` pins it).

## 9. Cache-key decision

`js/gear-data.js`: `STORAGE_KEY = 'ttg.gear.catalog.v4'` (exported as `CATALOG_CACHE_KEY`). A phase E
`v3` cache physically holds the UGF's 150 GPH / 20–40 bucket; phase F starts a clean generation.
Current code reads and writes **v4 only** and never reads, writes or deletes v3 / v2 / v1 (older open
tabs own those keys). Online with only a v3 cache: network catalog used, v4 written clean, v3 left
untouched. Offline with only v3: catalog unavailable (no fallback to an older generation) — saved UGFs
use the known-UGF path (section 11). Stale-record hardening still applies to whatever the loader reads
(section 10), and is unit-tested by feeding stale UGF shapes through the v4 key.

## 10. Catalog sanitizer

`sanitizeItem` (narrow change):

- a known UGF id (`isKnownUgfProductId`) is typed `UGF` whatever the record says (as phase C does for
  sponges);
- a UGF does **not** require GPH; it gets no `gphRated` / `rated_gph` / `minGallons` / `maxGallons`
  (no synthetic 0 GPH, no Infinity range), no manufacturer rating fields, `capacityMethod` forced to
  `tank_compatibility`, and `compatibleTanks` only if it survives sanitising;
- an explicitly unsupported `capacityMethod` still drops the record (phase A rule);
- powered records: unchanged (GPH still required); sponges: unchanged.

`compatibleTanks` sanitising (`math.sanitizeCompatibleTanks`): array only; string entries only; trimmed;
empty removed; de-duplicated; **only exact current preset ids** (`TANK_PRESET_IDS`, derived from
`TANK_SIZES`); returned in preset order; empty → `null`. A string `"20l,29g"`, an object, `["20"]`,
`[20, 29]`, `["20 gallon long"]`, `["20L"]` all fail closed (null → compatibility unknown). The current
Penn-Plax record sanitises to exactly `["20l", "29g"]`.

## 11. Known-UGF stale-data protection

`math.KNOWN_UGF_PRODUCT_IDS = ['penn-plax-ugf-20-29']` — the undergravel twin of
`KNOWN_SPONGE_PRODUCT_IDS`, identity only (unit test: equals the catalog's UGF ids; disjoint from the
sponge list). Applied at every place phase C applies the sponge list: `gear-data.sanitizeItem`,
`compute.legacy.sanitizeFilter`, `saved-state.buildEntry`, `sponge-items.restoreKind`, controller
`isUndergravelProduct`. A saved entry for this id typed `HOB` / flow / 150 / 900 GPH / missing /
nonsense type is a UGF: 0 GPH, `tank_compatibility`. **Offline fallback**: type UGF, 0 GPH, identity
kept, no compatibility (compatibleTanks are never hardcoded) → neutral "not evaluated". The known-sponge
protection is untouched and tested independently. `restoreKind` now checks known ids before saved types,
so a known UGF saved as `SPONGE` is a UGF and a known sponge saved as `UGF` is a sponge.

## 12. Engine evaluation

`math.effectiveCapacityMethod`: SPONGE → `manufacturer_rating`; **UGF → `tank_compatibility`**, both
before any GPH field is read; an explicitly unsupported method → `null` (fails closed, unchanged).
`gph`, `rated_gph`, `ratedGph`, `gphRated`, `capacityMethod: "flow"` never make a UGF score flow.
A non-UGF device carrying `tank_compatibility` is unchanged (not re-scored; zero non-UGF differences).

`normalizeFilter` gives a UGF `ratedGph 0` and keeps it (like a sponge); `role` stays biological. So a
valid UGF is **biological filtration present** with 0 biological / circulation / rated GPH and 0 turnover
— never "No biological filter".

Tank id threading: `assessFiltration({ filters, gallons, hasStock, tankId })`. `compute.legacy
buildFilteringState` passes `tank.presetId` (set by `calcTank` from `state.tank.id`, i.e. the tank
store's canonical id). The engine sanitises it with `cleanTankPresetId` (exact preset ids only) and
never derives it from gallons. Only the UGF path reads it.

Dedicated UGF path (`describeUgf`), per entry: sanitised `compatibleTanks`, current `tankId`,
`compatible = compatibilityKnown && tankId && compatibleTanks.includes(tankId)`, status:

| status | meaning |
| --- | --- |
| `compatible` | preset listed |
| `not-listed` | compatibility known, preset not listed |
| `tank-unknown` | compatibility known, no canonical preset id (e.g. custom gallons) |
| `compatibility-unknown` | no usable compatibleTanks (custom UGF, offline, stale record) |

No gallons arithmetic, no footprint maths at runtime, no sponge arithmetic, never summed with anything.

Decision logic (design 4.4 with the UGF path; only the `ugfRated` and `(sponges or ugf)` terms are new):

```text
NONE / CIRCULATION_ONLY   unchanged (a UGF is biological, so UGF + powerhead is never circulation-only)
ADEQUATE                  poweredPasses or spongeRated or ugfRated
LIKELY_MULTI_SPONGE       unchanged
REVIEW                    powered present, not passing, and (sponges or UGFs) present
VERY_LOW                  powered only (unchanged)
BELOW_RATING              verified sponges only (unchanged)
NOT_EVALUATED             otherwise (unrated sponges and / or UGFs not listed)
```

Structured output (step 31–32):

- `passingPaths`: every path that passes on its own, ordered `['powered', 'sponge', 'ugf']` subset;
  `[]` unless adequate.
- `adequateBy`: **unchanged meaning** whenever the powered or sponge path passes (`'powered'`,
  `'sponge'`, `'both'` = powered + sponge); `'ugf'` only when the UGF is the **sole** passing path. So
  consumers of `adequateBy` see identical values for every plan without a UGF, and phase G reads
  `passingPaths` for the complete picture.
- `ugf`: `{ count, capacityMethod: 'tank_compatibility', tankId, status, rated, gph: 0, entries[] }`;
  each entry `{ id, instanceId, productId, label, capacityMethod, compatibleTanks, compatibilityText,
  tankId, compatibilityKnown, compatible, status, gph: 0 }`. No gallons of capacity, no turnover.
- also `tankId` and `hasUgf` at the top level.

## 13. Passing status

20 Long / 29: level `adequate`, `adequateBy 'ugf'`, status `✓ Undergravel filter rated for this tank`
(tone good; new `FILTRATION_STATUS.UGF_RATED`). Neutral info note `filtration.ugf_rated`:
"Rated for: 20 Long and 29 Gallon tanks · Tank: 29 gal. Undergravel filters are checked by the tank sizes the
manufacturer lists; water flow isn't estimated. Filtration supports your livestock but does not increase
stocking capacity." No GPH, turnover, 150, or "sponge" anywhere. Filtration chip: none (as for a rated
sponge).

Compatibility text (`formatCompatibleTanks`, revised in review — section 27): each listed preset is
named explicitly, "20 Long and 29 Gallon"; never a dash or range.

## 14. Non-compatible status

Any preset not listed: level `not-evaluated` (neutral), status text carried by that level
(step 33: no new global level) — `○ Rating needed — this undergravel filter isn't listed for this tank
size` (`FILTRATION_STATUS.UGF_NOT_LISTED`, used when UGFs are the only unevaluated devices; the generic
"Not evaluated — rating needed" stays for sponge-only cases). Info note `filtration.rating_needed`:
"<name> is rated for 20 Long and 29 Gallon tanks, and this tank size isn't listed, so it isn't evaluated here.
Filtration isn't evaluated — not adequate, not unsafe." Never red, never the chip, never "Below
manufacturer rating".

## 15. Picker eligibility

`gear-data.filterGearByTank(items, gallons, tankId)` (third argument new, optional):
a UGF is offered only when `tankId` is in its sanitised `compatibleTanks` (`isUndergravelEligibleForTank`),
with or without gallons; never without a preset id. All other products are filtered exactly as before
(unit-tested on all presets and 19 gallon values). The controller passes the tank store's preset id,
excludes an ineligible UGF from its whole-catalog fallback too, and `canAddProduct` also refuses a stale
selection of the UGF on an unlisted preset ("This undergravel filter isn't listed for this tank size.").
Result: offered on **20l, 29g only**. Option text: `<name> • Undergravel • 20 Long and 29 Gallon`
(`data-filter-type="UGF"`, `data-compatible-tanks="20l 29g"`; no `data-gph` / min / max).

## 16. Saved-state behaviour

New catalog UGF saves identity only: `{instanceId, source:"product", productId, type:"UGF",
capacityMethod:"tank_compatibility"}` — no `gph`, `rated_gph`, bucket, rating or `compatibleTanks`
(re-resolved from the current catalog on reload, like catalog sponge ratings). v2 only; no v1.

Saved UGF on a tank it isn't listed for (29 → 40b): **not deleted**; same instance stays visible
(chip `data-rating="not-listed"`), evaluated as not listed; back to 29 → same `instanceId`, adequate.
Picker eligibility and restoration are separate concerns.

## 17. Historical v1 / v2 behaviour

| Historical shape (`penn-plax-ugf-20-29`) | Result (catalog loaded) |
| --- | --- |
| v1 `{type UGF, rated_gph 150}` | UGF, `tank_compatibility`, catalog `compatibleTanks`, 0 GPH; 29 → adequate |
| v1 typed `HOB` 150 / 900, v1 missing type | same (known id wins) |
| phase A v2 `capacityMethod flow, gph 150` | same |
| phase E v2 identity + stale `gph` / `minGallons` / `maxGallons` | same (all ignored) |
| v2 `HOB` 900 conflict, v2 nonsense type | same |
| v2 with a tampered `compatibleTanks` (`40b`, `55g`) | ignored; catalog list wins (40b not evaluated) |
| stale v3 catalog record (150 / 20 / 40) | not read (v4 key); fed through v4 directly: 0 GPH, no compatibility, not offered, not evaluated |

Written back as the identity-only v2 entry above; the historical v1 key is removed on save (phase E
rule). The pre-controller view (stocking.js before the controller restores) also scores 0 GPH.

## 18. Offline behaviour

Catalog unavailable: the known id keeps the entry a UGF — 0 GPH, `compatibility-unknown`,
`not-evaluated` (neutral), chip "Rating needed", no v4 cache written. The old 150 / 900 GPH never
revives. When the catalog is back, the next load resolves `compatibleTanks`.

## 19. Mixed powered / sponge / powerhead behaviour

| Setup | Result |
| --- | --- |
| compatible UGF + adequate powered (Tetra IQ 45, 29) | adequate; `passingPaths ['powered','ugf']`; `adequateBy 'powered'`; GPH = 215 (Tetra only); no note |
| compatible UGF + weak powered (20 GPH) | adequate; `adequateBy 'ugf'`; powered `belowFloor` shown in the UGF note |
| compatible UGF + verified sponge (Hygger S, 29) | adequate; `['sponge','ugf']`; no arithmetic |
| compatible UGF + unrated sponge (AQUANEAT Middle) | adequate from UGF; sponge stays Rating needed (named in the note) |
| UGF not listed (20h) + sponge covering the tank | adequate from sponge; `filtration.ugf_not_listed` info line |
| compatible UGF + powerhead | adequate from UGF; powerhead circulation only; UGF 0 biological GPH |
| UGF not listed only | not evaluated (neutral) |
| UGF not listed + powerhead | not evaluated — **not** "No biological filter" |
| UGF not listed + weak powered | **Review filtration** (amber): powered sentence first and in full, then "Undergravel filter: … isn't listed …"; not adequate, weak powered concern not hidden |
| UGF not listed + verified sponge below rating (55) | below rating + UGF info line |

Decision for step 30: the narrowest rule consistent with design 4.4 — a UGF that can't be evaluated
sits in the existing REVIEW tier beside a failing powered path (exactly as an unrated sponge already
could), and is otherwise neutral. No numerical combination anywhere.

## 20. One-UGF rule

Unchanged phase D exception: Add Selected is disabled after one UGF ("Already added. An undergravel
filter is one plate set per tank."); damaged saved state with 2–3 copies (including one typed HOB 900)
restores one, catalog loaded or offline (the restore de-dup now also recognises the known id).

## 21. Custom UGF decision

Audit: the custom "Filter type" selector (`stocking-advisor.html #fs-type`) offers HOB / Canister /
Internal / Sponge / Powerhead — **no Undergravel option already** (design 6.2), so no UI change was
needed; users cannot enter UGF + GPH. Historical custom UGFs (v1 `UGF` 150, v1 `Undergravel` 900, v2
custom flow 150) are still parsed: type UGF, `tank_compatibility`, 0 GPH, label "Undergravel filter",
biological present, `compatibility-unknown` → neutral. Their GPH is not written back (no `gph`, no
`legacyGph`: there is no UGF input that could use it), and **no compatible tanks are invented** — a
tampered `compatibleTanks` on a custom entry is dropped.

## 22. Stocking Load result

Identical for no filter, UGF on listed / unlisted presets, powered, sponge, UGF + powered / sponge /
powerhead / weak powered — 10 presets × 3 stocks (unit), every phase F browser test (`load` equals the
same stock with no filters), and 3,080 differential checks (0 mismatches on the branch, 0 between
trees). `capacityAdjustment` stays 0.

## 23. Non-UGF differential (step 49)

Node differential, clean `main` worktree vs branch, 10 presets × 4 stocks × 77 filter sets (none; each
of the 41 products; 2 × each sponge; 2 × Tetra / AC70 / Fluval 307 / EHEIM 2213; custom HOB 150 / HOB 1
/ canister / powerhead / old custom UGF; custom sponge 10 / 40 / 999; unrated legacy custom sponge;
mixes; everything; six UGF mixes) = 3,080 scenarios. Compared per scenario: full computed state direct,
written v2, pre-controller view after reload, state after controller restore. Phase F's additive
assessment fields (`passingPaths`, `tankId`, `hasUgf`, `ugf`) are removed before comparing.

| Class | Scenarios | Differences |
| --- | --- | --- |
| plans **without** a UGF | 2,720 | **0** |
| plans with a UGF | 360 | 360 (intended: no 150 GPH, no turnover, compatibility status, 20h / 40b no longer pass) |

Legacy fixtures × 4 presets: v1 sponges with fake GPH, phase A v2 sponges, HOB-900 sponge conflict, v1
custom sponges, v1 powered → **0 differences**; v1 UGF 150 and v2 UGF HOB-900 → differ (intended).
Loader: sorted order identical; every non-UGF loaded record identical; picker per preset identical for
every non-UGF product; UGF offered on main at 20h / 20l / 29g / 40b, on the branch at 20l / 29g.

The only other UGF-plan difference: the legacy `bioload.flowAdjustment` export estimate
(`compute.legacy calcTank` / `js/stocking.js` report object) no longer receives the UGF's 150 GPH.

## 24. Test results

| Suite | Result |
| --- | --- |
| `npm run test:unit` | **277 / 277** (245 on `main` + 32 new) |
| phase F unit (`filter-ugf-phase-f.test.mjs`) | 32 / 32 |
| phase B / C / D / E / saved-state / Tetra IQ 45 unit | all pass (26, 23, 22, 27, 21, 7) |
| phase F browser (`stocking-advisor-ugf-phase-f.spec.ts`, desktop + mobile) | 20 / 20 |
| Stocking gate (`CI=1`) | **199 passed, 0 failed, 27 skipped** (`main`: 179 / 0 / 27; +20 phase F runs) |
| `npm run test:stocking:extended` | 105 pairs, 0 failures (generated report not committed) |
| permanent live files, locally against the branch (`BASE_URL` = local static server) | `stocking-advisor-saved-filters.live.ts` 12 / 12, `stocking-advisor.live.ts` 5 / 5 |
| `guard:live`, `audit:controls` | pass |

A mutation check (compatibility ignoring the preset id) fails 9 phase F unit tests, including the 20h /
20l hard-blocker test.

Existing tests changed — current-behaviour assertions only; every historical fixture kept:

| File | Change |
| --- | --- |
| `filter-catalog-tetra-iq45.test.mjs` | fingerprint now excludes the UGF (32 records, identical on `main` and branch) |
| `filter-sponge-phase-b.test.mjs` | "UGF unchanged in phase B" → tank_compatibility, 0 GPH, adequate on 29; cache key v4; harness routes UGF products like the controller |
| `filter-sponge-phase-e.test.mjs` | current cache key v4 (stale fixtures still fed through the current key); UGF removed from the "powered records unchanged" table; picker never offers the UGF by gallons; "UGF unchanged in phase E" → phase F model; harness UGF routing |
| `filter-saved-state.test.mjs` | old custom UGF 150 → 0 GPH, not written back, compatibility unknown; loader metadata test excludes the UGF from "powered" |
| `filter-duplicates-phase-d.test.mjs` | two saved UGF copies still restore one; biological GPH 0 (was 150); harness UGF routing |
| `filter-sponge-phase-c.test.mjs` | harness UGF routing only |
| `stocking-advisor-sponge-phase-e.spec.ts` | current cache v4; test H: option / chip compatibility text, 0 GPH |
| `stocking-advisor-sponge-phase-c.spec.ts` | current cache key v4 |
| `stocking-advisor-duplicate-filters.spec.ts` | UGF GPH `[0,0,0]` (was 150) |
| `tests/live/stocking-advisor-saved-filters.live.ts` | deploy sentinel: `'ttg.gear.catalog.v4'` + `TANK_COMPATIBILITY` served; offline test clears v4 too |

New unit coverage (`filter-ugf-phase-f.test.mjs`, 32): preset ids; catalog record; loaded shape;
compatibleTanks sanitiser; compatibility text; v4 cache clean / v3 never written; old v3 ignored online
and offline; five stale UGF shapes through the current key; effectiveCapacityMethod; compute sanitizer
type-wins both ways; 20l / 29g pass; **20h vs 20l hard blocker**; all eight other presets; no gallons
arithmetic; generic 20 gal without id; five mixed setups; non-passing mixes; `adequateBy` /
`passingPaths`; picker; one-UGF; save / reload identity; 29 → 40b → 29; nine historical catalog shapes
(online, 40b, offline); four historical custom shapes × 3 presets; catalog type authority; Stocking Load
invariant; powered and sponge regressions.

New browser spec `tests/stocking-advisor-ugf-phase-f.spec.ts` (10 tests × desktop + mobile, in the gate
config): A 20 Long add + v2 identity + v4 cache; B 29 + reload; C 20 High not offered; C2 20 High seeded
UGF not listed; D–E 29 → 40b → 29 same instance; F v1 150; G HOB-900 conflict; H offline; I Tetra 215
beside a UGF; J second UGF blocked.

## 25. Permanent live-test recommendation (step 48)

**Recommended, not added.** The existing live suite covers powered, sponge, v1, offline-sponge and
duplicate paths, and — after this branch — asserts v4 is served, but nothing in it would catch the UGF
regressing to GPH scoring or 20h passing. Because the 20h / 20l distinction is the reason this model
exists, one permanent test is worthwhile:

> 29 gal: Penn-Plax UGF offered and added through the real picker; option / chip show "20 Long and 29 Gallon",
> no "150" / "GPH"; v2 entry `tank_compatibility` without `gph`; level adequate, "Undergravel filter
> rated for this tank", 0 GPH; reload keeps the instance; Stocking Load unchanged. Then 20 High: option
> absent, the saved UGF stays, level not evaluated.

It should be added in a follow-up after phase F is deployed (against today's production it fails by
design). **Run the live-verify workflow only after phase F is deployed**: the updated sentinel
(`'ttg.gear.catalog.v4'`, `TANK_COMPATIBILITY`) fails against phase E production by design.

## 26. Deferred phase G work

Not started. Phase G can render from `assessment.passingPaths`, `assessment.ugf` (per-entry
`compatibilityText`, `status`, `tankId`) and the existing warnings: the per-path lines ("Undergravel
filter: rated for 20 Long and 29 Gallon"), supplemental lines for a UGF next to another passing path, and the
design §12 UGF card. Also open, outside phase F: a verified manufacturer source for the Penn-Plax claim
(currently product title, grade C, as the design recorded), and the legacy type-multiplier
`flowAdjustment` export estimate (pre-existing for every type, including sponges).

## 27. Review follow-up: explicit compatibility wording

Review blocker: the first pass compressed presets that are neighbours in `TANK_SIZES` into a dash run,
so `["20l", "29g"]` displayed as **"20 Long–29 gal"** — which reads as a range and could be taken to
include 20 High. UGF compatibility is an explicit set of listed presets, not an interval.

New rule (`math.formatCompatibleTanks`): format the sanitised set literally, in preset order, one name
per preset — "20 Long", "20 High", "40 Breeder", otherwise "<gallons> Gallon" (from the preset label);
one → "A", two → "A and B", three or more → "A, B, and C". No dashes, no ranges, no adjacency logic,
nothing unlisted implied.

| Place | Before | After |
| --- | --- | --- |
| option | `<name> • Undergravel • 20 Long–29 gal` | `<name> • Undergravel • 20 Long and 29 Gallon` |
| chip | `Rated: 20 Long–29 gal` | `Rated: 20 Long and 29 Gallon` |
| passing note | `Rated for: 20 Long–29 gal tanks · Tank: 29 gal.` | `Rated for: 20 Long and 29 Gallon tanks · Tank: 29 gal.` |
| not-listed note | `… is rated for 20 Long–29 gal tanks, and this tank size isn't listed …` | `… is rated for 20 Long and 29 Gallon tanks, and this tank size isn't listed …` |

The catalog product name keeps the manufacturer's title ("for 20 (Long) - 29 Gallon Tanks"); only our
compatibility display changed. Summary text ("1 undergravel filter (rated for listed tanks)") had no
range and is unchanged. Display-only: no evaluation, picker, saved-state or calculation change (20l /
29g adequate, 20h and every other preset not evaluated, 0 GPH, Stocking Load unchanged). Tests assert
the exact strings, and that the compatibility text contains no "20 High" and no dash.

## Files changed

- `assets/data/gearCatalog.json` — UGF record: `gphRated` / `minGallons` / `maxGallons` removed; `capacityMethod`, `compatibleTanks` and review metadata added.
- `js/stocking-advisor/filtration/math.js` — UGF type / known-id list, preset ids, `sanitizeCompatibleTanks`, `formatCompatibleTanks`, `effectiveCapacityMethod` UGF rule, zero-flow UGF normalisation, `assessFiltration` `tankId` + UGF path, `passingPaths`, `ugf` output, UGF statuses.
- `js/stocking-advisor/filtration/ugf-items.js` (new) — UGF controller items, restore, chip / option text.
- `js/stocking-advisor/filtration/controller.js` — UGF item creation / restore, chip, summary, picker eligibility by preset id, add guard.
- `js/stocking-advisor/filtration/saved-state.js` — UGF entries identity-only `tank_compatibility`; known UGF id.
- `js/stocking-advisor/filtration/sponge-items.js` — `restoreKind` UGF kind; known ids before saved type.
- `js/gear-data.js` — cache key v4; UGF sanitising; `filterGearByTank` preset-id eligibility.
- `js/logic/compute.legacy.js` — UGF sanitising; `tankId` into `assessFiltration`; UGF warnings / status text.
- `data/stocking-advisor/FILTRATION_MODEL.md` — §2 input row, §6 UGF bullet.
- Tests: `tests/unit/filter-ugf-phase-f.test.mjs` (new), `tests/stocking-advisor-ugf-phase-f.spec.ts` (new), `playwright.stocking-gate.config.ts`, and the updates listed in section 24.
- `_internal/reports/stocking-advisor-sponge-migration-phase-f-2026-09.md` (this report).
