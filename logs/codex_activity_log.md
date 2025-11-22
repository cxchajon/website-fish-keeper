[2025-10-12 | Stocking Advisor | Real filter products + manual GPH + carryover]
Scope: Dual-input filter block; catalog-driven product list; auto-filled GPH; mild type factor; pass filter_id to Gear.
Result: Real-world filtration choices tied to Gear, with future-proofed highlighting.
Next: Gear page to auto-highlight filter_id product and factor planted/filter into suggestions.
[2025-10-12 | Stocking Advisor | Strict filter catalog eligibility]
Scope: Only show products whose tank_min_g ≤ tank_g ≤ tank_max_g; sort after filtering.
Result: Dropdown now matches our Gear categorization exactly.
[2025-10-12 | SA Products | Restore eligible dropdown (strict, inclusive, numeric)]
Scope: Robust catalog load; strict min≤g≤max; timed repopulation; explicit empty-state; debug console diffs.
Result: Products now appear only when truly eligible; no more blank dropdown.
[2025-10-13 | Stocking Advisor | Rated Flow made system-controlled]
Scope: Reordered controls; removed manual edits; auto-fill from product; neutral when none selected.
Result: Cleaner UX, fewer errors, and consistent cross-page handoff.
[2025-10-13 | Stocking Advisor | Planted control parity with Cycling Coach]
Scope: Replaced pill switch with Coach checkbox; unified styles & behavior.
Result: Consistent UX across tools; cleaner, compact control.
[2025-10-14 | Stocking Advisor | Planted checkbox parity with Cycling Coach]
Scope: Replace pill switch with Coach checkbox, checkmark visible on :checked, focus/spacing identical.
Result: Unified UX and clear selected state.
[2025-10-14 | SA Filtration | Multi-filter totals + weighted type factor]
Scope: Unified filters array; totals drive pill/turnover/bioload; mild weighted factor; robust events.
[2025-10-15 | SA Products | Auto-refresh on tank change]
Scope: Centralized refresh routine; repopulation after tank/catalog changes; strict eligibility; safe fallbacks.
Result: Product list is always current for the selected tank size.
[2025-10-15 | SA Products | Fix auto-refresh on tank change]
Scope: Centralized refresh; strict numeric eligibility; robust async; explicit empty-state.
Result: Product list reliably reflects the newly selected tank size.
[2025-10-16 | Website | Security Enhancement]
Scope: Added right-click and drag protection site-wide.
Result: Verified in browser — no context menu outside input fields.
Next: Consider optional hotlink protection under Cloudflare Scrape Shield.
[2025-10-17 | Media Route | Manual verification override]
Scope: Revalidated /media.html after Envoy 403s; confirmed Cloudflare CSP + WAF bypass for browsers/crawlers.
Result: Live traffic returns 200 with functioning YouTube embeds; curl-based probes intentionally blocked at edge (documented as non-issue).
[2025-10-18 | University | Hybrid parchment→aqua backdrop + watermark]
Scope: New /university/ page scaffold, parchment-to-aqua gradient, procedural grain, responsive pillars SVG, hero overlay, AA checks.
Result: Decorative background stays under perf budgets (<4KB CSS & SVG), hero overlay keeps text ≥4.5:1 contrast, responsive pillars soften on mobile.
[2025-10-17 | The Tank Guide | Aquarium Library Fix]
Scope: Restored book tiles + verified links.
Result: PR created successfully.
Next: Merge once approved.

[2025-10-18 | Journal Prototype | Private test page scaffold]
Scope: Created journal.html with notebook styling, spiral, ruled lines, and sample entries for internal validation.
Result: Journal test page build complete (private, unlinked).
[2025-10-18 | Journal | Legal notepad refactor]
Scope: remove spiral, expand width, legal-pad styling.
Result: page live at /journal.html (unlinked).
Next: fine-tune spacing & line density if needed.
[2025-10-18 | Journal | Red margin reposition]
Scope: moved margin closer to left edge to improve vertical comfort.
Result: widened writing area; preserved layout stability.
[2025-10-19 | Journal | Handwritten typography]
Scope: applied Patrick Hand (400/600), scoped styling, tuned hierarchy and spacing.
Result: handwritten look live on /journal.html.
[2025-10-20 | Journal | Handwritten font fix]
Scope: load + scope Patrick Hand (400/600), CSP allowances, verified across sections.
Result: handwritten rendering live.

[2025-10-18 | Journal | Backfill live v2] Scope: replaced placeholders with real CSV from provided RAW_DATA; newest-first; conditional sections verified.

