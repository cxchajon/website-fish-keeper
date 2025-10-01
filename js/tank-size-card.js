import { listTanks, getTankById } from './tankSizes.js';
import { normalizeLegacyTankSelection } from './utils.js';
import { setTank, normalizeTankPreset, getTankSnapshot } from './stocking/tankStore.js';

(function wireTankSizeChevron(){
  const wrap = document.getElementById('tank-size-select-wrap');
  const sel  = document.getElementById('tank-size-select');
  if (!wrap || !sel) return;

  // On desktop browsers, focus/blur is enough. On iOS, change is the reliable signal.
  const setOpen = (on) => wrap.classList.toggle('open', !!on);

  sel.addEventListener('focus', () => setOpen(true));
  sel.addEventListener('blur',  () => setOpen(false));

  // iOS Safari sometimes doesn't fire focus the same way when picker opens; use click/change as hints.
  sel.addEventListener('click',  () => setOpen(true));
  sel.addEventListener('change', () => setOpen(false));

  // Safety: if the element becomes disabled/enabled or page hides, ensure state resets
  document.addEventListener('visibilitychange', () => { if (document.hidden) setOpen(false); });
})();

(function initTankSizeCard(){
  const selectEl   = document.getElementById('tank-size-select');
  const factsEl    = document.getElementById('tank-facts');

  if (!selectEl || !factsEl) return;

  const state = (window.appState = window.appState || {});
  const presetCache = new Map();
  const STORAGE_KEY = 'ttg.selectedTank';
  const round1 = (n) => Math.round(n*10)/10;

  function cachePreset(preset){
    const normalized = normalizeTankPreset(preset);
    if (normalized) {
      presetCache.set(normalized.id, normalized);
    }
    return normalized;
  }

  function getNormalizedById(id){
    if (!id) return null;
    if (presetCache.has(id)) {
      return presetCache.get(id);
    }
    const preset = getTankById(id);
    if (!preset) return null;
    return cachePreset(preset);
  }

  // 1) Populate select from curated dataset (5–125g)
  function renderOptions(){
    presetCache.clear();
    const tanks = listTanks()
      .map((tank) => cachePreset(tank))
      .filter(Boolean)
      .sort((a, b) => (a.gallons - b.gallons) || a.label.localeCompare(b.label));

    [...selectEl.querySelectorAll('option:not([disabled])')].forEach((option) => option.remove());
    for (const tank of tanks) {
      const opt = document.createElement('option');
      opt.value = tank.id;
      opt.textContent = tank.label;
      selectEl.appendChild(opt);
    }
  }

  function formatDim(value){
    if (!Number.isFinite(value)) return '0';
    if (Number.isInteger(value)) return String(value);
    return (Math.round(value * 100) / 100).toString();
  }

  // 2) Facts line
  function setFacts(tank){
    if (!tank){ factsEl.textContent = ''; return; }
    const dimsIn = `${formatDim(tank.lengthIn)} × ${formatDim(tank.widthIn)} × ${formatDim(tank.heightIn)} in`;
    const dimsCm = `${formatDim(tank.dimensionsCm.l)} × ${formatDim(tank.dimensionsCm.w)} × ${formatDim(tank.dimensionsCm.h)} cm`;
    const weight = Number.isFinite(tank.filledWeightLbs) && tank.filledWeightLbs > 0 ? ` • ~${Math.round(tank.filledWeightLbs)} lbs filled` : '';
    factsEl.textContent = `${tank.gallons}g • ${round1(tank.liters)} L • ${dimsIn} (${dimsCm})${weight}`;
  }

  // 3) Recompute hook
  function recompute(){
    if (typeof window.recomputeAll === 'function') window.recomputeAll();
    else window.dispatchEvent?.(new CustomEvent('ttg:recompute'));
  }

  function syncStateFromSnapshot(snapshot){
    state.selectedTankId = snapshot.id;
    state.gallons = snapshot.gallons;
    state.liters = snapshot.liters;
    state.tank = snapshot;
  }

  // 4) Apply selection
  function applySelection(id){
    const tank = id ? getNormalizedById(id) : null;
    if (!tank){
      selectEl.value = '';
      const snapshot = setTank(null);
      syncStateFromSnapshot(snapshot);
      setFacts(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_){ }
      recompute();
      return;
    }
    const snapshot = setTank(tank);
    selectEl.value = tank.id;
    syncStateFromSnapshot(snapshot);
    state.variantId = null;
    setFacts(snapshot);
    try { localStorage.setItem(STORAGE_KEY, tank.id); } catch(_){}
    recompute();
  }

  // 5) Events
  selectEl.addEventListener('change', (e)=>applySelection(e.target.value));

  // 6) Init
  renderOptions();

  // Hydrate persisted tank choice
  let savedId = null;
  try { savedId = localStorage.getItem(STORAGE_KEY) || null; } catch(_){ }
  const normalizedSavedId = normalizeLegacyTankSelection(savedId);
  if (normalizedSavedId && getNormalizedById(normalizedSavedId)) {
    applySelection(normalizedSavedId);
  } else {
    const snapshot = getTankSnapshot();
    if (snapshot && snapshot.id) {
      selectEl.value = snapshot.id;
      setFacts(snapshot);
    } else {
      setFacts(null);
    }
  }
})();

(function wirePlantedOverlay(){
  const page = document.getElementById('stocking-page');
  const planted = document.getElementById('toggle-planted');
  if (!page || !planted) return;

  const apply = () => {
    page.classList.toggle('is-planted', !!planted.checked);
  };

  apply();

  planted.addEventListener('change', apply, { passive: true });
})();
