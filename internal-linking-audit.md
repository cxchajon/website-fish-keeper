# Internal Linking Audit — The Tank Guide

**Audited:** 30 July 2026 · **Source:** local repo (`cxchajon/website-fish-keeper`, branch `claude/tank-guide-internal-links-dn05tn`) · **Method:** static parse of all 73 `.html` files, ancestor-aware link extraction

---

## Summary

| Metric | Count |
|---|---|
| HTML files found | 73 |
| **Real pages audited** (excl. 6 partials/stubs blocked in `robots.txt`) | **67** |
| **Orphan pages** (0 in-content inbound links) | **8** (6 substantive) |
| **Thin-linked pages** (exactly 1 inbound page) | **26** |
| Broken internal links found | **21** |
| Links pointing at a 301 redirect source | **9** |
| Recommended links below | **134** (across 47 source pages) |

Excluded as infrastructure, not pages: `/nav.html`, `/footer.html`, `/params.html`, `/404.html`, `/store-prototype.html`, `/feature-your-tank-confirmation.html`.

### How links were counted

The nav is injected client-side into `<div id="site-nav">` and the footer into `<div id="site-footer">`, so every page carries the same 10 nav links and 5 footer links. Those, plus breadcrumbs, the `legal-links` strip, and the `ttg-ad-banner-link` house ads (which alone account for ~50 links to `/store.html`), are **boilerplate** and were excluded. Every count below is **in-content editorial links only** — the links that actually move ranking signal between topics.

### The one structural problem behind most of this

**The blog is a pure hub-and-spoke with no spoke-to-spoke links.** `/blogs/` links out to 27 article cards (3 links each: image, title, "Read the blog →"). Almost every article's *entire* inbound profile is those 3 links from that one hub page, and **14 articles have zero in-content outbound internal links at all** — they are dead ends. Those 14 alone hold ~21,000 words, arranged so that no article passes signal to any other article or to a tool.

The 14 dead-end articles: `/cool-down-fish-tank/` (2,580w) · `/beginner-carpeting-plants-low-tech/` (2,253w) · `/undergravel-filters-planted-tank-case-study/` (2,168w) · `/buying-shrimp-online-process-guide/` (2,038w) · `/diy-freshwater-sump-design-29-gallon/` (1,551w) · `/high-tech-vs-low-tech-planted-aquarium/` (1,404w) · `/neocaridina-shrimp-diet-biofilm-guide/` (1,398w) · `/fritz-plant-fest-2026/` (1,357w) · `/aquarium-fertilizers-guide-liquid-root-tabs/` (1,330w) · `/acclimating-shrimp-after-shipping-guide/` (1,276w) · `/reduce-aquarium-nitrates-pothos-guide.html` (1,209w) · `/diy-sump-lessons-learned.html` (1,075w) · `/aquarium-livestock-sourcing-comparison/` (1,007w) · `/aquarium-plants-remove-nitrates/` (725w)

Two related structural issues:

- **The houseplant cluster is a closed island.** `/best-houseplants-for-aquariums/` (3,434w), `/how-houseplants-grow-in-aquarium-water/` (2,074w) and `/growing-houseplants-in-aquarium/` (925w) cross-link each other well — but they are **not on the `/blogs/` hub** and have **zero inbound from anywhere else on the site**. ~6,400 words with no route in.
- **`/pages/university.html` is unreachable.** It holds 1,867 words of real curriculum content, and `/cycling-coach/` and `/media.html` link to it — but `_redirects` 301s `/pages/university.html` → `/university/`, which is an **11-word empty stub** (`<main>` renders nothing). The stub is also not in `sitemap.xml`, while the redirected-away URL *is*. Every link into University currently lands on a blank page.

### Top 5 priority fixes

1. **Fix the `/blogs/` link to the sump lessons article.** The hub card points at `/diy-sump-lessons-learned/` (trailing slash); the real file is `/diy-sump-lessons-learned.html`. That one typo is why a 1,075-word article has **zero** inbound links.
2. **Add the 4 missing articles to the `/blogs/` hub** — `/high-tech-vs-low-tech-planted-aquarium/` (1,404w, a true orphan) and the three houseplant guides. Zero-cost, converts an orphan and de-islands 6,400 words.
3. **Resolve the University redirect/canonical conflict.** `/pages/university.html` 301s to an empty `/university/`, which canonicals *back* to `/pages/university.html`. Pick one URL, put the 1,867 words on it, and point the sitemap and the 6 existing inbound links at it.
4. **Give the 18 dead-end articles their first outbound links.** The highest-value pattern: every article that discusses ammonia/nitrite/cycling gets one contextual link to `/cycling-coach/`, and every article that discusses bioload or "how many fish" gets one to `/stocking-advisor.html`. `/cool-down-fish-tank/` (2,580w) and `/undergravel-filters-planted-tank-case-study/` (2,168w) are the biggest offenders.
5. **Fix the 14 broken journal links + 4 other broken links.** `/journal.html` links to 14 non-existent `/journal/2026-*.html` entries. Also broken: `/about.html` → `/cycling-coach.html`, `/pages/university.html` → `/tools/{cycling-coach,stocking-advisor}.html`, `/podcast/` → `/stocking-advisor/`, `/books/daily-tank-journal-planted/` → `/stocking-advisor/`, `/best-houseplants-for-aquariums/` → `/reduce-aquarium-nitrates-pothos-guide/`.

---

## Phase 1 — Page inventory

### Cornerstone pages & tools

| URL | Title | Type | Words | In-content inbound | Topic |
|---|---|---|---|---|---|
| `/` | Fishkeeping Guides & Tools | Homepage | 788 | 10 | Hub for tools, media, about |
| `/stocking-advisor.html` | Stocking Advisor Calculator | Tool (cornerstone) | 1,335 | 11 | Bioload + compatibility calculator |
| `/cycling-coach/` | Aquarium Cycling Coach & Nitrogen Cycle Tracker | Tool (cornerstone) | 1,093 | 12 | Cycle logging + 24-hour challenge |
| `/gear/` | Fish Keeping Gear Guide | Gear/affiliate (cornerstone) | 1,097 | 12 | Tank-size-driven equipment bundles |
| `/blogs/` | Spotlight Blogs | Hub | 1,163 | 1 | Index of 27 article cards |
| `/pages/university.html` | Aquarium University | Pillar guide | 1,867 | 0 | Water chemistry & fish care curriculum |
| `/media.html` | Fishkeeping Media & Books | Hub | 851 | 6 | Videos, books, journal links |
| `/tools/snail-stock-recommender.html` | Snail Stocking Recommender | Tool | 97 | 2 | Snail population estimator |
| `/assistant.html` | The Tank Guide Assistant | Tool | 1,520 | 0 | AI aquarium helper |
| `/gear-products.html` | Fish Keeping Gear Products | Gear/affiliate | 222 | 1 | Amazon product landing (not in sitemap) |

