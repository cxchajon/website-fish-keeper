/* FishkeepingLifeCo — App module (v9.4.3)
   - Add button works on mobile Safari
   - Quantities respected
   - Bioload / Env Fit / Aggression bars + warnings
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
function getTempRange(r){ return (Array.isArray(r?.temp)&&r.temp.length===2)?r.temp.map(Number):null; }
function getPhRange(r){ return (Array.isArray(r?.ph)&&r.ph.length===2)?r.ph.map(Number):null; }

/* ---------------- DOM ---------------- */
function $(id){ return document.getElementById(id); }

/* ---------------- Populate species ---------------- */
function populateSelect(){
  const sel = $('fishSelect'), rec = $('recMin'), search = $('fishSearch');
  sel.innerHTML = '';
  const list = Array.isArray(window.FISH_DATA) ? [...window.FISH_DATA] : [];
  list.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  list.forEach(r=>{
    const opt=document.createElement('option');
    opt.value=r.name; opt.textContent=r.name;
    opt.dataset.min = String(getMinFromRow(r)||1);
    sel.appendChild(opt);
  });
  function updateRec(){
    const opt=sel.selectedOptions[0];
    rec.value = opt ? opt.dataset.min||'1' : '1';
  }
  sel.addEventListener('change', updateRec);
  if(search){
    search.addEventListener('input', function(){
      const q=norm(this.value); let first=null;
      Array.from(sel.options).forEach(o=>{
        const hit=!q||norm(o.textContent).includes(q);
        o.hidden=!hit; if(hit&&!first) first=o;
      });
      if(first){ sel.value=first.value; updateRec(); }
    });
  }
  updateRec();
}

/* ---------------- Stock table ---------------- */
function rowHTML(name, qty){
  return `<tr>
      <td>${titleCase(name)}</td>
      <td><input type="number" min="1" step="1" value="${qty}" style="width:72px"></td>
      <td style="text-align:right">
        <button class="btn btn-minus" type="button">−</button>
        <button class="btn btn-plus" type="button">+</button>
        <button class="btn btn-del" type="button" style="background:var(--bad)">Delete</button>
      </td>
    </tr>`;
}
function addOrUpdateStock(name, qty){
  const tbody=$('tbody');
  let tr=[...tbody.querySelectorAll('tr')].find(tr=>canonName(tr.cells[0].textContent)===canonName(name));
  if(tr){
    const input=tr.querySelector('input');
    input.value=safeQty((input.value||1))+qty;
  } else {
    const temp=document.createElement('tbody'); temp.innerHTML=rowHTML(name,qty);
    tr=temp.firstElementChild; tbody.appendChild(tr); wireRow(tr);
  }
  renderAll();
}
function wireRow(tr){
  const input=tr.querySelector('input');
  tr.querySelector('.btn-minus').onclick=()=>{ let v=safeQty(input.value)-1; if(v<=0) tr.remove(); else input.value=v; renderAll(); };
  tr.querySelector('.btn-plus').onclick=()=>{ input.value=safeQty(input.value)+1; renderAll(); };
  tr.querySelector('.btn-del').onclick=()=>{ tr.remove(); renderAll(); };
  input.oninput=renderAll; input.onchange=renderAll;
}
function readStock(){
  return [...$('tbody').querySelectorAll('tr')].map(tr=>({name:tr.cells[0].textContent, qty:safeQty(tr.querySelector('input').value)}));
}

/* ---------------- Bars ---------------- */
function capacityUnits(){
  const g=parseFloat($('gallons')?.value||0)||0, planted=$('planted')?.checked, f=$('filtration')?.value;
  const fFac=f==='low'?0.8:f==='high'?1.25:1, perGal=0.9;
  return Math.max(1,g*perGal)*fFac*(planted?1.1:1);
}
function totalBioPoints(stock,map){ return stock.reduce((s,{name,qty})=>s+(map.get(canonName(name))?.points||1)*qty,0); }
function setBarFill(el,p){ if(el) el.style.width=Math.max(0,Math.min(100,p)).toFixed(1)+'%'; }
function rangeOverlap(a,b){ if(!a||!b) return 0; const lo=Math.max(a[0],b[0]), hi=Math.min(a[1],b[1]), o=Math.max(0,hi-lo); return Math.max(0,Math.min(1,o/Math.max(b[1]-b[0],a[1]-a[0],1))); }
function envFitResult(stock,map){
  if(stock.length<2) return {fill:0,severe:false};
  let t=1,p=1; const arr=[...new Set(stock.map(s=>canonName(s.name)))];
  for(let i=0;i<arr.length;i++){const ri=map.get(arr[i]);
    for(let j=i+1;j<arr.length;j++){const rj=map.get(arr[j]);
      t=Math.min(t,rangeOverlap(getTempRange(ri),getTempRange(rj)));
      p=Math.min(p,rangeOverlap(getPhRange(ri),getPhRange(rj)));
    }}
  const both=Math.min(t,p); return both<=0?{fill:100,severe:true}:{fill:(1-both)*100,severe:false};
}
function aggressionResult(stock,map){
  const names=stock.map(s=>canonName(s.name)), warns=[]; let score=0;
  const has=re=>names.some(n=>re.test(n)), pair=(a,b)=>has(a)&&has(b);
  if(pair(/\bbetta\b/i,/\b(angelfish|gourami)\b/i)){score+=60;warns.push({txt:'Betta with Angelfish/Gourami = fin nipping risk.',sev:'severe'});}
  if(has(/\btiger barb|serpae|skirt tetra|black skirt\b/i)&&has(/\b(betta|guppy|angelfish|gourami)\b/i)){score+=50;warns.push({txt:'Fin-nippers with long-finned fish.',sev:'moderate'});}
  stock.forEach(s=>{const row=map.get(canonName(s.name));const min=getMinFromRow(row);if(min>=3&&s.qty<min){score+=10;warns.push({txt:`${titleCase(s.name)} prefer ${min}+ (have ${s.qty}).`,sev:'mild'});}});
  return {score:Math.min(100,score),warns};
}

/* ---------------- Render ---------------- */
let nameMap=null;
function renderAll(){
  if(!nameMap) nameMap=byNameMap(toArray(window.FISH_DATA));
  const stock=readStock();

  setBarFill($('bioBarFill'),(totalBioPoints(stock,nameMap)/capacityUnits())*100);
  const env=envFitResult(stock,nameMap);
  setBarFill($('envBarFill'),env.fill);
  $('compat-warnings').innerHTML=''; if(env.severe)$('compat-warnings').appendChild(bubble('Temp or pH ranges incompatible','severe'));
  const agg=aggressionResult(stock,nameMap);
  setBarFill($('aggBarFill'),agg.score);
  $('aggression-warnings').innerHTML=''; agg.warns.forEach(w=>$('aggression-warnings').appendChild(bubble(w.txt,w.sev)));
}
function bubble(txt,sev='info'){const d=document.createElement('div');d.className=`warning-bubble warning-${sev}`;d.textContent=txt;return d;}

/* ---------------- Boot ---------------- */
function boot(){
  populateSelect();
  $('addFish').onclick=()=>{
    const sel=$('fishSelect'); if(!sel||!sel.value)return;
    const raw=$('fQty').value.trim(), qty=raw?safeQty(raw):safeQty($('recMin').value);
    addOrUpdateStock(sel.value,qty);
  };
  $('reset').onclick=()=>{$('tbody').innerHTML='';renderAll();};
  ['gallons','filtration','planted'].forEach(id=>$(id)?.addEventListener('input',renderAll));
  renderAll();
}
document.addEventListener('DOMContentLoaded', boot);