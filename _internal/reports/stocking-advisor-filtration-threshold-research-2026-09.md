# Stocking Advisor — filtration adequacy threshold research (2026-09)

Research / model audit only. **No production logic, threshold, UI, bioload or species data was
changed.** `MIN_BIOLOGICAL_TURNOVER` is still `2` (`js/stocking-advisor/filtration/math.js:35`).

Question investigated: is the Phase 2C floor of **2× tank volume per hour through biological
media** appropriate, or is a target of **7×–10×** better supported?

Method note: full-page fetches from this build environment are blocked by the network egress
policy (same limitation recorded in `FILTRATION_MODEL.md` §5). Figures were first taken from
search-indexed text of the cited page (product listings, manufacturer pages, abstracts). Figures
that could only be traced to a retailer or forum relay are marked as such.

**Final source verification (2026-09).** The following primary sources were then reviewed
directly (outside the build environment) and their values are marked **✔ verified** in this report.
Where a verified value contradicted the search-indexed value, the verified value replaces it:

| Source | Directly verified values |
| --- | --- |
| EHEIM Classic 2213 manual — https://eheim.com/media/pdf/ab/d6/bb/2213_classic_07-20.pdf | Aquariums up to 250 L / 66 US gal; **pump output** 440 L/h / 116 US GPH. The manual labels 116 GPH as *pump output*; it does **not** document it as flow with media. → 116 ÷ 66 ≈ **1.76×** at the maximum rated tank. |
| Fluval canister series page — https://fluvalaquatics.com/us/shop/product/107-canister-filter-10-30 (series table) | Fluval 307: 40–70 US gal; **pump output** 303 US GPH; **filter circulation** 206 US GPH. At 70 gal: **4.33×** pump output, **2.94×** filter circulation. |
| AquaClear / Fluval AC series page — https://fluvalaquatics.com/us/shop/product/aquaclear | AquaClear AC70: 40–70 US gal; **maximum flow** 300 US GPH. At 70 gal: **4.29×**. No statement that this is measured with media. |
| OASE BioMaster 350 (US) — https://www.oase.com/en-US/aquarium/biomaster-350 | Up to 90 US gal / 350 L; **maximum flow** 295 US GPH (~1135 L/h). At 90 gal: **3.28×**. |
| 2Hr Aquarist — https://www.2hraquarist.com/blogs/filters-overview/filter-buying-checklist ; https://www.2hraquarist.com/blogs/filters-overview/flow-setup | ~**6×–10× rated** hourly filter flow **for planted aquariums**, justified by circulation, O₂ and CO₂ distribution, nutrient delivery, surface/deep-water exchange and reducing the need for extra circulation pumps. |

All other figures remain search-indexed only and should be re-checked before they are used for a
production threshold.

---

## 1. Executive summary

