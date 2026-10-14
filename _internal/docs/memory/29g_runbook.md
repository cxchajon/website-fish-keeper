# 29G Journal Runbook

## Source of truth
- Primary log: 29G Master Journal (Google Sheet / Excel workbook) stored in the shared "Aquarium Ops" drive under `Logs/29G/master_journal`.
- Ownership: Content team maintains copy updates.

## Repository roles
- `data/journal.csv` — preserved export of the master log; the closest local copy of it.
- `data/journal.json` — legacy chart-style dataset (nitrate, dosing, maintenance for Oct–Nov 2025). Not an entries feed and not read by any page.
- `data/journal/YYYY-MM.json` and `data/journal/index.json` — preserved historical/legacy monthly records. Some entries and photo metadata (for example in `2025-11.json`) exist only in these files. Not read by any public page.
- `/journal.html` and the pages under `/journal/` — the public journal, maintained by hand as cards and narrative pages.

These files are kept as recorded. Where they disagree with each other or with the narrative pages, the differences have not been reconciled.

## Preserved data — do not overwrite
- Do not overwrite, regenerate, or bulk-replace `data/journal.csv`, `data/journal.json`, or any file in `data/journal/`.
- No converter or generator exists in this repository. The previously documented `scripts/journal/convert_29g.sh` and `npm run journal:convert` do not exist (obsolete, not runnable), and `scripts/generate-journal-months.mjs` was removed because it could delete the monthly files. Do not recreate them.
- Any future import or sync from the master log needs its own separately designed and reviewed workflow first.

## Publishing a journal update
1. Add or edit the narrative page under `/journal/` and its card in `/journal.html` by hand.
2. Update `sitemap.xml` when a new public page is added.
3. Commit the page changes with any supporting assets.

## Rollback
1. Retrieve the previous version of the affected page from Git history (for example `git checkout HEAD~1 -- journal.html`).
2. Re-deploy and confirm the rollback is live.

## Verification
- Check `/journal.html` (desktop and mobile widths): the newest card appears first and links to its page.
- Confirm the Media page and homepage still link to `/journal.html`.
- After publishing, spot-check CDN caches.
