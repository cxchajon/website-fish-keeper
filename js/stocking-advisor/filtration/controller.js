import { canonicalizeFilterType } from '../../utils.js';
import { computeTurnover, getTotalGPH, normalizeFilters } from './math.js';
import {
  loadFilterCatalog as fetchFilterCatalog,
  filterByTank as filterCatalogByTank,
  sortByTypeBrandGph,
  CATALOG_SOURCES,
} from '../catalog-loader.js';
import { populateFilterDropdown } from '../../gear-data.js';
import { isDebugEnabled, onDebugToggle } from '../devtools.js';
import { getTankSnapshot } from '../../stocking/tankStore.js';

const DEBUG_FILTERS = Boolean(window?.TTG?.DEBUG_FILTERS);

const FILTER_STORAGE_KEY = 'ttg.stocking.filters.v1';
const FILTER_SOURCES = Object.freeze({
  PRODUCT: 'product',
  CUSTOM: 'custom',
});
const LEGACY_MANUAL_SOURCE = 'manual';
const ACTIVE_PRODUCT_NOTE = 'Select another product and click Add Selected to add it. Use × to remove filters you no longer need.';
const ICONS = Object.freeze({
  [FILTER_SOURCES.PRODUCT]: '🛠️',
  [FILTER_SOURCES.CUSTOM]: '✳️',
});

const state = {
  filters: [],
  tankGallons: 0,
  totals: {
    totalGph: 0,
    biologicalGph: 0,
    circulationGph: 0,
    turnover: null,
    totalTurnover: null,
  },
};

// This controller owns the filter list: the product dropdown, Add Selected, custom filters and the
// chips. It writes the list to window.appState.filters, the calculator's source of truth. The flag
// tells js/stocking.js to keep its legacy product picker from touching that dropdown or the list.
window.disableLegacyFilterRows = true;

const refs = {
  productSelect: null,
  productAddBtn: null,
  manualType: null,
  manualInput: null,
  manualAddBtn: null,
  manualNote: null,
  productNote: null,
  productLabel: null,
  productField: null,
  chips: null,
  emptyState: null,
  summary: null,
  catalogDebug: null,
  flowMeta: null,
};

let catalog = new Map();
let catalogItems = [];
let catalogPromise = null;
let baseManualNote = '';
let baseProductNote = '';
let recomputeFrame = 0;
let pendingProductId = '';
let productStatusMessage = '';
let productStatusTimer = 0;
let lastOptionsSignature = '';
let productDebugText = '';
let productDebugVisible = false;

const catalogMeta = {
  source: CATALOG_SOURCES.FALLBACK,
  total: 0,
  matched: 0,
};
const VALID_CATALOG_SOURCES = new Set(Object.values(CATALOG_SOURCES));

function ensureCatalogDebugElement() {
  if (refs.catalogDebug && refs.catalogDebug.isConnected) {
    return refs.catalogDebug;
  }
  if (!isDebugEnabled()) {
    return null;
  }
  const productField = refs.productField || document.querySelector('.filter-product-field');
  const controls = productField?.querySelector('.proto-inline-controls');
  if (!productField) {
    return null;
  }
  refs.productField = productField;
  const badge = document.createElement('div');
  badge.className = 'filter-catalog-debug dev-debug';
  badge.id = 'filter-catalog-debug';
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  if (controls && controls.parentNode) {
    controls.parentNode.insertBefore(badge, controls);
  } else {
    productField.appendChild(badge);
  }
  refs.catalogDebug = badge;
  return badge;
}

function removeCatalogDebugElement() {
  if (refs.catalogDebug && refs.catalogDebug.parentNode) {
    refs.catalogDebug.parentNode.removeChild(refs.catalogDebug);
  }
  refs.catalogDebug = null;
}

function syncCatalogDebug() {
  if (!isDebugEnabled()) {
    removeCatalogDebugElement();
    return;
  }
  const badge = ensureCatalogDebugElement();
  if (!badge) {
    return;
  }
  badge.dataset.source = catalogMeta.source;
  badge.textContent = `Catalog source: ${catalogMeta.source} • Loaded: ${catalogMeta.total} | Size-matched: ${catalogMeta.matched}`;
}

