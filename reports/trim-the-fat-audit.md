# Trim-the-Fat Audit — TheTankGuide.com

## 1. Executive Summary
- **Legacy bundles still shipped:** The legacy Gear bundle (`js/gear.js`) and Feature Your Tank controller (`js/feature-tank.js`) remain in the repo even though the live pages now mount the ES module build in `/src/pages/GearPage.js` and use new form IDs, making the old files unreachable in production.【F:js/gear.js†L1-L30】【F:gear/index.html†L45-L64】【F:js/feature-tank.js†L1-L34】【F:feature-your-tank.html†L331-L374】
- **Stocking → Gear hand-off broken:** The Stocking Advisor still serialises tank context to `sessionStorage` before sending visitors to `/gear/`, but the new Gear page never reads that payload, so the personalised recommendations flow silently fails.【F:js/stocking.js†L1077-L1084】【F:src/pages/GearPage.js†L10-L45】
- **Ads/consent regression:** Consent Mode toggles `.is-ads-disabled`, and the shared ad stylesheet hides `<ins>` slots whenever that class is present, wiping placeholders for NPA traffic and violating the “no layout jump” requirement.【F:assets/js/consent-mode.js†L53-L68】【F:assets/css/ads.css†L1-L13】 Several content pages load the AdSense script but ship no `<ins>` containers, so they will be flagged during a policy review (e.g., index, about, contact, store).
- **SEO & crawl gaps:** `/gear/index.html`, `/params.html`, and `/feature-your-tank.html` lack canonical links (gear also lacks a meta description), and `hardening/` carries stale copies of `robots.txt`/`sitemap.xml` that no longer match the live manifest, risking drift if ever deployed.【F:gear/index.html†L4-L23】【F:params.html†L4-L33】【F:feature-your-tank.html†L1-L33】【F:robots.txt†L1-L7】【F:hardening/robots.txt†L1-L7】【F:sitemap.xml†L1-L56】【F:hardening/sitemap.xml†L1-L48】
- **Logs & QA artefacts piling up:** Test logs (`verification.log`), static QA notes, and one-off curl captures are committed alongside a `backups/` directory, inflating the repo without runtime value.【7d9ce9†L1-L2】【4fa82b†L1-L5】【448e33†L1-L2】

Quick wins: remove the unused bundles, lift the ad/consent CSS conflict, wire Gear to the stored stocking payload, add missing canonical/meta tags, and archive QA artefacts outside the deploy bundle.

## 2. Deletion Candidates (ranked)
| Rank | Path | Size | Evidence | Risk if removed | Suggested retention |
|------|------|------|----------|-----------------|---------------------|
| 1 | `js/gear.js` | 41.8 KB | Legacy Gear bundle unused since `/gear/index.html` loads `/src/pages/GearPage.js` instead.【F:js/gear.js†L1-L30】【F:gear/index.html†L45-L64】 | **Low:** new Gear page is module-based; keep in branch history. | Archive for one release if rollback needed. |
| 2 | `js/modules/` (`audit.js`, `nav.js`, `status.js`) | 13.8 KB combined | Debug helpers referenced nowhere outside the folder; Stocking flow no longer imports them.【F:js/modules/audit.js†L1-L66】【F:js/modules/status.js†L1-L15】 | **Low:** they only log diagnostics; confirm no manual QA scripts depend on them. | Keep zipped in docs if desired. |
| 3 | `js/feature-tank.js` | 2.1 KB | Targets `tank-feature-form` IDs that no longer exist; new form uses `featureForm`/`feature-tank-form`.【F:js/feature-tank.js†L1-L34】【F:feature-your-tank.html†L331-L374】 | **Low:** removing avoids stale logic interfering with Formspree. | Drop immediately. |
| 4 | `css/params.css` | 8.9 KB | Params page inlines its styles and only links `css/style.css`; standalone sheet is dead weight.【F:css/params.css†L1-L33】【F:params.html†L4-L33】 | **Low:** verify no external embed references it. | Remove after snapshot. |
| 5 | `docs/screens/curl-index.html` | 0.9 KB | One-off HTTP capture that also loads AdSense scripts; not linked anywhere.【F:docs/screens/curl-index.html†L1-L26】 | **Low:** keep result in issue tracker instead. | Remove now. |
| 6 | `verification.log` | 0.7 KB | Playwright log checked into repo; regenerated on demand.【7d9ce9†L1-L2】 | **Low:** safe to delete. | None. |
| 7 | `static-qa-*.{md,json}` | 3.2 KB | Historical QA notes duplicated in docs; not surfaced on site.【4fa82b†L1-L5】 | **Low:** move to knowledge base if needed. | Archive outside repo. |
| 8 | `backups/cleanup-20251002-165631/` | 56 KB | Snapshot of gear CSVs duplicating `data/` and `gear_master.csv`.【448e33†L1-L2】 | **Low:** ensure ops no longer relies on it. | Keep latest export elsewhere. |
| 9 | `gear_master.csv` | 125 B | Single-line placeholder; runtime loader consumes split CSVs via `master_nav.json`.【F:src/utils/csvLoader.js†L1-L44】【b04cf9†L1-L1】 | **Low:** confirm scripts don’t expect fallback. | Remove after updating link-audit defaults. |
| 10 | `node_modules/` | 13 MB | Should not be committed; install via npm on deploy.【0090ac†L1-L2】 | **Medium:** ensure CI pipeline caches packages before dropping. | Delete from repo once pipeline verified. |

