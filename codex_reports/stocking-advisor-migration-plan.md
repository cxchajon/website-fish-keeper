# Stocking Advisor Prototype → Live Migration Prep (2025-10-31)

## 0. Pre-Flight Notes
- **Workspace sweep:** Reviewed `/`, `/prototype`, `/proto`, `/js`, `/css`, `/data`, `/assets`, `_headers`, and prior audit folders to confirm asset coverage.
- **Play script:** Regenerated runbook at `codex_reports/stocking-advisor-play-script.md` (2025-10-31 timestamp).
- **Live snapshot:** Created backup at `backups/live-stocking/20251031T182721Z/` covering HTML (`stocking.html`, `nav.html`, `footer.html`), CSS (`css/style.css`, `css/site.css`, `css/ui.css`), shared utilities (`assets/css/utilities.css`), JS + data modules (`js/*.js`, `js/stocking/*`, `js/logic/*`), and configs (`_headers`, `_redirects`).
- **Branch:** Working on `work`; staging target = Netlify preview built from this branch (no production deploy yet).

## 1. Inventory (Prototype = Source of Truth)
| Area | Prototype Source | Live Target | Purpose / Notes |
| --- | --- | --- | --- |
| HTML Template | `prototype/stocking-prototype.html` | `stocking.html` | Full page markup (hero, tool shell, FAQ, schema blocks, ad placeholders). |
| Shared Includes | `nav.html`, `footer.html` | `nav.html`, `footer.html` | Navigation/footer content; ensure accessible fallback without JS. |
| Global CSS | `/css/style.css`, `/css/site.css`, `/css/ui.css`, `/assets/css/utilities.css` | same | Base theming, layout tokens, buttons, cards. |
| Prototype CSS Overrides | `/prototype/css/stocking-prototype.css`, `/prototype/assets/css/prototype.css`, `/prototype/assets/css/proto-popovers.css`, `/prototype/assets/css/filtration.css`, `/prototype/css/proto-fixes.css` | (none yet) | Namespaced styles for popovers, FAQ spacing, filtration overrides, accessibility tokens. |
| Core JS Controllers | `/js/stocking.js`, `/js/tank-size-card.js`, `/js/logic/*.js`, `/js/stocking/*.js` | same | Tank planner engine, data adapters, event bus, validators. |
| Prototype JS Enhancements | `/prototype/js/stocking-prototype.js`, `/prototype/js/info-popovers.js`, `/prototype/js/proto-filtration.js`, `/prototype/js/ui/tooltip.js`, `/prototype/assets/js/ui-meters.js`, `/prototype/assets/js/proto-filter-tests.js`, `/prototype/js/logic/compute-proxy.js`, `/prototype/js/warnings/*` | (not in live) | Compact turnover UI, tooltip manager, filtration chip UI, FAQ/How-It-Works modal, analytics hooks. |
| Data Sources | `/proto/data/species.v2.json`, `/proto/logic/species.adapter.v2.js`, `/prototype/js/warnings/*.js`, `/prototype/js/logic/compute-proxy.js` | `js/fish-data.js`, `js/logic/speciesSchema.js`, `js/logic/compute.js`, `js/logic/conflicts.js`, `js/params.js` | Species library, warning catalog, effective capacity parameters, compatibility constants. |
| Schema / Meta | `prototype/stocking-prototype.html` head (Gemini-set meta) + `audits/stocking-advisor-prototype/structured_data.json` (Organization/WebPage/WebApplication/BreadcrumbList/FAQPage graph) | `stocking.html` head + inline WebApplication JSON-LD | Need consolidated Gemini copy, canonical, OG/Twitter, and JSON-LD graph parity. |
| Ad Placeholders | `prototype/stocking-prototype.html` (`#ad-pre-tool`, `#ad-mid-results`, `#ad-post-faq`) | `stocking.html` (`.ttg-adunit--top`, `.ttg-adunit--bottom`; mid-slot missing) | Ensure three labeled slots with reserved height, no CLS. |
| Accessibility Hooks | `prototype/stocking-prototype.html` (`.skip-link`, `<main id="main-content" role="main">`, ARIA on popovers/FAQ) + `/prototype/assets/css/prototype.css` tokens | `stocking.html` (no skip link; `main` lacks explicit role, tooltip ARIA differs) | Align focus order, skip link, ARIA attributes, keyboard support. |
| Images / OG Assets | `/assets/og/stocking-advisor-prototype.png`, `/assets/icons/apple-touch-icon.png`, `/logo.png` references | `logo.png` (current OG) | Need production OG/Twitter assets + alt text parity with prototype references. |
| Headers / Configs | `_headers`, `_redirects`, `ads.txt` (no change) | same | Confirm CSP, Referrer-Policy, caching entries cover new assets. |
| External Includes | `/js/nav.js`, `/js/footer-loader.js` vs fallback markup in `nav.html`/`footer.html` | same | Ensure nav/footer accessible when JS disabled (server include fallback). |

