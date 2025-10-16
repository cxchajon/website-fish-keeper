# Media Page Audit — 2025-10-16

## Page Overview
- **Title:** Fishkeeping Media & Books — The Tank Guide
- **Meta description:** “Explore The Tank Guide fishkeeping guides, media, and books by FishKeepingLifeCo—videos, previews, and resources to help you build healthy freshwater aquariums.”
- **Canonical:** https://thetankguide.com/media.html
- **Key sections:**
  1. Hero (Media Hub & Fishkeeping Guides)
  2. Featured Videos (latest upload card with CTA)
  3. Community (Featured Tanks card, Community Video Picks card, Aquarium Library CTA)
  4. Featured Resource (book promotion)
  5. Site footer + ad unit + consent tooling
  6. Hidden (commented-out) sections for TikTok, Instagram gallery, and Media Archive

## Embeds Summary
- **Featured video:** `https://www.youtube.com/embed/QbPxRZqd4MI?rel=0&modestbranding=1&playsinline=1`
  - Wrapper: `.video-embed.aspect-16-9` with `overflow:hidden` and border radius 12px (matches card radius).
  - Attributes: `loading="lazy"`, `referrerpolicy="strict-origin-when-cross-origin"`, `allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"`, `allowfullscreen`.
  - Fallback: `<noscript>` thumbnail sourced from `https://img.youtube.com/vi/QbPxRZqd4MI/hqdefault.jpg` linking directly to YouTube.
- **Community pick:** `https://www.youtube.com/embed/zX3wGQpC4eE?rel=0&modestbranding=1&playsinline=1`
  - Wrapper: `.video-embed.aspect-16-9` (same clipping + ratio).
  - Attributes already included `loading="lazy"`, `referrerpolicy`, and matching `allow` permissions.
  - Fallback: `<noscript>` thumbnail from `https://img.youtube.com/vi/zX3wGQpC4eE/hqdefault.jpg`.
- **Rounded corners:** Both embeds now inherit the 12px radius applied to cards (before: featured video iframe sat in an unstyled `.video-wrapper` and displayed sharp corners). Screenshots included in PR description (mobile 390px & desktop 1280px) show consistent clipping on both cards.

## CSP Snapshot
- Page contains a `<meta http-equiv="Content-Security-Policy">` defining:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`
  - `style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com`
  - `img-src 'self' data: https://www.gstatic.com/recaptcha/ https://www.google.com/recaptcha/`
  - `font-src 'self' https://cdnjs.cloudflare.com`
  - `connect-src 'self' https://formspree.io https://www.google.com/recaptcha/`
  - `frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`
  - Additional directives (`form-action`, `base-uri`, `object-src`, `frame-ancestors`, `upgrade-insecure-requests`).
- Console during local load records blocks for:
  - `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js`
  - `https://static.cloudflareinsights.com/beacon.min.js`
  - `https://fundingchoicesmessages.google.com/...`
  - Meta-delivered `frame-ancestors` being ignored.
- Cloudflare Response Header Transform (`docs/security/cloudflare-transform-media-2025-10-20.json`) manages the production CSP for `/media.html`. Ensure the rule explicitly allow-lists the above Google/Cloudflare domains plus `https://img.youtube.com https://i.ytimg.com` for `<noscript>` thumbnails.

## CSS & Design Findings
- Featured video now reuses the `.video-embed` helper, aligning visual treatment and ensuring rounded edges with `overflow:hidden`.
- The `Now Playing` heading exposes the full title within the heading to improve clarity against the adjacent link.
- Existing layout grid (`.stack`, `.split`) maintains responsive stacking (single-column under 900px). No spacing regressions observed; cards retain consistent padding and backdrop-blur aesthetic.
- Recommendation (no code change yet): consider compressing the Featured Tanks PNG or swapping to WebP to reduce the heavy 5.2 MB asset while keeping the same visual design.

## Accessibility Findings
- Heading hierarchy: `h1` (Media Hub) → `h2` (Featured Videos, Community, Featured Resource) → `h3` (card titles, now-playing, community pick) respects order with no skipped levels.
- Links: External CTAs already include `target="_blank"` + `rel="noopener noreferrer"` or `rel="sponsored noopener noreferrer"` as appropriate.
- Iframes: both include descriptive `title` attributes; wrappers remain keyboard reachable via surrounding links. Adding the video title text inside the `Now Playing` heading provides extra context for screen readers before encountering the adjacent link.
- Images: Featured Tanks image retains meaningful alt text; Amazon cover retains descriptive alt; no decorative images lack `alt=""`.
- Focus: Buttons/links inherit global focus styles. `resource-cover-link` defines a clear `outline`, and the new `<noscript>` thumbnails only render when JS is off (link remains focusable).

## Performance Findings
- Heavy asset: `assets/media/community/IMG_9505.png` is 5.2 MB; consider creating a 1600px WebP (~400 KB) to improve LCP in the Community card.
- Embedded iframes both lazy-load and use privacy-friendly params (`rel=0`, `modestbranding=1`, `playsinline=1`).
- Scripts already defer/async where possible. No additional blocking resources introduced by this change.
- `<noscript>` thumbnails require CSP allowance for `img.youtube.com` or `i.ytimg.com` when served to no-JS visitors.

## SEO Findings
- Meta title/description present; canonical set to the live URL.
- Open Graph/Twitter tags share the same copy and point to `/logo.png` (square). Consider providing a 1200×630 OG image for richer link previews in a future update.
- `footer.html` injects `<meta name="robots" content="noindex,nofollow">` into every page via `outerHTML`, effectively preventing indexing. Recommend relocating/removing the robots meta from the shared footer fragment so pages like `/media.html` can be indexed.
- No `nofollow` or `noindex` directives elsewhere on the page; schema.org JSON-LD present for Organization and Book.

## Action List
1. `media.html:214-216` → Reduce `.video-embed` radius to 12px → Aligns embed corners with 12px card radius for consistent clipping → Low risk; scoped to media page inline styles.
2. `media.html:475-498` → Replace unstyled `.video-wrapper` with `.video-embed aspect-16-9` and expand heading text → Ensures rounded presentation and clearer “Now Playing” heading → Low risk; HTML-only adjustment.
3. `media.html:481-497` → Normalize featured iframe attributes and add `<noscript>` fallback → Matches community embed’s privacy/perf params and provides no-JS access → Low risk; scoped to featured video block.

## Rollback Plan
- Revert the commit on branch `audit/media-20251016` (`git revert <commit>` or `git checkout -- media.html`) to restore the prior embed markup.
- Remove the audit report if needed (`git rm reports/media-full-audit-20251016.md`).
- Cloudflare Response Header Transform continues governing the live CSP; no repo-side CSP changes were made.
