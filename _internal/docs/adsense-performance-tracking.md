# AdSense Performance Tracking Setup

This document summarizes the workflow for breaking down ad performance by placement and correlating it with analytics data.

The authoritative list of live units, pages and slot IDs is [`docs/adsense-manual-units.md`](../../docs/adsense-manual-units.md), enforced by `tests/unit/ad-placements.test.mjs`.

## 1. Ad unit names

The live manual units (51 placements across 49 pages) use these AdSense units:

- `TTG_Blog_EndOfArticle` → slot `5598495275` (41 blog articles)
- `TTG_Gear_Bottom` → slot `1762971638`
- `TTG_StockingAdvisor_Mid` → slot `5996977454`
- `TTG_StockingAdvisor_Bottom` → slot `9758352395`
- `TTG_CyclingCoach_Bottom` → slot `2094490843`
- `TTG_Assistant_Mid` → slot `8930237876`
- `TTG_Assistant_Bottom` → slot `9864045598`
- `TTG_MediaProto_FAQ_Top` → slot `6497764235`
- `TTG_Podcast_Bottom` → slot `3569730759`
- `project-tank-000` → slot `6308794025`
- `TTG_University_Bottom` → slot `8925377095`

Earlier units no longer on any page: `TTG_StockingTop` (`8419879326`), `TTG_StockingBottom` (`8979116676`, retired; must not be reused), `TTG_ParamsTop` (`8136808291`), `TTG_ParamsBottom` (`5754828160`), `TTG_GearTop` (`7692943403`), `TTG_MediaBottom` (`9522042154`) and the University Water Chemistry Bottom unit (`4602491969`).

## 2. Custom channels (AdSense UI)

Create a **custom channel** for each placement grouping so you can compare RPM/CTR/impressions across your layouts:

1. Go to **AdSense → Brand Safety & Blocks → Manage → Custom channels** (or **Ads → By ad unit → Custom channels**).
2. Group the units, for example:
   - `TTG_Blog`: TTG_Blog_EndOfArticle
   - `TTG_ToolMid`: TTG_StockingAdvisor_Mid, TTG_Assistant_Mid
   - `TTG_ToolBottom`: TTG_Gear_Bottom, TTG_StockingAdvisor_Bottom, TTG_CyclingCoach_Bottom, TTG_Assistant_Bottom
   - `TTG_Content`: TTG_MediaProto_FAQ_Top, TTG_Podcast_Bottom, project-tank-000, TTG_University_Bottom

Once these channels collect data you can break down reports by placement group and optionally drill down to individual ad units as a secondary dimension.

## 3. URL groups (optional)

Set up URL groups if you want to filter AdSense reports by tool/page type:

- `/stocking-advisor.html`
- `/cycling-coach/`
- `/gear/`
- `/assistant.html`
- `/media.html`

## 4. Link AdSense to GA4 (recommended)

Linking AdSense with GA4 unlocks page-level revenue data in Analytics:

- In **AdSense**: `Account → Access and authorization → Google Analytics` and link the GA4 property.
- In **GA4**: `Admin → Product Links → AdSense` and complete the link wizard.

After the link is active you can combine AdSense revenue with GA4 events to see which tool flows correlate with higher monetization.

## 5. GA4 slot view events (retired)

`/js/ad-slot-view-tracking.js` used to send a GA4 `ad_slot_view` event when one of nine legacy ad containers (`ad-top-1`, `ad-bottom-1`, `ad-top-params`, `ad-bottom-params`, `ad-top-gear`, `ad-bottom-gear`, `ad-media-top-1`, `ad-media-mid-1`, `ad-media-bottom-1`) became 25% visible. None of those containers is on any page now, so the event could no longer fire. The script was removed in the Phase B3 cleanup. For viewability, use AdSense's Active View metrics per ad unit or the GA4 link above.
