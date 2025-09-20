/* FishkeepingLifeCo — App bootstrap (module)
 * Purpose: wire up UI, preserve user-entered Quantity, pretty names,
 * and drive the 3 bars (Bioload delegated to existing code; EnvFit here).
 *
 * Assumes you already have:
 *   - window.FISH_DATA  (your species list)
 *   - (optional) window.Aggression.compute(...) for aggression + warnings
 *   - CSS in /css/app.css for visuals
 */

import { safeQty, canonName, formatName } from './utils.js';

/* ----------------------------- helpers ----------------------------- */

// Map species by canonical name for fast lookup
function getSpeciesMap() {
  const src = (window.FISH_DATA || []);
  const map = new Map();
  src.forEach(row => {
    const key = canonName(row.name || row.species || row.common || row.id || '');
    if (key) map.set(key, row);
  });
  return map;
}

function getRowFor(nameCanon) {
  const tbody = document.getElementById('tbody');
  if (!tbody) return null;
  const rows = tbody.querySelectorAll('tr');
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i].querySelector('td');
    const text = (cell?.textContent || '').trim();
    if (canonName(text) === nameCanon) return rows[i];
  }
  return null;
}

// Add or update a row in Current Stock (format name for display)
function addOrUpdateRowUI(displayName, qtyDelta) {
  const nameCanon = canonName(displayName);
  const tbody = document.getElementById('tbody');
  if (!tbody) return;

  // If row exists, bump quantity
  const existing = getRowFor(nameCanon);
  if (existing) {
    const input = existing.querySelector('td:nth-child(2) input');
    const current = safeQty(input?.value ?? 0);
    const next = Math.max(0, current + safeQty(qtyDelta));
    if (next <= 0) {
      existing.remove();
    } else {
      input.value = next;
    }
    renderAll();
    return;
  }

  // Create row
  if (safeQty(qtyDelta) <= 0) return;

  const tr = document.createElement('tr');

  const tdName = document.createElement('td');
  tdName.textContent = formatName(displayName);

  const tdQty = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.inputMode = 'numeric';
  input.style.width = '64px';
  input.value = String(safeQty(qtyDelta));
  input.addEventListener('input', renderAll);
  input.addEventListener('change', renderAll);
  tdQty.appendChild(input);

  const tdAct = document.createElement('td');
  tdAct.style.textAlign = 'right';

  const bMinus = document.createElement('button');
  bMinus.textContent = '−';
  bMinus.className = 'btn';
  bMinus.style.marginRight = '6px';
  bMinus.type = 'button';
  bMinus.addEventListener('click', () => {
    const curr = safeQty(input.value);
    const next = Math.max(0, curr - 1);
    input.value = String(next);
    if (next === 0) tr.remove();
    renderAll();
  });

  const bPlus = document.createElement('button');
  bPlus.textContent = '+';
  bPlus.className = 'btn';
  bPlus.style.marginRight = '6px';
  bPlus.type = 'button';
  bPlus.addEventListener('click', () => {
    input.value = String(safeQty(input.value) + 1);
    renderAll();
  });

  const bDel = document.createElement('button');
  bDel.textContent = 'Delete';
  bDel.className = 'btn';
  bDel.style.background = 'var(--bad)';
  bDel.type = 'button';
  bDel.addEventListener('click', () => {
    tr.remove();
    renderAll();
  });

  tdAct.appendChild(bMinus);
  tdAct.appendChild(bPlus);
  tdAct.appendChild(bDel);

  tr.appendChild(tdName);
  tr.appendChild(tdQty);
  tr.appendChild(tdAct);

  // cute pop-in
  tr.classList.add('row-appear');
  tbody.appendChild(tr);
  renderAll();
}

function readStockUI() {
  const tbody = document.getElementById('tbody');
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll('tr')).map(tr => {
    const nameCell = tr.querySelector('td');
    const qtyInput = tr.querySelector('td:nth-child(2) input');
    const name = (nameCell?.textContent || '').trim();
    const qty = safeQty(qtyInput?.value ?? 0);
    return name ? { name, qty } : null;
  }).filter(Boolean);
}

