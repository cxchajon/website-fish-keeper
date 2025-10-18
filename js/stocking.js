import {
  createDefaultState,
  buildComputedState,
  runSanitySuite,
  runStressSuite,
  SPECIES,
  getDefaultSpeciesId,
  calcTotalGph,
  computeTurnover,
  sanitizeFilterList,
  computeFilterFlowStats,
  normalizeFilterTypeSelection,
} from './logic/compute.js';
import { renderEnvCard } from './logic/envRecommend.js';
import { getTankVariants } from './logic/sizeMap.js';
import { debounce, getQueryFlag, roundCapacity, nowTimestamp, byCommonName } from './logic/utils.js';
import { renderConditions, renderChips, bindPopoverHandlers } from './logic/ui.js';
import { getTankSnapshot, EMPTY_TANK, loadFilterSnapshot, saveFilterSnapshot } from './stocking/tankStore.js';
import { EVENTS, dispatchEvent as dispatchStockingEvent } from './stocking/events.js';
import { tankLengthStatus } from './stocking/validators.js';
import { initInfoTooltips } from './ui/tooltip.js';
import { renderFiltrationTrigger, renderFiltrationDrawer, bindFiltrationEvents } from './ui/filter-drawer.js';
import {
  parseTankGallons,
  isValidTankGallons,
  parseIntSafe,
  getQS,
  sortFiltersForTank,
  sortEligibleProducts,
  isEligibleForTank,
  canonicalizeFilterType,
} from './utils.js';

function isAssumptionText(el){
  const t = (el?.textContent || '').trim();
  return /^Tank:\s*\d+(\.\d+)?\s*gal\s*—\s*assumed:/i.test(t);
}

function scrubAssumptionOnce(scope){
  const root = scope || document;
  const card = root.querySelector('#stocking-page .ttg-card.tank-size, #stocking-page [data-card="tank-size"]');
  if (!card) return;
  card.querySelectorAll('p,div,.tank-assumption,#tank-assumption,[data-role="tank-assumption"],[data-test="tank-assumption"]').forEach((node) => {
    if (isAssumptionText(node)) {
      node.remove();
    }
  });
  Array.from(card.children).forEach((child) => {
    if (!child.textContent || !child.textContent.trim()) {
      child.remove();
    }
  });
}

scrubAssumptionOnce();

const GEAR_PAGE_PATH = '/gear.html';
const GEAR_QUERY_PARAM = 'tank_g';
const GEAR_TANK_SESSION_KEY = 'ttg:tank_g';
const GEAR_FILTER_SESSION_KEY = 'ttg:filter_id';
const FILTER_CATALOG_PATH = '/data/filters.json';

const DEBUG_PRODUCT_TANKS = Object.freeze([5, 10, 15, 20, 29, 40, 50, 55, 75]);
const debugDropdownSnapshots = new Map();
let debugDownloadLink = null;
let debugDownloadUrl = null;

let filterCatalog = [];
const filterCatalogById = new Map();
let filterCatalogPromise = null;
let filterCatalogLoaded = false;
let filterCatalogLoading = false;
let filterCatalogLoadError = false;
let filterCatalogErrorLogged = false;
let pendingFilterId = null;
let filterProductStatusMessage = '';

function debugProductsEnabled() {
  return typeof window !== 'undefined' && window.DEBUG_PRODUCTS === true;
}
(function initStockingFlags(){
  window.TTG = window.TTG || {};
  const ua = navigator.userAgent || '';
  const isChromeDesktop =
    /Chrome\/\d+/.test(ua) && !/Mobile|iPhone|Android|iPad|iPod/i.test(ua) && !/Edg\//.test(ua);
  TTG.SAFE_MODE = { isChromeDesktop, disableObservers: isChromeDesktop, disableHeavySweeps: isChromeDesktop };
  TTG.LOG_SAFE = (...a)=> console.warn('[TTG:SAFE]', ...a);
})();

/** Utility to create a mutation observer that auto-noops in SAFE_MODE */
function createSafeObserver(target, config, callback){
  const flags = window.TTG?.SAFE_MODE || {};
  if (flags.disableObservers){
    window.TTG?.LOG_SAFE?.('Observers disabled (Chrome desktop). Skipping observer on:', target?.id || target);
    return { observe(){}, disconnect(){}, _noop:true };
  }
  const obs = new MutationObserver(callback);
  if (target) obs.observe(target, config);
  return obs;
}

/** Wrap re-entrant handlers */
function guarded(handler){
  let busy = false;
  return function guardedHandler(...args){
    if (busy) return;
    busy = true;
    try {
      return handler.apply(this, args);
    } finally {
      setTimeout(()=>{ busy = false; }, 0);
    }
  };
}

function createLengthValidator(container) {
  if (!container) {
    return {
      evaluate() {},
      sync() {},
    };
  }
  let chip = null;
  let visible = false;
  let text = '';

  const ensureChip = () => {
    if (chip) return chip;
    chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.tone = 'bad';
    chip.dataset.role = 'stock-warning-length';
    chip.dataset.field = 'length-warning';
    chip.setAttribute('data-testid', 'tank-length-warning');
    return chip;
  };

  const attach = () => {
    if (!visible) return;
    const node = ensureChip();
    node.textContent = text;
    if (!node.isConnected) {
      container.prepend(node);
    }
  };

  const detach = () => {
    if (chip && chip.isConnected) {
      chip.remove();
    }
  };

  return {
    evaluate({ tank, species }) {
      const result = tankLengthStatus({ tank, species });
      if (!result.show) {
        visible = false;
        text = '';
        detach();
        return;
      }
      visible = true;
      text = result.message;
      attach();
    },
    sync() {
      if (visible) {
        attach();
      } else {
        detach();
      }
    },
  };
}

window.addEventListener('keydown', (e) => {
  const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
  const isMac = platform.toUpperCase().includes('MAC');
  if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    const u = new URL(location.href);
    u.searchParams.set('v', Date.now().toString(36));
    location.replace(u.toString());
  }
});

