/* ===== Species dropdown (robust) ===== */
const DATA = Array.isArray(window.FISH_DATA) ? window.FISH_DATA : [];

function titleCaseName(s){
  return (s||'')
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function buildSpeciesIndex(){
  const byKey = new Map();
  for (const row of DATA){
    const name = row?.name || row?.species || row?.common || '';
    if (!name) continue;
    const key = name.toLowerCase().replace(/[_\s-]+/g,' ').trim();
    byKey.set(key, row);
  }
  return byKey;
}
const SPECIES_BY_KEY = buildSpeciesIndex();

function populateSpeciesSelect(){
  const sel = document.getElementById('fishSelect');
  const rec = document.getElementById('recMin');
  const search = document.getElementById('fishSearch');
  if (!sel) return;

  // Clear then fill
  sel.innerHTML = '';
  const rows = [...SPECIES_BY_KEY.values()].sort((a,b)=>
    (a.name||'').localeCompare(b.name||'')
  );
  for (const r of rows){
    const opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = r.name;                // already proper-cased in your data
    opt.dataset.min = r.min || r.recommendedMinimum || 1;
    sel.appendChild(opt);
  }

  // Keep Rec Min synced with current visible selection
  function updateRecMin(){
    const o = sel.selectedOptions[0];
    if (rec && o) rec.value = parseInt(o.dataset.min || '1',10) || 1;
  }

  // Basic search that never hides ALL options (always leaves first match selected)
  if (search){
    search.addEventListener('input', () => {
      const q = (search.value||'').trim().toLowerCase();
      let firstVisible = null;
      for (const o of sel.options){
        const text = o.textContent.toLowerCase();
        const show = !q || text.includes(q);
        o.hidden = !show;
        if (show && !firstVisible) firstVisible = o;
      }
      if (firstVisible){
        sel.value = firstVisible.value;
      }else{
        // If nothing matches, clear search and show all again
        search.value = '';
        for (const o of sel.options) o.hidden = false;
        sel.selectedIndex = 0;
      }
      updateRecMin();
    });
  }

  sel.addEventListener('change', updateRecMin);
  // Initialize
  sel.selectedIndex = 0;
  updateRecMin();
}

window.addEventListener('DOMContentLoaded', populateSpeciesSelect);