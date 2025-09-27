import { FISH_DB } from "../fish-data.js";
import { validateSpeciesRecord } from "./speciesSchema.js";
import { pickTankVariant, getTankVariants, describeVariant } from './sizeMap.js';
import {
  clamp,
  formatNumber,
  formatPercent,
  percentLabel,
  sum,
  roundTo,
  getBandColor,
  severityFromDelta,
  calcSeverityIcon,
} from './utils.js';
import {
  evaluatePair,
  evaluateInvertSafety,
  beginnerInvertBlock,
  evaluateSalinity,
  evaluateFlow,
  evaluateBlackwater,
  checkGroupRule,
} from './conflicts.js';

function toRange(source, minKey, maxKey) {
  if (!source) return [NaN, NaN];
  const min = Number(source[minKey]);
  const max = Number(source[maxKey]);
  return [Number.isFinite(min) ? min : NaN, Number.isFinite(max) ? max : NaN];
}

function normalizeSpecies(record) {
  const normalized = {
    ...record,
    temperature: toRange(record.temperature, 'min_f', 'max_f'),
    pH: toRange(record.ph, 'min', 'max'),
    gH: toRange(record.gH, 'min_dGH', 'max_dGH'),
    kH: toRange(record.kH, 'min_dKH', 'max_dKH'),
    pH_sensitive: Boolean(record.ph_sensitive),
  };
  return Object.freeze(normalized);
}

const SUPPORTED_SALINITY = new Set(['fresh', 'brackish-low', 'brackish-high', 'dual']);
const SALINITY_LABEL = {
  fresh: 'Freshwater',
  'brackish-low': 'Brackish-low',
  'brackish-high': 'Brackish-high',
  dual: 'Dual',
};

export const SPECIES = Object.freeze(
  FISH_DB.filter((s) => validateSpeciesRecord(s) === true && s.salinity !== 'marine')
);

const NORMALIZED_SPECIES = SPECIES.map(normalizeSpecies);
const SPECIES_MAP = new Map(NORMALIZED_SPECIES.map((species) => [species.id, species]));
const ENGINE_SPECIES = Object.freeze(NORMALIZED_SPECIES);

export function getSpeciesById(id) {
  return SPECIES_MAP.get(id) ?? null;
}

export const SPECIES_LIST = ENGINE_SPECIES.map((species) => ({
  id: species.id,
  name: species.common_name,
}));

export function getDefaultSpeciesId() {
  return ENGINE_SPECIES[0]?.id ?? null;
}

export function autoBioloadUnit(species) {
  if (!species) return 0;
  if (Number.isFinite(species.bioload_unit)) {
    return species.bioload_unit;
  }
  const size = Number.isFinite(species.adult_size_in) ? species.adult_size_in : 2.5;
  const density = Number.isFinite(species.density_factor) ? species.density_factor : 0.01;
  return size ** 3 * density;
}

export function listSensitiveSpecies(speciesEntries, parameter) {
  const results = [];
  for (const entry of speciesEntries) {
    const { species } = entry;
    if (!species) continue;
    if (parameter === 'pH' && (species.pH_sensitive || species.ph_sensitive)) {
      results.push(species.common_name);
    }
  }
  return results;
}

const TURNOVER_POINTS = [
  { x: 0, m: 0.85 },
  { x: 2, m: 0.85 },
  { x: 4, m: 1.0 },
  { x: 6, m: 1.08 },
  { x: 8, m: 1.14 },
  { x: 10, m: 1.2 },
];

function interpolateMultiplier(turnover) {
  if (!Number.isFinite(turnover) || turnover <= 0) {
    return 0.85;
  }
  const points = TURNOVER_POINTS;
  if (turnover <= points[1].x) {
    return points[1].m;
  }
  if (turnover >= points[points.length - 1].x) {
    return points[points.length - 1].m;
  }
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 1];
    if (turnover >= previous.x && turnover <= current.x) {
      const t = (turnover - previous.x) / (current.x - previous.x);
      return previous.m + (current.m - previous.m) * t;
    }
  }
  return points[points.length - 1].m;
}