### Blog / educational articles

| URL | Type | Words | Inbound pages | In-content outbound |
|---|---|---|---|---|
| `/best-houseplants-for-aquariums/` | Article | 3,434 | 2 | 10 |
| `/cool-down-fish-tank/` | Article | 2,580 | 1 | **0** |
| `/beginner-carpeting-plants-low-tech/` | Article | 2,253 | 1 | **0** |
| `/undergravel-filters-planted-tank-case-study/` | Case study | 2,168 | 1 | **0** |
| `/how-houseplants-grow-in-aquarium-water/` | Article | 2,074 | 2 | 7 |
| `/buying-shrimp-online-process-guide/` | Case study | 2,038 | 1 | **0** |
| `/why-goldfish-are-misunderstood/` | Article | 1,825 | 1 | 1 |
| `/diy-freshwater-sump-design-29-gallon/` | Build guide | 1,551 | 1 | **0** |
| `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | Article | 1,544 | 1 | 1 |
| `/blogs/sick-fish-ich-freshwater-disease-guide/` | Article | 1,500 | 1 | 2 |
| `/high-tech-vs-low-tech-planted-aquarium/` | Article | 1,404 | **0** | **0** |
| `/neocaridina-shrimp-diet-biofilm-guide/` | Species care | 1,398 | 2 | **0** |
| `/low-maintenance-fish-aquariums/` | Article | 1,396 | 1 | 3 |
| `/neocaridina-shrimp-care/` | Species profile | 1,381 | 1 | 1 |
| `/blogs/aquarium-filtration-for-beginners.html` | Pillar article | 1,337 | 5 | 12 |
| `/aquarium-fertilizers-guide-liquid-root-tabs/` | Article | 1,330 | 1 | **0** |
| `/planted-aquarium-substrate-guide-aquasoil-dirt/` | Article | 1,326 | 1 | 1 |
| `/acclimating-shrimp-after-shipping-guide/` | Article | 1,276 | 1 | **0** |
| `/reduce-aquarium-nitrates-pothos-guide.html` | Article | 1,209 | 1 | **0** |
| `/blogs/betta-fish-in-a-community-tank.html` | Article | 1,132 | 3 | 7 |
| `/blogs/aquarium-heater-safety-temperature-controllers.html` | Article | 1,086 | 1 | 1 |
| `/diy-sump-lessons-learned.html` | Article | 1,075 | **0** | **0** |
| `/blogs/purigen/` | Article | 1,009 | 4 | 5 |
| `/aquarium-livestock-sourcing-comparison/` | Article | 1,007 | 1 | **0** |
| `/blogs/blackbeard/` | Article | 979 | 1 | 4 |
| `/blog/holiday-gift-guide-aquarium-lovers.html` | Article | 944 | 1 | 1 |
| `/growing-houseplants-in-aquarium/` | Article | 925 | 2 | 4 |
| `/best-beginner-aquarium-plants/` | Article | 866 | 2 | 2 |
| `/blogs/nitrogen-cycle/` | Pillar article | 739 | 8 | 5 |
| `/aquarium-plants-remove-nitrates/` | Article | 725 | 1 | **0** |
| `/fritz-plant-fest-2026/` | Event writeup | 1,357 | 2 | **0** |

### Journal, community, store, books & policy

| URL | Type | Words | Inbound pages |
|---|---|---|---|
| `/journal.html` | Journal hub | 5,165 | 5 |
| `/journal/november-2025.html` | Journal recap | 404 | 2 |
| `/journal/october-2025.html` | Journal recap | 300 | 1 |
| `/journal/2025-11.html` | Journal archive | 61 | 2 |
| `/journal/2025-10.html` | Journal archive | 61 | 2 |
| `/journal-dashboard.html` | Journal tool | 66 | 3 |
| `/tanks/project-tank-000.html` | Community tank profile | 814 | 1 |
| `/community-tanks.html` | Community hub | 175 | 1 |
| `/submit-your-tank.html` | Form | 1,062 | 5 |
| `/pages/community-video-picks.html` | Curated videos | 469 | 2 |
| `/podcast/` | Podcast hub | 722 | **0** |
| `/store.html` | Store | 509 | 5 |
| `/store/` | Store (duplicate) | 489 | **0** |
| `/books/life-in-balance/` | Book | 550 | 1 |
| `/books/coloring-book-vol-1/` | Book | 617 | 3 |
| `/books/coloring-book-vol-2/` | Book | 685 | 2 |
| `/books/daily-tank-journal/` | Book | 675 | 2 |
| `/books/daily-tank-journal-planted/` | Book | 731 | 3 |
| `/about.html` | About | 806 | 3 |
| `/contact-feedback.html` | Contact | 189 | 7 |
| `/privacy-legal.html` | Policy | 1,540 | 2 |
| `/terms.html` | Policy | 572 | 2 |
| `/trust-security.html` | Policy | 227 | **0** |
| `/cookie-settings.html` | Policy | 159 | **0** |
| `/copyright-dmca.html` | Policy | 338 | 1 |
| `/university/` | Empty stub | 11 | 2 |

---

## Phase 2 — Orphan & thin-linked pages

### Orphans (0 in-content inbound links)

| URL | Words | Why it's orphaned |
|---|---|---|
| `/diy-sump-lessons-learned.html` | 1,075 | `/blogs/` card points at `/diy-sump-lessons-learned/` — a URL that doesn't exist |
| `/high-tech-vs-low-tech-planted-aquarium/` | 1,404 | Never added to the `/blogs/` hub |
| `/pages/university.html` | 1,867 | 6 links point here, but the URL 301s to an empty stub |
| `/assistant.html` | 1,520 | Reachable via nav only |
| `/podcast/` | 722 | Reachable via nav only |
| `/store/` | 489 | Duplicate of `/store.html`; nothing links to it |
| `/trust-security.html` | 227 | Footer only (acceptable for a policy page) |
| `/cookie-settings.html` | 159 | Footer only (acceptable for a policy page) |

### Thin-linked (exactly 1 inbound page) — 26 pages

`/acclimating-shrimp-after-shipping-guide/` · `/aquarium-fertilizers-guide-liquid-root-tabs/` · `/aquarium-livestock-sourcing-comparison/` · `/aquarium-plants-remove-nitrates/` · `/beginner-carpeting-plants-low-tech/` · `/blog/holiday-gift-guide-aquarium-lovers.html` · `/blogs/` · `/blogs/aquarium-heater-safety-temperature-controllers.html` · `/blogs/blackbeard/` · `/blogs/sick-fish-ich-freshwater-disease-guide/` · `/books/life-in-balance/` · `/buying-shrimp-online-process-guide/` · `/community-tanks.html` · `/cool-down-fish-tank/` · `/copyright-dmca.html` · `/diy-freshwater-sump-design-29-gallon/` · `/freshwater-aquarium-clean-up-crew-snail-welfare.html` · `/gear-products.html` · `/journal/october-2025.html` · `/low-maintenance-fish-aquariums/` · `/neocaridina-shrimp-care/` · `/planted-aquarium-substrate-guide-aquasoil-dirt/` · `/reduce-aquarium-nitrates-pothos-guide.html` · `/tanks/project-tank-000.html` · `/undergravel-filters-planted-tank-case-study/` · `/why-goldfish-are-misunderstood/`

For 22 of these, the single inbound page is `/blogs/`.

---

## Phase 3 — Anchor text problems

**Generic anchors to replace** (all real, all currently on the site):

| Current anchor | Where | Suggested replacement |
|---|---|---|
| "Read the blog →" (×26) | `/blogs/` cards | Keep one descriptive link per card; the title link already does the work. If the CTA stays, make it "Read the full guide" and rely on the title link for the anchor signal |
| "Read more →" (×2) | `/blogs/sick-fish-ich…`, `/low-maintenance-fish-aquariums/` related-post cards | "How the nitrogen cycle actually works" |
| "Open calculator" | `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | "estimate a starting snail population" |
| "See alternatives" (×many) | `/gear/` | Fine in a product UI — no change needed |
| Empty anchors on card images (×27) | `/blogs/`, related-post cards | Add `alt` text matching the article topic so the image link carries meaning |
| "thetankguide.com/stocking-advisor.html" (bare URL) | `/assistant.html` | "plan your stocking list with the Stocking Advisor" |
| "Protect Fish Welfare" | `/books/daily-tank-journal/` → Stocking Advisor | "check your bioload before you buy" |

