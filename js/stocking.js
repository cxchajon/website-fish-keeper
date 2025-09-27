import { createDefaultState, buildComputedState, runSanitySuite, runStressSuite, SPECIES, getDefaultSpeciesId } from './logic/compute.js';
import { getTankVariants, describeVariant } from './logic/sizeMap.js';
import { debounce, getQueryFlag, roundCapacity, nowTimestamp, byCommonName } from './logic/utils.js';
import { renderConditions, renderBioloadBar, renderAggressionBar, renderStatus, renderChips, renderStockList, bindPopoverHandlers } from './logic/ui.js';

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
  speciesSelect: document.getElementById('select-species'),
  qty: document.getElementById('input-qty'),
  stage: document.getElementById('input-stage'),
  addBtn: document.getElementById('btn-add'),
  stockList: document.getElementById('stock-list'),
  seeGear: document.getElementById('btn-gear'),
  diagnostics: document.getElementById('diagnostics'),
  diagnosticsContent: document.getElementById('diagnostics-content'),
};

const supportedSpeciesIds = new Set(SPECIES.map((species) => species.id));
const warnedMarineIds = new Set();

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
  button.dataset.active = value ? 'true' : 'false';
  button.setAttribute('aria-checked', value ? 'true' : 'false');
  const label = button.querySelector('span:last-of-type');
  if (label) {
    label.textContent = value ? 'On' : 'Off';
  }
}

function syncStateFromInputs() {
  state.gallons = Number(refs.gallons.value) || state.gallons;
  state.turnover = Number(refs.turnover.value) || state.turnover;
  state.water.temperature = Number(refs.temp.value) || state.water.temperature;
  state.water.pH = Number(refs.ph.value) || state.water.pH;
  state.water.gH = Number(refs.gh.value) || state.water.gH;
  state.water.kH = Number(refs.kh.value) || state.water.kH;
  state.water.salinity = refs.salinity.value;
  state.water.flow = refs.flow.value;
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
  renderStockList(refs.stockList, computed.entries, (entry) => {
    state.stock = state.stock.filter((item) => !(item.id === entry.id && item.stage === entry.stage));
    scheduleUpdate();
  });
  renderDiagnostics();
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

const scheduleUpdate = debounce(() => {
  syncStateFromInputs();
  pruneMarineEntries();
  renderAll();
});

document.addEventListener('advisor:addCandidate', (event) => {
  const detail = event.detail ?? {};
  const species = detail.species;
  if (!species) return;
  state.candidate = {
    id: species.id,
    qty: detail.qty ?? 1,
    stage: state.candidate?.stage ?? 'adult',
  };
  if (refs.speciesSelect) {
    refs.speciesSelect.value = species.id;
  }
  if (refs.qty && Number.isFinite(detail.qty)) {
    refs.qty.value = String(detail.qty);
  }
  scheduleUpdate();
});

function handleAdd() {
  if (!computed) return;
  const candidate = computed.candidate;
  if (!candidate) return;
  if (state.beginnerMode && computed.blockReasons.length > 0) {
    return;
  }
  const existing = state.stock.find((entry) => entry.id === candidate.id && entry.stage === candidate.stage);
  if (existing) {
    existing.qty += candidate.qty;
  } else {
    state.stock.push({ id: candidate.id, qty: candidate.qty, stage: candidate.stage });
  }
  state.candidate.qty = 1;
  refs.qty.value = '1';
  scheduleUpdate();
}

function bindInputs() {
  refs.gallons.addEventListener('input', scheduleUpdate);
  refs.turnover.addEventListener('input', scheduleUpdate);
  refs.temp.addEventListener('input', scheduleUpdate);
  refs.ph.addEventListener('input', scheduleUpdate);
  refs.gh.addEventListener('input', scheduleUpdate);
  refs.kh.addEventListener('input', scheduleUpdate);
  refs.salinity.addEventListener('change', scheduleUpdate);
  refs.flow.addEventListener('change', scheduleUpdate);

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

  refs.blackwater.addEventListener('click', () => {
    state.water.blackwater = !state.water.blackwater;
    syncToggles();
    scheduleUpdate();
  });

  refs.speciesSelect.addEventListener('change', () => {
    state.candidate.id = refs.speciesSelect.value;
    scheduleUpdate();
  });

  refs.qty.addEventListener('input', () => {
    state.candidate.qty = Math.max(1, Math.round(Number(refs.qty.value) || 1));
    refs.qty.value = String(state.candidate.qty);
    scheduleUpdate();
  });

  refs.stage.addEventListener('change', () => {
    state.candidate.stage = refs.stage.value;
    scheduleUpdate();
  });

  refs.addBtn.addEventListener('click', handleAdd);
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