1. **The 7×–10× figure is a circulation / rated-flow rule of thumb, not a biological-filtration
   requirement.** Where sources say what it measures, 7×–10× (and 10×) refers to either
   *rated* filter flow chosen for **planted-tank circulation** (2Hr Aquarist ✔: ~6×–10× rated, for
   circulation, O₂/CO₂ distribution, nutrient delivery and surface/deep-water exchange) or *total
   circulation* (Eheim's 10× recommendation is in its **marine** guide and is for circulation).
   6×–10× is **well supported as a planted-tank rated-flow / circulation target**; it is not
   presented by its source as a universal biological-filtration minimum.
2. **Manufacturer evidence is heterogeneous, and powered-filter ratings commonly fall below 7× at
   their maximum recommended tank size.** Directly verified examples at each manufacturer's
   maximum tank:

   | Filter | Figure | Turnover at max tank |
   | --- | --- | --- |
   | EHEIM Classic 2213 ✔ | pump output 116 GPH, 66 gal | **1.76×** |
   | OASE BioMaster 350 ✔ | maximum flow 295 GPH, 90 gal | **3.28×** |
   | AquaClear AC70 ✔ (HOB) | maximum flow 300 GPH, 70 gal | **4.29×** |
   | Fluval 307 ✔ | pump output 303 GPH / filter circulation 206 GPH, 70 gal | **4.33×** pump / **2.94×** circulation |

   There is no single "manufacturer turnover": verified pump/maximum-flow ratings at the maximum
   tank range from 1.76× to 4.33×. None approaches 7×. A 7× requirement would mark all four as
   "insufficient" on tank sizes their manufacturers sell them for.
3. **Flow measurement method matters significantly.** Fluval ✔ publishes both *pump output* (303
   GPH) and *filter circulation* (206 GPH, 68 %) for the same 307. Rated pump GPH, operating filter
   circulation and actual installed flow are three different numbers and must not be treated as
   interchangeable.
4. **Nitrification capacity is set mainly by colonised media surface, oxygen and the ammonia
   supplied, not by turnover.** Aquaculture work shows single-pass ammonia removal *falls* as
   flow rises, and required flow scales with feed/waste (TAN) production, not with tank volume.
   A mass-balance estimate for ordinary home-aquarium feeding gives a flow requirement of roughly
   0.5×–4× (section 11). No source found gives a measured biological minimum for home aquaria.
5. **2× is defensible as a low floor, not as a target — and it is not uniformly "conservative"
   against manufacturer ratings.** For three of the four verified filters (3.28×–4.33× at their
   maximum tank) a sub-2× result means the filter is well under its manufacturer's own sizing.
   But the EHEIM Classic 2213's own **pump output** is only **1.76×** at its maximum stated tank
   (66 gal), so the current floor marks that filter red on a tank EHEIM rates it for. At the other
   end, 2×–4× shows green today although it is below most verified ratings. The floor is therefore
   both permissive (silent on 2×–4×) and, for at least one major manufacturer, stricter than the
   manufacturer's own rating.
6. **A single turnover number is an incomplete filtration model.** Filter type (especially sponge
   and sump), the flow basis (pump output vs filter circulation vs measured) and stocking load all
   change what a number means.
7. **Candidate future model (for review — no production threshold is selected here):** a low
   "too low" floor on a rated basis, an advisory "low" band, a "typical" band, and a neutral
   ">10× high filter flow" note; "low"-band severity depending on Stocking Load; separate handling
   for sponge filters and sumps; powerheads never counted; filtration never changing Stocking
   Load. Candidate band edges are in section 17 and are explicitly open (section 20).
8. **There is not enough evidence to implement a precise new pass/fail threshold such as 7×.**
   There is enough to design the *structure* above (flow basis, type-awareness, advisory bands),
   once the product questions in section 20 are answered and the filter catalog has been audited
   (Appendix A).

---

## 2. Definitions

These are used strictly throughout this report.

| Term | Meaning | What the Stocking Advisor has today |
| --- | --- | --- |
| **Filter rated flow** | Manufacturer-advertised GPH/LPH. For the verified brands (EHEIM ✔, Fluval ✔, AquaClear ✔, OASE ✔) it is labelled *pump output* or *maximum flow*, i.e. not a with-media operating figure. Fluval additionally publishes *filter circulation*. Sicce is reported by a retailer to rate *with media and head* (not verified). | `gphRated` in `assets/data/gear/filters.json`; user-typed GPH for custom filters. Basis not recorded. |
| **Actual filter flow** | Flow delivered in the installed state: after media, media fouling, hose length and diameter, lift/head height, valves, spray bars, intake sponges/screens. Always ≤ rated, and it falls between cleanings. | Not known. |
| **Biological media flow** | Water that actually passes through the colonised media. Equals actual filter flow for a sealed canister; can be less in HOBs (bypass when media clogs, or the AquaClear "re-filtration" mode where part of the water loops through the box again) and in sumps with overflow bypass. | Not known. |
| **Total tank circulation** | All water movement in the display: filter returns + powerheads + wavemakers + circulation pumps + airlifts. | Σ rated GPH of all devices ("total turnover"), shown but never scored. |
| **Turnover rate** | A flow ÷ display tank volume (per hour). Meaningless unless the flow is named: "rated turnover", "actual filter turnover", "media turnover", "circulation turnover". | `biologicalTurnover` = Σ rated GPH of non-powerhead devices ÷ nominal gallons. It is a **rated filter turnover**, not a media turnover. |

Consequence for the current model: the Phase 2C code comments call its number "biological
turnover" / "flow through filter media", but it is computed from **rated** flow. The warning text
("GPH through filter media") overstates what is known.

---

## 3. Source table

Tier per the brief (1 = manufacturer technical data / published science; 2 = established husbandry
organisations & publications; 3 = educators with stated method; F = forum/retailer relay, used only
as leads or measured anecdotes). ✔ = primary source reviewed directly (see method note).

| # | Source | Tier | Figure | What the figure measures |
| --- | --- | --- | --- | --- |
| S1 | ✔ Fluval canister series table (verified for the 307) — https://fluvalaquatics.com/us/shop/product/107-canister-filter-10-30 ; also https://fluvalaquatics.com/us/shop/product/07-series ; 307: https://fluvalaquatics.com/us/shop/product/307-canister-filter-40-70-us-gal-90-330-l ; 207: https://fluvalaquatics.com/us/shop/product/207-canister-filter-20-45-us-gal-60-220-l ; 107: https://fluvalaquatics.com/us/shop/product/107-canister-filter-10-30 ; 407: https://fluvalaquatics.com/ca/shop/product/407-canister-filter-50-100-us-gal-150-500-l | 1 | Pump output vs "filter circulation" + tank range (307 ✔: 303 / 206 GPH, 40–70 gal) | Rated pump output AND manufacturer operating circulation figure |
| S2 | Fluval FX4 — https://fluvalaquatics.com/us/shop/product/fx4-canister-filter-up-to-250-us-gal-1000-l | 1 | 700 GPH pump / 450 GPH filter circulation, up to 250 gal | Both bases |
| S3 | ✔ EHEIM Classic 2213 manual — https://eheim.com/media/pdf/ab/d6/bb/2213_classic_07-20.pdf (earlier leads: https://www.finestaquatics.co.uk/eheim-classic-250-external-filter-2213 ; a third-party review, https://www.aquariadise.com/review-eheim-classic-250-external-canister-filter/, claimed EHEIM rates with media — **not supported by the manual**) | 1 | Pump output 440 L/h / 116 US GPH; aquariums up to 250 L / 66 US gal | **Pump output** (manual label); not documented as with-media flow |
| S4 | Eheim professionel 4+ 350 (2273) — https://watermarque.co.uk/product/eheim-professionel-4-350-external-filter-2273/ | 1 (retailer copy of spec) | 1050 L/h max pump output, 180–350 L | Pump output ("max") |
| S5 | Eheim marine guide PDF — https://eheim.com/media/pdf/94/7c/3e/7994820_EHEIM_Ratgeber_Meerwasser_GB_0918.pdf | 1 | "circulation … about ten times the volume of the tank per hour" | **Total circulation, marine** |
| S6 | Eheim freshwater guide PDF — https://eheim.com/media/pdf/68/e4/dd/7991220_Ratgeber_EHEIM_Aquarien_GB_2019.pdf | 1 | Exists; turnover figure not recoverable from indexed text | — (needs manual check) |
| S7 | ✔ OASE BioMaster 350 (US) — https://www.oase.com/en-US/aquarium/biomaster-350 ; BioMaster 250 (search-indexed) — https://us.oase.com/products/biomaster-2-250-94718 | 1 | BioMaster 350: maximum flow 295 US GPH (~1135 L/h), up to 90 US gal / 350 L. BioMaster 250: 900 L/h, up to 250 L, max head 1.7 m | Maximum flow (pump) |
| S8 | Sicce Whale series — https://fresh.bulkreefsupply.com/whale-200-canister-filter-190-gph-sicce.html ; https://www.saltwateraquarium.com/whale-500-aquarium-canister-filter-80-135-gal-390-gph-sicce/ | 1 (retailer copy) | Whale 200: 190 GPH, 25–50 gal; Whale 500: 390 GPH, 80–135 gal; retailer copy says Sicce measures with media and head | With media + head (retailer relay of a manufacturer claim; **not verified**) |
| S9 | Seachem Tidal 55 — https://www.seachem.com/tidal-55.php ; manual: https://www.sicce.com/media/wysiwyg/ISTRUZIONI/80N567-A_Tidal_instructions.pdf | 1 | 250 GPH, up to 55 gal; adjustable down to ~50 GPH | Rated (basis not stated) |
| S10 | ✔ AquaClear / Fluval AC series — https://fluvalaquatics.com/us/shop/product/aquaclear ; AC70 page: https://fluvalaquatics.com/us/shop/product/fluval-aquaclear-70-power-filter-with-media-40-70-us-gal-152-265-l | 1 | AC70: maximum flow 300 US GPH, 40–70 US gal (not stated as with media); flow control; "up to 50 % of the water … processed multiple times" when reduced | Rated; flow control re-circulates inside the box |
| S11 | Tetra Whisper IQ 45 — https://www.tetra-fish.com/products/filtration/whisper-iq-power-filters.aspx | 1 | 215 GPH, up to 45 gal; adjustable to ~20 GPH | Rated |
| S12 | MarineLand Penguin 350 — retailer listings (e.g. https://www.dfwaquarium.com/Products/Hang-On-Filters/Penguin-350-Power-Filter-50-to-75-gal-350-gph.html) | 1 (retailer copy) | 350 GPH, 50–70 (or 75) gal | Rated |
| S13 | Aqueon QuietFlow 75 — https://www.chewy.com/aqueon-quietflow-led-pro-aquarium/dp/185108 | 1 (retailer copy) | 400 GPH, up to 75–90 gal | Rated |
| S14 | hygger HOB (105/210/315 GPH) — https://www.amazon.com/hygger-Aquarium-Adjustable-Extendable-External/dp/B0DCS2731J | 1 (listing) | 105 GPH 10–20 gal; 210 GPH 20–40; 315 GPH 40–75 | Rated |
| S15 | Hikari Bacto-Surge — https://tkaquatics.com/products/hikari-aquarium-solutions-bacto-surge-foam-filter-mini-up-to-10-gallons | 1 (listing) | Rated by tank size only (Mini ≤10 gal … XL ≤125 gal); **no GPH** | Tank size only |
| S16 | Aquarium Co-Op sponge sizes — https://www.aquariumcoop.com/blogs/faqs/sponge-filter-sizes | 2 | Rated by tank size only | Tank size only |
| S17 | Swiss Tropicals BetterBoxFilter / Jetlifter — https://www.swisstropicals.com/filtration-shop/betterboxfilter/ ; https://www.reef2rainforest.com/2017/12/15/the-new-betterboxfilter-from-swiss-tropicals/ | 1 | ~50 L/h air; water:air ≈ 4:1 for their optimised airlift; Jetlifter large 300–500 L/h | Airlift water flow (manufacturer, optimised design) |
| S18 | Aquarium Co-Op, water circulation — https://www.aquariumcoop.com/blogs/aquarium/water-circulation | 2 | "at least four times an hour … a filter **and/or powerhead**" | **Total circulation**, rated |
| S19 | LiveAquaria, flow rate — https://www.liveaquaria.com/blogs/water-movement/choosing-the-proper-flow-rate-for-your-aquarium | 2 | ~4× per hour on average; "biological and chemical media often work better at a rate of 4 times an hour or less"; slow flow for bettas/fry | Pump + filter (circulation), rated |
| S20 | ✔ 2Hr Aquarist — https://www.2hraquarist.com/blogs/filters-overview/filter-buying-checklist ; https://www.2hraquarist.com/blogs/filters-overview/flow-setup ; also https://www.2hraquarist.com/blogs/filters-overview/6-features-of-an-ideal-planted-tank-filter | 2 | ~6×–10× **rated** hourly filter flow for **planted** aquariums; reasons: circulation, O₂ and CO₂ distribution, nutrient delivery, surface/deeper-water exchange, less need for extra circulation pumps | **Rated** filter flow as a planted-tank **flow / circulation target** — not a biological-filtration minimum |
| S21 | Aquasabi, filtration in a planted aquarium — https://www.aquasabi.com/aquascaping-wiki_filtration_filtration-in-a-plant-aquarium | 2 | Planted-tank filtration guidance (circulation-driven) | Circulation |
| S22 | Bulk Reef Supply, sizing a return pump — https://www.bulkreefsupply.com/content/post/how-to-size-a-return-pump | 2 | Sump return often run 2×–5× **after head**; ~10 % rated flow lost per foot of head; example 900 GPH rated → 450 GPH at 4 ft + 2 elbows | Return flow after head loss (marine practice) |
| S23 | aquariumscience.org 6.5 Flow rate — https://aquariumscience.org/index.php/6-5-water-flow-rate/ ; 6.2 Biofiltration — https://aquariumscience.org/index.php/6-2-biofiltration/ | 3 | Flow "relatively immaterial" in ~1–10 turnovers/h; doubling flow adds ~5–15 % capacity per unit media area | Flow through filter; biofilter capacity |
| S24 | Schizothorax container RAS study (bioRxiv 2023) — https://www.biorxiv.org/content/10.1101/2023.06.22.546147v1.full | 1 (preprint) | Single-pass TAN removal 40 %→28 % (low feed) and 54 %→36 % (high feed) as circulation rose 1.5→4.5 m³/h | Flow through biofilter vs per-pass removal |
| S25 | Nitrifying trickling filters: temperature, TAN load, hydraulic loading — https://www.sciencedirect.com/science/article/abs/pii/S221334371930380X | 1 | Highest removal at highest temperature × hydraulic load × TAN load combined | Hydraulic loading on media |
| S26 | Fluidized-bed nitrification rates — https://www.globalseafood.org/advocate/nitrification-rates-in-fluidized-bed-filters/ | 1/2 | +17 % nitrification when flow increased | Flow through media |
| S27 | TAN production from feed (P_TAN = F × PC × 0.092, Timmons & Ebeling) — https://www.intechopen.com/chapters/44809 ; https://www.sciencedirect.com/science/article/pii/S004484860600216X | 1 | TAN produced ∝ feed × protein | Waste generation |
| S28 | Airlift pumps in aquaculture — https://www.bu.edu.eg/portal/uploads/Agriculture/Agricultural%20Engineering/1241/publications/Samir%20Ahmad%20Ali_Airlift%20Pump.pdf ; https://www.sciencedirect.com/science/article/abs/pii/0144860987900082 | 1 | Water flow depends on tube diameter, length, submergence ratio and air rate; flow rises then falls with air | Airlift water flow |
| S29 | Betta flow as an aversive stimulus — https://pubmed.ncbi.nlm.nih.gov/31406902/ ; caudal-fin size vs burst speed — https://www.tandfonline.com/doi/abs/10.1080/03949370.2026.2658495 | 1 | Water flow used as an aversive stimulus for B. splendens; larger caudal fins → lower burst speed | Current experienced by the fish |
| S30 | UKAPS threads on installed vs stated flow — https://www.ukaps.org/forum/threads/eheim-external-filters-stated-flow-actual-flow.36418/ ; https://www.ukaps.org/forum/threads/actual-flow-is-25-of-rated-flow-eheim-pro-3e-2076.14188/ | F | Manual "installed" vs box figures: Eheim 3e 1000/1700 L/h (59 %), Fluval G3 54 %, G6 41 %; one measured Eheim 66 % of rated; thread title reports 25 % | Measured installed flow (anecdote) + relayed manual figures |
| S31 | JBL manual note (relay) — https://www.ukaps.org/forum/threads/flow-issues-advice-needed-for-upgrading-canister-filter.36052/ | F | JBL manuals quote ~50 % of pump rating with media & hoses | Relay of manufacturer statement |
| S32 | Existing repo evidence — `data/stocking-advisor/FILTRATION_MODEL.md` §5, `_internal/reports/filtration-model-audit-2026-09.md` | — | Nitrifier growth follows ammonia; removal depends on colonised surface + hydraulics; O₂ demand 4.57 g/g N | Background |

Forum/calculator sites that surfaced (theaquariumguide.com, aquifarm.com, fishlore, plantedtank.net,
monsterfishkeepers, reef2reef, humble.fish, many "flow calculators") were used only to find leads.
None is a basis for a threshold. Seriously Fish and Practical Fishkeeping returned no dedicated
turnover guidance in indexed text (Practical Fishkeeping has product reviews quoting pump-named
flows, e.g. JBL e700 "named after its flow — 700 l/h … 60–160 l": https://www.practicalfishkeeping.co.uk/gear/cristalprofi-e700-canister-filter-review/).

---

## 4. Manufacturer guidance

Implied advertised turnover = rated flow ÷ manufacturer's **maximum** recommended volume.
✔ = values verified directly on the manufacturer page/manual; other rows are search-indexed only.

**Verified reference set**

| Filter | Type | Manufacturer figure (label as published) | Max tank | Turnover at max | With media? | Flow control |
| --- | --- | --- | --- | --- | --- | --- |
| ✔ EHEIM Classic 2213 | Canister | **Pump output** 440 L/h / 116 US GPH | 250 L / 66 US gal | **1.76×** | Not documented as with media | Hose valve |
| ✔ OASE BioMaster 350 | Canister | **Maximum flow** 295 US GPH (~1135 L/h) | 350 L / 90 US gal | **3.28×** | Not stated | — |
| ✔ AquaClear AC70 | HOB | **Maximum flow** 300 US GPH | 40–70 US gal | **4.29×** | Not stated | Yes — reduced flow re-circulates up to 50 % inside the box (search-indexed) |
| ✔ Fluval 307 | Canister | **Pump output** 303 US GPH; **filter circulation** 206 US GPH | 40–70 US gal | **4.33×** pump / **2.94×** circulation | Circulation figure is Fluval's operating figure; exact test conditions not stated | Valve |

**Search-indexed set (not verified)**

| Filter | Type | Rated flow | Max tank | Implied turnover at max | Basis of the flow figure | Flow control |
| --- | --- | --- | --- | --- | --- | --- |
| Fluval 107 | Canister | 145 GPH pump / 95 GPH circulation | 30 gal | 4.8× pump / 3.2× circulation | Both published | Valve |
| Fluval 207 | Canister | 206 / 121 | 45 gal | 4.6× / 2.7× | Both | Valve |
| Fluval 407 | Canister | 383 / 245 | 100 gal | 3.8× / 2.5× | Both | Valve |
| Fluval FX4 | Canister | 700 / 450 | 250 gal | 2.8× / 1.8× | Both | — |
| Eheim Pro 4+ 350 | Canister | 1050 L/h max | 350 L | 3.0× | "max" pump output | Valve |
| OASE BioMaster 250 | Canister | 900 L/h | 250 L | 3.6× | Max pump output | — |
| Sicce Whale 200 | Canister | 190 GPH | 50 gal | 3.8× | Retailer says with media + head (unverified) | — |
| Sicce Whale 500 | Canister | 390 GPH | 135 gal | 2.9× | Retailer says with media + head (unverified) | — |
| AquaClear 30 / 50 | HOB | 150 / 200 GPH | 30 / 50 gal | 5.0× / 4.0× | Rated | Yes |
| Seachem Tidal 35 / 55 / 75 / 110 | HOB | 130 / 250 / 350 / 450 GPH | 35 / 55 / 75 / 110 gal | 3.7× / 4.5× / 4.7× / 4.1× | Rated | Yes, down to ~50 GPH (Tidal 55) |
| Tetra Whisper IQ 45 | HOB | 215 GPH | 45 gal | 4.8× | Rated | Yes, to ~20 GPH |
| MarineLand Penguin 350 | HOB | 350 GPH | 70–75 gal | 4.7×–5.0× | Rated | — |
| Aqueon QuietFlow 75 | HOB | 400 GPH | 75–90 gal | 4.4×–5.3× | Rated | — |
| hygger HOB S / M / L | HOB | 105 / 210 / 315 GPH | 20 / 40 / 75 gal | 5.3× / 5.3× / 4.2× | Rated | Yes |
| Hikari Bacto-Surge, Aquarium Co-Op, AQUANEAT sponges | Sponge (air) | none published by Hikari / Co-Op | by tank size | not computable | — | Air valve |
| Swiss Tropicals BetterBoxFilter / Jetlifter | Airlift | ~4 L water per 1 L air; Jetlifter L 300–500 L/h | — | — | Manufacturer, optimised airlift | Air rate |

Findings:

- **Manufacturer evidence is heterogeneous.** Verified pump/maximum-flow turnover at the maximum
  rated tank ranges from **1.76× (EHEIM 2213) to 4.33× (Fluval 307)**; OASE BioMaster 350 sits at
  3.28× and AquaClear AC70 at 4.29×. The unverified set spans ~2.8×–5.3×. There is no single
  "manufacturer-implied turnover", and statements such as "manufacturers imply 4×–5×" are not
  true across brands.
- **None of the verified or indexed powered filters is rated at 7×–10× of its maximum tank.**
  Powered-filter ratings commonly fall below 7× at the maximum recommended tank size.
- **Measurement method matters.** Fluval ✔ distinguishes pump output (303 GPH) from filter
  circulation (206 GPH, 68 %) for the same 307. The other verified figures are labelled pump output
  or maximum flow, so none of them is a with-media operating figure. Actual installed flow (hoses,
  head, fouling) is a third number again (section 10).
- The only manufacturer "10×" found (Eheim) is a **marine circulation** figure, not a filter
  sizing rule.
- Flow control does not have one meaning: on a canister a valve reduces flow through media; on an
  AquaClear, reducing output makes part of the water pass through the media more than once, so
  flow *out* of the filter falls more than flow *through* the media.
- Manufacturer tank ratings are marketing and cannot be taken as biological fact, but they are the
  best available evidence of what the industry considers an adequately sized filter, and they are
  what users will compare the advisor against.

---

## 5. Husbandry guidance

| Source | Number | What it measures |
| --- | --- | --- |
| Aquarium Co-Op (S18) | ≥ 4×/h | Filter **and/or powerhead** — total circulation, rated |
| LiveAquaria (S19) | ~4×/h; bio/chemical media "often work better at 4× or less"; slow for betta/fry | Pump + filter circulation, rated |
| 2Hr Aquarist ✔ (S20) | ~6×–10× rated hourly filter flow for planted aquariums | **Rated** filter flow as a planted-tank **circulation** target (circulation, O₂/CO₂, nutrients, surface/deep exchange, fewer extra pumps) |
| aquariumscience.org (S23) | 1–10×/h, flow "relatively immaterial" in that range | Filter flow; argues surface area dominates |
| BRS (S22) | Sump return 2×–5× after head (modern reef practice) | Measured/derated return flow |
| Hobby calculators / blogs | 4–6× community, 6–8× heavy, 8–10× goldfish/cichlids, 3–4× betta | Usually unstated; appear to be rated circulation |

The husbandry consensus that is actually sourced is **~4× rated as a common minimum circulation**,
with 5–10× rated as common practice for planted or messy tanks. None of the Tier 2/3 sources
presents 7×–10× as a *biological* minimum.

---

## 6. Filter-type differences

| Type | Biology-relevant facts | Does "N×" mean the same thing? |
| --- | --- | --- |
| **HOB** | Small media volume (Tidal 55: 1.2 L), short contact time, good oxygenation at the waterfall; media bypass when clogged; some models re-circulate inside the box when turned down. | Rated flow overstates media flow; media volume is the limiting factor. |
| **Canister** | Larger media volume (Fluval 307 7.3 L canister; Eheim 2213 3 L; Pro 4+ 350 4.5 L); sealed, so all flow passes media; O₂ supply only from incoming water; flow falls steeply as media fouls. | Rated pump flow overstates by ~35–40 % before head and fouling. |
| **Internal** | Small media, low head, flow close to rated when clean. | Similar to HOB. |
| **Sponge (air)** | Large colonised foam surface, very gentle flow, strong oxygenation; flow set by air pump + lift tube, not the sponge. | No reliable GPH exists (section 7). |
| **Sump / trickle** | Large media volume, often wet/dry with excellent O₂; flow = return pump after head; display circulation often supplied separately. | 4× through a large sump is more biological capacity than 8× through a HOB (section 8). |
| **Undergravel** | Gravel bed as media; flow from airlift (weak) or powerhead; reverse flow roughly halves powerhead output (forum lead only). | GPH rarely known; biology depends on bed area and cleanliness. |
| **Moving-bed (K1)** | Self-cleaning, very high effective surface per volume; needs enough flow/air to fluidise, not a particular turnover. | Turnover is irrelevant beyond "enough to move the media". |
| **Trickle (wet/dry)** | Highest O₂ availability to biofilm; capacity depends on media area and even distribution. | As sump. |

Answer: **7× through a HOB does not mean the same thing biologically as 7× through a large sump.**
Biological capacity follows colonised surface area, oxygen supply and ammonia supplied (S23–S26,
S32); turnover is at best a weak proxy, and a proxy of different strength per type. One universal
threshold cannot express that, but the advisor cannot see media volume either, so the realistic
fix is a type-aware *input* (what number the user can give) rather than type-specific capacity
credit (which Phase 2C correctly removed).

---

## 7. Sponge-filter findings

- Sponge-filter makers with the clearest documentation (Hikari, Aquarium Co-Op) rate sponges **by
  tank size only and publish no GPH** (S15, S16).
- The catalog's sponge GPH values (60/80/120/150/200) come from Amazon listing copy and are
  tank-size marketing, not measured flow (already noted in `FILTRATION_MODEL.md` §6).
- Airlift water flow depends on air rate, **lift-tube diameter, tube length, submergence ratio and
  bubble size**; flow rises with air rate and then falls (S28). An optimised airlift manufacturer
  claims ~4:1 water:air (S17); ordinary coarse-bubble sponge lifts are less efficient and
  uncharacterised.
- Illustration only: a 1 L/min air pump (60 L/h) at 4:1 would give ~240 L/h ≈ 63 GPH (~3.2× on a
  20 gal) — and that is the *best-case* ratio from an optimised design. A standard sponge with a
  coarse airstone could deliver a fraction of that. The advisor cannot know which.
- **Air-pump LPM cannot be reliably converted to water GPH** by a fixed factor.
- **Asking a user for GPH for a sponge filter is not realistic.** Users will copy a listing number
  (which is tank-size marketing) or guess.

Conclusion: sponge filters eventually need a different input: e.g. "Sponge filter — rated for up to
__ gal" (from packaging) × count, with the check being "rated tank size ≥ this tank" (optionally
"≥ 1 sponge per N gal" and "air pump connected"). Turnover should not be computed or shown for
sponges. **Not implemented.**

---

## 8. Sump findings

- Sump flow is the **return pump's flow after head loss**, which can be half of rated (S22: ~10 %
  per foot of head, 0.5 ft equivalent per elbow; 900 GPH rated → 450 GPH delivered).
- Marine practice has moved from 10×+ through the sump to **2×–5× after head**, with display
  circulation supplied separately by powerheads (S22). For freshwater, the indexed guidance
  suggests 3×–5× to limit microbubbles; this came from a calculator/forum lead, not a Tier 1–2
  source.
- Display circulation (powerheads) moves water past the fish and keeps detritus in suspension so
  it can reach the overflow, but it passes **no media**. It must not be counted as filtration flow.
- Is a sump at 4× (measured) plus strong powerheads less biologically capable than a HOB at 8×
  (rated)? **No.** The sump's 4× is a *measured* flow through a media volume one to two orders of
  magnitude larger, usually with better oxygenation (wet/dry, open chambers). The HOB's 8× is a
  *rated* flow (~5–6× actual) through ~1 L of media. A single turnover threshold would rank them
  backwards.
- The advisor currently has no sump type. Adding one should ask for **return flow as delivered**
  (or rated + head height), and should not apply the HOB/canister rated-flow bands.

---

## 9. Planted-tank circulation distinction

- 2Hr Aquarist ✔ (filter-buying checklist and flow-setup pages) recommends approximately **6×–10×
  rated hourly filter flow for planted aquariums**. Its stated reasons are all circulation
  functions:
  - water circulation throughout the tank;
  - oxygen and CO₂ distribution;
  - nutrient delivery to plants;
  - exchange between surface and deeper water;
  - reducing the need for additional circulation pumps.
  None of these is a statement about how much flow nitrifying bacteria need. The figure is a
  **planted-tank flow / circulation target expressed in rated filter flow**, and is well supported
  as such. It must not be represented as a universal minimum biological-filtration requirement.
- Aquasabi (S21) frames planted-tank flow the same way (circulation-driven).
- These numbers are frequently met with powerheads/circulation pumps plus a smaller filter, which
  the planted-tank sources accept.
- Therefore **planted 6×–10× is a circulation recommendation, not a minimum biological filtration
  requirement.** In the advisor's terms it belongs to CIRCULATION (all devices, including
  powerheads), not to FILTRATION ADEQUACY (biological filters only). Heavily planted tanks, if anything, need less biological filtration (plants take
  up ammonium), though the advisor should not give credit for that either (it cannot see plant
  mass).
