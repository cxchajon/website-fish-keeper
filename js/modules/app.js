/* FishkeepingLifeCo — Core logic (v1.0.3)
   Changes:
   - Stricter bioload baseline: 0.5 × gallons.
   - High filtration now multiplies capacity by 1.1 (not 1.25).
   - Planted and low filtration multipliers unchanged (1.15 for planted; 0.75 for low).
   - Aggression still maxes out when Betta is paired with fin-nippers/Tiger Barbs.
*/

'use strict';

// ---------- Helpers ----------
const $ = (sel) => /** @type {HTMLElement} */(document.querySelector(sel));
const clamp   = (n,min,max) => Math.min(Math.max(n,min),max);
const toInt   = (v,def=0) => { const n = Number.parseInt(String(v),10); return Number.isFinite(n) ? n : def; };
const toNum   = (v,def=0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
const save    = (k,v) => localStorage.setItem(k,JSON.stringify(v));
const load    = (k,fallback) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; } catch { return fallback; } };
function animateFromZero(el,pct){
  el.style.transition='none';
  el.style.width='0%';
  void el.offsetWidth;
  el.style.transition='width 1.2s ease';
  el.style.width = `${clamp(pct,0,100)}%`;
  el.classList.remove('green','yellow','red');
  if (pct < 60) el.classList.add('green');
  else if (pct < 85) el.classList.add('yellow');
  else el.classList.add('red');
}
function avg(arr){ return arr.reduce((sum,x)=>sum+x,0) / (arr.length || 1); }
function intersectRange(a,b){
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  return (lo <= hi) ? [lo, hi] : null;
}
function intersectionAll(ranges){
  if (!ranges.length) return null;
  let cur = [...ranges[0]];
  for (let i=1; i<ranges.length; i++){
    const next = intersectRange(cur, ranges[i]);
    if (!next) return null;
    cur = next;
  }
  return cur;
}
function midpoint([a,b]){ return (a+b)/2; }
function distanceToRange(x,[a,b]){
  if (x < a) return a - x;
  if (x > b) return x - b;
  return 0;
}
function gapBetweenRanges([a1,a2],[b1,b2]){
  if (a2 < b1) return b1 - a2;
  if (b2 < a1) return a1 - b2;
  return 0;
}

// ---------- DB ----------
const DB = (globalThis.FISH_DB && Array.isArray(globalThis.FISH_DB) && globalThis.FISH_DB.length) ? globalThis.FISH_DB : [];

// ---------- DOM refs ----------
const gallonsEl    = $('#gallons');
const filtrationEl = $('#filtration');
const plantedEl    = $('#planted');
const fishSearchEl = $('#fishSearch');
const fishSelectEl = $('#fishSelect');
const qtyEl        = $('#fQty');
const recMinEl     = $('#recMin');
const addBtn       = $('#addFish');
const resetBtn     = $('#reset');

const tbody     = $('#tbody');
const bioBar    = $('#bioBar');
const bioBadge  = $('#bioBadge');
const envBar    = $('#envBar');
const recTempEl = $('#recTemp');
const recPHEl   = $('#recPH');
const aggBar    = $('#aggBar');
const warnBio   = $('#warn-bio');
const warnAgg   = $('#warn-agg');
const warnEnv   = $('#warn-env');
const noMatchEl = $('#noMatch');

// ---------- State ----------
const LS_KEY = 'flc_stock_v1';
let stock = load(LS_KEY, []);
let filterQuery = '';

// ---------- Setup ----------
document.addEventListener('DOMContentLoaded', () => {
  populateSelect();
  updateRecMin();
  renderAll();

  fishSearchEl.addEventListener('input', onSearch);
  fishSelectEl.addEventListener('change', updateRecMin);
  addBtn.addEventListener('click', onAdd);
  resetBtn.addEventListener('click', onReset);

  gallonsEl.addEventListener('input', renderAll);
  filtrationEl.addEventListener('change', renderAll);
  plantedEl.addEventListener('change', renderAll);
});

