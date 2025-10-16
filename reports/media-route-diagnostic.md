# Media Route Diagnostic

## Page inventory snapshots
### `/media.html`
- **Title & hero:** Shares the "Fishkeeping Media & Books — The Tank Guide" title and hero H1 "Media Hub & Fishkeeping Guides" with supporting subhead copy inviting visitors to "Watch • Read • Explore."【F:media.html†L7-L65】【F:media.html†L560-L626】
- **Inline head elements:** Includes a page-scoped `<meta http-equiv="Content-Security-Policy">` that relaxes YouTube embeds, on top of canonical/OG/Twitter tags that all point to `https://thetankguide.com/media.html`.【F:media.html†L9-L25】
- **Hero/intro styling:** Uses extensive inline CSS for gradient cards, a stacked library shelf illustration, and responsive embed helpers (`.video-embed`, `.aspect-16-9`).【F:media.html†L27-L208】
- **Featured video block:** Renders the Nitrogen Cycle video with a reusable `.video-embed aspect-16-9` wrapper, noscript thumbnail fallback, and a humorous supporting paragraph before CTAs.【F:media.html†L570-L626】
- **Community & Aquarium Library:** Community cards include full imagery (featured tank figure), accessible video markup with noscript fallbacks, and a gradient "Aquarium Library" card showing multiple destinations and a shelf illustration.【F:media.html†L720-L839】
- **Featured Resource:** Card keeps the CTA internal (`/store.html`) rather than sending directly to Amazon, followed by an extra closing paragraph summarizing the hub.【F:media.html†L844-L859】
- **Footer pattern:** Fetches `/footer.html?v=1.3.2` via an inline async script before loading cookie-consent assets, matching other pages.【F:media.html†L862-L920】

### `/media/index.html`
- **Title & hero:** Shares the same title, metadata, and hero text as the root version, but omits the page-level CSP override despite loading identical embeds.【F:media/index.html†L5-L399】
- **Inline styling:** Provides a leaner style block—the Aquarium Library section is simplified to a single CTA button with inline styles, and helper classes for `.video-embed` rely on ad-hoc inline styles instead of reusable classes.【F:media/index.html†L24-L156】【F:media/index.html†L391-L495】
- **Featured video block:** Uses a `youtube-nocookie.com` embed inside an inline-styled `<div>` and swaps the supporting copy for a descriptive blurb, but lacks the noscript image fallback present in `/media.html`.【F:media/index.html†L391-L418】
- **Community & Aquarium Library:** The featured tank card shows only a placeholder div (no imagery), the community video loses its noscript fallback/linked title, and the Aquarium Library collapses into a single "Browse Spotlight Blogs" pill link instead of the bookshelf treatment.【F:media/index.html†L429-L495】
- **Featured Resource:** Points the primary CTA straight to Amazon with `rel="sponsored"`, removing the store interstitial that `/media.html` uses.【F:media/index.html†L500-L512】
- **Footer pattern:** Matches the fetch-based footer injection and consent banner scripts used sitewide.【F:media/index.html†L516-L658】

## Meaningful differences
- **Security posture:** Only `/media.html` keeps the bespoke CSP meta tag that the README references for safe video embeds; the folder version omits it while still embedding external players.【F:media.html†L21-L25】【F:media/index.html†L5-L24】【F:README.md†L31-L39】
- **Hero & featured video treatments:** `/media.html` retains reusable classes, noscript fallbacks, and playful copy, whereas `/media/index.html` switches to inline-styled wrappers, drops the fallback thumbnail, and changes the featured video source to a different YouTube ID served from the `youtube-nocookie` domain.【F:media.html†L570-L609】【F:media/index.html†L391-L405】
- **Community visuals:** The root file includes the featured tank image and accessible video link text; the folder file downgrades to a placeholder box and removes the linked video heading, reducing richness and accessibility.【F:media.html†L724-L806】【F:media/index.html†L429-L460】
- **Aquarium Library layout:** `/media.html` delivers a bespoke gradient card with multiple destinations and decorative shelf, while `/media/index.html` condenses the section into a single CTA chip, removing the mini-library UI.【F:media.html†L818-L838】【F:media/index.html†L484-L495】
- **Featured Resource CTA:** Root page routes users through `/store.html`, keeping the internal merchandising flow; the folder version deep-links to Amazon directly.【F:media.html†L844-L855】【F:media/index.html†L500-L510】
- **Extra narrative paragraph:** `/media.html` closes with an additional descriptive paragraph that `/media/index.html` does not include.【F:media.html†L859-L860】
- **Commented future sections:** Only `/media.html` preserves commented-out TikTok/Instagram/archive sections, suggesting it is the working draft for upcoming expansions.【F:media.html†L629-L720】

