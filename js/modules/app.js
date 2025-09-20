/* FishkeepingLifeCo — App v9.3.8 */
/* ---------- tiny helpers ---------- */
const $  = s => document.querySelector(s);
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
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
  if(typeof raw==='number' && Number.isFinite(raw)) return clamp(Math.floor(raw),1,999);
  const s=(raw==null?'':String(raw)).replace(/[^\d]/g,'').slice(0,3);
  const n=parseInt(s,10);
  return clamp(isNaN(n)?1:n,1,999);
}
const span = r => (!r||r.length<2)?0:Math.max(0,r[1]-r[0]);
const inter2=(a,b)=>(!a||!b||a.length<2||b.length<2)?null:[Math.max(a[0],b[0]), Math.min(a[1],b[1])];
function interAll(ranges){
  let cur=null;
  for(const r of ranges){
    cur = cur ? inter2(cur,r) : r;
    if(!cur || cur[0]>=cur[1]) return null;
  }
  return cur;
}
const fmtRange=(r,u)=>(!r||r.length<2)?'—':`${r[0]}–${r[1]}${u||''}`;

/* ---------- data ---------- */
const DATA = Array.isArray(window.FISH_DATA) ? window.FISH_DATA : [];
const findData = name => DATA.find(r => canonName(r.name||r.id||'')===canonName(name)) || null;

/* ---------- DOM refs ---------- */
const selEl=$('#fishSelect'), qEl=$('#fQty'), recEl=$('#recMin'), searchEl=$('#fishSearch');
const addBtn=$('#addFish'), resetBtn=$('#reset'), tbody=$('#tbody');
const bioBar=$('#bioBarFill'), envBar=$('#envBarFill'), aggBar=$('#aggBarFill'), warnBox=$('#aggression-warnings');

/* ---------- species dropdown (with search + recMin sync) ---------- */
(function populateSpecies(){
  if(!selEl) return;
  const list=[...DATA].sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  selEl.innerHTML='';
  for(const r of list){
    const o=document.createElement('option');
    o.value=r.name;
    o.textContent=r.name;
    o.dataset.min = r.min || r.recommendedMinimum || 1;
    selEl.appendChild(o);
  }
  const syncMin=()=>{ const o=selEl.selectedOptions[0]; if(recEl&&o) recEl.value=parseInt(o.dataset.min||'1',10)||1; };
  selEl.addEventListener('change', syncMin); syncMin();

  if(searchEl){
    searchEl.addEventListener('input', ()=>{
      const q=norm(searchEl.value); let first=null;
      for(const o of selEl.options){
        const hit=!q || norm(o.textContent).includes(q);
        o.hidden=!hit; if(hit && !first) first=o;
      }
      if(first){ selEl.value=first.value; syncMin(); }
      else{ searchEl.value=''; for(const o of selEl.options) o.hidden=false; selEl.selectedIndex=0; syncMin(); }
    });
  }
})();

/* ---------- stock table ---------- */
function readStock(){
  return Array.from(tbody.querySelectorAll('tr')).map(tr=>{
    const name=tr.dataset.name||'';
    const qty = safeQty(tr.querySelector('input')?.value||0);
    return name?{name,qty}:null;
  }).filter(Boolean);
}
function rowFor(name){
  const key=canonName(name);
  return Array.from(tbody.querySelectorAll('tr')).find(tr=>canonName(tr.dataset.name||'')===key)||null;
}
function makeRow(name,qty){
  const tr=document.createElement('tr'); tr.dataset.name=name;

  const tdN=document.createElement('td'); tdN.textContent=formatName(name);

  const tdQ=document.createElement('td');
  const input=document.createElement('input');
  input.type='number'; input.min='0'; input.step='1'; input.inputMode='numeric';
  input.value=qty; input.addEventListener('input', renderAll);
  tdQ.appendChild(input);

  const tdA=document.createElement('td'); tdA.style.textAlign='right';
  const bM=document.createElement('button'); bM.className='btn'; bM.textContent='−'; bM.type='button';
  const bP=document.createElement('button'); bP.className='btn'; bP.textContent='+'; bP.type='button';
  const bD=document.createElement('button'); bD.className='btn'; bD.style.background='var(--bad)'; bD.textContent='Delete'; bD.type='button';

  bM.addEventListener('click',()=>{ let v=safeQty(input.value)-1; if(v<=0){tr.remove(); renderAll(); return;} input.value=v; renderAll(); });
  bP.addEventListener('click',()=>{ input.value=safeQty(input.value)+1; renderAll(); });
  bD.addEventListener('click',()=>{ tr.remove(); renderAll(); });

  tdA.append(bM,bP,bD);
  tr.append(tdN,tdQ,tdA);
  return tr;
}
function addOrUpdate(name,delta){
  let tr=rowFor(name);
  if(tr){
    const input=tr.querySelector('input');
    let v=safeQty(input.value)+delta;
    if(v<=0){ tr.remove(); renderAll(); return; }
    input.value=v; renderAll(); return;
  }
  if(delta>0){ tbody.appendChild(makeRow(name,delta)); renderAll(); }
}