function bootstrapStocking() {
  let state = window.appState;
  if (!state || typeof state !== 'object') {
    state = createDefaultState();
  } else {
    const defaults = createDefaultState();
    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in state)) {
        state[key] = value;
        continue;
      }
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          if (!Array.isArray(state[key])) {
            state[key] = value.slice();
          }
        } else {
          state[key] = { ...value, ...state[key] };
        }
      }
    }
  }
  window.appState = state;
  state.filterType = state.filterType ? normalizeFilterTypeSelection(state.filterType) : null;
  state.filterId = typeof state.filterId === 'string' && state.filterId.trim() ? state.filterId.trim() : null;
  state.ratedGph = null;
  const qs = getQS();
  const qsFilterId = qs.get('filter_id');
  if (qsFilterId) {
    pendingFilterId = qsFilterId;
  } else if (state.filterId) {
    pendingFilterId = state.filterId;
  }
  const initialTank = getTankSnapshot() ?? EMPTY_TANK;
  state.tank = initialTank;
  state.gallons = initialTank.gallons ?? 0;
  state.liters = initialTank.liters ?? 0;
  state.selectedTankId = initialTank.id ?? null;
  let computed = null;
  const debugMode = getQueryFlag('debug');
  let assumptionScrubInitialized = false;
  let lastScrubbedGallons = null;

  const refs = {
    pageTitle: document.getElementById('page-title'),
    plantIcon: document.getElementById('plant-icon'),
    planted: document.getElementById('stocking-planted'),
    filterSetup: document.querySelector('[data-role="filter-setup"]'),
    filterProductSelect: document.getElementById('filter-product'),
    filterRatedInput: document.getElementById('filter-rated-gph'),
    filterTurnover: document.getElementById('filter-turnover'),
    filterProductLabel: document.getElementById('filter-product-label'),
    filterFlowNote: document.getElementById('filter-rated-note'),
    filterProductNote: document.getElementById('filter-product-note'),
    filtrationTrigger: document.getElementById('filtration-trigger'),
    envCard: document.querySelector('#env-card, [data-role="env-card"]'),
    envInfoToggle: document.querySelector('#env-info-btn, #env-info-toggle, [data-role="env-info"]'),
    conditions: document.getElementById('conditions-list'),
    candidateChips: document.getElementById('candidate-chips'),
    candidateBanner: document.getElementById('candidate-banner'),
    speciesSelect: document.getElementById('plan-species'),
    speciesSearch: document.querySelector('#species-search, input[type="search"][name="species"]'),
    qty: document.getElementById('plan-qty'),
    addBtn: document.getElementById('plan-add'),
    stockList: document.getElementById('stock-list'),
    seeGear: document.getElementById('btn-gear'),
    envReco: document.getElementById('env-reco'),
    envTips: document.querySelector('#env-legend, #env-more-tips, [data-role="env-legend"]'),
  };

  const normalizeGearGallons = (value) => {
    const parsed = parseTankGallons(value);
    if (parsed === null) {
      return null;
    }
    return isValidTankGallons(parsed) ? parsed : null;
  };

  const persistGearTankGallons = (value) => {
    try {
      if (value === null || value === undefined) {
        sessionStorage.removeItem(GEAR_TANK_SESSION_KEY);
      } else {
        sessionStorage.setItem(GEAR_TANK_SESSION_KEY, String(value));
      }
    } catch (_error) {
      /* ignore storage errors */
    }
  };

  const persistGearFilterData = ({ filterId }) => {
    try {
      if (filterId) {
        sessionStorage.setItem(GEAR_FILTER_SESSION_KEY, filterId);
      } else {
        sessionStorage.removeItem(GEAR_FILTER_SESSION_KEY);
      }
    } catch (_error) {
      /* ignore storage errors */
    }
  };

  const buildGearHref = (gallons, filterId) => {
    const params = new URLSearchParams();
    const normalizedGallons = normalizeGearGallons(gallons);
    if (normalizedGallons !== null) {
      params.set(GEAR_QUERY_PARAM, String(normalizedGallons));
    }
    if (filterId) {
      params.set('filter_id', filterId);
    }
    const query = params.toString();
    return query ? `${GEAR_PAGE_PATH}?${query}` : GEAR_PAGE_PATH;
  };

  const syncGearLink = () => {
    if (!refs.seeGear) {
      return;
    }
    const gallonsCandidate = computed?.tank?.gallons ?? state?.tank?.gallons ?? state?.gallons ?? null;
    const normalizedGallons = normalizeGearGallons(gallonsCandidate);
    const filterId = state.filterId ?? null;
    const href = buildGearHref(normalizedGallons, filterId);
    if (refs.seeGear.getAttribute('href') !== href) {
      refs.seeGear.setAttribute('href', href);
    }
    persistGearTankGallons(normalizedGallons);
    persistGearFilterData({
      filterId: filterId ?? '',
    });
  };

  syncGearLink();

  const supportedSpeciesIds = new Set(SPECIES.map((species) => species.id));
  const speciesById = new Map(SPECIES.map((species) => [species.id, species]));
  const warnedMarineIds = new Set();

  const canonicalSpeciesList = SPECIES.slice();

  const createFilterRecord = () => ({ id: null, type: 'HOB', rated_gph: 0 });

  const filtrationHost = (() => {
    const toggleRow = document.querySelector('#tank-size-card .row.toggle-row');
    if (!toggleRow) return null;
    const host = document.createElement('div');
    host.className = 'filter-drawer-host';
    host.dataset.role = 'filter-drawer-host';
    toggleRow.insertAdjacentElement('afterend', host);
    return host;
  })();

  const filtrationUi = {
    trigger: refs.filtrationTrigger,
    host: filtrationHost,
    open: false,
    getFilters: () => (Array.isArray(state.filters) ? state.filters.map((filter) => ({ ...filter })) : []),
    onToggle: null,
  };

  function setFilters(nextFilters, { persist = true } = {}) {
    const sanitized = sanitizeFilterList(Array.isArray(nextFilters) ? nextFilters : []);
    state.filters = sanitized.map((filter) => ({ ...filter }));
    if (state.filterId) {
      const stillPresent = state.filters.some((filter) => filter?.id === state.filterId);
      if (!stillPresent) {
        state.filterId = null;
        state.filterType = null;
        state.ratedGph = null;
      }
    }
    if (persist) {
      try {
        if (state.filters.length) {
          saveFilterSnapshot(state.filters);
        } else {
          saveFilterSnapshot([]);
        }
      } catch (_error) {
        /* ignore persistence errors */
      }
    }
  }

  const initializeFilters = () => {
    const stored = loadFilterSnapshot();
    const candidate = Array.isArray(state.filters) && state.filters.length
      ? state.filters
      : stored;
    setFilters(candidate, { persist: false });
  };

  initializeFilters();

  const estimateGallonsForFilters = () => {
    if (computed?.tank?.effectiveGallons && Number.isFinite(computed.tank.effectiveGallons)) {
      return computed.tank.effectiveGallons;
    }
    const tankRecord = state.tank ?? EMPTY_TANK;
    if (Number.isFinite(tankRecord.effectiveGallons) && tankRecord.effectiveGallons > 0) {
      return tankRecord.effectiveGallons;
    }
    const gallons = Number(state.gallons ?? tankRecord.gallons);
    return Number.isFinite(gallons) ? gallons : 0;
  };

  function getFilteringSnapshot() {
    if (computed?.filtering) {
      return computed.filtering;
    }
    const sanitized = sanitizeFilterList(state.filters);
    const gphTotal = calcTotalGph(sanitized);
    const gallonsForCalc = estimateGallonsForFilters();
    const turnover = computeTurnover(gallonsForCalc, sanitized);
    const hasData = Number.isFinite(gphTotal) && gphTotal > 0;
    let tone = hasData ? 'neutral' : 'neutral';
    let text = hasData ? 'Turnover meets recommended flow.' : 'Add filter flow to estimate turnover.';
    if (hasData && gallonsForCalc <= 0) {
      tone = 'warn';
      text = 'Select a tank to calculate turnover.';
    }
    return {
      filters: sanitized,
      gphTotal,
      turnover,
      hasData,
      status: { tone, text },
      band: null,
      warning: false,
      chip: null,
      target: null,
    };
  }

  function syncFiltrationUI() {
    if (!filtrationUi.trigger || !filtrationUi.host) {
      return;
    }
    const metrics = getFilteringSnapshot();
    renderFiltrationTrigger(filtrationUi.trigger, {
      metrics,
      open: filtrationUi.open,
      warning: Boolean(metrics?.warning),
    });
    renderFiltrationDrawer(filtrationUi.host, {
      filters: state.filters,
      metrics,
      open: filtrationUi.open,
    });
  }

  syncFiltrationUI();

  function setFilterCatalogData(list = [], { hasError = false } = {}) {
    const normalized = Array.isArray(list) ? list.filter((item) => item && typeof item.id === 'string') : [];
    filterCatalog = normalized;
    filterCatalogById.clear();
    normalized.forEach((product) => {
      filterCatalogById.set(product.id, product);
    });
    filterCatalogLoaded = true;
    filterCatalogLoading = false;
    filterCatalogLoadError = hasError;
  }

  function getFilterProductById(id) {
    if (!id) {
      return null;
    }
    return filterCatalogById.get(id) ?? null;
  }

  function deriveRatedGphFromProduct(product) {
    if (!product) {
      return null;
    }
    const rated = parseIntSafe(product.rated_gph);
    return Number.isFinite(rated) && rated > 0 ? rated : null;
  }

  function getSelectedProductRatedGph() {
    const product = state.filterId ? getFilterProductById(state.filterId) : null;
    return deriveRatedGphFromProduct(product);
  }

  function getSelectedTankGallons() {
    const snapshotGallons = parseTankGallons(getTankSnapshot()?.gallons ?? null);
    if (Number.isFinite(snapshotGallons)) {
      return snapshotGallons;
    }
    const stateGallons = parseTankGallons(state?.tank?.gallons ?? state?.gallons ?? null);
    if (Number.isFinite(stateGallons)) {
      return stateGallons;
    }
    const computedGallons = parseTankGallons(computed?.tank?.gallons ?? null);
    return Number.isFinite(computedGallons) ? computedGallons : null;
  }

  function fetchFilterCatalogData() {
    if (filterCatalogPromise) {
      return filterCatalogPromise;
    }
    filterCatalogLoading = true;
    filterCatalogLoaded = false;
    filterCatalogLoadError = false;
    filterCatalogPromise = fetch(FILTER_CATALOG_PATH, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load filter catalog: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setFilterCatalogData(Array.isArray(data) ? data : []);
        return filterCatalog;
      })
      .catch((error) => {
        if (!filterCatalogErrorLogged) {
          console.error('[Stocking] Filter catalog load failed:', error);
          filterCatalogErrorLogged = true;
        }
        filterCatalog = [];
        filterCatalogById.clear();
        filterCatalogLoaded = true;
        filterCatalogLoading = false;
        filterCatalogLoadError = true;
        return [];
      });
    return filterCatalogPromise;
  }

  function collectDebugOptionIds(select) {
    if (!select) {
      return [];
    }
    return Array.from(select.options || [])
      .map((option) => String(option.value || '').trim())
      .filter((value) => value);
  }

  function ensureDebugDownloadLink() {
    if (debugDownloadLink || typeof document === 'undefined') {
      return;
    }
    const link = document.createElement('a');
    link.rel = 'noopener noreferrer';
    link.target = '_blank';
    link.download = 'audit_filters_dropdown.json';
    link.textContent = '';
    link.style.display = 'none';
    link.dataset.role = 'debug-filters-download';
    link.dataset.filename = '/logs/audit_filters_dropdown.json';
    document.body.appendChild(link);
    debugDownloadLink = link;
  }

  function updateDebugDownloadLink(report, hasDiff) {
    if (!debugProductsEnabled()) {
      return;
    }
    ensureDebugDownloadLink();
    if (!debugDownloadLink) {
      return;
    }
    if (debugDownloadUrl) {
      try {
        URL.revokeObjectURL(debugDownloadUrl);
      } catch (_error) {
        // ignore revoke errors
      }
      debugDownloadUrl = null;
    }
    if (!hasDiff) {
      debugDownloadLink.style.display = 'none';
      debugDownloadLink.removeAttribute('href');
      debugDownloadLink.textContent = '';
      return;
    }
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    debugDownloadUrl = URL.createObjectURL(blob);
    debugDownloadLink.href = debugDownloadUrl;
    debugDownloadLink.style.display = 'none';
    debugDownloadLink.textContent = '';
    const update = () => {
      if (!debugDownloadLink) {
        return;
      }
      debugDownloadLink.style.display = 'block';
      debugDownloadLink.textContent = 'Download filter dropdown audit report';
      debugDownloadLink.title = 'Download filter dropdown audit report';
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(update);
    } else {
      update();
    }
  }

  function runDebugFilterAudit({ select, gallons, status }) {
    if (!debugProductsEnabled()) {
      return;
    }
    const numericGallons = Number(gallons);
    const hasValidGallons = Number.isFinite(numericGallons) && numericGallons > 0;
    const actualIds = collectDebugOptionIds(select);
    const eligibleProducts = hasValidGallons
      ? sortEligibleProducts(filterCatalog, numericGallons)
      : [];
    const eligibleIds = eligibleProducts.map((product) => product.id);
    const missingForCurrent = eligibleIds.filter((id) => !actualIds.includes(id));
    const extraForCurrent = actualIds.filter((id) => !eligibleIds.includes(id));
    try {
      const tankLabel = hasValidGallons ? numericGallons : null;
      let groupOpen = false;
      if (console.groupCollapsed) {
        console.groupCollapsed('[Stocking][DEBUG] Filter dropdown snapshot', {
          tank_g: tankLabel,
          status: status ?? null,
        });
        groupOpen = true;
      } else {
        console.log('[Stocking][DEBUG] Filter dropdown snapshot', {
          tank_g: tankLabel,
          status: status ?? null,
        });
      }
      console.log('eligible_by_catalog', eligibleIds);
      console.log('dropdown_ids', actualIds);
      console.log('diffs', { missing: missingForCurrent, extra: extraForCurrent });
      if (filterCatalogLoadError) {
        console.warn('[Stocking][DEBUG] Catalog failed to load.');
      }
      if (!hasValidGallons) {
        console.warn('[Stocking][DEBUG] Tank gallons unavailable or invalid.');
      }
      if (groupOpen) {
        console.groupEnd();
      }
    } catch (_error) {
      // ignore console errors in unsupported environments
    }
    if (hasValidGallons) {
      debugDropdownSnapshots.set(numericGallons, actualIds);
    }
    const rows = DEBUG_PRODUCT_TANKS.map((tankGallons) => {
      const expectedProducts = sortEligibleProducts(filterCatalog, tankGallons);
      const expectedIds = expectedProducts.map((product) => product.id);
      const hasSample = debugDropdownSnapshots.has(tankGallons);
      const actualSample = hasSample ? debugDropdownSnapshots.get(tankGallons) : null;
      const missing = hasSample ? expectedIds.filter((id) => !actualSample.includes(id)) : null;
      const extra = hasSample ? actualSample.filter((id) => !expectedIds.includes(id)) : null;
      return {
        tank_g: tankGallons,
        expected_ids: expectedIds,
        actual_ids: hasSample ? actualSample : null,
        missing_in_dropdown: missing,
        extra_in_dropdown: extra,
      };
    });
    const sampledTanks = Array.from(debugDropdownSnapshots.keys()).sort((a, b) => a - b);
    const report = {
      generated_at: new Date().toISOString(),
      sampled_tanks: sampledTanks,
      tanks: rows,
    };
    window.TTG = window.TTG || {};
    window.TTG.DEBUG_PRODUCTS = {
      enabled: debugProductsEnabled(),
      report,
    };
    try {
      const tableData = rows.map((entry) => ({
        tank_g: entry.tank_g,
        expected: entry.expected_ids.join(', '),
        actual: Array.isArray(entry.actual_ids) ? entry.actual_ids.join(', ') : '(not sampled)',
        missing: Array.isArray(entry.missing_in_dropdown) && entry.missing_in_dropdown.length
          ? entry.missing_in_dropdown.join(', ')
          : '',
        extra: Array.isArray(entry.extra_in_dropdown) && entry.extra_in_dropdown.length
          ? entry.extra_in_dropdown.join(', ')
          : '',
      }));
      if (console.groupCollapsed) {
        console.groupCollapsed('[Stocking][DEBUG] Filter dropdown audit');
        console.table(tableData);
        console.groupEnd();
      } else {
        console.log('[Stocking][DEBUG] Filter dropdown audit', tableData);
      }
    } catch (_error) {
      // ignore console errors in unsupported environments
    }
    const hasDifferences = rows.some((entry) => {
      const missing = Array.isArray(entry.missing_in_dropdown) ? entry.missing_in_dropdown : [];
      const extra = Array.isArray(entry.extra_in_dropdown) ? entry.extra_in_dropdown : [];
      return missing.length > 0 || extra.length > 0;
    });
    updateDebugDownloadLink(report, hasDifferences);
  }

  function refreshFiltrationUI(options = {}) {
    const opts = typeof options === 'object' && options !== null ? options : {};
    const preserveSelection = Object.prototype.hasOwnProperty.call(opts, 'preserveSelection')
      ? Boolean(opts.preserveSelection)
      : true;

    ensureFilterControl();
    const select = refs.filterProductSelect;
    const gallonsRaw = getSelectedTankGallons();
    const gallons = Number.isFinite(gallonsRaw) ? gallonsRaw : null;
    let debugStatus = 'idle';

    const finalize = () => {
      syncFilterControl();
      syncFiltrationUI();
      runDebugFilterAudit({ select, gallons, status: debugStatus });
    };

    const clearSelectionState = () => {
      const previousId = state.filterId ?? null;
      if (previousId) {
        const existing = Array.isArray(state.filters) ? state.filters.slice() : [];
        const nextFilters = existing.filter((filter) => filter?.id !== previousId);
        setFilters(nextFilters);
      }
      pendingFilterId = null;
      state.filterId = null;
      state.filterType = null;
      state.ratedGph = null;
    };

    const applyDisabledState = (text, { status: statusKey = 'disabled', clearSelection = false } = {}) => {
      if (select) {
        if (document.activeElement === select && typeof select.blur === 'function') {
          select.blur();
        }
        select.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = text;
        select.appendChild(option);
        select.value = '';
        select.disabled = true;
        select.setAttribute('aria-disabled', 'true');
      }
      filterProductStatusMessage = text;
      debugStatus = statusKey;
      if (clearSelection) {
        clearSelectionState();
      }
    };

    if (!select) {
      applyDisabledState('Loading filter catalog…', { status: 'no-select', clearSelection: false });
      finalize();
      return;
    }

    if (filterCatalogLoadError) {
      applyDisabledState('Catalog failed to load.', { status: 'catalog-error', clearSelection: false });
      finalize();
      return;
    }

    if (!filterCatalogLoaded) {
      applyDisabledState('Loading filter catalog…', { status: 'loading', clearSelection: false });
      finalize();
      return;
    }

    if (!Number.isFinite(gallons) || gallons <= 0) {
      applyDisabledState('Select a tank size to view matching products.', { status: 'no-tank', clearSelection: true });
      finalize();
      return;
    }

    const products = sortFiltersForTank(filterCatalog, gallons);
    const availableIds = new Set(products.map((item) => item.id));

    if (pendingFilterId && availableIds.has(pendingFilterId)) {
      const candidateProduct = getFilterProductById(pendingFilterId);
      if (candidateProduct) {
        const normalizedType = normalizeFilterTypeSelection(String(candidateProduct.type || ''));
        const ratedValue = deriveRatedGphFromProduct(candidateProduct);
        state.filterId = candidateProduct.id;
        state.filterType = normalizedType;
        state.ratedGph = ratedValue;
        const rated = Number.isFinite(ratedValue) && ratedValue > 0 ? ratedValue : 0;
        setFilters([
          {
            id: candidateProduct.id,
            type: canonicalizeFilterType(candidateProduct.type),
            rated_gph: rated,
          },
        ]);
      }
      pendingFilterId = null;
    }

    let previousSelectionRemoved = false;
    if (state.filterId && !availableIds.has(state.filterId)) {
      previousSelectionRemoved = true;
      clearSelectionState();
    }

    if (!products.length) {
      applyDisabledState('No matching products for this tank size.', { status: 'no-matches', clearSelection: true });
      finalize();
      return;
    }

    const preservedValue = preserveSelection && state.filterId && availableIds.has(state.filterId)
      ? state.filterId
      : '';

    if (document.activeElement === select && typeof select.blur === 'function') {
      select.blur();
    }
    select.innerHTML = '';
    select.disabled = false;
    select.removeAttribute('aria-disabled');

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Select a product —';
    select.appendChild(placeholder);

    products.forEach((product) => {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = `${product.brand} ${product.name}`;
      select.appendChild(option);
    });

    const nextValue = preservedValue && availableIds.has(preservedValue) ? preservedValue : '';
    select.value = nextValue;

    if (nextValue) {
      const selectedProduct = getFilterProductById(nextValue);
      if (selectedProduct) {
        state.filterId = selectedProduct.id;
        state.filterType = normalizeFilterTypeSelection(String(selectedProduct.type || ''));
        state.ratedGph = deriveRatedGphFromProduct(selectedProduct);
      } else {
        previousSelectionRemoved = true;
        clearSelectionState();
      }
    } else {
      if (state.filterId) {
        previousSelectionRemoved = true;
      }
      clearSelectionState();
    }

    if (previousSelectionRemoved) {
      filterProductStatusMessage = "Previous product doesn't fit this tank size.";
      debugStatus = 'previous-removed';
    } else {
      filterProductStatusMessage = '';
      debugStatus = 'populated';
    }

    finalize();
  }

  function computeTurnoverEstimate() {
    const computedTurnover = computed?.filtering?.turnover ?? computed?.bioload?.flowAdjustment?.turnover;
    if (Number.isFinite(computedTurnover) && computedTurnover > 0) {
      return computedTurnover;
    }
    const gallons = getSelectedTankGallons();
    if (!Number.isFinite(gallons) || gallons <= 0) {
      return null;
    }
    const turnover = computeTurnover(gallons, state.filters);
    if (Number.isFinite(turnover) && turnover > 0) {
      return turnover;
    }
    return null;
  }

  function handleFilterProductChange(event) {
    const value = event?.target?.value ?? '';
    const product = value ? getFilterProductById(value) : null;
    filterProductStatusMessage = '';
    if (product) {
      const normalizedType = normalizeFilterTypeSelection(String(product.type || ''));
      const ratedValue = deriveRatedGphFromProduct(product);
      state.filterId = product.id;
      pendingFilterId = product.id;
      state.filterType = normalizedType;
      state.ratedGph = ratedValue;
      const rated = Number.isFinite(ratedValue) && ratedValue > 0 ? ratedValue : 0;
      setFilters([
        {
          id: product.id,
          type: canonicalizeFilterType(product.type),
          rated_gph: rated,
        },
      ]);
    } else {
      const previousId = state.filterId ?? null;
      state.filterId = null;
      pendingFilterId = null;
      state.filterType = null;
      state.ratedGph = null;
      if (previousId) {
        const remaining = Array.isArray(state.filters)
          ? state.filters.filter((filter) => filter?.id !== previousId)
          : [];
        setFilters(remaining);
      }
    }
    refreshFiltrationUI({ preserveSelection: true, reason: 'product-change' });
    syncGearLink();
    scheduleUpdate();
  }
  function ensureFilterControl() {
    if (!refs.filterSetup) {
      refs.filterSetup = document.querySelector('[data-role="filter-setup"]');
    }
    if (refs.filterSetup) {
      refs.filterProductSelect = refs.filterSetup.querySelector('#filter-product');
      refs.filterRatedInput = refs.filterSetup.querySelector('#filter-rated-gph');
      refs.filterTurnover = refs.filterSetup.querySelector('#filter-turnover');
      refs.filterProductLabel = refs.filterSetup.querySelector('#filter-product-label');
      refs.filterFlowNote = refs.filterSetup.querySelector('#filter-rated-note');
      refs.filterProductNote = refs.filterSetup.querySelector('#filter-product-note');
    }
    if (refs.filterProductSelect && !refs.filterProductSelect.__ttgBound) {
      refs.filterProductSelect.addEventListener('change', handleFilterProductChange);
      refs.filterProductSelect.__ttgBound = true;
    }
  }

  function syncFilterControl() {
    ensureFilterControl();
    const product = state.filterId ? getFilterProductById(state.filterId) : null;
    const derivedRated = deriveRatedGphFromProduct(product);
    if (product) {
      state.filterType = normalizeFilterTypeSelection(String(product.type || ''));
      state.ratedGph = derivedRated;
    } else {
      state.filterType = null;
      state.ratedGph = null;
    }
    const rated = Number(state.ratedGph);

    if (refs.filterProductSelect) {
      const desired = state.filterId ?? '';
      if (refs.filterProductSelect.value !== desired) {
        refs.filterProductSelect.value = desired;
      }
    }

    if (refs.filterRatedInput && document.activeElement !== refs.filterRatedInput) {
      if (Number.isFinite(rated) && rated > 0) {
        refs.filterRatedInput.value = String(rated);
        refs.filterRatedInput.setAttribute('aria-readonly', 'true');
        refs.filterRatedInput.placeholder = '';
      } else {
        refs.filterRatedInput.value = '';
        refs.filterRatedInput.setAttribute('aria-readonly', 'true');
        refs.filterRatedInput.placeholder = 'Select a product to auto-fill';
      }
    }
    if (refs.filterProductLabel) {
      if (product) {
        refs.filterProductLabel.textContent = `Product: ${product.brand} ${product.name}`;
        refs.filterProductLabel.hidden = false;
      } else {
        refs.filterProductLabel.textContent = '';
        refs.filterProductLabel.hidden = true;
      }
    }

    if (refs.filterProductNote) {
      if (filterProductStatusMessage) {
        refs.filterProductNote.textContent = filterProductStatusMessage;
      } else if (filterCatalogLoadError) {
        refs.filterProductNote.textContent = 'Catalog failed to load.';
      } else if (!filterCatalogLoaded) {
        refs.filterProductNote.textContent = 'Loading filter catalog…';
      } else if (!Number.isFinite(getSelectedTankGallons())) {
        refs.filterProductNote.textContent = 'Select a tank size to view matching products.';
      } else {
        refs.filterProductNote.textContent = 'Choose a filter matched to your tank size to auto-fill GPH.';
      }
    }

    const turnover = computeTurnoverEstimate();
    if (refs.filterTurnover) {
      refs.filterTurnover.textContent = Number.isFinite(turnover)
        ? `Estimated turnover: ${turnover.toFixed(1)}×/h`
        : 'Estimated turnover: —';
    }
  }

  ensureFilterControl();
  refreshFiltrationUI({ preserveSelection: true });

  function initializeFilterCatalog() {
    fetchFilterCatalogData()
      .catch(() => [])
      .finally(() => {
        refreshFiltrationUI({ preserveSelection: true });
        syncGearLink();
        if (typeof scheduleUpdate === 'function') {
          scheduleUpdate();
        }
      });
  }

  function handleFiltersChange(nextFilters) {
    setFilters(nextFilters);
    refreshFiltrationUI({ preserveSelection: true, reason: 'filters-change' });
    syncGearLink();
    scheduleUpdate();
  }

  const SALINITY_ALIASES = new Map([
    ['fw', 'fresh'],
    ['freshwater', 'fresh'],
    ['fresh', 'fresh'],
    ['br', 'brackish-low'],
    ['brackish', 'brackish-low'],
    ['brackish_low', 'brackish-low'],
    ['brackish-low', 'brackish-low'],
    ['brackish-high', 'brackish-high'],
    ['dual', 'dual'],
    ['sw', 'marine'],
    ['saltwater', 'marine'],
    ['marine', 'marine'],
  ]);

  const SALINITY_GROUPS = {
    fresh: new Set(['fresh', 'dual']),
    'brackish-low': new Set(['brackish-low', 'dual']),
    'brackish-high': new Set(['brackish-high', 'dual']),
    dual: new Set(['fresh', 'brackish-low', 'brackish-high', 'dual']),
    marine: new Set(['marine']),
  };

  let speciesSearchTerm = '';
  let manualSalinityFilter = null;

  function sanitizeSearchTerm(value) {
    if (typeof value !== 'string') return '';
    let normalized = value;
    if (typeof normalized.normalize === 'function') {
      try {
        normalized = normalized.normalize('NFKD');
      } catch (error) {
        // ignore normalization errors in unsupported environments
      }
    }
    return normalized.replace(/\s+/g, ' ').trim();
  }

  function normalizeSalinityPreference(value) {
    if (typeof value !== 'string') return null;
    const key = value.trim().toLowerCase();
    if (!key) return null;
    if (SALINITY_ALIASES.has(key)) {
      return SALINITY_ALIASES.get(key);
    }
    if (Object.prototype.hasOwnProperty.call(SALINITY_GROUPS, key)) {
      return key;
    }
    return null;
  }

  function resolveActiveSalinityFilter() {
    if (manualSalinityFilter && Object.prototype.hasOwnProperty.call(SALINITY_GROUPS, manualSalinityFilter)) {
      return manualSalinityFilter;
    }
    const fromState = normalizeSalinityPreference(state?.water?.salinity);
    if (fromState && Object.prototype.hasOwnProperty.call(SALINITY_GROUPS, fromState)) {
      return fromState;
    }
    return 'fresh';
  }

  function isSpeciesFeatureBlocked(species) {
    if (!species) return false;
    if (species.hide_from_stocking === true || species.hidden_from_stocking === true || species.stockingHidden === true) {
      return true;
    }
    if (species.hidden === true || species.hide_from_planner === true) {
      return true;
    }
    const featureFlags = Array.isArray(species.featureFlags) ? species.featureFlags : [];
    if (!featureFlags.length) {
      return false;
    }
    const featureConfig = window?.TTG?.features ?? window?.TTG?.featureFlags ?? null;
    if (!featureConfig) {
      return false;
    }
    return featureFlags.some((flag) => flag && featureConfig[flag] === false);
  }

  function matchesSearchTerm(species, term) {
    if (!term) return true;
    const needle = term.toLowerCase();
    const fields = [
      species.common_name,
      species.scientific_name,
      species.id,
    ];
    if (Array.isArray(species.aliases)) {
      fields.push(...species.aliases);
    }
    if (Array.isArray(species.tags)) {
      fields.push(species.tags.join(' '));
    }
    return fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(needle));
  }

  function isSalinityAllowed(speciesSalinity, filter) {
    const normalized = normalizeSalinityPreference(speciesSalinity) ?? 'fresh';
    const active = Object.prototype.hasOwnProperty.call(SALINITY_GROUPS, filter) ? filter : 'fresh';
    const allowed = SALINITY_GROUPS[active] ?? SALINITY_GROUPS.fresh;
    return allowed.has(normalized);
  }

  function shouldIncludeSpecies(species, { searchTerm, salinity } = {}) {
    if (!species) return false;
    if (isSpeciesFeatureBlocked(species)) {
      return false;
    }
    const effectiveSalinity = salinity ?? resolveActiveSalinityFilter();
    if (!isSalinityAllowed(species.salinity, effectiveSalinity)) {
      return false;
    }
    if (searchTerm && !matchesSearchTerm(species, searchTerm)) {
      return false;
    }
    return true;
  }

  function buildSpeciesOptionsList() {
    const filters = {
      salinity: resolveActiveSalinityFilter(),
      searchTerm: speciesSearchTerm,
    };
    return canonicalSpeciesList
      .filter((species) => shouldIncludeSpecies(species, filters))
      .sort(byCommonName);
  }

  function resetSpeciesFilters({ salinity } = {}) {
    speciesSearchTerm = '';
    if (refs.speciesSearch) {
      refs.speciesSearch.value = '';
    }
    if (salinity !== undefined) {
      manualSalinityFilter = normalizeSalinityPreference(salinity);
    } else {
      manualSalinityFilter = null;
    }
  }

  const lengthValidator = createLengthValidator(refs.candidateChips);
  let selectedSpeciesId = state.candidate?.id ?? null;
  let lastStockSignature = '';
  let isBootstrapped = false;

  if (!state.candidate || typeof state.candidate !== 'object') {
    state.candidate = { id: getDefaultSpeciesId(), qty: '1' };
  } else {
    if (!state.candidate.id) {
      state.candidate.id = getDefaultSpeciesId();
    }
    if (state.candidate.qty === null || state.candidate.qty === undefined) {
      state.candidate.qty = '1';
    } else if (typeof state.candidate.qty !== 'string') {
      state.candidate.qty = String(state.candidate.qty);
    }
  }

  function toDigits(value) {
    return String(value ?? '').replace(/\D+/g, '');
  }

  function normalizeCandidateQtyValue(value) {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return '1';
    }
    return String(Math.min(999, parsed));
  }

  function syncQtyInputFromState({ force = false } = {}) {
    if (!refs.qty) return;
    if (!force && document.activeElement === refs.qty) {
      return;
    }
    const value = typeof state.candidate?.qty === 'string'
      ? state.candidate.qty
      : String(state.candidate?.qty ?? '');
    refs.qty.value = value;
  }

  function commitCandidateQty() {
    const normalized = normalizeCandidateQtyValue(state.candidate?.qty ?? '');
    state.candidate.qty = normalized;
    if (refs.qty) {
      refs.qty.value = normalized;
    }
    return normalized;
  }

  const updateLengthValidator = () => {
    const tank = state.tank ?? EMPTY_TANK;
    const species = selectedSpeciesId ? speciesById.get(selectedSpeciesId) ?? null : null;
    lengthValidator.evaluate({ tank, species });
  };

  const emitSpeciesChange = (id) => {
    const normalized = typeof id === 'string' ? id : id ? String(id) : null;
    dispatchStockingEvent(EVENTS.SPECIES_CHANGED, { speciesId: normalized });
  };

  const computeStockSignature = (entries) => {
    if (!entries.length) return 'empty';
    return entries
      .map((entry) => `${entry.id}:${sanitizeQty(entry.qty, 0)}`)
      .sort()
      .join('|');
  };

  const emitStockChange = () => {
    const entries = Array.isArray(state.stock) ? state.stock.slice() : [];
    const signature = computeStockSignature(entries);
    if (signature === lastStockSignature) {
      return;
    }
    lastStockSignature = signature;
    const normalized = entries.map((entry) => ({
      id: entry.id,
      qty: sanitizeQty(entry.qty, 0),
    }));
    const totalQty = normalized.reduce((sum, entry) => sum + entry.qty, 0);
    dispatchStockingEvent(EVENTS.STOCK_CHANGED, {
      stock: normalized,
      totals: { items: normalized.length, quantity: totalQty },
    });
  };

  const requestEventRecompute = guarded(() => runRecompute({ skipInputSync: true }));

  window.addEventListener(EVENTS.TANK_CHANGED, (event) => {
    const snapshot = event.detail?.tank ?? EMPTY_TANK;
    state.tank = snapshot;
    state.gallons = snapshot.gallons ?? 0;
    state.liters = snapshot.liters ?? 0;
    state.selectedTankId = snapshot.id ?? null;
    state.variantId = null;
    shouldRestoreVariantFocus = false;
    refreshFiltrationUI({ preserveSelection: true, reason: 'tank-change' });
    syncGearLink();
    resetSpeciesFilters();
    populateSpecies();
    updateLengthValidator();
    if (isBootstrapped) {
      requestEventRecompute();
    }
  });

  window.addEventListener(EVENTS.SPECIES_CHANGED, (event) => {
    const nextId = event.detail?.speciesId ?? null;
    selectedSpeciesId = typeof nextId === 'string' && nextId ? nextId : null;
    updateLengthValidator();
  });

  window.addEventListener(EVENTS.STOCK_CHANGED, () => {
    if (isBootstrapped) {
      requestEventRecompute();
    }
  });

  updateLengthValidator();

  function ensureTankAssumptionScrubbed(){
    const gallons = computed?.tank?.gallons ?? state?.tank?.gallons ?? null;
    if (!assumptionScrubInitialized){
      scrubAssumptionOnce();
      assumptionScrubInitialized = true;
      lastScrubbedGallons = gallons;
      return;
    }
    if (gallons !== lastScrubbedGallons){
      scrubAssumptionOnce();
      lastScrubbedGallons = gallons;
    }
  }