/* ---------------------- bars: Bioload & Aggression ---------------------- */

// Let your existing scripts handle these if present
function renderBioloadBar() {
  if (typeof window.renderBioload === 'function') {
    window.renderBioload();
    return;
  }
  // Fallback: leave as-is (no-op)
}

function renderAggressionAndWarnings() {
  const box = document.getElementById('aggression-warnings');
  const bar = document.getElementById('aggBarFill');
  if (!box || !bar) return;

  box.innerHTML = '';

  const stock = readStockUI();

  let score = 0;
  let warnings = [];

  if (window.Aggression && typeof window.Aggression.compute === 'function') {
    try {
      const opts = {
        planted: !!document.getElementById('planted')?.checked,
        gallons: Number(document.getElementById('gallons')?.value || 0) || 0
      };
      const res = window.Aggression.compute(stock, opts) || {};
      score = Number(res.score || 0);
      warnings = Array.isArray(res.warnings) ? res.warnings : [];
    } catch (_) {}
  }

  // Bar: clamp 0–100, animate via CSS
  const pct = Math.max(0, Math.min(100, score));
  bar.style.width = pct.toFixed(1) + '%';

  // Render warnings (simple list; your styled bubbles will pick up from CSS if present)
  warnings.forEach(w => {
    const d = document.createElement('div');
    d.textContent = w;
    box.appendChild(d);
  });
}

/* -------------------------- Environment Fit bar -------------------------- */
/* Based on temp & pH overlap across DISTINCT species
 * - 0 with 0–1 species
 * - builds as more compatible pairs exist
 * - edge-touch counts as tight (small positive)
 */

function speciesRangesFor(nameCanon, map) {
  const row = map.get(nameCanon);
  if (!row) return null;
  const temp = Array.isArray(row.temp) ? row.temp : null; // [low, high]
  const ph   = Array.isArray(row.ph)   ? row.ph   : null;
  return { temp, ph };
}

function pairOverlapRatio(a, b) {
  // ratio 0..1 for temp, and for pH, then averaged (ignore missing fields)
  let parts = [];
  if (a.temp && b.temp) {
    const [aL, aH] = a.temp;
    const [bL, bH] = b.temp;
    const overlap = Math.max(0, Math.min(aH, bH) - Math.max(aL, bL));
    const denom = Math.max(0.01, Math.min(aH - aL, bH - bL)); // “tight” uses narrower band
    const tempRatio = Math.max(0, Math.min(1, overlap / denom));
    parts.push(tempRatio);
  }
  if (a.ph && b.ph) {
    const [aL, aH] = a.ph;
    const [bL, bH] = b.ph;
    const overlap = Math.max(0, Math.min(aH, bH) - Math.max(aL, bL));
    const denom = Math.max(0.01, Math.min(aH - aL, bH - bL));
    const phRatio = Math.max(0, Math.min(1, overlap / denom));
    parts.push(phRatio);
  }
  if (!parts.length) return 0.0;
  return parts.reduce((s, x) => s + x, 0) / parts.length;
}

function renderEnvFitBar() {
  const bar = document.getElementById('envBarFill') || document.getElementById('envBar') || document.getElementById('envBarFill');
  if (!bar) return;

  const stock = readStockUI()
    .filter(x => safeQty(x.qty) > 0)
    .map(x => canonName(x.name));

  // distinct species only
  const distinct = Array.from(new Set(stock));
  if (distinct.length < 2) {
    bar.style.width = '0%'; // start from zero; builds as you mix
    return;
  }

  const map = getSpeciesMap();
  // build all unordered pairs
  let sum = 0;
  let count = 0;
  for (let i = 0; i < distinct.length; i++) {
    const a = speciesRangesFor(distinct[i], map);
    if (!a) continue;
    for (let j = i + 1; j < distinct.length; j++) {
      const b = speciesRangesFor(distinct[j], map);
      if (!b) continue;
      sum += pairOverlapRatio(a, b);
      count++;
    }
  }

  if (!count) {
    bar.style.width = '0%';
    return;
  }

  // Average compatibility across pairs → percentage
  const avg = sum / count;              // 0..1
  const pct = Math.max(0, Math.min(100, Math.round(avg * 100)));
  bar.style.width = pct + '%';
}

