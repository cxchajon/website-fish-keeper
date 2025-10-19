# 29-Gallon Journal Sync Matrix

| Trigger | Action | Target files/pages |
| --- | --- | --- |
| New or edited row in the 29G master log (Google Sheet / Excel) | Run the converter to export the latest data. Overwrite `/data/journal.csv` and regenerate `/data/journal.json`. | `/data/journal.csv`, `/data/journal.json` |
| Media assets added (images, video references, alt text) | Cross-check media URLs for privacy-safe hosting, update references, and confirm any new assets are represented in the dataset. | `/data/journal.csv`, `/data/journal.json`, `/media/*` |
| Journal header or copy changes | Verify `/journal.html` renders newest-first entries, day-grouped, and free of placeholder text. Sync wording to the Media page Journal card so its label and color accents stay aligned. | `/journal.html`, `/data/journal.csv`, `/data/journal.json`, `media.html` |
| New tank added (future) | Add a `tank_id` column to the dataset, surface the filter flag in the UI, and verify the Journal and Media cards respond appropriately. | `/data/journal.csv`, `/data/journal.json`, `/journal.html`, `media.html`, UI components for filters |
| Any sync activity | Record the update in the Codex activity log with context and links. | `/logs/codex_activity_log.md` |

## Notes
- Always ensure journal entries remain in newest-first order after every sync.
- When adjusting media references, store only privacy-safe URLs or internal asset paths.
- UI checks cover both desktop and mobile breakpoints.
- Keep future tanks in mind: the `tank_id` column should default to `29g` until a new tank is introduced.
