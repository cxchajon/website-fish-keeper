# Stocking Advisor: candidate quantity preview fix

Date: 2026-09-26 · Branch: `claude/stocking-advisor-qty-preview-eaa5eq` (from `main` at `558c728`)

Scope: one bug. Changing the candidate quantity did not always update the preview. Not changed:
filtration thresholds, the Phase 2C filtration model, bioload, species data, predation rules, water
rules, and the results UI.

## 1. Reproduction

Sequence (production/main, desktop and mobile):

1. Open `/stocking-advisor.html`.
2. Select a tank (20 gal high).
3. Select a species, for example Cardinal Tetra.
4. Wait for the preview to render (anything over ~160 ms is enough).
5. Change the quantity field from 1 to 6. Do not click Add.
6. The preview still reads "If you add 1 × Cardinal Tetra:" and "Planned: 1". The field shows 6 and
   `appState.candidate.qty` is `"6"`.

Matrix run on main: 5 species (Cardinal Tetra, Neon Tetra, Tiger Barb, Bronze Corydoras, Molly), 7
input patterns, desktop (Desktop Chrome) and mobile (Pixel 5). Each case used a fresh page.

| Pattern | Result on main |
|---|---|
| Select species, type qty **within** ~160 ms (no wait) | Correct, by luck of timing |
| Select species, wait, type qty, stay in the field | **Stale: evaluates 1** |
| Select species, wait, type qty, then blur (tab / tap away) | **Stale: evaluates 1** |
| Select species, wait, `fill` qty, then blur | **Stale: evaluates 1** |
| Type qty on species A, then change to species B | Correct (the species change recomputes) |
| Type qty, wait, click Add | Correct stock quantity (6) |
| Type qty, wait, press Enter | Correct stock quantity (6) |

What it depends on:

- **Timing, not input method.** The preview is stale whenever the quantity changes after the species
  recompute has already run (160 ms debounce). Typing fast enough right after picking a species
  "works" because the pending species recompute picks the new quantity up.
- **Direct typing vs. programmatic fill:** both are affected.
- **+/- controls:** the candidate row has no +/- buttons. The only +/- buttons belong to stock rows
  after Add, and they always recomputed correctly. Not affected.
- **Species first vs. quantity first:** quantity first, then species, is correct, because the species
  change recomputes.
- **Desktop vs. mobile:** both are affected. A dedicated mobile probe went stale 10/10 times. In the
  wider matrix, mobile looked better (1/5 species stale) only because an unrelated later recompute
  happened to fire after the typing on those pages. Any recompute from another control (tank,
  filter, `ttg:recompute`) fixes the preview until the next quantity edit. That is why the bug looked
  intermittent.

## 2. Root cause

`js/stocking.js` `bindInputs()` wired the quantity field like this:

```js
refs.qty.addEventListener('input', (event) => {
  ...
  state.candidate.qty = raw;      // state updated
  syncCandidateControls();        // Add button enabled/disabled
});                               // no recompute scheduled

refs.qty.addEventListener('blur', () => {
  const previous = state.candidate?.qty;          // already "6", set by the input handler
  const normalized = commitCandidateQty();        // "6"
  if (previous !== normalized) scheduleUpdate();  // "6" === "6", so no recompute
});
```

- The `input` handler updated the state but never asked for a recompute.
- The `blur` handler compared the normalized value with the state that the `input` handler had
  **already** updated. For any valid entry they are equal, so blur never recomputed either. It only
  recomputed when normalization changed the text (empty → 1, `08` → 8, over 999 → 999).
- So nothing re-ran `buildComputedState()` for the new quantity. The last render, made at the old
  quantity (usually 1 from the species change), stayed on screen.

The state value was never wrong or reset. No render overwrote it, no DOM node was replaced, and no
old debounced recompute landed after a newer one. The preview simply was never recomputed. Add was
never affected: `addCurrentSelection()` reads the field (`getQty()`), which always matched the state.

## 3. State ownership

`state.candidate` (`window.appState.candidate`) is the single owner:

- `candidate.id` is set by the species `<select>` change handler, and by `populateSpecies()` when the
  list is rebuilt.
- `candidate.qty` is a digit string, set by the quantity `input` handler, normalized by `blur`, and
  reset to `'1'` after Add.

The DOM field mirrors it: `syncQtyInputFromState()` writes state → field on every render, except
while the field has focus, so a render never overwrites what the user is typing. The preview reads
only `state`: `runRecompute()` → `renderAll()` → `buildComputedState(state)`. No second owner was
added.

## 4. Previous and corrected flow

Previous:

```
species change ─▶ state.candidate.id ─▶ scheduleUpdate() ─(160 ms)─▶ renderAll(state)   ✔
qty input      ─▶ state.candidate.qty  (nothing scheduled)                              ✘ preview stale
qty blur       ─▶ normalize; recompute only if the text changed                         ✘ usually no-op
Add            ─▶ reads field ─▶ advisor:addCandidate ─▶ stock ─▶ scheduleUpdate()     ✔
```

Corrected:

```
qty input      ─▶ state.candidate.qty ─▶ if valid: scheduleUpdate() ─(160 ms)─▶ renderAll(state)
qty blur       ─▶ normalize; recompute if the text changed (empty/partial → 1, etc.)
```

The debounced recompute reads `state` when it fires, not when it is scheduled. Each new edit restarts
the timer. So rapid edits (1 → 3 → 6 → 8) collapse into one recompute at the last value, and an
older value can never be rendered after a newer one. There is no timeout increase. The existing
160 ms debounce is reused unchanged.

