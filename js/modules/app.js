/* FishkeepingLifeCo — modules/app.js (v9.3.7, standalone)
   - No external imports
   - Uses window.FISH_DATA only
   - Populates dropdown, respects quantity
   - Bars: Bioload, Environmental Fit, Aggression
   - Warning bubbles for Env & Aggression
*/

/* ---------------- Utilities ---------------- */
const toArray = x => (Array.isArray(x) ? x : x ? [x] : []);
const norm = s => (s ?? '').toString().trim().toLowerCase();
const canonName = s =>
  norm(s).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').replace(/\s*\([^)]*\)\s*/g, '').trim();

const titleCase = (s='') =>
  s.replace(/[_-]+/g,' ')
   .replace(/\s+/g,' ')
   .trim()
   .replace(/\b([a-z])/g, (_,c)=>c.toUpperCase());

function safeQty(raw){
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(999, Math.max(1, Math.floor(raw)));
  }
  const s = (raw==null ? '' : String(raw)).replace(/[^\d]/g,'').slice(0,3);
  let n = parseInt(s,10);
  if (isNaN(n) || n < 1) n = 1;
  if (n > 999) n = 999;
  return n;
}

/* ---------------- Data helpers ---------------- */
function byNameMap(list){
  const m = new Map();
  list.forEach(row=>{
    if(!row) return;
    const key = canonName(row.name || row.common || row.species || row.id);
    if(key) m.set(key, row);
  });
  return m;
}
function getMinFromRow(row){ return row?.min ?? row?.recommendedMinimum ?? row?.minGroup ?? 1; }
function getTempRange(row){
  const t = row?.temp;
  if (Array.isArray(t) && t.length===2 && Number.isFinite(+t[0]) && Number.isFinite(+t[1])) {
    return [Number(t[0]), Number(t[1])];
  }
  return null;
}
function getPhRange(row){
  const p = row?.ph;
  if (Array.isArray(p) && p.length===2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1])) {
    return [Number(p[0]), Number(p[1])];
  }
  return null;
}

/* ---------------- DOM cache ---------------- */
const els = {};
const $ = id => document.getElementById(id);

/* ---------------- Populate species select ---------------- */
function populateSelect(){
  const sel = $('fishSelect');
  const rec = $('recMin');
  const search = $('fishSearch');

  sel.innerHTML = '';
  const list = Array.isArray(window.FISH_DATA) ? window.FISH_DATA.slice() : [];
  list.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  list.forEach(row=>{
    const opt = document.createElement('option');
    opt.value = row.name;
    opt.textContent = row.name;
    opt.dataset.min = String(getMinFromRow(row) || 1);
    sel.appendChild(opt);
  });

  function updateRec(){
    const opt = sel.selectedOptions[0];
    const min = opt ? parseInt(opt.dataset.min||'1',10)||1 : 1;
    rec.value = String(min);
  }
  updateRec();

  if (search){
    search.addEventListener('input', function(){
      const q = norm(this.value);
      let firstVisible = null;
      Array.from(sel.options).forEach(o=>{
        const hit = !q || norm(o.textContent).includes(q);
        o.hidden = !hit;
        if (hit && !firstVisible) firstVisible = o;
      });
      if (firstVisible){ sel.value = firstVisible.value; updateRec(); }
    });
  }
  sel.addEventListener('change', updateRec);
}

