# Stocking Advisor — sponge migration phase G: filtration status card (2026-09)

Phase **G**, the last planned phase of `stocking-advisor-sponge-filter-migration-design-2026-09.md`
(section 15): the dedicated filtration status card designed in section 12. It explains **why** the
filtration result was reached, one line per independent path, without converting units and without
implying that filtration changes Stocking Load. Builds on phases A–F (`…-phase-a-2026-09.md` …
`…-phase-f-2026-09.md`).

Base: `main` @ `61bdc39` (phase F). Branch: `claude/filtration-status-card-phase-g-w3obxh`.

Presentation only. **Not changed:** the engine (`math.js`, `compute.legacy.js`), the powered-filter 2×
floor, sponge rating / multi-sponge / UGF compatibility / duplicate-filter logic, species, water,
predation and quantity-space rules, saved state (`saved-state.js`), catalog data, cache key
(`ttg.gear.catalog.v4`). `git diff main -- js/logic/compute.legacy.js js/stocking-advisor/filtration/math.js
js/stocking-advisor/filtration/saved-state.js js/gear-data.js assets/data` is empty.

### Baseline on `main` (step 1, before editing)

Confirmed on `61bdc39`: phase B rating model, phase C stale-data protection, phase D instances,
phase E clean sponge catalog / v2-only saves, phase F UGF model, `ttg.gear.catalog.v4`, permanent live
tests (18).

| Suite | Baseline (`main`) |
| --- | --- |
| `npm run test:unit` | 277 / 277 |
| Stocking gate (`CI=1`, desktop + mobile) | 199 passed, 0 failed, 27 skipped |
| `npm run test:stocking:extended` | 105 pairs, 0 failures |
| permanent live files, locally against `main` (static server of a clean worktree) | 18 / 18 |

(Pre-installed Chromium via `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`, as in phases B–F.)

---

## 1. Purpose

Give the filtration result a dedicated, structured explanation in the filter setup area: the verdict,
each path's own evidence (GPH and rated turnover for powered filters, each sponge's rating, the UGF's
listed presets), supplemental devices, a qualitative redundancy line and the permanent Stocking Load
sentence — rendered from `computed.filtering.assessment`, never recalculated.

## 2. Previous UI (audit, step 2)

Traced on `main`:

| Element | Where | Behaviour on `main` |
| --- | --- | --- |
| compact summary | `[data-role="proto-filter-summary"]` (controller `formatSummary`) | `Filtration: 150 GPH • 5.2×/h`; sponges / UGFs by count; **`0 GPH • 0.0×/h` with no filter and with powerheads only** |
| "Estimated turnover" label + compact turnover input | `#filter-turnover`, `#turnoverValue` | the input (and `[data-role="filter-turnover-value"]`) is `display:none !important` (`app.bundle.css`); with the controller owning filters `stocking.js` never writes the source span, so the hidden input sits at `0.0` — invisible and not exposed to assistive tech. The visible turnover is the summary line only |
| filter chips | `[data-role="proto-filter-chips"]` | GPH / sponge rating / UGF compatibility per instance |
| Heads-up note | `.heads-up-note` inside `#filter-turnover` | static cycled-filter note |
| **filtration verdict** | `#stock-warnings` (Current Stock card) | every `filtration.*` warning as a status strip (`filtration.none` amber, `circulation_only` / `very_low` red, `sponge_rated` / `ugf_rated` / `rating_needed` / `ugf_not_listed` neutral "ℹ Note", `likely_multi_sponge` / `below_rating` / `review` amber). Powered-adequate: no strip at all |
| environment card | flow row caption `Turnover: …` (`envRecommend.js`) | `Turnover: 0.0×/h` for powerhead-only (keyed on total GPH incl. circulation) |
| `computed.filtering.status` | consumed only by the filtration drawer path in `stocking.js` (inactive while the controller owns filters) and tests | — |

Duplication: none on `main` (the strips were the only verdict). Once the card exists, the same
filtration message would appear twice (card + strip), in two live regions.

## 3. Final card structure

Location: inside the filter setup area (`.filter-flow-meta` in the tank card), **after** the chips and
the compact summary (`#filter-turnover`), **before** the Heads-up note (moved from inside
`#filter-turnover` to directly after the card; text unchanged) and before the Current Stock card.