[2025-10-18 | Journal | Header + Grouping update] Scope: new subtitle, daily grouping, removed Quick Facts label, verified legal-pad visuals.
Result: journal live (unlinked).
[2025-10-20 | Journal | Meta Description (A)] Scope: Added SEO-optimized Discovery meta tag to /journal.html; verified canonical and tag hierarchy.
[2025-10-21 | Memory | Created 29G sync memory docs] Added /docs/memory/{29g_sync_matrix,29g_sync_checklist,29g_runbook}.md to track journal updates.

[2025-10-19 | SA | Info buttons fixed with shared accessible tooltip (Coach parity)]
[2025-10-19 | SA | Info buttons rounded (Coach parity)]
[2025-10-20 | Journal] Added major maintenance entry; regenerated journal.csv/json; verified /journal.html renders newest-first.
[2025-10-21 | SA | Info icons fixed — shared accessible tooltip, Coach parity]

[2025-10-21 | Journal] Added Feeding & Dosing entry; rebuilt CSV/JSON and 2025-10.json; verified monthly render and nav.
[2025-10-22 | Journal] Added Feeding, Test & Dosing entry; rebuilt CSV/JSON and 2025-10.json; verified monthly render and nav.
[2025-10-23 | Journal] Added Feeding, Test & Dosing entry; rebuilt CSV/JSON and 2025-10.json; verified monthly render and nav.
[2025-10-26 | Journal] Added Maintenance & Dosing entry; rebuilt CSV/JSON and 2025-10.json; verified monthly render and nav.

[2025-10-27 | Journal] Added entry; rebuilt CSV/JSON and 2025-10.json; verified Journal render (chips+notes de-dup) and month nav; dashboard refreshed.
[2025-10-28 | TheTankGuide | Journal dashboard charts] Scope: Align x-ticks/grid to data; improve mobile readability. Result: Vertical gridlines at each date; taller mobile charts; clean labels. Next: Consider pinch-zoom toggle if future months add too many dates.
[2025-10-28 | TheTankGuide | Journal Dashboard Rebuild] Scope: Rebuilt journal-dashboard with Chart.js tabs; restored original style; removed duplicate footer. Result: One global footer; charts auto-update from /data/journal.csv; guard passes. Next: Wire weekly auto-regeneration of /data/journal.csv in the journal workflow (if not already).
[2025-10-28 | TheTankGuide | Rebuilt journal dashboard]
Scope: Restore original dashboard, local Chart.js, auto data, footer-safe.
Result: Charts render; footer-lock pass.
Next: Hook date controls to fetch previous month slice when backend is ready.
[2025-10-28 | Journal | Add daily log]
Scope: Add 10/28 entry to JSON/CSV and render on /journal.html.
Result: Data updated; dashboard will pick up on next fetch.
Next: None.
[2025-10-29 | Journal | Add daily log]
Scope: Add 10/29 feeding/test/dosing entry.
Result: Data updated, dashboard auto-synced via cache-buster.
Next: None.
[2025-10-30 | Journal | Add daily log]
Scope: Add 10/30 feeding/test/dosing entry (Post-Treatment Recovery Week start).
Result: Data updated + dashboard synced.
Next: None.
[2025-10-30 | Label Position Update]
Summary: Moved date labels from the x-axis to sit beside each data point on the journal dashboard charts.
Changes: Disabled x-axis ticks, added custom point labels with accent colors tied to each dataset.
Result: Dates render clearly near each reading without overlapping or crowding the chart base.
Next: Fine-tune spacing for denser data sets and validate on smaller mobile breakpoints.
[2025-11-03 | Journal | Add 2025-11-03 entry + photo] Scope: CSV+JSON regenerated; journal page updated with image; dashboard reflects new data. Result: Success; no footer/nav touched. Next: Continue Post-Treatment Recovery Week monitoring.
[2025-11-06 | CI & Footer Fix]
Scope: Pin Node 20 LTS, repair prototype-guard workflow, enforce single global footer include.
Result: Both CI guards pass; journal layout intact; footer hash verified.
Next: Continue connecting CSV auto-updates when stable.
[2025-02-14 | Media-Prototype | Aquarium Library Update]
Scope: Replace generic Library paragraph with brand-aligned 3-sentence version.
Result: Updated text live, verified tone/spacing match site standards.
Next: Continue expanding Library descriptions under each card.
[2025-11-19 | About Page | Schema Upgrade]
Scope: Replaced WebPage JSON-LD with AboutPage + FAQPage structured data.
Result: Improved AEO visibility and Rich Results eligibility.
Next: Validate indexing in Search Console within 48 hours.
[2025-11-22 | The Tank Guide | Footer lock fix]
Scope: Standardized footer across pages and resolved footer lock failures.
Result: All main pages share a single canonical footer implementation. Fixed assistant.html footer-loader.js script order (must appear before placeholder).
Next: Run Gemini + Lighthouse audits on updated pages if needed.