function resolveEntry(entry) {
  if (!entry) return null;
  const species = getSpeciesById(entry.id);
  if (!species) return null;
  const qty = clamp(Number(entry.qty) || 0, 0, 999);
  if (qty <= 0) return null;
  const stage = entry.stage === 'juvenile' ? 'juvenile' : 'adult';
  const stageMultiplier = stage === 'juvenile' ? 0.6 : 1;
  const unit = autoBioloadUnit(species) * stageMultiplier;
  const bioload = unit * qty;
  return {
    id: species.id,
    qty,
    stage,
    species,
    bioloadUnit: unit,
    bioload,
    advisory: entry.advisory ?? '',
  };
}

function buildEntries(stock = []) {
  return stock.map(resolveEntry).filter(Boolean);
}

function buildCandidate(candidate) {
  const resolved = resolveEntry(candidate);
  if (!resolved) return null;
  return { ...resolved, isCandidate: true };
}

function calcTank(state, entries, overrideVariant) {
  const gallons = clamp(Number(state.gallons) || 0, 1, 999);
  const sump = clamp(Number(state.sumpGallons) || 0, 0, 400);
  const planted = Boolean(state.planted);
  const manualVariant = overrideVariant ?? state.variantId ?? null;
  const variant = pickTankVariant({ gallons, speciesEntries: entries, manualSelection: manualVariant })
    ?? pickTankVariant({ gallons, speciesEntries: [], manualSelection: manualVariant })
    ?? getTankVariants(gallons)[0]
    ?? null;

  const length = variant?.length ?? 0;
  const width = variant?.width ?? 0;
  const height = variant?.height ?? 0;
  const volume = gallons + 0.7 * sump;
  const turnover = clamp(Number(state.turnover) || 5, 0.5, 20);
  const multiplier = interpolateMultiplier(turnover);
  const plantedMultiplier = planted ? (state.tankAgeWeeks && state.tankAgeWeeks < 6 ? 1.05 : 1.15) : 1;
  const baseCapacity = volume * 0.06;
  const capacity = baseCapacity * multiplier * plantedMultiplier;
  const recommendedCapacity = state.beginnerMode ? capacity * 0.85 : capacity;
  const deliveredGph = turnover * volume;
  const ratedGph = deliveredGph / 0.78;

  return {
    gallons,
    sump,
    planted,
    variant,
    length,
    width,
    height,
    volume,
    turnover,
    multiplier,
    plantedMultiplier,
    baseCapacity,
    capacity,
    recommendedCapacity,
    deliveredGph,
    ratedGph,
  };
}

function calcConditionRange(entries, selector) {
  const mins = [];
  const maxs = [];
  for (const entry of entries) {
    const range = selector(entry.species) ?? [];
    const [min, max] = range;
    if (Number.isFinite(min)) mins.push(min);
    if (Number.isFinite(max)) maxs.push(max);
  }
  if (!mins.length || !maxs.length) {
    return [NaN, NaN];
  }
  return [Math.max(...mins), Math.min(...maxs)];
}

function conditionState(actual, range, options = {}) {
  const [min, max] = range;
  if (!Number.isFinite(actual) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return 'ok';
  }
  if (actual >= min && actual <= max) {
    return 'ok';
  }
  const { warnThreshold = 0, badThreshold = 0 } = options;
  if (actual < min) {
    return severityFromDelta(min - actual, warnThreshold, badThreshold);
  }
  if (actual > max) {
    return severityFromDelta(actual - max, warnThreshold, badThreshold);
  }
  return 'ok';
}

function describeConditionHint(level) {
  switch (level) {
    case 'bad':
      return '✖ Outside range';
    case 'warn':
      return '⚠ Slightly outside';
    default:
      return '✔ Within range';
  }
}

function gatherIssues(...entries) {
  return entries
    .filter(Boolean)
    .sort((a, b) => {
      const order = { bad: 2, warn: 1, ok: 0 };
      return (order[b.severity] ?? 0) - (order[a.severity] ?? 0);
    });
}

