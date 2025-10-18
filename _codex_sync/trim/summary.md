# Trim the Fat Audit Summary

## Totals
- unused_js_kb: N/A (coverage blocked by Playwright download failure)
- unused_css_kb: N/A (coverage blocked by Playwright download failure)
- orphan_images: 4
- legacy_pages: 1

## Proposed removals
- **LOW** — `assets/media/library/books/blogs.png`: not referenced across HTML/CSS/JS and never requested in captured logs (static scan). Safe to delete or replace with on-demand load if future content requires it.
- **LOW** — `assets/media/community/submit-tank-placeholder.svg`: unused placeholder asset; confirm no CMS references before removal.
- **MEDIUM** — `assets/icons/favicon.png`: redundant with `/favicon.ico`; ensure no manifest references before removing to avoid browser regressions.
- **MEDIUM** — `assets/icons/footer-x.svg`: not referenced by nav/footer templates; confirm no deferred load before deletion.
- **MEDIUM** — `/404.html` redirect helper: contains script attempting to strip `.html` before redirecting. Replacing with server-side 301s would simplify behavior but verify Netlify redirect coverage first.

## Proposed merges/refactors
- Consolidate box-sizing reset shared across `theme.css`, `university.css`, and `university.page.css` into a new `assets/css/utilities.css` (see `merge_css_preview.diff`).
- Unify tooltip logic by expanding `js/ui/tooltip.js` and retiring bespoke `js/params.js` implementation (see `components_consolidation.md`).
- Defer/conditional-load third-party scripts (AdSense, Funding Choices, Cloudflare beacon) based on consent to reduce unused bytes on first paint (details in `third_party_audit.md`).

## Evidence references
- Internal link graph and metadata: `_codex_sync/trim/graph.json`, `_codex_sync/trim/graph.csv`
- Sitemap reconciliation: `_codex_sync/trim/sitemap_diff.md`
- Asset analysis: `_codex_sync/trim/orphan_assets.json`
- CSS dedupe preview: `_codex_sync/trim/merge_css_preview.diff`
- Component consolidation: `_codex_sync/trim/components_consolidation.md`
- Blockers preventing dynamic coverage: `_codex_sync/trim/blockers.md`

## Post-Trim Validation: FAIL
- Playwright smoke could not execute; `npx playwright test` failed because browser downloads are blocked with HTTP 403 in this environment. Follow-up: rerun smoke after installing browsers in CI. (See chunks `a24562` and `2ba44a`).
- Lighthouse quick check not run; would require local server and browser binaries.
