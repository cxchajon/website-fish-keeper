# Stocking Test Report (Real Species Library)

## Overview
- Test harness: custom Node runner (`npm test`)
- Total test files: 5
- Total tests: 13
- Status: **All tests passed**

Artifacts:
- Summary: `out/jest-summary.txt`
- JUnit XML: `out/jest-junit.xml`
- Adapter audit: `out/adapter_issues.json` / `out/adapter_issues.md`
- Random failure sampler: `out/failing_combos.csv`

## Adapter Issues
The adapter flagged **0** species records. Ranges and flags normalized without schema conflicts. (See `out/adapter_issues.md`.)

## Fail Highlights (first 25)
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

## Bioload Sanity (baseline)
- Bioload percentages now use displacement-only effective capacity; planted bonuses have been removed from the model.

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
- No brackish-only species are present in the current library; salinity mismatch checks were skipped with a note logged in `failing_combos.csv`.
