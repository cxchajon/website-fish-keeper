## Checklist Reconciliation — 2025-11-01

| Item | Status | Evidence |
| --- | --- | --- |
| A1. Right-click/drag deterrent flag defaults OFF | ✅ COMPLETE | `js/nav.js` L333-L409 keeps `window.__RIGHT_CLICK_DETERRENT__` false unless explicitly set. |
| B1. TikTok media block | 💤 DEFERRED | Deferred placeholder remains commented out in `media.html` L814-L838. |
| B2. Instagram media block | 💤 DEFERRED | Deferred placeholder remains commented out in `media.html` L840-L865. |
| B3. Media archive block | 💤 DEFERRED | Deferred archive placeholder remains commented out in `media.html` L866-L918. |
| C1. Playwright smoke tests runnable | ✅ COMPLETE | `tests/e2e/*.spec.ts` present and `package.json` exposes `test:e2e`. |
| C2. Build/minify outputs to /dist | ✅ COMPLETE | `scripts/build-prod.mjs` writes minified CSS/JS into `dist/`. |
| D1. QA clickthrough log on file | ❌ INCOMPLETE | `AUDIT/qa-clickthrough-2025-10.md` is missing from the repository. |
| E1. Tool-page optimization tasks logged | ❌ INCOMPLETE | No repo log documents the v2.1 tool-page optimization plan (`rg "tool-page"` returned no matches). |
| E2. Homepage Quick Q&A block plan logged | ❌ INCOMPLETE | No documentation references a Quick Q&A block plan (`rg "Quick Q&A"` returned no matches). |
| E3. FAQPage JSON-LD plan logged | ✅ COMPLETE | `docs/CHANGELOG.md` (2025-10-23 entry) tracks the FAQPage JSON-LD follow-up. |

**Totals:** COMPLETE = 4 · INCOMPLETE = 3 · DEFERRED = 3

**Next Actions**
- Restore `/AUDIT/qa-clickthrough-2025-10.md` with the latest desktop/mobile pass results.
- Capture the v2.1 tool-page optimization backlog in `logs/codex_activity_log.md` (or a dedicated `/AUDIT/SEO-GEO-REPORT.md`).
- Document the homepage Quick Q&A block plan in `logs/codex_activity_log.md` (or `CHECKLIST.md` planning notes).

---
