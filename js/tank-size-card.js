import { listTanks, getTankById } from './tankSizes.js';

(function initTankSizeCard(){
  const selectEl   = document.getElementById('tank-size-select');
  const factsEl    = document.getElementById('tank-facts');
  const beginnerEl = document.getElementById('toggle-beginner');

  if (!selectEl || !factsEl) return;

  const state = (window.appState = window.appState || {});
  const STORAGE_KEY = 'ttg.selectedTank';
  const round1 = (n) => Math.round(n*10)/10;

  // 1) Populate select from curated dataset (5–125g)
  function renderOptions(){
    const tanks = listTanks()
      .filter(t => typeof t.gallons==='number' && t.gallons>=5 && t.gallons<=125)
      .sort((a,b)=> (a.gallons-b.gallons) || a.label.localeCompare(b.label));

    // Clear non-placeholder options
    [...selectEl.querySelectorAll('option:not([disabled])')].forEach(o=>o.remove());
    for (const t of tanks){
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      selectEl.appendChild(opt);
    }
  }

  // 2) Facts line
  function setFacts(tank){
    if (!tank){ factsEl.textContent = ''; return; }
    const dimsIn = `${tank.dimensions_in.l} × ${tank.dimensions_in.w} × ${tank.dimensions_in.h} in`;
    const dimsCm = `${round1(tank.dimensions_cm.l)} × ${round1(tank.dimensions_cm.w)} × ${round1(tank.dimensions_cm.h)} cm`;
    factsEl.textContent = `${tank.gallons}g • ${round1(tank.liters)} L • ${dimsIn} (${dimsCm}) • ~${tank.filled_weight_lbs} lbs filled`;
  }

  // 3) Recompute hook
  function recompute(){
    if (typeof window.recomputeAll === 'function') window.recomputeAll();
    else window.dispatchEvent?.(new CustomEvent('ttg:recompute'));
  }

  // 4) Apply selection
  function applySelection(id){
    const t = id ? getTankById(id) : null;
    if (!t){
      selectEl.value = '';
      state.selectedTankId = null;
      state.gallons = undefined;
      state.liters  = undefined;
      setFacts(null);
      recompute();
      return;
    }
    state.selectedTankId = t.id;
    state.gallons = t.gallons;
    state.liters  = t.liters;
    selectEl.value = t.id;
    setFacts(t);
    try { localStorage.setItem(STORAGE_KEY, t.id); } catch(_){}
    recompute();
  }

  // 5) Events
  selectEl.addEventListener('change', (e)=>applySelection(e.target.value));

  // 6) Init
  renderOptions();

  // Beginner Mode defaults OFF
  if (beginnerEl) beginnerEl.checked = false;

  // Hydrate persisted tank choice
  let savedId = null;
  try { savedId = localStorage.getItem(STORAGE_KEY) || null; } catch(_){ }
  if (savedId && getTankById(savedId)) applySelection(savedId);
  else setFacts(null);
})();

(function initBeginnerInfoPopover(){
  const card   = document.querySelector('.tank-size-card');
  const btn    = document.getElementById('bm-info-button');
  const pop    = document.getElementById('bm-info-popover');
  const close  = document.getElementById('bm-info-close');
  if (!card || !btn || !pop) return;

  const open = () => {
    // Position popover just below/right of the button
    const br = btn.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    pop.style.top  = `${br.bottom + scrollY + 8}px`;
    pop.style.left = `${Math.min(br.left + scrollX, window.innerWidth - pop.offsetWidth - 16)}px`;

    pop.hidden = false;
    requestAnimationFrame(() => pop.classList.add('is-open'));
    btn.setAttribute('aria-expanded', 'true');

    // Basic outside-click handler
    document.addEventListener('mousedown', onDocClick, { capture: true });
    document.addEventListener('touchstart', onDocClick, { capture: true });
    document.addEventListener('keydown', onEsc, { capture: true });
    // Move focus to the close button for accessibility
    close?.focus?.();
  };

  const closeIt = () => {
    pop.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    // Delay hiding to allow transition (if any)
    setTimeout(() => { pop.hidden = true; }, 140);
    document.removeEventListener('mousedown', onDocClick, { capture: true });
    document.removeEventListener('touchstart', onDocClick, { capture: true });
    document.removeEventListener('keydown', onEsc, { capture: true });
    btn.focus();
  };

  const toggle = () => (pop.hidden ? open() : closeIt());

  const onDocClick = (e) => {
    // Close if clicking outside the popover and button
    if (!pop.contains(e.target) && e.target !== btn) closeIt();
  };

  const onEsc = (e) => {
    if (e.key === 'Escape') closeIt();
  };

  // Wire events
  btn.addEventListener('click', toggle);
  close?.addEventListener?.('click', closeIt);

  // Reposition on resize/scroll while open
  const onReposition = () => {
    if (pop.hidden) return;
    const br = btn.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    pop.style.top  = `${br.bottom + scrollY + 8}px`;
    pop.style.left = `${Math.min(br.left + scrollX, window.innerWidth - pop.offsetWidth - 16)}px`;
  };
  window.addEventListener('resize', onReposition, { passive: true });
  window.addEventListener('scroll', onReposition, { passive: true });
})();

(function wirePlantedOverlay(){
  const page = document.getElementById('stocking-page');
  const planted = document.getElementById('toggle-planted');
  if (!page || !planted) return;

  const apply = () => {
    page.classList.toggle('is-planted', !!planted.checked);
  };

  apply();

  planted.addEventListener('change', apply, { passive: true });
})();
