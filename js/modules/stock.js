// js/modules/stock.js
// Wires up: Species dropdown, Qty field, Add/Clear buttons, stock rows.
// Guarantees: we ONLY use Rec Min when Qty is blank. Your typed number is never overwritten.

import { safeQty } from './utils.js';
import { addOrUpdateRow, clearAllRows, populateSpeciesSelect, readStock } from './species.js';
import { renderAll } from './app.js'; // circular-safe: app only calls initStockUI after exports ready

export function initStockUI () {
  const sel   = document.getElementById('fishSelect');
  const qtyEl = document.getElementById('fQty');
  const recEl = document.getElementById('recMin');
  const addBt = document.getElementById('addFish');
  const clrBt = document.getElementById('reset');
  const search= document.getElementById('fishSearch');

  // Populate species list (and Rec Min), but NEVER touch the Qty field.
  populateSpeciesSelect(sel, recEl, search);

  // --- helpers ---
  function hasUserQty() {
    if (!qtyEl) return false;
    // Treat any non-empty visible content as "user entered"
    return String(qtyEl.value || '').trim().length > 0;
  }

  function readQtyFromField() {
    if (!qtyEl) return 1;
    // Safari-safe: prefer valueAsNumber when finite, else parse string
    if (Number.isFinite(qtyEl.valueAsNumber)) {
      return safeQty(qtyEl.valueAsNumber);
    }
    return safeQty(qtyEl.value);
  }

  function handleAdd(ev){
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }
    const name = sel && sel.value ? sel.value : '';
    if (!name) return;

    // Use user's typed qty if present; otherwise fall back to Rec Min (or 1).
    const qty = hasUserQty()
      ? readQtyFromField()
      : safeQty(recEl && recEl.value ? recEl.value : 1);

    if (qty < 1) return;
    addOrUpdateRow(name, qty);  // increments existing row or creates new
    renderAll();
  }

  // --- events ---
  if (addBt) addBt.addEventListener('click', handleAdd, true);

  if (qtyEl) {
    // Pressing Enter in the qty field adds, without losing the typed number
    qtyEl.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') handleAdd(e);
    });
    // Do NOT auto-fill or change qty on species change anywhere in this file.
  }

  if (clrBt) {
    clrBt.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      clearAllRows();
      renderAll();
    }, true);
  }
}

/* ========== Minimal exports that other modules may use ========== */
// no-op here; stock row operations live in species.js (addOrUpdateRow, clearAllRows, readStock)
export { readStock } from './species.js';