## 3. Duplicates / Redundancies
- **robots/sitemap double committed:** `hardening/robots.txt` & `hardening/sitemap.xml` mirror root files but miss newer URLs (store, about) and risk diverging if ever deployed from the template set.【F:robots.txt†L1-L7】【F:hardening/robots.txt†L1-L7】【F:sitemap.xml†L1-L56】【F:hardening/sitemap.xml†L1-L48】
- **AdSense banner markup copied verbatim on every page:** Each template embeds identical consent banner + CMP bridge chunks inline; consider centralising via include to avoid drift.【F:gear/index.html†L63-L120】【F:store.html†L135-L224】
- **QA documentation overlaps:** Static QA markdown/JSON duplicate the compliance report and audit directories; consolidate into `/docs/` or external knowledge base.【4fa82b†L1-L5】【F:docs/adsense-performance-tracking.md†L1-L40】

## 4. Orphans / Dead Paths
- **Stocking data exports:** Old `js/modules/` suite and `js/gear.js` are no longer imported anywhere in the runtime bundle.【F:js/modules/audit.js†L1-L66】【F:js/gear.js†L1-L30】
- **Feature form helper:** `js/feature-tank.js` references IDs removed from the modern feature form, so it never attaches listeners.【F:js/feature-tank.js†L1-L34】【F:feature-your-tank.html†L331-L374】
- **Params stylesheet:** `css/params.css` is orphaned; page uses inline `<style>` instead.【F:css/params.css†L1-L33】【F:params.html†L4-L33】
- **Backups & curl capture:** `backups/cleanup-20251002-165631/` duplicates data CSVs; `docs/screens/curl-index.html` is a one-off capture unrelated to site navigation.【448e33†L1-L2】【F:docs/screens/curl-index.html†L1-L26】
- **AdSense loader on redirect stubs:** `gear.html` and `copyright.html` load AdSense + consent stacks despite immediately redirecting, adding unnecessary requests.【F:gear.html†L1-L32】【F:copyright.html†L1-L36】

## 5. Cross-Module Dependencies That Must Remain
- **Global nav/footers:** Every public page includes `<div id="site-nav"></div>` and fetches `nav.html` via `js/nav.js`, which normalises canonical routes for active state handling.【F:js/nav.js†L23-L88】【F:contact-feedback.html†L325-L405】 Keep `nav.html`/`footer.html` in sync with nav mapping.
- **Stocking advisor session payload:** `js/stocking.js` writes `ttg_stocking_state` before redirecting to `/gear/`. The Gear module must read and hydrate from this key to retain the “See Gear Suggestions” promise.【F:js/stocking.js†L1077-L1094】【F:src/pages/GearPage.js†L10-L45】
- **CSV manifest:** `src/utils/csvLoader.js` relies on `/data/master_nav.json` + the split CSVs; deleting any data file will break the gear catalogue ingest.【F:src/utils/csvLoader.js†L1-L78】
- **Consent bridge:** Funding Choices bridge toggles `documentElement.classList` and dispatches `ttg:consent-change`; any ad slot loader should listen to those events rather than duplicating state logic.【F:gear/index.html†L80-L118】【F:assets/js/consent-mode.js†L53-L68】

