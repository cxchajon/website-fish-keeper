import { FISH_DB } from "../fish-data.js";
import { validateSpeciesRecord } from "./speciesSchema.js";
import { EMPTY_TANK } from '../stocking/tankStore.js';
import { canonicalizeFilterType, sumGph } from '../utils.js';
import { getEffectiveGallons, getTotalGE, computeBioloadPercent, formatBioloadPercent } from '../bioload.js';
import { assessFiltration, FILTRATION_LEVELS, MIN_BIOLOGICAL_TURNOVER } from '../stocking-advisor/filtration/math.js';
import { pickTankVariant, getTankVariants, describeVariant } from './sizeMap.js';
import { BEHAVIOR_TAGS } from './behaviorTags.js';
import { evaluateStockWarnings } from './warnings.js';
import {
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

// Cache-policy marker read by the one-time stale-cache guard in stocking-advisor.html. It means "this
// copy was served under the revalidating /js/ policy (see _headers)"; it is never bumped per release.
(globalThis.__ttgRevalidatedModules ||= {})['compute-legacy'] = true;

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

export let SPECIES = Object.freeze(
  FISH_DB.filter((s) => validateSpeciesRecord(s) === true && s.salinity !== 'marine')
);

let NORMALIZED_SPECIES = SPECIES.map(normalizeSpecies);
let SPECIES_MAP = new Map(NORMALIZED_SPECIES.map((species) => [species.id, species]));
let ENGINE_SPECIES = Object.freeze(NORMALIZED_SPECIES);

export function getSpeciesById(id) {
  return SPECIES_MAP.get(id) ?? null;
}

export let SPECIES_LIST = ENGINE_SPECIES.map((species) => ({
  id: species.id,
  name: species.common_name,
}));

export function getDefaultSpeciesId() {
  return ENGINE_SPECIES[0]?.id ?? null;
}
export let ALL_SPECIES = SPECIES_LIST;

function rebuildSpeciesDataset(records) {
  SPECIES = Object.freeze(records);
  NORMALIZED_SPECIES = SPECIES.map(normalizeSpecies);
  SPECIES_MAP = new Map(NORMALIZED_SPECIES.map((species) => [species.id, species]));
  ENGINE_SPECIES = Object.freeze(NORMALIZED_SPECIES);
  SPECIES_LIST = ENGINE_SPECIES.map((species) => ({
    id: species.id,
    name: species.common_name,
  }));
  ALL_SPECIES = SPECIES_LIST;
}

// Records offered to the engine that it could not accept, keyed by id: { id, name, reason }.
let REJECTED_SPECIES = new Map();

// Where the engine's species records came from:
//   'legacy-default' — js/fish-data.js, before the advisor supplied its dataset (direct/unit use)
//   'loaded'         — the advisor's species.v2.json records (overrideSpeciesDataset)
//   'unavailable'    — species.v2.json failed to load; nothing can be evaluated
let DATASET_STATUS = { state: 'legacy-default', error: null };

export function getSpeciesDatasetStatus() {
  return { ...DATASET_STATUS };
}

// Called when the advisor's species data cannot be loaded. The engine is emptied rather than left
// on the legacy js/fish-data.js records, so every selection is reported as unevaluable and every
// result is marked unavailable instead of quietly using the old 20-species dataset.
export function markSpeciesDatasetUnavailable(error) {
  REJECTED_SPECIES = new Map();
  rebuildSpeciesDataset([]);
  DATASET_STATUS = { state: 'unavailable', error: error ? String(error) : 'species data failed to load' };
}

export function getRejectedSpecies() {
  return Array.from(REJECTED_SPECIES.values());
}

// Replaces the engine dataset with the advisor's species records. Once records are supplied the
// engine never falls back to the older js/fish-data.js list: a record that fails validation is
// recorded in REJECTED_SPECIES and any selection of it is flagged by flagUnevaluatedSpecies().
export function overrideSpeciesDataset(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return false;
  }
  const valid = [];
  const rejected = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const verdict = record.salinity === 'marine' ? 'marine not supported' : validateSpeciesRecord(record);
    if (verdict === true) {
      valid.push(record);
      continue;
    }
    const id = record.id ?? record.slug ?? '(unknown)';
    rejected.set(id, { id, name: record.common_name || record.name || id, reason: verdict });
  }
  REJECTED_SPECIES = rejected;
  DATASET_STATUS = { state: 'loaded', error: null };
  if (rejected.size > 0) {
    console.error('[StockingAdvisor] Species records failed validation and cannot be evaluated:', getRejectedSpecies());
  }
  rebuildSpeciesDataset(valid);
  return valid.length > 0;
}

// Per-animal load in GE. Every evaluable record has a validated bioloadGE (see validateSpeciesRecord),
// so there is no size-based fallback estimate here.
export function autoBioloadUnit(species) {
  if (!species) return 0;
  return Number.isFinite(species.bioloadGE) ? species.bioloadGE : NaN;
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

// Clamp helper
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

// Filtration never scales the bioload percentage; it is assessed separately in
// buildFilteringState (see js/stocking-advisor/filtration/math.js).

const FILTER_TYPE_KEYS = new Set(['canister', 'hob', 'internal', 'sponge', 'ugf', 'none']);

export const FILTER_TURNOVER_MULTIPLIERS = Object.freeze({
  sponge: 4,
  internal: 5,
  ugf: 4.5,
  hob: 6,
  canister: 8,
  none: 0,
});

const IDEAL_TURNOVER_MULTIPLIER = FILTER_TURNOVER_MULTIPLIERS.hob;

const FILTER_TYPE_ALIASES = new Map([
  ['hob', 'hob'],
  ['hangonback', 'hob'],
  ['hangonbackhob', 'hob'],
  ['hobfilter', 'hob'],
  ['canister', 'canister'],
  ['canisterfilter', 'canister'],
  ['sponge', 'sponge'],
  ['spongefilter', 'sponge'],
  ['internal', 'internal'],
  ['internalfilter', 'internal'],
  ['powerfilter', 'internal'],
  ['ugf', 'ugf'],
  ['undergravel', 'ugf'],
  ['undergravelfilter', 'ugf'],
  ['none', 'none'],
  ['nofilter', 'none'],
]);

export function normalizeFilterTypeSelection(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (FILTER_TYPE_KEYS.has(trimmed)) {
      return trimmed;
    }
    const sanitized = trimmed.replace(/[^a-z]/g, '');
    const mapped = FILTER_TYPE_ALIASES.get(sanitized);
    if (mapped) {
      return mapped;
    }
  }
  return 'hob';
}

export function computeFilterFlowStats(gallons, filterType, overrideGph = null) {
  const type = normalizeFilterTypeSelection(filterType);
  const multiplier = FILTER_TURNOVER_MULTIPLIERS[type] ?? FILTER_TURNOVER_MULTIPLIERS.hob;
  const gallonValue = Number(gallons);
  const hasGallons = Number.isFinite(gallonValue) && gallonValue > 0;
  const overrideValue = Number(overrideGph);
  const hasOverride = Number.isFinite(overrideValue) && overrideValue > 0;
  const baseGph = hasGallons ? gallonValue * multiplier : 0;
  const actualGph = hasOverride ? overrideValue : baseGph;
  const idealGph = hasGallons ? gallonValue * IDEAL_TURNOVER_MULTIPLIER : null;
  return {
    type,
    multiplier,
    idealMultiplier: IDEAL_TURNOVER_MULTIPLIER,
    actualGph: actualGph > 0 ? actualGph : null,
    idealGph,
  };
}

export const TURNOVER_BANDS = Object.freeze({
  L: [3, 5],
  M: [5, 8],
  H: [8, 12],
});

export const MIN_TURNOVER_FLOOR = MIN_BIOLOGICAL_TURNOVER;

function clampFlowRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.min(Math.round(num), 1500);
}

