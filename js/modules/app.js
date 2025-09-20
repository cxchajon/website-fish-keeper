/* FishkeepingLifeCo — Stocking Calculator core (v9.7.1)
   - Bars start at 0 and animate up
   - When no fish: all bars resolve to 0 (no false fill)
   - Current Stock empty-row is styled for readability
   - Aggression bar shows COMPATIBILITY (full = better)
*/

'use strict';

// ---------- Helpers ----------
const $ = (sel) => /** @type {HTMLElement} */(document.querySelector(sel));
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const toInt = (v, def = 0) => { const n = Number.parseInt(String(v), 10); return Number.isFinite(n) ? n : def; };
const toNum = (v, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; } catch { return fallback; } };

// Simple width animation that *always* starts from 0
function animateBar(el, pct, ms = 700) {
  el.style.transition = 'none';
  el.style.width = '0%';
  void el.offsetWidth; // force reflow
  el.style.transition = `width ${ms}ms ease`;
  el.style.width = `${clamp(pct, 0, 100)}%`;
}

// ---------- Species DB ----------
const FALLBACK_DB = [
  { id:'betta_m', name:'Betta (male)', aggression:0.7, bioload:1.6, temp:[76,82], pH:[6.0,7.5], schoolMin:1, soloOK:true, tags:['anabantoid','longfin','predator'] },
  { id:'cardinal', name:'Cardinal Tetra', aggression:0.2, bioload:0.25, temp:[75,82], pH:[5.5,7.0], schoolMin:6, soloOK:false, tags:['schooling'] },
  { id:'amano', name:'Amano Shrimp', aggression:0.05, bioload:0.05, temp:[68,78], pH:[6.2,7.8], schoolMin:6, soloOK:false, tags:['shrimp'] },
];
const DB = (globalThis.FISH_DB && Array.isArray(globalThis.FISH_DB) && globalThis.FISH_DB.length)
  ? globalThis.FISH_DB : FALLBACK_DB;

// ---------- DOM refs ----------
const gallonsEl = $('#gallons');
const filtrationEl = $('#filtration');
const plantedEl = $('#planted');
const fishSearchEl = $('#fishSearch');
const fishSelectEl = $('#fishSelect');
const qtyEl = $('#fQty');
const recMinEl = $('#recMin');
const addBtn = $('#addFish');
const resetBtn = $('#reset');
const tbody = $('#tbody');
const bioBarFill = $('#bioBarFill');
const envBarFill = $('#envBarFill');
const aggBarFill = $('#aggBarFill');
const compatWarningsEl = $('#compat-warnings');
const aggressionWarningsEl = $('#aggression-warnings');

// ---------- State ----------
const LS_KEY = 'flc_stock_v1';
let stock = load(LS_KEY, []); // [{id, qty}]
let filterQuery = '';

// ---------- Setup ----------
document.addEventListener('DOMContentLoaded', () => {
  populateSelect();
  renderAll(); // animate from 0

  fishSearchEl.addEventListener('input', onSearch);
  fishSelectEl.addEventListener('change', onSpeciesChange);
  qtyEl.addEventListener('input', onQtyInput);

  addBtn.addEventListener('click', onAddClicked, { passive: true });
  resetBtn.addEventListener('click', onReset, { passive: true });

  gallonsEl.addEventListener('input', onSetupChanged);
  filtrationEl.addEventListener('change', onSetupChanged);
  plantedEl.addEventListener('change', onSetupChanged);

  updateRecMin();
});

// ---------- UI building ----------
function populateSelect() {
  const list = filteredSpecies();
  fishSelectEl.innerHTML = '';
  for (const s of list) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    fishSelectEl.appendChild(opt);
  }
  if (list.length) fishSelectEl.value = list[0].id;
}

function filteredSpecies() {
  const q = filterQuery.trim().toLowerCase();
  if (!q) return DB;
  return DB.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.aliases || []).some(a => a.toLowerCase().includes(q))
  );
}

function onSearch(e) {
  filterQuery = String(e.target.value || '');
  const prevSel = fishSelectEl.value;
  populateSelect();
  if ([...fishSelectEl.options].some(o => o.value === prevSel)) fishSelectEl.value = prevSel;
  updateRecMin();
}
function onSpeciesChange() { updateRecMin(); }
function onQtyInput() { /* reserved */ }

