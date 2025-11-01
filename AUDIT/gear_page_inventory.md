# Gear Page Inventory

## Top 10 Facts
- Gear content is rendered by `/assets/js/gear.v2.data.js`, which fetches 11 CSV datasets and a generated stands JSON to assemble heaters, filters, lights, air, substrate, treatments, food, maintenance, extras, and stands sections dynamically. (Source: assets/js/gear.v2.data.js L521-L608, L1874-L1910)
- The tank selector offers preset volumes and synchronizes highlights, accordion state, and session/query parameters through `/assets/js/gear.v2.js`. (Source: assets/js/gear.v2.js L12-L74, L2425-L2605)
- Category tips for every “i” button are defined as HTML strings in `TIPS` within `/assets/js/gear.v2.data.js`, including safety guidance for stands and extras. (Source: assets/js/gear.v2.data.js L87-L152)
- The page opens with a redesign banner reading “⚠️ Redesign Coming Soon — This page is being updated to match our new design style.” (Source: gear/index.html L184-L189)
- An affiliate disclosure (“As an Amazon Associate, we earn from qualifying purchases.”) appears immediately before the gear accordion grid. (Source: gear/index.html L211-L213)
- All product links generated for gear items use `rel="sponsored noopener noreferrer"`, ensuring affiliate metadata accompanies every Amazon URL. (Source: assets/js/gear.v2.js L930-L1001, L1834-L1904)
- JSON-LD for WebPage, BreadcrumbList, and ItemList identifies gear sections and publisher data for SEO. (Source: gear/index.html L13-L79)
- Navigation and footer markup are fetched and injected on load via `/js/nav.js?v=1.1.0` and `/js/footer-loader.js?v=1.4.9`, rather than being inlined. (Source: gear/index.html L146, L319; js/nav.js L223-L266; js/footer-loader.js L16-L28)
- Filter product ranges pull an additional catalog (`/assets/data/gearCatalog.json`) through `/js/gear-data.js`, storing results with caching logic. (Source: js/gear-data.js L1-L96)
- A CTA block directs readers to “Next Step: Cycle Your Tank” linking to `/params.html` for the Cycling Coach workflow. (Source: gear/index.html L302-L308)

## 1. Overview
- **Primary file:** `gear/index.html`
- **Related includes & partials:** navigation fetched from `/nav.html?v=1.1.0`; footer fetched from `/footer.html?v=1.4.9`; GA include `<!--#include virtual="/includes/ga4.html" -->`. (Sources: gear/index.html L146-L150; js/nav.js L223-L266; js/footer-loader.js L16-L28)
- **Data sources:** CSV files in `/data/` and JSON in `/assets/js/generated/gear-stands.json`. (Source: assets/js/gear.v2.data.js L521-L608)
- **External services:** Google AdSense, Cloudflare Web Analytics, Google Funding Choices CMP, Google Fonts preconnect, Amazon affiliate links. (Source: gear/index.html L96-L160)

## 2. Head & Metadata (verbatim)
- `<title>Fishkeeping Gear Guides — Match Equipment to Tank Size</title>` (Source: gear/index.html L6)
- `<meta name="description" content="Aquarium gear guides by The Tank Guide: easily choose heaters, filters, and lighting matched to your fish tank size. Get planted tank tips.">` (Source: gear/index.html L8-L11)
- `<link rel="canonical" href="https://thetankguide.com/gear/">` (Source: gear/index.html L12)
- WebPage JSON-LD describing publisher, site, and description. (Source: gear/index.html L13-L37)
- BreadcrumbList JSON-LD listing Home → Gear. (Source: gear/index.html L39-L55)
- ItemList JSON-LD enumerating eight gear sections. (Source: gear/index.html L59-L77)
- Open Graph and Twitter metadata covering title, description, URL, and preview image. (Source: gear/index.html L80-L95)
- No explicit `<meta name="robots">` tag—page inherits default indexing. (Source: gear/index.html L3-L160)

## 3. Heading Outline
1. **H1:** Fishkeeping Gear Guide (Source: gear/index.html L185)
2. **H2:** Tank Gear Guide (Source: gear/index.html L194)
3. **H3:** Tank Size (Source: gear/index.html L196)
4. **H2:** Heaters; Filters; Air & Aeration; Lights; Substrate & Aquascaping; Fertilizers; Water Treatments; Stands & Cabinets; Food; Maintenance & Tools (Source: gear/index.html L217-L298)
5. **H2:** Next Step: Cycle Your Tank (Source: gear/index.html L304)

## 4. Sections
### 4.1 Intro & Banner
- Intro paragraph: “A quick fishkeeping reference to match aquarium heaters, filters, lights, and maintenance tools to your tank setup.” (Source: gear/index.html L185-L186)
- Status banner: “⚠️ Redesign Coming Soon — This page is being updated to match our new design style.” (Source: gear/index.html L187-L189)

### 4.2 Tank Gear Guide Card
- `select#tank-size` placeholder option “Select a tank size…” with visually hidden label. (Source: gear/index.html L196-L205)
- `#gear-tank-meta` paragraph initially hidden for JS updates. (Source: gear/index.html L205-L206)

### 4.3 Affiliate Disclosure
- `<em>As an Amazon Associate, we earn from qualifying purchases.</em>` (Source: gear/index.html L211-L213)

### 4.4 Gear Categories & Tips
Each accordion header contains an info button referencing `TIPS` entries. Dialog bodies are injected at runtime. (Sources: gear/index.html L217-L298; assets/js/gear.v2.js L864-L912)

#### Tip Content
(See assets/js/gear.v2.data.js L87-L152 for exact HTML strings.)

#### Product Inventories
#### Heaters (data/gear_heaters.csv)
- **5–10 Gallons**
  - Hitop 50W Adjustable Aquarium Heater, Submersible Glass Water Heater for 5–15 Gallon Fish Tank (Source: data/gear_heaters.csv L2) — Link: https://amzn.to/3KFMlOx
  - hygger Mini Fish Tank Submersible Heater 50W for 5–10 Gallons Small Betta Aquarium Heater with Digital Display Controller Adjustable Temperature (Source: data/gear_heaters.csv L3) — Link: https://amzn.to/479AuRA
  - hygger Aquarium Heater, Upgraded Ceramic 50W Small Fish Tank Heater with Digital LED Controller, Fast Heating, Precise Temperature Control, Turtle Tank Heater for Freshwater/Saltwater (Source: data/gear_heaters.csv L4) — Link: https://amzn.to/3KBKiLp
- **10–20 Gallons**
  - Hitop 100w Adjustable Aquarium Heater, Submersible Glass Water Heater for 10 – 30 Gallon Fish Tank (Source: data/gear_heaters.csv L5) — Link: https://amzn.to/4nXCmT2
  - Fluval M 50-Watt Submersible Aquarium Heater – Compact, Reliable Heating with Mirror Technology for Fresh & Saltwater Tanks Up to 15 Gallons (Source: data/gear_heaters.csv L6) — Link: https://amzn.to/4pTvtnA
  - hygger Aquarium Heater, Submersible Fish Tank Heater 100W with Digital LED Controller, Memory Function, Auto Shut Off Protection, Heater for Saltwater Freshwater Fish Tank (Source: data/gear_heaters.csv L7) — Link: https://amzn.to/46DNSxo
- **20–40 Gallons**
  - Hitop 300W Aquarium Heater, Submersible Glass Water Heater 35–70 Gallon Fish Tank (Source: data/gear_heaters.csv L8) — Link: https://amzn.to/4n9U4lP
  - hygger 802 Aquarium Titanium Heater Tube Heating Element Replacement Heater Rod (Controller Excluded) (200W) (Source: data/gear_heaters.csv L9) — Link: https://amzn.to/42Zj6wn
  - hygger Aquarium Heater 200W, Submersible Fish Tank Heater with Digital LED Controller, Overheating & Auto Shut Off Protection, Betta Turtle Tank Heater, for Saltwater & Freshwater Fish Tank 20–55 Gallon (Source: data/gear_heaters.csv L10) — Link: https://amzn.to/4mORQry
