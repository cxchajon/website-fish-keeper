/*
  tank-size-card.js — stacked toggles, no footprint pill
  - Populates select from tankSizes.js
  - Updates state and the facts line
  - Triggers recompute
*/

import { listTanks, getTankById } from './tankSizes.js';

(function initTankSizeCard() {
  const selectEl = document.getElementById('tank-size-select');
  const factsEl = document.getElementById('tank-facts');
  const labelEl = document.querySelector('#tank-size-card .tank-size-label');

  if (!selectEl || !factsEl) return;

  const state = (window.appState = window.appState || {});
  const format = (value, precision = 1) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '';
    const fixed = value.toFixed(precision);
    return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  };

  function renderOptions() {
    const tanks = listTanks()
      .filter((t) => typeof t.gallons === 'number' && t.gallons >= 5 && t.gallons <= 125)
      .sort((a, b) => (a.gallons - b.gallons) || a.label.localeCompare(b.label));

    // clear non-placeholder options
    [...selectEl.querySelectorAll('option:not([disabled])')].forEach((o) => o.remove());

    for (const t of tanks) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      selectEl.appendChild(opt);
    }
  }

  function setFacts(tank) {
    if (!tank) {
      factsEl.textContent = '';
      return;
    }

    const dimsIn = `${format(tank.dimensions_in.l, 2)} × ${format(tank.dimensions_in.w, 2)} × ${format(tank.dimensions_in.h, 2)} in`;
    const dimsCm = `${format(tank.dimensions_cm.l)} × ${format(tank.dimensions_cm.w)} × ${format(tank.dimensions_cm.h)} cm`;
    const filled = typeof tank.filled_weight_lbs === 'number' ? ` • ~${tank.filled_weight_lbs} lbs filled` : '';
    factsEl.textContent = `${tank.gallons} gal • ${format(tank.liters)} L • ${dimsIn} (${dimsCm})${filled}`;
  }

  function applySelection(id) {
    const t = id ? getTankById(id) : null;
    if (!t) {
      selectEl.selectedIndex = 0;
      state.selectedTankId = null;
      state.gallons = undefined;
      state.liters = undefined;
      setFacts(null);
      return;
    }

    state.selectedTankId = t.id;
    state.gallons = t.gallons;
    state.liters = t.liters;

    selectEl.value = t.id;
    setFacts(t);

    if (typeof window.recomputeAll === 'function') {
      window.recomputeAll();
    } else {
      window.dispatchEvent?.(new CustomEvent('ttg:recompute'));
    }
  }

  function toggleChevron(open) {
    if (!labelEl) return;
    labelEl.classList.toggle('is-open', Boolean(open));
  }

  // events
  selectEl.addEventListener('change', (e) => {
    applySelection(e.target.value);
    toggleChevron(false);
  });
  selectEl.addEventListener('focus', () => toggleChevron(true));
  selectEl.addEventListener('blur', () => toggleChevron(false));
  selectEl.addEventListener('mousedown', () => toggleChevron(true));
  selectEl.addEventListener('touchstart', () => toggleChevron(true), { passive: true });

  // init
  renderOptions();
  selectEl.selectedIndex = 0;
  setFacts(null);

  // keep Beginner Mode default OFF
  const beginnerToggle = document.getElementById('toggle-beginner');
  if (beginnerToggle) beginnerToggle.checked = false;
})();
