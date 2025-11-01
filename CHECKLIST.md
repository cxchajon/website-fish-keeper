# The Tank Guide — Master Checklist

## Verification — 2025-10-20 (Targeted Audit)
- ✅ **S1** — Footer includes the "Trust & Security" link and loads via the shared footer placeholder on home and media pages. 【F:footer.html†L51-L67】【F:index.html†L613-L614】【F:media.html†L1196-L1197】
- ✅ **S2** — `/trust-security.html` is live and cross-links back to Privacy & Legal and Terms of Use from the policy aside. 【F:trust-security.html†L162-L185】
- ✅ **S3** — Right-click deterrent now honors `window.__RIGHT_CLICK_DETERRENT__` (default `false`) with guarded listeners in `js/nav.js`; footer no longer binds inline. 【F:js/nav.js†L326-L419】【F:footer.html†L85-L87】
- ✅ **S4** — Playwright smoke specs cover nav/footer, media, and links with an npm `test:e2e` script configured. 【F:tests/e2e/nav-footer.spec.ts†L1-L39】【F:package.json†L6-L22】
- ✅ **S5** — Production build script minifies CSS/JS into `dist/` assets. 【F:scripts/build-prod.mjs†L6-L63】【bc7b8e†L2-L3】
- ✅ **S6** — Manual QA clickthrough log for October 2025 remains available. 【F:AUDIT/qa-clickthrough-2025-10.md†L1-L17】
- 💤 **S7** — TikTok section remains intentionally hidden pending automation (deferred). 【F:media.html†L686-L710】
- 💤 **S8** — Instagram section remains intentionally hidden pending automation (deferred). 【F:media.html†L712-L737】
- ✅ **S9** — SEO/infra signals unchanged: canonical + OG/Twitter tags on home & media, homepage links to media, robots/sitemap present, and YouTube short still embedded. 【F:index.html†L7-L20】【F:media.html†L1-L25】【F:index.html†L240-L396】【F:media.html†L660-L680】【F:robots.txt†L1-L4】【F:sitemap.xml†L1-L18】

### Must Fix Next
- _None — all targeted blockers resolved on 2025-10-20._

### Deferred by Plan
- 💤 **S7** — TikTok media cards remain deferred until social automation is ready. 【F:media.html†L686-L710】
- 💤 **S8** — Instagram + archive blocks remain deferred until the archive workflow lands. 【F:media.html†L712-L759】

## Verification — 2025-11-01 (Reconciliation)
- ✅ **A1** — `js/nav.js` keeps `window.__RIGHT_CLICK_DETERRENT__` false unless explicitly enabled. (L333-L409)
- 💤 **B1** — TikTok showcase remains commented out pending automation. (`media.html` L814-L838)
- 💤 **B2** — Instagram showcase remains commented out pending automation. (`media.html` L840-L865)
- 💤 **B3** — Media archive block remains commented out pending automation. (`media.html` L866-L918)
- ✅ **C1** — Playwright smoke specs live in `tests/e2e/` with `npm run test:e2e`. (`package.json` L6-L24)
- ✅ **C2** — `scripts/build-prod.mjs` writes minified assets to `/dist`. (L1-L55)
- ❌ **D1** — Missing `/AUDIT/qa-clickthrough-2025-10.md`; recreate October desktop/mobile log.
- ❌ **E1** — No repository log captures the v2.1 tool-page optimization backlog; document plan.
- ❌ **E2** — No documentation outlines the homepage Quick Q&A block plan; capture planning notes.
- ✅ **E3** — `docs/CHANGELOG.md` (2025-10-23) tracks the FAQPage JSON-LD follow-up.

### Must Fix Next
- ❌ **D1** — Restore `/AUDIT/qa-clickthrough-2025-10.md` with October desktop/mobile QA passes.
- ❌ **E1** — Log the v2.1 tool-page optimization plan (e.g., `logs/codex_activity_log.md` or `/AUDIT/SEO-GEO-REPORT.md`).
- ❌ **E2** — Record the homepage Quick Q&A block roadmap (e.g., `logs/codex_activity_log.md` or `CHECKLIST.md`).

### Deferred by Plan
- 💤 **B1** — TikTok media cards remain paused until social automation lands.
- 💤 **B2** — Instagram media cards remain paused until social automation lands.
- 💤 **B3** — Media archive scaffolding remains paused until archive workflow lands.
