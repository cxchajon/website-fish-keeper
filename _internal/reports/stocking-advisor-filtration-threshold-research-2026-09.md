# Stocking Advisor — filtration adequacy threshold research (2026-09)

Research / model audit only. **No production logic, threshold, UI, bioload or species data was
changed.** `MIN_BIOLOGICAL_TURNOVER` is still `2` (`js/stocking-advisor/filtration/math.js:35`).

Question investigated: is the Phase 2C floor of **2× tank volume per hour through biological
media** appropriate, or is a target of **7×–10×** better supported?

Method note: full-page fetches from this build environment are blocked by the network egress
policy (same limitation recorded in `FILTRATION_MODEL.md` §5). Every figure below was taken from
search-indexed text of the cited page (product listings, manufacturer pages, abstracts). Figures
that could only be traced to a retailer or forum relay are marked as such. Before any threshold is
shipped, the Tier 1 figures should be re-checked on the live manufacturer pages or manuals.

---

## 1. Executive summary

1. **The 7×–10× figure is a circulation / rated-flow rule of thumb, not a biological-filtration
   requirement.** Where sources say what it measures, 7×–10× (and 10×) refers to either
   *advertised* flow chosen with headroom (2Hr Aquarist: "rated 6×–10×" so that installed flow lands
   at ~5–7×) or *total circulation* for planted CO₂ distribution or reef tanks (Eheim's 10×
   recommendation is in its **marine** guide and is for circulation).
2. **Manufacturers themselves size filters well below 7×.** At the maximum tank size each
   manufacturer recommends, advertised turnover is ~3.6×–5.3× for HOBs and canister *pump output*,
   and **~1.8×–3.2× for the canister "with media" figures** that Fluval, Eheim and Sicce publish.
   A 7× requirement would mark nearly every major filter as "insufficient" on the tank sizes its
   manufacturer sells it for.
3. **Nitrification capacity is set mainly by colonised media surface, oxygen and the ammonia
   supplied, not by turnover.** Aquaculture work shows single-pass ammonia removal *falls* as
   flow rises, and required flow scales with feed/waste (TAN) production, not with tank volume.
   A mass-balance estimate for ordinary home-aquarium feeding gives a flow requirement of roughly
   0.5×–4× (section 11). No source found gives a measured biological minimum for home aquaria.
4. **2× is defensible as a floor ("this filter is far too small for this tank"), not as a
   target.** It is roughly half of what manufacturers' own tank ratings imply. It is permissive:
   a filter entered at 2.1× is about half the size its manufacturer would recommend. The larger
   problem is that the **flow basis is inconsistent**: the catalog mixes pump output without media
   (Fluval 307 = 303 GPH) with with-media figures (Eheim 2213 = 116 GPH). With the same 2× floor,
   an Eheim 2213 on a 65-gal tank — within Eheim's own 250 L rating — is shown red today.
5. **One universal number is the wrong model.** Filter type (especially sponge and sump), the flow
   basis (rated vs with-media vs measured) and stocking load all change what a number means.
6. **Recommended future model:** keep a hard "too low" floor near 2× (rated basis), add an
   advisory "low" band of 2×–4× (rated), call 4×–10× "typical", show >10× as "high filter flow —
   not a problem for filtration; check current for slow-water fish". Make the "low" band's
   severity depend on Stocking Load. Handle sponge filters and sumps separately. Never count
   powerheads. Never let filtration change Stocking Load.
7. **There is not enough evidence to implement a precise new pass/fail threshold such as 7×.**
   There is enough to implement the *structure* above (flow basis, type-awareness, advisory
   bands), once the product questions in section 20 are answered.

---

## 2. Definitions

These are used strictly throughout this report.

| Term | Meaning | What the Stocking Advisor has today |
| --- | --- | --- |
| **Filter rated flow** | Manufacturer-advertised GPH/LPH. For most brands this is *pump output with no media, no hoses, zero head*. Some brands (Eheim, Sicce) state that their figure is *with media*. | `gphRated` in `assets/data/gear/filters.json`; user-typed GPH for custom filters. Basis not recorded. |
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
as leads or measured anecdotes).

