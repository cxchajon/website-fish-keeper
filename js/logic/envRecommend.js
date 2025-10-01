import { clamp, getBandColor } from './utils.js';
import { formatBioloadPercent } from '../bioload.js';

const dash = '—';
const showRange = (range) => {
  if (!range) return dash;
  const { min, max } = range;
  if (min == null || max == null || min === '' || max === '') {
    return dash;
  }
  return `${min}–${max}`;
};
const showText = (value) => {
  if (value == null || value === '') {
    return dash;
  }
  return value;
};

// Returns the neutral env model used when no stock is present
export function defaultEnvModel() {
  return {
    temperature: null,
    pH: null,
    gH: null,
    kH: null,
    salinity: null,
    flow: null,
    blackwater: null,
    brackishYes: null,
    chips: [],
  };
}

const FLOW_LABEL = { low: 'Low', moderate: 'Moderate', high: 'High' };
const BLACK_LABEL = { off: 'Off', neutral: 'Off', prefers: 'Recommended', recommended: 'Recommended', required: 'Required' };
const SALINITY_LABEL = {
  fresh: 'Freshwater',
  'brackish-low': 'Brackish-low',
  'brackish-high': 'Brackish-high',
  dual: 'Dual',
};

const RANGE_KEYS = {
  temperature: ['temperature', 'min_f', 'max_f'],
  pH: ['pH', 'min', 'max'],
  gH: ['gH', 'min_dGH', 'max_dGH'],
  kH: ['kH', 'min_dKH', 'max_dKH'],
};

function hasFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num);
}

function hasMeaningfulRange(range) {
  if (!range) return false;
  if (Array.isArray(range)) {
    return range.some((value) => hasFiniteNumber(value));
  }
  if (typeof range === 'object') {
    const keys = ['min', 'max', 'min_f', 'max_f', 'min_dGH', 'max_dGH', 'min_dKH', 'max_dKH'];
    return keys.some((key) => hasFiniteNumber(range?.[key]));
  }
  return false;
}

function hasMeaningfulText(value) {
  if (value == null) return false;
  const text = String(value).trim();
  return text !== '' && text !== dash;
}

function isEnvDataMeaningful(env) {
  if (!env) return false;
  const hasRange = [env.temperature, env.pH, env.gH, env.kH].some((range) => hasMeaningfulRange(range));
  const hasText = [env.salinity, env.flow, env.blackwater].some((value) => hasMeaningfulText(value));
  const hasBrackishInfo = env.brackishYes != null;
  const hasChips = Array.isArray(env.chips) && env.chips.length > 0;
  const hasDetailChips = Array.isArray(env.detailChips) && env.detailChips.length > 0;
  return hasRange || hasText || hasBrackishInfo || hasChips || hasDetailChips;
}

function toggleEnvCompact({ env, bioloadPercent, aggressionPercent }) {
  if (typeof document === 'undefined') return;
  const card = document.querySelector('#env-card');
  const body = card?.querySelector('[data-role="env-body"]');
  const summary = card?.querySelector('[data-role="env-compact-summary"]');
  if (!card || !body || !summary) return;

  const hasEnv = isEnvDataMeaningful(env);
  const bio = Number(bioloadPercent);
  const agg = Number(aggressionPercent);
  const hasMeters = (Number.isFinite(bio) && bio > 0) || (Number.isFinite(agg) && agg > 0);
  const shouldCompact = !(hasEnv || hasMeters);

  if (shouldCompact) {
    card.classList.add('compact');
    summary.hidden = false;
    summary.setAttribute('aria-hidden', 'false');
    const messageEl = summary.querySelector('[data-field="summary-text"]');
    if (messageEl) {
      messageEl.textContent = 'Add species to see recommendations.';
    }
  } else {
    card.classList.remove('compact');
    summary.hidden = true;
    summary.setAttribute('aria-hidden', 'true');
  }
}