- **40–55 Gallons**
  - Hitop 300W Aquarium Heater, Submersible Glass Water Heater (35–70 Gallon Fish Tank) (Source: data/gear_heaters.csv L11) — Link: https://amzn.to/46Qv3ps
  - hygger Aquarium Heater 300W, Fish Tank Heater with Digital LED Controller, Overheating & Auto Shut Off Protection, Memory Function, Submersible Fish Heater for Saltwater & Freshwater Fish Tank 25–80 Gallon (Source: data/gear_heaters.csv L12) — Link: https://amzn.to/4nF3vuv
  - AQQA Aquarium Heater 500W for 55–130 Gallon Fish Tank Heater Quartz Glass Submersible Betta Fish Heater for Aquarium Thermostat Heater with External Digital Controller (AQ136-500W for 55–130Gal) (Source: data/gear_heaters.csv L13) — Link: https://amzn.to/3WsfsHG
- **55–75 Gallons**
  - AQQA Aquarium Heater 500W for 55–130 Gallon Fish Tank Heater Quartz Glass Submersible Betta Fish Heater for Aquarium Thermostat Heater with External Digital Controller (AQ136-500W for 55–130Gal) (Source: data/gear_heaters.csv L14) — Link: https://amzn.to/42q5t9x
  - hygger Aquarium Heater with Intelligent Temperature Controller, 500W for 66–135 Gallon Submersible Fish Tank Heater with Leaving Water Automatically Stop Heating System, for Freshwater Saltwater (Source: data/gear_heaters.csv L15) — Link: https://amzn.to/479hliF
  - Fluval M 200-Watt Submersible Aquarium Heater – High-Performance, Compact Heating with Mirror Technology for Fresh & Saltwater Tanks (Source: data/gear_heaters.csv L16) — Link: https://amzn.to/4o4Z6Az
- **75–125 Gallons**
  - hygger 500W Aquarium Heater with Controller, Adjustable & Submersible Fish Tank Heater with Digital Display Safety Triple Protection Beeping Alarm for Saltwater and Freshwater 65–135 Gallon (Source: data/gear_heaters.csv L17) — Link: https://amzn.to/46ROYo5
  - hygger Aquarium Heater with Intelligent Temperature Controller, 500W for 66–135 Gallon Submersible Fish Tank Heater with Leaving Water Automatically Stop Heating System, for Freshwater Saltwater (Source: data/gear_heaters.csv L18) — Link: https://amzn.to/3KWN91y
  - AQQA Aquarium Heater 500W for 55–130 Gallon Fish Tank Heater Quartz Glass Submersible Betta Fish Heater for Aquarium Thermostat Heater with External Digital Controller (AQ136-500W for 55–130Gal) (Source: data/gear_heaters.csv L19) — Link: https://amzn.to/3WocVON

#### Filters (data/gear_filters_ranges.csv)
- **5–10 Gallons (Option 1)**
  - Pawfly Aquarium Nano Bio Sponge Filter Quiet Betta Fry Shrimp and Small Fish Foam Filter for Tiny Fish Tank up to 10 Gallon (Source: data/gear_filters_ranges.csv L2) — Link: https://amzn.to/3IXHtns
- **5–10 Gallons (Option 2)**
  - hygger Aquarium Double Sponge Filter, Comes with 2 Spare Sponges (S) (Source: data/gear_filters_ranges.csv L3) — Link: https://amzn.to/46Qxf0a
- **5–10 Gallons (Option 3)**
  - AC30 Power Filter, 10–30 US Gal / 38–114 L – Fluval USA (fluvalaquatics.com) (Source: data/gear_filters_ranges.csv L4) — Link: https://amzn.to/4pXb0hE
- **10–20 Gallons (Option 1)**
  - AC30 Power Filter, 10–30 US Gal / 38–114 L – Fluval USA (fluvalaquatics.com) (Source: data/gear_filters_ranges.csv L5) — Link: https://amzn.to/4n9MXK9
- **10–20 Gallons (Option 2)**
  - hygger Aquarium Double Sponge Filter for Fresh Water and Salt-Water Fish Tank (M) (Source: data/gear_filters_ranges.csv L6) — Link: https://amzn.to/3VTKSXo
- **10–20 Gallons (Option 3)**
  - AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Middle up to 20Gal) (Source: data/gear_filters_ranges.csv L7) — Link: https://amzn.to/4mTK28f
- **20–40 Gallons (Option 1)**
  - hygger Aquarium Double Sponge Filter for Fresh Water and Salt-Water Fish Tank (M) (Source: data/gear_filters_ranges.csv L8) — Link: https://amzn.to/46XUzsV
- **20–40 Gallons (Option 2)**
  - Seachem Tidal Power Aquarium Filter - 35 Gallon Large Fish Tank Filter, black (Source: data/gear_filters_ranges.csv L9) — Link: https://amzn.to/3IUy1RL
- **20–40 Gallons (Option 3)**
  - Fluval C2 Power Filter, Fish Tank Filter for Aquariums up to 30 Gal. (Source: data/gear_filters_ranges.csv L10) — Link: https://amzn.to/4mSXsRP
- **40–60 Gallons (Option 1)**
  - AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Large up to 60Gal) (Source: data/gear_filters_ranges.csv L11) — Link: https://amzn.to/3KTUjUi
- **40–60 Gallons (Option 2)**
  - SeaChem Large Aquarium Fish Tank Filter, Tidal 55 Gallon (200 Liters) by Sicce (Source: data/gear_filters_ranges.csv L12) — Link: https://amzn.to/3VRpXV0
- **40–60 Gallons (Option 3)**
  - AquaClear 70 Power Filter, Fish Tank Filter for 40- to 70-Gallon Aquariums, Black (Source: data/gear_filters_ranges.csv L13) — Link: https://amzn.to/3IVD0BO
- **60–90 Gallons (Option 1)**
  - Aqueon QuietFlow 75 LED PRO Aquarium Fish Tank Power Filter For Up To 90 Gallon Aquariums (Source: data/gear_filters_ranges.csv L14) — Link: https://amzn.to/48hBMeC
- **60–90 Gallons (Option 2)**
  - Fluval 407 Perfomance Canister Filter - for Aquariums Up to 100 Gallons - Aquarium Canister Filter (Source: data/gear_filters_ranges.csv L15) — Link: https://amzn.to/47bXnUA
- **60–90 Gallons (Option 3)**
  - Marineland Penguin Bio-Wheel Power Filter, Multi-Stage Aquarium Filtration (Source: data/gear_filters_ranges.csv L16) — Link: https://amzn.to/4h0gsMT
- **90–125 Gallons (Option 1)**
  - Fluval FX2 High Performance Canister Aquarium Filter - Multi-Stage Filtration, Built-in Powered Water Change System, and Basket-in-Basket Tray Design (Source: data/gear_filters_ranges.csv L17) — Link: https://amzn.to/48QPCEJ
- **90–125 Gallons (Option 2)**
  - Fluval 407 Perfomance Canister Filter - for Aquariums Up to 100 Gallons - Aquarium Canister Filter (Source: data/gear_filters_ranges.csv L18) — Link: https://amzn.to/3KBqqs4
- **90–125 Gallons (Option 3)**
  - SeaChem – Large Aquarium Fish Tank Filter, Tidal 110 Gallon (400 Liters) by Sicce (Source: data/gear_filters_ranges.csv L19) — Link: https://amzn.to/48gPNZP

