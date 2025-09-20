// js/modules/stock.js
import { safeQty } from './utils.js';
import { addOrUpdateRow, clearAllRows, populateSpeciesSelect } from './species.js';
import { renderAll } from './app.js';

export function initStockUI () {
  const sel   = document.getElementById('fishSelect');
  const qtyEl = document.getElementById('fQty');
  const recEl = document.getElementById('recMin');
  const addBt = document.getElementById('addFish');
  const clrBt = document.getElementById('reset');
  const search= document.getElementById('fishSearch');

  populateSpeciesSelect(sel, recEl, search); // NEVER touches qty field

  function hasUserQty() {
    return String(qtyEl?.value ?? '').trim().length > 0;
  }
  function readQtyFromField() {
    if (!qtyEl) return 1;
    if (Number.isFinite(qtyEl.valueAsNumber)) return safeQty(qtyEl.valueAsNumber);
    return safeQty(qtyEl.value);
  }
  function handleAdd(e){
    if (e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    const name = sel?.value || '';
    if (!name) return;

    // Use user's qty when present, else rec min
    const qty = hasUserQty()
      ? readQtyFromField()
      : safeQty(recEl?.value || 1);

    if (qty < 1) return;
    addOrUpdateRow(name, qty);
    renderAll();
  }

  addBt?.addEventListener('click', handleAdd, true);
  qtyEl?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') handleAdd(e); });

  clrBt?.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    clearAllRows(); renderAll();
  }, true);
}