| # | Source | Tier | Figure | What the figure measures |
| --- | --- | --- | --- | --- |
| S1 | Fluval 07 series spec pages — https://fluvalaquatics.com/us/shop/product/07-series ; 307: https://fluvalaquatics.com/us/shop/product/307-canister-filter-40-70-us-gal-90-330-l ; 207: https://fluvalaquatics.com/us/shop/product/207-canister-filter-20-45-us-gal-60-220-l ; 107: https://fluvalaquatics.com/us/shop/product/107-canister-filter-10-30 ; 407: https://fluvalaquatics.com/ca/shop/product/407-canister-filter-50-100-us-gal-150-500-l | 1 | Pump output vs "filter circulation" (with media) + tank range | Rated pump output AND manufacturer with-media flow |
| S2 | Fluval FX4 — https://fluvalaquatics.com/us/shop/product/fx4-canister-filter-up-to-250-us-gal-1000-l | 1 | 700 GPH pump / 450 GPH filter circulation, up to 250 gal | Both bases |
| S3 | Eheim Classic 250 (2213) listings — https://www.finestaquatics.co.uk/eheim-classic-250-external-filter-2213 ; https://greenaqua.hu/en/eheim-2213-classic-without-filter-media.html ; review noting Eheim measures with media: https://www.aquariadise.com/review-eheim-classic-250-external-canister-filter/ | 1 (spec) / 3 (basis note) | 440 L/h, up to 250 L | Stated as with media |
| S4 | Eheim professionel 4+ 350 (2273) — https://watermarque.co.uk/product/eheim-professionel-4-350-external-filter-2273/ | 1 (retailer copy of spec) | 1050 L/h max pump output, 180–350 L | Pump output ("max") |
| S5 | Eheim marine guide PDF — https://eheim.com/media/pdf/94/7c/3e/7994820_EHEIM_Ratgeber_Meerwasser_GB_0918.pdf | 1 | "circulation … about ten times the volume of the tank per hour" | **Total circulation, marine** |
| S6 | Eheim freshwater guide PDF — https://eheim.com/media/pdf/68/e4/dd/7991220_Ratgeber_EHEIM_Aquarien_GB_2019.pdf | 1 | Exists; turnover figure not recoverable from indexed text | — (needs manual check) |
| S7 | OASE BioMaster 250 — https://us.oase.com/products/biomaster-2-250-94718 ; https://store.oase-usa.com/products/oase-biomaster-250 | 1 | 900 L/h (250 GPH), up to 250 L, max head 1.7 m | Max pump output |
| S8 | Sicce Whale series — https://fresh.bulkreefsupply.com/whale-200-canister-filter-190-gph-sicce.html ; https://www.saltwateraquarium.com/whale-500-aquarium-canister-filter-80-135-gal-390-gph-sicce/ | 1 (retailer copy) | Whale 200: 190 GPH, 25–50 gal; Whale 500: 390 GPH, 80–135 gal; Sicce says flow measured with media and head | With media + head (manufacturer claim) |
| S9 | Seachem Tidal 55 — https://www.seachem.com/tidal-55.php ; manual: https://www.sicce.com/media/wysiwyg/ISTRUZIONI/80N567-A_Tidal_instructions.pdf | 1 | 250 GPH, up to 55 gal; adjustable down to ~50 GPH | Rated (basis not stated) |
| S10 | AquaClear 70 — https://fluvalaquatics.com/us/shop/product/fluval-aquaclear-70-power-filter-with-media-40-70-us-gal-152-265-l | 1 | 300 GPH, 40–70 gal; flow control; "up to 50 % of the water … processed multiple times" when reduced | Rated; flow control re-circulates inside the box |
| S11 | Tetra Whisper IQ 45 — https://www.tetra-fish.com/products/filtration/whisper-iq-power-filters.aspx | 1 | 215 GPH, up to 45 gal; adjustable to ~20 GPH | Rated |
| S12 | MarineLand Penguin 350 — retailer listings (e.g. https://www.dfwaquarium.com/Products/Hang-On-Filters/Penguin-350-Power-Filter-50-to-75-gal-350-gph.html) | 1 (retailer copy) | 350 GPH, 50–70 (or 75) gal | Rated |
| S13 | Aqueon QuietFlow 75 — https://www.chewy.com/aqueon-quietflow-led-pro-aquarium/dp/185108 | 1 (retailer copy) | 400 GPH, up to 75–90 gal | Rated |
| S14 | hygger HOB (105/210/315 GPH) — https://www.amazon.com/hygger-Aquarium-Adjustable-Extendable-External/dp/B0DCS2731J | 1 (listing) | 105 GPH 10–20 gal; 210 GPH 20–40; 315 GPH 40–75 | Rated |
| S15 | Hikari Bacto-Surge — https://tkaquatics.com/products/hikari-aquarium-solutions-bacto-surge-foam-filter-mini-up-to-10-gallons | 1 (listing) | Rated by tank size only (Mini ≤10 gal … XL ≤125 gal); **no GPH** | Tank size only |
| S16 | Aquarium Co-Op sponge sizes — https://www.aquariumcoop.com/blogs/faqs/sponge-filter-sizes | 2 | Rated by tank size only | Tank size only |
| S17 | Swiss Tropicals BetterBoxFilter / Jetlifter — https://www.swisstropicals.com/filtration-shop/betterboxfilter/ ; https://www.reef2rainforest.com/2017/12/15/the-new-betterboxfilter-from-swiss-tropicals/ | 1 | ~50 L/h air; water:air ≈ 4:1 for their optimised airlift; Jetlifter large 300–500 L/h | Airlift water flow (manufacturer, optimised design) |
| S18 | Aquarium Co-Op, water circulation — https://www.aquariumcoop.com/blogs/aquarium/water-circulation | 2 | "at least four times an hour … a filter **and/or powerhead**" | **Total circulation**, rated |
| S19 | LiveAquaria, flow rate — https://www.liveaquaria.com/blogs/water-movement/choosing-the-proper-flow-rate-for-your-aquarium | 2 | ~4× per hour on average; "biological and chemical media often work better at a rate of 4 times an hour or less"; slow flow for bettas/fry | Pump + filter (circulation), rated |
| S20 | 2Hr Aquarist — https://www.2hraquarist.com/blogs/filters-overview/filter-buying-checklist ; https://www.2hraquarist.com/blogs/filters-overview/6-features-of-an-ideal-planted-tank-filter | 2 | "rated 6×–10×" so installed lands ~5–7×; ~10× target for planted circulation | **Rated** filter flow for planted **circulation / CO₂ distribution** |
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

| Filter | Type | Rated flow | Max tank | Implied turnover at max | Basis of the flow figure | Flow loss mentioned? | Flow control |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fluval 107 | Canister | 145 GPH pump / 95 GPH with media | 30 gal | **4.8×** pump / **3.2×** media | Both published | Yes (two figures) | Valve |
| Fluval 207 | Canister | 206 / 121 | 45 gal | **4.6× / 2.7×** | Both | Yes | Valve |
| Fluval 307 | Canister | 303 / 206 | 70 gal | **4.3× / 2.9×** | Both | Yes | Valve |
| Fluval 407 | Canister | 383 / 245 | 100 gal | **3.8× / 2.5×** | Both | Yes | Valve |
| Fluval FX4 | Canister | 700 / 450 | 250 gal | **2.8× / 1.8×** | Both | Yes | — |
| Eheim Classic 2213 | Canister | 440 L/h (116 GPH) | 250 L (66 gal) | **1.8×** | With media (Eheim) | Implicitly (figure is post-media) | Valve on hoses |
| Eheim Pro 4+ 350 | Canister | 1050 L/h max | 350 L | **3.0×** (pump) | "max" pump output | Not stated in indexed text | Valve |
| OASE BioMaster 250 | Canister | 900 L/h | 250 L | **3.6×** | Max pump output | Max head 1.7 m published | — |
| Sicce Whale 200 | Canister | 190 GPH | 50 gal | **3.8×** | With media + head (Sicce) | Yes | — |
| Sicce Whale 500 | Canister | 390 GPH | 135 gal | **2.9×** | With media + head | Yes | — |
| AquaClear 30 / 50 / 70 | HOB | 150 / 200 / 300 GPH | 30 / 50 / 70 gal | **5.0× / 4.0× / 4.3×** | Rated | No | Yes — reduced flow re-circulates up to 50 % inside the box |
| Seachem Tidal 35 / 55 / 75 / 110 | HOB | 130 / 250 / 350 / 450 GPH | 35 / 55 / 75 / 110 gal | **3.7× / 4.5× / 4.7× / 4.1×** | Rated | No | Yes, down to ~50 GPH (Tidal 55) |
| Tetra Whisper IQ 45 | HOB | 215 GPH | 45 gal | **4.8×** | Rated | No | Yes, to ~20 GPH |
| MarineLand Penguin 350 | HOB | 350 GPH | 70–75 gal | **4.7×–5.0×** | Rated | No | — |
| Aqueon QuietFlow 75 | HOB | 400 GPH | 75–90 gal | **4.4×–5.3×** | Rated | No | — |
| hygger HOB S / M / L | HOB | 105 / 210 / 315 GPH | 20 / 40 / 75 gal | **5.3× / 5.3× / 4.2×** | Rated | No | Yes |
| Hikari Bacto-Surge, Aquarium Co-Op, AQUANEAT sponges | Sponge (air) | none published by Hikari / Co-Op | by tank size | **not computable** | — | — | Air valve |
| Swiss Tropicals BetterBoxFilter / Jetlifter | Airlift | ~4 L water per 1 L air; Jetlifter L 300–500 L/h | — | — | Manufacturer, optimised airlift | — | Air rate |

Findings:

- **No manufacturer found sizes a freshwater filter at 7×–10× of its maximum tank.** HOB ratings
  cluster at ~4×–5× rated; canister pump ratings at ~3×–5×; published with-media figures at
  ~1.8×–3.2×.
- Brands that publish two figures (Fluval) show with-media flow at **59 %–68 %** of pump output.
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
| 2Hr Aquarist (S20) | Rated 6×–10×, installed ~5–7×; ~10× planted target | Rated filter flow chosen for planted circulation |
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

- The 5×–10× planted-tank numbers (S20, S21) are justified by **CO₂ and nutrient distribution, O₂
  at night, and avoiding dead spots** — i.e. circulation. 2Hr Aquarist explicitly frames 6×–10×
  as *rated* flow chosen so that *installed* flow is ~5–7×.
- These numbers are frequently met with powerheads/circulation pumps plus a smaller filter, which
  the planted-tank sources accept.
- Therefore **planted 5×–10× is a circulation recommendation, not a minimum biological filtration
  requirement.** Heavily planted tanks, if anything, need less biological filtration (plants take
  up ammonium), though the advisor should not give credit for that either (it cannot see plant
  mass).
- If a planted-tank circulation hint is ever added, it belongs to the circulation line (all
  devices), not to filtration adequacy.

---

## 10. Rated vs actual flow

| Cause | Evidence | Typical effect |
| --- | --- | --- |
| Media (clean) | Fluval with-media vs pump: 59 %–68 % (S1, S2) | −32 % to −41 % |
| Media + hoses (JBL manuals, relayed) | ~50 % of pump rating (S31) | −50 % |
| Installed per manual (relayed) | Eheim 3e 59 %, Fluval G3 54 %, G6 41 % (S30) | −41 % to −59 % |
| Measured by users (anecdote) | 66 % of rated; one thread 25 % (S30) | wide |
| Head height | ~10 % of rated per foot for return pumps (S22); OASE/Fluval publish max head 1.7–2.1 m | significant on sumps, small on HOBs |
| Elbows/valves/spray bars/intake sponges | ~0.5 ft head per elbow (S22); spray bars and pre-filter sponges add restriction (no quantified source) | unquantified |
| Fouling between cleanings | Qualitative only in sources found | progressive; can be large |

Brands differ in what the rated figure *means*: Eheim and Sicce say with media; Fluval publishes
both; most HOB brands publish only a rated (unstated-basis) number. **The same "200 GPH" can mean
~120 GPH or ~200 GPH through media.** The current catalog stores Fluval 307 at 303 (pump) and
Eheim 2213 at 116 (with media) with no basis field.

Options:

- **A. Trust user GPH directly.** Simple; consistent with hobby rules that are themselves stated
  in rated flow. Inconsistent across brands.
- **B. Rated GPH × fixed derating.** Any single factor (0.5–0.7) is invented precision for HOBs;
  it double-derates Eheim/Sicce with-media figures.
- **C. Ask whether entered GPH is rated or measured.** Captures the biggest source of error for
  custom entries; most users will say "rated".
- **D. Different assumptions by filter type / by catalog flow basis.** Best fidelity for catalog
  products where the basis is published.

**Recommendation: C + D, not B.** Keep thresholds expressed on a *rated* basis (because the
husbandry and manufacturer numbers are rated numbers), record `flowBasis` per catalog item
(`pump` | `withMedia` | `measured`), convert with-media/measured entries up to a rated-equivalent
for comparison (÷ ~0.65, the Fluval-published median), and show the user "rated" or "with media"
next to the number. Do not silently derate.

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
- It is about half the rated turnover manufacturers imply at their maximum tank size (≈ 3.6×–5.3×),
  so a filter below 2× is roughly less than half the size its maker would sell for that tank.
- The mass-balance illustration shows 2× of real flow is enough to move ordinary home-aquarium
  ammonia loads through media, if the media is sufficient.

**Is it overly permissive?** As the *only* signal, yes. A filter at 2.0×–4× (rated) is below every
manufacturer rating and below the ~4× husbandry consensus, and the advisor currently shows that as
a green "meets the 2× minimum". Heavy stocking at 2.1× gets no signal.

**Is it inconsistent?** Yes — because of flow basis, not the number. An Eheim 2213 (116 GPH with
media) on a 65-gal tank is red at 1.8×, while a Fluval 307 on the same tank is green at 4.7×
(pump figure) even though its with-media flow (206 GPH, 3.2×) is the more comparable number.

**Is a single number the wrong model?** A single *pass/fail* number is the wrong model; a single
*floor* plus advisory bands, applied to a consistent flow basis, is reasonable.

---

## 14. 7×–10× hypothesis review

| Test | Result |
| --- | --- |
| Manufacturer support | **None** for freshwater filters. All major brands rate filters at ~2×–5× of their max tank. The only 10× found is Eheim's marine circulation guidance. |
| Husbandry support | Partial: 6×–10× appears as **rated** flow for **planted circulation** (2Hr Aquarist), and in calculators for heavy/messy stocking. The mainstream minimum is ~4×. |
| Scientific support | **None** as a nitrification requirement. Aquaculture evidence says required flow follows waste load, and per-pass efficiency falls with higher flow. |
| Consequence if adopted as a minimum | Fails AquaClear 70 on a 55 (5.5×), Fluval 307 on a 55 (5.5× pump / 3.7× media), every sump run at modern 3–5×, and most filters on their manufacturer-rated tanks. Users would be told to buy equipment no manufacturer says they need. |
| What 7×–10× legitimately describes | A **common rated-flow range** hobbyists choose for planted or heavily stocked tanks, or a **total circulation** target. |

Verdict: **7×–10× is not supported as a biological-filtration minimum.** It is a reasonable
description of a *generous* rated filter-flow or total-circulation range, and could be shown as
"common range" copy, not as a requirement.

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
| I | 65 gal, Eheim 2213 (116 GPH, with media) | **1.8× → red "too low"** | Within Eheim's 250 L rating. Rated-equivalent ≈ 2.7×. |
| J | 65 gal, Fluval 307 (303 GPH pump) | 4.7× → green | With-media 206 GPH = 3.2×, i.e. *more* real flow than I but not dramatically. |
| K | 70 gal, Fluval 307 at Fluval's own max | 4.3× → green; B would say insufficient | Manufacturer-rated use would fail a 7× rule. |

Observations: Model B fails B, C, E, G on sizes that are normal and manufacturer-endorsed; Model A
gives E the same green as F; neither model can say anything true about H.

---

## 16. Model A–E comparison

| Model | Advantages | Disadvantages | Evidence |
| --- | --- | --- | --- |
| **A — current (<2× too low)** | Simple; never over-warns; catches missing/absurdly small filters; no invented precision. | Silent on 2×–4× (below every manufacturer rating); treats 2.1× and 10× the same; rated basis inconsistent across brands; says "through media" when it is rated flow. | Floor is defensible; nothing supports it as "adequate". |
| **B — simple 7×** | Simple; matches a popular hobby phrase. | Contradicts every manufacturer's sizing; fails modern sumps; mixes circulation guidance into biology; pushes purchases; still ignores flow basis. | Not supported (section 14). |
| **C — range (4/7/10)** | Graduated; 4× floor matches husbandry consensus; >10× "not automatically better" is a good message. | 4× as *insufficient* fails most canisters at their rated max (2.5×–3.2× with media); "7–10 good" implies 5× is worse than 8× biologically, which is unsupported; single range for all types. | Structure supported; 7/10 cut-points are circulation numbers. |
| **D — stocking-load dependent** | Matches the mass-balance principle (need ∝ waste); lets a lightly stocked tank with modest flow stay quiet. | Specific steps are invented; risks implying more flow lets you stock more (must be worded against that). | Direction supported; numbers not. |
| **E — filter-type-aware** | Only model that handles sponges (no GPH) and sumps (measured return, big media) sensibly; can apply flow basis. | More UI inputs; catalog needs a `flowBasis` field; "Other" types still need a default. | Strongly supported for sponge and sump; weakly for HOB vs canister (difference is mostly flow basis). |

---

## 17. Recommended future filtration model

A hybrid of A (floor), C (bands), D (severity only) and E (type-aware inputs). All numbers are on a
**rated-equivalent** basis (with-media/measured flows divided by 0.65 first). Powerheads never count.
Filtration never changes Stocking Load.

**Powered biological filters (HOB, canister, internal, powerhead-UGF, other):**

| Rated-equivalent filter turnover | Status | Severity |
| --- | --- | --- |
| < 2× | Too low | red (unchanged floor) |
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
Most filters sold for this tank size are rated 4× or more.
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

- Page fetches were blocked; every Tier 1 number came from indexed text or retailer copies of
  manufacturer specs. Re-verify before shipping.
- Eheim's freshwater turnover guidance (S6) could not be read.
- No manufacturer publishes with-media flow for HOBs; the 0.6–0.8 HOB estimate is an assumption.
- The 0.65 rated-equivalent factor is the median of Fluval's published pairs only.
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
3. Is the advisor willing to store a `flowBasis` per catalog filter and normalise with-media
   figures (fixes the Eheim 2213 red-at-rated-size case)?
4. Custom entries: add a "rated / measured" toggle, or assume rated?
5. Sponge filters: switch the input to "rated for up to __ gal" × count and stop computing GPH?
   What happens to existing saved states that carry a sponge GPH?
6. Add a sump type with "delivered return flow" input, or keep sumps as "Other"?
7. Show a ">10× high flow" note for low-flow species (betta, gourami, long-fin), or stay silent?
8. Show "Typical range 4×–10× rated" as copy, or show no range?
9. The catalog's displayed gallon range (`minGallons`/`maxGallons` ≈ GPH ÷ 16 to GPH ÷ 6, e.g.
   AquaClear 70 shown as 19–49 gal vs the manufacturer's 40–70) implies ~6×–16× and conflicts with
   both manufacturer ratings and the 2× floor. Replace with manufacturer ranges, or hide?
10. Should the warning text stop saying "through filter media" for rated flow now (copy-only fix)?