// ---------- Recommended minimum ----------
function getRecMinFor(id) {
  const s = DB.find(x => x.id === id);
  if (!s) return 1;
  if (s.soloOK) return 1;
  return s.schoolMin ? clamp(toInt(s.schoolMin, 1), 1, 99) : 1;
}
function updateRecMin() { recMinEl.value = getRecMinFor(fishSelectEl.value); }

// ---------- Add / Remove ----------
function onAddClicked() {
  const id = fishSelectEl.value;
  if (!id) return;

  const typed = qtyEl.value;
  const qtyTyped = toInt(typed, NaN);
  const recMin = getRecMinFor(id);
  const qty = Number.isFinite(qtyTyped) && qtyTyped > 0 ? qtyTyped : (recMin || 1);

  const idx = stock.findIndex(x => x.id === id);
  if (idx >= 0) stock[idx].qty = clamp(toInt(stock[idx].qty, 0) + qty, 1, 999);
  else stock.push({ id, qty: clamp(qty, 1, 999) });

  save(LS_KEY, stock);
  renderAll(); // re-animate from 0
}

function onReset() {
  if (!stock.length) return;
  if (confirm('Clear all stocked species?')) {
    stock = [];
    save(LS_KEY, stock);
    renderAll(); // re-animate from 0
  }
}

function inc(id, delta) {
  const i = stock.findIndex(x => x.id === id);
  if (i < 0) return;
  stock[i].qty = clamp(toInt(stock[i].qty, 1) + delta, 1, 999);
  save(LS_KEY, stock);
  renderAll();
}
function remove(id) {
  stock = stock.filter(x => x.id !== id);
  save(LS_KEY, stock);
  renderAll();
}

// ---------- Rendering ----------
function renderAll() { renderTable(); renderBarsAndWarnings(); }

function renderTable() {
  tbody.innerHTML = '';
  if (!stock.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'empty-cell';
    td.textContent = 'No fish added yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  for (const entry of stock) {
    const s = DB.find(x => x.id === entry.id);
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td'); nameTd.textContent = s ? s.name : entry.id;
    const qtyTd = document.createElement('td'); qtyTd.className = 'qty'; qtyTd.textContent = String(entry.qty);

    const actionsTd = document.createElement('td'); actionsTd.className = 'actions';
    const minus = document.createElement('button'); minus.className = 'mini'; minus.type = 'button'; minus.textContent = '−';
    minus.addEventListener('click', () => inc(entry.id, -1), { passive: true });
    const plus = document.createElement('button'); plus.className = 'mini'; plus.type = 'button'; plus.textContent = '+';
    plus.addEventListener('click', () => inc(entry.id, +1), { passive: true });
    const del = document.createElement('button'); del.className = 'mini'; del.type = 'button'; del.textContent = 'Remove';
    del.addEventListener('click', () => remove(entry.id), { passive: true });

    actionsTd.append(minus, plus, del);
    tr.append(nameTd, qtyTd, actionsTd);
    tbody.appendChild(tr);
  }
}

// ---------- Bars & warnings (with 0→target animation) ----------
function renderBarsAndWarnings() {
  const gallons = clamp(toNum(gallonsEl.value, 20), 1, 9999);
  const filtration = filtrationEl.value; // 'low'|'standard'|'high'
  const planted = !!plantedEl.checked;

  // Bioload
  const totalBioload = stock.reduce((sum, e) => {
    const s = DB.find(x => x.id === e.id);
    return sum + (s ? (toNum(s.bioload, 0.3) * toInt(e.qty, 1)) : 0);
  }, 0);

  let capacity = gallons * 1.0;
  if (filtration === 'low') capacity *= 0.75;
  if (filtration === 'high') capacity *= 1.25;
  if (planted) capacity *= 1.15;

  const bioloadPct = (stock.length === 0) ? 0 : (capacity > 0 ? clamp((totalBioload / capacity) * 100, 0, 300) : 0);
  animateBar(bioBarFill, bioloadPct);

  // Environmental fit
  const ENV_TEMP = [76, 78];
  const ENV_PH = [6.6, 7.6];
  let envPct = 0;
  if (stock.length > 0) {
    const envScores = stock.map(e => {
      const s = DB.find(x => x.id === e.id);
      if (!s) return 0.5;
      const tempOverlap = rangeOverlapRatio(ENV_TEMP, s.temp || [72, 82]);
      const phOverlap   = rangeOverlapRatio(ENV_PH,   s.pH   || [6.0, 7.8]);
      return (tempOverlap + phOverlap) / 2;
    });
    envPct = clamp(avg(envScores) * 100, 0, 100);
  }
  animateBar(envBarFill, envPct);

  // Aggression → Compatibility (invert). When no fish, show 0.
  let aggCompatPct = 0;
  if (stock.length > 0) {
    const aggScores = stock.map(e => {
      const s = DB.find(x => x.id === e.id);
      return s ? clamp(toNum(s.aggression, 0.3), 0, 1) : 0.3;
    });
    const aggAvg = avg(aggScores);
    aggCompatPct = clamp((1 - aggAvg) * 100, 0, 100);
  }
  animateBar(aggBarFill, aggCompatPct);

  // Warnings
  compatWarningsEl.innerHTML = '';
  aggressionWarningsEl.innerHTML = '';
  if (bioloadPct >= 100 && bioloadPct < 130) bubble(compatWarningsEl, 'Bioload near capacity. Monitor closely.');
  if (bioloadPct >= 130) bubble(compatWarningsEl, 'Bioload over capacity. Reduce stock or increase filtration.');
  addSchoolingWarnings();
  addBettaRules();
  addShrimpRiskWarnings();
  addLongfinNippingWarnings();
}

