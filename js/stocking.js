import { createDefaultState, buildComputedState, runSanitySuite, runStressSuite, SPECIES, getDefaultSpeciesId } from './logic/compute.js';
import { renderEnvCard } from './logic/envRecommend.js';
import { getTankVariants, describeVariant } from './logic/sizeMap.js';
import { debounce, getQueryFlag, roundCapacity, nowTimestamp, byCommonName } from './logic/utils.js';
import { renderConditions, renderChips, bindPopoverHandlers } from './logic/ui.js';

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
  let computed = null;
  let variantSelectorOpen = false;
  let shouldRestoreVariantFocus = false;
  const debugMode = getQueryFlag('debug');

  const refs = {
    pageTitle: document.getElementById('page-title'),
    plantIcon: document.getElementById('plant-icon'),
    planted: document.getElementById('toggle-planted'),
    tips: document.getElementById('toggle-tips'),
    tipsInline: document.getElementById('env-tips-toggle'),
    beginner: document.getElementById('toggle-beginner'),
    blackwater: document.getElementById('toggle-blackwater'),
    turnover: document.getElementById('input-turnover'),
    temp: document.getElementById('input-temp'),
    ph: document.getElementById('input-ph'),
    gh: document.getElementById('input-gh'),
    kh: document.getElementById('input-kh'),
    salinity: document.getElementById('select-salinity'),
    flow: document.getElementById('select-flow'),
    tankSummary: document.getElementById('tank-summary'),
    conditions: document.getElementById('conditions-list'),
    candidateChips: document.getElementById('candidate-chips'),
    candidateBanner: document.getElementById('candidate-banner'),
    speciesSelect: document.getElementById('plan-species'),
    qty: document.getElementById('plan-qty'),
    addBtn: document.getElementById('plan-add'),
    stockList: document.getElementById('stock-list'),
    seeGear: document.getElementById('btn-gear'),
    diagnostics: document.getElementById('diagnostics'),
    diagnosticsContent: document.getElementById('diagnostics-content'),
    envReco: document.getElementById('env-reco'),
    envTips: document.getElementById('env-tips'),
  };

const supportedSpeciesIds = new Set(SPECIES.map((species) => species.id));
const speciesById = new Map(SPECIES.map((species) => [species.id, species]));
const warnedMarineIds = new Set();

// ---- Add-to-Stock button wiring ----
const elAdd = document.querySelector('#plan-add, .plan-add');
const elSpec = document.querySelector('#plan-species, .plan-species');
const elQty = document.querySelector('#plan-qty, .plan-qty');

function getQty() {
  const n = parseInt(elQty?.value ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 1;
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
  if (state.beginnerMode && computed && computed.blockReasons.length > 0) {
    console.warn('[StockingAdvisor] Beginner safeguards block add:', computed.blockReasons.join(', '));
    return;
  }
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
}

function syncStateFromStock() {
  state.stock = Array.from(STOCK.values()).map(({ species, qty }) => ({
    id: species.id,
    qty: sanitizeQty(qty, 1),
  }));
  scheduleUpdate();
}

document.addEventListener('advisor:addCandidate', (event) => {
  const detail = event.detail ?? {};
  const species = detail.species;
  if (!species?.id || !speciesById.has(species.id)) {
    return;
  }
  const qty = sanitizeQty(detail.qty, state.candidate?.qty ?? 1);

  if (state.beginnerMode && computed && computed.blockReasons.length > 0) {
    console.warn('[StockingAdvisor] Beginner safeguards block add:', computed.blockReasons.join(', '));
    return;
  }

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
    qty: 1,
  };

  if (refs.speciesSelect) {
    if (normalizedFirst) {
      refs.speciesSelect.selectedIndex = 0;
    } else {
      refs.speciesSelect.value = nextId;
    }
  }
  if (refs.qty) {
    refs.qty.value = '1';
  }

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
    state.candidate = { id: getDefaultSpeciesId(), qty: 1 };
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
  }
}

