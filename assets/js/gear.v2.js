(function(){
  const STORAGE_KEY = 'gearTankSelection';
  const INCH_TO_CM = 2.54;

  const TANK_PRESETS = [
    { id:'5g',   label:'5 Gallon (19 L)',    gallons:5,   liters:19,  lengthIn:16.2,   widthIn:8.4,   heightIn:10.5,  weightLbs:62 },
    { id:'10g',  label:'10 Gallon (38 L)',   gallons:10,  liters:38,  lengthIn:20.25,  widthIn:10.5,  heightIn:12.6,  weightLbs:111 },
    { id:'15g',  label:'15 Gallon (57 L)',   gallons:15,  liters:57,  lengthIn:20.25,  widthIn:10.5,  heightIn:18.75, weightLbs:170 },
    { id:'20h',  label:'20 Gallon High (75 L)', gallons:20, liters:75, lengthIn:24.25, widthIn:12.5,  heightIn:16.75, weightLbs:225 },
    { id:'20l',  label:'20 Gallon Long (75 L)', gallons:20, liters:75, lengthIn:30.25, widthIn:12.5,  heightIn:12.75, weightLbs:225 },
    { id:'29g',  label:'29 Gallon (110 L)',   gallons:29,  liters:110, lengthIn:30.25, widthIn:12.5,  heightIn:18.75, weightLbs:330 },
    { id:'40b',  label:'40 Gallon Breeder (151 L)', gallons:40, liters:151, lengthIn:36.25, widthIn:18.25, heightIn:16.75, weightLbs:458 },
    { id:'55g',  label:'55 Gallon (208 L)',   gallons:55,  liters:208, lengthIn:48.25, widthIn:12.75, heightIn:21,    weightLbs:625 },
    { id:'75g',  label:'75 Gallon (284 L)',   gallons:75,  liters:284, lengthIn:48.5,  widthIn:18.5,  heightIn:21.25, weightLbs:850 },
    { id:'90g',  label:'90 Gallon (341 L)',   gallons:90,  liters:341, lengthIn:48.375,widthIn:18.375,heightIn:25,    weightLbs:1050 },
    { id:'125g', label:'125 Gallon (473 L)',  gallons:125, liters:473, lengthIn:72,    widthIn:18,    heightIn:21,    weightLbs:1206 }
  ];

  const PRESET_MAP = new Map(TANK_PRESETS.map((preset) => [preset.id, preset]));

  const state = {
    selectedGallons: 0,
    selectedLengthIn: 0
  };

  const DATA_SECTION_ALIASES = {
    heaters: 'heaters',
    filters: 'filters',
    lights: 'lights',
    air: 'air',
    aeration: 'air',
    'air-aeration': 'air',
    substrate: 'substrate',
    fertilizers: 'fertilizers',
    waterTreatments: 'water_treatments',
    'water-treatments': 'water_treatments',
    water_treatments: 'water_treatments',
    'water-treatments-fertilizers': 'water_treatments',
    water_treatments_fertilizers: 'water_treatments',
    food: 'food',
    maintenanceTools: 'maintenance_tools',
    'maintenance-tools': 'maintenance_tools',
    maintenance_tools: 'maintenance_tools',
    extras: 'extras'
  };

  const GEAR_SECTION_ALIASES = {
    heaters: 'heaters',
    filters: 'filters',
    lights: 'lights',
    air: 'air',
    aeration: 'air',
    'air-aeration': 'air',
    substrate: 'substrate',
    fertilizers: 'fertilizers',
    water_treatments: 'waterTreatments',
    'water-treatments': 'waterTreatments',
    waterTreatments: 'waterTreatments',
    'water-treatments-fertilizers': 'waterTreatments',
    water_treatments_fertilizers: 'waterTreatments',
    food: 'food',
    maintenance_tools: 'maintenanceTools',
    'maintenance-tools': 'maintenanceTools',
    maintenanceTools: 'maintenanceTools',
    extras: 'extras'
  };

  const AIR_PUMP_WHITELIST = [
    'HITOP 4W 110GPH Powerful Aquarium Air Pump: Quiet 2-outlets Aquarium Aerator, Adjustable Fish Tank Air Pump with Accessories, for 20-200 Gallon Tank',
    'hygger Aquarium Air Pump, Ultra Quiet Oxygen Aerator with Air Stone Airline Tubing Check Valve, Aquarium Fish Tank Air Bubbler for 3 to 79 Gallon Tank and Bucket',
    'hygger Aquarium Air Pump, Quiet Adjustable Fish Tank Air Pump, 4W/7W/11W Powerful Oxygen Aerator Dual Stainless Steel Outlets with Air Stone Bubbler for Small Medium Large Fish Tank, Hydroponic'
  ];

  const AIRLINE_ACCESSORY_WHITELIST = [
    'AQUANEAT Aquarium Check Valve, One Way Non Return Valve for Air Pump, Fit for 3/16 Inch Airline Tubing, Fish Tank Accessories, 10pcs (Red)',
    'Aquarium Air Valve, 10 Pcs Aquarium Air Pump Control Valves T Shaped Single Way Plastic Air Flow Control Regulator Aquarium Air Pump Accessories for Fish Tank 3/16" ID Tubing (Black)',
    'ALEGI Aquarium Air Pump Accessories Set 25 Feet Airline Tubing with 6 Check Valves, 6 Control Valve and 40 Connectors for Fish Tank White'
  ];

  const SUBSCRIPT_DIGIT_MAP = {
    '₀': '0',
    '₁': '1',
    '₂': '2',
    '₃': '3',
    '₄': '4',
    '₅': '5',
    '₆': '6',
    '₇': '7',
    '₈': '8',
    '₉': '9'
  };

  const AERATION_SUBCATEGORY_FIELDS = [
    'subcategorySlug',
    'subcategory_slug',
    'subcategory',
    'Subcategory',
    'bucket',
    'Bucket',
    'subgroup',
    'groupLabel',
    'group_label'
  ];

  const AERATION_SUBCATEGORY_ALIASES = {
    'air-pump': 'air-pumps',
    'air-pumps': 'air-pumps',
    'airline-accessory': 'airline-accessories',
    'airline-accessories': 'airline-accessories',
    'air-pump-accessory': 'airline-accessories',
    'air-pump-accessories': 'airline-accessories',
    'co2-accessory': 'co2-accessories',
    'co2-accessories': 'co2-accessories',
    'co-2-accessory': 'co2-accessories',
    'co-2-accessories': 'co2-accessories',
    'co2-gear': 'co2-accessories'
  };

  const AERATION_GROUP_CONFIG = [
    { key: 'air-pumps', id: 'air-pumps', label: 'Air Pumps' },
    { key: 'airline-accessories', id: 'airline-accessories', label: 'Air Pump Accessories' },
    { key: 'co2-accessories', id: 'co2-accessories', label: 'CO₂ Accessories' }
  ];

  const AERATION_SOURCE_GROUP_ALIASES = {
    'air-air-pumps': 'air-pumps',
    'air-airline-accessories': 'airline-accessories',
    maintenance_air: 'co2-accessories'
  };

  let hasWarnedUnknownAerationGroups = false;

  function toDataSectionKey(sectionKey){
    const key = String(sectionKey || '');
    return DATA_SECTION_ALIASES[key] || key;
  }

  function toGearSectionKey(sectionKey){
    const key = String(sectionKey || '');
    return GEAR_SECTION_ALIASES[key] || key;
  }

  function normalizeBucketId(value){
    if (value === null || value === undefined) return '';
    const key = String(value).trim();
    if (!key) return '';
    return key
      .replace(/-/g, '_')
      .replace(/__+/g, '_')
      .toLowerCase();
  }

  function shouldSkipFilterBucket(value){
    const normalized = normalizeBucketId(value);
    if (!normalized) return false;
    return /(125p|125\+|125_plus)/.test(normalized);
  }

  const FILTER_BUCKETS = [
    { key: '5-10', label: 'Recommended Filters for 5–10 Gallons', id: 'g_5_10', min: 5, max: 10, sort: 10 },
    { key: '10-20', label: 'Recommended Filters for 10–20 Gallons', id: 'g_10_20', min: 10, max: 20, sort: 20 },
    { key: '20-40', label: 'Recommended Filters for 20–40 Gallons', id: 'g_20_40', min: 20, max: 40, sort: 40 },
    { key: '40-55', label: 'Recommended Filters for 40–55 Gallons', id: 'g_40_55', min: 40, max: 55, sort: 55 },
    { key: '55-75', label: 'Recommended Filters for 55–75 Gallons', id: 'g_55_75', min: 55, max: 75, sort: 75 },
    { key: '75-125', label: 'Recommended Filters for 75–125 Gallons', id: 'g_75_125', min: 75, max: 125, sort: 125 }
  ];

  function normalizeFilterValue(value){
    if (value === null || value === undefined) return '';
    let next = String(value)
      .trim()
      .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
      .replace(/\s+/g, '')
      .toLowerCase();
    if (!next) return '';
    next = next
      .replace(/^filters?[-_]?/, '')
      .replace(/^filter[-_]?/, '')
      .replace(/^range[-_]?/, '')
      .replace(/^bucket[-_]?/, '')
      .replace(/^g(?:ump)?[-_]?/, '')
      .replace(/^g/, '')
      .replace(/gallons?$/, '')
      .replace(/gal$/, '')
      .replace(/plus$/, '+')
      .replace(/p$/, '+');
    next = next
      .replace(/[^0-9+]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
    return next;
  }

  function pickFilterRange(row = {}){
    const candidates = [
      row.tank_range,
      row.tankRange,
      row.tanksize,
      row.tankSize,
      row.range,
      row.rangeId,
      row.range_id,
      row.bucket_key,
      row.bucketKey,
      row.bucket,
      row.bucketId,
      row.gallons,
      row.gallon_range
    ];
    for (const candidate of candidates) {
      const normalized = normalizeFilterValue(candidate);
      if (normalized) return normalized;
    }
    return '';
  }

  function norm(value){
    return normalizeFilterValue(value);
  }

  function pickRange(row = {}){
    return pickFilterRange(row);
  }

  function firstFiniteNumber(...values){
    for (const value of values) {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    return undefined;
  }

  function toNormalizedBucketKey(bucket){
    if (!bucket) return '';
    if (typeof bucket === 'string') return normalizeBucketId(bucket) || normalizeBucketId(normalizeFilterValue(bucket));
    return normalizeBucketId(
      bucket.id || bucket.bucketId || bucket.bucketKey || bucket.bucket_key || bucket.rangeId || bucket.range_id || ''
    );
  }

  function getFilterRows(){
    if (typeof window === 'undefined') return [];
    const source = window.ttgGearNormalized;
    if (source && typeof source.get === 'function') {
      try {
        const rows = source.get('filters');
        if (Array.isArray(rows)) return rows;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[filters] unable to read normalized rows', error);
      }
    }
    if (Array.isArray(window.__filtersRows)) return window.__filtersRows;
    return [];
  }

  function createFallbackFilterOption(item = {}, index = 0, bucketId = ''){
    const title =
      item.title ||
      item.Product_Name ||
      item.product_name ||
      item.product_title ||
      item.Product_Title ||
      item.name ||
      item.label ||
      `Option ${index + 1}`;
    const label = item.label || item.Option_Label || title;
    const notes = item.notes || item.note || item.Notes || '';
    const href =
      item.href ||
      item.amazon_url ||
      item.amazonUrl ||
      item.Amazon_Link ||
      item.url ||
      item.link ||
      '';
    const affiliate = item.affiliate || 'amazon';
    const tag = item.tag || 'fishkeepingli-20';
    const baseId =
      item.id ||
      item.Item_ID ||
      `${bucketId || 'filters'}-${String(index + 1).padStart(2, '0')}`;
    return {
      label: label || title || `Option ${index + 1}`,
      title: title || label || `Option ${index + 1}`,
      notes,
      note: notes,
      href,
      category: 'filters',
      subgroup: item.subgroup || item.Subgroup || '',
      tanksize: item.tanksize || item.tank_range || item.Tank_Size || '',
      affiliate,
      tag,
      id: baseId
    };
  }

  function buildFallbackFilterBuckets(rows = []){
    const data = Array.isArray(rows) ? rows : [];
    const byBucket = {};
    const fallbackBuckets = FILTER_BUCKETS.map((bucketDef, index) => {
      const targetKey = norm(bucketDef.key);
      let matches = data.filter((row) => norm(pickRange(row)) === targetKey);
      if (!matches.length) {
        matches = data.filter((row) => {
          const candidate = norm(pickRange(row));
          return candidate && candidate.includes(targetKey);
        });
      }
      if (typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.info(`[filters] ${bucketDef.key} → ${matches.length} items`);
      }
      byBucket[bucketDef.key] = matches;

      const options = matches.map((item, itemIndex) =>
        createFallbackFilterOption(item, itemIndex, bucketDef.id || bucketDef.key)
      );
      const meta = typeof FILTER_BUCKET_META !== 'undefined' ? FILTER_BUCKET_META.get(bucketDef.id) : null;
      const rangeMeta = typeof FILTER_RANGE_META !== 'undefined' ? FILTER_RANGE_META.get(bucketDef.id) : null;
      const baseDefs = Array.isArray(FILTER_BUCKETS) ? FILTER_BUCKETS : [];
      const baseDef = baseDefs.find((def) => normalizeBucketId(def.id) === normalizeBucketId(bucketDef.id));

      const label = bucketDef.label || rangeMeta?.label || meta?.label || baseDef?.label || bucketDef.key;
      const tip = rangeMeta?.tip || meta?.tip || '';
      const minGallons = firstFiniteNumber(
        meta?.min,
        baseDef?.min,
        matches[0]?.minGallons,
        matches[0]?.min_gallons
      );
      const maxGallons = firstFiniteNumber(
        meta?.max,
        baseDef?.max,
        matches[0]?.maxGallons,
        matches[0]?.max_gallons
      );
      const sort = firstFiniteNumber(meta?.sort, baseDef?.sort, index + 1);

      return {
        id: bucketDef.id || bucketDef.key,
        key: bucketDef.key || bucketDef.id || '',
        label,
        rangeLabel: rangeMeta?.label || label,
        tip,
        sort,
        minGallons: Number.isFinite(minGallons) ? minGallons : undefined,
        maxGallons: Number.isFinite(maxGallons) ? maxGallons : undefined,
        options,
        placeholder: options.length ? '' : 'No items yet.'
      };
    });

    return { buckets: fallbackBuckets, byBucket };
  }

  function mergeFilterBuckets(primaryBuckets = [], fallbackBuckets = []){
    const primaryMap = new Map();
    const fallbackMap = new Map();

    primaryBuckets.forEach((bucket) => {
      const key = toNormalizedBucketKey(bucket);
      if (key) primaryMap.set(key, bucket);
    });

    fallbackBuckets.forEach((bucket) => {
      const key = toNormalizedBucketKey(bucket);
      if (key) fallbackMap.set(key, bucket);
    });

    const used = new Set();
    const merged = [];
    const baseDefs = Array.isArray(FILTER_BUCKETS) ? FILTER_BUCKETS : [];

    FILTER_BUCKETS.forEach((bucketDef, index) => {
      const normKey = normalizeBucketId(bucketDef.id || bucketDef.key);
      used.add(normKey);
      const primary = primaryMap.get(normKey) || null;
      const fallback = fallbackMap.get(normKey) || null;
      const meta = typeof FILTER_BUCKET_META !== 'undefined' ? FILTER_BUCKET_META.get(bucketDef.id) : null;
      const rangeMeta = typeof FILTER_RANGE_META !== 'undefined' ? FILTER_RANGE_META.get(bucketDef.id) : null;
      const baseDef = baseDefs.find((def) => normalizeBucketId(def.id) === normKey) || {};

      const options = Array.isArray(primary?.options) && primary.options.length
        ? primary.options
        : Array.isArray(fallback?.options)
          ? fallback.options
          : [];

      const placeholder = options.length
        ? ''
        : primary?.placeholder || fallback?.placeholder || 'No items yet.';

      const sort = firstFiniteNumber(
        primary?.sort,
        primary?.bucketSort,
        fallback?.sort,
        fallback?.bucketSort,
        meta?.sort,
        baseDef?.sort,
        index + 1
      );

      const minGallons = firstFiniteNumber(
        primary?.minGallons,
        fallback?.minGallons,
        meta?.min,
        baseDef?.min
      );
      const maxGallons = firstFiniteNumber(
        primary?.maxGallons,
        fallback?.maxGallons,
        meta?.max,
        baseDef?.max
      );

      const label = primary?.label || fallback?.label || bucketDef.label || rangeMeta?.label || meta?.label || '';
      const rangeLabel = primary?.rangeLabel || fallback?.rangeLabel || rangeMeta?.label || label;
      const tip = primary?.tip || fallback?.tip || rangeMeta?.tip || meta?.tip || '';

      merged.push({
        ...(fallback || {}),
        ...(primary || {}),
        key: primary?.key || fallback?.key || bucketDef.key || bucketDef.id || '',
        id: primary?.id || fallback?.id || bucketDef.id || bucketDef.key,
        label,
        rangeLabel,
        tip,
        sort,
        minGallons: Number.isFinite(minGallons) ? minGallons : undefined,
        maxGallons: Number.isFinite(maxGallons) ? maxGallons : undefined,
        options,
        placeholder
      });
    });

    const extraKeys = new Set([...primaryMap.keys(), ...fallbackMap.keys()]);
    extraKeys.forEach((key) => {
      if (used.has(key)) return;
      if (shouldSkipFilterBucket(key)) {
        return;
      }
      const source = primaryMap.get(key) || fallbackMap.get(key);
      if (!source) return;
      const options = Array.isArray(source.options) ? source.options : [];
      const placeholder = options.length ? source.placeholder || '' : source.placeholder || 'No items yet.';
      const resolvedKey = source.key || source.bucketKey || source.id || '';
      if (shouldSkipFilterBucket(resolvedKey)) {
        return;
      }
      merged.push({
        ...source,
        options,
        placeholder,
        key: resolvedKey,
        sort: firstFiniteNumber(source.sort, source.bucketSort, merged.length + FILTER_BUCKETS.length + 1)
      });
    });

    return merged.sort((a, b) => {
      const sortA = firstFiniteNumber(a.sort, a.bucketSort);
      const sortB = firstFiniteNumber(b.sort, b.bucketSort);
      if (sortA === undefined && sortB === undefined) return 0;
      if (sortA === undefined) return 1;
      if (sortB === undefined) return -1;
      return sortA - sortB;
    });
  }

  const RANGE_LOOKUP = {
    heaters: new Map((Array.isArray(RANGES_HEATERS) ? RANGES_HEATERS : []).map((range) => [range.id, range])),
    filters: new Map((Array.isArray(RANGES_FILTERS) ? RANGES_FILTERS : []).map((range) => [range.id, range])),
    lights: new Map((Array.isArray(RANGES_LIGHTS) ? RANGES_LIGHTS : []).map((range) => [range.id, range]))
  };

  function el(tag, attrs = {}, html = ''){
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') node.className = value;
      else if (key === 'html') node.innerHTML = value;
      else node.setAttribute(key, value);
    });
    if (html) node.innerHTML = html;
    return node;
  }

  function toNumber(value){
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function round(value, places = 2){
    const factor = Math.pow(10, places);
    return Math.round(value * factor) / factor;
  }

  function formatNumber(value){
    if (!Number.isFinite(value)) return '';
    if (Number.isInteger(value)) return String(value);
    return String(round(value, 2));
  }

  function getSelectedGallons(){
    return state.selectedGallons ?? 0;
  }

  function getSelectedLengthInches(){
    return state.selectedLengthIn ?? 0;
  }

  function isWithinGallons(rangeIdOrLabel, gallons){
    const el = document.querySelector(`[data-range-id="${rangeIdOrLabel}"]`);
    if (el && el.dataset.minG && el.dataset.maxG) {
      const min = Number(el.dataset.minG);
      const max = Number(el.dataset.maxG);
      return gallons >= min && gallons <= max;
    }
    const m = String(rangeIdOrLabel).match(/(\d+)[^\d]+(\d+)/);
    if (!m) return false;
    const min = Number(m[1]);
    const max = Number(m[2]);
    return gallons >= min && gallons <= max;
  }

  function isWithinLength(rangeIdOrLabel, inches){
    const el = document.querySelector(`[data-range-id="${rangeIdOrLabel}"]`);
    if (el && el.dataset.minL && el.dataset.maxL) {
      const min = Number(el.dataset.minL);
      const max = Number(el.dataset.maxL);
      return inches >= min && inches <= max;
    }
    const m = String(rangeIdOrLabel).match(/(\d+)[^\d]+(\d+)/);
    if (!m) return false;
    const min = Number(m[1]);
    const max = Number(m[2]);
    return inches >= min && inches <= max;
  }

  function sectionMatchesRange(sectionKey, rangeIdOrLabel, gallons, lengthIn){
    const gearSectionKey = toGearSectionKey(sectionKey);
    if (!gearSectionKey) return false;
    const matchMode = (GEAR[gearSectionKey]?.match || 'gallons').toLowerCase();
    if (matchMode === 'none') return false;
    if (matchMode === 'length') {
      return isWithinLength(rangeIdOrLabel, lengthIn);
    }
    return isWithinGallons(rangeIdOrLabel, gallons);
  }

  function updateGearHighlights(){
    const g = getSelectedGallons();
    const l = getSelectedLengthInches();

    document.querySelectorAll('.gear-card').forEach((card) => {
      if (card.dataset.ignoreMatch === '1') return;
      const section = toGearSectionKey(card.dataset.section || '');
      const rangeId = card.dataset.rangeId || '';
      const isMatch = sectionMatchesRange(section, rangeId, g, l);

      if (isMatch) card.setAttribute('data-match', '1');
      else card.removeAttribute('data-match');
      card.classList.toggle('gear-card--active', isMatch);
    });
  }

  function buildInfoLine(preset){
    if (!preset) return '';
    const gallons = Number.isFinite(preset.gallons) ? `${formatNumber(preset.gallons)}g` : '';
    const liters = Number.isFinite(preset.liters) ? `${formatNumber(preset.liters)} L` : '';
    const dimsIn = `${formatNumber(preset.lengthIn)} × ${formatNumber(preset.widthIn)} × ${formatNumber(preset.heightIn)} in`;
    const dimsCm = `(${formatNumber(preset.lengthIn * INCH_TO_CM)} × ${formatNumber(preset.widthIn * INCH_TO_CM)} × ${formatNumber(preset.heightIn * INCH_TO_CM)} cm)`;
    const weight = Number.isFinite(preset.weightLbs) && preset.weightLbs > 0 ? ` • ~${Math.round(preset.weightLbs)} lbs filled` : '';
    return [gallons, liters, dimsIn, dimsCm].filter(Boolean).join(' • ') + weight;
  }

  function showTip(kind){
    const defaultTitle = 'Tip';
    const tip = TIPS[kind];
    let title = defaultTitle;
    let message = 'No tip available.';

    if (typeof tip === 'string') {
      message = tip || message;
    } else if (tip && typeof tip === 'object') {
      if (typeof tip.title === 'string' && tip.title.trim()) {
        title = tip.title.trim();
      }
      if (typeof tip.body === 'string' && tip.body.trim()) {
        message = tip.body;
      }
    } else if (tip !== undefined && tip !== null) {
      message = String(tip);
    }

    const wrap = el('div',{class:'tip-wrap',style:'position:fixed;inset:0;padding:16px;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:120'});
    const cardStyles = [
      'width:min(340px,calc(100vw - 32px))',
      'max-width:340px',
      'background:rgba(15,23,42,0.88)',
      'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)',
      'color:#e5e7eb',
      'border:1px solid rgba(148,163,184,0.3)',
      'border-radius:10px',
      'padding:18px 20px',
      'box-shadow:0 18px 36px -24px rgba(0,0,0,0.6)',
      'font-size:0.9rem',
      'line-height:1.5'
    ].join(';');
    const card = el('div',{style:cardStyles});
    card.innerHTML = `<h3 style="margin:0 0 0.75rem;font-size:1.1rem;font-weight:600;">${escapeHTML(title)}</h3><p style="margin:0 0 1rem;color:#cbd5f5;font-size:0.9rem;line-height:1.5;">${message}</p><button style="padding:0.5rem 0.875rem;background:#111827;color:#e5e7eb;border:1px solid rgba(148,163,184,0.4);border-radius:8px;cursor:pointer;font-size:0.9rem;font-weight:600;">Close</button>`;
    card.querySelector('button').onclick = () => wrap.remove();
    wrap.onclick = (event) => { if (event.target === wrap) wrap.remove(); };
    wrap.appendChild(card);
    document.body.appendChild(wrap);
  }

  function escapeHTML(s){
    return String(s || '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m]));
  }

  function renderAddonCard(addon = {}){
    if (!addon || addon.enabled === false) return null;
    const title = String(addon.title || '').trim();
    if (!title) return null;
    const href = String(addon.amazonUrl || addon.href || '').trim();
    const notes = String(addon.notes || '').trim();
    const eyebrow = String(addon.eyebrow || 'Recommended add-on').trim() || 'Recommended add-on';
    const hasValidHref = /^https?:\/\//i.test(href);
    const cta = hasValidHref
      ? `<a href=\"${escapeHTML(href)}\" target=\"_blank\" rel=\"sponsored noopener noreferrer\" class=\"btn\" aria-label=\"Buy ${escapeHTML(title)} on Amazon\">Buy on Amazon</a>`
      : '<button class=\"btn\" type=\"button\" aria-disabled=\"true\" title=\"Link coming soon\">Buy on Amazon</button>';
    const card = el('div',{ class:'gear-addon' });
    card.innerHTML = `
      <p class=\"gear-addon__eyebrow\">${escapeHTML(eyebrow)}</p>
      <h3 class=\"gear-addon__title\">${escapeHTML(title)}</h3>
      ${notes ? `<p class=\"gear-addon__notes\">${escapeHTML(notes)}</p>` : ''}
      ${cta}
    `;
    return card;
  }

  const URL_PATTERN = /https?:\/\/\S+/gi;

  function stripUrls(text = ''){
    return String(text || '')
      .replace(URL_PATTERN, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const OPTION_PREFIX_WITH_DASH = /^\s*(?:recommended\s+option|option)\s*\d*\s*[—–-]\s*/i;
  const OPTION_PREFIX_GENERAL = /^\s*(?:recommended\s+option|option)\s*\d+\s*/i;

  function normalizeOptionTitle(rawTitle = ''){
    const value = String(rawTitle || '').trim();
    if (!value) return '';
    const withoutDashPrefix = value.replace(OPTION_PREFIX_WITH_DASH, '').trim();
    if (withoutDashPrefix !== value) return withoutDashPrefix;
    const withoutGeneralPrefix = value.replace(OPTION_PREFIX_GENERAL, '').trim();
    if (withoutGeneralPrefix !== value) return withoutGeneralPrefix;
    return value;
  }

  function createOptionRow(option = {}, options = {}){
    const row = el('div',{class:'option'});
    row.dataset.category = option.category || '';
    row.dataset.subgroup = option.subgroup || '';
    if (option.subgroupId) {
      row.dataset.subgroupId = option.subgroupId;
    }
    row.dataset.tanksize = option.tanksize || '';
    row.dataset.length = option.length || '';
    row.dataset.depth = (option.depth ?? '').toString();
    if (option.height !== undefined) {
      row.dataset.height = (option.height ?? '').toString();
    }
    row.dataset.affiliate = option.affiliate || 'amazon';
    row.dataset.tag = option.tag || 'fishkeepingli-20';
    if (option.material) row.dataset.material = option.material;
    if (option.color) row.dataset.color = option.color;
    if (option.source) row.dataset.source = option.source;
    const href = (option?.href || '').trim();
    const rawLabelText = stripUrls(option?.label || '').trim();
    const rawTitleText = stripUrls(option?.title || '').trim();
    const labelText = normalizeOptionTitle(rawLabelText);
    const titleText = normalizeOptionTitle(rawTitleText);
    const displayTitle = titleText || labelText || 'this item';
    const headingHtml = labelText && titleText
      ? `<strong>${escapeHTML(labelText)} — ${escapeHTML(titleText)}</strong>`
      : `<strong>${escapeHTML(displayTitle)}</strong>`;
    const noteText = (option?.note ?? option?.notes ?? '').trim();
    const dimensionsLite = (option?.dimensionsLite || '').toString().trim();
    const rawContext = options.context ?? '';
    const context = String(rawContext).toLowerCase();
    const hasValidHref = /^https?:\/\//i.test(href);
    const buyLabel = `Buy ${escapeHTML(displayTitle)} on Amazon`;
    const actionsHtml = hasValidHref
      ? `<a class=\"btn\" href=\"${escapeHTML(href)}\" target=\"_blank\" rel=\"sponsored noopener noreferrer\" aria-label=\"${buyLabel}\">Buy on Amazon</a>`
      : '<button class=\"btn\" type=\"button\" aria-disabled=\"true\" title=\"Link coming soon\">Buy on Amazon</button>';
    row.innerHTML = `
      <div class="option__title">${headingHtml}</div>
      ${noteText ? `<p class="option__note">${escapeHTML(noteText)}</p>` : ''}
      ${context === 'stands' && dimensionsLite ? `<p class="option__meta">Dimensions: ${escapeHTML(dimensionsLite)}</p>` : ''}
      <div class="option__actions">${actionsHtml}</div>
    `;
    return row;
  }

  function renderSubstrateSubgroupAccordion(subgroup = {}, index = 0, options = {}){
    const { optionContext = '', parentRangeId = '' } = options;
    const label = (subgroup.label || '').trim() || 'Substrate Picks';
    const groupId = subgroup.id || subgroup.slug || `substrate-${index + 1}`;
    const group = {
      ...subgroup,
      id: groupId,
      label,
      options: Array.isArray(subgroup.options) ? subgroup.options : [],
      placeholder: (subgroup.placeholder || '').trim() || 'Substrate picks coming soon.'
    };

    const section = renderAccordionGroup(group, index, {
      sectionKey: 'substrate',
      sectionClass: 'gear-subcard gear-subcard--substrate sub-accordion',
      headerClass: 'gear-card__header gear-subcard__header accordion-header',
      bodyClass: 'gear-card__body gear-subcard__body accordion-panel',
      rangeClass: 'range--substrate-subgroup',
      rangeOptions: {
        includeGearCard: false,
        showTitle: false,
        context: optionContext || 'substrate',
        listClass: 'range__list--flat'
      },
      matchable: false
    });

    if (!section) return null;

    section.dataset.ignoreMatch = '1';
    if (parentRangeId) section.dataset.parentRangeId = parentRangeId;
    if (subgroup.slug) section.dataset.subgroup = subgroup.slug;
    if (subgroup.id) section.dataset.subgroupId = subgroup.id;

    const rangeBlock = section.querySelector('.range');
    if (rangeBlock) {
      rangeBlock.classList.add('range--substrate-subgroup');
      if (parentRangeId) rangeBlock.dataset.parentRangeId = parentRangeId;
      if (subgroup.id && !rangeBlock.dataset.subgroupId) rangeBlock.dataset.subgroupId = subgroup.id;
    }

    return section;
  }

  function renderRangeBlock(range = {}, sectionKey, options = {}){
    const {
      includeGearCard = true,
      ignoreMatch = false,
      showTitle = true,
      showTip = true,
      headingTag = 'p',
      listClass = ''
    } = options;

    const wrap = el('div',{class:'range'});
    if (includeGearCard) wrap.classList.add('gear-card');
    if (ignoreMatch) wrap.dataset.ignoreMatch = '1';
    const dataSectionKey = toDataSectionKey(sectionKey);
    const gearSectionKey = toGearSectionKey(sectionKey);
    if (sectionKey) wrap.dataset.section = dataSectionKey;
    if (dataSectionKey === 'substrate') {
      wrap.classList.add('range--substrate');
    }
    if (range?.id) {
      wrap.dataset.rangeId = range.id;
      if (!ignoreMatch && gearSectionKey) {
        const matchMode = (GEAR[gearSectionKey]?.match || 'gallons').toLowerCase();
        const lookup = typeof RANGE_LOOKUP !== 'undefined' ? RANGE_LOOKUP : null;
        const rangeLookup = lookup && lookup[gearSectionKey] && typeof lookup[gearSectionKey].get === 'function'
          ? lookup[gearSectionKey]
          : null;
        const meta = rangeLookup ? rangeLookup.get(range.id) || {} : {};
        if (meta) {
          if (matchMode === 'length') {
            const min = Number.isFinite(meta.min) ? meta.min : Number.isFinite(range.minL) ? range.minL : undefined;
            const max = Number.isFinite(meta.max) ? meta.max : Number.isFinite(range.maxL) ? range.maxL : undefined;
            if (Number.isFinite(min)) wrap.dataset.minL = String(min);
            if (Number.isFinite(max)) wrap.dataset.maxL = String(max);
          } else if (matchMode === 'gallons') {
            const min = Number.isFinite(meta.min)
              ? meta.min
              : Number.isFinite(range.minGallons)
                ? range.minGallons
                : undefined;
            const max = Number.isFinite(meta.max)
              ? meta.max
              : Number.isFinite(range.maxGallons)
                ? range.maxGallons
                : undefined;
            if (Number.isFinite(min)) wrap.dataset.minG = String(min);
            if (Number.isFinite(max)) wrap.dataset.maxG = String(max);
          }
        }
      }
    }

    const rangeTitle = range.rangeLabel || range.label;
    const normalizedRangeTitle = String(rangeTitle || '')
      .trim()
      .toLowerCase();
    if (showTitle && rangeTitle) {
      wrap.appendChild(el(headingTag,{class:'range__title'}, rangeTitle));
    }
    if (range.tip && showTip !== false) {
      wrap.appendChild(el('p',{class:'range__tip range-intro'}, range.tip));
    }

    const list = el('div',{class:'range__list'});
    if (listClass) {
      String(listClass)
        .split(/\s+/)
        .filter(Boolean)
        .forEach((cls) => list.classList.add(cls));
    }
    const optionContext = options.context || sectionKey || '';
    const rawSubgroups = Array.isArray(range.subgroups)
      ? range.subgroups.filter((group) => group && Array.isArray(group.options))
      : [];
    if (dataSectionKey === 'substrate' && rawSubgroups.length) {
      list.classList.add('range__list--subgroups');
      const parentRangeId = range.id || range.rangeId || '';
      rawSubgroups.forEach((subgroup, index) => {
        const accordion = renderSubstrateSubgroupAccordion(subgroup, index, {
          ...options,
          optionContext,
          parentRangeId
        });
        if (accordion) {
          list.appendChild(accordion);
        }
      });
      if (!list.childElementCount) {
        const placeholderText = (range.placeholder || '').trim() || 'Substrate picks coming soon.';
        list.appendChild(el('p',{ class:'range__placeholder' }, placeholderText));
      }
    } else if (rawSubgroups.length) {
      const shouldSuppressSubgroupTitle = (title) => {
        if (!title) return false;
        const normalizedSection = String(dataSectionKey || '')
          .trim()
          .toLowerCase();
        if (normalizedSection !== 'water_treatments') {
          return false;
        }
        const normalizedTitle = String(title)
          .trim()
          .toLowerCase();
        if (!normalizedTitle) {
          return false;
        }
        if (normalizedTitle === 'water treatments') {
          return true;
        }
        return normalizedRangeTitle && normalizedTitle === normalizedRangeTitle;
      };

      rawSubgroups
        .filter((subgroup) => Array.isArray(subgroup.options) && subgroup.options.length)
        .forEach((subgroup) => {
          const subgroupWrap = el('div',{ class:'range__subgroup' });
          const subgroupTitle = (subgroup.label || '').trim();
          if (subgroupTitle && !shouldSuppressSubgroupTitle(subgroupTitle)) {
            subgroupWrap.appendChild(el('h3',{ class:'range__subgroup-title' }, subgroupTitle));
          }
          const subgroupList = el('div',{ class:'range__subgroup-items' });
          subgroup.options.forEach((opt) => {
            subgroupList.appendChild(createOptionRow(opt, { ...options, context: optionContext }));
          });
          subgroupWrap.appendChild(subgroupList);
          list.appendChild(subgroupWrap);
        });
    } else {
      const optionList = Array.isArray(range.options) ? range.options : [];
      optionList.forEach((opt) => {
        list.appendChild(createOptionRow(opt, { ...options, context: optionContext }));
      });
      if (!optionList.length && range.placeholder) {
        list.appendChild(el('p',{class:'range__placeholder'}, range.placeholder));
      }
    }
    wrap.appendChild(list);
    return wrap;
  }

  function renderAirProducts(groups = [], options = {}){
    const placeholderText = String(options?.placeholder || '').trim();
    const placeholder = placeholderText || '';

    const normaliseTitle = (value) =>
      String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const orderByWhitelist = (items, whitelist = []) => {
      const lookup = new Map();
      items.forEach((item) => {
        const key = normaliseTitle(item?.title || item?.label || '');
        if (key && !lookup.has(key)) {
          lookup.set(key, item);
        }
      });
      const ordered = [];
      whitelist.forEach((title) => {
        const key = normaliseTitle(title);
        if (!key) return;
        if (lookup.has(key)) {
          ordered.push(lookup.get(key));
          lookup.delete(key);
        }
      });
      lookup.forEach((item) => ordered.push(item));
      return ordered;
    };

    const normaliseSlug = (value) => {
      if (!value) return '';
      return String(value)
        .normalize('NFKD')
        .replace(/[₀-₉]/g, (char) => SUBSCRIPT_DIGIT_MAP[char] ?? char)
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .trim();
    };

    const deriveGroupKey = (option) => {
      for (const field of AERATION_SUBCATEGORY_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(option, field)) {
          const raw = option[field];
          const slug = normaliseSlug(raw);
          if (slug) {
            return AERATION_SUBCATEGORY_ALIASES[slug] || slug;
          }
        }
      }
      return '';
    };

    const parseAccessoryRank = (item = {}) => {
      const RANK_FIELDS = [
        'rank',
        'Rank',
        'sort',
        'Sort',
        'order',
        'Order',
        'order_index',
        'orderIndex',
        'Sort_Order',
        'sort_order',
        'sort_key',
        'Sort_Key',
        'sortKey',
        'SortKey'
      ];
      for (const field of RANK_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(item, field)) {
          const raw = item[field];
          if (raw === '' || raw === null || raw === undefined) continue;
          const parsed = Number.parseFloat(String(raw));
          if (Number.isFinite(parsed)) {
            return parsed;
          }
        }
      }
      const label = String(item?.label || '').trim();
      const labelMatch = label.match(/(\d+)/);
      if (labelMatch) {
        const value = Number.parseFloat(labelMatch[1]);
        if (Number.isFinite(value)) {
          return value;
        }
      }
      return Number.NaN;
    };

    const orderAccessoryItems = (items = []) => {
      if (!Array.isArray(items)) return [];
      const withIndex = items.map((item, index) => ({ item, index }));
      const hasRank = withIndex.some(({ item }) => Number.isFinite(parseAccessoryRank(item)));
      if (hasRank) {
        withIndex.sort((a, b) => {
          const rankA = parseAccessoryRank(a.item);
          const rankB = parseAccessoryRank(b.item);
          if (Number.isFinite(rankA) && Number.isFinite(rankB) && rankA !== rankB) {
            return rankA - rankB;
          }
          if (Number.isFinite(rankA) && !Number.isFinite(rankB)) {
            return -1;
          }
          if (!Number.isFinite(rankA) && Number.isFinite(rankB)) {
            return 1;
          }
          return a.index - b.index;
        });
      } else {
        withIndex.sort((a, b) => {
          const titleA = normaliseTitle(a.item?.title || a.item?.label || '');
          const titleB = normaliseTitle(b.item?.title || b.item?.label || '');
          if (titleA < titleB) return -1;
          if (titleA > titleB) return 1;
          return a.index - b.index;
        });
      }
      return withIndex.map(({ item }) => item);
    };

    const createAccessoryCard = (accessory) => {
      const title = String(accessory?.title || accessory?.label || '').trim();
      if (!title) return null;
      const notes = String(accessory?.notes ?? accessory?.note ?? '').trim();
      const href = String((accessory?.href || '').trim());
      const rel = String(accessory?.rel || 'sponsored noopener noreferrer').trim() || 'sponsored noopener noreferrer';
      const card = el('article',{ class:'air-accessory-card' });
      card.appendChild(el('h3',{ class:'air-accessory-card__title' }, escapeHTML(title)));
      if (notes) {
        card.appendChild(el('p',{ class:'air-accessory-card__description' }, escapeHTML(notes)));
      }
      if (href) {
        const actions = el('div',{ class:'air-accessory-card__actions' });
        actions.appendChild(el('a',{ class:'btn', href, target:'_blank', rel },'Buy on Amazon'));
        card.appendChild(actions);
      }
      return card;
    };

    const renderAccessoryGrid = (items = []) => {
      const grid = el('div',{ class:'air-accessory-grid' });
      items.forEach((accessory) => {
        const card = createAccessoryCard(accessory);
        if (card) grid.appendChild(card);
      });
      return grid;
    };

    const grouped = new Map(AERATION_GROUP_CONFIG.map((group) => [group.key, []]));
    const unknownKeys = new Set();

    groups.forEach((group) => {
      const sourceId = group?.id || group?.originalId || '';
      const aliasKey = AERATION_SOURCE_GROUP_ALIASES[sourceId] || '';
      const options = Array.isArray(group?.options) ? group.options.filter(Boolean) : [];
      options.forEach((option) => {
        const key = deriveGroupKey(option);
        if (key && grouped.has(key)) {
          grouped.get(key).push(option);
          return;
        }
        if (aliasKey && grouped.has(aliasKey)) {
          grouped.get(aliasKey).push(option);
          return;
        }
        if (option) {
          const fallback = key || aliasKey || option.subgroup || option.groupLabel || option.id || '[unknown]';
          unknownKeys.add(fallback);
        }
      });
    });

    const fragment = document.createDocumentFragment();

    const createRangeBlock = (rangeId) => {
      const block = renderRangeBlock(
        {
          id: rangeId,
          label: '',
          rangeLabel: '',
          options: [],
          placeholder
        },
        'air',
        {
          includeGearCard: false,
          ignoreMatch: true,
          showTitle: false,
          showTip: false,
          listClass: 'range__list--flat'
        }
      );
      if (block) {
        block.classList.add('range--air-subgroup');
      }
      return block;
    };

    AERATION_GROUP_CONFIG.forEach((group, index) => {
      const items = grouped.get(group.key) || [];
      const count = items.length;
      const hasItems = count > 0;
      const section = renderAccordionGroup(
        {
          id: group.id || group.key,
          label: group.label,
          options: [],
          placeholder
        },
        index,
        {
          sectionKey: 'air',
          sectionClass: 'gear-subcard gear-subcard--substrate gear-subcard--air',
          headerClass: 'gear-card__header gear-subcard__header accordion-header',
          bodyClass: 'gear-card__body gear-subcard__body accordion-panel',
          rangeOptions: {
            includeGearCard: false,
            ignoreMatch: true,
            showTitle: false,
            showTip: false
          }
        }
      );

      if (!section) {
        return;
      }

      section.dataset.airGroup = group.key;
      section.dataset.optionCount = String(count);
      if (!hasItems) {
        section.dataset.empty = '1';
      } else {
        section.removeAttribute('data-empty');
      }

      const header = section.querySelector('[data-accordion="toggle"]');
      const body = section.querySelector('.gear-card__body');
      if (header) {
        if (!hasItems) {
          header.setAttribute('aria-disabled', 'true');
          header.setAttribute('tabindex', '-1');
        } else {
          header.removeAttribute('aria-disabled');
          header.removeAttribute('tabindex');
        }
        header.setAttribute('data-count', String(count));
        const chevron = header.querySelector('.chevron');
        if (chevron) {
          const meta = el('span', { class: 'gear-subcard__meta' });
          if (hasItems && group.showCount !== false) {
            const countLabel = `${count} ${count === 1 ? 'pick' : 'picks'}`;
            meta.appendChild(el('span', { class: 'gear-subcard__count' }, countLabel));
          }
          meta.appendChild(chevron);
          header.appendChild(meta);
        }
      }

      if (!body) {
        fragment.appendChild(section);
        return;
      }

      body.innerHTML = '';

      if (!hasItems) {
        const emptyMessage = placeholder || 'Air & Aeration picks coming soon.';
        body.appendChild(el('p', { class: 'range__placeholder' }, emptyMessage));
        fragment.appendChild(section);
        return;
      }

      const rangeId = `${group.id || group.key}-range`;
      const rangeBlock = createRangeBlock(rangeId);
      if (rangeBlock) {
        const list = rangeBlock.querySelector('.range__list');
        if (list) {
          list.innerHTML = '';
          if (group.key === 'airline-accessories') {
            const orderedAccessories = orderByWhitelist(items, AIRLINE_ACCESSORY_WHITELIST);
            const grid = renderAccessoryGrid(orderedAccessories);
            if (grid) {
              grid.classList.add('air-accessory-grid');
              list.appendChild(grid);
            }
          } else if (group.key === 'co2-accessories') {
            const orderedAccessories = orderAccessoryItems(items);
            const grid = renderAccessoryGrid(orderedAccessories);
            if (grid) {
              grid.classList.add('air-accessory-grid');
              list.appendChild(grid);
            }
          } else {
            const whitelist = group.key === 'air-pumps' ? AIR_PUMP_WHITELIST : [];
            const orderedItems = orderByWhitelist(items, whitelist);
            orderedItems.forEach((option) => {
              const row = createOptionRow(option, { context: 'air' });
              if (row) list.appendChild(row);
            });
          }

          if (!list.childElementCount) {
            const emptyMessage = placeholder || 'Air & Aeration picks coming soon.';
            list.appendChild(el('p', { class: 'range__placeholder' }, emptyMessage));
          }
        }
        body.appendChild(rangeBlock);
      }

      fragment.appendChild(section);
    });

    if (unknownKeys.size && !hasWarnedUnknownAerationGroups) {
      console.warn('Unknown Air & Aeration subcategory items', Array.from(unknownKeys));
      hasWarnedUnknownAerationGroups = true;
    }

    if (!fragment.childNodes.length) {
      return el('p', { class: 'range__placeholder' }, placeholder || 'Air & Aeration picks coming soon.');
    }

    return fragment;
  }

  function hasLiveOptions(range){
    if (!range) return false;
    const directOptions = Array.isArray(range.options) ? range.options : [];
    if (directOptions.length > 0) return true;
    const subgroupHasOptions = Array.isArray(range.subgroups)
      ? range.subgroups.some((subgroup) => Array.isArray(subgroup?.options) && subgroup.options.length > 0)
      : false;
    if (subgroupHasOptions) return true;
    return Boolean((range?.placeholder || '').trim());
  }

  function renderAccordionGroup(group = {}, index = 0, options = {}){
    const {
      sectionKey = '',
      headerLevel = 'h3',
      sectionClass = 'gear-subcard sub-accordion',
      headerClass = 'gear-card__header gear-subcard__header accordion-header',
      bodyClass = 'gear-card__body gear-subcard__body accordion-panel',
      rangeClass = '',
      rangeOptions = {},
      matchable = false
    } = options;

    const classList = new Set(String(sectionClass || '').split(/\s+/).filter(Boolean));
    classList.add('gear-card');
    classList.add('sub-accordion');
    const section = el('section',{ class: Array.from(classList).join(' ') });
    section.dataset.ignoreMatch = matchable ? '0' : '1';
    const resolvedSectionKey = String(sectionKey || '').trim();
    const baseIdSource =
      (group && (group.domId || group.domID || group.dom_id)) ||
      (group && group.id) ||
      '';
    const fallbackToken = `${resolvedSectionKey || 'group'}-${index + 1}`;
    const baseIdRaw = baseIdSource ? String(baseIdSource) : fallbackToken;
    const shouldPrefix =
      resolvedSectionKey &&
      !baseIdRaw.toLowerCase().startsWith(`${resolvedSectionKey.toLowerCase()}-`);
    const prefixedBaseId = shouldPrefix ? `${resolvedSectionKey}-${baseIdRaw}` : baseIdRaw;
    const safeId = prefixedBaseId
      .replace(/[^a-z0-9-_]/gi, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '') || fallbackToken;
    if (safeId) section.id = safeId;
    if (group?.id) {
      section.dataset.subgroupId = group.id;
      section.dataset.rangeId = group.id;
      section.dataset.sourceId = group.id;
    }
    if (sectionKey) section.dataset.section = toDataSectionKey(sectionKey);

    const headerId = `${safeId}-header`;
    const bodyId = `${safeId}-body`;

    const header = el('button',{
      class: headerClass || 'gear-card__header',
      type:'button',
      id: headerId,
      'data-accordion':'toggle',
      'aria-controls': bodyId,
      'aria-expanded':'false'
    });
    const headingTag = String(headerLevel || 'h3').toLowerCase();
    const headingEl = el(headingTag,{ class:'gear-subcard__title' }, group?.label || 'Options');
    header.appendChild(headingEl);

    if (group?.infoButtonKey || group?.infoButtonText) {
      const tipKey = (group.infoButtonKey || '').trim() || `${safeId}-info`;
      const tipText = (group.infoButtonText || '').trim();
      if (tipText && typeof TIPS === 'object' && !TIPS[tipKey]) {
        TIPS[tipKey] = tipText;
      }
      const ariaLabel = (group.infoButtonLabel || `${group.label || 'Stand'} details`).trim();
      const infoBtn = el('button', {
        class: 'info-btn',
        type: 'button',
        'data-tip': tipKey,
        'aria-label': ariaLabel,
        'aria-haspopup': 'dialog'
      }, 'i');
      header.appendChild(infoBtn);
    }

    header.appendChild(el('span',{class:'chevron','aria-hidden':'true'},'▸'));
    section.appendChild(header);

    const body = el('div',{
      class: bodyClass || 'gear-card__body',
      id: bodyId,
      role:'region',
      'aria-labelledby': headerId,
      hidden:true,
      'aria-hidden':'true'
    });
    if (group?.intro) {
      body.appendChild(el('p',{ class:'gear-subcard__intro' }, group.intro));
    }
    const renderOptions = {
      includeGearCard: false,
      ignoreMatch: matchable ? false : true,
      showTitle: false,
      ...rangeOptions
    };
    const rangeBlock = renderRangeBlock(group, sectionKey, renderOptions);
    if (rangeBlock) {
      if (rangeClass) rangeBlock.classList.add(rangeClass);
      body.appendChild(rangeBlock);
    }
    section.appendChild(body);
    return section;
  }

  function renderHeaterBucket(bucket = {}, index = 0){
    const group = {
      ...bucket,
      label: bucket.label || '',
      rangeLabel: bucket.rangeLabel || bucket.label || ''
    };
    const section = renderAccordionGroup(group, index, {
      sectionKey: 'heaters',
      sectionClass: 'gear-subcard gear-subcard--heaters',
      rangeClass: 'range--heaters',
      matchable: true,
      rangeOptions: {
        includeGearCard: false,
        showTitle: false,
        showTip: false
      }
    });
    if (!section) return null;
    const bucketId = normalizeBucketId(bucket.id || bucket.bucketKey || `bucket-${index}`);
    section.dataset.heaterBucket = '1';
    section.dataset.bucketId = bucketId;
    return section;
  }

  function renderFilterBucket(bucket = {}, index = 0){
    const bucketKey = bucket.key || bucket.bucketKey || bucket.rangeKey || bucket.id || `bucket-${index}`;
    const normalizedBucket = normalizeBucketId(bucketKey);
    const fullLabel = (bucket.label || bucket.rangeLabel || bucket.bucketLabel || bucketKey || '').trim();
    const visibleLabel = fullLabel.replace(/^Recommended\s+Filters\s+for\s+/i, '').trim() || fullLabel;
    const placeholder = (bucket.placeholder || '').trim() || 'No items yet.';
    const options = Array.isArray(bucket.options) ? bucket.options : [];
    const groupId = bucket.id || bucket.rangeId || bucket.bucketId || normalizedBucket || bucketKey || `bucket-${index}`;
    const minGallons = Number.isFinite(bucket.minGallons) ? Number(bucket.minGallons) : undefined;
    const maxGallons = Number.isFinite(bucket.maxGallons) ? Number(bucket.maxGallons) : undefined;

    const group = {
      ...bucket,
      id: groupId,
      key: bucketKey,
      label: visibleLabel,
      rangeLabel: bucket.rangeLabel || fullLabel || visibleLabel,
      tip: bucket.tip || '',
      options,
      placeholder,
      minGallons,
      maxGallons,
      ariaLabel: fullLabel
    };

    const section = renderAccordionGroup(group, index, {
      sectionKey: 'filters',
      sectionClass: 'gear-subcard gear-subcard--filters sub-accordion',
      headerClass: 'gear-card__header gear-subcard__header accordion-header',
      bodyClass: 'gear-card__body gear-subcard__body accordion-panel',
      rangeClass: 'range--filters',
      rangeOptions: {
        includeGearCard: false,
        showTitle: false,
        context: 'filters'
      },
      matchable: true
    });

    if (!section) return null;

    const count = options.length;
    section.dataset.optionCount = String(count);
    if (!count) section.dataset.empty = '1';
    else section.removeAttribute('data-empty');

    const headerEl = section.querySelector('.gear-card__header');
    if (headerEl) {
      headerEl.setAttribute('data-count', String(count));
      const ariaLabel = (group.ariaLabel || '').trim();
      if (ariaLabel) headerEl.setAttribute('aria-label', ariaLabel);
      if (!count && typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.warn(`[filters] bucket "${bucketKey}" rendered with 0 items.`);
      }
    }

    const titleEl = section.querySelector('.gear-subcard__title');
    if (titleEl) {
      titleEl.setAttribute('data-count', String(count));
    }

    section.dataset.section = toDataSectionKey('filters');
    section.dataset.filterBucket = '1';
    section.dataset.bucket = bucketKey;
    if (normalizedBucket) section.dataset.bucketId = normalizedBucket;
    if (Number.isFinite(minGallons)) section.dataset.minG = String(minGallons);
    if (Number.isFinite(maxGallons)) section.dataset.maxG = String(maxGallons);

    const rangeBlock = section.querySelector('.range');
    if (rangeBlock) {
      rangeBlock.classList.add('range--filters');
      if (normalizedBucket) rangeBlock.dataset.bucketId = normalizedBucket;
      if (Number.isFinite(minGallons)) rangeBlock.dataset.minG = String(minGallons);
      if (Number.isFinite(maxGallons)) rangeBlock.dataset.maxG = String(maxGallons);
      if (!rangeBlock.dataset.rangeId && groupId) rangeBlock.dataset.rangeId = groupId;
      if (!options.length) {
        const placeholderEl = rangeBlock.querySelector('.range__placeholder');
        if (placeholderEl) placeholderEl.textContent = placeholder;
      }
    }

    return section;
  }

  function renderLightRangeGroup(range = {}, index = 0){
    if (!hasLiveOptions(range)) return null;

    const rangeId = range.id || `lights-${index}`;
    const minLength = firstFiniteNumber(range.minL, range.min, range.minLength);
    const maxLength = firstFiniteNumber(range.maxL, range.max, range.maxLength);

    const section = renderAccordionGroup(
      {
        ...range,
        id: rangeId,
        label: (range.rangeLabel || range.label || '').trim() || 'Recommended Lights'
      },
      index,
      {
        sectionKey: 'lights',
        sectionClass: 'gear-subcard gear-subcard--lights sub-accordion',
        headerClass: 'gear-card__header gear-subcard__header accordion-header',
        bodyClass: 'gear-card__body gear-subcard__body accordion-panel',
        rangeClass: 'range--lights',
        rangeOptions: {
          includeGearCard: false,
          showTitle: false,
          context: 'lights'
        },
        matchable: true
      }
    );

    if (!section) return null;

    if (Number.isFinite(minLength)) section.dataset.minL = String(minLength);
    if (Number.isFinite(maxLength)) section.dataset.maxL = String(maxLength);

    const rangeBlock = section.querySelector('.range');
    if (rangeBlock) {
      rangeBlock.classList.add('range--lights');
      if (!rangeBlock.dataset.rangeId && rangeId) rangeBlock.dataset.rangeId = rangeId;
      if (Number.isFinite(minLength)) rangeBlock.dataset.minL = String(minLength);
      if (Number.isFinite(maxLength)) rangeBlock.dataset.maxL = String(maxLength);
    }

    return section;
  }

  function renderFilterMediaGroup(group = {}, index = 0){
    const section = renderAccordionGroup(group, index, {
      sectionKey: 'filters',
      sectionClass: 'gear-subcard gear-subcard--filters',
      rangeClass: 'range--filters',
      rangeOptions: { context: 'filters' },
      matchable: false
    });
    if (!section) return null;
    section.dataset.filterMedia = '1';
    return section;
  }

  function createExtrasItem(item = {}){
    const option = el('div',{ class:'option extras-item' });
    const title = (item?.title || '').trim();
    const notes = (item?.notes || '').trim();
    if (title){
      option.appendChild(el('div',{ class:'option__title' }, escapeHTML(title)));
    }
    if (notes){
      option.appendChild(el('p',{ class:'option__note extras-item__note' }, escapeHTML(notes)));
    }
    const actions = el('div',{ class:'option__actions extras-item__actions' });
    const href = (item?.href || '').trim();
    const hasValidHref = /^https?:\/\//i.test(href);
    if (hasValidHref){
      actions.appendChild(
        el('a',{
          class:'btn',
          href:href,
          target:'_blank',
          rel:'sponsored noopener noreferrer',
          'aria-label':`Buy ${escapeHTML(title || 'this item')} on Amazon`
        },'Buy on Amazon')
      );
    } else {
      actions.appendChild(
        el('button',{
          class:'btn',
          type:'button',
          'aria-disabled':'true',
          title:'Link coming soon'
        },'Buy on Amazon')
      );
    }
    option.appendChild(actions);
    return option;
  }

  function renderExtrasAccordion(group = {}, index = 0, options = {}){
    const {
      sectionKey = 'extras',
      headerLevel = 'h3'
    } = options;

    const classList = new Set(['gear-subcard','gear-subcard--extras','gear-card']);
    const section = el('section',{ class:Array.from(classList).join(' ') });
    section.dataset.ignoreMatch = '1';
    const dataSectionKey = toDataSectionKey(sectionKey);
    if (dataSectionKey) section.dataset.section = dataSectionKey;

    const baseId = group?.id || `extras-${index}`;
    const safeId = String(baseId)
      .replace(/[^a-z0-9-_]/gi, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '') || `extras-${index}`;
    const sectionId = group?.id || safeId;
    section.id = sectionId;
    section.dataset.rangeId = sectionId;
    section.dataset.subgroupId = sectionId;

    const bodyId = `${safeId}-body`;
    const header = el('header',{
      class:'gear-card__header gear-subcard__header',
      'data-accordion':'toggle',
      role:'button',
      tabindex:'0',
      'aria-controls': bodyId,
      'aria-expanded':'false'
    });
    const headingTag = String(headerLevel || 'h3').toLowerCase();
    header.appendChild(el(headingTag,{ class:'gear-subcard__title' }, escapeHTML(group?.label || 'Cleanup & Extras')));

    if (group?.infoButtonKey || group?.infoButtonText){
      const tipKey = (group.infoButtonKey || '').trim();
      const tipText = (group.infoButtonText || '').trim();
      if (tipKey && tipText && typeof TIPS === 'object' && !TIPS[tipKey]){
        TIPS[tipKey] = tipText;
      }
      const ariaLabel = (group.infoButtonLabel || `${group.label || 'Extras'} tip`).trim();
      const infoBtn = el('button',{
        class:'info-btn',
        type:'button',
        'data-tip': tipKey || sectionId,
        'aria-label': ariaLabel || 'Extras tip',
        'aria-haspopup':'dialog'
      },'i');
      header.appendChild(infoBtn);
    }

    header.appendChild(el('span',{ class:'chevron','aria-hidden':'true' },'▸'));
    section.appendChild(header);

    const body = el('div',{
      class:'gear-card__body gear-subcard__body extras-body',
      id: bodyId,
      hidden:true
    });

    if (group?.intro){
      body.appendChild(el('p',{ class:'gear-subcard__intro extras-intro' }, escapeHTML(group.intro)));
    }

    const listWrap = el('div',{ class:'extras-groups' });
    const subgroups = Array.isArray(group?.subgroups) ? group.subgroups : [];
    if (subgroups.length){
      subgroups.forEach((subgroup) => {
        if (!subgroup || !Array.isArray(subgroup.items) || !subgroup.items.length) return;
        const subgroupWrap = el('div',{ class:'extras-group' });
        const subgroupTitle = (subgroup.label || subgroup.name || '').trim();
        if (subgroupTitle){
          subgroupWrap.appendChild(el('h4',{ class:'extras-group__title' }, escapeHTML(subgroupTitle)));
        }
        const itemsWrap = el('div',{ class:'extras-group__items' });
        subgroup.items.forEach((item) => {
          itemsWrap.appendChild(createExtrasItem(item));
        });
        subgroupWrap.appendChild(itemsWrap);
        listWrap.appendChild(subgroupWrap);
      });
    }

    if (!listWrap.childNodes.length){
      const placeholder = (group?.placeholder || 'Links coming soon.').trim();
      listWrap.appendChild(el('p',{ class:'range__placeholder extras-placeholder' }, escapeHTML(placeholder)));
    }

    body.appendChild(listWrap);
    section.appendChild(body);
    return section;
  }

  function buildCategory(kind, container){
    if (!container) return;
    container.innerHTML = '';
    let blocks = [];
    if (kind === 'heaters') {
      const addonCard = renderAddonCard(GEAR.heaters?.addon);
      if (addonCard) container.appendChild(addonCard);
      const heaterBuckets = Array.isArray(GEAR.heaters?.buckets) ? GEAR.heaters.buckets : [];
      blocks = heaterBuckets
        .map((bucket, index) => renderHeaterBucket(bucket, index))
        .filter(Boolean);
    } else if (kind === 'filters') {
      const filtersData = getFilterRows();
      if (typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.info('[filters] rows:', Array.isArray(filtersData) ? filtersData.length : 0);
        if (Array.isArray(filtersData) && typeof console.table === 'function') {
          // eslint-disable-next-line no-console
          console.table(filtersData.slice(0, 5));
        }
        if (Array.isArray(filtersData) && filtersData.length) {
          // eslint-disable-next-line no-console
          console.info('[filters] cols:', Object.keys(filtersData[0]));
        }
      }

      const { buckets: fallbackBuckets, byBucket } = buildFallbackFilterBuckets(filtersData);
      if (typeof window !== 'undefined') {
        window.__filtersDebug = { rows: Array.isArray(filtersData) ? filtersData.length : 0, byBucket };
      }

      const primaryBuckets = Array.isArray(GEAR.filters?.buckets) ? GEAR.filters.buckets : [];
      const mergedBuckets = mergeFilterBuckets(primaryBuckets, fallbackBuckets);
      if (GEAR.filters) {
        GEAR.filters.buckets = mergedBuckets;
      }

      blocks = mergedBuckets
        .map((bucket, index) => renderFilterBucket(bucket, index))
        .filter(Boolean);

      const mediaGroup = GEAR.filters?.mediaGroup;
      if (mediaGroup) {
        const mediaAccordion = renderFilterMediaGroup({ ...mediaGroup }, mergedBuckets.length);
        if (mediaAccordion) {
          blocks.push(mediaAccordion);
        }
      }
    }
    else if (kind === 'air') {
      const groups = Array.isArray(GEAR.air?.groups)
        ? GEAR.air.groups.filter(Boolean)
        : [];
      const airBlock = renderAirProducts(groups, { placeholder: GEAR.air?.placeholder });
      blocks = airBlock ? [airBlock] : [];
    }
    else if (kind === 'lights') {
      const ranges = Array.isArray(GEAR.lights?.ranges) ? [...GEAR.lights.ranges] : [];
      const sortRanges = (list) => {
        const getSortValue = (range) => {
          const candidates = [range?.sort, range?.maxL, range?.max, range?.maxLength];
          for (const candidate of candidates) {
            const numeric = Number(candidate);
            if (Number.isFinite(numeric)) {
              return numeric;
            }
          }
          return Number.POSITIVE_INFINITY;
        };
        return list.sort((a, b) => getSortValue(a) - getSortValue(b));
      };
      blocks = sortRanges(ranges)
        .map((range, index) => renderLightRangeGroup(range, index))
        .filter(Boolean);
    }
    else if (kind === 'substrate') {
      const groups = (GEAR.substrate?.groups || []).filter((range) => hasLiveOptions(range));
      const defaultLabel = typeof SUBSTRATE_DEFAULT_GROUP_LABEL !== 'undefined'
        ? (SUBSTRATE_DEFAULT_GROUP_LABEL || '')
        : 'Substrate & Aquascaping Picks';
      const normalizeLabel = (value) => String(value || '').trim().toLowerCase();
      const isDefaultLabel = (value) => {
        const normalized = normalizeLabel(value);
        return normalized && normalized === normalizeLabel(defaultLabel);
      };

      if (groups.length === 1 && isDefaultLabel(groups[0]?.rangeLabel || groups[0]?.label)) {
        const [primaryGroup] = groups;
        const parentRangeId = primaryGroup?.id || primaryGroup?.rangeId || '';
        const subgroups = Array.isArray(primaryGroup?.subgroups)
          ? primaryGroup.subgroups.filter(Boolean)
          : [];
        const subgroupBlocks = subgroups
          .map((subgroup, index) =>
            renderSubstrateSubgroupAccordion(subgroup, index, {
              optionContext: 'substrate',
              parentRangeId
            })
          )
          .filter(Boolean);

        if (subgroupBlocks.length) {
          const tipText = String(primaryGroup?.tip || '').trim();
          const nextBlocks = [];
          if (tipText) {
            nextBlocks.push(el('p', { class: 'range__tip range-intro' }, tipText));
          }
          nextBlocks.push(...subgroupBlocks);
          blocks = nextBlocks;
        } else {
          blocks = groups.map((range) => renderRangeBlock(range, 'substrate')).filter(Boolean);
        }
      } else {
        blocks = groups.map((range) => renderRangeBlock(range, 'substrate')).filter(Boolean);
      }
    } else if (kind === 'fertilizers') {
      blocks = (GEAR.fertilizers?.ranges || []).map((range) => renderRangeBlock(range, 'fertilizers', { ignoreMatch: true }));
    } else if (kind === 'water-treatments' || kind === 'water-treatments-fertilizers') {
      blocks = (GEAR.waterTreatments?.ranges || []).map((range) =>
        renderRangeBlock(range, 'waterTreatments', { ignoreMatch: true, showTitle: false })
      );
    } else if (kind === 'food') {
      if (GEAR.food?.intro) {
        const intro = el('div',{ class:'gear-card__intro' }, GEAR.food.intro);
        container.appendChild(intro);
      }
      blocks = (GEAR.food?.accordions || []).map((group, index) =>
        renderAccordionGroup(group, index, {
          sectionKey: 'food',
          rangeClass: 'range--food'
        })
      );
    } else if (kind === 'maintenance-tools') {
      if (GEAR.maintenanceTools?.intro) {
        const intro = el('div',{ class:'gear-card__intro' }, GEAR.maintenanceTools.intro);
        container.appendChild(intro);
      }
      const maintenanceGroups = Array.isArray(GEAR.maintenanceTools?.accordions)
        ? [...GEAR.maintenanceTools.accordions]
        : [];
      const extrasGroups = Array.isArray(GEAR.extras?.accordions)
        ? GEAR.extras.accordions.filter(Boolean)
        : [];
      const hasCleanupExtrasGroup = maintenanceGroups.some((group) => {
        const id = String(group?.id || '').trim().toLowerCase();
        if (id === 'maintenance_cleanup_extras') return true;
        const normalizedLabel = String(group?.label || '')
          .toLowerCase()
          .replace(/&/g, 'and')
          .replace(/\s+/g, ' ')
          .trim();
        return normalizedLabel === 'cleanup and extras';
      });
      if (hasCleanupExtrasGroup) {
        extrasGroups.length = 0;
      }
      const combined = [];
      let extrasInserted = false;
      const normalizeLabel = (value) =>
        String(value || '')
          .toLowerCase()
          .replace(/&/g, 'and')
          .replace(/\s+/g, ' ')
          .trim();

      maintenanceGroups.forEach((group) => {
        combined.push({ type: 'maintenance', group });
        if (!extrasInserted && extrasGroups.length) {
          const label = normalizeLabel(group?.label);
          if (label === 'safety and power') {
            extrasGroups.forEach((extrasGroup) => {
              combined.push({ type: 'extras', group: extrasGroup });
            });
            extrasGroups.length = 0;
            extrasInserted = true;
          }
        }
      });

      if (extrasGroups.length) {
        extrasGroups.forEach((extrasGroup) => {
          combined.push({ type: 'extras', group: extrasGroup });
        });
      }

      blocks = combined.map((entry, index) => {
        if (entry.type === 'extras') {
          return renderExtrasAccordion(entry.group, index, { sectionKey: 'extras' });
        }
        return renderAccordionGroup(entry.group, index, {
          sectionKey: 'maintenanceTools',
          rangeClass: 'range--maintenance'
        });
      });
    } else if (kind === 'stands') {
      const groups = Array.isArray(GEAR.stands?.ranges) ? GEAR.stands.ranges : [];
      if (!groups.length) {
        blocks = [
          el('p', {
            class: 'range__placeholder',
            html: 'No stand recommendations yet. Check back soon.',
          })
        ];
      } else {
        blocks = groups.map((group, index) =>
          renderAccordionGroup(group, index, {
            sectionKey: 'stands',
            sectionClass: 'gear-subcard gear-subcard--stands',
            rangeClass: 'range--stands',
            matchable: true,
            rangeOptions: {
              includeGearCard: false,
              showTitle: false,
              showTip: false,
              headingTag: 'h4',
              context: 'stands'
            }
          })
        );
      }
    }
    blocks.forEach((block) => container.appendChild(block));
  }

  const ACCORDION_DURATION = 250;
  const ACCORDION_EASING = 'ease-in-out';

  function animateAccordion(body, expanded, animate){
    if (!body) return;
    const shouldAnimate = animate && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    body.setAttribute('aria-hidden', String(!expanded));
    if (expanded) {
      body.hidden = false;
      body.removeAttribute('hidden');
      body.classList.add('is-open');
    } else {
      body.classList.remove('is-open');
    }
    if (!shouldAnimate){
      if (expanded) {
        body.hidden = false;
        body.removeAttribute('hidden');
      } else {
        body.hidden = true;
        body.setAttribute('hidden', '');
      }
      body.style.height = '';
      body.style.opacity = '';
      body.style.transition = '';
      body.style.overflow = '';
      delete body.__accordionState;
      return;
    }

    if (body.__accordionState){
      const prev = body.__accordionState;
      if (prev.handleEnd) body.removeEventListener('transitionend', prev.handleEnd);
      if (prev.fallback) clearTimeout(prev.fallback);
      if (typeof prev.cleanup === 'function') prev.cleanup(true);
    }

    const cleanup = (skipHide = false) => {
      body.style.transition = '';
      body.style.height = '';
      body.style.overflow = '';
      body.style.opacity = '';
      if (!expanded && !skipHide) {
        body.hidden = true;
        body.setAttribute('hidden', '');
      }
      delete body.__accordionState;
    };

    if (expanded){
      body.hidden = false;
      body.removeAttribute('hidden');
      const targetHeight = body.scrollHeight;
      body.style.overflow = 'hidden';
      body.style.height = '0px';
      body.style.opacity = '0';
      requestAnimationFrame(() => {
        body.style.transition = `height ${ACCORDION_DURATION}ms ${ACCORDION_EASING}, opacity ${ACCORDION_DURATION}ms ${ACCORDION_EASING}`;
        body.style.height = `${targetHeight}px`;
        body.style.opacity = '1';
      });
      const handleEnd = (event) => {
        if (event.target !== body) return;
        cleanup();
        clearTimeout(fallback);
        body.removeEventListener('transitionend', handleEnd);
      };
      const fallback = setTimeout(() => {
        cleanup();
        body.removeEventListener('transitionend', handleEnd);
      }, ACCORDION_DURATION + 50);
      body.addEventListener('transitionend', handleEnd);
      body.__accordionState = { handleEnd, fallback, cleanup };
    } else {
      const startHeight = body.scrollHeight;
      body.style.overflow = 'hidden';
      body.style.height = `${startHeight}px`;
      body.style.opacity = '1';
      requestAnimationFrame(() => {
        body.style.transition = `height ${ACCORDION_DURATION}ms ${ACCORDION_EASING}, opacity ${ACCORDION_DURATION}ms ${ACCORDION_EASING}`;
        body.style.height = '0px';
        body.style.opacity = '0';
      });
      const handleEnd = (event) => {
        if (event.target !== body) return;
        cleanup();
        clearTimeout(fallback);
        body.removeEventListener('transitionend', handleEnd);
      };
      const fallback = setTimeout(() => {
        cleanup();
        body.removeEventListener('transitionend', handleEnd);
      }, ACCORDION_DURATION + 50);
      body.addEventListener('transitionend', handleEnd);
      body.__accordionState = { handleEnd, fallback, cleanup };
    }
  }

  function wireAccordions(){
    document.querySelectorAll('[data-accordion="toggle"]').forEach((header) => {
      const controls = header.getAttribute('aria-controls');
      const body = controls ? document.getElementById(controls) : null;
      const chevron = header.querySelector('.chevron');
      if (!header.getAttribute('role')) {
        header.setAttribute('role', 'button');
      }

      const setExpanded = (expanded, options = {}) => {
        const { animate = true } = options;
        if (!body) return;
        animateAccordion(body, expanded, animate);
        header.setAttribute('aria-expanded', String(expanded));
        header.classList.toggle('is-open', expanded);
        if (chevron) {
          chevron.style.transform = expanded ? 'rotate(90deg)' : 'rotate(0deg)';
        }
      };

      header.__setExpanded = (expanded, options) => setExpanded(expanded, options);
      setExpanded(header.getAttribute('aria-expanded') === 'true', { animate: false });

      header.addEventListener('click', (event) => {
        event.preventDefault();
        const expanded = header.getAttribute('aria-expanded') === 'true';
        setExpanded(!expanded);
      });

      header.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const expanded = header.getAttribute('aria-expanded') === 'true';
          setExpanded(!expanded);
        }
      });
    });

    document.querySelectorAll('.info-btn').forEach((btn) => {
      btn.addEventListener('click', () => showTip(btn.getAttribute('data-tip')));
    });
  }

  function matchRange(value, ranges){
    if (value === null || typeof value === 'undefined') return null;
    const numeric = toNumber(value);
    if (!Number.isFinite(numeric)) return null;
    const exact = ranges.find((range) => numeric >= range.min && numeric <= range.max);
    if (exact) return exact.id;
    let nearest = null;
    let bestDistance = Infinity;
    ranges.forEach((range) => {
      const distance = numeric < range.min ? range.min - numeric : numeric - range.max;
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = range;
      }
    });
    return nearest ? nearest.id : null;
  }

  function setActiveRange(bodyId, rangeId){
    if (!rangeId) return false;
    const body = document.querySelector(bodyId);
    if (!body) return false;
    const rangeBlock = body.querySelector(`.range[data-range-id="${rangeId}"]`);
    const cardBlock = body.querySelector(`.gear-card[data-range-id="${rangeId}"]`);
    const filterBucket = body.querySelector(`.sub-accordion[data-range-id="${rangeId}"]`);
    if (!rangeBlock && !cardBlock && !filterBucket) return false;
    if (rangeBlock) rangeBlock.classList.add('is-active');
    if (cardBlock) cardBlock.classList.add('is-active');
    if (filterBucket) filterBucket.classList.add('is-active');
    return true;
  }

  function setAccordionOpen(panelEl, open, options = {}){
    if (!panelEl) return;
    const shouldOpen = !!open;
    if (panelEl.tagName === 'DETAILS') {
      if (shouldOpen) panelEl.setAttribute('open', '');
      else panelEl.removeAttribute('open');
      return;
    }
    const header = panelEl.querySelector('[data-accordion="toggle"]');
    if (header && typeof header.__setExpanded === 'function') {
      header.__setExpanded(shouldOpen, options);
      return;
    }
    panelEl.classList.toggle('is-open', shouldOpen);
    const body = panelEl.querySelector('.accordion__body, .gear-card__body');
    if (body) {
      if ('hidden' in body) body.hidden = !shouldOpen;
      else body.style.display = shouldOpen ? '' : 'none';
    }
  }

  function closeAllExcept(sectionKey){
    const panels = document.querySelectorAll('.gear-shell > .gear-card.accordion[data-section]');
    panels.forEach((panel) => {
      const dataSection = panel.getAttribute('data-section');
      const shouldStayOpen = sectionKey && dataSection === sectionKey;
      if (!shouldStayOpen) setAccordionOpen(panel, false);
    });
  }

  function getHeaterBucketSections(){
    return Array.from(document.querySelectorAll('#heaters-body [data-heater-bucket="1"]'));
  }

  function setHeaterBucketOpen(bucketId, open, options = {}){
    const normalizedId = normalizeBucketId(bucketId);
    if (!normalizedId) return false;
    const selector = `#heaters-body [data-heater-bucket="1"][data-bucket-id="${normalizedId}"]`;
    const section = document.querySelector(selector);
    if (!section) return false;
    setAccordionOpen(section, open, options);
    return true;
  }

  function closeHeaterBucketsExcept(bucketId){
    const normalizedId = normalizeBucketId(bucketId);
    getHeaterBucketSections().forEach((section) => {
      const sectionId = normalizeBucketId(section.dataset.bucketId || '');
      if (!normalizedId || sectionId !== normalizedId) {
        setAccordionOpen(section, false);
      }
    });
  }

  function openMatchingHeaterOnSelection(selectedGallons, matchingRangeId){
    const heaterPanel = document.querySelector('.gear-shell > .gear-card.accordion[data-section="heaters"]');
    const gallons = Number(selectedGallons);
    const bucketId = normalizeBucketId(matchingRangeId);
    const hasValidSelection = Number.isFinite(gallons) && gallons > 0 && !!bucketId;
    if (!heaterPanel) {
      if (!hasValidSelection) closeAllExcept();
      return;
    }
    if (!hasValidSelection) {
      setAccordionOpen(heaterPanel, false);
      closeAllExcept();
      closeHeaterBucketsExcept('');
      return;
    }
    setAccordionOpen(heaterPanel, true);
    closeAllExcept('heaters');
    closeHeaterBucketsExcept(bucketId);
    setHeaterBucketOpen(bucketId, true);
  }

  function clearHighlights(){
    document.querySelectorAll('.range.is-active').forEach((node) => node.classList.remove('is-active'));
    document.querySelectorAll('.gear-card.is-active').forEach((node) => node.classList.remove('is-active'));
    document.querySelectorAll('.sub-accordion.is-active').forEach((node) => node.classList.remove('is-active'));
  }

  function applyHighlights(gallons, length){
    const gallonsNumeric = toNumber(gallons);
    const lengthNumeric = toNumber(length);

    state.selectedGallons = Number.isFinite(gallonsNumeric) ? gallonsNumeric : 0;
    state.selectedLengthIn = Number.isFinite(lengthNumeric) ? lengthNumeric : 0;

    updateGearHighlights();
    clearHighlights();
    const heaterId = matchRange(gallonsNumeric, RANGES_HEATERS);
    const filterId = matchRange(gallonsNumeric, RANGES_FILTERS);
    const lightId = matchRange(lengthNumeric, RANGES_LIGHTS);
    const matches = {};
    if (setActiveRange('#heaters-body', heaterId)) matches.heaters = heaterId;
    if (setActiveRange('#filters-body', filterId)) matches.filters = filterId;
    if (setActiveRange('#lights-body', lightId)) matches.lights = lightId;
    openMatchingHeaterOnSelection(gallonsNumeric, matches.heaters);
    return matches;
  }

  function ensurePanelHooks(){
    const panels = document.querySelectorAll('.gear-shell > .gear-card[data-gear]');
    panels.forEach((panel) => {
      const gearKey = panel.getAttribute('data-gear');
      panel.classList.add('accordion');
      const dataSectionKey = toDataSectionKey(gearKey);
      if (dataSectionKey) panel.setAttribute('data-section', dataSectionKey);
    });
  }

  function initTankSelect(){
    const select =
      document.getElementById('tank-size') || document.getElementById('gear-tank-size');
    const wrap = document.getElementById('gear-tank-select-wrap');
    const meta = document.getElementById('gear-tank-meta');
    if (!select || !meta) return;

    select.innerHTML = '';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select a tank size…';
    placeholderOption.setAttribute('data-placeholder', '1');
    select.appendChild(placeholderOption);

    const fragment = document.createDocumentFragment();
    TANK_PRESETS.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.label;
      fragment.appendChild(option);
    });
    select.appendChild(fragment);

    const setInfo = (preset) => {
      if (!preset) {
        meta.textContent = '';
        meta.hidden = true;
        meta.removeAttribute('role');
        return;
      }
      meta.textContent = buildInfoLine(preset);
      meta.hidden = false;
      meta.setAttribute('role', 'note');
    };

    const persistSelection = (id) => {
      try {
        if (id) localStorage.setItem(STORAGE_KEY, id);
        else localStorage.removeItem(STORAGE_KEY);
      } catch (_) {
        /* noop */
      }
    };

    const handleSelection = (id) => {
      const preset = PRESET_MAP.get(id) || null;
      if (!preset) {
        select.value = '';
        setInfo(null);
        persistSelection('');
        applyHighlights();
        return;
      }
      setInfo(preset);
      persistSelection(preset.id);
      applyHighlights(preset.gallons, preset.lengthIn);
    };

    select.addEventListener('change', (event) => {
      handleSelection(event.target.value);
    });

    if (wrap) {
      const setOpen = (state) => wrap.classList.toggle('open', !!state);
      select.addEventListener('focus', () => setOpen(true));
      select.addEventListener('blur', () => setOpen(false));
      select.addEventListener('click', () => setOpen(true));
      select.addEventListener('change', () => setOpen(false));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) setOpen(false);
      });
    }

    let saved = '';
    try {
      saved = localStorage.getItem(STORAGE_KEY) || '';
    } catch (_) {
      saved = '';
    }

    if (saved && PRESET_MAP.has(saved)) {
      select.value = saved;
      handleSelection(saved);
    } else {
      select.value = '';
      setInfo(null);
      applyHighlights();
    }
  }

  function init(){
    ensurePanelHooks();
    buildCategory('heaters', document.getElementById('heaters-body'));
    buildCategory('filters', document.getElementById('filters-body'));
    buildCategory('air', document.getElementById('air-body'));
    buildCategory('lights', document.getElementById('lights-body'));
    buildCategory('substrate', document.getElementById('substrate-body'));
    buildCategory('fertilizers', document.getElementById('fertilizers-body'));
    buildCategory('water-treatments', document.getElementById('water-treatments-body'));
    buildCategory('stands', document.getElementById('stands-body'));
    buildCategory('food', document.getElementById('food-body'));
    buildCategory('maintenance-tools', document.getElementById('maintenance-tools-body'));
    wireAccordions();
    initTankSelect();
  }

  if (typeof window !== 'undefined') {
    window.ttgGear = Object.assign({}, window.ttgGear, {
      applyHighlights: (gallons, lengthIn) => applyHighlights(gallons, lengthIn),
      getSelection: () => ({
        gallons: getSelectedGallons(),
        lengthIn: getSelectedLengthInches()
      }),
      updateGearHighlights
    });
  }

  async function start(){
    if (typeof window !== 'undefined' && window.ttgGearDataPromise) {
      try {
        await window.ttgGearDataPromise;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[Gear] Data promise rejected:', error);
      }
    }
    init();
  }

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
