// js/modules/app.js
import { initStockUI } from './stock.js';
import { renderAllBars } from './bioload.js';

// Simple status strip so we know everything is wired
(function statusCheck(){
  const diag = document.getElementById('diag');
  if (!diag) return;
  const box = diag.querySelector('div');
  const issues = [];
  if (!document.getElementById('fishSelect')) issues.push('Species dropdown missing');
  if (!document.getElementById('tbody')) issues.push('Table body missing');
  const fishData = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
  if (!fishData) issues.push('No global species list found');
  const ok = issues.length === 0;
  diag.className = ok ? 'ok' : 'err';
  box.textContent = ok ? 'Core OK • Safety adapter ready' : 'Issues: '+issues.join(' | ');
})();

function replaceWithClone(el){
  if (!el) return el;
  const clone = el.cloneNode(true);
  el.replaceWith(clone);
  return clone;
}

export function renderAll(){
  renderAllBars();
}

window.addEventListener('load', () => {
  // Nuke any legacy listeners that might still be attached by other scripts
  replaceWithClone(document.getElementById('addFish'));
  replaceWithClone(document.getElementById('reset'));

  initStockUI();

  // Re-render on tank control changes
  ['gallons','planted','filtration'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', renderAll);
    el.addEventListener('change', renderAll);
  });

  renderAll();
});