An empty or leading-zero entry (`""`, `08`) is not valid, so it does not recompute on input. The
preview keeps its last valid quantity and Add stays disabled. On blur the value is normalized and
recomputed, which is the existing behaviour.

Species change keeps the entered quantity (unchanged behaviour). Only Add resets it to 1.

## 5. Files changed

| File | Change |
|---|---|
| `js/stocking.js` | Quantity `input` handler calls `scheduleUpdate()` when the entry is a valid quantity (+6 lines, including a comment). |
| `tests/stocking-advisor-gate.spec.ts` | New `candidate quantity preview (desktop and mobile)` block with 9 tests, run in both projects (18 runs). |
| `_internal/reports/stocking-advisor-quantity-preview-fix-2026-09.md` | This report. |

The `stocking.js?v=` query string in `stocking-advisor.html` was not bumped. It matches Phases
2C–2E, which changed `stocking.js` without bumping it.

## 6. Tests added

Every test changes the quantity only after the species preview has fully rendered, reads what is on
screen (the preview lead "If you add N × …", candidate warnings), and checks that the field and
`appState.candidate.qty` agree.

| Case | Test |
|---|---|
| A | Cardinal Tetra: preview at 1 (group warning "Planned: 1") → `fill` 6 → preview 6, group warning cleared, one control of each kind, no horizontal overflow. |
| B | Neon Tetra, typed keystrokes, focus kept: 1 → 3 ("Planned: 3") → 6 (warning cleared). |
| C | Tiger Barb, in-place digit edits (Backspace + digit) → 7 → 8. Stock-row +/- after Add still update the warning (7 ↔ 8). The candidate row has no +/- buttons, so keyboard step edits stand in for them. |
| D | Cardinal → qty 6 → Tiger Barb: the quantity is kept for B, and B's preview evaluates 6. |
| E | Bronze Corydoras: typed 6 after render → Add → stock row 6, and the candidate resets to 1. Molly: typed 4 → Enter → stock row 4. |
| F | Tiger Barb typed 3, 6, 8 back to back → preview 8. Then `fill` 2, 5 within the debounce → preview 5, "Planned: 5". |
| extra | Clearing the field: Add is disabled, blur restores 1 and re-evaluates ("Planned: 1"). |
| Step 5 | Pea Puffer in 5 gal: the typed 6 raises red `tank.group_volume` in the preview, and the typed 1 clears it. |
| Step 5 | Angelfish in 29 gal with 8 neons: the typed 3 raises the projected load above qty 1, and the red tank-volume warning stays. |

Neon 1/3/6 group-warning behaviour is covered by B. Cardinal shrimp predation severity (amber,
juvenile only) is covered by the existing `invert predation: juvenile-only shrimp risk is amber` test,
which still passes.

Proof that the tests catch the bug: with the `js/stocking.js` change reverted, **all 18 new runs fail**.
With the fix, all pass.

## 7. Results

| Check | Result |
|---|---|
| Unit tests (`npm run test:unit`) | 112 / 112 pass |
| Before/after matrix (5 species × 7 patterns × 2 viewports = 70 cases) | main: 18 stale · fix: 0 stale (70 / 70 evaluate 6) |
| New quantity tests, `--repeat-each=10`, desktop + mobile | 180 / 180 pass |
| Full Stocking Advisor gate (`playwright.stocking-gate.config.ts`) | 95 passed, 27 skipped (project-scoped by design), 0 failed |

Gate coverage that stayed green: all 44 species load, Phase 2B stocking load (angelfish / pleco /
mixed 20 long), Phase 2C filtration (powerhead, 1 GPH canister, large filter, catalog product flows),
Phase 2D water, Phase 2E warning visibility and persistence (stock and candidate), Phase 2G predation,
add/remove and stock +/- controls, filter controls, tank-size controls.

One transient failure in the first full-gate run: `invert predation: cherry-specific data is not
applied to Amano Shrimp` (desktop), under 4-worker load. It passed on an immediate re-run, 80/80 in a
`--repeat-each=8` stress run of the invert-predation tests, and in a second full-gate run. It does not
touch candidate-quantity behaviour, since it adds through `addSpecies` (fill → Add). An unmodified `main`
checkout, run through the same gate under the same load, also had one transient failure in a different
`addSpecies` test: `6 angelfish in a 20 gallon is not a normal green result`, where the stock row never
appeared (76 passed, 1 failed). So the gate has a load-timing flake that predates this change (§8).

## 8. Unrelated issues found (not fixed)

- **Bioload bar ignores the candidate when stock is empty.** With no species in stock, the bars
  render the "empty" state ("0% → 0% of capacity"), even though the engine's projected load for the
  candidate is non-zero (6 angelfish in 29 gal: engine proposed 265%). The projection shows only once
  something is in stock. This is outside this phase (results UI).
- **The mobile bioload bar shows current stock only.** The phone bar displays `currentPercent` and
  never the "current → projected" figure. The candidate's effect on load is only visible on desktop,
  or through warnings. This is a design choice or UI gap for the results-UI phase.
- **The candidate row has no +/- quantity buttons** (only a text field). Noted because the phase brief
  assumed them. No UI was added.
- **The gate is flaky under 4-worker load (pre-existing).** One run of an unmodified `main` failed
  `6 angelfish in a 20 gallon…`, where the stock row never appeared after `addSpecies`. It passes on
  re-run. The flake appears to be in the Add step when several browsers run at once. It was not
  investigated further.
