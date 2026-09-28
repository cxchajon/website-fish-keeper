import { canonicalizeFilterType } from '../../utils.js';
import {
  computeTurnover,
  effectiveCapacityMethod,
  getTotalGPH,
  hasUnsupportedCapacityMethod,
  isRatingBasedSponge,
  isSpongeFilter,
  normalizeFilters,
  pickPassthroughFields,
  resolveCapacityMethod,
} from './math.js';
import { createInstanceId, readSavedFilters, writeSavedFilters } from './saved-state.js';
import {
  SPONGE_ITEM_LABEL,
  buildCustomSpongeItem,
  buildSpongeProductItem,
  needsCustomRating,
  parseRatedGallons,
  restoreSpongeItem,
  spongeChipBadge,
  spongeOptionDetails,
} from './sponge-items.js';
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
  manualRatingField: null,
  manualRatingInput: null,
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
// A custom sponge (restored from an old plan, "Rating needed") whose rating the user is entering:
// Add replaces it in place instead of adding a second sponge.
let pendingRatingTargetId = '';
const SPONGE_MANUAL_NOTE = 'Rated for up to ___ gallons: enter the tank size the manufacturer rates this sponge for (printed on the box or listing, e.g. \u201cup to 20 gallons\u201d; for a range like 10\u201340 gal, enter 40). Sponge filters are checked by this rating; water flow isn\u2019t estimated.';
const SPONGE_RATING_ERROR = 'Enter the tank size this sponge is rated for: a whole number of gallons from 1 to 999.';
const FLOW_ERROR = 'Select a filter type and enter a positive flow value (GPH).';

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
  // Sponges show their rating state, never the legacy catalog GPH or the GPH-bucket tank range.
  if (isSpongeFilter(item)) {
    return label ? `${label} • ${spongeOptionDetails(item)}` : spongeOptionDetails(item);
  }
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
  // A custom sponge is named without any flow: its GPH (if an old plan had one) is not used.
  if (labelType === 'Sponge') {
    return SPONGE_ITEM_LABEL;
  }
  return `${labelType} ${formatGph(gph)} GPH`;
}

