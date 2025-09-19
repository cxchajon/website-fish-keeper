// js/modules/app.js
// FishkeepingLifeCo — App glue
// - Wires DOM to data, warnings, and bars with defensive fallbacks.

import { toArray, norm, canonName, safeQty, formatName } from './utils.js';
import { Environment } from './warnings.js';

/* -------------------------------------------------------
   Species helpers (reads from window.FISH_DATA)
------------------------------------------------------- */
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

  const src  = window.FISH_DATA || [];
  let list   = extractSpeciesList(src);

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

  const search   = document.getElementById('fishSearch');
  const recMinEl = document.getElementById('recMin');

  function updateRecMinOnly(){
    const opt = sel.selectedOptions[0];
    const min = opt ? parseInt(opt.dataset.min || '1', 10) || 1 : 1;
    if(recMinEl) recMinEl.value = min;
  }

  if(search){
    search.addEventListener('input', function(){
      const q=(this.value||'').toLowerCase();
      Array.from(sel.options).forEach(o=>{
        o.hidden=q && !o.textContent.toLowerCase().includes(q);
      });
      const first = Array.from(sel.options).find(o=>!o.hidden);
      if(first){ sel.value=first.value; updateRecMinOnly(); }
    });
  }

  sel.addEventListener('change', updateRecMinOnly);
  updateRecMinOnly();
}

/* -------------------------------------------------------
   Stock table helpers
------------------------------------------------------- */
function findRowByName(name){
  const want=canonName(name);
  const rows=document.querySelectorAll('#tbody tr');
  for(let i=0;i<rows.length;i++){
    const n=canonName(rows[i].querySelector('td')?.textContent||'');
    if(n===want) return rows[i];
  }
  return null;
}

function addRow(name, qty){
  const tbody=document.getElementById('tbody');
  const tr=document.createElement('tr');
  tr.classList.add('row-appear');

  const tdName=document.createElement('td');
  tdName.textContent = formatName(name);

  const tdQty=document.createElement('td');
  const input=document.createElement('input');
  input.type='number'; input.min='0'; input.step='1'; input.inputMode='numeric'; input.style.width='64px';
  input.value= qty;
  input.addEventListener('change', renderAll);
  input.addEventListener('input',  renderAll);
  tdQty.appendChild(input);

  const tdAct=document.createElement('td'); tdAct.style.textAlign='right';
  const bMinus=document.createElement('button'); bMinus.textContent='−'; bMinus.className='btn'; bMinus.style.marginRight='6px'; bMinus.type='button';
  const bPlus=document.createElement('button');  bPlus.textContent='+';  bPlus.className='btn';  bPlus.style.marginRight='6px';  bPlus.type='button';
  const bDel=document.createElement('button');   bDel.textContent='Delete'; bDel.className='btn'; bDel.style.background='var(--bad)'; bDel.type='button';

  bMinus.addEventListener('click', function(){
    let v=safeQty(input.value);
    v=Math.max(0, v-1); input.value=v;
    if(v===0) tr.remove();
    renderAll();
  });
  bPlus.addEventListener('click', function(){ input.value=safeQty(input.value)+1; renderAll(); });
  bDel.addEventListener('click', function(){ tr.remove(); renderAll(); });

  tdAct.appendChild(bMinus); tdAct.appendChild(bPlus); tdAct.appendChild(bDel);

  tr.appendChild(tdName); tr.appendChild(tdQty); tr.appendChild(tdAct);
  tbody.appendChild(tr);
}

function addOrUpdateRow(name, deltaQty){
  let tr=findRowByName(name);
  if(tr){
    const qtyInput=tr.querySelector('td:nth-child(2) input');
    let v=safeQty(qtyInput.value);
    v=v+deltaQty;
    if(v<=0){ tr.remove(); renderAll(); return; }
    qtyInput.value=v;
    renderAll(); return;
  }
  if(deltaQty<=0) return;
  addRow(name, deltaQty);
  renderAll();
}

function readStock(){
  const tbody=document.getElementById('tbody');
  return Array.from(tbody.querySelectorAll('tr')).map(tr=>{
    const tds=tr.querySelectorAll('td');
    const rawName=(tds[0]?.textContent||'').trim(); // already formatted for display
    const qtyEl=tds[1]?.querySelector('input');
    const qty=safeQty(qtyEl && qtyEl.value ? qtyEl.value : '0');
    return rawName ? { name: rawName, qty } : null;
  }).filter(Boolean);
}

/* -------------------------------------------------------
   Bioload (local heuristic, safe defaults)
------------------------------------------------------- */
function lookupDataFor(name){
  const key = canonName(name);
  const src = window.FISH_DATA || [];
  for (let i=0;i<src.length;i++){
    const row = src[i] || {};
    const n = canonName(row.name || row.species || row.common || row.id || '');
    if (n === key) return row;
  }
  return null;
}
function parseInches(val){
  if (val == null) return 0;
  const s = String(val);
  const m = s.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}