function statusFromIssues(issues) {
  const top = issues.find((issue) => issue.severity === 'bad')
    ?? issues.find((issue) => issue.severity === 'warn');
  if (!top) {
    return { severity: 'ok', label: '✔ Looks good — headroom available' };
  }
  const icon = calcSeverityIcon(top.severity);
  return {
    severity: top.severity,
    label: `${icon} ${top.message}`,
  };
}

function turnoverBand(tank) {
  if (!tank) return { band: 'community', range: [6, 8] };
  const turnover = tank.turnover;
  if (turnover >= 9) {
    return { band: 'heavy/messy', range: [9, 10] };
  }
  if (tank.planted) {
    return { band: 'planted', range: [6, 8] };
  }
  if (turnover <= 6) {
    return { band: 'low-flow', range: [4, 6] };
  }
  return { band: 'community', range: [8, 9] };
}

function createConditionItem({ key, label, range, actual, infoKey, severity, extra }) {
  return {
    key,
    label,
    range,
    actual,
    infoKey,
    severity,
    hint: describeConditionHint(severity),
    extra,
  };
}

function computeConditions(state, entries, candidate, water, showMore) {
  const combined = candidate ? [...entries, candidate] : [...entries];
  const baseRange = (selector) => calcConditionRange(combined, selector);

  const tempRange = baseRange((species) => species.temperature);
  const tempSeverity = conditionState(water.temperature, tempRange, { warnThreshold: 2, badThreshold: 2.01 });

  const pHRange = baseRange((species) => species.pH);
  const sensitive = listSensitiveSpecies(combined, 'pH');
  const warn = sensitive.length ? 0.2 : 0.5;
  let bad = sensitive.length ? 0.2 : 0.5;
  if ((water.kH ?? 0) >= 3) {
    bad += 0.2;
  }
  const phSeverity = conditionState(water.pH, pHRange, { warnThreshold: warn, badThreshold: bad });

  const ghRange = baseRange((species) => species.gH);
  const ghSeverity = conditionState(water.gH, ghRange, { warnThreshold: 2, badThreshold: 2.01 });

  const khRange = baseRange((species) => species.kH);
  const khSeverity = conditionState(water.kH, khRange, { warnThreshold: 2, badThreshold: 2.01 });

  const salinityCheck = evaluateSalinity(candidate ?? { species: null }, { water });
  const flowCheck = evaluateFlow(candidate ?? { species: null }, water);
  const blackwaterCheck = evaluateBlackwater(candidate ?? { species: null }, water);

  const conditions = [
    createConditionItem({ key: 'temperature', label: 'Temperature', range: tempRange, actual: `${formatNumber(water.temperature, { maximumFractionDigits: 1 })}°F`, severity: tempSeverity }),
    createConditionItem({ key: 'pH', label: 'pH', range: pHRange, actual: `${formatNumber(water.pH, { maximumFractionDigits: 2 })}`, infoKey: sensitive.length ? 'ph-sensitive' : null, severity: phSeverity, extra: sensitive.length ? `Sensitive: ${sensitive.join(', ')}` : null }),
    createConditionItem({ key: 'gH', label: 'gH', range: ghRange, actual: `${formatNumber(water.gH, { maximumFractionDigits: 1 })} dGH`, infoKey: 'gh', severity: ghSeverity }),
  ];

  const optional = [];
  optional.push(createConditionItem({ key: 'kH', label: 'kH', range: khRange, actual: `${formatNumber(water.kH, { maximumFractionDigits: 1 })} dKH`, infoKey: 'kh', severity: khSeverity }));
  const salinityActual = SUPPORTED_SALINITY.has(water.salinity)
    ? (SALINITY_LABEL[water.salinity] ?? water.salinity)
    : '— (See warning)';
  optional.push({
    key: 'salinity',
    label: 'Salinity',
    range: [NaN, NaN],
    actual: salinityActual,
    infoKey: 'salinity',
    severity: salinityCheck.severity,
    hint: salinityCheck.severity === 'ok' ? '✔ Matching category' : salinityCheck.reason,
  });
  optional.push({
    key: 'flow',
    label: 'Flow',
    range: [NaN, NaN],
    actual: water.flow,
    infoKey: null,
    severity: flowCheck.severity,
    hint: flowCheck.severity === 'ok' ? '✔ Suitable' : flowCheck.reason,
  });
  optional.push({
    key: 'blackwater',
    label: 'Blackwater / Tannins',
    range: [NaN, NaN],
    actual: water.blackwater ? 'Enabled' : 'Off',
    infoKey: 'blackwater',
    severity: blackwaterCheck.severity,
    hint: blackwaterCheck.severity === 'ok' ? (candidate?.species?.blackwater === 'prefers' ? 'Tip: benefits from tannins' : '✔ Balanced') : blackwaterCheck.reason,
  });

  const filteredOptional = optional.filter((item) => {
    if (showMore) return true;
    if (item.key === 'kH' && Number.isFinite(khRange[0])) return true;
    if (item.key === 'salinity' && item.severity !== 'ok') return true;
    if (item.key === 'flow' && item.severity !== 'ok') return true;
    if (item.key === 'blackwater' && item.severity !== 'ok') return true;
    return false;
  });

  return { conditions: [...conditions, ...filteredOptional], salinityCheck, flowCheck, blackwaterCheck, phSeverity, tempSeverity, ghSeverity, khSeverity };
}

