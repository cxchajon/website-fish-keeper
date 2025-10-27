import { canonicalizeFilterType, weightedMixFactor } from '/js/utils.js';

const DEBUG_FILTERS = Boolean(window?.TTG?.DEBUG_FILTERS);
const TYPE_WEIGHT = Object.freeze({
  CANISTER: 1.12,
  HOB: 1.0,
  INTERNAL: 0.94,
  UGF: 0.9,
  SPONGE: 0.86,
});

const FILTER_STORAGE_KEY = 'ttg.stocking.filters.v1';
const FILTER_SOURCES = Object.freeze({
  PRODUCT: 'product',
  MANUAL: 'manual',
});
const ACTIVE_PRODUCT_NOTE = 'Select another product and click Add Selected to add it. Use × to remove filters you no longer need.';
const ICONS = Object.freeze({
  [FILTER_SOURCES.PRODUCT]: '🛠️',
  [FILTER_SOURCES.MANUAL]: '✳️',
});

const state = {
  filters: [],
  tankGallons: 0,
};

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
  chips: null,
  emptyState: null,
  summary: null,
};

let catalog = new Map();
let catalogPromise = null;
let baseManualNote = '';
let baseProductNote = '';
let recomputeFrame = 0;
let pendingProductId = '';
let productStatusMessage = '';
let productStatusTimer = 0;

function parseGph(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
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
});

function formatFilterTypeLabel(value) {
  const canonical = resolveEfficiencyType(value);
  return FILTER_TYPE_LABELS[canonical] || canonical || 'HOB';
}

function computeManualLabel(type, gph) {
  const labelType = formatFilterTypeLabel(type);
  return `${labelType} ${formatGph(gph)} GPH`;
}