/* ----------------------------- species select ---------------------------- */

function extractSpeciesListFromData() {
  const src = window.FISH_DATA || [];
  if (!Array.isArray(src)) return [];
  return src.map(o => {
    const name = o?.name || o?.species || o?.common || '';
    const min = Number(o?.min || o?.recommendedMinimum || o?.minGroup || 0) || 0;
    return name ? { name, min } : null;
  }).filter(Boolean);
}

function populateSelectIfEmpty() {
  const sel = document.getElementById('fishSelect');
  if (!sel || sel.options.length) return;

  let list = extractSpeciesListFromData();
  if (!list.length) {
    list = [
      { name: 'Neon tetra', min: 6 },
      { name: 'Harlequin rasbora', min: 6 },
      { name: 'Corydoras (small)', min: 6 },
      { name: 'Betta (male)', min: 1 },
    ];
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.textContent = item.name;
    opt.dataset.min = String(item.min || 1);
    sel.appendChild(opt);
  });

  // keep "Recommended minimum" in sync — do NOT touch Quantity
  const recMinEl = document.getElementById('recMin');
  function syncRecMin() {
    const opt = sel.selectedOptions[0];
    const min = Number(opt?.dataset?.min || 1) || 1;
    if (recMinEl) recMinEl.value = String(min);
  }
  sel.addEventListener('change', syncRecMin);

  // search filter
  const search = document.getElementById('fishSearch');
  if (search) {
    search.addEventListener('input', function () {
      const q = (this.value || '').toLowerCase();
      Array.from(sel.options).forEach(o => {
        o.hidden = q && !o.textContent.toLowerCase().includes(q);
      });
      const firstVisible = Array.from(sel.options).find(o => !o.hidden);
      if (firstVisible) {
        sel.value = firstVisible.value;
        syncRecMin();
      }
    });
  }

  syncRecMin();
}

/* --------------------------------- boot ---------------------------------- */

function renderAll() {
  renderBioloadBar();
  renderAggressionAndWarnings();
  renderEnvFitBar();
}

window.addEventListener('load', () => {
  // status strip (if present from your status.js inline)
  const diag = document.getElementById('diag');
  if (diag) {
    const box = diag.querySelector('div');
    diag.className = 'ok';
    if (box) box.textContent = 'Core OK • Safety adapter ready';
  }

  populateSelectIfEmpty();

  // wire Add (preserve user-entered Quantity)
  const addBtn = document.getElementById('addFish');
  const qtyEl  = document.getElementById('fQty');
  const recEl  = document.getElementById('recMin');
  const sel    = document.getElementById('fishSelect');

  function currentQtyFromField() {
    const raw = (qtyEl && typeof qtyEl.value === 'string') ? qtyEl.value.trim() : '';
    return raw ? safeQty(raw) : NaN; // NaN means “user left blank”
  }

  function handleAdd(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    const name = sel?.value || '';
    if (!name) return;

    const typed = currentQtyFromField();                // user’s number if present
    const fallback = safeQty(recEl?.value ?? 1) || 1;  // else Rec Min (or 1)
    const qty = Number.isNaN(typed) ? fallback : typed;

    addOrUpdateRowUI(name, qty);
  }

  addBtn?.addEventListener('click', handleAdd);
  qtyEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdd(e);
  });

  // Clear stock
  document.getElementById('reset')?.addEventListener('click', (e) => {
    e.preventDefault();
    const tbody = document.getElementById('tbody');
    if (tbody) tbody.innerHTML = '';
    renderAll();
  });

  // Tank controls drive bars
  ['gallons', 'planted', 'filtration'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', renderAll);
    el?.addEventListener('change', renderAll);
  });

  // Initial paint
  renderAll();
});