// js/modules/app.js
// FishkeepingLifeCo — App bootstrap (wires UI + bars + warnings-bubbles)

import { renderWarnings } from './warnings.js';

/* ========== tiny utils (local) ========== */
function toArray(x){ return Array.isArray(x) ? x : x ? [x] : []; }
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function canonName(s){
  return norm(s)
    .replace(/\s*\([^)]*\)\s*/g,' ')
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function safeQty(raw){
  if (typeof raw === 'number' && Number.isFinite(raw)){
    let n = Math.floor(raw);
    if (n < 1) n = 1;
    if (n > 999) n = 999;
    return n;
  }
  const s = (raw==null ? '' : String(raw)).replace(/[^\d]/g,'').slice(0,3);
  let n2 = parseInt(s,10);
  if (isNaN(n2) || n2 < 1) n2 = 1;
  if (n2 > 999) n2 = 999;
  return n2;
}
function formatName(raw){
  if(!raw) return '';
  return String(raw)
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/\b\w/g,c=>c.toUpperCase());
}

/* ========== species select ========== */
function extractSpeciesList(src){
  if (Array.isArray(src)) {
    return src.map(o=>{
      const name = (o && (o.name||o.species||o.common)) || '';
      const min  = parseInt((o && (o.min||o.recommendedMinimum||o.minGroup||o.group)) || '0',10) || 0;
      return name ? { name, min } : null;
    }).filter(Boolean);
  }
  if (src && typeof src==='object') {
    return Object.keys(src).map(k=>{
      const v = src[k]||{};
      const min = parseInt(v.min || v.recommendedMinimum || v.minGroup || '0',10) || 0;
      return { name:k, min };
    });
  }
  return [];
}

function populateSelectIfEmpty(){
  const sel = document.getElementById('fishSelect');
  if (!sel || sel.options.length) return;

  const src = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
  let list = extractSpeciesList(src);
  if (!list.length){
    list = [
      { name:'Neon tetra', min:6 },
      { name:'Tiger barb', min:6 },
      { name:'Corydoras (small)', min:6 },
      { name:'Betta (male)', min:1 }
    ];
  }
  list.sort((a,b)=> a.name.localeCompare(b.name));
  list.forEach(item=>{
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.textContent = item.name;
    opt.dataset.min = item.min || 1;
    sel.appendChild(opt);
  });

  // keep recMin in sync on list/search change (never override user qty)
  const search   = document.getElementById('fishSearch');
  const recMinEl = document.getElementById('recMin');
  function updateRecMinOnly(){
    const opt = sel.selectedOptions[0];
    const min = opt ? parseInt(opt.dataset.min || '1', 10) || 1 : 1;
    if (recMinEl) recMinEl.value = min;
  }
  if (search){
    search.addEventListener('input', function(){
      const q = (this.value||'').toLowerCase();
      Array.from(sel.options).forEach(o=>{
        o.hidden = !!q && !o.textContent.toLowerCase().includes(q);
      });
      const first = Array.from(sel.options).find(o=>!o.hidden);
      if (first){ sel.value = first.value; updateRecMinOnly(); }
    });
  }
  sel.addEventListener('change', updateRecMinOnly);
  updateRecMinOnly();
}

