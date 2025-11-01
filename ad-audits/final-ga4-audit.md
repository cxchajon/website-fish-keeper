# GA4 Integration Audit — The Tank Guide

| Page | Loader Count | Config Count | Consent → GA4 → AdSense | Notes |
| --- | --- | --- | --- | --- |
| index.html | 1 | 1 | ✅ | Replaced inline GA4 block with shared include ahead of AdSense. |
| about.html | 1 | 1 | ✅ | Replaced inline GA4 block with shared include ahead of AdSense. |
| terms.html | 1 | 1 | N/A | Replaced inline GA4 block with shared include; legal page remains ad-free. |
| gear/index.html | 1 | 1 | ✅ | Replaced inline GA4 block with shared include before AdSense loader. |
| cookie-settings.html | 1 | 1 | N/A | Replaced inline GA4 block with shared include. |
| stocking-advisor.html | 1 | 1 | ✅ | Replaced inline GA4 block with shared include and preserved loader order. |
| media/index.html | 1 | 1 | ✅ | Replaced inline GA4 block with shared include before AdSense. |
| feature-your-tank.html | 1 | 1 | ✅ | Replaced inline GA4 block with shared include before AdSense. |
| privacy-legal.html | 1 | 1 | N/A | Replaced inline GA4 block with shared include; legal copy stays ad-free. |
| contact-feedback.html | 1 | 1 | N/A | Replaced inline GA4 block with shared include. |
| store.html | 1 | 1 | N/A | Replaced inline GA4 block with shared include. |
| copyright-dmca.html | 1 | 1 | N/A | Replaced inline GA4 block with shared include; legal copy stays ad-free. |
| params.html | 1 | 1 | ✅ | Replaced inline GA4 block with shared include before AdSense. |
| media.html | 1 | 1 | ✅ | Replaced inline GA4 block with shared include before AdSense. |
| blogs/index.html | 1 | 1 | N/A | Added consent script and shared GA4 include to previously untracked listing. |
| blogs/purigen/index.html | 1 | 1 | N/A | Added consent script and shared GA4 include to detail page. |
| blogs/cycle-check-3-readings/index.html | 1 | 1 | N/A | Added consent script and shared GA4 include to detail page. |
| 404.html | 1 | 1 | N/A | Inserted consent script and shared GA4 include on fallback route. |
| gear.html | 1 | 1 | N/A | Added consent script and shared GA4 include to redirect helper. |

## Summary
- All public templates now import `/includes/ga4.html` exactly once, eliminating prior inline duplicates.
- Consent mode runs before GA4 on every page, and AdSense (where present) follows the GA snippet.
- No UA or alternate measurement IDs remain, and each page exposes a single `dataLayer` bootstrap.

**Ready for live analytics.**
