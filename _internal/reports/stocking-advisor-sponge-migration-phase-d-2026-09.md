# Stocking Advisor — sponge migration phase D: duplicate filter instances (2026-09)

Phase **D** of `stocking-advisor-sponge-filter-migration-design-2026-09.md` (D11, section 10): the
user can add more than one physical copy of the same catalog filter product (2 × AquaClear 70,
2 × hygger Double Sponge S). Each physical filter is represented, scored, saved and removed
separately. Builds on phase A (`…-phase-a-2026-09.md`), phase B (`…-phase-b-2026-09.md`) and
phase C (`…-phase-c-2026-09.md`).

Base: `main` @ `d49af7b` (phase C + permanent live tests). Branch:
`claude/stocking-advisor-phase-d-8ic12y`.

Not done (out of scope): removing legacy sponge `gphRated` / `minGallons` / `maxGallons` (E), UGF
model (F), filtration-status card (G). `MIN_BIOLOGICAL_TURNOVER` (2×), the powered thresholds,
Stocking Load and the species / water / compatibility / bioload models are untouched.

### Baseline on `main` (step 1, before editing)

Confirmed on `main` @ `d49af7b`: saved-state v2 (`ttg.stocking.filters.v2`) with a stable
`instanceId` per entry (phase A), the rating-based sponge engine (phase B), catalog-type authority
(phase C), permanent live tests (`tests/live/stocking-advisor-saved-filters.live.ts`, 11 tests).

| Suite | Baseline (`main`) |
| --- | --- |
| `npm run test:unit` | 195 / 195 |
| Stocking gate `npm run test:e2e:stocking-gate` (desktop + mobile) | 143 passed, 0 failed, 27 skipped |
| `npm run test:stocking:extended` | 105 pairs, 0 failures |

Note: the gate config reuses a running server on port 4174 outside CI. A first baseline attempt
accidentally reused a server left running from the branch checkout; that run was discarded and the
baseline above was re-run from a clean `main` worktree with `CI=1` (own server). All gate numbers in
this report were run the same way.

---

## 1. Previous duplicate limitation

Three places made the same product impossible to hold twice (all `js/stocking-advisor/filtration/controller.js`):

| Where | `main` behaviour |
| --- | --- |
| `canAddProduct` | false when any product filter had the same `id` → Add Selected disabled, "Already added" / "Already added. Remove its chip to add again." |
| `setFilters` | de-duplicated on `` `${source}:${id}` `` → a second copy (from any source, including restore) was silently dropped |
| `removeFilterById` | removed **every** filter with that `id`; chips' `data-remove-filter` / `data-rate-filter` carried `id` |

`saved-state.js`, `compute.legacy.js` (`sanitizeFilterList`), `math.js` (`normalizeFilters`,
`assessFiltration`) and `stocking.js` (`setFilters`) never de-duplicated: they already passed every
entry through. Custom filters were never blocked (each gets its own `manual-…` id).

## 2. productId vs instanceId (step 2 — locked)

| Field | Answers | Unique? |
| --- | --- | --- |
| `productId` | "What model of filter is this?" (catalog id) | **No** — repeats for identical filters |
| `instanceId` | "Which physical copy is this?" | **Yes** — unique within the list |

`instanceId` format (new `math.isValidInstanceId`): letters, digits, `-`, `_`; starts with a letter or
digit; ≤ 64 characters. `createInstanceId` (phase A) writes `f-` + 6 base-36 characters (fallback
`f-<time>-<n>`). The id is random, never derived from the productId, never shown on screen.

New module `js/stocking-advisor/filtration/instances.js` (pure, unit-tested) holds every instance
operation: `withUniqueInstanceIds`, `findInstance`, `removeInstance`, `replaceInstance`,
`duplicatePositions`. `productId` is never used as a unique key anywhere after this phase.

## 3. Product picker behaviour (steps 4, 21)

- Product **selection** stays productId-based (`pendingProductId`, `<select>` value, catalog lookup).
  Filter-**instance** operations are instanceId-based. `render()` still pre-selects the latest added
  product (`latestProduct.id`) — that only chooses which product the dropdown shows, never an
  instance.
- After Add Selected the dropdown stays on the product and **Add Selected stays enabled**.
- Status wording: "Filter added." after each add; selecting a product already in the list shows
  "Already in your list. Click Add Selected to add another one."; a new product still shows "Click
  Add Selected to add this filter.". "Already added" is no longer shown for ordinary products.
- No quantity control was added.

