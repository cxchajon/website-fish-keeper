# Stocking Advisor — Phase 2D water parameters / hidden assumptions audit (2026-09)

Scope: whether the advisor presents assumed water parameters as the user's measurements, and replacing
that with an unknown-vs-entered model. The Phase 2B bioload model, the Phase 2C filtration model, page
design, custom tank dimensions, ads/consent and page weight are out of scope and unchanged.
New methodology: `data/stocking-advisor/WATER_MODEL.md`.

## 1. The page has no water inputs

`stocking-advisor.html` has no temperature, pH, GH, KH, flow or blackwater field, and `js/stocking.js`
never writes `state.water`. (`#conditions-list`, the old conditions list, is not in the page either, so
`renderConditions` in `js/logic/ui.js` renders nothing.) Every water value the engine used was a default
the user never saw and could not change.

## 2. Hidden defaults before this phase

Two layers, both in `js/logic/compute.legacy.js`:

| Parameter | `createDefaultState().water` | `sanitizeWater` fallback | Visible? | Editable? | Persisted? |
| --- | --- | --- | --- | --- | --- |
| Temperature | 78 °F | `\|\| 78` | no | no | no |
| pH | 7.2 | `\|\| 7` | no | no | no |
| GH | 6 dGH | `\|\| 6` | no | no | no |
| KH | 3 dKH | `\|\| 3` (also turned an entered 0 into 3) | no | no | no |
| Flow | `'moderate'` | `\|\| 'moderate'` | no | no | no |
| Blackwater | `false` | `Boolean()` | no | no | no |
| Salinity | `'fresh'` | `'fresh'` | no (species filter only) | no | no |

Other hidden assumptions: `evaluateInvertSafety` read `water.gH ?? 0` (an unknown GH counted as 0);
`evaluateFlow` defaulted the tank to `'moderate'`; `compatScore` returned **"Optimal"** for a missing
value (a false pass); the gear hand-off wrote `heater.temp_target_F: 78` (unused by the gear page).

## 3. Old path and effect on status

```
createDefaultState().water ─► sanitizeWater (fallbacks) ─► computeConditions
   ├─ conditionState(default value, shared species range) ─► severity ok/warn/bad
   │     ├─ computeChips: "gH: ✖ Outside range" chips        (candidate / preview only)
   │     └─ computeStatus: first bad/warn condition ─► status.severity + label  (stock AND candidate)
   ├─ evaluateFlow(species flow vs 'moderate')      ─► "Adjust flow pattern" / "Flow rate unsuitable"
   ├─ evaluateBlackwater(prefers vs false)           ─► amber "Prefers tannin-rich water"
   └─ evaluateBlackwater(requires vs false)          ─► red "Requires tannins / blackwater"
compute.js buildCompatibilityMap(candidate, water)   ─► "pH: Incompatible", "General hardness: Tolerable (not ideal)"
evaluateInvertSafety(snail, gH)                      ─► "Low gH risks shell health"
```

Candidate evaluation: chips + status. Existing-stock evaluation: status (condition ranges are computed
over stock + candidate). The Environmental Recommendations card (`envRecommend.js`) never used
`state.water`; it shows shared species ranges and species-only conflicts, and was already correct.

Measured on `main` (each species previewed alone in a 125 gallon with an adequate filter):

| | before | after |
| --- | --- | --- |
| Species showing ≥ 1 water chip from hidden values | **39 / 44** | 0 / 44 |
| …with a red water chip | **13** | 0 |
| Species whose engine status is red from water alone (in stock, no candidate) | **6** — Molly, Platy, Swordtail, White Cloud, Hillstream Loach, Blue Ram | 0 |

Chip types seen on `main`: "Adjust flow pattern" ×28, "Flow…" ×28, "General/Carbonate hardness…" ×11
each, pH ×10, Temperature ×9, "Prefers tannin-rich water" ×7, gH ×6, kH ×3, "Requires tannins" ×1.

