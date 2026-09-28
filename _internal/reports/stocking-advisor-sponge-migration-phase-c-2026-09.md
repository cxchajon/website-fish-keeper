# Stocking Advisor — sponge migration phase C: stale-cache + legacy migration validation (2026-09)

Phase **C** of `stocking-advisor-sponge-filter-migration-design-2026-09.md` (section 15): prove that
old saved, cached or contradictory filter data cannot resurrect the retired sponge-GPH model. Builds
on phase A (`…-phase-a-2026-09.md`), phase B0 (`…-sponge-rating-verification-2026-09.md`) and phase B
(`…-phase-b-2026-09.md`).

Base: `main` @ `9af3166` (phase B + permanent phase B live tests). Branch:
`claude/stocking-sponge-phase-c-2z62yb`.

Not done (out of scope): duplicate filters (D), removing legacy sponge `gphRated` / `minGallons` /
`maxGallons` from `gearCatalog.json` (E), UGF model (F), filtration-status card (G). The 2× powered
threshold and Stocking Load are untouched.

---

## 1. Purpose and invariant

**NO historical or stale sponge GPH may ever become trusted filtration flow again.**

For canonical type `SPONGE`, none of `gph`, `rated_gph`, `ratedGph`, `gphRated` or an old
`capacityMethod: "flow"` may produce biological GPH, total filter GPH, turnover, an adequate result or
a green filtration status. The only safe outcomes are the manufacturer-rating model (a **verified**
rating from the current catalog or entered by the user) or **Rating needed**.

### Baseline on `main` (step 1, before editing)

Confirmed on `main` @ `9af3166`: phase B production code; permanent phase B live tests
(`tests/live/stocking-advisor-saved-filters.live.ts`); `ttg.stocking.filters.v2`;
`ttg.gear.catalog.v2`; rating-based sponge evaluation (`math.assessFiltration`,
`resolveSpongeRating`); legacy sponge GPH retained in `gearCatalog.json` only as compatibility data.

| Suite | Baseline |
| --- | --- |
| `npm run test:unit` | 172 / 172 |
| saved-filter unit (`filter-saved-state`) / phase B unit (`filter-sponge-phase-b`) | 20 / 20, 26 / 26 (inside the 172) |
| Stocking gate `npm run test:e2e:stocking-gate` (desktop + mobile; includes saved-filters and phase B specs) | 127 passed, 0 failed, 27 skipped |
| `npm run test:stocking:extended` | 105 pairs, 0 failures |

## 2. Legacy data inventory (step 3)

Every way old filter data can enter the current app:

| # | Entry point | Where | Current handling |
| --- | --- | --- | --- |
| 1 | `ttg.stocking.filters.v1` (bare array `{id, type, rated_gph}`) | `saved-state.js` `readV1` → `migrateV1Entry` → `buildEntry` | read **only** when v2 is absent or unreadable; sponge → `manufacturer_rating`, no `gph` |
| 2 | `ttg.stocking.filters.v2` (`{v:2, filters}`) | `saved-state.js` `readV2` → `parseV2Entry` → `buildEntry` | authoritative; per-entry parsing; bad entries dropped individually |
| 3 | Old phase A v2 entries (sponge with `capacityMethod:"flow"`, `gph`) | same as 2 | type wins → identity-only catalog sponge / Rating-needed custom sponge |
| 4 | Current phase B v2 entries | same as 2 | unchanged |
| 5 | `ttg.gear.catalog.v1` | **not read** by current code (key is `ttg.gear.catalog.v2`, `gear-data.js`) | old tabs keep their own v1 cache; new code never falls back to it |
| 6 | `ttg.gear.catalog.v2` (cached catalog) | `gear-data.js` `readCachedCatalog` → `sanitizeItem`; served first for the page load, refreshed in the background | stale sponge record → Rating needed (no rating fields), never GPH |
| 7 | Network catalog (`/assets/data/gearCatalog.json`, `cache: 'no-store'`) | `gear-data.js` `fetchCatalogFromNetwork` → `sanitizeItem`; writes the v2 cache | current metadata |
| 8 | Stale in-memory catalog | `gear-data.js` `memoryCatalog`; `catalog-loader.js` `cachedResult` (fixed for the page load); controller `catalog` Map | whatever 6/7 produced; same sanitising |
| 9 | Old custom / manual filter records (`manual-…` ids, v1 or v2 `source:"custom"`) | `buildEntry` → `buildSpongeEntry`; controller `restoreSpongeItem` | GPH-only sponge → `ratingStatus:"needed"` + `legacyGph`; Add rating |
| 10 | Legacy `stocking.js` restoration | `tankStore.loadFilterSnapshot` (= `readSavedFilters`) → `stocking.js` `initializeFilters` → `sanitizeFilterList` → `appState.filters` | the pre-controller view the calculator scores until the controller hydrates |
| 11 | Controller restoration | `controller.js` `hydrateFromAppState` (from `appState.filters` or `readSavedFilters`) → `restoreKind` → `restoreProductItem` / `restoreSpongeItem` / stored-GPH fallback → `setFilters` → saved | final page state; writes v2 + v1 mirror |
| 12 | `compute.legacy.js` sanitisation | `sanitizeFilter` / `sanitizeFilterList` (every compute path) | type wins, sponge `rated_gph` 0 |
| 13 | Catalog product re-resolution | controller `findProductById` on the loaded catalog | current catalog record wins (section 4) |
| — | Session storage (`ttg:filter_id`, `ttg:rated_gph`, gear payload) | gear page / `stocking.js` | not a filter-list source; `ttg:rated_gph` has no reader (phase B §20) |

