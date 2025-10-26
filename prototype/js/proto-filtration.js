import { canonicalizeFilterType } from '/js/utils.js';
import { calcTotalGph, computeTurnover } from '/js/logic/compute.js';

const FILTER_STORAGE_KEY = 'ttg.stocking.filters.v1';
const FILTER_SOURCES = Object.freeze({
  PRODUCT: 'product',
  MANUAL: 'manual',
});
const ICONS = Object.freeze({
  [FILTER_SOURCES.PRODUCT]: '🛠️',
  [FILTER_SOURCES.MANUAL]: '✳️',
});

const state = {
  filters: [],
  tankGallons: 0,
};

const refs = {
  productSelect: null,
  manualInput: null,
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

function clampGph(value) {
  const num = Number(value);
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

function toAppFilter(item) {
  const gph = clampGph(item?.gph);
  const type = canonicalizeFilterType(item?.type ?? (item?.source === FILTER_SOURCES.PRODUCT ? item?.type : 'HOB'));
  return {
    id: typeof item?.id === 'string' && item.id ? item.id : null,
    type,
    rated_gph: gph ?? 0,
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

function applyFiltersToApp() {
  const appState = window.appState;
  if (!appState) return;
  const appFilters = state.filters.map((item) => toAppFilter(item));
  appState.filters = appFilters.map((entry) => ({ ...entry }));
  const product = state.filters.find((item) => item.source === FILTER_SOURCES.PRODUCT) ?? null;
  if (product) {
    appState.filterId = product.id ?? null;
    appState.filterType = canonicalizeFilterType(product.type ?? 'HOB');
    appState.ratedGph = clampGph(product.gph);
  } else {
    appState.filterId = null;
    appState.filterType = null;
    appState.ratedGph = null;
  }
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
  if (!refs.manualInput) {
    refs.manualInput = document.getElementById('filter-rated-gph');
  }
  if (!refs.manualNote) {
    refs.manualNote = document.getElementById('filter-rated-note');
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
  if (!refs.manualNote) return;
  refs.manualNote.textContent = message;
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
  const totalGph = calcTotalGph(appFilters);
  const turnover = computeTurnover(state.tankGallons, appFilters);
  refs.summary.textContent = `Filtration: ${formatGph(totalGph)} GPH • ${formatTurnover(turnover)}×/h`;
}

function syncSelectValue() {
  if (!refs.productSelect) return;
  const product = state.filters.find((item) => item.source === FILTER_SOURCES.PRODUCT) ?? null;
  const desired = product?.id ?? '';
  if (refs.productSelect.value !== desired) {
    refs.productSelect.value = desired;
  }
}

function render() {
  state.tankGallons = getTankGallons();
  renderChips();
  renderSummary();
  const product = state.filters.find((item) => item.source === FILTER_SOURCES.PRODUCT) ?? null;
  updateProductLabel(product);
  syncSelectValue();
  if (product) {
    setProductNote('Selecting a different product swaps the filter chip.');
  } else {
    setProductNote(baseProductNote);
  }
  if (!refs.manualInput) return;
  if (!refs.manualInput.placeholder) {
    refs.manualInput.placeholder = 'Add custom GPH and press Enter';
  }
}

function setFilters(nextFilters) {
  const product = nextFilters.find((item) => item.source === FILTER_SOURCES.PRODUCT) ?? null;
  const manuals = nextFilters.filter((item) => item.source === FILTER_SOURCES.MANUAL);
  const sanitizedManuals = manuals
    .map((manual) => ({
      ...manual,
      gph: clampGph(manual.gph) ?? 0,
      label: manual.label,
      type: 'HOB',
    }))
    .filter((manual) => manual.gph > 0);
  const uniqueManuals = [];
  const seen = new Set();
  sanitizedManuals.forEach((manual) => {
    const id = manual.id ?? '';
    if (!id || !seen.has(id)) {
      uniqueManuals.push(manual);
      if (id) {
        seen.add(id);
      }
    }
  });
  const next = [];
  if (product) {
    next.push({ ...product, gph: clampGph(product.gph) ?? 0 });
  }
  next.push(...uniqueManuals);
  state.filters = next;
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
  };
}

function addOrReplaceProduct(product) {
  const item = createProductFilter(product);
  if (!item) {
    return;
  }
  const manuals = state.filters.filter((entry) => entry.source === FILTER_SOURCES.MANUAL);
  if (state.filters.length && state.filters[0]?.source === FILTER_SOURCES.PRODUCT && state.filters[0]?.id === item.id) {
    setFilters([item, ...manuals]);
    return;
  }
  setFilters([item, ...manuals]);
}

function removeFilterById(id) {
  const targetId = typeof id === 'string' ? id : '';
  const next = state.filters.filter((item) => item.id !== targetId);
  setFilters(next);
  if (refs.productSelect && (!targetId || refs.productSelect.value === targetId)) {
    if (!next.some((item) => item.source === FILTER_SOURCES.PRODUCT)) {
      refs.productSelect.value = '';
    }
  }
}

function addManualFilter(value) {
  const rated = clampGph(value);
  if (!rated) {
    setManualNote('Enter a positive flow value (GPH).', { isError: true });
    return false;
  }
  const id = `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const manual = {
    id,
    source: FILTER_SOURCES.MANUAL,
    label: `Custom ${rated} GPH`,
    gph: rated,
    type: 'HOB',
  };
  const next = state.filters.concat([manual]);
  setFilters(next);
  setManualNote(baseManualNote);
  if (refs.manualInput) {
    refs.manualInput.value = '';
  }
  return true;
}

function handleManualSubmit() {
  if (!refs.manualInput) return;
  const value = refs.manualInput.value.trim();
  addManualFilter(value);
}

function findProductById(id) {
  if (!id) return null;
  return catalog.get(id) ?? null;
}

async function handleProductChange(value) {
  const id = typeof value === 'string' ? value : '';
  if (!id) {
    removeFilterById(state.filters.find((item) => item.source === FILTER_SOURCES.PRODUCT)?.id ?? '');
    return;
  }
  await loadCatalog();
  const product = findProductById(id);
  if (!product) {
    setProductNote('Filter catalog unavailable. Try again.');
    return;
  }
  addOrReplaceProduct(product);
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
    const manual = {
      id: id ?? `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      source: FILTER_SOURCES.MANUAL,
      label: `Custom ${gph} GPH`,
      gph,
      type: 'HOB',
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
        handleManualSubmit();
      }
    });
    refs.manualInput.addEventListener('input', () => {
      if (refs.manualInput?.value) {
        refs.manualInput.removeAttribute('aria-invalid');
        if (baseManualNote) {
          refs.manualNote.textContent = baseManualNote;
        }
      }
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
  baseManualNote = refs.manualNote?.textContent || 'Press Enter to add each custom GPH value.';
  baseProductNote = refs.productNote?.textContent || 'Choose a filter matched to your tank size to auto-fill GPH.';
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

