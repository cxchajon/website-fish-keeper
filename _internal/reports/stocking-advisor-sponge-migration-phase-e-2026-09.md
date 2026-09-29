# Stocking Advisor — sponge migration phase E: remove legacy sponge flow + bucket data (2026-09)

Phase **E** of `stocking-advisor-sponge-filter-migration-design-2026-09.md` (section 15): remove the
obsolete sponge GPH and generic filter-sizing bucket fields that the rating-based sponge model no
longer uses. Cleanup only — not a filtration-model change. Builds on phase A, B (`…-phase-b-2026-09.md`),
C (`…-phase-c-2026-09.md`) and D (`…-phase-d-2026-09.md`).

Base: `main` @ `91fa188` (phase D + permanent live tests). Branch:
`claude/stocking-advisor-sponge-phase-e-vuff26`.

Not changed: powered-filter calculations, sponge manufacturer-rating logic, duplicate-filter /
`instanceId` behaviour, Stocking Load, species / water / compatibility / predation /
quantity-space rules, the UGF record and behaviour, `MIN_BIOLOGICAL_TURNOVER` (2×). Phases F and G
not started.

### Baseline on `main` (step 1, before editing)

Confirmed on `main` @ `91fa188`: rating-based sponge model (`math.assessFiltration`,
`resolveSpongeRating`), catalog-type authority and `KNOWN_SPONGE_PRODUCT_IDS` (phase C), stale-cache
hardening (`gear-data.js sanitizeItem`, `compute.legacy.js sanitizeFilter`, `saved-state.js buildEntry`),
duplicate filter instances (`instances.js`, phase D), permanent live tests for phases B / C / D in
`tests/live/stocking-advisor-saved-filters.live.ts`.

| Suite | Baseline (`main`) |
| --- | --- |
| `npm run test:unit` | 217 / 217 |
| Stocking gate `npm run test:e2e:stocking-gate` (desktop + mobile, `CI=1`, clean `main` worktree) | 165 passed, 0 failed, 27 skipped |
| `npm run test:stocking:extended` | 105 pairs, 0 failures |

---

## 1. Purpose

