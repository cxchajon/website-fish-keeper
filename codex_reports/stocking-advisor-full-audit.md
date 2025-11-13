# Full Audit — Stocking Advisor (Live Page)

## 1. Meta & Head Inventory Table

| Tag | Key Attributes | Purpose & Notes |
| --- | --------------- | --------------- |
| `link` | rel=`preload`, href=`https://thetankguide.com/footer.html?v=1.5.2` | Preloads shared footer fragment fetched later by `footer-loader.js`; uses anonymous CORS fetch hint. 【F:stocking-advisor.html†L4-L4】【F:stocking-advisor.html†L1981-L1982】 |
| `meta` | charset=`UTF-8` | Sets UTF-8 encoding. 【F:stocking-advisor.html†L5-L5】 |
| `title` | "Aquarium Stocking Calculator & Fish Compatibility | The Tank Guide" | Page title targets core keyword + brand. 【F:stocking-advisor.html†L6-L6】 |
| `meta` | name=`description`, content=`Plan your freshwater tank…` | Primary SEO description present; matches OG/Twitter copy. 【F:stocking-advisor.html†L7-L24】 |
| `meta` | name=`robots`, content=`index,follow` | Allows indexing. 【F:stocking-advisor.html†L11-L11】 |
| `meta` | name=`viewport`, content=`width=device-width, initial-scale=1` | Responsive viewport configured. 【F:stocking-advisor.html†L12-L12】 |
| `meta` | name=`theme-color`, content=`#0a1020` | Sets mobile browser UI color. 【F:stocking-advisor.html†L13-L13】 |
| `link` | rel=`manifest`, href=`https://thetankguide.com/manifest.webmanifest` | PWA manifest reference. 【F:stocking-advisor.html†L14-L14】 |
| `link` | rel=`icon`, href=`https://thetankguide.com/favicon.ico` | Favicon. 【F:stocking-advisor.html†L15-L15】 |
| `link` | rel=`apple-touch-icon`, sizes=`180x180`, href=`https://thetankguide.com/assets/img/Logo-Master-180x10.PNG` | Apple touch icon. 【F:stocking-advisor.html†L16-L16】 |
| `link` | rel=`canonical`, href=`https://thetankguide.com/stocking-advisor.html` | Canonical matches live URL and sitemap. 【F:stocking-advisor.html†L17-L17】【F:sitemap.xml†L118-L118】 |
| `meta` | property=`og:*` set (`type`, `url`, `title`, `description`, `site_name`, `image`, `image:alt`, `image:width`, `image:height`, `locale`) | Comprehensive Open Graph coverage; image path currently points at missing asset (`/assets/og/stocking-advisor.png`). 【F:stocking-advisor.html†L18-L33】 |
| `meta` | name=`twitter:*` set (`card`, `site`, `creator`, `url`, `title`, `description`, `image`, `image:alt`) | Twitter summary large card mirrors OG data. 【F:stocking-advisor.html†L31-L41】 |
| `link` | rel=`stylesheet`, href=`https://thetankguide.com/css/style.css?v=2024-06-05a` (id `css-main`) | Primary global stylesheet. 【F:stocking-advisor.html†L42-L42】 |
| `link` | rel=`stylesheet`, href=`https://thetankguide.com/assets/css/utilities.css?v=2025-11-07` | Utility tokens. 【F:stocking-advisor.html†L43-L43】 |
| `link` | rel=`stylesheet`, href=`https://thetankguide.com/css/site.css?v=1.5.2` | Layout theme. 【F:stocking-advisor.html†L44-L44】 |
| `link` | rel=`stylesheet`, href=`https://thetankguide.com/css/ui.css?v=2024-09-15` | UI components baseline. 【F:stocking-advisor.html†L45-L45】 |
| `link` | rel=`stylesheet`, href=`https://thetankguide.com/css/stocking-advisor.css?v=2025-10-31` | Tool-specific styling. 【F:stocking-advisor.html†L46-L46】 |
| `style` (inline) | Prototype purge + tooltip styling | Removes deprecated filtration UI fragments that legacy scripts might inject. 【F:stocking-advisor.html†L47-L94】 |
| `script` | type=`application/ld+json` | See structured data summary below. 【F:stocking-advisor.html†L95-L188】 |
| `script` | defer src=`https://thetankguide.com/js/nav.js?v=1.1.0` | Injects navigation shell. 【F:stocking-advisor.html†L189-L189】 |
| `style` (inline) | Color tokens, skip-link, base typography, ad placeholder sizing, focus outlines, button hit targets | Accessibility-first token definitions (e.g., 44px hit area). 【F:stocking-advisor.html†L190-L458】 |
| `script` | defer src=`https://thetankguide.com/assets/js/consent-mode.js` | Initializes Google Consent Mode defaults. 【F:stocking-advisor.html†L1209-L1210】 |
| `script` | async src=`https://fundingchoicesmessages.google.com/i/pub-9905718149811880?ers=1` | Loads Google Funding Choices CMP. 【F:stocking-advisor.html†L1214-L1215】 |
| `script` (inline) | CMP bootstrap (googlefcPresent iframe) | Signals Funding Choices presence per Google spec. 【F:stocking-advisor.html†L1216-L1234】 |
| Comment include | `<!--#include virtual="/includes/ga4.html" -->` | Server-side include placeholder for GA4 gtag; verify on production server. 【F:stocking-advisor.html†L1211-L1212】 |

