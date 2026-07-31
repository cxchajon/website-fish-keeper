# Internal Linking Audit — The Tank Guide

**Site:** thetankguide.com · **Repo:** cxchajon/website-fish-keeper
**Date:** 2026-07-31
**Method:** Static analysis of every indexable `.html` file in the repo (66 pages), parsing all `<a href>` links, classifying each as **editorial** (in-content) or **boilerplate** (nav/footer/legal strip). Site nav and footer are injected client-side via `/js/nav.js` and `/footer.html`, so they carry no page-specific link equity and are excluded from the counts below. All link counts are **unique source pages**, not raw link instances.

---

## Summary

| Metric | Count |
|---|---|
| Pages audited | **66** |
| Orphan pages (0 editorial inbound links) | **7** |
| Thin-linked pages (exactly 1 editorial inbound link) | **14** |
| Pages with ≤2 editorial inbound links | **39 (59%)** |
| Broken / unresolved internal links found | **22 unique** |
| Recommended links in this report | **62** |

### Cornerstone health (editorial inbound, unique sources)

| Cornerstone | Editorial inbound | Verdict |
|---|---|---|
| `/blogs/` (blog hub) | 30 | Healthy — every post has a "← Back to all posts" link |
| `/store.html` | 36 | Healthy (mostly image/banner links with **empty anchor text** — see Note 3) |
| `/cycling-coach/` | 16 | Under-linked relative to how often the nitrogen cycle is discussed |
| `/gear/` | 16 | Under-linked relative to how often gear is discussed |
| `/stocking-advisor.html` | 11 | **Weakest cornerstone** — bioload/stocking is mentioned on 20+ pages |
| `/blogs/nitrogen-cycle/` | 8 | Reasonable |
| `/blogs/aquarium-filtration-for-beginners.html` | 8 | Reasonable |
| `/pages/university.html` | 2 | Under-linked pillar (1,727 words) |

### Top 5 priority fixes

1. **`/assistant.html` is a complete orphan.** 1,536 words describing the site's AI helper, with **zero** editorial inbound links — reachable only through the JS-injected nav. It links *out* to Stocking Advisor, Cycling Coach and Gear, but nothing links back. Fix from the homepage and both tool pages.
2. **`/podcast/` is a complete orphan.** 701 words, zero editorial inbound. `/media.html` is the natural hub — it links to the Media Library, Community Video Picks, Community Tanks and the books, but the word "podcast" does not appear on the page at all.
3. **The two biggest houseplant articles are missing from the blog index.** `/best-houseplants-for-aquariums/` (**3,391 words — the longest article on the site**) and `/how-houseplants-grow-in-aquarium-water/` (2,027 words) are absent from `/blogs/`. They currently sit in a closed 3-page loop that only links to itself, so almost no equity reaches them. (`/high-tech-vs-low-tech-planted-aquarium/` is also absent — **intentionally**, per site owner, and is excluded from these recommendations.)
4. **`/cool-down-fish-tank/` (2,606 words) and `/why-goldfish-are-misunderstood/` (1,799 words) are thin-linked** — one inbound link each, from `/blogs/`. Both are substantial pages that talk repeatedly about cycling, ammonia, stocking and gear without linking to any of the three cornerstones.
5. **Stocking Advisor is the weakest cornerstone.** Only 11 editorial inbound links, yet "bioload," "stocking," "tankmates" and the "one inch per gallon" myth appear on 20+ pages — including `/why-goldfish-are-misunderstood/`, which has a whole section titled *"The 10-Gallon Aquarium and the 'One Inch Per Gallon' Myth"* and does not link to the calculator that exists to replace that rule.

---

## Orphan pages (0 editorial inbound links)

| Page | Words | Note |
|---|---|---|
| `/assistant.html` | 1,536 | Real content page. High-value fix. |
| `/podcast/` | 701 | Real content page. High-value fix. |
| `/trust-security.html` | 182 | Trust/E-E-A-T page; also the *only* editorial source of inbound links for `/privacy-legal.html`, `/terms.html` and `/copyright-dmca.html` — so the whole legal cluster hangs off one orphan. |
| `/cookie-settings.html` | 154 | Utility page; low SEO value but should be reachable from `/privacy-legal.html`. |
| `/journal/2025-10.html` | 4 | Near-empty archive shell, but marked `robots: index,follow`. See Note 2. |
| `/journal/2025-11.html` | 4 | Near-empty archive shell, but marked `robots: index,follow`. See Note 2. |
| `/feature-your-tank-confirmation.html` | 54 | Post-submission confirmation. Correctly orphaned — **no action needed**. |