/* ========== stock table helpers ========== */
function findRowByName(name){
  const want = canonName(name);
  const rows = document.querySelectorAll('#tbody tr');
  for (let i=0;i<rows.length;i++){
    const n = canonName(rows[i].querySelector('td')?.textContent||'');
    if (n === want) return rows[i];
  }
  return null;
}
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
function addRow(name, qty){
  const tbody=document.getElementById('tbody');
  const tr=document.createElement('tr');
  tr.classList.add('row-appear');

  const tdName=document.createElement('td');
  tdName.textContent = formatName(name);

  const tdQty=document.createElement('td');
  const input=document.createElement('input');
  input.type='number'; input.min='0'; input.step='1'; input.inputMode='numeric';
  input.style.width='64px'; input.value=qty;
  input.addEventListener('input', renderAll);
  input.addEventListener('change', renderAll);
  tdQty.appendChild(input);

  const tdAct=document.createElement('td'); tdAct.style.textAlign='right';
  const bMinus=document.createElement('button'); bMinus.textContent='−'; bMinus.className='btn'; bMinus.style.marginRight='6px'; bMinus.type='button';
  const bPlus=document.createElement('button');  bPlus.textContent='+';  bPlus.className='btn';  bPlus.style.marginRight='6px';  bPlus.type='button';
  const bDel=document.createElement('button');   bDel.textContent='Delete'; bDel.className='btn'; bDel.style.background='var(--bad)'; bDel.type='button';

  bMinus.addEventListener('click', ()=>{
    let v=safeQty(input.value);
    v=Math.max(0, v-1); input.value=v;
    if(v===0) tr.remove();
    renderAll();
  });
  bPlus.addEventListener('click', ()=>{ input.value=safeQty(input.value)+1; renderAll(); });
  bDel.addEventListener('click', ()=>{ tr.remove(); renderAll(); });

  tdAct.appendChild(bMinus); tdAct.appendChild(bPlus); tdAct.appendChild(bDel);

  tr.appendChild(tdName); tr.appendChild(tdQty); tr.appendChild(tdAct);
  tbody.appendChild(tr);
}
function addOrUpdateRow(name, deltaQty){
  const tr = findRowByName(name);
  if (tr){
    const qtyInput = tr.querySelector('td:nth-child(2) input');
    let v = safeQty(qtyInput.value);
    v = v + deltaQty;
    if (v <= 0){ tr.remove(); renderAll(); return; }
    qtyInput.value = v;
    renderAll(); return;
  }
  if (deltaQty <= 0) return;
  addRow(name, deltaQty);
  renderAll();
}

/* ========== bioload bar ========== */
function unitsFor(name){
  // Prefer "points" from FISH_DATA; fallback to heuristic by size keywords
  const key = canonName(name);
  const data = window.FISH_DATA || [];
  let row = Array.isArray(data) ? data.find(r => canonName(r.name||r.id||'')===key) : null;
  if (!row && Array.isArray(data)){
    row = data.find(r => {
      const n = canonName(r.name||r.id||'');
      return n.includes(key) || key.includes(n);
    });
  }
  if (row && typeof row.points === 'number') return Math.max(0, row.points);

  // very rough fallback weights
  const n = key;
  if (/(shrimp|snail)/.test(n)) return 0.3;
  if (/(ember|neon|chili|harlequin|white cloud|danio)/.test(n)) return 0.8;
  if (/(guppy|platy|molly|cory|kuhli|otocinclus)/.test(n)) return 1.6;
  if (/(tetra|barb|rasbora)/.test(n)) return 2.0;
  if (/(gourami)/.test(n)) return 5.0;
  if (/(pleco|angelfish|rainbow)/.test(n)) return 7.0;
  return 2.0;
}
function totalBioUnits(){
  return readStock().reduce((sum, it)=> sum + unitsFor(it.name) * it.qty, 0);
}
function capacityUnits(){
  const gallons = parseFloat(document.getElementById('gallons')?.value || '0') || 0;
  const planted = !!document.getElementById('planted')?.checked;
  const filtSel = document.getElementById('filtration');
  const filt = (filtSel && filtSel.value) || 'standard';
  const perGal = 0.9;
  const filtFactor = (filt==='low') ? 0.80 : (filt==='high') ? 1.25 : 1.0;
  const plantedBonus = planted ? 1.10 : 1.0;
  return Math.max(1, gallons * perGal) * filtFactor * plantedBonus;
}
function renderBioload(){
  const bar=document.getElementById('bioBarFill');
  if(!bar) return;
  const total = totalBioUnits();
  const cap   = capacityUnits();
  const pct = Math.max(0, Math.min(160, (total / cap) * 100));
  bar.style.width = pct.toFixed(1) + '%';
  bar.classList.remove('pulse'); void bar.offsetHeight; bar.classList.add('pulse');
}