**Exception — undergravel plates (review point).** The design (D11, section 10) locks "all filter
types, **except UGF**". The only UGF product (`penn-plax-ugf-20-29`) is one plate set per tank and its
150 GPH is an unsupported legacy number (UGF model is phase F), so a second copy would double a flow
that isn't real. It therefore keeps a one-per-tank block: Add Selected is disabled once it is in the
list, with "Already added. An undergravel filter is one plate set per tank." A saved plan holding two
copies restores one (catalog loaded or not). This preserves `main`'s behaviour for UGF exactly. If
review prefers UGF duplicates too, it is a two-line change (`canAddProduct`, `hydrateFromAppState`).

## 4. Add Selected behaviour (step 3)

Each click creates a new item from the current catalog record (`createProductFilter`), appended by
`setFilters`, which gives it a new unique `instanceId` (`withUniqueInstanceIds`). Same `productId`,
new `instanceId`, every click. No arbitrary limit was added: the app has no total-filter limit, so
none was invented (step 26). Saved-state parsing limits are unchanged (per-entry parsing, bounded
fields, `MAX_DEVICE_GPH`, id length).

## 5. Chip identity and removal (steps 6, 7, 18)

- Each chip carries `data-instance-id`; its × (`data-remove-filter`) and Add rating
  (`data-rate-filter`) carry the **instanceId**. The click handler removes / rates exactly that
  instance (`removeFilterInstance` → `removeInstance`; `startRatingEntry(instanceId)`).
- `data-filter-id` is kept as the product / custom id (descriptive; repeats for identical products;
  existing tests and the live tests locate chips by it). It is never used for identity.
- Labels: identical products show the same product name, unchanged (the cleaner option). The ×
  buttons' `aria-label` gets "(1 of 2)" / "(2 of 2)" **only when duplicates exist**, so a screen reader
  user can tell them apart; nothing visible changes and the catalog name is not altered.
- Removal audit: chip × → by instanceId; the only programmatic remove (`removeFilterById`) was
  replaced by `removeFilterInstance`; Add-rating replacement → `replaceInstance` (below). No other
  removal path exists in the controller (`stocking.js`'s legacy picker is disabled while the
  controller owns the list).
- Result: add AquaClear 70 twice → two chips; remove the first → the second (same instanceId)
  remains; remove it → zero.
- Two existing gate selectors used the old attribute value (`[data-remove-filter="<id>"]`,
  `[data-remove-filter^="manual-"]`); they now select the chip by `data-filter-id` and click its ×.
  Same assertions otherwise. The live tests needed no change.

## 6. Powered duplicate math (step 8)

Two identical powered filters are two pumps: their flows add. 2 × 150 GPH on 100 gal = **300 GPH,
3.0×/h → adequate** (one alone: 1.5×/h, "Filter flow too low"). Catalog check: Tetra IQ 45 on the
125-gal preset: one 215 GPH = 1.72×/h (very low); two = 430 GPH = 3.44×/h (adequate). No type bonus;
`MIN_BIOLOGICAL_TURNOVER` is still 2.

## 7. Powerhead duplicate math (step 9)

2 × 400 GPH powerhead: circulation 800 GPH, total 800 GPH, **biological 0 GPH**, level
"No biological filter" (`circulation-only`), `hasBiologicalFiltration: false`. With a verified sponge
on 29 gal: adequate by the sponge, circulation still 800, biological 0.

## 8. Sponge duplicate evaluation (steps 10–12)

Each copy is its own sponge entry, rated individually from the current catalog.

| Plan | Result |
| --- | --- |
| 2 × hygger S (10–40 gal) on **55 gal** | ⚠ **Likely adequate — multiple sponge filters** (amber). Each rating listed separately ("…(S) 1: rated 10–40 gal; …(S) 2: rated 10–40 gal"); no "80 gal" anywhere; 0 GPH |
| … remove one | ⚠ Below manufacturer rating |
| 2 × hygger S on **29 gal** | ✓ **Rated for this tank** — the same status, chip and warnings as one copy; nothing stronger |
| 2 × AQUANEAT Middle (Rating needed) | both chips visible, "Rating needed", 0 GPH, **Not evaluated — rating needed** (also with 5 copies, on 10 / 20 / 29 / 55 gal); adequate only if an independent filter passes (e.g. + AquaClear 70 → adequate by powered) |

Quantity alone is never evidence of adequacy for unrated sponges. Stocking Load capacity is never
increased.

## 9. Multiple-sponge heuristic (step 24)

`math.assessFiltration` counts **instances**: `verified = sponges.filter(verified)` over every
normalized entry, so 2 × hygger S gives `verified.length === 2`, sum 80 ≥ 55 →
`likely-multi-sponge`. The sum only decides the amber tier and is never reported (unchanged phase B
rule). No engine change was needed — the heuristic was already instance-based; only the controller
prevented it from ever seeing two copies.

