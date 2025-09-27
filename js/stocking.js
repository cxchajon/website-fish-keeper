import { createDefaultState, buildComputedState, runSanitySuite, runStressSuite, SPECIES, getDefaultSpeciesId } from './logic/compute.js';
import { computeEnv, renderEnvInto, renderWarningsInto } from './logic/envRecommend.js';
import { getTankVariants, describeVariant } from './logic/sizeMap.js';
import { debounce, getQueryFlag, roundCapacity, nowTimestamp, byCommonName } from './logic/utils.js';
import { renderConditions, renderBioloadBar, renderAggressionBar, renderStatus, renderChips, bindPopoverHandlers } from './logic/ui.js';

const state = createDefaultState();
let computed = null;
let variantSelectorOpen = false;
const debugMode = getQueryFlag('debug');

const refs = {
  pageTitle: document.getElementById('page-title'),
  plantIcon: document.getElementById('plant-icon'),
  gallons: document.getElementById('input-gallons'),
  planted: document.getElementById('toggle-planted'),
  tips: document.getElementById('toggle-tips'),
  tipsInline: document.getElementById('toggle-tips-inline'),
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
  bioloadFill: document.getElementById('bioload-fill'),
  bioloadGhost: document.getElementById('bioload-ghost'),
  bioloadText: document.getElementById('bioload-text'),
  aggFill: document.getElementById('agg-fill'),
  aggText: document.getElementById('agg-text'),
  statusStrip: document.getElementById('status-strip'),
  chipRow: document.getElementById('chip-row'),
  candidateChips: document.getElementById('candidate-chips'),
  candidateBanner: document.getElementById('candidate-banner'),
  speciesSelect: document.getElementById('plan-species'),
  qty: document.getElementById('plan-qty'),
  stage: document.getElementById('plan-stage'),
  addBtn: document.getElementById('plan-add'),
  stockList: document.getElementById('stock-list'),
  seeGear: document.getElementById('btn-gear'),
  diagnostics: document.getElementById('diagnostics'),
  diagnosticsContent: document.getElementById('diagnostics-content'),
  envReco: document.getElementById('env-reco'),
  warningsCard: document.getElementById('warnings-card'),
};

const supportedSpeciesIds = new Set(SPECIES.map((species) => species.id));
const speciesById = new Map(SPECIES.map((species) => [species.id, species]));
const warnedMarineIds = new Set();

// ---- Add-to-Stock button wiring ----
const elAdd = document.querySelector('#plan-add, .plan-add');
const elSpec = document.querySelector('#plan-species, .plan-species');
const elQty = document.querySelector('#plan-qty, .plan-qty');
const elStage = document.querySelector('#plan-stage, .plan-stage');