## 6. AdSense Readiness (per page)
| Page | Loader present once | `<ins>` slots | Consent placeholders when denied | Notes |
|------|---------------------|---------------|----------------------------------|-------|
| `/index.html` | ✅ script in `<head>` | ❌ none defined | ❌ `.is-ads-disabled` hides any potential slots | Add at least one responsive `<ins>` and keep placeholder visible.【F:index.html†L145-L173】【F:assets/css/ads.css†L1-L13】 |
| `/stocking.html` | ✅ | ✅ Top `8419879326`, bottom `8979116676` | ❌ Hidden when consent denied because of shared CSS | Keep slots but adjust CSS to preserve placeholders for NPA traffic.【F:stocking.html†L965-L976】【F:stocking.html†L1370-L1382】【F:assets/css/ads.css†L1-L13】 |
| `/gear/index.html` | ✅ | ✅ Bottom slot `1762971638` only | ❌ Hidden on denial via CSS | Add top slot (comment already present) and ensure consent denial keeps wrappers visible.【F:gear/index.html†L45-L61】【F:assets/css/ads.css†L1-L13】 |
| `/params.html` | ✅ | ✅ Top `8136808291`, bottom `5754828160` | ❌ Hidden on denial | Same CSS issue; placeholders disappear for NPA state.【F:params.html†L575-L585】【F:params.html†L663-L672】 |
| `/media.html` | ✅ | ✅ Bottom `9522042154` | ❌ Hidden on denial | Acceptable placement; fix CSS to prevent collapse.【F:media.html†L502-L513】 |
| `/feature-your-tank.html` | ✅ | ❌ none | ❌ N/A (no slot) | Consider removing loader or adding compliant placement; form page currently ad-free.【F:feature-your-tank.html†L294-L303】 |
| `/about.html` | ✅ | ❌ none | ❌ N/A | Either remove loader or introduce compliant ad slot + placeholder.【F:about.html†L266-L304】 |
| `/contact-feedback.html` | ✅ | ❌ none | ❌ N/A | Remove loader (form page) or add placeholder slot to avoid policy mismatch.【F:contact-feedback.html†L298-L336】 |
| `/privacy-legal.html`, `/terms.html`, `/cookie-settings.html`, `/copyright-dmca.html`, `/store.html`, `gear.html` | ✅ | ❌ none | ❌ N/A | Legal/support pages load AdSense without slots; either drop loader or add static placeholders that comply.【F:privacy-legal.html†L318-L360】【F:terms.html†L40-L88】【F:cookie-settings.html†L20-L68】【F:store.html†L96-L135】【F:gear.html†L1-L32】【F:copyright.html†L1-L36】 |

## 7. Crawlability & SEO
- **Canonical coverage gaps:** Gear index, Params, and Feature Your Tank lack `<link rel="canonical">`; add canonical tags to stabilise preferred URLs.【F:gear/index.html†L4-L23】【F:params.html†L4-L33】【F:feature-your-tank.html†L1-L33】
- **Meta descriptions:** Gear index ships only a `<title>`; add a description to satisfy Search Console quality checks.【F:gear/index.html†L4-L12】
- **Sitemap divergence:** Root sitemap lists store/about/cookie URLs, but `hardening/sitemap.xml` omits them; remove or update the template copy to avoid conflicting submissions.【F:sitemap.xml†L1-L56】【F:hardening/sitemap.xml†L1-L48】
- **Internal linking:** Nav canonical mapping ensures extensionless links resolve correctly (`/gear/` → `/gear/index.html`).【F:js/nav.js†L40-L69】 Verify hero CTAs (`/gear/`) remain in sitemap.
- **Structured data parity:** Store page only outputs `WebPage` JSON-LD without `sameAs`; align with Organization schema used elsewhere for consistency.【F:store.html†L40-L78】【F:index.html†L52-L88】