function updateToggle(control, value) {
  if (!control) return;
  const active = Boolean(value);
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    control.checked = active;
    control.setAttribute('data-active', active ? 'true' : 'false');
    control.setAttribute('aria-checked', active ? 'true' : 'false');
    const wrapper = control.closest('.switch');
    if (wrapper) {
      wrapper.setAttribute('data-active', active ? 'true' : 'false');
      wrapper.setAttribute('aria-checked', active ? 'true' : 'false');
    }
    return;
  }
  control.dataset.active = active ? 'true' : 'false';
  control.setAttribute('aria-checked', active ? 'true' : 'false');
  const label = control.querySelector('span:last-of-type');
  if (label) {
    label.textContent = active ? 'On' : 'Off';
  }
}

function syncStateFromInputs() {
  if (refs.turnover) {
    state.turnover = Number(refs.turnover.value) || state.turnover;
  }
  if (refs.temp) {
    state.water.temperature = Number(refs.temp.value) || state.water.temperature;
  }
  if (refs.ph) {
    state.water.pH = Number(refs.ph.value) || state.water.pH;
  }
  if (refs.gh) {
    state.water.gH = Number(refs.gh.value) || state.water.gH;
  }
  if (refs.kh) {
    state.water.kH = Number(refs.kh.value) || state.water.kH;
  }
  if (refs.salinity) {
    state.water.salinity = refs.salinity.value;
  }
  if (refs.flow) {
    state.water.flow = refs.flow.value;
  }
  if (state.variantId) {
    const valid = getTankVariants(state.gallons).some((variant) => variant.id === state.variantId);
    if (!valid) {
      state.variantId = null;
    }
  }
}

function populateSpecies() {
  refs.speciesSelect.innerHTML = '';
  const options = SPECIES.filter((species) => species.salinity !== 'marine').slice().sort(byCommonName);
  for (const species of options) {
    const option = document.createElement('option');
    option.value = species.id;
    option.textContent = species.common_name;
    refs.speciesSelect.appendChild(option);
  }
  if (state.candidate?.id) {
    refs.speciesSelect.value = state.candidate.id;
  }
}

function renderTankSummaryView() {
  refs.tankSummary.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'tank-summary';
  if (!computed) {
    const text = document.createElement('p');
    text.className = 'subtle';
    text.textContent = 'Select a tank size to unlock recommendations.';
    container.appendChild(text);
    refs.tankSummary.appendChild(container);
    return;
  }
  const variant = computed.tank.variant;
  const dims = variant ? `${variant.length}″×${variant.width}″×${variant.height}″` : '—';
  const text = document.createElement('p');
  const assumed = variant ? `${variant.name} (${dims})` : 'custom footprint';
  text.innerHTML = `Tank: ${computed.tank.gallons} gal — assumed: ${assumed}. Best fit for your current species.`;
  container.appendChild(text);

  const variants = getTankVariants(computed.tank.gallons);
  if (variants.length <= 1) {
    variantSelectorOpen = false;
  }
  if (variants.length > 1) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'link-like';
    toggle.textContent = variantSelectorOpen ? 'Close' : 'Change';
    toggle.dataset.testid = 'variant-toggle';
    toggle.addEventListener('click', () => {
      variantSelectorOpen = !variantSelectorOpen;
      renderTankSummaryView();
    });
    text.append(' ');
    text.appendChild(toggle);

    if (variantSelectorOpen) {
      const selector = document.createElement('div');
      selector.className = 'variant-selector';
      selector.dataset.testid = 'variant-selector';
      for (const option of variants) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = describeVariant(option);
        button.dataset.active = option.id === computed.tank.variant?.id ? 'true' : 'false';
        button.dataset.testid = 'variant-option';
        button.addEventListener('click', () => {
          state.variantId = option.id;
          variantSelectorOpen = false;
          shouldRestoreVariantFocus = true;
          scheduleUpdate();
        });
        selector.appendChild(button);
      }
      container.appendChild(selector);
    }

    if (shouldRestoreVariantFocus) {
      queueMicrotask(() => {
        toggle.focus();
        shouldRestoreVariantFocus = false;
      });
    }
  }

  refs.tankSummary.appendChild(container);
}

