/* Ranges used for matching/highlighting */
const RANGES_HEATERS = [
  { id:"g-5-10",   label:"5–10 gallons",  min:5,  max:10 },
  { id:"g-10-20",  label:"10–20 gallons", min:10, max:20 },
  { id:"g-20-40",  label:"20–40 gallons", min:20, max:40 },
  { id:"g-40-60",  label:"40–60 gallons", min:40, max:60 },
  { id:"g-60-90",  label:"60–90 gallons", min:60, max:90 },
  { id:"g-90-125", label:"90–125 gallons",min:90, max:125 }
];

const RANGES_FILTERS = RANGES_HEATERS.slice(); // same gallon buckets

const RANGES_LIGHTS = [
  { id:"l-12-20",  label:"12–20 inches",  min:12, max:20 },
  { id:"l-20-24",  label:"20–24 inches",  min:20, max:24 },
  { id:"l-24-30",  label:"24–30 inches",  min:24, max:30 },
  { id:"l-30-36",  label:"30–36 inches",  min:30, max:36 },
  { id:"l-36-48",  label:"36–48 inches",  min:36, max:47.99 },
  { id:"l-48-up",  label:"48 inches and up",  min:48, max:999 }
];

/* Category tips shown on the “i” buttons */
const TIPS = {
  heaters: "Choose a heater whose printed range starts at (or just above) your tank size. Example: for a 40-gallon tank, prefer 40–60 gal over 20–40. Bonus safety: use a temp controller. Remember to account for tank height, substrate thickness, and whether the heater has a water level mark — most are not fully submersible.",
  filters: "Oversize your filter. A 40–60 gal filter on a 40-gal tank keeps water clearer. Keep biomedia; replace only mechanical floss.",
  lights: `
  <strong>Lighting Tips</strong><br>
  Match your light to your <strong>tank length</strong>, not just gallons.<br>
  It’s often better to go <strong>slightly longer</strong> than your tank to prevent dark corners and dead spots.<br>
  For <strong>planted tanks</strong>, check PAR and spectrum ratings — high PAR supports carpet plants, while moderate PAR works for most setups.<br>
  For <strong>long tanks</strong>, consider two fixtures or one high-output unit to ensure even coverage end to end.<br>
  For <strong>tall tanks</strong>, look for higher lumen or PAR ratings since light intensity drops quickly with depth — especially if you’re keeping rooted or carpet plants.
`,
  substrate:`
  <strong>What Is a Dirt Cap?</strong><br>
  A <strong>dirt cap</strong> is a protective top layer — typically gravel or sand — placed over nutrient-rich soil in planted tanks.<br>
  It keeps organic material in place, prevents clouding, and stops fish from disturbing the base soil.<br>
  Caps also improve appearance and create a natural gradient between planted and open areas.<br>
  Typical thickness: <strong>1–2 inches</strong> of gravel or sand above the soil layer.
`,
  'water-treatments': `
  Dose for <strong>total tank volume</strong>, not just replacement water.<br>
  Avoid mixing brands of cycle boosters at once.<br>
  If your city uses chloramine, choose a conditioner that binds ammonia.
`,
  food: `
  <strong>Rotate 2–3 foods</strong>; feed only what’s eaten within ~30–60 seconds.<br>
  For bottom dwellers, use sinking foods; for shrimp, micron foods.<br>
  Overfeeding → ammonia → nitrates → algae.
`,
  'maintenance-tools': `
  Keep a dedicated kit for testing, cleaning, and safety so gear is ready for every water change.<br>
  Expand each subgroup for best-practice reminders and trusted tools.
`
};

