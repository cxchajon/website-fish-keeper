# 29G Journal Sync Checklist

1. **Leave preserved data alone** – Do not overwrite `/data/journal.csv`, `/data/journal.json`, or `/data/journal/*.json`. They are preserved records and no page reads them. See `29g_runbook.md`.
2. **Update the journal by hand** – Edit the narrative page under `/journal/` and its card in `/journal.html`.
3. **Verify Journal page** – Load `/journal.html` in a browser, confirm the newest card appears first, links to its page, and has no stub text.
4. **Check Media page** – Ensure the Journal card is visible, label text only (no imagery swaps), and the color accents match the Journal page palette.
5. **Glance at Homepage** – Confirm the homepage still links to `/journal.html`.
6. **Document the change** – Use the standard commit + PR summary template before shipping.
7. **Smoke test** – Spot-check on mobile and desktop viewports for layout or content regressions.

> **Gotchas**
> - Clear caches/CDN to surface the latest pages.
> - Double-check units and numeric precision before publishing.
> - Scrub media URLs for privacy before posting.