function syncToggles() {
  updateToggle(refs.planted, state.planted);
  if (refs.tips) {
    updateToggle(refs.tips, state.showTips);
  }
  updateToggle(refs.beginner, state.beginnerMode);
  updateToggle(refs.blackwater, state.water.blackwater);
  if (refs.tipsInline) {
    refs.tipsInline.textContent = state.showTips ? 'Hide Tips' : 'Show More Tips';
    refs.tipsInline.setAttribute('aria-pressed', state.showTips ? 'true' : 'false');
  }
  if (refs.envTips) {
    if (state.showTips) {
      refs.envTips.removeAttribute('hidden');
    } else {
      refs.envTips.setAttribute('hidden', '');
    }
  }
  if (refs.plantIcon) {
    refs.plantIcon.style.display = state.planted ? 'inline-flex' : 'none';
  }
}

function renderCandidateState() {
  if (!computed) return;
  renderChips(refs.candidateChips, computed.chips);
  const blocked = state.beginnerMode && computed.blockReasons.length > 0;
  refs.addBtn.disabled = blocked;
  if (blocked) {
    refs.candidateBanner.style.display = 'flex';
    refs.candidateBanner.textContent = `Beginner safeguards: ${computed.blockReasons.join('; ')}`;
  } else {
    refs.candidateBanner.style.display = 'none';
  }
}

function renderDiagnostics() {
  if (!debugMode || !refs.diagnostics) return;
  if (!computed) {
    refs.diagnostics.hidden = true;
    if (refs.diagnosticsContent) {
      refs.diagnosticsContent.innerHTML = '';
    }
    return;
  }
  refs.diagnostics.hidden = false;
  const sanity = runSanitySuite(state);
  const stress = runStressSuite(state);
  const lines = [
    '<strong>Live Snapshot</strong>',
    ...computed.diagnostics.map((line) => `<span>${line}</span>`),
    '<strong>Sanity Tests</strong>',
    ...sanity.map((line) => `<span>${line}</span>`),
    '<strong>Stress Tests</strong>',
    ...stress.map((line) => `<span>${line}</span>`),
  ];
  if (refs.diagnosticsContent) {
    refs.diagnosticsContent.innerHTML = `<ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul>`;
  }
  console.groupCollapsed('[Stocking] Diagnostics');
  computed.diagnostics.forEach((line) => console.log(line));
  sanity.forEach((line) => console.log(line));
  stress.forEach((line) => console.log(line));
  console.groupEnd();
}

function renderAll() {
  if (!state.gallons) {
    computed = null;
    renderTankSummaryView();
    if (refs.conditions) {
      refs.conditions.innerHTML = '';
    }
    renderCandidateState();
    syncStockFromState();
    renderDiagnostics();
    renderEnvironmentPanels();
    return;
  }
  computed = buildComputedState(state);
  renderTankSummaryView();
  if (refs.conditions) {
    renderConditions(refs.conditions, computed.conditions.conditions);
  }
  renderCandidateState();
  syncStockFromState();
  renderDiagnostics();
  renderEnvironmentPanels();
}

