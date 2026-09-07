# 29G Journal Runbook

## Source of truth
- Primary log: 29G Master Journal (Google Sheet / Excel workbook) stored in the shared "Aquarium Ops" drive under `Logs/29G/master_journal`.
- Ownership: Content team maintains copy updates; Ops ensures `tank_id` values remain accurate (default `29g`).

## Conversion workflow
1. Pull the latest Sheet/Excel copy and verify the `tank_id` column is present for every entry.
   - Name exports `29g_master_log_YYYYMMDD.(xlsx|csv)` so converters and archives can track versions at a glance.
2. Run the converter script located at `scripts/journal/convert_29g.sh` (or the equivalent Node task `npm run journal:convert`).
   - Input: path to the exported spreadsheet.
   - Output: `data/journal.csv` and `data/journal.json` written in UTF-8 with LF line endings.
3. Confirm the CSV headers match the schema (`date`, `title`, `summary`, `media_url`, `tank_id`, etc.).
4. Commit the regenerated files along with any supporting assets.

## Rollback
1. Retrieve the previous `journal.csv` / `journal.json` from Git history (`git checkout HEAD~1 -- data/journal.csv`).
2. Re-deploy or re-publish the prior version of `/journal.html` if the layout was affected.
3. Note the rollback in `/logs/codex_activity_log.md` with rationale and timestamp.

## Verification
- Capture before/after screenshots of `/journal.html` (desktop and mobile widths) focusing on newest entries and Quick Facts.
- Grab a Media page screenshot showing the Journal card label and color alignment.
- File screenshots under `docs/memory/verification/29g/` for quick reference.
- After publishing, spot-check CDN caches and confirm the homepage Aquarium Library still surfaces the Journal card.
