# Manual Google AdSense units

The Tank Guide runs a hybrid model: existing house-ad slots are converted one-for-one to manual
Google Display units. Auto ads stay **off**, no new positions are added, and the homepage carries no
ads of any kind. `tests/unit/ad-placements.test.mjs` enforces all of this.

## Units in use

| Page | Replaced house-ad slot | Unit name | Slot ID | Full-width responsive |
|---|---|---|---|---|
| `/blogs/aquarium-heater-safety-temperature-controllers.html` | `ad-snail-welfare-rotator` (end of article) | TTG_Blog_EndOfArticle | `5598495275` | `false` — `.blog-body` clips overflow, so a viewport-wide ad would be cropped on phones |
| `/gear/` | `ad-gear-bundle` (bottom) | TTG_Gear_Bottom | `1762971638` | `true` |
| `/stocking-advisor.html` | `ad-stocking-bottom` (bottom) | TTG_StockingAdvisor_Bottom | `9758352395` | `true` |

Publisher: `ca-pub-9905718149811880`. The legacy Stocking bottom unit `8979116676` is retired and must
not be used. Every other house-ad slot (including `ad-gear-top`, `ad-stocking-top`,
`ad-stocking-mid`) is still a house ad.

## Converting a slot

1. Replace the house-ad `<div class="ttg-ad-slot ttg-house-ad-slot" …>` with:

   ```html
   <aside class="ttg-gad" id="ad-…" aria-label="Advertisement">
     <p class="ttg-gad__label" aria-hidden="true">Advertisement</p>
     <ins class="adsbygoogle"
          style="display:block"
          data-ad-client="ca-pub-9905718149811880"
          data-ad-slot="SLOT_ID_FROM_THE_ADSENSE_DASHBOARD"
          data-ad-format="auto"
          data-full-width-responsive="true"></ins>
   </aside>
   ```

   Use `data-full-width-responsive="false"` when any ancestor clips overflow on mobile.
2. Link `/css/google-ads.css?v=…` after the page's other stylesheets and
   `<script src="/js/google-ads.js?v=…" defer>` before `footer-loader.js`.
3. The page must already load the AdSense loader exactly once inside the "TTG consent stack"
   (after the Consent Mode v2 defaults, Funding Choices and GTM). Never add a second loader and
   never add inline `adsbygoogle.push()` calls.
4. Add the page and slot ID to `MANUAL_UNITS` in `tests/unit/ad-placements.test.mjs`.

## How it behaves

- **`js/google-ads.js`** pushes once per `.ttg-gad ins.adsbygoogle`, skips units Google already
  processed (`data-adsbygoogle-status`), has no timers and never creates units. When the visitor
  declined advertising on `/cookie-settings.html` (`<html data-ad-consent="denied">`, set by
  `consent-mode.js`), it makes no ad request. Consent Mode v2 and Google's CMP govern everything else.
- **`css/google-ads.css`** is standalone (not part of the immutable `app.bundle.css` /
  `blogs-bundle.min.css`), so no bundle cache bump is needed for it. `.ttg-gad` deliberately does not
  use `.ttg-ad-slot`, so the blog `max-height: 320px; overflow: hidden` cap, the 250px `ins`
  reservation, the empty-slot QA overlays (`data-ad-label`) and the house-ad rotator never touch a
  Google unit. Units Google reports as `data-ad-status="unfilled"` collapse; filled ads are never
  hidden or restyled. The "Advertisement" label appears only once an ad fills.

## Content-Security-Policy

The production CSP is set in Cloudflare, not in this repository (`hardening/_headers` is a reference
copy only). The new files are same-origin and need no CSP change. Live manual Display ads need the
Google ad origins in the relevant directives — at minimum `script-src`
`https://pagead2.googlesyndication.com` and `https://*.adtrafficquality.google`; `frame-src`
`https://googleads.g.doubleclick.net`, `https://tpc.googlesyndication.com` and
`https://*.adtrafficquality.google`; `img-src https:`; and `connect-src`
`https://*.googlesyndication.com` and `https://*.adtrafficquality.google`. Google serves creatives from
further rotating hosts, so after deploying run the Security Headers Verify workflow
(`tests/live/csp-console.live.ts`, with `/gear/` and the blog pilot added to its `PAGES` if needed) and
add only origins that are reported as violations. Do not loosen unrelated directives.

## Outside the repository

These cannot be verified from code and must be checked in Google's dashboards:

- AdSense → Ads → By site: Auto ads **off** for thetankguide.com (including anchor/vignette/side-rail
  overlays and "Optimize existing ad units").
- GTM container `GTM-KTRVCMQN`: no tag loads AdSense or injects ad units (especially on the homepage).
- AdSense → Privacy & messaging: the EEA/UK/CH GDPR message and US state-regulation message are
  published for the site.
- `ads.txt` is served at `https://thetankguide.com/ads.txt` with
  `google.com, pub-9905718149811880, DIRECT, f08c47fec0942fa0`.
