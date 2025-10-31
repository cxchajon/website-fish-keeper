# Components

## Tank Size Card
- **Purpose:** Establish the display tank volume and physical dimensions that drive stocking calculations, filter matching, and environmental recommendations.
- **Inputs:**
  - Preset `<select id="tank-size">` populated by `js/tank-size-card.js` from the canonical `TANK_SIZES` list (enforced via MutationObserver guards).
  - Facts line container `div[data-role="tank-spec"]` updated with gallons, liters, imperial/metric dimensions, and filled weight once a preset is chosen.
  - Info button toggling the "Tank size picker" popover for guidance.
- **Outputs:**
  - Persisted selection in `localStorage` under `ttg.selectedTank` via `tankStore.setTank()`.
  - Dispatches `CustomEvent('ttg:tank:changed', { detail: { tank } })` through `js/stocking/tankStore.js`, which re-renders downstream cards and recalculates turnover/bioload in `js/stocking.js`.
  - Syncs gear deep-link parameters (tank gallons) through `js/stocking.js` (`buildGearHref()` + `sessionStorage`).
- **State Dependencies:** Relies on shared `window.appState.tank` snapshot and `tankStore` subscribers to stay in sync with other modules (filter UI, stocking state).
- **Events:**
  - `change` on the `<select>` normalizes presets and triggers `setTank()`.
  - Focus/click handlers toggle the chevron `open` class for animation parity on mobile (wired inside `wireTankSizeChevron`).
  - Tank updates trigger `window` listeners in `js/stocking.js` to refresh species lists, validators, and recomputation.
- **Render Targets:**
  - `<div class="facts-line" data-role="tank-spec">` (tank summary).
  - `window.appState.tank` for logic modules that read gallons/dimensions.

## Filter Product Picker
- **Purpose:** Attach manufacturer-rated filtration products to the scenario so turnover, capacity boosts, and gear hand-off stay accurate.
- **Inputs:**
  - `<select id="filter-product">` (default "— Select a product —"), filled by `prototype/js/proto-filtration.js` using catalog data sourced via `catalog-loader.js` (`fetchFilterCatalog()` + size filtering).
  - `Add Selected` button (disabled until an eligible catalog item is selected).
  - Info popover "Picking a filter" with usage tips.
- **Outputs:**
  - Selected products converted into normalized filter records (`{ id, type, rated_gph }`) stored in local state and `localStorage` (`ttg.stocking.filters.v1`).
  - Chips rendered inside `div[data-role="proto-filter-chips"]` showing active filters with remove controls.
  - Summary string `p[data-role="proto-filter-summary"]` updated with aggregate GPH and turnover.
  - Debug badge `div.filter-catalog-debug` (when dev tools enabled) indicating catalog source and match counts.
- **State Dependencies:**
  - Consumes the current tank gallons (from `window.appState.tank`) to filter catalog results and compute turnover multipliers.
  - Shares filter totals with `window.appState.filters` for the compute engine.
- **Events:**
  - `change` on the product `<select>` triggers catalog lookups, note updates, and enables the add button (`handleProductChange`).
  - `click` on `#filter-product-add` calls `tryAddProduct()` → `setFilters()` and schedules recomputation.
  - Chip container listens for `click` events with `data-remove-filter` to remove entries (`removeFilterById`).
- **Render Targets:**
  - `div[data-role="proto-filter-chips"]` (active filters list).
  - `p.proto-filter-empty` (fallback message toggled hidden once filters exist).
  - `.filter-turnover-value` span (mirrors numeric turnover for non-visual consumption).

## Custom Flow (Manual GPH) Controls
- **Purpose:** Allow hobbyists to specify custom filtration setups (modded filters, multiple units) when catalog coverage is insufficient.
- **Inputs:**
  - `select#fs-type` (options: HOB, Canister, Internal, Sponge, Powerhead).
  - `input#fs-gph` numeric entry for rated flow (placeholder "GPH").
  - `button#fs-add-custom` labeled "Add custom".
- **Outputs:**
  - Manual filters appended to the shared filter state with `source: 'custom'`, chip badge "✳️", and included in turnover math.
  - Validation messaging injected into the helper paragraphs when inputs are incomplete or invalid (`proto-filtration.js` updates `baseManualNote`).