function addSchoolingWarnings() {
  for (const e of stock) {
    const s = DB.find(x => x.id === e.id);
    if (!s) continue;
    if (!s.soloOK && s.schoolMin && e.qty < s.schoolMin) {
      bubble(compatWarningsEl, `${s.name}: below recommended group of ${s.schoolMin}.`);
    }
  }
}

function addBettaRules() {
  const bettaM = stock.find(e => e.id === 'betta_m');
  if (bettaM && bettaM.qty > 1) bubble(aggressionWarningsEl, 'Multiple male Bettas can fight — keep only one male.');
  if (bettaM) {
    const hasGourami = stock.some(e => ['dgourami','pgourami'].includes(e.id));
    const hasLongfinTargets = stock.some(e => {
      const s = DB.find(x => x.id === e.id);
      return s && (s.tags || []).includes('longfin') && e.id !== 'betta_m';
    });
    if (hasGourami) bubble(aggressionWarningsEl, 'Betta + Gourami can result in territorial disputes.');
    if (hasLongfinTargets) bubble(aggressionWarningsEl, 'Betta may flare at long-finned tankmates (nipping risk).');
  }
}

function addShrimpRiskWarnings() {
  const hasShrimp = stock.some(e => {
    const s = DB.find(x => x.id === e.id);
    return s && (s.tags || []).includes('shrimp');
  });
  if (!hasShrimp) return;
  const riskyPredators = stock.filter(e => {
    const s = DB.find(x => x.id === e.id);
    return s && ((s.tags || []).includes('predator') || toNum(s.aggression,0.3) >= 0.5);
  });
  if (riskyPredators.length) bubble(compatWarningsEl, 'Shrimp may be prey — dense plants and hides recommended.');
}

function addLongfinNippingWarnings() {
  const hasLongfin = stock.some(e => {
    const s = DB.find(x => x.id === e.id);
    return s && (s.tags || []).includes('longfin');
  });
  if (!hasLongfin) return;
  const possibleNippers = stock.some(e => {
    const s = DB.find(x => x.id === e.id);
    return s && (['cherrybarb','zebra'].includes(e.id) || toNum(s.aggression,0.3) >= 0.45);
  });
  if (possibleNippers) bubble(aggressionWarningsEl, 'Long-finned fish present — watch for fin-nipping behavior.');
}

function bubble(parent, text) {
  const div = document.createElement('div');
  div.className = 'warning-bubble';
  div.textContent = text;
  parent.appendChild(div);
}

// ---------- Math utils ----------
function rangeOverlapRatio(a, b) {
  const [a1,a2] = a; const [b1,b2] = b;
  const lo = Math.max(Math.min(a1,a2), Math.min(b1,b2));
  const hi = Math.min(Math.max(a1,a2), Math.max(b1,b2));
  const overlap = Math.max(0, hi - lo);
  const span = Math.max(1, Math.max(a1,a2) - Math.min(a1,a2));
  return clamp(overlap / span, 0, 1);
}
function avg(arr) { return arr.reduce((s,x)=>s+x,0) / (arr.length || 1); }

// ---------- Setup change ----------
function onSetupChanged() { renderBarsAndWarnings(); }