Phase B kept each sponge record's pre-phase-B `gphRated` and GPH-bucket `minGallons` / `maxGallons`
as compatibility baggage for older cached scripts (design 9.3 item 2: "keep legacy `gphRated` in the
data until phase E, at least one release after phase B"). Phases B, C and D are live, so the
compatibility window is over. Phase E removes those values from the **current catalog data** and
stops the loader from emitting synthetic flow / bucket fields for sponges, while keeping every
protection that neutralises the same fields when they arrive from **old caches or old saved plans**.

## 2. Fields removed

### 2.1 Inventory (step 3)

For the seven ids (`aquaneat-sponge-10`, `-20`, `-60`, `hygger-double-sponge-s`, `-m`,
`pawfly-sponge-10`, `powkoo-dual-sponge-40`):

| Where | Field(s) | Class | Phase E |
| --- | --- | --- | --- |
| `assets/data/gearCatalog.json` | `manufacturerMinGallons`, `manufacturerMaxGallons`, `ratingStatus`, `capacityMethod` (+ review-only `ratingExpression`, `ratingEvidence`, `ratingSourceKind`, `ratingSource`, `productRef`, `ratingNote`, `ratingCheckedAt`) | **A. authoritative rating** | kept, unchanged |
| `assets/data/gearCatalog.json` | `gphRated`, `minGallons`, `maxGallons`, `legacyFieldsNote` | **B. obsolete compatibility** | **removed** |
| `js/gear-data.js sanitizeItem` output (memory catalog, `ttg.gear.catalog.v2`) | `gphRated` (legacy value, or a synthetic `0` for a GPH-less sponge), `rated_gph`, `minGallons` (default `0`), `maxGallons` (default `Infinity` → `null` in the cache JSON) | **B. obsolete (derived)** | **no longer emitted for SPONGE** |
| `js/stocking-advisor/filtration/math.js` | `KNOWN_SPONGE_PRODUCT_IDS` | phase C safety list (identity only) | kept |
| `data/filters.json`, `tools/build_filter_catalog.py` | `rated_gph`, old names | non-runtime audit / prototype data (read only by `scripts/*audit*` and `extract-gear-filters.mjs`, never by the advisor or gear page) | out of scope (phase B §20 gear-page content pass) |
| tests (section 14) | `gphRated`, `rated_gph`, `ratedGph`, `gph`, `minGallons`, `maxGallons` | **C. historical fixtures** (v1, phase A v2, stale cache, contradictory saved state, offline, old custom sponge) | kept |
| tests: phase B catalog-metadata test, phase B loader test, live AQUANEAT 20 test | "legacy GPH kept" / `gphRated: 0` / `gphRated: 120` | describe the **current** catalog / loader | updated |

No other runtime file (HTML, `assets/js/*`, `js/*`) contains any of the seven ids.

### 2.2 Removed from `gearCatalog.json`

28 key removals, 4 per sponge record: `gphRated`, `minGallons`, `maxGallons`, `legacyFieldsNote` (the
note described only the three removed fields and said "removal is phase E"). No value was replaced
with `0`; the fields are gone. The 34 non-sponge records are byte-identical (existing fingerprint
test in `filter-catalog-tetra-iq45.test.mjs` passes).

## 3. The seven catalog records before / after

Rating fields are unchanged for every record. "Legacy" = `gphRated` / `minGallons` / `maxGallons`.

| id | Legacy before | Legacy after | min | max | ratingStatus | expression | Runtime result (unchanged) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `aquaneat-sponge-10` (AQUANEAT Single) | 60 / 0 / 20 | — | null | null | needed | unclear | Rating needed |
| `aquaneat-sponge-20` (AQUANEAT Middle) | 120 / 0 / 20 | — | null | 20 (review only) | needs_review | up_to | Rating needed; cannot score |
| `aquaneat-sponge-60` (AQUANEAT Large) | 200 / 20 / 40 | — | 40 | 60 (review only) | needs_review | range | Rating needed; cannot score |
| `hygger-double-sponge-s` | 80 / 0 / 20 | — | 10 | 40 | verified | range | Rated 10–40 gal |
| `hygger-double-sponge-m` | 120 / 0 / 20 | — | 15 | 55 | verified | range | Rated 15–55 gal |
| `pawfly-sponge-10` | 60 / 0 / 20 | — | null | null | needed | unclear | Rating needed |
| `powkoo-dual-sponge-40` | 150 / 20 / 40 | — | null | null | needed | unclear | Rating needed |

Loaded (sanitised) record after phase E, e.g. Hygger S:
`{id, brand, name, type:"SPONGE", capacityMethod:"manufacturer_rating", manufacturerMaxGallons:40,
manufacturerMinGallons:10, ratingStatus:"verified"}` — no `gphRated`, `rated_gph`, `minGallons`,
`maxGallons`. (Before: the same plus `gphRated:80, rated_gph:80, minGallons:0, maxGallons:20`.)

## 4. Why the manufacturer rating fields remain

They are the sponge model (design D1–D3, locked): `ratingStatus === "verified"` with a positive
`manufacturerMaxGallons` is the only way a sponge can be green; `manufacturerMinGallons` is
display-only; `needs_review` / `needed` records are Rating needed. The review-only 20 (Middle) and
40–60 (Large) stay stored as review metadata exactly as phase B locked them and still never score
(unit + browser tested).

## 5. Why migration support for old GPH remains (step 11)

Historical saved plans and caches can still hold fake sponge GPH, so none of the phase B / C
protections was removed:

- `math.js` type-wins (`effectiveCapacityMethod`, `normalizeFilter`), `compute.legacy.js sanitizeFilter`,
  `saved-state.js buildEntry` / v1 migration, `sponge-items.js restoreKind` / `restoreSpongeItem`:
  unchanged. They still recognise and neutralise `gph`, `rated_gph`, `ratedGph`, `gphRated` and
  `capacityMethod:"flow"` on a SPONGE.
- **`KNOWN_SPONGE_PRODUCT_IDS` kept (step 12).** Its purpose is a contradictory / offline saved plan
  when the catalog cannot resolve (phase C H1); a clean catalog doesn't change that. The unit test
  tying it to the catalog's SPONGE ids still passes.
- **`legacyGph` kept (step 14).** Distinct from catalog GPH: it is migration-only metadata on an old
  user-created custom sponge that had only a GPH, never scored, never shown (phase B §10). The design
  (section 8.2) keeps it "for one migration cycle", and section 15 does **not** list its removal under
  phase E (only the phase B / C reports' deferred lists mention dropping it). One release after phase
  B is too early to call the cycle complete, and removing it would change saved-state output, which
  this phase must not do. Decision: **preserved**; revisit with the v1-mirror retirement (section 16).

## 6. Current catalog cache behaviour (step 16)

`js/gear-data.js sanitizeItem` now builds a SPONGE entry as identity + rating metadata only. It no
longer emits the shared placeholder fields for sponges (`gphRated:0` / legacy value, `rated_gph`,
`minGallons:0`, `maxGallons:Infinity`, which serialised as `null` in the cache). Powered records are
built exactly as before (same fields, same defaults, same drop rule for a missing GPH). After a load,
`ttg.gear.catalog.v2` holds the seven sponges as e.g.
`{"id":"hygger-double-sponge-s","brand":"Hygger","name":"…","type":"SPONGE","capacityMethod":"manufacturer_rating","manufacturerMaxGallons":40,"manufacturerMinGallons":10,"ratingStatus":"verified"}`.

Why removing the placeholders is safe — every reader of a sanitised catalog record was checked:

| Reader | Sponge handling |
| --- | --- |
| controller `formatProductOption`, `renderProductOptions` `mapOption` | sponge branch returns first (rating text, `data-filter-type` + `data-rating-status` only) |
| controller `createProductFilter` → `sponge-items.buildSpongeProductItem` | reads rating fields only; `gph: 0` |
| `gear-data.filterGearByTank` | sponge → always offered, before min/max are read |
| `gear-data` sort | see below |
| `stocking.js setFilterCatalogData` (legacy picker) | drops `rated_gph ≤ 0`, so sponges leave that list. The legacy picker is disabled while the filtration controller owns filters (`window.disableLegacyFilterRows`, set when `controller.js` loads, before the async catalog resolves); its only pre-catalog call shows "Loading…". No reachable behaviour change. |
| gear page `assets/js/gear.v2.js` `?filter=<id>` | `rated_gph` absent → `ttg:rated_gph` session key removed instead of set to the legacy value. That key has no reader (phase B §20). |

**Sort order.** The catalog sort was type → brand → `gphRated` → name, so the legacy sponge GPH
decided the order inside AQUANEAT (60 / 120 / 200) and hygger (80 / 120). Without it, name order would
have changed the picker. Sponges are now ordered by `manufacturerMaxGallons` (null → 0) inside a
brand, which reproduces the previous order exactly (AQUANEAT Single, Middle, Large; hygger S, M).
This only orders the picker and never feeds scoring. Powered filters still sort by GPH.

**Cache key not bumped.** The design's "bump the catalog cache key" item was done in phase B
(`v1 → v2`). A second bump is not needed: an old v2 cache is sanitised on read (section 7) and
rewritten with clean records by the background refresh on the same page load, and a bump would only
orphan another key in visitors' storage.

## 7. Stale-cache behaviour (step 15)

| Old cache content (`ttg.gear.catalog.v2`) | Result |
| --- | --- |
| Pre-phase-B shape: `{type:"SPONGE", gphRated, rated_gph, minGallons, maxGallons, capacityMethod:"flow"}`, no rating | legacy fields dropped on read; 0 GPH; **Rating needed** for all seven; the old `maxGallons` never becomes `manufacturerMaxGallons`; offered on every tank; `not-evaluated` on all 10 presets |
| Phase B–D shape (what `main`'s loader wrote): rating metadata **plus** `gphRated` / `rated_gph` / `minGallons` / `maxGallons` | legacy fields dropped on read; record identical to the current one; Hygger S rated / adequate on 29, 2 × Hygger S likely-multi on 55, AQUANEAT Middle not evaluated — all 0 GPH; background refresh replaces the cache with clean records |
| Damaged: a known sponge typed `HOB` with 900 GPH and a bucket | typed `SPONGE` (phase C), legacy fields dropped, 0 GPH |
| Junk values (`"huge"`, negative, `Infinity`, objects, `1e9`) | no crash; record kept; Rating needed; 0 GPH |
| `ttg.gear.catalog.v1` | still never read (phase C) |

Unit-tested (`filter-sponge-phase-e.test.mjs`) and browser-tested (phase E spec, "old
ttg.gear.catalog.v2 …"). Phase C's stale-cache tests (which keep their fake-GPH fixtures) pass unchanged.

**Old-JS window.** A tab still running pre-phase-B JavaScript with the new catalog would drop the
GPH-less sponge records from its picker (its loader required GPH). This is the window design 9.3 kept
the legacy GPH for; phases B, C and D have each shipped since, and `/js/*` and `/data/*` are
`must-revalidate`, so it is limited to tabs left open across four releases. Consequence is
conservative (sponges missing from an old picker, never scored).

## 8. Saved-state behaviour (step 13)

Unchanged. A newly selected catalog sponge saves `{instanceId, source:"product", productId,
type:"SPONGE", capacityMethod:"manufacturer_rating"}` — no GPH, no bucket, no rating (re-resolved from
the catalog). Unit test: all seven written and re-read, exact key set, same instanceIds, rating
badges from the catalog. Custom sponges unchanged (user rating stored). The v1 mirror still holds
flow-method entries only.

## 9. Powered-filter regression (step 17)

| Product | Catalog | Loaded | Picker label | Scoring |
| --- | --- | --- | --- | --- |
| Tetra Whisper IQ 45 | HOB 215 GPH, 40–75 | unchanged | `… • 215 GPH • HOB • 40g–75g` (browser) | 215 GPH on every preset; chip "215 GPH"; adequate on 55 |
| AquaClear 70 | HOB 300, 40–70 | unchanged | unchanged | 300 GPH |
| Fluval 307 | CANISTER 303, 40–70 | unchanged | unchanged | 303 GPH |
| EHEIM 2213 | CANISTER 116, 21–66 | unchanged | unchanged | 116 GPH |

Powered picker eligibility per tank (10 presets + 1 / 2.5 / 3 / 12 / 33 / 90 / 150 / 300 / 999 gal)
equals the min/max rule exactly; the loader's powered output is identical to `main` (diffed).

## 10. UGF deferral (step 18)

`penn-plax-ugf-20-29` is untouched: `type:"UGF"`, `gphRated:150`, `minGallons:20`, `maxGallons:40`,
flow-scored at 150 GPH, offered on 20–40 gal presets only, chip "150 GPH", **one plate set per tank**
(Add disabled, "one plate set per tank" note; unit + browser). Cleanup is phase F.

## 11. Duplicate-filter regression (step 19)

| Scenario | Result |
| --- | --- |
| 55 gal + 2 × Hygger S | two instances (distinct instanceIds, same productId), both "Rated 10–40 gal", 0 GPH, **Likely adequate — multiple sponge filters** |
| 29 gal + 2 × Hygger S | **Rated for this tank**, 0 GPH |
| 2 × AQUANEAT Middle (step 20) | both selectable, both "Rating needed", 0 GPH, **Not evaluated** on 5–125 gal; + AquaClear 70 → adequate by powered; review-only 20 never scores |

All 22 phase D unit tests and 22 phase D browser runs pass unchanged.

## 12. Stocking Load (step 21)

Identical for A no filter, B verified sponge, C 2 × verified sponge, D unrated sponge, E powered
filter (Tetra) — 10 tank presets × 3 stocks (unit; each stock asserted non-zero) and in every phase E
browser test (`load` equals the same stock with no filters). `capacityAdjustment` stays 0.

## 13. Differential results (step 28)

1. **Loader differential** (node, `main` worktree vs branch): sorted catalog order identical; picker
   ids identical on 3 / 5 / 10 / 15 / 20 / 29 / 40 / 55 / 75 / 125 gal; the only field differences are
   `gphRated`, `rated_gph`, `minGallons`, `maxGallons` on the seven sponges (intended).
2. **Compute + saved-state differential** (node, both trees): 10 presets × 4 stocks (empty; community;
   angelfish + neon + betta; pea puffer + amano) × 71 filter sets (none; each of the 41 catalog
   products; 2 × each sponge; 2 × Tetra / AC70 / Fluval 307 / EHEIM 2213; custom HOB / 1-GPH HOB /
   canister / powerhead / UGF; custom sponge 10 / 40 / 999; unrated legacy custom sponge; hygger S + M;
   Tetra + sponge + powerhead; weak HOB + verified / unrated sponge; powerhead + sponge; AC70 + F307 +
   E2213; 2 × Middle + AC70; all sponges; everything) = 2,840 scenarios, plus 6 legacy fixtures × 3
   tanks (v1 sponges with fake GPH, phase A v2 sponges, HOB-900 conflict, v1 custom sponges, v1
   powered, UGF) = **2,858 scenarios**. Compared: full computed state (filtration, Stocking Load,
   species, conditions, water, warnings) directly, after save → read in the pre-controller view and
   after controller restore, plus the written v2 and v1 payloads. **0 differences** (9 v1-migration
   scenarios differ only in randomly generated `instanceId`s; identical after normalising them).
3. **UI differential** (Playwright, `main` and branch served side by side, 53 scenarios: picker on all
   10 presets; each of the 7 sponges and Tetra / AC70 / Fluval 307 / EHEIM 2213 on 10 / 29 / 55 gal;
   2 × Hygger S on 55 and 29; 2 × Middle; 2 × Middle + AC70; UGF; Tetra + sponge; custom sponge;
   custom HOB + Middle; seeded v1 fake-GPH plan; seeded HOB-900 conflict). Compared: every option's
   value / text / data attributes, chips and their aria labels, summary, flow meta, warnings (id,
   state, text), engine level / GPH / turnover / Stocking Load, calculator filters, saved v2 / v1,
   product note. **0 differences** (2 custom-filter scenarios differ only in the time-generated
   `manual-…` id). The catalog cache was excluded: it is the intended difference.

Expected zero-difference areas all confirmed: Stocking Load, filtration status, verified / unrated /
duplicate sponge results, powered filters, powerheads, species, water, predation, quantity-space,
saved state, phase C restoration.

## 14. Test results (steps 24–27, 30)

| Suite | Result |
| --- | --- |
| `npm run test:unit` | **238 / 238** (217 existing + 21 new in `tests/unit/filter-sponge-phase-e.test.mjs`) |
| saved-state / phase B / phase C / phase D unit | 20 / 20, 26 / 26, 23 / 23, 22 / 22 |
| phase E unit | 21 / 21 (7 fail on `main`: the catalog / loader / cache contract; the 14 behaviour guards pass on both) |
| filtration model / Tetra IQ 45 / catalog batch 1 | 15 / 15, 7 / 7, 7 / 7 |
| Stocking gate (desktop + mobile, `CI=1`) | **177 passed, 0 failed, 27 skipped** (165 baseline + 12 new). Per spec: gate 95 (+27 skipped, the gate's own desktop/mobile splits), saved filters 16, phase B 16, phase C 16, phase D 22, phase E 12 |
| `npm run test:stocking:extended` | 105 pairs, 0 failures (generated report not committed) |
| Permanent live files, locally against the branch (`BASE_URL` = local static server) | `stocking-advisor-saved-filters.live.ts` 12 / 12, `stocking-advisor.live.ts` 5 / 5 |
| `guard:live`, `audit:controls` | pass |

Test changes to existing files (current-catalog assertions only):

- `filter-sponge-phase-b.test.mjs` — the catalog-metadata test asserted "legacy GPH kept"; it now
  asserts the seven records carry no `gphRated` / `rated_gph` / `ratedGph` / `gph` / `minGallons` /
  `maxGallons` / `legacyFieldsNote`. The loader test asserted `gphRated === 0` for a GPH-less sponge;
  it now asserts no synthetic flow / bucket fields.
- Fixture classification (step 23): every other fake sponge GPH in tests is **kept** because it
  represents historical data — phase B stale type-wins entries and stale record; phase C
  `OLD_SPONGE_RECORD`, stale v2 cache, damaged cache, v1 / phase A plans, conflicts, old custom sponges;
  phase C browser `STALE_CATALOG`; saved-state contradictory entry; the phase B / D browser negative
  assertions (`LEGACY_SPONGE_GPH` must not appear). Helpers building powered items from
  `product.gphRated` already route sponges through `buildSpongeProductItem`.

New unit coverage (`filter-sponge-phase-e.test.mjs`): current catalog has no legacy fields and the
safety list equals the catalog; exact rating metadata; powered + UGF records and loaded values; exact
loaded sponge shape; cache written / re-read clean; picker order preserved; stale pre-B cache; stale
B–D cache (as `main` wrote it) incl. background refresh; damaged HOB-900 cache; junk values; picker on
19 tank sizes; option / chip text; five unverified never score; save / reload of all seven; 2 × Hygger
S (55 / 29) with instanceIds; 2 × Middle; powered scoring; UGF; v1 / phase A / conflict saved GPH
(7 ids × 5 GPH values, online + offline); `legacyGph` preserved; Stocking Load invariant.

New browser spec `tests/stocking-advisor-sponge-phase-e.spec.ts` (6 tests × desktop + mobile = 12
runs, in the gate config): A–E all seven options on 5 / 10 / 29 / 55 / 75 / 125 gal with exact
labels (`Sponge • Rated 10–40 gal`, `Sponge • Rated 15–55 gal`, `Sponge • Rating needed`), no GPH /
bucket text or data attributes, clean `ttg.gear.catalog.v2`; each sponge's chip, level, 0 GPH and
identity-only v2; F 55 gal + 2 × Hygger S likely-multi; G Tetra IQ 45 label / chip / 215 GPH / v1
mirror; H UGF 150 GPH, 20–40 range, one per tank; old v2 cache with legacy fields harmless and
replaced. Against `main`'s JS the two storage-contract tests fail and the four UI tests pass.

## 15. Live-test decision (step 29)

**No new live test.** The permanent suite already fails if legacy sponge GPH becomes visible or
scores (AQUANEAT 20 / Hygger S 29 & 55 / v1 plan / phase A plan / phase C offline / phase D
duplicates all assert 0 GPH, rating text, and no "80 / 120 GPH" text).

**One existing live assertion had to change**: `catalog sponge needing review (AQUANEAT 20)` asserted
the production record still had `gphRated: 120`. It now asserts the record has none of `gphRated`,
`rated_gph`, `minGallons`, `maxGallons` (review-only max 20 still asserted). Without this edit the
permanent suite would go red as soon as phase E deploys; with it, the suite also guards against the
legacy field returning to production data. Locally: passes on the branch, fails on `main` at that
assertion (`gphRated` = 120). **Run the live-verify workflow only after phase E is deployed** —
against today's production (no phase E yet) this one assertion fails by design.

## 16. Deferred (phase E design items not done here, and phases F / G)

- **Stop v1 mirror writes** (design 8.3 / section 15 row E, "after grace period"): deferred. It is a
  saved-state behaviour change (old tabs would lose powered filters), and this phase required zero
  saved-state differences. Suggested as its own small change; retire `legacyGph` at the same time.
- **`legacyGph`**: kept (section 5).
- `data/filters.json`, `tools/build_filter_catalog.py`, `data/gear_filters_ranges.csv`,
  `assets/data/gear/filters.json`: non-runtime gear / audit data with old sponge names and GPH; gear-page
  content pass (phase B §20).
- `stocking-tests-extended` "24g sponge pair" (110 GPH) is a generic tank-flow fixture in the extended
  runner, not catalog data; untouched.
- **Phase F** (UGF model: `compatibleTanks`, remove its 150 GPH) and **phase G** (filtration-status
  card): not started.
- Pre-existing: product-note start-up race; `npm run lint:css` errors on `main` (no CSS changed).

## User-facing copy (step 22)

Searched the advisor page, tooltips, controller, compute warnings and the filtration model doc for
sponge GPH / turnover / bucket wording. Advisor copy is already consistent with phase B (powered →
GPH / turnover; sponge → manufacturer tank rating; powerheads → circulation). One clear phase E
leftover fixed: `data/stocking-advisor/FILTRATION_MODEL.md` §6 said "Sponge-filter GPH figures in the
catalog (60–200) are tank-size marketing"; it now says those figures were removed in phase E and
sponges are checked by their manufacturer rating (the correction design section 15 assigns to phase E).

## Files changed

- `assets/data/gearCatalog.json` — seven sponge records: `gphRated`, `minGallons`, `maxGallons`, `legacyFieldsNote` removed.
- `js/gear-data.js` — `sanitizeItem` emits no flow / bucket fields for a SPONGE (drops them from old caches); sponge sort key = manufacturer max (keeps the previous order); comments.
- `js/stocking-advisor/filtration/saved-state.js` — comment only (v1 mirror retirement deferred).
- `data/stocking-advisor/FILTRATION_MODEL.md` — §6 sponge-GPH bullet corrected.
- `tests/unit/filter-sponge-phase-e.test.mjs` (new), `tests/stocking-advisor-sponge-phase-e.spec.ts` (new), `playwright.stocking-gate.config.ts` (runs the new spec).
- `tests/unit/filter-sponge-phase-b.test.mjs` — two current-catalog / loader assertions updated.
- `tests/live/stocking-advisor-saved-filters.live.ts` — AQUANEAT 20 record assertion updated (section 15).
- `_internal/reports/stocking-advisor-sponge-migration-phase-e-2026-09.md` (this report).
