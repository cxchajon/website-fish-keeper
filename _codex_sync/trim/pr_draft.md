# Draft PR: Trim the Fat (Audit Findings)

## Summary
- Remove unused media/icons flagged in `_codex_sync/trim/orphan_assets.json` (see LOW/MEDIUM risk breakdown).
- Replace `/404.html` redirect helper with Netlify `_redirects` entries; ensure `/gear.html` consumers update to `/gear/` before deletion.
- Consolidate tooltip utilities and shared CSS via previews in `_codex_sync/trim/previews/`.

## Safety
- Reference tag `pre-trim-2025-10-18` for rollback and `_codex_sync/preflight_checksums.json` for integrity verification.
- Dynamic coverage and network captures blocked (Chromium download 403); rerun Playwright once proxy allows `npx playwright install chromium`.

## Validation TODOs
- Re-run Playwright mobile/desktop sweeps to confirm zero console errors and capture updated coverage/HAR.
- Lighthouse desktop/mobile to confirm unused JS/CSS budgets decrease or remain flat.
- Verify sitemap alignment after removing legacy stubs; update `_redirects` to 301 canonical paths.
