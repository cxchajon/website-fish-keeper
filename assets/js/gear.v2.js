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
    food: 'food',
    maintenanceTools: 'maintenance_tools',
    'maintenance-tools': 'maintenance_tools',
    maintenance_tools: 'maintenance_tools'
  };

  const GEAR_SECTION_ALIASES = {
    heaters: 'heaters',
    filters: 'filters',
    lights: 'lights',
    substrate: 'substrate',
    water_treatments: 'waterTreatments',
    'water-treatments': 'waterTreatments',
    waterTreatments: 'waterTreatments',
    food: 'food',
    maintenance_tools: 'maintenanceTools',
    'maintenance-tools': 'maintenanceTools',
    maintenanceTools: 'maintenanceTools'
  };

  function toDataSectionKey(sectionKey){
    const key = String(sectionKey || '');
    return DATA_SECTION_ALIASES[key] || key;
  }

  function toGearSectionKey(sectionKey){
    const key = String(sectionKey || '');
    return GEAR_SECTION_ALIASES[key] || key;
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

  function createOptionRow(option = {}, options = {}){
    const row = el('div',{class:'option'});
    row.dataset.category = option.category || '';
    row.dataset.subgroup = option.subgroup || '';
    row.dataset.tanksize = option.tanksize || '';
    row.dataset.length = option.length || '';
    row.dataset.depth = (option.depth ?? '').toString();
    row.dataset.affiliate = option.affiliate || 'amazon';
    row.dataset.tag = option.tag || 'fishkeepingli-20';
    const href = (option?.href || '').trim();
    const labelText = (option?.label || '').trim();
    const titleText = (option?.title || '').trim();
    const displayTitle = titleText || labelText || 'this item';
    const headingHtml = labelText && titleText
      ? `<strong>${escapeHTML(labelText)} — ${escapeHTML(titleText)}</strong>`
      : `<strong>${escapeHTML(displayTitle)}</strong>`;
    const noteText = (option?.note ?? option?.notes ?? '').trim();
    const buttonLabel = options.buttonLabel || 'Buy on Amazon';
    const actionsHtml = href
      ? `<a class="btn btn-amazon" href="${escapeHTML(href)}" target="_blank" rel="sponsored noopener noreferrer" aria-label="Buy ${escapeHTML(displayTitle)} on Amazon">${buttonLabel}</a>`
      : `<span class="muted">Add link</span>`;
    row.innerHTML = `
      <div class="option__title">${headingHtml}</div>
      ${noteText ? `<p class="option__note">${escapeHTML(noteText)}</p>` : ''}
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
        const meta = RANGE_LOOKUP[gearSectionKey]?.get(range.id);
        if (meta) {
          if (matchMode === 'length') {
            if (Number.isFinite(meta.min)) wrap.dataset.minL = String(meta.min);
            if (Number.isFinite(meta.max)) wrap.dataset.maxL = String(meta.max);
          } else if (matchMode === 'gallons') {
            if (Number.isFinite(meta.min)) wrap.dataset.minG = String(meta.min);
            if (Number.isFinite(meta.max)) wrap.dataset.maxG = String(meta.max);
          }
        }
      }
    }

    if (showTitle && range.label) {
      wrap.appendChild(el(headingTag,{class:'range__title'}, range.label));
    }
    if (range.tip && showTip !== false) {
      wrap.appendChild(el('p',{class:'range__tip'}, range.tip));
    }

    const list = el('div',{class:'range__list'});
    const optionList = Array.isArray(range.options) ? range.options : [];
    optionList.forEach((opt) => {
      list.appendChild(createOptionRow(opt, options));
    });
    if (!optionList.length && range.placeholder) {
      list.appendChild(el('p',{class:'range__placeholder'}, range.placeholder));
    }
    wrap.appendChild(list);
    return wrap;
  }

  function hasLiveOptions(range){
    if (!range || !Array.isArray(range.options)) return false;
    return range.options.some((option) => {
      const href = (option?.href || '').trim();
      return href.length > 0;
    });
  }

  function renderAccordionGroup(group = {}, index = 0, options = {}){
    const {
      sectionKey = '',
      headerLevel = 'h3',
      sectionClass = 'gear-subcard',
      headerClass = 'gear-card__header gear-subcard__header',
      bodyClass = 'gear-card__body gear-subcard__body',
      rangeClass = '',
      rangeOptions = {}
    } = options;

    const classList = new Set(String(sectionClass || '').split(/\s+/).filter(Boolean));
    classList.add('gear-card');
    const section = el('section',{ class: Array.from(classList).join(' ') });
    section.dataset.ignoreMatch = '1';
    if (group?.id) section.dataset.subgroupId = group.id;
    if (sectionKey) section.dataset.section = toDataSectionKey(sectionKey);

    const baseId = group?.id ? String(group.id) : `${sectionKey || 'group'}-${index}`;
    const safeId = baseId.replace(/[^a-z0-9-_]/gi, '-');
    const bodyId = `${safeId}-body`;

    const header = el('header',{
      class: headerClass || 'gear-card__header',
      'data-accordion':'toggle',
      tabindex:'0',
      'aria-controls': bodyId,
      'aria-expanded':'false'
    });
    const headingTag = String(headerLevel || 'h3').toLowerCase();
    header.appendChild(el(headingTag,{}, group?.label || 'Options'));
    header.appendChild(el('span',{class:'chevron','aria-hidden':'true'},'▸'));
    section.appendChild(header);

    const body = el('div',{ class: bodyClass || 'gear-card__body', id: bodyId, hidden:true });
    const renderOptions = {
      includeGearCard: false,
      ignoreMatch: true,
      showTitle: false,
      ...rangeOptions
    };
    const rangeBlock = renderRangeBlock(group, sectionKey, renderOptions);
    if (rangeClass && rangeBlock) rangeBlock.classList.add(rangeClass);
    body.appendChild(rangeBlock);
    section.appendChild(body);
    return section;
  }

  function buildCategory(kind, container){
    if (!container) return;
    container.innerHTML = '';
    let blocks = [];
    if (kind === 'heaters') blocks = (GEAR.heaters?.ranges || []).map((range) => renderRangeBlock(range, 'heaters'));
    else if (kind === 'filters') blocks = (GEAR.filters?.ranges || []).map((range) => renderRangeBlock(range, 'filters'));
    else if (kind === 'lights') blocks = (GEAR.lights?.ranges || []).map((range) => renderRangeBlock(range, 'lights'));
    else if (kind === 'substrate') {
      blocks = (GEAR.substrate?.groups || [])
        .filter((range) => hasLiveOptions(range))
        .map((range) => renderRangeBlock(range, 'substrate'));
    } else if (kind === 'water-treatments') {
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
      blocks = (GEAR.maintenanceTools?.accordions || []).map((group, index) =>
        renderAccordionGroup(group, index, {
          sectionKey: 'maintenanceTools',
          rangeClass: 'range--maintenance'
        })
      );
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
            rangeOptions: {
              includeGearCard: false,
              ignoreMatch: true,
              showTitle: false,
              headingTag: 'h4'
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
    const block = body.querySelector(`[data-range-id="${rangeId}"]`);
    if (!block) return false;
    block.classList.add('is-active');
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

  function openMatchingHeaterOnSelection(selectedGallons, matchingRangeId){
    const heaterPanel = document.querySelector('.gear-shell > .gear-card.accordion[data-section="heaters"]');
    const gallons = Number(selectedGallons);
    const hasValidSelection = Number.isFinite(gallons) && gallons > 0 && !!matchingRangeId;
    if (!heaterPanel) {
      if (!hasValidSelection) closeAllExcept();
      return;
    }
    if (!hasValidSelection) {
      setAccordionOpen(heaterPanel, false);
      closeAllExcept();
      return;
    }
    setAccordionOpen(heaterPanel, true);
    closeAllExcept('heaters');
  }

  function clearHighlights(){
    document.querySelectorAll('.range.is-active').forEach((node) => node.classList.remove('is-active'));
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
    ensurePanelHooks();
    buildCategory('heaters', document.getElementById('heaters-body'));
    buildCategory('filters', document.getElementById('filters-body'));
    buildCategory('lights', document.getElementById('lights-body'));
    buildCategory('substrate', document.getElementById('substrate-body'));
    buildCategory('water-treatments', document.getElementById('water-treatments-body'));
    buildCategory('food', document.getElementById('food-body'));
    buildCategory('maintenance-tools', document.getElementById('maintenance-tools-body'));
    buildCategory('stands', document.getElementById('stands-body'));
    wireAccordions();
    initTankSelect();
    console.log("[Gear] Heaters g-5-10 options:", (GEAR.heaters?.ranges||[]).find(r=>r.id==="g-5-10")?.options?.length || 0);
    console.log("[Gear] Added heaters 10–20 range:", (GEAR.heaters?.ranges||[]).find(r=>r.id==="g-10-20")?.options?.length || 0);
    console.log("[Gear] Heaters g-40-60 options:", (GEAR.heaters?.ranges||[]).find(r=>r.id==="g-40-60")?.options?.length || 0);
    console.log("[Gear] Heaters g-60-90 options:", (GEAR.heaters?.ranges||[]).find(r=>r.id==="g-60-90")?.options?.length || 0);
    console.log("[Gear] Heaters g-90-125 options:", (GEAR.heaters?.ranges||[]).find(r=>r.id==="g-90-125")?.options?.length || 0);
    console.log("[Gear] Heading language normalized to 'Recommended' for all categories.");
    console.log("[Gear] Filters g-5-10 options:", (GEAR.filters?.ranges||[]).find(r=>r.id==="g-5-10")?.options?.length || 0);
    console.log("[Gear] Filters g-10-20 options:", (GEAR.filters?.ranges||[]).find(r=>r.id==="g-10-20")?.options?.length || 0);
    console.log("[Gear] Lights l-12-20 options:", (GEAR.lights?.ranges||[]).find(r=>r.id==="l-12-20")?.options?.length || 0);
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