**Head gaps & duplicates:** All critical SEO metas present. Missing dedicated `meta` for `og:updated_time`/`article:published_time` (optional). Primary blocker is missing OG/Twitter image asset at referenced URL.

## 2. Structured Data Summary Table

| Node Type | Key Properties Present | Issues / Gaps |
| --------- | ---------------------- | ------------- |
| `Organization` (`https://thetankguide.com/#organization`) | `name`, `url`, `@id`, `logo.url`, `sameAs` social array | No `logo` dimensions; acceptable but optional improvement. 【F:stocking-advisor.html†L99-L114】 |
| `WebPage` (`…/stocking-advisor.html#webpage`) | `@id`, `url`, `name`, `description`, `isPartOf`, `primaryImageOfPage`, `dateModified` (`2025-10-31T23:01:57Z`) | Referenced `primaryImageOfPage.url` points to missing `/assets/og/stocking-advisor.png`; consider adding `inLanguage`. 【F:stocking-advisor.html†L115-L129】 |
| `WebApplication` (`…#webapp`) | `@id`, `name`, `url`, `description`, `applicationCategory`, `operatingSystem`, `image`, `author`, `publisher` | Image reference shares the missing OG file; consider `offers`/`featureList` for richer SERP detail. 【F:stocking-advisor.html†L130-L144】 |
| `BreadcrumbList` (`…#breadcrumb`) | `itemListElement` for Home → Stocking Advisor | Fully populated; no issues. 【F:stocking-advisor.html†L145-L163】 |
| `FAQPage` (`…#faq`) | Two Q&A pairs in `mainEntity` | First answer is only 34 words (<40), violating Gemini FAQ word-length guidance; both answers reference missing OG image domain. 【F:stocking-advisor.html†L164-L185】【1cd013†L1-L11】 |

## 3. Body Layout & Content Map

