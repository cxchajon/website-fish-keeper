# 29-Gallon Journal Sync Matrix

| Trigger | Action | Target files/pages |
| --- | --- | --- |
| New or edited row in the 29G master log (Google Sheet / Excel) | Write or update the matching narrative page and hub card by hand. Do not overwrite the preserved data files; any import needs a separately designed workflow (see `29g_runbook.md`). | `/journal/*.html`, `/journal.html` |
| Media assets added (images, video references, alt text) | Cross-check media URLs for privacy-safe hosting and add the references to the page that uses them. | `/journal/*.html`, `/assets/images/*` |
| Journal header or copy changes | Verify `/journal.html` shows the newest card first and is free of placeholder text. Sync wording to the Media page Journal card so its label and color accents stay aligned. | `/journal.html`, `media.html` |

## Notes
- `/data/journal.csv`, `/data/journal.json`, and `/data/journal/*.json` are preserved historical records. They do not drive any public page and must not be regenerated or bulk-replaced.
- When adjusting media references, store only privacy-safe URLs or internal asset paths.
- UI checks cover both desktop and mobile breakpoints.