**Over-optimization watch:** `/cycling-coach/` currently receives 11 of its 17 inbound links with the exact anchor "Cycling Coach", and `/stocking-advisor.html` receives 10 of 16 as exactly "Stocking Advisor". `/pages/university.html` alone sends 4 links to `/gear/` all anchored "Gear Guide". **Every new link suggested below deliberately uses varied, sentence-level phrasing** rather than the brand name, to dilute rather than deepen that pattern.

---

## Recommended links

Priority key — **High**: fixes an orphan/thin page, or routes a high-traffic page into a cornerstone. **Medium**: topical cross-link between related articles. **Low**: nice-to-have contextual mention.

| Source Page | Target Page | Suggested Anchor Text | Where to Insert | Priority | Reason |
|---|---|---|---|---|---|
| `/blogs/` | `/diy-sump-lessons-learned.html` | DIY Sump Setup: Lessons Learned from a Hardware Failure | Existing card — change `href` from `/diy-sump-lessons-learned/` to `/diy-sump-lessons-learned.html` | **High** | Broken link is the sole reason a 1,075-word article has zero inbound links |
| `/blogs/` | `/high-tech-vs-low-tech-planted-aquarium/` | High Tech vs Low Tech Planted Aquarium: Setup & Lighting | New card in the planted-tank group, next to the substrate and fertilizer cards | **High** | True orphan (1,404w) — never added to the hub |
| `/blogs/` | `/best-houseplants-for-aquariums/` | Best Houseplants for Aquariums: Selection, Setup & Care | New card in the plants group | **High** | 3,434w with zero inbound from outside its own 3-page cluster |
| `/blogs/` | `/how-houseplants-grow-in-aquarium-water/` | How Houseplants Grow With Roots in Aquarium Water | New card in the plants group | **High** | 2,074w island page — no route in from the wider site |
| `/blogs/` | `/growing-houseplants-in-aquarium/` | Growing Houseplants in Your Aquarium: The Complete Guide | New card in the plants group | **High** | 925w island page; it is the cluster's pillar and deserves the hub link |
| `/blogs/` | `/cycling-coach/` | track your ammonia and nitrite day by day | Intro copy above the card grid, where the hub already mentions the nitrogen cycle | **High** | The hub is the most-crawled content page and sends nothing to any tool |
| `/blogs/` | `/stocking-advisor.html` | work out your bioload before you buy | Same intro paragraph, at the existing "bioload" mention | **High** | Routes hub equity into a cornerstone tool |
| `/cool-down-fish-tank/` | `/cycling-coach/` | log those numbers and see where your cycle stands | "Test the water. Ammonia and nitrite should stay at zero." | **High** | 2,580w dead-end article; strongest ammonia/nitrite context on the site |
| `/cool-down-fish-tank/` | `/gear/` | the air pumps and controllers we actually recommend | "A battery-operated aquarium air pump is one of the simplest ways to provide emergency aeration during a power outage" | **High** | 32 gear mentions, zero gear links — direct commercial intent |
| `/cool-down-fish-tank/` | `/blogs/aquarium-heater-safety-temperature-controllers.html` | why a temperature controller is worth having | "another good reason a temperature controller with alerts is worth having" | **High** | Near-perfect topical match; the sentence already argues for the target |
| `/cool-down-fish-tank/` | `/blogs/aquarium-filtration-for-beginners.html` | how filter flow and surface agitation work together | "You can also use the filtration equipment already running on your tank." | Medium | Genuine overlap on flow and surface disturbance |
| `/undergravel-filters-planted-tank-case-study/` | `/blogs/aquarium-filtration-for-beginners.html` | what a filter is really doing | "All meaningful filtration and nutrient interaction occurred above the plate" | **High** | 2,168w dead end with 41 filtration mentions and no internal links |
| `/undergravel-filters-planted-tank-case-study/` | `/planted-aquarium-substrate-guide-aquasoil-dirt/` | picking a substrate for a planted tank | "Substrate Layering (Bottom → Top)" section intro | **High** | Same author, same build, obvious reader next step |
| `/undergravel-filters-planted-tank-case-study/` | `/diy-freshwater-sump-design-29-gallon/` | how this sump was built | "Sump mechanical filtration → Water enters bottom of filter chamber" | **High** | The sump referenced here has its own full build guide |
| `/undergravel-filters-planted-tank-case-study/` | `/gear/` | gear that fits a 29-gallon build | Near the end, before "Which Path Will You Take?"-style closing | Medium | 44 gear mentions, no gear link |
| `/high-tech-vs-low-tech-planted-aquarium/` | `/gear/` | see what a planted setup actually needs | "The difference comes down to how much equipment, maintenance, and control you want" | **High** | 51 equipment/lighting mentions in an orphan article; highest gear intent on the site |
| `/high-tech-vs-low-tech-planted-aquarium/` | `/aquarium-fertilizers-guide-liquid-root-tabs/` | liquid ferts, root tabs, and EI dosing | "Introducing fertilizers" in the low-to-high upgrade path list | **High** | Direct topical continuation |
| `/high-tech-vs-low-tech-planted-aquarium/` | `/planted-aquarium-substrate-guide-aquasoil-dirt/` | why aquasoil behaves differently from sand | "Upgrading substrate to aquasoil" in the same list | **High** | Direct topical continuation |
| `/high-tech-vs-low-tech-planted-aquarium/` | `/blogs/blackbeard/` | what finally cleared our black beard algae | "If lighting, CO₂, and nutrients fall out of balance, algae may develop faster" | Medium | The article raises algae risk and never says what to do about it |
| `/high-tech-vs-low-tech-planted-aquarium/` | `/beginner-carpeting-plants-low-tech/` | carpeting plants that work without CO₂ | "Common low-light plants include:" | Medium | Serves the low-tech reader this article is written for |
| `/diy-sump-lessons-learned.html` | `/diy-freshwater-sump-design-29-gallon/` | the original sump build | "When I designed this setup, I built in safeguards." | **High** | Orphan article; this is its parent build guide and the natural entry point |
| `/diy-sump-lessons-learned.html` | `/undergravel-filters-planted-tank-case-study/` | how the substrate and undergravel side works | "the real value is not just in the finished tank, but in everything you learn" | Medium | Same 29-gallon system, different subsystem |
| `/diy-sump-lessons-learned.html` | `/journal.html` | follow this build in the journal | "visit the journal section of the media page" — currently unlinked plain text | **High** | Existing textual reference with no link on it |
| `/diy-sump-lessons-learned.html` | `/books/daily-tank-journal/` | the Daily Tank Journals | "check out the Daily Tank Journals, available in Planted and Standard editions" — currently unlinked plain text | Medium | Existing unlinked product mention |
| `/blogs/aquarium-filtration-for-beginners.html` | `/cycling-coach/` | Cycling Coach | Existing link — change `href` from `/params.html` to `/cycling-coach/` (2 instances) | **High** | Removes a 301 hop on the site's best-linked pillar article |
| `/blogs/nitrogen-cycle/` | `/cycling-coach/` | Cycling Coach Tool | Existing link — change `href` from `/params.html` to `/cycling-coach/` | **High** | Removes a 301 hop from the highest-authority topical match |
| `/blogs/nitrogen-cycle/` | `/cycling-coach/` | run the 24-hour challenge before you add fish | "Feed the biofilter with a tiny ammonia source (pure ammonia or fish food) and test daily." | **High** | 29 cycle mentions; the tool does exactly what this paragraph describes |
| `/blogs/nitrogen-cycle/` | `/stocking-advisor.html` | plan what goes in once it's cycled | "That first wall becomes a speed bump." closing paragraph | **High** | Natural next step; sends pillar equity to a cornerstone |
| `/about.html` | `/cycling-coach/` | Use Cycling Coach | Existing link — change `href` from `/cycling-coach.html` to `/cycling-coach/` | **High** | Broken link (no such file, no redirect rule covers it) |
| `/about.html` | `/blogs/nitrogen-cycle/` | the nitrogen cycle, the way we learned it | Existing "nitrogen cycle" mention in the mission copy | Medium | Feeds the pillar article from a well-linked page |
| `/pages/university.html` | `/cycling-coach/` | Cycling Coach | Existing link — change `href` from `/tools/cycling-coach.html` to `/cycling-coach/` (5 instances) | **High** | Broken link ×5 on the pillar guide |
| `/pages/university.html` | `/stocking-advisor.html` | Stocking Advisor | Existing link — change `href` from `/tools/stocking-advisor.html` to `/stocking-advisor.html` (3 instances) | **High** | Broken link ×3 on the pillar guide |
| `/pages/university.html` | `/blogs/nitrogen-cycle/` | how ammonia turns into nitrate | "especially how ammonia appears, how quickly it converts, and how buffering stabilizes pH" | **High** | 1,867w pillar page currently sends nothing to any article |
| `/pages/university.html` | `/blogs/aquarium-filtration-for-beginners.html` | where the nitrogen cycle actually lives | "Set up your equipment, keep observation logs, and follow stocking steps" | **High** | Pillar-to-pillar link; 30 filtration mentions, no link |
| `/pages/university.html` | `/low-maintenance-fish-aquariums/` | why bioload matters more than "hardy" | The stocking study-area intro that mentions bioload | Medium | Varies the anchor pattern away from 4× "Gear Guide" |
| `/podcast/` | `/stocking-advisor.html` | the Stocking Advisor | Existing link — change `href` from `/stocking-advisor/` to `/stocking-advisor.html` | **High** | Broken link on an orphan page |
| `/podcast/` | `/blogs/nitrogen-cycle/` | our own walk through the nitrogen cycle | "From ammonia spikes to nitrite crashes, we explain what's actually happening in your filter media" | **High** | Orphan page with strong topical hooks and only 2 outbound links |
| `/podcast/` | `/gear/` | the gear we keep coming back to | "gear reviews" in the show description | **High** | Routes an orphan page into a cornerstone |
| `/podcast/` | `/blogs/aquarium-filtration-for-beginners.html` | what your filter media is doing | Same "filter media" sentence in the nitrogen-cycle bullet | Medium | Topical match |
| `/journal.html` | `/cycling-coach/` | log readings the way we do | "Stability was dosed to support beneficial bacteria and maintain biological balance." | **High** | 5,165w page, 21 cycling mentions, no link to the cycling tool |
| `/journal.html` | `/stocking-advisor.html` | how we think about bioload | "Bioload reduced compared to previous months" | **High** | 5 bioload mentions on the site's longest page |
| `/journal.html` | `/gear/` | the equipment running this tank | First equipment list or setup summary | **High** | 47 gear mentions, no gear link |
| `/journal.html` | `/blogs/aquarium-filtration-for-beginners.html` | how we choose and clean media | "Dosed Prime during refill and added Stability to support beneficial bacteria after introducing new filter media." | Medium | 58 filtration mentions |
| `/journal.html` | *(14 targets)* | — | 14 links to `/journal/2026-*.html` entries that do not exist — **broken, do not fix as part of linking work** | **High** | Flagged only; the entry pages need to be created or the links removed |
| `/assistant.html` | `/gear/` | gear matched to your tank size | Where the assistant's capabilities mention filters, heaters and test kits | **High** | Orphan page, 14 gear mentions, no gear link |
| `/assistant.html` | `/blogs/nitrogen-cycle/` | the nitrogen cycle in plain language | Existing "ammonia spike" / "nitrogen cycle" mention | **High** | Orphan page needs outbound topical signal |
| `/assistant.html` | `/stocking-advisor.html` | plan your stocking list with the Stocking Advisor | Replace the bare-URL anchor "thetankguide.com/stocking-advisor.html" | Medium | Fixes a bare-URL anchor |
| `/blogs/sick-fish-ich-freshwater-disease-guide/` | `/cycling-coach/` | check where your cycle actually is | "To keep a low-maintenance tank, you must respect the nitrogen cycle." | **High** | 20 cycle mentions; disease and cycle failure are causally linked |
| `/blogs/sick-fish-ich-freshwater-disease-guide/` | `/stocking-advisor.html` | keep bioload inside what your filter can handle | "Managing bioload ensures this cycle is never overwhelmed." | **High** | Sentence already makes the argument for the tool |
| `/blogs/sick-fish-ich-freshwater-disease-guide/` | `/blogs/aquarium-filtration-for-beginners.html` | how medication affects your filter bacteria | "impacting the beneficial bacteria in your main display" | Medium | Real overlap on medication vs. biofilter |
| `/why-goldfish-are-misunderstood/` | `/stocking-advisor.html` | what your tank can actually support | "The 10-Gallon Aquarium and the 'One Inch Per Gallon' Myth" | **High** | The tool exists specifically to replace this rule; ideal match |
| `/why-goldfish-are-misunderstood/` | `/cycling-coach/` | get the cycle done before fish go in | "most experienced hobbyists recommend fishless cycling methods to avoid exposing fish to toxic ammonia and nitrite spikes" | **High** | Strong fishless-cycling context |
| `/why-goldfish-are-misunderstood/` | `/low-maintenance-fish-aquariums/` | bioload, not toughness | "that still wasn't ideal long term for a high-bioload species" | Medium | The two articles make the same core argument |
| `/why-goldfish-are-misunderstood/` | `/blogs/aquarium-filtration-for-beginners.html` | what real filtration looks like | "They need real filtration, real water volume, and stable water conditions." | Medium | 11 filtration mentions, one outbound link total |
| `/low-maintenance-fish-aquariums/` | `/cycling-coach/` | watch ammonia and nitrite while it settles | "aquariums rely on beneficial bacteria to process it" | **High** | 20 cycling mentions and no link to the cycling tool |
| `/low-maintenance-fish-aquariums/` | `/blogs/aquarium-filtration-for-beginners.html` | giving those bacteria somewhere to live | "the biological filter has time to adjust" | Medium | Direct conceptual handoff |
| `/neocaridina-shrimp-care/` | `/cycling-coach/` | confirm the tank is truly cycled | "Uncycled tank – Ammonia and nitrite spikes are deadly to invertebrates." | **High** | Highest-stakes cycling context on the site; thin-linked species profile |
| `/neocaridina-shrimp-care/` | `/gear/` | heaters and controllers that don't fail quietly | "Temperature fluctuations – Heater malfunctions or seasonal swings stress colonies." | **High** | Clear gear need stated in the text |
| `/neocaridina-shrimp-care/` | `/neocaridina-shrimp-diet-biofilm-guide/` | what shrimp actually eat | "Use a mature, fully cycled aquarium with visible biofilm." | Medium | Sibling guide; currently linked only one way |
| `/neocaridina-shrimp-care/` | `/acclimating-shrimp-after-shipping-guide/` | getting new shrimp settled in | Near the "colony crashes are environmental" paragraph | Medium | Completes the shrimp cluster |
| `/neocaridina-shrimp-diet-biofilm-guide/` | `/cycling-coach/` | keep ammonia at zero while you dial in feeding | "If uneaten after 4–6 hours, remove them to prevent ammonia spikes" | **High** | Dead-end article with a direct ammonia hook |
| `/neocaridina-shrimp-diet-biofilm-guide/` | `/neocaridina-shrimp-care/` | full Neocaridina care guide | Opening paragraph | **High** | Dead-end article; sibling page is the obvious next read |
| `/acclimating-shrimp-after-shipping-guide/` | `/cycling-coach/` | make sure ammonia and nitrite read zero first | "Time set aside for acclimation" readiness checklist | **High** | Dead-end article with 8 ammonia/cycle mentions |
| `/acclimating-shrimp-after-shipping-guide/` | `/neocaridina-shrimp-care/` | ongoing Neocaridina care | Closing section on the first day after delivery | **High** | Dead-end article; natural next step for the reader |
| `/buying-shrimp-online-process-guide/` | `/acclimating-shrimp-after-shipping-guide/` | what to do once the box arrives | "The next phase covers delivery day realities, acclimation as a critical step" — an explicit forward reference with no link | **High** | 2,038w dead end that literally promises the next article |
| `/buying-shrimp-online-process-guide/` | `/cycling-coach/` | confirm your parameters are stable | "confirm: (1) Your tank parameters are stable and suitable for the species" | **High** | Dead-end article; readiness checklist is exactly the tool's job |
| `/buying-shrimp-online-process-guide/` | `/aquarium-livestock-sourcing-comparison/` | online versus your local store | "Responsible online livestock buying begins before checkout." | Medium | Sibling comparison article |
| `/aquarium-livestock-sourcing-comparison/` | `/buying-shrimp-online-process-guide/` | how one online order actually went | "Rushed or improper acclimation" | **High** | Dead-end article; the case study is its proof |
| `/aquarium-livestock-sourcing-comparison/` | `/blogs/sick-fish-ich-freshwater-disease-guide/` | setting up a quarantine tank | "Quarantine, hospital, or backup systems" | Medium | Real overlap on quarantine practice |
| `/aquarium-plants-remove-nitrates/` | `/cycling-coach/` | where nitrate comes from in the first place | "nitrates (NO₃⁻) gradually accumulate as the final byproduct of the nitrogen cycle" | **High** | Dead-end article with a clean cycle hook |
| `/aquarium-plants-remove-nitrates/` | `/reduce-aquarium-nitrates-pothos-guide.html` | the pothos method, step by step | "specific plants can significantly lower nitrate concentrations" | **High** | Dead-end article; the practical companion guide |
| `/aquarium-plants-remove-nitrates/` | `/best-beginner-aquarium-plants/` | fast-growing plants that are easy to start | "most effective in fast-growing species that have a high demand for nutrients" | Medium | Direct topical continuation |
| `/reduce-aquarium-nitrates-pothos-guide.html` | `/aquarium-plants-remove-nitrates/` | the science behind plant nitrate uptake | Opening section | **High** | Dead-end article; completes a two-way pair |
| `/reduce-aquarium-nitrates-pothos-guide.html` | `/stocking-advisor.html` | keeping bioload in proportion | Existing "bioload" mention | Medium | Routes a dead end into a cornerstone |
| `/best-houseplants-for-aquariums/` | `/reduce-aquarium-nitrates-pothos-guide.html` | full pothos nitrate guide | Existing link — change `href` from `/reduce-aquarium-nitrates-pothos-guide/` to `/reduce-aquarium-nitrates-pothos-guide.html` | **High** | Broken link |
| `/best-houseplants-for-aquariums/` | `/gear/` | lights that suit low-tech setups | Lighting section | **High** | 47 lighting/equipment mentions on the site's longest article, no gear link |
| `/best-houseplants-for-aquariums/` | `/cycling-coach/` | make sure the tank is cycled first | Existing "cycled" mention in the setup section | Medium | Links the island cluster to a cornerstone |
| `/how-houseplants-grow-in-aquarium-water/` | `/gear/` | test kits and lights we use | Existing "test kit" mention | Medium | 9 gear mentions, no gear link |
| `/how-houseplants-grow-in-aquarium-water/` | `/aquarium-plants-remove-nitrates/` | how submerged plants take up nitrate | Nutrient-uptake section | Medium | Connects the island cluster to the main plant corpus |
| `/growing-houseplants-in-aquarium/` | `/cycling-coach/` | keep ammonia and nitrite at zero while roots establish | The paragraph mentioning beneficial bacteria and ammonia | **High** | Island cluster page with 8 cycle mentions |
| `/growing-houseplants-in-aquarium/` | `/reduce-aquarium-nitrates-pothos-guide.html` | our pothos nitrate results | Intro, where the guide frames the benefit | Medium | Connects the cluster to the main corpus |
| `/planted-aquarium-substrate-guide-aquasoil-dirt/` | `/cycling-coach/` | how substrate bacteria fit the cycle | "Provides surface area for beneficial bacteria" | **High** | 5 cycle mentions, thin-linked page |
| `/planted-aquarium-substrate-guide-aquasoil-dirt/` | `/gear/` | substrate and setup gear by tank size | "there are many ways to build a planted tank" | **High** | 31 substrate/gear mentions, no gear link |
| `/planted-aquarium-substrate-guide-aquasoil-dirt/` | `/aquarium-fertilizers-guide-liquid-root-tabs/` | root tabs for inert substrates | "In aquariums with inert substrates like sand or gravel" | **High** | The fertilizer guide covers exactly this |
| `/planted-aquarium-substrate-guide-aquasoil-dirt/` | `/high-tech-vs-low-tech-planted-aquarium/` | low-tech versus high-tech setups | Aquasoil section, where CO₂ and lighting come up | Medium | Helps de-orphan the high-tech article |
| `/aquarium-fertilizers-guide-liquid-root-tabs/` | `/planted-aquarium-substrate-guide-aquasoil-dirt/` | choosing a substrate | "root tabs help replace the nutrients that natural soils would normally provide" | **High** | Dead-end article; reciprocates the pair above |
| `/aquarium-fertilizers-guide-liquid-root-tabs/` | `/gear/` | lighting and dosing gear | "EI dosing is most commonly used in high-tech aquariums with strong lighting and CO₂ injection" | **High** | 20 lighting/substrate mentions, no gear link |
| `/aquarium-fertilizers-guide-liquid-root-tabs/` | `/high-tech-vs-low-tech-planted-aquarium/` | high-tech versus low-tech | Same EI dosing sentence | **High** | Helps de-orphan the high-tech article |
| `/aquarium-fertilizers-guide-liquid-root-tabs/` | `/best-beginner-aquarium-plants/` | plants that grow without much fuss | "Plants like Anubias, Java Fern, Bucephalandra, and mosses" | Medium | Species overlap |
| `/beginner-carpeting-plants-low-tech/` | `/gear/` | what a low-tech setup actually costs | "without requiring expensive equipment" | **High** | 2,253w dead end with 30 gear mentions |
| `/beginner-carpeting-plants-low-tech/` | `/planted-aquarium-substrate-guide-aquasoil-dirt/` | substrate for root feeders | "most freshwater carpeting plants on this list feed heavily from the substrate" | **High** | Dead-end article; direct topical need |
| `/beginner-carpeting-plants-low-tech/` | `/high-tech-vs-low-tech-planted-aquarium/` | what high-tech actually adds | "Many use high lighting, injected CO₂, nutrient-rich fertilization schedules" | **High** | De-orphans the high-tech article from its closest match |
| `/beginner-carpeting-plants-low-tech/` | `/best-beginner-aquarium-plants/` | easy starter plants | "Not every carpeting plant is a good choice for beginners." | Medium | Sibling beginner-plant guide |
| `/diy-freshwater-sump-design-29-gallon/` | `/diy-sump-lessons-learned.html` | what went wrong two years in | "You don't have to reinvent equipment — sometimes you just need to understand it better." | **High** | De-orphans the lessons article; honest follow-up |
| `/diy-freshwater-sump-design-29-gallon/` | `/blogs/aquarium-filtration-for-beginners.html` | filter basics before you start hacking | "Like most people, I ran manufacturer cartridges at first." | **High** | 34 filtration mentions on a dead-end page |
| `/diy-freshwater-sump-design-29-gallon/` | `/gear/` | media and pumps by tank size | "I could decide what media went inside" | Medium | 13 gear mentions, no gear link |
| `/diy-freshwater-sump-design-29-gallon/` | `/tanks/project-tank-000.html` | see the finished system | Closing section | Medium | The community tank profile documents this exact build |
| `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | `/tools/snail-stock-recommender.html` | estimate a starting snail population | Replace the generic "Open calculator" anchor | **High** | Generic anchor on the tool's main inbound link |
| `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | `/cycling-coach/` | how that waste becomes nitrate | "helps convert uneaten food and decaying plant matter into forms that beneficial bacteria can process" | **High** | Thin-linked page with a clean cycle hook |
| `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | `/stocking-advisor.html` | plan densities that don't compete | "choose stocking densities that avoid resource pressure" | **High** | Sentence already argues for the tool |
| `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | `/neocaridina-shrimp-diet-biofilm-guide/` | how shrimp feeding differs | "snails and shrimp compete for the same food" | Medium | Real topical overlap |
| `/blogs/blackbeard/` | `/cycling-coach/` | check where your cycle stands | The Seachem Stability / beneficial bacteria mention | Medium | Thin-linked page, 3 cycle mentions |
| `/blogs/blackbeard/` | `/gear/` | timers and lights that fixed this | "Inconsistent lighting (no timer back then) and the wrong spectrum" | **High** | Explicit gear cause named in the text |
| `/blogs/blackbeard/` | `/high-tech-vs-low-tech-planted-aquarium/` | getting light, CO₂ and nutrients in balance | Lighting-and-flow fixes section | Medium | De-orphans the high-tech article |
| `/blogs/purigen/` | `/cycling-coach/` | where Purigen sits in the cycle | Existing nitrogen-cycle mention | Medium | Fills the one cornerstone gap on this page |
| `/blogs/betta-fish-in-a-community-tank.html` | `/cycling-coach/` | cycle it fully before the betta goes in | Existing ammonia / nitrogen-cycle mention | **High** | Well-linked page missing only the cycling cornerstone |
| `/blogs/aquarium-heater-safety-temperature-controllers.html` | `/cool-down-fish-tank/` | when the problem is heat, not the heater | Section on heaters sticking on | **High** | Thin-linked page ↔ thin-linked page, strong overlap |
| `/blogs/aquarium-heater-safety-temperature-controllers.html` | `/neocaridina-shrimp-care/` | why shrimp colonies feel swings first | Discussion of temperature stress | Low | Species-specific supporting example |
| `/blog/holiday-gift-guide-aquarium-lovers.html` | `/gear/` | gear that's genuinely worth giving | "test kit" / "equipment" gift suggestions | **High** | Thin-linked page with 4 gear mentions and direct purchase intent |
| `/blog/holiday-gift-guide-aquarium-lovers.html` | `/stocking-advisor.html` | why you shouldn't gift fish | Existing bioload/stocking caution | **High** | Reinforces the article's core "what to avoid" argument |
| `/blog/holiday-gift-guide-aquarium-lovers.html` | `/books/daily-tank-journal/` | the Daily Tank Journal | Gift ideas list | Medium | Owned product, direct fit |
| `/books/daily-tank-journal-planted/` | `/stocking-advisor.html` | Stocking Advisor | Existing link — change `href` from `https://thetankguide.com/stocking-advisor/` to `/stocking-advisor.html` | **High** | Broken link |
| `/books/life-in-balance/` | `/blogs/nitrogen-cycle/` | the nitrogen cycle, explained simply | Existing nitrogen-cycle / beneficial-bacteria copy | Medium | Thin-linked book page with 8 cycle mentions and no outbound links |
| `/books/life-in-balance/` | `/cycling-coach/` | track your own cycle | Same section | Medium | Routes a book page into a cornerstone |
| `/tanks/project-tank-000.html` | `/diy-freshwater-sump-design-29-gallon/` | the full sump build | The DIY sump description | **High** | Thin-linked page; the build guide is its natural detail page |
| `/tanks/project-tank-000.html` | `/stocking-advisor.html` | how this stock list was planned | Existing schooling/stocking mention | **High** | Routes a community page into a cornerstone |
| `/tanks/project-tank-000.html` | `/gear/` | equipment on this tank | Equipment list | Medium | 11 gear mentions, no gear link |
| `/fritz-plant-fest-2026/` | `/gear/` | gear worth picking up | Existing equipment/gear discussion | Medium | Dead-end event page with 13 gear mentions |
| `/fritz-plant-fest-2026/` | `/best-beginner-aquarium-plants/` | easy plants to start with | Plant discussion | Medium | Dead-end page; obvious reader next step |
| `/journal/november-2025.html` | `/blogs/aquarium-filtration-for-beginners.html` | how we handle media changes | Sponge/filter/media mentions | Low | Short recap page with 8 filtration mentions and no outbound links |
| `/pages/community-video-picks.html` | `/stocking-advisor.html` | check bioload yourself | Existing bioload mention | Medium | Thin-linked page, one outbound link |
| `/pages/community-video-picks.html` | `/blogs/nitrogen-cycle/` | our nitrogen cycle write-up | Existing nitrogen-cycle mention | Medium | Topical match |
| `/community-tanks.html` | `/submit-your-tank.html` | share your own tank | Body copy (175w page) | Medium | Thin page, thin content — the CTA belongs here |
| `/media.html` | `/cycling-coach/` | track your cycle as you watch | Existing cycling / nitrogen-cycle mention | **High** | Well-linked hub sending nothing to the cycling cornerstone |
| `/media.html` | `/pages/university.html` | Aquarium University lessons | Existing 3 links — repoint once the University URL conflict is resolved | **High** | Currently lands on an empty stub |
| `/cycling-coach/` | `/blogs/nitrogen-cycle/` | how the cycle actually felt to learn | Existing nitrogen-cycle explanation copy | **High** | Cornerstone tool sends nothing to its own pillar article |
| `/cycling-coach/` | `/stocking-advisor.html` | plan your stock once it's cycled | "Perform a final large water change and stabilize temperature before adding fish." | **High** | Natural tool-to-tool handoff at the exact decision point |
| `/cycling-coach/` | `/pages/university.html` | water chemistry foundations | Existing 3 links — repoint once the University URL conflict is resolved | **High** | Currently lands on an empty stub |
| `/stocking-advisor.html` | `/blogs/nitrogen-cycle/` | what "cycled" actually means | "Verify your nitrogen cycle is complete—showing zero ammonia and zero nitrite—before adding any fish." | **High** | Cornerstone tool with 5 cycle mentions, no link to the pillar |
| `/stocking-advisor.html` | `/blogs/aquarium-filtration-for-beginners.html` | picking a filter that keeps up | "Select a model rated for your tank volume, or one size larger" | **High** | 24 filter mentions inside the filter picker UI |
| `/gear/` | `/blogs/aquarium-filtration-for-beginners.html` | how to choose between these | Filter Media & Boosters section | **High** | 61 filter mentions on the gear cornerstone, no link to the filtration pillar |
| `/gear/` | `/blogs/aquarium-heater-safety-temperature-controllers.html` | why we recommend a controller | Temp Controller / "Heater safety" block | **High** | Existing product rationale with a matching article |
| `/` | `/blogs/nitrogen-cycle/` | the nitrogen cycle | "At the heart of every stable aquarium is one crucial process: the nitrogen cycle." | **High** | Homepage sends nothing to any article; strongest possible pillar boost |
| `/` | `/blogs/` | read the guides | Below the tool cards | **High** | The blog hub has just 1 inbound page and it isn't the homepage |
| `/` | `/blogs/aquarium-filtration-for-beginners.html` | filtration, explained properly | "filtration capacity" in the Stocking Advisor paragraph | Medium | Feeds the second pillar from the homepage |

