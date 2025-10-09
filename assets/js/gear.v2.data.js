/* Ranges used for matching/highlighting */
const RANGES_HEATERS = [
  { id: "g_5_10", label: "5–10 Gallons", min: 5, max: 10, sort: 10 },
  { id: "g_10_20", label: "10–20 Gallons", min: 10, max: 20, sort: 20 },
  { id: "g_20_40", label: "20–40 Gallons", min: 20, max: 40, sort: 40 },
  { id: "g_40_55", label: "40–55 Gallons", min: 40, max: 55, sort: 55 },
  { id: "g_55_75", label: "55–75 Gallons", min: 55, max: 75, sort: 75 },
  { id: "g_75_125", label: "75–125 Gallons", min: 75, max: 125, sort: 125 }
];

const FILTER_BUCKETS = [
  { id: "g_5_10", label: "5–10 Gallons", min: 5, max: 10, sort: 10 },
  { id: "g_10_20", label: "10–20 Gallons", min: 10, max: 20, sort: 20 },
  { id: "g_20_40", label: "20–40 Gallons", min: 20, max: 40, sort: 40 },
  { id: "g_40_55", label: "40–55 Gallons", min: 40, max: 55, sort: 55 },
  { id: "g_55_75", label: "55–75 Gallons", min: 55, max: 75, sort: 75 },
  { id: "g_75_125", label: "75–125 Gallons", min: 75, max: 125, sort: 125 }
];

const RANGES_FILTERS = FILTER_BUCKETS.map((bucket) => ({
  id: bucket.id,
  label: bucket.label,
  min: bucket.min,
  max: bucket.max,
  sort: bucket.sort
}));

const RANGES_LIGHTS = [
  { id: "l-12-18", label: "12–18 inches", min: 12, max: 18, sort: 18 },
  { id: "l-18-24", label: "18–24 inches", min: 18, max: 24, sort: 24 },
  { id: "l-24-36", label: "24–36 inches", min: 24, max: 36, sort: 36 },
  { id: "l-36-48", label: "36–48 inches", min: 36, max: 48, sort: 48 },
  { id: "l-48-55", label: "48–55 inches", min: 48, max: 55, sort: 55 }
];

const LIGHT_RANGE_IDS = RANGES_LIGHTS.map((range) => range.id);
const LIGHT_RANGE_ID_SET = new Set(LIGHT_RANGE_IDS);
const LIGHT_RANGE_ALIAS_ENTRIES = LIGHT_RANGE_IDS.flatMap((id) => {
  const base = id.replace(/^l-/, '');
  const baseNoDash = base.replace(/-/g, '');
  const entries = [
    [id, id],
    [base, id],
    [base.replace(/-/g, '_'), id],
    [baseNoDash, id],
    [`l${base}`, id],
    [`l_${base}`, id],
    [`l${baseNoDash}`, id],
  ];
  if (base.endsWith('-up')) {
    const start = base.replace('-up', '');
    entries.push(
      [`${start}up`, id],
      [`${start}+`, id],
      [`${start}-up`, id],
      [`${start}_up`, id],
      [`l${start}up`, id],
      [`l${start}+`, id],
      [`l-${start}up`, id]
    );
  }
  return entries;
});

const LEGACY_LIGHT_RANGE_ALIASES = [
  ['l-12-20', 'l-12-18'],
  ['12-20', 'l-12-18'],
  ['l-20-24', 'l-18-24'],
  ['20-24', 'l-18-24'],
  ['l-24-30', 'l-24-36'],
  ['24-30', 'l-24-36'],
  ['l-30-36', 'l-24-36'],
  ['30-36', 'l-24-36'],
  ['l-36-48', 'l-36-48'],
  ['36-48', 'l-36-48'],
  ['l-48-up', 'l-48-55'],
  ['48-up', 'l-48-55'],
  ['l-48-60', 'l-48-55'],
  ['48-60', 'l-48-55']
];

const LIGHT_RANGE_ALIAS_MAP = new Map([...LIGHT_RANGE_ALIAS_ENTRIES, ...LEGACY_LIGHT_RANGE_ALIASES]);

/* Category tips shown on the “i” buttons */
const EXTRAS_TIP_KEY = 'extras_cleanup_tip';

const FOOD_INTRO =
  "Feed small amounts 1–2× daily; aim for all food to be eaten within ~1–2 minutes. Rotate staples with protein treats and bottom-feeder wafers as appropriate. Reduce feeding when cycling or if ammonia/nitrite appear.";

const TIPS = {
  heaters: [
    "Choose a heater whose printed range starts at (or just above) your tank size. Example: for a 40-gallon tank, prefer 40–60 gal over 20–40. Bonus safety: pair your heater with a controller (see the Inkbird add-on above). Remember to account for tank height, substrate thickness, and whether the heater has a water level mark — most are not fully submersible.",
    '',
    '• <strong>5–10 Gallons —</strong> For 5–10 gal, target 25–50W. Place near gentle flow for even heat.',
    '• <strong>10–20 Gallons —</strong> For 10–20 gal, aim for 50–100W.',
    '• <strong>20–40 Gallons —</strong> For 20–40 gal tanks, aim for 100–200W. See the Heater tip for placement and safety guidance.',
    '• <strong>40–55 Gallons —</strong> For 40–55 gal tanks, aim for roughly 200–300W total. Consider using dual heaters for redundancy and more even heating.',
    '• <strong>55–75 Gallons —</strong> For 55–75 gal tanks, plan on ~300–500W total. Splitting wattage across two heaters improves coverage and safety.',
    '• <strong>75–125 Gallons —</strong> For 75–125 gal tanks, aim for 500–800W total heating power. Use multiple heaters for balanced temperature and redundancy.'
  ].join('<br>'),
  filters: [
    'Oversize your filter. A 40–60 gal filter on a 40-gal tank keeps water clearer. Keep biomedia; replace only mechanical floss.',
    '',
    '• <strong>5–10 Gallons —</strong> For 5–10 gal tanks, use gentle filtration — sponge or low-flow HOB filters. Clean sponges monthly and avoid replacing biomedia to preserve beneficial bacteria. (Full maintenance and sizing guidance available in the Filter Tip popup.)'
  ].join('<br>'),
  lights: `
  <strong>Lighting Tips</strong><br>
  Match your light to your <strong>tank length</strong>, not just gallons.<br>
  It’s often better to go <strong>slightly longer</strong> than your tank to prevent dark corners and dead spots.<br>
  For <strong>planted tanks</strong>, check PAR and spectrum ratings — high PAR supports carpet plants, while moderate PAR works for most setups.<br>
  For <strong>long tanks</strong>, consider two fixtures or one high-output unit to ensure even coverage end to end.<br>
  For <strong>tall tanks</strong>, look for higher lumen or PAR ratings since light intensity drops quickly with depth — especially if you’re keeping rooted or carpet plants.<br>
  <br>
  💡 <strong>For tanks 55 inches and longer:</strong><br>
  We recommend using multiple smaller lights spaced evenly across the top of the aquarium.<br>
  Combining two 24–36&quot; lights or a mix of 36–48&quot; units provides more balanced coverage and prevents dim corners in longer tanks.
`,
  air:
    'Increase surface agitation to boost oxygen exchange during heavy stocking, warmer temps, or medication use. Always add check valves on airlines and pair pumps with diffusers or stones to spread flow and protect against back-siphons.',
  substrate:
    'Planted tanks do best with nutrient-rich soils. Unplanted/community tanks often prefer inert gravel or sand. For décor: rinse stones thoroughly; test for carbonate fizz if you keep soft-water species. Pre-soak driftwood to reduce tannins and weigh down until waterlogged.',
  'water-treatments': `
  Use water conditioners to remove chlorine/chloramine before adding fish.<br>
  Bacteria starters jumpstart your cycle and stabilize biofilters.<br>
  Detoxifiers bind ammonia temporarily—still address the root cause and retest often.
`,
  fertilizers: `
  Fertilizers support plant growth—dose based on lighting, plant type, and water changes.<br>
  Pair root tabs for heavy root feeders with liquid dosing for stems and fast growers.<br>
  For liquid carbon (e.g., Excel), start with reduced dosing and watch for sensitive species like Vallisneria.
`,
  food: {
    title: 'Feeding Guidance',
    body: FOOD_INTRO
  },
  'maintenance-tools': `
  <strong>Safety &amp; Power Tips</strong><br>
  GFCI outlets and drip loops prevent electrical hazards.<br>
  Keep power strips dry and elevated.<br>
  Use timers or smart plugs for consistent light cycles and to reduce wear on equipment.
`,
  stands: `
  Choose a stand rated above your tank size. Example: for a 40-gallon tank, a stand rated for 50–65 gallons gives margin for aquascape weight and long-term stability.<br>
  Always level and pad per manufacturer instructions.
`
};

