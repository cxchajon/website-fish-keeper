# Stocking Advisor — sponge migration phase A: saved-state v2 + capacity-method plumbing (2026-09)

Infrastructure only. Implements phase **A** of
`stocking-advisor-sponge-filter-migration-design-2026-09.md` (section 15). **No scoring, warning,
threshold, UI, picker, catalog-data, undergravel or Stocking Load change.** Sponges still score by
their catalog / entered GPH exactly as before; that switch is phase B.

Base: `main` @ `a117efe`.

---

## 0. Filter state map (step 1)

Every place filter state is created, normalised, saved, restored, passed to compute, rendered,
copied to storage or hydrated from the catalog (line numbers are `main`):

| Path | Where | Role |
| --- | --- | --- |
| Catalog load | `js/gear-data.js` `sanitizeItem` :57 (drops `gphRated ≤ 0`; also applied to the `ttg.gear.catalog.v1` localStorage cache), via `js/stocking-advisor/catalog-loader.js` | catalog hydration source |
| Create (product) | controller `createProductFilter` :722 | catalog item → controller item `{id, source, label, gph, type, efficiencyType}` |
| Create (custom) | controller `addManualFilter` :746 | `manual-…` id, label `"<Type> <gph> GPH"` |
| Normalise / de-dupe | controller `setFilters` :676 | drops GPH ≤ 0, de-dupes on `source:id` |
| To calculator | controller `toAppFilter` :307 → `math.normalizeFilters` → `appState.filters` (`applyFiltersToApp` :376) | **writer** of `appState.filters` |
| Save | controller `persistAppFilters` :322 | **writer 1** of `ttg.stocking.filters.v1` |
| Save (legacy) | `js/stocking/tankStore.js` `saveFilterSnapshot` :221 ← `js/stocking.js` `setFilters` :530 (legacy picker paths only; disabled while `window.disableLegacyFilterRows`) | **writer 2** of the same key |
| Restore | `tankStore.loadFilterSnapshot` :207 → `stocking.js` `initializeFilters` :554 → `sanitizeFilterList` → `appState.filters` | **reader 1** |
| Restore | controller `readStoredFilters` :990 / `hydrateFromAppState` :1002 (uses `appState.filters` if already filled, else storage) | **reader 2**; catalog id → rebuilt from catalog, unknown id → custom at stored GPH, GPH 0 → dropped |
| Compute | `compute.legacy.js` `summarizeFilters` → `sanitizeFilter` :253 (in `calcTank` :816 and `buildFilteringState` :1051) → `math.assessFiltration` → `math.normalizeFilter` :87 | scoring |
| Render | controller `renderChips`, `renderSummary`, `window.renderFiltration`; `stocking.js` `syncFiltrationUI` (legacy drawer `js/ui/filter-drawer.js`, disabled) | UI |
| Session storage | `stocking.js` `ttg:filter_id` (:463), `ttg_stocking_state` gear payload (:2502, `filter.product_id/type/rated_gph` from `state.filterId`); `assets/js/gear.v2.js` `ttg:filter_type` / `ttg:rated_gph` | gear-page hand-off; not a filter-list store |

## 1. Old v1 format (step 2)

- Key: `localStorage['ttg.stocking.filters.v1']`.
- Value: a bare JSON array `[{ "id": string|null, "type": string, "rated_gph": number }]`.
  - `id`: catalog product id, or `manual-<ts36>-<rand4>` for a custom filter — the **only identity**.
  - `type`: canonical upper-case type (`canonicalizeFilterType`: HOB, CANISTER, INTERNAL, SPONGE, UGF,
    POWERHEAD; anything unknown becomes HOB).
  - `rated_gph`: integer 0–1500.
- Discarded: label, source (product vs custom), efficiency type/kind, instance identity, any
  capacity/rating field. Catalog and custom entries have the same shape; the difference is only
  whether the id resolves in the catalog on restore.
- Product id retained: yes (as `id`). GPH stored: yes (ignored on restore when the id resolves).
  Type retained: yes.

**Confirmed stripping.** Every step between the controller and scoring reduced a filter to GPH-oriented
fields:

| Step | File (main) | Kept |
| --- | --- | --- |
| `sanitizeFilter` | `js/logic/compute.legacy.js:253–265` | `{id, type, rated_gph}` only |
| `normalizeFilter` | `js/stocking-advisor/filtration/math.js:87–100` | `{id, source, label, type, role, ratedGph, rated_gph}` |
| `toAppFilter` | controller `:307` | `{id, type, rated_gph, kind, source}` |
| `persistAppFilters` / `normalizeStoredFilter` | controller `:322`; tankStore `:195` | `{id, type, rated_gph}` |
| `sanitizeItem` | `js/gear-data.js:57` | fixed field list |