function ensureProductLabelElement() {
  if (refs.productLabel && refs.productLabel.isConnected) {
    return refs.productLabel;
  }
  if (!isDebugEnabled()) {
    return null;
  }
  const flowMeta = refs.flowMeta || document.querySelector('.filter-flow-meta');
  if (!flowMeta) {
    return null;
  }
  refs.flowMeta = flowMeta;
  const label = document.createElement('p');
  label.className = 'filter-product-meta dev-debug';
  label.id = 'filter-product-label';
  label.hidden = true;
  flowMeta.appendChild(label);
  refs.productLabel = label;
  return label;
}

function removeProductLabelElement() {
  if (refs.productLabel && refs.productLabel.parentNode) {
    refs.productLabel.parentNode.removeChild(refs.productLabel);
  }
  refs.productLabel = null;
}

function syncProductDebug() {
  if (!isDebugEnabled()) {
    removeProductLabelElement();
    return;
  }
  const label = ensureProductLabelElement();
  if (!label) {
    return;
  }
  if (productDebugVisible && productDebugText) {
    label.hidden = false;
    label.textContent = productDebugText;
  } else {
    label.hidden = true;
    label.textContent = '';
  }
}

onDebugToggle(() => {
  syncCatalogDebug();
  syncProductDebug();
});

function normalizeSource(value) {
  if (value === FILTER_SOURCES.PRODUCT) {
    return FILTER_SOURCES.PRODUCT;
  }
  if (value === FILTER_SOURCES.CUSTOM) {
    return FILTER_SOURCES.CUSTOM;
  }
  if (value === LEGACY_MANUAL_SOURCE) {
    return FILTER_SOURCES.CUSTOM;
  }
  return FILTER_SOURCES.CUSTOM;
}

function parseGph(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    // A minus sign means a negative flow, not a typo to strip.
    if (!normalized || normalized.includes('-')) {
      return NaN;
    }
    const digits = normalized.replace(/[^0-9.]/g, '');
    if (!digits) {
      return NaN;
    }
    return Number(digits);
  }
  return NaN;
}

function clampGph(value) {
  const num = parseGph(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Math.min(Math.round(num), 1500);
}

function formatGph(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return '0';
  }
  return String(Math.round(num));
}

function formatGallonsRange(min, max) {
  const minValue = Number.isFinite(min) && min > 0 ? Math.round(min) : 0;
  const maxValue = Number.isFinite(max) && max > 0 ? Math.round(max) : Infinity;
  const lower = `${minValue}g`;
  const upper = maxValue === Infinity ? '∞' : `${maxValue}g`;
  return lower === upper ? lower : `${lower}–${upper}`;
}

function formatProductOption(item) {
  const label = item?.name ? item.name : item?.id ?? '';
  const details = [];
  if (Number.isFinite(item?.gphRated) && item.gphRated > 0) {
    details.push(`${formatGph(item.gphRated)} GPH`);
  }
  if (typeof item?.type === 'string' && item.type) {
    details.push(item.type);
  }
  details.push(formatGallonsRange(item?.minGallons, item?.maxGallons));
  if (!label) {
    return details.join(' • ');
  }
  return details.length ? `${label} • ${details.join(' • ')}` : label;
}

function formatTurnover(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return '0.0';
  }
  return Math.max(num, 0).toFixed(1);
}

const FILTER_TYPE_LABELS = Object.freeze({
  CANISTER: 'Canister',
  HOB: 'Hang-on-back (HOB)',
  INTERNAL: 'Internal',
  UGF: 'Undergravel',
  SPONGE: 'Sponge',
  POWERHEAD: 'Powerhead',
});

function formatFilterTypeLabel(value) {
  const canonical = resolveEfficiencyType(value);
  return FILTER_TYPE_LABELS[canonical] || canonical || 'HOB';
}

function computeManualLabel(type, gph) {
  const labelType = formatFilterTypeLabel(type);
  return `${labelType} ${formatGph(gph)} GPH`;
}

// Powerheads stay distinct from filters: they add circulation, not biological filtration.
function resolveEfficiencyType(rawType) {
  return canonicalizeFilterType(rawType);
}

function canAddProduct(product) {
  if (!product || !product.id) {
    return false;
  }
  return !state.filters.some((entry) => entry.source === FILTER_SOURCES.PRODUCT && entry.id === product.id);
}

function canAddManual(type, gph) {
  const canonicalType = canonicalizeFilterType(type);
  const rated = clampGph(gph);
  return Boolean(canonicalType) && Number.isFinite(rated) && rated > 0;
}

function setButtonState(button, enabled) {
  if (!button) return;
  if (enabled) {
    button.disabled = false;
    button.removeAttribute('aria-disabled');
  } else {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
  }
}