TIPS[EXTRAS_TIP_KEY] = 'Use microfiber towels and paper towels for drips. Avoid harsh glass cleaners near aquariums. For exterior glass, use distilled water + white vinegar mix on a cloth and wipe dry. Keep a dedicated bucket and gloves for tank work only to prevent cross-contamination.';

TIPS.stands_55_75_info =
  'A filled 55-gallon tank can weigh over 600 lbs; a 75-gallon can exceed 900 lbs. Choose a stand whose capacity is greater than the full tank weight, match the footprint exactly, and confirm the stand is level before filling.';

const HEATER_RANGE_META = new Map([
  [
    "g_5_10",
    {
      label: "Recommended Heaters for 5–10 Gallons",
      tip: ""
    }
  ],
  ["g_10_20", { label: "Recommended Heaters for 10–20 Gallons", tip: "" }],
  [
    "g_20_40",
    {
      label: "Recommended Heaters for 20–40 Gallons",
      tip: ""
    }
  ],
  [
    "g_40_55",
    {
      label: "Recommended Heaters for 40–55 Gallons",
      tip: ""
    }
  ],
  [
    "g_55_75",
    {
      label: "Recommended Heaters for 55–75 Gallons",
      tip: ""
    }
  ],
  [
    "g_75_125",
    {
      label: "Recommended Heaters for 75–125 Gallons",
      tip: ""
    }
  ]
]);

const FILTER_RANGE_META = new Map([
  [
    "g_5_10",
    {
      label: "Recommended Filters for 5–10 Gallons",
      tip: ""
    }
  ],
  ["g_10_20", { label: "Recommended Filters for 10–20 Gallons", tip: "" }],
  ["g_20_40", { label: "Recommended Filters for 20–40 Gallons", tip: "" }],
  ["g_40_55", { label: "Recommended Filters for 40–55 Gallons", tip: "" }],
  ["g_55_75", { label: "Recommended Filters for 55–75 Gallons", tip: "" }],
  ["g_75_125", { label: "Recommended Filters for 75–125 Gallons", tip: "" }]
]);

const FILTER_GROUP_META = new Map([
  [
    'filters-filter-media',
    {
      id: 'filters_media',
      label: 'Filter Media',
      intro:
        'Stack media in flow order: mechanical → biological → chemical. Rinse sponges/floss in tank water, not tap. Never replace all bio media at once. Remove carbon when medicating.'
    }
  ]
]);

const FILTER_BUCKET_META = new Map(FILTER_BUCKETS.map((bucket) => [bucket.id, { ...bucket }]));

const FILTER_BUCKET_ALIASES = new Map([
  ['g-5-10', 'g_5_10'],
  ['g5-10', 'g_5_10'],
  ['g5_10', 'g_5_10'],
  ['5-10', 'g_5_10'],
  ['5_10', 'g_5_10'],
  ['g_5_10_01', 'g_5_10'],
  ['g_5_10_02', 'g_5_10'],
  ['g_5_10_03', 'g_5_10'],
  ['g-10-20', 'g_10_20'],
  ['g10-20', 'g_10_20'],
  ['g10_20', 'g_10_20'],
  ['10-20', 'g_10_20'],
  ['10_20', 'g_10_20'],
  ['g_10_20_01', 'g_10_20'],
  ['g-20-40', 'g_20_40'],
  ['g20-40', 'g_20_40'],
  ['g20_40', 'g_20_40'],
  ['20-40', 'g_20_40'],
  ['20_40', 'g_20_40'],
  ['g_20_40_01', 'g_20_40'],
  ['g-40-60', 'g_40_55'],
  ['g40-60', 'g_40_55'],
  ['g40_60', 'g_40_55'],
  ['40-60', 'g_40_55'],
  ['40_60', 'g_40_55'],
  ['g_40_60', 'g_40_55'],
  ['gump_40_55', 'g_40_55'],
  ['g-60-90', 'g_55_75'],
  ['g60-90', 'g_55_75'],
  ['g60_90', 'g_55_75'],
  ['g_60_90', 'g_55_75'],
  ['60-90', 'g_55_75'],
  ['60_90', 'g_55_75'],
  ['gump_55_75', 'g_55_75'],
  ['g-90-125', 'g_75_125'],
  ['g90-125', 'g_75_125'],
  ['g90_125', 'g_75_125'],
  ['g_90_125', 'g_75_125'],
  ['90-125', 'g_75_125'],
  ['90_125', 'g_75_125'],
  ['gump_75_125', 'g_75_125']
]);

const LIGHT_RANGE_META = new Map([
  ["l-12-18", { label: "Recommended Lights for 12–18 inch Tanks", tip: "" }],
  ["l-18-24", { label: "Recommended Lights for 18–24 inch Tanks", tip: "" }],
  ["l-24-36", { label: "Recommended Lights for 24–36 inch Tanks", tip: "" }],
  ["l-36-48", { label: "Recommended Lights for 36–48 inch Tanks", tip: "For 36–48 inch tanks, choose lights with adjustable brackets or a slight overhang. Longer tanks may benefit from dual fixtures or higher wattage to maintain even brightness and plant growth." }],
  ["l-48-55", { label: "Recommended Lights for 48–55 inch Tanks", tip: "For 48–55 inch tanks, look for extendable arms or brackets to cover the full span. Consider pairing fixtures or upgrading output for dense planting." }]
]);

const HEATERS_ADDON = {
  enabled: true,
  eyebrow: 'Recommended add-on',
  title:
    'Inkbird ITC-306A WiFi Temperature Controller, Wi-Fi Aquarium Thermostat Heater Controller 120V~1200W Temperature Control with Two Probes only for Heater Aquarium Breeding Reptiles Hatching.',
  notes: '',
  amazonUrl: 'https://amzn.to/46QJSd3'
};

const WATER_TREATMENT_TIPS = new Map([
  [
    "wt-core",
    "Conditioners and beneficial bacteria each play a role: detoxify tap water and seed your biofilter so livestock stay protected."
  ]
]);

const FERTILIZER_TIPS = new Map([
  [
    'fertilizers-fertilizers',
    'Balance macro and micro nutrients, and adjust dosing to match lighting intensity and plant growth.'
  ],
  [
    'fertilizers',
    'Balance macro and micro nutrients, and adjust dosing to match lighting intensity and plant growth.'
  ]
]);

const FOOD_GROUP_TIPS = new Map([
  ["food-staples-daily", "Core daily flakes and pellets that cover most community tanks."],
  ["food-bottom-feeders-and-algae", "Sinking wafers and algae-rich diets for plecos, shrimp, and catfish."],
  ["food-high-protein-treats", "Offer sparingly 1–2× weekly to boost protein and entice picky fish."]
]);

function normalizeFoodGroupKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const FOOD_GROUP_ALIASES = new Map([
  [normalizeFoodGroupKey('Staples (Daily)'), { id: 'food-staples-daily', label: 'Staples (Daily)' }],
  [normalizeFoodGroupKey('Staples'), { id: 'food-staples-daily', label: 'Staples (Daily)' }],
  [normalizeFoodGroupKey('Daily Staples'), { id: 'food-staples-daily', label: 'Staples (Daily)' }]
]);

const FOOD_GROUP_ORDER = [
  'food-staples-daily',
  'food-bottom-feeders-and-algae',
  'food-high-protein-treats'
];

const MAINTENANCE_INTRO = "Keep your aquarium healthy and clear with the right tools for testing, water changes, and glass maintenance. Consistent care prevents algae, stress, and equipment issues.";

const AERATION_SECTION_INTRO =
  'Use a check valve on every airline to prevent back-siphon. Size your pump to the devices you’ll run (sponge filters, airstones). Consider a battery backup or UPS for outages. For CO₂, place diffusers under outflow for better circulation; use CO₂-rated check valves to protect your regulator.';

const MAINTENANCE_GROUP_TIPS = new Map([
  ["maintenance-safety", "Use GFCI protection and surge-protected strips to keep your aquarium gear safe. Always create drip loops on cords, label plugs for quick shutoff, and keep outlets above water level."]
]);

const MAINTENANCE_GROUP_META = new Map([
  [
    'maintenance_cleanup_extras',
    {
      intro:
        'Keep aquarium-safe supplies separate from household products. Use only 100% silicone labeled for aquariums when sealing glass or attaching dividers.'
    }
  ],
  [
    'maintenance_nets_handling',
    {
      intro:
        'Match net size to fish; use soft or silicone nets for delicate fins. Wet the net first to reduce slime-coat damage. For planted tanks, choose snag-free mesh.'
    }
  ],
  [
    'maintenance_aquascaping_tools',
    {
      intro:
        'Use long tweezers for planting stems and carpeting species, curved scissors for trimming, and a spatula to level substrate. Rinse and dry tools after use to prevent corrosion.'
    }
  ]
]);