function computeBioload(tank, entries, candidate, beginnerMode) {
  const currentLoad = sum(entries, (entry) => entry.bioload);
  const candidateLoad = candidate?.bioload ?? 0;
  const proposed = currentLoad + candidateLoad;
  const capacity = Math.max(tank.recommendedCapacity, 0.0001);
  const currentPercent = currentLoad / capacity;
  const proposedPercent = proposed / capacity;
  const color = getBandColor(proposedPercent);
  const turnoverIssue = tank.turnover < 2;
  const severity = proposedPercent > 1.1 ? 'bad' : proposedPercent > 0.9 ? 'warn' : turnoverIssue ? 'warn' : 'ok';
  const text = `${percentLabel(currentPercent, proposedPercent)} of capacity`;
  const message = turnoverIssue ? 'Turnover below 2× — upgrade filtration' : undefined;
  const badge = candidate && !Number.isFinite(candidate.species.bioload_unit) ? 'estimated' : null;
  return {
    currentLoad,
    candidateLoad,
    proposed,
    capacity,
    currentPercent,
    proposedPercent,
    color,
    severity,
    text,
    message,
    badge,
  };
}

function computeAggression(tank, entries, candidate) {
  if (!candidate) {
    return { severity: 'ok', reasons: [], score: 0, label: 'No conflicts' };
  }
  const reasons = [];
  let severity = 'ok';
  for (const entry of entries) {
    const result = evaluatePair(candidate, entry, { length: tank.length });
    severity = severity === 'bad' ? 'bad' : (severity === 'warn' && result.severity === 'bad' ? 'bad' : severity);
    if (result.severity === 'bad' || result.severity === 'warn') {
      severity = severity === 'bad' ? 'bad' : result.severity;
      if (result.reasons.length) {
        reasons.push(result.reasons[0]);
      }
    }
  }
  const label = reasons.length ? reasons[0] : 'No conflicts';
  const score = severity === 'bad' ? 90 : severity === 'warn' ? 45 : 0;
  return { severity, reasons, score, label };
}