## 4. Options considered

1. **Remove hidden defaults; unknown until entered** — chosen. No invented values, no state flags to
   keep in sync, and it composes with a future input UI (a field writes a number or clears to null).
2. Keep defaults internally but ignore them until "confirmed" — needs a parallel confirmed-flag per
   field that every consumer must check; one missed check (as `compatScore` and
   `evaluateInvertSafety` show) reintroduces the bug.
3. Neutral reference values for display only — the advisor has nothing to display them in, and a
   labelled "example 7.2" still reads as a claim next to a pass/fail hint.

## 5. New model (summary — see WATER_MODEL.md)

- `state.water` temperature/pH/GH/KH/flow/blackwater default to `null`; `sanitizeWater` keeps only real
  entries (0 dKH now valid) and exposes `water.entered`.
- Unknown → `status: 'not-entered'`, severity ok, hint "Not entered"; `compatScore` → "Not evaluated".
- Entered → compared with the shared range (highest min → lowest max); outside produces a chip and a
  `water.<key>.outside` stock warning naming the entered value and the shared range.
- Species with no shared range → `species-conflict` from species data alone (temperature/GH/KH red;
  pH red with a pH-sensitive species, else amber). Across all 946 species pairs: temperature 46,
  GH 61, KH 58, pH 50 (12 red, 38 amber).
- Flow compared only with an entered tank flow. Blackwater "prefers" is a tip; "requires" is amber when
  unknown, red only when the user says tannins are off. Snail shell warning only with an entered GH < 6.
- Data correction: Rummynose Tetra blackwater `requires` → `prefers` (§5a). No selectable species now
  has a sourced `requires` value; the rule remains for a future sourced case.
- Salinity `'fresh'` kept as the tool's scope (marine excluded; brackish mixing is detected from species).

## 5a. Rummynose Tetra blackwater correction

Old path: the `species.v2.json` record had no `blackwater` key, so `species-adapter.v2.js → pick()`
fell back to the adapter's built-in legacy table (`'rummynose-tetra'` entry, `blackwater: 'requires'`),
a copy of `js/fish-data.js` (`id:"rummynose"`, `blackwater:"requires"`). The normalized record reached
`evaluateBlackwater()` as `requires`: red on `main` (tannins assumed off), amber earlier in this phase
(tannins unknown).

Evidence: Seriously Fish describes blackwater habitat and a blackwater-style biotope set-up, but also
says the species does well in a more standard planted aquarium — a preference, not a captive
requirement. Fix at the source: `species.v2.json` now states `"blackwater": "prefers"` explicitly, and
the adapter's legacy entry and `js/fish-data.js` were changed to `prefers` so no layer disagrees. No
other species was touched. With tannins unknown, off or on, Rummynose now gets no amber/red result.
It was the only `requires` value in any layer, so no selectable species has a sourced requirement.

## 6. Unchanged (verified)

Bioload %, severity and text, filtration level/turnover/warnings/status text, aggression severity and
every non-water stock warning were compared between `main` and this branch for all 44 species × 6
tanks × 4 filter set-ups (1,056 cases): identical.

## 7. Known limitations

- There is still no water input on the page; this phase makes unknown neutral and adds no UI. The
  minimal future UI: optional number fields for temperature (°F), pH, GH (dGH) and KH (dKH), an optional
  flow select and a tannins yes/no/not-sure control, each writing `appState.water.<key>` (empty → null)
  and calling `recomputeAll()`; plus a one-line "Water parameters not entered — enter yours to compare
  with this stock" note on the Environmental card.
- Candidate chips can list the same issue twice (the stock-wide condition chip and the previewed
  species' own score). This duplication existed before; wording was clarified, structure left alone.
- Species conflicts are reported in the candidate chips, the engine status and (as before) the
  Environmental card warnings, not as separate `#stock-warnings` entries.
- A single-point overlap (ranges that only touch) counts as a conflict, matching the Environmental card.
