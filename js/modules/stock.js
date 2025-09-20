/* js/modules/stock.js
 * Owns: adding/updating/removing rows in "Current Stock".
 * Exposes: window.Stock.addOrUpdateRow(name, qty), window.Stock.read()
 */
(function(){
  function $(id){ return document.getElementById(id); }
  function norm(s){ return (s||'').toString().trim(); }
  function canonName(s){
    return norm(s).toLowerCase()
      .replace(/[_-]+/g,' ')
      .replace(/\s+/g,' ')
      .replace(/\s*\([^)]*\)\s*/g,' ')
      .trim();
  }
  function safeQty(raw){
    if (typeof raw === 'number' && Number.isFinite(raw)){
      let n = Math.floor(raw); if(n<1) n=1; if(n>999) n=999; return n;
    }
    const s = (raw==null ? '' : String(raw)).replace(/[^\d]/g,'').slice(0,3);
    let n = parseInt(s,10); if(isNaN(n)||n<1) n=1; if(n>999) n=999; return n;
  }
  function formatName(raw){
    return (raw||'')
      .replace(/[_-]+/g,' ')
      .replace(/\s+/g,' ')
      .trim()
      .replace(/\b\w/g,c=>c.toUpperCase());
  }

  function findRowByName(name){
    const want = canonName(name);
    const rows = $('tbody')?.querySelectorAll('tr') || [];
    for (let i=0;i<rows.length;i++){
      const cellName = rows[i].querySelector('td')?.textContent || '';
      if (canonName(cellName) === want) return rows[i];
    }
    return null;
  }

  function addRow(name, qty){
    const tbody = $('tbody'); if(!tbody) return;
    const tr = document.createElement('tr');
    tr.className = 'row-appear';

    // Name
    const tdName = document.createElement('td');
    tdName.textContent = formatName(name);

    // Qty
    const tdQty = document.createElement('td');
    const input = document.createElement('input');
    input.type='number'; input.min='0'; input.step='1'; input.inputMode='numeric';
    input.style.width='72px'; input.value = qty;
    input.addEventListener('input',   () => window.__renderAll__ && window.__renderAll__());
    input.addEventListener('change',  () => window.__renderAll__ && window.__renderAll__());
    tdQty.appendChild(input);

    // Actions
    const tdAct = document.createElement('td'); tdAct.style.textAlign='right';
    const bMinus = document.createElement('button'); bMinus.type='button'; bMinus.className='btn'; bMinus.textContent='−'; bMinus.style.marginRight='6px';
    const bPlus  = document.createElement('button'); bPlus.type='button';  bPlus.className='btn';  bPlus.textContent='+'; bPlus.style.marginRight='6px';
    const bDel   = document.createElement('button'); bDel.type='button';   bDel.className='btn';   bDel.textContent='Delete'; bDel.style.background='var(--bad)';

    bMinus.addEventListener('click', ()=>{
      let v = safeQty(input.value) - 1; if (v<0) v=0;
      input.value = v;
      if (v===0) tr.remove();
      window.__renderAll__ && window.__renderAll__();
    });
    bPlus.addEventListener('click', ()=>{
      input.value = safeQty(input.value) + 1;
      window.__renderAll__ && window.__renderAll__();
    });
    bDel.addEventListener('click', ()=>{
      tr.remove();
      window.__renderAll__ && window.__renderAll__();
    });

    tdAct.appendChild(bMinus); tdAct.appendChild(bPlus); tdAct.appendChild(bDel);

    tr.appendChild(tdName);
    tr.appendChild(tdQty);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  }

  function addOrUpdateRow(name, deltaQty){
    if(!name) return;
    const tr = findRowByName(name);
    if (tr){
      const qtyInput = tr.querySelector('td:nth-child(2) input');
      let v = safeQty(qtyInput?.value || '0') + safeQty(deltaQty);
      if (v<=0){ tr.remove(); window.__renderAll__ && window.__renderAll__(); return; }
      qtyInput.value = v;
      window.__renderAll__ && window.__renderAll__();
      return;
    }
    if (safeQty(deltaQty) <= 0) return;
    addRow(name, safeQty(deltaQty));
    window.__renderAll__ && window.__renderAll__();
  }

  function read(){
    const tbody = $('tbody'); if(!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr')).map(tr=>{
      const tds = tr.querySelectorAll('td');
      const name = (tds[0]?.textContent || '').trim();
      const qtyEl = tds[1]?.querySelector('input');
      const qty = safeQty(qtyEl && qtyEl.value);
      return name ? { name, qty } : null;
    }).filter(Boolean);
  }

  // Wire the Add and Clear buttons
  window.addEventListener('load', ()=>{
    const addBtn = $('addFish');
    const qtyEl  = $('fQty');
    const recEl  = $('recMin');
    const sel    = $('fishSelect');
    const reset  = $('reset');

    function getQtyFromField(){
      if (qtyEl && Number.isFinite(qtyEl.valueAsNumber)) return safeQty(qtyEl.valueAsNumber);
      return safeQty(qtyEl?.value || '');
    }

    function onAdd(e){
      e?.preventDefault();
      const name = sel?.value || '';
      if(!name) return;
      const hasTyped = !!(qtyEl && String(qtyEl.value||'').trim().length);
      const qty = hasTyped ? getQtyFromField()
                           : safeQty(recEl?.value || '1');
      addOrUpdateRow(name, qty);
    }

    addBtn && addBtn.addEventListener('click', onAdd);
    qtyEl  && qtyEl.addEventListener('keydown', e=>{ if(e.key==='Enter') onAdd(e); });

    reset && reset.addEventListener('click', ()=>{
      if ($('tbody')) $('tbody').innerHTML = '';
      window.__renderAll__ && window.__renderAll__();
    });
  });

  // expose
  window.Stock = { addOrUpdateRow, read };
})();