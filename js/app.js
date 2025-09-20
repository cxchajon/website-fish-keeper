/* FishkeepingLifeCo – App core (self-contained) */
console.log('[FLC] app boot');

//
// ---------- utilities ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function toArray(x){ return Array.isArray(x) ? x : x ? [x] : []; }
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function canonName(s){
  return norm(s).replace(/[_-]+/g,' ')
                .replace(/\s+/g,' ')
                .replace(/\s*\([^)]*\)\s*/g,' ')
                .trim();
}
function formatName(raw){
  if(!raw) return '';
  return raw
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/\b\w/g,c=>c.toUpperCase());
}
function safeQty(raw){
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    let n = Math.floor(raw);
    return Math.min(999, Math.max(1, n));
  }
  const s = (raw==null ? '' : String(raw)).replace(/[^\d]/g,'').slice(0,3);
  let n2 = parseInt(s,10);
  if(isNaN(n2) || n2 < 1) n2 = 1;
  if(n2 > 999) n2 = 999;
  return n2;
}
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

//
// ---------- data access ----------
const DATA = window.FISH_DATA || [];
function byName(name){
  const key = canonName(name);
  for(const r of DATA){
    const n = canonName(r.name || r.id || '');
    if(n === key) return r;
  }
  return null;
}

//
// ---------- DOM refs ----------
const selEl   = $('#fishSelect');
const qEl     = $('#fQty');
const recEl   = $('#recMin');
const searchEl= $('#fishSearch');
const addBtn  = $('#addFish');
const resetBtn= $('#reset');
const tbody   = $('#tbody');

const bioBar  = $('#bioBarFill');
const envBar  = $('#envBarFill');
const aggBar  = $('#aggBarFill');
const warnBox = $('#aggression-warnings');

//
// ---------- populate species dropdown ----------
(function populate(){
  if(!selEl) return;
  const list = [...DATA].sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  selEl.innerHTML = '';
  for(const r of list){
    const opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = r.name;
    opt.dataset.min = r.min || r.recommendedMinimum || 1;
    selEl.appendChild(opt);
  }
  // keep Rec Min in sync with selection
  const setRec = ()=>{
    const opt = selEl.selectedOptions[0];
    recEl.value = opt ? (parseInt(opt.dataset.min,10)||1) : 1;
  };
  selEl.addEventListener('change', setRec);
  setRec();

  // search filter
  if(searchEl){
    searchEl.addEventListener('input', ()=>{
      const q = norm(searchEl.value);
      let firstShown = null;
      for(const opt of selEl.options){
        const hit = !q || norm(opt.textContent).includes(q);
        opt.hidden = !hit;
        if(hit && !firstShown) firstShown = opt;
      }
      if(firstShown){ selEl.value = firstShown.value; setRec(); }
    });
  }
})();

//
// ---------- stock table helpers ----------
function readStock(){
  return Array.from(tbody.querySelectorAll('tr')).map(tr=>{
    const name = tr.dataset.name || '';
    const qty  = safeQty(tr.querySelector('input')?.value || 0);
    return name ? { name, qty } : null;
  }).filter(Boolean);
}
function findRow(name){
  const key = canonName(name);
  return Array.from(tbody.querySelectorAll('tr'))
    .find(tr => canonName(tr.dataset.name||'') === key) || null;
}
function makeRow(name, qty){
  const tr = document.createElement('tr');
  tr.dataset.name = name;

  const tdName = document.createElement('td');
  tdName.textContent = formatName(name);

  const tdQty = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'number'; input.min = '0'; input.step='1'; input.inputMode='numeric';
  input.value = qty;
  input.addEventListener('input', renderAll);
  tdQty.appendChild(input);

  const tdAct = document.createElement('td'); tdAct.style.textAlign='right';
  const bMinus = document.createElement('button');
  bMinus.className='btn'; bMinus.textContent='−';
  const bPlus  = document.createElement('button');
  bPlus.className='btn';  bPlus.textContent='+';
  const bDel   = document.createElement('button');
  bDel.className='btn';   bDel.style.background='var(--bad)'; bDel.textContent='Delete';

  bMinus.addEventListener('click', ()=> {
    let v = safeQty(input.value) - 1;
    if(v<=0){ tr.remove(); renderAll(); return; }
    input.value = v; renderAll();
  });
  bPlus.addEventListener('click', ()=> { input.value = safeQty(input.value)+1; renderAll(); });
  bDel.addEventListener('click', ()=> { tr.remove(); renderAll(); });

  tdAct.appendChild(bMinus); tdAct.appendChild(bPlus); tdAct.appendChild(bDel);

  tr.appendChild(tdName); tr.appendChild(tdQty); tr.appendChild(tdAct);
  return tr;
}
function addOrUpdate(name, delta){
  let tr = findRow(name);
  if(tr){
    const input = tr.querySelector('input');
    let v = safeQty(input.value) + delta;
    if(v<=0){ tr.remove(); renderAll(); return; }
    input.value = v; renderAll(); return;
  }
  if(delta>0){
    tbody.appendChild(makeRow(name, delta));
    renderAll();
  }
}

