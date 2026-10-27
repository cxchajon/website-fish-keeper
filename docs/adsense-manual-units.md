# Manual Google AdSense units

The Tank Guide runs a hybrid model: existing house-ad slots are converted one-for-one to manual
Google Display units. Auto ads stay **off**, no new positions are added, and the homepage carries no
ads of any kind. On every interactive tool the first ad stays a rotating FishKeepingLifeCo house ad;
middle positions use compact Google units and bottom positions flexible ones.
`tests/unit/ad-placements.test.mjs` enforces all of this.

## Units in use

| Page | Replaced house-ad slot | Unit name | Slot ID | Full-width responsive |
|---|---|---|---|---|
| `/blogs/aquarium-heater-safety-temperature-controllers.html` (pilot) | `ad-snail-welfare-rotator` (end of article) | TTG_Blog_EndOfArticle | `5598495275` | `false` |
| 37 further blog articles (batch 2) | each article's single house-ad slot, same position | TTG_Blog_EndOfArticle | `5598495275` | `false` |
| `/best-houseplants-for-aquariums/` | `ad-best-houseplants-for-aquariums-rotator` (end of article) | TTG_Blog_EndOfArticle | `5598495275` | `false` |
| `/growing-houseplants-in-aquarium/` | `ad-growing-houseplants-in-aquarium-rotator` (end of article) | TTG_Blog_EndOfArticle | `5598495275` | `false` |
| `/gear/` | `ad-gear-bundle` (bottom) | TTG_Gear_Bottom | `1762971638` | `true` |
| `/stocking-advisor.html` | `ad-stocking-mid` (middle, between the explainer and the bioload panel) | TTG_StockingAdvisor_Mid | `5996977454` | compact, see below |
| `/stocking-advisor.html` | `ad-stocking-bottom` (bottom) | TTG_StockingAdvisor_Bottom | `9758352395` | `true` |
| `/cycling-coach/` | `ad-cycling-bottom` (bottom, after the byline, above the footer) | TTG_CyclingCoach_Bottom | `2094490843` | `true` |
| `/assistant.html` | `ad-assistant-mid` (after the intro, before "How it works") | TTG_Assistant_Mid | `8930237876` | compact, see below |
| `/assistant.html` | `ad-assistant-bottom` (after the FAQ, before "About FishKeepingLifeCo") | TTG_Assistant_Bottom | `9864045598` | `true` |
| `/media.html` | `ad-media-faq-top` (after the storefront, before the FAQ) | TTG_MediaProto_FAQ_Top | `6497764235` | compact, see below |
| `/podcast/` | `ad-podcast-bottom` (after the FAQ, above the footer) | TTG_Podcast_Bottom | `3569730759` | `true` |
| `/tanks/project-tank-000.html` | `ad-project-tank-000-bottom` (end of article, before "Submit Your Tank") | project-tank-000 | `6308794025` | `false` |
| `/university/` | `ad-university-waterchem-bottom` (after the research citations, before the FAQ) | TTG_University_Bottom | `8925377095` | `false` |

Publisher: `ca-pub-9905718149811880`. The legacy Stocking bottom unit `8979116676` is retired and must
not be used. The University hub uses TTG_University_Bottom `8925377095`, not the historical University
Water Chemistry Bottom unit `4602491969`.

**Phase B1 (content and hub pages).** Six house-ad positions on five pages became Google units in
place (`PHASE_B1_CONVERSIONS` in the test). The podcast page had no AdSense loader; it now carries the
pilot's loader as the last entry of its consent stack, so its stack is byte-identical to the pilot's.
Project Tank #000 no longer loads `/assets/js/ad-rotator.js` itself: its bottom slot was its only
rotator. Project Tank and University keep `data-full-width-responsive="false"` so the ad stays in the
article or content column (the University shell clips overflow). Media's FAQ unit keeps the page's
existing `.media-page #ad-media-faq-top` spacing rule (2rem margins).

**Blog batch 2.** The authoritative list of converted articles is `BLOG_BATCH_2` in
`tests/unit/ad-placements.test.mjs`. Every converted article's consent stack, including the loader,
is byte-identical to the pilot's.