// ---- Add-to-Stock button wiring ----
const elAdd = document.querySelector('#plan-add, .plan-add');
const elSpec = document.querySelector('#plan-species, .plan-species');
const elQty = document.querySelector('#plan-qty, .plan-qty');

function getQty() {
  if (!elQty) return 1;
  const rawDigits = (elQty.value || '').replace(/\D+/g, '');
  if (rawDigits !== elQty.value) {
    elQty.value = rawDigits;
  }
  const numeric = Math.floor(Number(rawDigits));
  const clamped = Number.isFinite(numeric) && numeric > 0 ? Math.min(numeric, 999) : 1;
  const normalized = String(clamped);
  if (elQty.value !== normalized) {
    elQty.value = normalized;
    elQty.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return clamped;
}

function findSpeciesById(id) {
  try {
    if (!id) return null;
    return speciesById.get(id) ?? null;
  } catch (error) {
    console.warn('[StockingAdvisor] SPECIES not available');
    return null;
  }
}

function addCurrentSelection() {
  const id = (elSpec?.value || '').trim();
  if (!id) {
    console.warn('[StockingAdvisor] No species selected');
    return;
  }
  const species = findSpeciesById(id);
  if (!species) {
    console.warn('[StockingAdvisor] Unknown species id:', id);
    return;
  }
  const qty = getQty();
  document.dispatchEvent(
    new CustomEvent('advisor:addCandidate', { detail: { species, qty } })
  );
  try {
    if (elSpec) {
      elSpec.selectedIndex = 0;
    }
  } catch (error) {
    // ignore reset failure
  }
  try {
    if (elQty) {
      elQty.value = '1';
    }
  } catch (error) {
    // ignore reset failure
  }
}

elAdd?.addEventListener('click', (event) => {
  event.preventDefault();
  addCurrentSelection();
});

elQty?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    elQty.blur();
    addCurrentSelection();
  }
});