export function renderEnvCard({ stock = [], stockCount = null, computed = null } = {}) {
  const env = deriveEnv(stock, { computed });
  const derivedCount = typeof stockCount === 'number' ? stockCount : env.stockLength ?? (Array.isArray(stock) ? stock.length : 0);
  const isEmpty = derivedCount === 0;
  if (typeof document === 'undefined') {
    return env;
  }

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767.98px)').matches;
  const listEl = document.getElementById('env-reco');
  const excelEl = document.getElementById('env-reco-xl');
  const barsEl = document.getElementById('env-bars');
  const warnEl = document.getElementById('env-warnings');
  const tipsEl = document.getElementById('env-legend');

  if (listEl) {
    renderConditions(listEl, env.conditions, { isEmpty });
    if (isMobile) {
      listEl.setAttribute('hidden', '');
    } else {
      listEl.removeAttribute('hidden');
    }
  }
  if (excelEl) {
    if (isMobile) {
      renderConditionsExcel(env, { isEmpty });
    } else {
      excelEl.innerHTML = '';
      excelEl.setAttribute('hidden', '');
    }
  }
  if (barsEl) {
    renderBars(barsEl, env, { isMobile, isEmpty });
  }
  if (warnEl) {
    renderWarnings(warnEl, env.warnings);
  }
  if (tipsEl) {
    ensureTips(tipsEl);
  }

  toggleEnvCompact({
    env,
    bioloadPercent: env?.bioloadPct ?? 0,
    aggressionPercent: env?.aggressionPct ?? 0,
  });

  return env;
}

export function deriveEnv(stock = [], options = {}) {
  const { computed = null } = options ?? {};
  const entries = normalizeStock(stock);
  const stockLength = entries.length;
  if (!stockLength) {
    return buildDefaultEnv({ stockLength });
  }

  const conditions = [];
  const warnings = [];
  const detailChips = [];
  const noteCodes = new Set();
  const notes = { bioload: [], aggression: [] };

  const tempRanges = collectRanges(entries, 'temperature');
  const tempCondition = buildRangeCondition({
    label: 'Temperature (°F)',
    ranges: tempRanges,
    digits: 0,
    conflictPrefix: 'Temperature clash',
    warningBuilder: (cool, warm) =>
      `Not compatible: ${formatRangeGroup(cool, '°F')} vs ${formatRangeGroup(warm, '°F')}.`,
  });
  appendConditionResult(conditions, warnings, tempCondition);
  const temperatureRange = excelRangeFromRanges(tempRanges, 0);

  const phRanges = collectRanges(entries, 'pH');
  const sensitiveSpecies = entries.filter((entry) => entry.species.pH_sensitive || entry.species.ph_sensitive);
  const phCondition = buildPhCondition(phRanges, sensitiveSpecies);
  appendConditionResult(conditions, warnings, phCondition);
  if (Array.isArray(phCondition.notes)) {
    for (const code of phCondition.notes) noteCodes.add(code);
  }
  const pHRange = excelRangeFromRanges(phRanges, 1);

  const gRanges = collectRanges(entries, 'gH');
  const gCondition = buildRangeCondition({
    label: 'gH (dGH)',
    ranges: gRanges,
    digits: 0,
    conflictPrefix: 'gH mismatch',
    warningBuilder: (low, high) =>
      `Hardness mismatch: ${formatRangeGroup(low, ' dGH')} vs ${formatRangeGroup(high, ' dGH')}.`,
  });
  appendConditionResult(conditions, warnings, gCondition);
  const gHRange = excelRangeFromRanges(gRanges, 0);

  const kRanges = collectRanges(entries, 'kH');
  const kCondition = buildRangeCondition({
    label: 'kH (dKH)',
    ranges: kRanges,
    digits: 0,
    conflictPrefix: 'kH mismatch',
    warningBuilder: (low, high) =>
      `Buffering mismatch: ${formatRangeGroup(low, ' dKH')} vs ${formatRangeGroup(high, ' dKH')}.`,
  });
  appendConditionResult(conditions, warnings, kCondition);
  const kHRange = excelRangeFromRanges(kRanges, 0);

  const salinityResult = buildSalinity(entries);
  conditions.push(salinityResult.condition);
  warnings.push(...salinityResult.warnings);
  detailChips.push(...salinityResult.chips);
  if (Array.isArray(salinityResult.noteCodes)) {
    for (const code of salinityResult.noteCodes) noteCodes.add(code);
  }
  const salinityCode = salinityResult.code ?? 'FW';

  const flowResult = buildFlow(entries);
  conditions.push(flowResult.condition);
  detailChips.push(...flowResult.chips);
  if (Array.isArray(flowResult.noteCodes)) {
    for (const code of flowResult.noteCodes) noteCodes.add(code);
  }
  const flowCode = flowResult.code ?? 'M';

  const blackResult = buildBlackwater(entries);
  conditions.push(blackResult.condition);
  if (Array.isArray(blackResult.noteCodes)) {
    for (const code of blackResult.noteCodes) noteCodes.add(code);
  }
  const blackwaterStatus = blackResult.status ?? 'off';

  const invertResult = evaluateInvertSafety(entries);
  warnings.push(...invertResult.warnings);
  detailChips.push(...invertResult.chips);

  const groupResult = evaluateGroupNeeds(entries);
  detailChips.push(...groupResult.chips);

  const tankResult = evaluateTankFit(entries, computed);
  detailChips.push(...tankResult.chips);

  const bioloadPct = computeBioloadPct(computed);
  const bioloadLabel = computeBioloadLabel(computed, entries.length);
  const bioloadSeverity = computed?.bioload?.severity ?? 'ok';
  if (computed?.bioload?.message) {
    notes.bioload.push(computed.bioload.message);
  }

  let aggressionPct = computeAggressionScore(computed);
  let aggressionLabel = computed?.aggression?.label ?? 'No conflicts detected.';
  let aggressionSeverity = computed?.aggression?.severity ?? 'ok';
  if (Array.isArray(computed?.aggression?.reasons)) {
    notes.aggression.push(...computed.aggression.reasons);
  }

  let totalIndividuals = 0;
  const maleBettaCount = entries.reduce((total, entry) => {
    if (!entry || !entry.species) return total;
    const qty = Number(entry.qty) || 0;
    if (qty <= 0) return total;
    totalIndividuals += qty;
    const species = entry.species;
    if (species.id === 'betta_male') {
      return total + qty;
    }
    const commonName = (species.common_name ?? species.commonName ?? '').toLowerCase();
    if (commonName === 'betta (male)') {
      return total + qty;
    }
    if (Array.isArray(species.tags)) {
      const tags = species.tags.map((tag) => String(tag).toLowerCase());
      if (tags.includes('betta') && tags.includes('male')) {
        return total + qty;
      }
    }
    return total;
  }, 0);

  if (maleBettaCount >= 2) {
    aggressionPct = 100;
    aggressionLabel = '100%';
    aggressionSeverity = 'critical';
    const warningTitle = 'Multiple Male Bettas Detected';
    const warningMessage = 'Two or more male bettas should NOT be kept together. They will fight, often to injury or death. Keep only one male betta per tank.';
    const warningActions = [
      'Reduce male betta count to 1',
      'Use a separate, fully cycled tank for additional males',
    ];
    const warningText = `${warningTitle}. ${warningMessage} Actions: ${warningActions.join('; ')}.`;
    warnings.push({
      id: 'warn_betta_male_conflict',
      severity: 'critical',
      type: 'hard',
      title: warningTitle,
      message: warningMessage,
      actions: warningActions,
      docs: { ref: 'betta_male_conflict' },
      text: warningText,
    });
    notes.aggression.push('Multiple male bettas detected — keep only one male betta per tank.');
  } else if (maleBettaCount === 1 && totalIndividuals === 1) {
    aggressionPct = 0;
    aggressionLabel = '0%';
    aggressionSeverity = 'ok';
  }

  return {
    conditions,
    warnings: dedupeWarnings(warnings),
    chips: dedupeStrings(Array.from(noteCodes)),
    detailChips: dedupeStrings(detailChips),
    barNotes: {
      bioload: dedupeStrings(notes.bioload),
      aggression: dedupeStrings(notes.aggression),
    },
    bioloadPct,
    bioloadLabel,
    bioloadSeverity,
    aggressionPct,
    aggressionLabel,
    aggressionSeverity,
    temperature: temperatureRange,
    pH: pHRange,
    gH: gHRange,
    kH: kHRange,
    salinity: salinityCode,
    flow: flowCode,
    blackwater: blackwaterStatusToAbbrev(blackwaterStatus),
    brackishYes: Boolean(salinityResult.brackish),
    stockLength,
  };
}

