import { clamp, getBandColor } from './utils.js';

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

export function renderEnvCard({ stock = [], beginner = false, computed = null } = {}) {
  const env = deriveEnv(stock, { beginner, computed });
  const listEl = document.getElementById('env-reco');
  const barsEl = document.getElementById('env-bars');
  const warnEl = document.getElementById('env-warnings');
  const tipsEl = document.getElementById('env-tips');

  if (listEl) {
    renderConditions(listEl, env.conditions);
  }
  if (barsEl) {
    renderBars(barsEl, env);
  }
  if (warnEl) {
    renderWarnings(warnEl, env.warnings);
  }
  if (tipsEl) {
    ensureTips(tipsEl);
  }
}

export function deriveEnv(stock = [], options = {}) {
  const { beginner = false, computed = null } = options ?? {};
  const entries = normalizeStock(stock);
  if (!entries.length) {
    return buildDefaultEnv({ beginner, computed });
  }

  const conditions = [];
  const warnings = [];
  const chips = [];
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

  const phRanges = collectRanges(entries, 'pH');
  const sensitiveSpecies = entries.filter((entry) => entry.species.pH_sensitive || entry.species.ph_sensitive);
  const phCondition = buildPhCondition(phRanges, sensitiveSpecies);
  appendConditionResult(conditions, warnings, phCondition);

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

  const salinityResult = buildSalinity(entries);
  conditions.push(salinityResult.condition);
  warnings.push(...salinityResult.warnings);
  chips.push(...salinityResult.chips);

  const flowResult = buildFlow(entries);
  conditions.push(flowResult.condition);
  chips.push(...flowResult.chips);

  const blackResult = buildBlackwater(entries);
  conditions.push(blackResult.condition);

  const invertResult = evaluateInvertSafety(entries);
  warnings.push(...invertResult.warnings);
  chips.push(...invertResult.chips);

  const groupResult = evaluateGroupNeeds(entries);
  chips.push(...groupResult.chips);

  const tankResult = evaluateTankFit(entries, computed);
  chips.push(...tankResult.chips);

  const bioloadPct = computeBioloadPct(computed);
  const bioloadLabel = computeBioloadLabel(computed, entries.length);
  const bioloadSeverity = computed?.bioload?.severity ?? 'ok';
  if (computed?.bioload?.message) {
    notes.bioload.push(computed.bioload.message);
  }

  const aggressionPct = computeAggressionScore(computed);
  const aggressionLabel = computed?.aggression?.label ?? 'No conflicts detected.';
  const aggressionSeverity = computed?.aggression?.severity ?? 'ok';
  if (Array.isArray(computed?.aggression?.reasons)) {
    notes.aggression.push(...computed.aggression.reasons);
  }

  return {
    beginner,
    conditions,
    warnings: dedupeWarnings(warnings),
    chips: dedupeStrings(chips),
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
  };
}

function renderConditions(root, conditions) {
  const html = conditions
    .map((condition) => {
      const badges = (condition.badges ?? [])
        .map((badge) => `<span class="env-item__badge">${escapeHtml(badge)}</span>`)
        .join('');
      return `<div class="env-item" role="listitem">
        <div class="env-item__label">${escapeHtml(condition.label)}</div>
        <div class="env-item__value">${escapeHtml(condition.value)}${badges}</div>
      </div>`;
    })
    .join('');
  root.innerHTML = html;
}

function renderBars(root, env) {
  const bioloadColor = getBandColor((env.bioloadPct || 0) / 100);
  const aggressionColor = colorForSeverity(env.aggressionSeverity);
  const bioloadNotes = renderChips(env.barNotes?.bioload ?? []);
  const aggressionNotes = renderChips(env.barNotes?.aggression ?? []);
  const generalChips = renderChips(env.chips ?? []);

  root.innerHTML = `
    <div class="env-bar">
      <div class="env-bar__hd">
        <span>Bioload Capacity</span>
        <span>${escapeHtml(env.bioloadLabel)}</span>
      </div>
      <div class="env-bar__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.max(0, Math.round(env.bioloadPct)))}">
        <div class="env-bar__fill" style="width:${Math.min(100, Math.max(0, env.bioloadPct))}%; background:${bioloadColor};"></div>
      </div>
      ${bioloadNotes}
    </div>
    <div class="env-bar">
      <div class="env-bar__hd">
        <span>Aggression &amp; Compatibility</span>
        <span>${escapeHtml(env.aggressionLabel)}</span>
      </div>
      <div class="env-bar__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.max(0, Math.round(env.aggressionPct)))}">
        <div class="env-bar__fill" style="width:${Math.min(100, Math.max(0, env.aggressionPct))}%; background:${aggressionColor};"></div>
      </div>
      ${aggressionNotes}
    </div>
    ${generalChips}`;
}

