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
  const round1 = (n) => Math.round(n * 10) / 10;

  function renderOptions() {
    // Expect dataset already curated to popular sizes (5–125g). No hardcoding.
    const tanks = listTanks()
      .filter(t => typeof t.gallons === 'number' && t.gallons >= 5 && t.gallons <= 125)
      .sort((a,b) => (a.gallons - b.gallons) || a.label.localeCompare(b.label));

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
      factsEl.textContent = '';
      return;
    }
    const inches = `${tank.dimensions_in.l} × ${tank.dimensions_in.w} in (${round1(tank.dimensions_cm.l)} × ${round1(tank.dimensions_cm.w)} cm)`;
    footprintEl.textContent = `Footprint: ${tank.footprint_in} in (${round1(tank.dimensions_cm.l)} × ${round1(tank.dimensions_cm.w)} cm)`;

    const dimsIn  = `${tank.dimensions_in.l} × ${tank.dimensions_in.w} × ${tank.dimensions_in.h} in`;
    const dimsCm  = `${round1(tank.dimensions_cm.l)} × ${round1(tank.dimensions_cm.w)} × ${round1(tank.dimensions_cm.h)} cm`;
    const line    = `${tank.gallons}g • ${round1(tank.liters)} L • ${dimsIn} (${dimsCm}) • ~${tank.filled_weight_lbs} lbs filled`;
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