const EXTRAS_INTRO =
  'Handy everyday supplies to keep your setup tidy and maintenance smooth. These are optional, but convenient.';

const EXTRAS_ACCORDION_META = {
  id: 'extras_cleanup',
  label: 'Cleanup & Extras',
  infoButtonKey: EXTRAS_TIP_KEY,
  infoButtonLabel: 'Cleanup & Extras tip'
};

const EXTRAS_DEFAULT_SUBGROUP = 'Misc';
const EXTRAS_PLACEHOLDER = 'Links coming soon.';

const CATEGORY_ALIASES = new Map([
  ['filtration', 'filters'],
  ['filter', 'filters'],
  ['substrate & aquascaping', 'substrate'],
  ['air & aeration', 'air'],
  ['air and aeration', 'air'],
  ['aeration', 'air'],
  ['air', 'air'],
  ['maintenance & tools', 'maintenance_tools'],
  ['maintenance tools', 'maintenance_tools'],
  ['maintenance-tools', 'maintenance_tools'],
  ['water treatments & fertilizers', 'water_treatments'],
  ['water treatments and fertilizers', 'water_treatments']
]);

const GROUP_ALIAS_LOOKUP = new Map([
  ['maintenance_tools::testing & monitoring', { id: 'maintenance-testing', label: 'Testing & Monitoring' }],
  ['maintenance_tools::cleanup & extras', { id: 'maintenance_cleanup_extras', label: 'Cleanup & Extras' }],
  ['maintenance_tools::air & aeration', { id: 'maintenance_air', label: 'Air & Aeration' }],
  ['maintenance_tools::nets & handling', { id: 'maintenance_nets_handling', label: 'Nets & Handling' }],
  ['maintenance_tools::aquascaping tools', { id: 'maintenance_aquascaping_tools', label: 'Aquascaping Tools' }]
]);

const MAINTENANCE_SUBGROUP_ORDER = [
  'maintenance-testing',
  'maintenance_cleanup_extras',
  'maintenance_nets_handling',
  'maintenance_aquascaping_tools'
];

const AIR_GROUP_META = new Map([
  [
    'maintenance_air',
    {
      intro: AERATION_SECTION_INTRO
    }
  ]
]);

const SUBSTRATE_DEFAULT_GROUP_ID = 'substrate-all';
const SUBSTRATE_DEFAULT_GROUP_LABEL = 'Substrate & Aquascaping Picks';
const SUBSTRATE_SUBGROUP_DEFINITIONS = [
  {
    id: 'substrate-base-layers-soil',
    label: 'Base Layers & Soil',
    aliases: [
      'base-layers-soil',
      'base-layers-and-soil',
      'base-layer',
      'base-layers',
      'soil',
      'soils',
      'nutrient-rich-soils',
      'enriched-substrates',
      'root-tabs',
      'plant-substrates',
      'clay-based-materials'
    ]
  },
  {
    id: 'substrate-gravel-sand',
    label: 'Gravel & Sand',
    aliases: [
      'gravel-sand',
      'gravel-and-sand',
      'gravel',
      'sand',
      'dirt-cap',
      'pea-gravel',
      'decorative-sand',
      'aragonite'
    ]
  },
  {
    id: 'substrate-rock-hardscape',
    label: 'Rock & Hardscape',
    aliases: [
      'rock-hardscape',
      'rocks',
      'stone',
      'stones',
      'hardscape',
      'dragonstone',
      'seiryu',
      'lava-rock',
      'slate'
    ]
  },
  {
    id: 'substrate-wood-driftwood',
    label: 'Wood & Driftwood',
    aliases: [
      'wood-driftwood',
      'wood',
      'driftwood',
      'branches',
      'spiderwood',
      'malaysian-driftwood',
      'natural-branches'
    ]
  }
].map((definition) => {
  const slug = slugifyKey(definition.label);
  const aliases = new Set(
    [slug, definition.id, ...(definition.aliases || [])].map((value) => slugifyKey(value))
  );
  return {
    ...definition,
    slug,
    aliases: Array.from(aliases).filter(Boolean)
  };
});

const SUBSTRATE_SUBGROUP_LOOKUP = new Map();
SUBSTRATE_SUBGROUP_DEFINITIONS.forEach((definition) => {
  definition.aliases.forEach((alias) => {
    if (!SUBSTRATE_SUBGROUP_LOOKUP.has(alias)) {
      SUBSTRATE_SUBGROUP_LOOKUP.set(alias, definition);
    }
  });
});

const SUBSTRATE_SUBGROUP_ORDER = SUBSTRATE_SUBGROUP_DEFINITIONS.map((definition) => definition.id);

const SUBSTRATE_DEFAULT_SUBGROUP = {
  id: 'substrate-general',
  label: 'General Substrate',
  slug: slugifyKey('General Substrate'),
  aliases: [slugifyKey('General Substrate')]
};

function normalizeCategoryKey(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  return CATEGORY_ALIASES.get(key) || key;
}

function slugifyKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CSV_SOURCES = [
  { path: "/data/gear_heaters.csv", category: "heaters" },
  { path: "/data/gear_filters_ranges.csv", category: "filters" },
  { path: "/data/gear_filters.csv", category: "filters" },
  { path: "/data/gear_lighting.csv", category: "lights" },
  { path: "/data/gear_substrate.csv", category: "substrate" },
  { path: "/data/gear_treatments.csv", category: "water_treatments" },
  { path: "/data/gear_food.csv", category: "food" },
  { path: "/data/gear_water_food_tools.csv", category: "" },
  { path: "/data/gear_maintenance.csv", category: "maintenance_tools" },
  { path: "/data/gear_extras.csv", category: "extras" }
];

const STANDS_JSON_PATH = "/assets/js/generated/gear-stands.json";
const STAND_ALLOWED_GROUPS = new Map([
  ["5-10", { min: 5, max: 10, label: "Recommended Stands for 5–10 Gallons" }],
  ["10-20", { min: 10, max: 20, label: "Recommended Stands for 10–20 Gallons" }],
  ["20-40", { min: 20, max: 40, label: "Recommended Stands for 20–40 Gallons" }],
  [
    "40-55",
    {
      id: "stands_40_55",
      min: 40,
      max: 55,
      label: "Recommended Stands for 40–55 Gallons",
      tip:
        "For 40–55 gal tanks, pick a stand rated for at least your tank’s full weight when filled (~8.3 lbs/gal plus substrate/rock). We suggest sizing up when possible for extra safety."
    }
  ],
  [
    "55-75",
    {
      id: "stands_55_75",
      min: 55,
      max: 75,
      label: "Recommended Stands for 55–75 Gallon Tanks",
      intro:
        'For 55–75 gallon tanks, choose a stand rated for at least 75 gallons. Larger setups with substrate, décor, and rockwork can exceed 900 lbs—always add a safety margin.',
      infoButtonKey: 'stands_55_75_info',
      infoButtonLabel: 'Stand safety guidance for 55–75 gallon tanks',
      infoButtonText: TIPS.stands_55_75_info
    }
  ],
  [
    "75-up",
    {
      min: 75,
      max: 999,
      label: "Recommended Stands for 75+ Gallons"
    }
  ]
]);
const STAND_RANGE_ORDER = Array.from(STAND_ALLOWED_GROUPS.keys());

function normaliseHeader(header) {
  return String(header || "").trim();
}

function parseCSV(text) {
  const rows = [];
  const headers = [];
  let current = "";
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\r") continue;
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else if (inQuotes && text[i - 1] === '\\') {
        current = `${current.slice(0, -1)}"`;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(current);
      if (!headers.length) {
        row.forEach((header) => headers.push(normaliseHeader(header)));
      } else if (row.some((cell) => cell && cell.length > 0)) {
        const entry = {};
        headers.forEach((header, index) => {
          entry[header] = row[index] !== undefined ? row[index] : "";
        });
        rows.push(entry);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    if (!headers.length) {
      row.forEach((header) => headers.push(normaliseHeader(header)));
    } else if (row.some((cell) => cell && cell.length > 0)) {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = row[index] !== undefined ? row[index] : "";
      });
      rows.push(entry);
    }
  }

  return rows;
}