//
// ---------- add / reset handlers ----------
if(addBtn){
  addBtn.addEventListener('click', ()=>{
    const name = selEl?.value || '';
    if(!name) return;

    const fieldRaw = qEl?.value ?? '';
    const hasUser = String(fieldRaw).trim().length > 0;
    const qty = hasUser ? safeQty(fieldRaw)
                        : safeQty(recEl?.value || 1);

    addOrUpdate(name, qty);
  });
}
if(qEl){
  qEl.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ addBtn.click(); }
  });
}
if(resetBtn){
  resetBtn.addEventListener('click', ()=>{
    tbody.innerHTML = '';
    renderAll();
  });
}

//
// ---------- bioload ----------
function parseInches(val){
  if(val==null) return 0;
  const m = String(val).match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}
function unitsFor(name){
  const r = byName(name);
  if(!r) return 1;
  if(typeof r.points === 'number') return r.points;
  const inches = parseInches(r.maxInches || r.sizeInches || r.max_in);
  if(inches){
    if(inches <= 1.0) return 0.25;
    if(inches <= 1.5) return 0.5;
    if(inches <= 2.0) return 0.8;
    if(inches <= 3.0) return 1.1;
    if(inches <= 4.0) return 1.6;
    if(inches <= 5.0) return 2.2;
    if(inches <= 6.0) return 3.0;
    if(inches <= 8.0) return 4.2;
    return 5.5;
  }
  return 1.0;
}
function totalBioUnits(){
  return readStock().reduce((s,it)=> s + unitsFor(it.name) * it.qty, 0);
}
function capacityUnits(){
  const gallons = parseFloat($('#gallons')?.value || '0') || 0;
  const planted = !!$('#planted')?.checked;
  const filt    = $('#filtration')?.value || 'standard';
  const perGal = 0.9;
  const filtFactor = (filt==='low') ? 0.80 : (filt==='high') ? 1.25 : 1.0;
  const plantBonus = planted ? 1.10 : 1.0;
  return Math.max(1, gallons * perGal) * filtFactor * plantBonus;
}
function renderBioload(){
  if(!bioBar) return;
  const pct = clamp((totalBioUnits()/capacityUnits())*100, 0, 160);
  bioBar.style.width = pct.toFixed(1)+'%';
}

//
// ---------- environment fit (temp & pH) ----------
function overlapLen(a,b){
  if(!a||!b||a.length<2||b.length<2) return 0;
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  return Math.max(0, hi-lo);
}
function envFitScore(){
  const stock = readStock();
  if(stock.length <= 1) return 0; // build from 0, no penalty with single species
  const chosen = stock.map(s => byName(s.name)).filter(Boolean);
  const temps = chosen.map(r => toArray(r.temp));
  const phs   = chosen.map(r => toArray(r.ph));

  // compute min pairwise overlap
  let tMin = Infinity, pMin = Infinity;
  for(let i=0;i<temps.length;i++){
    for(let j=i+1;j<temps.length;j++){
      tMin = Math.min(tMin, overlapLen(temps[i], temps[j]));
      pMin = Math.min(pMin, overlapLen(phs[i], phs[j]));
    }
  }
  // scale: temp 0..12°F, pH 0..2.0
  const tScore = clamp(tMin/12, 0, 1);
  const pScore = clamp(pMin/2,  0, 1);
  // modest weight to be welcoming for common mixes
  return (tScore*0.55 + pScore*0.45) * 100;
}
function renderEnv(){
  if(!envBar) return;
  envBar.style.width = envFitScore().toFixed(1)+'%';
}

