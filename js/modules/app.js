// js/modules/app.js
import { populateSelectIfEmpty } from './species.js?v=921';
import { addOrUpdateRow, registerRender } from './stock.js?v=921';
import { renderAll } from './warnings.js?v=921';
import { statusCheck } from './status.js?v=921';
import { safeQty } from './utils.js?v=921';

// utility: replace element with a fresh clone (removes any existing listeners)
function replaceWithClone(el){
  if(!el) return el;
  const clone = el.cloneNode(true);
  el.replaceWith(clone);
  return clone;
}

window.addEventListener('load', () => {
  registerRender(renderAll);

  populateSelectIfEmpty();
  statusCheck();

  // Clone buttons to remove any 3rd-party listeners
  let addBtn   = document.getElementById('addFish');
  let resetBtn = document.getElementById('reset');
  addBtn   = replaceWithClone(addBtn);
  resetBtn = replaceWithClone(resetBtn);

  const sel   = document.getElementById('fishSelect');
  const qtyEl = document.getElementById('fQty');
  const recEl = document.getElementById('recMin');

  function getQtyFromField(){
    if (qtyEl && Number.isFinite(qtyEl.valueAsNumber)) return safeQty(qtyEl.valueAsNumber);
    const raw = (qtyEl && typeof qtyEl.value==='string') ? qtyEl.value : '';
    return safeQty(raw);
  }

  function handleAdd(e){
    if(e){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    const name = sel && sel.value ? sel.value : '';
    if(!name) return;

    const fieldRaw = qtyEl ? qtyEl.value : '';
    const hasUserValue = fieldRaw != null && String(fieldRaw).trim().length > 0;
    const qty = hasUserValue ? getQtyFromField()
                             : safeQty(recEl && recEl.value ? recEl.value : '1');

    addOrUpdateRow(name, qty);
  }

  if(addBtn) addBtn.addEventListener('click', handleAdd, true);

  if(qtyEl){
    qtyEl.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ handleAdd(e); }
    });
  }

  if(resetBtn){
    resetBtn.addEventListener('click', function(e){
      if(e){
        e.preventDefault();
        e.stopPropagation();
        if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
      const tbody=document.getElementById('tbody');
      if (tbody) tbody.innerHTML='';
      renderAll();
    }, true);
  }

  ['gallons','planted','filtration'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', renderAll);
    el.addEventListener('change', renderAll);
  });

  renderAll();
});