- If a planted-tank circulation hint is ever added, it belongs to the circulation line (all
  devices), not to filtration adequacy.

---

## 10. Rated vs actual flow

| Cause | Evidence | Typical effect |
| --- | --- | --- |
| Media (clean) | Fluval filter circulation vs pump output: 68 % for the 307 ✔ (206/303); 59 %–66 % for other 07/FX models (search-indexed) (S1, S2) | −32 % to −41 % |
| Media + hoses (JBL manuals, relayed) | ~50 % of pump rating (S31) | −50 % |
| Installed per manual (relayed) | Eheim 3e 59 %, Fluval G3 54 %, G6 41 % (S30) | −41 % to −59 % |
| Measured by users (anecdote) | 66 % of rated; one thread 25 % (S30) | wide |
| Head height | ~10 % of rated per foot for return pumps (S22); OASE/Fluval publish max head 1.7–2.1 m | significant on sumps, small on HOBs |
| Elbows/valves/spray bars/intake sponges | ~0.5 ft head per elbow (S22); spray bars and pre-filter sponges add restriction (no quantified source) | unquantified |
| Fouling between cleanings | Qualitative only in sources found | progressive; can be large |

Brands differ in what they publish: EHEIM ✔ (2213) labels its figure *pump output*; OASE ✔ and
AquaClear ✔ publish *maximum flow*; Fluval ✔ publishes both *pump output* and *filter circulation*;
Sicce is reported (unverified) to rate with media and head; most HOB brands give one unlabelled
number. **Rated pump GPH, operating filter circulation and actual installed flow are three
different quantities** — the Fluval 307 alone shows a 303 → 206 GPH step before hoses, head or
fouling. The current catalog stores both Fluval 307 (303) and EHEIM 2213 (116) at their pump
output, with no field recording the basis; a user-entered number could be any of the three.