function renderWarnings(root, warnings) {
  if (!warnings.length) {
    root.hidden = true;
    root.innerHTML = '';
    return;
  }
  root.hidden = false;
  const list = warnings
    .map((warning) => {
      const cls = warning.type === 'hard' ? ' class="env-warn-hard"' : '';
      return `<li${cls}>${escapeHtml(warning.text)}</li>`;
    })
    .join('');
  root.innerHTML = `<div class="env-warn-title">Warnings</div><ul class="env-warn-list">${list}</ul>`;
}

function ensureTips(el) {
  if (el.dataset.bound === 'true') return;
  el.innerHTML = `
    <ul>
      <li>Match general hardness (gH) and carbonate hardness (kH) to the tightest species range— remineralize slowly when using RO.</li>
      <li>Lock in one salinity profile; avoid mixing freshwater and brackish species unless they are noted as dual-tolerant.</li>
      <li>Blackwater lovers appreciate botanicals and tinted water; only mark it required when tannin-dependent species are present.</li>
      <li>Blend flow zones when low- and high-flow species are mixed—use spray bars or directional pumps to create calm refuges.</li>
      <li>Beginner Mode keeps a conservative buffer on capacity and compatibility. Switch to Advanced only when you can monitor closely.</li>
    </ul>`;
  el.dataset.bound = 'true';
}

function buildDefaultEnv({ beginner, computed }) {
  const conditions = [
    { label: 'Temperature (°F)', value: '74–78' },
    { label: 'pH', value: '6.5–7.5' },
    { label: 'gH (dGH)', value: '4–12' },
    { label: 'kH (dKH)', value: '2–8' },
    { label: 'Salinity', value: 'Freshwater' },
    { label: 'Flow', value: 'Moderate' },
    { label: 'Blackwater / Tannins', value: 'Off' },
  ];
  return {
    beginner,
    conditions,
    warnings: [],
    chips: [],
    barNotes: { bioload: [], aggression: [] },
    bioloadPct: computeBioloadPct(computed),
    bioloadLabel: computeBioloadLabel(computed, 0),
    bioloadSeverity: computed?.bioload?.severity ?? 'ok',
    aggressionPct: computeAggressionScore(computed),
    aggressionLabel: computed?.aggression?.label ?? 'No conflicts detected.',
    aggressionSeverity: computed?.aggression?.severity ?? 'ok',
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
    return { condition: { label, value: '—', badges: [] }, warnings: [] };
  }
  const intersection = intersectRanges(ranges);
  const badges = [];
  if (sensitiveSpecies.length) {
    badges.push('sensitive species');
  }
  if (intersection.ok) {
    const value = formatRange(intersection.min, intersection.max, 1);
    return { condition: { label, value, badges }, warnings: [] };
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
  let value = 'Freshwater';
  if (hasHigh) value = SALINITY_LABEL['brackish-high'];
  else if (hasLow) value = SALINITY_LABEL['brackish-low'];
  else if (hasDual) value = SALINITY_LABEL.dual;
  else if (hasFresh) value = SALINITY_LABEL.fresh;

  if (!hasDual && hasFresh && (hasLow || hasHigh)) {
    warnings.push({ type: 'soft', text: 'Salinity mix (fresh + brackish) not advised.' });
    chips.push('fresh + brackish mix');
  }

  return { condition: { label: 'Salinity', value }, warnings, chips };
}

function buildFlow(entries) {
  const flows = entries.map((entry) => entry.species.flow).filter(Boolean);
  if (!flows.length) {
    return { condition: { label: 'Flow', value: 'Moderate' }, chips: [] };
  }
  const flowSet = new Set(flows);
  const hasLow = flowSet.has('low');
  const hasHigh = flowSet.has('high');
  const hasModerate = flowSet.has('moderate');
  const badges = [];
  const chips = [];
  let value = 'Moderate';
  if (hasLow && hasHigh) {
    value = 'Moderate';
    badges.push('create zones');
  } else if (hasHigh) {
    value = FLOW_LABEL.high;
  } else if (hasLow && !hasModerate) {
    value = FLOW_LABEL.low;
  } else if (hasModerate) {
    value = FLOW_LABEL.moderate;
  }
  if (hasLow && hasHigh) {
    chips.push('flow zones needed');
  }
  return { condition: { label: 'Flow', value, badges }, chips };
}

function buildBlackwater(entries) {
  const flags = entries.map((entry) => entry.species.blackwater).filter(Boolean);
  if (!flags.length) {
    return { condition: { label: 'Blackwater / Tannins', value: 'Off' } };
  }
  let value = 'Off';
  if (flags.includes('required')) {
    value = BLACK_LABEL.required;
  } else if (flags.includes('recommended') || flags.includes('prefers')) {
    value = BLACK_LABEL.recommended;
  }
  return { condition: { label: 'Blackwater / Tannins', value } };
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

function colorForSeverity(severity) {
  if (severity === 'bad') return 'var(--bad)';
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
