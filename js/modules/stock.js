// js/modules/stock.js
import { canonName, safeQty, formatName } from './utils.js';

// we'll call this after every change (to update bars/warnings).
let _renderAll = () => {};
export function registerRender(fn){
  if (typeof fn === 'function') _renderAll = fn;
}

/** Find an existing row by species name (case/format insensitive) */
export function findRowByName(name){
  const want = canonName(name);
  const rows = document.querySelectorAll('#tbody tr');
  for (let i=0; i<rows.length; i++){
    const n = canonName(rows[i].querySelector('td')?.textContent || '');
    if (n === want) return rows[i];
  }
  return null;
}

/** Create a new table row for a species with the given starting qty */
export function addRow(name, qty){
  const tbody = document.getElementById('tbody');
  const tr = document.createElement('tr');

  // Name cell (pretty display)
  const tdName = document.createElement('td');
  tdName.textContent = formatName(name);

  // Qty cell with input
  const tdQty = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.inputMode = 'numeric';
  input.style.width = '64px';
  input.value = safeQty(qty);
  input.addEventListener('change', _renderAll);
  input.addEventListener('input', _renderAll);
  tdQty.appendChild(input);

  // Actions cell
  const tdAct = document.createElement('td');
  tdAct.style.textAlign = 'right';

  const bMinus = document.createElement('button');
  bMinus.textContent = '−';
  bMinus.className = 'btn';
  bMinus.style.marginRight = '6px';
  bMinus.type = 'button';

  const bPlus = document.createElement('button');
  bPlus.textContent = '+';
  bPlus.className = 'btn';
  bPlus.style.marginRight = '6px';
  bPlus.type = 'button';

  const bDel = document.createElement('button');
  bDel.textContent = 'Delete';
  bDel.className = 'btn';
  bDel.style.background = 'var(--bad)';
  bDel.type = 'button';

  bMinus.addEventListener('click', function(){
    let v = safeQty(input.value);
    v = Math.max(0, v - 1);
    input.value = v;
    if (v === 0) tr.remove();
    _renderAll();
  });
  bPlus.addEventListener('click', function(){
    input.value = safeQty(input.value) + 1;
    _renderAll();
  });
  bDel.addEventListener('click', function(){
    tr.remove();
    _renderAll();
  });

  tdAct.appendChild(bMinus);
  tdAct.appendChild(bPlus);
  tdAct.appendChild(bDel);

  tr.appendChild(tdName);
  tr.appendChild(tdQty);
  tr.appendChild(tdAct);

  // micro-interaction: fade+slide on add
  tr.classList.add('row-appear');
  tbody.appendChild(tr);
  tr.addEventListener('animationend', () => tr.classList.remove('row-appear'), { once:true });
}

/** Add to an existing species' qty, or create a new row */
export function addOrUpdateRow(name, deltaQty){
  let tr = findRowByName(name);
  if (tr){
    const qtyInput = tr.querySelector('td:nth-child(2) input');
    let v = safeQty(qtyInput.value);
    v = v + safeQty(deltaQty);
    if (v <= 0){
      tr.remove();
      _renderAll();
      return;
    }
    qtyInput.value = v;

    // ensure name cell stays nicely formatted even if original was raw
    const nameTd = tr.querySelector('td:first-child');
    if (nameTd) nameTd.textContent = formatName(name);

    _renderAll();
    return;
  }
  if (safeQty(deltaQty) <= 0) return;
  addRow(name, deltaQty);
  _renderAll();
}

/** Read all current stock rows into an array: [{name, qty}] */
export function readStock(){
  const tbody = document.getElementById('tbody');
  return Array.from(tbody.querySelectorAll('tr')).map(tr=>{
    const tds = tr.querySelectorAll('td');
    const name = (tds[0]?.textContent || '').trim(); // already formatted for display
    const qtyEl = tds[1]?.querySelector('input');
    const qty = safeQty(qtyEl && qtyEl.value ? qtyEl.value : '0');
    return name ? { name, qty } : null;
  }).filter(Boolean);
}