| Section | DOM Hook | Content & Word Count | Notes |
| ------- | -------- | -------------------- | ----- |
| Skip link | `.skip-link` before nav | Accessible jump to `#main-content`. 【F:stocking-advisor.html†L1238-L1238】 |
| Navigation placeholder | `#site-nav` | Populated by `nav.js` after load. 【F:stocking-advisor.html†L1239-L1240】【F:stocking-advisor.html†L189-L189】 |
| Hero | `<header class="hero">` | H1 "Stocking Advisor" with mission subline; sets context. 【F:stocking-advisor.html†L1242-L1251】 |
| Pre-tool ad | `.ad-placeholder#ad-pre-tool` | Static 120px tall placeholder labelled "Advertisement". 【F:stocking-advisor.html†L1254-L1257】【F:stocking-advisor.html†L236-L249】 |
| Tool wrapper | `.wrap.page-content` | Contains secondary ad slot, calculator cards, CTA, education, FAQ, ad slots. 【F:stocking-advisor.html†L1260-L1767】 |
| Secondary ad | `.ad-container.ad-hero` | Complementary region labelled advertisement. 【F:stocking-advisor.html†L1261-L1263】 |
| Tank Size card | `#tank-size-card` | H2, popover dialog, select control for volume, filter planner UI. 【F:stocking-advisor.html†L1265-L1507】 |
| Current Stock card | `#stock-list-card` | H2, info dialog list, empty state, warnings container. 【F:stocking-advisor.html†L1571-L1609】 |
| Environmental Recommendations | `#env-card` | Dynamic environment guidance, warnings, summary, chips. 【F:stocking-advisor.html†L1611-L1663】 |
| Plan Your Stock | Panel w/ `#plan-species`, `#plan-qty`, `#plan-add` | Form controls for adding species, status banner. 【F:stocking-advisor.html†L1665-L1703】 |
| Gear CTA | `#btn-gear` | Link to `/gear.html`. 【F:stocking-advisor.html†L1707-L1707】 |
| Educational explainer | `#post-results-explainer` | Multi-heading educational block (~229 words). 【F:stocking-advisor.html†L1709-L1743】【49455d†L1-L3】 |
| Mid-content ad | `.ad-placeholder#ad-mid-content` | Labelled advertisement between education and FAQ. 【F:stocking-advisor.html†L1727-L1733】 |
| Nitrogen Cycle panel | `#educational-title` | Single educational paragraph. 【F:stocking-advisor.html†L1735-L1743】 |
| FAQ section | `#faq` | Static H3 + paragraph pairs; no accordion markup despite scripts/styles. 【F:stocking-advisor.html†L1745-L1768】【F:stocking-advisor.html†L1961-L1978】 |
| Post-FAQ ad | `.ad-placeholder#ad-post-faq` | Labelled advertisement placeholder. 【F:stocking-advisor.html†L1769-L1773】 |
| SEO intro | `.seo-intro` | Short keyword-rich summary. 【F:stocking-advisor.html†L1775-L1779】 |
| Footer placeholder | `#site-footer[data-footer-src]` | Footer injected asynchronously. 【F:stocking-advisor.html†L1981-L1982】 |
| Consent UI | `#ttg-consent`, `#ttg-consent-modal` | Banner + modal for cookie preferences. 【F:stocking-advisor.html†L1794-L1836】 |
| Tooltips & overlays | `#bioload-info-panel`, `#proto-info-overlay`, `#turnover-tip` | Hidden dialogs for info popovers. 【F:stocking-advisor.html†L1783-L1793】 |

Total on-page text inside `<main>` ≈1,965 words (>300 minimum), ensuring substantial unique content for AdSense review. 【fdd9d1†L1-L25】

## 4. Accessibility & UX Notes

- **Landmarks & navigation:** `<main role="main">`, skip link, aria-live status for dynamic feedback, and popover dialogs with `aria-labelledby` provide strong baseline. 【F:stocking-advisor.html†L1238-L1293】
- **Heading hierarchy:** Single H1 followed by logical H2/H3 structure supporting screen reader outline. 【bef6df†L24-L35】
- **Buttons & focus:** Global inline CSS enforces 44px minimum hit area and custom focus outlines (`outline: 2px solid rgba(163,200,255,0.7)`). 【F:stocking-advisor.html†L424-L455】
- **Accordion gap:** FAQ markup lacks `.faq-trigger` buttons or `data-faq-accordion` containers expected by JS, so no keyboard-toggleable accordion exists—violates intended WCAG behavior. 【F:stocking-advisor.html†L1745-L1768】【F:stocking-advisor.html†L1961-L1978】
- **Images:** No `<img>` elements; OG image missing on server (see blockers).
- **Modal support:** Info popovers/overlays use `role="dialog"`, close buttons, and hidden state toggles; ensure focus trapping when activated (not covered in static HTML). 【F:stocking-advisor.html†L1271-L1294】【F:stocking-advisor.html†L1587-L1599】【F:stocking-advisor.html†L1626-L1637】【F:stocking-advisor.html†L1783-L1793】
- **ARIA for ads:** Ad placeholders labeled `role="complementary"` with `aria-label="Advertisement"` for assistive clarity. 【F:stocking-advisor.html†L1255-L1263】【F:stocking-advisor.html†L1727-L1773】
- **Keyboard navigation:** Primary controls are semantic `<button>`/`<select>` elements; ensure JS maintains focus management when dialogs open (runtime check pending).

## 5. AdSense Readiness Findings

