# Media Prototype Audit — `/media-prototype.html#aquarium-library`

## 1) Overview
- Page: `/media-prototype.html`
- Hash focus: `#aquarium-library`
- Timestamp (UTC): 2025-11-12 18:09:12 UTC
- Branch: `work`
- Commit: `417997348cf5b6ad49b8ee99de709107630f990f`
- Rendering summary: H1=1, H2=6, H3=10; ~844 words (page), ~84 words (Aquarium Library block); 27 links, 7 images

## 2) Metadata
- **Title:** `Fishkeeping Media & Books — The Tank Guide`
- **Meta description:** `Explore FishKeepingLifeCo videos, books, and aquarium guides in one hub designed to make aquarium science simple for every hobbyist.`
- **Robots meta:** `noindex, nofollow`
- **Canonical:** `https://thetankguide.com/media.html`
- **Open Graph:** Present `og:site_name`, `og:type`, `og:title`, `og:description`, `og:url`, `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`; missing `og:locale`
- **Twitter:** Present `twitter:card`, `twitter:site`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt`; missing `twitter:url`
- **OG image sizing:** 1200×630 PNG already referenced; ensure shared asset stays in `/assets/img/logos/logo-1200x630.png`

**Paste-Ready Head Block (recommended additions)**
```html
<link rel="canonical" href="https://thetankguide.com/media.html">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="The Tank Guide">
<meta property="og:type" content="website">
<meta property="og:title" content="Fishkeeping Media &amp; Books — The Tank Guide">
<meta property="og:description" content="Explore FishKeepingLifeCo videos, books, and aquarium guides in one hub designed to make aquarium science simple for every hobbyist.">
<meta property="og:url" content="https://thetankguide.com/media.html">
<meta property="og:image" content="https://thetankguide.com/assets/img/logos/logo-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="FishKeepingLifeCo logo (1200×630).">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@fishkeepinglife">
<meta name="twitter:title" content="Fishkeeping Media &amp; Books — The Tank Guide">
<meta name="twitter:description" content="Explore FishKeepingLifeCo videos, books, and aquarium guides in one hub designed to make aquarium science simple for every hobbyist.">
<meta name="twitter:image" content="https://thetankguide.com/assets/img/logos/logo-1200x630.png">
<meta name="twitter:image:alt" content="FishKeepingLifeCo logo (1200×630).">
<meta name="twitter:url" content="https://thetankguide.com/media.html">
```

## 3) Content Audit (Visible Text)
- **Hero / Intro**
  - `Media Hub & Fishkeeping Guides`
  - `Welcome to The Tank Guide Media Hub — your resource for all FishKeepingLifeCo content. Our goal is to make aquarium science simple and accessible for every hobbyist. Whether you’re fixing algae, starting your first tank, or looking for inspiration, you’ll find trusted, hands-on advice here.`
  - `Watch • Read • Explore`
  - `Step-by-step tutorials and guides on aquarium setup, gear, cycling, and stocking. Watch our latest videos, explore community picks, or browse our growing archive of how-to articles and builds.`
- **Featured Videos**
  - Heading: `Featured Videos`
  - Subline: `Catch our latest upload or explore the full channel for more.`
  - `Now Playing:` `How to beat Black Beard Algae. My full guide`
  - Supporting copy: `Got Black Beard Algae (BBA)? This short guide shows what really works — and what doesn’t. For a deeper breakdown, visit our Blogs page.`
  - Timestamp: `Added: 2025-10-24`
  - CTA: `Visit Our Channel`
- **Community Video Pick (within Featured Videos card)**
  - Intro: `Community Video Picks`
  - Description: `Curated how-to videos and inspiration from creators we trust — and from folks who use and follow The Tank Guide. We rotate a featured pick regularly and keep an archive of favorites you can explore anytime.`
  - Title: `This is ACTUALLY The Method for Crystal Clear Aquarium Water`
  - Attribution: `by @AQUAPROS`
  - Summary: `AQUAPROS tests Seachem Purigen to see if it really delivers crystal-clear water. The results show it’s a great polishing tool—but true clarity still depends on solid basics like regular water changes, proper filtration, and balanced bioload. A must-watch for anyone chasing that perfect glass-clear tank.`
  - CTA: `Watch on YouTube`
  - Timestamp: `Added: 2025-10-21`
  - Archive CTA: `View past Community Video Picks`
- **Community Section**
  - Heading: `Community`
  - Featured Tanks intro: `Showcasing aquariums from The Tank Guide community — real setups, honest lessons learned, and ideas to try. Want to be featured? Submit your tank and we’ll highlight standout builds.`
  - CTA: `Submit Your Tank`
- **Aquarium Library**
  - Heading: `Aquarium Library`
  - Deck: `The Aquarium Library is our free collection of aquarium guides, research articles, and data logs. You’ll find practical blogs for quick tips, university-level articles for deeper science, and a journal for tracking real aquarium data.`
  - Subhead: `Each section has its own focus:`
  - Bullets:
    - `Blogs: Hands-on aquarium tips and setup guides.`
    - `University Articles: Science-based lessons on water chemistry, biology, and cycling.`
    - `Journal: Real-world builds and data from our own tanks to help you learn by example.`
- **Storefront Image Link**
  - Anchor label: `Visit the FishKeepingLifeCo Store for educational books and journals`
- **Storefront Section Copy**
  - Heading: `📚 Educational Aquarium Books from Our Store`
  - Paragraphs describe flagship guide, journals, coloring books, and how they complement the Library; CTA `Explore the full collection of guides and journals on our Store page.`
- **FAQ Section**
  - Q1: `What is The Tank Guide?` → A1 first sentence: `The Tank Guide is the FishKeepingLifeCo learning platform dedicated to freshwater beginners.`
  - Q2: `What is “Life in Balance” about?` → `“Life in Balance” is our family-friendly storybook that turns the nitrogen cycle, filtration, and fish care basics into an illustrated adventure.`
  - Q3: `Where can I find nitrogen cycle guides?` → `Start with the Aquarium University lessons, then bookmark the quick-reference sheets in the Aquarium Library.`
  - Q4: `Do you feature community tanks?` → `Absolutely.`
  - Q5: `What is the difference between Blogs, University, and the Journal?` → `The Blogs provide practical, hands-on fishkeeping tips.`
  - Q6: `How can I submit my aquarium to be featured?` → `Use the “Submit Your Tank” form on our Community page to share photos, details, and lessons learned.`
  - Q7: `Are The Tank Guide books suitable for complete beginners?` → `Yes.`
- **SEO footer / legal links**
  - Visually hidden block: `Privacy Policy · Terms · Contact`
  - Footer section: `Privacy Policy`, `Terms`, `Contact`
- **Approximate word counts:** page ≈844; Aquarium Library block ≈84

## 4) AdSense Audit
| Location (file:line) | data-ad-client | data-ad-slot | data-ad-format | data-ad-layout | data-full-width-responsive | ARIA source | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| media-prototype.html:1029 | ca-pub-9905718149811880 | 6411910426 | auto | — | true | Wrapper `div` has `aria-label="Advertisement"`; `<ins>` lacks aria | Active |
| media-prototype.html:1111 | ca-pub-9905718149811880 | 6497764235 | auto | — | true | Wrapper `div` has `aria-label="Advertisement"`; `<ins>` lacks aria | Active |

- **Duplication check:** Slots `6411910426` and `6497764235` are unique across the repo.
- **Placeholders:** None detected.
- **Spacing checks:**
  - `.ttg-ad-slot { margin: clamp(9.5rem, 16vw, 12rem); }` and `.stack > .ttg-ad-slot { margin-block: clamp(9.5rem, 16vw, 12rem); }` maintain ~152–192px clearance around the Feature Your Tank ad, keeping distance from the “Submit Your Tank” CTA.
  - `.faq-section + .ad-slot, .ad-slot + .faq-section { margin-top: 10rem; }` enforces ~160px between the FAQ heading and the FAQ Top ad.
- **Placement guidance:** Existing slots match plan (`TTG_MediaProto_FeatureYourTank1` and `TTG_MediaProto_FAQ_Top`). Keep any future insertions between full H2 sections—not wedged between an H2 and its immediate H3 content.

**Paste-ready Ad Snippets**
```html
<!-- Display Ad for Feature Your Tank — Slot 6411910426 -->
<div class="ttg-card ad-slot rounded-2xl p-4 ttg-ad-slot" id="ad-media-feature-your-tank" data-ad-label="TTG_MediaProto_FeatureYourTank1 • Slot 6411910426" aria-label="Advertisement">
  <ins class="adsbygoogle"
       style="display:block"
       data-ad-client="ca-pub-9905718149811880"
       data-ad-slot="6411910426"
       data-ad-format="auto"
       data-full-width-responsive="true"
       aria-label="Feature Your Tank sponsored slot"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<!-- Display Ad for FAQ Top — Slot 6497764235 -->
