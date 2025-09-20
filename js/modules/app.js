/* FishkeepingLifeCo — App module (hardening)
 * - Respect user Quantity (Safari-safe)
 * - Kill legacy listeners (clone buttons)
 * - Pretty names in Current Stock
 * - Bars: Bioload (delegated), Aggression (delegated), Env Fit (here)
 */

import { safeQty, canonName, formatName } from './utils.js';

/* ---------------- utils for species lookup ---------------- */
function speciesMap() {
  const map = new Map();
  (window.FISH_DATA || []).forEach(r => {
    const key = canonName(r.name || r.species || r.common || r.id || '');
    if (key) map.set(key, r);
  });
  return map;
}
function rangesFor(key, map) {
  const row = map.get(key);
  if (!row) return null;
  return {
    temp: Array.isArray(row.temp) ? row.temp : null,
    ph:   Array.isArray(row.ph)   ? row.ph   : null,
  };
}

/* ---------------- Current Stock table ---------------- */
function rowByCanon(nameCanon){
  const rows = document.querySelectorAll('#tbody tr');
  for (const tr of rows){
    const txt = (tr.querySelector('td')?.textContent || '').trim();
    if (canonName(txt) === nameCanon) return tr;
  }
  return null;
}

function addOrUpdateRowUI(displayName, qtyDelta){
  const tbody = document.getElementById('tbody'); if (!tbody) return;
  const key = canonName(displayName);

  const exist = rowByCanon(key);
  if (exist){
    const inp = exist.querySelector('td:nth-child(2) input');
    const next = Math.max(0, safeQty(inp?.value ?? 0) + safeQty(qtyDelta));
    if (next === 0) exist.remove(); else inp.value = String(next);
    renderAll();
    return;
  }

  if (safeQty(qtyDelta) <= 0) return;

  const tr = document.createElement('tr');

  const tdName = document.createElement('td');
  tdName.textContent = formatName(displayName);

  const tdQty = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'number'; input.min = '0'; input.step = '1'; input.inputMode = 'numeric';
  input.style.width = '64px';
  input.value = String(safeQty(qtyDelta));
  input.addEventListener('input', renderAll);
  input.addEventListener('change', renderAll);
  tdQty.appendChild(input);

  const tdAct = document.createElement('td'); tdAct.style.textAlign = 'right';
  const bMinus = document.createElement('button'); bMinus.textContent='−'; bMinus.className='btn'; bMinus.style.marginRight='6px'; bMinus.type='button';
  const bPlus  = document.createElement('button'); bPlus.textContent = '+'; bPlus.className='btn'; bPlus.style.marginRight='6px'; bPlus.type='button';
  const bDel   = document.createElement('button'); bDel.textContent  = 'Delete'; bDel.className='btn'; bDel.style.background='var(--bad)'; bDel.type='button';

  bMinus.addEventListener('click', () => {
    const curr = safeQty(input.value);
    const next = Math.max(0, curr - 1);
    input.value = String(next);
    if (next === 0) tr.remove();
    renderAll();
  });
  bPlus.addEventListener('click', () => { input.value = String(safeQty(input.value) + 1); renderAll(); });
  bDel.addEventListener('click', () => { tr.remove(); renderAll(); });

  tdAct.appendChild(bMinus); tdAct.appendChild(bPlus); tdAct.appendChild(bDel);
  tr.appendChild(tdName); tr.appendChild(tdQty); tr.appendChild(tdAct);
  tr.classList.add('row-appear');
  tbody.appendChild(tr);
  renderAll();
}

function readStockUI(){
  const tbody = document.getElementById('tbody');
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll('tr')).map(tr => {
    const name = (tr.querySelector('td')?.textContent || '').trim();
    const qty  = safeQty(tr.querySelector('td:nth-child(2) input')?.value ?? 0);
    return name ? { name, qty } : null;
  }).filter(Boolean);
}

/* ---------------- Bars: Bioload & Aggression ---------------- */
function renderBioloadBar(){
  if (typeof window.renderBioload === 'function') { window.renderBioload(); }
}
function renderAggressionAndWarnings(){
  const bar = document.getElementById('aggBarFill');
  const box = document.getElementById('aggression-warnings');
  if (!bar || !box) return;
  box.innerHTML = '';

  let score = 0, warnings = [];
  if (window.Aggression?.compute){
    try{
      const opts = {
        planted: !!document.getElementById('planted')?.checked,
        gallons: Number(document.getElementById('gallons')?.value || 0) || 0
      };
      const res = window.Aggression.compute(readStockUI(), opts) || {};
      score = Number(res.score || 0);
      warnings = Array.isArray(res.warnings) ? res.warnings : [];
    }catch{}
  }
  bar.style.width = Math.max(0, Math.min(100, score)).toFixed(1) + '%';
  warnings.forEach(w => { const d=document.createElement('div'); d.textContent=w; box.appendChild(d); });
}