- **State Dependencies:** Accesses and updates the same filter list managed by the product picker so totals stay unified.
- **Events:**
  - `input` and `keydown` (Enter) on `#fs-gph` validate numeric input and fast-add filters.
  - `change` on `#fs-type` toggles add-button availability.
  - `click` on `#fs-add-custom` runs `tryAddCustom()`.
- **Render Targets:**
  - Chips list + summary string shared with the product picker component.
  - Heads-up note remains static but is conceptually tied to this block.

## Estimated Turnover Summary & Tooltip
- **Purpose:** Surface combined filtration flow in gallons per hour and volumes-per-hour, matching turnover best practices.
- **Inputs:**
  - Aggregate filter state computed in `prototype/js/proto-filtration.js` (`computeFilterStats()` -> `computeTurnover`, `getTotalGPH`).
  - Tooltip trigger button with `data-info="turnover"` tied to `/prototype/js/ui/tooltip.js` for hover/focus popover.
- **Outputs:**
  - Text summary (e.g., "Filtration: 0 GPH • 0.0×/h") and readonly numeric field `#turnoverValue` kept in sync with recalculated totals.
  - Accessibility mirror `span.filter-turnover-value` for assistive tech.
- **State Dependencies:** Requires current tank gallons, filter efficiency weighting (TYPE_WEIGHT), and proto filtration math constants.
- **Events:**
  - Recompute triggered via `window.dispatchEvent('ttg:recompute')` updates summary text and the readonly input.
  - Tooltip module attaches pointer/focus listeners to reveal descriptive copy.
- **Render Targets:**
  - `.proto-filter-summary` paragraph and `.proto-turnover` input group inside the Tank Size card.

## Environmental Recommendations Card
- **Purpose:** Present combined parameter ranges, warnings, and bioload/compatibility metrics based on selected species and filtration.
- **Inputs:**
  - Computed state from `js/logic/compute.js` (proxied through `prototype/js/logic/compute-proxy.js`) delivering `computed.environment`, `computed.bioload`, and conflict tokens.
  - Info button toggles "Environmental Card Guide" popover via `prototype/js/info-popovers.js` overlay system.
- **Outputs:**
  - `#env-reco` / `#env-reco-xl` lists render parameter rows with target ranges.
  - `#env-warnings` surfaces severity banners (bad/warn) based on compatibility/conflict evaluations.
  - `#env-bars` hosts dynamic bar meters (bioload %, compatibility chips) managed by `prototype/assets/js/ui-meters.js` and syncs info badges converted by `prototype/js/stocking-prototype.js` (bioload info button hooking to the panel).
  - `#env-more-tips` toggles a legend of extra parameter notes when info mode is open.
- **State Dependencies:**
  - Depends on `window.appState.stock` (species list), filter turnover totals, and computed aggression/conflict tokens (`proto/logic/aggression.v2.js`, `proto/logic/compat.v2.js`).
  - Tracks `info-open` class toggled by popover controller to reveal hidden legend.
- **Events:**
  - `ttg:recompute` listener in `js/stocking.js` calls `renderEnvironmentPanels()`.
  - Info popover overlay listens for pointer/keyboard to open/close the panel with focus trap.
- **Render Targets:**
  - Card header subtitle (compact summary), warnings list, environment tables, bars, and tip legend.

## Bioload Info Panel
- **Purpose:** Provide deeper explanation of the bioload percentage and filtration impact outside the inline tooltip.
- **Inputs:**
  - Triggered by any info badge with `data-info="bioload"`, converted to overlay buttons by `prototype/js/stocking-prototype.js` (`syncBioloadBadges`).
- **Outputs:**
  - Modal dialog `#bioload-info-panel` toggled into view with focus lock and overlay backdrop managed by `prototype/js/info-popovers.js`.
- **State Dependencies:**
  - Checks window tooltip registry (`window.TTGProtoTooltips`) to close legacy tooltips on open.
- **Events:**
  - Buttons set `aria-expanded` and call overlay show/hide functions; closing returns focus to triggering badge.
- **Render Targets:**
  - `.proto-info-panel` markup appended near document end.

## Plan Your Stock Selector
- **Purpose:** Add species and quantities into the working stock list driving compatibility, warnings, and recommendations.
- **Inputs:**
  - Species select `#plan-species` (populated by `js/stocking.js` using dataset from `proto/logic/species.adapter.v2.js`).
  - Quantity input `#plan-qty` (defaults to blank/"Qty").
  - Add button `#plan-add` ("Add to Stock").
  - Candidate banner `#candidate-banner` for gating warnings.
