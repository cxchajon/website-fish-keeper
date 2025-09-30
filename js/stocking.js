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
    envInfoToggle: document.getElementById('env-info-toggle'),
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
    envTips: document.getElementById('env-more-tips'),
  };

  let envTipsInitialized = false;
  let envTipsHideTimer = null;
  const envTipsFrame = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (fn) => setTimeout(fn, 0);
  const envTipsTimeout = typeof window !== 'undefined' && typeof window.setTimeout === 'function'
    ? window.setTimeout.bind(window)
    : (fn, ms) => setTimeout(fn, ms);

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

  function applyEnvTipsState(open, { animate = true } = {}) {
    if (envTipsHideTimer) {
      clearTimeout(envTipsHideTimer);
      envTipsHideTimer = null;
    }
    const panel = refs.envTips;
    if (!panel) {
      if (refs.envInfoToggle) {
        refs.envInfoToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      return;
    }
    if (open) {
      panel.hidden = false;
      const activate = () => panel.classList.add('is-open');
      if (animate) {
        envTipsFrame(activate);
      } else {
        activate();
      }
    } else {
      panel.classList.remove('is-open');
      if (animate) {
        envTipsHideTimer = envTipsTimeout(() => {
          if (!state.showTips && refs.envTips) {
            refs.envTips.hidden = true;
          }
          envTipsHideTimer = null;
        }, 180);
      } else {
        panel.hidden = true;
      }
    }
    if (refs.envInfoToggle) {
      refs.envInfoToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
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
  if (!computed) {
    return;
  }
  const container = document.createElement('div');
  container.className = 'tank-summary';
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
  updateToggle(refs.blackwater, state.water.blackwater);
  if (refs.envTips || refs.envInfoToggle) {
    applyEnvTipsState(state.showTips, { animate: envTipsInitialized });
    envTipsInitialized = true;
  }
  if (refs.plantIcon) {
    refs.plantIcon.style.display = state.planted ? 'inline-flex' : 'none';
  }
}

function renderCandidateState() {
  if (!computed) return;
  renderChips(refs.candidateChips, computed.chips);
  refs.addBtn.disabled = false;
  refs.candidateBanner.style.display = 'none';
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
    renderEnvCard({ stock: [], stockCount: 0, computed: null });
    return;
  }
  renderEnvCard({
    stock: currentStockArray(),
    stockCount: computed?.stockCount ?? 0,
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

  const envInfoBtn = refs.envInfoToggle;
  const envTipsPane = refs.envTips;

  if (envInfoBtn && envTipsPane) {
    const scheduleMicrotask = typeof queueMicrotask === 'function'
      ? queueMicrotask
      : (fn) => Promise.resolve().then(fn);
    let infoShownOnce = false;
    let forwardingSynthetic = false;

    function showGenericPopover(anchor, text) {
      const prev = anchor.getAttribute('data-info');
      const message = text || prev || 'Additional information.';
      if (message !== prev) {
        anchor.setAttribute('data-info', message);
      }
      forwardingSynthetic = true;
      anchor.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
      );
      scheduleMicrotask(() => {
        forwardingSynthetic = false;
        if (message !== prev) {
          if (prev == null) {
            anchor.removeAttribute('data-info');
          } else {
            anchor.setAttribute('data-info', prev);
          }
        }
      });
    }

    function showFallbackPopover(anchor, text) {
      const pop = document.createElement('div');
      pop.style.position = 'fixed';
      pop.style.zIndex = '2147483647';
      pop.style.maxWidth = '320px';
      pop.style.padding = '10px 12px';
      pop.style.borderRadius = '10px';
      pop.style.background = 'rgba(20,22,25,.96)';
      pop.style.border = '1px solid rgba(255,255,255,.12)';
      pop.style.boxShadow = '0 10px 30px rgba(0,0,0,.35)';
      pop.style.fontSize = '13px';
      pop.style.color = 'inherit';
      pop.textContent = text || 'Additional information.';
      document.body.appendChild(pop);

      const rect = anchor.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, rect.left));
      const top = Math.max(8, Math.min(window.innerHeight - pop.offsetHeight - 8, rect.bottom + 8));
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;

      envTipsTimeout(() => {
        pop.remove();
      }, 2200);
    }

    function showInfoFirst() {
      const message = envInfoBtn.getAttribute('data-info') ||
        'Derived from your selected stock. Ranges reflect compatible overlaps across all species.';
      showGenericPopover(envInfoBtn, message);
      envTipsTimeout(() => {
        const openPopover = document.querySelector('.ttg-popover.is-open');
        if (!openPopover) {
          showFallbackPopover(envInfoBtn, message);
        }
      }, 20);
    }

    envInfoBtn.addEventListener('click', (event) => {
      if (forwardingSynthetic) {
        forwardingSynthetic = false;
        return;
      }
      event.preventDefault();
      if (!infoShownOnce) {
        infoShownOnce = true;
        showInfoFirst();
        return;
      }
      state.showTips = !state.showTips;
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

(function infoPopovers(){
  const page = document.getElementById('stocking-page');
  if(!page) return;

  let portal = document.getElementById('ui-portal');
  if(!portal){
    portal = document.createElement('div');
    portal.id = 'ui-portal';
    portal.style.position = 'static';
    portal.style.isolation = 'auto';
    document.body.appendChild(portal);
  }

  const pop = document.createElement('div');
  pop.className = 'ttg-popover';
  pop.setAttribute('role','dialog');
  pop.setAttribute('aria-modal','false');
  pop.hidden = true;
  pop.innerHTML = `
    <h3 id="ttg-popover-title">Info</h3>
    <p id="ttg-popover-text"></p>
    <button type="button" class="close" aria-label="Close">OK</button>
  `;
  portal.appendChild(pop);
  const titleEl = pop.querySelector('#ttg-popover-title');
  const textEl  = pop.querySelector('#ttg-popover-text');
  const closeEl = pop.querySelector('.close');

  let currentBtn = null;

  function offsets(){
    const vv = window.visualViewport;
    return {
      x: vv && 'pageLeft' in vv ? vv.pageLeft : (window.pageXOffset || document.documentElement.scrollLeft || 0),
      y: vv && 'pageTop'  in vv ? vv.pageTop  : (window.pageYOffset || document.documentElement.scrollTop  || 0),
    };
  }

  function placeUnder(el){
    const target = el.closest('label') || el;
    const r = target.getBoundingClientRect();
    const wasHidden = pop.hidden;
    if (wasHidden) pop.hidden = false;
    pop.style.visibility = 'hidden';

    const pw = pop.offsetWidth || 280;
    const ph = pop.offsetHeight || 140;
    const gap = 8;
    const { x:sx, y:sy } = offsets();

    let left = Math.round(r.left + sx);
    let top  = Math.round(r.bottom + sy + gap);
    left = Math.min(Math.max(8 + sx, left), (window.innerWidth - pw - 8) + sx);
    top  = Math.min(Math.max(8 + sy, top),  (window.innerHeight - ph - 8) + sy);

    pop.style.left = `${left}px`;
    pop.style.top  = `${top}px`;

    pop.style.visibility = '';
    pop.hidden = wasHidden;
  }

  function openFor(btn){
    currentBtn = btn;
    const info = btn.getAttribute('data-info') || 'Additional information.';
    titleEl.textContent = 'Info';
    textEl.textContent  = info;

    if (btn.closest('#bioagg-card')) pop.dataset.bioagg = '1';
    else delete pop.dataset.bioagg;

    placeUnder(btn);
    pop.hidden = false;
    requestAnimationFrame(()=> pop.classList.add('is-open'));

    document.addEventListener('mousedown', onDoc, { capture:true });
    document.addEventListener('touchstart', onDoc, { capture:true });
    document.addEventListener('keydown', onEsc, { capture:true });

    window.addEventListener('scroll', onReflow, { passive:true });
    window.addEventListener('resize', onReflow, { passive:true });
    window.visualViewport?.addEventListener?.('scroll', onReflow, { passive:true });
    window.visualViewport?.addEventListener?.('resize', onReflow, { passive:true });
  }

  function closePop(){
    pop.classList.remove('is-open');
    setTimeout(()=>{ pop.hidden = true; }, 140);
    delete pop.dataset.bioagg;
    currentBtn = null;

    document.removeEventListener('mousedown', onDoc, { capture:true });
    document.removeEventListener('touchstart', onDoc, { capture:true });
    document.removeEventListener('keydown', onEsc, { capture:true });

    window.removeEventListener('scroll', onReflow);
    window.removeEventListener('resize', onReflow);
    window.visualViewport?.removeEventListener?.('scroll', onReflow);
    window.visualViewport?.removeEventListener?.('resize', onReflow);
  }

  function onDoc(e){ if (!pop.contains(e.target) && e.target !== currentBtn) closePop(); }
  function onEsc(e){ if (e.key === 'Escape') closePop(); }
  function onReflow(){ if (!pop.hidden && currentBtn) placeUnder(currentBtn); }

  page.addEventListener('click', (e)=>{
    const btn = e.target.closest('.info-btn');
    if(!btn) return;
    e.preventDefault();
    if(pop.hidden || currentBtn !== btn) openFor(btn);
    else closePop();
  });
  closeEl.addEventListener('click', closePop);
})();

(function compactBioAggController(){
  function getCard(){
    return document.getElementById('bioagg-card');
  }

  function infoVisible(card){
    if (!card) return false;
    const openPop = document.querySelector('.ttg-popover.is-open[data-bioagg="1"]');
    if (openPop) return true;

    const activeEl = document.activeElement;
    if (activeEl && card.contains(activeEl) && activeEl.classList.contains('info-btn')) {
      return true;
    }

    const expanded = card.querySelector('[aria-expanded="true"]');
    if (expanded) return true;

    return false;
  }

  function update(){
    const card = getCard();
    if (!card) return;
    if (infoVisible(card)) {
      card.classList.remove('is-compact');
    } else {
      card.classList.add('is-compact');
    }
  }

  document.addEventListener('click', ()=> setTimeout(update, 0), true);
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') setTimeout(update, 0);
  }, true);
  window.addEventListener('resize', ()=> setTimeout(update, 0));
  window.visualViewport?.addEventListener?.('resize', ()=> setTimeout(update, 0));
  window.visualViewport?.addEventListener?.('scroll', ()=> setTimeout(update, 0));

  const envBars = document.getElementById('env-bars');
  if (envBars) {
    const observer = new MutationObserver(()=> setTimeout(update, 0));
    observer.observe(envBars, { childList: true });
  }

  update();
})();