function renderConditions(root, conditions, { isEmpty = false } = {}) {
  const html = conditions
    .map((condition) => {
      const badges = (condition.badges ?? [])
        .map((badge) => `<span class="env-item__badge">${escapeHtml(badge)}</span>`)
        .join('');
      const valueText = isEmpty ? dash : showText(condition.value);
      return `<div class="env-item" role="listitem">
        <div class="env-item__label">${escapeHtml(condition.label)}</div>
        <div class="env-item__value">${escapeHtml(valueText)}${badges}</div>
      </div>`;
    })
    .join('');
  root.innerHTML = html;
}

function renderConditionsExcel(env, { isEmpty = false } = {}) {
  const root = document.getElementById('env-reco-xl');
  if (!root) return;
  root.classList.add('env-table');

  const chipsHtml = !isEmpty && env.chips?.length
    ? `<div class="env-notes">${env.chips.map((c) => `<span class="env-chip">${esc(c)}</span>`).join('')}</div>`
    : dash;

  const renderRange = (range) => {
    if (isEmpty) return dash;
    const result = showRange(range);
    if (result === dash || !range || typeof range !== 'object') return dash;
    const { min, max } = range;
    return `${formatExcelValue(min)}–${formatExcelValue(max)}`;
  };

  const renderText = (value) => {
    if (isEmpty) return dash;
    return showText(value);
  };

  const html = `
    <table class="env-xl-table" role="table" aria-label="Recommended Environmental Conditions (mobile)">
      <colgroup>
        <col />
        <col />
        <col />
      </colgroup>
      <tbody>
        <tr class="env-xl-rowA">
          <td class="env-xl-cell env-xl-label">Temp °F</td>
          <td class="env-xl-cell env-xl-label">pH</td>
          <td class="env-xl-cell env-xl-label">gH (dGH)</td>
        </tr>
        <tr class="env-xl-rowB">
          <td class="env-xl-cell env-xl-value env-xl-nowrap">${renderRange(env.temperature)}</td>
          <td class="env-xl-cell env-xl-value env-xl-nowrap">${renderRange(env.pH)}</td>
          <td class="env-xl-cell env-xl-value env-xl-nowrap">${renderRange(env.gH)}</td>
        </tr>

        <tr class="env-xl-rowA">
          <td class="env-xl-cell env-xl-label">kH (dKH)</td>
          <td class="env-xl-cell env-xl-label">Sal</td>
          <td class="env-xl-cell env-xl-label">Flow</td>
        </tr>
        <tr class="env-xl-rowB">
          <td class="env-xl-cell env-xl-value env-xl-nowrap">${renderRange(env.kH)}</td>
          <td class="env-xl-cell env-xl-value env-xl-nowrap">${renderText(env.salinity)}</td>
          <td class="env-xl-cell env-xl-value env-xl-nowrap">${renderText(env.flow)}</td>
        </tr>

        <tr class="env-xl-rowA">
          <td class="env-xl-cell env-xl-label">Brackish</td>
          <td class="env-xl-cell env-xl-label">Dark water / tannins</td>
          <td class="env-xl-cell env-xl-label">Notes</td>
        </tr>
        <tr class="env-xl-rowB">
          <td class="env-xl-cell env-xl-value env-xl-nowrap">${isEmpty ? dash : env.brackishYes == null ? dash : env.brackishYes ? 'Yes' : 'No'}</td>
          <td class="env-xl-cell env-xl-value env-xl-nowrap">${renderText(env.blackwater)}</td>
          <td class="env-xl-cell env-xl-value">${chipsHtml}</td>
        </tr>
      </tbody>
    </table>
  `;

  root.innerHTML = html;
  root.removeAttribute('hidden');
}

