# Gemini Brief — Stocking Advisor Prototype

## Page Purpose & Audience
- Prototype walkthrough for the Stocking Advisor tool, guiding freshwater aquarists through tank sizing, filtration setup, stock planning, and environmental checks. (See `content_snapshot.md`.)

## Environment Notes
- Prototype-only route (`/prototype/stocking-prototype.html`) marked by `prototype-mode` class and guarded by `/prototype/assets/js/proto-guard.js` to prevent live usage. (`architecture_notes.md`)
- Navigation and footer fetched client-side from shared includes; no static header/footer markup in source. (`architecture_notes.md`)
- Prototype scripts strip legacy filtration elements and enforce new UI (`/prototype/assets/js/filtration.js`, `/prototype/assets/js/proto-guards.js`, inline purge). (`components.md`, `behaviors_event_map.md`)

## Metadata & Head
- Title, description, canonical URL, OG/Twitter metadata, article tags, theme color, manifest, and icon links documented in `meta_tags.json`.
- Preload hint fetches `/footer.html?v=1.4.9`; viewport and theme-color set for dark experience. (`meta_tags.json`)

## Structured Data
- JSON-LD graph includes Organization, WebApplication, BreadcrumbList, and FAQPage entities. Full payload in `structured_data.json`.
- No Microdata/RDFa observed. (`structured_data.json`)

## Document Structure
- Single H1 (“Stocking Advisor”), card H2s/H3s for Tank Size, Current Stock, Environmental Recommendations, Plan Your Stock, explainer, FAQ, and cookie dialogs. Ordered list in `headings.json`.
- Landmark roles limited to `<main>` and complementary ad containers; no skip link. (`accessibility_facts.md`)

## Copy Reference
- Full textual transcript (hero copy, popovers, helper notes, FAQ answers, consent messaging) captured in `content_snapshot.md`.
- Buttons, placeholders, warning banners, and modal steps preserved verbatim. (`content_snapshot.md`)

## Components Overview
- Tank Size card, filter product picker, manual GPH controls, turnover summary, current stock list, environmental recommendations, bioload panel, Plan Your Stock form, warnings system, post-results explainer, and consent UI are documented with purpose, inputs, outputs, and events in `components.md`.

## Scripts & Data Flow
- Complete script inventory with sizes, loading strategy, and responsibilities: `scripts_inventory.json`.
- Core logic uses live compute modules with prototype proxy (`prototype/js/logic/compute-proxy.js`) pulling species dataset from `proto/data/species.v2.json`. (`architecture_notes.md`, `components.md`)
- Event mapping (tank change, stock add/remove, info popovers, consent signals) summarized in `behaviors_event_map.md`.

## Styles & Tokens
- CSS stack, color variables, gradients, radii, shadow/glass effects, z-index layers, and dark theme notes detailed in `styles_tokens.md`.

## Links & Media
- All anchors with context and classification in `links.csv` (hero modal link, gear CTA, external gear/cycling/community links).
- Icon and OG image references with expected dimensions captured in `images.csv` (source assets hosted on site CDN). No inline `<img>` elements. (`images.csv`)

## Accessibility Snapshot
- Roles, live regions, dialog behavior, tooltip handling, consent dialog semantics, and noted gaps (skip-link absence) in `accessibility_facts.md`.

## Performance Footprint
- File counts, byte totals, inline script sizes, importmap presence, and preload hints summarized in `performance_footprint.json`. No lazy-loading attributes detected. (`performance_footprint.json`)

## Headers & Security
- Repository `_headers` file only defines content-type/cache rules for `/ads.txt`, `/robots.txt`, and `/sitemap.xml`; no CSP overrides. (`headers_snapshot.md`)

## Outstanding Absences
- No iframes, video embeds, or additional media on the prototype page. (`content_snapshot.md`, inspection)
