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
    const msg = TIPS[kind] || 'No tip available.';
    const wrap = el('div',{class:'tip-wrap',style:'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:120'});
    const card = el('div',{style:'max-width:520px;background:#0b1220;color:#e5e7eb;border:1px solid #1f2937;border-radius:14px;padding:18px;box-shadow:0 18px 36px -24px rgba(0,0,0,0.6)'});
    card.innerHTML = `<h3 style="margin:0 0 10px;font-size:1.1rem;">Tip</h3><p style="margin:0 0 16px;color:#cbd5f5;line-height:1.45;">${msg}</p><button style="padding:8px 14px;background:#111827;color:#e5e7eb;border:1px solid #1f2937;border-radius:8px;cursor:pointer;">Close</button>`;
    card.querySelector('button').onclick = () => wrap.remove();
    wrap.onclick = (event) => { if (event.target === wrap) wrap.remove(); };
    wrap.appendChild(card);
    document.body.appendChild(wrap);
  }

  function renderRangeBlock(range){
    const wrap = el('div',{class:'range','data-range-id':range.id});
    wrap.appendChild(el('p',{class:'range__title'}, range.label));
    if (range.tip) wrap.appendChild(el('p',{class:'range__tip'}, range.tip));
    const list = el('div',{class:'range__list'});
    (range.options || []).forEach((opt) => {
      const row = el('div',{class:'option'});
      const hasLink = !!opt.href;
      row.innerHTML = `<strong>${opt.label} — ${opt.title || '(add title)'}</strong><br>${hasLink ? `<a href="${opt.href}" target="_blank" rel="noopener noreferrer">Buy on Amazon</a>` : '<span style="color:#94a3b8;">Add link</span>'}`;
      list.appendChild(row);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function buildCategory(kind, container){
    if (!container) return;
    container.innerHTML = '';
    let blocks = [];
    if (kind === 'heaters') blocks = (GEAR.heaters?.ranges || []).map(renderRangeBlock);
    else if (kind === 'filters') blocks = (GEAR.filters?.ranges || []).map(renderRangeBlock);
    else if (kind === 'lights') blocks = (GEAR.lights?.ranges || []).map(renderRangeBlock);
    else if (kind === 'substrate') blocks = (GEAR.substrate?.groups || []).map(renderRangeBlock);
    blocks.forEach((block) => container.appendChild(block));
  }

  function wireAccordions(){
    document.querySelectorAll('[data-accordion="toggle"]').forEach((header) => {
      const controls = header.getAttribute('aria-controls');
      const body = controls ? document.getElementById(controls) : null;
      const chevron = header.querySelector('.chevron');

      const setExpanded = (expanded) => {
        if (!body) return;
        body.hidden = !expanded;
        header.setAttribute('aria-expanded', String(expanded));
        if (chevron) {
          chevron.style.transform = expanded ? 'rotate(90deg)' : 'rotate(0deg)';
        }
      };

      header.__setExpanded = setExpanded;
      setExpanded(header.getAttribute('aria-expanded') === 'true');

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
    const block = body.querySelector(`[data-range-id="${rangeId}"]`);
    if (!block) return false;
    block.classList.add('is-active');
    const header = body.previousElementSibling;
    if (header && typeof header.__setExpanded === 'function') {
      header.__setExpanded(true);
    }
    return true;
  }

  function clearHighlights(){
    document.querySelectorAll('.range.is-active').forEach((node) => node.classList.remove('is-active'));
  }

  function applyHighlights(gallons, length){
    clearHighlights();
    const heaterId = matchRange(gallons, RANGES_HEATERS);
    const filterId = matchRange(gallons, RANGES_FILTERS);
    const lightId = matchRange(length, RANGES_LIGHTS);
    const matches = {};
    if (setActiveRange('#heaters-body', heaterId)) matches.heaters = heaterId;
    if (setActiveRange('#filters-body', filterId)) matches.filters = filterId;
    if (setActiveRange('#lights-body', lightId)) matches.lights = lightId;
    return matches;
  }

  function initTankSelect(){
    const select = document.getElementById('gear-tank-size');
    const wrap = document.getElementById('gear-tank-select-wrap');
    const meta = document.getElementById('gear-tank-meta');
    if (!select || !meta) return;

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

    const setInfo = (preset) => {
      if (!preset) {
        meta.textContent = '';
        meta.hidden = true;
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
    buildCategory('heaters', document.getElementById('heaters-body'));
    buildCategory('filters', document.getElementById('filters-body'));
    buildCategory('lights', document.getElementById('lights-body'));
    buildCategory('substrate', document.getElementById('substrate-body'));
    wireAccordions();
    initTankSelect();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
