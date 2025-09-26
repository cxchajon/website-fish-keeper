# Channel Log

## 2025-09-26 — Contact & Feedback v1.1 (reCAPTCHA secret key added)
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** reCAPTCHA fully configured on Formspree side.
- Secret key added in Formspree: CAPTCHA → Custom reCAPTCHA → Secret key configured
- Front-end already had site key (v1 baseline)
- Next: run live challenge test and ship `release/contact-form-v1.1`
- No UI changes in this step

**Evidence / Links**
- Formspree dashboard: https://formspree.io
- Page: https://thetankguide.com/contact-feedback.html

## 2025-09-26 — Contact & Feedback v1.0 — Baseline Live
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**What shipped**
- Contact & Feedback form live (`/contact-feedback.html`)
- Formspree endpoint active: `/f/xnngnwld`
- reCAPTCHA v2 site key installed on page (front-end)
- Consent + Newsletter toggles included in payload
- Test submissions delivered to inbox

**Follow-ups**
- Add reCAPTCHA secret key in Formspree (done in v1.1 entry)
- Live test validation + green badge
- Create GitHub release: `release/contact-form-v1.1`
- Minor UI tidy (spacing, label copy)

## 2025-09-25 — SEO Schema Refresh (Sitewide) + Media Page Book Data
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Sitewide JSON-LD Organization schema added/updated; Media page book metadata refreshed.
- JSON-LD `Organization` applied across pages:
  - `name`: FishKeepingLifeCo
  - `url`: https://thetankguide.com
  - `logo`/`image`: https://thetankguide.com/logo.png
  - `addressLocality`: New York
  - `addressCountry`: United States
- Media page updated with book details:
  - ISBN: 979-8263446215
  - Ensured book info reflects current softcover
- Acceptance: schema present in `<script type="application/ld+json">` on all core pages; Media page shows updated book info.

## 2025-09-25 — Footer Links: Privacy & Legal, Accessibility, Contact
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Footer updated to include legal and contact links across the site.
- Footer text: `© 2025 FishKeepingLifeCo • Privacy & Legal • Accessibility • Contact`
- Links wired to their respective pages/anchors (where applicable)
- Acceptance: visible footer links on all pages; links resolve without errors

## 2025-09-25 — Privacy & Legal Page: Structure + Link Integration
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Established page scaffolding and style; linked in footer.
- Style: gradient black background, high-readability layout, silver outline container
- Plan for collapsible sections (dropdowns) for long content
- Footer now links to this page
- Acceptance: page loads, matches brand style; link available via footer

## 2025-09-24 — About Page Finalized
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Visuals and link routing complete.
- Background matches Home/Media; silver border treatment
- “Send feedback” link points to Contact/Feedback page
- Acceptance: about page renders correctly; feedback link opens `/contact-feedback.html`

## 2025-09-23 — Homepage v1 Released
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**What shipped**
- Brand block finalized (The Tank Guide • FishKeepingLifeCo) + tagline
- 4-card launch grid: Stocking Advisor, Gear, Cycling Coach, Media
- Social strip (Instagram, TikTok, YouTube)
- Footer with Amazon Associate disclaimer integrated
- Duplicate headline removed; CSS scoped for socials
- Status: v1 stable checkpoint for expansion (v1.1+)

**Acceptance**
- Live at: https://thetankguide.com/
- Visual hierarchy clean; grid + social strip present; disclaimer visible

## 2025-09-21 — Media Page: Amazon Book Link + CTA + Blurb
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Commerce link + copy polish.
- Updated book link to: https://amzn.to/3Kh34I1
- Button label changed from “Get the eBook” to “Buy Book On Amazon”
- Restored/updated short blurb under the book image
- Acceptance: button label correct; link resolves; blurb visible

## 2025-09-20 — Amazon Associate Disclaimer (Sitewide)
**Owner:** FishKeepingLifeCo (CXLXC LLC)

**Summary:** Compliance message added to footer across site.
- Text: “As an Amazon Associate, I earn from qualifying purchases.”
- Style: small, subtle text in footer area
- Acceptance: disclaimer present on all pages using the shared footer