<div class="ttg-card ad-slot rounded-2xl p-4 ttg-ad-slot" id="ad-media-faq-top" data-ad-label="TTG_MediaProto_FAQ_Top • Slot 6497764235" aria-label="Advertisement">
  <ins class="adsbygoogle"
       style="display:block"
       data-ad-client="ca-pub-9905718149811880"
       data-ad-slot="6497764235"
       data-ad-format="auto"
       data-full-width-responsive="true"
       aria-label="FAQ Top sponsored slot"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<!-- Suggested in-article unit between Community and Storefront -->
<div class="ttg-card ad-slot rounded-2xl p-4 ttg-ad-slot" data-ad-label="TTG_MediaProto_InArticle • TODO_SLOT_ID" aria-label="Advertisement">
  <ins class="adsbygoogle"
       style="display:block"
       data-ad-client="ca-pub-9905718149811880"
       data-ad-slot="TODO_SLOT_ID"
       data-ad-format="auto"
       data-full-width-responsive="true"
       aria-label="Media Hub in-article slot"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>
```

## 5) Schema / Structured Data
- Detected blocks:
  - **Organization** (`@id` present, logo present, only 3 `sameAs` URLs — fewer than the include version).
  - **FAQPage** (7 questions, aligns with accordion content).
  - **VideoObject** ×2 (both include `name`, `description`, `uploadDate`, `thumbnailUrl`, `url`, `embedUrl`, `publisher`, `author`; no `duration` or `contentUrl`).
  - **ItemList** (3 Book entries; missing `bookFormat`).
  - **BreadcrumbList** (`Home` → `Media Hub`).
- Missing recommended entity: `CollectionPage` describing the Media Hub overview.
- Enhancement opportunity: add `bookFormat` (e.g., `EBook`, `Paperback`) for each Book in the ItemList.
- Organization schema differs from `/includes/schema-organization.html` (missing Amazon Author ID, Instagram, TikTok, Facebook, etc.).

**Paste-ready JSON-LD — CollectionPage**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": "https://thetankguide.com/media.html#collection",
  "name": "Fishkeeping Media & Books — The Tank Guide",
  "description": "Watch FishKeepingLifeCo videos, browse the Aquarium Library, and explore educational aquarium books in one media hub.",
  "url": "https://thetankguide.com/media.html",
  "mainEntity": [
    {"@type": "WebPage", "@id": "https://thetankguide.com/media.html#videos", "name": "Featured Videos"},
    {"@type": "WebPage", "@id": "https://thetankguide.com/media.html#community", "name": "Community"},
    {"@type": "WebPage", "@id": "https://thetankguide.com/media.html#aquarium-library", "name": "Aquarium Library"}
  ]
}
</script>
```

