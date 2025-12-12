# Ad Slot Inventory (Standardized)

## Canonical Specification
- Standard Tank Guide ad slot: responsive container, max-width **970px**, min-height **280px** (approx. 970×280 footprint).
- Design template: logical display **970×280**; working size **1940×560** (2× for retina, safe cropping outside 970×280).
- All `.ttg-ad-slot` containers center within the content column, use clamp-based vertical spacing, and flex-center their contents.

## Page Coverage
- **about.html** — Footer ad (`#ad-about-footer-top`) inside `.ttg-ad-slot`; styled via `app.bundle.css`, `css/style.css`, and inline theme vars. Intended size: standard Tank Guide ad slot.
- **community-tanks.html** — Gallery ad between intro and grid, `.ttg-ad-slot`; inline spacing plus global bundles. Intended size: standard Tank Guide ad slot.
- **tanks/project-tank-000.html** — Bottom promo/ad container `#ad-project-tank-000-bottom` using `.ttg-ad-slot`; explicitly follows the standard Tank Guide ad slot footprint (responsive up to 970px wide, min-height 280px). Intended size: standard Tank Guide ad slot.
- Now running internal promo creative for *Life in Balance – The Hidden Magic of Aquariums* using `/assets/img/ads/IMG_2870.jpeg` linked to `/store.html#life-in-balance`.
- **assistant.html** — Mid and bottom slots (`#ad-assistant-mid`, `#ad-assistant-bottom`) inside `.ttg-ad-slot`; governed by app bundle and inline spec. Intended size: standard Tank Guide ad slot.
- **media.html** — Feature CTA slots (`#ad-media-feature-your-tank`, `#ad-media-faq-top`) use `.ttg-card.ad-slot.ttg-ad-slot` with media gradients; sizing now standard Tank Guide ad slot.
- **pages/university.html** — All ad sections now `.ad-slot.ttg-ad-slot`; university page CSS updated to canonical sizing. Intended size: standard Tank Guide ad slot.
- **stocking-advisor.html** — Hero promo now `.ad-container.ad-hero.ttg-ad-slot`; top/mid/bottom AdSense slots already `.ttg-ad-slot`. Page CSS aligned to standard Tank Guide ad slot.
- **gear/index.html** — Top/bundle ad slots `.ttg-ad-slot`; gear CSS uses the standard Tank Guide ad slot spec.

## Anomalies & Follow-ups
- Previous height mismatches (90px university slots, 250px bundle defaults, 10rem spacing variance, media min-heights) are **resolved** under the 970×280 standard.
- No intentional exceptions remain; future modifiers (e.g., slim variants) are not in use.
