# Stocking Advisor Prototype — Gemini Integration Report

## Files Updated
- `prototype/stocking-prototype.html`
  - Replaced legacy meta, OG, and Twitter tags with Gemini-optimized values and consolidated JSON-LD graph.
  - Added skip link/main landmark, featured summary, ad placeholders, educational section, accordion FAQ, and supporting scripts/styles.
- `audits/stocking-advisor-prototype/gemini_clean/*`
  - Authored UTF-8 clean Gemini outputs for metadata, copy modules, structured data, accessibility, geo, and advertising guidance.
- `audits/stocking-advisor-prototype/port_to_live/stocking-prototype.html`
  - Port-ready copy of the updated prototype markup.
- `audits/stocking-advisor-prototype/port_to_live/gemini_clean/*`
  - Mirrored cleaned Gemini artifacts for live deployment handoff.

## Head Tag Snapshot
- Title
- Meta description
- Meta robots
- Canonical (https://thetankguide.com/stocking-advisor.html)
- Viewport
- Theme-color
- Manifest
- Icon + Apple touch icon
- Open Graph: type, site_name, title, description, url, image, image:width, image:height, image:alt
- Twitter Card: card, site, creator, title, description, image, image:alt
- Consolidated JSON-LD graph (Organization, WebPage, WebApplication, BreadcrumbList, FAQPage)
- Consent/Funding scripts and navigation/feature scripts retained

## Head Includes (with version tokens)
- CSS: `/css/style.css?v=2024-06-05a`, `/assets/css/utilities.css?v=2025-11-07`, `/css/site.css?v=1.4.9`, `/css/ui.css?v=2024-09-15`, `/prototype/css/stocking-prototype.css`, `/prototype/assets/css/proto-popovers.css?v=proto_rm_2025_10_25`, `/prototype/assets/css/filtration.css?v=proto_rm_2025_10_25`, `/prototype/assets/css/prototype.css?v=proto_rm_2025_10_25`, `/prototype/css/proto-fixes.css`
- JS (head): `/js/nav.js?v=1.1.0`, `/prototype/assets/js/filtration.js?v=proto_rm_2025_10_25`, `/prototype/assets/js/proto-guards.js?v=proto_rm_2025_10_25`

## Section Flow (Hero → Footer)
1. Hero with Featured Summary under the Stocking Advisor H1
2. Pre-tool advertisement placeholder
3. Tool controls/results stack
4. Post-results explainer panel
5. Mid-content advertisement placeholder
6. "Aquarium Bioload & The Nitrogen Cycle" educational panel
7. FAQ accordion (collapsible, anchored at `#faq`)
8. Post-FAQ advertisement placeholder

## Structured Data
- Single JSON-LD graph containing: `Organization`, `WebPage`, `WebApplication`, `BreadcrumbList`, `FAQPage`.
- `WebPage.datePublished`: `2023-06-15T09:00:00-04:00`
- `WebPage.dateModified`: `2025-10-31T16:08:20Z`
- Legacy schema blocks removed; no duplicates remain.

## Accessibility
- Skip link added at top of body targeting `#main-content`.
- Main landmark now uses `<main id="main-content" role="main">` with existing tool wrapper nested inside.
- FAQ uses keyboard-accessible buttons with `aria-expanded`, `aria-controls`, and region labeling; panels stay collapsed by default.

## Assets & Notes
- Referenced OG/Twitter image `https://thetankguide.com/assets/og/stocking-advisor-prototype.png` is not present in the repository; retain tags but asset upload is pending.
- Gemini source files validated for UTF-8 cleanliness and copied to the port-to-live bundle.
