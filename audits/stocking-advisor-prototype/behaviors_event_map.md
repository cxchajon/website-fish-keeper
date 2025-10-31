# Behaviors & Event Map

## Tank & Filter Setup
- `change` on `#tank-size` → `tank-size-card.js` normalizes preset, updates facts line, stores selection, dispatches `CustomEvent('ttg:tank:changed', { tank })` → `js/stocking.js` refreshes species lists and recomputes.
- `click/focus/blur` on `#tank-size` → toggles `.select-wrap.open` class for chevron animation.
- `change` on `#filter-product` → `prototype/js/proto-filtration.js` runs `handleProductChange()` to fetch catalog data, enable `#filter-product-add`, and update helper text.
- `click` on `#filter-product-add` → `tryAddProduct()` → `setFilters()` updates filter state, writes `localStorage`, renders chips, and `window.dispatchEvent('ttg:recompute')` for recalculation.
- `input`/`keydown Enter` on `#fs-gph` → validates numeric input, optionally adds manual filter via `tryAddCustom()`.
- `change` on `#fs-type` → toggles manual add availability, updates hints.
- `click` on `[data-remove-filter]` within `.proto-filter-chips` → removes filter entry, reruns `setFilters()`.
- `window` listens for `ttg:recompute` (raised by filtration module) → `js/stocking.js` executes recompute pipeline and re-renders environment + stock cards.

## Stock Selection Flow
- `change` on `#plan-species` (wired in `js/stocking.js`) → `dispatchStockingEvent('ttg:species:changed')` updates length validator.
- `click` on `#plan-add` → `addCurrentSelection()` extracts selected species & qty, dispatches `document` event `advisor:addCandidate` with `{ species, qty }`.
- `keydown Enter` on `#plan-qty` → prevents default, blurs input, then calls `addCurrentSelection()`.
- `document` listener for `advisor:addCandidate` → `js/stocking.js` updates `STOCK` map, queues feedback, re-renders `#stock-list`, and emits `ttg:stock:changed` for recompute.
- `document` listener for `advisor:removeCandidate` → removes species from `STOCK`, focuses next/prev entry, dispatches stock change event.
- `window` listener for `ttg:stock:changed` (and `ttg:species:changed`) → triggers recompute cycle and validator checks.

## Environmental Card & Bioload
- `click` on `#env-info-btn` (info trigger) → `prototype/js/info-popovers.js` opens corresponding popover (focus trap, overlay) and toggles `aria-expanded`; closing updates `info-open` class on card to reveal/hide legend.
- MutationObserver on `#env-bars` (`prototype/js/stocking-prototype.js`) → re-upgrades bioload info badges to buttons, resetting tooltip state and hooking to `#bioload-info-panel`.
- Clicking upgraded bioload badge (role=button) → `info-popovers` module opens `#bioload-info-panel`, locking scroll and returning focus on close.

## Hero Modal & Tooltips
- `click` on `#hero-how-works` → inline modal controller prevents default, reveals `#how-modal`, sets focus to close button, and disables body scroll. Escape key, backdrop click, close buttons, or "Close" action call `hide()` to restore focus.
- Tooltip triggers with `data-info` (e.g., Estimated turnover) → `/prototype/js/ui/tooltip.js` attaches pointer/keyboard listeners to show/hide `#turnover-tip` tooltip panel.

## Consent & CMP Integration
- `click` on consent banner buttons (`#ttg-consent-accept`, `#ttg-consent-reject`, `#ttg-consent-manage`) → `/assets/js/consent-banner.js` updates stored preferences, toggles banner/modal visibility, and dispatches `window` event `ttg:consent-change`.
- Inline CMP bridge listens for `window.__tcfapi('addEventListener', ...)` → when Funding Choices reports consent, updates `document.documentElement` attributes (`data-ad-consent`, `classList`) and fires `ttg:consent-change` for ad loader listeners.

## Navigation & Footer
- `js/nav.js` runs once (`window.__TTG_NAV_LOADER__` guard); fetches nav HTML, wires `#ttg-nav-open`/`#drawer-close` to open/close drawer, traps focus inside `#ttg-drawer`, and marks active links via `aria-current`.
- `window` `keydown` listener inside nav module closes drawer on `Escape` when open.
- `/js/footer-loader.js` fetches `/footer.html?v=1.4.9` and injects into `#site-footer` after load.

## Prototype Guards
- `/prototype/assets/js/filtration.js` sets `window.disableLegacyFiltrationCard` and invokes `window.renderFiltration?.()` ensuring new filtration UI renders while legacy components stay hidden.
- `/prototype/assets/js/proto-guards.js` + inline purge script watch DOM mutations to remove legacy `.filtration-*` nodes post-load.

## Analytics Hooks
- `prototype/js/stocking-prototype.js` exposes `fireProtoEvent(eventName)` using `window.saProtoAnalytics.emit` if available, else pushes to `window.dataLayer`. Current prototype markup does not call specific events but function ready for instrumentation.
