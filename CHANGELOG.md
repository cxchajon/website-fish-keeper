# The Tank Guide — Changelog

- [2025-10-31 | Stocking Advisor] Captured prototype→live migration plan (inventory, diff, rollback) and staged backups for Stocking Advisor parity work.
- [2025-10-31 | Journal] Added Feeding entry (flakes only); updated data; verified dashboard renders latest.

# v1.9.4 — 2025-10-20 | S3 Deterrent Flag Honored
- Default OFF; listeners attach only when `window.__RIGHT_CLICK_DETERRENT__` is true.
- Playwright coverage added to confirm OFF/ON behaviors for right-click deterrent.

## v1.9.3 — 2025-10-20 | Targeted Checklist Audit
- Totals: PASS=6, FAIL=1, DEFERRED=2
- Highlights: Footer trust link verified site-wide; Playwright smoke scripts intact with `test:e2e`.
- Outstanding: Right-click deterrent still bypasses the feature flag.
- Note: Media social + archive blocks remain deferred per plan while the flag fix proceeds.

## v1.9.2 — 2025-10-07
- Resolved audit FAIL/PARTIAL items (Trust & Security link + page, Media TikTok/IG sections + Archive, minify step scaffold, Playwright smoke tests, QA log).
