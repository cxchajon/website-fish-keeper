/* FishkeepingLifeCo — Stocking Calculator App
 * Build v8.7.0 — Externalized JS, Safari-safe quantity reading
 */

/* ---------- Utilities ---------- */
function toArray(x){ return Array.isArray(x) ? x : x ? [x] : []; }
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function canonName(s){
  return norm(s).replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\s*\([^)]*\)\s*/g,' ').trim();
}

/* ---------- Status strip ---------- */
(function statusCheck(){
  const diag = document.getElementById('diag');
  if (!diag) return;
  const box = diag.querySelector('div');
  function show(ok,msg){ diag.className = ok ? 'ok' : 'err'; box.textContent = msg; }
  const issues = [];
  if (!document.getElementById('fishSelect')) issues.push('Species dropdown missing');
  if (!document.getElementById('tbody')) issues.push('Table body missing');
  const fishData = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
  if (!fishData) issues.push('No global species list found');
  if (issues.length) show(false, 'Issues: '+issues.join(' | '));
  else show(true, 'Core OK • Safety adapter ready');
})();

/* ---------- Species list population ---------- */
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

  // Keep Rec Min in sync (NEVER touch Quantity field)
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

/* ---------- Stock table helpers ---------- */
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

  const tdName=document.createElement('td'); tdName.textContent=name;

  const tdQty=document.createElement('td');
  const input=document.createElement('input');
  input.type='number'; input.min='0'; input.step='1'; input.inputMode='numeric'; input.style.width='64px';
  input.value= qty;
  input.addEventListener('change', renderAll);
  input.addEventListener('input', renderAll);
  tdQty.appendChild(input);

  const tdAct=document.createElement('td'); tdAct.style.textAlign='right';
  const bMinus=document.createElement('button'); bMinus.textContent='−'; bMinus.className='btn'; bMinus.style.marginRight='6px'; bMinus.type='button';
  const bPlus=document.createElement('button'); bPlus.textContent='+'; bPlus.className='btn'; bPlus.style.marginRight='6px'; bPlus.type='button';
  const bDel=document.createElement('button');  bDel.textContent='Delete'; bDel.className='btn'; bDel.style.background='var(--bad)'; bDel.type='button';

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
    const name=(tds[0]?.textContent||'').trim();
    const qtyEl=tds[1]?.querySelector('input');
    const qty=safeQty(qtyEl && qtyEl.value ? qtyEl.value : '0');
    return name ? {name, qty} : null;
  }).filter(Boolean);
}

/* ---------- Quantity parsing & clamp (Safari-safe) ---------- */
function safeQty(raw){
  // Numeric path first (valueAsNumber on Safari iOS without blur)
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    let n = Math.floor(raw);
    if(n < 1) n = 1;
    if(n > 999) n = 999;
    return n;
  }
  // String path
  const s = (raw==null ? '' : String(raw)).replace(/[^\d]/g,'').slice(0,3);
  let n2 = parseInt(s,10);
  if(isNaN(n2) || n2 < 1) n2 = 1;
  if(n2 > 999) n2 = 999;
  return n2;
}

/* ---------- Bioload (size-weighted) ---------- */
function lookupDataFor(name){
  const key = canonName(name);
  const src = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
  if (!src) return null;

  if (Array.isArray(src)) {
    for (let i=0;i<src.length;i++){
      const row = src[i] || {};
      const n = canonName(row.name || row.species || row.common || '');
      if (n === key) return row;
    }
  } else if (typeof src === 'object') {
    const row = src[name] || src[key] || null;
    if (row) return row;
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
  const explicit = row && (row.bioUnits || row.bioload || row.bio_load);
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
function renderBioload(){
  const bar=document.getElementById('bioBarFill');
  if(!bar) return;
  const total = totalBioUnits();
  const cap   = capacityUnits();
  const pct = Math.max(0, Math.min(160, (total / cap) * 100));
  bar.style.width = pct.toFixed(1) + '%';
}

/* ---------- Warnings & Aggression ---------- */
function renderWarnings(){
  const box=document.getElementById('aggression-warnings')||document.getElementById('warnings');
  if(!box) return;
  box.innerHTML='';
  const stock=readStock();

  const opts = {
    planted: !!document.getElementById('planted')?.checked,
    gallons: parseFloat(document.getElementById('gallons')?.value || '0') || 0
  };

  let res={ warnings:[], score:0 };
  if(window.Aggression && typeof window.Aggression.compute==='function'){
    try{ res=window.Aggression.compute(stock, opts); } catch(e){}
  }
  toArray(res.warnings).forEach(w=>{
    const d=document.createElement('div');
    d.textContent=w;
    box.appendChild(d);
  });
  const bar=document.getElementById('aggBarFill');
  if(bar && typeof res.score==='number'){ bar.style.width=Math.min(100, Math.max(0,res.score))+'%'; }
}

function renderAll(){
  renderWarnings();
  renderBioload();
}

/* ---------- Boot & Events ---------- */
window.addEventListener('load', function(){
  populateSelectIfEmpty();

  // Purge potential conflicting handlers by cloning buttons
  function replaceWithClone(el){
    const clone = el.cloneNode(true);
    el.replaceWith(clone);
    return clone;
  }

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

  addBtn.addEventListener('click', handleAdd, true); // capture = out-prioritize others
  if(qtyEl){
    qtyEl.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ handleAdd(e); }
    });
  }

  if(resetBtn){
    resetBtn.addEventListener('click', function(e){
      if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }
      document.getElementById('tbody').innerHTML='';
      renderAll();
    }, true);
  }

  // Tank controls update bars
  ['gallons','planted','filtration'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', renderAll);
    el.addEventListener('change', renderAll);
  });

  renderAll();
});