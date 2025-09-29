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
  const infoBtn  = document.getElementById('bm-info-button');
  const pop      = document.getElementById('bm-info-popover');
  const closeBtn = document.getElementById('bm-info-close');
  if (!infoBtn || !pop) return;

  let portal = document.getElementById('ui-portal');
  if (!portal){
    portal = document.createElement('div');
    portal.id = 'ui-portal';
    portal.style.position = 'static';
    portal.style.isolation = 'auto';
    document.body.appendChild(portal);
  }

  const originalParent = pop.parentElement;
  const originalNextSibling = pop.nextSibling;

  function getOffsets(){
    const vv = window.visualViewport;
    return {
      x: vv && 'pageLeft' in vv ? vv.pageLeft : (window.pageXOffset || document.documentElement.scrollLeft || 0),
      y: vv && 'pageTop' in vv ? vv.pageTop : (window.pageYOffset || document.documentElement.scrollTop || 0),
    };
  }

  function placePopover(){
    const wasHidden = pop.hidden;
    const prevVisibility = pop.style.visibility;
    if (wasHidden){
      pop.hidden = false;
      pop.style.visibility = 'hidden';
    } else {
      pop.style.visibility = 'hidden';
    }

    const rect = infoBtn.getBoundingClientRect();
    const gap = 8;
    const pw = pop.offsetWidth || 280;
    const ph = pop.offsetHeight || 140;
    const { x: sx, y: sy } = getOffsets();

    let left = Math.round(rect.left + (rect.width / 2) + sx - (pw / 2));
    let top = Math.round(rect.bottom + sy + gap);

    left = Math.min(Math.max(8 + sx, left), (window.innerWidth - pw - 8) + sx);
    top = Math.min(Math.max(8 + sy, top), (window.innerHeight - ph - 8) + sy);

    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    pop.style.visibility = prevVisibility || '';
    if (wasHidden) pop.hidden = true;
  }

  function openPopover(){
    if (!pop.hidden) return;

    if (pop.parentElement !== portal) portal.appendChild(pop);

    placePopover();
    pop.hidden = false;
    requestAnimationFrame(() => {
      pop.classList.add('is-open');
      closeBtn?.focus?.();
    });

    infoBtn.setAttribute('aria-expanded', 'true');

    document.addEventListener('mousedown', onDoc, { capture: true });
    document.addEventListener('touchstart', onDoc, { capture: true });
    document.addEventListener('keydown', onEsc, { capture: true });

    window.addEventListener('scroll', onReflow, { passive: true });
    window.addEventListener('resize', onReflow, { passive: true });
    window.visualViewport?.addEventListener?.('scroll', onReflow, { passive: true });
    window.visualViewport?.addEventListener?.('resize', onReflow, { passive: true });
  }

  function closePopover(){
    if (pop.hidden) return;

    pop.classList.remove('is-open');
    infoBtn.setAttribute('aria-expanded', 'false');

    document.removeEventListener('mousedown', onDoc, { capture: true });
    document.removeEventListener('touchstart', onDoc, { capture: true });
    document.removeEventListener('keydown', onEsc, { capture: true });

    window.removeEventListener('scroll', onReflow);
    window.removeEventListener('resize', onReflow);
    window.visualViewport?.removeEventListener?.('scroll', onReflow);
    window.visualViewport?.removeEventListener?.('resize', onReflow);

    setTimeout(() => {
      pop.hidden = true;
      if (originalParent){
        if (originalNextSibling && originalNextSibling.parentNode === originalParent){
          originalParent.insertBefore(pop, originalNextSibling);
        } else {
          originalParent.appendChild(pop);
        }
      }
    }, 140);

    infoBtn.focus();
  }

  function togglePopover(){ pop.hidden ? openPopover() : closePopover(); }

  function onDoc(e){
    if (!pop.contains(e.target) && e.target !== infoBtn) closePopover();
  }

  function onEsc(e){
    if (e.key === 'Escape') closePopover();
  }

  function onReflow(){
    if (!pop.hidden) placePopover();
  }

  infoBtn.addEventListener('click', (event) => {
    event.preventDefault();
    togglePopover();
  });

  closeBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    closePopover();
  });
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