function renderBars(root, env, { isMobile = false, isEmpty = false } = {}) {
  if (!root) return;
  const rawBioloadPct = isEmpty ? 0 : Number(env.bioloadPct) || 0;
  const bioloadPct = isEmpty ? 0 : sanitizePercent(rawBioloadPct);
  const aggressionPct = isEmpty ? 0 : sanitizePercent(env.aggressionPct);
  const bioloadColor = getBandColor(bioloadPct / 100);
  const bioloadDisplay = formatBioloadPercent(Math.max(0, Math.min(200, rawBioloadPct)));
  const bioloadAria = Number.isFinite(bioloadPct) ? Number(bioloadPct.toFixed(2)) : 0;
  const aggressionColor = colorForSeverity(isEmpty ? 'ok' : env.aggressionSeverity);
  const bioloadNotes = isEmpty ? '' : renderChips(env.barNotes?.bioload ?? []);
  const aggressionNotes = isEmpty ? '' : renderChips(env.barNotes?.aggression ?? []);
  const generalChips = isEmpty ? '' : renderChips(env.detailChips ?? []);
  const bioloadLabel = isEmpty ? '0% → 0% of capacity' : env.bioloadLabel;
  const aggressionLabel = isEmpty ? '0%' : (aggressionPct >= 100 ? '100%' : env.aggressionLabel);
  const bioloadInfoBtn = '<button type="button" class="info-btn" data-info="Approximate stocking level for your tank size. Stay in green for better stability.">i</button>';
  const aggressionInfoBtn = '<button type="button" class="info-btn" data-info="Estimated compatibility risk. Adding aggressive or territorial species will raise this.">i</button>';

  if (isMobile) {
    root.classList.add('env-bars--xl');
    root.innerHTML = `
      <div id="bioagg-card" class="ttg-card bioagg-card is-compact">
        <div class="env-bar env-bar--xl bar-row">
          <div class="env-bar__hd">
            <div class="env-bar__label metric-label">Bioload ${bioloadInfoBtn}</div>
            <div class="env-bar__value">${bioloadDisplay}</div>
          </div>
          <div class="env-bar__track meter-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${bioloadAria}">
            <div class="env-bar__fill" style="width:${bioloadPct}%; background:${bioloadColor};"></div>
          </div>
        </div>
        <div class="env-bar env-bar--xl bar-row">
          <div class="env-bar__hd">
            <div class="env-bar__label metric-label">Aggression ${aggressionInfoBtn}</div>
            <div class="env-bar__value">${Math.round(aggressionPct)}%</div>
          </div>
          <div class="env-bar__track meter-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(aggressionPct)}">
            <div class="env-bar__fill" style="width:${aggressionPct}%; background:${aggressionColor};"></div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  root.classList.remove('env-bars--xl');
  root.innerHTML = `
    <div id="bioagg-card" class="ttg-card bioagg-card is-compact">
      <div class="env-bar metric-row">
        <div class="env-bar__hd">
          <span class="env-bar__label metric-label">Bioload ${bioloadInfoBtn}</span>
          <span>${escapeHtml(bioloadLabel)}</span>
        </div>
        <div class="env-bar__track progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${bioloadAria}">
          <div class="env-bar__fill" style="width:${bioloadPct}%; background:${bioloadColor};"></div>
        </div>
        ${bioloadNotes}
      </div>
      <div class="env-bar metric-row">
        <div class="env-bar__hd">
          <span class="env-bar__label metric-label">Aggression ${aggressionInfoBtn}</span>
          <span>${escapeHtml(aggressionLabel)}</span>
        </div>
        <div class="env-bar__track progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(aggressionPct)}">
          <div class="env-bar__fill" style="width:${aggressionPct}%; background:${aggressionColor};"></div>
        </div>
        ${aggressionNotes}
      </div>
      ${generalChips}
    </div>`;
}

function renderWarnings(root, warnings) {
  if (!root) return;
  if (!warnings.length) {
    root.hidden = true;
    root.innerHTML = '';
    return;
  }
  root.hidden = false;
  const [first, ...rest] = warnings;
  const firstClass = first.type === 'hard' ? ' env-warn-hard' : '';
  let html = `<p class="env-warn-primary${firstClass}">${escapeHtml(first.text)}</p>`;
  if (rest.length) {
    const items = rest
      .map((warning) => {
        const cls = warning.type === 'hard' ? ' class="env-warn-hard"' : '';
        return `<li${cls}>${escapeHtml(warning.text)}</li>`;
      })
      .join('');
    html += ` <button type="button" class="linklike env-warn-more" data-expanded="false" aria-expanded="false">(+${rest.length} more)</button>`;
    html += `<ul class="env-warn-list" hidden>${items}</ul>`;
  }
  root.innerHTML = html;

  if (rest.length) {
    const toggle = root.querySelector('.env-warn-more');
    const list = root.querySelector('.env-warn-list');
    if (toggle && list) {
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('data-expanded') === 'true';
        if (expanded) {
          list.setAttribute('hidden', '');
          toggle.setAttribute('data-expanded', 'false');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.textContent = `(+${rest.length} more)`;
        } else {
          list.removeAttribute('hidden');
          toggle.setAttribute('data-expanded', 'true');
          toggle.setAttribute('aria-expanded', 'true');
          toggle.textContent = 'Hide';
        }
      });
    }
  }
}

function ensureTips(el) {
  if (el.dataset.bound === 'true') return;
  el.innerHTML = `
    <div class="env-tip-legend">
      <strong>Legend</strong>
      <p>Sal: FW (freshwater), Br-L (low brackish), Br-H (high brackish). Flow: L (low), M (moderate), H (high). Dark water: Off, Pref, Rec, Req. Notes chips: zones (mixed flow), sens (pH sensitive), req (blackwater required), mix (fresh+brackish).</p>
    </div>
    <ul>
      <li>Match general hardness (gH) and carbonate hardness (kH) to the tightest species range— remineralize slowly when using RO.</li>
      <li>Lock in one salinity profile; avoid mixing freshwater and brackish species unless they are noted as dual-tolerant.</li>
      <li>Blackwater lovers appreciate botanicals and tinted water; only mark it required when tannin-dependent species are present.</li>
      <li>Blend flow zones when low- and high-flow species are mixed—use spray bars or directional pumps to create calm refuges.</li>
      <li>Stay within the green bioload zone for stability and increase filtration or planting before pushing higher loads.</li>
    </ul>`;
  el.dataset.bound = 'true';
}

function buildDefaultEnv({ stockLength = 0 }) {
  const model = defaultEnvModel();
  const conditions = [
    { label: 'Temperature (°F)', value: dash },
    { label: 'pH', value: dash },
    { label: 'gH (dGH)', value: dash },
    { label: 'kH (dKH)', value: dash },
    { label: 'Salinity', value: dash },
    { label: 'Flow', value: dash },
    { label: 'Blackwater / Tannins', value: dash },
  ];
  return {
    ...model,
    conditions,
    warnings: [],
    chips: [],
    detailChips: [],
    barNotes: { bioload: [], aggression: [] },
    bioloadPct: 0,
    bioloadLabel: '0% → 0% of capacity',
    bioloadSeverity: 'ok',
    aggressionPct: 0,
    aggressionLabel: '0%',
    aggressionSeverity: 'ok',
    stockLength,
  };
}

function normalizeStock(stock) {
  const result = [];
  for (const entry of stock) {
    if (!entry || !entry.species) continue;
    const qty = Number(entry.qty) || 0;
    if (qty <= 0) continue;
    result.push({ species: entry.species, qty });
  }
  return result;
}

function collectRanges(entries, key) {
  const results = [];
  const [prop, minKey, maxKey] = RANGE_KEYS[key] ?? [];
  if (!prop) return results;
  for (const entry of entries) {
    const species = entry.species;
    let range = species[prop];
    if (range == null && typeof prop === 'string') {
      const lower = prop.toLowerCase();
      range = species[lower] ?? range;
    }
    let min = Number.NaN;
    let max = Number.NaN;
    if (Array.isArray(range)) {
      [min, max] = range;
    } else if (range && typeof range === 'object') {
      min = range[minKey];
      max = range[maxKey];
    }
    min = Number(min);
    max = Number(max);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      if (max < min) {
        const tmp = min;
        min = max;
        max = tmp;
      }
      results.push({ min, max, species });
    }
  }
  return results;
}

function buildRangeCondition({ label, ranges, digits, conflictPrefix, warningBuilder }) {
  if (!ranges.length) {
    return { condition: { label, value: '—', badges: [] }, warnings: [] };
  }
  const intersection = intersectRanges(ranges);
  if (intersection.ok) {
    const value = formatRange(intersection.min, intersection.max, digits);
    const badges = extremaBadges(ranges, intersection.min, intersection.max);
    return { condition: { label, value, badges }, warnings: [] };
  }
  const conflict = analyzeConflict(ranges);
  const compromise = formatRange(conflict.band.min, conflict.band.max, digits);
  const conflictText = warningBuilder(conflict.low, conflict.high) || `${conflictPrefix}: adjust stock for compatibility.`;
  return {
    condition: { label, value: `${compromise} (compromise)`, badges: [] },
    warnings: [{ type: 'hard', text: conflictText }],
  };
}

function buildPhCondition(ranges, sensitiveSpecies) {
  const label = 'pH';
  if (!ranges.length) {
    return { condition: { label, value: '—', badges: [] }, warnings: [], notes: sensitiveSpecies.length ? ['sens'] : [] };
  }
  const intersection = intersectRanges(ranges);
  const badges = [];
  const notes = [];
  if (sensitiveSpecies.length) {
    badges.push('sensitive species');
    notes.push('sens');
  }
  if (intersection.ok) {
    const value = formatRange(intersection.min, intersection.max, 1);
    return { condition: { label, value, badges }, warnings: [], notes };
  }
  if (sensitiveSpecies.length) {
    const conflict = analyzeConflict(ranges);
    const warning = {
      type: 'hard',
      text: `pH clash for sensitive species: ${formatRangeGroup(conflict.low, '')} vs ${formatRangeGroup(conflict.high, '')}.`,
    };
    return {
      condition: { label, value: 'No shared band (see warnings)', badges },
      warnings: [warning],
      notes,
    };
  }
  const unionMin = Math.min(...ranges.map((range) => range.min));
  const unionMax = Math.max(...ranges.map((range) => range.max));
  const paddedMin = Math.max(0, unionMin - 0.3);
  const paddedMax = Math.min(9, unionMax + 0.3);
  badges.push('flexible');
  return {
    condition: { label, value: formatRange(paddedMin, paddedMax, 1), badges },
    warnings: [],
    notes,
  };
}

function buildSalinity(entries) {
  const salinities = new Set(entries.map((entry) => entry.species.salinity).filter(Boolean));
  const hasFresh = salinities.has('fresh');
  const hasLow = salinities.has('brackish-low');
  const hasHigh = salinities.has('brackish-high');
  const hasDual = salinities.has('dual');
  const warnings = [];
  const chips = [];
  const noteCodes = [];
  let value = SALINITY_LABEL.fresh;
  let code = 'FW';
  let brackish = false;
  if (hasHigh) {
    value = SALINITY_LABEL['brackish-high'];
    code = 'Br-H';
    brackish = true;
  } else if (hasLow) {
    value = SALINITY_LABEL['brackish-low'];
    code = 'Br-L';
    brackish = true;
  } else if (hasDual) {
    value = SALINITY_LABEL.dual;
    code = 'FW';
  } else if (hasFresh) {
    value = SALINITY_LABEL.fresh;
    code = 'FW';
  }

  if (!hasDual && hasFresh && (hasLow || hasHigh)) {
    warnings.push({ type: 'soft', text: 'Salinity mix (fresh + brackish) not advised.' });
    chips.push('fresh + brackish mix');
    noteCodes.push('mix');
  }

  return { condition: { label: 'Salinity', value }, warnings, chips, noteCodes, code, brackish };
}

function buildFlow(entries) {
  const flows = entries.map((entry) => entry.species.flow).filter(Boolean);
  if (!flows.length) {
    return { condition: { label: 'Flow', value: 'Moderate' }, chips: [], noteCodes: [], code: 'M' };
  }
  const flowSet = new Set(flows);
  const hasLow = flowSet.has('low');
  const hasHigh = flowSet.has('high');
  const hasModerate = flowSet.has('moderate');
  const badges = [];
  const chips = [];
  const noteCodes = [];
  let value = 'Moderate';
  let code = 'M';
  if (hasLow && hasHigh) {
    value = 'Moderate';
    badges.push('create zones');
    noteCodes.push('zones');
  } else if (hasHigh) {
    value = FLOW_LABEL.high;
    code = 'H';
  } else if (hasLow && !hasModerate) {
    value = FLOW_LABEL.low;
    code = 'L';
  } else if (hasModerate) {
    value = FLOW_LABEL.moderate;
  }
  if (hasLow && hasHigh) {
    chips.push('flow zones needed');
  }
  return { condition: { label: 'Flow', value, badges }, chips, noteCodes, code };
}

function buildBlackwater(entries) {
  const flags = entries.map((entry) => entry.species.blackwater).filter(Boolean);
  if (!flags.length) {
    return { condition: { label: 'Blackwater / Tannins', value: 'Off' }, status: 'off', noteCodes: [] };
  }
  let value = 'Off';
  let status = 'off';
  const noteCodes = [];
  if (flags.includes('required')) {
    value = BLACK_LABEL.required;
    status = 'req';
    noteCodes.push('req');
  } else if (flags.includes('prefers')) {
    value = BLACK_LABEL.recommended;
    status = 'pref';
  } else if (flags.includes('recommended')) {
    value = BLACK_LABEL.recommended;
    status = 'rec';
  }
  return { condition: { label: 'Blackwater / Tannins', value }, status, noteCodes };
}

function evaluateInvertSafety(entries) {
  const warnings = [];
  const chips = [];
  const shrimp = entries.filter((entry) => entry.species.category === 'shrimp');
  if (!shrimp.length) {
    return { warnings, chips };
  }
  const predators = entries.filter((entry) => entry.species.category !== 'shrimp' && entry.species.invert_safe === false);
  if (!predators.length) {
    return { warnings, chips };
  }
  const shrimpNames = shrimp.map((entry) => entry.species.common_name).join(', ');
  const predatorNames = predators.map((entry) => entry.species.common_name).join(', ');
  warnings.push({ type: 'soft', text: `Shrimp predation risk: ${predatorNames} vs ${shrimpNames}.` });
  chips.push('shrimp at risk');
  return { warnings, chips };
}

function evaluateGroupNeeds(entries) {
  const chips = [];
  for (const entry of entries) {
    const { species, qty } = entry;
    const group = species.group;
    if (!group) continue;
    if (group.type === 'shoal' && qty < group.min) {
      chips.push(`shoal min not met: ${species.common_name}`);
    } else if (group.type === 'harem' && qty < group.min) {
      chips.push(`harem ratio needed: ${species.common_name}`);
    }
  }
  return { chips };
}

function evaluateTankFit(entries, computed) {
  const chips = [];
  const tankLength = computed?.tank?.length;
  if (!Number.isFinite(tankLength)) {
    return { chips };
  }
  for (const entry of entries) {
    const needed = Number(entry.species.min_tank_length_in);
    if (Number.isFinite(needed) && needed > tankLength) {
      chips.push(`tank length short for ${entry.species.common_name}`);
    }
  }
  return { chips };
}

function computeBioloadPct(computed) {
  const percent = computed?.bioload?.currentPercent;
  if (!Number.isFinite(percent)) {
    return 0;
  }
  return clamp(percent * 100, 0, 200);
}

function computeBioloadLabel(computed, speciesCount) {
  if (computed?.bioload?.text) {
    return computed.bioload.text;
  }
  return speciesCount > 0 ? 'Capacity estimate unavailable.' : 'Add species to estimate capacity.';
}

function computeAggressionScore(computed) {
  const score = computed?.aggression?.score;
  if (!Number.isFinite(score)) {
    return 0;
  }
  return clamp(score, 0, 100);
}

function appendConditionResult(conditions, warnings, result) {
  if (!result) return;
  if (result.condition) {
    conditions.push(result.condition);
  }
  if (Array.isArray(result.warnings)) {
    warnings.push(...result.warnings);
  }
}

function intersectRanges(ranges) {
  if (!ranges.length) return { ok: false, min: NaN, max: NaN };
  const min = Math.max(...ranges.map((range) => range.min));
  const max = Math.min(...ranges.map((range) => range.max));
  const epsilon = 0.01;
  return { ok: max - min > epsilon, min, max };
}

function analyzeConflict(ranges) {
  if (!ranges.length) {
    return {
      low: [],
      high: [],
      band: { min: NaN, max: NaN },
    };
  }
  const lowEntry = ranges.reduce((prev, next) => (next.max < prev.max ? next : prev));
  const highEntry = ranges.reduce((prev, next) => (next.min > prev.min ? next : prev));
  const threshold = 0.1;
  const lowGroup = ranges.filter((range) => range.max <= lowEntry.max + threshold);
  const highGroup = ranges.filter((range) => range.min >= highEntry.min - threshold);
  const min = Math.min(lowEntry.max, highEntry.min);
  const max = Math.max(lowEntry.max, highEntry.min);
  const band = {
    min,
    max,
  };
  return { low: lowGroup, high: highGroup, band };
}

function extremaBadges(ranges, min, max) {
  const badges = [];
  const tolerance = 0.05;
  const minSetter = ranges.find((range) => Math.abs(range.min - min) <= tolerance);
  const maxSetter = ranges.find((range) => Math.abs(range.max - max) <= tolerance);
  if (minSetter) {
    badges.push(`${minSetter.species.common_name} sets min`);
  }
  if (maxSetter && maxSetter.species !== minSetter?.species) {
    badges.push(`${maxSetter.species.common_name} sets max`);
  }
  return badges;
}

function formatRange(min, max, digits = 0) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return '—';
  }
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const format = (value) => value.toFixed(digits);
  if (Math.abs(hi - lo) <= 0.05) {
    return format(lo);
  }
  return `${format(lo)}–${format(hi)}`;
}

function formatRangeGroup(ranges, unit) {
  if (!ranges.length) return '—';
  return ranges
    .map((range) => {
      const label = range.species.common_name;
      const digits = unit.trim() === '°F' ? 0 : 1;
      const formatted = formatRange(range.min, range.max, digits);
      return `${label} (${formatted}${unit})`;
    })
    .join(', ');
}

function renderChips(items) {
  if (!items.length) return '';
  return `<div class="env-bar__chips">${items
    .map((item) => `<span class="chip">${escapeHtml(item)}</span>`)
    .join('')}</div>`;
}

function formatExcelValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return String(Number(value));
  }
  return String(value);
}

function excelRangeFromRanges(ranges, digits = 0) {
  if (!Array.isArray(ranges) || !ranges.length) {
    return null;
  }
  const intersection = intersectRanges(ranges);
  const format = (val) => formatRangeNumber(val, digits);
  if (intersection.ok) {
    return { min: format(intersection.min), max: format(intersection.max) };
  }
  const conflict = analyzeConflict(ranges);
  if (Number.isFinite(conflict.band?.min) && Number.isFinite(conflict.band?.max)) {
    return { min: format(conflict.band.min), max: format(conflict.band.max) };
  }
  return null;
}

function formatRangeNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return '';
  if (digits <= 0) {
    return String(Math.round(value));
  }
  return Number(value).toFixed(digits);
}

function colorForSeverity(severity) {
  if (severity === 'critical' || severity === 'bad') return 'var(--bad)';
  if (severity === 'warn') return '#f4b400';
  return 'rgba(255,255,255,0.35)';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dedupeWarnings(list) {
  const seen = new Set();
  const result = [];
  for (const warning of list) {
    const key = `${warning.type}|${warning.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(warning);
  }
  return result;
}

function dedupeStrings(list) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function sanitizePercent(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Number(value)));
}

function blackwaterStatusToAbbrev(status) {
  switch (status) {
    case 'req':
      return 'Req';
    case 'pref':
      return 'Pref';
    case 'rec':
      return 'Rec';
    default:
      return 'Off';
  }
}
