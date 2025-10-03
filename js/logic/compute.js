import { FISH_DB } from "../fish-data.js";
import { validateSpeciesRecord } from "./speciesSchema.js";
import { EMPTY_TANK } from '../stocking/tankStore.js';
import { getEffectiveGallons, getTotalGE, computeBioloadPercent, formatBioloadPercent, PLANTED_CAPACITY_BONUS } from '../bioload.js';
import { pickTankVariant, getTankVariants, describeVariant } from './sizeMap.js';
import { BEHAVIOR_TAGS } from './behaviorTags.js';
import {
  clamp,
  formatNumber,
  formatPercent,
  sum,
  roundTo,
  getBandColor,
  severityFromDelta,
  calcSeverityIcon,
} from './utils.js';
import {
  evaluateInvertSafety,
  evaluateSalinity,
  evaluateFlow,
  evaluateBlackwater,
  checkGroupRule,
  HARD_CONFLICTS,
  keyPair,
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
  if (Number.isFinite(species.bioloadGE)) {
    return species.bioloadGE;
  }
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
  const unit = autoBioloadUnit(species);
  const bioload = unit * qty;
  return {
    id: species.id,
    qty,
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
  const tankState = state?.tank ?? EMPTY_TANK;
  const hasTankGallons = Number.isFinite(tankState.gallons) && tankState.gallons > 0;
  const gallonsSource = hasTankGallons ? tankState.gallons : Number(state.gallons) || 0;
  const gallons = clamp(gallonsSource, 0, 999);
  const tankId = tankState?.id ?? null;
  const sump = clamp(Number(state.sumpGallons) || 0, 0, 400);
  const planted = Boolean(state.planted);
  const manualVariant = overrideVariant ?? state.variantId ?? null;
  const variant = pickTankVariant({ tankId, gallons, speciesEntries: entries, manualSelection: manualVariant })
    ?? pickTankVariant({ tankId, gallons, speciesEntries: [], manualSelection: manualVariant })
    ?? getTankVariants({ tankId, gallons })[0]
    ?? null;

  const resolveDimension = (value, fallback) => {
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
    return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
  };

  const lengthIn = resolveDimension(tankState.lengthIn, variant?.length);
  const widthIn = resolveDimension(tankState.widthIn, variant?.width);
  const heightIn = resolveDimension(tankState.heightIn, variant?.height);

  const length = Number.isFinite(lengthIn) ? lengthIn : 0;
  const width = Number.isFinite(widthIn) ? widthIn : 0;
  const height = Number.isFinite(heightIn) ? heightIn : 0;
  const volume = gallons + 0.7 * sump;
  const turnover = clamp(Number(state.turnover) || 5, 0.5, 20);
  const multiplier = interpolateMultiplier(turnover);
  const plantedMultiplier = planted ? (1 + PLANTED_CAPACITY_BONUS) : 1;
  const effectiveGallons = getEffectiveGallons(gallons, { planted });
  const baseCapacity = effectiveGallons;
  const capacity = effectiveGallons;
  const recommendedCapacity = effectiveGallons;
  const deliveredGph = turnover * volume;
  const ratedGph = deliveredGph / 0.78;

  return {
    gallons,
    sump,
    planted,
    variant,
    presetId: tankState.id ?? null,
    presetLabel: tankState.label ?? '',
    length,
    lengthIn,
    width,
    widthIn,
    height,
    heightIn,
    volume,
    turnover,
    multiplier,
    plantedMultiplier,
    baseCapacity,
    capacity,
    recommendedCapacity,
    effectiveGallons,
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

function mapEntriesToStock(entries = []) {
  return entries.map((entry) => ({ speciesId: entry.id, count: entry.qty }));
}

function computeBioload(tank, entries, candidate) {
  const currentStock = mapEntriesToStock(entries);
  const candidateStock = candidate ? [{ speciesId: candidate.id, count: candidate.qty }] : [];
  const proposedStock = candidate ? [...currentStock, ...candidateStock] : currentStock;

  const currentLoad = getTotalGE(currentStock, SPECIES_MAP);
  const candidateLoad = getTotalGE(candidateStock, SPECIES_MAP);
  const proposed = getTotalGE(proposedStock, SPECIES_MAP);

  const effectiveGallons = getEffectiveGallons(tank.gallons, { planted: tank.planted });
  const capacity = Math.max(effectiveGallons, 0.0001);
  const currentPercentValue = computeBioloadPercent({
    gallons: tank.gallons,
    planted: tank.planted,
    currentStock,
    speciesMap: SPECIES_MAP,
  });
  const proposedPercentValue = computeBioloadPercent({
    gallons: tank.gallons,
    planted: tank.planted,
    currentStock: proposedStock,
    speciesMap: SPECIES_MAP,
  });
  const currentPercent = currentPercentValue / 100;
  const proposedPercent = proposedPercentValue / 100;
  const color = getBandColor(proposedPercent);
  const turnoverIssue = tank.turnover < 2;
  const severity = proposedPercent > 1.1 ? 'bad' : proposedPercent > 0.9 ? 'warn' : turnoverIssue ? 'warn' : 'ok';
  const text = `${formatBioloadPercent(currentPercentValue)} → ${formatBioloadPercent(proposedPercentValue)} of capacity`;
  const message = turnoverIssue ? 'Turnover below 2× — upgrade filtration' : undefined;
  const badge = candidate && !Number.isFinite(candidate.species.bioloadGE) ? 'estimated' : null;
  return {
    currentLoad,
    candidateLoad,
    proposed,
    capacity,
    effectiveGallons,
    currentPercent,
    proposedPercent,
    color,
    severity,
    text,
    message,
    badge,
  };
}

const {
  FIN_NIPPER,
  LONG_FIN_VULNERABLE,
  SLOW_SWIMMER,
  TERRITORIAL,
  FAST_ACTIVE,
  SHOALING,
} = BEHAVIOR_TAGS;

const UNDERSTOCK_SEVERITY = 35;
const TERRITORIAL_CROWDING_SEVERITY = 80;

function toBehaviorSet(species) {
  if (!species) return new Set();
  const raw = Array.isArray(species.behavior) ? species.behavior : [];
  return new Set(raw.map((tag) => String(tag)));
}

function resolveAggressionTraits(species) {
  if (!species) {
    return {
      finNipper: false,
      longFins: false,
      slowLongFins: false,
      aggressive: false,
      semiAggressive: false,
      bettaMale: false,
      fastActive: false,
    };
  }
  const tags = new Set((Array.isArray(species.tags) ? species.tags : []).map((tag) => String(tag).toLowerCase()));
  const behavior = toBehaviorSet(species);
  const aggressionScore = Number(species.aggression) || 0;
  const finNipper = tags.has('fin_nipper') || behavior.has(FIN_NIPPER);
  const longFins = tags.has('long_fins') || behavior.has(LONG_FIN_VULNERABLE);
  const slowSwimmer = tags.has('slow_swimmer') || behavior.has(SLOW_SWIMMER);
  const slowLongFins = tags.has('slow_long_fins') || (longFins && slowSwimmer);
  const aggressive = tags.has('aggressive') || tags.has('territorial') || behavior.has(TERRITORIAL) || aggressionScore >= 70;
  const semiAggressive = tags.has('semi_aggressive');
  const bettaMale = species.id === 'betta_male' || tags.has('betta_male');
  const fastActive = behavior.has(FAST_ACTIVE) || tags.has('fast_swimmer');
  return {
    finNipper,
    longFins,
    slowLongFins,
    slowSwimmer,
    aggressive,
    semiAggressive,
    bettaMale,
    fastActive,
  };
}

function normalizePairOrder(aGroup, bGroup) {
  const list = [aGroup, bGroup].filter((group) => group?.species);
  list.sort((left, right) => {
    const leftName = (left.species.common_name || left.species.commonName || left.species.id || '').toLowerCase();
    const rightName = (right.species.common_name || right.species.commonName || right.species.id || '').toLowerCase();
    if (leftName === rightName) {
      return (left.species.id || '').localeCompare(right.species.id || '');
    }
    return leftName.localeCompare(rightName);
  });
  return list;
}

function evaluateAggressionConflict(aGroup, bGroup) {
  if (!aGroup?.species || !bGroup?.species) {
    return null;
  }
  const [first, second] = normalizePairOrder(aGroup, bGroup);
  if (!first || !second) {
    return null;
  }
  const speciesA = first.species;
  const speciesB = second.species;
  const traitsA = resolveAggressionTraits(speciesA);
  const traitsB = resolveAggressionTraits(speciesB);
  const pairKey = keyPair(speciesA.id, speciesB.id);

  const rules = [];
  const severityRank = { error: 2, warn: 1 };
  const addRule = (rule, severity, message, priority) => {
    if (!rule || !message) return;
    rules.push({ rule, severity, message, priority });
  };

  if (HARD_CONFLICTS.has(pairKey)) {
    addRule('hard_pair', 'error', 'known conflict pairing', -1);
  }
  if (traitsA.finNipper && traitsB.longFins) {
    addRule('fin_nip', 'error', 'fin-nipping risk', 0);
  }
  if (traitsB.finNipper && traitsA.longFins) {
    addRule('fin_nip', 'error', 'fin-nipping risk', 0);
  }
  if (traitsA.aggressive && traitsB.aggressive && speciesA.id !== speciesB.id) {
    addRule('aggressive_pair', 'warn', 'territorial conflict', 4);
  }
  if (traitsA.aggressive && traitsB.slowLongFins) {
    addRule('agg_vs_slow_long', 'error', 'targets slow, long-finned fish', 2);
  }
  if (traitsB.aggressive && traitsA.slowLongFins) {
    addRule('agg_vs_slow_long', 'error', 'targets slow, long-finned fish', 2);
  }
  if (traitsA.semiAggressive && traitsB.longFins) {
    addRule('semi_vs_long', 'warn', 'may nip long fins', 3);
  }
  if (traitsB.semiAggressive && traitsA.longFins) {
    addRule('semi_vs_long', 'warn', 'may nip long fins', 3);
  }
  if (traitsA.bettaMale && (traitsB.finNipper || traitsB.aggressive || traitsB.semiAggressive)) {
    addRule('betta_conflict', 'error', 'betta targeted / provokes retaliation', 1);
  }
  if (traitsB.bettaMale && (traitsA.finNipper || traitsA.aggressive || traitsA.semiAggressive)) {
    addRule('betta_conflict', 'error', 'betta targeted / provokes retaliation', 1);
  }

  if (!rules.length) {
    return null;
  }

  rules.sort((left, right) => {
    const diff = (severityRank[right.severity] ?? 0) - (severityRank[left.severity] ?? 0);
    if (diff !== 0) return diff;
    return (left.priority ?? 0) - (right.priority ?? 0);
  });

  const best = rules[0];
  const highestSeverity = best.severity;
  const messageSet = new Set();
  for (const rule of rules) {
    if (rule.severity === highestSeverity) {
      messageSet.add(rule.message);
    }
  }
  const combinedMessage = Array.from(messageSet).join('; ');

  return {
    aId: speciesA.id,
    bId: speciesB.id,
    rule: best.rule,
    severity: highestSeverity === 'error' ? 'error' : 'warn',
    message: combinedMessage || best.message,
  };
}

function resolveMinGroup(species) {
  if (!species) return 0;
  const direct = Number(species.min_group);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.floor(direct);
  }
  const fallback = Number(species.group?.min);
  if (Number.isFinite(fallback) && fallback > 0) {
    return Math.floor(fallback);
  }
  return 0;
}

function aggressionSeverity(score) {
  if (!Number.isFinite(score) || score <= 0) return 'ok';
  if (score >= 75) return 'bad';
  return 'warn';
}

function selectPairRule(aGroup, bGroup) {
  const matches = [];
  let priority = 0;
  const add = (severity, message) => {
    if (!message) return;
    const existing = matches.find((item) => item.message === message);
    if (existing) {
      existing.severity = Math.max(existing.severity, severity);
      return;
    }
    matches.push({ severity, message, priority });
    priority += 1;
  };

  const aName = aGroup.species.common_name;
  const bName = bGroup.species.common_name;
  const aTags = aGroup.behavior;
  const bTags = bGroup.behavior;

  if (aTags.has(FIN_NIPPER) && bTags.has(LONG_FIN_VULNERABLE)) {
    add(100, `Fin-nipping risk: ${aName} ↔ ${bName} (long fins).`);
  }
  if (bTags.has(FIN_NIPPER) && aTags.has(LONG_FIN_VULNERABLE)) {
    add(100, `Fin-nipping risk: ${bName} ↔ ${aName} (long fins).`);
  }
  if (aTags.has(FIN_NIPPER) && bTags.has(SLOW_SWIMMER)) {
    add(90, `Nips slow swimmers: ${aName} ↔ ${bName}.`);
  }
  if (bTags.has(FIN_NIPPER) && aTags.has(SLOW_SWIMMER)) {
    add(90, `Nips slow swimmers: ${bName} ↔ ${aName}.`);
  }
  if (aTags.has(TERRITORIAL) && bTags.has(LONG_FIN_VULNERABLE) && aGroup.species.id !== bGroup.species.id) {
    add(75, `Territorial disputes likely: ${aName} ↔ ${bName}.`);
  }
  if (bTags.has(TERRITORIAL) && aTags.has(LONG_FIN_VULNERABLE) && aGroup.species.id !== bGroup.species.id) {
    add(75, `Territorial disputes likely: ${bName} ↔ ${aName}.`);
  }
  const aSize = Number(aGroup.species.adult_size_in);
  const bSize = Number(bGroup.species.adult_size_in);
  if (aTags.has(FAST_ACTIVE) && bTags.has(SLOW_SWIMMER) && Number.isFinite(aSize) && Number.isFinite(bSize) && aSize >= bSize * 2) {
    add(70, `Stress from chasing/activity: ${aName} ↔ ${bName}.`);
  }
  if (bTags.has(FAST_ACTIVE) && aTags.has(SLOW_SWIMMER) && Number.isFinite(aSize) && Number.isFinite(bSize) && bSize >= aSize * 2) {
    add(70, `Stress from chasing/activity: ${bName} ↔ ${aName}.`);
  }
  if (HARD_CONFLICTS.has(keyPair(aGroup.species.id, bGroup.species.id))) {
    add(100, `Known conflict pairing: ${aName} ↔ ${bName}.`);
  }

  if (!matches.length) {
    return null;
  }

  matches.sort((left, right) => {
    if (right.severity !== left.severity) {
      return right.severity - left.severity;
    }
    return left.priority - right.priority;
  });
  return matches[0];
}

function computeAggression(tank, entries, candidate) {
  const combined = [];
  for (const entry of entries) {
    if (entry?.species && entry.qty > 0) {
      combined.push(entry);
    }
  }
  if (candidate?.species && candidate.qty > 0) {
    combined.push(candidate);
  }
  if (!combined.length) {
    return { severity: 'ok', reasons: [], score: 0, percent: 0, label: 'No conflicts detected.', conflicts: [] };
  }

  const groupsById = new Map();
  for (const entry of combined) {
    const id = entry.species.id;
    if (!groupsById.has(id)) {
      groupsById.set(id, {
        species: entry.species,
        qty: 0,
        behavior: toBehaviorSet(entry.species),
        contextBoost: 0,
      });
    }
    const group = groupsById.get(id);
    group.qty += Number(entry.qty) || 0;
  }

  const groups = Array.from(groupsById.values());
  if (!groups.length) {
    return { severity: 'ok', reasons: [], score: 0, percent: 0, label: 'No conflicts detected.', conflicts: [] };
  }

  const contextIssues = [];
  const contextSeverities = [];
  const tankLength = Number.isFinite(tank?.length) && tank.length > 0
    ? tank.length
    : Number(tank?.lengthIn) || 0;

  for (const group of groups) {
    const { species, behavior, qty } = group;
    if (behavior.has(SHOALING)) {
      const minGroup = resolveMinGroup(species);
      if (minGroup > 0 && qty > 0 && qty < minGroup) {
        group.contextBoost += UNDERSTOCK_SEVERITY;
        const message = `${species.common_name} understocked (needs ${minGroup}+). Under-grouping increases nipping/aggression.`;
        contextIssues.push({ severity: UNDERSTOCK_SEVERITY, message });
        contextSeverities.push(UNDERSTOCK_SEVERITY);
      }
    }
    if (behavior.has(TERRITORIAL) && qty >= 2) {
      const required = Number(species.min_tank_length_in);
      if (Number.isFinite(required) && required > 0 && (!Number.isFinite(tankLength) || tankLength < required)) {
        group.contextBoost += TERRITORIAL_CROWDING_SEVERITY;
        const message = `Territory crowding among ${species.common_name}.`;
        contextIssues.push({ severity: TERRITORIAL_CROWDING_SEVERITY, message });
        contextSeverities.push(TERRITORIAL_CROWDING_SEVERITY);
      }
    }
  }

  const pairIssues = [];
  const pairConflicts = [];
  const severityPool = [];

  for (let index = 0; index < groups.length; index += 1) {
    const aGroup = groups[index];
    for (let otherIndex = index + 1; otherIndex < groups.length; otherIndex += 1) {
      const bGroup = groups[otherIndex];
      const match = selectPairRule(aGroup, bGroup);
      const contextSum = (aGroup.contextBoost || 0) + (bGroup.contextBoost || 0);
      if (match) {
        const combinedSeverity = Math.min(100, match.severity + contextSum);
        severityPool.push(combinedSeverity);
        pairIssues.push({ severity: combinedSeverity, message: match.message });
        const conflict = evaluateAggressionConflict(aGroup, bGroup);
        if (conflict) {
          pairConflicts.push(conflict);
        }
      } else if (contextSum > 0) {
        severityPool.push(Math.min(100, contextSum));
        const conflict = evaluateAggressionConflict(aGroup, bGroup);
        if (conflict) {
          pairConflicts.push(conflict);
        }
      } else {
        const conflict = evaluateAggressionConflict(aGroup, bGroup);
        if (conflict) {
          pairConflicts.push(conflict);
        }
      }
    }
  }

  const maxSeverity = Math.max(0, ...severityPool, ...contextSeverities);
  const severity = aggressionSeverity(maxSeverity);

  const severityOrder = { error: 2, warn: 1 };
  const conflicts = pairConflicts
    .filter((item) => item && item.aId && item.bId && item.message)
    .reduce((acc, item) => {
      const id = `aggr:${item.aId}:${item.bId}:${item.rule}`;
      if (acc.map.has(id)) {
        return acc;
      }
      acc.map.set(id, { ...item, id });
      acc.list.push({ ...item, id });
      return acc;
    }, { map: new Map(), list: [] }).list
    .sort((left, right) => {
      const diff = (severityOrder[right.severity] ?? 0) - (severityOrder[left.severity] ?? 0);
      if (diff !== 0) return diff;
      return (left.message || '').localeCompare(right.message || '');
    });

  const dedupedIssues = new Map();
  for (const issue of [...pairIssues, ...contextIssues]) {
    if (!issue?.message) continue;
    const existing = dedupedIssues.get(issue.message);
    if (!existing || existing.severity < issue.severity) {
      dedupedIssues.set(issue.message, issue);
    }
  }
  const sortedIssues = Array.from(dedupedIssues.values()).sort((a, b) => b.severity - a.severity);
  const topIssues = sortedIssues.slice(0, 3);
  const reasons = topIssues.map((issue) => issue.message);
  const label = topIssues[0]?.message ?? 'No conflicts detected.';

  return {
    severity,
    reasons,
    score: maxSeverity,
    percent: maxSeverity,
    label,
    conflicts,
  };
}

function computeChips({ tank, candidate, entries, groupRule, salinityCheck, flowCheck, blackwaterCheck, bioload, conditions }) {
  const chips = [];
  if (!candidate) return chips;
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

function computeStatus({ bioload, aggression, conditions, groupRule, salinityCheck, flowCheck, blackwaterCheck }) {
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

  const warnings = [];
  const seen = new Set();
  if (Array.isArray(aggression?.conflicts)) {
    for (const conflict of aggression.conflicts) {
      if (!conflict?.aId || !conflict?.bId || !conflict?.message) continue;
      const id = conflict.id || `aggr:${conflict.aId}:${conflict.bId}:${conflict.rule ?? 'rule'}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const aName = getSpeciesById(conflict.aId)?.common_name ?? conflict.aId;
      const bName = getSpeciesById(conflict.bId)?.common_name ?? conflict.bId;
      warnings.push({
        id,
        severity: conflict.severity === 'error' ? 'danger' : 'warn',
        icon: 'alert',
        kind: 'aggression',
        text: `Aggression conflict: ${aName} vs ${bName} — ${conflict.message}`,
      });
    }
  }

  const severityRank = { danger: 2, bad: 2, warn: 1, warning: 1 };
  warnings.sort((left, right) => {
    const diff = (severityRank[right.severity] ?? 0) - (severityRank[left.severity] ?? 0);
    if (diff !== 0) return diff;
    const leftText = (left.text || '').toLowerCase();
    const rightText = (right.text || '').toLowerCase();
    if (leftText < rightText) return -1;
    if (leftText > rightText) return 1;
    return 0;
  });

  return { ...status, warnings };
}

function computeDiagnostics({ tank, bioload, aggression, status, candidate, entries }) {
  const lines = [];
  lines.push(`Tank variant: ${tank.variant ? tank.variant.name : 'n/a'} (${tank.length}″)`);
  const effectiveGallons = Number.isFinite(bioload.effectiveGallons)
    ? bioload.effectiveGallons
    : Number.isFinite(tank.effectiveGallons)
      ? tank.effectiveGallons
      : 0;
  lines.push(`Effective gallons: ${roundTo(effectiveGallons, 3)}`);
  lines.push(`Current GE: ${roundTo(bioload.currentLoad, 3)} | Proposed GE: ${roundTo(bioload.proposed, 3)}`);
  lines.push(`Bioload %: ${formatBioloadPercent(bioload.currentPercent * 100)} → ${formatBioloadPercent(bioload.proposedPercent * 100)}`);
  lines.push(`Aggression: ${aggression.label} (${aggression.severity})`);
  lines.push(`Entries: ${entries.length}${candidate ? ` + candidate ${candidate.species.common_name}` : ''}`);
  lines.push(status.label);
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
  const bioload = computeBioload(tank, entries, candidate);
  const aggression = computeAggression(tank, entries, candidate);
  const invertCheck = candidate ? evaluateInvertSafety(candidate.species, { water }) : { severity: 'ok' };
  const groupRule = candidate ? checkGroupRule(candidate, entries) : null;

  const chips = computeChips({ tank, candidate, entries, groupRule, salinityCheck: conditions.salinityCheck, flowCheck: conditions.flowCheck, blackwaterCheck: conditions.blackwaterCheck, bioload, conditions });
  if (invertCheck.severity !== 'ok') {
    chips.push({ tone: invertCheck.severity === 'bad' ? 'bad' : 'warn', text: invertCheck.reason });
  }
  const status = computeStatus({ bioload, aggression, conditions, groupRule, salinityCheck: conditions.salinityCheck, flowCheck: conditions.flowCheck, blackwaterCheck: conditions.blackwaterCheck });

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
    diagnostics,
    turnover: turnoverBand(tank),
    stockCount: entries.length,
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
    stock: [{ id: 'cardinal', qty: 12 }],
  });
  results.push(`1) 20g, 12 cardinal tetras → Load ${roundTo(scenario1.bioload.proposed, 3)} | Usage ${formatPercent(scenario1.bioload.proposedPercent)}`);

  const scenario2 = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    stock: [
      { id: 'cardinal', qty: 12 },
      { id: 'betta_male', qty: 1 },
    ],
  });
  results.push(`2) + Betta → Load ${roundTo(scenario2.bioload.proposed, 3)} | Usage ${formatPercent(scenario2.bioload.proposedPercent)}`);

  const scenario2p = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: true,
    stock: [
      { id: 'cardinal', qty: 12 },
      { id: 'betta_male', qty: 1 },
    ],
  });
  results.push(`   Planted → Usage ${formatPercent(scenario2p.bioload.proposedPercent)}`);

  const scenario3 = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    stock: [
      { id: 'cardinal', qty: 12 },
      { id: 'betta_male', qty: 1 },
      { id: 'cory_panda', qty: 6 },
    ],
  });
  results.push(`3) +6 panda corys → Load ${roundTo(scenario3.bioload.proposed, 3)} | Usage ${formatPercent(scenario3.bioload.proposedPercent)}`);

  const scenario3p = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: true,
    stock: [
      { id: 'cardinal', qty: 12 },
      { id: 'betta_male', qty: 1 },
      { id: 'cory_panda', qty: 6 },
    ],
  });
  results.push(`   Planted → Usage ${formatPercent(scenario3p.bioload.proposedPercent)}`);

  const scenario4 = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    stock: [
      { id: 'cardinal', qty: 12 },
      { id: 'cory_panda', qty: 6 },
    ],
    candidate: { id: 'tigerbarb', qty: 2 },
  });
  results.push(`4) +2 tiger barbs → ${scenario4.status.label}`);

  const scenario5 = runScenario(base, {
    gallons: 10,
    turnover: 4,
    planted: false,
    stock: [{ id: 'betta_male', qty: 1 }],
  });
  results.push(`5) 10g solo betta → Bioload ${formatPercent(scenario5.bioload.proposedPercent)} | Agg ${scenario5.aggression.label}`);

  const scenario6a = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    water: { temperature: 78, pH: 7.6, gH: 6, kH: 3, salinity: 'fresh', flow: 'moderate', blackwater: false },
    stock: [{ id: 'cardinal', qty: 10 }],
  });
  results.push(`6) pH 7.6 vs Cardinal → ${scenario6a.conditions.conditions.find((c) => c.key === 'pH')?.hint ?? ''}`);
  const scenario6b = runScenario(base, {
    gallons: 20,
    turnover: 5,
    planted: false,
    water: { temperature: 78, pH: 7.6, gH: 12, kH: 5, salinity: 'brackish-low', flow: 'moderate', blackwater: false },
    stock: [{ id: 'nerite', qty: 2 }],
  });
  results.push(`   Nerite snail → ${scenario6b.conditions.conditions.find((c) => c.key === 'pH')?.hint ?? ''}`);

  return results;
}

export function runStressSuite(baseState) {
  const results = [];
  const scenario = runScenario(baseState, {
    gallons: 40,
    turnover: 9.5,
    planted: false,
    stock: [{ id: 'cardinal', qty: 30 }],
  });
  results.push(`40g heavy stock → Delivered ${roundTo(scenario.tank.deliveredGph, 1)} gph | Rated ${roundTo(scenario.tank.ratedGph, 1)} gph | Mult ${roundTo(scenario.tank.multiplier, 3)}`);
  return results;
}

export function createDefaultState() {
  return {
    gallons: 0,
    liters: 0,
    selectedTankId: null,
    tank: EMPTY_TANK,
    planted: false,
    showTips: false,
    turnover: 5,
    sumpGallons: 0,
    tankAgeWeeks: 12,
    variantId: null,
    stock: [],
    candidate: { id: getDefaultSpeciesId(), qty: '1' },
    water: { temperature: 78, pH: 7.2, gH: 6, kH: 3, salinity: 'fresh', flow: 'moderate', blackwater: false },
  };
}

export const ALL_SPECIES = SPECIES_LIST;