## Internal references
| Target | Count | Files & notes |
| --- | --- | --- |
| `/media.html` | 9 | Canonical + OG URL + self-link in `/media.html`; canonical + OG URL + CTA button in `/media/index.html`; primary & mobile nav links in `nav.html`; homepage card CTA and footer footnote in `index.html`; Cycling Coach note in `params.html`.【F:media.html†L9-L15】【F:media/index.html†L8-L14】【F:media.html†L758-L758】【F:media/index.html†L437-L437】【F:nav.html†L34-L68】【F:index.html†L242-L245】【F:index.html†L411-L413】【F:params.html†L706-L706】
| `/media/` (or `/media/index.html`) | 2 | `sitemap.xml` lists both `/media.html` and `/media/index.html`; legacy audit diff references `media/index.html` (repository history only). No runtime links point users to `/media/`.【F:sitemap.xml†L20-L25】【F:AUDIT/patches/2025-10-07_media__index.html.diff†L1-L4】

## SEO signals
- Both files declare the canonical URL as `https://thetankguide.com/media.html`, reinforcing the HTML file as the preferred path.【F:media.html†L9】【F:media/index.html†L8】
- Heading hierarchy is clean on both pages (single `<h1>` followed by sectional `<h2>/<h3>`), though `/media.html` retains more semantic anchors (e.g., `aria-labelledby` wrappers and labeled groups).【F:media.html†L560-L839】【F:media/index.html†L375-L495】
- `sitemap.xml` currently exposes both versions, creating duplicate content in search indexes.【F:sitemap.xml†L20-L25】

## Recommendation
**KEEP:** `/media.html`

**Rationale:** Site navigation, canonical tags, the README's Cloudflare CSP rule, and every internal CTA already target `/media.html`, while `/media/index.html` is missing the bespoke CSP and trims key content (image assets, noscript fallbacks, richer library card). `/media.html` therefore best reflects the maintained experience and security posture, and aligns with the documented Cloudflare configuration.【F:media.html†L9-L924】【F:media/index.html†L8-L658】【F:nav.html†L34-L68】【F:README.md†L31-L39】

## Part 2 change list (actionable plan)
- **Source of truth:** Continue iterating on `media.html`; treat it as the canonical Media hub template.
- **File removals:** Delete `media/index.html` to eliminate the duplicate route.
- **Link updates:**
  - Remove the `/media/index.html` entry from `sitemap.xml` so search engines see only the canonical page.【F:sitemap.xml†L20-L25】
  - No nav/footer changes needed because all runtime links already target `/media.html`; keep `params.html`, `index.html`, and component CTAs pointed there.【F:index.html†L242-L245】【F:index.html†L411-L413】【F:params.html†L706-L706】
- **Cloudflare dashboard:**
  - Add a 301 redirect rule sending requests from `/media/*` (or at minimum `/media/` and `/media/index.html`) to `/media.html`.
  - Confirm the existing Transform Rule continues to match `/media.html`; if it currently matches `/media/*`, tighten it to `/media.html` after the redirect so the CSP override is tied to the surviving page.【F:README.md†L31-L39】

## Rollback notes
- Restore `media/index.html` from version control and re-add its sitemap entry if stakeholders later decide to serve the folder route.
- Remove the Cloudflare redirect rule if `/media/` needs to host unique content again.
- Re-run sitemap submissions after any rollback so search engines re-crawl the reinstated URL.