function toAppFilter(item) {
  const gph = clampGph(item?.gph);
  const source = normalizeSource(item?.source);
  const baseType = item?.type ?? (source === FILTER_SOURCES.PRODUCT ? item?.type : 'HOB');
  const type = canonicalizeFilterType(baseType);
  const efficiencyType = resolveEfficiencyType(item?.efficiencyType ?? baseType);
  return {
    id: typeof item?.id === 'string' && item.id ? item.id : null,
    type,
    rated_gph: gph ?? 0,
    kind: efficiencyType,
    source,
  };
}

function persistAppFilters(filters) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const payload = Array.isArray(filters)
      ? filters.map((entry) => ({
          id: entry.id ?? null,
          type: canonicalizeFilterType(entry.type),
          rated_gph: clampGph(entry.rated_gph) ?? 0,
        }))
      : [];
    const meaningful = payload.filter((item) => item.id || item.rated_gph > 0);
    if (!meaningful.length) {
      localStorage.removeItem(FILTER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(meaningful));
  } catch (_error) {
    // ignore storage failures
  }
}

function scheduleRecompute() {
  if (recomputeFrame) {
    cancelAnimationFrame(recomputeFrame);
  }
  recomputeFrame = requestAnimationFrame(() => {
    recomputeFrame = 0;
    window.dispatchEvent(new CustomEvent('ttg:recompute'));
  });
}

// Flow summary only. Filtration never changes the bioload percentage; the engine reports its
// adequacy separately (computed.filtering).
function computeFilterStats(appFilters, { gallons = state.tankGallons } = {}) {
  const normalizedFilters = normalizeFilters(Array.isArray(appFilters) ? appFilters : []);
  const totals = getTotalGPH(normalizedFilters, { normalized: true });
  const volume = Number.isFinite(gallons) && gallons > 0 ? gallons : state.tankGallons;
  const hasVolume = Number.isFinite(volume) && volume > 0;
  return {
    totalGph: totals.rated,
    biologicalGph: totals.biological,
    circulationGph: totals.circulation,
    turnover: totals.rated > 0 && hasVolume ? computeTurnover(totals.biological, volume) : null,
    totalTurnover: totals.rated > 0 && hasVolume ? computeTurnover(totals.rated, volume) : null,
    normalizedFilters: normalizedFilters.map((entry) => ({ ...entry })),
  };
}

function logFilterDebug() {
  /* Debug logging disabled for production build */
}

function applyFiltersToApp() {
  const appState = window.appState;
  if (!appState) return;
  const appFilters = state.filters.map((item) => toAppFilter(item));
  const gallons = Number.isFinite(state.tankGallons) && state.tankGallons > 0 ? state.tankGallons : 0;
  const stats = computeFilterStats(appFilters, { gallons });
  state.totals = {
    totalGph: stats.totalGph,
    biologicalGph: stats.biologicalGph,
    circulationGph: stats.circulationGph,
    turnover: stats.turnover,
    totalTurnover: stats.totalTurnover,
  };
  appState.filters = stats.normalizedFilters.map((entry) => ({ ...entry }));
  const productFilters = state.filters.filter((item) => item.source === FILTER_SOURCES.PRODUCT);
  const primaryProduct = productFilters.length ? productFilters[productFilters.length - 1] : null;
  if (primaryProduct) {
    appState.filterId = primaryProduct.id ?? null;
    appState.filterType = canonicalizeFilterType(primaryProduct.type ?? 'HOB');
    appState.ratedGph = clampGph(primaryProduct.gph);
  } else {
    appState.filterId = null;
    appState.filterType = null;
    appState.ratedGph = null;
  }
  appState.totalGph = stats.totalGph > 0 ? stats.totalGph : null;
  appState.actualGph = stats.totalGph > 0 ? stats.totalGph : null;
  appState.turnover = Number.isFinite(stats.turnover) && stats.turnover > 0 ? stats.turnover : null;
  logFilterDebug({ filters: appState.filters, ...state.totals });
  persistAppFilters(appFilters);
  scheduleRecompute();
}