function renderEnvironmentPanels() {
  if (!computed) {
    renderEnvCard({ stock: [], stockCount: 0, beginner: state.beginnerMode, computed: null });
    return;
  }
  renderEnvCard({
    stock: currentStockArray(),
    stockCount: computed?.stockCount ?? 0,
    beginner: state.beginnerMode,
    computed,
  });
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

window.recomputeAll = (options = {}) => {
  const opts = typeof options === 'object' && options !== null ? options : {};
  runRecompute({ skipInputSync: true, ...opts });
};

window.addEventListener('ttg:recompute', () => {
  runRecompute({ skipInputSync: true });
});

const tipsBtn = document.querySelector('#env-tips-toggle');
const tipsPane = document.querySelector('#env-tips');

if (tipsBtn && tipsPane) {
  tipsBtn.addEventListener('click', () => {
    const open = !tipsPane.hasAttribute('hidden');
    if (open) {
      tipsPane.setAttribute('hidden', '');
      tipsBtn.setAttribute('aria-pressed', 'false');
      tipsBtn.textContent = 'Show More Tips';
    } else {
      tipsPane.removeAttribute('hidden');
      tipsBtn.setAttribute('aria-pressed', 'true');
      tipsBtn.textContent = 'Hide Tips';
    }
    state.showTips = !open;
    syncToggles();
  });
}

function bindInputs() {
  if (refs.turnover) refs.turnover.addEventListener('input', scheduleUpdate);
  if (refs.temp) refs.temp.addEventListener('input', scheduleUpdate);
  if (refs.ph) refs.ph.addEventListener('input', scheduleUpdate);
  if (refs.gh) refs.gh.addEventListener('input', scheduleUpdate);
  if (refs.kh) refs.kh.addEventListener('input', scheduleUpdate);
  if (refs.salinity) refs.salinity.addEventListener('change', scheduleUpdate);
  if (refs.flow) refs.flow.addEventListener('change', scheduleUpdate);

  if (refs.planted) {
    refs.planted.addEventListener('change', () => {
      state.planted = Boolean(refs.planted.checked);
      syncToggles();
      scheduleUpdate();
    });
  }

  if (refs.tips) {
    refs.tips.addEventListener('click', () => {
      state.showTips = !state.showTips;
      syncToggles();
      scheduleUpdate();
    });
  }

  if (refs.beginner) {
    const handleBeginnerChange = () => {
      const next = refs.beginner instanceof HTMLInputElement ? refs.beginner.checked : !state.beginnerMode;
      state.beginnerMode = Boolean(next);
      syncToggles();
      scheduleUpdate();
    };
    if (refs.beginner instanceof HTMLInputElement) {
      refs.beginner.addEventListener('change', handleBeginnerChange);
    } else {
      refs.beginner.addEventListener('click', handleBeginnerChange);
    }
  }

  if (refs.blackwater) {
    refs.blackwater.addEventListener('click', () => {
      state.water.blackwater = !state.water.blackwater;
      syncToggles();
      scheduleUpdate();
    });
  }

  refs.speciesSelect.addEventListener('change', () => {
    state.candidate.id = refs.speciesSelect.value;
    scheduleUpdate();
  });

  refs.qty.addEventListener('input', () => {
    const qty = sanitizeQty(refs.qty.value, state.candidate?.qty ?? 1);
    state.candidate.qty = qty;
    refs.qty.value = String(qty);
    scheduleUpdate();
  });

  refs.seeGear.addEventListener('click', () => {
    if (!computed) return;
    const payload = buildGearPayload();
    sessionStorage.setItem('ttg_stocking_state', JSON.stringify(payload));
    window.location.href = '/gear.html';
  });
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
    heater: {
      temp_target_F: state.water.temperature,
      ambient_F: null,
      has_lid: true,
      watts_recommended: watts,
      watts_range: [Math.max(25, Math.round(watts * 0.8)), Math.round(watts * 1.2)],
    },
    flags: {
      beginner_mode: state.beginnerMode,
      heavy_stock: bioload.proposedPercent > 0.9,
      low_flow_species: computed.entries.some((entry) => entry.species.flow === 'low'),
    },
  };
}

  function init() {
    bindPopoverHandlers(document.body);
    pruneMarineEntries();
    populateSpecies();
    if (refs.qty) {
      refs.qty.value = String(state.candidate.qty);
    }
    syncToggles();
    bindInputs();
    runRecompute({ skipInputSync: true });
  }

  init();
}

bootstrapStocking();
