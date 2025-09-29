/*
  tank-size-card.js (page-scope)
  - Populates the Tank Size <select> from tankSizes.js
  - Updates app state (gallons/liters/selectedTankId)
  - Updates footprint + facts display
  - Triggers existing recompute hooks (if present)
  Assumptions:
    • tankSizes.js exports { listTanks, getTankById }
    • Global/state object exists or can be created at window.appState
    • Recompute function available as window.recomputeAll?.()
*/

import { listTanks, getTankById } from './tankSizes.js';

(function initTankSizeCard(){
  // DOM
  const selectEl     = document.getElementById('tank-size-select');
  const footprintEl  = document.getElementById('tank-footprint');
  const factsEl      = document.getElementById('tank-facts');

  if (!selectEl || !footprintEl || !factsEl) return;

  // State (non-destructive: reuse if app already has one)
  const state = (window.appState = window.appState || {});
  const STORAGE_KEY = 'ttg.selectedTank';

  // ----- Helpers
  const formatNumber = (value, decimals = 1) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '';
    const factor = 10 ** decimals;
    const rounded = Math.round(value * factor) / factor;
    let str = rounded.toFixed(decimals);
    str = str.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    return str;
  };

  const formatDimensionIn = (value) => formatNumber(value, 2);
  const formatDimensionCm = (value) => formatNumber(value, 1);

  function renderOptions() {
    // Limit to the popular 5–125g sizes requested for this card.
    const tanks = listTanks()
      .filter((t) => typeof t.gallons === 'number' && t.gallons >= 5 && t.gallons <= 125)
      .sort((a, b) => (a.gallons - b.gallons) || a.label.localeCompare(b.label));

    // Clear existing (keep placeholder)
    [...selectEl.querySelectorAll('option:not([disabled])')].forEach(o => o.remove());

    for (const t of tanks) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      selectEl.appendChild(opt);
    }
  }

  function updateFactsUI(tank) {
    if (!tank) {
      footprintEl.textContent = '';
      footprintEl.hidden = true;
      factsEl.textContent = 'Select a tank size to begin.';
      return;
    }

    const footprintIn = `${formatDimensionIn(tank.dimensions_in.l)} × ${formatDimensionIn(tank.dimensions_in.w)} in`;
    const footprintCm = `${formatDimensionCm(tank.dimensions_cm.l)} × ${formatDimensionCm(tank.dimensions_cm.w)} cm`;
    footprintEl.textContent = `Footprint: ${footprintIn} (${footprintCm})`;
    footprintEl.hidden = false;

    const dimsIn = `${formatDimensionIn(tank.dimensions_in.l)} × ${formatDimensionIn(tank.dimensions_in.w)} × ${formatDimensionIn(tank.dimensions_in.h)} in`;
    const dimsCm = `${formatDimensionCm(tank.dimensions_cm.l)} × ${formatDimensionCm(tank.dimensions_cm.w)} × ${formatDimensionCm(tank.dimensions_cm.h)} cm`;
    const liters = formatNumber(tank.liters, 1);
    const line = `${tank.gallons}g • ${liters} L • ${dimsIn} (${dimsCm}) • ~${tank.filled_weight_lbs} lbs filled`;
    factsEl.textContent = line;
  }

  function applyTankSelection(id) {
    const t = id ? getTankById(id) : null;
    if (!t) {
      // Reset UI/state when no selection
      selectEl.value = '';
      state.selectedTankId = null;
      state.gallons = undefined;
      state.liters  = undefined;
      updateFactsUI(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      return;
    }

    // Update state
    state.selectedTankId = t.id;
    state.gallons = t.gallons;
    state.liters  = t.liters;

    // UI
    selectEl.value = t.id;
    updateFactsUI(t);

    // Persist
    try { localStorage.setItem(STORAGE_KEY, t.id); } catch (_) {}

    // Trigger recompute pipeline if available
    if (typeof window.recomputeAll === 'function') {
      window.recomputeAll();
    } else if (typeof window.dispatchEvent === 'function') {
      // Fallback: broadcast an event some apps listen for
      window.dispatchEvent(new CustomEvent('ttg:recompute'));
    }
  }

  // ----- Events
  selectEl.addEventListener('change', (e) => {
    applyTankSelection(e.target.value);
  });

  // ----- Init
  renderOptions();

  // Hydrate from storage (if valid), else leave placeholder
  let savedId = null;
  try { savedId = localStorage.getItem(STORAGE_KEY) || null; } catch (_) {}
  if (savedId && getTankById(savedId)) {
    applyTankSelection(savedId);
  } else {
    updateFactsUI(null);
  }

  // Ensure Beginner Mode remains default OFF (don’t force here—respect existing logic)
  const beginnerToggle = document.getElementById('toggle-beginner');
  if (beginnerToggle && beginnerToggle.checked) {
    beginnerToggle.checked = false;
  }
})();
