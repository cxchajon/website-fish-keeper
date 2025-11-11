# Media Prototype — Gemini Optimization Pass

## Summary of Changes
- Duplicated the live Media hub into `/media-prototype.html` with prototype-only noindex and canonical safeguards.
- Surfaced TikTok and Instagram showcases with added editorial context, expanded FAQ content, and refreshed the featured book heading and copy.
- Added MediaTop and MediaMid ad placements, FAQPage schema, and backup crawlable legal links while preserving existing analytics and consent tooling.

## Gemini Recommendation Checklist
- [x] **P0 – Content depth & hidden sections:** TikTok and Instagram blocks enabled with supporting copy; Media Archive left staged.
- [x] **P0 – FAQ section:** Four-question FAQ inserted above the featured book.
- [x] **P0 – FAQPage schema:** New JSON-LD added matching on-page Q&A.
- [x] **P0 – Noindex/crawl controls:** `<meta name="robots" content="noindex, nofollow">` applied; canonical remains on production URL.
- [x] **P1 – Meta description:** Updated to Gemini-provided copy.
- [x] **P1 – WebPage schema:** Author and publisher `@id` references confirmed in prototype head.
- [x] **P1 – Ad slots:** TTG_MediaTop and TTG_MediaMid containers implemented using standard `.ttg-adunit` markup.
- [x] **P1 – Revenue/analytics:** GA4 ad-slot tracking updated for MediaTop and MediaMid IDs.
- [x] **P2 – H2 refinement:** Featured section heading now reads “Featured Book: Life in Balance.”
- [x] **P2 – Legal links:** Prototype includes crawlable Privacy, Terms, and Contact text links.

## Word Count Delta (approx.)
- `/media.html`: 4,932 words
- `/media-prototype.html`: 5,423 words
- **Delta:** +491 words of meaningful content

## New Ad Slot Locations
- **TTG_MediaTop:** Immediately below the hero section heading.
- **TTG_MediaMid:** Between the Community stack and the Aquarium Library showcase.

## Meta Description Used
> Explore The Tank Guide’s fishkeeping guides, videos, and books. Find resources from FishKeepingLifeCo to help you build a healthy freshwater aquarium.

## WebPage Schema Snippet (author/publisher lines)
```json
  "publisher": {
    "@id": "https://thetankguide.com/#organization"
  },
  "author": {
    "@id": "https://thetankguide.com/#organization"
  }
```

## FAQ Section Headings
- What is The Tank Guide?
- What is “Life in Balance” about?
- Where can I find nitrogen cycle guides?
- Do you feature community tanks?

## Noindex Confirmation
- `<meta name="robots" content="noindex, nofollow">` is present in the prototype head.

## Additional Notes
- Prototype-only legal links are visually hidden but crawlable to satisfy compliance until global footer updates ship.
- OG/Twitter image references remain aligned with the sitewide 1200×630 logo standard.
