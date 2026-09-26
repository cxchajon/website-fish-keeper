# Stocking Advisor — Phase 2E warning visibility / severity audit (2026-09)

Scope: make every warning the engine already detects visible, coloured by its engine severity, and the
same on desktop and mobile. Bioload (2B), filtration (2C), the water model (2D) and species data are
unchanged; no rule's severity was changed.

## 1. Warning-source inventory (as found on `main` @ 477df51)

"Preview" = species selected, not yet added. "After Add" = the candidate is cleared
(`state.candidate = { id: null }`), so candidate-only output disappears.

| Rule | Source | ID | Engine severity | Preview | After Add | Desktop location | Mobile location | Look | Duplicated |
|---|---|---|---|---|---|---|---|---|---|
| Min tank volume | `evaluateTankSuitability` (compute.legacy) | `tank.volume.<id>` | danger | yes (#stock-warnings) | yes | #stock-warnings | same | red strip, **dark text on dark bg** | no |
| Quantity-space | same | `tank.group_volume.<id>` | danger | yes | yes | #stock-warnings | same | red strip | no |
| Min tank length | same | `tank.length.<id>` | warn | yes | yes | #stock-warnings | same | amber strip | **yes**: special chip (below) + gray env chip |
| Tank length (special path) | `createLengthValidator` → `tankLengthStatus` (stocking.js / validators.js) | chip `data-role=stock-warning-length` | UI hard-coded `bad` | yes | **no** | #candidate-chips | same | **red chip — contradicts engine amber** | yes |
| Schooling / social / colony min, harem | `checkGroupRule` (conflicts.js) | none (chip) | warn (harem: warn/bad) | chip only | **no** (gray "shoal min not met" env chip, desktop only) | #candidate-chips; env chip | chip only; **nothing after Add** | amber chip / **gray chip** | no |
| Aggression pairs incl. hard pairs, fin-nipping | `computeAggression` → `computeStatus` | `aggr:<a>:<b>:<rule>` | danger/warn | yes | yes | #stock-warnings + candidate chip + #env-warnings + env chip | #stock-warnings + chip + #env-warnings | red/amber | **4 places on desktop** |
| Betta rules | `evaluateStockWarnings` (warnings.js) / warning-rules.js | `betta.*` | danger | yes | yes | #stock-warnings | same | red | no |
| Multiple male bettas | aggression.v2 token (candidate chip); env card | `warn_betta_male_conflict` (env only) | bad / critical | chip | **env card only** | chip; #env-warnings | same | red chip / plain text | yes |
| Fish → fish predation | `evaluateFishPredation` | `predation.fish.<pred>.<prey>` | danger | yes | yes | #stock-warnings | same | red | no |
| Fish → shrimp / snail predation | `evaluateInvertSafety` (envRecommend.js) | none | env "soft" (amber) | **no** (only a generic "Predation risk: Shrimp (…)" species chip, no prey named) | env card, **collapsed behind "(+N more)"**; gray "shrimp at risk" chip desktop only | #env-warnings (hidden), env chip | #env-warnings (hidden) | plain text / **gray** | yes |
| Species range conflicts (temp/pH/GH/KH) | `computeConditions` `species-conflict` | none | bad (pH warn unless sensitive) | candidate chips | **env card only, extras collapsed** | chips; #env-warnings | same | red chip / plain text | yes |
| User-entered water | `buildWaterWarnings` | `water.<key>.outside` | danger/warn | yes (+ chip) | yes | #stock-warnings + chip | same | red/amber | yes (preview) |
| Salinity / flow / blackwater | `evaluateSalinity/Flow/Blackwater` | none | chips | candidate only | no | chips | chips | tone | unreachable (no inputs, no brackish species) |
| Filtration none / circulation / very low | `buildFiltrationWarnings` | `filtration.*` | warn / danger / danger | yes | yes | #stock-warnings + chip in #candidate-chips | same | red/amber | **yes, same state** |
| Unevaluated / data unavailable | `flagUnevaluatedSpecies` | `species.unevaluated.<id>`, `species.dataUnavailable` | danger | yes | yes | #stock-warnings | same | red | no |
| Species behaviour chips | `buildBehaviorChips` (compute.js) | none | warn | candidate | no | #candidate-chips | same | amber | no (informational, unchanged) |

CSS: nothing hid `#stock-warnings`, `.status-strip` or chips by media query. Mobile loss came from JS:
`renderBars` never rendered the env detail chips on mobile, and `renderWarnings` collapsed every env
warning after the first behind "(+N more)" on both viewports. `#stock-warnings .status-strip` set
`color: #0b1228` (dark navy) on the dark theme's translucent strip backgrounds: barely legible.

## 2. Changes

Engine (`compute.legacy.js`) — existing rules re-stated as persistent warnings over stock + candidate,
severity as the rule already assigns, and fed into the overall status:
- `group.min.<id>` / `group.harem.<id>` from `checkGroupRule` (warn; harem warn/bad).
- `predation.shrimp|snail.<pred>.<prey>` from `shrimp_risk`/`snail_risk` (warn — the env card's "soft").
- `range.<key>.conflict` from `species-conflict` conditions (bad; pH warn unless pH-sensitive).
- `betta.multipleMales` from HARD_CONFLICTS `betta_male|betta_male` (danger).
- Aggression warnings gained a title/message split ("Aggression conflict: A and B" + reasons).
- Chips carry `covers: [warningId]` so the UI can drop a chip that repeats a shown warning.

UI: `#stock-warnings` shows the plan without the candidate; a new `#candidate-warnings` ("If you add
N × Species:") shows what the preview adds or changes; the same ids move to `#stock-warnings` on Add.
Keyed rendering keeps unchanged nodes (no re-announcement); only red strips have `role="alert"`.
Every strip/chip states severity in words ("✖ Problem" / "⚠ Warning"). The special tank-length chip
and `validators.js` were removed. The env card no longer repeats warnings owned by `#stock-warnings`,
no longer collapses the rest, and drops the gray duplicate chips. CSS: readable strip text, wrapping.
`app.bundle.css` is `immutable`, so the Stocking Advisor's `?v=` was bumped (other pages unaffected).

## 3. Regression check

All 44 species × 10 tanks × 4 filter set-ups × 3 stock shapes (5,280 cases), `main` vs branch:
bioload text/severity/%, filtration level/turnover/status, water condition statuses, aggression, every
pre-existing warning id + severity and every chip are identical. Only `status.severity` differs (409
cases): 369 ok→warn (under-minimum groups, shrimp/snail predators) and 40 →bad (2+ male bettas).

## 4. Shrimp / snail predation precedence (follow-up)

A predator's own `behavior.predationRisks` is the evidence. When it has any entry for the prey category,
only those entries decide (strongest match wins), whatever the generic tags say:

| Entry | Prey | Result |
|---|---|---|
| "Shrimp (all sizes)" | any shrimp | red — adult shrimp at risk |
| "Snails" | any other snail | red |
| "Shrimp (cherry)" / "Shrimp (amano)" | that named type | red |
| same | a different shrimp type | no warning from that entry |
| "Shrimp (juvenile)" | any shrimp | amber — adults may coexist, shrimplets at risk |
| none; `shrimp_risk` / `snail_risk` tag only | category | amber (fallback) |

Result matrix (predator → prey): all-sizes predators (Blue Ram, Bolivian Ram, Cockatoo, Angelfish,
Kribensis, Tiger Barb, Pea Puffer) red with every shrimp; Pea Puffer and Assassin Snail red with every
other snail; cherry-named predators (Bettas, Cardinal, Neon, Dwarf/Pearl Gourami) red with Cherry Shrimp
only; Cherry Barb red with Cherry and Amano; juvenile-only species amber with every shrimp; Ghost Shrimp
(tag only) amber. Compared with the previous commit over 7,040 cases, only `predation.shrimp|snail.*`
changed (1,000 raised to red, 360 cherry-only pairings with other shrimp removed); everything else is
identical.

### Tag / data contradictions (not edited — for a separate dataset clean-up)

- `shrimp_safe` tag with explicit shrimp prey: chili-rasbora, harlequin-rasbora, rummynose-tetra,
  zebra-danio (juvenile), neon-tetra (cherry).
- Explicit shrimp prey with no `shrimp_risk` tag: cardinal-tetra, cherry-barb, chili-rasbora,
  harlequin-rasbora, keyhole-cichlid, kuhli-loach, neon-tetra, pea-puffer (all sizes), rummynose-tetra,
  tiger-barb (all sizes), upside-down-catfish, zebra-danio.
- `shrimp_risk` tag with no explicit shrimp data: ghost-shrimp.
- Snail data and tags agree (assassin-snail, pea-puffer).

## 5. Open questions

- Species behaviour chips ("Predation risk: Shrimp (cherry)") appear amber on a preview even when no
  prey is planned. They were left unchanged.
