# The Tank Guide — FishKeepingLifeCo

Live site: [thetankguide.com](https://thetankguide.com)
Owner: FishKeepingLifeCo (CXLXC LLC)

## Overview
The Tank Guide is a static HTML/CSS/JS site delivering aquarium planning tools, reference guides, and tank management workflows. Updates are tracked internally through the [Channel Log](docs/CHANNEL_LOG.md) and mirrored to GitHub Releases for deployment notes.

## Core Pages
- [index.html](index.html) — Homepage / feature grid.
- [about.html](about.html) — Story, mission, vision.
- [media.html](media.html) — Videos, book, articles.
- [gear.html](gear.html) — Aquarium gear guides.
- [params.html](params.html) — Cycling Coach & 24-Hour Challenge.
- [contact-feedback.html](contact-feedback.html) — Formspree + reCAPTCHA feedback.

#### Shared Partials
- [nav.html](nav.html)
- [footer.v1.3.0.html](footer.v1.3.0.html)

#### Other Pages
- [404.html](404.html)
- [cookie-settings.html](cookie-settings.html)
- [copyright-dmca.html](copyright-dmca.html)
- [feature-your-tank.html](feature-your-tank.html)
- [privacy-legal.html](privacy-legal.html)
- [stocking.html](stocking.html)
- [store.html](store.html)
- [terms.html](terms.html)

## Dev Notes
- Pure HTML/CSS/JS (no framework) with modular scripts in [js/](js) and shared styles in [css/](css).
- Navigation and footer load as partials (see `nav.html` + `footer.v1.3.0.html`) via `js/nav.js` and page-level fetch helpers for consistency.
- SEO baseline includes explicit titles, meta descriptions, and JSON-LD schema blocks across feature pages.

## Release Management
- [Channel Log](docs/CHANNEL_LOG.md) is the source of truth for shipped work.
- [GitHub Releases](../../releases) must mirror each Channel Log entry (1:1 title/date alignment) when changes go live.

## Maintenance Routine
- [ ] Daily Morning (Mon–Fri, 9:00 AM): 29G feed prompt + fertilizer check
- [ ] Daily Evening (Daily, 9:00 PM): Journal wrap (Project, FishKeeper App/AI, quick params/maintenance)
- [ ] Weekly (Sundays, 6:00 PM): Business & Tank Summary
- [ ] Bi-weekly (Every other Friday, 9:00 AM): Channel Log ↔ Releases review
- [ ] Monthly (Last day, 6:00 PM): Aquarium roll-up package

## Sync & Automation Notes
Site updates flow into `/docs/CHANNEL_LOG.md`, then publish as matching GitHub Releases so external artifacts stay aligned. A bi-weekly job reviews the Channel Log against Releases to flag any gaps, and the monthly roll-up distills tank trends, incidents, costs, and time investment for leadership.

- [ ] Channel Log entry added
- [ ] Matching GitHub Release created/updated
- [ ] Footer/schema/doc notes reflect latest changes (if applicable)

## Status
- Core pages live

Updated: 2025-10-12

All rights reserved — FishKeepingLifeCo (CXLXC LLC).
