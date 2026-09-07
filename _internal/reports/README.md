# Reports

## Stocking tests – extended suite

Run the deterministic extended coverage harness to refresh compatibility analytics and documentation:

```bash
npm run test:stocking:extended
```

Outputs are written to the `reports/` directory:

- `stocking-tests-extended-YYYY-MM-DD.md` – Markdown summary with heatmaps, fail highlights, bioload, and turnover tables.
- `failing_combos.csv` – Top incompatibilities ranked by reason frequency.
- `adapter_issues.json` / `.md` – Normalization audit from the species adapter (empty arrays mean clean data).
- `trend_history.json` – Append-only record of prior runs. Each entry includes species counts, pair totals, fail rates, and per-dimension stats.

When reviewing trend deltas, compare the most recent entry against the previous row in `trend_history.json`:

- **Species Δ** shows how many species were added or removed since the last run.
- **Fail rate Δ** is measured in percentage points of expectation failures per pair tested.
- **Pairs tested Δ** tracks changes in sampling breadth (positive numbers indicate more coverage).

The Markdown report also surfaces any skipped dimensions (for example, no brackish species available) so gaps remain visible in CI dashboards.
