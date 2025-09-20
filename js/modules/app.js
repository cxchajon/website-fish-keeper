/* FishkeepingLifeCo — App v9.3.4 */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function toArray(x){ return Array.isArray(x)?x:(x?[x]:[]); }
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function canonName(s){
  return norm(s).replace(/[_-]+/g,' ')
                .replace(/\s+/g,' ')
                .replace(/\s*\([^)]*\)\s*/g,' ')
                .trim();
}
function formatName(raw){
  if(!raw) return '';
  return raw.replace(/[_-]+/g,' ')
            .replace(/\s+/g,' ')
            .trim()
            .replace(/\b\w/g,c=>c.toUpperCase());
}
function safeQty(raw){
  if(typeof raw === 'number' && Number.isFinite(raw)){
    return Math.min(999, Math.max(1, Math.floor(raw)));
  }
  const s = (raw==null?'':String(raw)).replace(/[^\d]/g,'').slice(0,3);
  let n = parseInt(s,10);
  if(isNaN(n)||n<1) n=1;
  if(n>999) n=999;
  return n;
}
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

const DATA = window.FISH_DATA || [];
const byName = name => DATA.find(r => canonName(r.name||r.id||'')===canonName(name)) || null;

/* --- DOM --- */
const selEl=$('#fishSelect'), qEl=$('#fQty'), recEl=$('#recMin'), searchEl=$('#fishSearch');
const addBtn=$('#addFish'), resetBtn=$('#reset'), tbody=$('#tbody');
const bioBar=$('#bioBarFill'), envBar=$('#envBarFill'), aggBar=$('#aggBarFill'), warnBox=$('#aggression-warnings');

/* --- Populate species --- */
(function(){
  if(!selEl) return;
  const list=[...DATA].sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  selEl.innerHTML='';
  for(const r of list){
    const o=document.createElement('option');
    o.value=r.name; o.textContent=r.name; o.dataset.min=r.min||r.recommendedMinimum||1;
    selEl.appendChild(o);
  }
  const syncRec=()=>{
    const opt=selEl.selectedOptions[0];
    recEl.value = opt ? (parseInt(opt.dataset.min,10)||1) : 1;
  };
  selEl.addEventListener('change', syncRec);
  syncRec();

  if(searchEl){
    searchEl.addEventListener('input',()=>{
      const q=norm(searchEl.value);
      let first=null;
      for(const o of selEl.options){
        const hit=!q||norm(o.textContent).includes(q);
        o.hidden=!hit;
        if(hit && !first) first=o;
      }
      if(first){ selEl.value=first.value; syncRec(); }
    });
  }
})();

/* --- Stock helpers --- */
function readStock(){
  return Array.from(tbody.querySelectorAll('tr')).map(tr=>{
    const name=tr.dataset.name||'';
    const qty =safeQty(tr.querySelector('input')?.value||0);
    return name?{name,qty}:null;
  }).filter(Boolean);
}
function findRow(name){
  const key=canonName(name);
  return Array.from(tbody.querySelectorAll('tr'))
    .find(tr=>canonName(tr.dataset.name||'')===key)||null;
}
function makeRow(name,qty){
  const tr=document.createElement('tr'); tr.dataset.name=name;

  const tdN=document.createElement('td'); tdN.textContent=formatName(name);
  const tdQ=document.createElement('td');
  const input=document.createElement('input');
  input.type='number'; input.min='0'; input.step='1'; input.inputMode='numeric'; input.value=qty;
  input.addEventListener('input', renderAll);
  tdQ.appendChild(input);

  const tdA=document.createElement('td'); tdA.style.textAlign='right';
  const bM=document.createElement('button'); bM.className='btn'; bM.textContent='−';
  const bP=document.createElement('button'); bP.className='btn'; bP.textContent='+';
  const bD=document.createElement('button'); bD.className='btn'; bD.style.background='var(--bad)'; bD.textContent='Delete';

  bM.addEventListener('click',()=>{ let v=safeQty(input.value)-1; if(v<=0){tr.remove(); renderAll(); return;} input.value=v; renderAll();});
  bP.addEventListener('click',()=>{ input.value=safeQty(input.value)+1; renderAll(); });
  bD.addEventListener('click',()=>{ tr.remove(); renderAll(); });

  tdA.append(bM,bP,bD);
  tr.append(tdN,tdQ,tdA);
  return tr;
}
function addOrUpdate(name,delta){
  let tr=findRow(name);
  if(tr){
    const input=tr.querySelector('input');
    let v=safeQty(input.value)+delta;
    if(v<=0){ tr.remove(); renderAll(); return; }
    input.value=v; renderAll(); return;
  }
  if(delta>0){ tbody.appendChild(makeRow(name,delta)); renderAll(); }
}