## 8. Security & Privacy
- **Contact form never submits:** The handler prevents default, validates fields, and shows a success banner without posting to any backend, creating false positives. Add a fetch to the intended endpoint or reinstate the form action.【F:contact-feedback.html†L424-L533】
- **Formspree feature form:** Uses POST with external action; ensure privacy notice references Formspree data handling (currently implied but not explicit).【F:feature-your-tank.html†L331-L374】
- **External scripts:** Funding Choices, AdSense, Font Awesome, Cloudinary Widget, Google reCAPTCHA, Google Fonts—document in privacy policy and monitor for updates.【F:feature-your-tank.html†L600-L905】【F:gear/index.html†L7-L22】
- **Link hygiene:** All `target="_blank"` anchors include `rel="noopener noreferrer"` (Amazon CTAs also add `rel="sponsored"`).【F:store.html†L160-L170】【F:media.html†L490-L506】
- **Server headers:** Recommend configuring HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy at the CDN since static markup can’t enforce them directly (document in ops runbook).

## 9. Actionable Fix List
1. **Delete unused bundles:** Remove `js/gear.js`, `js/modules/*.js`, `js/feature-tank.js`, `css/params.css`, and QA artefacts after archiving as needed.【F:js/gear.js†L1-L30】【F:js/modules/status.js†L1-L15】【F:css/params.css†L1-L33】【F:docs/screens/curl-index.html†L1-L26】
2. **Restore stocking → gear integration:** Read `ttg_stocking_state` inside `src/pages/GearPage.js` during initialisation to pre-populate context and recommendations.【F:js/stocking.js†L1077-L1094】【F:src/pages/GearPage.js†L10-L45】
3. **Fix AdSense placeholders:** Update `/assets/css/ads.css` so denied consent keeps ad wrappers visible (e.g., use opacity instead of `display:none`).【F:assets/css/ads.css†L1-L13】
4. **Align consent + ads:** Ensure ad slot loader listens to `ttg:consent-change` and respects `data-ad-consent`, rather than duplicating toggles in inline scripts.【F:gear/index.html†L80-L118】【F:assets/js/consent-mode.js†L53-L68】
5. **Add missing ad units or remove loader:** Audit each non-monetised page (about/contact/store/legal) and either add compliant ad placements or drop the AdSense `<script>` to avoid invalid traffic flags.【F:about.html†L266-L304】【F:store.html†L96-L174】
6. **Add canonical + meta description:** Update `/gear/index.html`, `/params.html`, `/feature-your-tank.html` with canonical links (and description for gear).【F:gear/index.html†L4-L12】【F:params.html†L4-L33】【F:feature-your-tank.html†L1-L33】
7. **Synchronise sitemap/robots templates:** Either remove `hardening/robots.txt` & `hardening/sitemap.xml` or update them automatically from the live files to prevent drift.【F:robots.txt†L1-L7】【F:hardening/sitemap.xml†L1-L48】
8. **Implement real contact submission:** Wire the contact form to an API or service; include success/failure handling instead of client-only reset.【F:contact-feedback.html†L424-L533】
9. **Document third-party scripts in privacy policy:** Confirm `privacy-legal.html` lists Funding Choices, Cloudinary, reCAPTCHA, and Formspree for transparency.【F:feature-your-tank.html†L600-L905】
10. **Remove committed `node_modules/`:** Update deployment to install dependencies dynamically and drop the vendor tree from git.【0090ac†L1-L2】

## Appendix
### A. File Size Snapshot
- `node_modules/` — 13 MB (`du -sh`).【0090ac†L1-L2】
- `backups/cleanup-20251002-165631/` — 56 KB (`du -sh`).【448e33†L1-L2】
- `js/` — 348 KB; `src/` — 120 KB (`du -sh`).【d878b2†L1-L2】【d8c005†L1-L2】
- Asset manifest:
  - `assets/books/book-cover-large.jpg` — 258 KB
  - `assets/books/book-cover-web.jpg` — 63 KB
  - `assets/js/consent-banner.js` — 6.6 KB
  - `assets/js/consent-mode.js` — 5.1 KB
  - `assets/css/ads.css` — 0.3 KB【9643a9†L1-L7】

### B. Data/CSV Backups
- `gear_master.csv` placeholder (125 bytes).【b04cf9†L1-L1】
- `backups/cleanup-20251002-165631/*.csv` duplicate live CSVs; confirm no automation depends on them.【448e33†L1-L2】

### C. Command Outputs & Link Map Highlights
- Ad slot references: Stocking (`8419879326`, `8979116676`).【F:stocking.html†L965-L976】【F:stocking.html†L1370-L1382】
- Params slots (`8136808291`, `5754828160`).【F:params.html†L575-L585】【F:params.html†L663-L672】
- Media slot (`9522042154`).【F:media.html†L502-L511】
- Gear slot (`1762971638`).【F:gear/index.html†L45-L61】
- Consent toggles `.is-ads-disabled`.【F:assets/js/consent-mode.js†L53-L68】
- Contact form lacks submission fetch.【F:contact-feedback.html†L424-L533】