/* ---------- Add / Reset wiring (Safari-safe & robust) ---------- */
function getTypedQty(){
  if(!qEl) return null;
  // prefer valueAsNumber when it’s finite (Safari sometimes returns NaN until blur)
  if(Number.isFinite(qEl.valueAsNumber)) return safeQty(qEl.valueAsNumber);
  const raw = (typeof qEl.value==='string') ? qEl.value : '';
  const s = raw.trim();
  if(s.length===0) return null; // treat empty as “no user value”
  return safeQty(raw);
}
function onAddClick(ev){
  ev?.preventDefault?.();
  const name = selEl?.value || '';
  if(!name) return;

  // Use typed qty if present; else fall back to Rec Min; else 1
  const typed = getTypedQty();
  const fall  = recEl ? safeQty(recEl.value||1) : 1;
  const qty   = (typed==null) ? fall : typed;

  addOrUpdate(name, qty);
}
addBtn?.addEventListener('click', onAddClick, true);
qEl?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ onAddClick(e); }});
resetBtn?.addEventListener('click', ()=>{ tbody.innerHTML=''; renderAll(); });

/* ---------- bioload ---------- */
function parseInches(v){ const m=String(v??'').match(/(\d+(\.\d+)?)/); return m?parseFloat(m[1]):0; }
function unitsFor(name){
  const r=findData(name); if(!r) return 1;
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

/* ---------- environmental fit (badness fills right) ---------- */
function envFitScoreAndBubbles(){
  const stock = readStock();
  const chosen = stock
    .map(s => findData(s.name))
    .filter(r => r && Array.isArray(r.temp) && r.temp.length===2 && Array.isArray(r.ph) && r.ph.length===2);

  const bubbles = [];
  if (chosen.length < 2) return { bad: 0, bubbles };

  const tAll = interAll(chosen.map(r => r.temp));
  const pAll = interAll(chosen.map(r => r.ph));

  if (!tAll || !pAll) {
    // find one conflicting pair for message
    let pick=null;
    for(let i=0;i<chosen.length;i++){
      for(let j=i+1;j<chosen.length;j++){
        const a=chosen[i], b=chosen[j];
        const t=inter2(a.temp,b.temp), p=inter2(a.ph,b.ph);
        if(!t || !p){ pick=[a,b,t,p]; break; }
      }
      if(pick) break;
    }
    if(pick){
      const [a,b,t,p]=pick;
      const msgs=[];
      if(!t) msgs.push(`Temp clash (${fmtRange(a.temp,'°F')} vs ${fmtRange(b.temp,'°F')})`);
      if(!p) msgs.push(`pH clash (${fmtRange(a.ph,'')} vs ${fmtRange(b.ph,'')})`);
      bubbles.push(['severe', `${a.name} ↔ ${b.name}: ${msgs.join(' • ')}`]);
    }else{
      bubbles.push(['severe','Temperature or pH ranges do not overlap.']);
    }
    return { bad: 100, bubbles };
  }

  // we do have an intersection => compute goodness then invert to badness
  const tGood = clamp(span(tAll)/30, 0, 1);
  const pGood = clamp(span(pAll)/3 , 0, 1);
  const goodness = (tGood*0.55 + pGood*0.45) * 100;
  const bad = clamp(100 - goodness, 0, 100);

  if (bad >= 75) bubbles.push(['moderate','Very tight overlap in temperature & pH.']);
  return { bad, bubbles };
}
function renderEnv(){
  if(!envBar) return;
  const { bad } = envFitScoreAndBubbles();
  envBar.style.width = bad.toFixed(1) + '%';
}

/* ---------- aggression (schooling, bettas, nippers, etc.) ---------- */
const FIN_NIPPERS = ['tiger barb','serpae tetra','black skirt tetra','columbian tetra','red eye tetra','penguin tetra','giant danio'];
const LONG_FIN_TARGETS = ['betta','angelfish','gourami','guppy','long fin','veil'];
const hasAny = (list, name) => list.some(n => canonName(name).includes(canonName(n)));

function aggressionResult(){
  const stock=readStock();
  const names=stock.map(s=>s.name);
  const get = n => findData(n) || {};
  const bubbles=[];
  let score=0, hasSevere=false;

  // schooling / min group
  for(const s of stock){
    const r=get(s.name);
    const min = r.min || r.recommendedMinimum || 1;
    if(min>=3 && s.qty < min){
      bubbles.push(['mild', `${r.name||s.name}: schooling species — recommended ≥ ${min}.`]);
      score += 8;
    }
  }

  // multiple male bettas
  const bettas = stock.filter(s=>canonName(s.name).includes('betta')).reduce((a,b)=>a+b.qty,0);
  if(bettas>=2){ hasSevere=true; bubbles.push(['severe','Multiple male bettas: not compatible.']); }

  // fin nippers vs long fins
  const hasNipper = names.some(n=>hasAny(FIN_NIPPERS,n));
  const hasLong   = names.some(n=>hasAny(LONG_FIN_TARGETS,n));
  if(hasNipper && hasLong){ hasSevere=true; bubbles.push(['severe','Fin-nippers with long-fin fish → high risk of nipping.']); }
  else if(hasNipper){ score+=16; bubbles.push(['mild','Fin-nippers present — monitor for nipping.']); }

  // gourami + angelfish
  const hasGourami = names.some(n=>canonName(n).includes('gourami'));
  const hasAngel   = names.some(n=>canonName(n).includes('angelfish'));
  if(hasGourami && hasAngel){ score+=18; bubbles.push(['moderate','Gourami + Angelfish may compete and fin-spar.']); }

  // shrimp & cichlids
  const hasShrimp  = names.some(n=>canonName(n).includes('shrimp'));
  const hasCichlid = names.some(n=>canonName(n).includes('cichlid'));
  if(hasShrimp && hasCichlid){ score+=12; bubbles.push(['info','Shrimp may be prey for cichlids.']); }

  // env conflicts can contribute
  const env = envFitScoreAndBubbles();
  for(const b of env.bubbles){
    bubbles.push(b);
    if(b[0]==='severe') hasSevere=true;
    else if(b[0]==='moderate') score+=12;
    else if(b[0]==='mild') score+=6;
  }

  if(hasSevere) score = 100;
  return { score: clamp(score,0,100), bubbles };
}

function renderAggression(){
  if(!aggBar || !warnBox) return;
  const { score, bubbles } = aggressionResult();
  aggBar.style.width = score.toFixed(0)+'%';

  warnBox.innerHTML='';
  const groups={
    severe:{label:'Severe',cls:'warning-severe',items:[]},
    moderate:{label:'Moderate',cls:'warning-moderate',items:[]},
    mild:{label:'Mild',cls:'warning-mild',items:[]},
    info:{label:'Info',cls:'warning-info',items:[]},
  };
  bubbles.forEach(([lvl,msg])=>{ (groups[lvl]||groups.info).items.push(msg); });

  for(const key of ['severe','moderate','mild','info']){
    const g=groups[key]; if(!g.items.length) continue;
    const sec=document.createElement('div'); sec.className='warning-section';
    const h=document.createElement('div'); h.className='warning-title'; h.textContent=g.label;
    const wrap=document.createElement('div'); wrap.className='warning-bubbles';
    g.items.forEach(t=>{ const b=document.createElement('span'); b.className=`warning-bubble ${g.cls}`; b.textContent=t; wrap.appendChild(b); });
    sec.append(h,wrap); warnBox.appendChild(sec);
  }
}

/* ---------- render wiring ---------- */
function renderAll(){ renderBioload(); renderEnv(); renderAggression(); }
;['gallons','planted','filtration'].forEach(id=>{
  const el=$('#'+id); if(!el) return;
  el.addEventListener('input', renderAll);
  el.addEventListener('change', renderAll);
});
renderAll();
console.log('[FLC] ready — species loaded:', DATA.length);