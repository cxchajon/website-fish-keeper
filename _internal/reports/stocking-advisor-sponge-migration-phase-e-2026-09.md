# Stocking Advisor — sponge migration phase E: remove legacy sponge flow + bucket data (2026-09)

Phase **E** of `stocking-advisor-sponge-filter-migration-design-2026-09.md` (section 15), complete
per the locked design row: (1) remove the obsolete sponge GPH and generic filter-sizing bucket
fields from the current catalog, (2) bump the catalog cache key (`ttg.gear.catalog.v2 → v3`),
(3) stop writing the v1 filter mirror after its grace period, and correct `FILTRATION_MODEL.md` §6.
Cleanup only — not a filtration-model change. Builds on phase A, B (`…-phase-b-2026-09.md`),
C (`…-phase-c-2026-09.md`) and D (`…-phase-d-2026-09.md`).

Base: `main` @ `91fa188` (phase D + permanent live tests). Branch:
`claude/stocking-advisor-sponge-phase-e-vuff26`.

A first pass (commit `b1c5574`) did (1) and the doc correction and deferred (2) and (3); review
reinstated them as locked phase E requirements, and the follow-up did both (sections 6a and 8).
This report describes the combined result.

Not changed: powered-filter calculations, sponge manufacturer-rating logic, duplicate-filter /
`instanceId` behaviour, v2 saved-state format, v1 **read** / migration, Stocking Load, species / water / compatibility / predation /
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
compatibility window is over. Phase E removes those values from the **current catalog data**, stops
the loader from emitting synthetic flow / bucket fields for sponges, starts a clean catalog cache
generation (v3), and retires the v1 filter mirror (design 8.3: "retire v1 writes" after one or two
releases), while keeping every protection that neutralises old fields when they arrive from **old
caches or old saved plans**, and keeping v1 **reads**.

## 2. Fields removed

### 2.1 Inventory (step 3)

For the seven ids (`aquaneat-sponge-10`, `-20`, `-60`, `hygger-double-sponge-s`, `-m`,
`pawfly-sponge-10`, `powkoo-dual-sponge-40`):

