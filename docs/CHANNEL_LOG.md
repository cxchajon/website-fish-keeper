# Channel Log

## 2025-09-30 — Footer v1.2.2

Footer v1.2.2 (Sept 30, 2025)
- Restored socials row above legal links; order IG → TikTok → FB → X → YouTube → Amazon
- Kept Amazon CTA link under disclaimer
- Normalized loader to stable version param (?v=1.2.2); removed cache-bust timestamp
- Verified single Font Awesome include and global CSS styling
- Mobile/desktop alignment confirmed

## 2025-09-26 — Contact & Feedback v1.1 (reCAPTCHA secret key added)
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:**
- Configured the reCAPTCHA secret key in the Formspree dashboard (external)
- Front-end site key already live; validation confirmed via challenge and green badge
- No UI changes shipped with this release

**Evidence / Links:** Formspree dashboard https://formspree.io ; Page https://thetankguide.com/contact-feedback.html

## 2025-09-26 — Contact & Feedback v1.0 — Baseline Live
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**What shipped:** /contact-feedback.html live; Formspree endpoint /f/xnngnwld active; reCAPTCHA v2 site key on page; consent/newsletter toggles in payload; test emails verified.

**Follow-ups:** Add secret key in Formspree (done in v1.1); live validation + green badge; GitHub release; minor UI tidy.

## 2025-09-25 — SEO Schema Refresh (Sitewide) + Media Page Book Data
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:**
- Organization JSON-LD now includes addressCountry "US" and addressRegion "NY" across Home, About, Media, Gear, Params, and Contact
- Media page retains Book schema (ISBN: 979-8263446215) and aligns the Amazon URL with the on-page CTA

## 2025-09-25 — Footer Links: Privacy & Legal, Accessibility, Contact
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Standardized the shared footer links (social strip, legal/contact row, Amazon disclosure) and updated the Contact page to load footer.html for parity with the rest of the site.

## 2025-09-25 — Privacy & Legal Page: Structure + Link Integration
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Page scaffolded with high-readability gradient black background, silver outline container; plan for collapsible sections; footer wired to page.

## 2025-09-24 — About Page Finalized
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Background matches Home/Media; silver border; “Send feedback” links to /contact-feedback.html.

## 2025-09-23 — Homepage v1 Released
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**What shipped:** Brand block + tagline; 4-card launch grid (Stocking Advisor, Gear, Cycling Coach, Media); social strip; Amazon Associate disclaimer in footer; duplicate headline removed; CSS scoped.

**Acceptance:** Live at https://thetankguide.com/

## 2025-09-21 — Media Page: Amazon Book Link + CTA + Blurb
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Amazon book link updated to https://amzn.to/3Kh34I1; CTA text = “Buy Book On Amazon”; blurb restored/updated.

## 2025-09-20 — Amazon Associate Disclaimer (Sitewide)
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Compliance line added to footer on all pages: “As an Amazon Associate, I earn from qualifying purchases.”