#### Filters – Filter Media (data/gear_filters.csv)
- Seachem Purigen Organic Filtration Resin - Fresh and Saltwater 500 ml (116016308) — Chemical polishing resin; removes dissolved organics and clarifies water. (Source: data/gear_filters.csv L2) — Link: https://amzn.to/4o7x07V
- Seachem Matrix Bio Media 1 Liter — Porous biological media; high surface area for nitrifying bacteria. (Source: data/gear_filters.csv L3) — Link: https://amzn.to/435usiz
- Aquarium Filter Media Pad Cut to Fit Roll, 12" x 72" (6 ft) — Cut-to-fit mechanical floss; place first in flow path for debris trapping. (Source: data/gear_filters.csv L4) — Link: https://amzn.to/3IDHzAK
- Fluval BioMax Biological Material Remover, 500 g - Biological Filter Media for Aquariums — Sintered biomedia rings; stable home for beneficial bacteria. (Source: data/gear_filters.csv L5) — Link: https://amzn.to/48Ryajp
- Aquatic Experts Bio Balls Filter Media Bulk, 1.5 Inch (300 Count with 14" x 20" Mesh Bag) — Durable aerobic bio media; great oxygen exposure; rinse gently. (Source: data/gear_filters.csv L6) — Link: https://amzn.to/4o8Pipq
- Fluval Spec/Evo/Flex Activated Carbon, Replacement Aquarium Filter Media, 3-Pack, A1377, Black — Granular carbon packs; adsorb odors/tannins/meds (remove during medication). (Source: data/gear_filters.csv L7) — Link: https://amzn.to/430JHJA
- Big Kahuna Aquarium Filter Floss Rolls – 12-inch x 6 ft – 1-inch Thick Bonded Media — Thick mechanical polishing pad; cut-to-fit HOB/canister trays. (Source: data/gear_filters.csv L8) — Link: https://amzn.to/4o2R9vQ
- Penn-Plax Undergravel Aquarium Filter for 20 (Long) - 29 Gallon Tanks (Two 14" x 11.1" Plates) — Undergravel plate system (mechanical/biological base) — pair with powerhead or airlift. (Source: data/gear_filters.csv L9) — Link: https://amzn.to/435uUgL
- Aquarium Filter Pad - Media Roll 39.4 x 11.8 in (White) — Fine mechanical pad for polishing; replace as it clogs. (Source: data/gear_filters.csv L10) — Link: https://amzn.to/4h4N5sO
- Aquatic Experts Classic Bonded Aquarium Filter Pad - 24" x 12 ft x 0.75" (Blue/White) — Bonded mechanical pad; cut-to-fit; place before bio media. (Source: data/gear_filters.csv L11) — Link: https://amzn.to/3ICU7s5
- AQUANEAT Aquarium Bio Sponge Foam Filter Media Pad Cut-to-Fit (17" x 11" x 1/2"–1") — Reusable sponge sheets; primary mechanical stage; rinse in tank water. (Source: data/gear_filters.csv L12) — Link: https://amzn.to/46YC4Vc
- Geiserailie 15 Pieces Aquarium Filter Media Bags, 150 Micron, Zipper, 5.5" x 7.9" — Reusable media bags for carbon/resins/biomedia; secure fine media. (Source: data/gear_filters.csv L13) — Link: https://amzn.to/4mQHNCj

#### Lights (data/gear_lighting.csv)
- **l-12-20**
  - NICREW C10 Plants LED Aquarium Light, 12-18 in, 9 Watts, Full Spectrum Fish Tank Light with Timer, Day and Night Cycle, Brightness Adjustable (Source: data/gear_lighting.csv L2) — Link: https://amzn.to/4mP0Sow
  - hygger New Mode 24/7 Timer LED Aquarium Light, Auto On Off Full Spectrum Fish Tank Light Fish Colorful/Sun/Nightlight/WRGB Cycle Mode for Freshwater Plants Tank (for 12in~18in Long Tank) (Source: data/gear_lighting.csv L3) — Link: https://amzn.to/3VS4co0
  - hygger Fish Aquarium LED Light, 14W 24/7 Lighting Sunrise-Daylight-Moonlight Mode DIY, Adjustable Timer/Brightness with Extendable Bracket 7 Colors for Planted Tank (Source: data/gear_lighting.csv L4) — Link: https://amzn.to/4h3wUvY
- **l-20-24**
  - NICREW C10 Plants LED Aquarium Light, 18-24 in, 13 Watts, Full Spectrum Fish Tank Light with Timer, Day and Night Cycle, Brightness Adjustable (Source: data/gear_lighting.csv L5) — Link: https://amzn.to/3WpCKxX
  - hygger 14W Full Spectrum Aquarium Light with Aluminum Alloy Shell Extendable Brackets, White Blue Red LEDs, External Controller, for Freshwater Fish Tank (18-24 inch) (Source: data/gear_lighting.csv L6) — Link: https://amzn.to/3VRUYIs
  - hygger Auto On Off LED Aquarium Light 18-24 Inches Dimmable 7 Colors Full Spectrum Fish Tank Light Fixture for Freshwater Planted Tank Built-in Timer Sunrise Sunset (Source: data/gear_lighting.csv L7) — Link: https://amzn.to/4gWRH45
- **l-24-30**
  - hygger 16W Full Spectrum Aquarium Light with Aluminum Alloy Shell Extendable Brackets, White Blue Red LEDs, External Controller, for Freshwater Fish Tank (24-30 inch) (Source: data/gear_lighting.csv L8) — Link: https://amzn.to/42oWCVx
  - AQQA Aquarium Light, Multi-Function Fish Tank LED Light 24/7 DIY Auto On Off + Night Mode + Day Mode + Full Spectrum + 7 Colors, Adjustable Brightness Waterproof with Timer for Freshwater 24W (Source: data/gear_lighting.csv L9) — Link: https://amzn.to/4gU5ZlU
  - hygger Advanced Remote Control Aquarium Light Customizable Full Spectrum Fish Tank LED with DIY, Default & Weather Mode Freshwater Planted Tank (Source: data/gear_lighting.csv L10) — Link: https://amzn.to/4h3Ob8k
- **l-30-36**
  - hygger 20W Full Spectrum Aquarium Light with Aluminum Alloy Shell Extendable Brackets, White Blue Red LEDs, External Controller, for Freshwater Fish Tank (30-36 inch) (Source: data/gear_lighting.csv L11) — Link: https://amzn.to/3Wo63Rt
  - hygger 20W Full Spectrum Aquarium Light with Aluminum Alloy Shell Extendable Brackets, White Blue Red LEDs, External Controller, for Freshwater Fish Tank (30-36 inch) (Source: data/gear_lighting.csv L12) — Link: https://amzn.to/4q2HWWo
  - hygger Advanced Remote Control Aquarium Light Customizable Full Spectrum Fish Tank LED with DIY, Default & Weather Mode Freshwater Planted Tank (Source: data/gear_lighting.csv L13) — Link: https://amzn.to/46L2CZS
- **l-36-48**
  - hygger 36W 24/7 Lighting Aquarium LED Light, Sunrise-Daylight-Moonlight Mode and DIY Mode, Adjustable Timer Adjustable Brightness Fish Tank Light with Extendable Bracket 7 Colors for Planted Tank (Source: data/gear_lighting.csv L14) — Link: https://amzn.to/4nAAekl
  - AQQA Aquarium Light, Multi-Function Fish Tank LED Light 24/7 DIY Auto On Off + Night Mode + Day Mode + Full Spectrum + 7 Colors, Adjustable Brightness Waterproof with Timer for Freshwater 36W (Source: data/gear_lighting.csv L15) — Link: https://amzn.to/4mS1bz0
  - hygger Advanced Remote Control Aquarium Light Customizable Full Spectrum Fish Tank LED with DIY, Default & Weather Mode Freshwater Planted Tank (Source: data/gear_lighting.csv L16) — Link: https://amzn.to/3ISKOEg
- **l-48-up**
  - AQQA Aquarium Light, Multi-Function Fish Tank LED Light 24/7 DIY Auto On Off + Night Mode + Day Mode + Full Spectrum + 7 Colors, Adjustable Brightness Waterproof with Timer for Freshwater 44W (Source: data/gear_lighting.csv L17) — Link: https://amzn.to/3VVjRCW
  - hygger Sun Moon LED Aquarium Light, Full Spectrum Fish Tank Light Day-Night Dual Timer, Adjustable 6 Timer 10 Brightness 8 Colors for Planted Freshwater Tank (Source: data/gear_lighting.csv L18) — Link: https://amzn.to/4gWbLUp
  - hygger Auto On Off 48-55 Inch LED Aquarium Light Extendable Dimmable 7 Colors Full Spectrum Light Fixture for Freshwater Planted Tank Built-in Timer Sunrise Sunset (Source: data/gear_lighting.csv L19) — Link: https://amzn.to/4h1IbwH

#### Air & Aeration (data/gear_aeration.csv)
- **Air Pumps**
  - HITOP 4W 110GPH Powerful Aquarium Air Pump: Quiet 2-outlets Aquarium Aerator, Adjustable Fish Tank Air Pump with Accessories, for 20-200 Gallon Tank — Dual-outlet air pump for medium-to-large tanks; adjustable output for sponge filters or air stones. (Source: data/gear_aeration.csv L2) — Link: https://amzn.to/42vZsbh
  - hygger Aquarium Air Pump, Ultra Quiet Oxygen Aerator with Air Stone Airline Tubing Check Valve, Aquarium Fish Tank Air Bubbler for 3 to 79 Gallon Tank and Bucket — Compact, near-silent pump; includes airline and air stone for small-to-mid tanks. (Source: data/gear_aeration.csv L3) — Link: https://amzn.to/4h2AW7B
  - hygger Aquarium Air Pump, Quiet Adjustable Fish Tank Air Pump, 4W/7W/11W Powerful Oxygen Aerator Dual Stainless Steel Outlets with Air Stone Bubbler for Small Medium Large Fish Tank, Hydroponic — Adjustable output with dual stainless outlets; suitable across a wide tank size range. (Source: data/gear_aeration.csv L4) — Link: https://amzn.to/4q0N25a