/* ==== Current Stock state + renderer with +/- controls ==== */
const STOCK = new Map(); // id -> { species, qty }

function currentStockArray() {
  return Array.from(STOCK.values()).map(({ species, qty }) => ({ species, qty }));
}

document.addEventListener('advisor:addCandidate', (e) => {
  const s = e.detail?.species; const addQty = Math.max(1, e.detail?.qty || 1);
  if (!s || !s.id) return;
  const cur = STOCK.get(s.id)?.qty || 0;
  const next = Math.min(999, cur + addQty);
  STOCK.set(s.id, { species: s, qty: next });
  renderStockList();
});

document.addEventListener('advisor:removeCandidate', (e) => {
  const id = e.detail?.id;
  if (!id) return;
  STOCK.delete(id);
  renderStockList();
});

document.addEventListener('DOMContentLoaded', renderStockList);

function renderStockList() {
  const root = document.querySelector('#stock-list');
  if (!root) return;

  if (STOCK.size === 0) {
    root.innerHTML = `<div class="stock-empty subtle">No stock yet. Add species to begin.</div>`;
    return;
  }

  const rows = [];
  for (const { species, qty } of STOCK.values()) {
    rows.push(stockRow(species, qty));
  }
  root.innerHTML = rows.join('');

  // Event delegation for +/- and remove
  root.addEventListener('click', onRowClick, { once: true });
}