/* ---------------- Current Stock table ---------------- */
function rowHTML(name, qty){
  return `
    <tr>
      <td>${titleCase(name)}</td>
      <td>
        <input type="number" min="1" step="1" inputmode="numeric" value="${qty}" style="width:72px" />
      </td>
      <td style="text-align:right">
        <button class="btn btn-minus" type="button">−</button>
        <button class="btn btn-plus" type="button">+</button>
        <button class="btn btn-del" type="button" style="background:var(--bad)">Delete</button>
      </td>
    </tr>
  `.trim();
}
function findRowByName(name){
  const want = canonName(name);
  const rows = $('#tbody').querySelectorAll('tr');
  for (const tr of rows){
    const text = (tr.querySelector('td')?.textContent)||'';
    if (canonName(text)===want) return tr;
  }
  return null;
}
function addOrUpdateStock(name, delta){
  const tbody = $('#tbody');
  let tr = findRowByName(name);
  if (tr){
    const input = tr.querySelector('input');
    const next = Math.max(1, safeQty((input && input.value) || 1) + delta);
    input.value = String(next);
    renderAll();
    return;
  }
  const wrapper = document.createElement('tbody');
  wrapper.innerHTML = rowHTML(name, delta);
  tr = wrapper.firstElementChild;
  tbody.appendChild(tr);
  wireRow(tr);
  renderAll();
}
function wireRow(tr){
  const input = tr.querySelector('input');
  const minus = tr.querySelector('.btn-minus');
  const plus  = tr.querySelector('.btn-plus');
  const del   = tr.querySelector('.btn-del');

  input.addEventListener('input', renderAll);
  input.addEventListener('change', renderAll);

  minus.addEventListener('click', ()=>{
    const v = safeQty(input.value) - 1;
    if (v <= 0) tr.remove();
    else input.value = String(v);
    renderAll();
  });
  plus.addEventListener('click', ()=>{
    input.value = String(safeQty(input.value) + 1);
    renderAll();
  });
  del.addEventListener('click', ()=>{
    tr.remove();
    renderAll();
  });
}
function readStock(){
  const res = [];
  const rows = $('#tbody').querySelectorAll('tr');
  rows.forEach(tr=>{
    const name = (tr.querySelector('td')?.textContent)||'';
    const qty  = safeQty(tr.querySelector('input')?.value || 1);
    if (name) res.push({ name, qty });
  });
  return res;
}

/* ---------------- Bars: Bioload ---------------- */
function capacityUnits(){
  const gallons = parseFloat($('gallons')?.value || '0') || 0;
  const planted = !!$('planted')?.checked;
  const filtVal = $('filtration')?.value || 'standard';
  const filtFactor = (filtVal==='low') ? 0.8 : (filtVal==='high') ? 1.25 : 1.0;
  const perGal = 0.9; // baseline “points” per gallon
  return Math.max(1, gallons * perGal) * filtFactor * (planted ? 1.10 : 1.0);
}
function totalBioPoints(stock, nameMap){
  let sum = 0;
  stock.forEach(({name, qty})=>{
    const row = nameMap.get(canonName(name));
    const pts = Number(row?.points ?? 1);
    sum += pts * (qty||0);
  });
  return sum;
}
function setBarFill(el, pct){
  if (!el) return;
  const p = Math.max(0, Math.min(100, pct));
  el.style.width = p.toFixed(1) + '%';
}

/* ---------------- Bars: Environmental Fit ---------------- */
function rangeOverlap(a, b){
  if (!a || !b) return 0;
  const low  = Math.max(a[0], b[0]);
  const high = Math.min(a[1], b[1]);
  const widthA = Math.max(0, a[1]-a[0]);
  const widthB = Math.max(0, b[1]-b[0]);
  const widthO = Math.max(0, high - low);
  const denom = Math.max(widthA, widthB, 1e-6);
  return Math.max(0, Math.min(1, widthO / denom)); // 1 = tight overlap
}
function envFitResult(stock, nameMap){
  const uniq = new Set(stock.map(s=>canonName(s.name)));
  if (uniq.size < 2) return { fill: 0, severe:false };

  let tempScore = 1, phScore = 1;
  const arr = Array.from(uniq);
  for (let i=0; i<arr.length; i++){
    const ri = nameMap.get(arr[i]);
    const ti = getTempRange(ri), pi = getPhRange(ri);
    for (let j=i+1; j<arr.length; j++){
      const rj = nameMap.get(arr[j]);
      const tj = getTempRange(rj), pj = getPhRange(rj);
      tempScore = Math.min(tempScore, rangeOverlap(ti, tj));
      phScore   = Math.min(phScore,   rangeOverlap(pi, pj));
    }
  }
  const both = Math.min(tempScore, phScore);
  if (both <= 0) return { fill: 100, severe:true };
  return { fill: (1 - both) * 100, severe:false };
}