### D. Manifest of External Scripts
- AdSense loader (`pagead2.googlesyndication.com`) on every template.【F:gear/index.html†L15-L22】
- Funding Choices CMP script on all templates.【F:gear/index.html†L18-L33】
- Cloudinary widget (`widget.cloudinary.com`) + Google reCAPTCHA on Feature Your Tank.【F:feature-your-tank.html†L600-L905】
- Font Awesome CDN & Google Fonts as needed.【F:gear/index.html†L7-L13】【F:index.html†L23-L30】

### E. Test Hooks & Data Attributes
- `data-testid` coverage on Gear (`gear-root`, accordions, modals) and Stocking (`species-list`, `btn-gear`) remains intact.【F:gear/index.html†L45-L53】【F:stocking.html†L1328-L1374】

## Top 10 Safest Removals
- [ ] Remove `js/gear.js` legacy bundle.【F:js/gear.js†L1-L30】
- [ ] Remove `js/modules/*.js` diagnostics.【F:js/modules/audit.js†L1-L66】
- [ ] Remove `js/feature-tank.js`.【F:js/feature-tank.js†L1-L34】
- [ ] Remove `css/params.css`.【F:css/params.css†L1-L33】
- [ ] Delete `docs/screens/curl-index.html`.【F:docs/screens/curl-index.html†L1-L26】
- [ ] Drop `verification.log`.【7d9ce9†L1-L2】
- [ ] Remove `static-qa-*.{md,json}` QA artefacts.【4fa82b†L1-L5】
- [ ] Clear `backups/cleanup-20251002-165631/`.【448e33†L1-L2】
- [ ] Remove `gear_master.csv` placeholder after pipeline check.【b04cf9†L1-L1】
- [ ] Stop tracking `node_modules/`.【0090ac†L1-L2】

## Top 10 Must-Fix Links/Joins
- [ ] Gear page should ingest `ttg_stocking_state` and surface personalised results.【F:js/stocking.js†L1077-L1094】【F:src/pages/GearPage.js†L10-L45】
- [ ] Adjust ad CSS to keep placeholders visible under consent denial.【F:assets/css/ads.css†L1-L13】
- [ ] Add `<ins>` ad units or remove AdSense loader on non-monetised pages.【F:about.html†L266-L304】【F:store.html†L96-L174】
- [ ] Add canonical links to `/gear/index.html`, `/params.html`, `/feature-your-tank.html`.【F:gear/index.html†L4-L23】【F:params.html†L4-L33】【F:feature-your-tank.html†L1-L33】
- [ ] Add meta description to `/gear/index.html`.【F:gear/index.html†L4-L12】
- [ ] Update privacy/legal copy with third-party scripts (Formspree, Cloudinary, reCAPTCHA).【F:feature-your-tank.html†L600-L905】
- [ ] Resolve duplicate robots/sitemap templates or automate sync.【F:robots.txt†L1-L7】【F:hardening/sitemap.xml†L1-L48】
- [ ] Implement actual submission for contact form.【F:contact-feedback.html†L424-L533】
- [ ] Ensure Gear page exposes transparency banner/affiliate disclosures tied to actual data consumption.【F:src/components/gear/TransparencyBanner.js†L1-L40】
- [ ] Keep JSON-LD `sameAs` arrays aligned with footer links across all templates (add to Store page).【F:index.html†L52-L88】【F:store.html†L40-L78】

## Mini Roadmap
- **Week 1 (cleanup):** Delete unused bundles and QA artefacts, drop `node_modules/`, fix consent CSS placeholders, add missing canonical/meta tags, and sync sitemap/robots templates.
- **Week 2 (nav/SEO):** Restore Stocking→Gear data bridge, add JSON-LD/`sameAs` to store + gear, introduce ad slots (or remove loaders) on informational pages, and document third-party scripts in privacy copy.
- **Week 3 (ads/consent + a11y):** Re-test consent flow with Funding Choices, ensure ad placeholders persist for NPA users, implement real contact form submission with error handling, and audit accessibility (focus management, ARIA) on consent modal and feature form.