Mixed cases (unit): 2 × HOB (adequate powered); 2 × verified sponge on 75 (80 ≥ 75 → likely-multi)
and on 125 (below rating); HOB + duplicate HOB + sponge (adequate powered); 2 × weak HOB + sponge
below rating (review); 2 × weak HOB + 2 × hygger S on 75 (likely-multi takes precedence, as phase B);
powerhead × 2 + verified sponge (adequate by sponge, circulation 600); 2 × unrated sponge + powered
(adequate powered) / + weak powered (review). All phase B path rules unchanged.

## 10. Saved-state behaviour (steps 5, 14, 15, 22)

- **v2** stores one entry per physical filter; `productId` repeats; nothing collapses (the
  serializer never de-duplicated). The phase D example (`f-one` / `f-two`, both
  `hygger-double-sponge-s`) survives save, reload, sanitize, catalog re-resolution and four
  consecutive save / reload cycles **byte-identically** (online); offline the instanceIds stay the
  same through every cycle as well.
- **Catalog authority per instance**: each copy re-resolves independently from the current catalog
  by its shared productId; each keeps its own instanceId. A second copy saved with stale data
  (`type:"HOB"`, `gph:900`, "verified 500 gal") restores as the current catalog sponge (10–40 gal)
  and is re-saved as identity only — nothing is copied between instances.
- **instanceId repair (step 5, 22)**: missing, malformed (e.g. `"<bad id>"`, `" f-abc"`, 65+ chars,
  numbers) or duplicate ids are re-issued by the phase A strategy (`createInstanceId`); the **first**
  use of a repeated id is kept and the later filter gets a new id — it is **kept, never dropped**.
  Valid unique ids are never changed. Applied at every layer: `pickPassthroughFields` now accepts only
  a well-formed `instanceId` (so compute / saved-state never carry a malformed one), saved-state's
  `assignInstanceIds` and the controller's `setFilters` (`withUniqueInstanceIds`). The repair is
  written back on the first save and is stable after that.
- Change in validation: `pickPassthroughFields` used to accept any trimmed string ≤ 128 characters as
  an `instanceId`; it now requires the format above. No writer ever produced anything else, so no
  saved plan changes (differential §14).

## 11. v1 compatibility behaviour (step 16)

The v1 mirror (`toV1Mirror`, unchanged code) writes one `{id, type, rated_gph}` per **flow** entry, so
two AquaClear 70s are two entries with the same id:
`[{id:"aquaclear-70",type:"HOB",rated_gph:300},{id:"aquaclear-70",…}]`. No fake product ids, no
instanceId in any id, no sponge (rating-based sponges are still never written to v1).

Old-reader behaviour, confirmed in the browser by serving `main`'s JS (= the previous release)
against a phase D plan:

| Reader | Sees | Result |
| --- | --- | --- |
| Current code (phase D) | v2 | all copies |
| Previous release (phase C / `main`) | v2 (it reads v2 first) | **collapses to one per product** (its `setFilters` de-duplicates on `source:id`) — 2 × AC70 + 2 × hygger S → AC70 + hygger S, 300 GPH, and it re-saves that collapsed list |
| Pre-phase-A code | v1 | same collapse in its controller (its pre-controller `stocking.js` view briefly sums both) |

Repeated ids are the safest representation: they are faithful, and every old reader degrades to one
copy — the conservative direction (less flow, never more). De-duplicating the mirror would give old
readers the same single copy, so it would gain nothing. v2 remains authoritative. The collapse can
only happen in a tab still running old JavaScript (JS is served `must-revalidate`, so a reload picks
up the new code); it is the ordinary last-writer-wins between two open tabs. Accepted; noted in §17.

## 12. Legacy migration behaviour (step 17)

- **v1 with a repeated powered id** (`2 × {id:"tetra-whisper-iq-45",HOB,215}`): historically the
  controller collapsed them to one (the v1 migration itself kept both; `setFilters` dropped the
  second). No v1 writer ever produced repeats (the controller de-duplicated before writing), so the
  shape only comes from damaged data. Now: **both migrate**, distinct instanceIds, 430 GPH, adequate
  on 125 gal, written back as two v2 entries (the historical collapse is not preserved, per step 17).
- **v1 with a repeated known sponge id** (`hygger S` as SPONGE 200 and as HOB 900): two separate
  sponge instances, `manufacturer_rating`, no `gph`, **0 GPH** before and after the controller,
  likely-multi on 55 gal, nothing in the v1 mirror. Two legacy custom sponges sharing one damaged
  `manual-` id: two Rating-needed sponges with distinct instanceIds.