/* ---------------- Bars: Aggression (simple rules) ---------------- */
function aggressionResult(stock, nameMap){
  const names = stock.map(s=>canonName(s.name));
  let score = 0;
  const warns = [];

  const has = re => names.some(n=>re.test(n));
  const pair = (reA, reB) => has(reA) && has(reB);

  // Betta vs long-finned species (angels/gourami/livebearers)
  if (pair(/\bbetta\b/i, /\b(angelfish|gourami)\b/i)) {
    score += 60;
    warns.push({txt:'Betta with long-finned fish (Angelfish/Gourami) can cause fin nipping and stress.', sev:'severe'});
  }

  // Fin-nippers vs long-fins/livebearers
  const finNippers = /\b(tiger barb|serpae|skirt tetra|black skirt)\b/i;
  if (has(finNippers) && has(/\b(betta|guppy|angelfish|gourami|molly|swordtail)\b/i)) {
    score += 50;
    warns.push({txt:'Known fin-nippers with long-finned or livebearers — monitor closely.', sev:'moderate'});
  }

  // Cichlid mix (broad; light nudge)
  if (has(/\b(cichlid|apistogramma|kribensis|ram)\b/i) && names.length > 1){
    score += 25;
    warns.push({txt:'Cichlid mix can be territorial; ensure space and hiding spots.', sev:'mild'});
  }

  // Schooling shortfall
  stock.forEach(s=>{
    const row = nameMap.get(canonName(s.name));
    const min = getMinFromRow(row) || 1;
    if (min >= 3 && (s.qty||0) < min){
      score += 10;
      warns.push({txt:`${titleCase(s.name)} prefer groups of ${min}+ (stock is ${s.qty}).`, sev:'mild'});
    }
  });

  score = Math.max(0, Math.min(100, score));
  return { score, warns };
}

/* ---------------- Warnings rendering ---------------- */
function clearNode(el){ if(el) el.innerHTML = ''; }
function bubble(text, sev='info'){
  const d = document.createElement('div');
  d.className = `warning-bubble warning-${sev}`;
  d.textContent = text;
  return d;
}

/* ---------------- Main render ---------------- */
let nameMapCache = null;

function renderAll(){
  if (!nameMapCache){
    nameMapCache = byNameMap(toArray(window.FISH_DATA));
  }
  const stock = readStock();

  // Bioload
  const bioPts = totalBioPoints(stock, nameMapCache);
  const cap    = capacityUnits();
  const bioPct = (bioPts / Math.max(1, cap)) * 100;
  setBarFill($('#bioBarFill'), Math.min(100, bioPct));

  // Environmental Fit
  const envRes = envFitResult(stock, nameMapCache);
  setBarFill($('#envBarFill'), envRes.fill);
  const compatBox = $('#compat-warnings');
  clearNode(compatBox);
  if (envRes.severe){
    compatBox.appendChild(bubble('Temperature or pH ranges do not overlap.', 'severe'));
  }

  // Aggression
  const agg = aggressionResult(stock, nameMapCache);
  setBarFill($('#aggBarFill'), agg.score);
  const aggBox = $('#aggression-warnings');
  clearNode(aggBox);
  agg.warns.forEach(w=> aggBox.appendChild(bubble(w.txt, w.sev)));
}

/* ---------------- Boot ---------------- */
function boot(){
  ['gallons','filtration','planted','fishSearch','fishSelect','fQty','recMin','addFish','reset','tbody']
    .forEach(id => els[id] = $(id));

  populateSelect();

  // Add fish (respect typed quantity; fallback to Rec Min if empty)
  els.addFish.addEventListener('click', ()=>{
    const name = els.fishSelect?.value || '';
    if (!name) return;
    const raw = els.fQty?.value ?? '';
    const useTyped = String(raw).trim().length > 0;
    const qty = useTyped ? safeQty(raw) : safeQty(els.recMin?.value ?? '1');
    addOrUpdateStock(name, qty);
  });

  // Clear stock
  els.reset.addEventListener('click', ()=>{
    $('#tbody').innerHTML = '';
    renderAll();
  });

  // Wire existing rows (if any)
  $('#tbody').querySelectorAll('tr').forEach(wireRow);

  // Tank controls
  ['gallons','filtration','planted'].forEach(id=>{
    const el = $(id); if (!el) return;
    el.addEventListener('input', renderAll);
    el.addEventListener('change', renderAll);
  });

  renderAll();
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}