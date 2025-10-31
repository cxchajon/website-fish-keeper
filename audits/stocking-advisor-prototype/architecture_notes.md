# Architecture Notes

- **Entry point:** `/prototype/stocking-prototype.html` is a standalone HTML document flagged with body classes `proto-stock theme-dark prototype-stock-page` and sets `document.documentElement.classList.add('prototype-mode')` via `/prototype/js/stocking-prototype.js`.
- **Shared chrome:** Navigation (`<div id="site-nav">`) and footer (`<div id="site-footer" data-footer-src="/footer.html?v=1.4.9">`) are placeholders; `/js/nav.js` and `/js/footer-loader.js` fetch reusable fragments after load.
- **Styling stack:** Inherits site-wide CSS (`/css/style.css`, `/css/site.css`, `/css/ui.css`, utilities) plus prototype-specific layers under `/prototype/css/` and `/prototype/assets/css/` to restyle cards, popovers, and filtration UI for the dark prototype theme.
- **Prototype guardrails:** `/prototype/assets/js/proto-guard.js`, `/prototype/assets/js/filtration.js`, `/prototype/assets/js/proto-guards.js`, and an inline purge script ensure legacy filtration widgets are suppressed and prototype bundles are not served on live routes.
- **Data sources:**
  - Species dataset loads from `proto/data/species.v2.json` via `/proto/logic/species.adapter.v2.js` (with schema checks in `speciesSchema.proto.js`).
  - Filtration math constants are defined in `/prototype/assets/js/proto-filtration-math.js` and consumed by `/prototype/js/proto-filtration.js`.
  - Conflict rules and aggression scoring reuse live modules `/js/logic/compute.js`, `/js/logic/conflicts.js`, and proto overrides (`proto/logic/aggression.v2.js`, `proto/logic/compat.v2.js`).
- **Computation layer:** An `<script type="importmap">` remaps `/js/logic/compute.js` to `/prototype/js/logic/compute-proxy.js`, which injects prototype datasets, warning rules (`prototype/js/logic/warnings/rules.js`), and filtration math before delegating to the live compute engine.
- **State management:** `js/stocking.js` remains the main controller, relying on `window.appState` for tank, filters, and stock. Prototype filtration updates `window.appState.filters` and dispatches `ttg:recompute` events consumed by `js/stocking.js` to refresh UI.
- **UI composition:** Cards are plain HTML within the document; interactive behavior is layered by modules:
  - `/prototype/js/info-popovers.js` and `/prototype/assets/js/proto-popovers.js` manage dialog-style info popovers.
  - `/prototype/js/ui/tooltip.js` handles tooltip interactions.
  - `/prototype/assets/js/ui-meters.js` formats dynamic meters/bars.
- **Consent & ads:** Google CMP loads via Funding Choices script; inline bridge synchronizes CMP signals with the local consent banner (`/assets/js/consent-banner.js`) and sets `data-ad-consent`. Ad-slot viewability is tracked by `/js/ad-slot-view-tracking.js`.
- **External dependencies:** No third-party package managers are used; all JS/CSS served from repository paths or Google Funding Choices.
- **Prototype flags:** Scripts check `location.pathname.includes('/prototype/stocking-prototype.html')` before executing prototype-only logic, preventing interference with live pages.
