// js/modules/envfit.js
// Environment Fit (Temp & pH overlap) — starts at 0% and builds up only when species truly overlap.

(function(){
  /* ===== small helpers ===== */
  const norm = s => (s||'').toString().trim().toLowerCase();
  const canon = s => norm(s).replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\s*\([^)]*\)\s*/g,' ').trim();

  function readStock(){
    const rows = document.querySelectorAll('#tbody tr');
    const out = [];
    rows.forEach(tr=>{
      const tds = tr.querySelectorAll('td');
      const name = (tds[0]?.textContent || '').trim();
      const qtyEl = tds[1]?.querySelector('input');
      const raw = qtyEl?.value ?? '';
      const n = parseInt(String(raw).replace(/[^\d]/g,''),10);
      const qty = Number.isFinite(n) && n>0 ? Math.min(999, n) : 0;
      if (name && qty>0) out.push({ name, qty });
    });
    return out;
  }

  function findSpeciesRow(name){
    const key = canon(name);
    const src = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
    if (!src) return null;

    if (Array.isArray(src)){
      for (let i=0;i<src.length;i++){
        const row = src[i] || {};
        const n = canon(row.name || row.species || row.common || row.id || '');
        if (n === key) return row;
      }
    } else if (typeof src === 'object'){
      const direct = src[name] || src[key];
      if (direct) return direct;
    }
    return null;
  }

  function len(range){
    if (!Array.isArray(range) || range.length<2) return 0;
    const a = Number(range[0]), b = Number(range[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.max(0, b - a);
  }

  function intersect(a,b){
    if (!a || !b) return null;
    const lo = Math.max(a[0], b[0]);
    const hi = Math.min(a[1], b[1]);
    return (hi >= lo) ? [lo, hi] : null;
  }

  // overlap% = intersection length divided by the *smallest* individual range
  function overlapPercent(ranges){
    const valid = ranges.filter(r=>Array.isArray(r) && r.length===2 && Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[1] >= r[0]);
    if (valid.length < 2) return 0;

    // intersection across all
    let inter = valid[0];
    for (let i=1;i<valid.length;i++){
      inter = intersect(inter, valid[i]);
      if (!inter) return 0;
    }

    const interLen = len(inter);
    if (interLen <= 0) return 0;

    // smallest member range (stricter, “real” compatibility)
    const minSpan = Math.max(1e-6, Math.min(...valid.map(len)));
    return Math.max(0, Math.min(1, interLen / minSpan));
  }

  function renderEnvFit(){
    const bar = document.getElementById('envBarFill');
    if (!bar) return;

    const stock = readStock();
    // With < 2 species, start at 0% (no compatibility to evaluate)
    if (stock.length < 2){
      bar.style.width = '0%';
      return;
    }

    // Gather ranges
    const temps = [];
    const phs   = [];
    stock.forEach(item=>{
      const row = findSpeciesRow(item.name);
      if (row?.temp && Array.isArray(row.temp) && row.temp.length===2) temps.push([Number(row.temp[0]), Number(row.temp[1])]);
      if (row?.ph   && Array.isArray(row.ph)   && row.ph.length===2)   phs.push([Number(row.ph[0]), Number(row.ph[1])]);
    });

    // If either dimension is totally missing for all fish, treat that dimension as 0 contribution (i.e., don’t falsely inflate)
    const tempPct = temps.length >= 2 ? overlapPercent(temps) : 0;
    const phPct   = phs.length   >= 2 ? overlapPercent(phs)   : 0;

    // Average the two dimensions (equal weight)
    const overall = (tempPct + phPct) / 2;

    // Build up from 0 → 100
    const pct = Math.round(overall * 100);
    bar.style.width = pct + '%';
    // micro pulse like other bars
    bar.classList.remove('pulse'); // re-trigger
    // eslint-disable-next-line no-unused-expressions
    bar.offsetHeight;
    bar.classList.add('pulse');
  }

  // expose (optional)
  window.EnvFit = { render: renderEnvFit };

  // Auto-wire without touching app.js
  function setup(){
    // Initial render
    renderEnvFit();

    // Re-render on tank control changes
    ['gallons','planted','filtration'].forEach(id=>{
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', renderEnvFit);
      el.addEventListener('change', renderEnvFit);
    });

    // Watch stock table for any changes
    const tbody = document.getElementById('tbody');
    if (tbody){
      const obs = new MutationObserver(renderEnvFit);
      obs.observe(tbody, { childList:true, subtree:true, attributes:true, characterData:true });
      // also listen to qty inputs directly (for Safari)
      tbody.addEventListener('input', renderEnvFit);
      tbody.addEventListener('change', renderEnvFit);
      // clicks on +/-/Delete
      tbody.addEventListener('click', function(e){
        const t = e.target;
        if (t && (t.tagName==='BUTTON' || t.closest('button'))) {
          setTimeout(renderEnvFit, 0);
        }
      });
    }
  }

  window.addEventListener('load', setup);
})();