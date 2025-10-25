# Stocking Tests — Real Species Library (2025-10-18)

## Run Summary
- Runner: custom Node harness (`npm test`)
- Test suites: 5
- Individual tests: 13
- Outcome: ✅ **All tests passed**
- Artifacts: `stocking-tests-real/out/jest-summary.txt`, `stocking-tests-real/out/jest-junit.xml`, `stocking-tests-real/out/adapter_issues.*`, `stocking-tests-real/out/failing_combos.csv`

## Adapter Health
- Species evaluated: 20
- Adapter issues: **0** flagged records — input ranges and flags normalized without schema conflicts. See `adapter_issues.md` for the raw dump.

## Compatibility Fail Highlights
Top flagged pairings (aggression gaps and shrimp predation dominate):

| Species A | Species B | Reason |
| --- | --- | --- |
| Bronze Corydoras | Tiger Barb | aggression gap |
| Pearl Gourami | Betta (Male) | aggression gap |
| Kuhli Loach | Tiger Barb | aggression gap |
| Betta (Female) | Cherry Shrimp | shrimp predation risk |
| Panda Corydoras | Betta (Male) | aggression gap |
| Tiger Barb | Panda Corydoras | aggression gap |
| Betta (Male) | Harlequin Rasbora | aggression gap |
| Cardinal Tetra | Cherry Shrimp | shrimp predation risk |
| Chili Rasbora | Betta (Male) | aggression gap |
| Tiger Barb | Otocinclus (Oto Cat) | aggression gap |
| Betta (Male) | Bronze Corydoras | aggression gap |
| Zebra Danio | Pearl Gourami | temperature mismatch |
| Nerite Snail | Betta (Male) | aggression gap |
| Panda Corydoras | Betta (Male) | aggression gap |
| Zebra Danio | Betta (Male) | aggression gap |
| Betta (Female) | Cherry Shrimp | shrimp predation risk |
| Amano Shrimp | Pearl Gourami | shrimp predation risk |
| Cherry Shrimp | Rummynose Tetra | shrimp predation risk |
| Tiger Barb | Neon Tetra | aggression gap |
| Rummynose Tetra | Betta (Male) | aggression gap |
| Amano Shrimp | Dwarf Gourami | shrimp predation risk |
| Kuhli Loach | Betta (Male) | aggression gap |
| Betta (Male) | Panda Corydoras | aggression gap |
| Amano Shrimp | Guppy (Male) | shrimp predation risk |
| Zebra Danio | Cherry Shrimp | shrimp predation risk |

## Bioload Spot Checks

| Plan | Gallons | Base % | Planted % |
| --- | ---: | ---: | ---: |
| Betta w/ nano shoal | 20 | 40.0 | 34.8 |
| Community tetra | 29 | 52.4 | 45.6 |
| Tiger barb squad | 40 | 51.1 | 44.4 |
| Peaceful rasbora | 25 | 45.9 | 39.9 |
| Algae team | 30 | 16.0 | 13.9 |
| Shrimp colony | 12 | 53.3 | 46.4 |
| Livebearer mix | 29 | 40.2 | 34.9 |
| Gourami pair | 36 | 50.0 | 43.5 |
| School & snails | 40 | 27.8 | 24.2 |
| Dwarf gourami center | 32 | 50.0 | 43.5 |

## Turnover Sanity Samples

| Gallons | Flow (GPH) | Turnover (x/h) | Recommended Min (GPH) | Recommended Max (GPH) |
| ---: | ---: | ---: | ---: | ---: |
| 10 | 50 | 5.00 | 40.0 | 80.0 |
| 12 | 80 | 6.67 | 48.0 | 96.0 |
| 15 | 120 | 8.00 | 60.0 | 120.0 |
| 20 | 100 | 5.00 | 80.0 | 160.0 |
| 29 | 200 | 6.90 | 116.0 | 232.0 |
| 36 | 250 | 6.94 | 144.0 | 288.0 |
| 40 | 300 | 7.50 | 160.0 | 320.0 |
| 55 | 400 | 7.27 | 220.0 | 440.0 |
| 65 | 500 | 7.69 | 260.0 | 520.0 |
| 75 | 550 | 7.33 | 300.0 | 600.0 |

## Notes
- Brackish-only checks skipped (no brackish species present); see `failing_combos.csv` for logged note.