```html
<section data-role="filtration-status-card" aria-labelledby="filtration-status-title"
         data-state="warn" data-level="likely-multi-sponge" data-card-state="likely-multi-sponge"
         data-warning-ids="filtration.likely_multi_sponge" data-turnover="none">
  <h3 id="filtration-status-title" data-role="filtration-status-title">Filtration</h3>
  <p data-role="filtration-status-headline" role="status">
    <span data-role="filtration-status-icon" aria-hidden="true">⚠</span><span class="sr-only">Warning: </span><span data-role="filtration-status-headline-text">Likely adequate — multiple sponge filters</span></p>
  <ul data-role="filtration-status-paths">
    <li data-row-kind="path" data-path="sponge" data-instance-id="f-…">Sponge 1: rated 10–40 gal</li>
    <li data-row-kind="path" data-path="sponge" data-instance-id="f-…">Sponge 2: rated 10–40 gal</li>
    <li data-row-kind="fact" data-path="tank">Tank: 55 gal</li>
  </ul>
  <div data-role="filtration-status-explanation"><p>No single sponge is rated for this tank. …</p></div>
  <p data-role="filtration-status-redundancy">Redundancy: 2 biological filters provide backup during maintenance.</p>
  <p data-role="filtration-status-note">Filtration supports your livestock but does not increase stocking capacity.</p>
</section>
```

Code:

- `js/stocking-advisor/filtration/status-view.js` (new) — **pure view model**
  `buildFiltrationCardModel(computed.filtering)` → `{ state, level, headline {tone, icon, iconLabel, text},
  tone, rows[], explanation[], redundancy, note, showTurnover, evaluated, warningIds, adequateBy,
  passingPaths }`. Imports only `math.js`; no DOM; unit-tested in Node.
- `js/stocking-advisor/filtration/status-card.js` (new) — renderer; rebuilds the card only when its
  content signature changes.
- Styling (`css/app.bundle.css`) uses only the card's stable attributes — `data-role` (card, title,
  headline, icon, headline text, paths, explanation, redundancy, note), `data-state` for the tone and
  `data-row-kind` for supplemental / legacy / fact rows. The card has no feature class names (only the
  site's shared `sr-only`), so it adds no Stylelint violations (section 25).
- `js/stocking.js` — `renderAll` renders the card (both the tank and the no-tank branches), so every
  recompute (filter / tank / stock change) updates it.

Row kinds: `path` (a device that decides or is judged), `supplemental` ("+ …", not needed for the
verdict), `fact` ("Tank: 55 gal", "Current tank: 20 High"), `legacy` (old custom sponge value),
`device` (no-stock listing).

## 4. Status / tone mapping

The headline text, icon and tone are the engine's `assessment.status` (`FILTRATION_STATUS`), so no
second severity model exists. The card adds an icon where the engine has none (red / no-filter) and the
status in words for screen readers.

| Engine level | Headline | Tone (`data-state`) |
| --- | --- | --- |
| adequate, `adequateBy` powered / both | ✓ Filtration appears adequate | good |
| adequate, `adequateBy` sponge | ✓ Rated for this tank | good |
| adequate, `adequateBy` ugf | ✓ Undergravel filter rated for this tank | good |
| likely-multi-sponge | ⚠ Likely adequate — multiple sponge filters | warn |
| below-rating | ⚠ Below manufacturer rating | warn |
| review | ⚠ Review filtration | warn |
| very-low | ✖ Filter flow too low | bad |
| circulation-only | ✖ No biological filter | bad |
| none (stock, nothing entered) | ⚠ No filter added | warn (existing) |
| not-evaluated (sponges) | ○ Not evaluated — rating needed | neutral |
| not-evaluated (UGF only) | ○ Rating needed — this undergravel filter isn't listed for this tank size | neutral |
| no stock yet (card state) | ○ Filtration is checked once species are added | neutral |
| no stock, no filter (card state) | ○ Add a filter to check filtration | neutral |
| no tank (card state) | ○ Select a tank to check filtration | neutral |

Screen-reader labels: good "OK", warn "Warning", bad "Problem", neutral "Not evaluated".

## 5. Powered path presentation

One line for the powered path, because the engine evaluates the powered path on its combined rated
biological flow: `Powered filter: 150 GPH · 5.2× / hour (rated)`; two or more:
`Powered filters (2): 350 GPH total · 6.4× / hour (rated)`. "(rated)" marks the manufacturer's rated
flow through media (not a measured flow). Below the floor as the concern (very-low / review /
likely-multi): `… — below the 2× minimum`; beside another passing path it is supplemental:
`+ Powered filter: 40 GPH · 1.4× / hour (rated) — below the 2× powered-filter minimum` (weak fact never
hidden, never turns the green result red). The 2× rule is unchanged (it is the engine's).

## 6. Sponge path presentation

Each sponge's own engine `ratingText`, never a GPH, a turnover or a converted capacity:

- rated for the tank: `Sponge filter: rated 10–40 gal — rated for this tank`, `Tank: 29 gal`,
  "Sponge filters are sized by tank; water flow isn't estimated."
- below rating (sponges only): `Sponge filter: rated 10–40 gal`, `Tank: 55 gal`, "Add another sponge or a
  filter rated for this tank." — amber, never red.
- in review: `Sponge filter: rated up to 20 gal — below this 29 gal tank`.
- unrated: `Sponge filter: Rating needed`; "No verified manufacturer tank rating, so filtration isn't
  evaluated — not adequate, not unsafe." A **custom** unrated sponge (no `productId`) adds "For a custom
  sponge, enter the tank size the manufacturer rates it for (printed on the box or listing)."; catalog
  sponges don't (the user can't enter their rating).
- old custom sponge with migration-only `legacyGph`: an extra line `Old value: 120 GPH — not used for
  sponge filters.` — only when `legacyGph` exists, never scored, never a turnover (design section 12).

## 7. Multi-sponge presentation

`Sponge 1: rated 10–40 gal`, `Sponge 2: rated 10–40 gal`, `Tank: 55 gal`, then "No single sponge is
rated for this tank. Several sponges add media and backup, but their combined capacity isn't
verified." One row per physical sponge from `assessment.sponge.entries` (instanceId identity,
`data-instance-id`); duplicates of one product are never collapsed. The engine's internal sum stays the
yes/no threshold for the amber tier and is never displayed (no "80 gal").

