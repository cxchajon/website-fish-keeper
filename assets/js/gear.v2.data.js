/* Ranges used for matching/highlighting */
const RANGES_HEATERS = [
  { id: "g-5-10", label: "5–10 gallons", min: 5, max: 10 },
  { id: "g-10-20", label: "10–20 gallons", min: 10, max: 20 },
  { id: "g-20-40", label: "20–40 gallons", min: 20, max: 40 },
  { id: "g-40-60", label: "40–60 gallons", min: 40, max: 60 },
  { id: "g-60-90", label: "60–90 gallons", min: 60, max: 90 },
  { id: "g-90-125", label: "90–125 gallons", min: 90, max: 125 }
];

const RANGES_FILTERS = RANGES_HEATERS.slice(); // same gallon buckets

const RANGES_LIGHTS = [
  { id: "l-12-20", label: "12–20 inches", min: 12, max: 20 },
  { id: "l-20-24", label: "20–24 inches", min: 20, max: 24 },
  { id: "l-24-30", label: "24–30 inches", min: 24, max: 30 },
  { id: "l-30-36", label: "30–36 inches", min: 30, max: 36 },
  { id: "l-36-48", label: "36–48 inches", min: 36, max: 47.99 },
  { id: "l-48-up", label: "48 inches and up", min: 48, max: 999 }
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
  substrate: `
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
  Rotate 2–3 foods; feed only what’s eaten within ~30–60 seconds.<br>
  For bottom dwellers, use sinking foods; for shrimp, micron foods.<br>
  Overfeeding → ammonia → nitrates → algae.
`,
  'maintenance-tools': `
  <strong>Safety &amp; Power Tips</strong><br>
  GFCI outlets and drip loops prevent electrical hazards.<br>
  Keep power strips dry and elevated.<br>
  Use timers or smart plugs for consistent light cycles and to reduce wear on equipment.
`
};

const HEATER_RANGE_META = new Map([
  ["g-5-10", { label: "Recommended Heaters for 5–10 Gallons", tip: "For 5–10 gal, target 25–50W. Place near gentle flow for even heat." }],
  ["g-10-20", { label: "Recommended Heaters for 10–20 Gallons", tip: "For 10–20 gal, aim for 50–100W." }],
  ["g-20-40", { label: "Recommended Heaters for 20–40 Gallons", tip: "For 20–40 gal tanks, aim for 100–200W. When placing your heater, account for tank height, substrate depth, and water line markings. Most shouldn’t touch the substrate, and not all are fully submersible. Place near gentle flow for even heat." }],
  ["g-40-60", { label: "Recommended Heaters for 40–60 Gallons", tip: "For 40–60 gal tanks, aim for ~200–300W and place the heater in steady flow for even temperature. (Full placement/safety details are in the Heater Tip popup.)" }],
  ["g-60-90", { label: "Recommended Heaters for 60–90 Gallons", tip: "For 60–90 gal tanks, aim for ~300–500W total heating. Consider splitting across two smaller heaters for even coverage and redundancy. (Full placement/safety guidance is in the Heater Tip popup.)" }],
  ["g-90-125", { label: "Recommended Heaters for 90–125 Gallons", tip: "For 90–125 gal tanks, aim for 500–800W total heating power. For large aquariums, use multiple heaters for balanced temperature and redundancy. (Full placement/safety details in the Heater Tip popup.)" }]
]);

const FILTER_RANGE_META = new Map([
  ["g-5-10", { label: "Recommended Filters for 5–10 Gallons", tip: "For 5–10 gal tanks, use gentle filtration — sponge or low-flow HOB filters. Clean sponges monthly and avoid replacing biomedia to preserve beneficial bacteria. (Full maintenance and sizing guidance available in the Filter Tip popup.)" }],
  ["g-10-20", { label: "Recommended Filters for 10–20 Gallons", tip: "" }],
  ["g-20-40", { label: "Recommended Filters for 20–40 Gallons", tip: "" }],
  ["g-40-60", { label: "Recommended Filters for 40–60 Gallons", tip: "" }],
  ["g-60-90", { label: "Recommended Filters for 60–90 Gallons", tip: "" }],
  ["g-90-125", { label: "Recommended Filters for 90–125 Gallons", tip: "" }]
]);