function onRowClick(e) {
  const plus  = e.target.closest('[data-qty-plus]');
  const minus = e.target.closest('[data-qty-minus]');
  const rem   = e.target.closest('[data-remove-id]');
  if (!plus && !minus && !rem) return;

  if (plus) {
    const id = plus.getAttribute('data-qty-plus');
    const entry = STOCK.get(id);
    if (!entry) return;
    entry.qty = Math.min(999, entry.qty + 1);
    STOCK.set(id, entry);
    renderStockList();
    syncStateFromStock();
    return;
  }

  if (minus) {
    const id = minus.getAttribute('data-qty-minus');
    const entry = STOCK.get(id);
    if (!entry) return;
    entry.qty = Math.max(0, entry.qty - 1);
    if (entry.qty === 0) STOCK.delete(id); else STOCK.set(id, entry);
    renderStockList();
    syncStateFromStock();
    return;
  }

  if (rem) {
    const id = rem.getAttribute('data-remove-id');
    STOCK.delete(id);
    renderStockList();
    syncStateFromStock();
  }
}

function stockRow(s, qty) {
  const name = esc(s.common_name || s.id);
  const id   = esc(s.id);
  const qStr = `${qty}`;
  return `
    <div class="stock-row" data-testid="species-row">
      <div class="stock-row__name">${name}</div>
      <div class="stock-row__qtyctrl" role="group" aria-label="Quantity for ${name}">
        <button class="qtybtn" data-qty-minus="${id}" aria-label="Decrease ${name}">–</button>
        <div class="qtyval" aria-live="polite" aria-atomic="true">${qStr}</div>
        <button class="qtybtn" data-qty-plus="${id}" aria-label="Increase ${name}">+</button>
      </div>
      <button class="stock-row__remove" data-remove-id="${id}" aria-label="Remove ${name}" data-testid="btn-remove-species">Remove</button>
    </div>
  `;
}