function computeChips({ tank, candidate, entries, groupRule, salinityCheck, flowCheck, blackwaterCheck, bioload, conditions }) {
  const chips = [];
  if (!candidate) return chips;
  if (candidate.species.min_tank_length_in && candidate.species.min_tank_length_in > tank.length) {
    chips.push({ tone: 'bad', text: `Needs ${candidate.species.min_tank_length_in}″ tank length (yours ${tank.length}″)` });
  }
  if (groupRule) {
    chips.push({ tone: groupRule.severity === 'bad' ? 'bad' : 'warn', text: groupRule.message });
  }
  if (salinityCheck?.severity && salinityCheck.severity !== 'ok') {
    chips.push({ tone: salinityCheck.severity === 'bad' ? 'bad' : 'warn', text: salinityCheck.reason });
  }
  if (flowCheck?.severity && flowCheck.severity !== 'ok') {
    chips.push({ tone: flowCheck.severity === 'bad' ? 'bad' : 'warn', text: flowCheck.reason });
  }
  if (blackwaterCheck?.severity && blackwaterCheck.severity !== 'ok') {
    chips.push({ tone: blackwaterCheck.severity === 'bad' ? 'bad' : 'warn', text: blackwaterCheck.reason });
  }
  if (bioload.severity !== 'ok') {
    chips.push({ tone: bioload.severity === 'bad' ? 'bad' : 'warn', text: bioload.severity === 'bad' ? 'Capacity exceeded' : 'High capacity use' });
  }
  const conditionIssues = conditions.conditions.filter((item) => item.severity !== 'ok');
  for (const condition of conditionIssues) {
    chips.push({ tone: condition.severity === 'bad' ? 'bad' : 'warn', text: `${condition.label}: ${condition.hint}` });
  }
  return chips;
}

function computeStatus({ bioload, aggression, conditions, groupRule, salinityCheck, flowCheck, blackwaterCheck }, beginnerMode) {
  const issues = [];
  issues.push({ severity: bioload.severity, message: bioload.severity === 'bad' ? 'Bioload exceeds recommended capacity' : 'Bioload nearing limit' });
  issues.push({ severity: aggression.severity, message: aggression.label });
  const conditionIssue = conditions.conditions.find((item) => item.severity === 'bad' || item.severity === 'warn');
  if (conditionIssue) {
    issues.push({ severity: conditionIssue.severity, message: `${conditionIssue.label}: ${conditionIssue.hint}` });
  }
  if (groupRule) {
    issues.push({ severity: groupRule.severity, message: groupRule.message });
  }
  if (salinityCheck?.severity) {
    issues.push({ severity: salinityCheck.severity, message: salinityCheck.reason });
  }
  if (flowCheck?.severity) {
    issues.push({ severity: flowCheck.severity, message: flowCheck.reason });
  }
  if (blackwaterCheck?.severity) {
    issues.push({ severity: blackwaterCheck.severity, message: blackwaterCheck.reason });
  }
  const filtered = gatherIssues(...issues);
  const status = statusFromIssues(filtered);

  const blockReasons = [];
  if (beginnerMode) {
    if (bioload.proposedPercent > 1.1) {
      blockReasons.push('Bioload exceeds beginner buffer');
    }
    if (salinityCheck?.severity === 'bad') {
      blockReasons.push('Salinity mismatch');
    }
    if (conditions.conditions.some((item) => item.severity === 'bad')) {
      blockReasons.push('Water parameters outside safe range');
    }
  }
  return { status, blockReasons };
}

function computeDiagnostics({ tank, bioload, aggression, status, candidate, entries }) {
  const lines = [];
  lines.push(`Tank variant: ${tank.variant ? tank.variant.name : 'n/a'} (${tank.length}″)`);
  lines.push(`Capacity (recommended): ${roundTo(tank.recommendedCapacity, 3)} units`);
  lines.push(`Current load: ${roundTo(bioload.currentLoad, 3)} | Proposed: ${roundTo(bioload.proposed, 3)}`);
  lines.push(`Bioload %: ${formatPercent(bioload.currentPercent)} → ${formatPercent(bioload.proposedPercent)}`);
  lines.push(`Aggression: ${aggression.label} (${aggression.severity})`);
  lines.push(`Entries: ${entries.length}${candidate ? ` + candidate ${candidate.species.common_name}` : ''}`);
  lines.push(status.status.label);
  return lines;
}

function sanitizeWater(state) {
  return {
    temperature: Number(state.temperature) || 78,
    pH: Number(state.pH) || 7,
    gH: Number(state.gH) || 6,
    kH: Number(state.kH) || 3,
    salinity: (() => {
      const raw = typeof state.salinity === 'string' ? state.salinity : 'fresh';
      if (raw === 'marine') return 'marine';
      return SUPPORTED_SALINITY.has(raw) ? raw : 'fresh';
    })(),
    flow: state.flow || 'moderate',
    blackwater: Boolean(state.blackwater),
  };
}