function sanitizeFilter(filter) {
  if (!filter || typeof filter !== 'object') {
    return { id: null, type: 'HOB', rated_gph: 0 };
  }
  const id = typeof filter.id === 'string' && filter.id.trim() ? filter.id.trim() : null;
  const type = canonicalizeFilterType(filter.type ?? filter.kind ?? filter.filterType);
  const rated_gph = clampFlowRate(filter.rated_gph ?? filter.gph);
  return {
    id,
    type,
    rated_gph,
  };
}

export function sanitizeFilterList(filters) {
  if (!Array.isArray(filters)) return [];
  return filters.map((filter) => sanitizeFilter(filter));
}

function summarizeFilters(filters) {
  const sanitized = sanitizeFilterList(filters);
  const totalGph = sumGph(sanitized);
  return { sanitized, totalGph };
}

export function calcTotalGph(filters) {
  const { totalGph } = summarizeFilters(filters);
  return totalGph;
}

export function computeTurnover(effectiveGallons, filters) {
  const gallons = Number(effectiveGallons);
  if (!Number.isFinite(gallons) || gallons <= 0) {
    return 0;
  }
  const total = calcTotalGph(filters);
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return total / gallons;
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

function unevaluatedEntry(entry, isCandidate) {
  if (!entry || entry.id == null) return null;
  if ((Number(entry.qty) || 0) <= 0) return null;
  if (getSpeciesById(entry.id)) return null;
  const rejected = REJECTED_SPECIES.get(entry.id);
  return {
    id: entry.id,
    qty: Number(entry.qty),
    name: rejected?.name || entry.name || entry.common_name || String(entry.id),
    reason: rejected
      ? `failed validation (${rejected.reason})`
      : DATASET_STATUS.state === 'unavailable' ? 'could not be loaded' : 'has no record',
    isCandidate,
  };
}

// Selected species the engine has no usable record for. buildEntries() cannot include these, so
// they are listed here and surfaced to the user instead of silently dropping out of the results.
export function findUnevaluatedSpecies(stock = [], candidate = null) {
  const list = [];
  for (const entry of Array.isArray(stock) ? stock : []) {
    const missing = unevaluatedEntry(entry, false);
    if (missing) list.push(missing);
  }
  const missingCandidate = unevaluatedEntry(candidate, true);
  if (missingCandidate) list.push(missingCandidate);
  return list;
}

const UNEVALUATED_NOTE = 'Results incomplete — not every selected species could be evaluated.';

// Marks a computed state as incomplete when any selected species could not be evaluated: adds a
// red warning per species, forces the overall status to bad, and labels the bioload figure as
// incomplete. Safe to call more than once on the same state.
export function flagUnevaluatedSpecies(computed) {
  if (!computed) return computed;
  const missing = Array.isArray(computed.unevaluatedSpecies) ? computed.unevaluatedSpecies : [];
  const unavailable = DATASET_STATUS.state === 'unavailable';
  if (missing.length === 0 && !unavailable) {
    return computed;
  }
  const names = missing.map((item) => item.name).join(', ');
  const additions = unavailable ? [{
    id: 'species.dataUnavailable',
    severity: 'danger',
    icon: 'alert',
    kind: 'data',
    title: 'Species data failed to load',
    message: 'The Stocking Advisor could not load its species data, so no stocking level, compatibility, or water check can be calculated. Reload the page; if this keeps happening, please try again later.',
    text: 'Species data failed to load — results are unavailable.',
  }] : [];
  additions.push(...missing.map((item) => ({
    id: `species.unevaluated.${item.id}`,
    severity: 'danger',
    icon: 'alert',
    kind: 'data',
    title: `${item.name} could not be evaluated`,
    message: `${item.name} is selected but its species data ${item.reason}, so it is not counted in bioload, compatibility, or water checks. The results shown are incomplete — do not rely on them for this stock.`,
    text: `${item.name} could not be evaluated — results are incomplete.`,
  })));
  const warnings = mergeWarnings(computed.status?.warnings ?? [], additions);
  const status = {
    ...(computed.status || {}),
    severity: 'bad',
    label: unavailable
      ? `${calcSeverityIcon('bad')} Species data failed to load. Results are unavailable.`
      : `${calcSeverityIcon('bad')} Could not evaluate: ${names}. Results are incomplete.`,
    warnings,
    incomplete: true,
    unavailable,
  };
  const bioload = computed.bioload
    ? {
      ...computed.bioload,
      incomplete: true,
      severity: 'bad',
      text: computed.bioload.text && !computed.bioload.text.endsWith('(incomplete)')
        ? `${computed.bioload.text} (incomplete)`
        : computed.bioload.text,
      message: UNEVALUATED_NOTE,
    }
    : computed.bioload;
  return { ...computed, status, bioload };
}

const LITERS_PER_US_GALLON = 3.78541;

function formatGallons(liters) {
  const gallons = liters / LITERS_PER_US_GALLON;
  return `${Math.round(gallons * 10) / 10} gal`;
}

// Tank suitability per selected species, from the species' own minimums. Volume and length are
// separate requirements and checked separately: a tank below the minimum volume is unsuitable
// (red); a tank shorter than the species' minimum swimming length is flagged amber. Minimums are
// per species, not scaled by how many are planned — except where a species record carries a
// sourced `quantity_space` rule (territorial space per fish): then the required volume is
// max(min_tank_liters, quantity × liters_per_fish). That is a space check, independent of bioload.
function evaluateTankSuitability(tank, entries, candidate) {
  const issues = [];
  const warnings = [];
  const gallons = Number(tank?.gallons);
  // Whole litres: minimums quoted as "10 gal (38 L)" must pass a 10 gal (37.85 L) tank.
  const tankLiters = Number.isFinite(gallons) && gallons > 0 ? Math.round(gallons * LITERS_PER_US_GALLON) : null;
  const tankLength = Number.isFinite(tank?.length) && tank.length > 0 ? tank.length : null;
  const tooSmallFor = [];
  const seen = new Set();
  const quantities = new Map();
  for (const entry of [...entries, candidate]) {
    const id = entry?.species?.id;
    if (id) quantities.set(id, (quantities.get(id) || 0) + (Number(entry.qty) || 0));
  }
  for (const entry of [...entries, candidate]) {
    const species = entry?.species;
    if (!species || seen.has(species.id)) continue;
    seen.add(species.id);
    const name = species.common_name || species.id;
    const minLiters = Number(species.min_tank_liters);
    const quantity = quantities.get(species.id) || 0;
    const perFish = Number(species.quantity_space?.liters_per_fish);
    const groupLiters = Number.isFinite(perFish) && perFish > 0 ? quantity * perFish : 0;
    if (tankLiters != null && groupLiters > minLiters && tankLiters < groupLiters) {
      // The number planned needs more room than the single-fish minimum: report the space shortfall.
      const needed = Math.ceil(groupLiters);
      const message = `${quantity} × ${name} need at least ${needed} L (${formatGallons(needed)}) of territory — ${formatGallons(perFish)} per fish; this tank is ${Math.round(tankLiters)} L (${formatGallons(tankLiters)}). This is a space limit for the number of fish, not a waste (bioload) limit.`;
      issues.push({ severity: 'bad', message: `Not enough space for ${quantity} × ${name}` });
      tooSmallFor.push(`${quantity} × ${name}`);
      warnings.push({
        id: `tank.group_volume.${species.id}`,
        severity: 'danger',
        icon: 'alert',
        kind: 'tank',
        title: `Not enough space for ${quantity} × ${name}`,
        message,
        text: `Not enough space for ${quantity} × ${name} — ${message}`,
      });
    } else if (tankLiters != null && Number.isFinite(minLiters) && minLiters > 0 && tankLiters < minLiters) {
      const message = `${name} needs at least ${Math.round(minLiters)} L (${formatGallons(minLiters)}); this tank is ${Math.round(tankLiters)} L (${formatGallons(tankLiters)}).`;
      issues.push({ severity: 'bad', message: `Tank too small for ${name}` });
      tooSmallFor.push(name);
      warnings.push({
        id: `tank.volume.${species.id}`,
        severity: 'danger',
        icon: 'alert',
        kind: 'tank',
        title: `Tank too small for ${name}`,
        message,
        text: `Tank too small for ${name} — ${message}`,
      });
    }
    const minLength = Number(species.min_tank_length_in);
    if (tankLength != null && Number.isFinite(minLength) && minLength > 0 && tankLength < minLength) {
      const message = `${name} needs a tank at least ${minLength}″ long for swimming space; this tank is ${Math.round(tankLength * 10) / 10}″.`;
      issues.push({ severity: 'warn', message: `Tank too short for ${name}` });
      warnings.push({
        id: `tank.length.${species.id}`,
        severity: 'warn',
        icon: 'alert',
        kind: 'tank',
        title: `Tank too short for ${name}`,
        message,
        text: `Tank too short for ${name} — ${message}`,
      });
    }
  }
  return { issues, warnings, tooSmallFor: [...new Set(tooSmallFor)] };
}

// A capacity percentage is not meaningful for a tank a selected species cannot live in, so the
// bioload figure is marked as such (red, with the reason) rather than shown in its normal colour.
export function flagUnsuitableTank(computed) {
  const names = computed?.tankSuitability?.tooSmallFor;
  if (!Array.isArray(names) || names.length === 0 || !computed.bioload) {
    return computed;
  }
  const suffix = `(tank too small for ${names.join(', ')})`;
  const text = computed.bioload.text && !computed.bioload.text.includes(suffix)
    ? `${computed.bioload.text} ${suffix}`
    : computed.bioload.text;
  return {
    ...computed,
    bioload: { ...computed.bioload, tankUnsuitable: true, severity: 'bad', text },
  };
}

// Fish-on-fish predation from explicit species data only: a predator's preys_on_species lists the
// selectable fish its own record names as prey (species-adapter.v2.js → resolveFishPrey). There is
// no size-based inference. Likely predation is red.
function evaluateFishPredation(entries, candidate) {
  const issues = [];
  const warnings = [];
  const selected = new Map();
  for (const entry of [...entries, candidate]) {
    if (entry?.species && !selected.has(entry.species.id)) selected.set(entry.species.id, entry.species);
  }
  for (const predator of selected.values()) {
    const prey = Array.isArray(predator.preys_on_species) ? predator.preys_on_species : [];
    for (const { id, evidence } of prey) {
      const target = selected.get(id);
      if (!target || id === predator.id) continue;
      const predatorName = predator.common_name || predator.id;
      const preyName = target.common_name || id;
      const message = `${predatorName} is documented to eat ${preyName} (species data: “${evidence}”). Do not keep them together.`;
      issues.push({ severity: 'bad', message: `Predation risk: ${predatorName} may eat ${preyName}` });
      warnings.push({
        id: `predation.fish.${predator.id}.${id}`,
        severity: 'danger',
        icon: 'alert',
        kind: 'compatibility',
        title: `Predation risk: ${predatorName} may eat ${preyName}`,
        message,
        text: `Predation risk: ${predatorName} may eat ${preyName} — ${message}`,
      });
    }
  }
  return { issues, warnings };
}

// The plan warnings below re-state existing rules as persistent warnings over stock + candidate, so an
// issue stays in the stock warnings after Add instead of living only in a candidate chip or the
// Environmental card. Each keeps the severity its rule already assigns; none adds a relationship.

const GROUP_SEVERITY = { warn: 'warn', bad: 'danger' };

// Group / social / colony minimums and harem guidance: checkGroupRule, evaluated once per species on
// the combined planned quantity.
function evaluateGroupWarnings(entries, candidate) {
  const issues = [];
  const warnings = [];
  const combined = candidate ? [...entries, candidate] : [...entries];
  const seen = new Set();
  for (const entry of combined) {
    const species = entry?.species;
    if (!species || seen.has(species.id)) continue;
    seen.add(species.id);
    const rule = checkGroupRule({ species, qty: 0 }, combined);
    if (!rule) continue;
    const severity = GROUP_SEVERITY[rule.severity] ?? 'warn';
    const name = species.common_name || species.id;
    const { type, min } = species.group;
    const planned = combined
      .filter((item) => item?.species?.id === species.id)
      .reduce((total, item) => total + (Number(item.qty) || 0), 0);
    let title;
    let message;
    if (type === 'harem') {
      title = `Harem balance: ${name}`;
      message = `${name}: ${rule.message}.`;
    } else if (type === 'social') {
      title = `Group too small: ${name}`;
      message = `${name} is not a schooling fish, but should be kept in a group of at least ${min}. Planned: ${planned}.`;
    } else if (type === 'colony') {
      title = `Colony too small: ${name}`;
      message = `${name} does best in a colony of at least ${min}. Planned: ${planned}.`;
    } else {
      title = `Group too small: ${name}`;
      message = `${name} needs a group of at least ${min}. Planned: ${planned}.`;
    }
    issues.push({ severity: rule.severity, message: title });
    warnings.push({
      id: `group.${type === 'harem' ? 'harem' : 'min'}.${species.id}`,
      severity,
      icon: 'alert',
      kind: 'group',
      title,
      message,
      text: `${title} — ${message}`,
    });
  }
  return { issues, warnings };
}

const INVERT_PREY = [
  { category: 'shrimp', tag: 'shrimp_risk', pattern: /shrimp/i, label: 'shrimp' },
  { category: 'snail', tag: 'snail_risk', pattern: /snail/i, label: 'snail' },
];

// What one explicit predationRisks entry ("Shrimp (all sizes)", "Shrimp (juvenile)", "Shrimp (cherry)",
// "Snails") says about one prey species. Returns null when the entry does not cover that prey.
//   all sizes / plain "Snails"            → bad: the planned animals themselves are at risk
//   juvenile                               → warn: adults may coexist, offspring are at risk
//   a named type ("cherry", "amano")       → bad, but only for prey of that type
function readPreyEntry(entry, prey) {
  const qualifier = (entry.match(/\(([^)]*)\)/)?.[1] ?? '').trim().toLowerCase();
  if (!qualifier || /\ball\b/.test(qualifier)) return { scope: 'all', severity: 'bad' };
  if (/juvenile|young|baby|fry|shrimplet/.test(qualifier)) return { scope: 'juvenile', severity: 'warn' };
  const preyName = `${prey.common_name || ''} ${prey.id || ''} ${prey.slug || ''}`.toLowerCase();
  if (preyName.includes(qualifier)) return { scope: 'named', severity: 'bad', qualifier };
  return null;
}