| Checklist Item | Status | Evidence |
| -------------- | ------ | -------- |
| ≥300 words of unique, educational copy | ✅ | 1,965 words across hero, tool instructions, education, FAQ. 【fdd9d1†L1-L25】 |
| Clear navigation to About/Contact/Privacy/Terms | ✅ | Footer loader fetches shared nav/footer; direct link to Contact inside FAQ; standalone pages exist in repo. 【F:stocking-advisor.html†L1707-L1768】【F:contact-feedback.html†L1-L26】【F:privacy-legal.html†L1-L20】【F:terms.html†L1-L17】 |
| Family-safe, policy-compliant content | ✅ | Educational tone focused on aquarium care; no sensitive topics. 【F:stocking-advisor.html†L1245-L1768】 |
| Ad placeholders labeled & size-stable | ✅ | `.ad-placeholder` min-height 120px, uppercase label, ARIA role. 【F:stocking-advisor.html†L236-L249】【F:stocking-advisor.html†L1255-L1769】 |
| ≤3 ads in initial viewport | ⚠️ | Four placeholders exist (`ad-pre-tool`, `.ad-hero`, `ad-mid-content`, `ad-post-faq`); depending on viewport height, first two may co-display before content. Consider load rules to keep ≤3 visible above the fold. 【F:stocking-advisor.html†L1255-L1733】 |
| Prohibited elements absent (pop-ups, misleading UI) | ✅ | Only consent banner (required) and info dialogs triggered by explicit buttons. 【F:stocking-advisor.html†L1794-L1836】 |
| Ad consent flow ready | ✅ | Google CMP script + TTG consent bridge toggles `data-ad-consent` attribute and dispatches events for slots. 【F:stocking-advisor.html†L1214-L1234】【F:stocking-advisor.html†L1863-L1926】 |
| Ad scripts non-breaking | ⚠️ | `/js/ad-slot-view-tracking.js` loads without `defer`, blocking parsing; recommend adding `defer`/`async`. 【F:stocking-advisor.html†L1931-L1933】 |

## 6. Performance / Freshness Metrics

- **File weights (local assets only):** Combined HTML + CSS + JS ≈403 KB before compression (HTML 63.5 KB; CSS 109.3 KB total; JS 230.4 KB). 【c24052†L1-L23】
- **Critical path:** Four CSS files + large inline styles may delay first paint; consider consolidating or preloading critical CSS.
- **Scripts:** Modules (`compute.js`, `conflicts.js`, `stocking.js`, etc.) load as deferred by default; legacy scripts use explicit `defer` except `ad-slot-view-tracking.js`. 【F:stocking-advisor.html†L1710-L1933】
- **Consent & analytics:** Consent Mode script deferred; GA4 served via SSI include (verify production server resolves include). 【F:stocking-advisor.html†L1209-L1212】
- **Preload hints:** Only footer fragment is preloaded; no font/image preloads.
- **Lazy loading:** No `loading="lazy"` necessary (no `<img>`); consider deferring heavy tooltips until interaction.
- **Freshness:** `dateModified` in WebPage schema is `2025-10-31T23:01:57Z`; ensure this matches actual deployment timestamp. 【F:stocking-advisor.html†L115-L129】
- **Sitemap & canonical:** Entry present in `sitemap.xml` and canonical self-referential; consistent for crawlers. 【F:sitemap.xml†L118-L118】【F:stocking-advisor.html†L17-L17】

## 7. Conclusion Summary

- **Overall readiness:** Rich interactive tool with >1,900 words of educational copy, structured data coverage, labeled ad placeholders, and consent infrastructure suitable for AdSense review. 【F:stocking-advisor.html†L1245-L1933】【fdd9d1†L1-L25】
- **Minor fixes:** Add accessible accordion markup for the FAQ, extend FAQ JSON-LD answers to ≥40 words, and defer `/js/ad-slot-view-tracking.js` to keep parsing non-blocking. 【F:stocking-advisor.html†L1745-L1978】【1cd013†L1-L11】【F:stocking-advisor.html†L1931-L1933】
- **Blockers:** Publish the referenced social/OG image at `https://thetankguide.com/assets/og/stocking-advisor.png` (asset missing from repo and build), or update metadata to a valid image before Gemini verification. 【F:stocking-advisor.html†L26-L40】【7c696d†L1-L2】