function getQty() {
  const n = parseInt(elQty?.value ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 1;
}

function getStageValue() {
  const raw = elStage?.value;
  return normalizeStage(raw, state.candidate?.stage ?? 'adult');
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
  const stage = getStageValue();
  if (state.beginnerMode && computed && computed.blockReasons.length > 0) {
    console.warn('[StockingAdvisor] Beginner safeguards block add:', computed.blockReasons.join(', '));
    return;
  }
  document.dispatchEvent(
    new CustomEvent('advisor:addCandidate', { detail: { species, qty, stage } })
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

// ---- Selected stock state & renderer ----
const SELECTED = new Map();

document.addEventListener('advisor:addCandidate', (event) => {
  const detail = event.detail ?? {};
  const species = detail.species;
  if (!species?.id || !speciesById.has(species.id)) {
    return;
  }
  const stage = normalizeStage(detail.stage, state.candidate?.stage ?? 'adult');
  const qty = sanitizeQty(detail.qty, state.candidate?.qty ?? 1);

  if (state.beginnerMode && computed && computed.blockReasons.length > 0) {
    console.warn('[StockingAdvisor] Beginner safeguards block add:', computed.blockReasons.join(', '));
    return;
  }

  const existing = state.stock.find(
    (entry) => entry.id === species.id && normalizeStage(entry.stage, 'adult') === stage
  );
  if (existing) {
    const combined = (Number(existing.qty) || 0) + qty;
    existing.qty = sanitizeQty(combined, qty);
  } else {
    state.stock.push({ id: species.id, qty, stage });
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
    stage,
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
  if (refs.stage) {
    refs.stage.value = stage;
  }

  syncSelectedFromState();
  console.log('[StockingAdvisor] Added:', species.id, 'x', qty, 'stage:', stage);
  scheduleUpdate();
});

document.addEventListener('advisor:removeCandidate', (event) => {
  const id = event.detail?.id;
  if (!id) {
    return;
  }
  const stage = normalizeStage(event.detail?.stage, 'adult');
  state.stock = state.stock.filter(
    (entry) => !(entry.id === id && normalizeStage(entry.stage, 'adult') === stage)
  );
  syncSelectedFromState();
  console.log('[StockingAdvisor] Removed:', id, 'stage:', stage);
  scheduleUpdate();
});

document.addEventListener('DOMContentLoaded', () => {
  syncSelectedFromState();
});

function syncSelectedFromState() {
  SELECTED.clear();
  if (!Array.isArray(state.stock)) {
    renderStockList();
    return;
  }
  for (const entry of state.stock) {
    if (!entry?.id) continue;
    const species = speciesById.get(entry.id);
    if (!species) continue;
    const stage = normalizeStage(entry.stage, 'adult');
    const qty = sanitizeQty(entry.qty, 1);
    entry.qty = qty;
    entry.stage = stage;
    const key = `${species.id}::${stage}`;
    const current = SELECTED.get(key);
    const nextQty = (current?.qty || 0) + qty;
    SELECTED.set(key, { species, qty: nextQty, stage });
  }
  renderStockList();
}

function renderStockList() {
  const root = document.querySelector('#stock-list');
  if (!root) return;
  if (SELECTED.size === 0) {
    root.innerHTML = `<div class="stock-empty subtle">No stock yet. Add species to begin.</div>`;
    return;
  }
  const rows = [];
  for (const { species, qty, stage } of SELECTED.values()) {
    rows.push(stockRow(species, qty, stage));
  }
  root.innerHTML = rows.join('');
  root.querySelectorAll('[data-remove-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const removeId = button.getAttribute('data-remove-id');
      const removeStage = button.getAttribute('data-remove-stage') || 'adult';
      document.dispatchEvent(
        new CustomEvent('advisor:removeCandidate', { detail: { id: removeId, stage: removeStage } })
      );
    });
  });
}

function stockRow(species, qty, stage) {
  const name = escapeHtml(species.common_name || species.id);
  const id = escapeHtml(species.id);
  const stageLabel = stage === 'juvenile' ? 'Juvenile' : 'Adult';
  const qtyLabel = `Qty: ${qty}`;
  const stageSuffix = stage === 'adult' ? '' : ` (${stageLabel})`;
  return `
    <div class="stock-entry">
      <div class="stock-entry__name">${name}</div>
      <div class="stock-entry__meta">${qtyLabel}${stageSuffix}</div>
      <button class="stock-entry__remove" data-remove-id="${id}" data-remove-stage="${escapeHtml(stage)}" aria-label="Remove ${name}">Remove</button>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function sanitizeQty(value, fallback = 1) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(999, Math.max(1, parsed));
}

function normalizeStage(stage, fallback = 'adult') {
  return stage === 'juvenile' ? 'juvenile' : stage === 'adult' ? 'adult' : fallback;
}

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
    state.candidate = { id: getDefaultSpeciesId(), qty: 1, stage: 'adult' };
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

function updateToggle(button, value) {
  if (!button) return;
  button.dataset.active = value ? 'true' : 'false';
  button.setAttribute('aria-checked', value ? 'true' : 'false');
  const label = button.querySelector('span:last-of-type');
  if (label) {
    label.textContent = value ? 'On' : 'Off';
  }
}

function syncStateFromInputs() {
  state.gallons = Number(refs.gallons.value) || state.gallons;
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
    toggle.addEventListener('click', () => {
      variantSelectorOpen = !variantSelectorOpen;
      renderTankSummaryView();
    });
    text.append(' ');
    text.appendChild(toggle);

    if (variantSelectorOpen) {
      const selector = document.createElement('div');
      selector.className = 'variant-selector';
      for (const option of variants) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = describeVariant(option);
        button.dataset.active = option.id === computed.tank.variant?.id ? 'true' : 'false';
        button.addEventListener('click', () => {
          state.variantId = option.id;
          variantSelectorOpen = false;
          scheduleUpdate();
        });
        selector.appendChild(button);
      }
      container.appendChild(selector);
    }
  }

  refs.tankSummary.appendChild(container);
}

function syncToggles() {
  updateToggle(refs.planted, state.planted);
  updateToggle(refs.tips, state.showTips);
  updateToggle(refs.beginner, state.beginnerMode);
  updateToggle(refs.blackwater, state.water.blackwater);
  refs.tipsInline.textContent = state.showTips ? 'Hide Tips' : 'Show More Tips';
  refs.plantIcon.style.display = state.planted ? 'inline-flex' : 'none';
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
  if (!debugMode) return;
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
  refs.diagnosticsContent.innerHTML = `<ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul>`;
  console.groupCollapsed('[Stocking] Diagnostics');
  computed.diagnostics.forEach((line) => console.log(line));
  sanity.forEach((line) => console.log(line));
  stress.forEach((line) => console.log(line));
  console.groupEnd();
}

function renderAll() {
  computed = buildComputedState(state);
  renderTankSummaryView();
  renderConditions(refs.conditions, computed.conditions.conditions);
  renderBioloadBar(refs.bioloadFill, refs.bioloadGhost, refs.bioloadText, computed.bioload);
  renderAggressionBar(refs.aggFill, refs.aggText, computed.aggression);
  renderStatus(refs.statusStrip, computed.status);
  renderChips(refs.chipRow, buildStatusChips());
  renderCandidateState();
  syncSelectedFromState();
  renderDiagnostics();
  renderEnvironmentPanels();
}

function buildStatusChips() {
  if (!computed) return [];
  const chips = [];
  if (computed.bioload.severity !== 'ok') {
    chips.push({ tone: computed.bioload.severity === 'bad' ? 'bad' : 'warn', text: computed.bioload.text });
  }
  if (computed.aggression.severity !== 'ok') {
    chips.push({ tone: computed.aggression.severity === 'bad' ? 'bad' : 'warn', text: computed.aggression.label });
  }
  const condition = computed.conditions.conditions.find((item) => item.severity !== 'ok');
  if (condition) {
    chips.push({ tone: condition.severity === 'bad' ? 'bad' : 'warn', text: `${condition.label}: ${condition.hint}` });
  }
  return chips;
}

function renderEnvironmentPanels() {
  if (!computed) return;
  const envEl = refs.envReco;
  const warnEl = refs.warningsCard;
  if (!envEl || !warnEl) return;
  const speciesList = computed.entries.map((entry) => entry.species);
  const env = computeEnv({ speciesList, planted: state.planted });
  renderEnvInto(envEl, env);
  renderWarningsInto(warnEl, env);
  if (env.rows?.temperature?.setpoint) {
    state.water.temperature = env.rows.temperature.setpoint;
  }
}

const scheduleUpdate = debounce(() => {
  syncStateFromInputs();
  pruneMarineEntries();
  renderAll();
});

function bindInputs() {
  refs.gallons.addEventListener('input', scheduleUpdate);
  if (refs.turnover) refs.turnover.addEventListener('input', scheduleUpdate);
  if (refs.temp) refs.temp.addEventListener('input', scheduleUpdate);
  if (refs.ph) refs.ph.addEventListener('input', scheduleUpdate);
  if (refs.gh) refs.gh.addEventListener('input', scheduleUpdate);
  if (refs.kh) refs.kh.addEventListener('input', scheduleUpdate);
  if (refs.salinity) refs.salinity.addEventListener('change', scheduleUpdate);
  if (refs.flow) refs.flow.addEventListener('change', scheduleUpdate);

  refs.planted.addEventListener('click', () => {
    state.planted = !state.planted;
    syncToggles();
    scheduleUpdate();
  });

  refs.tips.addEventListener('click', () => {
    state.showTips = !state.showTips;
    syncToggles();
    scheduleUpdate();
  });
  refs.tipsInline.addEventListener('click', () => {
    state.showTips = !state.showTips;
    syncToggles();
    scheduleUpdate();
  });

  refs.beginner.addEventListener('click', () => {
    state.beginnerMode = !state.beginnerMode;
    syncToggles();
    scheduleUpdate();
  });

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

  refs.stage.addEventListener('change', () => {
    const stage = normalizeStage(refs.stage.value, state.candidate?.stage ?? 'adult');
    state.candidate.stage = stage;
    refs.stage.value = stage;
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
  refs.qty.value = String(state.candidate.qty);
  syncToggles();
  bindInputs();
  syncStateFromInputs();
  renderAll();
}

init();