const SCOPE_RANK = { all: 3, named: 3, juvenile: 2, tag: 1 };

// Shrimp / snail predation. A predator's own behavior.predationRisks is the evidence: when it names
// the prey category at all, only those entries decide (the strongest matching entry wins), whatever
// the generic shrimp_risk / snail_risk / *_safe tags say. The shrimp_risk / snail_risk tag is only a
// fallback for a record with no explicit entry for that category (amber). A species is never flagged
// against itself, and no relationship is added beyond what the data states.
function evaluateInvertPredation(entries, candidate) {
  const issues = [];
  const warnings = [];
  const selected = new Map();
  for (const entry of [...entries, candidate]) {
    if (entry?.species && !selected.has(entry.species.id)) selected.set(entry.species.id, entry.species);
  }
  const all = [...selected.values()];
  for (const { category, tag, pattern, label } of INVERT_PREY) {
    for (const predator of all) {
      const explicit = (predator.protoV2?.behavior?.predationRisks ?? [])
        .filter((risk) => typeof risk === 'string' && !/^\s*predators?\s*:/i.test(risk) && pattern.test(risk));
      const tagged = Array.isArray(predator.tags) && predator.tags.includes(tag);
      if (!explicit.length && !tagged) continue;
      for (const prey of all) {
        if (prey.category !== category || prey.id === predator.id) continue;
        let match = null;
        if (explicit.length) {
          for (const entry of explicit) {
            const read = readPreyEntry(entry, prey);
            if (read && (!match || SCOPE_RANK[read.scope] > SCOPE_RANK[match.scope])) match = { ...read, evidence: entry };
          }
        } else {
          match = { scope: 'tag', severity: 'warn' };
        }
        if (!match) continue;
        const predatorName = predator.common_name || predator.id;
        const preyName = prey.common_name || prey.id;
        let title;
        let message;
        if (match.scope === 'all') {
          title = `${predatorName} may eat ${preyName}`;
          message = category === 'snail'
            ? `Species data lists snails as prey (“${match.evidence}”), so the ${preyName} you plan are at risk.`
            : `Species data lists shrimp of all sizes as prey (“${match.evidence}”), so adult ${preyName} are at risk, not just shrimplets.`;
        } else if (match.scope === 'named') {
          title = `${predatorName} may prey on ${preyName}`;
          message = `Species data names ${match.qualifier} ${label} as prey (“${match.evidence}”).`;
        } else if (match.scope === 'juvenile') {
          title = `${predatorName} may eat juvenile ${preyName}`;
          message = `Species data lists juvenile ${label} as prey (“${match.evidence}”). Adult ${preyName} may coexist, but ${label === 'shrimp' ? 'shrimplets' : 'young snails'} are at risk.`;
        } else {
          title = `${predatorName} may eat ${preyName}`;
          message = `${predatorName} is tagged as a ${label} predator in species data, with no detail on which sizes it eats. Watch ${preyName} closely, especially young ones.`;
        }
        issues.push({ severity: match.severity, message: title });
        warnings.push({
          id: `predation.${label}.${predator.id}.${prey.id}`,
          severity: match.severity === 'bad' ? 'danger' : 'warn',
          icon: 'alert',
          kind: 'compatibility',
          basis: match.scope,
          title,
          message,
          text: `${title} — ${message}`,
        });
      }
    }
  }
  return { issues, warnings };
}