/* ========== environment (Temp & pH overlap) ========== */
function getSpeciesRanges(name){
  const key = canonName(name);
  const data = window.FISH_DATA || [];
  let row = Array.isArray(data) ? data.find(r => canonName(r.name||r.id||'')===key) : null;
  if (!row && Array.isArray(data)){
    row = data.find(r => {
      const n = canonName(r.name||r.id||'');
      return n.includes(key) || key.includes(n);
    });
  }
  const temp = Array.isArray(row?.temp) && row.temp.length===2 ? row.temp : null;
  const ph   = Array.isArray(row?.ph)   && row.ph.length===2   ? row.ph   : null;
  return { temp, ph };
}
function overlap1D(a, b){
  if (!a || !b) return 0;
  const [a1,a2] = a, [b1,b2] = b;
  const lo = Math.max(a1,b1);
  const hi = Math.min(a2,b2);
  return Math.max(0, hi - lo);
}
function rangeWidth(r){ return r ? Math.max(0, r[1]-r[0]) : 0; }
function pairFit(aRanges, bRanges){
  // ratio overlap of temp & ph; simple average
  const tempOv = overlap1D(aRanges.temp, bRanges.temp);
  const phOv   = overlap1D(aRanges.ph,   bRanges.ph);
  const tempDen = Math.max(rangeWidth(aRanges.temp), rangeWidth(bRanges.temp), 1);
  const phDen   = Math.max(rangeWidth(aRanges.ph),   rangeWidth(bRanges.ph),   1);
  const tempFit = tempOv / tempDen;
  const phFit   = phOv / phDen;
  return (tempFit + phFit) / 2; // 0..1
}
function renderEnvironment(){
  const bar = document.getElementById('envBarFill');
  if (!bar) return;

  const stock = readStock();
  if (stock.length <= 1){
    bar.style.width = '0%';
    bar.classList.remove('pulse'); void bar.offsetHeight; bar.classList.add('pulse');
    return;
  }

  // compute average pairwise fit across all unique pairs
  const pairs = [];
  for (let i=0;i<stock.length;i++){
    for (let j=i+1;j<stock.length;j++){
      const A = getSpeciesRanges(stock[i].name);
      const B = getSpeciesRanges(stock[j].name);
      if (!A.temp && !A.ph) continue;
      if (!B.temp && !B.ph) continue;
      pairs.push(pairFit(A,B));
    }
  }
  if (!pairs.length){
    // no data → show neutral (20%) so it "builds up" as data becomes available
    bar.style.width = '20%';
    bar.classList.remove('pulse'); void bar.offsetHeight; bar.classList.add('pulse');
    return;
  }

  const avg = pairs.reduce((s,x)=>s+x,0) / pairs.length; // 0..1 (1 = perfect)
  // Convert to "poor fit" bar (0 = good, 100 = poor) to match your High on right label
  const poor = (1 - avg) * 100;
  bar.style.width = Math.max(0, Math.min(100, poor)).toFixed(0) + '%';
  bar.classList.remove('pulse'); void bar.offsetHeight; bar.classList.add('pulse');
}

/* ========== renderAll ========== */
function renderAll(){
  renderWarnings();     // bubbles + aggression bar
  renderBioload();      // bioload bar
  renderEnvironment();  // temp/pH fit bar
}

/* ========== boot ========== */
window.addEventListener('load', () => {
  populateSelectIfEmpty();

  // Re-bind buttons cleanly (avoid duplicate handlers after hot reloads)
  function replaceWithClone(el){
    if (!el) return el;
    const clone = el.cloneNode(true);
    el.replaceWith(clone);
    return clone;
  }

  const addBtn   = replaceWithClone(document.getElementById('addFish'));
  const resetBtn = replaceWithClone(document.getElementById('reset'));
  const sel      = document.getElementById('fishSelect');
  const qtyEl    = document.getElementById('fQty');
  const recEl    = document.getElementById('recMin');

  function getQtyFromField(){
    if (qtyEl && Number.isFinite(qtyEl.valueAsNumber)) {
      return safeQty(qtyEl.valueAsNumber);
    }
    const raw = (qtyEl && typeof qtyEl.value === 'string') ? qtyEl.value : '';
    return safeQty(raw);
  }

  function handleAdd(e){
    if (e){ e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    const name = sel && sel.value ? sel.value : '';
    if (!name) return;

    const fieldRaw = qtyEl ? qtyEl.value : '';
    const hasUserValue = fieldRaw != null && String(fieldRaw).trim().length > 0;
    const qty = hasUserValue ? getQtyFromField()
                             : safeQty(recEl && recEl.value ? recEl.value : '1');

    addOrUpdateRow(name, qty);
  }

  if (addBtn)  addBtn.addEventListener('click', handleAdd, true);
  if (qtyEl)   qtyEl.addEventListener('keydown', e=>{ if(e.key==='Enter') handleAdd(e); });

  if (resetBtn){
    resetBtn.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      document.getElementById('tbody').innerHTML='';
      renderAll();
    }, true);
  }

  // Recompute bars when tank settings change
  ['gallons','planted','filtration'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', renderAll);
    el.addEventListener('change', renderAll);
  });

  renderAll();
});