| Where | Field(s) | Class | Phase E |
| --- | --- | --- | --- |
| `assets/data/gearCatalog.json` | `manufacturerMinGallons`, `manufacturerMaxGallons`, `ratingStatus`, `capacityMethod` (+ review-only `ratingExpression`, `ratingEvidence`, `ratingSourceKind`, `ratingSource`, `productRef`, `ratingNote`, `ratingCheckedAt`) | **A. authoritative rating** | kept, unchanged |
| `assets/data/gearCatalog.json` | `gphRated`, `minGallons`, `maxGallons`, `legacyFieldsNote` | **B. obsolete compatibility** | **removed** |
| `js/gear-data.js sanitizeItem` output (memory catalog, cache — now `ttg.gear.catalog.v3`) | `gphRated` (legacy value, or a synthetic `0` for a GPH-less sponge), `rated_gph`, `minGallons` (default `0`), `maxGallons` (default `Infinity` → `null` in the cache JSON) | **B. obsolete (derived)** | **no longer emitted for SPONGE** |
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
  phase E (only the phase B / C reports' deferred lists mention dropping it). Decision:
  **intentionally retained**. It is not part of either phase E cleanup: it is not current catalog
  data, and it is not the v1 mirror — it lives inside **v2** entries of old custom sponges (written
  by the v1 / phase A migration) so the user's old number is not silently lost before they enter a
  rating; it is dropped as soon as they do. Retiring v1 *writes* does not touch it, and v1 *reads*
  still create it for a GPH-only custom sponge found in a historical v1 plan.

## 6. Current catalog cache behaviour (step 16)

`js/gear-data.js sanitizeItem` now builds a SPONGE entry as identity + rating metadata only. It no
longer emits the shared placeholder fields for sponges (`gphRated:0` / legacy value, `rated_gph`,
`minGallons:0`, `maxGallons:Infinity`, which serialised as `null` in the cache). Powered records are
built exactly as before (same fields, same defaults, same drop rule for a missing GPH). After a load,
`ttg.gear.catalog.v3` holds the seven sponges as e.g.
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

## 6a. Catalog cache key bumped: `ttg.gear.catalog.v2` → `ttg.gear.catalog.v3`

`js/gear-data.js`: `STORAGE_KEY = 'ttg.gear.catalog.v3'` (also exported as `CATALOG_CACHE_KEY` for
tests). The loader reads and writes only v3.

Why v2 is retired as the current cache: every v2 cache in a visitor's browser was written by the
phases B–D loader, so its sponge records physically carry `gphRated` / `rated_gph` / `minGallons` /
`maxGallons`. The phase E catalog is a new data generation; starting it on a new key means current
code never takes an old-generation cache for the phase E catalog, and the current cache begins clean
instead of relying on the first background refresh to overwrite it.

Behaviour:

| Situation | Result |
| --- | --- |
| Online, only an old v2 (and/or v1) cache | no cache served; the network catalog is used (`source: NETWORK`) and written to v3 clean; **v2 and v1 are neither read nor modified** (tabs still running older code keep their own key, the phase B precedent for v1) |
| Offline, only an old v2 (and/or v1) cache | catalog unavailable (no fallback to an older generation); saved sponges restore as **Rating needed**, 0 GPH, identity kept (phase C offline path); powered custom filters keep their stored GPH; no crash |
| v3 present | served first, refreshed in the background (unchanged cache logic) |
| An old-shaped record inside the cache the loader reads (damaged / tampered / historical fixture) | sanitised exactly as before (section 7): sponge flow / bucket fields dropped, known sponge ids typed SPONGE, no rating unless the record carries valid verified rating metadata |

The stale-record sanitiser is **not** relaxed: it still runs on every cached and network record, and
all historical stale-cache fixtures (phase C and phase E) are still exercised — they are now fed
through the key the loader reads (`CATALOG_CACHE_KEY`) instead of the retired v2 key, so they keep
testing the sanitiser rather than silently becoming "cache ignored" tests. Separate tests prove the
v2 key itself is ignored online and offline.

## 7. Stale-cache behaviour (step 15)

| Old-shaped record in the cache the loader reads (fixtures fed through `ttg.gear.catalog.v3`) | Result |
| --- | --- |
| Pre-phase-B shape: `{type:"SPONGE", gphRated, rated_gph, minGallons, maxGallons, capacityMethod:"flow"}`, no rating | legacy fields dropped on read; 0 GPH; **Rating needed** for all seven; the old `maxGallons` never becomes `manufacturerMaxGallons`; offered on every tank; `not-evaluated` on all 10 presets |
| Phase B–D shape (what `main`'s loader wrote): rating metadata **plus** `gphRated` / `rated_gph` / `minGallons` / `maxGallons` | legacy fields dropped on read; record identical to the current one; Hygger S rated / adequate on 29, 2 × Hygger S likely-multi on 55, AQUANEAT Middle not evaluated — all 0 GPH; background refresh replaces the cache with clean records |
| Damaged: a known sponge typed `HOB` with 900 GPH and a bucket | typed `SPONGE` (phase C), legacy fields dropped, 0 GPH |
| Junk values (`"huge"`, negative, `Infinity`, objects, `1e9`) | no crash; record kept; Rating needed; 0 GPH |
| `ttg.gear.catalog.v2` / `ttg.gear.catalog.v1` keys | never read or written (section 6a) |

Unit-tested (`filter-sponge-phase-e.test.mjs`, `filter-sponge-phase-c.test.mjs`) and browser-tested
(phase C spec stale / offline cache tests, phase E spec "old ttg.gear.catalog.v2 … is ignored").
Phase C's fake-GPH fixtures are unchanged; only the key they are seeded under moved to the current one.

**Old-JS window.** A tab still running pre-phase-B JavaScript with the new catalog would drop the
GPH-less sponge records from its picker (its loader required GPH). This is the window design 9.3 kept
the legacy GPH for; phases B, C and D have each shipped since, and `/js/*` and `/data/*` are
`must-revalidate`, so it is limited to tabs left open across four releases. Consequence is
conservative (sponges missing from an old picker, never scored).

## 8. Saved-state behaviour (step 13) and v1 mirror retirement

**v2 format unchanged.** A newly selected catalog sponge saves `{instanceId, source:"product",
productId, type:"SPONGE", capacityMethod:"manufacturer_rating"}` — no GPH, no bucket, no rating
(re-resolved from the catalog). Custom sponges unchanged (user rating stored). Powered entries
unchanged (`flow` + `gph`).

**v1 mirror retired.** The grace period of design 8.3 ("keep writing a v1 mirror … for one or two
releases … then retire v1 writes") is complete: phases B, C and D each shipped with the mirror. Both
writers (filtration controller `persistAppFilters`, `tankStore.saveFilterSnapshot`) go through
`saved-state.js writeSavedFilters`, which is the only place v1 was written; `toV1Mirror` is removed.

Write semantics (`writeSavedFilters`), chosen as the narrowest rule that never creates v1 data and
never lets a stale plan return:

| Call | v2 | v1 |
| --- | --- | --- |
| non-empty list | written (`{v:2, filters}`) | **not written**; an existing (historical) v1 key is **removed** after the v2 write succeeds — v2 now holds the plan, and a stale v1 must not come back if v2 is ever lost or corrupted |
| empty list (user removed every filter) | removed | **removed** — otherwise the v1 fallback would resurrect an old plan on the next load |
| v2 write throws (quota / private mode) | unchanged | **left alone** — nothing is lost; returns `false` |

Read semantics — unchanged: a well-formed v2 wins (v1 is not even read); if v2 is missing or
unreadable (`{oops`, `[]`, `v:1`, `v:3`, missing `filters`, a string), historical v1 is read and
migrated in memory with every phase B / C / D rule: known sponge ids ignore GPH (also when typed
`HOB`), fake sponge GPH never scores, catalog type authority, malformed entries fail closed, a
GPH-only custom sponge becomes Rating needed + `legacyGph`, repeated v1 ids become separate
instances. The migrated plan is written back as v2 only (and the v1 key removed) on the first save.

Consequence (accepted by the design): a tab still running pre-phase-A JavaScript (which reads only
v1) no longer sees plans saved by current code. That code predates four releases; `/js/*` is
`must-revalidate`.

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

Intentional differences from `main` (locked phase E): **A** current sponge catalog metadata cleanup;
**B** catalog cache `v2 → v3`; **C** current filter saves write v2 only (no v1 mirror; a historical
v1 key is removed on save). Everything else must be identical.

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
   after controller restore, plus the written v2 and v1 payloads. Result (after normalising randomly
   generated `instanceId`s): the **only** differing field is the written v1 payload — `main` wrote a
   v1 mirror in 2,006 scenarios, the branch in **0** (difference C). Computed state before and after
   restore, and the written **v2** payloads, are identical in all 2,858 (0 differences).
3. **UI differential** (Playwright, `main` and branch served side by side, 53 scenarios: picker on all
   10 presets; each of the 7 sponges and Tetra / AC70 / Fluval 307 / EHEIM 2213 on 10 / 29 / 55 gal;
   2 × Hygger S on 55 and 29; 2 × Middle; 2 × Middle + AC70; UGF; Tetra + sponge; custom sponge;
   custom HOB + Middle; seeded v1 fake-GPH plan; seeded HOB-900 conflict). Compared: every option's
   value / text / data attributes, chips and their aria labels, summary, flow meta, warnings (id,
   state, text), engine level / GPH / turnover / Stocking Load, calculator filters, saved v2 / v1,
   product note. **0 differences** (2 custom-filter scenarios differ only in the time-generated
   `manual-…` id). Run before the cache-key / v1 follow-up; the follow-up changes no UI, scoring or
   v2 code path, and the node differential above plus the full gate cover it. The catalog cache and
   v1 key are the intended differences (B, C).

Expected zero-difference areas all confirmed: Stocking Load, filtration scoring and status, powered
GPH, sponge ratings, verified / unrated / duplicate sponge results, powerheads, species, water,
predation, quantity-space, v2 saved state, v1 read / migration, phase C safety, phase D instances, UGF.

## 14. Test results (steps 24–27, 30)

| Suite | Result |
| --- | --- |
| `npm run test:unit` | **245 / 245** (217 on `main` + 28 net new) |
| saved-state / phase B / phase C / phase D unit | 21 / 21, 26 / 26, 23 / 23, 22 / 22 |
| phase E unit (`filter-sponge-phase-e.test.mjs`) | 27 / 27 |
| historical v1 migration tests (`--test-name-pattern=v1`, all unit files) | 35 / 35 |
| filtration model / Tetra IQ 45 / catalog batch 1 | 15 / 15, 7 / 7, 7 / 7 |
| Stocking gate (desktop + mobile, `CI=1`) | **179 passed, 0 failed, 27 skipped** (`main`: 165 / 0 / 27). Per spec: gate 95 (+27 skipped, the gate's own desktop/mobile splits), saved filters 16, phase B 16, phase C 16, phase D 22, phase E 14 |
| `npm run test:stocking:extended` | 105 pairs, 0 failures (generated report not committed) |
| Permanent live files, locally against the branch (`BASE_URL` = local static server) | `stocking-advisor-saved-filters.live.ts` 12 / 12, `stocking-advisor.live.ts` 5 / 5 |
| `guard:live`, `audit:controls` | pass |

Test changes to existing files — only assertions about **current** behaviour; historical inputs kept:

| File | Changed (current behaviour) | Kept (historical) |
| --- | --- | --- |
| `filter-sponge-phase-b.test.mjs` | catalog has no legacy fields; loader emits no synthetic fields; cache key v3; custom sponge save "no v1 written"; "v1 mirror" test → "v2 only" | stale type-wins entries, stale record |
| `filter-saved-state.test.mjs` | F: write-back is v2 only and removes v1; "v1 mirror" test → "no v1 mirror, clearing removes both"; new "clearing with a historical v1" test (incl. failed-write case) | v1 payload migration F, v2-wins G, malformed-v2 fallback, contradictory entries |
| `filter-sponge-phase-c.test.mjs` | mirror assertions → `[]`; "v1 mirror excludes every sponge" → "current saves write no v1 mirror" (+ historical v1 removed on save); stale-record fixtures seeded under `CATALOG_CACHE_KEY` | every fake-GPH fixture, v1 / phase A plans, conflicts A–D, offline cases, `ttg.gear.catalog.v1` never-read test |
| `filter-duplicates-phase-d.test.mjs` | serialize test: no `toV1Mirror`, v2 holds both instances, no v1; repeated-powered-v1 test: written back as two v2 instances, no v1 | repeated powered / sponge / damaged-manual v1 fixtures |
| `filter-sponge-phase-e.test.mjs` | cache key v3 | stale-record fixtures (pre-B, B–D, damaged, junk) |
| browser specs (saved filters, phase B, phase C, phase D, phase E) | "current save writes v1 mirror" → `v1` is `null`; phase C stale-cache seeds moved to v3 plus old v2 / v1 seeded and asserted untouched / unused | every seeded v1 plan and fake-GPH cache |

Fixture classification for sponge GPH (step 23): every fake sponge GPH in tests is **kept** because it
represents historical data; only the three assertions describing the current catalog / loader changed
(first pass). Helpers building powered items from `product.gphRated` route sponges separately.

New unit coverage (`filter-sponge-phase-e.test.mjs`, 27): current catalog has no legacy fields and
the safety list equals the catalog; exact rating metadata; powered + UGF records; exact loaded sponge
shape; **cache key v3: network writes v3, never v2, sponges clean, powered unchanged, re-read**;
**old v2 cache ignored online (network used, v2 untouched, v3 clean, a tampered v2 rating never
surfaces)**; **offline with only v2 / v1 caches: catalog unavailable, Rating needed, no GPH**;
stale-record sanitising (pre-B, B–D incl. background refresh, damaged HOB-900, junk); picker on 19
tank sizes; option / chip text; five unverified never score; save / reload of all seven; duplicates;
powered scoring; UGF; old saved GPH (v1 / phase A / conflict, online + offline); `legacyGph`
retained; **v1 retirement 1–4** (powered, sponge, duplicate powered, duplicate sponge → v2 only, every
instance, no v1; `toV1Mirror` gone); **5–7** (historical v1-only plan: powered, sponge with fake GPH,
repeated powered and sponge ids → separate instances, custom sponge Rating needed + `legacyGph`,
written back v2-only, next load reads v2); **8–9** (valid v2 wins over stale v1; missing / 6 kinds
of malformed v2 fall back to v1 with phase C rules); **10** (clearing removes v2 and v1, nothing
restores); Stocking Load invariant.

New browser spec `tests/stocking-advisor-sponge-phase-e.spec.ts` (7 tests × desktop + mobile = 14
runs, in the gate config): A–E all seven options on 5 / 10 / 29 / 55 / 75 / 125 gal with exact
labels, no GPH / bucket text or data attributes, clean v3 cache and no v2 written; each sponge's
chip, level, 0 GPH and identity-only v2; F 55 gal + 2 × Hygger S likely-multi; G Tetra IQ 45 label /
chip / 215 GPH, saved to v2 only; H UGF 150 GPH, 20–40 range, one per tank; an old v2 cache (legacy
fields + tampered rating) ignored, v3 written clean, v2 untouched; historical v1 plan migrated, then
every chip removed → v2 and v1 both gone, nothing returns after reload.

## 15. Live-test decision (step 29)

**No new live test.** The permanent suite already fails if legacy sponge GPH becomes visible or
scores (AQUANEAT 20 / Hygger S 29 & 55 / v1 plan / phase A plan / phase C offline / phase D
duplicates all assert 0 GPH, rating text, and no "80 / 120 GPH" text), and it already covers a seeded
historical v1 plan, current saves, the phase C offline path and phase D duplicates.

Existing assertions updated to the phase E contract:

- `catalog sponge needing review (AQUANEAT 20)`: record has no `gphRated` / `rated_gph` /
  `minGallons` / `maxGallons` (see below).
- Current-write v1 assertions → `v1` is `null`: Tetra IQ 45 save; existing v1 plan (still seeded as
  historical v1 and restored by rating — now also asserts the historical v1 key is gone after the
  v2 write-back); unsupported-`capacityMethod` v2 entry. Seven other tests already asserted
  `v1 === null` (sponge-only saves) and are unchanged.
- Phase C offline test: also clears `ttg.gear.catalog.v3` and asserts no v3 cache is written.
- The deployment sentinel request test now also asserts `saved-state.js` no longer contains
  `toV1Mirror` and `gear-data.js` serves `'ttg.gear.catalog.v3'`.

The AQUANEAT 20 change in detail: `catalog sponge needing review (AQUANEAT 20)` asserted
the production record still had `gphRated: 120`. It now asserts the record has none of `gphRated`,
`rated_gph`, `minGallons`, `maxGallons` (review-only max 20 still asserted). Without this edit the
permanent suite would go red as soon as phase E deploys; with it, the suite also guards against the
legacy field returning to production data. Locally: passes on the branch, fails on `main` at that
assertion (`gphRated` = 120). **Run the live-verify workflow only after phase E is deployed** —
against today's production (no phase E yet) the updated assertions (catalog record, v1 `null`
after current saves, v3 sentinel) fail by design.

## 16. Design alignment and remaining out-of-scope items

Design section 15, row E — all items done: remove `gphRated` and GPH-bucket `minGallons` /
`maxGallons` from the air-driven records (the seven sponges; the UGF is phase F by decision), bump
the catalog cache key (v3), stop v1 mirror writes after the grace period, correct
`FILTRATION_MODEL.md` §6.

Not part of phase E:

- **`legacyGph`**: intentionally retained (section 5).
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
- `js/gear-data.js` — `sanitizeItem` emits no flow / bucket fields for a SPONGE (drops them from old caches); sponge sort key = manufacturer max (keeps the previous order); cache key `ttg.gear.catalog.v3` (exported as `CATALOG_CACHE_KEY`).
- `js/stocking-advisor/filtration/saved-state.js` — `writeSavedFilters` writes v2 only, removes a historical v1 on save and on clear; `toV1Mirror` removed; v1 read / migration unchanged; header comment.
- `js/stocking-advisor/filtration/controller.js`, `js/stocking/tankStore.js` — comments only.
- `data/stocking-advisor/FILTRATION_MODEL.md` — §6 sponge-GPH bullet corrected.
- `tests/unit/filter-sponge-phase-e.test.mjs` (new), `tests/stocking-advisor-sponge-phase-e.spec.ts` (new), `playwright.stocking-gate.config.ts` (runs the new spec).
- `tests/unit/filter-sponge-phase-b.test.mjs`, `filter-saved-state.test.mjs`, `filter-sponge-phase-c.test.mjs`, `filter-duplicates-phase-d.test.mjs` — current-behaviour assertions updated (section 14).
- `tests/stocking-advisor-saved-filters.spec.ts`, `-sponge-phase-b.spec.ts`, `-sponge-phase-c.spec.ts`, `-duplicate-filters.spec.ts` — current-write v1 assertions; phase C stale-cache seeds.
- `tests/live/stocking-advisor-saved-filters.live.ts` — phase E contract (section 15).
- `_internal/reports/stocking-advisor-sponge-migration-phase-e-2026-09.md` (this report).