const LIGHT_RANGE_META = new Map([
  ["l-12-20", { label: "Recommended Lights for 12–20 Inch Tanks", tip: "" }],
  ["l-20-24", { label: "Recommended Lights for 20–24 Inch Tanks", tip: "" }],
  ["l-24-30", { label: "Recommended Lights for 24–30 Inch Tanks", tip: "" }],
  ["l-30-36", { label: "Recommended Lights for 30–36 Inch Tanks", tip: "" }],
  ["l-36-48", { label: "Recommended Lights for 36–48 Inches", tip: "For 36–48 inch tanks, choose lights with adjustable brackets or a slight overhang. Longer tanks may benefit from dual fixtures or higher wattage to maintain even brightness and plant growth." }],
  ["l-48-up", { label: "Recommended Lights for 48 Inches and Up", tip: "For tanks 48 inches and longer, use extended-length fixtures or dual lights for even coverage. Longer tanks benefit from high-output full-spectrum LEDs with strong PAR and deeper penetration to support planted setups. Dual fixtures can also help eliminate dark zones and maintain even brightness from end to end." }]
]);

const WATER_TREATMENT_TIPS = new Map([
  ["wt-core", "Conditioners and bacterial starters help make tap water safe and maintain tank stability. Always dose for total tank volume, not just refill water."]
]);

const FOOD_INTRO = "A balanced rotation keeps fish vibrant and healthy. Combine a daily staple with a protein treat and a veggie/algae option. Feed only what’s eaten within 30–60 seconds to maintain good water quality.";

const FOOD_GROUP_TIPS = new Map([
  ["food-staple", "Daily flakes and pellets that anchor your rotation for community tanks."],
  ["food-protein", "Offer 1–2x weekly to boost protein and keep diets varied."],
  ["food-veggie", "Sinking wafers that keep plecos, shrimp, and bottom grazers nourished."]
]);

const MAINTENANCE_INTRO = "Keep your aquarium healthy and clear with the right tools for testing, water changes, and glass maintenance. Consistent care prevents algae, stress, and equipment issues.";

const MAINTENANCE_GROUP_TIPS = new Map([
  ["maintenance-safety", "Use GFCI protection and surge-protected strips to keep your aquarium gear safe. Always create drip loops on cords, label plugs for quick shutoff, and keep outlets above water level."]
]);

const CSV_SOURCES = [
  { path: "/data/gear_heaters.csv", category: "heaters" },
  { path: "/data/gear_filters.csv", category: "filters" },
  { path: "/data/gear_lighting.csv", category: "lights" },
  { path: "/data/gear_substrate.csv", category: "substrate" },
  { path: "/data/gear_water_food_tools.csv", category: "" }
];

const STANDS_CSV_PATH = "/data/gear_stands.csv";
const STAND_SUBGROUPS = ["Metal_Frame", "Cabinet", "Solid_Wood", "Leveling_Support"];

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
  const parts = String(rangeId).split('-').slice(1);
  return parts.length ? parts.join('-') : "";
}

function toNumberOrBlank(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) ? num : "";
}

function normalizeStandRow(row) {
  const get = (key) => {
    if (key in row) return row[key];
    const lower = key.toLowerCase();
    if (lower in row) return row[lower];
    const upper = key.toUpperCase();
    if (upper in row) return row[upper];
    return "";
  };

  const id = (get('product_id') || "").toString().trim();
  const subgroup = (get('subgroup') || "").toString().trim();
  const title = (get('title') || "").toString().trim();
  const notes = (get('notes') || "").toString().trim();
  const href = (get('amazon_url') || get('href') || "").toString().trim();
  const image = (get('image_url') || get('image') || "").toString().trim();
  const lengthIn = toNumberOrBlank((get('length_in') || get('length') || "").toString().trim());
  const widthIn = toNumberOrBlank((get('width_in') || get('width') || "").toString().trim());
  const heightIn = toNumberOrBlank((get('height_in') || get('height') || "").toString().trim());
  const capacityLbs = toNumberOrBlank((get('capacity_lbs') || get('capacity') || "").toString().trim());
  const material = (get('material') || "").toString().trim();
  const color = (get('color') || "").toString().trim();
  const affiliate = (get('affiliate') || "").toString().trim() || "amazon";
  const tag = (get('tag') || "").toString().trim() || "fishkeepingli-20";

  return {
    id,
    subgroup,
    title,
    notes,
    href,
    image,
    length_in: lengthIn,
    width_in: widthIn,
    height_in: heightIn,
    capacity_lbs: capacityLbs,
    material,
    color,
    affiliate,
    tag
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

  const categoryRaw = (get('category') || fallbackCategory || "").toString().trim();
  const category = categoryRaw ? categoryRaw.toLowerCase() : "";
  const rangeId = (get('Range_ID') || get('range_id') || "").toString().trim();
  const groupId = (get('Group_ID') || get('group_id') || rangeId || "").toString().trim();
  const subgroup = (get('subgroup') || get('Subgroup') || "").toString().trim();
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
  const groupLabel = (get('Group_Label') || get('group_label') || "").toString().trim();
  const groupTip = (get('Group_Tip') || get('group_tip') || "").toString().trim();
  const id = (get('Item_ID') || get('id') || "").toString().trim();

  const normalized = {
    id,
    label,
    title,
    notes,
    href,
    image,
    category,
    subgroup,
    tanksize,
    length,
    depth,
    affiliate,
    tag,
    rangeId,
    groupId,
    groupLabel,
    groupTip
  };

  if (!normalized.category && fallbackCategory) {
    normalized.category = fallbackCategory.toLowerCase();
  }
  if (!normalized.tanksize && normalized.rangeId && (normalized.category === 'heaters' || normalized.category === 'filters')) {
    normalized.tanksize = rangeBand(normalized.rangeId);
  }
  if (!normalized.length && normalized.rangeId && normalized.category === 'lights') {
    normalized.length = rangeBand(normalized.rangeId);
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
    tanksize: item.tanksize || "",
    length: item.length || "",
    depth: item.depth === "" ? "" : item.depth,
    affiliate: item.affiliate || "amazon",
    tag: item.tag || "fishkeepingli-20"
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
    return {
      id: range.id,
      label: meta.label,
      tip: meta.tip || "",
      options
    };
  });
}