export function buildComputedState(state) {
  const entries = buildEntries(state.stock);
  const candidate = buildCandidate(state.candidate);
  const tank = calcTank(state, entries, state.variantId);
  const water = sanitizeWater(state.water ?? {});
  const conditions = computeConditions(state, entries, candidate, water, state.showTips);
  const bioload = computeBioload(tank, entries, candidate, state.beginnerMode);
  const aggression = computeAggression(tank, entries, candidate);
  const invertCheck = candidate ? evaluateInvertSafety(candidate.species, { water }) : { severity: 'ok' };
  const beginnerInvert = candidate ? beginnerInvertBlock(candidate, entries, state.beginnerMode) : { severity: 'ok' };
  const groupRule = candidate ? checkGroupRule(candidate, entries) : null;

  const chips = computeChips({ tank, candidate, entries, groupRule, salinityCheck: conditions.salinityCheck, flowCheck: conditions.flowCheck, blackwaterCheck: conditions.blackwaterCheck, bioload, conditions });
  if (invertCheck.severity !== 'ok') {
    chips.push({ tone: invertCheck.severity === 'bad' ? 'bad' : 'warn', text: invertCheck.reason });
  }
  if (beginnerInvert.severity === 'bad') {
    chips.push({ tone: 'bad', text: beginnerInvert.reason });
  }

  const { status, blockReasons } = computeStatus({ bioload, aggression, conditions, groupRule, salinityCheck: conditions.salinityCheck, flowCheck: conditions.flowCheck, blackwaterCheck: conditions.blackwaterCheck }, state.beginnerMode);

  if (beginnerInvert.severity === 'bad') {
    blockReasons.push(beginnerInvert.reason);
  }

  const diagnostics = computeDiagnostics({ tank, bioload, aggression, status, candidate, entries });

  return {
    tank,
    entries,
    candidate,
    water,
    conditions,
    bioload,
    aggression,
    chips,
    invertCheck,
    status,
    blockReasons,
    diagnostics,
    turnover: turnoverBand(tank),
  };
}

export function runScenario(baseState, overrides) {
  const next = {
    ...baseState,
    ...overrides,
  };
  if (overrides?.stock) {
    next.stock = overrides.stock;
  }
  if (overrides?.candidate) {
    next.candidate = overrides.candidate;
  }
  if (overrides?.water) {
    next.water = overrides.water;
  }
  return buildComputedState(next);
}