function rangeBand(rangeId) {
  if (!rangeId) return "";
  const value = String(rangeId).trim();
  if (!value) return "";
  const hyphenParts = value.split('-');
  if (hyphenParts.length > 1 && hyphenParts[0]) {
    return hyphenParts.slice(1).join('-');
  }
  const underscoreParts = value.split('_');
  if (underscoreParts.length > 1 && underscoreParts[0]) {
    return underscoreParts.slice(1).join('-');
  }
  return "";
}

function normalizeLightRangeId(value) {
  if (value === null || value === undefined) return "";
  let next = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\u2012-\u2015\u2212]/g, '-')
    .replace(/[“”"′″]/g, '')
    .replace(/inches?$/g, '')
    .replace(/inch$/g, '')
    .replace(/in$/g, '')
    .replace(/tanks?$/g, '')
    .replace(/^lights?[-_]?/, '')
    .replace(/^light[-_]?/, '')
    .replace(/^range[-_]?/, '')
    .replace(/^bucket[-_]?/, '')
    .replace(/^group[-_]?/, '')
    .replace(/\s+/g, '')
    .replace(/_/g, '-')
    .replace(/\+$/, 'up');

  if (!next) {
    return '';
  }

  if (LIGHT_RANGE_ALIAS_MAP.has(next)) {
    next = LIGHT_RANGE_ALIAS_MAP.get(next) || '';
  }

  if (next.startsWith('l') && !next.startsWith('l-')) {
    next = `l-${next.slice(1)}`;
  }
  if (next.startsWith('-')) {
    next = `l${next}`;
  }

  if (LIGHT_RANGE_ALIAS_MAP.has(next)) {
    next = LIGHT_RANGE_ALIAS_MAP.get(next) || '';
  }

  if (LIGHT_RANGE_ID_SET.has(next)) {
    return next;
  }

  const standardMatch = next.match(/^(\d{2})-(\d{2})$/);
  if (standardMatch) {
    const candidate = `l-${standardMatch[1]}-${standardMatch[2]}`;
    return LIGHT_RANGE_ID_SET.has(candidate) ? candidate : '';
  }

  const upMatch = next.match(/^(\d{2})(?:-)?(?:up)$/);
  if (upMatch) {
    const candidate = `l-${upMatch[1]}-up`;
    return LIGHT_RANGE_ID_SET.has(candidate) ? candidate : '';
  }

  const prefixedMatch = next.match(/^l-(\d{2})-(\d{2})$/);
  if (prefixedMatch) {
    return LIGHT_RANGE_ID_SET.has(next) ? next : '';
  }

  return '';
}

function toNumberOrBlank(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) ? num : "";
}

function normalizeHeaterBucketKey(value) {
  if (value === null || value === undefined) return "";
  const key = String(value).trim();
  if (!key) return "";
  return key
    .replace(/-/g, '_')
    .replace(/__+/g, '_')
    .toLowerCase();
}

