/* FishkeepingLifeCo — App v9.3.7 */
const $  = s => document.querySelector(s);

/* ---------- Utils ---------- */
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
  return raw.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim()
            .replace(/\b\w/g,c=>c.toUpperCase());
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
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

/* ---------- Data ---------- */
const DATA = window.FISH_DATA || [];
const findRow = name => DATA.find(r => canonName(r.name||r.id||'')===canonName(name)) || null;

/* ---------- DOM ---------- */
const selEl=$('#fishSelect'), qEl=$('#fQty'), recEl=$('#recMin'), searchEl=$('#fishSearch');
const addBtn=$('#addFish'), resetBtn=$('#reset'), tbody=$('#tbody');
const bioBar=$('#bioBarFill'), envBar=$('#envBarFill'), aggBar=$('#aggBarFill'), warnBox=$('#aggression-warnings');

/* ---------- Populate species dropdown ---------- */
(function(){
  if(!selEl) return;
  const list=[...DATA].sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  selEl.innerHTML='';
  for(const r of list){
    const o=document.createElement('option');
    o.value=r.name; o.textContent=r.name; o.dataset.min=r.min||r.recommendedMinimum||1;
    selEl.appendChild(o);
  }
  const syncMin=()=>{ const opt=selEl.selectedOptions[0]; recEl.value = opt ? (parseInt(opt.dataset.min,10)||1) : 1; };
  selEl.addEventListener('change',syncMin); syncMin();

  if(searchEl){
    searchEl.addEventListener('input',()=>{
      const q=norm(searchEl.value); let first=null;
      for(const o of selEl.options){ const hit=!q || norm(o.textContent).includes(q); o.hidden=!hit; if(hit && !first) first=o; }
      if(first){ selEl.value=first.value; syncMin(); }
    });
  }
})();

/* ---------- Stock table ---------- */
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
  input.value=qty; input.addEventListener('input',renderAll);
  tdQ.appendChild(input);

  const tdA=document.createElement('td'); tdA.style.textAlign='right';
  const bM=document.createElement('button'); bM.className='btn'; bM.textContent='−';
  const bP=document.createElement('button'); bP.className='btn'; bP.textContent='+';
  const bD=document.createElement('button'); bD.className='btn'; bD.style.background='var(--bad)'; bD.textContent='Delete';

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

/* Add / Reset */
addBtn?.addEventListener('click',()=>{
  const name=selEl?.value||''; if(!name) return;
  const raw=qEl?.value??''; const hasUser=String(raw).trim().length>0;
  const qty=hasUser? safeQty(raw) : safeQty(recEl?.value||1);
  addOrUpdate(name,qty);
});
qEl?.addEventListener('keydown',e=>{ if(e.key==='Enter') addBtn?.click(); });
resetBtn?.addEventListener('click',()=>{ tbody.innerHTML=''; renderAll(); });