Options:

- **A. Trust user GPH directly.** Simple; consistent with hobby rules that are themselves stated
  in rated flow. Inconsistent across brands.
- **B. Rated GPH × fixed derating.** Any single factor (0.5–0.7) is invented precision for HOBs,
  and it would double-derate any figure that is already an operating/with-media number (Fluval
  "filter circulation", Sicce if its claim holds, user-measured flow).
- **C. Ask whether entered GPH is rated or measured.** Captures the biggest source of error for
  custom entries; most users will say "rated".
- **D. Different assumptions by filter type / by catalog flow basis.** Best fidelity for catalog
  products where the basis is published.

**Recommendation: C + D, not B.** Keep thresholds expressed on a *rated* basis (because the
husbandry and manufacturer numbers are rated numbers), record `flowBasis` per catalog item
(`pump` | `circulation` | `measured`), and show the user "rated" or "measured" next to the number.
If circulation/measured entries are ever compared against rated-basis bands, the only verified
conversion evidence is Fluval's 307 ratio (0.68); any factor is a product decision, not a finding.
Do not silently derate.

---

## 11. Stocking-level relationship

- Aquaculture engineering sizes flow from a **TAN mass balance**: TAN production
  P_TAN ≈ feed × protein fraction × 0.092 (S27), and required flow Q ≈ P_TAN ÷ (tank TAN ×
  single-pass removal fraction). **Flow need scales with waste produced, not with tank volume.**
