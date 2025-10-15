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
- [footer.html](footer.html)

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
- Navigation and footer load as partials (see `nav.html` + `footer.html`) via `js/nav.js` and page-level fetch helpers for consistency.
- SEO baseline includes explicit titles, meta descriptions, and JSON-LD schema blocks across feature pages.
- Security headers are injected at Cloudflare. `/media.html` uses a page-scoped Transform Rule ([docs/security/cloudflare-transform-media-2025-10-20.json](docs/security/cloudflare-transform-media-2025-10-20.json)) that sets a YouTube-friendly `Content-Security-Policy` while removing `X-Frame-Options`, and still applies:
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Content-Type-Options: nosniff`
  - `Permissions-Policy: autoplay=(self "https://www.youtube.com"), fullscreen=(self "https://www.youtube.com")`
  - Rollback: delete/disable the single Cloudflare Transform Rule or revert this doc entry.
- TODO: expand the per-page CSP pattern so other embeds can be enabled without relaxing global security.

## Release Management
- [Channel Log](docs/CHANNEL_LOG.md) is the source of truth for shipped work.
- [GitHub Releases](../../releases) must mirror each Channel Log entry (1:1 title/date alignment) when changes go live.

## Maintenance Routine
All schedules run on Eastern Time (ET) unless otherwise noted.

- [ ] Daily Morning (Mon–Fri, 9:00 AM ET): 29G feed prompt + fertilizer check
- [ ] Daily Evening (Daily, 9:00 PM ET): Journal wrap (Project, FishKeeper App/AI, quick params/maintenance)
- [ ] Weekly (Sundays, 6:00 PM ET): Business & Tank Summary
- [ ] Bi-weekly (Every other Friday, 9:00 AM ET): Channel Log ↔ Releases review
- [ ] Monthly (Last calendar day, 6:00 PM ET): Aquarium roll-up package

## Sync & Automation Notes
Site updates flow into `/docs/CHANNEL_LOG.md`, then publish as matching GitHub Releases so external artifacts stay aligned. A bi-weekly job (Fridays 9:00 AM ET) reviews the Channel Log against Releases to flag gaps, while the monthly roll-up distills tank trends, incidents, costs, and time investment for leadership. reCAPTCHA v1.1 on `/contact-feedback.html` is verified each release cycle alongside Channel Log ↔ Release reconciliation.

- [ ] Channel Log entry added
- [ ] Matching GitHub Release created/updated
- [ ] Footer/schema/doc notes reflect latest changes (if applicable)

## Status
- Core pages live

Updated: 2025-10-11

All rights reserved — FishKeepingLifeCo (CXLXC LLC).
