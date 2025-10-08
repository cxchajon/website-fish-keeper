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
    substrate: 'substrate',
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
    substrate: 'substrate',
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

  function buildSummaryLine(preset){
    if (!preset) return '';
    const gallons = Number.isFinite(preset.gallons) ? `${formatNumber(preset.gallons)} gal` : '';
    const dims = [preset.lengthIn, preset.widthIn, preset.heightIn]
      .map((value) => formatNumber(value))
      .filter(Boolean)
      .join(' × ');
    const dimsText = dims ? `${dims} in` : '';
    return [gallons, dimsText].filter(Boolean).join(' • ');
  }

  function showTip(kind){
    const msg = TIPS[kind] || 'No tip available.';
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
    card.innerHTML = `<h3 style="margin:0 0 0.75rem;font-size:1.1rem;font-weight:600;">Tip</h3><p style="margin:0 0 1rem;color:#cbd5f5;font-size:0.9rem;line-height:1.5;">${msg}</p><button style="padding:0.5rem 0.875rem;background:#111827;color:#e5e7eb;border:1px solid rgba(148,163,184,0.4);border-radius:8px;cursor:pointer;font-size:0.9rem;font-weight:600;">Close</button>`;
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

  function renderRangeBlock(range = {}, sectionKey, options = {}){
    const {
      includeGearCard = true,
      ignoreMatch = false,
      showTitle = true,
      showTip = true,
      headingTag = 'p'
    } = options;

    const wrap = el('div',{class:'range'});
    if (includeGearCard) wrap.classList.add('gear-card');
    if (ignoreMatch) wrap.dataset.ignoreMatch = '1';
    const dataSectionKey = toDataSectionKey(sectionKey);
    const gearSectionKey = toGearSectionKey(sectionKey);
    if (sectionKey) wrap.dataset.section = dataSectionKey;
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
    if (showTitle && rangeTitle) {
      wrap.appendChild(el(headingTag,{class:'range__title'}, rangeTitle));
    }
    if (range.tip && showTip !== false) {
      wrap.appendChild(el('p',{class:'range__tip range-intro'}, range.tip));
    }

    const list = el('div',{class:'range__list'});
    const optionContext = options.context || sectionKey || '';
    const subgroups = Array.isArray(range.subgroups)
      ? range.subgroups.filter((group) => group && Array.isArray(group.options) && group.options.length)
      : [];
    if (subgroups.length) {
      subgroups.forEach((subgroup) => {
        const subgroupWrap = el('div',{ class:'range__subgroup' });
        const subgroupTitle = (subgroup.label || '').trim();
        if (subgroupTitle) {
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

  function hasLiveOptions(range){
    if (!range || !Array.isArray(range.options)) return false;
    if (range.options.length > 0) return true;
    return Boolean((range?.placeholder || '').trim());
  }

  function renderAccordionGroup(group = {}, index = 0, options = {}){
    const {
      sectionKey = '',
      headerLevel = 'h3',
      sectionClass = 'gear-subcard',
      headerClass = 'gear-card__header gear-subcard__header',
      bodyClass = 'gear-card__body gear-subcard__body',
      rangeClass = '',
      rangeOptions = {},
      matchable = false
    } = options;

    const classList = new Set(String(sectionClass || '').split(/\s+/).filter(Boolean));
    classList.add('gear-card');
    const section = el('section',{ class: Array.from(classList).join(' ') });
    section.dataset.ignoreMatch = matchable ? '0' : '1';
    if (group?.id) {
      section.dataset.subgroupId = group.id;
      section.dataset.rangeId = group.id;
    }
    if (sectionKey) section.dataset.section = toDataSectionKey(sectionKey);

    const baseId = group?.id ? String(group.id) : `${sectionKey || 'group'}-${index}`;
    const safeId = baseId.replace(/[^a-z0-9-_]/gi, '-');
    const bodyId = `${safeId}-body`;

    const header = el('header',{
      class: headerClass || 'gear-card__header',
      'data-accordion':'toggle',
      role:'button',
      tabindex:'0',
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

    const body = el('div',{ class: bodyClass || 'gear-card__body', id: bodyId, hidden:true });
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
    if (rangeClass && rangeBlock) rangeBlock.classList.add(rangeClass);
    body.appendChild(rangeBlock);
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
        showTitle: false
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
    const label = (bucket.label || bucket.rangeLabel || bucket.bucketLabel || bucketKey || '').trim();
    const placeholder = (bucket.placeholder || '').trim() || 'No items yet.';
    const options = Array.isArray(bucket.options) ? bucket.options : [];
    const groupId = bucket.id || bucket.rangeId || bucket.bucketId || normalizedBucket || bucketKey || `bucket-${index}`;
    const minGallons = Number.isFinite(bucket.minGallons) ? Number(bucket.minGallons) : undefined;
    const maxGallons = Number.isFinite(bucket.maxGallons) ? Number(bucket.maxGallons) : undefined;

    const group = {
      ...bucket,
      id: groupId,
      key: bucketKey,
      label,
      rangeLabel: bucket.rangeLabel || label,
      tip: bucket.tip || '',
      options,
      placeholder,
      minGallons,
      maxGallons,
    };

    const suffixSource = normalizedBucket || normalizeBucketId(groupId) || `bucket-${index}`;
    const safeSuffix = String(suffixSource)
      .replace(/[^a-z0-9-_]/gi, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '') || `bucket-${index}`;
    const headerId = `filters-${safeSuffix}-header`;
    const panelId = `filters-${safeSuffix}-panel`;

    const section = el('section',{ class:'gear-subcard gear-subcard--filters gear-card sub-accordion' });
    section.dataset.ignoreMatch = '0';
    section.dataset.section = toDataSectionKey('filters');
    section.dataset.filterBucket = '1';
    section.dataset.bucket = bucketKey;
    if (normalizedBucket) section.dataset.bucketId = normalizedBucket;
    if (groupId) {
      section.dataset.rangeId = groupId;
      section.dataset.subgroupId = groupId;
    }
    if (Number.isFinite(minGallons)) section.dataset.minG = String(minGallons);
    if (Number.isFinite(maxGallons)) section.dataset.maxG = String(maxGallons);

    const header = el('button',{
      class:'gear-card__header gear-subcard__header accordion-header',
      type:'button',
      id: headerId,
      'data-accordion':'toggle',
      'aria-controls': panelId,
      'aria-expanded':'false'
    });
    header.appendChild(el('span',{ class:'gear-subcard__title' }, label || 'Options'));
    header.appendChild(el('span',{ class:'chevron','aria-hidden':'true' },'▸'));

    const panel = el('div',{
      class:'gear-card__body gear-subcard__body accordion-panel',
      id: panelId,
      role:'region',
      'aria-labelledby': headerId,
      hidden:true,
      'aria-hidden':'true'
    });

    const rangeBlock = renderRangeBlock(group, 'filters', {
      includeGearCard: false,
      showTitle: false,
      context: 'filters'
    });
    if (rangeBlock) {
      rangeBlock.classList.add('range--filters');
      if (normalizedBucket) rangeBlock.dataset.bucketId = normalizedBucket;
      if (Number.isFinite(minGallons)) rangeBlock.dataset.minG = String(minGallons);
      if (Number.isFinite(maxGallons)) rangeBlock.dataset.maxG = String(maxGallons);
      if (!rangeBlock.dataset.rangeId && groupId) rangeBlock.dataset.rangeId = groupId;
      panel.appendChild(rangeBlock);
    }

    if (!options.length) {
      const placeholderEl = panel.querySelector('.range__placeholder');
      if (placeholderEl) placeholderEl.textContent = placeholder;
    }

    section.appendChild(header);
    section.appendChild(panel);
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
    else if (kind === 'lights') {
      blocks = (GEAR.lights?.ranges || []).map((range) =>
        renderRangeBlock(range, 'lights', { showTitle: false })
      );
    }
    else if (kind === 'substrate') {
      blocks = (GEAR.substrate?.groups || [])
        .filter((range) => hasLiveOptions(range))
        .map((range) => renderRangeBlock(range, 'substrate'));
    } else if (kind === 'water-treatments' || kind === 'water-treatments-fertilizers') {
      blocks = (GEAR.waterTreatments?.ranges || []).map((range) => renderRangeBlock(range, 'waterTreatments', { ignoreMatch: true }));
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
    if (!shouldAnimate){
      body.hidden = !expanded;
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
      if (!expanded && !skipHide) body.hidden = true;
      delete body.__accordionState;
    };

    if (expanded){
      body.hidden = false;
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
    const summary = document.getElementById('tank-summary-value');
    const defaultSummary = 'Select a tank size to see gallons and dimensions.';
    if (!select || !meta) return;
    if (summary) summary.textContent = defaultSummary;

    const existingBlank = select.querySelector('option[value=""]');
    if (!existingBlank) {
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Select a tank size…';
      select.appendChild(blank);
    }

    const fragment = document.createDocumentFragment();
    TANK_PRESETS.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.label;
      fragment.appendChild(option);
    });
    select.appendChild(fragment);

    const updateSummary = (preset) => {
      if (!summary) return;
      if (!preset) {
        summary.textContent = defaultSummary;
        return;
      }
      summary.textContent = buildSummaryLine(preset) || defaultSummary;
    };

    const setInfo = (preset) => {
      if (!preset) {
        meta.textContent = '';
        meta.hidden = true;
        updateSummary(null);
        return;
      }
      meta.textContent = buildInfoLine(preset);
      meta.hidden = false;
      meta.setAttribute('role', 'note');
      updateSummary(preset);
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
      updateSummary(null);
      applyHighlights();
    }
  }

  function init(){
    ensurePanelHooks();
    buildCategory('heaters', document.getElementById('heaters-body'));
    buildCategory('filters', document.getElementById('filters-body'));
    buildCategory('lights', document.getElementById('lights-body'));
    buildCategory('substrate', document.getElementById('substrate-body'));
    buildCategory('stands', document.getElementById('stands-body'));
    buildCategory('food', document.getElementById('food-body'));
    buildCategory('water-treatments-fertilizers', document.getElementById('water-treatments-fertilizers-body'));
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