**Houseplant articles.** `best-houseplants-for-aquariums` and `growing-houseplants-in-aquarium`
(`BLOG_HOUSEPLANTS` in the same test) were held back from batch 2 because their `.blog-body` was
wider than the viewport between about 641px and 830px. `.blog-body` is a column-flex item of the
article with `margin: auto`, so it shrink-wraps to its min-content width, and the 760px comparison
table inside `.table-scroll-container` made that 804px. Each page's own inline style now gives
`.blog-body` `width: 100%` (scoped to the page's body class), so it fills the column and the table
scrolls inside its container. Keep that rule: the test checks it is present.

**Blog standard: `data-full-width-responsive="false"` on every blog unit.** Blog ads stay responsive
(`data-ad-format="auto"`) but are sized to the article's own content column, exactly like the
verified pilot, instead of expanding to the viewport edges on phones. On some articles a
viewport-wide ad would also be cropped, because `.blog-body` (and on two, `body`) clips overflow.
The flexible tool-page units (Gear, Stocking Advisor and Cycling Coach bottoms), Podcast bottom and
Assistant bottom keep `true` because their containers already span the viewport (Assistant's within
its 40px page padding).

**Compact middle units (Stocking Advisor, Assistant, Media).** `ad-stocking-mid`, `ad-assistant-mid`
and `ad-media-faq-top` use Google's documented "exact size
per screen width" responsive code instead of `data-ad-format="auto"`: each `<ins>` carries a size
class (`ttg_stocking_mid`, `ttg_assistant_mid`, `ttg_media_faq_top`) and no `data-ad-format`, `data-full-width-responsive` or inline style, and the
sizes are set by an inline `<style>` in the page's `<head>` (Google does not support those rules in
external stylesheets, so they are not in `css/google-ads.css`). The rules are scoped with the
container ID so the shared `.ttg-gad ins.adsbygoogle { width: 100% }` rule cannot override them.

All three use the same breakpoints. Measured available width: Stocking Advisor and Media content
columns are the viewport − 36px, Assistant's is the viewport − 40px (up to 970px).

| Viewport | Creative | Available width (Stocking / Media) | Available width (Assistant) |
|---|---|---|---|
| below 360px | none: the unit and its container are `display: none`, so it is not requested | 284px at 320 | 280px at 320 |
| 360–519px | 320×100 | 339–483px | 335–479px |
| 520–799px | 468×60 | 484–763px (Google's sample uses 500px; at 500 only 464px is available) | 480–759px |
| 800px and wider | 728×90 | 764px, up to 970px | 760px, up to 970px |

The size is fixed when the ad is requested. If the viewport later crosses a breakpoint (for example a
phone rotated after the ad filled), Google keeps the original creative; the unit is not refreshed.
`COMPACT_UNITS` in the test pins these rules.

**Tool pages: FishKeepingLifeCo first.** Every interactive tool's first ad is its rotating house ad
(`ad-stocking-top`, `ad-gear-top`, `ad-cycling-top`, `ad-snail-recommender-bottom`); the test checks
this. The Snail Recommender's only slot therefore stays a house ad. The Cycling Coach top banner has
a known layout shift (no reserved height while its image loads); it is left for the house-ad
modernization phase.

**Still house ads** (exact inventory: `REMAINING_HOUSE_ADS` in the same test):

- `neocaridina-shrimp-diet-biofilm-guide`: its products slot needs a separate affiliate-advertising decision.
- Interactive tools' first ads (cycling-coach top, gear top, snail recommender, stocking top).
- About (books, beginners, footer-top: footer-top awaits a separate owner decision), community-tanks,
  media Feature Your Tank (next to the submission buttons), podcast top and university top.

## Converting a slot

1. Replace the house-ad `<div class="ttg-ad-slot ttg-house-ad-slot" …>` with:

   ```html
   <aside class="ttg-gad" id="ad-…" aria-label="Advertisements">
     <p class="ttg-gad__label" aria-hidden="true">Advertisements</p>
     <ins class="adsbygoogle"
          style="display:block"
          data-ad-client="ca-pub-9905718149811880"
          data-ad-slot="SLOT_ID_FROM_THE_ADSENSE_DASHBOARD"
          data-ad-format="auto"
          data-full-width-responsive="true"></ins>
   </aside>
   ```

   Blog articles always use `data-full-width-responsive="false"`. Elsewhere, use `"false"` when any
   ancestor clips overflow on mobile. Do not convert a slot whose container is wider than the
   viewport at any width; a creative there would be cropped. For a compact middle unit, use the
   exact-size pattern above instead and check every breakpoint against the measured available width.
2. Link `/css/google-ads.css?v=…` after the page's other stylesheets and
   `<script src="/js/google-ads.js?v=…" defer>` before `footer-loader.js`.
3. The page must load the AdSense loader exactly once, as the last entry of the "TTG consent stack"
   (after the Consent Mode v2 defaults, Funding Choices, GTM and `consent-mode.js`), exactly as on
   the pilot. Never add a second loader and never add inline `adsbygoogle.push()` calls.
4. Add the page and slot ID to `MANUAL_UNITS` (blog articles: `BLOG_BATCH_2` or `BLOG_HOUSEPLANTS`; compact
   units also `COMPACT_UNITS`) and update `REMAINING_HOUSE_ADS` in `tests/unit/ad-placements.test.mjs`.

## Label wording

Google's [AdSense ad placement policies](https://support.google.com/adsense/answer/1346295) allow
publishers to label Google ads only as "Advertisements" or "Sponsored Links". Every manual unit uses
**"Advertisements"**, both as the visible `.ttg-gad__label` text (shown in capitals by CSS) and as the
`<aside>`'s `aria-label`, so screen readers announce the same name once (the visible label is
`aria-hidden`). Future units must use "Advertisements", or another label Google explicitly permits
after an owner decision; `GOOGLE_AD_LABEL` in `tests/unit/ad-placements.test.mjs` enforces the wording.
FishKeepingLifeCo house ads are not Google ads and keep their own markup.