## 3. Source-of-truth precedence

Storage level (which saved list is used):

1. `ttg.stocking.filters.v2` when it parses as `{v:2, filters:[…]}` — even if every entry is dropped
   and even if a newer `ttg.stocking.filters.v1` exists.
2. Otherwise `ttg.stocking.filters.v1`, migrated in memory (written back as v2 on the first save).
3. Otherwise empty.

Entry level (how one saved entry is restored — `sponge-items.js` `restoreKind`, used by the
controller):

1. **Unsupported `capacityMethod`** (`"banana"`, `""`, `42`, …) → dropped (fails closed).
2. **Product id resolved by the current catalog** → rebuilt from that catalog record: catalog
   **type**, catalog GPH (powered), catalog rating (sponge), catalog `capacityMethod`. The saved type,
   `capacityMethod`, GPH and rating are ignored. Only the saved `instanceId` is kept.
3. **Sponge without a catalog record** (saved type `SPONGE`, or a known catalog sponge id — see §4)
   → rating sponge, 0 GPH. A product id keeps its identity and is **Rating needed** (a stored rating is
   never trusted for a product). A custom sponge keeps a user-entered **verified** rating; otherwise
   **Rating needed** + `legacyGph`.
4. **Powered filter without a catalog record** (custom, or a product id the catalog doesn't have) →
   stored GPH, as before (legacy behaviour, unchanged).

Catalog level (which catalog resolves ids): in-memory catalog → cached `ttg.gear.catalog.v2`
(served immediately, refreshed from the network in the background) → network → none. `ttg.gear.catalog.v1`
is never used.

Scoring level: `compute.legacy.js` `sanitizeFilter` and `math.normalizeFilter` apply type-wins
again, so even an entry that bypassed the layers above scores 0 GPH if it is a sponge.

## 4. Catalog product type authority (steps 4, 7, 20)

**Rule (locked): for a resolved product id, the current catalog type is authoritative.** A stale
saved type cannot turn a known sponge into a powered filter, nor a known powered product into a
sponge.

### What `main` did (reproduced before editing)

| Case | Saved entry | `main`, catalog loaded | `main`, catalog unavailable |
| --- | --- | --- | --- |
| A | Hygger S, `type:"HOB"`, `capacityMethod:"flow"`, `gph:900` | sponge (controller resolved it) ✔ | **HOB 900 GPH, "adequate", re-saved as HOB 900 GPH** ✘ |
| B | AquaClear 70, `type:"SPONGE"`, verified 500 gal | **filter silently dropped, saved plan erased** ✘ | sponge, Rating needed (fails closed) |
| C | AQUANEAT 20, no `type`, `gph:120` | sponge ✔ | **HOB 120 GPH** ✘ |
| D | Powkoo, `type:"BANANA"`, `gph:250` | sponge ✔ | **HOB 250 GPH** ✘ |
| — | any of A/C/D, before the controller hydrates | `stocking.js` + compute score the stored GPH (pre-controller window) ✘ | same ✘ |

A/C/D were safe only when the catalog loaded *and* after the controller ran; the saved-state and
compute layers were type-blind for product ids. None of these shapes is produced by any released
writer (every writer stored the catalog type), so no ordinary user was affected — they require
contradictory, hand-edited or damaged storage — but the invariant did not hold for them.

### Phase C hardening (narrowest fix)

1. `math.js`: `KNOWN_SPONGE_PRODUCT_IDS` (the seven catalog SPONGE ids) + `isKnownSpongeProductId`.
   Identity only — no rating or other metadata; a unit test requires it to equal the SPONGE ids of
   `gearCatalog.json`, so a catalog change cannot drift silently.
2. `saved-state.js` `buildEntry`: a product entry with a known sponge id is typed `SPONGE` (read v1,
   read v2, write). Covers the `stocking.js` pre-controller path and the offline controller path.
3. `compute.legacy.js` `sanitizeFilter`: same rule on `productId ?? id` (defence in depth for any
   `appState.filters` writer).
4. `gear-data.js` `sanitizeItem`: a catalog record (network or cache) with a known sponge id is typed
   `SPONGE`, so a damaged cached record cannot present a sponge as a powered product.
5. `controller.js` `hydrateFromAppState`: resolve the product **first** (`restoreKind`); a resolved
   product is rebuilt from the catalog whatever the saved type says (fixes B: AquaClear 70 restores
   as HOB 300 GPH instead of vanishing). `restoreProductItem` no longer merges saved
   `capacityMethod` / rating fields onto a powered product (the phase A merge existed only so phase B
   fields could survive a catalog without them; the catalog now carries them).
6. `sponge-items.js`: `restoreKind` (the pure decision above, unit-tested) and `restoreSpongeItem`
   keeps product identity for a known sponge id given only as `id`.

After the fix (browser-verified, desktop + mobile):

| Case | Catalog loaded | Catalog unavailable |
| --- | --- | --- |
| A | Hygger S, Rated 10–40 gal, verified, 0 GPH | Hygger S, Rating needed, 0 GPH, identity kept |
| B | AquaClear 70, HOB, 300 GPH (catalog) | sponge Rating needed (cannot know it is powered; fails closed); re-resolves to HOB 300 once the catalog loads |
| C / D | AQUANEAT 20 / Powkoo, SPONGE, catalog rating state (needs_review / needed), 0 GPH | Rating needed, 0 GPH |

## 5. v1 behaviour (step 5)

All seven sponge ids × historical GPH 60 / 120 / 200 / 900 / 1500 as `{id, type:"SPONGE", rated_gph}`:
id resolves, type stays SPONGE, saved-state entry `{productId, type, capacityMethod:"manufacturer_rating"}`
with no `gph`, restored rating from the current catalog, **0 GPH / 0 turnover** before and after the
controller. Hygger S / M → verified (adequate on 29 gal); the other five → Rating needed
(`needs_review` or `needed`). Rewritten v2 = identity only; nothing written to the v1 mirror.
v1 entries with the sponge id but `type:"HOB"`, a missing type or `kind:"canister"` → also SPONGE (§4).

## 6. Phase A v2 behaviour (step 6)

`{source:"product", productId, type:"SPONGE", capacityMethod:"flow", gph}` for all seven: flow method
and GPH ignored; `instanceId` kept; product re-resolved; correct phase B rating state; rewritten as
`{instanceId, source, productId, type:"SPONGE", capacityMethod:"manufacturer_rating"}` — no flow, no
GPH. (Unchanged from phase B; now covered for every id.)

## 7. Current v2 behaviour

Phase B entries round-trip unchanged: catalog sponge = identity only; custom sponge =
`manufacturerMaxGallons` + `ratingStatus:"verified"`; unrated custom sponge = `ratingStatus:"needed"`
+ `legacyGph`; powered = `flow` + `gph`. A catalog sponge carrying stale saved rating fields
(e.g. Hygger S "verified 500 gal", AQUANEAT 60 "verified 500 gal") is restored with the **current
catalog** rating; the saved numbers are not stored back.

## 8. Custom legacy sponge behaviour (step 9)

Shapes tested (unit + browser): v1 `type:"SPONGE"` + `rated_gph`; v1 `type:"Sponge"` + `gph`;
v1 `filterType:"SPONGE"` + `rated_gph`; v1 `kind:"sponge"`; v2 `capacityMethod:"flow"` + `gph`;
v2 missing `capacityMethod` + `gph`; v2 `filterType` + `rated_gph`; phase A v2 custom sponge;
phase B unrated custom sponge.

All: biological sponge (`hasBiologicalFiltration`), 0 GPH, label "Sponge filter", chip
**Rating needed**, **Add rating** available, level "Not evaluated — rating needed", `legacyGph` kept
internally only (never in chips, summary, warnings or status text; never converted to gallons).
Entering a rating upgrades the same filter in place (same id / `instanceId`), turns it verified,
drops `legacyGph` on the next save.

Hardening: v1 `{id:"manual-…", filterType:"SPONGE", rated_gph:200}` restored on `main` as a **HOB at
200 GPH** (`migrateV1Entry` read only `type` / `kind`). It now reads `filterType` too (the v2 reader and
the serializer already did).

## 9. Stale catalog cache behaviour (steps 11, 12)

- **`ttg.gear.catalog.v1`** is never read by current code: offline with only a v1 cache the catalog
  is unavailable (no fallback to v1); online the network catalog is used and the v1 key is left alone
  for old tabs. A v1-shaped sponge record (`{type:"SPONGE", gphRated:200}`, no rating), if it ever
  entered, builds a sponge item with 0 GPH and **Rating needed**.
- **Stale `ttg.gear.catalog.v2`** (Hygger S as `{type:"SPONGE", gphRated:120, capacityMethod:"flow"}`,
  no rating): served first for the page load → 0 GPH, **Rating needed**, level "not evaluated", no
  turnover. The background network refresh rewrites the v2 cache with current metadata during that
  load; the **next** page load shows Hygger S verified (Rated 10–40 gal, adequate on 29 gal) — rating
  based, the old 120 GPH is not restored. (The current load keeps the stale in-memory catalog:
  `catalog-loader.js` caches its result per page. Unchanged phase B behaviour.)
- A damaged cached record typing a known sponge as `HOB` with GPH is typed `SPONGE` by the loader (§4).

## 10. Offline behaviour (step 13)

Catalog fetch failing (network aborted):

| Cache | Result |
| --- | --- |
| stale v2 cache, GPH-only sponge records | cache used; sponges **Rating needed**, 0 GPH, not evaluated; picker works; no page errors |
| v2 cache holding verified rating metadata | that verified rating is used (it was stored as catalog rating metadata) — adequate by sponge, 0 GPH |
| no cache | catalog unavailable ("Filters unavailable"); saved sponges restored as **Rating needed** with identity kept; custom powered filters keep their GPH; no crash |

Never a fake adequate result from old GPH.

## 11. Malformed data behaviour (steps 10, 15)

Only `ratingStatus === "verified"` **and** a valid positive `manufacturerMaxGallons` (≤ 10,000)
**and** no minimum above it may be used. Each of these is "Not evaluated — rating needed" on 5 / 10 /
29 / 55 gal and is re-saved as `ratingStatus:"needed"` without the bad number:

verified + max missing / 0 / negative / NaN / `"forty"` / `true` / object / 1e9; `needs_review` + max;
`needed` + max; unknown status (`"approved"`, upper-case `"VERIFIED"`); no status + max;
**min greater than max**.

Hardening: `manufacturerMinGallons > manufacturerMaxGallons` with `ratingStatus:"verified"` used to
drop the minimum and **green-pass on the maximum**; it now fails closed (`resolveSpongeRating`). No
writer produces it (the custom input takes only a maximum; the catalog has no such record).

Unsupported `capacityMethod` on a sponge (`"banana"`, `""`, `"Flow"`, `42`, `true`, object) → entry
dropped, never flow, never a rating sponge; the rest of the payload is kept.

**Isolation (step 15)** — one v2 payload with a valid Tetra IQ 45, a valid verified custom sponge, a
malformed sponge (verified + `"huge"` / `-5`), an unsupported-method canister, `"garbage"`,
`{nonsense:true}`, `null`, `42`, `[]`, plus a v1 key: each bad entry fails on its own, the valid peers
survive (the malformed sponge survives as **Rating needed**), the payload stays v2 and **v1 is not
consulted**. The existing parser already satisfied this (per-entry `parseV2Entry`); confirmed.

**Mixed versions (step 14)** — a valid v2 plus a stale v1 written later by an old tab (with 200 / 900
"GPH" sponges and an extra HOB): v2 wins, the v1 content is ignored. Malformed v2 (`{not json`, `[]`,
`v:1`, `v:3`, `filters:{}`, missing `filters`, `null`, a string) + valid v1: falls back to v1 as
designed, and every sponge in it still migrates to `manufacturer_rating` (catalog → rating, custom →
Rating needed); only the powered filter contributes GPH.

## 12. v1 mirror behaviour (step 16)

Plan: Tetra IQ 45 (HOB), custom powerhead, verified catalog sponge (Hygger M), custom verified sponge
(40 gal), unrated legacy sponge (legacyGph 120). v1 mirror = `[{tetra-whisper-iq-45, HOB, 215},
{manual-ph1, POWERHEAD, 400}]` only. No sponge id, no gallons in `rated_gph`, no legacy GPH. v2 holds
all five. A sponge-only plan removes the v1 key.

## 13. Canonical save / reload behaviour (step 17)

For each fixture set (v1 catalog sponges, phase A v2 catalog sponges, type conflicts, old custom
sponges v1 / v2, unresolved ids, mixed valid + malformed, malformed v2 → v1 fallback, powered legacy),
online and offline, four consecutive load → save cycles produce **byte-identical saved v2** after the
first save and the same filtration level every time. Catalog sponges save identity only
(`capacityMethod, instanceId, productId, source, type`); verified custom sponges save their rating;
unrated custom sponges save `ratingStatus:"needed"` + only `legacyGph` / `label` / `legacyId`.
Nothing oscillates between `flow` and `manufacturer_rating`. Browser: a v1 plan and a re-loaded plan
give identical saved v2.

## 14. Code hardening required (summary)

Yes — four narrow fixes, all for contradictory / malformed legacy data only:

| # | Gap on `main` | Fix |
| --- | --- | --- |
| H1 | Known sponge id saved with a non-sponge / missing / nonsense type scored its stored GPH before the controller ran, and permanently when the catalog was unavailable (Hygger S at 900 GPH → "adequate") | known sponge ids are SPONGE in saved-state, compute and the catalog loader (§4 1–4) |
| H2 | Known powered product saved as `SPONGE` was dropped and the saved plan erased when the catalog loaded | controller resolves the product first; catalog type wins both ways; saved capacity fields no longer merged onto a powered product (§4 5–6) |
| H3 | v1 custom `filterType:"SPONGE"` + GPH restored as a HOB with that GPH | `migrateV1Entry` reads `filterType` |
| H4 | verified rating with min > max green-passed on the max | fails closed |

No storage model, key, threshold, warning copy, UI or catalog data changed.

## 15. Differential results (step 24)

1. **Compute + saved-state differential** (node, `main` worktree vs branch): 10 tank presets × 4 stock
   lists (none; community; freshwater angelfish + neon + betta; pea puffer + amano) × 63 current-state
   filter sets (none, all 41 catalog products, custom HOB / 1-GPH HOB / canister / internal / powerhead /
   UGF, custom sponges 10–999 gal, unrated legacy custom sponge, two sponges, Hygger S + M, Tetra +
   sponge + powerhead, weak HOB + verified / unrated sponge, powerhead + sponge, AC70 + Fluval 307 +
   EHEIM 2213, everything) = **2,520 scenarios, 0 differences** in the full computed state (filtration,
   Stocking Load, species, conditions, water, warnings) directly and after save → read → compute, and
   in the written v2 / v1 payloads.
2. **Legacy-fixture differential** (same harness, 16 fixtures): identical for v1 / phase A catalog and
   custom sponges, malformed / needs_review ratings, unresolved ids and powered v1. Different **only**
   for the intended cases: conflicts A / C / D and v1 sponge id without type (main: adequate at
   900 / 120 / 250 / 200 GPH → branch: not evaluated, 0 GPH), v1 `filterType` custom sponge (200 GPH →
   0), min > max (adequate → not evaluated). Stocking Load identical in every row.
3. **UI differential** (Playwright, `main` and branch served side by side, 35 scenarios: picker on all
   10 presets, none + stock, custom HOB / 1-GPH canister / internal / powerhead / sponge 40 / sponge 20
   on 55, Tetra IQ 45, AC70, Fluval 307, EHEIM 2213, UGF, Hygger S, unrated product on 75, mixed powered
   + sponge + powerhead, weak HOB + sponge review, removal, tank change, too-small angelfish, pea puffer
   quantity preview, predation + water, save / reload of a current plan, seeded phase B v2 plan, seeded
   v1 powered plan, legacy custom sponge + Add rating): chips, summary, warnings (id + text), Stocking
   Load label, engine level / GPH / turnover / bioload, calculator filters, picker options, species
   rows, v2 / v1 storage — **0 differences in two consecutive runs**. The product note alone varied
   ("Loading filter catalog…" vs the ready text) at random on **either** side: the pre-existing
   start-up race noted in the phase A / B reports; it was excluded from the comparison and logged.

No ordinary-current-state difference.

## 16. Test results (steps 18, 19, 21, 22, 25)

| Suite | Result |
| --- | --- |
| `npm run test:unit` | **195 / 195** (172 existing + 23 new in `tests/unit/filter-sponge-phase-c.test.mjs`) |
| saved-state (`filter-saved-state`) | 20 / 20 |
| sponge phase B (`filter-sponge-phase-b`) | 26 / 26 |
| sponge phase C (`filter-sponge-phase-c`) | 23 / 23 |
| filtration model / Tetra IQ 45 / catalog batch 1 | 15 / 15, 7 / 7, 7 / 7 |
| Stocking gate `npm run test:e2e:stocking-gate` (desktop + mobile) | **143 passed, 0 failed, 27 skipped** (127 existing + 16 new; §16.1) |
| `npm run test:stocking:extended` | 105 pairs, 0 failures (generated report not committed) |
| `guard:live`, `audit:controls` | pass |

New unit coverage (`filter-sponge-phase-c.test.mjs`): known-sponge-id list = catalog; v1 fake GPH
(7 ids × 5 GPH values); phase A v2 fake GPH; type conflicts A / A2 / C / D online and offline plus v1
variants; B (powered saved as SPONGE) online / offline / back online; stale saved rating vs catalog
rating; `restoreKind` precedence; unresolved sponge vs powered ids; nine old custom sponge shapes +
Add rating upgrade; current verified custom sponge unchanged; 14 malformed ratings on four tanks;
unsupported methods; stale v1 catalog cache; stale v2 catalog cache + background refresh; damaged
cache record; offline with stale / verified / no cache; valid v2 vs stale v1; malformed v2 → v1
fallback (8 malformed payloads); mixed valid / malformed v2 isolation; v1 mirror; four-cycle
canonicalisation (9 fixture sets × online / offline); **Stocking Load identical** before / after
restore / save / reload (9 fixture sets × 5 tanks × 4 stocks, plus the pre-controller view);
powered regression (Tetra 215, AC70 300, Fluval 307 303, EHEIM 2213 116 through v1 and v2; stale
Tetra 450 in v1 → 215 from the catalog; custom HOB / canister / powerhead).

New browser spec `tests/stocking-advisor-sponge-phase-c.spec.ts` (8 tests × desktop + mobile = 16
runs, added to the gate config): old v1 catalog sponges with fake GPH (+ reload stability); old
phase A v2 catalog sponges; old custom GPH-only sponges in three shapes behind a malformed v2 + Add
rating upgrade; stale type conflicts (A, C, B) online; type conflict with the catalog unavailable;
stale catalog cache (v2 + v1 keys) → Rating needed, refresh, reload → verified; offline with stale
cache and with no cache (no page errors); mixed valid / malformed v2. Every test asserts Stocking
Load equals the same stock with no filters, and that no fake GPH appears in chips, summary, flow meta
or warnings. On `main`'s JS the three tests covering H1–H3 fail and the other five pass.

### 16.1 Gate

**143 passed, 0 failed, 27 skipped** (desktop + mobile Chromium) — the 127 baseline runs (gate, saved
filters v2, sponge phase B) plus the 16 new phase C runs; the skips are the gate's own desktop-only /
mobile-only splits, as on `main`. Run with `PW_CHROMIUM_PATH` pointing at the locally installed
Chromium (the config's documented hook), on `main` and on the branch alike.

## 17. Live test impact (step 23)

`tests/live/stocking-advisor-saved-filters.live.ts` already covers the production-critical migration
paths: an existing v1 plan (sponge by rating, powered unchanged, v1 flow-only), a phase A v2 catalog
sponge (Rating needed, rewritten), an unsupported `capacityMethod`, verified / needs-review catalog
sponges and custom sponge save / reload. **Not expanded in this phase.**

**Follow-up (after review): one permanent live test added** for H1, the only phase C fix whose
failure would re-introduce scored sponge GPH in production:
`phase C: catalog unavailable — a known sponge id saved as a 900 GPH HOB fails safe as a sponge`.

- Fixture (seeded before any page script, fresh context): `ttg.stocking.filters.v2` =
  `{v:2, filters:[{instanceId:"f-phasec", source:"product", productId:"aquaneat-sponge-20",
  type:"HOB", capacityMethod:"flow", gph:900}]}`; `ttg.gear.catalog.v2` / `.v1` and
  `ttg.stocking.filters.v1` removed.
- Catalog unavailable: `page.route` aborts only `/assets/data/gearCatalog.json`; the page and all JS
  modules load normally. The test asserts the request was attempted and failed, the product picker
  is `data-catalog-ready="0"` and no catalog cache was written.
- Asserts: `['aquaneat-sponge-20', 'SPONGE', 0]`, `manufacturer_rating` / `needed`, GPH `[0,0,0]`,
  turnover 0, level `not-evaluated`, not adequate, `filtration.rating_needed` only, biological
  filtration without biological GPH, chip "Rating needed", no "900" in the filter area and no
  "900 GPH" on the page, saved v2 identity-only SPONGE, no v1 mirror, identical after an offline
  reload, Stocking Load equal to the same stock with no filter (engine) and unchanged when the chip
  is removed (label), no page errors, no site console errors except the two caused by the induced
  outage (the network error and `stocking.js`'s existing "Filter catalog load failed" log).
- Local validation (`BASE_URL` = a local static server, desktop Chromium): **passes on the phase C
  branch** (3 / 3 runs; the whole live file 11 / 11); **fails on `main` @ `9af3166`** at the first
  scoring assertion (`['aquaneat-sponge-20', 'HOB', 900]`). Not run against production, which does
  not contain phase C yet.
- The live suite runs only under `playwright.live.config.ts`, so gate counts are unchanged.

## 18. Deferred issues

- **Offline powered-as-sponge (case B)**: without a catalog, a powered product saved as `SPONGE`
  stays a Rating-needed sponge until the catalog loads (it cannot be known to be powered). Fails
  closed; re-resolves automatically.
- **Unresolved non-sponge ids**: an id the catalog no longer has, typed as a powered filter, keeps its
  stored GPH (existing legacy behaviour, preserved as required). If a retired *sponge* product were
  ever saved with a powered type **and** is not one of the seven known ids, it would score that GPH.
  Checked: every revision of `assets/data/gearCatalog.json` in git history (4) has exactly these
  seven SPONGE ids, so no such product exists.
- **`KNOWN_SPONGE_PRODUCT_IDS` maintenance**: must equal the catalog's SPONGE ids; enforced by a unit
  test, so adding a sponge record (phase D / later) requires updating the list.
- **Stale v2 catalog for one page load**: unchanged phase B behaviour (Rating needed for that load,
  verified from the next). A mid-load refresh of the controller catalog is not attempted.
- **Custom rating ceiling**: a saved custom sponge may hold a verified maximum up to 10,000 gal
  (the input allows 999). Both cover any selectable tank, so it cannot mis-pass; not changed.
- **Product-note start-up race** ("Loading filter catalog…"), pre-existing on `main`.
- Phase D (duplicates), E (remove legacy sponge GPH, stop v1 mirror, drop `legacyGph`), F (UGF),
  G (status card) untouched.

## Files changed

- `js/stocking-advisor/filtration/math.js` — `KNOWN_SPONGE_PRODUCT_IDS`, `isKnownSpongeProductId`; `resolveSpongeRating` fails closed on min > max.
- `js/stocking-advisor/filtration/saved-state.js` — known sponge ids typed SPONGE; v1 migration reads `filterType`.
- `js/stocking-advisor/filtration/sponge-items.js` — `RESTORE_KINDS`, `restoreKind`; `restoreSpongeItem` keeps a known sponge id as product identity.
- `js/stocking-advisor/filtration/controller.js` — restore resolves the catalog product first (catalog type wins); no saved capacity merge onto powered products.
- `js/logic/compute.legacy.js` — `sanitizeFilter` types known sponge ids SPONGE.
- `js/gear-data.js` — `sanitizeItem` types known sponge ids SPONGE.
- `tests/unit/filter-sponge-phase-c.test.mjs` (new), `tests/stocking-advisor-sponge-phase-c.spec.ts` (new), `playwright.stocking-gate.config.ts` (runs the new spec).
- Follow-up: `tests/live/stocking-advisor-saved-filters.live.ts` (one phase C live test, §17).
- `_internal/reports/stocking-advisor-sponge-migration-phase-c-2026-09.md` (this report).