/* --- Add / Reset --- */
addBtn?.addEventListener('click',()=>{
  const name=selEl?.value||''; if(!name) return;
  const raw=qEl?.value??''; const hasUser=String(raw).trim().length>0;
  const qty=hasUser? safeQty(raw) : safeQty(recEl?.value||1);
  addOrUpdate(name, qty);
});
qEl?.addEventListener('keydown',e=>{ if(e.key==='Enter') addBtn?.click(); });
resetBtn?.addEventListener('click',()=>{ tbody.innerHTML=''; renderAll(); });

/* --- Bioload --- */
function parseInches(v){ const m=String(v??'').match(/(\d+(\.\d+)?)/); return m?parseFloat(m[1]):0; }
function unitsFor(name){
  const r=byName(name); if(!r) return 1;
  if(typeof r.points==='number') return r.points;
  const inches=parseInches(r.maxInches||r.sizeInches||r.max_in);
  if(inches){
    if(inches<=1.0) return 0.25;
    if(inches<=1.5) return 0.5;
    if(inches<=2.0) return 0.8;
    if(inches<=3.0) return 1.1;
    if(inches<=4.0) return 1.6;
    if(inches<=5.0) return 2.2;
    if(inches<=6.0) return 3.0;
    if(inches<=8.0) return 4.2;
    return 5.5;
  }
  return 1.0;
}
function totalBioUnits(){ return readStock().reduce((s,it)=>s+unitsFor(it.name)*it.qty,0); }
function capacityUnits(){
  const gallons=parseFloat($('#gallons')?.value||'0')||0;
  const planted=!!$('#planted')?.checked;
  const filt=$('#filtration')?.value||'standard';
  const perGal=0.9;
  const filtFactor=(filt==='low')?0.80:(filt==='high')?1.25:1.0;
  const plantBonus=planted?1.10:1.0;
  return Math.max(1,gallons*perGal)*filtFactor*plantBonus;
}
function renderBioload(){
  if(!bioBar) return;
  const pct=clamp((totalBioUnits()/capacityUnits())*100,0,160);
  bioBar.style.width=pct.toFixed(1)+'%';
}

/* --- Environmental Fit (Temp & pH) --- */
function overlapLen(a,b){ if(!a||!b||a.length<2||b.length<2) return 0; const lo=Math.max(a[0],b[0]); const hi=Math.min(a[1],b[1]); return Math.max(0,hi-lo); }
function envFitScore(){
  const stock=readStock();
  if(stock.length<=1) return 0;
  const chosen=stock.map(s=>byName(s.name)).filter(Boolean);
  const temps=chosen.map(r=>toArray(r.temp));
  const phs  =chosen.map(r=>toArray(r.ph));
  let tMin=Infinity, pMin=Infinity;
  for(let i=0;i<temps.length;i++){
    for(let j=i+1;j<temps.length;j++){
      tMin=Math.min(tMin, overlapLen(temps[i],temps[j]));
      pMin=Math.min(pMin, overlapLen(phs[i],phs[j]));
    }
  }
  const tScore=clamp(tMin/12,0,1);
  const pScore=clamp(pMin/2, 0,1);
  return (tScore*0.55 + pScore*0.45)*100;
}
function renderEnv(){ if(!envBar) return; envBar.style.width=envFitScore().toFixed(1)+'%'; }