const RANGE_CONFLICT_COPY = {
  temperature: { name: 'temperature', select: (species) => species.temperature, prefix: '', unit: '°F' },
  pH: { name: 'pH', select: (species) => species.pH, prefix: 'pH ', unit: '' },
  gH: { name: 'GH (general hardness)', select: (species) => species.gH, prefix: '', unit: ' dGH' },
  kH: { name: 'KH (carbonate hardness)', select: (species) => species.kH, prefix: '', unit: ' dKH' },
};

// Species-to-species range conflicts (condition status 'species-conflict'), with the severity the
// water model assigned. They come from species data only, never from the user's water.
function buildRangeConflictWarnings(conditions, entries, candidate) {
  const warnings = [];
  const combined = candidate ? [...entries, candidate] : [...entries];
  for (const item of conditions) {
    if (item?.status !== 'species-conflict') continue;
    const copy = RANGE_CONFLICT_COPY[item.key];
    if (!copy) continue;
    let low = null;
    let high = null;
    for (const entry of combined) {
      const [min, max] = copy.select(entry.species) ?? [];
      if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
      if (!low || max < low.max) low = { species: entry.species, min, max };
      if (!high || min > high.min) high = { species: entry.species, min, max };
    }
    if (!low || !high || low.species.id === high.species.id) continue;
    const number = (value) => formatNumber(value, { maximumFractionDigits: 1 });
    const describe = ({ species, min, max }) => `${species.common_name} (${copy.prefix}${number(min)}–${number(max)}${copy.unit})`;
    const title = `No shared ${copy.name} range: ${low.species.common_name} and ${high.species.common_name}`;
    const message = `${describe(low)} and ${describe(high)} need different water, so one of them will always be kept outside its range. This comes from species data, not from your water.`;
    warnings.push({
      id: `range.${item.key}.conflict`,
      severity: item.severity === 'bad' ? 'danger' : 'warn',
      icon: 'alert',
      kind: 'water',
      title,
      message,
      text: `${title} — ${message}`,
    });
  }
  return warnings;
}

