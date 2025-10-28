import { TANK_SIZES, getTankById, normalizeLegacyTankSelection } from './utils.js';
import { setTank, normalizeTankPreset, getTankSnapshot } from './stocking/tankStore.js';
import { shouldRestoreVariantFocus } from './stocking.js';

const TANK_SELECT_QUERY = "#tank-size, [data-role='tank-size'], select[name='tank-size'], select[name='tankSize'], #tank-size-select";
const ALLOWED_TANK_IDS = new Set(TANK_SIZES.map((tank) => tank.id));

function findTankSelect() {
  return document.querySelector(TANK_SELECT_QUERY);
}

function renderTankSizeOptions(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  TANK_SIZES.forEach(({ id, label }) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    selectEl.appendChild(opt);
  });
  enforceTankWhitelist(selectEl);
}

function enforceTankWhitelist(selectEl) {
  if (!selectEl) return;
  [...selectEl.options].forEach((option) => {
    if (!ALLOWED_TANK_IDS.has(option.value)) {
      option.remove();
    }
  });
}

function installTankMutationGuard(selectEl) {
  if (!selectEl) return;
  if (selectEl.dataset.tankWhitelistGuard === '1') {
    enforceTankWhitelist(selectEl);
    return;
  }

  const prune = () => enforceTankWhitelist(selectEl);
  const observer = new MutationObserver(prune);
  observer.observe(selectEl, { childList: true });
  prune();
  selectEl.dataset.tankWhitelistGuard = '1';
  selectEl.__tankWhitelistObserver = observer;
}

const immediateSelect = findTankSelect();
if (!immediateSelect) {
  console.error('Tank size <select> not found on Stocking Advisor page.');
} else {
  renderTankSizeOptions(immediateSelect);
  installTankMutationGuard(immediateSelect);
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
  const selectEl = findTankSelect();

  if (!selectEl) return;
  const specEl = document.querySelector('[data-role="tank-spec"]');

  if (!specEl) return;

  const state = (window.appState = window.appState || {});
  const presetCache = new Map();
  const STORAGE_KEY = 'ttg.selectedTank';
  const round1 = (n) => Math.round(n * 10) / 10;

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
  function updateTankSpecLine(selectedTank){
    specEl.setAttribute('role', 'note');
    if (!selectedTank){
      specEl.textContent = '';
      return;
    }

    const gallons = Number.isFinite(selectedTank.gallons) ? `${selectedTank.gallons}g` : '';
    const liters = Number.isFinite(selectedTank.liters) ? `${round1(selectedTank.liters)} L` : '';
    const dimsIn = selectedTank.dimensionsIn ?? {
      l: selectedTank.lengthIn,
      w: selectedTank.widthIn,
      h: selectedTank.heightIn,
    };
    const dimsCm = selectedTank.dimensionsCm ?? null;
    const inches = dimsIn
      ? `${formatDim(dimsIn.l)} × ${formatDim(dimsIn.w)} × ${formatDim(dimsIn.h)} in`
      : '';
    const centimeters = dimsCm
      ? `(${formatDim(dimsCm.l)} × ${formatDim(dimsCm.w)} × ${formatDim(dimsCm.h)} cm)`
      : '';
    const weight = Number.isFinite(selectedTank.filledWeightLbs) && selectedTank.filledWeightLbs > 0
      ? ` • ~${Math.round(selectedTank.filledWeightLbs)} lbs filled`
      : '';

    const segments = [gallons, liters, inches, centimeters].filter(Boolean);
    specEl.textContent = `${segments.join(' • ')}${weight}`.trim();
  }

  (function preventVariantUI(){
    const forbiddenSelectors = [
      "[data-role='tank-variant-chooser']",
      '.tank-variant-chooser',
      '.size-detail',
      '.variant-drawer',
      '.popover',
      '.bottom-sheet',
    ];

    const shouldRemove = (node) => {
      if (!node) return false;
      const role = typeof node.getAttribute === 'function' ? node.getAttribute('data-role') : null;
      const id = typeof node.id === 'string' ? node.id : '';
      const classList = node.classList || { contains: () => false };
      if (role === 'tank-variant-chooser') return true;
      if (classList.contains('tank-variant-chooser') || classList.contains('variant-drawer') || classList.contains('size-detail') || classList.contains('bottom-sheet')) {
        return true;
      }
      const withinTankCard = typeof node.closest === 'function' ? Boolean(node.closest('#tank-size-card')) : false;
      if (withinTankCard) return true;
      const text = typeof node.textContent === 'string' ? node.textContent : '';
      if (/tank\s*variant/i.test(text) || /\b20\s+gallon\b/i.test(text)) {
        return true;
      }
      if (classList.contains('popover')) {
        if (withinTankCard) return true;
        if (/tank/i.test(role || '') || /tank/i.test(id)) return true;
        return false;
      }
      return false;
    };

    const removeAll = () => {
      const selector = forbiddenSelectors.join(',');
      document.querySelectorAll(selector).forEach((node) => {
        if (shouldRemove(node)) {
          node.remove();
        }
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', removeAll, { once: true });
    }
    removeAll();

    const observer = new MutationObserver(() => removeAll());
    observer.observe(document.body, { childList: true, subtree: true });
  })();

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

    const restoreFocusSafely = () => {
      try {
        shouldRestoreVariantFocus?.();
      } catch (error) {
        const message = typeof error?.message === 'string' ? error.message : String(error);
        console.warn('[tank-size]', 'Focus restore skipped:', message);
      }
    };

    if (!tank){
      selectEl.value = '';
      const snapshot = setTank(null);
      restoreFocusSafely();
      syncStateFromSnapshot(snapshot);
      updateTankSpecLine(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_){ }
      recompute();
      return;
    }

    const snapshot = setTank(tank);
    restoreFocusSafely();
    selectEl.value = tank.id;
    syncStateFromSnapshot(snapshot);
    state.variantId = null;
    updateTankSpecLine(snapshot);
    try { localStorage.setItem(STORAGE_KEY, tank.id); } catch(_){}
    recompute();
  }

  // 5) Events
  selectEl.addEventListener('change', (e)=>applySelection(e.target.value));

  // 6) Init
  renderOptions();
  installTankMutationGuard(selectEl);

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
  const planted = document.getElementById('stocking-planted');
  if (!page || !planted) return;

  const apply = () => {
    page.classList.toggle('is-planted', !!planted.checked);
  };

  apply();

  planted.addEventListener('change', apply, { passive: true });
})();
