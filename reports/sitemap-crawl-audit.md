# Sitemap & Crawlability Audit (2025-12)

## Pre-flight inventory
- **Sitemap location:** `/sitemap.xml` (committed artifact; no generator scripts found).
- **Robots:** `/robots.txt` allows all crawling and references the sitemap; no disallow for `/blogs` or `/blog` paths.
- **Meta canonical/robots templates:** Directly embedded per page; no shared template injecting meta robots beyond page-level markup.
- **New blog page located:** `blog/holiday-gift-guide-aquarium-lovers.html` (canonical `https://thetankguide.com/blog/holiday-gift-guide-aquarium-lovers.html`).

### Audit plan (files reviewed/updated)
- **Sitemap + routing:** `sitemap.xml`, `_redirects`.
- **New page inclusion:** `blog/holiday-gift-guide-aquarium-lovers.html` (canonical/indexable verification).
- **Canonical targets:** `university/index.html` (canonical), `pages/university.html` (redirect source), `store/index.html` (added to back sitemap path `/store/`).
- **Reference pages for indexability/canonicals:** `index.html`, `about.html`, `media.html`, `assistant.html`, `stocking-advisor.html`, `gear/index.html`, `cycling-coach/index.html`, `blogs/index.html`, `journal.html`, `journal-dashboard.html`, `privacy-legal.html`, `terms.html`, `trust-security.html`, `contact-feedback.html`.

## Findings
- **Missing in sitemap:** New blog (`/blog/holiday-gift-guide-aquarium-lovers.html`) was absent.
- **Non-canonical entry:** Sitemap pointed to `/pages/university.html` while the intended canonical is `/university/`; redirects also pointed away from the canonical.
- **Path coverage:** Sitemap URLs now all map to real repo files after adding `/store/index.html` for the `/store/` canonical path.
- **Indexability:** No `noindex` directives on pages kept in the sitemap; robots.txt does not block key sections.

## Actions taken
- Added the new blog post to `sitemap.xml` with `lastmod` set to the latest git commit date (2025-12-20) and aligned changefreq/priority with existing blogs.
- Re-pointed the University sitemap entry to the canonical `/university/` with an updated `lastmod`, and updated `_redirects` so all university variants resolve to that canonical path.
- Added `store/index.html` (content from `store.html`) so the `/store/` sitemap URL resolves directly to an on-disk page.

## Summary table
| URL | In sitemap | File exists | Canonical OK | Indexable OK | Notes |
| --- | --- | --- | --- | --- | --- |
| `/` | Yes | Yes (`index.html`) | Yes (`/`) | Yes | Home page indexed. |
| `/about.html` | Yes | Yes | Yes (`/about.html`) | Yes | — |
| `/media.html` | Yes | Yes | Yes (`/media.html`) | Yes | — |
| `/store/` | Yes | Yes (`store/index.html`) | Yes (`/store/`) | Yes | Added folder to back canonical path. |
| `/assistant.html` | Yes | Yes | Yes (`/assistant.html`) | Yes | — |
| `/stocking-advisor.html` | Yes | Yes | Yes (`/stocking-advisor.html`) | Yes | — |
| `/gear/` | Yes | Yes (`gear/index.html`) | Yes (`/gear/`) | Yes | — |
| `/cycling-coach/` | Yes | Yes (`cycling-coach/index.html`) | Yes (`/cycling-coach/`) | Yes | — |
| `/blogs/` | Yes | Yes (`blogs/index.html`) | Yes (`/blogs/`) | Yes | Blog index. |
| `/blog/holiday-gift-guide-aquarium-lovers.html` | Yes | Yes | Yes (`/blog/holiday-gift-guide-aquarium-lovers.html`) | Yes | Newly added blog. |
| `/blogs/nitrogen-cycle/` | Yes | Yes | Yes (`/blogs/nitrogen-cycle/`) | Yes | — |
| `/blogs/purigen/` | Yes | Yes | Yes (`/blogs/purigen/`) | Yes | — |
| `/blogs/blackbeard/` | Yes | Yes | Yes (`/blogs/blackbeard/`) | Yes | — |
| `/blogs/aquarium-filtration-for-beginners.html` | Yes | Yes | Yes (`/blogs/aquarium-filtration-for-beginners.html`) | Yes | — |
| `/blogs/betta-fish-in-a-community-tank.html` | Yes | Yes | Yes (`/blogs/betta-fish-in-a-community-tank.html`) | Yes | — |
| `/journal.html` | Yes | Yes | Yes (`/journal.html`) | Yes | — |
| `/journal-dashboard.html` | Yes | Yes | Yes (`/journal-dashboard.html`) | Yes | — |
| `/university/` | Yes | Yes (`university/index.html`) | Yes (`/university/`) | Yes | Sitemap/redirects realigned to canonical target. |
| `/privacy-legal.html` | Yes | Yes | Yes (`/privacy-legal.html`) | Yes | Legal page. |
| `/terms.html` | Yes | Yes | Yes (`/terms.html`) | Yes | — |
| `/trust-security.html` | Yes | Yes | Yes (`/trust-security.html`) | Yes | — |
| `/contact-feedback.html` | Yes | Yes | Yes (`/contact-feedback.html`) | Yes | — |

## Crawl blockers
- None detected for sitemap-listed URLs (no `noindex` meta on indexed pages; robots.txt allows crawling; canonicals point to intended URLs).

## Follow-ups
- After deployment, re-submit the sitemap in Search Console so the new blog and university canonical change are re-crawled promptly.
- Monitor server-side redirect logs to confirm `/pages/university.html` and legacy `/university` hits resolve cleanly to `/university/`.