---

## Broken internal links (flagged, not fixed)

| Source | Anchor | Bad target | Note |
|---|---|---|---|
| `/journal.html` | 14 journal entry titles | `/journal/2026-01-18-…` through `/journal/2026-06-…` | 14 entries linked; only `2025-10`, `2025-11`, `october-2025`, `november-2025` exist |
| `/about.html` | "Use Cycling Coach" | `/cycling-coach.html` | No such file; no `_redirects` rule covers it |
| `/pages/university.html` | "Cycling Coach" ×5 | `/tools/cycling-coach.html` | Correct path is `/cycling-coach/` |
| `/pages/university.html` | "Stocking Advisor" ×3 | `/tools/stocking-advisor.html` | Correct path is `/stocking-advisor.html` |
| `/blogs/` | (card image + title) | `/diy-sump-lessons-learned/` | Correct path is `/diy-sump-lessons-learned.html` |
| `/podcast/` | "Stocking Advisor" | `/stocking-advisor/` | Correct path is `/stocking-advisor.html` |
| `/books/daily-tank-journal-planted/` | "Stocking Advisor" | `https://thetankguide.com/stocking-advisor/` | Correct path is `/stocking-advisor.html` |
| `/best-houseplants-for-aquariums/` | "full pothos nitrate guide" | `/reduce-aquarium-nitrates-pothos-guide/` | Correct path is `/reduce-aquarium-nitrates-pothos-guide.html` |