// ---------- Functions ----------
function filteredSpecies(){
  const q = filterQuery.trim().toLowerCase();
  if (!q) return DB;
  return DB.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.advisory || '').toLowerCase().includes(q)
  );
}
function populateSelect(){
  const list = filteredSpecies();
  fishSelectEl.innerHTML='';
  noMatchEl.hidden = true;
  if (!list.length){
    noMatchEl.hidden=false;
    return;
  }
  for (const s of list){
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    fishSelectEl.appendChild(opt);
  }
  fishSelectEl.value = list[0].id;
}
function onSearch(e){
  filterQuery = String(e.target.value || '');
  const prev = fishSelectEl.value;
  populateSelect();
  if ([...fishSelectEl.options].some(o => o.value === prev)) fishSelectEl.value = prev;
  updateRecMin();
}
function getRecMinFor(id){
  const s = DB.find(x => x.id === id);
  if (!s) return 1;
  if (s.soloOK) return 1;
  return s.schoolMin ? clamp(toInt(s.schoolMin,1),1,99) : 1;
}
function updateRecMin(){
  const id = fishSelectEl.value;
  recMinEl.value = getRecMinFor(id || '');
}
function onAdd(){
  const id = fishSelectEl.value;
  if (!id) return;
  const typed = qtyEl.value;
  const qtyTyped = toInt(typed, NaN);
  const recMin   = getRecMinFor(id);
  const qty      = Number.isFinite(qtyTyped) && qtyTyped > 0 ? qtyTyped : (recMin || 1);
  const idx      = stock.findIndex(x => x.id === id);
  if (idx >= 0) stock[idx].qty = clamp(toInt(stock[idx].qty,0)+qty,1,999);
  else stock.push({ id, qty: clamp(qty,1,999) });
  save(LS_KEY, stock);
  renderAll();
}
function onReset(){
  if (!stock.length) return;
  if (confirm('Clear all stocked species?')){
    stock = [];
    save(LS_KEY, stock);
    renderAll();
  }
}
function inc(id, delta){
  const i = stock.findIndex(x => x.id === id);
  if (i < 0) return;
  stock[i].qty = clamp(toInt(stock[i].qty,1) + delta, 1, 999);
  save(LS_KEY, stock);
  renderAll();
}
function removeRow(id){
  stock = stock.filter(x => x.id !== id);
  save(LS_KEY, stock);
  renderAll();
}

function renderAll(){
  renderTable();
  renderMetricsAndWarnings();
}
function renderTable(){
  tbody.innerHTML='';
  if (!stock.length){
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan=3;
    td.className='empty-cell';
    td.textContent='No fish added yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  for (const entry of stock){
    const s = DB.find(x => x.id === entry.id);
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.textContent = s ? s.name : entry.id;
    if (s?.advisory){
      const small = document.createElement('div');
      small.className='help';
      small.textContent = s.advisory;
      nameTd.appendChild(small);
    }
    const qtyTd = document.createElement('td');
    qtyTd.className='qty';
    qtyTd.textContent=String(entry.qty);
    const actionsTd = document.createElement('td');
    actionsTd.className='actions';
    const minus = document.createElement('button');
    minus.className='mini';
    minus.type='button';
    minus.textContent='−';
    minus.addEventListener('click', () => inc(entry.id,-1));
    const plus = document.createElement('button');
    plus.className='mini';
    plus.type='button';
    plus.textContent='+';
    plus.addEventListener('click', () => inc(entry.id,+1));
    const del = document.createElement('button');
    del.className='mini';
    del.type='button';
    del.textContent='Remove';
    del.addEventListener('click', () => removeRow(entry.id));
    actionsTd.append(minus, plus, del);
    tr.append(nameTd, qtyTd, actionsTd);
    tbody.appendChild(tr);
  }
}

