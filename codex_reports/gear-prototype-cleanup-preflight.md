# Gear Prototype Cleanup — Preflight Audit

## Candidate files and first headings
- `gear.html` — no `<h1>`; JavaScript redirect stub to `/gear/`.
- `prototype/gear/index.html` — first `<h1>`: "Fish Keeping Gear Guide".
- `prototype/gear/includes/ga4.html` — include fragment (no heading).
- `prototype/gear/includes/nav.html` — include fragment (no heading).
- `prototype/gear/includes/gear-footer.html` — include fragment (no heading).
- `prototype/gear/css/gear.v2.css` — CSS copied for prototype only.
- `prototype/gear/proto-gear.css` — scoped CSS for prototype `.proto-gear` layout.
- `prototype/gear/js/consent-mode.js` — consent script copy for prototype.
- `prototype/gear/js/nav.js` — nav loader copy for prototype.
- `prototype/gear/js/footer-loader.js` — footer loader copy for prototype.
- `prototype/gear/js/gear.v2.js` — prototype JS bundle.
- `prototype/gear/js/gear.v2.data.js` — prototype data bootstrap.
- `prototype/gear/js/gear-data.js` — prototype data helpers.
- `prototype/gear/js/faq-accordion.js` — prototype-only accordion behavior.
- `prototype/gear/js/quick-answers.js` — prototype-only helper.
- `prototype/gear/js/ui/tooltip.js` — prototype tooltip helper.
- `prototype/gear/js/ui/tooltip-content.js` — prototype tooltip content registry.
- `prototype/gear/data/*` — duplicated CSV/JSON datasets for prototype.
- `prototype/gear/assets/sprite.socials.svg` — prototype asset copy.
- `css/prototype-gear.css` — unused legacy prototype styles in `/css`.

## Inbound references discovered
- `gear.html`
  - `stocking-advisor.html:1755` — CTA link `href="/gear.html"`.
  - `js/stocking.js:195` — constant `GEAR_PAGE_PATH = '/gear.html'`.
  - `tests/consent-ads.spec.ts:31` — redirect helper path list includes `/gear.html`.
  - Documentation & audit references (e.g., `README.md:10`, `ad-audits/adsense-readiness.md:24`).
- `prototype/gear/index.html`
  - Mentioned only inside prototype manifest (`AUDIT/gear_prototype_manifest.csv:7`) and safeguards doc (`AUDIT/gear_prototype_safeguards.md:12`).
- `prototype/gear/includes/ga4.html`
  - Referenced from `prototype/gear/index.html:393` include.
- `prototype/gear/includes/nav.html`
  - Loaded by `prototype/gear/js/nav.js:39` (fetch target `/prototype/gear/includes/nav.html`).
- `prototype/gear/includes/gear-footer.html`
  - Loaded by `prototype/gear/js/footer-loader.js:8` (fetch target `/prototype/gear/includes/gear-footer.html`).
- `prototype/gear/css/gear.v2.css`
  - Linked from `prototype/gear/index.html:147`.
- `prototype/gear/proto-gear.css`
  - Scoped in `prototype/gear/index.html:446` via `class="proto-gear"`.
- `prototype/gear/js/consent-mode.js`
  - Script tag in `prototype/gear/index.html:184` (`<script src="./js/consent-mode.js" defer></script>`).
- `prototype/gear/js/nav.js`
  - Script tag in `prototype/gear/index.html:939`.
- `prototype/gear/js/footer-loader.js`
  - Script tag in `prototype/gear/index.html:943`.
- `prototype/gear/js/gear.v2.js`
  - Script tag in `prototype/gear/index.html:941`.
- `prototype/gear/js/gear.v2.data.js`
  - Script tag in `prototype/gear/index.html:940`.
- `prototype/gear/js/gear-data.js`
  - Imported by `prototype/gear/js/gear.v2.js:17`.
- `prototype/gear/js/faq-accordion.js`
  - Imported by `prototype/gear/js/gear.v2.js:19`.
- `prototype/gear/js/quick-answers.js`
  - Imported by `prototype/gear/js/gear.v2.js:20`.
- `prototype/gear/js/ui/tooltip.js`
  - Imported by `prototype/gear/js/gear.v2.js:16`.
- `prototype/gear/js/ui/tooltip-content.js`
  - Imported by `prototype/gear/js/ui/tooltip.js:4`.
- `prototype/gear/data/*`
  - Imported throughout `prototype/gear/js/gear-data.js` (e.g., `fetch('./data/gearCatalog.json')`).
- `prototype/gear/assets/sprite.socials.svg`
  - Referenced in `prototype/gear/includes/gear-footer.html:26` as the social icon sprite.
- `css/prototype-gear.css`
  - No references found via ripgrep; appears unused legacy prototype stylesheet.

## Canonical source for `/gear/`
- Confirmed `gear/index.html` renders the live `/gear/` page and includes `<link rel="canonical" href="https://thetankguide.com/gear/">`.

## Canonical & redirect checks
- `/gear/index.html` already canonicalizes to `/gear/` via `_redirects`.
- `_redirects` currently includes `/gear/index.html   /gear/   301` and `/gear.html /gear/ 301`.
- `<link rel="canonical" href="https://thetankguide.com/gear/">` present in `gear/index.html`.

## Sitemap confirmation
- `sitemap.xml` lists only `https://thetankguide.com/gear/` for Gear (line 106).