- **Airline Accessories**
  - AQUANEAT Aquarium Check Valve, One Way Non Return Valve for Air Pump, Fit for 3/16 Inch Airline Tubing, Fish Tank Accessories, 10pcs (Red) — Prevents back-siphon; use one per airline below tank water level. (Source: data/gear_aeration.csv L5) — Link: https://amzn.to/42wLPZs
  - Aquarium Air Valve, 10 Pcs Aquarium Air Pump Control Valves T Shaped Single Way Plastic Air Flow Control Regulator Aquarium Air Pump Accessories for Fish Tank 3/16" ID Tubing (Black) — Fine-tune airflow to multiple devices; easy inline install. (Source: data/gear_aeration.csv L6) — Link: https://amzn.to/46F8DIW
  - ALEGI Aquarium Air Pump Accessories Set 25 Feet Airline Tubing with 6 Check Valves, 6 Control Valve and 40 Connectors for Fish Tank White — Complete airline kit for custom multi-line air systems. (Source: data/gear_aeration.csv L7) — Link: https://amzn.to/48S7HlO

#### Substrate & Aquascaping (data/gear_substrate.csv)
- **Base Layers & Soil**
  - Fluval 12695 Plant and Shrimp Stratum for Freshwater Fish Tanks, 17.6 lbs – Aquarium Substrate for Strong Plant Growth — Porous volcanic granules that buffer slightly acidic; ideal for shrimp and rooted stems. (Material: Volcanic soil; Color: Black) (Source: data/gear_substrate.csv L2) — Link: https://amzn.to/4gXDMuF
  - Fluval 12698 Natural Mineral-Rich Volcanic Soil Bio Stratum for Planted Tanks, 17.6 lbs — Fine-grain stratum that boosts nitrifying bacteria and gentle water chemistry. (Material: Volcanic soil; Color: Dark Brown) (Source: data/gear_substrate.csv L3) — Link: https://amzn.to/3WtUCHW
  - Seachem Flourite Black Clay Gravel - Stable Porous Natural Planted Aquarium Substrate 15.4 lbs — High-CEC clay granules; rinse thoroughly before use; cap with sand if desired. (Material: Porous clay; Color: Black) (Source: data/gear_substrate.csv L4) — Link: https://amzn.to/4mVTEiK
  - Flourite, 7 kg / 15.4 lbs — Neutral clay base layer that resists breaking down; great for root-feeding species. (Material: Porous clay; Color: Deep Red) (Source: data/gear_substrate.csv L5) — Link: https://amzn.to/48SfvUL
  - API Root Tabs Aquarium Fertilizer 30-Count — Slow-release nutrient tabs to recharge planted substrates every 3–4 months. (Material: Nutrient tabs; Color: Brown) (Source: data/gear_substrate.csv L6) — Link: https://www.amazon.com/dp/B003SNDNQ6/?tag=fishkeepingli-20