- Worked illustration (not a sourced threshold): a 29-gal (110 L) community fed 0.5 g/day of 45 %
  protein food produces ≈ 21 mg TAN/day. To hold tank TAN at 0.05 mg/L:
  - 20 % single-pass removal → Q ≈ 86 L/h ≈ 23 GPH ≈ **0.8×**
  - 10 % single-pass removal → ≈ **1.6×**
  - holding 0.02 mg/L at 10 % removal → ≈ **4×**
  Doubling the feed (heavier stocking) doubles every one of those figures.
- Single-pass removal falls as flow rises (S24), and doubling flow adds only ~5–15 % capacity per
  unit media (S23), so extra flow buys much less than proportional nitrification. Beyond a modest
  minimum, media area and oxygen dominate.
- Husbandry sources (calculators, S20) consistently scale recommended flow with stocking/"messy"
  fish (4× light → 6× community → 8–10× heavy), but these are rules of thumb that also include
  mechanical capture of solids — a real reason for more flow in heavily stocked or messy tanks.

Conclusion: evidence **supports the direction** of a graduated target (more waste → more flow and,
more importantly, more media), but **does not support specific numbers**. A graduated model is
appropriate only as advisory severity (e.g. the same 3× is informational at light load and amber
at heavy load), not as precise pass/fail steps.