## Thin-linked pages (exactly 1 editorial inbound link)

| Page | Words | Only inbound from |
|---|---|---|
| `/cool-down-fish-tank/` | 2,606 | `/blogs/` |
| `/why-goldfish-are-misunderstood/` | 1,799 | `/blogs/` |
| `/privacy-legal.html` | 1,566 | `/trust-security.html` (an orphan) |
| `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | 1,488 | `/blogs/` |
| `/low-maintenance-fish-aquariums/` | 1,355 | `/blogs/` |
| `/blog/holiday-gift-guide-aquarium-lovers.html` | 876 | `/blogs/` |
| `/about.html` | 792 | `/` |
| `/terms.html` | 566 | `/trust-security.html` (an orphan) |
| `/books/life-in-balance/` | 539 | `/store.html` |
| `/store/` | 468 | `/neocaridina-shrimp-care/` |
| `/journal/november-2025.html` | 357 | `/journal.html` |
| `/copyright-dmca.html` | 339 | `/trust-security.html` (an orphan) |
| `/journal/october-2025.html` | 256 | `/journal.html` |
| `/community-tanks.html` | 165 | `/media.html` |

---

## Recommended links

| Source Page | Target Page | Suggested Anchor Text | Where to Insert | Priority | Reason |
|---|---|---|---|---|---|
| `/` | `/assistant.html` | ask the Tank Guide Assistant | In the tool card row, alongside the existing "Stocking Advisor" and "Cycling Coach" cards | High | Fixes the site's largest orphan (1,536 words, 0 editorial inbound) from the strongest page on the site. |
| `/cycling-coach/` | `/assistant.html` | ask the assistant about your readings | Near the results/readiness summary, after the coach returns a verdict | High | Orphan fix; natural next step when a reading is confusing. |
| `/stocking-advisor.html` | `/assistant.html` | ask the assistant about a specific pairing | In the compatibility-warning area, after "The Advisor warns about known problem pairs…" | High | Orphan fix; handles the edge cases the calculator flags but can't explain. |
| `/media.html` | `/podcast/` | the Tank Guide Life podcast | In the "Watch • Read • Explore" block, beside the existing Media Library and Community Video Picks links | High | Fixes an orphan; the word "podcast" never appears on the media hub. |
| `/` | `/podcast/` | listen to the podcast | In the Media card, after "Explore the Media Hub" | High | Second inbound path to an orphan from the homepage. |
| `/blogs/` | `/best-houseplants-for-aquariums/` | Best Houseplants for Aquariums: Selection, Setup & Care | Add a post card in the plants/houseplant group, next to "Growing Houseplants in Your Aquarium" | High | The longest article on the site (3,391 words) is missing from the blog index entirely. |
| `/blogs/` | `/how-houseplants-grow-in-aquarium-water/` | How Houseplants Grow With Roots in Aquarium Water | Add a post card next to "Growing Houseplants in Your Aquarium" | High | 2,027-word article missing from the blog index; currently only reachable via a closed 3-page loop. |
| `/about.html` | `/trust-security.html` | how we handle your data and site security | In the trust/credibility section, near the existing Privacy Policy mention | High | Orphan fix; also the only editorial route to the entire legal cluster. |
| `/privacy-legal.html` | `/cookie-settings.html` | manage your cookie choices | In the cookies/analytics section, at "…Support advertising services such as Google AdSense" | High | Orphan fix; users looking for cookie controls land on the privacy page first. |
| `/why-goldfish-are-misunderstood/` | `/stocking-advisor.html` | work out what a tank can actually hold | In the section "The 10-Gallon Aquarium and the 'One Inch Per Gallon' Myth" | High | Thin page → weakest cornerstone; the section is literally about the rule the Advisor replaces. |
| `/why-goldfish-are-misunderstood/` | `/cycling-coach/` | what cycling a tank actually involves | At "Nobody talked about cycling an aquarium. Nobody explained water conditioner or dechlorinator." | High | Thin page (1 inbound) mentions cycling 7× with no link to the cycling tool. |
| `/why-goldfish-are-misunderstood/` | `/blogs/nitrogen-cycle/` | the nitrogen cycle, explained simply | At "…aquarium filtration, oxygen exchange, and the nitrogen cycle, I realized how unfair that setup really was" | Medium | Reinforces a pillar from a thin page with genuine topical overlap. |
| `/cool-down-fish-tank/` | `/cycling-coach/` | log those readings and check where your cycle stands | Under "Check Your Water Parameters," at "Check ammonia, nitrite, and nitrate, ideally with a liquid test kit" | High | 2,606-word thin page; ammonia/nitrite testing is exactly the Coach's job. *(Note: this link already exists further down the page — place this one at the testing paragraph and vary the wording so the page doesn't repeat the same anchor.)* |
| `/cool-down-fish-tank/` | `/gear/` | air pumps and air stones we actually use | At "An air stone and air pump are simple options for adding water movement and aeration" | High | Thin page → `/gear/`; direct product-category match. |
| `/cool-down-fish-tank/` | `/blogs/aquarium-heater-safety-temperature-controllers.html` | why a temperature controller is worth it | In the equipment/temperature-management section | Medium | Strong topical pairing (heat management ↔ heater safety) that doesn't exist today. |
| `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | `/cycling-coach/` | make sure the tank is fully cycled first | At "…forms that beneficial bacteria can process more easily as part of the nitrogen cycle" | High | Thin page mentioning the nitrogen cycle without linking the Coach. |
| `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | `/stocking-advisor.html` | check the bioload before you add more | Near "The 'Quick Fix' Trap → Why Problems Appear Later" | High | Thin page → weakest cornerstone; snails are a bioload decision. |
| `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | `/neocaridina-shrimp-care/` | shrimp, which we cover separately | At "Shrimp (acknowledged, but covered separately)" | High | The page explicitly promises separate shrimp coverage and never links to it — 12 shrimp mentions, 0 links. |
| `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | `/planted-aquarium-substrate-guide-aquasoil-dirt/` | what's happening in your substrate | At "snails graze on surfaces, aerate the substrate, and break down organic waste" | Medium | Real topical overlap (substrate turnover), currently unlinked. |
| `/low-maintenance-fish-aquariums/` | `/cycling-coach/` | get the cycle established first | At "Ammonia is toxic even at low levels, which is why aquariums rely on beneficial bacteria to process it" | High | Thin page with 17 cycling-concept mentions and no link to the Coach. |
| `/low-maintenance-fish-aquariums/` | `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | what snails actually need from you | At "Snails need sufficient mineral content in the water to maintain healthy shells" | Medium | Links two thin pages that share the "easy invert" misconception. |
| `/low-maintenance-fish-aquariums/` | `/neocaridina-shrimp-care/` | keeping cherry shrimp steady | At "Shrimp rely on proper hardness and stable parameters for molting" | Medium | Natural species hand-off. |
| `/blog/holiday-gift-guide-aquarium-lovers.html` | `/stocking-advisor.html` | let them plan their own stocking list | At "Every tank has a specific 'bioload' and compatibility requirements" | High | Thin page; the word "bioload" appears in quotes and links nowhere. |
| `/blog/holiday-gift-guide-aquarium-lovers.html` | `/gear/` | our gear picks by category | At "Water Conditioners (e.g., Seachem Prime), Filter Media…" | High | Thin page → `/gear/`; a gift guide listing products should route to the gear hub. |
| `/blog/holiday-gift-guide-aquarium-lovers.html` | `/blogs/aquarium-filtration-for-beginners.html` | how filter media actually works | At "Filter Media (Purigen, Matrix, or high-quality sponge media)" | Low | Helpful context for a gift-buyer who doesn't keep fish. |
| `/journal.html` | `/journal/2025-10.html` | October 2025 archive | In the monthly archive list, beside the existing "October 2025 Monthly Recap" link | High | Orphan fix — or better, see Note 2 (these shells may deserve `noindex` instead). |
| `/journal.html` | `/journal/2025-11.html` | November 2025 archive | In the monthly archive list, beside the existing "November 2025 Monthly Recap" link | High | Same as above. |
| `/blogs/sick-fish-ich-freshwater-disease-guide/` | `/cycling-coach/` | confirm ammonia and nitrite are reading zero | At "…without stressing healthy tankmates or impacting the beneficial bacteria in your main display" | High | 10 cycling-concept mentions, 0 links; unstable water is the #1 cause of the diseases this page covers. |
| `/blogs/sick-fish-ich-freshwater-disease-guide/` | `/stocking-advisor.html` | check whether the tank is overstocked | At "Social stress or aggression from tankmates" | High | Overstocking is a named disease trigger on this page and links nowhere. |
| `/blogs/sick-fish-ich-freshwater-disease-guide/` | `/gear/` | quarantine tank basics | In the "hospital tank" paragraph | Medium | Direct gear-category match for a page that recommends buying a second tank. |
| `/planted-aquarium-substrate-guide-aquasoil-dirt/` | `/cycling-coach/` | while your tank is still cycling | At "It affects plant growth, supports beneficial bacteria, and can even shape the entire layout" | High | 1,282-word page feeding a cornerstone it never links to. |
| `/planted-aquarium-substrate-guide-aquasoil-dirt/` | `/aquarium-fertilizers-guide-liquid-root-tabs/` | how to dose root tabs and liquid ferts | At "…many aquarists supplement with root tabs or liquid fertilizers to keep plants healthy" | High | 9 fertilizer mentions with a dedicated guide sitting unlinked — the single cleanest topical match on the site. |
| `/planted-aquarium-substrate-guide-aquasoil-dirt/` | `/blogs/nitrogen-cycle/` | how beneficial bacteria colonise a new tank | At "supports beneficial bacteria" | Low | Contextual reinforcement of a pillar. |
| `/best-beginner-aquarium-plants/` | `/cycling-coach/` | track the cycle while plants settle in | At "Many of these plants can be added early — even while your tank is cycling" | High | Explicit cycling mention, no link; page has 6 inbound so it can pass equity onward. |
| `/best-beginner-aquarium-plants/` | `/gear/` | lights that suit low-light plants | At "They tolerate average lighting, handle small mistakes…" | High | 13 gear-concept mentions, 0 links to `/gear/`. |
| `/best-beginner-aquarium-plants/` | `/aquarium-fertilizers-guide-liquid-root-tabs/` | when root tabs are actually worth it | At "A liquid fertilizer can support stronger growth, but heavy dosing isn't necessary — and root tabs aren't required" | Medium | 10 fertilizer mentions, dedicated guide unlinked. |
| `/best-beginner-aquarium-plants/` | `/planted-aquarium-substrate-guide-aquasoil-dirt/` | picking a substrate for planted tanks | At "Anubias grows from a rhizome — a thick horizontal stem that must stay above the substrate" | Medium | 14 substrate mentions, guide unlinked. |
| `/blogs/betta-fish-in-a-community-tank.html` | `/stocking-advisor.html` | check your tankmate list | At "Avoid fin-nippers or flashy fish — tiger barbs, male guppies, angelfish…" | High | Compatibility is the page's core topic; the existing link is buried lower and generically worded. |
| `/blogs/betta-fish-in-a-community-tank.html` | `/cycling-coach/` | keeping ammonia at zero | At "Ammonia spikes and temperature swings stress them quickly" | High | Named ammonia-spike mention with no link to the Coach. |
| `/blogs/betta-fish-in-a-community-tank.html` | `/best-beginner-aquarium-plants/` | easy broad-leaf plants for beginners | At "Provide plants with broad leaves — like java fern or anubias" | Medium | Exact species overlap with the beginner-plants post. |
| `/blogs/blackbeard/` | `/aquarium-fertilizers-guide-liquid-root-tabs/` | getting your dosing schedule right | At "Fertilizer timing vs. uptake—when growth stalls, nutrients linger" | High | 9 fertilizer mentions on a page whose whole thesis is dosing balance. |
| `/blogs/blackbeard/` | `/gear/` | the light and timer setup I run now | At "Today the light runs a proper plant-first spectrum (no extra white spikes) on a schedule" | High | 12 gear mentions; page names specific equipment without routing to `/gear/`. |
| `/blogs/blackbeard/` | `/aquarium-plants-remove-nitrates/` | why my nitrates now run so low | At "Managing My New Problem: Zero Nitrates (The Dosing Life)" | Medium | Strong, specific topical bridge between two plant-nutrient pages. |
| `/tanks/project-tank-000.html` | `/gear/` | the gear list for this build | In the "Quick Specs" table, after "Lighting: Finnex 24/7 CC (custom-tuned)" | High | 12 gear mentions on a showcase page; the natural affiliate route is missing. |
| `/tanks/project-tank-000.html` | `/planted-aquarium-substrate-guide-aquasoil-dirt/` | why we layered soil over the plate | In "Quick Specs," at "Substrate: Soil over undergravel filter plate" | Medium | Directly explains a spec the page states without elaboration. |
| `/tanks/project-tank-000.html` | `/aquarium-plants-remove-nitrates/` | how plants strip nitrate out of the water | At "Nitrate Starvation: Plant growth is strong enough that nitrates run low" | Medium | Explains the exact phenomenon the page names. |
| `/growing-houseplants-in-aquarium/` | `/cycling-coach/` | see where your cycle actually stands | At "Beneficial bacteria convert ammonia from fish and decomposing organic matter into nitrite and then nitrate" | High | Textbook cycling sentence with no link to the Coach. |
| `/growing-houseplants-in-aquarium/` | `/aquarium-plants-remove-nitrates/` | how plants pull nitrate out of the water | At "…absorbing nutrients like nitrate while becoming part of your aquarium's natural filtration system" | High | 8 nitrate mentions; the dedicated nitrate page is unlinked from its closest sibling. |
| `/growing-houseplants-in-aquarium/` | `/gear/` | grow lights that work above a tank | In the lighting/placement section | Medium | 6 lighting mentions, `/gear/` unlinked. |
| `/best-houseplants-for-aquariums/` | `/aquarium-plants-remove-nitrates/` | how nitrate export actually works | At "For a closer look at pothos specifically as a dedicated nitrate-export tool…" | High | The site's longest article, currently linking only within its own 3-page cluster. |
| `/best-houseplants-for-aquariums/` | `/gear/` | lights and equipment for emersed growth | In the lighting/space requirements comparison section | High | 49 gear-concept mentions on a 3,391-word page with zero `/gear/` links. |
| `/best-houseplants-for-aquariums/` | `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | what pesticides do to snails and shrimp | At "Some of these treatments can be dangerous to fish, shrimp, snails, and other aquarium inhabitants" | Medium | Genuine welfare overlap; also feeds a thin page. |
| `/how-houseplants-grow-in-aquarium-water/` | `/aquarium-plants-remove-nitrates/` | the nitrate side of the story | At "How Houseplants Use Aquarium Nutrients and Nitrates" | High | 17 nitrate mentions; dedicated page unlinked. |
| `/how-houseplants-grow-in-aquarium-water/` | `/blogs/nitrogen-cycle/` | the nitrogen cycle in plain language | At "They convert ammonia into nitrite and then nitrate" | Medium | Pillar reinforcement from a 2,027-word page. |
| `/buying-shrimp-online-process-guide/` | `/neocaridina-shrimp-care/` | full Neocaridina care guide | At "Tank parameters are stable and species-appropriate" in the pre-order checklist | High | **19 shrimp mentions, zero links to the care guide.** Biggest same-topic gap on the site. |
| `/buying-shrimp-online-process-guide/` | `/blogs/sick-fish-ich-freshwater-disease-guide/` | setting up a proper quarantine | At "You have an acclimation plan and quarantine option ready" | Medium | Named quarantine step with a dedicated guide unlinked. |
| `/aquarium-livestock-sourcing-comparison/` | `/neocaridina-shrimp-care/` | what shrimp need once they're home | In the opening, at "Fish, shrimp, plants, and snails all move through very different systems" | High | 11 shrimp mentions, no link — same cluster gap as above. |
| `/aquarium-livestock-sourcing-comparison/` | `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | choosing snails responsibly | Same opening paragraph, on "snails" | Medium | 13 snail mentions; also feeds a thin page. |
| `/beginner-carpeting-plants-low-tech/` | `/neocaridina-shrimp-care/` | keeping shrimp in a carpeted tank | At "In shrimp tanks, the dense blades create grazing surfaces and shelter for young shrimp" | Medium | 8 shrimp mentions on a 2,215-word page, unlinked. |
| `/beginner-carpeting-plants-low-tech/` | `/aquarium-fertilizers-guide-liquid-root-tabs/` | how root tabs feed carpeting plants | At "root tabs can help it spread in sand or gravel" | Medium | Direct dosing hand-off. |
| `/undergravel-filters-planted-tank-case-study/` | `/freshwater-aquarium-clean-up-crew-snail-welfare.html` | what trumpet snails do to substrate | At "especially Malaysian trumpet snails—would already be present and could contribute to substrate mixing" | Medium | 7 snail mentions on a 2,207-word case study; feeds a thin page. |
| `/undergravel-filters-planted-tank-case-study/` | `/blogs/purigen/` | why Purigen sits last in the chain | At "Coarse sponge / Medium sponge / Fine sponge / Seachem Purigen / Filter floss" | Low | Explains a named component in the flow path. |
| `/diy-freshwater-sump-design-29-gallon/` | `/planted-aquarium-substrate-guide-aquasoil-dirt/` | how we layered the substrate | At "added a weed cloth layer over the undergravel plate, placed dirt above that, and finished with a sand cap" | Medium | 10 substrate mentions; guide unlinked. |
| `/diy-sump-lessons-learned.html` | `/gear/` | check valves and pumps we'd trust again | At "Never rely on a check valve as your only flood protection in a DIY sump" | Medium | 8 gear mentions on a hardware-failure post with no `/gear/` link. |
| `/fritz-plant-fest-2026/` | `/neocaridina-shrimp-care/` | how we keep cherry shrimp | At "including one setup with red cherry shrimp" | Medium | 11 shrimp mentions, unlinked. |
| `/aquarium-fertilizers-guide-liquid-root-tabs/` | `/aquarium-plants-remove-nitrates/` | how plants use up nitrate | At "nitrate is the form of nitrogen that plants absorb most readily" | Medium | Precise conceptual match. |
| `/blogs/aquarium-filtration-for-beginners.html` | `/stocking-advisor.html` | work out what your filter can keep up with | At "lots of plants, shrimp and snails, a light bioload, and one little airstone" | Medium | Reinforces the weakest cornerstone from a well-linked hub page (8 inbound). |
| `/blogs/purigen/` | `/aquarium-plants-remove-nitrates/` | where those nitrates come from | At "traps dissolved organics before they break down into nitrates" | Low | Contextual, accurate. |
| `/pages/university.html` | `/blogs/aquarium-filtration-for-beginners.html` | our plain-English filtration guide | Beside "Duke University — Filter Hardware Primer" | Medium | The pillar sends 12 filtration mentions to `.edu` sources and never to its own guide. |
| `/pages/university.html` | `/blogs/sick-fish-ich-freshwater-disease-guide/` | our guide to ich and common diseases | Beside "UF/IFAS Extension — Health Management in Aquaculture" | Medium | Same pattern — 11 disease mentions, all outbound to external sources. |
| `/journal.html` | `/blogs/blackbeard/` | how I finally beat BBA | At the first "BBA spreading slightly" entry | Medium | 44 BBA mentions across the journal, no link to the BBA article. |
| `/journal.html` | `/aquarium-plants-remove-nitrates/` | why my nitrates read this low | Near the "Current Parameters / Nitrates: 5 ppm" panel | Medium | 68 nitrate mentions on a 4,906-word page (the site's longest) with no link. |
| `/journal.html` | `/gear/` | the equipment running this tank | In the tank-specs / equipment section | Medium | 50 gear mentions on the site's longest page; no `/gear/` link at all. |
| `/media.html` | `/blogs/` | browse all the written guides | In "Watch • Read • Explore," at "browse our growing archive of how-tos" | Low | The phrase describes the blog hub but only links to it via an image. |
| `/community-tanks.html` | `/stocking-advisor.html` | plan your own stocking list | Below the featured tank cards | Low | Thin page (165 words); gives it a reason to pass equity to a cornerstone. |
| `/store/` | `/store.html` | (see Note 4 — consolidate, don't link) | — | Low | Duplicate store page; a redirect is the right fix, not a link. |

---

## Notes and caveats

### Note 1 — Broken / unresolved internal links (reported, not fixed)

| Source | Broken href | Anchor text | Likely fix |
|---|---|---|---|
| `/about.html` | `/index.html` | "Visit the home page" | `/` |
| `/about.html` | `/cycling-coach.html` | "Use Cycling Coach" | `/cycling-coach/` |
| `/podcast/` | `/stocking-advisor/` | "Stocking Advisor" | `/stocking-advisor.html` |
| `/books/daily-tank-journal-planted/` | `https://thetankguide.com/stocking-advisor/` | "Stocking Advisor" | `/stocking-advisor.html` |
| `/best-beginner-aquarium-plants/` | `https://thetankguide.com/freshwater-aquarium-clean-up-crew-snail-welfare` | "Snail-free" | add `.html` |
| `/best-houseplants-for-aquariums/` | `https://thetankguide.com/reduce-aquarium-nitrates-pothos-guide` | "full pothos nitrate guide" | add `.html` |
| `/gear/` | `/gear-products.html` | "Amazon" | page not in sitemap — verify it should be published |
| `/pages/university.html` | `/media/` | "Media Library" | `/media.html` |
| `/journal.html` | 13 × `/journal/2026-*.html` | various dated entries | Journal entry pages referenced but not present in the repo |

The 13 missing `/journal/2026-*.html` entries are the largest cluster — `/journal.html` links to a full year of 2026 entries (Balance Experiment phases, maintenance logs, BBA prep) that don't exist as files. Worth checking whether those were meant to ship.

### Note 2 — `/journal/2025-10.html` and `/journal/2025-11.html`
These are 4-word shells (JS-driven, no server-rendered content) but carry `<meta name="robots" content="index,follow">`. They duplicate `/journal/october-2025.html` and `/journal/november-2025.html`, which have real content. Linking them from `/journal.html` fixes the orphan status, but `noindex` on the shells is probably the better call — flagging rather than recommending, since it's a content decision.

### Note 3 — Empty anchor text
45 editorial links carry **no anchor text at all** — image/banner links, mostly store promos (e.g. `/pages/university.html` → `/store.html` ×4, `/media.html` → `/store.html` ×3, `/stocking-advisor.html` → `/books/coloring-book-vol-1/` ×3). These pass equity but tell search engines nothing about the destination. Adding descriptive `alt` text on the wrapped image (e.g. `alt="The Daily Tank Journal — printed aquarium logbook"`) is a fast, low-risk site-wide win.

### Note 4 — `/store/` vs `/store.html`
Two store pages exist with the same title ("Aquarium Books & Journals | Official Store"). `/store.html` has 36 editorial inbound links; `/store/` has one (from `/neocaridina-shrimp-care/`). This is splitting equity between duplicates. Recommend a 301 from `/store/` → `/store.html` rather than adding links to `/store/`.

### Note 5 — Over-optimisation check
No "click here," "read more," "this page" or similar generic anchors were found in editorial content — the site's anchor text is already in good shape. Two patterns to watch:
- **`/stocking-advisor.html`** receives the exact anchor **"Stocking Advisor"** 12 times and **`/cycling-coach/`** receives **"Cycling Coach"** 14 times. Not penalty-level, but the newer links suggested above deliberately vary the phrasing ("work out what a tank can actually hold," "check the bioload before you add more") so the ratio improves as the count grows.
- **"Read the blog →"** appears 28 times on `/blogs/`. That's fine — each card already carries a descriptive title link above it, so the arrow link is secondary.

### Note 6 — What was excluded
Nav and footer links (JS-injected sitewide), `/404.html`, `/params.html`, `/store-prototype.html`, `/gear-products.html`, template partials in `/includes/`, and everything under `/dist/`, `/archive/`, `/legacy/`, `/tests/`, `/src/` and `/docs/`. `/feature-your-tank-confirmation.html` is correctly orphaned as a post-submission page. `/high-tech-vs-low-tech-planted-aquarium/` is intentionally excluded from the blog index per the site owner and is not recommended for inclusion — though it is worth noting it has only 2 editorial inbound links total, so if it's meant to rank, it needs in-content links from related planted-tank articles rather than an index listing.