export function runSanitySuite(baseState) {
  const results = [];
  const base = { ...baseState };

  const scenario1 = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    stock: [{ id: 'cardinal', qty: 12, stage: 'adult' }],
  });
  results.push(`1) 20g, 12 cardinal tetras → Load ${roundTo(scenario1.bioload.proposed, 3)} | Usage ${formatPercent(scenario1.bioload.proposedPercent)}`);

  const scenario2 = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    stock: [
      { id: 'cardinal', qty: 12, stage: 'adult' },
      { id: 'betta_male', qty: 1, stage: 'adult' },
    ],
  });
  results.push(`2) + Betta → Load ${roundTo(scenario2.bioload.proposed, 3)} | Usage ${formatPercent(scenario2.bioload.proposedPercent)}`);

  const scenario2p = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: true,
    stock: [
      { id: 'cardinal', qty: 12, stage: 'adult' },
      { id: 'betta_male', qty: 1, stage: 'adult' },
    ],
  });
  results.push(`   Planted → Usage ${formatPercent(scenario2p.bioload.proposedPercent)}`);

  const scenario3 = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    stock: [
      { id: 'cardinal', qty: 12, stage: 'adult' },
      { id: 'betta_male', qty: 1, stage: 'adult' },
      { id: 'cory_panda', qty: 6, stage: 'adult' },
    ],
  });
  results.push(`3) +6 panda corys → Load ${roundTo(scenario3.bioload.proposed, 3)} | Usage ${formatPercent(scenario3.bioload.proposedPercent)}`);

  const scenario3p = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: true,
    stock: [
      { id: 'cardinal', qty: 12, stage: 'adult' },
      { id: 'betta_male', qty: 1, stage: 'adult' },
      { id: 'cory_panda', qty: 6, stage: 'adult' },
    ],
  });
  results.push(`   Planted → Usage ${formatPercent(scenario3p.bioload.proposedPercent)}`);

  const scenario4 = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    stock: [
      { id: 'cardinal', qty: 12, stage: 'adult' },
      { id: 'cory_panda', qty: 6, stage: 'adult' },
    ],
    candidate: { id: 'tigerbarb', qty: 2, stage: 'adult' },
  });
  results.push(`4) +2 tiger barbs → ${scenario4.status.status.label}`);

  const scenario5 = runScenario(base, {
    gallons: 10,
    turnover: 4,
    planted: false,
    stock: [{ id: 'betta_male', qty: 1, stage: 'adult' }],
  });
  results.push(`5) 10g solo betta → Bioload ${formatPercent(scenario5.bioload.proposedPercent)} | Agg ${scenario5.aggression.label}`);

  const scenario6a = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    water: { temperature: 78, pH: 7.6, gH: 6, kH: 3, salinity: 'fresh', flow: 'moderate', blackwater: false },
    stock: [{ id: 'cardinal', qty: 10, stage: 'adult' }],
  });
  results.push(`6) pH 7.6 vs Cardinal → ${scenario6a.conditions.conditions.find((c) => c.key === 'pH')?.hint ?? ''}`);
  const scenario6b = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    water: { temperature: 78, pH: 7.6, gH: 12, kH: 5, salinity: 'brackish-low', flow: 'moderate', blackwater: false },
    stock: [{ id: 'nerite', qty: 2, stage: 'adult' }],
  });
  results.push(`   Nerite snail → ${scenario6b.conditions.conditions.find((c) => c.key === 'pH')?.hint ?? ''}`);

  const scenario7a = runScenario(base, {
    gallons: 10,
    turnover: 4,
    planted: true,
    beginnerMode: true,
    stock: [{ id: 'neocaridina', qty: 12, stage: 'adult' }],
    candidate: { id: 'betta_male', qty: 1, stage: 'adult' },
  });
  results.push(`7) Shrimp + Betta (Beginner) → ${scenario7a.blockReasons.join('; ') || scenario7a.status.status.label}`);
  const scenario7b = runScenario(base, {
    gallons: 10,
    turnover: 4,
    planted: true,
    beginnerMode: false,
    stock: [{ id: 'neocaridina', qty: 12, stage: 'adult' }],
    candidate: { id: 'betta_male', qty: 1, stage: 'adult' },
  });
  results.push(`   Advanced → ${scenario7b.status.status.label}`);

  return results;
}

export function runStressSuite(baseState) {
  const results = [];
  const scenario = runScenario(baseState, {
    gallons: 40,
    turnover: 9.5,
    planted: false,
    stock: [{ id: 'cardinal', qty: 30, stage: 'adult' }],
  });
  results.push(`40g heavy stock → Delivered ${roundTo(scenario.tank.deliveredGph, 1)} gph | Rated ${roundTo(scenario.tank.ratedGph, 1)} gph | Mult ${roundTo(scenario.tank.multiplier, 3)}`);
  return results;
}

export function createDefaultState() {
  return {
    gallons: 20,
    planted: false,
    showTips: false,
    beginnerMode: true,
    turnover: 5,
    sumpGallons: 0,
    tankAgeWeeks: 12,
    variantId: null,
    stock: [],
    candidate: { id: getDefaultSpeciesId(), qty: 1, stage: 'adult' },
    water: { temperature: 78, pH: 7.2, gH: 6, kH: 3, salinity: 'fresh', flow: 'moderate', blackwater: false },
  };
}

export const ALL_SPECIES = SPECIES_LIST;
