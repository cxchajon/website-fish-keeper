## 2025-10-23 — v1.2.0 “AdSense Optimization Pass” (Ecosystem Sync)

Status: ✅ Live homepage AdSense-ready; ecosystem synced.

Highlights
- Indexing enabled (`index,follow`) with canonical to https://thetankguide.com/.
- Static, crawlable policy links present: Privacy Policy, Terms, Contact.
- Meta updated: Title, Description, OG + Twitter Card (incl. alt text).
- JSON-LD: Valid Organization. (P1 next: add WebSite + WebPage + FAQPage @graph.)
- Accessibility: headings normalized; removed H2-as-navigation anti-pattern.
- AEO: Task-oriented CTAs (e.g., “Plan My Stocking List”, “Browse the Gear Guide”).
- CWV: Placeholders for async nav/footer to prevent CLS. (P1 risk: heavy hero gradients.)

Verification
- Google Rich Results Test: Organization detected; crawlable; no blocking errors.
- Internal audit wordcount ≈693; family-safe content; layout suitable for ad slots.

Next actions
- P1: Add WebSite/WebPage + FAQPage JSON-LD and visible FAQ section.
- P2: Add `og:image:width=1200` and `og:image:height=630`; ship custom `home-1200x630.png`.
- P2: Lighten hero shadows; add base `background-color` to improve LCP.

Meta
- Build tag: `x-build: live-hero-sync-001`
- Commit ref: ce9e70c7fe7de3f2f475c8a4cf7179be1c74ca37
