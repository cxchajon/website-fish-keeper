import { TANK_SIZES, getTankById, normalizeLegacyTankSelection } from './utils.js';
import { setTank, normalizeTankPreset, getTankSnapshot } from './stocking/tankStore.js';

const TANK_SELECT_QUERY = "#tank-size, [data-role='tank-size'], select[name='tank-size'], select[name='tankSize'], #tank-size-select";

function findTankSelect() {
  return document.querySelector(TANK_SELECT_QUERY);
}

function renderTankSizeOptions(selectEl) {
  selectEl.innerHTML = '';
  TANK_SIZES.forEach(({ id, label }) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    selectEl.appendChild(opt);
  });
}

const immediateSelect = findTankSelect();
if (!immediateSelect) {
  console.error('Tank size <select> not found on Stocking Advisor page.');
} else {
  renderTankSizeOptions(immediateSelect);
}

(function wireTankSizeChevron(){
  const wrap = document.getElementById('tank-size-select-wrap');
  const sel  = findTankSelect();
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
  const selectEl   = findTankSelect();
  const factsEl    = document.getElementById('tank-facts');

  if (!selectEl) return;
  if (!factsEl) return;

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

  // 1) Populate select from canonical dataset
  function renderOptions(){
    presetCache.clear();
    renderTankSizeOptions(selectEl);
    TANK_SIZES.forEach((tank) => cachePreset(tank));
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
  function applySelection(rawId){
    const normalizedId = normalizeLegacyTankSelection(rawId);
    const tank = normalizedId ? getNormalizedById(normalizedId) : null;

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

  const initialId = (() => {
    const candidate = savedId ?? getTankSnapshot()?.id ?? null;
    const normalized = normalizeLegacyTankSelection(candidate);
    return getNormalizedById(normalized) ? normalized : normalizeLegacyTankSelection('');
  })();

  applySelection(initialId);
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