## How it behaves

- **`js/google-ads.js`** pushes once per `.ttg-gad ins.adsbygoogle`, skips units Google already
  processed (`data-adsbygoogle-status`), has no timers and never creates units. Each push names its
  unit (`push({ element: ins })`): a bare `push({})` fills the first unfilled `<ins>` on the page, which
  could be a unit hidden at the current width. A unit that is not rendered (`display: none` or zero
  width) is not requested; it is requested once if a later resize makes it visible. When the visitor
  declined advertising on `/cookie-settings.html` (`<html data-ad-consent="denied">`, set by
  `consent-mode.js`), it makes no ad request. Consent Mode v2 and Google's CMP govern everything else.
- **`css/google-ads.css`** is standalone (not part of the immutable `app.bundle.css` /
  `blogs-bundle.min.css`), so no bundle cache bump is needed for it. `.ttg-gad` deliberately does not
  use `.ttg-ad-slot`, so the blog `max-height: 320px; overflow: hidden` cap, the 250px `ins`
  reservation, the empty-slot QA overlays (`data-ad-label`) and the house-ad rotator never touch a
  Google unit. Units Google reports as `data-ad-status="unfilled"` collapse; filled ads are never
  hidden or restyled. The "Advertisements" label appears only once an ad fills.

## Content-Security-Policy

The production CSP is set in Cloudflare, not in this repository (`hardening/_headers` is a reference
copy only). As recorded by the Security Headers Verify workflow, it is currently
`object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https://formspree.io; upgrade-insecure-requests`.
It has no `script-src`, `frame-src`, `connect-src` or `img-src` directives, so it does not restrict
AdSense scripts, ad iframes or beacons, and the new files are same-origin. No change is needed.

If those fetch directives are ever added, Google ad serving needs at least `script-src`
`https://pagead2.googlesyndication.com` and `https://*.adtrafficquality.google`; `frame-src`
`https://googleads.g.doubleclick.net`, `https://tpc.googlesyndication.com` and
`https://*.adtrafficquality.google`; `img-src https:`; and `connect-src`
`https://*.googlesyndication.com` and `https://*.adtrafficquality.google`. Google serves creatives from
further rotating hosts, so verify with `tests/live/csp-console.live.ts` and add only origins that
are reported as violations.

## Outside the repository

These cannot be verified from code and must be checked in Google's dashboards:

- AdSense → Ads → By site: Auto ads **off** for thetankguide.com (including anchor/vignette/side-rail
  overlays and "Optimize existing ad units").
- GTM container `GTM-KTRVCMQN`: no tag loads AdSense or injects ad units (especially on the homepage).
- AdSense → Privacy & messaging: the EEA/UK/CH GDPR message and US state-regulation message are
  published for the site.
- `ads.txt` is served at `https://thetankguide.com/ads.txt` with
  `google.com, pub-9905718149811880, DIRECT, f08c47fec0942fa0`.
