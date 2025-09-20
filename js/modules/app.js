/* FishkeepingLifeCo — App runtime (build v9.3.0)
   - Respects typed Quantity (uses recMin only when empty)
   - Restores bar updates, including Environmental Fit (id: envBarFill)
   - Formats names (no underscores, Title Case) in Current Stock
*/

/* ===== Utilities (local, so this file works by itself) ===== */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toArray(x){ return Array.isArray(x) ? x : x ? [x] : []; }
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function canonName(s){
  return norm(s).replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\s*\([^)]*\)\s*/g,' ').trim();
}
function formatName(raw){
  if(!raw) return '';
  return raw
    .toString()
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Safari-safe qty: returns 1..999 when a number is intended, 0 allowed only when we internally set it
function safeQty(raw, allowZero=false){
  if (typeof raw === 'number' && Number.isFinite(raw)){
    let n = Math.floor(raw);
    if(!allowZero && n < 1) n = 1;
    if(allowZero && n < 0) n = 0;
    if(n > 999) n = 999;
    return n;
  }
  const cleaned = (raw==null?'':String(raw)).replace(/[^\d]/g,'').slice(0,3);
  let n = cleaned === '' ? (allowZero?0:1) : parseInt(cleaned,10);
  if(!allowZero && (isNaN(n) || n < 1)) n = 1;
  if(allowZero && (isNaN(n) || n < 0)) n = 0;
  if(n > 999) n = 999;
  return n;
}

/* ===== Data access ===== */
function getFishList(){
  // Accepts array or object forms
  const src = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES || [];
  if (Array.isArray(src)) return src;
  if (src && typeof src === 'object'){
    return Object.keys(src).map(k => ({ id:k, name:k, ...(src[k]||{}) }));
  }
  return [];
}

function findFishRow(name){
  const key = canonName(name);
  const list = getFishList();
  for (const r of list){
    const n = canonName(r.name || r.species || r.common || r.id || '');
    if (n === key) return r;
  }
  return null;
}

/* ===== Bars ===== */
function capacityUnits(){
  const gallons = parseFloat($('#gallons')?.value || '0') || 0;
  const planted = !!$('#planted')?.checked;
  const filt = $('#filtration')?.value || 'standard';
  const perGal = 0.9;
  const filtFactor = (filt==='low') ? 0.80 : (filt==='high') ? 1.25 : 1.0;
  const plantedBonus = planted ? 1.10 : 1.0;
  return Math.max(1, gallons * perGal) * filtFactor * plantedBonus;
}
function unitsFor(name){
  const row = findFishRow(name) || {};
  // prefer points if present; otherwise use a simple heuristic
  if (row.points && !isNaN(Number(row.points))) return Number(row.points);
  const n = canonName(name);
  if (/(shrimp|snail)/i.test(n)) return 0.3;
  if (/(ember|neon|endlers|microrasbora|cpd)/i.test(n)) return 0.6;
  if (/(harlequin|rasbora|tetra|danio|guppy|platy|cory)/i.test(n)) return 1.0;
  if (/(gourami|angelfish|apisto|ram)/i.test(n)) return 2.0;
  if (/(pleco|swordtail|rainbow)/i.test(n)) return 3.0;
  return 1.0;
}
function totalBioUnits(stock){
  return stock.reduce((sum, it)=> sum + unitsFor(it.name) * (it.qty||0), 0);
}
function setBarFill(el, pct){
  if (!el) return;
  const clamped = Math.max(0, Math.min(160, pct)); // allow a little overshoot tail
  el.style.width = clamped.toFixed(1) + '%';
  // pulse micro animation
  el.classList.remove('pulse');
  void el.offsetWidth; // reflow
  el.classList.add('pulse');
}

/* Environmental fit from temp/ph ranges */
function overlapLen(a, b){
  // inclusive overlap length; returns 0 if none
  if (!a || !b || a.length<2 || b.length<2) return 0;
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  return Math.max(0, hi - lo);
}
function rangeLen(a){
  if (!a || a.length < 2) return 0;
  return Math.max(0, a[1]-a[0]);
}
function envFitPercent(stock){
  // Build aggregate overlap across all selected species
  const rows = stock
    .map(s => findFishRow(s.name))
    .filter(Boolean)
    .map(r => ({
      t: Array.isArray(r.temp)? r.temp.slice(0,2) : null,
      p: Array.isArray(r.ph)? r.ph.slice(0,2) : null
    }));
  if (rows.length <= 1) return 0; // start at 0 and build as more species are added

  // Start with first ranges, intersect forward
  let tInt = rows[0].t ? rows[0].t.slice() : null;
  let pInt = rows[0].p ? rows[0].p.slice() : null;

  for (let i=1;i<rows.length;i++){
    const r = rows[i];
    if (tInt && r.t){
      tInt = [Math.max(tInt[0], r.t[0]), Math.min(tInt[1], r.t[1])];
      if (tInt[1] < tInt[0]) tInt = [0,0];
    }
    if (pInt && r.p){
      pInt = [Math.max(pInt[0], r.p[0]), Math.min(pInt[1], r.p[1])];
      if (pInt[1] < pInt[0]) pInt = [0,0];
    }
  }

  // Score: fraction of average range overlapped
  const tAllLen = rows
    .map(r => rangeLen(r.t))
    .filter(x => x>0);
  const pAllLen = rows
    .map(r => rangeLen(r.p))
    .filter(x => x>0);

  const tAvg = tAllLen.length ? (tAllLen.reduce((a,b)=>a+b,0)/tAllLen.length) : 0;
  const pAvg = pAllLen.length ? (pAllLen.reduce((a,b)=>a+b,0)/pAllLen.length) : 0;

  const tOv = overlapLen(tInt, tInt) ? rangeLen(tInt) : 0; // if intersected to 0, becomes 0
  const pOv = overlapLen(pInt, pInt) ? rangeLen(pInt) : 0;

  // Weight temp more (7) than pH (3) by default
  const tScore = tAvg>0 ? Math.min(1, tOv / tAvg) : 0;
  const pScore = pAvg>0 ? Math.min(1, pOv / pAvg) : 0;
  const score01 = (tScore*0.7 + pScore*0.3);
  return Math.max(0, Math.min(1, score01));
}

/* ===== Current stock table ===== */
function readStock(){
  return $$('#tbody tr').map(tr=>{
    const name = tr.dataset.name || (tr.querySelector('td')?.textContent||'').trim();
    const inp  = tr.querySelector('td:nth-child(2) input');
    const qty  = safeQty(inp ? inp.value : '0', true); // allow 0 here
    return name ? { name, qty } : null;
  }).filter(Boolean);
}

function findRowByName(name){
  const want = canonName(name);
  for (const tr of $$('#tbody tr')){
    const n = canonName(tr.dataset.name || tr.querySelector('td')?.textContent||'');
    if (n === want) return tr;
  }
  return null;
}

function addRow(name, qty){
  const tbody = $('#tbody');
  const tr = document.createElement('tr');
  tr.dataset.name = name;

  const tdName = document.createElement('td');
  tdName.textContent = formatName(name);

  const tdQty = document.createElement('td');
  const input = document.createElement('input');
  input.type='number'; input.min='0'; input.step='1'; input.inputMode='numeric';
  input.style.width='64px';
  input.value = String(safeQty(qty, true));
  input.addEventListener('input', renderAll);
  input.addEventListener('change', renderAll);
  tdQty.appendChild(input);

  const tdAct = document.createElement('td');
  tdAct.style.textAlign='right';
  const bMinus = document.createElement('button'); bMinus.type='button'; bMinus.className='btn'; bMinus.textContent='−'; bMinus.style.marginRight='6px';
  const bPlus  = document.createElement('button'); bPlus.type='button';  bPlus.className='btn';  bPlus.textContent='+'; bPlus.style.marginRight='6px';
  const bDel   = document.createElement('button'); bDel.type='button';   bDel.className='btn';   bDel.textContent='Delete'; bDel.style.background='var(--bad)';

  bMinus.addEventListener('click', ()=>{
    const v = safeQty(input.value, true) - 1;
    input.value = String(Math.max(0, v));
    if (safeQty(input.value, true) === 0) tr.remove();
    renderAll();
  });
  bPlus.addEventListener('click', ()=>{
    input.value = String(safeQty(input.value, true) + 1);
    renderAll();
  });
  bDel.addEventListener('click', ()=>{ tr.remove(); renderAll(); });

  tdAct.append(bMinus,bPlus,bDel);
  tr.append(tdName, tdQty, tdAct);
  tbody.appendChild(tr);
}

function addOrUpdateRow(name, deltaQty){
  const tr = findRowByName(name);
  if (tr){
    const inp = tr.querySelector('td:nth-child(2) input');
    const cur = safeQty(inp.value, true);
    const v = cur + deltaQty;
    if (v <= 0){ tr.remove(); renderAll(); return; }
    inp.value = String(v);
    renderAll();
    return;
  }
  if (deltaQty <= 0) return;
  addRow(name, deltaQty);
  renderAll();
}

/* ===== Populate species select ===== */
function populateSelectIfEmpty(){
  const sel = $('#fishSelect');
  if (!sel || sel.options.length) return;

  const list = getFishList().slice().sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  for (const r of list){
    const opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = r.name;
    opt.dataset.min = (r.min || r.recommendedMinimum || r.minGroup || 1);
    // keep ranges handy
    if (Array.isArray(r.temp)) opt.dataset.temp = JSON.stringify(r.temp.slice(0,2));
    if (Array.isArray(r.ph))   opt.dataset.ph   = JSON.stringify(r.ph.slice(0,2));
    sel.appendChild(opt);
  }

  const rec = $('#recMin');
  function updateRec(){
    const o = sel.selectedOptions[0];
    rec.value = o ? (parseInt(o.dataset.min || '1',10)||1) : 1;
  }
  updateRec();
  sel.addEventListener('change', updateRec);

  // Search filter
  const search = $('#fishSearch');
  if (search){
    search.addEventListener('input', ()=>{
      const q = search.value.trim().toLowerCase();
      let firstShown = null;
      for (const o of sel.options){
        const show = !q || o.textContent.toLowerCase().includes(q);
        o.hidden = !show;
        if (show && !firstShown) firstShown = o;
      }
      if (firstShown){ sel.value = firstShown.value; updateRec(); }
    });
  }
}

/* ===== Rendering ===== */
function renderBioload(){
  const stock = readStock();
  const total = totalBioUnits(stock);
  const cap   = capacityUnits();
  const pct   = cap > 0 ? (total / cap) * 100 : 0;
  setBarFill($('#bioBarFill'), pct);
}

function renderAggression(){
  const box = $('#aggression-warnings');
  if (box) box.innerHTML = '';
  const stock = readStock();

  let res = { score:0, warnings:[] };
  if (window.Aggression && typeof window.Aggression.compute === 'function'){
    try { res = window.Aggression.compute(stock, { gallons: parseFloat($('#gallons')?.value||'0')||0 }); } catch(e){}
  }
  setBarFill($('#aggBarFill'), Math.min(100, Math.max(0, res.score||0)));
  // Optional: render warning bubbles if res.grouped exists (compatible with your later UI)
  if (box && res.grouped){
    for (const group of res.grouped){
      const sec = document.createElement('div'); sec.className='warning-section';
      const title = document.createElement('div'); title.className='warning-title'; title.textContent=group.title||'Warnings';
      const row = document.createElement('div'); row.className='warning-bubbles';
      for (const w of group.items||[]){
        const span = document.createElement('span');
        span.className = 'warning-bubble ' + (w.severity||'warning-info');
        span.innerHTML = w.html || w.text || '';
        row.appendChild(span);
      }
      sec.append(title,row); box.appendChild(sec);
    }
  }
}

function renderEnvFit(){
  const stock = readStock().filter(s => s.qty>0);
  const score01 = envFitPercent(stock);     // 0..1
  const pct = score01 * 100;                // fill amount
  setBarFill($('#envBarFill'), pct);
}

function renderAll(){
  renderBioload();
  renderAggression();
  renderEnvFit();
}

/* ===== Boot ===== */
window.addEventListener('load', () => {
  // status strip
  const diag = $('#diag');
  if (diag){
    const box = diag.querySelector('div');
    const issues = [];
    if (!$('#fishSelect')) issues.push('Species dropdown missing');
    if (!$('#tbody')) issues.push('Table body missing');
    if (!window.FISH_DATA) issues.push('No species data');
    diag.className = issues.length ? 'err' : 'ok';
    box.textContent = issues.length ? ('Issues: ' + issues.join(' | ')) : 'Core OK • Safety adapter ready';
  }

  populateSelectIfEmpty();

  // Bind Add / Reset with “typed qty wins”
  const addBtn   = $('#addFish');
  const resetBtn = $('#reset');
  const qtyEl    = $('#fQty');
  const recEl    = $('#recMin');
  const sel      = $('#fishSelect');

  function getTypedQty(){
    if (!qtyEl) return null;
    const raw = String(qtyEl.value||'').trim();
    if (raw === '') return null;           // user left it empty -> use recMin fallback
    return safeQty(raw);
  }

  function handleAdd(){
    const name = sel && sel.value ? sel.value : '';
    if (!name) return;
    const typed = getTypedQty();
    const fallback = safeQty(recEl && recEl.value ? recEl.value : '1');
    const qty = (typed==null) ? fallback : typed;   // *** TYPED WINS ***
    addOrUpdateRow(name, qty);
  }

  if (addBtn)  addBtn.addEventListener('click', handleAdd);
  if (qtyEl){
    qtyEl.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') handleAdd(); });
  }
  if (resetBtn){
    resetBtn.addEventListener('click', ()=>{
      $('#tbody').innerHTML = '';
      renderAll();
    });
  }

  // Tank inputs recalc bars
  ['gallons','planted','filtration'].forEach(id=>{
    const el = $('#'+id);
    if (!el) return;
    el.addEventListener('input', renderAll);
    el.addEventListener('change', renderAll);
  });

  renderAll();
});