function isManualSpongeType(type) {
  return canonicalizeFilterType(type) === 'SPONGE';
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

// Powered / circulation types need a positive GPH; a sponge needs its rated tank size instead.
function canAddManual(type, value) {
  if (typeof type !== 'string' || !type.trim()) return false;
  if (isManualSpongeType(type)) {
    return parseRatedGallons(value) !== null;
  }
  const canonicalType = canonicalizeFilterType(type);
  const rated = clampGph(value);
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

// Identity and capacity fields an item carries through the calculator and saved state. A sponge
// always resolves to manufacturer_rating (type wins over stale "flow" data, phase B).
function capacityFields(item) {
  return {
    ...pickPassthroughFields(item),
    capacityMethod: effectiveCapacityMethod(item),
  };
}

function isSpongeItem(item) {
  return isSpongeFilter({ type: canonicalizeFilterType(item?.type ?? 'HOB') });
}

function toAppFilter(item) {
  const source = normalizeSource(item?.source);
  const baseType = item?.type ?? (source === FILTER_SOURCES.PRODUCT ? item?.type : 'HOB');
  const type = canonicalizeFilterType(baseType);
  const efficiencyType = resolveEfficiencyType(item?.efficiencyType ?? baseType);
  // A sponge carries no flow, whatever its item holds.
  const sponge = isSpongeFilter({ type });
  const gph = sponge ? null : clampGph(item?.gph);
  const appFilter = {
    id: typeof item?.id === 'string' && item.id ? item.id : null,
    type,
    rated_gph: gph ?? 0,
    kind: efficiencyType,
    source,
    ...capacityFields(item),
  };
  // The engine names each sponge in its rating messages.
  if (sponge && typeof item?.label === 'string' && item.label) {
    appFilter.label = item.label;
  }
  return appFilter;
}

// Saved as ttg.stocking.filters.v2, with the v1 mirror older scripts read (see saved-state.js).
// A custom filter also keeps its chip label there.
function persistAppFilters(items) {
  const saved = Array.isArray(items)
    ? items.map((item) => {
        const appFilter = toAppFilter(item);
        return appFilter.source === FILTER_SOURCES.CUSTOM && item?.label
          ? { ...appFilter, label: item.label }
          : appFilter;
      })
    : [];
  writeSavedFilters(undefined, saved);
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
    // Sponges are counted, never measured in GPH.
    spongeCount: normalizedFilters.filter((entry) => isRatingBasedSponge(entry)).length,
    poweredCount: normalizedFilters.filter((entry) => entry.role === 'biological' && !isRatingBasedSponge(entry)).length,
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
    // A sponge has no rated flow: its legacy catalog GPH is never handed to the calculator.
    appState.ratedGph = isSpongeItem(primaryProduct) ? null : clampGph(primaryProduct.gph);
  } else {
    appState.filterId = null;
    appState.filterType = null;
    appState.ratedGph = null;
  }
  appState.totalGph = stats.totalGph > 0 ? stats.totalGph : null;
  appState.actualGph = stats.totalGph > 0 ? stats.totalGph : null;
  appState.turnover = Number.isFinite(stats.turnover) && stats.turnover > 0 ? stats.turnover : null;
  logFilterDebug({ filters: appState.filters, ...state.totals });
  persistAppFilters(state.filters);
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
  if (!refs.manualRatingField) {
    refs.manualRatingField = document.querySelector('[data-role="fs-rating-field"]');
  }
  if (!refs.manualRatingInput) {
    refs.manualRatingInput = document.getElementById('fs-rated-gallons');
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
    ? `${productItem.label} • ${isSpongeItem(productItem) ? spongeChipBadge(productItem) : `${formatGph(productItem.gph)} GPH`}`
    : '';
  syncProductDebug();
}

function manualTypeIsSponge() {
  return isManualSpongeType(refs.manualType?.value || '');
}

// The field that is active for the chosen custom type: rated gallons for a sponge, GPH otherwise.
function activeManualInput() {
  return manualTypeIsSponge() && refs.manualRatingInput ? refs.manualRatingInput : refs.manualInput;
}

// The note under the custom row matches the active field.
function defaultManualNote() {
  return manualTypeIsSponge() ? SPONGE_MANUAL_NOTE : baseManualNote;
}

function setManualNote(message, { isError = false } = {}) {
  if (refs.manualNote && typeof message === 'string') {
    refs.manualNote.textContent = message;
  }
  [refs.manualInput, refs.manualRatingInput].forEach((input) => {
    if (!input) return;
    if (isError && input === activeManualInput()) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  });
}

// Sponge → "Rated for up to ___ gallons"; every other type → GPH. A value typed for one field is
// never carried into the other: switching type clears the field being hidden.
function syncManualFields() {
  const sponge = manualTypeIsSponge();
  if (refs.manualRatingField) {
    refs.manualRatingField.hidden = !sponge;
    refs.manualRatingField.style.display = sponge ? 'inline-flex' : 'none';
  }
  if (refs.manualInput) {
    if (sponge && refs.manualInput.value) refs.manualInput.value = '';
    refs.manualInput.hidden = sponge;
    const gphLabel = document.querySelector('label[for="fs-gph"]');
    if (gphLabel) gphLabel.hidden = sponge;
  }
  if (refs.manualRatingInput && !sponge && refs.manualRatingInput.value) {
    refs.manualRatingInput.value = '';
  }
  if (!sponge) {
    pendingRatingTargetId = '';
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
  if (pendingRatingTargetId && !state.filters.some((item) => item.id === pendingRatingTargetId)) {
    pendingRatingTargetId = '';
  }
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

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'proto-filter-chip__remove fp-chip__close';
    remove.dataset.removeFilter = item.id ?? '';
    remove.setAttribute('aria-label', `Remove ${item.label}`);
    remove.textContent = '×';

    let rate = null;
    if (isSpongeItem(item)) {
      // A sponge shows its manufacturer rating (or "Rating needed"), never a GPH.
      const badge = spongeChipBadge(item);
      gph.textContent = badge;
      gph.dataset.rating = badge === 'Rating needed' ? 'needed' : 'rated';
      gph.removeAttribute('aria-hidden');
      label.setAttribute('title', `${item.label} — ${badge}`);
      remove.setAttribute('aria-label', `Remove ${item.label} (${badge})`);
      if (needsCustomRating(item)) {
        // An old custom sponge (no rating): let the user enter the number printed on the box.
        rate = document.createElement('button');
        rate.type = 'button';
        rate.className = 'proto-filter-chip__rate';
        rate.dataset.rateFilter = item.id ?? '';
        rate.textContent = 'Add rating';
        rate.setAttribute('aria-label', `Add the manufacturer tank rating for ${item.label}`);
        rate.style.cssText = 'flex:0 0 auto;width:auto;min-width:0;min-height:0;height:auto;margin:0;white-space:nowrap;border:1px solid currentColor;background:transparent;color:inherit;border-radius:6px;font-size:12px;line-height:1.2;padding:2px 6px;cursor:pointer;';
      }
    } else {
      gph.innerHTML = `${formatGph(item.gph)}&nbsp;GPH`;
    }

    chip.appendChild(icon);
    chip.appendChild(label);
    chip.appendChild(gph);
    if (rate) chip.appendChild(rate);
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
// Sponges (phase B) are listed by count: they are rated by tank size and have no flow or turnover.
function formatSummary(stats) {
  const spongeCount = stats.spongeCount ?? 0;
  const sponges = `${spongeCount} sponge filter${spongeCount === 1 ? '' : 's'} (rated by tank size)`;
  const flow = `${formatGph(stats.biologicalGph)} GPH • ${formatTurnover(stats.turnover)}×/h`;
  let base = `Filtration: ${flow}`;
  if (spongeCount > 0) {
    base = (stats.poweredCount ?? 0) > 0 ? `Filtration: ${flow} + ${sponges}` : `Filtration: ${sponges}`;
  }
  return stats.circulationGph > 0 ? `${base} (+${formatGph(stats.circulationGph)} GPH circulation only)` : base;
}

const SUMMARY_TITLE = 'Powered filters: rated flow through filter media (GPH) and turnover per hour. Sponge filters: checked by the manufacturer tank-size rating; no flow or turnover is estimated. Powerheads add circulation only. Filtration does not change Stocking Load.';

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
  const value = activeManualInput()?.value || '';
  const enabled = canAddManual(typeValue, value);
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
  const instanceIds = new Set();

  nextFilters.forEach((raw) => {
    // An explicitly unsupported capacity method never becomes a flow filter.
    if (!raw || hasUnsupportedCapacityMethod(raw)) return;
    const source = normalizeSource(raw.source);
    const inputType = raw.type ?? (source === FILTER_SOURCES.PRODUCT ? raw.type : 'HOB');
    const type = canonicalizeFilterType(inputType);
    // A sponge is kept with zero flow (it is rated by tank size); its stored GPH is never read.
    // Powered filters still need a positive GPH.
    const sponge = isSpongeFilter({ type });
    const gph = sponge ? 0 : clampGph(raw.gph ?? raw.rated_gph ?? raw.gphRated);
    if (!sponge && (!Number.isFinite(gph) || gph <= 0)) {
      return;
    }
    let id = typeof raw.id === 'string' && raw.id ? raw.id : null;
    if (!id) {
      id = `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const efficiencyType = resolveEfficiencyType(raw.efficiencyType ?? inputType);
    // Custom labels are generated, so a custom sponge's old "Sponge 120 GPH" label is replaced.
    const label = source !== FILTER_SOURCES.PRODUCT && sponge
      ? SPONGE_ITEM_LABEL
      : typeof raw.label === 'string' && raw.label
        ? raw.label
        : source === FILTER_SOURCES.PRODUCT
          ? raw.name ?? id
          : computeManualLabel(efficiencyType, gph);
    const key = `${source}:${id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    // Stable per-instance id, separate from the product id. The same product still can't be added
    // twice (the key above); repeated instances arrive in phase D.
    const fields = capacityFields(raw);
    const instanceId = fields.instanceId && !instanceIds.has(fields.instanceId)
      ? fields.instanceId
      : createInstanceId(instanceIds);
    instanceIds.add(instanceId);
    const productId = source === FILTER_SOURCES.PRODUCT ? id : fields.productId;
    sanitized.push({
      id,
      source,
      label,
      gph,
      type,
      efficiencyType,
      ...fields,
      instanceId,
      ...(productId ? { productId } : {}),
    });
  });

  state.filters = sanitized;
  render();
  applyFiltersToApp();
}

function createProductFilter(product) {
  if (!product || !product.id) return null;
  // A catalog sponge carries its catalog rating, never its legacy catalog GPH (phase B).
  if (isSpongeFilter({ type: canonicalizeFilterType(product.type ?? 'HOB') })) {
    return buildSpongeProductItem(product);
  }
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
    ...pickPassthroughFields(product),
    capacityMethod: resolveCapacityMethod(product),
    productId: product.id,
  };
}

function removeFilterById(id) {
  const targetId = typeof id === 'string' ? id : '';
  const next = state.filters.filter((item) => item.id !== targetId);
  setFilters(next);
  updateProductAddButton();
}

function newManualId() {
  return `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Custom sponge: "Rated for up to ___ gallons" (the manufacturer's tank-size rating), no GPH.
function addManualSponge(value) {
  const target = pendingRatingTargetId
    ? state.filters.find((item) => item.id === pendingRatingTargetId && needsCustomRating(item))
    : null;
  const sponge = buildCustomSpongeItem({ id: target?.id ?? newManualId(), ratedGallons: value });
  if (!sponge) {
    setManualNote(SPONGE_RATING_ERROR, { isError: true });
    return false;
  }
  if (refs.manualRatingInput) {
    refs.manualRatingInput.value = '';
    refs.manualRatingInput.removeAttribute('aria-invalid');
  }
  pendingRatingTargetId = '';
  setManualNote(defaultManualNote());
  if (target) {
    // Rating an old custom sponge replaces it in place (same chip, same instance).
    const rated = { ...sponge, instanceId: target.instanceId };
    setFilters(state.filters.map((item) => (item === target ? rated : item)));
  } else {
    setFilters(state.filters.concat([sponge]));
  }
  updateManualAddButton();
  refs.manualRatingInput?.focus({ preventScroll: true });
  return true;
}

function addManualFilter(typeValue, value) {
  if (isManualSpongeType(typeValue)) {
    return addManualSponge(value);
  }
  const efficiencyType = resolveEfficiencyType(typeValue);
  const canonicalType = canonicalizeFilterType(typeValue);
  const rated = clampGph(value);
  if (!canAddManual(typeValue, rated)) {
    setManualNote(FLOW_ERROR, { isError: true });
    return false;
  }
  const id = newManualId();
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
  if (!typeValue) {
    setManualNote(FLOW_ERROR, { isError: true });
    updateManualAddButton();
    return;
  }
  const value = activeManualInput()?.value?.trim() || '';
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
  // Sponges are offered on every tank (their legacy GPH-bucket range is ignored, phase B). The
  // fall-back to the whole catalog still depends on powered products only, as before.
  const filteredForTank = filterCatalogByTank(catalogItems, tankGallons);
  const matchCount = filteredForTank.length;
  const poweredMatches = filteredForTank.filter((item) => !isSpongeFilter(item)).length;
  const items = poweredMatches ? filteredForTank : catalogItems.slice();
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
      if (isSpongeFilter(item)) {
        // No GPH and no GPH-bucket range for a sponge: only its rating state.
        dataset.filterType = item.type;
        dataset.ratingStatus = spongeChipBadge(item) === 'Rating needed' ? 'needed' : 'verified';
        return { value: item.id, label: formatProductOption(item), dataset };
      }
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
  return readSavedFilters();
}

// Catalog metadata wins for a restored product; a capacity field the catalog doesn't define keeps
// the saved value. The instance keeps its saved instanceId. A catalog sponge takes its rating from
// the current catalog only (restoreSpongeItem): a saved rating or GPH is never trusted for it.
function restoreProductItem(product, entry) {
  if (isSpongeFilter({ type: canonicalizeFilterType(product?.type ?? 'HOB') })) {
    return restoreSpongeItem(entry, product);
  }
  const productItem = createProductFilter(product);
  if (!productItem) return null;
  const saved = pickPassthroughFields(entry);
  const fromCatalog = pickPassthroughFields(product);
  const merged = { ...productItem };
  ['manufacturerMaxGallons', 'manufacturerMinGallons', 'ratingStatus'].forEach((key) => {
    if (fromCatalog[key] === undefined && saved[key] !== undefined) {
      merged[key] = saved[key];
    }
  });
  if (typeof product.capacityMethod !== 'string' && saved.capacityMethod) {
    merged.capacityMethod = saved.capacityMethod;
  }
  if (saved.instanceId) {
    merged.instanceId = saved.instanceId;
  }
  return merged;
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
    if (hasUnsupportedCapacityMethod(entry)) {
      return;
    }
    const id = typeof entry?.id === 'string' && entry.id ? entry.id : null;
    const product = id ? findProductById(id) : null;
    // Type wins (phase B): a saved sponge is restored by rating, with or without a stored GPH, and
    // that GPH is never scored. A known catalog sponge takes the current catalog record.
    if (isSpongeFilter({ type: canonicalizeFilterType(entry?.type ?? 'HOB') })
      && (!product || isSpongeFilter({ type: canonicalizeFilterType(product.type ?? 'HOB') }))) {
      const item = restoreSpongeItem(entry, product);
      if (item) {
        if (!item.id) item.id = newManualId();
        next.push(item);
      }
      return;
    }
    const gph = clampGph(entry?.rated_gph ?? entry?.gphRated ?? entry?.gph);
    if (!gph) {
      return;
    }
    if (product) {
      const productItem = restoreProductItem(product, entry);
      if (productItem) {
        next.push(productItem);
      }
      return;
    }
    const type = canonicalizeFilterType(entry?.type ?? 'HOB');
    const efficiencyType = resolveEfficiencyType(entry?.kind ?? entry?.efficiencyType ?? entry?.type ?? 'HOB');
    // An id the catalog doesn't know (custom, or a product it can't resolve right now) keeps its
    // stored GPH, as before. A product id is kept so a later catalog load can still resolve it.
    const manual = {
      id: id ?? `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      source: FILTER_SOURCES.CUSTOM,
      label: computeManualLabel(efficiencyType, gph),
      gph,
      type,
      efficiencyType,
      ...capacityFields(entry),
    };
    next.push(manual);
  });
  setFilters(next);
}

// "Add rating" on an old custom sponge: switch the custom row to Sponge and focus the rating field;
// Add then gives that sponge its rating in place.
function startRatingEntry(id) {
  const target = state.filters.find((item) => item.id === id && needsCustomRating(item));
  if (!target || !refs.manualType) return;
  const spongeOption = Array.from(refs.manualType.options || []).find((option) => isManualSpongeType(option.value || option.textContent || ''));
  if (spongeOption) {
    refs.manualType.value = spongeOption.value;
  }
  syncManualFields();
  pendingRatingTargetId = target.id;
  setManualNote(`Enter the tank size this sponge is rated for, then Add custom. ${SPONGE_MANUAL_NOTE}`);
  updateManualAddButton();
  refs.manualRatingInput?.focus({ preventScroll: false });
}

function handleChipClick(event) {
  const rateButton = event.target.closest('[data-rate-filter]');
  if (rateButton) {
    startRatingEntry(rateButton.dataset.rateFilter || '');
    return;
  }
  const button = event.target.closest('[data-remove-filter]');
  if (!button) return;
  const id = button.dataset.removeFilter || '';
  removeFilterById(id);
}

function handleManualInput(input) {
  if (input?.value) {
    input.removeAttribute('aria-invalid');
    if (refs.manualNote) {
      refs.manualNote.textContent = pendingRatingTargetId && input === refs.manualRatingInput
        ? refs.manualNote.textContent
        : defaultManualNote();
    }
  }
  updateManualAddButton();
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
      handleManualInput(refs.manualInput);
    });
  }
  if (refs.manualRatingInput) {
    refs.manualRatingInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        tryAddCustom();
      }
    });
    refs.manualRatingInput.addEventListener('input', () => {
      handleManualInput(refs.manualRatingInput);
    });
  }
  if (refs.manualType) {
    let wasSponge = manualTypeIsSponge();
    refs.manualType.addEventListener('change', () => {
      // Switching between Sponge and a flow type swaps the field, clears the hidden one and resets
      // the note so its message matches the active field. Flow → flow keeps the previous behaviour.
      const isSponge = manualTypeIsSponge();
      syncManualFields();
      if (isSponge !== wasSponge || canAddManual(refs.manualType.value, activeManualInput()?.value)) {
        setManualNote(defaultManualNote());
      }
      wasSponge = isSponge;
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
  syncManualFields();
  updateCatalogDebug();
  await loadCatalog();
  hydrateFromAppState();
  attachEventListeners();
  render();
}

init().catch(() => {
  // Swallow initialization errors to avoid breaking the prototype experience.
});