function getTankGallons() {
  // The tank store is updated before ttg:tank:changed fires; appState.tank only after it. Reading
  // appState first listed products for the previous tank size in the dropdown.
  const snapshot = getTankSnapshot();
  if (snapshot) {
    const snapshotGallons = Number(snapshot.gallons);
    return Number.isFinite(snapshotGallons) && snapshotGallons > 0 ? snapshotGallons : 0;
  }
  const appState = window.appState || {};
  const fromTank = appState?.tank?.gallons;
  if (Number.isFinite(fromTank) && fromTank > 0) {
    return Number(fromTank);
  }
  const direct = appState?.gallons;
  if (Number.isFinite(direct) && direct > 0) {
    return Number(direct);
  }
  return 0;
}

function ensureRefs() {
  if (!refs.productSelect) {
    refs.productSelect = document.getElementById('filter-product');
  }
  if (!refs.productAddBtn) {
    refs.productAddBtn = document.getElementById('filter-product-add');
  }
  if (!refs.manualType) {
    refs.manualType = document.getElementById('fs-type');
  }
  if (!refs.manualInput) {
    refs.manualInput = document.getElementById('fs-gph');
  }
  if (!refs.manualAddBtn) {
    refs.manualAddBtn = document.getElementById('fs-add-custom');
  }
  if (!refs.manualNote) {
    refs.manualNote = document.querySelector('.filter-setup .hint');
  }
  if (!refs.productNote) {
    refs.productNote = document.getElementById('filter-product-note');
  }
  if (!refs.productLabel) {
    refs.productLabel = document.getElementById('filter-product-label');
  }
  if (!refs.productField) {
    refs.productField = document.querySelector('.filter-product-field');
  }
  if (!refs.catalogDebug) {
    refs.catalogDebug = document.getElementById('filter-catalog-debug');
  }
  if (!refs.chips) {
    refs.chips = document.querySelector('[data-role="proto-filter-chips"]');
  }
  if (!refs.emptyState) {
    refs.emptyState = document.querySelector('[data-role="proto-filter-empty"]');
  }
  if (!refs.summary) {
    refs.summary = document.querySelector('[data-role="proto-filter-summary"]');
  }
  if (!refs.flowMeta) {
    refs.flowMeta = document.querySelector('.filter-flow-meta');
  }
}

function updateProductLabel(productItem) {
  productDebugVisible = Boolean(productItem);
  productDebugText = productItem
    ? `${productItem.label} • ${formatGph(productItem.gph)} GPH`
    : '';
  syncProductDebug();
}

function setManualNote(message, { isError = false } = {}) {
  if (refs.manualNote && typeof message === 'string') {
    refs.manualNote.textContent = message;
  }
  if (refs.manualInput) {
    if (isError) {
      refs.manualInput.setAttribute('aria-invalid', 'true');
    } else {
      refs.manualInput.removeAttribute('aria-invalid');
    }
  }
}

function setProductNote(message) {
  if (!refs.productNote) return;
  refs.productNote.textContent = message;
}

function computeProductNote() {
  const hasProduct = state.filters.some((item) => item.source === FILTER_SOURCES.PRODUCT);
  return hasProduct ? ACTIVE_PRODUCT_NOTE : baseProductNote;
}

function updateProductNote() {
  const message = productStatusMessage || computeProductNote();
  setProductNote(message);
}

function clearProductStatusMessage() {
  if (productStatusTimer) {
    window.clearTimeout(productStatusTimer);
    productStatusTimer = 0;
  }
  productStatusMessage = '';
}

function showProductStatus(message, { duration = 2400 } = {}) {
  if (!message) {
    clearProductStatusMessage();
    updateProductNote();
    return;
  }
  clearProductStatusMessage();
  productStatusMessage = message;
  setProductNote(message);
  if (duration > 0) {
    productStatusTimer = window.setTimeout(() => {
      productStatusTimer = 0;
      productStatusMessage = '';
      updateProductNote();
    }, duration);
  }
}

