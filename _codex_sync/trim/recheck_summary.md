# Trim Recheck Summary — 2025-10-18

## Static Assertions
| Assertion | Status | Details |
| --- | --- | --- |
| Checksum diff vs preflight | INFO | `_codex_sync/recheck_checksums.json` reports +8 added / 528 removed / 20 changed entries relative to `_codex_sync/preflight_checksums.json`. |
| Removed assets absent | PASS | `assets/media/library/books/blogs.png`, `assets/media/community/submit-tank-placeholder.svg`, `assets/icons/favicon.png`, and `assets/icons/footer-x.svg` are missing from disk and have no references. |
| Utilities.css imported exactly once | FAIL | `/`, `/gear/`, and `/about.html` still omit `assets/css/utilities.css` (0 imports) and retain inline `box-sizing` rules; `stocking.html`, `params.html`, and `media.html` are correct. |
| Tooltip module unified | PASS | `js/ui/tooltip.js` exports the controller and `js/params.js` only imports/initialises it. |
| Redirect rule present | PASS | `_redirects` contains the `/404.html / 301` rule. |
| Sitemap updated | PASS | `sitemap.xml` lists `/pages/university.html` with no legacy duplicates. |

## Runtime Smoke
Runtime smoke checks were **not executed** — Playwright Chromium binaries could not be downloaded (HTTP 403 via corporate proxy). See `_codex_sync/trim/runtime_report.json` and `_codex_sync/trim/runtime_console.txt` for captured failure context.

## Redirect Behavior
Validated statically: `_redirects` retains the `/404.html / 301` mapping. Runtime redirect behavior still requires confirmation once browser downloads are allowed.

## Follow-ups
- Add a single `assets/css/utilities.css` import to `/`, `/gear/`, and `/about.html`, removing redundant inline `box-sizing` declarations.
- Re-run runtime smoke (and optional Lighthouse) after Playwright Chromium downloads succeed.