/* Seed data — text links only. 
   We start with one confirmed link from the user under Heaters → 5–10 gallons → Option 1. 
   Leave TODO slots for Option 2/3 and other ranges to be filled as the user supplies links.
*/
const GEAR = {
  heaters: {
    match: "gallons",
    ranges: [
      {
        id: "g-5-10",
        label: "Recommended Heaters for 5–10 Gallons",
        tip: "For 5–10 gal, target 25–50W. Place near gentle flow for even heat.",
        options: [
          {
            label: "Option 1",
            title: "Hitop 50W Adjustable Aquarium Heater, Submersible Glass Water Heater for 5–15 Gallon Fish Tank",
            href: "https://amzn.to/3KFMlOx"
          },
          {
            label: "Option 2",
            title: "hygger Mini Fish Tank Submersible Heater 50W for 5–10 Gallons Small Betta Aquarium Heater with Digital Display Controller Adjustable Temperature",
            href: "https://amzn.to/479AuRA"
          },
          {
            label: "Option 3",
            title: "hygger Aquarium Heater, Upgraded Ceramic 50W Small Fish Tank Heater with Digital LED Controller, Fast Heating, Precise Temperature Control, Turtle Tank Heater for Freshwater/Saltwater",
            href: "https://amzn.to/3KBKiLp"
          }
        ]
      },
      {
        id: "g-10-20",
        label: "Recommended Heaters for 10–20 Gallons",
        tip: "For 10–20 gal, aim for 50–100W.",
        options: [
          {
            label: "Option 1",
            title: "Hitop 100w Adjustable Aquarium Heater, Submersible Glass Water Heater for 10 – 30 Gallon Fish Tank",
            href: "https://amzn.to/4nXCmT2"
          },
          {
            label: "Option 2",
            title: "Fluval M 50-Watt Submersible Aquarium Heater – Compact, Reliable Heating with Mirror Technology for Fresh & Saltwater Tanks Up to 15 Gallons",
            href: "https://amzn.to/4pTvtnA"
          },
          {
            label: "Option 3",
            title: "hygger Aquarium Heater, Submersible Fish Tank Heater 100W with Digital LED Controller, Memory Function, Auto Shut Off Protection, Heater for Saltwater Freshwater Fish Tank",
            href: "https://amzn.to/46DNSxo"
          }
        ]
      },
      {
        id: "g-20-40",
        label: "Recommended Heaters for 20–40 Gallons",
        tip: "For 20–40 gal tanks, aim for 100–200W. When placing your heater, account for tank height, substrate depth, and water line markings. Most shouldn’t touch the substrate, and not all are fully submersible. Place near gentle flow for even heat.",
        options: [
          {
            label: "Option 1",
            title: "Hitop 300W Aquarium Heater, Submersible Glass Water Heater 35–70 Gallon Fish Tank",
            href: "https://amzn.to/4n9U4lP"
          },
          {
            label: "Option 2",
            title: "hygger 802 Aquarium Titanium Heater Tube Heating Element Replacement Heater Rod (Controller Excluded) (200W)",
            href: "https://amzn.to/42Zj6wn"
          },
          {
            label: "Option 3",
            title: "hygger Aquarium Heater 200W, Submersible Fish Tank Heater with Digital LED Controller, Overheating & Auto Shut Off Protection, Betta Turtle Tank Heater, for Saltwater & Freshwater Fish Tank 20–55 Gallon",
            href: "https://amzn.to/4mORQry"
          }
        ]
      },
      {
        id: "g-40-60",
        label: "Recommended Heaters for 40–60 Gallons",
        tip: "For 40–60 gal tanks, aim for ~200–300W and place the heater in steady flow for even temperature. (Full placement/safety details are in the Heater Tip popup.)",
        options: [
          {
            label: "Option 1",
            title: "Hitop 300W Aquarium Heater, Submersible Glass Water Heater (35–70 Gallon Fish Tank)",
            href: "https://amzn.to/46Qv3ps"
          },
          {
            label: "Option 2",
            title: "hygger Aquarium Heater 300W, Fish Tank Heater with Digital LED Controller, Overheating & Auto Shut Off Protection, Memory Function, Submersible Fish Heater for Saltwater & Freshwater Fish Tank 25–80 Gallon",
            href: "https://amzn.to/4nF3vuv"
          },
          {
            label: "Option 3",
            title: "AQQA Aquarium Heater 500W for 55–130 Gallon Fish Tank Heater Quartz Glass Submersible Betta Fish Heater for Aquarium Thermostat Heater with External Digital Controller (AQ136-500W for 55–130Gal)",
            href: "https://amzn.to/3WsfsHG"
          }
        ]
      },
      {
        id: "g-60-90",
        label: "Recommended Heaters for 60–90 Gallons",
        tip: "For 60–90 gal tanks, aim for ~300–500W total heating. Consider splitting across two smaller heaters for even coverage and redundancy. (Full placement/safety guidance is in the Heater Tip popup.)",
        options: [
          {
            label: "Option 1",
            title: "AQQA Aquarium Heater 500W for 55–130 Gallon Fish Tank Heater Quartz Glass Submersible Betta Fish Heater for Aquarium Thermostat Heater with External Digital Controller (AQ136-500W for 55–130Gal)",
            href: "https://amzn.to/42q5t9x"
          },
          {
            label: "Option 2",
            title: "hygger Aquarium Heater with Intelligent Temperature Controller, 500W for 66–135 Gallon Submersible Fish Tank Heater with Leaving Water Automatically Stop Heating System, for Freshwater Saltwater",
            href: "https://amzn.to/479hliF"
          },
          {
            label: "Option 3",
            title: "Fluval M 200-Watt Submersible Aquarium Heater – High-Performance, Compact Heating with Mirror Technology for Fresh & Saltwater Tanks",
            href: "https://amzn.to/4o4Z6Az"
          }
        ]
      },
      {
        id: "g-90-125",
        label: "Recommended Heaters for 90–125 Gallons",
        tip: "For 90–125 gal tanks, aim for 500–800W total heating power. For large aquariums, use multiple heaters for balanced temperature and redundancy. (Full placement/safety details in the Heater Tip popup.)",
        options: [
          {
            label: "Option 1",
            title: "hygger 500W Aquarium Heater with Controller, Adjustable & Submersible Fish Tank Heater with Digital Display Safety Triple Protection Beeping Alarm for Saltwater and Freshwater 65–135 Gallon",
            href: "https://amzn.to/46ROYo5"
          },
          {
            label: "Option 2",
            title: "hygger Aquarium Heater with Intelligent Temperature Controller, 500W for 66–135 Gallon Submersible Fish Tank Heater with Leaving Water Automatically Stop Heating System, for Freshwater Saltwater",
            href: "https://amzn.to/3KWN91y"
          },
          {
            label: "Option 3",
            title: "AQQA Aquarium Heater 500W for 55–130 Gallon Fish Tank Heater Quartz Glass Submersible Betta Fish Heater for Aquarium Thermostat Heater with External Digital Controller (AQ136-500W for 55–130Gal)",
            href: "https://amzn.to/3WocVON"
          }
        ]
      }
    ]
  },

  filters: {
    match: "gallons",
    ranges: RANGES_FILTERS.map(r => {
      if (r.id === "g-5-10") {
        return {
          id: "g-5-10",
          label: "Recommended Filters for 5–10 Gallons",
          tip: "For 5–10 gal tanks, use gentle filtration — sponge or low-flow HOB filters. Clean sponges monthly and avoid replacing biomedia to preserve beneficial bacteria. (Full maintenance and sizing guidance available in the Filter Tip popup.)",
          options: [
            {
              label: "Option 1",
              title: "Pawfly Aquarium Nano Bio Sponge Filter Quiet Betta Fry Shrimp and Small Fish Foam Filter for Tiny Fish Tank up to 10 Gallon",
              href: "https://amzn.to/3IXHtns"
            },
            {
              label: "Option 2",
              title: "hygger Aquarium Double Sponge Filter, Comes with 2 Spare Sponges (S)",
              href: "https://amzn.to/46Qxf0a"
            },
            {
              label: "Option 3",
              title: "AC30 Power Filter, 10–30 US Gal / 38–114 L – Fluval USA (fluvalaquatics.com)",
              href: "https://amzn.to/4pXb0hE"
            }
          ]
        };
      }

      if (r.id === "g-10-20") {
        return {
          id: "g-10-20",
          label: "Recommended Filters for 10–20 Gallons",
          tip: "",  // keep empty — all education lives in the Filter Tip popup
          options: [
            {
              label: "Option 1",
              title: "AC30 Power Filter, 10–30 US Gal / 38–114 L – Fluval USA (fluvalaquatics.com)",
              href: "https://amzn.to/4n9MXK9"
            },
            {
              label: "Option 2",
              title: "hygger Aquarium Double Sponge Filter for Fresh Water and Salt-Water Fish Tank (M)",
              href: "https://amzn.to/3VTKSXo"
            },
            {
              label: "Option 3",
              title: "AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Middle up to 20Gal)",
              href: "https://amzn.to/4mTK28f"
            }
          ]
        };
      }

      if (r.id === "g-20-40") {
        return {
          id: "g-20-40",
          label: "Recommended Filters for 20–40 Gallons",
          // all educational text handled by the Filter Tip popup
          tip: "",
          options: [
            {
              label: "Option 1",
              title: "hygger Aquarium Double Sponge Filter for Fresh Water and Salt-Water Fish Tank (M)",
              href: "https://amzn.to/46XUzsV"
            },
            {
              label: "Option 2",
              title: "Seachem Tidal Power Aquarium Filter - 35 Gallon Large Fish Tank Filter, black",
              href: "https://amzn.to/3IUy1RL"
            },
            {
              label: "Option 3",
              title: "Fluval C2 Power Filter, Fish Tank Filter for Aquariums up to 30 Gal.",
              href: "https://amzn.to/4mSXsRP"
            }
          ]
        };
      }

      if (r.id === "g-40-60") {
        return {
          id: "g-40-60",
          label: "Recommended Filters for 40–60 Gallons",
          tip: "",  // tips moved to Filter info popup
          options: [
            {
              label: "Option 1",
              title: "AQUANEAT Aquarium Bio Sponge Filter Breeding Fry Betta Shrimp Nano Fish Tank (Large up to 60Gal)",
              href: "https://amzn.to/3KTUjUi"
            },
            {
              label: "Option 2",
              title: "SeaChem Large Aquarium Fish Tank Filter, Tidal 55 Gallon (200 Liters) by Sicce",
              href: "https://amzn.to/3VRpXV0"
            },
            {
              label: "Option 3",
              title: "AquaClear 70 Power Filter, Fish Tank Filter for 40- to 70-Gallon Aquariums, Black",
              href: "https://amzn.to/3IVD0BO"
            }
          ]
        };
      }

      if (r.id === "g-60-90") {
        return {
          id: "g-60-90",
          label: "Recommended Filters for 60–90 Gallons",
          tip: "",  // all education lives in the Filter Tip popup
          options: [
            {
              label: "Option 1",
              title: "Aqueon QuietFlow 75 LED PRO Aquarium Fish Tank Power Filter For Up To 90 Gallon Aquariums",
              href: "https://amzn.to/48hBMeC"
            },
            {
              label: "Option 2",
              title: "Fluval 407 Perfomance Canister Filter - for Aquariums Up to 100 Gallons - Aquarium Canister Filter",
              href: "https://amzn.to/47bXnUA"
            },
            {
              label: "Option 3",
              title: "Marineland Penguin Bio-Wheel Power Filter, Multi-Stage Aquarium Filtration",
              href: "https://amzn.to/4h0gsMT"
            }
          ]
        };
      }

      if (r.id === "g-90-125") {
        return {
          id: "g-90-125",
          label: "Recommended Filters for 90–125 Gallons",
          tip: "",  // all education lives in the Filter Tip popup
          options: [
            {
              label: "Option 1",
              title: "Fluval FX2 High Performance Canister Aquarium Filter - Multi-Stage Filtration, Built-in Powered Water Change System, and Basket-in-Basket Tray Design",
              href: "https://amzn.to/48QPCEJ"
            },
            {
              label: "Option 2",
              title: "Fluval 407 Perfomance Canister Filter - for Aquariums Up to 100 Gallons - Aquarium Canister Filter",
              href: "https://amzn.to/3KBqqs4"
            },
            {
              label: "Option 3",
              title: "SeaChem – Large Aquarium Fish Tank Filter, Tidal 110 Gallon (400 Liters) by Sicce",
              href: "https://amzn.to/48gPNZP"
            }
          ]
        };
      }

      return {
        id: r.id,
        label: `Recommended Filters for ${r.label}`,
        tip: "Oversize rating for clearer water; clean mechanical media often, preserve bio.",
        options: [ {label:"Option 1",title:"(add)",href:""}, {label:"Option 2",title:"(add)",href:""}, {label:"Option 3",title:"(add)",href:""} ]
      };
    })
  },

  lights: {
    match: "length",
    ranges: RANGES_LIGHTS.map(r => {
      if (r.id === "l-12-20") {
        return {
          id: "l-12-20",
          label: "Recommended Lights for 12–20 Inch Tanks",
          tip: "",
          options: [
            {
              label: "Option 1",
              title: "NICREW C10 Plants LED Aquarium Light, 12-18 in, 9 Watts, Full Spectrum Fish Tank Light with Timer, Day and Night Cycle, Brightness Adjustable",
              href: "https://amzn.to/4mP0Sow"
            },
            {
              label: "Option 2",
              title: "hygger New Mode 24/7 Timer LED Aquarium Light, Auto On Off Full Spectrum Fish Tank Light Fish Colorful/Sun/Nightlight/Wrgb Cycle Mode for Freshwater Plants Tank (for 12in~18in Long Tank)",
              href: "https://amzn.to/3VS4co0"
            },
            {
              label: "Option 3",
              title: "hygger Fish Aquarium LED Light, 14W 24/7 Lighting Sunrise-Daylight-Moonlight Mode DIY , Adjustable Timer/Brightness with Extendable Bracket 7 Colors for Planted Tank",
              href: "https://amzn.to/4h3wUvY"
            }
          ]
        };
      }

      if (r.id === "l-20-24") {
        return {
          id: "l-20-24",
          label: "Recommended Lights for 20–24 Inch Tanks",
          tip: "",
          options: [
            {
              label: "Option 1",
              title: "NICREW C10 Plants LED Aquarium Light, 18-24 in, 13 Watts, Full Spectrum Fish Tank Light with Timer, Day and Night Cycle, Brightness Adjustable",
              href: "https://amzn.to/3WpCKxX"
            },
            {
              label: "Option 2",
              title: "hygger 14W Full Spectrum Aquarium Light with Aluminum Alloy Shell Extendable Brackets, White Blue Red LEDs, External Controller, for Freshwater Fish Tank (18-24 inch)",
              href: "https://amzn.to/3VRUYIs"
            },
            {
              label: "Option 3",
              title: "hygger Auto On Off LED Aquarium Light 18-24 Inches Dimmable 7 Colors Full Spectrum Fish Tank Light Fixture for Freshwater Planted Tank Build in Timer Sunrise Sunset",
              href: "https://amzn.to/4gWRH45"
            }
          ]
        };
      }

      if (r.id === "l-24-30") {
        return {
          id: "l-24-30",
          label: "Recommended Lights for 24–30 Inch Tanks",
          tip: "",
          options: [
            {
              label: "Option 1",
              title: "hygger 16W Full Spectrum Aquarium Light with Aluminum Alloy Shell Extendable Brackets, White Blue Red LEDs, External Controller, for Freshwater Fish Tank (24-30 inch)",
              href: "https://amzn.to/42oWCVx"
            },
            {
              label: "Option 2",
              title: "AQQA Aquarium Light, Multi-Function Fish Tank Led Light 24/7 DIY Auto On Off + Night Mode + Day Mode + Full Spectrum + 7 Colors, Adjustable Brightness Waterproof with Timer for Freshwater 24W",
              href: "https://amzn.to/4gU5ZlU"
            },
            {
              label: "Option 3",
              title: "hygger Advanced Remote Control Aquarium Light Customizable Full Spectrum Fish Tank LED with DIY, Default & Weather Mode Freshwater Planted Tank",
              href: "https://amzn.to/4h3Ob8k"
            }
          ]
        };
      }

      if (r.id === "l-30-36") {
        return {
          id: "l-30-36",
          label: "Recommended Lights for 30–36 Inch Tanks",
          tip: "", // Lighting guidance lives in the global Lighting info popup
          options: [
            {
              label: "Option 1",
              title: "hygger 20W Full Spectrum Aquarium Light with Aluminum Alloy Shell Extendable Brackets, White Blue Red LEDs, External Controller, for Freshwater Fish Tank (30-36 inch)",
              href: "https://amzn.to/3Wo63Rt"
            },
            {
              label: "Option 2",
              title: "hygger 20W Full Spectrum Aquarium Light with Aluminum Alloy Shell Extendable Brackets, White Blue Red LEDs, External Controller, for Freshwater Fish Tank (30-36 inch)",
              href: "https://amzn.to/4q2HWWo"
            },
            {
              label: "Option 3",
              title: "hygger Advanced Remote Control Aquarium Light Customizable Full Spectrum Fish Tank LED with DIY, Default & Weather Mode Freshwater Planted Tank",
              href: "https://amzn.to/46L2CZS"
            }
          ]
        };
      }

      if (r.id === "l-36-48") {
        return {
          id: "l-36-48",
          label: "Recommended Lights for 36–48 Inches",
          tip: "For 36–48 inch tanks, choose lights with adjustable brackets or a slight overhang. Longer tanks may benefit from dual fixtures or higher wattage to maintain even brightness and plant growth.",
          options: [
            {
              label: "Option 1",
              title: "hygger 36W 24/7 Lighting Aquarium LED Light, Sunrise-Daylight-Moonlight Mode and DIY Mode, Adjustable Timer Adjustable Brightness Fish Tank Light with Extendable Bracket 7 Colors for Planted Tank",
              href: "https://amzn.to/4nAAekl"
            },
            {
              label: "Option 2",
              title: "AQQA Aquarium Light, Multi-Function Fish Tank Led Light 24/7 DIY Auto On Off + Night Mode + Day Mode + Full Spectrum + 7 Colors, Adjustable Brightness Waterproof with Timer for Freshwater 36W",
              href: "https://amzn.to/4mS1bz0"
            },
            {
              label: "Option 3",
              title: "hygger Advanced Remote Control Aquarium Light Customizable Full Spectrum Fish Tank LED with DIY, Default & Weather Mode Freshwater Planted Tank",
              href: "https://amzn.to/3ISKOEg"
            }
          ]
        };
      }

      if (r.id === "l-48-up") {
        return {
          id: "l-48-up",
          label: "Recommended Lights for 48 Inches and Up",
          tip: "For tanks 48 inches and longer, use extended-length fixtures or dual lights for even coverage. Longer tanks benefit from high-output full-spectrum LEDs with strong PAR and deeper penetration to support planted setups. Dual fixtures can also help eliminate dark zones and maintain even brightness from end to end.",
          options: [
            {
              label: "Option 1",
              title: "AQQA Aquarium Light, Multi-Function Fish Tank Led Light 24/7 DIY Auto On Off + Night Mode + Day Mode + Full Spectrum + 7 Colors, Adjustable Brightness Waterproof with Timer for Freshwater 44W",
              href: "https://amzn.to/3VVjRCW"
            },
            {
              label: "Option 2",
              title: "hygger Sun Moon LED Aquarium Light, Full Spectrum Fish Tank Light Day-Night Dual Timer, Adjustable 6 Timer 10 Brightness 8 Colors for Planted Freshwater Tank",
              href: "https://amzn.to/4gWbLUp"
            },
            {
              label: "Option 3",
              title: "hygger Auto On Off 48-55 Inch LED Aquarium Light Extendable Dimable 7 Colors Full Spectrum Light Fixture for Freshwater Planted Tank Build in Timer Sunrise Sunset",
              href: "https://amzn.to/4h1IbwH"
            }
          ]
        };
      }

      return {
        id: r.id,
        label: `Recommended Lights for ${r.label}`,
        tip: "Match fixture length to tank. Choose plant-ready if keeping live plants.",
        options: [ {label:"Option 1",title:"(add)",href:""}, {label:"Option 2",title:"(add)",href:""}, {label:"Option 3",title:"(add)",href:""} ]
      };
    })
  },

  substrate: {
    match: "gallons",
    groups: [
      {
        id:"sub-dirted",
        label:"Recommended Substrates for Dirted Planted Tanks",
        tip:"These substrates are ideal for dirted or fully planted aquariums, providing the nutrients and mineral balance needed for strong root systems and lush growth. They also help stabilize pH and improve plant health over time.",
        options:[
          { label:"Option 1", title:"Fluval 12695 Plant and Shrimp Stratum for Freshwater Fish Tanks, 17.6 lbs. – Aquarium Substrate for Strong Plant Growth, Supports Neutral to Slightly Acidic pH", href:"https://amzn.to/4gXDMuF" },
          { label:"Option 2", title:"Upgraded Aquarium Soil Water Grass Mud, Ideal for Fish Tank Aquascaping Aquarium Substrate Soil for Plants and Shrimps, No Need to Wash (17.6 Pounds)", href:"https://amzn.to/3KvbaNk" },
          { label:"Option 3", title:"Fluval 12698 Natural Mineral-Rich Volcanic Soil Bio Stratum for Planted Tanks, 17.6 lbs. - Aquarium Substrate for Healthy Plant Development, Growth, and Color", href:"https://amzn.to/3WtUCHW" },
          { label:"Option 4", title:"Seachem Flourite Black Clay Gravel - Stable Porous Natural Planted Aquarium Substrate 15.4 lbs", href:"https://amzn.to/4mVTEiK" },
          { label:"Option 5", title:"Flourite, 7 kg / 15.4 lbs", href:"https://amzn.to/48SfvUL" }
        ]
      },
      {
        id:"sub-dirt-cap",
        label:"Recommended Gravel / Sand / Dirt Cap Substrates",
        tip:"These substrates are ideal for unplanted tanks, layered setups, or as a cap over dirted bases. They provide stability, aesthetic variety, and protection for plant roots and fish alike. Choose finer sand for bottom dwellers, or medium gravel for easier cleaning and water flow.",
        options:[
          { label:"Option 1", title:"20LB Decorative River Rocks Gravel - 2/5\" Mixed Color Gravel for Vase Filling, Flower Pot Paving. Gravel for Garden Decoration, Landscaping, Aquarium Aquascape Gravel, Fish Tanks Gravel (8-12MM)", href:"https://amzn.to/3KH29k6" },
          { label:"Option 2", title:"Sandtastik Sparkling White Play Sand, 25 lb (11.3 kg)", href:"https://amzn.to/4h8dp5h" },
          { label:"Option 3", title:"Carib Sea ACS05820 Super Natural Moonlight Sand for Aquarium, 5-Pound", href:"https://amzn.to/3IxxGVd" },
          { label:"Option 4", title:"Aqua Natural Diamond Black 10lb, Premium Gravel and Substrate for Aquariums, Fish Tanks and Terrariums, 1-2mm", href:"https://amzn.to/3IJ16jd" }
        ]
      }
    ]
  },

  waterTreatments: {
    match: "none",
    ranges: [
      {
        id: "wt-core",
        label: "Recommended Water Treatments",
        tip: "Conditioners and cycle boosters that keep tap water fish-safe and biofilters stable.",
        options: [
          {
            title: "Seachem Prime Water Conditioner",
            notes: "Concentrated dechlorinator that detoxifies chlorine, chloramine, and ammonia instantly.",
            href: "https://www.amazon.com/s?k=Seachem+Prime+Water+Conditioner&tag=fishkeepingli-20"
          },
          {
            title: "Fritz Complete Water Conditioner",
            notes: "One-step conditioner that handles chlorine, chloramine, and heavy metals while supporting slime coat.",
            href: "https://www.amazon.com/s?k=Fritz+Complete+Water+Conditioner&tag=fishkeepingli-20"
          },
          {
            title: "Seachem Stability Biological Starter",
            notes: "Live bacteria blend that seeds filters quickly and steadies tanks after cleanings or medications.",
            href: "https://www.amazon.com/s?k=Seachem+Stability+Biological+Starter&tag=fishkeepingli-20"
          }
        ]
      }
    ]
  },

  food: {
    match: "none",
    intro: "A balanced rotation keeps fish vibrant and healthy. Combine a daily staple with a protein treat and a veggie/algae option. Feed only what’s eaten within 30–60 seconds to maintain good water quality.",
    accordions: [
      {
        id: "food-staple",
        label: "Staple (Daily Flake/Pellet)",
        tip: "Daily staples that anchor the feeding schedule for community tanks.",
        options: [
          {
            label: "Option 1",
            title: "Tetra TetraMin Plus Tropical Flakes 2.2 Ounces, Nutritionally Balanced Fish Food With Added Shrimp",
            notes: "Fortified flake staple with added shrimp meal for color and palatability.",
            href: "https://amzn.to/4o5Ulqx"
          },
          {
            label: "Option 2",
            title: "Fluval Bug Bites Tropical Fish Food, Small Granules for Small to Medium Sized Fish, 1.6 oz., A6577",
            notes: "Sustainably sourced insect-larvae granules that sink slowly for broad community appeal.",
            href: "https://amzn.to/3KBeZAt"
          },
          {
            label: "Option 3",
            title: "Hikari Tropical Semi-Floating Micro Pellets Fish Food, 0.77 Oz (22 g)",
            notes: "Semi-floating micro pellets sized for nano fish, rasboras, and shy feeders.",
            href: "https://amzn.to/46MbkXO"
          },
          {
            label: "Option 4",
            title: "TetraColor PLUS Tropical Flakes with Color Enhancing 2.2 Ounce (Pack of 1)",
            notes: "Color-enhancing flake blend that helps intensify reds and oranges.",
            href: "https://amzn.to/3WnK90O"
          },
          {
            label: "Option 5",
            title: "New Life Spectrum Thera A Regular 80 g (Naturox Series)",
            notes: "Garlic-infused sinking pellets that support immune response and vivid coloration.",
            href: "https://amzn.to/4h4JJ9k"
          }
        ]
      },
      {
        id: "food-protein",
        label: "Protein Treats (Frozen / Dried)",
        tip: "Offer 1–2 times weekly to add variety and boost protein.",
        options: [
          {
            label: "Option 1",
            title: "Hikari Bio-Pure Freeze Dried Blood Worms for Pets, 0.42 Ounce",
            notes: "Single-ingredient bloodworms for conditioning color and growth.",
            href: "https://amzn.to/4nJmKD6"
          },
          {
            label: "Option 2",
            title: "Hikari Bio-Pure Freeze Dried Brine Shrimp for Pets, 0.42 Ounce",
            notes: "Low-fat brine shrimp that rehydrate fast for small and midwater fish.",
            href: "https://amzn.to/4pZsn1q"
          },
          {
            label: "Option 3",
            title: "Hikari Tropical Shrimp Cuisine Fish Food, 0.35 oz (10 g)",
            notes: "Micro wafers crafted for dwarf shrimp and small scavengers.",
            href: "https://amzn.to/46FoPtF"
          }
        ]
      },
      {
        id: "food-veggie",
        label: "Veggie / Algae & Bottom Feeders",
        tip: "Sinking wafers that keep plecos, loaches, shrimp, and snails nourished.",
        options: [
          {
            label: "Option 1",
            title: "Hikari Tropical Sinking Wafers for Catfish, Loaches and Bottom Feeders 3.88 oz",
            notes: "Dense sinking wafers that break down slowly for corydoras, loaches, and plecos.",
            href: "https://amzn.to/3IZ8gQj"
          },
          {
            label: "Option 2",
            title: "Hikari Usa Inc AHK21328 Tropical Algae Wafer 8.8 Ounce",
            notes: "Extra-large algae wafers that provide overnight grazing for plecos and algae eaters.",
            href: "https://amzn.to/4mUNdwq"
          }
        ]
      }
    ]
  },

  maintenanceTools: {
    match: "none",
    accordions: [
      {
        id: "maintenance-testing",
        label: "Testing & Monitoring",
        tip: "Test weekly; consistency matters more than chasing perfect numbers.",
        options: [
          {
            title: "API Freshwater Master Test Kit",
            notes: "Liquid test kit covering ammonia, nitrite, nitrate, and pH for precise tracking.",
            href: "https://www.amazon.com/s?k=API+Freshwater+Master+Test+Kit&tag=fishkeepingli-20"
          },
          {
            title: "Digital TDS Meter",
            notes: "Pocket meter to spot mineral creep or dilution after remineralizing top-offs.",
            href: "https://www.amazon.com/s?k=Digital+TDS+Meter&tag=fishkeepingli-20"
          },
          {
            title: "Floating Thermometer",
            notes: "Simple glass backup thermometer to verify heater and controller accuracy.",
            href: "https://www.amazon.com/s?k=Floating+Aquarium+Thermometer&tag=fishkeepingli-20"
          }
        ]
      },
      {
        id: "maintenance-cleaning",
        label: "Water Change & Cleaning",
        tip: "Weekly 25–50% water change; match temperature and dechlorinate first. Use microfiber + distilled water + vinegar to wipe glass; avoid harsh cleaners.",
        options: [
          {
            title: "Python Gravel Vacuum",
            notes: "Hooks to a faucet for no-bucket gravel cleaning and refills on medium to large tanks.",
            href: "https://www.amazon.com/s?k=Python+Gravel+Vacuum&tag=fishkeepingli-20"
          },
          {
            title: "Aqueon Water Changer Kit",
            notes: "Faucet-driven siphon with flow control ideal for apartments and smaller sinks.",
            href: "https://www.amazon.com/s?k=Aqueon+Water+Changer&tag=fishkeepingli-20"
          },
          {
            title: "Microfiber Towel Pack",
            notes: "Lint-free cloths dedicated to aquarium use so glass dries streak-free.",
            href: "https://www.amazon.com/s?k=Microfiber+Towel+Pack&tag=fishkeepingli-20"
          },
          {
            title: "Algae Scraper Pad",
            notes: "Non-scratch pad to clear film algae from glass or acrylic panels.",
            href: "https://www.amazon.com/s?k=Aquarium+Algae+Scraper+Pad&tag=fishkeepingli-20"
          }
        ]
      },
      {
        id: "maintenance-safety",
        label: "Safety & Power",
        tip: "Use GFCI outlets and drip loops on all cords. Keep power strips above floor level.",
        options: [
          {
            title: "Surge Protected Power Strip",
            notes: "Mount high to protect gear from splashes while guarding against voltage spikes.",
            href: "https://www.amazon.com/s?k=Surge+Protected+Power+Strip&tag=fishkeepingli-20"
          },
          {
            title: "Outlet Timer for Lights",
            notes: "Automates light cycles for stable photoperiods that keep fish and plants on schedule.",
            href: "https://www.amazon.com/s?k=Outlet+Timer+for+Aquarium+Lights&tag=fishkeepingli-20"
          },
          {
            title: "GFCI Safety Adapter Plug",
            notes: "Adds ground-fault protection without rewiring, ideal for rental setups.",
            href: "https://www.amazon.com/s?k=GFCI+Safety+Adapter+Plug&tag=fishkeepingli-20"
          }
        ]
      }
    ]
  }
};
