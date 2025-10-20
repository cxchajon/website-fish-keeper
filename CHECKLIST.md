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