function buildGroups(items, tipsMap, category) {
  const order = [];
  const map = new Map();
  items.forEach((item) => {
    const id = item.groupId || item.rangeId || `${category}-group`;
    if (!map.has(id)) {
      const tip = tipsMap?.get(id) || item.groupTip || "";
      map.set(id, {
        id,
        label: item.groupLabel || id,
        tip,
        options: []
      });
      order.push(id);
    }
    const group = map.get(id);
    if (item.groupLabel) group.label = item.groupLabel;
    if (item.groupTip) group.tip = item.groupTip;
    if (tipsMap?.get(id)) group.tip = tipsMap.get(id);
    group.options.push(ensureOptionDefaults(item, group.options.length, category, id));
  });
  return order.map((id) => map.get(id));
}

function getItemsByCategory(normalized, category) {
  return normalized.get(category) || [];
}

function buildGear(normalized, standsItems = []) {
  const heaters = getItemsByCategory(normalized, 'heaters');
  const filters = getItemsByCategory(normalized, 'filters');
  const lights = getItemsByCategory(normalized, 'lights');
  const substrate = getItemsByCategory(normalized, 'substrate');
  const waterTreatments = getItemsByCategory(normalized, 'water_treatments');
  const food = getItemsByCategory(normalized, 'food');
  const maintenance = getItemsByCategory(normalized, 'maintenance_tools');
  const stands = Array.isArray(standsItems) ? standsItems : [];

  const gear = {
    heaters: {
      match: 'gallons',
      ranges: buildRange(RANGES_HEATERS, HEATER_RANGE_META, heaters, 'heaters')
    },
    filters: {
      match: 'gallons',
      ranges: buildRange(RANGES_FILTERS, FILTER_RANGE_META, filters, 'filters')
    },
    lights: {
      match: 'length',
      ranges: buildRange(RANGES_LIGHTS, LIGHT_RANGE_META, lights, 'lights')
    },
    substrate: {
      match: 'gallons',
      groups: buildGroups(substrate, undefined, 'substrate')
    },
    waterTreatments: {
      match: 'none',
      ranges: buildGroups(waterTreatments, WATER_TREATMENT_TIPS, 'water_treatments')
    },
    food: {
      match: 'none',
      intro: FOOD_INTRO,
      accordions: buildGroups(food, FOOD_GROUP_TIPS, 'food')
    },
    maintenanceTools: {
      match: 'none',
      intro: MAINTENANCE_INTRO,
      accordions: buildGroups(maintenance, MAINTENANCE_GROUP_TIPS, 'maintenance_tools')
    },
    stands: {
      match: 'none',
      subgroups: STAND_SUBGROUPS.slice(),
      items: stands
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
    const text = await fetchCsv(STANDS_CSV_PATH);
    const rows = parseCSV(text);
    return rows
      .filter((row) => {
        const rawId = (row.product_id || row.Product_ID || row.ProductId || "").toString().trim();
        const title = (row.title || row.Title || "").toString().trim();
        const link = (row.amazon_url || row.Amazon_URL || row.href || "").toString().trim();
        if (rawId.startsWith('#')) {
          return false;
        }
        if (!rawId && !title && !link) {
          return false;
        }
        return true;
      })
      .map((row) => normalizeStandRow(row));
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
