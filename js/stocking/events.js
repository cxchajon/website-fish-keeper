export const EVENTS = Object.freeze({
  TANK_CHANGED: 'ttg:tank:changed',
  SPECIES_CHANGED: 'ttg:species:changed',
  STOCK_CHANGED: 'ttg:stock:changed',
});

export function dispatchEvent(name, detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
