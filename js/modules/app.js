// js/modules/app.js
import { populateSelectIfEmpty } from './species.js';
import { addOrUpdateRow, readStock, registerRender } from './stock.js';
import { renderAll } from './warnings.js';
import { statusCheck } from './status.js';
import { safeQty } from './utils.js';

// Boot logic
window.addEventListener('load', () => {
  // connect stock.js with warnings/bioload
  registerRender(renderAll);

  populateSelectIfEmpty();
  statusCheck();

  // Add Fish button
  const addBtn = document.getElementById('addFish');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const sel   = document.getElementById('fishSelect');
      const qtyEl = document.getElementById('fQty');
      const recEl = document.getElementById('recMin');

      const name = sel && sel.value ? sel.value : '';
      let raw = qtyEl?.value ? qtyEl.value.trim() : '';
      let qty = parseInt(raw, 10);

      if (!qty || qty < 1) {
        const rec = parseInt(recEl?.value || '0', 10) || 0;
        qty = rec > 0 ? rec : 1;
        if (qtyEl) qtyEl.value = qty;
      }

      if (!name) return;
      addOrUpdateRow(name, qty);
    });
  }

  // Clear stock
  const resetBtn = document.getElementById('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      document.getElementById('tbody').innerHTML = '';
      renderAll();
    });
  }

  // Tank controls update bars
  ['gallons','planted','filtration'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', renderAll);
    el.addEventListener('change', renderAll);
  });

  renderAll();
});