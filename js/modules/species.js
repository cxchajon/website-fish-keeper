// js/modules/species.js
import { canonName } from './utils.js';
import { renderAll } from './app.js';

export function populateSpeciesSelect(sel, recMinEl, searchBox){
  if (!sel || sel.options.length) return;
  const src = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES || [];
  const list = Array.isArray(src) ? src.map(r=>({name:r.name || r.species || r.common, min:r.min||r.recommendedMinimum||1}))
                                  : Object.keys(src).map(k=>({name:k, min:(src[k]&& (src[k].min||src[k].recommendedMinimum||1))||1}));
  list.sort((a,b)=> a.name.localeCompare(b.name));
  list.forEach(item=>{
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.textContent = item.name;
    opt.dataset.min = item.min || 1;
    sel.appendChild(opt);
  });

  function updateRecMin(){
    const opt = sel.selectedOptions[0];
    const m = opt ? parseInt(opt.dataset.min||'1',10) || 1 : 1;
    if (recMinEl) recMinEl.value = m;
  }
  if (searchBox){
    searchBox.addEventListener('input', () => {
      const q = (searchBox.value||'').toLowerCase();
      Array.from(sel.options).forEach(o=>{
        o.hidden = q && !o.textContent.toLowerCase().includes(q);
      });
      const first = Array.from(sel.options).find(o=>!o.hidden);
      if (first){ sel.value = first.value; updateRecMin(); }
    });
  }
  sel.addEventListener('change', updateRecMin);
  updateRecMin();
}

export function findRowByName(name){
  const want = canonName(name);
  const rows = document.querySelectorAll('#tbody tr');
  for (let i=0;i<rows.length;i++){
    const n = canonName(rows[i].querySelector('td')?.textContent||'');
    if(n===want) return rows[i];
  }
  return null;
}

export function addOrUpdateRow(name, deltaQty){
  const tbody=document.getElementById('tbody');
  let tr=findRowByName(name);
  if(tr){
    const qtyInput=tr.querySelector('td:nth-child(2) input');
    const current = parseInt(qtyInput.value||'0',10) || 0;
    const next = current + deltaQty;
    if (next <= 0){ tr.remove(); renderAll(); return; }
    qtyInput.value = next;
    renderAll(); return;
  }
  if (deltaQty <= 0) return;

  tr=document.createElement('tr');

  const tdName=document.createElement('td'); tdName.textContent=name;

  const tdQty=document.createElement('td');
  const input=document.createElement('input');
  input.type='number'; input.min='0'; input.step='1'; input.inputMode='numeric'; input.style.width='64px';
  input.value = deltaQty;
  input.addEventListener('input', renderAll);
  input.addEventListener('change', renderAll);
  tdQty.appendChild(input);

  const tdAct=document.createElement('td'); tdAct.style.textAlign='right';
  const bMinus=document.createElement('button'); bMinus.textContent='−'; bMinus.className='btn'; bMinus.style.marginRight='6px'; bMinus.type='button';
  const bPlus=document.createElement('button'); bPlus.textContent='+'; bPlus.className='btn'; bPlus.style.marginRight='6px'; bPlus.type='button';
  const bDel=document.createElement('button');  bDel.textContent='Delete'; bDel.className='btn'; bDel.style.background='var(--bad)'; bDel.type='button';

  bMinus.addEventListener('click', () => {
    const v = (parseInt(input.value||'0',10) || 0) - 1;
    if (v <= 0) tr.remove(); else input.value = v;
    renderAll();
  });
  bPlus.addEventListener('click', () => { input.value = (parseInt(input.value||'0',10) || 0) + 1; renderAll(); });
  bDel.addEventListener('click', () => { tr.remove(); renderAll(); });

  tdAct.appendChild(bMinus); tdAct.appendChild(bPlus); tdAct.appendChild(bDel);
  tr.appendChild(tdName); tr.appendChild(tdQty); tr.appendChild(tdAct);
  tbody.appendChild(tr);
  renderAll();
}

export function clearAllRows(){
  const tbody=document.getElementById('tbody');
  if (tbody) tbody.innerHTML='';
}

export function readStock(){
  const tbody=document.getElementById('tbody');
  return Array.from(tbody.querySelectorAll('tr')).map(tr=>{
    const tds=tr.querySelectorAll('td');
    const name=(tds[0]?.textContent||'').trim();
    const qtyEl=tds[1]?.querySelector('input');
    const qty=parseInt(qtyEl && qtyEl.value ? qtyEl.value : '0',10) || 0;
    return name ? {name, qty} : null;
  }).filter(Boolean);
}