/* ---------- Bioload ---------- */
function parseInches(v){ const m=String(v??'').match(/(\d+(\.\d+)?)/); return m?parseFloat(m[1]):0; }
function unitsFor(name){
  const r=findRow(name); if(!r) return 1;
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

/* ---------- Environmental Fit (robust) ---------- */
function envFitScoreAndBubbles(){
  const stock=readStock();
  const chosen = stock
    .map(s=>findRow(s.name))
    .filter(r=>r && Array.isArray(r.temp) && r.temp.length===2 && Array.isArray(r.ph) && r.ph.length===2);

  const bubbles=[];
  if(chosen.length<2) return { score:0, bubbles };

  const tAll = interAll(chosen.map(r=>r.temp));
  const pAll = interAll(chosen.map(r=>r.ph));

  if(!tAll || !pAll){
    // Show one explicit conflicting pair
    let pick=null, worst=-1;
    for(let i=0;i<chosen.length;i++){
      for(let j=i+1;j<chosen.length;j++){
        const a=chosen[i], b=chosen[j];
        const t=inter2(a.temp,b.temp), p=inter2(a.ph,b.ph);
        const bad = (t?0:1) + (p?0:1);
        if(bad>0){
          const width=(span(a.temp)+span(b.temp))+(span(a.ph)+span(b.ph));
          if(width>worst){ worst=width; pick=[a,b,t,p]; }
        }
      }
    }
    if(pick){
      const [a,b,t,p]=pick;
      const msgs=[];
      if(!t) msgs.push(`Temp clash (${fmtRange(a.temp,'°F')} vs ${fmtRange(b.temp,'°F')})`);
      if(!p) msgs.push(`pH clash (${fmtRange(a.ph,'')} vs ${fmtRange(b.ph,'')})`);
      const level = (!t && !p) ? 'severe' : 'moderate';
      bubbles.push([level, `${a.name} ↔ ${b.name}: ${msgs.join(' • ')}`]);
    }
    return { score:0, bubbles };
  }

  // Scale: 30°F span → 100%; 3.0 pH span → 100%
  const tScore = clamp(span(tAll)/30,0,1);
  const pScore = clamp(span(pAll)/3 ,0,1);
  const score = (tScore*0.55 + pScore*0.45)*100;

  if(score>0 && score<25){
    bubbles.push(['mild','Very tight overlap in temperature & pH.']);
  }
  return { score, bubbles };
}
function renderEnv(){
  if(!envBar) return;
  const { score } = envFitScoreAndBubbles();
  envBar.style.width = score.toFixed(1)+'%';
}

/* ---------- Aggression & Warnings ---------- */
const FIN_NIPPERS = ['tiger barb','serpae tetra','black skirt tetra','columbian tetra','red eye tetra','penguin tetra','giant danio'];
const LONG_FIN_TARGETS = ['betta','angelfish','gourami','guppy','long fin','veil'];
const hasAny = (list, name) => list.some(n => canonName(name).includes(canonName(n)));

function aggressionResult(){
  const stock=readStock();
  const names=stock.map(s=>s.name);
  const find = n => findRow(n) || {};
  const bubbles=[];
  let score=0;
  let hasSevere=false;

  // Schooling / minimum group
  for(const s of stock){
    const r=find(s.name);
    const min = r.min || r.recommendedMinimum || 1;
    if(min>=3 && s.qty < min){
      bubbles.push(['mild', `${r.name||s.name}: schooling species — recommended ≥ ${min}.`]);
      score+=8;
    }
  }

  // Multiple male bettas
  const bettas = stock.filter(s=>canonName(s.name).includes('betta')).reduce((a,b)=>a+b.qty,0);
  if(bettas>=2){ hasSevere=true; bubbles.push(['severe','Multiple male bettas: not compatible.']); }

  // Fin nippers vs long fins
  const hasNipper = names.some(n=>hasAny(FIN_NIPPERS,n));
  const hasLong   = names.some(n=>hasAny(LONG_FIN_TARGETS,n));
  if(hasNipper && hasLong){ hasSevere=true; bubbles.push(['severe','Fin-nippers with long-fin fish → high risk of nipping.']); }
  else if(hasNipper){ score+=16; bubbles.push(['mild','Fin-nippers present — monitor for nipping.']); }

  // Gourami + Angelfish tension
  const hasGourami = names.some(n=>canonName(n).includes('gourami'));
  const hasAngel   = names.some(n=>canonName(n).includes('angelfish'));
  if(hasGourami && hasAngel){ score+=18; bubbles.push(['moderate','Gourami + Angelfish may compete and fin-spar.']); }

  // Shrimp & cichlids
  const hasShrimp  = names.some(n=>canonName(n).includes('shrimp'));
  const hasCichlid = names.some(n=>canonName(n).includes('cichlid'));
  if(hasShrimp && hasCichlid){ score+=12; bubbles.push(['info','Shrimp may be prey for cichlids.']); }

  // Pull in environment conflict bubbles
  const env=envFitScoreAndBubbles();
  for(const b of env.bubbles){
    bubbles.push(b);
    if(b[0]==='severe') hasSevere=true;
    else if(b[0]==='moderate') score+=12;
    else if(b[0]==='mild') score+=6;
  }

  // If any severe -> bar maxes
  if(hasSevere) score=100;

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

/* ---------- Render wiring ---------- */
function renderAll(){ renderBioload(); renderEnv(); renderAggression(); }
;['gallons','planted','filtration'].forEach(id=>{
  const el=$('#'+id); if(!el) return;
  el.addEventListener('input',renderAll);
  el.addEventListener('change',renderAll);
});
renderAll();
console.log('[FLC] ready — species loaded:', DATA.length);
