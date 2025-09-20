/* js/modules/warnings.js
 * Renders grouped, color-coded warning “bubbles” inside the
 * Aggression & Compatibility card, using window.Aggression.compute(stock, opts).
 *
 * Exposes: window.Warnings.render(stock, opts)
 */
(function(){
  const CLASS_BY_SEVERITY = {
    mild:     'warning-bubble warning-mild',
    moderate: 'warning-bubble warning-moderate',
    severe:   'warning-bubble warning-severe',
    info:     'warning-bubble warning-info'
  };

  const LABEL_BY_GROUP = {
    fin:       'Fin-Nipping & Long-Fin Risks',
    betta:     'Betta Conflicts',
    territory: 'Territory & Space',
    general:   'General Compatibility'
  };

  function byGroup(warnings){
    const map = new Map();
    warnings.forEach(w=>{
      const key = (w.type || 'general');
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(w);
    });
    return map;
  }

  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function bubble(text, severity){
    const span = document.createElement('span');
    span.className = CLASS_BY_SEVERITY[severity] || CLASS_BY_SEVERITY.mild;
    span.textContent = text;
    return span;
  }

  function section(title){
    const wrap = document.createElement('div');
    wrap.className = 'warning-section';

    const h = document.createElement('div');
    h.className = 'warning-title';
    h.textContent = title;

    const row = document.createElement('div');
    row.className = 'warning-bubbles';

    wrap.appendChild(h);
    wrap.appendChild(row);
    return {wrap, row};
  }

  /** Public: render into #aggression-warnings */
  function render(stock, opts){
    const box = document.getElementById('aggression-warnings');
    if(!box) return;

    // run the aggression engine
    let result = {warnings:[], score:0};
    try{
      if (window.Aggression && typeof window.Aggression.compute === 'function'){
        result = window.Aggression.compute(stock, opts) || result;
      }
    }catch(e){ /* fail-soft */ }

    // update the aggression bar (0–100)
    const bar = document.getElementById('aggBarFill');
    if (bar) bar.style.width = Math.max(0, Math.min(100, result.score || 0)) + '%';

    // paint bubbles
    clear(box);

    if(!result.warnings || !result.warnings.length){
      // Optional: gentle “no issues” state
      const ok = document.createElement('div');
      ok.className = 'warning-bubbles';
      const chip = document.createElement('span');
      chip.className = 'warning-bubble warning-info';
      chip.textContent = 'No notable aggression issues detected for this mix.';
      ok.appendChild(chip);
      box.appendChild(ok);
      return;
    }

    const grouped = byGroup(result.warnings);
    for (const [key, list] of grouped.entries()){
      const title = LABEL_BY_GROUP[key] || 'Compatibility';
      const {wrap, row} = section(title);

      list.forEach(w=>{
        row.appendChild(bubble(w.text, w.severity));
      });

      box.appendChild(wrap);
    }
  }

  window.Warnings = { render };
})();