# AdSense Performance Tracking Setup

This document summarizes the workflow for breaking down ad performance by placement and correlating it with analytics data.

## 1. Ad unit names

All ad units in AdSense already follow the naming convention below, which makes it easy to assign them to placement groups:

- `TTG_StockingTop` → slot `8419879326`
- `TTG_StockingBottom` → slot `8979116676`
- `TTG_ParamsTop` → slot `8136808291`
- `TTG_ParamsBottom` → slot `5754828160`
- `TTG_GearTop` → slot `7692943403`
- `TTG_GearBottom` → slot `1762971638`
- `TTG_MediaBottom` → slot `9522042154`

## 2. Custom channels (AdSense UI)

Create a **custom channel** for each placement grouping so you can compare RPM/CTR/impressions across your layouts:

1. Go to **AdSense → Brand Safety & Blocks → Manage → Custom channels** (or **Ads → By ad unit → Custom channels**).
2. Create the channels below and add the specified ad units to each:
   - `TTG_TopTool`: StockingTop, ParamsTop, GearTop
   - `TTG_PostResultsTool`: StockingBottom, ParamsBottom
   - `TTG_MediaBottom`: MediaBottom

Once these channels collect data you can break down reports by placement group and optionally drill down to individual ad units as a secondary dimension.

## 3. URL groups (optional)

Set up URL groups if you want to filter AdSense reports by tool/page type:

- `/stocking-advisor.html`
- `/params.html`
- `/gear.html`
- `/media.html`

## 4. Link AdSense to GA4 (recommended)

Linking AdSense with GA4 unlocks page-level revenue data in Analytics:

- In **AdSense**: `Account → Access and authorization → Google Analytics` and link the GA4 property.
- In **GA4**: `Admin → Product Links → AdSense` and complete the link wizard.

After the link is active you can combine AdSense revenue with GA4 events to see which tool flows correlate with higher monetization.

## 5. GA4 slot view events (implemented in code)

We now emit a lightweight GA4 event when ad containers become at least 25% visible in the viewport. Events are sent only when `gtag` is present on the page.

File: [`/js/ad-slot-view-tracking.js`](../js/ad-slot-view-tracking.js)

Covered slots:

- Stocking top & bottom (`ad-top-1`, `ad-bottom-1`)
- Params top & bottom (`ad-top-params`, `ad-bottom-params`)
- Gear top & bottom (`ad-top-gear`, `ad-bottom-gear`)
- Media bottom (`ad-media-bottom-1`)

Use the GA4 event `ad_slot_view` with the `label` parameter to inspect viewability context alongside AdSense revenue once the integration is active.