- **Outputs:**
  - Dispatches `document` event `advisor:addCandidate` with `{ species, qty }` consumed by stock renderer.
  - Resets selector back to default option and quantity "1" after add.
  - Updates `sessionStorage` + `window.appState.stock` via downstream handlers.
- **State Dependencies:**
  - Uses `speciesById` map built from the compute proxy dataset.
  - Busy indicator wraps add button to prevent duplicate submissions.
- **Events:**
  - `click` on `#plan-add` triggers `addCurrentSelection()`.
  - `keydown` Enter on `#plan-qty` also adds the candidate.
  - `window` listens for `ttg:species:changed` when species select changes (wired elsewhere) to refresh validators.
- **Render Targets:**
  - `#candidate-chips` (temporary candidate tokens).
  - `#candidate-banner` (error/warning state message).

## Current Stock List & Warnings
- **Purpose:** Display the assembled livestock plan and surface severity-tier warnings before finalizing stock.
- **Inputs:**
  - `document` events `advisor:addCandidate` and `advisor:removeCandidate` manage `STOCK` map inside `js/stocking.js`.
  - Computed warnings from `js/logic/conflicts.js` and proto aggression rules.
- **Outputs:**
  - Renders list items into `#stock-list` with controls for quantity adjustment/removal (handled by `renderStockList`).
  - Populates `#stock-warnings` with status badges (tones `warn` / `bad`) mapped to severity tiers.
  - Announces changes through queued feedback messages.
- **State Dependencies:**
  - Reads `window.appState.stock`, compute engine results, and `SPECIES` dataset.
  - Maintains internal `Map` to deduplicate species entries.
- **Events:**
  - Remove buttons dispatch `advisor:removeCandidate`.
  - Stock mutations call `dispatchStockingEvent(EVENTS.STOCK_CHANGED, ...)` prompting recompute.
- **Render Targets:**
  - `#stock-list`, `#stock-warnings`, live region messaging, and scroll anchors for focus management.

## Environmental Warnings & Banner System
- **Purpose:** Consolidate conflict alerts (parameter mismatches, aggression issues, incompatible pairings) with severity tiers.
- **Inputs:**
  - Output from `evaluateWarningRules()` in `prototype/js/logic/compute-proxy.js` (includes tokens, tones, copy).
  - Filter turnover thresholds to determine if filtration is adequate.
- **Outputs:**
  - Renders pill chips and stacked warnings within both `#stock-warnings` and `#env-warnings` depending on scope.
  - Status strip `#candidate-banner` toggled to "Stocking safeguards" message when add-to-stock gating is active.
- **State Dependencies:** Depends on combined species entries, tank gallons, turnover, and aggression tokens from `proto/logic/aggression.v2.js`.
- **Events:** Triggered every recompute cycle; severity mapping handled by `js/stocking.js` render functions.
- **Render Targets:** Warnings containers plus inline chips attached to species rows in `#stock-list`.

## Post-Results Explainer & External Links
- **Purpose:** Provide educational context and navigation to related resources once a plan is built.
- **Inputs:** Static markup plus anchor tags to Gear Guide, Cycling Coach, and feature submission pages.
- **Outputs:** No dynamic state; anchors open internal/external resources.
- **State Dependencies:** None.
- **Events:** Standard link navigation.
- **Render Targets:** `#post-results-explainer` section content.

## Cookie Consent Banner & Modal
- **Purpose:** Collect consent for analytics/ads and bridge Google CMP signals.
- **Inputs:** Buttons (`Reject`, `Manage`, `Accept All`), checkboxes inside modal, plus Google Funding Choices script injecting CMP messaging.
- **Outputs:**
  - Sets document attribute `data-ad-consent` and toggles `is-ads-disabled` class based on CMP responses (`setAdConsent` in inline script).
  - Persists preferences via `/assets/js/consent-banner.js` (manages storage + event wiring).
- **State Dependencies:**
  - Observes `window.__tcfapi` for EU CMP integration; falls back to local banner otherwise.
  - Dispatches `ttg:consent-change` when consent status changes.
- **Events:**
  - Click handlers on banner buttons show modal or update consent flags.
  - Form submit (`Save Preferences`) writes selections and hides modal.
- **Render Targets:** Banner `#ttg-consent`, modal `#ttg-consent-modal`, and document-level attributes for ad loaders.