function esc(x){ return String(x).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
/* ==== end renderer ==== */

function sanitizeQty(value, fallback = 1) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(999, Math.max(1, parsed));
}

function syncStockFromState() {
  STOCK.clear();
  if (!Array.isArray(state.stock)) {
    renderStockList();
    emitStockChange();
    return;
  }
  for (const entry of state.stock) {
    if (!entry?.id) continue;
    const species = speciesById.get(entry.id);
    if (!species) continue;
    const qty = sanitizeQty(entry.qty, 1);
    entry.qty = qty;
    if ('stage' in entry) {
      delete entry.stage;
    }
    STOCK.set(species.id, { species, qty });
  }
  renderStockList();
  emitStockChange();
}

function syncStateFromStock() {
  state.stock = Array.from(STOCK.values()).map(({ species, qty }) => ({
    id: species.id,
    qty: sanitizeQty(qty, 1),
  }));
  emitStockChange();
  scheduleUpdate();
}

document.addEventListener('advisor:addCandidate', (event) => {
  const detail = event.detail ?? {};
  const species = detail.species;
  if (!species?.id || !speciesById.has(species.id)) {
    return;
  }
  const fallbackQty = Number(state.candidate?.qty ?? 1) || 1;
  const qty = sanitizeQty(detail.qty, fallbackQty);

  const existing = state.stock.find((entry) => entry.id === species.id);
  if (existing) {
    const combined = (Number(existing.qty) || 0) + qty;
    existing.qty = sanitizeQty(combined, qty);
  } else {
    state.stock.push({ id: species.id, qty });
  }

  const defaultId = getDefaultSpeciesId();
  const firstOptionId =
    refs.speciesSelect && refs.speciesSelect.options.length > 0
      ? refs.speciesSelect.options[0].value
      : null;
  const normalizedFirst = firstOptionId && speciesById.has(firstOptionId) ? firstOptionId : null;
  const normalizedDefault = defaultId && speciesById.has(defaultId) ? defaultId : null;
  const nextId = normalizedFirst ?? normalizedDefault ?? species.id;

  state.candidate = {
    id: nextId,
    qty: '1',
  };

  if (refs.speciesSelect) {
    if (normalizedFirst) {
      refs.speciesSelect.selectedIndex = 0;
    } else {
      refs.speciesSelect.value = nextId;
    }
  }
  syncQtyInputFromState({ force: true });

  selectedSpeciesId = state.candidate.id || null;
  emitSpeciesChange(selectedSpeciesId);
  syncStockFromState();
  console.log('[StockingAdvisor] Added:', species.id, 'x', qty);
  scheduleUpdate();
});

