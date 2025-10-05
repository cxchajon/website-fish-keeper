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
  { id:"l-12-18",  label:"12–18 inches",  min:12, max:18 },
  { id:"l-20-24",  label:"20–24 inches",  min:20, max:24 },
  { id:"l-30-36",  label:"30–36 inches",  min:30, max:36 },
  { id:"l-40-48",  label:"40–48 inches",  min:40, max:48 },
  { id:"l-55-60",  label:"55–60 inches",  min:55, max:60 },
  { id:"l-72-up",  label:"72 inches +",   min:72, max:999 }
];

/* Category tips shown on the “i” buttons */
const TIPS = {
  heaters: "Choose a heater whose printed range starts at (or just above) your tank size. Example: for a 40-gallon tank, prefer 40–60 gal over 20–40. Bonus safety: use a temp controller. When placing your heater, account for tank height, how thick your substrate is, and whether the heater has a water line mark. Most should not touch substrate, and not all are fully submersible. Place near gentle flow for even heat.",
  filters: "Oversize your filter. A 40–60 gal filter on a 40-gal tank keeps water clearer. Keep biomedia; replace only mechanical floss.",
  lights:  "Match your light to tank length, not wattage. Look for plant-ready if you keep live plants. A little overhang is OK; avoid dark spots.",
  substrate:"Depth matters: 1–2\" for most tanks; 2+\" for planted. Rinse inert gravels. For planted, consider root tabs with inert substrates."
};

/* Seed data — text links only. 
   We start with one confirmed link from the user under Heaters → 5–10 gallons → Option 1. 
   Leave TODO slots for Option 2/3 and other ranges to be filled as the user supplies links.
*/
const GEAR = {
  heaters: {
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
      { id:"g-20-40",  label:"Recommended Heaters for 20–40 Gallons",  tip:"Aim 100–200W.", options:[ {label:"Option 1",title:"(add)",href:""}, {label:"Option 2",title:"(add)",href:""}, {label:"Option 3",title:"(add)",href:""} ] },
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

      return {
        id: r.id,
        label: `Recommended Filters for ${r.label}`,
        tip: "Oversize rating for clearer water; clean mechanical media often, preserve bio.",
        options: [ {label:"Option 1",title:"(add)",href:""}, {label:"Option 2",title:"(add)",href:""}, {label:"Option 3",title:"(add)",href:""} ]
      };
    })
  },

  lights: {
    ranges: RANGES_LIGHTS.map(r => ({
      id: r.id,
      label: `Recommended Lights for ${r.label}`,
      tip: "Match fixture length to tank. Choose plant-ready if keeping live plants.",
      options: [ {label:"Option 1",title:"(add)",href:""}, {label:"Option 2",title:"(add)",href:""}, {label:"Option 3",title:"(add)",href:""} ]
    }))
  },

  substrate: {
    groups: [
      {
        id:"sub-fish-only",
        label:"Fish-Only Gravel",
        tip:"Easy clean, neutral look.",
        options:[ {label:"Option 1",title:"(add)",href:""}, {label:"Option 2",title:"(add)",href:""}, {label:"Option 3",title:"(add)",href:""} ]
      },
      {
        id:"sub-planted",
        label:"Planted Substrate",
        tip:"Nutrient-rich base for root feeders.",
        options:[ {label:"Option 1",title:"(add)",href:""}, {label:"Option 2",title:"(add)",href:""}, {label:"Option 3",title:"(add)",href:""} ]
      },
      {
        id:"sub-specialty",
        label:"Specialty (Shrimp / Aquascape)",
        tip:"Stabilizes pH for shrimp, or aesthetic aquascapes.",
        options:[ {label:"Option 1",title:"(add)",href:""}, {label:"Option 2",title:"(add)",href:""}, {label:"Option 3",title:"(add)",href:""} ]
      }
    ]
  }
};
