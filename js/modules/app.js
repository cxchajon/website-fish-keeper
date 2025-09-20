// put this near the top (after your small helpers like $()):
window.addSelectedFish = function addSelectedFish() {
  const sel = document.getElementById('fishSelect');
  const qtyField = document.getElementById('fQty');
  const recMin   = document.getElementById('recMin');

  if (!sel || !sel.value) return;

  const raw = (qtyField?.value ?? '').trim();
  const qty = raw ? Math.max(1, Math.min(999, Math.floor(+raw || 0)))
                  : Math.max(1, Math.min(999, Math.floor(+(recMin?.value || 1))));

  // use your existing table helper; if you don’t have it, this safely adds/updates a row:
  if (typeof addOrUpdateStock === 'function') {
    addOrUpdateStock(sel.value, qty);
  } else {
    // minimal fallback to add a row if helper isn't present
    const tbody = document.getElementById('tbody');
    if (!tbody) return;
    const name = sel.value;
    let tr = Array.from(tbody.querySelectorAll('tr'))
      .find(r => (r.querySelector('td')?.textContent || '').trim().toLowerCase() === name.trim().toLowerCase());

    if (!tr) {
      tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${name}</td>
        <td><input type="number" min="1" step="1" value="${qty}" style="width:72px"></td>
        <td style="text-align:right">
          <button class="btn btn-minus" type="button">−</button>
          <button class="btn btn-plus"  type="button">+</button>
          <button class="btn btn-del"   type="button" style="background:var(--bad)">Delete</button>
        </td>`;
      tbody.appendChild(tr);
    } else {
      const input = tr.querySelector('input');
      input.value = String((+input.value || 0) + qty);
    }
  }

  // re-render bars if your app has renderAll()
  if (typeof renderAll === 'function') renderAll();
};