## 2. Diff Checklist (Prototype vs Live)
| Item | Status | Notes |
| --- | --- | --- |
| Featured summary + removed walkthrough line | Needs Merge | Live hero lacks `hero-subline` and contact summary; prototype removed old walkthrough text and tightened spacing. |
| Compact Estimated Turnover popover | Needs Merge | Live still uses legacy tooltip + passive value; prototype introduces single popover + compact input module. |
| FAQ content & deletions | Needs Merge | Live page lacks FAQ entirely; prototype includes curated FAQ (sans “compare presets”) with rewrites + Contact link. |
| JSON-LD graph coverage | Needs Merge | Live only has WebApplication block; must add Organization, WebPage (with `dateModified`), BreadcrumbList, FAQPage per prototype audit. |
| Meta/OG/Twitter & canonical | Needs Merge | Live meta points to `/stocking.html` with legacy copy; prototype uses Gemini-provided title/description, OG alt text, canonical `/stocking-advisor.html`. Need to port text but preserve live URL. |
| Ad placeholders (3 slots) | Needs Merge | Live includes top/bottom Google slots only; missing mid-results container + reserved heights/labels from prototype placeholders. |
| Accessibility foundations | Needs Merge | Live lacks skip link, `<main role="main">`, idempotent popover ARIA, and FAQ keyboard bindings present in prototype. |
| Filtration/stocking logic parity | Needs Merge | Prototype relies on compute proxy + updated warnings (betta female, fin-nipper). Live still on legacy data set and lacks new alert copy. |
| CSS namespace collisions | Needs Merge | Prototype styles currently isolated under `.proto-stock`; live needs scoped imports to avoid leaking to other pages. |
| Footer/nav policy links without JS | Aligned | Live already ships static `nav.html`/`footer.html`; ensure unchanged when porting markup. |