function renderChips() {
  if (!refs.chips) return;
  refs.chips.innerHTML = '';
  const hasFilters = state.filters.length > 0;
  refs.chips.dataset.hasFilters = hasFilters ? 'true' : 'false';
  if (refs.emptyState) {
    if (hasFilters) {
      refs.emptyState.setAttribute('data-hidden', 'true');
    } else {
      refs.emptyState.removeAttribute('data-hidden');
    }
  }
  if (!hasFilters) {
    return;
  }
  state.filters.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'proto-filter-chip fp-chip';
    chip.dataset.filterId = item.id ?? '';
    chip.dataset.source = item.source;
    chip.setAttribute('role', 'listitem');

    const icon = document.createElement('span');
    icon.className = 'proto-filter-chip__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[item.source] || '⚙️';

    const label = document.createElement('span');
    label.className = 'proto-filter-chip__label fp-chip__label';
    label.textContent = item.label;
    label.setAttribute('title', item.label);

    const gph = document.createElement('span');
    gph.className = 'proto-filter-chip__gph fp-chip__badge';
    gph.setAttribute('aria-hidden', 'true');
    gph.innerHTML = `${formatGph(item.gph)}&nbsp;GPH`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'proto-filter-chip__remove fp-chip__close';
    remove.dataset.removeFilter = item.id ?? '';
    remove.setAttribute('aria-label', `Remove ${item.label}`);
    remove.textContent = '×';

    chip.appendChild(icon);
    chip.appendChild(label);
    chip.appendChild(gph);
    chip.appendChild(remove);
    refs.chips.appendChild(chip);
  });
}

function currentStats() {
  const gallons = Number.isFinite(state.tankGallons) && state.tankGallons > 0 ? state.tankGallons : 0;
  const stats = computeFilterStats(state.filters.map((item) => toAppFilter(item)), { gallons });
  state.totals = {
    totalGph: stats.totalGph,
    biologicalGph: stats.biologicalGph,
    circulationGph: stats.circulationGph,
    turnover: stats.turnover,
    totalTurnover: stats.totalTurnover,
  };
  return stats;
}

// "Filtration: 150 GPH • 5.2×/h" counts filters only; powerheads are listed as circulation.
function formatSummary(stats) {
  const base = `Filtration: ${formatGph(stats.biologicalGph)} GPH • ${formatTurnover(stats.turnover)}×/h`;
  return stats.circulationGph > 0 ? `${base} (+${formatGph(stats.circulationGph)} GPH circulation only)` : base;
}

const SUMMARY_TITLE = 'Rated flow through filter media per hour. Powerheads add circulation only. Filtration does not change the bioload %.';

function renderSummary() {
  if (!refs.summary) return;
  const stats = currentStats();
  refs.summary.textContent = formatSummary(stats);
  refs.summary.setAttribute('title', SUMMARY_TITLE);
}

function syncSelectValue() {
  if (!refs.productSelect) return;
  const desired = pendingProductId || '';
  if (refs.productSelect.value !== desired) {
    refs.productSelect.value = desired;
  }
}

function getSelectedProduct() {
  const id = pendingProductId || refs.productSelect?.value || '';
  if (!id) return null;
  return findProductById(id);
}

function updateProductAddButton() {
  const button = refs.productAddBtn;
  if (!button) return;
  const product = getSelectedProduct();
  if (!product) {
    setButtonState(button, false);
    return;
  }
  const item = createProductFilter(product);
  const enabled = Boolean(item) && canAddProduct(item);
  setButtonState(button, enabled);
}

function updateManualAddButton() {
  const button = refs.manualAddBtn;
  if (!button) return;
  const typeValue = refs.manualType?.value || '';
  const gphValue = refs.manualInput?.value || '';
  const enabled = canAddManual(typeValue, gphValue);
  setButtonState(button, enabled);
}

function render() {
  state.tankGallons = getTankGallons();
  renderProductOptions();
  renderChips();
  renderSummary();
  if (typeof window.renderFiltration === 'function') {
    window.renderFiltration();
  }
  const productFilters = state.filters.filter((item) => item.source === FILTER_SOURCES.PRODUCT);
  const latestProduct = productFilters.length ? productFilters[productFilters.length - 1] : null;
  if (!pendingProductId && latestProduct?.id) {
    pendingProductId = latestProduct.id;
  }
  updateProductLabel(latestProduct);
  syncSelectValue();
  updateProductNote();
  updateProductAddButton();
  updateManualAddButton();
  if (!refs.manualInput) return;
  if (!refs.manualInput.placeholder) {
    refs.manualInput.placeholder = 'GPH';
  }
}

