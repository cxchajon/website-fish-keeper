/* =========================================================
   FishkeepingLifeCo — modules/app.js  (v9.3.5)
   ========================================================= */

/* ---------- tiny helpers ---------- */
const tc = s => (s||'').toString()
  .replace(/[_-]+/g,' ')
  .replace(/\s+/g,' ')
  .trim()
  .replace(/\b\w/g, c => c.toUpperCase());

const canon = s => (s||'').toString().trim().toLowerCase().replace(/[_-]+/g,' ');

/* ---------- data access ---------- */
function getSpeciesSource(){
  return window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES || [];
}

function getSpeciesList(){
  const src = getSpeciesSource();
  if (Array.isArray(src)) {
    return src.map(r => ({
      raw: r,
      name: r?.name || r?.species || r?.common || '',
      min : Number(r?.min || r?.recommendedMinimum || r?.group) || 1
    })).filter(x => x.name);
  }
  if (src && typeof src === 'object') {
    return Object.keys(src).map(k => ({
      raw: src[k],
      name: k,
      min : Number(src[k]?.min || src[k]?.recommendedMinimum || 1) || 1
    }));
  }
  return [];
}

function metaFor(name){
  const key = canon(name);
  const src = getSpeciesSource();

  if (Array.isArray(src)) {
    for (const r of src){
      const n = canon(r?.name || r?.species || r?.common || '');
      if (n === key) return r || null;
    }
  } else if (src && typeof src === 'object'){
    return src[name] || src[key] || null;
  }
  return null;
}

/* ---------- UI state ---------- */
let stock = []; // [{name, qty, min}]

/* ---------- species select (self-healing + search) ---------- */
function populateSpeciesSelect(){
  const sel = document.getElementById('fishSelect');
  if (!sel) return;

  const list = getSpeciesList().sort((a,b)=> a.name.localeCompare(b.name));
  sel.innerHTML = '';
  for (const {name, min} of list){
    const o = document.createElement('option');
    o.value = name;
    o.textContent = tc(name);
    o.dataset.min = String(min || 1);
    sel.appendChild(o);
  }

  const rec = document.getElementById('recMin');
  const updateRec = () => {
    const o = sel.selectedOptions[0];
    if (rec && o) rec.value = o.dataset.min || '';
  };
  sel.addEventListener('change', updateRec);
  updateRec();

  const search = document.getElementById('fishSearch');
  if (search && !search._wired){
    search._wired = true;
    search.addEventListener('input', ()=>{
      const q = (search.value || '').toLowerCase();
      let first = null;
      Array.from(sel.options).forEach(o=>{
        const hit = o.textContent.toLowerCase().includes(q);
        o.hidden = !hit;
        if (hit && !first) first = o;
      });
      if (first){ sel.value = first.value; updateRec(); }
    });
  }
}

/* ---------- stock table ---------- */
function renderStock(){
  const tbody = document.getElementById('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  stock.forEach((f, i)=>{
    const tr = document.createElement('tr');

    const tdN = document.createElement('td');
    tdN.textContent = tc(f.name);

    const tdQ = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = '1';
    inp.value = f.qty;
    inp.addEventListener('change', ()=>{
      const n = parseInt(inp.value, 10);
      if (!isNaN(n) && n >= 1){ f.qty = n; renderAll(); }
      else { inp.value = f.qty; }
    });
    tdQ.appendChild(inp);

    const tdA = document.createElement('td');
    tdA.style.textAlign = 'right';
    const minus = document.createElement('button');
    minus.className = 'btn'; minus.textContent = '–';
    minus.addEventListener('click', ()=>{ if (f.qty > 1){ f.qty--; renderAll(); } });

    const plus = document.createElement('button');
    plus.className = 'btn'; plus.textContent = '+';
    plus.addEventListener('click', ()=>{ f.qty++; renderAll(); });

    const del = document.createElement('button');
    del.className = 'btn'; del.style.background='var(--bad)'; del.textContent = 'Delete';
    del.addEventListener('click', ()=>{ stock.splice(i,1); renderAll(); });

    tdA.append(minus, plus, del);

    tr.append(tdN, tdQ, tdA);
    tbody.appendChild(tr);
  });
}

