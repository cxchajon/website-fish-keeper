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