function setFilters(nextFilters) {
  if (!Array.isArray(nextFilters)) {
    return;
  }
  const sanitized = [];
  const seen = new Set();

  nextFilters.forEach((raw) => {
    if (!raw) return;
    const source = normalizeSource(raw.source);
    const gph = clampGph(raw.gph ?? raw.rated_gph ?? raw.gphRated);
    if (!Number.isFinite(gph) || gph <= 0) {
      return;
    }
    let id = typeof raw.id === 'string' && raw.id ? raw.id : null;
    if (!id) {
      id = `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const inputType = raw.type ?? (source === FILTER_SOURCES.PRODUCT ? raw.type : 'HOB');
    const type = canonicalizeFilterType(inputType);
    const efficiencyType = resolveEfficiencyType(raw.efficiencyType ?? inputType);
    const label = typeof raw.label === 'string' && raw.label
      ? raw.label
      : source === FILTER_SOURCES.PRODUCT
        ? raw.name ?? id
        : computeManualLabel(efficiencyType, gph);
    const key = `${source}:${id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    sanitized.push({
      id,
      source,
      label,
      gph,
      type,
      efficiencyType,
    });
  });

  state.filters = sanitized;
  render();
  applyFiltersToApp();
}

function createProductFilter(product) {
  if (!product || !product.id) return null;
  const rated = clampGph(product.rated_gph ?? product.ratedGph ?? product.gphRated);
  if (!rated) {
    return null;
  }
  const label = product.name ? `${product.name}` : product.id;
  return {
    id: product.id,
    source: FILTER_SOURCES.PRODUCT,
    label,
    gph: rated,
    type: canonicalizeFilterType(product.type ?? 'HOB'),
    efficiencyType: resolveEfficiencyType(product.type ?? 'HOB'),
  };
}

function removeFilterById(id) {
  const targetId = typeof id === 'string' ? id : '';
  const next = state.filters.filter((item) => item.id !== targetId);
  setFilters(next);
  updateProductAddButton();
}

function addManualFilter(typeValue, value) {
  const efficiencyType = resolveEfficiencyType(typeValue);
  const canonicalType = canonicalizeFilterType(typeValue);
  const rated = clampGph(value);
  if (!canAddManual(canonicalType, rated)) {
    setManualNote('Select a filter type and enter a positive flow value (GPH).', { isError: true });
    return false;
  }
  const id = `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const manual = {
    id,
    source: FILTER_SOURCES.CUSTOM,
    label: computeManualLabel(efficiencyType, rated),
    gph: rated,
    type: canonicalType,
    efficiencyType,
  };
  if (refs.manualInput) {
    refs.manualInput.value = '';
    refs.manualInput.removeAttribute('aria-invalid');
  }
  setManualNote(baseManualNote);
  setFilters(state.filters.concat([manual]));
  updateManualAddButton();
  refs.manualInput?.focus({ preventScroll: true });
  return true;
}

window.renderFiltration = function renderFiltration() {
  const tankGallons = getTankGallons();
  if (Number.isFinite(tankGallons) && tankGallons >= 0) {
    state.tankGallons = tankGallons;
  }
  const stats = currentStats();
  const chipbar = document.querySelector('.filtration-chipbar');
  if (chipbar) {
    chipbar.dataset.total = formatSummary(stats).replace(/^Filtration: /, '');
    chipbar.setAttribute('title', SUMMARY_TITLE);
  }
};

function tryAddCustom() {
  const typeValue = refs.manualType?.value || '';
  const value = refs.manualInput?.value?.trim() || '';
  const added = addManualFilter(typeValue, value);
  if (!added) {
    updateManualAddButton();
  }
}

function findProductById(id) {
  if (!id) return null;
  return catalog.get(id) ?? null;
}

function updateCatalogDebug({ matchedCount = null, totalCount = null, source = null } = {}) {
  if (Number.isFinite(totalCount)) {
    catalogMeta.total = Math.max(0, Math.round(totalCount));
  }
  if (Number.isFinite(matchedCount) && matchedCount >= 0) {
    catalogMeta.matched = Math.max(0, Math.round(matchedCount));
  }
  if (source && VALID_CATALOG_SOURCES.has(source)) {
    catalogMeta.source = source;
  }
  syncCatalogDebug();
}

function buildOptionsSignature(items) {
  if (!items.length) return '';
  return items.map((item) => item.id).join('|');
}

function showProductDropdownUnavailable(message = 'Filters unavailable') {
  if (!refs.productSelect) {
    return;
  }
  populateFilterDropdown(refs.productSelect, [], { emptyMessage: message, preserveValue: false });
  refs.productSelect.dataset.catalogReady = '0';
  pendingProductId = '';
}

function renderProductOptions() {
  if (!refs.productSelect) {
    return;
  }
  if (!catalogItems.length) {
    showProductDropdownUnavailable();
    updateCatalogDebug({ matchedCount: 0, totalCount: 0 });
    return;
  }
  const tankGallons = Number.isFinite(state.tankGallons) && state.tankGallons > 0
    ? state.tankGallons
    : getTankGallons();
  const filteredForTank = filterCatalogByTank(catalogItems, tankGallons);
  const matchCount = filteredForTank.length;
  const items = matchCount ? filteredForTank : catalogItems.slice();
  updateCatalogDebug({ matchedCount: matchCount, totalCount: catalogItems.length });
  if (!items.length) {
    showProductDropdownUnavailable('Filters unavailable');
    return;
  }
  const signature = buildOptionsSignature(items);
  const shouldRender = signature !== lastOptionsSignature || refs.productSelect.dataset.catalogReady !== '1';
  if (!shouldRender) {
    return;
  }
  lastOptionsSignature = signature;
  const selectEl = refs.productSelect;
  const previousValue = pendingProductId || selectEl.value || '';
  const result = populateFilterDropdown(selectEl, items, {
    placeholder: '— Select a product —',
    placeholderValue: '',
    selectedValue: previousValue,
    mapOption: (item) => {
      const dataset = {};
      if (Number.isFinite(item.minGallons)) {
        dataset.minGallons = String(Math.max(0, Math.round(item.minGallons)));
      }
      if (Number.isFinite(item.maxGallons)) {
        dataset.maxGallons = item.maxGallons === Infinity
          ? 'Infinity'
          : String(Math.max(0, Math.round(item.maxGallons)));
      }
      if (Number.isFinite(item.gphRated) && item.gphRated > 0) {
        dataset.gph = String(Math.round(item.gphRated));
      }
      if (typeof item.type === 'string' && item.type) {
        dataset.filterType = item.type;
      }
      return {
        value: item.id,
        label: formatProductOption(item),
        dataset,
      };
    },
  });
  if (!result.hasOptions) {
    showProductDropdownUnavailable('Filters unavailable');
    return;
  }
  if (previousValue && selectEl.value !== previousValue) {
    pendingProductId = '';
  }
  selectEl.dataset.catalogReady = '1';
}

async function handleProductChange(value) {
  const id = typeof value === 'string' ? value : '';
  pendingProductId = id;
  showProductStatus('');
  if (!id) {
    updateProductAddButton();
    return;
  }
  await loadCatalog();
  const product = findProductById(id);
  if (!product) {
    showProductStatus('Filter catalog unavailable. Try again.', { duration: 2800 });
    updateProductAddButton();
    return;
  }
  const item = createProductFilter(product);
  if (!item) {
    showProductStatus('Filter data unavailable. Try a different model.', { duration: 2800 });
    updateProductAddButton();
    return;
  }
  updateProductAddButton();
  if (canAddProduct(item)) {
    showProductStatus('Click Add Selected to add this filter.', { duration: 0 });
  } else {
    showProductStatus('Already added. Remove its chip to add again.', { duration: 0 });
  }
}

async function tryAddProduct() {
  await loadCatalog();
  const product = getSelectedProduct();
  if (!product) {
    showProductStatus('Select a filter to add.', { duration: 2200 });
    updateProductAddButton();
    return;
  }
  const item = createProductFilter(product);
  if (!item) {
    showProductStatus('Filter data unavailable. Try a different model.', { duration: 2800 });
    updateProductAddButton();
    return;
  }
  if (!canAddProduct(item)) {
    showProductStatus('Already added', { duration: 2200 });
    updateProductAddButton();
    return;
  }
  pendingProductId = item.id || pendingProductId;
  setFilters(state.filters.concat([item]));
  showProductStatus('Filter added.', { duration: 1800 });
  updateProductAddButton();
}

async function loadCatalog() {
  if (catalogPromise) {
    return catalogPromise;
  }
  const applyCatalogItems = (items, source) => {
    const normalized = sortByTypeBrandGph(Array.isArray(items) ? items : []);
    catalogItems = normalized.slice();
    catalog = new Map();
    catalogItems.forEach((item) => {
      if (item && typeof item.id === 'string' && item.id) {
        catalog.set(item.id, item);
      }
    });
    lastOptionsSignature = '';
    updateCatalogDebug({ source, totalCount: catalogItems.length, matchedCount: 0 });
    renderProductOptions();
    return catalog;
  };

    catalogPromise = fetchFilterCatalog()
      .then((result) => {
        const source = result?.source && VALID_CATALOG_SOURCES.has(result.source)
          ? result.source
          : CATALOG_SOURCES.FALLBACK;
      const items = Array.isArray(result?.items) ? result.items : [];
      if (!items.length) {
        showProductDropdownUnavailable();
      }
      return applyCatalogItems(items, items.length ? source : CATALOG_SOURCES.FALLBACK);
    })
    .catch((error) => {
    if (DEBUG_FILTERS && typeof console !== 'undefined') {
      console.error('[filtration] failed to load filter catalog:', error);
    }
      showProductDropdownUnavailable('Filters unavailable');
      return applyCatalogItems([], CATALOG_SOURCES.FALLBACK);
    })
    .finally(() => {
      catalogPromise = null;
    });
  return catalogPromise;
}

function readStoredFilters() {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function hydrateFromAppState() {
  const appState = window.appState;
  if (!appState) return;
  // stocking.js loads the saved filters into appState.filters once species data is ready. When this
  // runs first, restore from the same saved list so the empty list written back does not erase it.
  const existing = Array.isArray(appState.filters) && appState.filters.length
    ? appState.filters
    : readStoredFilters();
  const next = [];
  existing.forEach((entry) => {
    const gph = clampGph(entry?.rated_gph ?? entry?.gphRated ?? entry?.gph);
    if (!gph) {
      return;
    }
    const id = typeof entry?.id === 'string' && entry.id ? entry.id : null;
    const product = id ? findProductById(id) : null;
    if (product) {
      const productItem = createProductFilter(product);
      if (productItem) {
        next.push(productItem);
      }
      return;
    }
    const type = canonicalizeFilterType(entry?.type ?? 'HOB');
    const efficiencyType = resolveEfficiencyType(entry?.kind ?? entry?.efficiencyType ?? entry?.type ?? 'HOB');
    const manual = {
      id: id ?? `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      source: FILTER_SOURCES.CUSTOM,
      label: computeManualLabel(efficiencyType, gph),
      gph,
      type,
      efficiencyType,
    };
    next.push(manual);
  });
  setFilters(next);
}