/* ---------- bars ---------- */
function setBar(id, pct){
  const fill = document.getElementById(id);
  if (!fill) return;
  fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

/* ---------- warnings renderer ---------- */
function bubble(cls, text){
  const d = document.createElement('div');
  d.className = 'warning-bubble ' + cls;
  d.textContent = text;
  return d;
}
function banner(cls, text){
  const wrap = document.createElement('div');
  wrap.className = 'warning-section';
  const bubbles = document.createElement('div');
  bubbles.className = 'warning-bubbles';
  const b = bubble(cls, text);
  bubbles.appendChild(b);
  wrap.appendChild(bubbles);
  return wrap;
}

function renderWarningsAndAgg(aggScoreExtra = 0){
  const box = document.getElementById('aggression-warnings');
  if (!box) return;
  box.innerHTML = '';

  let risk = 0; // 0..100 for Aggression bar

  // Schooling + fin nippers + betta rule
  for (const f of stock){
    const m = metaFor(f.name) || {};
    const min = Number(m.min || m.recommendedMinimum || f.min || 1) || 1;

    if (f.qty < min){
      box.appendChild( bubble('warning-moderate',
        `${tc(f.name)}: Schooling minimum is ${min}`) );
      risk += 18;
    }

    const n = canon(f.name);
    if (/\bbarb\b/.test(n)){ // most barbs nip
      box.appendChild( bubble('warning-mild',
        `${tc(f.name)}: Known fin nipper`) );
      risk += 22;
    }

    // Multiple male bettas → severe
    if (/betta/.test(n) && f.qty > 1){
      box.appendChild( bubble('warning-severe',
        `Multiple male bettas will fight`) );
      risk = 100;
    }
  }

  risk = Math.min(100, risk + aggScoreExtra);
  setBar('aggBarFill', risk);
}

/* ---------- environmental fit (Temp & pH) ---------- */
/* Score logic:
   - For each dimension (temp, ph), compute intersection across all species.
   - Let union span be (maxHigh - minLow). Overlap ratio = max(0, interSpan)/unionSpan.
   - Combined fit = average of ratios (temp + pH)/2 * 100.
   - Single species or missing data ⇒ no penalty (0% fill on Env bar).
   - Env bar shows **risk**, so width = 100 - fit.
   - If either dimension has zero intersection ⇒ Severe banner + envRisk=100 and also max aggression.
*/
function computeEnvRisk(){
  if (stock.length < 2) return { risk: 0, severe: false, note: 'single-or-empty' };

  const ranges = stock.map(s => {
    const m = metaFor(s.name) || {};
    return {
      t: Array.isArray(m.temp) && m.temp.length === 2 ? [Number(m.temp[0]), Number(m.temp[1])] : null,
      p: Array.isArray(m.ph)   && m.ph.length   === 2 ? [Number(m.ph[0]),   Number(m.ph[1])]   : null
    };
  });

  // If fewer than two with both datasets, treat as unknown ⇒ no penalty.
  const haveAny = ranges.some(r => r.t || r.p);
  if (!haveAny) return { risk: 0, severe: false, note: 'no-data' };

  function overlapRatio(getRange){
    const vals = ranges.map(getRange).filter(Boolean);
    if (vals.length < 2) return 1; // not enough info to penalize
    let minLow = +Infinity, maxHigh = -Infinity;
    let interLow = -Infinity, interHigh = +Infinity;
    for (const [lo, hi] of vals){
      if (lo > hi) continue;
      minLow  = Math.min(minLow, lo);
      maxHigh = Math.max(maxHigh, hi);
      interLow  = Math.max(interLow, lo);
      interHigh = Math.min(interHigh, hi);
    }
    const unionSpan = Math.max(0, maxHigh - minLow);
    const interSpan = Math.max(0, interHigh - interLow);
    if (unionSpan <= 0) return 0;
    // edge-touch counts as tight -> 0
    if (interSpan <= 0) return 0;
    return interSpan / unionSpan; // 0..1
  }

  const tempR = overlapRatio(r => r.t);
  const phR   = overlapRatio(r => r.p);

  const fit = 0.5 * (tempR + phR);     // 0..1
  const envRisk = Math.round(100 * (1 - fit)); // 0 good .. 100 bad
  const severe = (tempR === 0 || phR === 0);

  return { risk: envRisk, severe };
}

/* ---------- bioload (simple scalable placeholder) ---------- */
function computeBioload(){
  // Simple points: use qty sum scaled. (Your detailed units function can replace this.)
  let total = 0;
  for (const f of stock) total += f.qty;
  // Each fish ~5% capacity (tunable)
  return Math.min(100, total * 5);
}

/* ---------- render all ---------- */
function renderAll(){
  renderStock();

  // BIO
  setBar('bioBarFill', computeBioload());

  // ENV
  const env = computeEnvRisk();
  setBar('envBarFill', env.risk);

  // Warnings + Aggression (add env severity weight)
  const extra = env.severe ? 100 : Math.round(env.risk * 0.4); // mild coupling
  const warnBox = document.getElementById('aggression-warnings');
  if (warnBox){
    warnBox.innerHTML = '';
    if (env.severe){
      warnBox.appendChild( banner('warning-severe', 'Temperature or pH ranges do not overlap.') );
    } else if (env.risk >= 60){
      warnBox.appendChild( banner('warning-moderate', 'Environment fit is tight — consider matching ranges better.') );
    }
  }
  renderWarningsAndAgg(extra);
}

/* ---------- init ---------- */
window.addEventListener('load', () => {
  populateSpeciesSelect();

  const addBtn = document.getElementById('addFish');
  const resetBtn = document.getElementById('reset');

  addBtn?.addEventListener('click', ()=>{
    const sel = document.getElementById('fishSelect');
    const qtyEl = document.getElementById('fQty');
    const recEl = document.getElementById('recMin');

    const name = sel?.value || '';
    if (!name) return;

    const userQty = parseInt(qtyEl?.value, 10);
    const recMin  = parseInt(recEl?.value, 10) || 1;
    const qty = (!isNaN(userQty) && userQty >= 1) ? userQty : recMin;

    const existing = stock.find(f => canon(f.name) === canon(name));
    if (existing) existing.qty += qty;
    else stock.push({ name, qty, min: recMin });

    if (qtyEl) qtyEl.value = '';
    renderAll();
  });

  resetBtn?.addEventListener('click', ()=>{
    stock = [];
    renderAll();
  });

  // Tank controls (capacity hooks if you later add their effects)
  ['gallons','planted','filtration'].forEach(id=>{
    const el = document.getElementById(id);
    el?.addEventListener('input', renderAll);
    el?.addEventListener('change', renderAll);
  });

  renderAll();
});