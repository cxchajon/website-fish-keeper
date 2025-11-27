# The Tank Guide

Official website for aquarium tools, research hubs, and real-world husbandry logs.

**Live site:** https://thetankguide.com

## Project Overview
The Tank Guide is a FishKeepingLifeCo product that blends practical aquarium tooling with curated research. Visitors can plan livestock, study cycling science, browse gear recommendations, and follow along with an active 29-gallon planted tank journal.

## Live Site / URLs
- Home: `/` (The Tank Guide landing page)
- Stocking Advisor: `/stocking-advisor.html`
- Cycling Coach: `/cycling-coach/`
- Gear Guide hub: `/gear/`
- Media library: `/media.html`
- University pages: `/university/` and the legacy research hub at `/pages/university.html`
- Community Video Picks: `/pages/community-video-picks.html`
- Live Tank Journal: `/journal.html` (live notebook for the 29-gallon planted aquarium)
- Journal archives (static monthly snapshots): `/journal/2025-09.html`, `/journal/2025-10.html`, `/journal/2025-11.html`
- Blog collection: `/blogs/` plus individual posts under `/blogs/`
- Additional public pages: `/submit-your-tank.html`, `/store.html`, `/about.html`, `/contact-feedback.html`, `/privacy-legal.html`, `/terms.html`, `/copyright-dmca.html`, `/trust-security.html`, `/cookie-settings.html`

## Key Pages & Tools
- **Stocking Advisor:** Calculates safe fish stocking plans based on tank size, filtration, and species data.
- **Cycling Coach:** Guides aquarists through nitrogen cycle tracking with parameter logging and safety tips.
- **Gear Guide:** Curated equipment recommendations organized by category with structured data for filters, heaters, lighting, and more.
- **University:** Curated research hub combining academic references with practical lessons; `/university/` carries the latest design while `/pages/university.html` anchors existing deep links.
- **Media:** Interview and tutorial hub, including YouTube features and reference guides.
- **Live Tank Journal:** Daily-ish notebook for the 29-gallon planted aquarium; archives capture month-by-month snapshots for long-term reference.
- **Community Video Picks:** Archived tutorials we continue to endorse.
- **Blogs:** Long-form explainers on topics like betta community care, black beard algae, nitrogen cycling, and Purigen use.

## Tech & Architecture Notes
- Static HTML with progressive enhancement via vanilla JS (`/js/nav.js` and page-specific scripts). No server-side framework.
- Shared includes for head metadata, organization schema, and analytics live under `/includes/` and are reused by golden templates such as `gear/index.html`, `university/index.html`, `pages/university.html`, and `journal.html`.
- JSON-LD entity model: **FishKeepingLifeCo** (`Organization`) publishes **The Tank Guide** (`WebSite`), with individual pages declaring `CollectionPage` and `FAQPage` nodes where relevant.
- Data pipeline: Gear data, filters, and other reference CSV/JSON live in `/data/`. Live Tank Journal entries load from `/data/journal/index.json` with month-level snapshots in `/data/journal/YYYY-MM.json` backing the archives.

## Development Workflow / Conventions
- New pages should follow the head/meta/schema patterns in the golden templates (gear, university, journal) for consistent SEO, JSON-LD, and consent handling.
- Keep changes text-only; image assets are managed separately.
- Navigation/footer fragments are fetched client-side (`/nav.html`, `/footer.html`); ensure new pages preload them as existing templates do.
- Journal and archive pages rely on the shared journal JSON data; avoid hard-coding entries when possible.
- Sitemaps live at `/sitemap.xml`; add new public URLs there with canonical paths, sensible `lastmod`, `changefreq`, and `priority` values.

## AdSense & CMP Notes
- Google CMP (Funding Choices) implements TCF 2.0; a Consent Mode bridge maps Purpose 1/4 consent to Google signals.
- AdSense is enabled on eligible pages; the Live Tank Journal intentionally remains ad-free.
- Do not change CMP or Consent Mode scripts without product approval.

## Future Work
- Automate generation of monthly journal archives from `/data/journal` snapshots.
- Expand University course tracks and integrate the refreshed `/university/` experience across navigation.
- Add more tooling (e.g., parameter trend visualizers) using the existing static + JSON model.

—

A project by FishKeepingLifeCo. All rights reserved.