- Phase C protections re-verified (§15): known-sponge offline fail-safe, catalog type authority,
  malformed-rating fail-closed, v2-over-v1 precedence, fake sponge GPH protection — the whole phase C
  unit file and browser spec pass unchanged.

## 13. Add-rating targeting (step 20)

"Add rating" carries the chip's instanceId; `startRatingEntry(instanceId)` stores it
(`pendingRatingTargetInstanceId`) and `addManualSponge` replaces **that instance only**
(`replaceInstance`, same instanceId, same chip position). With two unrated legacy custom sponges —
including two that share one damaged legacy id — rating one turns only it "Rated up to 30 gal"
(verified, `legacyGph` dropped on save); the other stays "Rating needed" with its Add rating button
and `legacyGph: 120`.

## 14. Differential results (step 30)

1. **Compute + saved-state** (node, `main` worktree vs branch): 58 non-duplicate filter sets (none;
   each of the 41 catalog products; custom HOB / 1-GPH HOB / canister / internal / powerhead; custom
   sponges 10 / 40 / 999; unrated legacy custom sponge; two different sponges; Tetra + sponge +
   powerhead; weak HOB + verified / unrated sponge; powerhead + sponge; AC70 + Fluval 307 + EHEIM
   2213; everything) × 10 tank presets × 4 stocks (none; community; angelfish + neon + betta; pea
   puffer + amano) × direct / saved → reloaded = **4,640 scenarios, 0 differences** in filtering,
   Stocking Load, status, conditions, water, aggression, species entries, diagnostics and tank
   suitability, and identical written v2 / v1 payloads and read-back.
