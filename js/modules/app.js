/* js/modules/app.js
 * Small orchestrator: reads controls + table, updates bars,
 * asks Aggression + Warnings to render UI bubbles.
 */
(function(){
  // ---------- tiny utils ----------
  function $(id){ return document.getElementById(id); }
  function norm(s){ return (s||'').toString().trim(); }
  function safeInt(s, def){ const n = parseInt(s,10); return Number.isFinite(n) ? n : (def||0); }

  // ---------- read stock from table ----------
  function readStock(){
    const tbody = $('tbody');
    if(!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr')).map(tr=>{
      const tds = tr.querySelectorAll('td');
      const name = norm(tds[0]?.textContent||'');
      const qtyEl = tds[1]?.querySelector('input');
      const qty = safeInt(qtyEl && qtyEl.value, 0);
      return name ? { name, qty } : null;
    }).filter(Boolean);
  }

  // ---------- capacity + bioload (already handled elsewhere) ----------
  function renderBioload(){
    if (typeof window.totalBioUnits !== 'function' ||
        typeof window.capacityUnits !== 'function') return;

    const bar = $('bioBarFill'); if(!bar) return;
    const total = window.totalBioUnits();
    const cap   = window.capacityUnits();
    const pct   = Math.max(0, Math.min(160, (total / cap) * 100));
    bar.style.width = pct.toFixed(1) + '%';
  }

  // ---------- environment fit (temp/pH) — already implemented in your env module ----------
  function renderEnvFit(){
    // keep your existing environment-fit logic; this function just calls it if present
    if (window.EnvFit && typeof window.EnvFit.render === 'function'){
      const stock = readStock();
      const opts = {
        planted: !!$('planted')?.checked,
        gallons: parseFloat($('gallons')?.value || '0') || 0
      };
      window.EnvFit.render(stock, opts);
    }
  }

  // ---------- aggression bubbles ----------
  function renderAggression(){
    const stock = readStock();
    const opts = {
      planted: !!$('planted')?.checked,
      gallons: parseFloat($('gallons')?.value || '0') || 0
    };
    if (window.Warnings && typeof window.Warnings.render === 'function'){
      window.Warnings.render(stock, opts);
    } else if (window.Aggression && typeof window.Aggression.compute === 'function'){
      // Fallback: just set bar if bubbles module missing
      const res = window.Aggression.compute(stock, opts) || {score:0};
      const bar = $('aggBarFill'); if(bar) bar.style.width = Math.max(0, Math.min(100, res.score||0)) + '%';
    }
  }

  // ---------- main render ----------
  function renderAll(){
    renderBioload();
    renderAggression();
    renderEnvFit();
  }

  // ---------- events ----------
  window.addEventListener('load', function(){
    // controls → re-render
    ['gallons','planted','filtration','fishSearch','fishSelect','fQty'].forEach(id=>{
      const el = $(id); if(!el) return;
      el.addEventListener('input', renderAll);
      el.addEventListener('change', renderAll);
    });

    // delegate changes in the stock table (qty +/- buttons)
    const tbody = $('tbody');
    if (tbody){
      tbody.addEventListener('input', renderAll, true);
      tbody.addEventListener('change', renderAll, true);
      tbody.addEventListener('click', function(e){
        const t = e.target;
        if (t && (t.matches('button') || t.matches('input[type="number"]'))){
          // give DOM a tick to update values
          setTimeout(renderAll, 0);
        }
      }, true);
    }

    renderAll();
  });

  // Expose for other modules if needed
  window.__renderAll__ = renderAll;
})();