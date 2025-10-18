# Third-Party Script Audit

- **Google AdSense (`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js`)**
  - Included on `/` and `/gear/` regardless of consent banner state. Script downloads before consent is collected, although runtime CSS hides ad slots when consent is denied. Consider lazy-loading after positive consent to avoid unused payload for EEA visitors. 【index.html†L176-L185】【gear/index.html†L115-L123】
- **Google Funding Choices (`https://fundingchoicesmessages.google.com/...`)**
  - Always requested alongside the consent banner, even on legal pages where consent defaults to denied. Verify whether the Funding Choices prompt is necessary when custom consent UI already handles opt-in. 【index.html†L176-L185】【gear/index.html†L115-L123】
- **Cloudflare Insights Beacon (`https://static.cloudflareinsights.com/beacon.min.js`)**
  - Loads on major pages even when analytics consent is withheld. The script runs regardless of consent toggles, so evaluate gating behind consent or removing if analytics value is minimal. 【index.html†L179-L183】【gear/index.html†L118-L120】
- **Amazon affiliate redirects**
  - Numerous short links (`https://amzn.to/...`) ship in `assets/js/gear.v2.data.js` and `assets/js/generated/gear-stands.json`. Confirm whether all catalog entries are still in use; dead catalog items can be trimmed to reduce JS payload. 【assets/js/gear.v2.data.js†L1-L320】【assets/js/generated/gear-stands.json†L1-L220】

> Due to Playwright download blocks, runtime verification of script execution could not be captured; findings rely on static inspection. See `blockers.md` for details.