## 2. New v2 format (steps 3, 5–7)

Key `ttg.stocking.filters.v2`, a versioned envelope:

```jsonc
{
  "v": 2,
  "filters": [
    // powered catalog filter
    { "instanceId": "f-7k2p9a", "source": "product", "productId": "tetra-whisper-iq-45",
      "type": "HOB", "capacityMethod": "flow", "gph": 215 },
    // powered custom filter
    { "instanceId": "f-9q1z0b", "source": "custom", "label": "Canister 180 GPH",
      "legacyId": "manual-mujj1jg4-viar", "type": "CANISTER", "capacityMethod": "flow", "gph": 180 },
    // catalog sponge — phase A: still a flow filter with its catalog GPH (unchanged behaviour)
    { "instanceId": "f-3m8a2c", "source": "product", "productId": "aquaneat-sponge-20",
      "type": "SPONGE", "capacityMethod": "flow", "gph": 120 },
    // future shape (test fixture only; nothing in production writes this yet)
    { "instanceId": "f-5c0d1e", "source": "custom", "label": "Sponge", "type": "SPONGE",
      "capacityMethod": "manufacturer_rating", "manufacturerMaxGallons": 20, "manufacturerMinGallons": 10 }
  ]
}
```

| Field | Present | Meaning |
| --- | --- | --- |
| `instanceId` | always | `f-` + 6 base-36 chars, unique within the list; separate from `productId` |
| `source` | always | `product` (catalog-backed) or `custom` |
| `productId` | catalog | catalog identity; re-resolved on restore |
| `label` | custom | the chip label (today derived from type + GPH) |
| `legacyId` | custom | the existing `manual-…` id, so the chip/calculator id and the v1 mirror id stay stable |
| `type` | always | canonical filter type, stored explicitly (never inferred from GPH) |
| `capacityMethod` | always | `flow` for every current filter |
| `gph` | when > 0 | phase A: stored for every entry that has a flow, sponges included (it is still the scoring input; for catalog entries only the fallback when the id can't be resolved) |
| `manufacturerMaxGallons`, `manufacturerMinGallons`, `ratingStatus` | only when set | carried, never scored; no production path sets them in phase A |

Field names follow the design report (`capacityMethod`, `manufacturerMaxGallons`,
`manufacturerMinGallons`); `type` keeps the v1/design name (the reader also accepts `filterType`,
and `ratedMaxGallons` from design §8.2 as an alias of `manufacturerMaxGallons`).

Capacity methods recognised structurally (`math.CAPACITY_METHODS`): `flow`, `manufacturer_rating`,
`tank_compatibility`. A missing or unknown value resolves to `flow` (`resolveCapacityMethod`).
Powerheads are also `flow` (their role, not their method, keeps them circulation-only).

## 3. Storage keys (step 4)

| Key | Status in phase A |
| --- | --- |
| `ttg.stocking.filters.v2` | new, authoritative; read first, written on every save |
| `ttg.stocking.filters.v1` | kept; read only when v2 is absent or unreadable; still written as a mirror; never deleted by a read |

## 4. Migration behaviour (step 9)

`js/stocking-advisor/filtration/saved-state.js` `readSavedFilterState`:

1. v2 present, valid JSON, `v === 2`, `filters` is an array → use it. **v1 is not read.**
2. Otherwise read v1 and migrate **in memory**; v2 is written on the next save (the controller saves
   as soon as it restores, so on the first page load).
3. Neither → empty list.

v1 → v2 per entry (`migrateV1Entry`): `productId` = the id unless it is a `manual-…` id; `type`
canonicalised as before; `gph` = stored `rated_gph`; `capacityMethod: "flow"` for **every** entry
including known sponges (no reinterpretation — phase B); a new `instanceId`. Entries that v1 kept
(an id or a GPH) are kept; restore then applies the unchanged v1 rules (catalog id → rebuilt from the
current catalog, stored GPH ignored; unknown id → custom at stored GPH; GPH 0 → dropped).

## 5. instanceId behaviour (step 5)

- Assigned by the controller's `setFilters` when an item has none (new filter, or v1 migration) and
  kept thereafter: controller item → `appState.filters` → `sanitizeFilter` → saved v2 → restored.
- Unique within the list: a repeated or malformed id is re-issued (first use kept).
- `productId` stays the catalog identity. The picker's "Already added" block and the `source:id`
  de-duplication are unchanged, so one instance per product as today (phase D enables repeats).

## 6. capacityMethod support (step 6)

Recognised, validated and carried; **not read by any scoring code**. `assessFiltration`,
`MIN_BIOLOGICAL_TURNOVER`, the filtration levels and warning copy are untouched. A unit test feeds
the same devices with and without capacity fields (including `manufacturer_rating` + a 500-gallon
rating) and gets identical assessments.

## 7. Sanitisation changes (step 8)

A shared `math.pickPassthroughFields` copies only valid values of `instanceId`, `productId`,
`capacityMethod`, `manufacturerMaxGallons`, `manufacturerMinGallons`, `ratingStatus`. It is now
spread into:

- `compute.legacy.js` `sanitizeFilter` (scoring still reads only `id`, `type`, `rated_gph`),
- `math.js` `normalizeFilter`,
- controller `toAppFilter`, `setFilters`, `createProductFilter`, restore,
- `gear-data.js` `sanitizeItem` (capacity fields only, only when a record has them — none do).

`type` was already preserved (canonical). An entry without the new fields keeps its previous shape
plus `instanceId`/`capacityMethod`/`productId`.

## 8. Catalog hydration (step 10)

- A restored catalog filter is rebuilt from the **current catalog** by id, as before (name, type, GPH).
- Capacity fields: the catalog's value wins when the catalog defines one; otherwise the saved value is
  kept (so phase-B fields survive a catalog that doesn't carry them yet). `instanceId` is kept.
- A product id the catalog can't resolve (removed product, or the catalog failed to load) keeps
  today's fallback — a custom chip at its stored GPH — and now also keeps `productId`, so it is saved
  back as a catalog entry and re-resolves once the catalog is available (v1 kept the id the same way).
- Custom filters keep their stored type and GPH; nothing replaces them from the catalog.
- Sponge GPH is **not** ignored in phase A.

## 9. v1 compatibility strategy (step 11)

- **Yes, v1 is still written** on every save, as a mirror: only `capacityMethod: "flow"` entries,
  only `{id, type, rated_gph}` (product id, or the custom `manual-…` id). Rating-method entries and
  any future field never reach it. An empty list removes both keys, as v1 did.
- Why: a tab still running the previous JavaScript (or a returning visitor's cached HTML during the
  deploy window) reads only v1; the mirror gives it exactly today's data.
- Compatibility period: keep the mirror at least until phase E (design section 15), i.e. at least one
  release after phase B ships; phase E stops mirror writes. v1 *reading* stays as the migration path.
- Known limitation (design-accepted, "prefer v2"): edits made in a still-open old tab after the new
  code has written v2 update only v1 and are not picked up while v2 exists. The window is short
  (`/js/*` is `max-age=0, must-revalidate`).

## 10. Round-trip results (steps 12, 13, 16)

`tests/unit/filter-saved-state.test.mjs` (15 tests, module + real compute) and
`tests/stocking-advisor-saved-filters.spec.ts` (7 tests × desktop + mobile, real page, added to the
stocking gate config):

| Case | Unit | Browser |
| --- | --- | --- |
| A powered catalog filter (incl. Tetra IQ 45 = 215 GPH) save → reload → identical scoring | pass | pass |
| B custom powered filter | pass | pass |
| C several different filters: order, values and instanceIds preserved | pass | pass |
| D every catalog sponge: still its catalog GPH, `flow`, no rating populated | pass | pass |
| E custom sponge | pass | pass |
| F v1 payload → v2, same scoring, v1 mirror identical to the v1 input | pass | pass |
| G v2 payload loads directly; storage spy shows v1 never read | pass | pass |
| Future-field fixture (`manufacturer_rating`, max 20, min 10, `tank_compatibility`) survives read → restore → `normalizeFilter` → `sanitizeFilter` → re-save; scoring identical to the same devices without the fields; sponge still scored at catalog GPH; excluded from v1 | pass | pass |
| Malformed v2 JSON (falls back to v1), wrong envelope/version, missing fields, negative/junk GPH, junk ratings, unknown `capacityMethod` (→ flow), unknown type (→ HOB, as v1), stale product id, duplicated instanceId, oversized GPH (→ 1500, as v1), throwing storage, no storage | pass | malformed + no-localStorage pages load, no page errors, no invented filter |

## 11. Differential behaviour results (step 14)

1. **Compute differential** (node, scratch harness): every tank preset (10) × every catalog product (41)
   plus none, powerhead-only, custom HOB / sponge / 1-GPH canister, mixed, two sponges,
   product + custom + powerhead × 3 stock lists, run on `main` and on this branch both directly and
   through save → reload: **2,940 scenarios, 0 differences** in filtration level/status/warnings,
   GPH totals, turnover, Stocking Load (bioload), chips and tank turnover.
2. **UI differential** (Playwright, `main` and branch served side by side): 29 scenarios — none,
   no-stock, custom HOB / 1-GPH canister / sponge, powerhead-only, mixed, Tetra IQ 45, all 8
   sponge/UGF catalog products, two sponges + custom, "Already added" re-select, chip removal, the
   product picker on 7 tank sizes, a seeded v1 plan (with / without stock), malformed v1 — each
   captured live and after reload: chip text, calculator input, filtration level/status/turnover,
   warning ids/titles/text, status-strip text, Stocking Load label, summary/chipbar text, product
   notes, picker options and Add-button state. **0 differences** against a second `main` run. The
   only difference seen between two `main` runs themselves (the product note reading "Loading filter
   catalog…" vs the ready text on first paint) is a pre-existing load-order race, not this change.

No user-visible difference found.

## 12. Cache / versioning findings (step 17)

- Affected JS: `js/stocking-advisor/filtration/controller.js`, `…/filtration/math.js`,
  `…/filtration/saved-state.js` (new), `js/stocking/tankStore.js`, `js/logic/compute.legacy.js`,
  `js/gear-data.js` (also loaded by the gear page via `assets/js/gear.v2.js`).
- Cache behaviour: `_headers` serves `/js/*` and `/data/*` with `max-age=0, must-revalidate`; HTML is
  `max-age=3600, must-revalidate`. Module imports use plain paths (no `?v=`), so every module is
  revalidated on use regardless of the entry-script query string.
- **No version query needs changing.** The `?v=` on the entry scripts in `stocking-advisor.html`
  (`compute.js?v=1.5.2`, `stocking.js?v=2024-09-01`, `controller.js?v=1.5.2`) does not control
  freshness under must-revalidate, and bumping them would not reach imported modules anyway. No
  data file or catalog cache key (`ttg.gear.catalog.v1`) changes in phase A. Nothing bumped.
- Mixed-version window: old page + new modules is not possible for more than one navigation (all
  revalidate); old tab + new tab sharing storage is covered by the v1 mirror (section 9).

## 13. Regression (step 18)

- Unit suite `npm run test:unit`: **141 / 141 pass** (126 existing + 15 new), including filtration
  model, filter-catalog batch 1, Tetra IQ 45 (215 GPH), species integrity (44 species), bioload
  model (Phase 2B Stocking Load), water model (2D), warnings (2E), invert predation (2G).
- `npm run test:stocking:extended`: 105 pairs, 0 failures (generated report not committed).
- Stocking gate `npm run test:e2e:stocking-gate` (desktop + mobile Chromium, final code):
  **109 passed, 0 failed, 27 skipped** — 95 existing gate runs + 14 new saved-filters runs; the
  skips are the gate's own desktop-only / mobile-only splits. Covers the 44-species dropdown,
  Phase 2B Stocking Load, 2C filtration, 2D water, 2E warnings, 2G predation, the quantity-preview
  fix and the catalog-product filter path.

## 14. Items for phase B (not blockers for A)

1. The GPH gates listed in design §9.3 are unchanged, so a GPH-less rating-method entry (possible
   only from a future writer) is parsed and kept by the serializer but dropped by the controller's
   `setFilters` / `hydrateFromAppState` GPH gate, and so not re-saved. Phase B must open those gates
   in the same release as the rating fields (as the design already requires).
2. Phase B should stop writing `gph` for rating-method entries and add `legacyGph` for migrated
   custom sponges (design §8.2, §9.2); phase A deliberately keeps sponge GPH.
3. `gear-data.js` now carries catalog capacity fields when present; phase B's catalog data will flow
   through without another loader change.

## Files changed

- `js/stocking-advisor/filtration/saved-state.js` (new): v2 serializer/reader, v1 migration, v1 mirror.
- `js/stocking-advisor/filtration/math.js`: `CAPACITY_METHODS`, `resolveCapacityMethod`,
  `pickPassthroughFields`; `normalizeFilter` passes the fields through.
- `js/stocking-advisor/filtration/controller.js`: uses the shared module; instanceId, productId,
  capacityMethod on items; catalog-first restore that keeps saved capacity fields.
- `js/stocking/tankStore.js`: `loadFilterSnapshot` / `saveFilterSnapshot` delegate to the shared module.
- `js/logic/compute.legacy.js`: `sanitizeFilter` passes the fields through.
- `js/gear-data.js`: carries catalog capacity fields when present.
- `tests/unit/filter-saved-state.test.mjs` (new), `tests/stocking-advisor-saved-filters.spec.ts` (new),
  `playwright.stocking-gate.config.ts` (runs the new spec).
- `_internal/reports/stocking-advisor-sponge-migration-phase-a-2026-09.md` (this report).
