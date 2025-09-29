/*
  tank-size-card.js — stacked toggles, no footprint pill
  - Populates select from tankSizes.js
  - Updates state and the facts line
  - Triggers recompute
*/

import { listTanks, getTankById } from './tankSizes.js';

(function initTankSizeCard(){
  const selectEl = document.getElementById('tank-size-select');
  const factsEl  = document.getElementById('tank-facts');

  if (!selectEl || !factsEl) return;

  const state = (window.appState = window.appState || {});
  const STORAGE_KEY = 'ttg.selectedTank';
  const round1 = (n) => Math.round(n * 10) / 10;

  function renderOptions() {
    const tanks = listTanks()
      .filter(t => typeof t.gallons === 'number' && t.gallons >= 5 && t.gallons <= 125)
      .sort((a,b) => (a.gallons - b.gallons) || a.label.localeCompare(b.label));

    // clear non-placeholder options
    [...selectEl.querySelectorAll('option:not([disabled])')].forEach(o => o.remove());

    for (const t of tanks) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      selectEl.appendChild(opt);
    }
  }

  function setFacts(tank) {
    if (!tank) {
      factsEl.textContent = 'Select a tank size to begin.';
      return;
    }
    const dimsIn = `${tank.dimensions_in.l} × ${tank.dimensions_in.w} × ${tank.dimensions_in.h} in`;
    const dimsCm = `${round1(tank.dimensions_cm.l)} × ${round1(tank.dimensions_cm.w)} × ${round1(tank.dimensions_cm.h)} cm`;
    factsEl.textContent = `${tank.gallons}g • ${round1(tank.liters)} L • ${dimsIn} (${dimsCm}) • ~${tank.filled_weight_lbs} lbs filled`;
  }

  function applySelection(id) {
    const t = id ? getTankById(id) : null;
    if (!t) {
      selectEl.value = '';
      state.selectedTankId = null;
      state.gallons = undefined;
      state.liters  = undefined;
      setFacts(null);
      return;
    }

    state.selectedTankId = t.id;
    state.gallons = t.gallons;
    state.liters  = t.liters;

    selectEl.value = t.id;
    setFacts(t);

    try { localStorage.setItem(STORAGE_KEY, t.id); } catch (_) {}

    if (typeof window.recomputeAll === 'function') {
      window.recomputeAll();
    } else {
      window.dispatchEvent?.(new CustomEvent('ttg:recompute'));
    }
  }

  // events
  selectEl.addEventListener('change', (e) => applySelection(e.target.value));

  // init
  renderOptions();
  let savedId = null;
  try { savedId = localStorage.getItem(STORAGE_KEY) || null; } catch (_) {}
  if (savedId && getTankById(savedId)) applySelection(savedId);
  else setFacts(null);

  // keep Beginner Mode default OFF
  const beginnerToggle = document.getElementById('toggle-beginner');
  if (beginnerToggle) beginnerToggle.checked = false;
})();