function renderMetricsAndWarnings(){
  warnBio.innerHTML='';
  warnAgg.innerHTML='';
  warnEnv.innerHTML='';
  bioBadge.hidden=true;

  if (!stock.length){
    bubble(warnBio,'No stock yet — this is where bioload warnings will appear.','note');
    bubble(warnAgg,'No stock yet — this is where compatibility warnings will appear.','note');
    bubble(warnEnv,'No stock yet — this is where environmental fit warnings will appear.','note');
  }

  const entries = stock.map(e => ({ ...e, s: DB.find(x => x.id === e.id) })).filter(e => e.s);

  // Bioload
  const gallons = clamp(toNum(gallonsEl.value,20),1,9999);
  let capacity  = gallons * 0.5;   // stricter baseline
  const filtration = filtrationEl.value;
  if (filtration === 'low')  capacity *= 0.75;
  if (filtration === 'high') capacity *= 1.10;  // high filtration less generous now
  const planted = !!plantedEl.checked;
  if (planted) capacity *= 1.15;
  const totalBioload = entries.reduce((sum,e) => sum + toNum(e.s.bioload,0.3)* toInt(e.qty,1), 0);
  const bioloadPctMath = capacity > 0 ? (totalBioload/capacity)*100 : 0;
  const bioloadPct = clamp(bioloadPctMath,0,999);
  animateFromZero(bioBar, clamp(bioloadPct,0,100));
  if (bioloadPct >= 75 && bioloadPct < 100){
    bubble(warnBio,`Bioload ${Math.round(bioloadPct)}% — keep ~25% buffer. Consider upgrading filtration${planted?'':' or adding plants'}.`,'warn');
  }
  if (bioloadPct >= 100){
    bubble(warnBio,'Bioload maxed — reduce stock, upgrade filtration, or move to a larger tank.','bad');
    showBadge(bioBadge,'OVER','bad');
  }

  // Environmental
  const temps = entries.map(e => e.s.temp || [72,82]);
  const phs   = entries.map(e => e.s.pH   || [6.0,7.8]);
  let tempSetpoint = null;
  let tempCompromise=false;
  const tempOverlap = intersectionAll(temps);
  if (entries.length && tempOverlap) tempSetpoint = midpoint(tempOverlap);
  else if (entries.length){
    const mids = temps.map(r => midpoint(r)).sort((a,b)=>a-b);
    tempSetpoint = mids[Math.floor(mids.length/2)];
    tempCompromise=true;
  }
  let phBand = null;
  let phCompromise=false;
  const phOverlap = intersectionAll(phs);
  if (entries.length && phOverlap) phBand=phOverlap;
  else if (entries.length){
    const mids = phs.map(r => midpoint(r)).sort((a,b)=>a-b);
    const m = mids[Math.floor(mids.length/2)];
    phBand=[m-0.3, m+0.3];
    phCompromise=true;
  }
  recTempEl.textContent = tempSetpoint ? `Heater: ${Math.round(tempSetpoint)}°F`:'Heater: —';
  recPHEl.textContent   = phBand ? `Safe pH: ${phBand[0].toFixed(1)}–${phBand[1].toFixed(1)}`:'Safe pH: —';
  let envPct=0;
  if (entries.length && tempSetpoint != null && phBand != null){
    const bandExpanded = [phBand[0]-0.2, phBand[1]+0.2];
    const per = entries.map(e => {
      const tOK = distanceToRange(tempSetpoint,e.s.temp) <= 2;
      const pGap = gapBetweenRanges(bandExpanded,e.s.pH);
      const pOK  = pGap===0;
      return (tOK && pOK) ? 100 : (tOK || pOK) ? 50 : 0;
    });
    envPct = avg(per);
  }
  animateFromZero(envBar, envPct);
  if (tempCompromise) bubble(warnEnv,'Compromise temperature — not all species share a common temp window.','warn');
  if (phCompromise)   bubble(warnEnv,'Compromise pH — not all species share a common pH window.','warn');
  if (entries.length && tempSetpoint != null){
    for (const e of entries){
      const tDist = distanceToRange(tempSetpoint,e.s.temp);
      if (tDist > 2){
        bubble(warnEnv,`${e.s.name}: temperature outlier by ~${Math.round(tDist)}°F — not recommended for this stock.`,'bad');
      }
    }
  }
  if (entries.length && phBand != null){
    for (const e of entries){
      const gap= gapBetweenRanges(phBand,e.s.pH);
      if (gap >= 3.0) bubble(warnEnv,`${e.s.name}: pH not compatible (≥3.0 away from safe band).`,'bad');
      else if (gap > 2.5) bubble(warnEnv,`${e.s.name}: pH far from safe band (>2.5).`,'warn');
    }
  }

  // Aggression
  let aggScore=0;
  const has     = (id) => entries.some(e=> e.s.id === id);
  const countId = (id) => entries.reduce((acc,e)=> acc + (e.s.id===id ? e.qty:0), 0);
  const anyTag  = (tag) => entries.some(e=> (e.s.tags || []).includes(tag));
  const bettaMales = countId('betta_m');
  const hasCichlid = anyTag('cichlid');
  const hasLongfinTargets = entries.some(e => (e.s.tags||[]).includes('longfin') && e.s.id!=='betta_m');
  const hasShrimp = anyTag('shrimp');
  const hasPredators = anyTag('predator');
  const hasNippers = anyTag('nipper');
  const tigerBarb = entries.find(e=> e.s.id === 'tigerbarb');
  const hasLongfinsAny = anyTag('longfin');

  if (bettaMales > 1){
    aggScore=100;
    bubble(warnAgg,'Multiple male Bettas cannot coexist — lethal aggression.','bad');
  }
  if (has('betta_m') && hasCichlid){
    aggScore=100;
    bubble(warnAgg,'Betta + Cichlid mix is not recommended.','bad');
  }
  if (has('betta_m') && hasLongfinTargets){
    aggScore=100;
    bubble(warnAgg,'Betta with long-finned tankmates is not recommended.','bad');
  }
  if (has('betta_m') && (hasNippers || has('tigerbarb'))){
    aggScore=100;
    bubble(warnAgg,'Betta with fin-nippers or Tiger Barbs is not recommended.','bad');
  }
  if (aggScore < 100){
    if (hasNippers && hasLongfinsAny){
      aggScore += 50;
      bubble(warnAgg,'Fin-nippers present with long-finned fish — watch for nipping.','warn');
    }
    for (const e of entries){
      if (!e.s.soloOK && e.s.schoolMin && e.qty < e.s.schoolMin){
        aggScore += 25;
        bubble(warnAgg,`${e.s.name}: below recommended group of ${e.s.schoolMin}.`,'warn');
      }
    }
    if (hasShrimp && hasPredators){
      aggScore += planted ? 10 : 15;
      bubble(warnAgg,'Shrimp may become prey — dense plants and hides recommended.','warn');
    }
    if (tigerBarb){
      const tbQty = toInt(tigerBarb.qty,1);
      const inMixed = entries.length > 1;
      if (!inMixed){
        aggScore += 10;
        bubble(warnAgg,'Tiger Barbs are boisterous; species-only is fine.','warn');
      } else {
        if (!has('betta_m')){
          if (hasLongfinsAny){
            let add = 50;
            if (tbQty >= 12) add -= 20;
            else if (tbQty >= 8) add -= 10;
            add = Math.max(add, 15);
            aggScore += add;
            bubble(warnAgg,`Tiger Barbs with long-fins — larger groups reduce nipping (qty ${tbQty}).`,'warn');
          } else {
            aggScore += 25;
            bubble(warnAgg,'Tiger Barbs in mixed community — active and nippy; monitor.','warn');
          }
        }
        if (entries.some(e => e.s.id === 'cory_panda')){
          bubble(warnAgg,'Consider swimming levels — Tiger Barbs (mid) + Panda Corydoras (bottom) are often OK.','warn');
        }
      }
    }
  }
  aggScore = clamp(aggScore,0,100);
  animateFromZero(aggBar, aggScore);
}

// ---------- Warnings helpers ----------
function bubble(parent,text,kind='warn'){
  const div=document.createElement('div');
  div.className=`bubble ${kind}`;
  div.textContent=text;
  parent.appendChild(div);
}
function showBadge(el,text,kind){
  el.textContent=text;
  el.hidden=false;
  el.classList.remove('bad','warn');
  if (kind) el.classList.add(kind);
}