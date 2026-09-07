# 29G Journal Sync Checklist

1. **Export latest master log** – Run the Sheet/Excel export or converter and overwrite `/data/journal.csv`; regenerate `/data/journal.json` if the API consumes it.
2. **Verify Journal page** – Load `/journal.html` in a browser, confirm entries group by day, render newest-first, Quick Facts block in blue, and no stub text.
3. **Check Media page** – Ensure the Journal card is visible, label text only (no imagery swaps), and the color accents match the Journal page palette.
4. **Glance at Homepage** – Confirm the Aquarium Library still links or references the Journal card when applicable.
5. **Document the change** – Use the standard commit + PR summary template before shipping.
6. **Smoke test** – Spot-check on mobile and desktop viewports for layout or content regressions.

> **Gotchas**
> - Clear caches/CDN to surface the latest CSV.
> - Save CSV/JSON as UTF-8 with LF endings to avoid encoding issues.
> - Double-check units and numeric precision before publishing.
> - Scrub media URLs for privacy before posting.