function heuristicUnits(name){
  const n = canonName(name);
  if (/(shrimp|snail|daphnia|microrasbora|celestial pearl|cpd)/i.test(n)) return 0.2;
  if (/(ember tetra|neon tetra|cardinal tetra|harlequin rasbora|endlers?)/i.test(n)) return 0.6;
  if (/(guppy|platy|molly|danio|white cloud|corydoras|cory|kuhli)/i.test(n)) return 0.9;
  if (/(tetra|barb|rasbora)/i.test(n)) return 1.0;
  if (/(gourami|angelfish|rainbowfish|kribensis|ram|apistogramma)/i.test(n)) return 1.8;
  if (/(bristlenose|pleco|swordtail|larger rainbowfish)/i.test(n)) return 2.5;
  if (/(goldfish|oscar|severum|jack dempsey|convict|flowerhorn|common pleco)/i.test(n)) return 5.0;
  return 1.0;
}
function unitsFor(name){
  const row = lookupDataFor(name);
  const explicit = row && (row.bioUnits || row.bioload || row.bio_load || row.points);
  if (explicit && !isNaN(Number(explicit))) return Number(explicit);
  const maxIn = row && (row.maxInches || row.sizeInches || row.maxSizeIn || row.max_in);
  const inches = parseInches(maxIn);
  if (inches){
    if (inches <= 1.0) return 0.25;
    if (inches <= 1.5) return 0.5;
    if (inches <= 2.0) return 0.8;
    if (inches <= 3.0) return 1.1;
    if (inches <= 4.0) return 1.6;
    if (inches <= 5.0) return 2.2;
    if (inches <= 6.0) return 3.0;
    if (inches <= 8.0) return 4.2;
    return 5.5;
  }
  return heuristicUnits(name);
}
function totalBioUnits(){
  return readStock().reduce((sum, item)=> sum + unitsFor(item.name) * (item.qty||0), 0);
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

/* -------------------------------------------------------
   Bars + Warnings
------------------------------------------------------- */
function renderBioload(){
  const bar=document.getElementById('bioBarFill');
  if(!bar) return;
  const total = totalBioUnits();
  const cap   = capacityUnits();
  const pct = Math.max(0, Math.min(160, (total / cap) * 100));
  bar.style.width = pct.toFixed(1) + '%';
  bar.classList.remove('pulse'); void bar.offsetWidth; bar.classList.add('pulse');
}

function renderAggressionAndEnv(){
  // Aggression (from legacy window.Aggression if present)
  let aggScore = 0;
  let aggWarnings = [];
  try{
    if(window.Aggression && typeof window.Aggression.compute==='function'){
      const stock = readStock();
      const opts = {
        planted: !!document.getElementById('planted')?.checked,
        gallons: parseFloat(document.getElementById('gallons')?.value || '0') || 0
      };
      const res = window.Aggression.compute(stock, opts) || {};
      aggScore = Math.max(0, Math.min(100, Number(res.score)||0));
      aggWarnings = toArray(res.warnings);
    }
  }catch(_e){}

  // Environmental overlap (pairwise) — from our warnings module
  const envRes = Environment.compute(readStock());
  const envScore = Math.max(0, Math.min(100, Number(envRes.score)||0));
  const envWarnings = toArray(envRes.warnings);

  // Bars
  const aggBar=document.getElementById('aggBarFill');
  if(aggBar){ aggBar.style.width = aggScore + '%'; }

  const envBar=document.getElementById('envBarFill');
  if(envBar){ envBar.style.width = envScore + '%'; envBar.classList.remove('pulse'); void envBar.offsetWidth; envBar.classList.add('pulse'); }

  // Warnings UI — share the same panel for now
  const box=document.getElementById('aggression-warnings');
  if(box){
    box.innerHTML='';
    // Aggression warnings first
    aggWarnings.forEach(w=>{
      const d=document.createElement('div');
      d.textContent=w;
      box.appendChild(d);
    });
    // Then environmental warnings (prefixed)
    envWarnings.forEach(w=>{
      const d=document.createElement('div');
      d.textContent = w; // already has "temperature" / "pH" in message
      box.appendChild(d);
    });
  }
}

function renderAll(){
  renderBioload();
  renderAggressionAndEnv();
}

/* -------------------------------------------------------
   Boot
------------------------------------------------------- */
function replaceWithClone(el){
  if(!el) return el;
  const clone = el.cloneNode(true);
  el.replaceWith(clone);
  return clone;
}

window.addEventListener('load', function(){
  populateSelectIfEmpty();

  const addBtn   = replaceWithClone(document.getElementById('addFish'));
  const resetBtn = replaceWithClone(document.getElementById('reset'));
  const qtyEl    = document.getElementById('fQty');
  const recEl    = document.getElementById('recMin');
  const sel      = document.getElementById('fishSelect');

  function getQtyFromField(){
    if (qtyEl && Number.isFinite(qtyEl.valueAsNumber)) {
      return safeQty(qtyEl.valueAsNumber);
    }
    const raw = (qtyEl && typeof qtyEl.value==='string') ? qtyEl.value : '';
    return safeQty(raw);
  }

  function handleAdd(e){
    if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    const name = sel && sel.value ? sel.value : '';
    if(!name) return;

    const fieldRaw = qtyEl ? qtyEl.value : '';
    const hasUserValue = fieldRaw != null && String(fieldRaw).trim().length > 0;
    const qty = hasUserValue ? getQtyFromField()
                             : safeQty(recEl && recEl.value ? recEl.value : '1');

    addOrUpdateRow(name, qty);
  }

  if(addBtn) addBtn.addEventListener('click', handleAdd, true);
  if(qtyEl){
    qtyEl.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ handleAdd(e); }
    });
  }
  if(resetBtn){
    resetBtn.addEventListener('click', function(e){
      if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }
      const tbody=document.getElementById('tbody');
      if(tbody) tbody.innerHTML='';
      renderAll();
    }, true);
  }

  // Tank controls update bars + env checks
  ['gallons','planted','filtration'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', renderAll);
    el.addEventListener('change', renderAll);
  });

  renderAll();
});