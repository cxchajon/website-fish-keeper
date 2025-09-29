import { listTanks, getTankById } from './tankSizes.js';

(function wireTankSizeChevron(){
  const wrap = document.getElementById('tank-size-select-wrap');
  const sel  = document.getElementById('tank-size-select');
  if (!wrap || !sel) return;

  // On desktop browsers, focus/blur is enough. On iOS, change is the reliable signal.
  const setOpen = (on) => wrap.classList.toggle('open', !!on);

  sel.addEventListener('focus', () => setOpen(true));
  sel.addEventListener('blur',  () => setOpen(false));

  // iOS Safari sometimes doesn't fire focus the same way when picker opens; use click/change as hints.
  sel.addEventListener('click',  () => setOpen(true));
  sel.addEventListener('change', () => setOpen(false));

  // Safety: if the element becomes disabled/enabled or page hides, ensure state resets
  document.addEventListener('visibilitychange', () => { if (document.hidden) setOpen(false); });
})();

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

(function beginnerInfoInit(){
  try{
    const btn   = document.getElementById('bm-info-button');
    const pop   = document.getElementById('bm-info-popover');
    const close = document.getElementById('bm-info-close');
    const label = document.querySelector('.tank-size-card .toggle-title[for="toggle-beginner"]');

    if(!btn || !pop || !label){
      console.error('[BeginnerInfo] Missing element(s):', { btn:!!btn, pop:!!pop, label:!!label });
      return;
    }

    // Create portal once (top of body, no new stacking context)
    let portal = document.getElementById('ui-portal');
    if(!portal){
      portal = document.createElement('div');
      portal.id = 'ui-portal';
      portal.style.position = 'static';
      portal.style.isolation = 'auto';
      document.body.appendChild(portal);
    }

    const getOffsets = () => {
      const vv = window.visualViewport;
      return {
        x: vv && 'pageLeft' in vv ? vv.pageLeft : (window.pageXOffset || document.documentElement.scrollLeft || 0),
        y: vv && 'pageTop'  in vv ? vv.pageTop  : (window.pageYOffset || document.documentElement.scrollTop  || 0),
      };
    };

    function place(){
      // Reveal to measure natural size
      const wasHidden = pop.hidden;
      pop.hidden = false;
      const oldVis = pop.style.visibility;
      pop.style.visibility = 'hidden';

      const r  = label.getBoundingClientRect();
      const pw = pop.offsetWidth || 280;
      const ph = pop.offsetHeight || 140;
      const gap = 8;
      const { x:sx, y:sy } = getOffsets();

      let left = Math.round(r.left + sx);
      let top  = Math.round(r.bottom + sy + gap);

      left = Math.min(Math.max(8 + sx, left), (window.innerWidth - pw - 8) + sx);
      top  = Math.min(Math.max(8 + sy, top),  (window.innerHeight - ph - 8) + sy);

      pop.style.left = `${left}px`;
      pop.style.top  = `${top}px`;

      pop.style.visibility = oldVis;
      pop.hidden = wasHidden;
    }

    function open(){
      // Move into portal (escapes any card stacking contexts)
      if(pop.parentElement !== portal) portal.appendChild(pop);

      // Position & show
      place();
      pop.hidden = false;
      requestAnimationFrame(()=> pop.classList.add('is-open'));
      btn.setAttribute('aria-expanded','true');

      // TEMP debug outline (auto remove) so we can SEE it for sure
      const oldOutline = pop.style.outline;
      pop.style.outline = '2px solid red';
      setTimeout(()=>{ pop.style.outline = oldOutline; }, 1000);

      // listeners
      document.addEventListener('mousedown', onDoc, { capture:true });
      document.addEventListener('touchstart', onDoc, { capture:true });
      document.addEventListener('keydown', onEsc, { capture:true });

      window.addEventListener('scroll', onReflow, { passive:true });
      window.addEventListener('resize', onReflow, { passive:true });
      window.visualViewport?.addEventListener?.('scroll', onReflow, { passive:true });
      window.visualViewport?.addEventListener?.('resize', onReflow, { passive:true });
    }

    function closePop(){
      pop.classList.remove('is-open');
      btn.setAttribute('aria-expanded','false');
      setTimeout(()=>{ pop.hidden = true; }, 140);

      document.removeEventListener('mousedown', onDoc, { capture:true });
      document.removeEventListener('touchstart', onDoc, { capture:true });
      document.removeEventListener('keydown', onEsc, { capture:true });

      window.removeEventListener('scroll', onReflow);
      window.removeEventListener('resize', onReflow);
      window.visualViewport?.removeEventListener?.('scroll', onReflow);
      window.visualViewport?.removeEventListener?.('resize', onReflow);
    }

    function toggle(){ pop.hidden ? open() : closePop(); }
    function onDoc(e){ if(!pop.contains(e.target) && e.target !== btn) closePop(); }
    function onEsc(e){ if(e.key === 'Escape') closePop(); }
    function onReflow(){ if(!pop.hidden) place(); }

    // Bind (idempotent)
    btn.addEventListener('click', (e)=>{ e.preventDefault(); toggle(); });
    close?.addEventListener('click', closePop);

    // Final visibility sanity checks (log if something still hides it)
    const cs = getComputedStyle(pop);
    if(cs.display === 'none') console.warn('[BeginnerInfo] CSS sets display:none; [hidden] toggling will override with !important.');
    if(cs.opacity === '0') console.warn('[BeginnerInfo] CSS opacity is 0 until .is-open is applied (expected).');
    if(parseInt(cs.zIndex || '0',10) < 9999) console.warn('[BeginnerInfo] z-index looks low; ensured via CSS to 2147483647.');
  } catch(err){
    console.error('[BeginnerInfo] Init failed:', err);
  }
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
