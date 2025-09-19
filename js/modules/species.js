// js/modules/species.js
import { toArray } from './utils.js';

// turn raw fish data into a [{name, min}, ...] list
export function extractSpeciesList(src){
  if (Array.isArray(src)) {
    return src.map(o=>{
      const name = (o && (o.name||o.species||o.common)) || '';
      const min  = parseInt((o && (o.min||o.recommendedMinimum||o.minGroup||o.group)) || '0',10) || 0;
      return name ? { name, min } : null;
    }).filter(Boolean);
  }
  if (src && typeof src==='object') {
    return Object.keys(src).map(k=>{
      const v = src[k]||{};
      const min = parseInt(v.min || v.recommendedMinimum || v.minGroup || '0',10) || 0;
      return { name:k, min };
    });
  }
  return [];
}

// populate the <select> with species, hook up search & rec min
export function populateSelectIfEmpty(){
  const sel = document.getElementById('fishSelect');
  if (!sel || sel.options.length) return;

  const src = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
  let list = extractSpeciesList(src);
  if (!list.length){
    list = [
      { name:'Neon tetra', min:6 },
      { name:'Tiger barb', min:6 },
      { name:'Corydoras (small)', min:6 },
      { name:'Betta (male)', min:1 }
    ];
  }

  list.sort((a,b)=> a.name.localeCompare(b.name));
  list.forEach(item=>{
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.textContent = item.name;
    opt.dataset.min = item.min || 1;
    sel.appendChild(opt);
  });

  const search   = document.getElementById('fishSearch');
  const recMinEl = document.getElementById('recMin');

  function updateRecMinOnly(){
    const opt = sel.selectedOptions[0];
    const min = opt ? parseInt(opt.dataset.min || '1', 10) || 1 : 1;
    if(recMinEl) recMinEl.value = min;
  }

  if(search){
    search.addEventListener('input', function(){
      const q=(this.value||'').toLowerCase();
      Array.from(sel.options).forEach(o=>{
        o.hidden=q && !o.textContent.toLowerCase().includes(q);
      });
      const first = Array.from(sel.options).find(o=>!o.hidden);
      if(first){ sel.value=first.value; updateRecMinOnly(); }
    });
  }

  sel.addEventListener('change', updateRecMinOnly);
  updateRecMinOnly();
}