/* ---------------- Environment Fit (Temp & pH) ---------------- */
function pairOverlap(a, b){
  const parts = [];
  if (a.temp && b.temp){
    const [aL,aH] = a.temp, [bL,bH] = b.temp;
    const ov = Math.max(0, Math.min(aH,bH) - Math.max(aL,bL));
    const denom = Math.max(0.01, Math.min(aH-aL, bH-bL));
    parts.push(Math.max(0, Math.min(1, ov/denom)));
  }
  if (a.ph && b.ph){
    const [aL,aH] = a.ph, [bL,bH] = b.ph;
    const ov = Math.max(0, Math.min(aH,bH) - Math.max(aL,bL));
    const denom = Math.max(0.01, Math.min(aH-aL, bH-bL));
    parts.push(Math.max(0, Math.min(1, ov/denom)));
  }
  if (!parts.length) return 0;
  return (parts[0] + (parts[1] ?? parts[0])) / (parts.length);
}
function renderEnvFitBar(){
  const bar = document.getElementById('envBarFill'); // make sure index uses this id
  if (!bar) return;

  const distinct = Array.from(new Set(
    readStockUI().filter(x => x.qty > 0).map(x => canonName(x.name))
  ));
  if (distinct.length < 2){ bar.style.width = '0%'; return; }

  const map = speciesMap();
  let sum = 0, count = 0;
  for (let i=0;i<distinct.length;i++){
    const A = rangesFor(distinct[i], map); if (!A) continue;
    for (let j=i+1;j<distinct.length;j++){
      const B = rangesFor(distinct[j], map); if (!B) continue;
      sum += pairOverlap(A,B); count++;
    }
  }
  const avg = count ? (sum / count) : 0;
  bar.style.width = Math.round(avg * 100) + '%';
}

/* ---------------- Species select & search ---------------- */
function buildSelect(){
  const sel = document.getElementById('fishSelect'); if (!sel || sel.options.length) return;
  let list = Array.isArray(window.FISH_DATA) ? window.FISH_DATA : [];
  list = list.map(o => ({ name: o?.name || o?.species || o?.common || '', min: Number(o?.min || o?.recommendedMinimum || o?.minGroup || 0) || 0 }))
             .filter(x => x.name);
  list.sort((a,b)=>a.name.localeCompare(b.name));
  for (const it of list){
    const opt = document.createElement('option');
    opt.value = it.name;
    opt.textContent = it.name;
    opt.dataset.min = String(it.min || 1);
    sel.appendChild(opt);
  }

  const rec = document.getElementById('recMin');
  const syncRec = () => { const m = Number(sel.selectedOptions[0]?.dataset?.min || 1) || 1; if (rec) rec.value = String(m); };
  sel.addEventListener('change', syncRec);
  syncRec();

  const search = document.getElementById('fishSearch');
  if (search){
    search.addEventListener('input', function(){
      const q = (this.value||'').toLowerCase();
      Array.from(sel.options).forEach(o => { o.hidden = q && !o.textContent.toLowerCase().includes(q); });
      const first = Array.from(sel.options).find(o => !o.hidden);
      if (first){ sel.value = first.value; syncRec(); }
    });
  }
}

/* ---------------- render orchestrator ---------------- */
function renderAll(){
  renderBioloadBar();
  renderAggressionAndWarnings();
  renderEnvFitBar();
}

/* ---------------- boot ---------------- */
window.addEventListener('load', () => {
  // status strip hinting
  const diag = document.getElementById('diag');
  if (diag){
    diag.className = 'ok';
    diag.querySelector('div').textContent = 'Core OK • Safety adapter ready';
  }

  buildSelect();

  // *** KILL legacy handlers by cloning the buttons ***
  function cloneReplace(el){ if (!el) return el; const c = el.cloneNode(true); el.replaceWith(c); return c; }
  let addBtn   = document.getElementById('addFish');
  let resetBtn = document.getElementById('reset');
  addBtn   = cloneReplace(addBtn);
  resetBtn = cloneReplace(resetBtn);

  const qtyEl = document.getElementById('fQty');
  const recEl = document.getElementById('recMin');
  const sel   = document.getElementById('fishSelect');

  function getTypedQty(){
    // Prefer typed string; Safari sometimes delays valueAsNumber
    const raw = (qtyEl && typeof qtyEl.value === 'string') ? qtyEl.value.trim() : '';
    if (raw.length) return safeQty(raw);
    return NaN; // indicates “no user input”
  }

  function handleAdd(ev){
    if (ev){ ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); }
    const name = sel?.value || '';
    if (!name) return;
    const typed = getTypedQty();
    const fallback = safeQty(recEl?.value ?? 1) || 1;
    const qty = Number.isNaN(typed) ? fallback : typed; // only fall back if empty
    addOrUpdateRowUI(name, qty);
  }

  addBtn?.addEventListener('click', handleAdd, true); // capture to beat any stray listeners
  qtyEl?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') handleAdd(e); });

  resetBtn?.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    const tbody = document.getElementById('tbody');
    if (tbody) tbody.innerHTML = '';
    renderAll();
  }, true);

  // tank controls
  ['gallons','planted','filtration'].forEach(id=>{
    const el = document.getElementById(id);
    el?.addEventListener('input', renderAll);
    el?.addEventListener('change', renderAll);
  });

  renderAll();

  // quick diagnostics if Env bar element is wrong
  if (!document.getElementById('envBarFill') && diag){
    diag.className = 'err';
    diag.querySelector('div').textContent = 'EnvFit bar element with id="envBarFill" not found in index.html';
  }
});