function handleChipClick(event) {
  const button = event.target.closest('[data-remove-filter]');
  if (!button) return;
  const id = button.dataset.removeFilter || '';
  removeFilterById(id);
}

function attachEventListeners() {
  if (refs.manualInput) {
    refs.manualInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        tryAddCustom();
      }
    });
    refs.manualInput.addEventListener('input', () => {
      if (refs.manualInput?.value) {
        refs.manualInput.removeAttribute('aria-invalid');
        if (refs.manualNote && baseManualNote) {
          refs.manualNote.textContent = baseManualNote;
        }
      }
      updateManualAddButton();
    });
  }
  if (refs.manualType) {
    refs.manualType.addEventListener('change', () => {
      if (canAddManual(refs.manualType.value, refs.manualInput?.value)) {
        setManualNote(baseManualNote);
        refs.manualInput?.removeAttribute('aria-invalid');
      }
      updateManualAddButton();
    });
  }
  if (refs.manualAddBtn) {
    refs.manualAddBtn.addEventListener('click', () => {
      tryAddCustom();
    });
  }
  if (refs.chips) {
    refs.chips.addEventListener('click', handleChipClick);
  }
  if (refs.productSelect) {
    refs.productSelect.addEventListener(
      'change',
      (event) => {
        event.stopImmediatePropagation();
        event.stopPropagation();
        handleProductChange(event.target.value);
      },
      true,
    );
  }
  if (refs.productAddBtn) {
    refs.productAddBtn.addEventListener('click', () => {
      tryAddProduct().catch(() => {
        showProductStatus('Unable to add filter. Try again.', { duration: 2400 });
      });
    });
  }
  window.addEventListener('ttg:tank:changed', () => {
    state.tankGallons = getTankGallons();
    render();
  });
}

async function init() {
  await new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    } else {
      resolve();
    }
  });
  ensureRefs();
  baseManualNote = refs.manualNote?.textContent || 'Tip: press Enter in the GPH field to add quickly.';
  baseProductNote = refs.productNote?.textContent || 'Choose a filter matched to your tank size and use Add Selected when ready.';
  if (refs.manualInput) {
    refs.manualInput.removeAttribute('readonly');
  }
  updateCatalogDebug();
  await loadCatalog();
  hydrateFromAppState();
  attachEventListeners();
  render();
}

init().catch(() => {
  // Swallow initialization errors to avoid breaking the prototype experience.
});