// More than one male betta: the HARD_CONFLICTS self-pair and calcAggression's fatal token, which the
// pair loop (one group per species) cannot see once they are in the stock.
function evaluateMaleBettas(entries, candidate) {
  const total = [...entries, candidate]
    .filter((entry) => entry?.species?.id === 'betta_male')
    .reduce((sum, entry) => sum + (Number(entry.qty) || 0), 0);
  if (total < 2 || !HARD_CONFLICTS.has(keyPair('betta_male', 'betta_male'))) {
    return { issues: [], warnings: [] };
  }
  const title = `${total} male bettas planned`;
  const message = 'Male bettas must be housed individually. Two or more will fight, often to injury or death. Keep only one male betta per tank.';
  return {
    issues: [{ severity: 'bad', message: title }],
    warnings: [{ id: 'betta.multipleMales', severity: 'danger', icon: 'alert', kind: 'aggression', title, message, text: `${title} — ${message}` }],
  };
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
  const filterId = state?.filterId ?? null;
  const filterType = normalizeFilterTypeSelection(state.filterType);
  const manualRatedValue = Number(state?.ratedGph);
  const manualRatedGph = Number.isFinite(manualRatedValue) && manualRatedValue > 0 ? manualRatedValue : null;
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
  const effectiveGallons = getEffectiveGallons(gallons);
  const baseCapacity = effectiveGallons;
  const capacity = effectiveGallons;
  const recommendedCapacity = effectiveGallons;

  let turnover = clamp(Number(state.turnover) || 5, 0.5, 20);
  let deliveredGph = turnover * volume;
  let ratedGph = deliveredGph;
  let filterFlow = computeFilterFlowStats(gallons, filterType);
  const gallonsForTurnover = Number.isFinite(effectiveGallons) && effectiveGallons > 0 ? effectiveGallons : gallons;

  const { totalGph } = summarizeFilters(state.filters);
  if (totalGph > 0) {
    deliveredGph = totalGph;
    ratedGph = totalGph;
    const computedTurnover = gallonsForTurnover > 0 ? deliveredGph / gallonsForTurnover : 0;
    if (computedTurnover > 0) {
      turnover = computedTurnover;
    }
  } else if (manualRatedGph) {
    deliveredGph = manualRatedGph;
    ratedGph = manualRatedGph;
    const computedTurnover = gallonsForTurnover > 0 ? manualRatedGph / gallonsForTurnover : 0;
    if (computedTurnover > 0) {
      turnover = computedTurnover;
    }
  } else if (Number.isFinite(filterFlow.actualGph) && filterFlow.actualGph > 0) {
    deliveredGph = filterFlow.actualGph;
    ratedGph = filterFlow.actualGph;
    const computedTurnover = gallonsForTurnover > 0 ? deliveredGph / gallonsForTurnover : 0;
    if (computedTurnover > 0) {
      turnover = computedTurnover;
    }
  }

  filterFlow = computeFilterFlowStats(gallons, filterType, deliveredGph);
  const flowTurnover = gallonsForTurnover > 0 && deliveredGph > 0 ? deliveredGph / gallonsForTurnover : null;
  filterFlow.turnover = Number.isFinite(flowTurnover) ? flowTurnover : null;
  filterFlow.ratedGph = Number.isFinite(ratedGph) && ratedGph > 0 ? ratedGph : null;
  filterFlow.filterId = filterId;

  const ratedGphValue = Number.isFinite(ratedGph) && ratedGph > 0 ? ratedGph : null;
  const multiplier = interpolateMultiplier(turnover);

  return {
    gallons,
    sump,
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
    baseCapacity,
    capacity,
    recommendedCapacity,
    effectiveGallons,
    deliveredGph,
    ratedGph: ratedGphValue,
    filterId,
    filterType: filterFlow.type,
    filterFlow,
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

// Species ranges combine as highest minimum → lowest maximum. No overlap is a species-to-species
// conflict, known from species data alone. Same test as the environment card (intersectRanges in
// envRecommend.js), and only when at least two species have a range.
const RANGE_OVERLAP_EPSILON = 0.01;

function hasSpeciesRangeConflict(range, contributors) {
  const [min, max] = range;
  if (contributors < 2 || !Number.isFinite(min) || !Number.isFinite(max)) return false;
  return !(max - min > RANGE_OVERLAP_EPSILON);
}

// status: 'not-entered' (the user gave no value: not evaluated), 'no-range' (no species data),
// 'species-conflict' (the species share no range), 'within' / 'outside' (the user's value vs the
// shared range). Only an entered value can be within or outside.
const CONDITION_HINTS = {
  'not-entered': 'Not entered',
  'no-range': 'No species range',
  within: '✔ Your water is within the shared range',
  outside: {
    warn: '⚠ Your water is slightly outside the shared range',
    bad: '✖ Your water is outside the shared range',
  },
  'species-conflict': {
    warn: '⚠ No shared range between these species',
    bad: '✖ No shared range between these species',
  },
};

function describeConditionHint(status, severity) {
  const hint = CONDITION_HINTS[status] ?? '';
  return typeof hint === 'string' ? hint : (hint[severity] ?? hint.bad);
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
  if (turnover <= 6) {
    return { band: 'low-flow', range: [4, 6] };
  }
  return { band: 'community', range: [8, 9] };
}

const FLOW_LABEL_BY_BAND = {
  L: 'low-flow species',
  M: 'moderate-flow species',
  H: 'high-flow species',
};

function resolveTurnoverBand(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }
  let hasHigh = false;
  let hasModerate = false;
  let hasLow = false;
  for (const entry of entries) {
    const flow = entry?.species?.flow;
    if (!flow) continue;
    if (flow === 'high') {
      hasHigh = true;
    } else if (flow === 'moderate') {
      hasModerate = true;
    } else if (flow === 'low') {
      hasLow = true;
    }
  }
  if (hasHigh) {
    return { key: 'H', range: TURNOVER_BANDS.H, label: FLOW_LABEL_BY_BAND.H };
  }
  if (hasModerate) {
    return { key: 'M', range: TURNOVER_BANDS.M, label: FLOW_LABEL_BY_BAND.M };
  }
  if (hasLow) {
    return { key: 'L', range: TURNOVER_BANDS.L, label: FLOW_LABEL_BY_BAND.L };
  }
  return null;
}

function formatGallonsValue(value) {
  return String(Math.round(value * 10) / 10);
}

// "about 5.2×", or "less than 0.1×" so a near-zero flow never reads as a plain 0.
function formatTurnoverPhrase(value) {
  return value < 0.1 ? 'less than 0.1×' : `about ${value.toFixed(1)}×`;
}

// Filtration warnings. They sit beside the bioload percentage and never change it: a bigger filter
// cannot make a heavily stocked tank lighter, and a missing or weak one does not change how much
// waste the livestock produce.
// Species flow preferences are not used here: they describe circulation, not biological filtration.
function buildFiltrationWarnings(assessment) {
  const warnings = [];
  const gallons = formatGallonsValue(assessment.gallons);
  const push = (id, severity, title, message) => {
    warnings.push({ id, severity, icon: 'alert', kind: 'filtration', title, message, text: `${title} — ${message}` });
  };
  switch (assessment.level) {
    case FILTRATION_LEVELS.NONE:
      push('filtration.none', 'warn', 'No filter added',
        'Add your filter so its flow can be checked. The bioload % assumes a working, established (cycled) filter; without one, waste builds up much faster.');
      break;
    case FILTRATION_LEVELS.CIRCULATION_ONLY:
      push('filtration.circulation_only', 'danger', 'No biological filter',
        'A powerhead moves water but holds no filter media, so it does not process fish waste. Add a filter (sponge, hang-on-back, internal or canister) for this stock.');
      break;
    case FILTRATION_LEVELS.VERY_LOW:
      push('filtration.very_low', 'danger', 'Filter flow too low',
        `${Math.round(assessment.biologicalGph)} GPH through filter media turns this ${gallons}-gallon tank over ${formatTurnoverPhrase(assessment.biologicalTurnover)} per hour, below the ${MIN_BIOLOGICAL_TURNOVER}× minimum. Check the flow value, or use a filter sized for this tank.`);
      break;
    default:
      break;
  }
  return warnings;
}

function buildFilteringState(state, tank, entries) {
  const { sanitized, totalGph } = summarizeFilters(state.filters);
  // Turnover uses the nominal tank size the user selected, the basis of turnover rules of thumb.
  const gallons = Number.isFinite(tank?.gallons) && tank.gallons > 0 ? tank.gallons : 0;
  const stockCount = Array.isArray(entries) ? entries.length : 0;
  const band = resolveTurnoverBand(entries);
  const assessment = assessFiltration({ filters: sanitized, gallons, hasStock: stockCount > 0 });
  const hasFlowData = assessment.totalGph > 0;
  const warnings = stockCount > 0 && gallons > 0 ? buildFiltrationWarnings(assessment) : [];

  let statusTone = 'neutral';
  let statusText = 'Add filter flow to estimate turnover.';
  if (hasFlowData && gallons <= 0) {
    statusTone = 'warn';
    statusText = 'Select a tank to calculate turnover.';
  } else if (hasFlowData && stockCount === 0) {
    statusText = 'No stock yet — filter flow is checked once species are added.';
  } else if (warnings.length) {
    const top = warnings.find((warning) => warning.severity === 'danger') ?? warnings[0];
    statusTone = top.severity === 'danger' ? 'bad' : 'warn';
    statusText = top.title;
  } else if (hasFlowData) {
    statusTone = 'good';
    statusText = `Filter flow meets the ${MIN_BIOLOGICAL_TURNOVER}× minimum.`;
  }
  const top = warnings.find((warning) => warning.severity === 'danger') ?? warnings[0] ?? null;

  return {
    filters: sanitized,
    gphTotal: totalGph,
    biologicalGph: assessment.biologicalGph,
    circulationGph: assessment.circulationGph,
    // Turnover through filter media (circulation-only devices excluded).
    turnover: assessment.biologicalTurnover,
    totalTurnover: assessment.totalTurnover,
    hasData: hasFlowData,
    level: assessment.level,
    assessment,
    status: { tone: statusTone, text: statusText },
    // Species flow band: circulation guidance only, never a filtration requirement.
    band,
    warning: warnings.length > 0,
    warnings,
    chip: top ? { id: top.id, tone: top.severity === 'danger' ? 'bad' : 'warn', text: top.title } : null,
    target: band ? { key: band.key, range: band.range } : null,
  };
}

function createConditionItem({ key, label, range, actual, infoKey, severity, status, measured, extra }) {
  return {
    key,
    label,
    range,
    actual,
    infoKey,
    severity,
    status,
    measured,
    hint: describeConditionHint(status, severity),
    extra,
  };
}

function countRangeContributors(entries, selector) {
  let count = 0;
  for (const entry of entries) {
    const [min, max] = selector(entry.species) ?? [];
    if (Number.isFinite(min) && Number.isFinite(max)) count += 1;
  }
  return count;
}

// One measured parameter vs the combined species range.
function evaluateParameter({ value, range, contributors, conflictSeverity, thresholds }) {
  const measured = Number.isFinite(value);
  if (hasSpeciesRangeConflict(range, contributors)) {
    return { measured, status: 'species-conflict', severity: conflictSeverity };
  }
  if (!Number.isFinite(range[0]) || !Number.isFinite(range[1])) {
    return { measured, status: measured ? 'no-range' : 'not-entered', severity: 'ok' };
  }
  if (!measured) {
    return { measured, status: 'not-entered', severity: 'ok' };
  }
  const severity = conditionState(value, range, thresholds);
  return { measured, status: severity === 'ok' ? 'within' : 'outside', severity };
}

const NOT_ENTERED = 'Not entered';

function formatMeasured(value, format) {
  return Number.isFinite(value) ? format(value) : NOT_ENTERED;
}

function computeConditions(state, entries, candidate, water, showMore) {
  const combined = candidate ? [...entries, candidate] : [...entries];
  const baseRange = (selector) => calcConditionRange(combined, selector);
  const contributors = (selector) => countRangeContributors(combined, selector);

  const tempSelector = (species) => species.temperature;
  const tempRange = baseRange(tempSelector);
  const temp = evaluateParameter({
    value: water.temperature,
    range: tempRange,
    contributors: contributors(tempSelector),
    conflictSeverity: 'bad',
    thresholds: { warnThreshold: 2, badThreshold: 2.01 },
  });

  const pHSelector = (species) => species.pH;
  const pHRange = baseRange(pHSelector);
  const sensitive = listSensitiveSpecies(combined, 'pH');
  const warn = sensitive.length ? 0.2 : 0.5;
  let bad = sensitive.length ? 0.2 : 0.5;
  // Only a KH the user entered can buffer pH swings.
  if (Number.isFinite(water.kH) && water.kH >= 3) {
    bad += 0.2;
  }
  // As on the environment card, a pH clash is hard only when a pH-sensitive species is involved.
  const ph = evaluateParameter({
    value: water.pH,
    range: pHRange,
    contributors: contributors(pHSelector),
    conflictSeverity: sensitive.length ? 'bad' : 'warn',
    thresholds: { warnThreshold: warn, badThreshold: bad },
  });

  const ghSelector = (species) => species.gH;
  const ghRange = baseRange(ghSelector);
  const gh = evaluateParameter({
    value: water.gH,
    range: ghRange,
    contributors: contributors(ghSelector),
    conflictSeverity: 'bad',
    thresholds: { warnThreshold: 2, badThreshold: 2.01 },
  });

  const khSelector = (species) => species.kH;
  const khRange = baseRange(khSelector);
  const kh = evaluateParameter({
    value: water.kH,
    range: khRange,
    contributors: contributors(khSelector),
    conflictSeverity: 'bad',
    thresholds: { warnThreshold: 2, badThreshold: 2.01 },
  });

  const salinityCheck = evaluateSalinity(candidate ?? { species: null }, { water });
  const flowCheck = evaluateFlow(candidate ?? { species: null }, water);
  const blackwaterCheck = evaluateBlackwater(candidate ?? { species: null }, water);

  const conditions = [
    createConditionItem({ key: 'temperature', label: 'Temperature', range: tempRange, actual: formatMeasured(water.temperature, (v) => `${formatNumber(v, { maximumFractionDigits: 1 })}°F`), ...temp }),
    createConditionItem({ key: 'pH', label: 'pH', range: pHRange, actual: formatMeasured(water.pH, (v) => `${formatNumber(v, { maximumFractionDigits: 2 })}`), infoKey: sensitive.length ? 'ph-sensitive' : null, ...ph, extra: sensitive.length ? `Sensitive: ${sensitive.join(', ')}` : null }),
    createConditionItem({ key: 'gH', label: 'gH', range: ghRange, actual: formatMeasured(water.gH, (v) => `${formatNumber(v, { maximumFractionDigits: 1 })} dGH`), infoKey: 'gh', ...gh }),
  ];

  const optional = [];
  optional.push(createConditionItem({ key: 'kH', label: 'kH', range: khRange, actual: formatMeasured(water.kH, (v) => `${formatNumber(v, { maximumFractionDigits: 1 })} dKH`), infoKey: 'kh', ...kh }));
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
  const flowEntered = FLOW_VALUES.has(water.flow);
  optional.push({
    key: 'flow',
    label: 'Flow',
    range: [NaN, NaN],
    actual: flowEntered ? water.flow : NOT_ENTERED,
    infoKey: null,
    severity: flowCheck.severity,
    measured: flowEntered,
    hint: !flowEntered ? NOT_ENTERED : flowCheck.severity === 'ok' ? '✔ Suitable' : flowCheck.reason,
  });
  const blackwaterEntered = typeof water.blackwater === 'boolean';
  optional.push({
    key: 'blackwater',
    label: 'Blackwater / Tannins',
    range: [NaN, NaN],
    actual: !blackwaterEntered ? NOT_ENTERED : water.blackwater ? 'Enabled' : 'Off',
    infoKey: 'blackwater',
    severity: blackwaterCheck.severity,
    measured: blackwaterEntered,
    hint: blackwaterCheck.severity === 'ok' ? (blackwaterCheck.tip ?? '✔ Balanced') : blackwaterCheck.reason,
  });

  const filteredOptional = optional.filter((item) => {
    if (showMore) return true;
    if (item.key === 'kH' && Number.isFinite(khRange[0])) return true;
    if (item.key === 'salinity' && item.severity !== 'ok') return true;
    if (item.key === 'flow' && item.severity !== 'ok') return true;
    if (item.key === 'blackwater' && item.severity !== 'ok') return true;
    return false;
  });

  return { conditions: [...conditions, ...filteredOptional], salinityCheck, flowCheck, blackwaterCheck, phSeverity: ph.severity, tempSeverity: temp.severity, ghSeverity: gh.severity, khSeverity: kh.severity };
}

const WATER_WARNING_TEXT = {
  temperature: { name: 'temperature', format: (v) => `${formatNumber(v, { maximumFractionDigits: 1 })}°F`, unit: '°F', digits: 1 },
  pH: { name: 'pH', format: (v) => `pH ${formatNumber(v, { maximumFractionDigits: 2 })}`, unit: '', digits: 1 },
  gH: { name: 'GH (general hardness)', format: (v) => `${formatNumber(v, { maximumFractionDigits: 1 })} dGH`, unit: ' dGH', digits: 0 },
  kH: { name: 'KH (carbonate hardness)', format: (v) => `${formatNumber(v, { maximumFractionDigits: 1 })} dKH`, unit: ' dKH', digits: 0 },
};

// Warnings about the user's own water. They exist only for a value the user entered that falls
// outside the stock's shared range; an unentered parameter never produces one.
function buildWaterWarnings(conditions, water) {
  const warnings = [];
  for (const item of conditions) {
    if (item?.status !== 'outside' || !item.measured) continue;
    const copy = WATER_WARNING_TEXT[item.key];
    if (!copy) continue;
    const [min, max] = item.range;
    const shared = `${formatNumber(min, { maximumFractionDigits: copy.digits })}–${formatNumber(max, { maximumFractionDigits: copy.digits })}${copy.unit}`;
    const title = `Your ${copy.name} is outside this stock's range`;
    const message = `You entered ${copy.format(water[item.key])}. Shared species range: ${shared}. Change your water slowly, or choose fish that suit it.`;
    warnings.push({
      id: `water.${item.key}.outside`,
      severity: item.severity === 'bad' ? 'danger' : 'warn',
      icon: 'alert',
      kind: 'water',
      title,
      message,
      text: `${title} — ${message}`,
    });
  }
  return warnings;
}

function mapEntriesToStock(entries = []) {
  return entries.map((entry) => ({ speciesId: entry.id, count: entry.qty }));
}

export function computeBioload(tank, entries, candidate, filterState = {}) {
  const currentStock = mapEntriesToStock(entries);
  const candidateStock = candidate ? [{ speciesId: candidate.id, count: candidate.qty }] : [];
  const proposedStock = candidate ? [...currentStock, ...candidateStock] : currentStock;

  const currentLoad = getTotalGE(currentStock, SPECIES_MAP);
  const candidateLoad = getTotalGE(candidateStock, SPECIES_MAP);
  const proposed = getTotalGE(proposedStock, SPECIES_MAP);

  const effectiveGallons = getEffectiveGallons(tank.gallons);
  const capacity = Math.max(effectiveGallons, 0.0001);
  const currentPercentValue = computeBioloadPercent({
    gallons: tank.gallons,
    currentStock,
    speciesMap: SPECIES_MAP,
  });
  const proposedPercentValue = computeBioloadPercent({
    gallons: tank.gallons,
    currentStock: proposedStock,
    speciesMap: SPECIES_MAP,
  });
  const normalizedType = normalizeFilterTypeSelection(filterState.filterType ?? tank?.filterType);
  const flow = tank?.filterFlow ?? computeFilterFlowStats(tank?.gallons, normalizedType);
  const tankGallons = Number.isFinite(tank?.gallons) && tank.gallons > 0
    ? tank.gallons
    : Number.isFinite(tank?.effectiveGallons) && tank.effectiveGallons > 0
      ? tank.effectiveGallons
      : 0;
  const deliveredGph = Number.isFinite(tank?.deliveredGph) && tank.deliveredGph > 0
    ? tank.deliveredGph
    : Number.isFinite(flow?.actualGph) && flow.actualGph > 0
      ? flow.actualGph
      : 0;
  const filtersList = Array.isArray(filterState.filters) ? filterState.filters : [];
  const turnoverCandidate = Number.isFinite(filterState.turnover)
    ? filterState.turnover
    : Number.isFinite(tank?.turnover)
      ? tank.turnover
      : Number.isFinite(flow?.turnover)
        ? flow.turnover
        : tankGallons > 0 && deliveredGph > 0
          ? deliveredGph / tankGallons
          : null;
  // Livestock load only: filtration is assessed separately (buildFilteringState) and never scales it.
  const currentPercent = (Number.isFinite(currentPercentValue) ? currentPercentValue : 0) / 100;
  const proposedPercent = (Number.isFinite(proposedPercentValue) ? proposedPercentValue : 0) / 100;
  const color = getBandColor(proposedPercent);
  const severity = proposedPercent > 1.1 ? 'bad' : proposedPercent > 0.9 ? 'warn' : 'ok';
  const text = `${formatBioloadPercent(currentPercentValue)} → ${formatBioloadPercent(proposedPercentValue)} of capacity`;
  const message = undefined;
  const badge = candidate && !Number.isFinite(candidate.species.bioloadGE) ? 'estimated' : null;
  const ratedGphValue = Number.isFinite(flow?.ratedGph) && flow.ratedGph > 0
    ? flow.ratedGph
    : Number.isFinite(tank?.ratedGph) && tank.ratedGph > 0
      ? tank.ratedGph
      : null;
  const hasProduct = Boolean(filterState.filterId ?? tank?.filterFlow?.filterId ?? tank?.filterId)
    || filtersList.some((filter) => filter?.id);
  const flowAdjustment = {
    type: flow?.type ?? normalizedType,
    actualGph: deliveredGph > 0 ? deliveredGph : null,
    idealGph: Number.isFinite(flow?.idealGph) ? flow.idealGph : null,
    ratedGph: ratedGphValue,
    turnover: Number.isFinite(turnoverCandidate) ? turnoverCandidate : null,
    hasProduct,
  };
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
    adjustedCurrentLoad: currentLoad,
    adjustedProposed: proposed,
    flowAdjustment,
    baseCurrentPercent: currentPercentValue / 100,
    baseProposedPercent: proposedPercentValue / 100,
    baseCurrentPercentValue: currentPercentValue,
    baseProposedPercentValue: proposedPercentValue,
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

function computeChips({ tank, candidate, entries, groupRule, salinityCheck, flowCheck, blackwaterCheck, bioload, conditions, aggression, filtering }) {
  const chips = [];
  if (candidate) {
    if (groupRule) {
      const id = candidate.species?.id;
      chips.push({ tone: groupRule.severity === 'bad' ? 'bad' : 'warn', text: groupRule.message, covers: [`group.min.${id}`, `group.harem.${id}`] });
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
    const aggressionState = aggression ?? candidate?.aggression ?? null;
    if (aggressionState && Array.isArray(aggressionState.conflicts) && aggressionState.conflicts.length) {
      for (const conflict of aggressionState.conflicts) {
        if (!conflict || !conflict.message) continue;
        const severity = typeof conflict.severity === 'string' ? conflict.severity.toLowerCase() : '';
        const tone = (severity === 'error' || severity === 'high' || severity === 'danger' || severity === 'bad') ? 'bad' : 'warn';
        const message = conflict.message || conflict.label || conflict.id;
        if (!message) continue;
        const text = `Aggression conflict: ${message}`;
        const id = conflict.id || `aggr:${conflict.aId ?? ''}:${conflict.bId ?? ''}:${conflict.rule ?? message}`;
        chips.push({ tone, text, kind: 'aggression', id, covers: [id] });
      }
    }
    const conditionIssues = conditions.conditions.filter((item) => item.severity !== 'ok');
    for (const condition of conditionIssues) {
      const covers = condition.status === 'species-conflict' ? [`range.${condition.key}.conflict`]
        : condition.status === 'outside' ? [`water.${condition.key}.outside`] : [];
      chips.push({ tone: condition.severity === 'bad' ? 'bad' : 'warn', text: `${condition.label}: ${condition.hint}`, covers });
    }
  }

  if (Array.isArray(entries) && entries.length > 0 && filtering?.chip) {
    chips.push({ ...filtering.chip, covers: [filtering.chip.id] });
  }
  return chips;
}

const WARNING_SEVERITY_RANK = { danger: 2, bad: 2, warn: 1, warning: 1 };

function sortWarnings(list) {
  list.sort((left, right) => {
    const diff = (WARNING_SEVERITY_RANK[right?.severity] ?? 0) - (WARNING_SEVERITY_RANK[left?.severity] ?? 0);
    if (diff !== 0) return diff;
    const leftText = (left?.text || '').toLowerCase();
    const rightText = (right?.text || '').toLowerCase();
    if (leftText < rightText) return -1;
    if (leftText > rightText) return 1;
    return 0;
  });
  return list;
}

function mergeWarnings(base, additions) {
  if (!Array.isArray(additions) || additions.length === 0) {
    return base;
  }
  const target = Array.isArray(base) ? [...base] : [];
  const seen = new Set(target.map((item) => (item?.id ? String(item.id) : null)).filter(Boolean));
  let mutated = false;
  for (const addition of additions) {
    if (!addition || typeof addition !== 'object') continue;
    const id = addition.id ? String(addition.id) : null;
    if (id && seen.has(id)) continue;
    target.push(addition);
    if (id) {
      seen.add(id);
    }
    mutated = true;
  }
  if (!mutated) {
    return base;
  }
  sortWarnings(target);
  return target;
}

function computeStatus({ bioload, aggression, conditions, groupRule, salinityCheck, flowCheck, blackwaterCheck, extraIssues = [] }) {
  const issues = [...extraIssues];
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
      const title = `Aggression conflict: ${aName} and ${bName}`;
      const reasons = conflict.message.charAt(0).toUpperCase() + conflict.message.slice(1);
      warnings.push({
        id,
        severity: conflict.severity === 'error' ? 'danger' : 'warn',
        icon: 'alert',
        kind: 'aggression',
        title,
        message: `${reasons}.`,
        text: `Aggression conflict: ${aName} vs ${bName} — ${conflict.message}`,
      });
    }
  }

  sortWarnings(warnings);

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

// Plausible bounds for a value the user typed; anything else is treated as not entered.
const WATER_BOUNDS = Object.freeze({
  temperature: [32, 110],
  pH: [0, 14],
  gH: [0, 60],
  kH: [0, 60],
});
const FLOW_VALUES = new Set(['low', 'moderate', 'high']);

function readMeasurement(raw, [lo, hi]) {
  if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= lo && value <= hi ? value : null;
}

// The user's water, exactly as entered. temperature / pH / gH / kH / flow / blackwater are null when
// the user has not entered them, and nothing downstream substitutes an assumed value. Salinity
// defaults to freshwater: it is the tool's scope (marine species are excluded), not a measurement.
export function sanitizeWater(state = {}) {
  const water = {
    temperature: readMeasurement(state.temperature, WATER_BOUNDS.temperature),
    pH: readMeasurement(state.pH, WATER_BOUNDS.pH),
    gH: readMeasurement(state.gH, WATER_BOUNDS.gH),
    kH: readMeasurement(state.kH, WATER_BOUNDS.kH),
    salinity: (() => {
      const raw = typeof state.salinity === 'string' ? state.salinity : 'fresh';
      if (raw === 'marine') return 'marine';
      return SUPPORTED_SALINITY.has(raw) ? raw : 'fresh';
    })(),
    flow: FLOW_VALUES.has(state.flow) ? state.flow : null,
    blackwater: typeof state.blackwater === 'boolean' ? state.blackwater : null,
  };
  water.entered = Object.freeze({
    temperature: water.temperature !== null,
    pH: water.pH !== null,
    gH: water.gH !== null,
    kH: water.kH !== null,
    flow: water.flow !== null,
    blackwater: water.blackwater !== null,
  });
  return water;
}

export function buildComputedState(state) {
  const entries = buildEntries(state.stock);
  const candidate = buildCandidate(state.candidate);
  const tank = calcTank(state, entries, state.variantId);
  const filtering = buildFilteringState(state, tank, entries);
  const water = sanitizeWater(state.water ?? {});
  const conditions = computeConditions(state, entries, candidate, water, state.showTips);
  const bioload = computeBioload(tank, entries, candidate, {
    filterType: state.filterType,
    filterId: state.filterId,
    ratedGph: state.ratedGph,
    turnover: Number.isFinite(filtering?.turnover) ? filtering.turnover : tank.turnover,
    filters: filtering?.filters,
    totalGph: filtering?.gphTotal,
  });
  const aggression = computeAggression(tank, entries, candidate);
  const invertCheck = candidate ? evaluateInvertSafety(candidate.species, { water }) : { severity: 'ok' };
  const groupRule = candidate ? checkGroupRule(candidate, entries) : null;

  const chips = computeChips({
    tank,
    candidate,
    entries,
    groupRule,
    salinityCheck: conditions.salinityCheck,
    flowCheck: conditions.flowCheck,
    blackwaterCheck: conditions.blackwaterCheck,
    bioload,
    conditions,
    aggression,
    filtering,
  });
  if (invertCheck.severity !== 'ok') {
    chips.push({ tone: invertCheck.severity === 'bad' ? 'bad' : 'warn', text: invertCheck.reason });
  }
  const tankSuitability = evaluateTankSuitability(tank, entries, candidate);
  const fishPredation = evaluateFishPredation(entries, candidate);
  const filtrationIssues = filtering.warnings.map((warning) => ({
    severity: warning.severity === 'danger' ? 'bad' : 'warn',
    message: warning.title,
  }));
  const groupWarnings = evaluateGroupWarnings(entries, candidate);
  const invertPredation = evaluateInvertPredation(entries, candidate);
  const maleBettas = evaluateMaleBettas(entries, candidate);
  const status = computeStatus({ bioload, aggression, conditions, groupRule, salinityCheck: conditions.salinityCheck, flowCheck: conditions.flowCheck, blackwaterCheck: conditions.blackwaterCheck, extraIssues: [...fishPredation.issues, ...tankSuitability.issues, ...filtrationIssues, ...groupWarnings.issues, ...invertPredation.issues, ...maleBettas.issues] });
  const waterWarnings = buildWaterWarnings(conditions.conditions, water);
  const rangeWarnings = buildRangeConflictWarnings(conditions.conditions, entries, candidate);
  const stockWarnings = [...evaluateStockWarnings({ entries, candidate }), ...fishPredation.warnings, ...invertPredation.warnings, ...maleBettas.warnings, ...tankSuitability.warnings, ...groupWarnings.warnings, ...filtering.warnings, ...rangeWarnings, ...waterWarnings];
  const mergedWarnings = mergeWarnings(status.warnings, stockWarnings);
  const statusWithWarnings = mergedWarnings === status.warnings ? status : { ...status, warnings: mergedWarnings };

  const diagnostics = computeDiagnostics({ tank, bioload, aggression, status: statusWithWarnings, candidate, entries });

  return flagUnevaluatedSpecies(flagUnsuitableTank({
    tank,
    entries,
    candidate,
    water,
    conditions,
    bioload,
    aggression,
    chips,
    invertCheck,
    status: statusWithWarnings,
    diagnostics,
    filtering,
    turnover: turnoverBand(tank),
    stockCount: entries.length,
    tankSuitability,
    unevaluatedSpecies: findUnevaluatedSpecies(state.stock, state.candidate),
  }));
}

export function runScenario(baseState, overrides) {
  const next = {
    ...baseState,
    ...overrides,
  };
  next.filterType = normalizeFilterTypeSelection(next.filterType);
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
    stock: [{ id: 'cardinal', qty: 12 }],
  });
  results.push(`1) 20g, 12 cardinal tetras → Load ${roundTo(scenario1.bioload.proposed, 3)} | Usage ${formatPercent(scenario1.bioload.proposedPercent)}`);

  const scenario2 = runScenario(base, {
    gallons: 20,
    turnover: 5,
    stock: [
      { id: 'cardinal', qty: 12 },
      { id: 'betta_male', qty: 1 },
    ],
  });
  results.push(`2) + Betta → Load ${roundTo(scenario2.bioload.proposed, 3)} | Usage ${formatPercent(scenario2.bioload.proposedPercent)}`);

  const scenario3 = runScenario(base, {
    gallons: 20,
    turnover: 5,
    stock: [
      { id: 'cardinal', qty: 12 },
      { id: 'betta_male', qty: 1 },
      { id: 'cory_panda', qty: 6 },
    ],
  });
  results.push(`3) +6 panda corys → Load ${roundTo(scenario3.bioload.proposed, 3)} | Usage ${formatPercent(scenario3.bioload.proposedPercent)}`);

  const scenario4 = runScenario(base, {
    gallons: 20,
    turnover: 5,
    stock: [
      { id: 'cardinal', qty: 12 },
      { id: 'cory_panda', qty: 6 },
    ],
    candidate: { id: 'tiger_barb', qty: 2 },
  });
  results.push(`4) +2 tiger barbs → ${scenario4.status.label}`);

  const scenario5 = runScenario(base, {
    gallons: 10,
    turnover: 4,
    stock: [{ id: 'betta_male', qty: 1 }],
  });
  results.push(`5) 10g solo betta → Bioload ${formatPercent(scenario5.bioload.proposedPercent)} | Agg ${scenario5.aggression.label}`);

  const scenario6a = runScenario(base, {
    gallons: 20,
    turnover: 5,
    water: { temperature: 78, pH: 7.6, gH: 6, kH: 3, salinity: 'fresh', flow: 'moderate', blackwater: false },
    stock: [{ id: 'cardinal', qty: 10 }],
  });
  results.push(`6) pH 7.6 vs Cardinal → ${scenario6a.conditions.conditions.find((c) => c.key === 'pH')?.hint ?? ''}`);
  const scenario6b = runScenario(base, {
    gallons: 20,
    turnover: 5,
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
    showTips: false,
    turnover: 5,
    filterType: 'hob',
    filterId: null,
    ratedGph: null,
    filters: [],
    sumpGallons: 0,
    tankAgeWeeks: 12,
    variantId: null,
    stock: [],
    candidate: { id: getDefaultSpeciesId(), qty: '1' },
    // Not entered: the advisor knows nothing about the user's water until they enter it.
    water: { temperature: null, pH: null, gH: null, kH: null, salinity: 'fresh', flow: null, blackwater: null },
  };
}