function normalizeFilterBucketKey(value) {
  if (value === null || value === undefined) return "";
  let key = String(value).trim().toLowerCase();
  if (!key) return "";
  key = key
    .replace(/[\u2012-\u2015\u2212]/g, '-')
    .replace(/filters?[-_]?/g, '')
    .replace(/range[-_]?/g, '')
    .replace(/bucket[-_]?/g, '')
    .replace(/option[-_a-z0-9]*/g, '')
    .replace(/[^a-z0-9+]+/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!key) return "";

  const segments = key.split('_').filter(Boolean);
  if (segments.length > 3) {
    const last = segments[segments.length - 1];
    const previous = segments[segments.length - 2];
    if (/^\d+$/.test(last) && /^\d+$/.test(previous)) {
      segments.pop();
      key = segments.join('_');
    }
  }

  if (!key) return "";

  if (key === 'g_125p') {
    return "";
  }

  if (FILTER_BUCKET_ALIASES.has(key)) {
    return FILTER_BUCKET_ALIASES.get(key) || "";
  }
  if (FILTER_BUCKET_META.has(key)) {
    return key;
  }

  const direct = key.replace(/-/g, '_');
  if (FILTER_BUCKET_META.has(direct)) {
    return direct;
  }
  if (FILTER_BUCKET_ALIASES.has(direct)) {
    return FILTER_BUCKET_ALIASES.get(direct) || "";
  }

  const digitsOnly = key.replace(/[^0-9+]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (FILTER_BUCKET_ALIASES.has(digitsOnly)) {
    return FILTER_BUCKET_ALIASES.get(digitsOnly) || "";
  }

  const plusNormalized = digitsOnly.includes('+') ? digitsOnly : digitsOnly.replace(/p$/, '+');
  if (FILTER_BUCKET_ALIASES.has(plusNormalized)) {
    return FILTER_BUCKET_ALIASES.get(plusNormalized) || "";
  }

  const rangeMatch = digitsOnly.match(/(\d+)(?:-(\d+))?/);
  if (rangeMatch) {
    const candidate = rangeMatch[2] ? `g_${rangeMatch[1]}_${rangeMatch[2]}` : `g_${rangeMatch[1]}`;
    if (FILTER_BUCKET_META.has(candidate)) return candidate;
    if (FILTER_BUCKET_ALIASES.has(candidate)) return FILTER_BUCKET_ALIASES.get(candidate) || "";
    const altCandidate = rangeMatch[2] ? `${rangeMatch[1]}-${rangeMatch[2]}` : '';
    if (altCandidate && FILTER_BUCKET_ALIASES.has(altCandidate)) {
      return FILTER_BUCKET_ALIASES.get(altCandidate) || "";
    }
  }

  const withPrefix = key.startsWith('g_') ? key : `g_${key}`;
  if (FILTER_BUCKET_META.has(withPrefix)) {
    return withPrefix;
  }
  if (FILTER_BUCKET_ALIASES.has(withPrefix)) {
    return FILTER_BUCKET_ALIASES.get(withPrefix) || "";
  }

  const withGump = key.startsWith('gump_') ? key : `gump_${key}`;
  if (FILTER_BUCKET_ALIASES.has(withGump)) {
    return FILTER_BUCKET_ALIASES.get(withGump) || "";
  }

  const numberMatch = key.match(/(\d+)[^0-9]+(\d+)/);
  if (numberMatch) {
    const canonical = `g_${numberMatch[1]}_${numberMatch[2]}`;
    if (FILTER_BUCKET_META.has(canonical)) {
      return canonical;
    }
    if (FILTER_BUCKET_ALIASES.has(canonical)) {
      return FILTER_BUCKET_ALIASES.get(canonical) || canonical;
    }
    return canonical;
  }

  return key;
}

function normalizeStandItem(item = {}) {
  const id = (item.id || "").toString().trim();
  const group = (item.group || "").toString().trim().toLowerCase();
  const meta = STAND_ALLOWED_GROUPS.get(group);
  const title = (item.title || "").toString().trim();
  if (!id || !meta || !title) {
    return null;
  }

  const notes = (item.notes || "").toString().trim();
  const rawUrl = (item.amazonUrl || item.href || "").toString().trim();
  const amazonUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
  const groupLabel = (item.groupLabel || "").toString().trim();
  const groupTip = (item.groupTip || "").toString().trim();
  const introText = (item.introText || item.intro || meta.intro || "").toString().trim();
  const infoButtonKey = (item.infoButtonKey || meta.infoButtonKey || "").toString().trim();
  const infoButtonText = (item.infoButtonText || meta.infoButtonText || "").toString().trim();
  const infoButtonLabel = (item.infoButtonLabel || meta.infoButtonLabel || "").toString().trim();
  const subgroup = (item.subgroup || "").toString().trim();
  const dimensionsIn = (item.dimensionsIn || "").toString().trim();
  const brand = (item.brand || "").toString().trim();
  const material = (item.material || "").toString().trim();
  const color = (item.color || "").toString().trim();
  const affiliate = (item.affiliate || "").toString().trim() || 'amazon';
  const tag = (item.tag || "").toString().trim() || 'fishkeepingli-20';
  const lengthIn = Number.isFinite(item.lengthIn) ? Number(item.lengthIn) : '';
  const widthIn = Number.isFinite(item.widthIn) ? Number(item.widthIn) : '';
  const heightIn = Number.isFinite(item.heightIn) ? Number(item.heightIn) : '';
  const capacityRaw = item.capacityLbs;
  const capacityLbs = Number.isFinite(capacityRaw) ? capacityRaw : "";
  const minGallons = Number.isFinite(item.minGallons) ? item.minGallons : meta.min;
  const maxGallons = Number.isFinite(item.maxGallons) ? item.maxGallons : meta.max;

  return {
    id,
    group,
    groupLabel,
    groupTip,
    introText,
    infoButtonKey,
    infoButtonText,
    infoButtonLabel,
    subgroup,
    title,
    notes,
    amazonUrl,
    dimensionsIn,
    capacityLbs,
    brand,
    material,
    color,
    affiliate,
    tag,
    lengthIn,
    widthIn,
    heightIn,
    minGallons,
    maxGallons
  };
}

function resolveSubstrateSubgroup(rawValue) {
  const value = String(rawValue || '').trim();
  const slug = slugifyKey(value);
  if (!slug) {
    return SUBSTRATE_DEFAULT_SUBGROUP;
  }
  const match = SUBSTRATE_SUBGROUP_LOOKUP.get(slug);
  if (match) {
    return match;
  }
  return {
    id: `substrate-${slug}`,
    label: value || SUBSTRATE_DEFAULT_SUBGROUP.label,
    slug,
    aliases: [slug]
  };
}

function normalizeRow(row, fallbackCategory) {
  const get = (key) => {
    if (key in row) return row[key];
    const lower = key.toLowerCase();
    if (lower in row) return row[lower];
    const upper = key.toUpperCase();
    if (upper in row) return row[upper];
    return "";
  };

  const fallbackCategoryNormalized = normalizeCategoryKey(fallbackCategory);
  const categoryRaw = (get('category') || fallbackCategory || "").toString().trim();
  let category = normalizeCategoryKey(categoryRaw);
  let rangeId = (get('Range_ID') || get('range_id') || "").toString().trim();
  let groupId = (get('Group_ID') || get('group_id') || rangeId || "").toString().trim();
  const subgroup = (get('subgroup') || get('Subgroup') || "").toString().trim();
  const tankRange = (get('tank_range') || get('Tank_Range') || "").toString().trim();
  const tanksize = (get('tanksize') || get('Tank_Size') || "").toString().trim();
  const length = (get('length') || get('Length') || "").toString().trim();
  const depth = toNumberOrBlank(get('depth') || get('depth_in'));
  const label = (get('Option_Label') || get('label') || "").toString().trim();
  const title = (get('Product_Name') || get('title') || "").toString().trim();
  const notes = (get('Notes') || get('notes') || "").toString().trim();
  const href = (get('Amazon_Link') || get('amazon_url') || get('href') || "").toString().trim();
  const image = (get('Image_URL') || get('image_url') || get('image') || "").toString().trim();
  const affiliate = (get('affiliate') || "").toString().trim() || "amazon";
  const tag = (get('tag') || "").toString().trim() || "fishkeepingli-20";
  let groupLabel = (get('Group_Label') || get('group_label') || "").toString().trim();
  const groupTip = (get('Group_Tip') || get('group_tip') || "").toString().trim();
  const id = (get('Item_ID') || get('id') || "").toString().trim();
  const bucketKeyRaw = (get('bucket_key') || get('Bucket_Key') || "").toString().trim();
  const bucketLabel = (get('bucket_label') || get('Bucket_Label') || "").toString().trim();
  const bucketSortValue = toNumberOrBlank(get('bucket_sort') || get('Bucket_Sort'));
  const lengthRangeRaw = (get('length_range') || get('Length_Range') || get('lengthRange') || "").toString().trim();
  const material = (get('material') || get('Material') || "").toString().trim();
  const color = (get('color') || get('Color') || "").toString().trim();
  const source = (get('source') || get('Source') || "").toString().trim();

  if (!category && fallbackCategoryNormalized) {
    category = fallbackCategoryNormalized;
  }

  const subgroupKey = subgroup.toLowerCase();
  if (category === 'water_treatments' && subgroupKey === 'fertilizers') {
    category = 'fertilizers';
  }

  if (category === 'lights') {
    const normalizedRange = normalizeLightRangeId(lengthRangeRaw || rangeId || bucketKeyRaw);
    if (normalizedRange) {
      rangeId = normalizedRange;
      groupId = groupId || normalizedRange;
    }
  }

  const categoryKeyForAlias = category || fallbackCategoryNormalized || '';
  const normalizedSubgroupKey = subgroup ? `${categoryKeyForAlias}::${subgroup.trim().toLowerCase()}` : '';
  const groupAlias = normalizedSubgroupKey ? GROUP_ALIAS_LOOKUP.get(normalizedSubgroupKey) : null;
  if (!groupId && groupAlias?.id) {
    groupId = groupAlias.id;
  }
  if (!groupLabel && groupAlias?.label) {
    groupLabel = groupAlias.label;
  }

  if (!rangeId && tankRange) {
    rangeId = tankRange;
  }
  if (!groupId && tankRange) {
    groupId = tankRange;
  }
  if (!groupLabel && tankRange) {
    groupLabel = tankRange;
  }

  if (!groupId && subgroup) {
    const categorySlug = slugifyKey(category || fallbackCategoryNormalized || 'group');
    const subgroupSlug = slugifyKey(subgroup);
    const combined = [categorySlug, subgroupSlug].filter(Boolean).join('-');
    groupId = combined || subgroupSlug || categorySlug || "";
  }

  if (!groupLabel && subgroup) {
    groupLabel = subgroup;
  }

  const normalized = {
    id,
    label,
    title,
    notes,
    href,
    image,
    category,
    subgroup,
    subgroupId: '',
    tanksize,
    length,
    depth,
    affiliate,
    tag,
    rangeId,
    groupId,
    groupLabel,
    groupTip,
    tankRange,
    material,
    color,
    source,
    bucketKey: bucketKeyRaw,
    bucketLabel,
    bucketSort: bucketSortValue
  };

  if (category === 'filters') {
    const normalizedBucketKey = normalizeFilterBucketKey(bucketKeyRaw || rangeId || groupId || tanksize);
    if (normalizedBucketKey) {
      normalized.bucketKey = normalizedBucketKey;
    }
  }

  if (!normalized.category && fallbackCategory) {
    normalized.category = normalizeCategoryKey(fallbackCategory);
  }
  if (!normalized.rangeId && normalized.bucketKey) {
    normalized.rangeId = normalized.bucketKey;
  }
  if (!normalized.rangeId && bucketKeyRaw) {
    normalized.rangeId = bucketKeyRaw;
  }
  if (!normalized.tanksize && normalized.rangeId && (normalized.category === 'heaters' || normalized.category === 'filters')) {
    normalized.tanksize = rangeBand(normalized.rangeId);
  }
  if (!normalized.length && normalized.rangeId && normalized.category === 'lights') {
    normalized.length = rangeBand(normalized.rangeId);
  }

  if (normalized.category === 'lights') {
    const canonicalRange = normalizeLightRangeId(
      normalized.rangeId || lengthRangeRaw || rangeId || normalized.bucketKey || ''
    );
    if (canonicalRange) {
      normalized.rangeId = canonicalRange;
      normalized.bucketKey = canonicalRange;
      if (!normalized.length) {
        normalized.length = rangeBand(canonicalRange);
      }
    }
  }

  if (normalized.category === 'substrate') {
    const subgroupMeta = resolveSubstrateSubgroup(normalized.subgroup || normalized.subgroupId);
    normalized.subgroup = subgroupMeta.label;
    normalized.subgroupId = subgroupMeta.id;
    const desiredRangeId = slugifyKey(
      normalized.rangeId || normalized.groupId || normalized.tankRange || SUBSTRATE_DEFAULT_GROUP_ID
    );
    const rangeSlug = desiredRangeId ? `substrate-${desiredRangeId}` : SUBSTRATE_DEFAULT_GROUP_ID;
    normalized.rangeId = rangeSlug;
    normalized.groupId = rangeSlug;
    if (!normalized.groupLabel || normalized.groupLabel === normalized.groupId || normalized.groupLabel === normalized.tankRange) {
    normalized.groupLabel = SUBSTRATE_DEFAULT_GROUP_LABEL;
    }
  }

  if (normalized.category === 'food') {
    const groupKeySource = normalizeFoodGroupKey(normalized.subgroup || normalized.groupLabel || normalized.groupId);
    const alias = groupKeySource ? FOOD_GROUP_ALIASES.get(groupKeySource) : undefined;
    if (alias) {
      normalized.groupId = alias.id;
      normalized.rangeId = alias.id;
      normalized.groupLabel = alias.label;
      normalized.subgroup = alias.label;
    }
  }

  return normalized;
}

function ensureOptionDefaults(item, index, fallbackCategory, fallbackKey) {
  const option = {
    label: item.label || "",
    title: item.title || "",
    notes: item.notes || "",
    href: item.href || "",
    image: item.image || "",
    id: item.id || "",
    category: item.category || fallbackCategory || "",
    subgroup: item.subgroup || "",
    subgroupId: item.subgroupId || "",
    tanksize: item.tanksize || "",
    length: item.length || "",
    depth: item.depth === "" ? "" : item.depth,
    affiliate: item.affiliate || "amazon",
    tag: item.tag || "fishkeepingli-20",
    material: item.material || "",
    color: item.color || "",
    source: item.source || ""
  };

  if (!option.label) {
    option.label = `Option ${index + 1}`;
  }
  if (!option.id) {
    option.id = `${option.category || 'item'}-${fallbackKey || 'option'}-${String(index + 1).padStart(2, '0')}`;
  }

  return option;
}

function buildRange(collection, metaMap, items, category) {
  return collection.map((range) => {
    const meta = metaMap.get(range.id) || { label: `Recommended ${category} for ${range.label}`, tip: "" };
    const matches = items.filter((item) => (item.rangeId || "").toLowerCase() === range.id.toLowerCase());
    const options = matches.map((item, index) => ensureOptionDefaults(item, index, category, range.id));
    const minLength = Number.isFinite(range.min) ? range.min : undefined;
    const maxLength = Number.isFinite(range.max) ? range.max : undefined;
    const sort = Number.isFinite(range.sort) ? range.sort : undefined;
    const placeholder = meta.placeholder || (options.length ? '' : 'Lights coming soon.');
    return {
      id: range.id,
      label: meta.label,
      rangeLabel: meta.label,
      tip: meta.tip || "",
      options,
      placeholder,
      minL: minLength,
      maxL: maxLength,
      sort
    };
  });
}

function buildHeaterBuckets(items = []) {
  const bucketStore = new Map();

  items.forEach((item) => {
    const rawKey = item.bucketKey || item.rangeId || '';
    const key = normalizeHeaterBucketKey(rawKey);
    if (!key) return;
    if (!bucketStore.has(key)) {
      const sortValue = Number.isFinite(item.bucketSort) ? Number(item.bucketSort) : '';
      bucketStore.set(key, {
        id: key,
        label: (item.bucketLabel || '').trim(),
        sort: sortValue,
        options: []
      });
    }
    const bucket = bucketStore.get(key);
    if (!bucket.label && item.bucketLabel) {
      bucket.label = item.bucketLabel;
    }
    if (!Number.isFinite(bucket.sort)) {
      const numericSort = Number(item.bucketSort);
      if (Number.isFinite(numericSort)) {
        bucket.sort = numericSort;
      }
    }
    bucket.options.push(ensureOptionDefaults(item, bucket.options.length, 'heaters', key));
  });

  const orderedBuckets = RANGES_HEATERS.map((bucket) => {
    const key = normalizeHeaterBucketKey(bucket.id);
    const stored = bucketStore.get(key);
    const meta = HEATER_RANGE_META.get(bucket.id) || {};
    const label = stored?.label || bucket.label || meta.label || '';
    const sortValue = Number.isFinite(stored?.sort)
      ? stored.sort
      : Number.isFinite(bucket.sort)
        ? bucket.sort
        : Number.isFinite(meta.sort)
          ? meta.sort
          : undefined;
    const options = stored ? stored.options : [];
    return {
      id: bucket.id,
      label,
      rangeLabel: meta.label || label,
      tip: meta.tip || '',
      options,
      minGallons: bucket.min,
      maxGallons: bucket.max,
      sort: Number.isFinite(sortValue) ? sortValue : bucket.sort || 0,
      placeholder: options.length ? '' : 'Links coming soon.'
    };
  });

  return orderedBuckets.sort((a, b) => (a.sort || 0) - (b.sort || 0));
}

function getFilterBucketId(item = {}) {
  const subgroup = String(item.subgroup || '').trim().toLowerCase();
  if (subgroup === 'filter media') return '';
  const candidates = [
    item.bucketKey,
    item.rangeId,
    item.groupId,
    item.tanksize,
    item.id,
    item.label,
    item.title
  ];
  for (const candidate of candidates) {
    const normalized = normalizeFilterBucketKey(candidate);
    if (normalized) return normalized;
  }
  return '';
}

function buildFilterBuckets(items = []) {
  const bucketStore = new Map();

  const ensureBucket = (id) => {
    if (!bucketStore.has(id)) {
      const meta = FILTER_BUCKET_META.get(id) || {};
      const rangeMeta = FILTER_RANGE_META.get(id) || {};
      bucketStore.set(id, {
        id,
        label: rangeMeta.label || meta.label || id,
        rangeLabel: rangeMeta.label || meta.label || id,
        tip: rangeMeta.tip || '',
        sort: Number.isFinite(meta.sort) ? meta.sort : undefined,
        minGallons: Number.isFinite(meta.min) ? meta.min : undefined,
        maxGallons: Number.isFinite(meta.max) ? meta.max : undefined,
        options: [],
        bucketLabel: '',
        bucketSort: undefined
      });
    }
    return bucketStore.get(id);
  };

  items.forEach((item) => {
    const bucketId = getFilterBucketId(item);
    if (!bucketId) return;
    const bucket = ensureBucket(bucketId);
    if (!bucket.bucketLabel && item.bucketLabel) {
      bucket.bucketLabel = item.bucketLabel;
    }
    const sortValue = Number(item.bucketSort);
    if (Number.isFinite(sortValue)) {
      bucket.bucketSort = sortValue;
    }
    if (!bucket.minGallons && Number.isFinite(item.minGallons)) {
      bucket.minGallons = item.minGallons;
    }
    if (!bucket.maxGallons && Number.isFinite(item.maxGallons)) {
      bucket.maxGallons = item.maxGallons;
    }
    bucket.options.push(ensureOptionDefaults(item, bucket.options.length, 'filters', bucketId));
  });

  const orderedBuckets = FILTER_BUCKETS.map((definition) => {
    const stored = bucketStore.get(definition.id);
    const meta = FILTER_BUCKET_META.get(definition.id) || {};
    const rangeMeta = FILTER_RANGE_META.get(definition.id) || {};
    const options = stored ? stored.options : [];
    const sort = Number.isFinite(stored?.bucketSort)
      ? stored.bucketSort
      : Number.isFinite(meta.sort)
        ? meta.sort
        : Number.isFinite(definition.sort)
          ? definition.sort
          : 0;
    const minGallons = Number.isFinite(stored?.minGallons)
      ? stored.minGallons
      : Number.isFinite(meta.min)
        ? meta.min
        : Number.isFinite(definition.min)
          ? definition.min
          : undefined;
    const maxGallons = Number.isFinite(stored?.maxGallons)
      ? stored.maxGallons
      : Number.isFinite(meta.max)
        ? meta.max
        : Number.isFinite(definition.max)
          ? definition.max
          : undefined;
    const labelFromData = stored?.bucketLabel || stored?.label;
    const label = labelFromData || rangeMeta.label || meta.label || definition.label || definition.id;
    return {
      id: definition.id,
      label,
      rangeLabel: rangeMeta.label || label,
      tip: rangeMeta.tip || '',
      sort: Number.isFinite(sort) ? sort : 0,
      minGallons: Number.isFinite(minGallons) ? minGallons : undefined,
      maxGallons: Number.isFinite(maxGallons) ? maxGallons : undefined,
      options,
      placeholder: options.length ? '' : 'Links coming soon.'
    };
  });

  const extraBuckets = Array.from(bucketStore.keys()).filter((key) => !FILTER_BUCKET_META.has(key));
  const extraBucketDefs = extraBuckets.map((key, index) => {
    const stored = bucketStore.get(key);
    if (!stored) return null;
    const rangeMeta = FILTER_RANGE_META.get(key) || {};
    const sort = Number.isFinite(stored.bucketSort)
      ? stored.bucketSort
      : Number.isFinite(stored.sort)
        ? stored.sort
        : FILTER_BUCKETS.length + index;
    return {
      id: key,
      label: stored.bucketLabel || stored.label || rangeMeta.label || key,
      rangeLabel: rangeMeta.label || stored.rangeLabel || stored.bucketLabel || stored.label || key,
      tip: rangeMeta.tip || stored.tip || '',
      sort: Number.isFinite(sort) ? sort : FILTER_BUCKETS.length + index,
      minGallons: Number.isFinite(stored.minGallons) ? stored.minGallons : undefined,
      maxGallons: Number.isFinite(stored.maxGallons) ? stored.maxGallons : undefined,
      options: stored.options,
      placeholder: stored.options.length ? '' : 'Links coming soon.'
    };
  }).filter(Boolean);

  return [...orderedBuckets, ...extraBucketDefs].sort((a, b) => (a.sort || 0) - (b.sort || 0));
}

function buildGroups(items, tipsMap, category, metaMap) {
  const order = [];
  const map = new Map();
  items.forEach((item) => {
    const id = item.groupId || item.rangeId || `${category}-group`;
    const staticMeta = metaMap?.get(id) || {};
    if (!map.has(id)) {
      const finalId = staticMeta.id || id;
      const tip = tipsMap?.get(id) || item.groupTip || staticMeta.tip || "";
      map.set(id, {
        id: finalId,
        originalId: id,
        label: item.groupLabel || staticMeta.label || id,
        rangeLabel: staticMeta.label || item.groupLabel || id,
        tip,
        intro: staticMeta.intro || "",
        infoButtonKey: staticMeta.infoButtonKey || "",
        infoButtonLabel: staticMeta.infoButtonLabel || "",
        infoButtonText: staticMeta.infoButtonText || "",
        options: [],
        placeholder: ''
      });
      order.push(id);
    }
    const group = map.get(id);
    if (!group.label && staticMeta.label) {
      group.label = staticMeta.label;
    }
    if (item.groupLabel) {
      group.label = item.groupLabel;
      group.rangeLabel = item.groupLabel;
    } else if (!group.rangeLabel && group.label) {
      group.rangeLabel = group.label;
    }
    if (item.groupTip) group.tip = item.groupTip;
    if (tipsMap?.get(id)) group.tip = tipsMap.get(id);
    if (!group.tip && staticMeta.tip) {
      group.tip = staticMeta.tip;
    }
    if (!group.intro && staticMeta.intro) {
      group.intro = staticMeta.intro;
    }
    if (!group.infoButtonKey && staticMeta.infoButtonKey) {
      group.infoButtonKey = staticMeta.infoButtonKey;
    }
    if (!group.infoButtonLabel && staticMeta.infoButtonLabel) {
      group.infoButtonLabel = staticMeta.infoButtonLabel;
    }
    if (!group.infoButtonText && staticMeta.infoButtonText) {
      group.infoButtonText = staticMeta.infoButtonText;
    }
    group.options.push(ensureOptionDefaults(item, group.options.length, category, id));
  });
  if ((category || '').toLowerCase() === 'water_treatments') {
    map.forEach((group) => {
      const subgroupOrder = [];
      const subgroupMap = new Map();
      group.options.forEach((option) => {
        const rawName = (option.subgroup || '').trim();
        const name = rawName || 'General';
        if (!subgroupMap.has(name)) {
          const slug = slugifyKey(name) || `subgroup-${subgroupOrder.length + 1}`;
          subgroupMap.set(name, {
            id: `water-treatments-${slug}`,
            label: name,
            options: []
          });
          subgroupOrder.push(name);
        }
        const subgroup = subgroupMap.get(name);
        subgroup.options.push(option);
      });
      if (subgroupOrder.length) {
        group.subgroups = subgroupOrder.map((name) => subgroupMap.get(name)).filter(Boolean);
        group.options = [];
      }
    });
  }

  if ((category || '').toLowerCase() === 'substrate') {
    map.forEach((group) => {
      if (!group.label || group.label === group.originalId) {
        group.label = SUBSTRATE_DEFAULT_GROUP_LABEL;
      }
      if (!group.rangeLabel) {
        group.rangeLabel = group.label;
      }
      const subgroupMap = new Map();
      const subgroupOrder = [];
      (group.options || []).forEach((option) => {
        const meta = resolveSubstrateSubgroup(option.subgroup || option.subgroupId);
        const key = meta.id || option.subgroupId || `substrate-${subgroupOrder.length + 1}`;
        if (!subgroupMap.has(key)) {
          subgroupMap.set(key, {
            id: key,
            label: meta.label,
            slug: meta.slug,
            options: [],
            placeholder: ''
          });
          subgroupOrder.push(key);
        }
        const subgroup = subgroupMap.get(key);
        if (meta.label && !subgroup.label) {
          subgroup.label = meta.label;
        }
        subgroup.options.push(option);
      });

      if (subgroupOrder.length) {
        const prioritized = SUBSTRATE_SUBGROUP_ORDER.map((id) => subgroupMap.get(id)).filter(Boolean);
        const prioritizedSet = new Set(prioritized.map((item) => item?.id));
        const remainder = subgroupOrder
          .map((id) => subgroupMap.get(id))
          .filter((subgroup) => subgroup && !prioritizedSet.has(subgroup.id))
          .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
        const ordered = [...prioritized, ...remainder].filter(Boolean);
        group.subgroups = ordered.map((subgroup) => ({
          ...subgroup,
          placeholder: subgroup.options.length ? '' : 'Substrate picks coming soon.'
        }));
        group.options = [];
        if (!group.placeholder) {
          group.placeholder = 'Substrate picks coming soon.';
        }
      }
    });
  }

  const defaultOrder = order.map((id) => map.get(id));
  if ((category || '').toLowerCase() === 'food') {
    const seen = new Set();
    const prioritized = FOOD_GROUP_ORDER.filter((id) => {
      if (!map.has(id)) return false;
      seen.add(id);
      return true;
    }).map((id) => map.get(id));
    const remainder = defaultOrder.filter((group) => group && !seen.has(group.id));
    return [...prioritized, ...remainder];
  }
  if ((category || '').toLowerCase() === 'maintenance_tools') {
    const seen = new Set();
    const prioritized = MAINTENANCE_SUBGROUP_ORDER.filter((id) => {
      if (!map.has(id)) return false;
      seen.add(id);
      return true;
    }).map((id) => map.get(id));
    const remainder = defaultOrder.filter((group) => group && !seen.has(group.id));
    return [...prioritized, ...remainder];
  }
  return defaultOrder;
}

function slugifyExtrasKey(value, fallback = 'group') {
  const base = String(value || '').trim();
  if (!base) return fallback;
  const normalized = base
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function buildExtrasGroup(items = []) {
  const order = [];
  const map = new Map();
  let total = 0;

  items.forEach((item) => {
    const subgroupName = (item.subgroup || '').trim() || EXTRAS_DEFAULT_SUBGROUP;
    if (!map.has(subgroupName)) {
      const slug = slugifyExtrasKey(subgroupName, EXTRAS_DEFAULT_SUBGROUP.toLowerCase());
      map.set(subgroupName, {
        id: `extras-${slug}`,
        label: subgroupName,
        items: []
      });
      order.push(subgroupName);
    }

    const group = map.get(subgroupName);
    const title = (item.title || item.label || '').trim();
    if (!title) return;

    group.items.push({
      title,
      notes: (item.notes || '').trim(),
      href: (item.href || '').trim()
    });
    total += 1;
  });

  const subgroups = order
    .map((key) => map.get(key))
    .filter((group) => group && group.items.length > 0);

  return {
    id: EXTRAS_ACCORDION_META.id,
    label: EXTRAS_ACCORDION_META.label,
    intro: EXTRAS_INTRO,
    infoButtonKey: EXTRAS_ACCORDION_META.infoButtonKey,
    infoButtonLabel: EXTRAS_ACCORDION_META.infoButtonLabel,
    infoButtonText: TIPS[EXTRAS_ACCORDION_META.infoButtonKey] || '',
    placeholder: EXTRAS_PLACEHOLDER,
    subgroups,
    itemsCount: total,
    type: 'extras'
  };
}

function buildExtras(items = []) {
  const group = buildExtrasGroup(items);
  if (!group) return [];
  return [group];
}

function normalizeStandRangeId(range = '') {
  return String(range || '')
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z+-]/g, '-');
}

