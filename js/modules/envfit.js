// js/modules/envfit.js
// Dynamic color + build-up behavior for Environment Fit bar (Temp & pH overlap)

(function(){
  /* ---------- tiny helpers (local, no imports needed) ---------- */
  const $ = (sel) => document.querySelector(sel);

  function norm(s){ return (s||'').toString().trim().toLowerCase(); }
  function canonName(s){
    return norm(s).replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\s*\([^)]*\)\s*/g,' ').trim();
  }

  function lookupDataFor(name){
    const key = canonName(name);
    const src = (window.FISH_DATA||[]);
    for (let i=0;i<src.length;i++){
      const row = src[i] || {};
      const n = canonName(row.name || row.species || row.common || row.id || '');
      if(n === key) return row;
    }
    return null;
  }

  function readStock(){
    const tbody = $('#tbody');
    if(!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr')).map(tr=>{
      const name = (tr.querySelector('td:first-child')?.textContent||'').trim();
      const qtyEl = tr.querySelector('td:nth-child(2) input');
      const qty = Math.max(0, parseInt(qtyEl && qtyEl.value ? qtyEl.value : '0', 10) || 0);
      return name ? { name, qty } : null;
    }).filter(Boolean).filter(x=>x.qty>0);
  }

  /* ---------- range math ---------- */
  const touchBonus = 0.15;   // slight credit for just-touching ranges
  const tempWeight = 0.70;   // temp importance
  const phWeight   = 0.30;   // pH importance

  function overlapFrac(a, b){
    // a,b are [min, max]; returns 0..1 fraction of overlap vs union
    if(!a || !b || a.length!==2 || b.length!==2) return 0;
    const minA = Math.min(a[0], a[1]);
    const maxA = Math.max(a[0], a[1]);
    const minB = Math.min(b[0], b[1]);
    const maxB = Math.max(b[0], b[1]);
    const union = Math.max(maxA, maxB) - Math.min(minA, minB);
    if (union <= 0) return 0;
    const start = Math.max(minA, minB);
    const end   = Math.min(maxA, maxB);
    const inter = Math.max(0, end - start);
    if (inter > 0) return inter / union;
    // Just-touching edge?
    if (end === start) return touchBonus; // tiny credit
    return 0;
  }

  function uniqSpecies(items){
    // collapse by canonical name; add up qty
    const map = new Map();
    for (const it of items){
      const k = canonName(it.name);
      map.set(k, { name: it.name, qty: (map.get(k)?.qty || 0) + (it.qty||0) });
    }
    return Array.from(map.values());
  }

  function pairwiseScore(aName, bName){
    const a = lookupDataFor(aName);
    const b = lookupDataFor(bName);
    if(!a || !b) return 0;

    const tA = Array.isArray(a.temp) ? a.temp : null;
    const tB = Array.isArray(b.temp) ? b.temp : null;
    const pA = Array.isArray(a.ph)   ? a.ph   : null;
    const pB = Array.isArray(b.ph)   ? b.ph   : null;

    const tf = overlapFrac(tA, tB); // 0..1
    const pf = overlapFrac(pA, pB); // 0..1

    // weighted 0..1
    return (tf * tempWeight) + (pf * phWeight);
  }

  function envFitPercent(stock){
    const items = uniqSpecies(stock);
    if(items.length < 2) return 0; // start empty until 2+ species

    // compute weighted average of pair scores (weight by min(qtyA, qtyB))
    let wsum = 0;
    let ssum = 0;
    for(let i=0;i<items.length;i++){
      for(let j=i+1;j<items.length;j++){
        const w = Math.max(1, Math.min(items[i].qty||1, items[j].qty||1));
        const s = pairwiseScore(items[i].name, items[j].name); // 0..1
        wsum += w;
        ssum += s * w;
      }
    }
    if(wsum === 0) return 0;

    // convert "compatibility" (higher is better) into a bar that fills with *risk*.
    // We want 0% when perfect fit, 100% when poor fit.
    const compat = ssum / wsum;       // 0..1 (1 = great overlap)
    const risk   = 1 - compat;        // 0..1
    return Math.max(0, Math.min(100, risk * 100));
  }

  /* ---------- render ---------- */
  function setBar(fillEl, pct){
    if(!fillEl) return;
    // width
    fillEl.style.width = pct.toFixed(1) + '%';

    // color: green (good) when pct small risk, orange mid, red high
    // thresholds tuned for UX
    let bg;
    if (pct < 35) {
      bg = 'linear-gradient(90deg,#10b981,#10b981)'; // green
    } else if (pct < 70) {
      bg = 'linear-gradient(90deg,#f59e0b,#f59e0b)'; // orange
    } else {
      bg = 'linear-gradient(90deg,#ef4444,#ef4444)'; // red
    }
    fillEl.style.background = bg;

    // micro pulse
    fillEl.classList.remove('pulse');
    // force reflow to retrigger
    void fillEl.offsetWidth;
    fillEl.classList.add('pulse');
  }

  function render(){
    const stock = readStock();
    const pct   = envFitPercent(stock); // 0..100
    const bar   = $('#envBarFill');
    setBar(bar, pct);
  }

  /* ---------- wire up ---------- */
  function boot(){
    // initial
    render();

    // Changes coming from quantity edits / plus-minus / delete:
    const tbody = $('#tbody');
    if(tbody){
      tbody.addEventListener('input', render);
      tbody.addEventListener('change', render);
      // observe row inserts/removals
      const mo = new MutationObserver(render);
      mo.observe(tbody, { childList:true, subtree:true });
    }

    // If other modules change environment or stock indirectly, re-run on common events
    ['gallons','planted','filtration'].forEach(id=>{
      const el = document.getElementById(id);
      if(el){ el.addEventListener('change', render); el.addEventListener('input', render); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();