---

## 12. Fish-flow tolerance

- Filter flow and the current a fish experiences are different quantities. The same GPH through
  a spray bar, a wide/flared outlet, a baffled return or several returns produces very different
  local velocities. Sponge filters move little water at low velocity; a HOB turned down can
  keep media flow while lowering outlet velocity (AquaClear re-filtration, Tidal/Whisper flow
  controls down to 20–50 GPH).
- Evidence that current matters for some fish: water flow is aversive enough to be used as the
  aversive stimulus in B. splendens learning experiments (S29); larger caudal fins in selected
  bettas reduce burst swimming speed (S29); LiveAquaria/others advise slow flow for bettas, fry,
  long-finned fish (S19).
- Therefore the tool **should not state or imply that 10× filtration means 10× current**. A
  high-turnover result should be phrased as "high filter flow", with an optional note for
  slow-water species ("baffle or diffuse the outlet"), never as an incompatibility.
- Phase 2C already avoids scoring current from turnover; any new ">10×" band must keep that.
  Compatibility rules were not changed.

---

## 13. Current 2× threshold review

**Origin.** Pre-dates Phase 2C. It appears as the long-standing "turnover < 2× — upgrade
filtration" bar note and `TURNOVER_BANDS`-era engine logic (`_internal/reports/filtration-model-audit-2026-09.md`
lines 53–57). Phase 2C kept it explicitly as "a conservative 'is water moving through the media at
all' check; nothing in the research supports a different single number" (`FILTRATION_MODEL.md` §3,
§5). No external source for "2×" specifically was found; it is an internal convention.

**Is it defensible as a minimum?** Yes, as a *floor for "clearly undersized"*:
- For three of the four verified filters (OASE BioMaster 350 3.28×, AquaClear AC70 4.29×, Fluval
  307 4.33× at their maximum tanks), a result below 2× means the filter is well under its
  manufacturer's own sizing.
- **Exception:** the EHEIM Classic 2213 ✔ is rated for up to 66 gal with a *pump output* of 116 GPH,
  i.e. **1.76×** at its maximum stated tank. Even the manufacturer's pump figure is below the
  current 2× floor there. So the floor is *not* uniformly more lenient than manufacturer ratings,
  and "2× is roughly half of manufacturer recommendations" is not a safe general statement.
- The mass-balance illustration shows 2× of real flow is enough to move ordinary home-aquarium
  ammonia loads through media, if the media is sufficient.

**Is it overly permissive?** As the *only* signal, yes, in most cases. A filter at 2×–4× (rated) is
below the verified OASE, AquaClear and Fluval pump ratings at their maximum tanks and below the ~4×
husbandry consensus, yet the advisor shows a green "meets the 2× minimum". Heavy stocking at 2.1×
gets no signal.

**Is it inconsistent with manufacturers?** Yes, in both directions. On a 65-gal tank an EHEIM
2213 (116 GPH pump output) is **red at 1.78×** although EHEIM rates it for that tank, while a
Fluval 307 is green at 4.66× on pump output — and still only 3.17× on Fluval's own filter
circulation figure. Both catalog entries are pump-output figures, so this is not a basis mismatch
between them: it shows that manufacturers pair very different pump outputs with the same tank
size, and that pump output alone does not describe flow through media.

**Is a single number the wrong model?** A single turnover number is an incomplete model. A low
*floor* plus advisory bands, applied to a labelled flow basis, is a reasonable structure, but where
the floor sits (and whether a manufacturer's own tank rating should override it, as the EHEIM case
raises) is an open product decision (section 20).

---

## 14. 7×–10× hypothesis review

| Test | Result |
| --- | --- |
| Manufacturer support | **None** for freshwater filters. Verified pump/maximum-flow ratings at the maximum tank are 1.76× (EHEIM 2213), 3.28× (OASE BioMaster 350), 4.29× (AquaClear AC70), 4.33× (Fluval 307; 2.94× filter circulation); indexed figures ~2.8×–5.3×. Heterogeneous, and all below 7×. The only 10× found is Eheim's marine circulation guidance. |
| Husbandry support | **Well supported as a planted-tank circulation target:** 2Hr Aquarist ✔ recommends ~6×–10× **rated** filter flow for planted aquariums, for circulation, O₂/CO₂ distribution, nutrient delivery and surface/deep exchange. Not presented as a biological-filtration minimum. Calculators also cite 8–10× for heavy/messy stocking (unsourced). The mainstream general minimum is ~4× (circulation). |
| Scientific support | **None** as a nitrification requirement. Aquaculture evidence says required flow follows waste load, and per-pass efficiency falls with higher flow. |
| Consequence if adopted as a minimum | Fails all four verified filters at their maximum tanks; fails AquaClear 70 on a 55 (5.5×), Fluval 307 on a 55 (5.5× pump / 3.7× circulation), every sump run at modern 3–5×, and most indexed filters on their manufacturer-rated tanks. Users would be told to buy equipment no manufacturer says they need. |
| What 7×–10× legitimately describes | A **common rated-flow range** hobbyists choose for planted or heavily stocked tanks, or a **total circulation** target. |