/* --- Aggression & warnings (uses quantities) --- */
const FIN_NIPPERS = ['tiger barb','serpae tetra','black skirt tetra','columbian tetra','red eye tetra','penguin tetra','giant danio'];
const LONG_FIN_TARGETS = ['betta','angelfish','gourami','guppy'];

function hasAny(list, name){ const key=canonName(name); return list.some(n=>key.includes(canonName(n))); }

function aggressionResult(){
  const stock=readStock();
  const names=stock.map(s=>s.name);

  let score=0;
  const bubbles={ severe:[], moderate:[], mild:[], info:[] };

  // Betta quantity rule
  const bettaQty = stock.filter(s=>canonName(s.name).includes('betta')).reduce((a,b)=>a+b.qty,0);
  if(bettaQty>=2){ score+=70; bubbles.severe.push('Multiple male bettas: not compatible.'); }
  else if(bettaQty===1){ score+=20; bubbles.moderate.push('Betta present: avoid long-fin tankmates & other bettas.'); }

  // Fin-nippers vs long fins
  const hasNipper = names.some(n=>hasAny(FIN_NIPPERS,n));
  const hasLong   = names.some(n=>hasAny(LONG_FIN_TARGETS,n));
  if(hasNipper && hasLong){ score+=45; bubbles.severe.push('Fin-nippers with long-fin fish → high risk.'); }
  else if(hasNipper){ score+=18; bubbles.mild.push('Fin-nippers present: monitor for nipping.'); }

  // Gourami + Angelfish note
  const hasGourami = names.some(n=>canonName(n).includes('gourami'));
  const hasAngel   = names.some(n=>canonName(n).includes('angelfish'));
  if(hasGourami && hasAngel){ score+=20; bubbles.moderate.push('Gourami + Angelfish can compete/fin-spar.'); }

  // Shrimp with cichlids
  const hasShrimp  = names.some(n=>canonName(n).includes('shrimp'));
  const hasCichlid = names.some(n=>canonName(n).includes('cichlid'));
  if(hasShrimp && hasCichlid){ score+=12; bubbles.info.push('Shrimp may be prey for cichlids.'); }

  return { score: clamp(score,0,100), bubbles };
}

function renderAggression(){
  if(!aggBar || !warnBox) return;
  const { score, bubbles } = aggressionResult();
  aggBar.style.width = score.toFixed(0)+'%';

  warnBox.innerHTML='';
  const order = [
    ['severe','Severe','warning-severe'],
    ['moderate','Moderate','warning-moderate'],
    ['mild','Mild','warning-mild'],
    ['info','Info','warning-info']
  ];
  for(const [key,label,cls] of order){
    const arr=bubbles[key]; if(!arr||!arr.length) continue;
    const sec=document.createElement('div'); sec.className='warning-section';
    const h=document.createElement('div'); h.className='warning-title'; h.textContent=label;
    const wrap=document.createElement('div'); wrap.className='warning-bubbles';
    arr.forEach(t=>{ const b=document.createElement('span'); b.className=`warning-bubble ${cls}`; b.textContent=t; wrap.appendChild(b); });
    sec.append(h,wrap); warnBox.appendChild(sec);
  }
}

/* --- Render cycle --- */
function renderAll(){ renderBioload(); renderEnv(); renderAggression(); }
;['gallons','planted','filtration'].forEach(id=>{
  const el=$('#'+id); if(!el) return;
  el.addEventListener('input', renderAll);
  el.addEventListener('change', renderAll);
});
renderAll();
console.log('[FLC] ready – species loaded:', DATA.length);
