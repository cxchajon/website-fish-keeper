# Static QA – AdSense

## /stocking.html — PASS
- Loader present once in the `<head>` before CMP scripts. 【F:stocking.html†L907-L934】
- Slots match spec: top `8419879326`, bottom `8979116676`. 【F:stocking.html†L950-L968】【F:stocking.html†L1356-L1368】
- Placement: top ad sits between the hero header and the Tank Size card; bottom ad appears after the “See Gear Suggestions” CTA and before the footer include. 【F:stocking.html†L937-L976】【F:stocking.html†L1356-L1374】
- CLS guard: `.ttg-adunit` enforces `min-height: 96px` globally, and inline slots retain `display:block`. 【F:css/style.css†L1608-L1638】

## /params.html — PASS
- Loader present once in `<head>`. 【F:params.html†L532-L559】
- Slots match spec: top `8136808291`, bottom `5754828160`. 【F:params.html†L564-L586】【F:params.html†L663-L674】
- Placement: top ad follows the hero title block and precedes the input form; bottom ad follows the results/actions block and precedes supplemental sections. 【F:params.html†L564-L612】【F:params.html†L663-L706】
- CLS guard provided by shared `.ttg-adunit` rule. 【F:css/style.css†L1608-L1638】

## /gear.html (/gear/) — PASS
- Loader present once in `<head>` of the redirect shell. 【F:gear/index.html†L15-L42】
- Slots match spec: dynamic top slot `7692943403` (`GearTopAd`), static bottom slot `1762971638`. 【F:src/pages/GearPage.js†L160-L185】【F:gear/index.html†L48-L58】
- Placement: `GearTopAd()` fragment is appended before the context controls, keeping the ad between the introductory copy and the first tool; bottom ad sits before the footer include. 【F:src/pages/GearPage.js†L207-L225】【F:gear/index.html†L48-L60】
- CLS guard inherits from global `.ttg-adunit` styles. 【F:css/style.css†L1608-L1638】

## /media.html — PASS
- Loader present once in `<head>`. 【F:media.html†L322-L360】
- Slot matches spec: bottom `9522042154`. 【F:media.html†L502-L513】
- Placement: single ad appears just before the footer include. 【F:media.html†L502-L525】
- CLS guard provided by `.ttg-adunit`. 【F:css/style.css†L1608-L1638】

## Legal pages — PASS
- `privacy-legal.html`, `terms.html`, `copyright.html`, and `copyright-dmca.html` contain policy content only and no `<ins class="adsbygoogle">` markup. 【F:privacy-legal.html†L360-L420】【F:terms.html†L352-L420】【F:copyright.html†L332-L396】【F:copyright-dmca.html†L332-L394】

## Global loader check
- All AdSense loader tags use the canonical snippet and occur exactly once per document head (verified across site templates and docs). 【F:stocking.html†L907-L934】【F:params.html†L532-L559】【F:gear/index.html†L15-L42】【F:media.html†L322-L360】【F:docs/screens/curl-index.html†L11-L18】

No issues detected.