Verdict: **7×–10× is not supported as a universal biological-filtration minimum.** 6×–10× rated
is well supported as a **planted-tank flow / circulation target** (2Hr Aquarist ✔). It belongs to
circulation guidance, not to filtration adequacy, and could at most be shown as planted-tank
circulation copy, not as a requirement.

---

## 15. Example tank simulations

Rated turnover = rated GPH ÷ tank gallons. "Est. media turnover" uses 0.6–0.8 of rated for a HOB
(assumption for illustration; no HOB maker publishes with-media flow). Model D is evaluated at two
Stocking Loads: 80 % (yellow band, `getBandColor`) and 100 % (orange band).

| Tank | Setup | Rated turnover | Est. media turnover | A (≥2×) | B (≥7×) | C (4/7/10) | D @80 % / @100 % (req 3× / 4×) | E / Recommended |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 10 gal, HOB 100 GPH | 10.0× | 6–8× | Adequate | Adequate | Good | Pass / Pass | Typical (4–10×) |
| B | 20 gal, HOB 100 GPH | 5.0× | 3–4× | Adequate | **Insufficient** | Marginal | Pass / Pass | Typical |
| C | 29 gal, HOB 150 GPH | 5.2× | 3.1–4.1× | Adequate | **Insufficient** | Marginal | Pass / Pass | Typical |
| D | 29 gal, HOB 300 GPH | 10.3× | 6.2–8.3× | Adequate | Adequate | High flow | Pass / Pass | High filter flow — info note only if a slow-water species is planned |
| E | 55 gal, HOB 200 GPH | 3.6× | 2.2–2.9× | Adequate | **Insufficient** | **Insufficient** | Pass / **Low** | **Low** (2–4×): info at ≤70 % load, amber above |
| F | 55 gal, HOB 400 GPH | 7.3× | 4.4–5.8× | Adequate | Adequate | Good | Pass / Pass | Typical |
| G | 75 gal, sump return 300 GPH measured + 750 GPH powerheads | 4.0× measured (≈6× rated-equivalent); circulation 14× | 4.0× | Adequate (powerheads correctly excluded) | **Insufficient** on filter flow; "adequate" only if powerheads were wrongly counted (14×) | Marginal | Pass / Pass | Sump: typical (3–5× measured); circulation shown separately |
| H | 20 gal, air sponge, water GPH unknown | unknown (catalog listing "120 GPH" → 6.0×) | unknown (plausibly ~1–3×) | Adequate *if* the listing number is typed; "No filter added" if left blank | Insufficient (6.0×) — on a fictional number | Marginal (6.0×) — on a fictional number | Pass — on a fictional number | Sponge: no turnover computed; check "sponge rated for ≥ 20 gal" |

Extra cases showing the flow-basis problem:

| Tank | Setup | Current model | Comment |
| --- | --- | --- | --- |
| I | 65 gal, EHEIM 2213 ✔ (116 GPH pump output) | **1.78× → red "too low"** | Within EHEIM's 66 gal rating. At 66 gal: 1.76×. Even the manufacturer's pump figure is below the 2× floor. |
| J | 65 gal, Fluval 307 ✔ (303 GPH pump output) | 4.66× → green | Fluval's filter circulation 206 GPH = 3.17×. Same tank, same basis (pump output) as I, very different result. |
| K | 70 gal, Fluval 307 ✔ at Fluval's own max | 4.33× pump (2.94× circulation) → green; B would say insufficient | Manufacturer-rated use would fail a 7× rule. |
| L | 90 gal, OASE BioMaster 350 ✔ at OASE's max | 3.28× → green; B insufficient; C insufficient | |
| M | 70 gal, AquaClear AC70 ✔ at its max | 4.29× → green; B insufficient; C marginal | HOB example. |

Observations: Model B fails B, C, E, G on sizes that are normal and manufacturer-endorsed; Model A
gives E the same green as F; neither model can say anything true about H.

---

## 16. Model A–E comparison

| Model | Advantages | Disadvantages | Evidence |
| --- | --- | --- | --- |
| **A — current (<2× too low)** | Simple; catches missing/absurdly small filters; no invented precision. | Silent on 2×–4× (below most verified manufacturer ratings); yet marks EHEIM 2213 ✔ red at its own maximum tank (1.76×); treats 2.1× and 10× the same; flow basis unlabelled; says "through media" when it is rated flow. | Low floor is defensible; nothing supports it as "adequate". |
| **B — simple 7×** | Simple; matches a popular hobby phrase. | Contradicts every verified manufacturer's sizing (1.76×–4.33× at max tank); fails modern sumps; mixes circulation guidance into biology; pushes purchases; still ignores flow basis. | Not supported (section 14). |
| **C — range (4/7/10)** | Graduated; 4× floor matches husbandry consensus; >10× "not automatically better" is a good message. | 4× as *insufficient* fails EHEIM 2213 (1.76×) and OASE BioMaster 350 (3.28×) at their rated max, and Fluval 307 on its filter-circulation figure (2.94×); "7–10 good" implies 5× is worse than 8× biologically, which is unsupported; single range for all types. | Structure supported; 7/10 cut-points are circulation numbers. |
| **D — stocking-load dependent** | Matches the mass-balance principle (need ∝ waste); lets a lightly stocked tank with modest flow stay quiet. | Specific steps are invented; risks implying more flow lets you stock more (must be worded against that). | Direction supported; numbers not. |
| **E — filter-type-aware** | Only model that handles sponges (no GPH) and sumps (measured return, big media) sensibly; can apply flow basis. | More UI inputs; catalog needs a `flowBasis` field; "Other" types still need a default. | Strongly supported for sponge and sump; weakly for HOB vs canister (difference is mostly flow basis). |

---

## 17. Recommended future filtration model (candidate — no production threshold selected)

A hybrid of A (floor), C (bands), D (severity only) and E (type-aware inputs). The band edges below
are **candidates for review**, anchored to manufacturer and husbandry figures, not biological
measurements. Given the heterogeneous verified manufacturer ratings (1.76×–4.33×), no threshold is
selected in this report; see section 20 (especially Q1–Q3a). Numbers are on a **rated** (pump
output / maximum flow) basis; circulation or measured entries need a basis label and a
product-decided conversion first. Powerheads never count. Filtration never changes Stocking Load.

Known conflict to resolve before shipping: a < 2× "too low" floor marks the EHEIM Classic 2213 ✔ red
at its manufacturer's maximum tank (1.76×).

**Powered biological filters (HOB, canister, internal, powerhead-UGF, other):**

| Rated-equivalent filter turnover | Status | Severity |
| --- | --- | --- |
| < 2× | Too low | red (current floor; see conflict above) |
| 2× – < 4× | Low for this tank | **info** at Stocking Load ≤ 70 %; **amber** above 70 % |
| 4× – 10× | Typical | none (green) |
| > 10× | High filter flow | none; neutral note only if a low-flow species is planned ("diffuse or baffle the outlet"); never a compatibility warning |