Names: rows use short generic names ("Sponge filter", "Sponge 1", "Undergravel filter", "Powered
filter", "Powerhead"); the chips directly above already carry the full product titles. No catalog name
was changed.

## 8. UGF presentation

- compatible (20l, 29g): `Undergravel filter: rated for 20 Long and 29 Gallon — rated for this tank`,
  "Undergravel filters are checked by the tank sizes the manufacturer lists; water flow isn't
  estimated." — the literal preset set from `formatCompatibleTanks` (phase F), no GPH, no turnover,
  no "20–40", no "20 Long–29".
- not listed (e.g. 20h), UGF only: headline ○ Rating needed — this undergravel filter isn't listed for
  this tank size; rows `Undergravel filter: rated for 20 Long and 29 Gallon`, `Current tank: 20 High`;
  "Not evaluated for this tank — not adequate, not unsafe." Never "unsafe", never "below manufacturer
  rating", no GPH.
- not listed beside another passing path: `+ Undergravel filter: this tank size isn't listed (rated for
  20 Long and 29 Gallon)` — neutral supplemental, the green result stays green.
- tank-unknown / compatibility-unknown (custom tank, offline): neutral wording, no invented presets.

## 9. Powerhead presentation

Alone: `Powerhead: 300 GPH circulation only` under ✖ No biological filter. Beside biological
filtration: `+ Powerhead: 300 GPH circulation only`, one line per device. Never added to the powered
GPH / turnover shown on the card (the engine's biological GPH excludes it), never called filtration,
never counted for redundancy.

## 10. Supplemental-line rules

Every entered device is represented. In an adequate result, devices not on a passing path are listed
after the passing lines with a "+ " prefix and `data-row-kind="supplemental"`: unrated or undersized
sponges ("+ Additional sponge filter: …", **not** flagged below rating), a powered filter below the
floor, a UGF not listed, powerheads. In likely-multi / below-rating an unlisted UGF and powerheads are
supplemental too. Nothing is summed across lines.

## 11. Redundancy line

With **two or more biological filter instances** (`assessment.filters` with role biological —
powered, sponge, UGF; each duplicate instance counts; powerheads don't; one UGF maximum by the phase D
rule): `Redundancy: N biological filters provide backup during maintenance.` Neutral, in every state
that lists devices. It says nothing about capacity (tested against "double", "twice", "capacity",
"gal").

## 12. Permanent Stocking Load line

`Filtration supports your livestock but does not increase stocking capacity.` is the last line of
**every** card state — green, amber, red, neutral, no filter, no stock, no tank, rating needed, UGF —
unconditionally (`model.note`; unit-tested for all 30 fixtures and for 3,120 differential scenarios).

## 13. Turnover visibility rule

A numerical filtration turnover appears only with **powered biological GPH** (`model.showTurnover`,
card `data-turnover="powered"`):

| Plan | Compact summary | Card | Env card caption |
| --- | --- | --- | --- |
| powered | `Filtration: 150 GPH • 5.2×/h` (unchanged) | `150 GPH · 5.2× / hour (rated)` | `Turnover: 5.2×/h` |
| powered + sponge / UGF | `Filtration: 150 GPH • 5.2×/h + 1 sponge filter (rated by tank size)` (unchanged) | powered line only carries turnover | powered only |
| sponge-only | `Filtration: 1 sponge filter (rated by tank size)` (unchanged) | no GPH / turnover | `Turnover: —` (unchanged) |
| UGF-only | `Filtration: 1 undergravel filter (rated for listed tanks)` (unchanged) | no GPH / turnover | `Turnover: —` (unchanged) |
| powerhead-only | **`Filtration: no biological filter (+300 GPH circulation only)`** (was `0 GPH • 0.0×/h (+…)`) | circulation line, no × | **`Turnover: —`** (was `0.0×/h`) |
| no filter | **`Filtration: no filter added`** (was `0 GPH • 0.0×/h`) | no GPH | `Turnover: —` (unchanged) |

Chosen solution: text instead of a zero figure in the compact summary (the "Estimated turnover" label
and its info tooltip stay), and "—" in the env caption (its existing not-applicable form). The
permanently hidden `#turnoverValue` input was left alone (not visible, not exposed). Only
`controller.formatSummary`, the static initial summary text in the page and one condition in
`envRecommend.js` changed; no calculator input changed (the controller's `appState.turnover` etc. are
untouched).

## 14. Generic-warning duplication decision (step 34)

With the card, every filtration warning would be shown twice (card + `#stock-warnings` strip, both
live regions). Decision, as preferred:

- the filtration warning objects, ids, severities and messages are **unchanged** in
  `computed.filtering.warnings` and `computed.status.warnings` (and in computed status issues);
- `stocking.js renderStockWarningsPanel` leaves out only warnings with `kind: "filtration"` / id
  `filtration.*`; **no** other kind is filtered (aggression, tank size, predation, water, social / group,
  species data — covered by the gate and the phase G "non-filtration warnings stay" test);
- the card exposes the engine's filtration warning ids in `data-warning-ids`, so tests and other
  consumers can still address them;
- the candidate preview ("If you add …") panel is unchanged: it shows what a preview would add, which
  the card (no-stock state) does not duplicate.

## 15. Accessibility

Semantic `<section>` labelled by an `<h3>Filtration</h3>` (page card titles are h2). The headline is
the card's only live region (`role="status"`, polite, atomic by role); the card is not inside another
live region (the Heads-up note and card sit outside `#filter-turnover`'s `aria-live`). The renderer
rebuilds only when the content signature changes, so unrelated recomputes don't re-announce (browser
test). Meaning never depends on colour: an icon (✓ ⚠ ✖ ○, `aria-hidden`), the status in words
("OK: / Warning: / Problem: / Not evaluated:", `sr-only`) and the headline text itself. No custom ARIA
widgets; plain list for rows. Contrast: body text `var(--fg)`, secondary lines `var(--muted)` on the
site's raised card background, the same tokens the warning strips use; the red strips' `role="alert"`
for filtration no longer fires from `#stock-warnings` (the card's polite status replaces it — one
announcement per change).

## 16. Mobile behaviour

Pixel 5 project (393 px): no page overflow, card and rows never clipped, long lines wrap
(`overflow-wrap: anywhere`), headline wraps under its icon, the permanent line and the redundancy line
visible, text ≥ 14 px (asserted; note measured 14.4 px), chip remove buttons still usable (browser test).
Card heights, desktop / mobile: powered 150 / 186 px; powered + sponge + powerhead 231 / 329;
rated sponge 204 / 261; likely-multi 260 / 379; review 235 / 353; rating needed 178 / 258;
UGF compatible 178 / 279; UGF not listed 233 / 376 (397 before the shortened explanation, section 22);
powerhead only 199 / 256.

## 17. Common-case matrix (design 4.5, browser, desktop + mobile)

| # | Setup | Card |
| --- | --- | --- |
| A | 29g + 150 GPH HOB | ✓ Filtration appears adequate · `Powered filter: 150 GPH · 5.2× / hour (rated)` |
| B | 29g + 150 HOB + 20-gal sponge | ✓ adequate · powered path · `+ Additional sponge filter: rated up to 20 gal` (no "below") |
| C | 29g + 100 HOB + 40-gal sponge | ✓ adequate · `Powered filter: 100 GPH · 3.4× / hour (rated)` · `Sponge filter: rated up to 40 gal — rated for this tank` |
| D | 55g + 200 canister + 40-gal sponge | ✓ adequate · `Powered filter: 200 GPH · 3.6× / hour (rated)` · `+ Additional sponge filter: rated up to 40 gal` |
| E | 55g + Hygger S | ⚠ Below manufacturer rating · `Sponge filter: rated 10–40 gal` · `Tank: 55 gal` |
| F | 55g + 2 × Hygger S | ⚠ Likely adequate — multiple sponge filters · `Sponge 1` / `Sponge 2: rated 10–40 gal` · no 80 |
| G | 29g + Hygger S | ✓ Rated for this tank · `Sponge filter: rated 10–40 gal — rated for this tank` |
| H | 29g + 40 HOB + 20-gal sponge | ⚠ Review filtration · powered below 2× · sponge below this 29 gal tank · "Neither filter…" |
| U | unrated sponge | ○ Not evaluated — rating needed · `Sponge filter: Rating needed` |
| — | 29g + 40 HOB + Hygger S | ✓ Rated for this tank · `+ Powered filter: … below the 2× powered-filter minimum` |
| — | 29g + 40 HOB + unrated sponge (current engine: review) | ⚠ Review filtration · powered below-floor line · `Sponge filter: Rating needed` (unit) |

## 18. UGF matrix

| Setup | Card |
| --- | --- |
| 29g / 20l + Penn-Plax | ✓ Undergravel filter rated for this tank · `rated for 20 Long and 29 Gallon — rated for this tank`, no GPH |
| 20h + saved Penn-Plax | ○ Rating needed — … isn't listed … · `Current tank: 20 High`, no GPH, not "unsafe" |
| UGF + powerhead (29g) | ✓ from UGF · `+ Powerhead: 300 GPH circulation only` · no redundancy line |
| UGF + weak powered (29g) | ✓ from UGF · `+ Powered filter: 20 GPH · 0.7× / hour (rated) — below the 2× powered-filter minimum` |
| UGF + Tetra IQ 45 (29g) | ✓ Filtration appears adequate · powered and UGF path lines (unit) |
| UGF not listed + weak powered (20h, current engine: review) | ⚠ Review filtration · powered below-floor line · `Undergravel filter: this tank size isn't listed (…)` (unit) |
| UGF not listed + passing powered (20h) | ✓ adequate · `+ Undergravel filter: this tank size isn't listed (…)` |
| UGF + Hygger S / + unrated sponge (29g) | both paths / `+ Additional sponge filter: Rating needed` (unit) |
| 29 → 20h → 20l | good → neutral → good, same `f-…` instance (browser) |

## 19. Calculation differential (step 47)

Node differential, clean `main` worktree vs branch: 10 presets × 4 stocks (none; neon; neon + cory;
angelfish + neon) × 78 filter sets (none; each of the 41 catalog products; 2 × each sponge; 2 × Tetra /
AC70 / Fluval 307 / EHEIM 2213; custom HOB 150 / 40 / 1, canister 200, powerhead, 2 powerheads; custom
sponges 10 / 20 / 40 / 999, 2 × 20; legacy custom sponge (legacyGph 120); powered + sponge mixes; UGF
mixes; everything) = **3,120 scenarios**, deterministic instance ids. Compared per scenario: the
complete computed state (includes level, adequateBy, passingPaths, GPH totals, turnover, sponge / UGF
assessments, filtration warnings, species / water / predation / quantity-space results), the filtering
state alone, Stocking Load and the written v2 entries.

| Compared | Differences |
| --- | --- |
| full computed state | **0** |
| `computed.filtering` | **0** |
| Stocking Load | **0** |
| written v2 (`serializeFilters`) | **0** |

Branch-only checks over the same 3,120 scenarios: card model built for every one; permanent sentence
present in all; **0** forbidden claims (combined gallons, 80 gal, capacity bonus, sponge / UGF GPH or
turnover, UGF range); Stocking Load with filters equals the same stock without filters in all 3,120.

Presentation differences only: the card; filtration strips no longer repeated in `#stock-warnings`;
the compact summary and env-card caption for no-filter / powerhead-only plans (section 13).

## 20. Stocking Load result

Identical with and without filters for every card scenario (no filter, powered, sponge, duplicate
sponges, UGF, powered + sponge, UGF + powered, powerhead): unit test over 4 presets × 8 setups,
`capacityAdjustment` 0; every phase G browser test (`load` equals the same stock with no filters);
and the 3,120-scenario differential.

## 21. Test results

| Suite | Result |
| --- | --- |
| `npm run test:unit` | **307 / 307** (277 on `main` + 30 new) |
| phase G unit (`filtration-status-card-phase-g.test.mjs`) | 30 / 30 — fixtures A–X plus O2, P2, S2, engine-agreement, Stocking Load, redundancy-claims |
| phase B / C / D / E / F / saved-state / Tetra IQ 45 unit | all pass (unchanged files) |
| phase G browser (`stocking-advisor-filtration-card-phase-g.spec.ts`, desktop + mobile) | **48 / 48** |
| Stocking gate (`CI=1`, desktop + mobile) | **247 passed, 0 failed, 27 skipped** (`main`: 199 / 0 / 27; +48 phase G runs) |
| `npm run test:stocking:extended` | 105 pairs, 0 failures (generated report not committed) |
| permanent live files, locally against the branch (`BASE_URL` = local static server) | **18 / 18** (`stocking-advisor-saved-filters.live.ts` 13, `stocking-advisor.live.ts` 5). A first run made while the full gate was running in parallel had one setup timeout (species row not shown in time, before any filtration step) and one real assertion ("20 High" forbidden in filter text, now allowed only as `Current tank: 20 High`); after that fix, run without the parallel gate: 18 / 18 |
| permanent live files, locally against `main` (updated tests) | **18 / 18** — the updated live tests still pass against pre-G code |
| `guard:live`, `audit:controls` | pass |
| Stylelint (`npm run lint:css`) | `main` 14,060 problems → branch 14,060: **Phase G delta 0** (bundle alone: 3,285 → 3,285). The repository still carries this historical debt; see section 25 |

Existing tests changed — presentation assertions only (the engine assertions are untouched):

| File | Change |
| --- | --- |
| `stocking-advisor-gate.spec.ts` | `warning()` routes `filtration.*` ids to the card; `filtrationWarnings` = card with warning ids; powerhead summary `Filtration: no biological filter (+200 GPH circulation only)`; `expectShown` reads the card headline's "Problem: / Warning:" |
| `stocking-advisor-sponge-phase-b.spec.ts` | same helper; rated card `data-state` good (was strip "ok"), rating-needed neutral; card line text for rated / below / review / sponge-carrying-weak-HOB |
| `stocking-advisor-duplicate-filters.spec.ts` | same helper; two per-instance sponge rows (`Sponge 1/2: rated 10–40 gal`, was "(S) 1 / (S) 2"); unrated wording |
| `stocking-advisor-ugf-phase-f.spec.ts` | same helper; passing card headline + listed-preset line; unlisted UGF supplemental line |
| `stocking-advisor-sponge-phase-e.spec.ts` | same helper |
| phases B / C / D / E / F `filtrationText` | also read the card; the one permitted `Old value: N GPH — not used for sponge filters.` line is removed before the legacy-GPH scans (its exact wording is pinned by the phase G tests) |
| `tests/live/stocking-advisor-saved-filters.live.ts` | deploy-tolerant: `filtrationSignal()` matches the pre-G strip **or** the card; below-rating text `10–40 gal` + `55 gal`; the card is included in `filterText`; UGF status text without the icon; "20 High" allowed only as `Current tank: 20 High` |
| `playwright.stocking-gate.config.ts` | adds the phase G spec |

## 22. Screenshot / visual review

Desktop and mobile screenshots of: powered adequate, powered + sponge + powerhead, rated sponge,
likely-multi, review, rating needed, compatible UGF, non-compatible UGF, powerhead only (18 images,
taken locally; not committed). Review:

- hierarchy: small uppercase "FILTRATION" label → bold headline with icon → path lines → muted facts /
  supplemental lines → explanation → redundancy → note above a divider. Tone shown by the left border,
  a light tint and the icon, matching the warning strips' good / warn / bad colours.
- repeated text: the not-listed UGF explanation first restated the headline; shortened to "Not
  evaluated for this tank — not adequate, not unsafe." The Heads-up note (cycled-filter advice) was
  moved below the card so the summary and the card read together.
- duplicated warnings: none (filtration strips no longer in `#stock-warnings`).
- height: 150–260 px desktop, 186–397 px mobile (tallest: UGF not listed on a phone); no decorative
  elements added.
- overflow / wrapping: none; long product names stay in the chips (pre-existing chip truncation on
  phones unchanged).

## 23. Permanent live test (step 52, added in review follow-up — section 26)

First recommended, then added after review as the one permanent phase G check (section 26). The
existing live suite validates the engine extensively; this test covers the card itself, on the
multi-sponge case that most directly guards the "no combined capacity" rule.

## 24. Remaining non-phase-G issues

- The hidden `#turnoverValue` prototype input (always `display:none`) still holds a stale `0.0`; it is
  dead UI and could be removed in a cleanup.
- Pre-existing: phone chips truncate long product names ("P.."); `#stock-list-card` is a whole-card
  `aria-live` region.
- Design section 16 open items are unchanged (powered 2× floor questions, unverified Penn-Plax source,
  "and up" sponge products, `flowAdjustment` export estimate).

## 25. Review follow-up: no new Stylelint debt

Review blocker: the first pass styled the card with feature classes (`filtration-status`,
`filtration-status__title`, `__headline`, `__icon`, `__headline-text`, `__paths`, `__row`,
`__explanation`, `__redundancy`, `__note`). The project's `selector-class-pattern` only approves the
`proto-home` / `btn` / `u-` / `is-` / `has-` prefixes, so the block added 23 violations
(`npm run lint:css`: `main` 14,060 → 14,083; bundle alone 3,285 → 3,308).

Fix (selectors / markup only — no wording, tone, status, row, redundancy, warning-suppression,
accessibility, layout, Stocking Load or turnover change):

- the card CSS now selects the existing stable attributes: `[data-role="filtration-status-card"]` with
  `[data-state="good|warn|bad"]` and `[hidden]`; `[data-role="filtration-status-title"]`,
  `…-headline`, `…-icon`, `…-headline-text`, `…-paths` (rows by `> [data-row-kind="supplemental|legacy|fact"]`),
  `…-explanation`, `…-redundancy`, `…-note`. Attribute selectors carry the same specificity as the
  classes they replace, so the cascade is unchanged;
- every Phase G class was removed: `class="filtration-status"` from the static root in
  `stocking-advisor.html`, and all ten classes from the generated elements in `status-card.js` (the
  title, icon and headline text got `data-role`s instead); the shared `sr-only` stays;
- the phase G browser spec reads the headline text by `data-role` instead of a class.

| Stylelint (`npm run lint:css`, whole repository) | Problems |
| --- | --- |
| `main` (`61bdc39`) | 14,060 |
| phase G first pass (`9ff98f9`) | 14,083 (+23) |
| **phase G final** | **14,060 (delta 0)** |

The violation list with line numbers removed is identical to `main`'s, and no error falls inside the
card's CSS block. No `stylelint-disable` directive was added (none exists in the bundle).

Visual regression: the same 9 states × desktop and mobile were rendered from the first-pass commit and
from the fix. The computed styles (margin, padding, borders, radius, background, colour, font size /
weight, line height, letter spacing, text transform, display, gap, list style, alignment) and the
position and size of every card element are byte-identical in all 18 scenes; 15 / 18 area screenshots
are pixel-identical, the other 3 differ only outside the card (chip row / a 1 px taller capture area,
changing between runs). No overflow; the permanent note and redundancy line keep their styling.

Functional regression after the fix: unit 307 / 307; gate (with the phase G spec, 48 / 48) 247 passed, 0 failed, 27 skipped;
extended 105 pairs / 0 failures; permanent live locally against the branch 18 / 18; 3,120-scenario differential
0 differences.

## 26. Review follow-up: permanent phase G live test

Added to `tests/live/stocking-advisor-saved-filters.live.ts` (same file, same helpers: `trackErrors`,
`openAdvisor`, `setUp`, `chip`, `settle`, `snapshot`), one test:

`phase G: filtration card for 55 gal + 2 × hygger Double Sponge S — amber likely-multi, one row per
physical sponge, no combined capacity`

Fresh browser context (Playwright default per test), 55 gal, 8 Neon Tetras, no seeded filters. The
filters are added through the real picker: select hygger Double Sponge S once, **Add Selected twice**
(the phase D duplicate path).

| Step | Asserted (card read only through `data-role` / `data-*` attributes) |
| --- | --- |
| before filters | exactly one card, `data-level="none"` (existing "No filter added" state) |
| card | exactly one, visible; `data-state="warn"`; `data-level="likely-multi-sponge"`; `data-warning-ids` contains `filtration.likely_multi_sponge`; the engine agrees (level, status `⚠ / Likely adequate — multiple sponge filters / warn`, warning ids) |
| headline | `[data-role="filtration-status-headline"]` contains "Likely adequate — multiple sponge filters" (no icon markup required) |
| two physical sponges | two `li[data-path="sponge"]` rows, text `Sponge 1: rated 10–40 gal` / `Sponge 2: rated 10–40 gal`; both `data-instance-id`s present, different from each other and equal to the two chips' instance ids; fact row `Tank: 55 gal` |
| **no combined capacity (hard)** | card text has no `80` and no `80 gal`; the explanation contains the one allowed sentence ("… their combined capacity isn't verified."); with that sentence and the permanent sentence removed, no `combined`, `total capacity / rating / gallons`, `capacity bonus`, `extra (stocking) capacity`, `double`, `twice`; no `GPH`, `×` or `turnover` anywhere on the card |
| redundancy | exactly `Redundancy: 2 biological filters provide backup during maintenance.` |
| permanent sentence | `[data-role="filtration-status-note"]` visible, exactly "Filtration supports your livestock but does not increase stocking capacity." |
| no duplicate | no `#stock-warnings [data-warning-id^="filtration."]` |
| Stocking Load | DOM load equal to the same stock before any filter; engine load equal to the no-filter computation |
| remove one instance | card follows without reload: `below-rating`, still `warn`, one row `Sponge filter: rated 10–40 gal` carrying the **remaining** instance id, no redundancy line, permanent sentence, no `80` / `GPH` |
| errors | no page errors, no site-script console errors |

Validation (local static servers only; **not run against production**, which is still phase F):

| Target | Result |
| --- | --- |
| branch, new test alone | 3 / 3 passes |
| branch, full permanent live suite | **19 / 19** (`stocking-advisor-saved-filters.live.ts` 14, `stocking-advisor.live.ts` 5) |
| `main` (phase F) application code, full suite | 18 passed, 1 failed — the new test, at its first card assertion (`card` count 1), as intended |
| mutation: an "Combined rating: 80 gal." sentence added to the multi-sponge explanation | fails (`/\b80\b/`) |
| mutation: "Their total capacity is enough for this tank." added | fails (combined / total-capacity check) |
| mutation: sponge rows collapsed to one | fails (two sponge rows) |

Mutations were applied temporarily to `status-view.js` and reverted; no application code changed in
this follow-up. **Run the live-verify workflow only after phase G is merged and deployed**: this test
fails against phase F production by design (the other 18 tests pass on both).

## Files changed

- `js/stocking-advisor/filtration/status-view.js` (new) — pure card view model.
- `js/stocking-advisor/filtration/status-card.js` (new) — card renderer.
- `js/stocking.js` — renders the card on every recompute; `#stock-warnings` leaves out filtration-kind warnings.
- `js/stocking-advisor/filtration/controller.js` — compact summary: no zero turnover without powered biological flow.
- `js/logic/envRecommend.js` — env-card turnover caption "—" without powered biological flow.
- `stocking-advisor.html` — card container, Heads-up note moved after it, initial summary text, stylesheet version.
- `css/app.bundle.css` — card styles (data-attribute selectors).
- `data/stocking-advisor/FILTRATION_MODEL.md` — §3.1 filtration status card.
- Tests: `tests/unit/filtration-status-card-phase-g.test.mjs` (new), `tests/stocking-advisor-filtration-card-phase-g.spec.ts` (new), `playwright.stocking-gate.config.ts`, and the updates in section 21.
- `tests/live/stocking-advisor-saved-filters.live.ts` — also the permanent phase G card test (section 26).
- `_internal/reports/stocking-advisor-sponge-migration-phase-g-2026-09.md` (this report).
