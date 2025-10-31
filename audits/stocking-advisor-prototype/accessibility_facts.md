# Accessibility Facts

## Landmark & Roles
- Navigation and footer injected asynchronously; static markup includes `<main id="stocking-page">`, advertisement blocks with `role="complementary"`, and panel containers using `role="dialog"` for popovers/modals.
- No skip-link markup is present in the prototype source.

## Live Regions & Status
- `#stocking-status` is a screen-reader only `role="status"` region (`aria-live="polite" aria-atomic="true"`).
- Tank facts line `div[data-role="tank-spec"]` is given `role="note"` when populated by `tank-size-card.js`.
- Filter summary paragraph carries `aria-live="polite"` to announce turnover updates; `.filter-turnover-value` mirrors numbers with `aria-hidden="true"` when hidden.
- `#stock-list-card` and `#env-card` include `aria-live="polite"` to announce recompute output.

## Dialogs & Popovers
- Info triggers (`.proto-info-trigger`, `.info-btn`) define `aria-haspopup="dialog"`, `aria-controls`, and toggle `aria-expanded`.
- Popover containers (e.g., `#pop-tank-size`, `#pop-env-info`) use `role="dialog"`, `tabindex="-1"`, and close buttons with `data-close`.
- Prototype overlay module (`prototype/js/info-popovers.js`) moves panels to `<body>`, traps focus, and sets `aria-hidden` on overlays.
- Hero "How it works" modal (`#how-modal`) includes `aria-modal="true"`, `aria-labelledby="how-modal-title"`, and focus restoration to the trigger when closed.
- Bioload info panel (`#bioload-info-panel`) operates as `role="dialog" aria-modal="true"` with close button `aria-label="Close"`.

## Forms & Inputs
- Tank size `<select>` has `aria-label="Tank size"` and is paired with a visually hidden `<label>`.
- Filter product select uses `aria-describedby="filter-product-note"`; manual GPH input sets `inputmode="numeric"` and `pattern="[0-9]*"`.
- Quantity field `#plan-qty` uses `inputmode="numeric"`, `pattern="[0-9]*"`, and `enterkeyhint="done"`.

## Tooltips & Info Buttons
- Turnover tooltip trigger defines `data-info="turnover"`, `aria-expanded`, and `aria-controls` linking to `#turnover-tip` (`role="tooltip" hidden`).
- Prototype scripts upgrade info badges to buttons with `tabindex="0"`, `role="button"`, and maintain `aria-expanded` states.

## Consent UI
- Consent banner `#ttg-consent` exposes `role="dialog"` with `aria-labelledby`/`aria-describedby` and buttons labelled for actions.
- Preference modal `#ttg-consent-modal` uses `role="dialog" aria-modal="true" aria-labelledby="ttg-consent-modal-title"` and groups checkboxes inside labelled rows.

## Focus Management
- `js/nav.js` focus-traps the drawer menu and restores focus when closed.
- Inline modal script for "How it works" sets focus to close button (or OK) on open and returns focus to trigger on close; listens for `Escape`.
- Info popover modules listen for `Escape`, pointer events on backdrop, and maintain pointer guard timestamps to avoid accidental closures.

## Alt Text & Labels
- No inline `<img>` elements exist on the prototype page; metadata provides `og:image:alt` and `twitter:image:alt` strings describing the Stocking Advisor screenshot.
- Buttons such as popover close controls use `aria-label="Close"`; info triggers specify descriptive `aria-label` (e.g., "How tank size selections work").

## Observed Gaps
- Skip-link absent; rely on navigation injection for site-level accessibility.
- Prototype icons (e.g., `i` info buttons) rely on accessible names via `aria-label`; ensure scripts preserve names when upgrading badges.
