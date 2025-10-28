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