document.addEventListener('advisor:removeCandidate', (event) => {
  const id = event.detail?.id;
  if (!id) {
    return;
  }
  state.stock = state.stock.filter((entry) => entry.id !== id);
  syncStockFromState();
  console.log('[StockingAdvisor] Removed:', id);
  scheduleUpdate();
});

document.addEventListener('DOMContentLoaded', () => {
  syncStockFromState();
});

function pruneMarineEntries() {
  if (!Array.isArray(state.stock)) {
    state.stock = [];
  }
  state.stock = state.stock.filter((entry) => {
    if (entry && supportedSpeciesIds.has(entry.id)) {
      return true;
    }
    if (entry?.id && !warnedMarineIds.has(entry.id)) {
      warnedMarineIds.add(entry.id);
      console.warn('Marine species not supported:', entry.id);
    }
    return false;
  });

  if (!state.candidate) {
    state.candidate = { id: getDefaultSpeciesId(), qty: '1' };
    selectedSpeciesId = state.candidate.id || null;
    emitSpeciesChange(selectedSpeciesId);
    return;
  }

  if (state.candidate.id && !supportedSpeciesIds.has(state.candidate.id)) {
    if (!warnedMarineIds.has(state.candidate.id)) {
      warnedMarineIds.add(state.candidate.id);
      console.warn('Marine species not supported:', state.candidate.id);
    }
    state.candidate.id = getDefaultSpeciesId();
    if (refs.speciesSelect) {
      refs.speciesSelect.value = state.candidate.id ?? '';
    }
    selectedSpeciesId = state.candidate.id || null;
    emitSpeciesChange(selectedSpeciesId);
  }

  emitStockChange();
}