**Sponge (air-driven):** no GPH, no turnover. Input = count × manufacturer "rated up to N gal".
Adequate if Σ rated gallons ≥ tank gallons; info/amber (by load) if below; red only if none.

**Sump / wet-dry:** input = return flow as delivered (or rated + head height, derated ~10 %/ft).
Bands on measured basis: < 1.5× too low, 1.5×–3× low (severity by load), ≥ 3× typical.
(Weaker evidence: marine-derived; freshwater guidance is a lead only.)

**Circulation (powerheads, wavemakers):** shown as its own line ("+750 GPH circulation"); never
counted as filtration; never scored.

Stocking Load > 110 % is its own warning; no filtration result can soften it.

---

## 18. Recommended future UI (wording proposals — not built)

The brief's first example ("✓ Adequate … Target 7×–10× / hour") is **not recommended**: it presents
a circulation/rated range as a biological target and would contradict manufacturer ratings.

Proposed result card:

```
Filtration                                    ✓ Typical
Filter flow (rated): 5.2× / hour  ·  150 GPH on 29 gal
Typical range: 4×–10× rated
Filtration supports your livestock but does not increase stocking capacity.
```

```
Filtration                                    ⚠ Low for this stock
Filter flow (rated): 3.6× / hour  ·  200 GPH on 55 gal
This is below the flow many filters sold for this tank size provide.
At this stocking level, consider a larger filter or a second filter.
Filtration supports your livestock but does not increase stocking capacity.
```

```
Filtration                                    ✕ Too low
Filter flow (rated): 1.4× / hour  ·  40 GPH on 29 gal
This filter is much smaller than this tank needs. Check the GPH value, or add a filter sized for this tank.
Filtration supports your livestock but does not increase stocking capacity.
```

```
Filtration                                    ✓ Typical · high flow
Filter flow (rated): 10.3× / hour  ·  300 GPH on 29 gal
High filter flow is fine for filtration. Bettas and long-finned fish prefer gentle water:
a spray bar, sponge on the outlet or turning the flow down keeps current low.
Filtration supports your livestock but does not increase stocking capacity.
```

```
Filtration                                    ✓ Sponge filter
Rated for up to 20 gal (1 sponge) on a 20 gal tank
Sponge filters are sized by tank volume; water flow isn't estimated.
Filtration supports your livestock but does not increase stocking capacity.
```

Wording rules: always say **"rated"** or **"measured"** beside a turnover; never say "through
media" for a rated number; never show a turnover for a sponge; show circulation on a separate line;
the permanent line "Filtration supports your livestock but does not increase stocking capacity."
stays on every state.

---

## 19. Uncertainties

- Page fetches were blocked in the build environment. Only the ✔ sources (EHEIM 2213 manual,
  Fluval canister series table, AquaClear AC series page, OASE BioMaster 350 page, 2Hr Aquarist
  checklist and flow-setup pages) were verified directly; all other Tier 1 numbers came from indexed
  text or retailer copies and should be re-verified before any threshold ships.
- An earlier draft described the EHEIM 2213's 116 GPH as a with-media figure, based on a
  third-party review. The EHEIM manual labels it *pump output*; the report now uses that. The
  Sicce "with media and head" claim rests on a similar relay and is unverified.
- Eheim's freshwater turnover guidance (S6) could not be read.
- No verified HOB manufacturer publishes a with-media or operating flow (AquaClear ✔ gives maximum flow only); the 0.6–0.8 HOB estimate is an assumption.
- Only one pump-output → filter-circulation ratio is verified (Fluval 307: 0.68); other ratios are
  search-indexed. No conversion factor is established.
- Verified manufacturer ratings are heterogeneous (1.76×–4.33× at maximum tank); four verified
  filters are too few to characterise "the industry".
- Freshwater sump turnover guidance is weak (marine-derived + forum leads).
- The mass-balance illustration uses assumed feed, protein, target TAN and single-pass removal;
  home-aquarium single-pass removal at very low TAN has not been measured in any source found.
- Sponge airlift efficiency for ordinary commercial sponges is uncharacterised.
- Flow loss from fouling between cleanings is qualitative only.
- The 2×/4×/10× band edges are judgement calls anchored to manufacturer sizing and husbandry
  consensus, not biological measurements.

---

## 20. Questions requiring a product decision

1. Should the "low" band (2×–4× rated) be shown at all, and at what severity (info vs amber)?
2. Should its severity depend on Stocking Load (recommended), and at which band edge (70 %?)?
3. Is the advisor willing to store a `flowBasis` per catalog filter (`pump` | `circulation` |
   `measured`) and label it in the UI?
3a. When the turnover floor contradicts a manufacturer's own tank rating (EHEIM 2213 ✔: 1.76× at
   66 gal), which wins — the floor, the manufacturer rating, or a softer "below the advisor's
   minimum but within the manufacturer's rating" message?
4. Custom entries: add a "rated / measured" toggle, or assume rated?
5. Sponge filters: switch the input to "rated for up to __ gal" × count and stop computing GPH?
   What happens to existing saved states that carry a sponge GPH?
6. Add a sump type with "delivered return flow" input, or keep sumps as "Other"?
7. Show a ">10× high flow" note for low-flow species (betta, gourami, long-fin), or stay silent?
8. Show "Typical range 4×–10× rated" as copy, or show no range?
9. How should the filter catalog be corrected (see Appendix A — scheduled as separate next work)?
10. Should the warning text stop saying "through filter media" for rated flow now (copy-only fix)?

---

## Appendix A. Next work — filter catalog audit (separate from the research conclusions)

This is a data-quality finding about the advisor's own catalog, not a research conclusion about
turnover. **It is not fixed in this branch.**

Before the future filtration-status UI is implemented, the Stocking Advisor filter catalog
(`assets/data/gear/filters.json`) should be audited against manufacturer tank ratings and flow
specifications:

- **Tank ranges do not match manufacturer ratings.** The catalog's `minGallons` / `maxGallons`
  appear to be derived from flow (≈ GPH ÷ 16 to GPH ÷ 6, i.e. an implied ~6×–16× turnover), not
  taken from the manufacturer. Example: **AquaClear 70** appears in the catalog as **19–49 gal**;
  the manufacturer's official rating is **40–70 US gal** ✔. The same pattern affects every entry
  checked (e.g. Fluval 307 catalog 19–50 gal vs Fluval ✔ 40–70 gal; EHEIM 2213 catalog 7–19 gal vs
  EHEIM ✔ up to 66 gal). These ranges are shown to users in the filter picker.
- **Flow basis is not recorded.** `gphRated` holds pump output / maximum flow for the verified
  entries, but there is no field saying so, and no place for a manufacturer "filter circulation"
  figure (Fluval) or a measured value.
- **Sponge filter GPH values** (60–200) come from listing copy and are tank-size marketing, not
  flow (section 7).
- **Duplicates** (e.g. two Fluval 407 rows, two AquaClear 70 rows, two Tidal 55 rows) should be
  reconciled.

Suggested audit output per entry: manufacturer, model, official tank range (with source URL),
published flow figure(s) with their labels (pump output / maximum flow / filter circulation),
filter type, and whether the catalog value matches.