- **Gravel & Sand**
  - Carib Sea ACS05820 Super Natural Moonlight Sand for Aquarium, 5-Pound — Pre-rinsed soft sand that stays in place for corydoras and loaches. (Material: Silica sand; Color: White) (Source: data/gear_substrate.csv L7) — Link: https://amzn.to/3IxxGVd
  - Aqua Natural Diamond Black 10lb, Premium Gravel and Substrate for Aquariums, Fish Tanks and Terrariums, 1-2mm — Deep black gravel for striking contrast; rinse until water runs clear. (Material: Quartz gravel; Color: Black) (Source: data/gear_substrate.csv L8) — Link: https://amzn.to/3IJ16jd
  - 20LB Decorative River Rocks Gravel - 2/5\ Mixed Color Gravel for Vase Filling — Flower Pot Paving. Gravel for Garden Decoration (Material: Aquarium Aquascape Gravel; Color: Fish Tanks Gravel (8-12MM)") (Source: data/gear_substrate.csv L9) — Link: Landscaping
  - 10LB Mixed Stones Pebbles River Rocks, Natural Beach Pebbles, 0.5–1 Inch Decorative River Rocks for Landscaping Garden Paving Plant Rocks Crafting Walkways and Outdoor Decorative Stone — Natural 0.5–1 in. mixed river pebbles; great for decorative top layer, scape accents, and hardscape contrast. (Material: River rock; Color: Mixed) (Source: data/gear_substrate.csv L10) — Link: https://amzn.to/46WKOLx
  - CaribSea Arag-Alive Fiji Pink Sand, 20 lb — Live aragonite sand that buffers pH slightly—ideal for brackish or marine aquascapes. (Material: Aragonite sand; Color: Pink) (Source: data/gear_substrate.csv L11) — Link: https://www.amazon.com/dp/B00025698M/?tag=fishkeepingli-20
- **Rock & Hardscape**
  - Dragon Stone (Ohko) – Assorted Sizes — Light, porous clay-stone; easy to carve into terraces—rinse thoroughly. (Material: Clay stone; Color: Tan) (Source: data/gear_substrate.csv L12) — Link: https://www.amazon.com/dp/B07HFHKD8V/?tag=fishkeepingli-20
  - Seiryu Stone Natural Stone Rocks Fish Tank Decor Rocks for Aquariums Landscaping Model Tank Decoration Aquarium Miniature -20Lb (2-8 inch) — Iconic ridged texture; may raise KH/GH slightly—test if keeping soft-water species. (Material: Limestone mix; Color: Gray) (Source: data/gear_substrate.csv L13) — Link: https://amzn.to/46HWDGK
  - Natural Rock Stone 10LB Fish Tank Rock for Aquarium Landscaping Models Fish Tank Decoration, Freshwater Planted Aquariums and Amphibian enclosures-2-6 inches — Varied shapes for building structure; rinse to remove dust before aquascaping. (Material: Natural stone; Color: Mixed) (Source: data/gear_substrate.csv L14) — Link: https://amzn.to/42YxBAI
  - Lava Rocks for Aquarium, 10 lbs — Porous volcanic rock anchors epiphytes and boosts surface area for bacteria. (Material: Lava rock; Color: Charcoal) (Source: data/gear_substrate.csv L15) — Link: https://www.amazon.com/dp/B07MDVG3P2/?tag=fishkeepingli-20
- **Wood & Driftwood**
  - Spiderwood (Root Form) – Assorted Sizes — Branching wood; pre-soak and weigh down until waterlogged. (Material: Softwood; Color: Tan) (Source: data/gear_substrate.csv L16) — Link: https://www.amazon.com/dp/B00GH7YDBQ/?tag=fishkeepingli-20
  - Mopani Driftwood – Natural — Dense hardwood sinks quickly; releases tannins that tint water amber. (Material: Hardwood; Color: Brown) (Source: data/gear_substrate.csv L17) — Link: https://www.amazon.com/dp/B0002DJ9WW/?tag=fishkeepingli-20
  - Hamiledyi 12Pcs Small Driftwood for Aquarium 4.1\-7.2\" Driftwood Branches Aquarium Wood Decoration Natural Fish Tank Habitat Decor Wood for Lizard Assorted Size" — Small branches for nano aquascapes; boil to reduce tannins and prevent float. (Material: Hardwood; Color: Tan) (Source: data/gear_substrate.csv L18) — Link: https://amzn.to/4h0jGzK
  - majoywoo Natural Small Driftwood for Aquarium Decor Reptile Decor, Assorted Driftwood Branch 2-4.5\ 10 Pcs — Fish Tank Decorations" (Material: https://amzn.to/4h3maOb; Color: Hardwood) (Source: data/gear_substrate.csv L19) — Link: Curated mini driftwood pieces; ideal for accenting carpets and moss mounds.

#### Fertilizers (data/gear_treatments.csv)
- API ROOT TABS Freshwater Aquarium Plant Fertilizer 0.4-Ounce 10-Count Box — Slow-release nutrient tabs to recharge root-heavy plants every few months. (Source: data/gear_treatments.csv L2) — Link: https://amzn.to/48ECCCn
- ThriveCaps | Aquarium Root Fertilizer Tabs Caps 60 Count — Nutrient-rich capsules that boost substrate fertility for heavy root feeders. (Source: data/gear_treatments.csv L3) — Link: https://amzn.to/4h1RoF2
- Seachem Flourish Excel 500 ml — Liquid carbon supplement to enhance plant growth; dose carefully with sensitive species. (Source: data/gear_treatments.csv L4) — Link: https://amzn.to/48gdh1g
- 2HR Aquarist All-in-one Aquarium Plant Fertilizers APT 3 / Complete (600ml) — All-in-one dosing for medium–high light planted tanks; macro + micro nutrients. (Source: data/gear_treatments.csv L5) — Link: https://amzn.to/46YTXmT
- Thrive S Shrimp Specific All in One Aquarium Fertilizer – 500ml Liquid Plant Food – Comprehensive nutrients – Aquarium Nutrition – Convenient to Use – Concentrated Aquarium Plant Fertilizer — Formulated for shrimp tanks; plant nutrients with lower copper content. (Source: data/gear_treatments.csv L6) — Link: https://amzn.to/4mSnO6o
- Seachem Flourish Freshwater Plant Supplement 500 ml — Trace-focused supplement for overall plant health; pairs with macros if needed. (Source: data/gear_treatments.csv L7) — Link: https://amzn.to/4pZWiXf
- Thrive+ All in One Liquid Aquarium Plant Fertilizer – 500ml Highly Concentrated Aquatic Plant Fertilizer Solution – Nutrient-Rich Aquarium Plant Food – Convenient Usage – Effective Results — Concentrated all-in-one fertilizer; suitable for most planted setups. (Source: data/gear_treatments.csv L8) — Link: https://amzn.to/3J0LcRd

#### Water Treatments (data/gear_water_food_tools.csv)
- Seachem 437 Prime Fresh and Saltwater Conditioner – Chemical Remover and Detoxifier 1 L — Highly concentrated dechlorinator that binds chlorine, chloramine, and ammonia in seconds. (Source: data/gear_water_food_tools.csv L2) — Link: https://amzn.to/4h8EfKz
- Seachem Stability Fish Tank Stabilizer – For Freshwater and Marine Aquariums, 16.9 Fl Oz (Pack of 1) — Robust nitrifying bacteria culture that quickly establishes and supports biofilters. (Source: data/gear_water_food_tools.csv L3) — Link: https://amzn.to/4gYNUDf
- API TAP WATER CONDITIONER Aquarium Water Conditioner 16-Ounce Bottle — Instantly detoxifies tap water while protecting beneficial bacteria and slime coats. (Source: data/gear_water_food_tools.csv L4) — Link: https://amzn.to/48d12T7
- Tetra AquaSafe Plus – Aquarium Water Conditioner and Dechlorinator, 33.8 Ounces — Neutralizes chlorine, chloramine, and heavy metals with added vitamins for stress relief. (Source: data/gear_water_food_tools.csv L5) — Link: https://amzn.to/4q3itMw

#### Food (data/gear_food.csv)
- **Staples (Daily)**
  - Tetra TetraMin Plus Tropical Flakes 2.2 Ounces, Nutritionally Balanced Fish Food With Added Shrimp — Classic daily staple flake; easy for community tanks. (Source: data/gear_food.csv L2) — Link: https://amzn.to/4o5Ulqx
  - Fluval Bug Bites Tropical Fish Food, Small Granules for Small to Medium Sized Fish, 1.6 oz., A6577 — Protein from black soldier fly larvae; slow-sinking granules. (Source: data/gear_food.csv L3) — Link: https://amzn.to/3KBeZAt
  - Hikari Tropical Semi-Floating Micro Pellets Fish Food, 0.77 oz (22 g) — Micro pellets for small community fish; semi-floating for mid-column feeding. (Source: data/gear_food.csv L4) — Link: https://amzn.to/46MbkXO
  - New Life Spectrum Thera A Regular 80 g (Naturox Series) — Balanced daily pellet with garlic; good palatability and color support. (Source: data/gear_food.csv L5) — Link: https://amzn.to/4h4JJ9k
  - TetraColor PLUS Tropical Flakes with Color Enhancing 2.2 oz — Color-boosting flake; use alongside a staple for variety. (Source: data/gear_food.csv L11) — Link: https://amzn.to/3WnK90O
- **Bottom Feeders & Algae**
  - Hikari Tropical Sinking Wafers for Catfish, Loaches and Bottom Feeders 3.88 oz — Dense wafers for Corydoras, loaches; holds shape on substrate. (Source: data/gear_food.csv L6) — Link: https://amzn.to/3IZ8gQj
  - Hikari USA AHK21328 Tropical Algae Wafer 8.8 oz — Algae-based wafers for plecos and herbivores; stable in water. (Source: data/gear_food.csv L7) — Link: https://amzn.to/4mUNdwq
- **High-Protein Treats**
  - Hikari Bio-Pure Freeze Dried Blood Worms, 0.42 oz — Occasional protein-rich treat; rehydrate before feeding for safety. (Source: data/gear_food.csv L8) — Link: https://amzn.to/4nJmKD6
  - Hikari Bio-Pure Freeze Dried Brine Shrimp, 0.42 oz — High-protein, enticing treat; rotate with staple foods. (Source: data/gear_food.csv L9) — Link: https://amzn.to/4pZsn1q
  - Hikari Tropical Shrimp Cuisine Fish Food, 0.35 oz (10 g) — Micro pellet designed for dwarf shrimp; supplement minerals separately. (Source: data/gear_food.csv L10) — Link: https://amzn.to/46FoPtF

#### Maintenance & Tools (data/gear_water_food_tools.csv & data/gear_maintenance.csv)
- **Air & Aeration**
  - AQUANEAT Aquarium Check Valve, One Way Non Return Valve for Air Pump, Fit for 3/16 Inch Airline Tubing, Fish Tank Accessories, 10pcs (Red) — Prevents water backflow; use one per airline below tank water level. (Source: data/gear_maintenance.csv L5) — Link: https://amzn.to/42wLPZs
  - Aquarium Air Valve, 10 Pcs Aquarium Air Pump Control Valves T Shaped Single Way Plastic Air Flow Control Regulator Aquarium Air Pump Accessories for Fish Tank 3/16" ID Tubing (Black) — Fine-tune airflow to multiple devices; easy inline installation. (Source: data/gear_maintenance.csv L6) — Link: https://amzn.to/46F8DIW
  - ALEGI Aquarium Air Pump Accessories Set 25 Feet Airline Tubing with 6 Check Valves, 6 Control Valve and 40 Connectors for Fish Tank White — Complete airline accessory kit for custom multi-line air systems. (Source: data/gear_maintenance.csv L7) — Link: https://amzn.to/48S7HlO
  - Nano CO₂ Diffuser Glass Reactor for Aquarium Planted Tank — Small in-tank glass diffuser; fine mist for nano setups—place under gentle flow. (Source: data/gear_maintenance.csv L30) — Link: https://amzn.to/47cpN0G
  - CO₂ Diffuser Glass Reactor with U Shape Connecting Tube for Pollen Aquarium Plants Tank (Large Flat-Bottomed) — Larger in-tank diffuser with U-tube routing over rim; stable base for mid-size tanks. (Source: data/gear_maintenance.csv L31) — Link: https://amzn.to/46JZkrm
  - Fzone Neo CO₂ Diffuser with Customized Ceramic from South Korea (L-24mm) — High-efficiency micro-bubble ceramic; minimalist profile; position low under outflow. (Source: data/gear_maintenance.csv L32) — Link: https://amzn.to/46GvELD
  - Pawfly 16 ft. Aquarium CO₂-Proof Tubing, Standard 3/16" Airline — CO₂-rated PU tubing resists leaks; includes suction cups/connectors for clean routing. (Source: data/gear_maintenance.csv L33) — Link: https://amzn.to/4h0pkBW
  - Pawfly Glass CO₂ Drop Checker (with Solution) — Visual CO₂ indicator for dialing in bubble rate; place where flow is moderate. (Source: data/gear_maintenance.csv L34) — Link: https://amzn.to/48SDa7u
- **Aquascaping Tools**
  - Aquarium Aquascape Tools Kit, 4 in 1 Anti-Rust Aquatic Plant Aquascaping Tool Stainless Steel Black Tweezers Scissors Spatula for Aquarium Tank Clean Fish Tank Aquascape Accessories Set — Core trimming/planting set: tweezers, scissors, spatula for routine scaping and substrate leveling. (Source: data/gear_maintenance.csv L28) — Link: https://amzn.to/48lZ6aW
  - Aquarium Aquascape Tools Kit, Long 15 Inch Stainless Steel Aquatic Plants Tools, 4 in 1 Anti-Rust Black Aquascaping Tweezers Scissors Spatula Scrapers Tool Set for Fish Tank Cleaning Plant Trimming — Extra-long reach for deeper tanks; improves control while trimming and planting. (Source: data/gear_maintenance.csv L29) — Link: https://amzn.to/475FPZg
- **Cleanup & Extras**
  - Bounty Quick-Size Paper Towels, White, 12 Family Triple Rolls = 40 Regular Rolls — Durable, absorbent paper towels for quick cleanups around the tank. (Source: data/gear_maintenance.csv L8) — Link: https://amzn.to/3VRQh1h
  - Amazon Basics 2-Ply Soft Toilet Paper, 30 Rolls (5 Packs of 6), Equivalent to 185 Regular Rolls, Packaging May Vary — Useful during maintenance; keep a roll near your setup. (Source: data/gear_maintenance.csv L9) — Link: https://amzn.to/3IAe4jj
  - Gorilla Super Glue Gel XL, Clear Glue, 25 Gram (Pack of 2) - All Purpose and Fast Setting for Projects and Repairs — Handy for quick décor or equipment fixes (use outside water contact points). (Source: data/gear_maintenance.csv L10) — Link: https://amzn.to/4q1j8hj
  - ARM & HAMMER Baking Soda Made in USA, Ideal for Baking, Pure & Natural, 2.7lb Bag — Gentle cleaning and odor control; non-abrasive. (Source: data/gear_maintenance.csv L11) — Link: https://amzn.to/4haFwRl
  - Iberia All Natural Distilled White Vinegar, 1 Gallon - 5% Acidity — Mix with distilled water for exterior glass cleaning. (Source: data/gear_maintenance.csv L12) — Link: https://amzn.to/42wJIF0
  - USANOOKS Microfiber Cleaning Cloth Grey - 12 Pcs (12.5"x12.5") - High Performance - 1200 Washes, Ultra Absorbent Microfiber Towel Weave — Streak-free wipes for glass and stands; low lint. (Source: data/gear_maintenance.csv L13) — Link: https://amzn.to/46YMaWb
  - Pack Microfiber Glass Cleaning Cloth, 16 Inch X 16 Inch, Lint Free Quickly Clean Window, Glasses, Windshields, Mirrors, and Stainless Steel, Blue — Extra glass cloths for polish passes. (Source: data/gear_maintenance.csv L14) — Link: https://amzn.to/4n4UtWE
  - JohnBee Empty Spray Bottles (16oz/2Pack) - Adjustable Spray Bottles for Cleaning Solutions - No Leak and Clog - HDPE spray bottle — Label one for distilled water + vinegar mix. (Source: data/gear_maintenance.csv L15) — Link: https://amzn.to/3VXVqEW
  - Sharpie Permanent Markers Set Quick Drying And Fade Resistant Fine Point Marker For Wood Plastic Paper Metal And More Drawing Coloring And Poster Marker Black 12 Count — Label cords, bins, and dosing containers. (Source: data/gear_maintenance.csv L16) — Link: https://amzn.to/3VWKh7n
  - United Solutions 5-Gallon Heavy-Duty Buckets with Snap-On Lids, 6-Pack – BPA-Free, Food-Grade Plastic, Multi-Purpose Storage – White — Keep dedicated aquarium-only buckets (no cross-use). (Source: data/gear_maintenance.csv L17) — Link: https://amzn.to/4mWhPh4
  - 16/3 25 FT Outdoor Extension Cord Waterproof, Weatherproof & Flame Retardant Black 3 Prong Power Cord Outside — Use drip loops and avoid tripping hazards; ETL listed. (Source: data/gear_maintenance.csv L18) — Link: https://amzn.to/4gVDkNm
  - Long Straw Brush, Nylon Pipe Tube Cleaner 8.2-ihch 10 Different Diameters Set of 10 — Cleans tubing, air lines, and small parts. (Source: data/gear_maintenance.csv L19) — Link: https://amzn.to/4gWOJfQ
  - IRIS USA 20-Pack Storage Bins with Lids, 6 Quart, Shoe Boxes Clear Stackable Containers — Organize tools, foods, and spare parts. (Source: data/gear_maintenance.csv L20) — Link: https://amzn.to/48S6tac
  - North Mountain Supply 8 Ounce Glass Regular Mouth Tapered Mason Canning Jars - with Safety Button Lids - Case of 6 (Black Metal Lids) — Store foods or dosing mixes; label clearly. (Source: data/gear_maintenance.csv L21) — Link: https://amzn.to/4ocwW6V
  - SKYLA HOMES Baby Locks (8-Pack) Child Safety Cabinet Proofing - 3M Adhesive Cabinet Drawer Door Latches — Secure cabinets with chemicals or tools. (Source: data/gear_maintenance.csv L22) — Link: https://amzn.to/4nO5kFC
  - Safety 1st Electrical Outlet Baby Proof Covers, Secure Outlet Plugs, Baby Proofing, 36 Count — Cover unused outlets near splash zones. (Source: data/gear_maintenance.csv L23) — Link: https://amzn.to/3IOxfG4
  - Aqueon Silicone Aquarium Sealant, Clear, 10.3 oz Cartridge — Aquarium-safe 100% silicone for resealing tanks, attaching baffles, or DIY glass projects. (Source: data/gear_maintenance.csv L24) — Link: https://amzn.to/3ID2C6s
  - Aqueon Silicone Sealant Clear 3 Ounces (Pack of 2) — Aquarium-safe 100% silicone in small tubes for spot fixes and minor reseals. (Source: data/gear_maintenance.csv L26) — Link: https://amzn.to/3Ky4jTn
  - Clear Aquarium Silicone Sealant - 10.2 Fluid oz Cartridge — 100% aquarium-safe silicone; cartridge format for larger reseals or sump/baffle installs. (Source: data/gear_maintenance.csv L27) — Link: https://amzn.to/4319YYc
- **Nets & Handling**
  - Pawfly Aquarium Fish Net with Braided Metal Handle Square Net with Soft Fine Mesh Sludge Food Residue Wastes Skimming Cleaning Net for Fish Tanks Small Koi Ponds and Pools — Fine mesh with metal handle; ideal for gently catching fish or removing debris. (Source: data/gear_maintenance.csv L25) — Link: https://amzn.to/4nGN3tN
- **Safety & Power**
  - Power Strip, ALESTOR Surge Protector with 12 Outlets and 4 USB Ports, 6 Feet Extension Cord (1875W/15A), 2700 Joules, ETL Listed, Black — High-capacity surge protector keeps multiple aquarium devices powered while taming cord clutter. (Source: data/gear_water_food_tools.csv L15) — Link: https://amzn.to/3J22Ynb
  - meross Smart Plug Power Strip, WiFi Flat Outlet 15A Compatible with Apple HomeKit, Siri, Alexa, Google Assistant & SmartThings, with 4 AC Outlets & 4 USB Ports, 6 Feet Surge Protector Extender — App-connected strip adds remote control and scheduling plus built-in surge protection for core gear. (Source: data/gear_water_food_tools.csv L16) — Link: https://amzn.to/437noBU
  - Meross Smart Water Sensor Alarm 3 Pack, WiFi Water Leak Detector Support Apple HomeKit, SmartThings, IP67 Waterproof with App Alerts, Alarm, 100M Range for Home Basement Kitchen (Meross Hub Included) — Linked leak sensors send instant alerts so you can shut off equipment before water reaches outlets. (Source: data/gear_water_food_tools.csv L17) — Link: https://amzn.to/42sP4ky
  - Linkind Matter Smart Plug, Works with Apple Home, Siri, Alexa, Google, SmartThings, Smart Outlet 15A/1800W Max, Smart Home Automation, App Remote Control, Timer & Schedule, 2.4G Wi-Fi Only (4 Pack) — Matter-ready smart plugs label critical gear and enable quick shutoffs without unplugging cords. (Source: data/gear_water_food_tools.csv L18) — Link: https://amzn.to/3KDGMQT
- **Testing & Monitoring**
  - VIVOSUN Digital pH and TDS Meter Kits, 0.01 pH High Accuracy Pen Type pH Meter ±2% Readout Accuracy 3-in-1 TDS EC Temperature Meter for Hydroponics, Pool, and Aquarium, Yellow Blue, UL Certified — Dual meters read pH, EC, TDS, and temperature so you can catch swings before livestock feel stress. (Source: data/gear_water_food_tools.csv L6) — Link: https://amzn.to/46F70el
  - API FRESHWATER MASTER TEST KIT 800-Test Freshwater Aquarium Water Master Test Kit, White, Single, Multi-colored — Liquid ammonia, nitrite, nitrate, and pH tests deliver precise water chemistry tracking for weekly logs. (Source: data/gear_water_food_tools.csv L7) — Link: https://amzn.to/3KDF7L9
  - Inkbird ITC-306A WiFi Temperature Controller, Wi-Fi Aquarium Thermostat Heater Controller 120V~1200W Temperature Control with Two Probes only for Heater Aquarium Breeding Reptiles Hatching. — Add a fail-safe: cuts power to the heater on overheat; Wi-Fi alerts for peace of mind. (Source: data/gear_maintenance.csv L2) — Link: https://amzn.to/46QJSd3
  - JW Aquarium SmartTemp Thermometer — Simple glass thermometer with suction mount; reliable and easy to read. (Source: data/gear_maintenance.csv L3) — Link: https://amzn.to/42uddHB
  - 2-Pack Aquarium Thermometer, Fish Tank Thermometer, AikTryee Water Thermometer with 3.3ft Cord Fahrenheit/Celsius(℉/℃) for Vehicle Reptile Terrarium Fish Tank Refrigerator. — Digital probe thermometer for precise temperature readings; dual Fahrenheit/Celsius display. (Source: data/gear_maintenance.csv L4) — Link: https://amzn.to/4gYFCLX
- **Water Change & Cleaning**
  - Tetra Water Cleaner Gravel Siphon for Aquariums, Easily Clean Freshwater Aquariums — Starter siphon removes waste from substrate while keeping fish safe with a debris guard and priming bulb. (Source: data/gear_water_food_tools.csv L8) — Link: https://amzn.to/4pPCA0m
  - Gravel Vacuum for Aquarium Water Changer Fish Tank Cleaning Tools, Siphon Universal Quick Pump Aquarium Water Changing (50 ft) — 50-foot hose reaches sinks with ease so you can drain and refill without lugging heavy buckets. (Source: data/gear_water_food_tools.csv L9) — Link: https://amzn.to/4nEtZw1
  - Aquarium Coral Feeder Fish Feeder Waste Clean Tool Manual Cleaner Water Changer Fish Tank Cleaning Tool Siphon Dropper Waste Remover Aquatic Bottom Pipette (25 in) — Target-feed corals or spot-clean debris in tight spaces using this precise squeeze dropper. (Source: data/gear_water_food_tools.csv L10) — Link: https://amzn.to/3KCBLYK
  - Flipper Magnetic Aquarium Glass Cleaner & Fish Tank Accessories | Effortless Algae Remover for Fish Tank (Nano) — Compact magnetic cleaner glides around corners on nano tanks without scratching glass. (Source: data/gear_water_food_tools.csv L11) — Link: https://amzn.to/3KXWUMZ
  - Flipper Magnetic Aquarium Glass Cleaner & Fish Tank Accessories | Effortless Algae Remover for Fish Tank (Standard) — Standard Flipper handles thicker glass on mid-sized tanks and flips between scrubber and blade instantly. (Source: data/gear_water_food_tools.csv L12) — Link: https://amzn.to/46Ml1Wc
  - 25" Glass Aquariums Algae Scraper – Durable Stainless Steel, Powerfully Remove Stubborn Algae, Professional Fish Tank Cleaner Tools, Includes Sheath, Long Tweezers & 10 Replaceable Blades — Stainless handle with replaceable blades powers through stubborn algae on tall panels. (Source: data/gear_water_food_tools.csv L13) — Link: https://amzn.to/4nySNFL
  - API ALGAE SCRAPER For Glass Aquariums 1-Count Container — Handheld scraper keeps front glass clear between deep cleans and tucks easily into a maintenance kit. (Source: data/gear_water_food_tools.csv L14) — Link: https://amzn.to/3Wqbmjr

#### Extras (data/gear_extras.csv)
- Microfiber Towels (Pack) — Lint-free; great for glass and general cleanup. (Source: data/gear_extras.csv L2)
- Paper Towels (Bulk) — Keep a roll near your tank for quick drips. (Source: data/gear_extras.csv L3)
- Reusable Spray Bottles (2-Pack) — Label one for distilled water + vinegar mix. (Source: data/gear_extras.csv L4)
- Distilled Water (1 Gal) — Use with vinegar for exterior glass cleaning. (Source: data/gear_extras.csv L5)
- Nitrile/Neoprene Gloves — Dedicated set for tank maintenance only. (Source: data/gear_extras.csv L6)
- 5-Gallon Bucket (Dedicated) — Do not repurpose; keep for aquarium use only. (Source: data/gear_extras.csv L7)
- Cable Ties / Velcro Straps — Tidy cords; add drip loops for safety. (Source: data/gear_extras.csv L8)
- Shop Towels / Rags — Absorbent option for bigger spills. (Source: data/gear_extras.csv L9)
- Small Parts Organizer — Store spare media, o-rings, test kit bits. (Source: data/gear_extras.csv L10)
- Silicone Mat / Tray — Set damp tools on this to protect surfaces. (Source: data/gear_extras.csv L11)

#### Stands & Cabinets (assets/js/generated/gear-stands.json)
- **5-10**
  - Snughome 10 Gallon Aquarium Stand with Storage (3-Tier, 20.47″ × 11.42″ × 30.91″) — Open-frame metal stand with storage; fits standard 10-gal footprint. (Material: Metal/Wood; Dimensions: 20.47×11.42×30.91) (Source: assets/js/generated/gear-stands.json L12) — Link: https://amzn.to/4q0RyAQ?tag=fishkeepingli-20
- **10-20**
  - 20 Gallon Heavy-Duty Metal Aquarium Stand (24.8″ × 13″ × 30″) — Compact welded-steel frame; fits standard 20-long tanks. (Material: Metal; Dimensions: 24.80×13×30) (Source: assets/js/generated/gear-stands.json L38) — Link: https://amzn.to/4pZswSt?tag=fishkeepingli-20
- **20-40**
  - YITAHOME 30″ Metal Aquarium Stand with Power Outlet — Built-in outlet, hooks, and adjustable shelves for flexible storage. (Material: Metal/Wood; Dimensions: 30×16×31.50) (Source: assets/js/generated/gear-stands.json L64) — Link: https://amzn.to/4nOZOSX?tag=fishkeepingli-20
  - Heavy-Duty 40 Gallon Metal Aquarium Stand — Heavy-duty frame sized for standard 36-inch tanks; great for 29–40 gallons. (Material: Metal; Dimensions: 36.50×18.50×29.50) (Source: assets/js/generated/gear-stands.json L90) — Link: https://amzn.to/3Wp9JT5?tag=fishkeepingli-20
  - GRLEAF 20–40 Gallon Aquarium Stand with Power Outlet — Steel and wood hybrid construction with deep storage shelves and outlet. (Material: Steel/Wood) (Source: assets/js/generated/gear-stands.json L116) — Link: https://amzn.to/437Cmb4?tag=fishkeepingli-20
- **40-55**
  - YITAHOME 40–50 Gallon Fish Tank Stand with Power Outlet, 40x18 Inch Metal Aquarium Stand with 3-Tier Adjustable Storage Shelves and Hooks, 700LBS Capacity, Black (Material: Metal) (Source: assets/js/generated/gear-stands.json L142) — Link: https://amzn.to/43a8nzk
  - Reinforced 40–50 Gallon Aquarium Stand with Power Outlet | Ultra-Stable 750LBS Capacity Metal Fish Tank Stand for Reptile/Aquatic Setups, 5-Tier Adjustable 37"x19" Steel Shelving System (Material: Metal) (Source: assets/js/generated/gear-stands.json L168) — Link: https://amzn.to/48OF35a
  - 40–50 Gallon Fish Tank Stand, Aquarium Stand with Cabinet Accessories Storage, Heavy Duty Metal Frame, 40.55" L × 18.89" W Tabletop, 850 LBS Capacity, Black PG02YGB (Material: Metal/Wood) (Source: assets/js/generated/gear-stands.json L194) — Link: https://amzn.to/3KxLPlX
  - YITAHOME Heavy Duty 40–50 Gallon Aquarium Stand with Power Outlets, Cabinet for Fish Tank Accessories Storage – Metal Fish Tank Stand Suitable for Fish, Turtle, 660 LBS Capacity, Black (Material: Metal/Wood) (Source: assets/js/generated/gear-stands.json L220) — Link: https://amzn.to/3VX1SMr
- **55-75**
  - 4ever2buy 55-75 Gallon Fish Tank Stand with Power Outlets, LED Light, Heavy Duty Aquarium Stand with Cabinet for Fish Tank Accessories Storage, for Turtle Tank, Reptile Terrarium, 1100LBS, Gray (Source: assets/js/generated/gear-stands.json L246) — Link: https://amzn.to/4mSgBmE
  - GRLEAF 55-75 Gallon Aquarium Stand: 1200LB Capacity, Built-In Power Outlets, 3-Tier Shelves for Fish Tank Accessories Storage, Heavy-Duty Steel/Wood Hybrid for Fish & Reptile Tanks | Excludes Tank (Source: assets/js/generated/gear-stands.json L272) — Link: https://amzn.to/48g6zZ9
  - DWVO 55-75 Gallon Aquarium Stand with Power Outlets, Cabinet for Fish Tank Accessories Storage - Heavy Duty Metal Fish Tank Stand Suitable for Turtle Tank, Reptile Terrarium, 860LBS Capacity, Black (Source: assets/js/generated/gear-stands.json L298) — Link: https://amzn.to/3L0LIPG
  - Aquarium Stand with Power Outlets, 55-70 Gallon Fish Tank Stand with 3 Baskets, 2 Storage Shelf, 5-Tier Heavy Duty Metal Tank Stand Suitable for Turtle Tank, Reptile Terrarium (Source: assets/js/generated/gear-stands.json L324) — Link: https://amzn.to/3KxyOZA
- **75-up**
  - GDLF 125-150 Gallon Fish Tank Stand, Heavy Duty Metal Aquarium Stand with Power Outlet and Cabinet for Fish Tank Filters and Accessories, 72.8″ L × 18.9″ W, 2200 LBS Capacity (Source: assets/js/generated/gear-stands.json L350) — Link: https://amzn.to/47dCQPo
  - GDLF 100-150 Gallon Fish Tank Stand, 120 Gallon Tank Stand with 60″ × 24″ Tabletop Fits 100/120/150 Volumes Aquariums, 2200 LBS Capacity Heavy Duty (Source: assets/js/generated/gear-stands.json L376) — Link: https://amzn.to/3ILng4n
  - VOWNER 100-150 Gallon Fish Tank Stand with Power Outlet, Heavy Duty Aquarium Stand with Cabinet Storage for Fish Tank, Turtle Tank, Reptile Terrarium, 60″ L × 23.6″ W Tabletop, 2200 LBS Capacity, Black (Source: assets/js/generated/gear-stands.json L402) — Link: https://amzn.to/4mVF4HQ
  - DWVO 75-120 Gallon Aquarium Stand with Power Outlet & LED Light, Cabinet for Accessories Storage – Heavy Duty Metal Fish Tank Stand Suitable for Turtle Tank, Reptile Terrarium, 2000 LBS Capacity, White (Source: assets/js/generated/gear-stands.json L428) — Link: https://amzn.to/3VVta5Y

### 4.5 CTA & Supporting Copy
- CTA block: “Next Step: Cycle Your Tank” with copy “You’ve picked the right gear — now bring it to life. The Cycling Coach walks you through building your tank’s biological balance, from first fill to fish-ready.” Link to `/params.html`. (Source: gear/index.html L302-L308)
- Supporting paragraph describing The Tank Guide Gear Hub mission. (Source: gear/index.html L312-L314)

## 5. Size Selector / Interactions
- Tank presets defined in `TANK_PRESETS` (IDs like `5g`, `10g`, `125g`) with gallon, liter, dimensions, and estimated weight. (Source: assets/js/gear.v2.js L12-L47)
- `initTankSelect` populates the dropdown, announces selection via `#gear-tank-meta`, stores the preset ID in `localStorage`, and syncs session-storage gallons for reuse across tools. (Source: assets/js/gear.v2.js L2455-L2528)
- Query parameters (`tank_g`, `tank`, `size`) can preselect a tank; they are tidied after load. (Source: assets/js/gear.v2.js L320-L374, L389-L409)
- `applyHighlights` computes heater, filter, and light matches, opens the heater accordion, and marks matching ranges. (Source: assets/js/gear.v2.js L2425-L2447)
- `start()` waits for `window.ttgGearDataPromise`, syncs filter selections from query strings, and initializes all gear categories plus accordions. (Source: assets/js/gear.v2.js L2558-L2605)

## 6. Links & CTAs
- Full inventory of 170 links (internal, external, affiliate) captured in `AUDIT/gear_page_links.csv`. (Generated from datasets listed above.)
- On-page CTA: `/params.html` (Cycling Coach) within the Next Step section. (Source: gear/index.html L302-L308)

## 7. Scripts & Styles
- Stylesheets: `/css/style.css?v=2024-06-05a`, `/css/site.css?v=1.4.9`, `/assets/css/gear.v2.css`. (Source: gear/index.html L96-L100)
- Inline style block styles the affiliate disclaimer and banner animation. (Source: gear/index.html L100-L145)
- Scripts loaded: `/js/nav.js?v=1.1.0`, `/assets/js/consent-mode.js`, GA4 include, Google AdSense, Cloudflare beacon, Google Funding Choices loader, `/assets/js/gear.v2.data.js`, `/js/ui/tooltip.js` (module), `/assets/js/gear.v2.js`, `/js/footer-loader.js?v=1.4.9`. (Source: gear/index.html L146-L319)
- Additional fetches: `/nav.html?v=1.1.0` (nav.js L223-L266), `/footer.html?v=1.4.9` (footer-loader.js L16-L28), `/js/gear-data.js` imports `/assets/data/gearCatalog.json`. (Source: assets/js/gear.v2.js L287-L302; js/gear-data.js L1-L96)
- Data fetch matrix summarized in `AUDIT/gear_page_assets.csv`.

## 8. Accessibility Notes
- Gear accordion headers use either `<header role="button" tabindex="0">` (top-level cards) or `<button data-accordion="toggle">` (sub-accordions), toggling `aria-expanded` and `aria-controls`. (Source: gear/index.html L217-L298; assets/js/gear.v2.js L1548-L1790)
- Info buttons carry `aria-label` and `aria-haspopup="dialog"`; dialogs are built with `role="dialog"`, `aria-modal="true"`, and close buttons. (Source: gear/index.html L218-L296; assets/js/gear.v2.js L864-L912)
- Tank select has an associated `<label class="sr-only">` and `aria-label="Tank Size"`. (Source: gear/index.html L196-L201)
- Banner uses `role="status"` with `aria-live="polite"`. (Source: gear/index.html L187-L189)
- Tooltip script removes native titles, sets `aria-describedby`, and manages focus trapping for dialogs. (Source: assets/js/gear.v2.js L864-L912; js/ui/tooltip.js L1-L130)

## 9. Disclosures & Legal
- Primary affiliate disclosure inline before gear listings. (Source: gear/index.html L211-L213)
- Footer reiterates Amazon Associate statement and links to privacy/legal resources. (Source: footer.html L80-L93)
- No additional legal copy within main gear content beyond CTA paragraph.

## 10. Commented-Out / Placeholders
- Server-side include comment for GA4: `<!--#include virtual="/includes/ga4.html" -->`. (Source: gear/index.html L150)
- No other commented placeholder content observed in `gear/index.html` or related scripts.

## 11. TODOs / FIXMEs
- No `TODO`, `FIXME`, `NOTE`, or `WIP` tags found in gear page source or supporting scripts. (Verified via search.)

## 12. Observed Gaps
- Page lacks an explicit meta robots directive; relies on site default indexing. (Source: gear/index.html L3-L160)
- Tooltips rely on HTML strings with `<br>` separators; content is not localized or sanitized beyond manual definitions. (Source: assets/js/gear.v2.data.js L87-L152)
- Extras category currently renders placeholder bullet points with no outbound links. (Source: data/gear_extras.csv L2-L11)
- Stands JSON entries omit dimensions for several mid/large options, resulting in blank detail fields. (Source: assets/js/generated/gear-stands.json L246-L428)
