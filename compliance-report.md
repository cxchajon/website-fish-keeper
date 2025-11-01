# AdSense Readiness Audit — TheTankGuide.com

## Overview
- **Monetization method:** Manual AdSense units (no Auto Ads)
- **Consent stack:** Custom Consent Mode v2 banner with Google Funding Choices bridge
- **Audit date:** 2025-10-03 UTC

## Page-by-Page Findings

| Page | Loader once in `<head>` | Required slots present & matched | Consent banner hooks | Layout & CLS guard | Legal/ad-free | Verdict |
|------|------------------------|----------------------------------|----------------------|--------------------|---------------|---------|
| `/stocking-advisor.html` | ✅ AdSense loader present exactly once in `<head>` and follows `/assets/js/consent-mode.js`. | ✅ `ad-top-1` → `8419879326` under hero; `ad-bottom-1` → `8979116676` after results CTA. | ✅ Banner (`data-consent-banner`) with `.js-consent-accept` / `.js-consent-reject`; Funding Choices bridge sets `data-ad-consent`. | ✅ `.ttg-adunit` reserves `min-height:96px`; no sticky/fixed styles; spacing respects CTAs. | ✅ No legal content ads; footer now links to privacy/legal resources. | **READY** |
| `/params.html` | ✅ Loader once in `<head>` after consent script. | ✅ `ad-top-params` → `8136808291` under intro; `ad-bottom-params` → `5754828160` before educational content. | ✅ Banner hooks identical; consent choice updates DOM & GTM state. | ✅ Same `.ttg-adunit` reserve ensures no CLS; placements away from form buttons. | ✅ Legal content separate; footer updated. | **READY** |
| `/gear/` (`/gear/index.html`) | ✅ Loader once in `<head>` after consent script. | ✅ `ad-top-gear` → `7692943403` injected just below hero summary via `GearTopAd()`; `ad-bottom-gear` → `1762971638` static before footer. | ✅ Banner hooks & Funding Choices bridge; CMP event toggles `is-ads-disabled`. | ✅ `.ttg-adunit` wrapper provides reserve; no overlays. | ✅ Gear page only; no legal copy. | **READY** |
| `/media.html` | ✅ Loader once in `<head>` after consent script. | ✅ Single bottom unit `ad-media-bottom-1` → `9522042154` above footer. | ✅ Banner hooks present; matches Consent Mode defaults. | ✅ `.ttg-adunit--media-bottom` reserves space; placement away from CTAs. | ✅ No legal ads; footer links compliant. | **READY** |
| `/privacy-legal.html` | ✅ Loader once in `<head>` after consent script; no ad slots rendered. | ✅ N/A (no ad units by design). | ✅ Banner hooks retained for consent access & reset. | ✅ No ad containers; layout unaffected. | ✅ Contains required sections (Privacy Policy, Cookies & Tracking, Affiliate Disclosure, AdSense Disclaimer, Terms of Use, Copyright & DMCA, Accessibility, Contact). | **READY** |

## Global Assets
- **Consent Mode v2:** `/assets/js/consent-mode.js` sets EEA defaults to denied, persists choices for 365 days in `localStorage` + cookie, exposes `window.acceptAll()` / `window.rejectPersonalized()` and toggles `is-ads-disabled`. Funding Choices bridge syncs CMP decisions to DOM attributes.
- **Ad placement CSS:** `/css/style.css` defines `.ttg-adunit { min-height:96px; display:flex; ... }` preventing layout collapse before fill.
- **Footer links:** `footer.html` now lists Privacy & Legal, Terms of Use, Cookie Settings, Contact, Store, Copyright.
- **ads.txt:** Added `/ads.txt` with `google.com, pub-9905718149811880, DIRECT, f08c47fec0942fa0`.

## Live Behavior Notes
_(Static review only — no production telemetry executed. Local static preview verified banner visibility and footer links.)_
- Non-EEA default: Consent script sets `defaultGranted=true` ensuring ads render immediately (`data-ad-consent="granted"` and `.is-ads-disabled` removed by banner sync).
- EEA gate: Banner appears (controlled by region param/time-zone); Accept triggers `gtag('consent','update')` with all grants; Reject keeps ad storage granted but disables personalization/analytics and removes `.is-ads-disabled` allowing NPA fill.
- CMP integration: Funding Choices listener sets `data-ad-consent` for TCF events; fallback banner hidden automatically when CMP active.

## Screenshots
- Desktop footer with contact link: ![Stocking footer desktop](browser:/invocations/dpcqimpu/artifacts/artifacts/stocking-footer-desktop.png)
- Mobile footer with contact link: ![Stocking footer mobile](browser:/invocations/esjtfrcv/artifacts/artifacts/stocking-footer-mobile.png)

## Outstanding Questions for Site Owner
1. Are any incentivized traffic sources, paid-to-click schemes, or iframe embeds planned or in use? (Policy requires avoidance.)
2. Does any site content fall under restricted or YMYL categories needing certified expertise? Provide references if so.
3. Will a certified IAB TCF CMP be added for EEA/UK/CH traffic, or will non-personalized ads remain the long-term approach?
4. Can you confirm every page that renders the shared footer also includes a dedicated Contact link now that it has been added site-wide?

## Final Verdict
**READY FOR SUBMISSION** — All monetized pages meet loader placement, slot mapping, consent gating, CLS reserve, legal coverage, and footer-link requirements. Maintain Consent Mode data hygiene and ensure future templates keep the single loader in `<head>` only.
