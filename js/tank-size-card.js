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
  const btn   = document.getElementById('bm-info-button');
  const pop   = document.getElementById('bm-info-popover');
  const close = document.getElementById('bm-info-close');
  if (!btn || !pop) return;

  function placePopover(){
    // Viewport-relative positioning for fixed element
    const br = btn.getBoundingClientRect();
    const gap = 8;
    let left = Math.max(8, Math.min(br.left, window.innerWidth - 8 - pop.offsetWidth));
    let top  = Math.max(8, Math.min(br.bottom + gap, window.innerHeight - 8 - pop.offsetHeight));
    pop.style.left = `${left}px`;
    pop.style.top  = `${top}px`;
  }

  function openPop(){
    if (!pop.hidden) return;
    pop.hidden = false;
    placePopover();
    requestAnimationFrame(() => pop.classList.add('is-open'));
    btn.setAttribute('aria-expanded','true');
    document.addEventListener('mousedown', onDoc, { capture:true });
    document.addEventListener('touchstart', onDoc, { capture:true });
    document.addEventListener('keydown', onEsc, { capture:true });
    close?.focus?.();
  }

  function closePop(){
    if (pop.hidden) return;
    pop.classList.remove('is-open');
    btn.setAttribute('aria-expanded','false');
    setTimeout(() => { pop.hidden = true; }, 140);
    document.removeEventListener('mousedown', onDoc, { capture:true });
    document.removeEventListener('touchstart', onDoc, { capture:true });
    document.removeEventListener('keydown', onEsc, { capture:true });
    btn.focus();
  }

  function toggle(){ pop.hidden ? openPop() : closePop(); }
  function onDoc(e){ if (!pop.contains(e.target) && e.target !== btn) closePop(); }
  function onEsc(e){ if (e.key === 'Escape') closePop(); }
  function onReflow(){ if (!pop.hidden){ placePopover(); } }

  btn.addEventListener('click', toggle);
  close?.addEventListener('click', closePop);
  window.addEventListener('resize', onReflow, { passive:true });
  window.addEventListener('scroll', onReflow, { passive:true });
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