function formatStandRangeLabel(range = '') {
  const value = String(range || '').trim();
  if (!value || value.toLowerCase() === 'other') {
    return 'Stand Options';
  }
  if (/plus$/i.test(value)) {
    const base = value.replace(/-?plus$/i, '+');
    return `Stand Options for ${base} Gallons`;
  }
  return `Stand Options for ${value.replace(/-/g, '–')} Gallons`;
}

function buildStandRanges(items = []) {
  const groups = new Map();

  const ensureGroup = (key, source) => {
    if (!groups.has(key)) {
      const meta = STAND_ALLOWED_GROUPS.get(key) || {};
      const safeKey = normalizeStandRangeId(key || 'stands');
      const requestedId = String(source?.groupId || meta.id || '').trim();
      const sanitizedRequestedId = requestedId
        ? requestedId.replace(/[^a-z0-9-_]/gi, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
        : '';
      const label = (source?.groupLabel || '').trim() || meta.label || formatStandRangeLabel(key);
      const intro = (source?.introText || source?.groupTip || meta.intro || meta.tip || '').trim();
      groups.set(key, {
        id: sanitizedRequestedId || `stands-${safeKey}`,
        label,
        tip: (source?.groupTip || meta.tip || '').trim(),
        intro,
        infoButtonKey: (source?.infoButtonKey || meta.infoButtonKey || '').trim(),
        infoButtonLabel: (source?.infoButtonLabel || meta.infoButtonLabel || '').trim(),
        infoButtonText: (source?.infoButtonText || meta.infoButtonText || '').trim(),
        placeholder: 'No stand recommendations yet. Check back soon.',
        options: [],
        minGallons: Number.isFinite(source?.minGallons) ? source.minGallons : meta.min,
        maxGallons: Number.isFinite(source?.maxGallons) ? source.maxGallons : meta.max
      });
    }
    const group = groups.get(key);
    if (source?.groupLabel && !group.label) {
      group.label = source.groupLabel;
    }
    const meta = STAND_ALLOWED_GROUPS.get(key) || {};
    const sourceTip = (source?.groupTip || '').trim();
    if (sourceTip) {
      group.tip = sourceTip;
    } else if (!group.tip && meta.tip) {
      group.tip = meta.tip;
    }
    const sourceIntro = (source?.introText || source?.intro || '').trim();
    if (sourceIntro) {
      group.intro = sourceIntro;
    } else if (!group.intro && meta.intro) {
      group.intro = meta.intro;
    }
    const sourceInfoKey = (source?.infoButtonKey || '').trim();
    if (sourceInfoKey) {
      group.infoButtonKey = sourceInfoKey;
    } else if (!group.infoButtonKey && meta.infoButtonKey) {
      group.infoButtonKey = meta.infoButtonKey;
    }
    const sourceInfoLabel = (source?.infoButtonLabel || '').trim();
    if (sourceInfoLabel) {
      group.infoButtonLabel = sourceInfoLabel;
    } else if (!group.infoButtonLabel && meta.infoButtonLabel) {
      group.infoButtonLabel = meta.infoButtonLabel;
    }
    const sourceInfoText = (source?.infoButtonText || '').trim();
    if (sourceInfoText) {
      group.infoButtonText = sourceInfoText;
    } else if (!group.infoButtonText && meta.infoButtonText) {
      group.infoButtonText = meta.infoButtonText;
    }
    if (Number.isFinite(source?.minGallons)) {
      group.minGallons = source.minGallons;
    }
    if (Number.isFinite(source?.maxGallons)) {
      group.maxGallons = source.maxGallons;
    }
    return group;
  };

  items.forEach((item) => {
    const key = (item.group || '').trim();
    if (!STAND_ALLOWED_GROUPS.has(key)) {
      return;
    }
    const group = ensureGroup(key, item);
    const optionId = item.id || `${group.id}-option-${group.options.length + 1}`;
    group.options.push({
      id: optionId,
      label: '',
      title: item.title || '',
      note: item.notes || '',
      notes: item.notes || '',
      href: item.amazonUrl || '',
      category: 'stands',
      subgroup: item.subgroup || '',
      affiliate: item.affiliate || 'amazon',
      tag: item.tag || 'fishkeepingli-20',
      tanksize: key,
      dimensionsLite: item.dimensionsIn || '',
      capacityLbs: item.capacityLbs || '',
      brand: item.brand || '',
      material: item.material || '',
      color: item.color || '',
      length: item.lengthIn || '',
      depth: item.widthIn || '',
      height: item.heightIn || '',
      minGallons: item.minGallons,
      maxGallons: item.maxGallons
    });
  });

  const orderedKeys = STAND_RANGE_ORDER.filter((key) => groups.has(key));
  return orderedKeys.map((key) => groups.get(key));
}

function getItemsByCategory(normalized, category) {
  return normalized.get(category) || [];
}

function buildGear(normalized, standsItems = []) {
  const heaters = getItemsByCategory(normalized, 'heaters');
  const filters = getItemsByCategory(normalized, 'filters');
  const filterMediaItems = filters.filter((item) =>
    String(item.subgroup || '')
      .toLowerCase()
      .trim() === 'filter media'
  );
  const filterRangeItems = filters.filter((item) => {
    const subgroup = String(item.subgroup || '').toLowerCase().trim();
    if (subgroup === 'filter media') return false;
    return Boolean((item.rangeId || '').trim());
  });
  const filterBuckets = buildFilterBuckets(filterRangeItems);
  const filterMediaGroups = buildGroups(filterMediaItems, undefined, 'filters', FILTER_GROUP_META);
  const filterMediaGroup = filterMediaGroups.find((group) => group && group.options && group.options.length);
  const lights = getItemsByCategory(normalized, 'lights');
  const substrate = getItemsByCategory(normalized, 'substrate');
  const fertilizers = getItemsByCategory(normalized, 'fertilizers');
  const waterTreatments = getItemsByCategory(normalized, 'water_treatments');
  const food = getItemsByCategory(normalized, 'food');
  const maintenanceSource = getItemsByCategory(normalized, 'maintenance_tools');
  const maintenance = [];
  const airItems = [];
  const normalizeAirKey = (value = '') =>
    String(value || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\s+/g, ' ')
      .trim();

  maintenanceSource.forEach((item) => {
    const subgroupKey = normalizeAirKey(item.subgroup);
    const groupKey = normalizeAirKey(item.groupId || item.rangeId);
    const isAir = subgroupKey === 'air and aeration' || groupKey === 'maintenance_air';
    if (isAir) {
      airItems.push({ ...item, category: 'air' });
    } else {
      maintenance.push(item);
    }
  });
  const extras = getItemsByCategory(normalized, 'extras');
  const stands = Array.isArray(standsItems) ? standsItems : [];
  const standRanges = buildStandRanges(stands);

  const gear = {
    heaters: {
      match: 'gallons',
      buckets: buildHeaterBuckets(heaters),
      addon: { ...HEATERS_ADDON }
    },
    filters: {
      match: 'gallons',
      buckets: filterBuckets,
      mediaGroup: filterMediaGroup || filterMediaGroups[0] || null
    },
    lights: {
      match: 'length',
      ranges: buildRange(RANGES_LIGHTS, LIGHT_RANGE_META, lights, 'lights')
    },
    air: {
      match: 'none',
      accordions: buildGroups(airItems, undefined, 'air', AIR_GROUP_META)
    },
    substrate: {
      match: 'gallons',
      groups: buildGroups(substrate, undefined, 'substrate')
    },
    fertilizers: {
      match: 'none',
      ranges: buildGroups(fertilizers, FERTILIZER_TIPS, 'fertilizers')
    },
    waterTreatments: {
      match: 'none',
      ranges: buildGroups(waterTreatments, WATER_TREATMENT_TIPS, 'water_treatments')
    },
    food: {
      match: 'none',
      accordions: buildGroups(food, FOOD_GROUP_TIPS, 'food')
    },
    maintenanceTools: {
      match: 'none',
      intro: MAINTENANCE_INTRO,
      accordions: buildGroups(maintenance, MAINTENANCE_GROUP_TIPS, 'maintenance_tools', MAINTENANCE_GROUP_META)
    },
    extras: {
      match: 'none',
      accordions: buildExtras(extras)
    },
    stands: {
      match: 'gallons',
      items: stands,
      ranges: standRanges
    }
  };

  return gear;
}

async function fetchCsv(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.text();
}

async function loadGearData() {
  const normalized = new Map();
  for (const source of CSV_SOURCES) {
    try {
      const text = await fetchCsv(source.path);
      const rows = parseCSV(text);
      rows.forEach((row) => {
        const normalizedRow = normalizeRow(row, source.category);
        const category = normalizedRow.category || source.category || '';
        const key = category.toLowerCase();
        if (!normalized.has(key)) {
          normalized.set(key, []);
        }
        normalized.get(key).push(normalizedRow);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Gear] Data load failed:', error);
    }
  }
  return normalized;
}

async function loadStandsData() {
  try {
    const response = await fetch(STANDS_JSON_PATH, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load ${STANDS_JSON_PATH}: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((item) => normalizeStandItem(item))
      .filter((item) => item !== null);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Gear] Stands data load failed:', error);
    return [];
  }
}

const gearDataPromise = (async () => {
  const [normalized, stands] = await Promise.all([loadGearData(), loadStandsData()]);
  const gear = buildGear(normalized, stands);
  if (typeof window !== 'undefined') {
    window.GEAR = gear;
    window.ttgGearNormalized = normalized;
  }
  return gear;
})().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[Gear] Initialization failed:', error);
  const fallback = buildGear(new Map(), []);
  if (typeof window !== 'undefined') {
    window.GEAR = fallback;
    window.ttgGearNormalized = new Map();
  }
  return fallback;
});

if (typeof window !== 'undefined') {
  window.ttgGearDataPromise = gearDataPromise;
}
