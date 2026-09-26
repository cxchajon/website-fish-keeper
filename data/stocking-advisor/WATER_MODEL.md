# Stocking Advisor water-parameter model (Phase 2D)

Code: `js/logic/compute.legacy.js` (`sanitizeWater`, `computeConditions`, `buildWaterWarnings`,
`createDefaultState`), `js/logic/conflicts.js` (flow, blackwater, snail shell checks),
`js/stocking-advisor/logic/compat.v2.js` + `js/logic/compute.js → buildCompatibilityMap` (per-species
candidate scores). Species-only display: `js/logic/envRecommend.js` (Environmental Recommendations card).
Tests: `tests/unit/water-model.test.mjs`, `tests/stocking-advisor-gate.spec.ts` ("water parameters").
Audit that led here: `_internal/reports/water-parameters-audit-2026-09.md`.

## 1. Rule

**The advisor never presents an assumed value as the user's water.**

There are two different questions, and they are kept apart:

| Question | Needs | Example wording |
| --- | --- | --- |
| Do these species share a range? | species data only | "No shared range between these species" |
| Is the user's water inside that range? | a value the user entered | "Your pH is outside this stock's range" |

A parameter the user has not entered is **not evaluated**: it neither passes ("within range",
"Optimal") nor fails ("outside range", "Incompatible"). Unknown is not unsafe, so it never makes the
plan amber or red.

The tool works fully without water values: tank size, bioload (BIOLOAD_MODEL.md), space, group size,
compatibility, predation, aggression and filtration (FILTRATION_MODEL.md) do not read `state.water`.

## 2. Inputs

`state.water` (default from `createDefaultState`):

| Field | Default | Meaning of the default |
| --- | --- | --- |
| `temperature` (°F) | `null` | not entered |
| `pH` | `null` | not entered |
| `gH` (dGH) | `null` | not entered |
| `kH` (dKH) | `null` | not entered |
| `flow` (`low` / `moderate` / `high`) | `null` | not entered |
| `blackwater` (`true` / `false`) | `null` | not entered |
| `salinity` | `'fresh'` | tool scope, not a measurement (§5) |

`sanitizeWater` keeps a value only when the user supplied one: a finite number inside plausible bounds
(temperature 32–110 °F, pH 0–14, GH/KH 0–60; 0 dKH is a valid entry). `null`, `undefined`, `''`,
booleans, text and out-of-bounds numbers become `null`. It also returns `water.entered.<key>`
(true/false). Nothing downstream substitutes a fallback value.

The page has **no water inputs yet**. Values reach the engine only through `window.appState.water`
(followed by `window.recomputeAll()`), which is how the production gate enters them. Entered values
are kept in memory only: they are not written to local/session storage and are gone after a reload.

## 3. Combining species ranges

For temperature, pH, GH and KH the shared range of the selected stock (existing stock plus the species
being previewed) is:

```
shared min = highest species minimum
shared max = lowest species maximum
```

With two or more species, `shared max − shared min ≤ 0.01` is a **species conflict** (the same test as
the Environmental card's `intersectRanges`). It is reported from species data alone, whether or not the
user entered anything:

| Parameter | Species-conflict severity |
| --- | --- |
| Temperature, GH, KH | red |
| pH | red if a pH-sensitive species is involved, otherwise amber (the card shows a "flexible" band) |

When the species conflict, a user value for that parameter is not additionally scored: there is no
shared range to be inside.

## 4. Per-parameter behaviour

Each condition item carries `status`, `measured`, `severity` and `hint`:

| `status` | When | Severity | Hint |
| --- | --- | --- | --- |
| `not-entered` | no user value | ok (not evaluated) | "Not entered" |
| `no-range` | user value, but no species range data | ok | "No species range" |
| `within` | user value inside the shared range | ok | "✔ Your water is within the shared range" |
| `outside` | user value outside the shared range | amber / red | "⚠/✖ Your water is (slightly) outside the shared range" |
| `species-conflict` | species share no range | §3 | "✖/⚠ No shared range between these species" |

Outside thresholds are unchanged from before this phase: temperature, GH and KH are amber within 2 of
the range and red beyond; pH is amber/red at 0.5 (0.2 with a pH-sensitive species), with 0.2 extra red
tolerance when the user entered KH ≥ 3.

Every `outside` item also produces a stock warning `water.<key>.outside` (shown in the warnings panel),
e.g. "Your pH is outside this stock's range — You entered pH 8.5. Shared species range: 4.8–7.2."

The previewed species' own optimal/tolerable scores (`compatScore`) return **"Not evaluated"** for a
parameter the user has not entered (previously "Optimal").

**Flow.** A species' circulation preference is compared with the tank's flow only when the user says
what that flow is. There is no assumed "moderate" tank. Mixed flow needs among the species are still
shown on the Environmental card ("flow zones needed"). Filtration turnover is a separate check
(FILTRATION_MODEL.md) and is not involved.

**Blackwater / tannins.**

| Species value | Not entered | User: tannins off | User: tannins on |
| --- | --- | --- | --- |
| `prefers` | ok ("Tip: benefits from tannins") | ok (tip) | ok |
| `requires` | amber: "Needs tannin-stained (blackwater) water…" | red: "Requires tannins / blackwater" | ok |
| `neutral` / `null` | ok | ok | ok |

A preference is never a failure. A requirement is a husbandry fact about the species (like salinity),
so it stays visible when the tank is unknown, and is red only when the user said tannins are off.

**Snail shell health.** "Low gH risks shell health" appears only when the user entered GH < 6.

## 5. Salinity

`'fresh'` is the tool's scope, not an assumption about the user's water: the advisor is
freshwater-only and marine species are excluded from the dataset. Freshwater-vs-brackish mixing is
detected from species data (Environmental card, "fresh + brackish mix"); a marine tank setting is
still red.

## 6. Status

Water affects the overall status only through a user value outside the shared range, a species
conflict (§3), or a blackwater requirement (§4). An unentered parameter never does.