function updateToggle(control, value) {
  if (!control) return;
  const active = Boolean(value);
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    control.checked = active;
    control.setAttribute('aria-checked', active ? 'true' : 'false');
    return;
  }
  control.dataset.active = active ? 'true' : 'false';
  control.setAttribute('aria-checked', active ? 'true' : 'false');
  const label = control.querySelector('span:last-of-type');
  if (label) {
    label.textContent = active ? 'On' : 'Off';
  }
}

  function applyEnvTipsState(open) {
    const panel = refs.envTips;
    const card = refs.envCard;
    if (panel) {
      panel.hidden = !open;
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (card) {
      card.classList.toggle('info-open', Boolean(open));
    }
  }

function syncStateFromInputs() {
  if (state.variantId) {
    const gallons = state.tank?.gallons ?? 0;
    const tankId = state.tank?.id ?? null;
    const valid = getTankVariants({ tankId, gallons }).some((variant) => variant.id === state.variantId);
    if (!valid) {
      state.variantId = null;
    }
  }
}

function populateSpecies({ preserveSelection = false } = {}) {
  if (!refs.speciesSelect) return;

  const previousSelection = preserveSelection
    ? (refs.speciesSelect.value || state.candidate?.id || null)
    : (state.candidate?.id || refs.speciesSelect.value || null);

  const options = buildSpeciesOptionsList();
  const fragment = document.createDocumentFragment();
  for (const species of options) {
    const option = document.createElement('option');
    option.value = species.id;
    option.textContent = species.common_name;
    fragment.appendChild(option);
  }

  refs.speciesSelect.innerHTML = '';
  refs.speciesSelect.appendChild(fragment);

  let nextSelection = null;
  if (previousSelection && options.some((item) => item.id === previousSelection)) {
    nextSelection = previousSelection;
  } else if (options.length) {
    nextSelection = options[0].id;
  }

  if (nextSelection) {
    refs.speciesSelect.value = nextSelection;
  } else {
    refs.speciesSelect.value = '';
  }

  if (!state.candidate || typeof state.candidate !== 'object') {
    state.candidate = { id: nextSelection ?? getDefaultSpeciesId(), qty: '1' };
  } else {
    state.candidate.id = nextSelection ?? null;
  }

  if (refs.addBtn) {
    refs.addBtn.disabled = options.length === 0;
  }

  selectedSpeciesId = nextSelection ?? null;
  emitSpeciesChange(selectedSpeciesId);
}

function rebuildSpecies(options = {}) {
  const opts = typeof options === 'object' && options !== null ? options : {};
  const hasCustomOptions = Object.keys(opts).length > 0;

  if (!hasCustomOptions) {
    resetSpeciesFilters();
  } else {
    if (opts.resetSearch) {
      speciesSearchTerm = '';
    }

    const providedSearch = opts.search ?? opts.searchTerm ?? opts.term ?? opts.query;
    if (providedSearch !== undefined) {
      speciesSearchTerm = sanitizeSearchTerm(providedSearch);
    }

    if (refs.speciesSearch) {
      refs.speciesSearch.value = speciesSearchTerm;
    }

    if (Object.prototype.hasOwnProperty.call(opts, 'salinity')) {
      manualSalinityFilter = normalizeSalinityPreference(opts.salinity);
    }
  }

  const preserveSelection = opts.preserveSelection ?? true;
  populateSpecies({ preserveSelection });
  scheduleUpdate();
}

const advisorApi = window.advisor ? { ...window.advisor } : {};
advisorApi.rebuildSpecies = (options) => {
  rebuildSpecies(options);
};
advisorApi.getVisibleSpecies = () => buildSpeciesOptionsList().map((species) => ({
  id: species.id,
  name: species.common_name,
}));
window.advisor = advisorApi;

function syncToggles() {
  updateToggle(refs.planted, state.planted);
  if (refs.envTips || refs.envInfoToggle || refs.envCard) {
    applyEnvTipsState(state.showTips);
  }
  if (refs.plantIcon) {
    refs.plantIcon.style.display = state.planted ? 'inline-flex' : 'none';
  }
}

function renderCandidateState() {
  const chips = computed ? computed.chips : [];
  renderChips(refs.candidateChips, chips);
  lengthValidator.sync();
  if (!computed) {
    if (refs.candidateBanner) {
      refs.candidateBanner.style.display = 'none';
    }
    return;
  }
  if (refs.addBtn) {
    refs.addBtn.disabled = false;
  }
  if (refs.candidateBanner) {
    refs.candidateBanner.style.display = 'none';
  }
}

function renderDiagnostics() {
  if (!debugMode) return;
  const groupLabel = computed ? '[Stocking] Diagnostics' : '[Stocking] Diagnostics (inactive)';
  console.groupCollapsed(groupLabel);
  if (!computed) {
    console.log('Diagnostics unavailable: select a tank to generate state.');
    console.groupEnd();
    return;
  }
  const sanity = runSanitySuite(state);
  const stress = runStressSuite(state);
  console.log('Live Snapshot');
  computed.diagnostics.forEach((line) => console.log(line));
  console.log('Sanity Tests');
  sanity.forEach((line) => console.log(line));
  console.log('Stress Tests');
  stress.forEach((line) => console.log(line));
  console.groupEnd();
}

function renderAll() {
  const activeTank = state.tank ?? EMPTY_TANK;
  if (!Number.isFinite(activeTank.gallons) || activeTank.gallons <= 0) {
    computed = null;
    if (refs.conditions) {
      refs.conditions.innerHTML = '';
    }
    renderCandidateState();
    syncStockFromState();
    renderDiagnostics();
    renderEnvironmentPanels();
    ensureTankAssumptionScrubbed();
    syncQtyInputFromState();
    refreshFiltrationUI({ preserveSelection: true, reason: 'render' });
    syncGearLink();
    return;
  }
  computed = buildComputedState(state);
  if (refs.conditions) {
    renderConditions(refs.conditions, computed.conditions.conditions);
  }
  renderCandidateState();
  syncStockFromState();
  renderDiagnostics();
  renderEnvironmentPanels();
  ensureTankAssumptionScrubbed();
  syncQtyInputFromState();
  refreshFiltrationUI({ preserveSelection: true, reason: 'render' });
  syncGearLink();
}

function renderEnvironmentPanels() {
  if (!computed) {
    renderEnvCard({ stock: [], stockCount: 0, computed: null });
    initInfoTooltips();
    return;
  }
  renderEnvCard({
    stock: currentStockArray(),
    stockCount: computed?.stockCount ?? 0,
    computed,
  });
  initInfoTooltips();
}

function runRecompute({ skipInputSync = false } = {}) {
  if (!skipInputSync) {
    syncStateFromInputs();
  }
  pruneMarineEntries();
  renderAll();
}

const scheduleUpdate = debounce(() => {
  runRecompute();
});

initializeFilterCatalog();

window.recomputeAll = (options = {}) => {
  const opts = typeof options === 'object' && options !== null ? options : {};
  runRecompute({ skipInputSync: true, ...opts });
};

window.addEventListener('ttg:recompute', () => {
    initializeFilterCatalog();
    runRecompute({ skipInputSync: true });
});

  document.addEventListener('ttg:envTips:state', (event) => {
    const desired = Boolean(event?.detail?.open);
    if (state.showTips === desired) return;
    state.showTips = desired;
    syncToggles();
  });

function bindInputs() {
  if (refs.planted) {
    refs.planted.addEventListener('change', () => {
      state.planted = Boolean(refs.planted.checked);
      syncToggles();
      scheduleUpdate();
    });
  }

  if (refs.speciesSearch) {
    const handleSearchInput = (event) => {
      speciesSearchTerm = sanitizeSearchTerm(event.target.value);
      populateSpecies({ preserveSelection: true });
      scheduleUpdate();
    };
    refs.speciesSearch.addEventListener('input', handleSearchInput);
    refs.speciesSearch.addEventListener('change', handleSearchInput);
  }

  refs.speciesSelect.addEventListener('change', () => {
    state.candidate.id = refs.speciesSelect.value;
    selectedSpeciesId = state.candidate.id || null;
    emitSpeciesChange(selectedSpeciesId);
    scheduleUpdate();
  });

  refs.qty.addEventListener('input', (event) => {
    const target = event.target;
    const raw = toDigits(target.value);
    if (target.value !== raw) {
      target.value = raw;
    }
    state.candidate.qty = raw;
  });

  refs.qty.addEventListener('blur', () => {
    const previous = state.candidate?.qty;
    const normalized = commitCandidateQty();
    if (previous !== normalized) {
      scheduleUpdate();
    }
  });

  if (refs.seeGear) {
    refs.seeGear.addEventListener('click', () => {
      syncGearLink();
      const gallonsCandidate = computed?.tank?.gallons ?? state?.tank?.gallons ?? state?.gallons ?? null;
      const normalizedGallons = normalizeGearGallons(gallonsCandidate);
      persistGearTankGallons(normalizedGallons);
      persistGearFilterData({
        filterId: state.filterId ?? '',
      });
      if (!computed) return;
      const payload = buildGearPayload();
      try {
        sessionStorage.setItem('ttg_stocking_state', JSON.stringify(payload));
      } catch (_error) {
        /* ignore persistence errors */
      }
    });
  }
}

function buildGearPayload() {
  const tank = computed.tank;
  const bioload = computed.bioload;
  const turnoverInfo = computed.turnover;
  const watts = Math.round(tank.gallons * 4.5);
  return {
    v: '1.0',
    ts: nowTimestamp(),
    tank: {
      gallons_total: tank.gallons,
      length_in: tank.length,
      planted: tank.planted,
      sump_gal: tank.sump,
    },
    targets: {
      turnover_band: turnoverInfo.band,
      turnover_x: tank.turnover,
    },
    filtration: {
      delivered_gph: roundCapacity(tank.deliveredGph),
      rated_gph: roundCapacity(tank.ratedGph),
    },
    filter: {
      product_id: state.filterId ?? null,
      type: state.filterId && state.filterType
        ? String(state.filterType).toUpperCase()
        : null,
      rated_gph: Number.isFinite(state.ratedGph) && state.ratedGph > 0
        ? roundCapacity(state.ratedGph)
        : null,
    },
    heater: {
      temp_target_F: state.water.temperature,
      ambient_F: null,
      has_lid: true,
      watts_recommended: watts,
      watts_range: [Math.max(25, Math.round(watts * 0.8)), Math.round(watts * 1.2)],
    },
    flags: {
      heavy_stock: bioload.proposedPercent > 0.9,
      low_flow_species: computed.entries.some((entry) => entry.species.flow === 'low'),
    },
  };
}

  function init() {
    bindPopoverHandlers(document.body);
    pruneMarineEntries();
    resetSpeciesFilters();
    populateSpecies();
    syncQtyInputFromState({ force: true });
    syncToggles();
    ensureFilterControl();
    if (filtrationUi.trigger && filtrationUi.host) {
      filtrationUi.onToggle = (open) => {
        filtrationUi.open = open;
        syncFiltrationUI();
      };
      filtrationUi.open = false;
      bindFiltrationEvents(filtrationUi, handleFiltersChange);
    }
    bindInputs();
    initializeFilterCatalog();
    runRecompute({ skipInputSync: true });
    isBootstrapped = true;
  }

  init();
}

document.addEventListener('ttg:tooltip-open', (event) => {
  const trigger = event.target;
  if (!(trigger instanceof HTMLElement)) {
    return;
  }
  const card = trigger.closest('#env-card, .env-card, [data-role="env-card"]');
  if (card) {
    card.classList.add('is-tooltip-open');
  }
});

document.addEventListener('ttg:tooltip-close', (event) => {
  const trigger = event.target;
  if (!(trigger instanceof HTMLElement)) {
    return;
  }
  const card = trigger.closest('#env-card, .env-card, [data-role="env-card"]');
  if (card) {
    card.classList.remove('is-tooltip-open');
  }
});

bootstrapStocking();

// Legacy info popover removed in favor of dedicated tooltip utility.
(function compactBioAggSafe(){
  const bioAgg = document.getElementById('bioagg-card');
  if (!bioAgg) return;

  const update = (()=>{
    let raf = 0;
    return ()=>{
      if (raf) return;
      raf = requestAnimationFrame(()=>{
        raf = 0;
        const tipOpen = !!document.querySelector('.ttg-tooltip[data-tooltip-panel]:not([hidden])');
        const legacyPopOpen = !!document.querySelector('.ttg-popover.is-open');
        const expanded = bioAgg.querySelector('[aria-expanded="true"]');
        const shouldExpand = tipOpen || legacyPopOpen || !!expanded;
        bioAgg.classList.toggle('is-compact', !shouldExpand);

        if (bioAgg.dataset.heightsStripped !== '1'){
          bioAgg.style.minHeight = '';
          bioAgg.style.height = '';
          const body = bioAgg.querySelector('.bioagg-body');
          if (body){
            body.style.minHeight = '';
            body.style.height = '';
          }
          bioAgg.dataset.heightsStripped = '1';
        }
      });
    };
  })();

  createSafeObserver(bioAgg, { attributes: true, attributeFilter: ['style'] }, update);
  bioAgg.classList.add('is-compact');

  window.addEventListener('click', update, { passive: true, capture: true });
  window.addEventListener('keydown', update, { capture: true });
  window.addEventListener('resize', update, { passive: true });
  window.visualViewport?.addEventListener?.('resize', update, { passive: true });
  window.visualViewport?.addEventListener?.('scroll', update, { passive: true });

  update();
})();


if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations)=>{
    registrations.forEach((registration)=> registration.update());
  });
}
