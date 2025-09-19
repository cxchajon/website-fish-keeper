// js/modules/warnings.js
import { toArray } from './utils.js';
import { renderBioload } from './bioload.js';
import { readStock } from './stock.js';

// Build the aggression/compatibility messages and update the red/orange bar
export function renderWarnings(){
  const box = document.getElementById('aggression-warnings') || document.getElementById('warnings');
  if (!box) return;

  box.innerHTML = '';
  const stock = readStock();

  const opts = {
    planted: !!document.getElementById('planted')?.checked,
    gallons: parseFloat(document.getElementById('gallons')?.value || '0') || 0
  };

  let res = { warnings: [], score: 0 };
  if (window.Aggression && typeof window.Aggression.compute === 'function') {
    try { res = window.Aggression.compute(stock, opts); } catch (e) {}
  }

  toArray(res.warnings).forEach(w => {
    const d = document.createElement('div');
    d.textContent = w;
    box.appendChild(d);
  });

  const bar = document.getElementById('aggBarFill');
  if (bar && typeof res.score === 'number') {
    bar.style.width = Math.min(100, Math.max(0, res.score)) + '%';
  }
}

// One call that refreshes everything UI-wise
export function renderAll(){
  renderWarnings();
  renderBioload();
}