import { safeQty, canonName, formatName } from './utils.js';

function tbody(){ return document.getElementById('tbody'); }

/** Find an existing row by canonical name (row carries data-name key) */
function findRowByName(rawName){
  const want = canonName(rawName);
  return Array.from(tbody().querySelectorAll('tr')).find(
    tr => tr.dataset.name === want
  ) || null;
}

/** Add a new row (pretty name in UI, canonical key in data-name) */
function addRow(rawName, qty){
  const tr = document.createElement('tr');
  tr.dataset.name = canonName(rawName);

  const tdName = document.createElement('td');
  tdName.textContent = formatName(rawName);
  tr.appendChild(tdName);

  const tdQty = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'number'; input.min = '0'; input.step = '1';
  input.inputMode = 'numeric'; input.style.width = '64px';
  input.value = safeQty(qty);
  input.addEventListener('input',  () => window.renderAll && window.renderAll());
  input.addEventListener('change', () => window.renderAll && window.renderAll());
  tdQty.appendChild(input);
  tr.appendChild(tdQty);

  const tdAct = document.createElement('td');
  tdAct.style.textAlign = 'right';

  const mkBtn = (label, bg) => {
    const b = document.createElement('button');
    b.type='button'; b.className='btn'; b.textContent=label;
    if(bg) b.style.background = bg;
    b.style.marginRight='6px';
    return b;
  };
  const bMinus = mkBtn('−');
  const bPlus  = mkBtn('+');
  const bDel   = mkBtn('Delete', 'var(--bad)');

  bMinus.addEventListener('click', ()=>{
    const v = safeQty(input.value) - 1;
    if (v <= 0) tr.remove(); else input.value = v;
    window.renderAll && window.renderAll();
  });
  bPlus.addEventListener('click', ()=>{
    input.value = safeQty(input.value) + 1;
    window.renderAll && window.renderAll();
  });
  bDel.addEventListener('click', ()=>{
    tr.remove();
    window.renderAll && window.renderAll();
  });

  tdAct.appendChild(bMinus);
  tdAct.appendChild(bPlus);
  tdAct.appendChild(bDel);
  tr.appendChild(tdAct);

  tbody().appendChild(tr);
}

/** Add or bump a row by delta quantity */
export function addOrUpdateRow(name, deltaQty){
  const tr = findRowByName(name);
  if (tr){
    const input = tr.querySelector('td:nth-child(2) input');
    let v = safeQty(input.value) + safeQty(deltaQty);
    if (v <= 0){ tr.remove(); }
    else input.value = v;
  } else if (safeQty(deltaQty) > 0){
    addRow(name, safeQty(deltaQty));
  }
  window.renderAll && window.renderAll();
}

/** Read current stock as raw names + qty (use data-name, not display text) */
export function readStock(){
  return Array.from(tbody().querySelectorAll('tr')).map(tr => {
    const key = tr.dataset.name || '';
    const qtyEl = tr.querySelector('td:nth-child(2) input');
    const qty = safeQty(qtyEl && qtyEl.value ? qtyEl.value : '0');
    return key ? { name: key, qty } : null;
  }).filter(Boolean);
}

/** Clear all stock rows */
export function clearStock(){
  tbody().innerHTML = '';
  window.renderAll && window.renderAll();
}