## 3. Migration Plan Matrix
| Source → Target | Operation | Notes | Rollback |
| --- | --- | --- | --- |
| `prototype/stocking-prototype.html` → `stocking.html` | Merge | Replace hero, ad slots, FAQ section, schema blocks while adjusting URLs/canonicals for live path; preserve consent banner + analytics. | Restore `backups/live-stocking/20251031T182721Z/html/stocking.html`. |
| `prototype/css/stocking-prototype.css` (scoped portions) → `css/style.css` or new page CSS | Merge | Extract `.proto-stock` rules, namespace to `.stocking-page` to avoid bleed; integrate hero spacing + FAQ styles. | Restore affected CSS from backup. |
| `prototype/assets/css/proto-popovers.css` → `css/ui.css` (scoped) | Merge | Incorporate popover tokens, ensure single tooltip system; add `.stocking-popover` classes. | Revert `css/ui.css` from backup. |
| `prototype/assets/css/filtration.css` → `css/site.css` | Merge | Bring turnover block layout + chip styling, adjust selectors to live DOM. | Revert `css/site.css`. |
| `prototype/js/info-popovers.js` + `prototype/js/ui/tooltip.js` → `js/stocking-info.js` (new) | Adopt (as-is with namespacing) | Port as standalone module imported by `stocking.js`; ensure idempotent init guard to avoid double binding. | Delete new module and restore `js/stocking.js` from backup. |
| `prototype/js/proto-filtration.js` → `js/stocking.js` or new helper | Merge | Integrate turnover computation UI and chip interactions into live compute loop; verify watchers for MutationObserver compatibility. | Revert `js/stocking.js` + remove helper. |
| `proto/data/species.v2.json` + `proto/logic/species.adapter.v2.js` → `js/fish-data.js`/`js/logic/*.js` | Merge | Replace legacy dataset with adapter pipeline; map property names to live schema (e.g., `bioloadGE`, tags). | Revert `js/fish-data.js`, `js/logic` folder from backup. |
| `audits/stocking-advisor-prototype/structured_data.json` → `<head>` in `stocking.html` | Adopt (as-is with URL tweaks) | Inline JSON-LD graph, update `@id`/`url` to `/stocking.html` and refresh `dateModified`. | Remove new block; reinstate old WebApplication JSON-LD. |
| Prototype FAQ copy (same file) → new `<section id="stocking-faq">` in `stocking.html` | Adopt | Insert details/summary markup with `aria-expanded`, keyboard-handled toggles. | Remove FAQ section. |
| `prototype/assets/js/ui-meters.js` → evaluate | Map | Determine if functionality duplicates existing bars; map to existing env meter code or fold logic into `js/stocking.js`. | Omit mapping / revert `js/stocking.js`. |
| `prototype/assets/css/prototype.css` tokens → `css/style.css` | Merge | Bring skip-link styling, focus outlines; ensure tokens defined once. | Revert `css/style.css`. |
| OG assets (`assets/og/stocking-advisor-prototype.png`) → `assets/og/stocking-advisor-live.png` | Map | Duplicate asset under live filename; update `<meta>` references. | Restore meta to `logo.png`. |
| `_headers` cache rules → update if new assets added | Adopt | Ensure caching + CSP allow new JS/CSS paths under `/prototype` -> `/js`. | Reapply backed-up `_headers`. |

## 4. Implementation Constraints Checklist
- Honor prototype visual intent; no redesign beyond parity adjustments.
- Keep canonical URL `https://thetankguide.com/stocking.html` while importing Gemini copy.
- Consolidate tooltip systems: port prototype popover and disable legacy `ttg-tooltip` for turnover info to prevent double-binding.
- FAQ remains within main flow above footer; avoid portal rendering.
- Maintain ad slot markup only (no script auto-injection beyond placeholders).
- Keep nav/footer links rendered in HTML for no-JS fallback.
- Deduplicate meta/schema blocks so each type appears once.

## 5. Acceptance Evidence Plan
- Functional: Manual mobile (Safari emu) + desktop (Chrome) runs per acceptance list (popover toggle, FAQ absence/presence, hero spacing).
- Content/SEO: Validate head tags vs Gemini spec; run Google Rich Results (record test IDs in PR notes); confirm canonical + OG images.
- Accessibility: Keyboard path for skip link, FAQ toggles, popover close; verify headings order (H1 → H2) and tokens meet contrast.
- Performance/Robustness: Inspect console for duplicate listeners; measure layout shift around ad placeholders via Lighthouse trace; ensure `_headers` retains CSP/Referrer policies.

## 6. Staging & PR Checklist
- Branch: `work` → staging Netlify preview.
- Update `CHANGELOG.md` with migration prep entry.
- Collect screenshots: hero (desktop & mobile), turnover popover open, FAQ accordion expanded once staging build ready.
- Link Rich Results validation (record ID/text in PR description).
- Include inventory table, diff checklist, migration matrix, acceptance notes, and rollback steps in PR summary (reference this doc).

## 7. Rollback Plan
1. Replace modified files with counterparts from `backups/live-stocking/20251031T182721Z/` (HTML, CSS, JS, config).
2. `git checkout -- <file>` is safe pre-deploy; otherwise copy backup files back into repo and redeploy.
3. Purge Netlify CDN cache (or trigger redeploy) to clear stale assets; invalidate Cloudflare if used for `/assets/og/*`.

## 8. Post-Flight Summary & Follow-ups
- **Migration Report Notes:** Pending implementation, monitor for data adapter regressions (species v2). Ensure tests updated to cover new warnings.
- **P2 Follow-ups:**
  - Automate `dateModified` injection for JSON-LD (avoid manual edits).
  - Wire ad loader to respect new mid-results placeholder once ad ops ready.
  - Evaluate CSS namespace strategy (e.g., bundle-level SCSS) to prevent future prototype bleed.