2. **UI** (Playwright, `main` and branch served side by side, 36 scenarios × desktop + mobile = 72
   runs, 0 errors): picker on all 10 presets, none + stock, custom HOB / 1-GPH canister / internal /
   powerhead / sponge 40 and 20 on 55, Tetra IQ 45, AC70, Fluval 307, EHEIM 2213, UGF, hygger S,
   unrated product on 75, mixed powered + sponge + powerhead, weak HOB + unrated sponge, two different
   sponges, removal, tank change, too-small angelfish, pea-puffer quantity preview, save / reload of a
   current plan, seeded phase B v2 plan, seeded v1 powered plan, legacy custom sponge + Add rating,
   and re-selecting an added product. Compared: chips (id, source, label, badge, aria-label, Add
   rating), summary, chip-bar total, flow meta, warnings (id, state, text), Stocking Load label, engine
   level / adequateBy / GPH / turnover / bioload, calculator filters, picker options, species rows,
   select value, product note, v2 / v1 storage (instanceIds normalized). **Identical except the
   intended change:** Add Selected is enabled after adding a product (it was disabled on `main`) in the
   32 snapshots that had a product selected, and the re-select note ("Already added. Remove its chip
   to add again." → "Already in your list. Click Add Selected to add another one."). Nothing else
   differs for plans without duplicates.
3. **Stocking Load**: identical for 0 / 1 / 2 / 5 identical copies of AC70, Tetra IQ 45, hygger S,
   AQUANEAT Middle, custom HOB, custom sponge and custom powerhead on 5 tanks × 4 stocks (unit), and
   equal to the same stock with no filters in every phase D browser test.

## 15. Test results (steps 27, 28, 29, 31)

| Suite | Result |
| --- | --- |
| `npm run test:unit` | **217 / 217** (195 existing + 22 new in `tests/unit/filter-duplicates-phase-d.test.mjs`) |
| saved-state / phase B / phase C unit files | 20 / 20, 26 / 26, 23 / 23 (unchanged, inside the 217) |
| Stocking gate (desktop + mobile) | **165 passed, 0 failed, 27 skipped** (143 existing + 22 new) |
| `npm run test:stocking:extended` | 105 pairs, 0 failures (generated report not committed) |
| Live files run locally against the branch (`BASE_URL` = local static server) | `stocking-advisor-saved-filters.live.ts` 11 / 11, `stocking-advisor.live.ts` 5 / 5 |
| `guard:live`, `audit:controls` | pass |

New unit coverage: instanceId format at every sanitising layer; `withUniqueInstanceIds` (same
productId + different ids untouched; duplicate / missing / malformed repaired, never dropped);
remove / replace / find touch exactly one instance, a productId removes nothing; duplicate positions;
Add Selected × 5 → 5 unique ids; serialization of powered + sponge duplicates and the v1 mirror; the
phase D example plan restored with per-instance catalog re-resolution; four-cycle save / reload
(10 filters incl. duplicates of every kind, online / offline); duplicate-instanceId repair in saved
v2; v1 repeated powered id; v1 repeated sponge id (+ shared damaged manual id); powered duplicate
math (100 gal, Tetra on 125); powerhead duplicates; 2 × hygger S on 55 and 29; duplicate unrated
sponges on four tanks (2 and 5 copies); nine mixed scenarios; identical custom HOBs / sponges; Add
rating on one of two legacy sponges; compute pipeline keeps every instance; UGF restore (online /
offline); the Stocking Load invariant (420 combinations).

New browser spec `tests/stocking-advisor-duplicate-filters.spec.ts` (11 tests × desktop + mobile, in
the gate config): A–C powered AC70 twice → two chips, aria "(1 of 2)" / "(2 of 2)", 600 GPH, v2 + v1
mirror, remove first → second remains, reload keeps it, remove last → zero; D–F 55 gal + 2 × hygger S
→ likely-multi with separate ratings, no "80 gal", identity-only v2, no v1; remove one → below
rating, reload keeps it; 2 × hygger S on 29 → rated; G 2 × AQUANEAT Middle → Rating needed, 0 GPH,
not evaluated; H two custom HOBs (2.4×/h adequate → remove one → very low); I two custom sponges
(likely-multi → remove one → below rating → reload); J Add rating on one of two legacy sponges
sharing a damaged id; saved repeated / malformed instanceIds repaired and stable across reload; UGF
one per tank (Add disabled, note); saved UGF duplicates restore once, catalog loaded and unavailable.
Every test asserts Stocking Load equals the same stock with no filters. Against `main`'s JS all
eleven fail (H and I only for the missing `data-instance-id`: custom duplicates already worked on
`main`, since each custom filter gets its own `manual-` id).

## 16. Live-test recommendation (step 32)

**Recommended, after this ships:** one permanent production test —

> Fresh context, 55-gal tank + a stock. Add hygger Double Sponge S twice with Add Selected. Expect two
> chips with distinct `data-instance-id`, both "Rated 10–40 gal"; engine `likely-multi-sponge`,
> 0 GPH; warning "Likely adequate — multiple sponge filters" listing each rating separately and no
> "80 gal"; v2 has two identity-only entries with distinct instanceIds and the same productId; no v1.
> Remove the first chip → one remains (the second instanceId), "Below manufacturer rating". Reload →
> the same single instance. Stocking Load equals the same stock with no filters throughout.

It covers the whole phase D chain in production (picker, instance creation, engine counting,
serializer, restore, remove-by-instance) with the primary acceptance case, and a regression back to
product-id de-duplication would fail it at the second chip. **Not added in this phase** (per the
instructions); the browser spec's D–F test is the same scenario and validates it locally.

## 17. Deferred issues

- **Old tabs collapse duplicates** (§11): a tab still running pre-phase-D JavaScript shows one copy
  per product and, if the user edits filters in it, saves that. Conservative (less flow) and limited
  to open stale tabs; retire with the v1 mirror in phase E.
- **UGF duplicates** stay blocked pending the UGF model (phase F) — review point in §3.
- **Chip grouping** ("AQUANEAT Middle ×2" with one chip, as the design sketched) was not built: the
  instructions ask for one chip per physical filter. Revisit with the status card (phase G) if long
  lists become hard to read.
- `ACTIVE_PRODUCT_NOTE` ("Select another product and click Add Selected to add it…") is unchanged to
  keep non-duplicate plans identical; it is still accurate, just silent about adding a second copy.
- Pre-existing: product-note start-up race; phase E / F / G items.

## Files changed

- `js/stocking-advisor/filtration/instances.js` (new) — instance identity helpers.
- `js/stocking-advisor/filtration/controller.js` — no product-id de-duplication; `canAddProduct` blocks only a second UGF; chips / remove / Add rating by instanceId; duplicate aria labels; picker notes; restore keeps every instance (UGF once).
- `js/stocking-advisor/filtration/math.js` — `isValidInstanceId`; `pickPassthroughFields` accepts only well-formed instanceIds.
- `js/stocking-advisor/filtration/saved-state.js` — comments only (duplicate / v1 mirror contract).
- `tests/unit/filter-duplicates-phase-d.test.mjs` (new), `tests/stocking-advisor-duplicate-filters.spec.ts` (new), `playwright.stocking-gate.config.ts` (runs the new spec).
- `tests/stocking-advisor-gate.spec.ts`, `tests/stocking-advisor-sponge-phase-b.spec.ts` — one selector each (× button located through its chip).
- `_internal/reports/stocking-advisor-sponge-migration-phase-d-2026-09.md` (this report).