**Not broken, but inconsistent:** `/best-beginner-aquarium-plants/` links "Snail-free" to `https://thetankguide.com/freshwater-aquarium-clean-up-crew-snail-welfare` — extensionless. Cloudflare Pages will almost certainly serve the `.html` file for that path, so it resolves; it is just inconsistent with the canonical `.html` URL used everywhere else, and it's an absolute URL where the rest of the site uses relative paths. Worth normalising, but it is not costing you a 404. (Confirm against the live site before treating it as either.)

### Links that resolve through a 301 (worth pointing directly)

| Source | Anchor | Target | Redirects to |
|---|---|---|---|
| `/blogs/aquarium-filtration-for-beginners.html` | "Cycling Coach" ×2 | `/params.html` | `/cycling-coach/` |
| `/blogs/nitrogen-cycle/` | "Cycling Coach Tool" | `/params.html` | `/cycling-coach/` |
| `/cycling-coach/` | University ×3 | `/pages/university.html` | `/university/` (empty stub) |
| `/media.html` | University ×3 | `/pages/university.html` | `/university/` (empty stub) |

### Other issues noticed

- **`sitemap.xml` lists `/pages/university.html`**, which `_redirects` 301s away. A sitemap should not list redirect sources.
- **`/store/` and `/store.html`** are near-duplicate pages (489 vs. 509 words). `/store/` has zero inbound links; the nav and footer both point at `/store.html`.
- **`/gear-products.html`** is not in `sitemap.xml` but is linked from `/gear/` as the "Amazon" destination for heater and filter cards.
- **`/university/index.html` canonicals to `/pages/university.html`** while `_redirects` sends `/pages/university.html` → `/university/` — a redirect/canonical loop.
- **27 card image links across `/blogs/` and the related-post modules have empty anchor text** (no `alt` on the wrapped image), so those links pass no topical signal.