function resolveEfficiencyType(rawType) {
  const canonical = canonicalizeFilterType(rawType);
  if (canonical === 'HOB' && typeof rawType === 'string') {
    const upper = rawType.trim().toUpperCase();
    if (upper === 'INTERNAL' || upper === 'POWERHEAD') {
      return 'INTERNAL';
    }
    if (upper === 'UGF' || upper === 'UNDERGRAVEL') {
      return 'UGF';
    }
  }
  return canonical;
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
  const baseType = item?.type ?? (item?.source === FILTER_SOURCES.PRODUCT ? item?.type : 'HOB');
  const type = canonicalizeFilterType(baseType);
  const efficiencyType = resolveEfficiencyType(item?.efficiencyType ?? baseType);
  return {
    id: typeof item?.id === 'string' && item.id ? item.id : null,
    type,
    rated_gph: gph ?? 0,
    kind: efficiencyType,
    source: item?.source === FILTER_SOURCES.PRODUCT ? FILTER_SOURCES.PRODUCT : FILTER_SOURCES.MANUAL,
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

function computeFilterStats(appFilters) {
  const filtersForCalc = appFilters.map((filter) => ({
    ...filter,
    resolvedType: resolveEfficiencyType(filter.kind ?? filter.type),
  }));
  const totalGph = filtersForCalc.reduce((sum, filter) => {
    const gph = Number(filter?.rated_gph ?? filter?.gph);
    return Number.isFinite(gph) && gph > 0 ? sum + gph : sum;
  }, 0);
  const mixFactorRaw = totalGph > 0
    ? filtersForCalc.reduce((sum, filter) => {
        const gph = Number(filter?.rated_gph ?? filter?.gph);
        if (!Number.isFinite(gph) || gph <= 0) {
          return sum;
        }
        const weight = TYPE_WEIGHT[filter.resolvedType] ?? TYPE_WEIGHT.HOB;
        return sum + weight * (gph / totalGph);
      }, 0)
    : null;
  const fallbackFactor = weightedMixFactor(appFilters, totalGph);
  const mixFactor = Number.isFinite(mixFactorRaw) && mixFactorRaw > 0 ? mixFactorRaw : fallbackFactor;
  const gallons = state.tankGallons;
  const turnover = gallons > 0 && Number.isFinite(totalGph) && totalGph > 0
    ? totalGph / gallons
    : null;
  return { totalGph, mixFactor, turnover };
}

function logFilterDebug(payload) {
  if (!DEBUG_FILTERS || typeof console === 'undefined') {
    return;
  }
  const rows = Array.isArray(payload.filters)
    ? payload.filters.map((filter) => ({
        source: filter.source,
        type: filter.kind ?? filter.type,
        gph: filter.rated_gph,
      }))
    : [];
  try {
    console.groupCollapsed('[Proto] Filtration debug');
    if (rows.length) {
      console.table(rows);
    } else {
      console.log('No filters configured');
    }
    console.log('totalGPH:', payload.totalGph);
    console.log('turnover:', payload.turnover);
    console.log('mixFactor:', payload.mixFactor);
    if (payload.baseBioload != null) {
      console.log('baseBioload:', payload.baseBioload);
    }
    if (payload.adjustedBioload != null) {
      console.log('adjustedBioload:', payload.adjustedBioload);
    }
    if (payload.bioloadPercent != null) {
      console.log('bioloadPercent:', payload.bioloadPercent);
    }
    console.groupEnd();
  } catch (error) {
    console.log('[Proto] Filtration debug', payload, error);
  }
}

if (DEBUG_FILTERS && typeof window !== 'undefined') {
  window.addEventListener('ttg:proto:filtration-debug', (event) => {
    const detail = event?.detail ?? {};
    logFilterDebug({
      filters: Array.isArray(detail.filters) ? detail.filters : [],
      totalGph: detail.totalGph ?? null,
      turnover: detail.turnover ?? null,
      mixFactor: detail.mixFactor ?? null,
      efficiency: detail.efficiency ?? null,
      baseBioload: detail.baseBioload ?? null,
      adjustedBioload: detail.adjustedBioload ?? null,
      bioloadPercent: detail.bioloadPercent ?? null,
    });
  });
}

function applyFiltersToApp() {
  const appState = window.appState;
  if (!appState) return;
  const appFilters = state.filters.map((item) => toAppFilter(item));
  const normalizedFilters = appFilters.map((entry) => ({ ...entry }));
  const { totalGph, mixFactor, turnover } = computeFilterStats(normalizedFilters);
  appState.filters = normalizedFilters;
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
  appState.totalGph = Number.isFinite(totalGph) && totalGph > 0 ? totalGph : null;
  appState.mixFactor = Number.isFinite(mixFactor) && mixFactor > 0 ? mixFactor : null;
  appState.turnover = Number.isFinite(turnover) && turnover > 0 ? turnover : null;
  const snapshotFilters = normalizedFilters.map((entry) => ({ ...entry }));
  appState.filtering = {
    filters: snapshotFilters,
    gphTotal: totalGph,
    turnover,
    mixFactor,
  };
  logFilterDebug({ filters: snapshotFilters, totalGph, turnover, mixFactor });
  persistAppFilters(appFilters);
  scheduleRecompute();
}

function getTankGallons() {
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
  if (!refs.chips) {
    refs.chips = document.querySelector('[data-role="proto-filter-chips"]');
  }
  if (!refs.emptyState) {
    refs.emptyState = document.querySelector('[data-role="proto-filter-empty"]');
  }
  if (!refs.summary) {
    refs.summary = document.querySelector('[data-role="proto-filter-summary"]');
  }
}

function updateProductLabel(productItem) {
  if (!refs.productLabel) return;
  if (productItem) {
    refs.productLabel.hidden = false;
    refs.productLabel.textContent = `${productItem.label} • ${formatGph(productItem.gph)} GPH`;
  } else {
    refs.productLabel.hidden = true;
    refs.productLabel.textContent = '';
  }
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
    const chip = document.createElement('div');
    chip.className = 'proto-filter-chip';
    chip.dataset.filterId = item.id ?? '';
    chip.dataset.source = item.source;

    const icon = document.createElement('span');
    icon.className = 'proto-filter-chip__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[item.source] || '⚙️';

    const label = document.createElement('span');
    label.className = 'proto-filter-chip__label';
    label.textContent = item.label;

    const gph = document.createElement('span');
    gph.className = 'proto-filter-chip__gph';
    gph.textContent = `${formatGph(item.gph)} GPH`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'proto-filter-chip__remove';
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

function renderSummary() {
  if (!refs.summary) return;
  const appFilters = state.filters.map((item) => toAppFilter(item));
  const { totalGph, turnover } = computeFilterStats(appFilters);
  refs.summary.textContent = `Filtration: ${formatGph(totalGph)} GPH • ${formatTurnover(turnover)}×/h`;
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
    const source = raw.source === FILTER_SOURCES.PRODUCT ? FILTER_SOURCES.PRODUCT : FILTER_SOURCES.MANUAL;
    const gph = clampGph(raw.gph ?? raw.rated_gph);
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
  const rated = clampGph(product.rated_gph ?? product.ratedGph);
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
    source: FILTER_SOURCES.MANUAL,
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
  const appFilters = state.filters.map((item) => toAppFilter(item));
  const { totalGph, turnover } = computeFilterStats(appFilters);
  const chipbar = document.querySelector('.filtration-chipbar');
  if (chipbar) {
    chipbar.dataset.total = `${formatGph(totalGph)} GPH • ${formatTurnover(turnover)}×/h`;
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
  catalogPromise = fetch('/data/filters.json', { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load catalog: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      catalog = new Map();
      const list = Array.isArray(data) ? data : [];
      list.forEach((item) => {
        if (item && typeof item.id === 'string' && item.id) {
          catalog.set(item.id, item);
        }
      });
      return catalog;
    })
    .catch((_error) => {
      catalog = new Map();
      return catalog;
    });
  return catalogPromise;
}

function hydrateFromAppState() {
  const appState = window.appState;
  if (!appState) return;
  const existing = Array.isArray(appState.filters) ? appState.filters : [];
  const next = [];
  existing.forEach((entry) => {
    const gph = clampGph(entry?.rated_gph ?? entry?.gph);
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
      source: FILTER_SOURCES.MANUAL,
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
  await loadCatalog();
  hydrateFromAppState();
  attachEventListeners();
  render();
}

init().catch(() => {
  // Swallow initialization errors to avoid breaking the prototype experience.
});

