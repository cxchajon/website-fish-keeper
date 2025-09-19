// js/modules/warnings.js
// Renders: Aggression bar + grouped, color-coded warning bubbles

/* ===== helpers (local, self-contained) ===== */
function toArray(x){ return Array.isArray(x)?x:(x?[x]:[]); }
function readStockFromDOM(){
  const rows = document.querySelectorAll('#tbody tr');
  const out = [];
  rows.forEach(tr=>{
    const tds = tr.querySelectorAll('td');
    const name = (tds[0]?.textContent || '').trim();
    const qtyEl = tds[1]?.querySelector('input');
    const raw = qtyEl?.value ?? '';
    const n = parseInt(String(raw).replace(/[^\d]/g,''),10);
    const qty = Number.isFinite(n) && n>0 ? Math.min(999, n) : 0;
    if (name && qty>0) out.push({name, qty});
  });
  return out;
}
function classForType(t){
  switch((t||'').toLowerCase()){
    case 'severe':   return 'warning-severe';
    case 'moderate': return 'warning-moderate';
    case 'mild':     return 'warning-mild';
    default:         return 'warning-info';
  }
}

/* ===== main render ===== */
export function renderWarnings(){
  const box = document.getElementById('aggression-warnings') || document.getElementById('warnings');
  if (!box) return;
  box.innerHTML = '';

  const stock = readStockFromDOM();
  const gallons = parseFloat(document.getElementById('gallons')?.value || '0') || 0;
  const planted = !!document.getElementById('planted')?.checked;

  // Ask the engine to score conflicts
  let res = { warnings: [], score: 0 };
  if (window.Aggression && typeof window.Aggression.compute === 'function'){
    try { res = window.Aggression.compute(stock, { gallons, planted }); } catch(e){ /* noop */ }
  }

  // Group warnings by category (and keep deterministic order)
  const groups = Object.create(null);
  toArray(res.warnings).forEach(w=>{
    const cat = (w.category || 'other').toLowerCase();
    (groups[cat] ||= []).push(w);
  });

  const order = ['fin-nipping','tank-size','territorial','other'];
  order.forEach(cat=>{
    const arr = groups[cat];
    if (!arr || !arr.length) return;

    // Section container
    const sec = document.createElement('div');
    sec.className = 'warning-section';

    // Section title
    const title = document.createElement('div');
    title.className = 'warning-title';
    title.textContent =
      cat === 'fin-nipping' ? 'Fin-nipping issues' :
      cat === 'tank-size'   ? 'Tank size issues'   :
      cat === 'territorial' ? 'Territorial / semi-aggressive issues' :
                               'Other considerations';
    sec.appendChild(title);

    // Bubbles row
    const wrap = document.createElement('div');
    wrap.className = 'warning-bubbles';

    arr.forEach(w=>{
      const b = document.createElement('div');
      b.className = 'warning-bubble ' + classForType(w.type);
      // allow simple **bold** markdown in texts coming from the engine
      const html = String(w.text || '')
        .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
      b.innerHTML = html;
      wrap.appendChild(b);
    });

    sec.appendChild(wrap);
    box.appendChild(sec);
  });

  // Drive the aggression bar (visual only)
  const bar = document.getElementById('aggBarFill');
  if (bar && typeof res.score === 'number'){
    const pct = Math.max(0, Math.min(100, res.score));
    bar.style.width = pct + '%';
    bar.classList.remove('pulse'); // re-trigger micro animation
    // force reflow to restart animation
    // eslint-disable-next-line no-unused-expressions
    bar.offsetHeight; 
    bar.classList.add('pulse');
  }
}