**Paste-ready JSON-LD — Book ItemList enhancement**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Educational Aquarium Books by FishKeepingLifeCo",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "Book",
        "name": "Life in Balance: The Hidden Magic of Aquariums",
        "isbn": "979-8263446215",
        "bookFormat": "https://schema.org/Hardcover",
        "author": {"@id": "https://thetankguide.com/#organization"},
        "publisher": {"@id": "https://thetankguide.com/#organization"},
        "url": "https://thetankguide.com/store.html#life-in-balance"
      }
    },
    {
      "@type": "ListItem",
      "position": 2,
      "item": {
        "@type": "Book",
        "name": "The Daily Tank Journal (Standard and Planted Edition)",
        "bookFormat": "https://schema.org/SpiralBound",
        "author": {"@id": "https://thetankguide.com/#organization"},
        "publisher": {"@id": "https://thetankguide.com/#organization"},
        "url": "https://thetankguide.com/store.html#tank-journal"
      }
    },
    {
      "@type": "ListItem",
      "position": 3,
      "item": {
        "@type": "Book",
        "name": "Life in Balance Coloring Books (Vol. 1 & 2)",
        "bookFormat": "https://schema.org/Paperback",
        "author": {"@id": "https://thetankguide.com/#organization"},
        "publisher": {"@id": "https://thetankguide.com/#organization"},
        "url": "https://thetankguide.com/store.html#coloring1"
      }
    }
  ]
}
</script>
```

## 6) Accessibility & Semantics
- Ad containers use `aria-label="Advertisement"`, but `<ins>` elements have no aria attributes; consider mirroring the label on the ad iframe wrapper for redundancy.
- Storefront image link includes descriptive `aria-label`; all inline images carry descriptive `alt` attributes.
- Heading hierarchy flows H1 → H2 → nested H3s; the `Community Video Picks` H3 lives inside the Featured Videos card but is semantically acceptable.
- Link text is descriptive (e.g., `Visit Our Channel`, `Watch on YouTube`, `Submit Your Tank`); no generic “click here”.
- Video iframes include `title` attributes and lazy loading; community pick iframe also sets `aria-label`.
- FAQ accordion updates `aria-expanded` via script to support assistive tech.

## 7) AEO / GEO Notes
- **Answer Snippet (≤130 chars):** `The Tank Guide Media Hub curates videos, community picks, and library resources to simplify aquarium care.`
- **Library Snippet (≤130 chars):** `Aquarium Library: free blogs, science articles, and journals to guide every freshwater tank build.`
- **Keywords**
  - Primary: fishkeeping media hub, aquarium library, aquarium guides, FishKeepingLifeCo
  - Secondary: black beard algae guide, community aquarium videos, aquarium books and journals
  - Suggested reinforcements: mention “freshwater aquarium education”, “media archive” in body copy when launched.

## 8) Risks & Blockers
- Robots meta currently `noindex, nofollow` (prototype only).
- Missing `og:locale` and `twitter:url` tags for richer share snippets.
- Organization schema omits several `sameAs` profiles present in `/includes/schema-organization.html` (Amazon Author, Instagram, TikTok, Facebook, Twitter).
- ItemList lacks `bookFormat`, and no CollectionPage schema exists yet.
- Ad `<ins>` tags lack explicit `aria-label`; consider parity for accessibility reviews.
- Internal links mix `/pages/university.html` and `/university/` — ensure canonical structure before launch.

## 9) Action Checklist (No Code Changes)
1. **Restore full social graph in Organization schema** — File: `media-prototype.html` (or shared include) — reference `/includes/schema-organization.html` for complete `sameAs` list. *(Priority: High)*
2. **Add missing OG/Twitter metadata** — File: shared head include or `media-prototype.html`; use Paste-Ready Head Block. *(Priority: High)*
3. **Add CollectionPage schema** — File: `media-prototype.html`; use provided JSON-LD block. *(Priority: Medium)*
4. **Enhance Book ItemList with bookFormat** — File: `media-prototype.html`; use provided JSON-LD block. *(Priority: Medium)*
5. **Mirror aria labels on `<ins>` ads** — File: `media-prototype.html`; apply ad snippet template for accessibility consistency. *(Priority: Medium)*
6. **Standardize University link path** — Files: `media-prototype.html` and target page; confirm `/university/` vs `/pages/university.html`. *(Priority: Medium)*