//
// ---------- aggression + warnings ----------
const FIN_NIPPERS = [
  'tiger barb','serpae tetra','black skirt tetra','columbian tetra',
  'red eye tetra','penguin tetra','giant danio'
];
const LONG_FIN_TARGETS = [
  'betta','angelfish','gourami','guppy'
];

function isAny(nameList, hay){
  const key = canonName(hay);
  return nameList.some(n => key.includes(canonName(n)));
}

function aggressionResult(){
  const stock = readStock();
  let score = 0;
  const bubbles = { severe:[], moderate:[], mild:[], info:[] };

  const names = stock.map(s=>s.name);

  // Betta rule
  const bettas = names.filter(n => canonName(n).includes('betta'));
  if(bettas.length >= 1){
    score += 35;
    bubbles.moderate.push('Betta: males are solitary; no other male bettas.');
  }

  // Fin nippers vs long-fin targets
  const hasNipper = names.some(n => isAny(FIN_NIPPERS, n));
  const hasLongFin= names.some(n => isAny(LONG_FIN_TARGETS, n));
  if(hasNipper && hasLongFin){
    score += 50;
    bubbles.severe.push('Fin-nippers with long-fin fish → high risk.');
  } else if(hasNipper){
    score += 20;
    bubbles.mild.push('Fin-nippers present: monitor nipping.');
  }

  // Gourami vs Gourami / Angelfish mix notes
  const hasGourami = names.some(n => canonName(n).includes('gourami'));
  const hasAngel   = names.some(n => canonName(n).includes('angelfish'));
  if(hasGourami && hasAngel){
    score += 20;
    bubbles.moderate.push('Gourami + Angelfish: potential territory/fin disputes.');
  }

  // Shrimp note (info)
  const hasShrimp = names.some(n => canonName(n).includes('shrimp'));
  const hasCichlid= names.some(n => canonName(n).includes('cichlid'));
  if(hasShrimp && hasCichlid){
    bubbles.info.push('Shrimp may be prey for cichlids.');
    score += 10;
  }

  score = clamp(score, 0, 100);
  return { score, bubbles };
}

function renderAggression(){
  if(!aggBar || !warnBox) return;
  const { score, bubbles } = aggressionResult();
  aggBar.style.width = score.toFixed(0) + '%';

  // render grouped bubbles
  warnBox.innerHTML = '';
  const order = [
    ['severe','Severe', 'warning-severe'],
    ['moderate','Moderate','warning-moderate'],
    ['mild','Mild','warning-mild'],
    ['info','Info','warning-info']
  ];
  for(const [key,label,cls] of order){
    const arr = bubbles[key];
    if(!arr || !arr.length) continue;
    const sec  = document.createElement('div'); sec.className = 'warning-section';
    const h    = document.createElement('div'); h.className = 'warning-title'; h.textContent = label;
    const wrap = document.createElement('div'); wrap.className = 'warning-bubbles';
    arr.forEach(t => {
      const b = document.createElement('span');
      b.className = `warning-bubble ${cls}`;
      b.textContent = t;
      wrap.appendChild(b);
    });
    sec.appendChild(h); sec.appendChild(wrap);
    warnBox.appendChild(sec);
  }
}

//
// ---------- master render ----------
function renderAll(){
  renderBioload();
  renderEnv();
  renderAggression();
}

// tank controls update bars
['gallons','planted','filtration'].forEach(id=>{
  const el = $('#'+id);
  if(!el) return;
  el.addEventListener('input', renderAll);
  el.addEventListener('change', renderAll);
});

// initial pass
renderAll();
console.log('[FLC] app ready; species:', DATA.length);