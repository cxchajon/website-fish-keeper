/**
 * Filtration status card — view model (sponge migration phase G; design report sections 4.4, 4.5, 12).
 *
 * Pure presentation: turns the engine's structured filtration result (computed.filtering, above all
 * computed.filtering.assessment from math.assessFiltration) into the lines the card shows. Nothing
 * here decides adequacy. The headline, tone, level, adequateBy, passingPaths, GPH totals, turnover,
 * sponge ratings and UGF compatibility are all read from the engine and never recomputed, and no
 * figure is ever combined across paths:
 *   - powered filters: the engine's rated biological GPH and turnover (the unchanged 2× floor);
 *   - sponges: each sponge's own manufacturer rating, never a GPH, a turnover or a sum of gallons;
 *   - undergravel filters: the tank presets the maker lists, never a GPH, a turnover or a range;
 *   - powerheads: circulation only, never part of biological turnover.
 * Filtration never changes Stocking Load, so every state carries the same permanent sentence.
 *
 * No DOM access: unit-tested in Node (tests/unit/filtration-status-card-phase-g.test.mjs).
 */

import {
  FILTRATION_LEVELS,
  FILTRATION_STATUS,
  FILTER_ROLES,
  MIN_BIOLOGICAL_TURNOVER,
  RATING_STATUSES,
  UGF_STATUSES,
  formatCompatibleTanks,
  isCompatibilityBasedUgf,
  isRatingBasedSponge,
} from './math.js';

export const FILTRATION_SUPPORT_SENTENCE = 'Filtration supports your livestock but does not increase stocking capacity.';

export const CARD_TONES = Object.freeze({ GOOD: 'good', WARN: 'warn', BAD: 'bad', NEUTRAL: 'neutral' });

// Icon and its meaning in words, so the status never depends on colour (or on the icon) alone.
const TONE_ICONS = Object.freeze({ good: '✓', warn: '⚠', bad: '✖', neutral: '○' });
export const TONE_LABELS = Object.freeze({ good: 'OK', warn: 'Warning', bad: 'Problem', neutral: 'Not evaluated' });

// Card states that are not engine levels.
export const CARD_STATES = Object.freeze({
  NO_TANK: 'no-tank', // no tank selected (or no volume): nothing to check against
  EMPTY: 'empty', // tank, no stock, no filter
  NO_STOCK: 'no-stock', // filters entered, no livestock yet: devices listed, no verdict
});

const SPONGE_NOTE = 'Sponge filters are sized by tank; water flow isn\'t estimated.';
const UGF_NOTE = 'Undergravel filters are checked by the tank sizes the manufacturer lists; water flow isn\'t estimated.';
const MULTI_SPONGE_NOTE = 'No single sponge is rated for this tank. Several sponges add media and backup, but their combined capacity isn\'t verified.';
const BELOW_RATING_NOTE = 'Add another sponge or a filter rated for this tank.';
const CUSTOM_RATING_HINT = 'For a custom sponge, enter the tank size the manufacturer rates it for (printed on the box or listing).';

function formatGallons(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 10) / 10);
}

function formatGph(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? String(Math.round(num)) : '0';
}

// "5.2× / hour (rated)": rated flow through media per tank volume. A near-zero flow never reads as 0.
export function formatRatedTurnover(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num < 0.1 ? 'less than 0.1× / hour (rated)' : `${num.toFixed(1)}× / hour (rated)`;
}

// "Tank: 20 High" for a preset whose name matters (a UGF's listed tanks), "Tank: 29 gal" otherwise.
function tankPresetName(tankId) {
  return tankId ? formatCompatibleTanks([tankId]) : null;
}

function row(kind, path, text, extra = {}) {
  return { kind, path, text, ...extra };
}

// The engine's device list (assessment.filters) sorted into the three paths plus circulation. Only
// the engine's own classification is used (isRatingBasedSponge / isCompatibilityBasedUgf / role).
function splitDevices(assessment) {
  const devices = Array.isArray(assessment?.filters) ? assessment.filters : [];
  const circulation = devices.filter((entry) => entry.role === FILTER_ROLES.CIRCULATION);
  const biological = devices.filter((entry) => entry.role !== FILTER_ROLES.CIRCULATION);
  const powered = biological.filter((entry) => !isRatingBasedSponge(entry) && !isCompatibilityBasedUgf(entry));
  return { devices, circulation, biological, powered };
}

// Source / legacy GPH for a sponge, looked up in the engine's device list by instance.
function deviceFor(devices, sponge, index, spongeDevices) {
  if (sponge.instanceId) {
    const match = devices.find((entry) => entry.instanceId === sponge.instanceId);
    if (match) return match;
  }
  return spongeDevices[index] ?? null;
}

function spongeRatingText(sponge) {
  return sponge.ratingStatus === RATING_STATUSES.VERIFIED && sponge.ratingText ? `rated ${sponge.ratingText}` : 'Rating needed';
}

// One line per physical sponge (duplicates of one product are separate lines: instanceId is the
// identity). Names are numbered only when there is more than one sponge.
function spongeLabel(index, count, { additional = false } = {}) {
  if (additional) return 'Additional sponge filter';
  return count > 1 ? `Sponge ${index + 1}` : 'Sponge filter';
}

function spongeRows(assessment, devices, { mode }) {
  const sponges = assessment?.sponge?.entries ?? [];
  const spongeDevices = devices.filter((entry) => isRatingBasedSponge(entry));
  const gallons = formatGallons(assessment?.gallons);
  const rows = [];
  sponges.forEach((sponge, index) => {
    const device = deviceFor(devices, sponge, index, spongeDevices);
    const verified = sponge.ratingStatus === RATING_STATUSES.VERIFIED;
    let kind = mode === 'listing' ? 'device' : 'path';
    let status = 'info';
    let label = spongeLabel(index, sponges.length);
    let detail = spongeRatingText(sponge);
    if (mode === 'passing') {
      // Another path (or this sponge) carries the tank. Only a sponge rated for the tank is a path;
      // every other sponge is supplemental and is not flagged as below its rating (design 4.4).
      if (verified && sponge.coversTank) {
        detail = `${detail} — rated for this tank`;
        status = 'pass';
      } else {
        kind = 'supplemental';
        label = spongeLabel(index, sponges.length, { additional: true });
      }
    } else if (mode === 'review') {
      if (verified) {
        detail = `${detail} — below this ${gallons} gal tank`;
        status = 'fail';
      }
    } else if (mode === 'below' || mode === 'likely') {
      status = verified ? 'caution' : 'info';
    }
    if (!verified) status = 'neutral';
    const prefix = kind === 'supplemental' ? '+ ' : '';
    rows.push(row(kind, 'sponge', `${prefix}${label}: ${detail}`, {
      instanceId: sponge.instanceId ?? null,
      status,
      ratingStatus: sponge.ratingStatus,
    }));
    // An old custom sponge's historical GPH: shown so the user recognises it, never scored.
    if (!verified && Number(device?.legacyGph) > 0) {
      rows.push(row('legacy', 'sponge', `Old value: ${formatGph(device.legacyGph)} GPH — not used for sponge filters.`, {
        instanceId: sponge.instanceId ?? null,
        status: 'neutral',
      }));
    }
  });
  return rows;
}

function ugfDetail(ugf, { forPath }) {
  const listed = ugf.compatibilityText;
  switch (ugf.status) {
    case UGF_STATUSES.COMPATIBLE:
      return `rated for ${listed} — rated for this tank`;
    case UGF_STATUSES.NOT_LISTED:
      return forPath ? `rated for ${listed}` : `this tank size isn't listed (rated for ${listed})`;
    case UGF_STATUSES.TANK_UNKNOWN:
      return `rated for ${listed} — select one of these tank sizes to check it`;
    default:
      return 'no listed tank sizes available, so it isn\'t evaluated';
  }
}

function ugfRows(assessment, { mode }) {
  const ugfs = assessment?.ugf?.entries ?? [];
  return ugfs.map((ugf) => {
    if (ugf.compatible) {
      return row('path', 'ugf', `Undergravel filter: ${ugfDetail(ugf, { forPath: true })}`, {
        instanceId: ugf.instanceId ?? null,
        status: 'pass',
      });
    }
    // A UGF that can't be evaluated here is neutral: next to a passing path it is supplemental.
    const supplemental = mode === 'passing' || mode === 'likely' || mode === 'below';
    const text = supplemental
      ? `+ Undergravel filter: ${ugfDetail(ugf, { forPath: false })}`
      // Not evaluated: a separate "Current tank" row follows; beside a weak powered filter (review) the
      // line itself says the tank isn't listed.
      : `Undergravel filter: ${ugfDetail(ugf, { forPath: mode === 'not-evaluated' })}`;
    return row(supplemental ? 'supplemental' : 'path', 'ugf', text, {
      instanceId: ugf.instanceId ?? null,
      status: 'neutral',
    });
  });
}

// One powered line: the engine evaluates the powered path on its combined rated biological flow.
function poweredRow(assessment, poweredDevices, { mode }) {
  const powered = assessment?.powered;
  if (!powered || !(powered.count > 0)) return null;
  const count = powered.count;
  const label = count > 1 ? `Powered filters (${count})` : 'Powered filter';
  const gph = `${formatGph(powered.gph)} GPH${count > 1 ? ' total' : ''}`;
  const turnover = formatRatedTurnover(powered.turnover);
  const base = turnover ? `${gph} · ${turnover}` : gph;
  if (mode === 'listing') {
    return row('device', 'powered', `${label}: ${base}`, { status: 'info', instanceIds: poweredDevices.map((d) => d.instanceId ?? null) });
  }
  if (powered.passes) {
    return row('path', 'powered', `${label}: ${base}`, { status: 'pass', instanceIds: poweredDevices.map((d) => d.instanceId ?? null) });
  }
  // Below the floor. Beside another path that carries the tank it is supplemental, and the line says
  // the minimum is the powered-filter one; otherwise it is the concern itself.
  if (mode === 'passing') {
    return row('supplemental', 'powered', `+ ${label}: ${base} — below the ${MIN_BIOLOGICAL_TURNOVER}× powered-filter minimum`, {
      status: 'caution',
      instanceIds: poweredDevices.map((d) => d.instanceId ?? null),
    });
  }
  return row('path', 'powered', `${label}: ${base} — below the ${MIN_BIOLOGICAL_TURNOVER}× minimum`, {
    status: 'fail',
    instanceIds: poweredDevices.map((d) => d.instanceId ?? null),
  });
}

// Powerheads, one line per device: circulation only, never counted as filtration.
function circulationRows(circulation, { supplemental }) {
  return circulation.map((device) => row(supplemental ? 'supplemental' : 'path', 'circulation',
    `${supplemental ? '+ ' : ''}Powerhead: ${formatGph(device.ratedGph)} GPH circulation only`, {
      instanceId: device.instanceId ?? null,
      status: supplemental ? 'info' : 'fail',
    }));
}

function statusFor(tone, text, iconOverride) {
  return {
    tone,
    icon: iconOverride || TONE_ICONS[tone],
    iconLabel: TONE_LABELS[tone],
    text,
  };
}

// Qualitative only: several biological filters give backup during maintenance. No capacity claim.
function redundancyText(biologicalCount) {
  return biologicalCount >= 2
    ? `Redundancy: ${biologicalCount} biological filters provide backup during maintenance.`
    : null;
}

function neitherSentence(biologicalCount) {
  const lead = biologicalCount > 2
    ? 'None of these filters is shown to be sized for this tank on its own.'
    : 'Neither filter is shown to be sized for this tank on its own.';
  return `${lead} A filter rated for this tank is the safer choice.`;
}

// A custom sponge has no productId (a catalog sponge always keeps its product identity); only a
// custom sponge's rating can be entered by the user.
function hasCustomUnratedSponge(assessment) {
  const sponges = assessment?.sponge?.entries ?? [];
  return sponges.some((sponge) => sponge.ratingStatus !== RATING_STATUSES.VERIFIED && !sponge.productId);
}

function baseModel(state, status, extras = {}) {
  return {
    state,
    level: extras.level ?? state,
    headline: status,
    tone: status.tone,
    rows: extras.rows ?? [],
    explanation: extras.explanation ?? [],
    redundancy: extras.redundancy ?? null,
    note: FILTRATION_SUPPORT_SENTENCE,
    showTurnover: Boolean(extras.showTurnover),
    evaluated: Boolean(extras.evaluated),
    warningIds: extras.warningIds ?? [],
    adequateBy: extras.adequateBy ?? null,
    passingPaths: extras.passingPaths ?? [],
  };
}

/**
 * @param {object|null} filtering computed.filtering (compute.legacy buildFilteringState), or null
 *   when no tank is selected.
 * @returns the card model: { state, level, headline {tone, icon, iconLabel, text}, tone, rows[],
 *   explanation[], redundancy, note, showTurnover, evaluated, warningIds[], adequateBy, passingPaths }
 */
export function buildFiltrationCardModel(filtering) {
  const assessment = filtering?.assessment ?? null;
  if (!assessment || !(Number(assessment.gallons) > 0)) {
    return baseModel(CARD_STATES.NO_TANK, statusFor(CARD_TONES.NEUTRAL, 'Select a tank to check filtration'), {
      explanation: [],
    });
  }

  const { devices, circulation, biological, powered } = splitDevices(assessment);
  const showTurnover = powered.length > 0 && Number(assessment.biologicalGph) > 0;
  const redundancy = redundancyText(biological.length);
  const gallons = formatGallons(assessment.gallons);
  const warningIds = (Array.isArray(filtering?.warnings) ? filtering.warnings : [])
    .map((warning) => warning?.id)
    .filter((id) => typeof id === 'string' && id);

  if (!devices.length) {
    if (!assessment.hasStock) {
      return baseModel(CARD_STATES.EMPTY, statusFor(CARD_TONES.NEUTRAL, 'Add a filter to check filtration'), {
        explanation: ['Filtration is checked once a filter and species are added.'],
      });
    }
    // Engine level NONE (filtration.none, amber). No GPH is claimed: nothing has been entered.
    const none = FILTRATION_STATUS[FILTRATION_LEVELS.NONE];
    return baseModel(FILTRATION_LEVELS.NONE, statusFor(none.tone, none.text), {
      level: FILTRATION_LEVELS.NONE,
      explanation: ['Add your filter so the advisor can check it for this stock. The bioload % assumes a working, established (cycled) filter.'],
      evaluated: true,
      warningIds,
    });
  }

  if (!assessment.hasStock) {
    // Devices listed with their own rating / flow facts; no livestock verdict yet.
    const rows = [];
    const poweredLine = poweredRow(assessment, powered, { mode: 'listing' });
    if (poweredLine) rows.push(poweredLine);
    rows.push(...spongeRows(assessment, devices, { mode: 'listing' }));
    (assessment.ugf?.entries ?? []).forEach((ugf) => {
      const detail = ugf.compatibilityText ? `rated for ${ugf.compatibilityText}` : 'no listed tank sizes available';
      rows.push(row('device', 'ugf', `Undergravel filter: ${detail}`, { instanceId: ugf.instanceId ?? null, status: 'info' }));
    });
    circulation.forEach((device) => {
      rows.push(row('device', 'circulation', `Powerhead: ${formatGph(device.ratedGph)} GPH circulation only`, {
        instanceId: device.instanceId ?? null,
        status: 'info',
      }));
    });
    return baseModel(CARD_STATES.NO_STOCK, statusFor(CARD_TONES.NEUTRAL, 'Filtration is checked once species are added'), {
      rows,
      redundancy,
      showTurnover,
    });
  }

  const level = assessment.level;
  const engineStatus = assessment.status ?? FILTRATION_STATUS[level] ?? {};
  const tone = Object.values(CARD_TONES).includes(engineStatus.tone) ? engineStatus.tone : CARD_TONES.NEUTRAL;
  const headline = statusFor(tone, engineStatus.text ?? '', engineStatus.icon);
  const rows = [];
  const explanation = [];
  const hasSponges = (assessment.sponge?.count ?? 0) > 0;
  const hasUgfs = (assessment.ugf?.count ?? 0) > 0;
  const passing = new Set(Array.isArray(assessment.passingPaths) ? assessment.passingPaths : []);

  switch (level) {
    case FILTRATION_LEVELS.CIRCULATION_ONLY:
      rows.push(...circulationRows(circulation, { supplemental: false }));
      explanation.push('A powerhead moves water but holds no filter media, so it doesn\'t process fish waste. Add a biological filter (sponge, hang-on-back, internal or canister).');
      break;
    case FILTRATION_LEVELS.VERY_LOW: {
      const line = poweredRow(assessment, powered, { mode: 'concern' });
      if (line) rows.push(line);
      explanation.push('Check the flow value, or use a filter sized for this tank.');
      break;
    }
    case FILTRATION_LEVELS.ADEQUATE: {
      // Passing paths first (powered, sponge, UGF — the engine's order), then everything else.
      const poweredLine = poweredRow(assessment, powered, { mode: 'passing' });
      const sponge = spongeRows(assessment, devices, { mode: 'passing' });
      const ugf = ugfRows(assessment, { mode: 'passing' });
      // A legacy "old value" note only follows an unrated (so supplemental) sponge, and stays after it.
      const all = [poweredLine, ...sponge, ...ugf].filter(Boolean);
      rows.push(...all.filter((line) => line.kind === 'path'), ...all.filter((line) => line.kind !== 'path'));
      if (passing.has('sponge') && !passing.has('powered')) {
        rows.push(row('fact', 'tank', `Tank: ${gallons} gal`, { status: 'info' }));
        explanation.push(SPONGE_NOTE);
      }
      if (passing.has('ugf') && !passing.has('powered') && !passing.has('sponge')) {
        explanation.push(UGF_NOTE);
      }
      break;
    }
    case FILTRATION_LEVELS.LIKELY_MULTI_SPONGE: {
      rows.push(...spongeRows(assessment, devices, { mode: 'likely' }));
      rows.push(row('fact', 'tank', `Tank: ${gallons} gal`, { status: 'info' }));
      const poweredLine = poweredRow(assessment, powered, { mode: 'concern' });
      if (poweredLine) rows.push(poweredLine);
      rows.push(...ugfRows(assessment, { mode: 'likely' }));
      explanation.push(MULTI_SPONGE_NOTE);
      break;
    }
    case FILTRATION_LEVELS.BELOW_RATING: {
      rows.push(...spongeRows(assessment, devices, { mode: 'below' }));
      rows.push(row('fact', 'tank', `Tank: ${gallons} gal`, { status: 'info' }));
      rows.push(...ugfRows(assessment, { mode: 'below' }));
      explanation.push(BELOW_RATING_NOTE);
      break;
    }
    case FILTRATION_LEVELS.REVIEW: {
      const poweredLine = poweredRow(assessment, powered, { mode: 'concern' });
      if (poweredLine) rows.push(poweredLine);
      rows.push(...spongeRows(assessment, devices, { mode: 'review' }));
      rows.push(...ugfRows(assessment, { mode: 'review' }));
      explanation.push(neitherSentence(biological.length));
      if (hasCustomUnratedSponge(assessment)) explanation.push(CUSTOM_RATING_HINT);
      break;
    }
    case FILTRATION_LEVELS.NOT_EVALUATED: {
      rows.push(...spongeRows(assessment, devices, { mode: 'not-evaluated' }));
      rows.push(...ugfRows(assessment, { mode: 'not-evaluated' }));
      const ugfEntries = assessment.ugf?.entries ?? [];
      if (ugfEntries.some((ugf) => ugf.status === UGF_STATUSES.NOT_LISTED)) {
        const name = tankPresetName(assessment.tankId);
        rows.push(row('fact', 'tank', `Current tank: ${name ?? `${gallons} gal`}`, { status: 'info' }));
      }
      if (hasSponges) {
        explanation.push('No verified manufacturer tank rating, so filtration isn\'t evaluated — not adequate, not unsafe.');
        if (hasCustomUnratedSponge(assessment)) explanation.push(CUSTOM_RATING_HINT);
      }
      if (hasUgfs) {
        explanation.push(ugfEntries.some((ugf) => ugf.status === UGF_STATUSES.NOT_LISTED)
          ? 'Not evaluated for this tank — not adequate, not unsafe.'
          : 'This undergravel filter can\'t be checked for this tank, so it isn\'t evaluated — not adequate, not unsafe.');
        explanation.push(UGF_NOTE);
      }
      break;
    }
    default:
      break;
  }

  // Powerheads beside biological filtration: listed, never part of turnover.
  if (level !== FILTRATION_LEVELS.CIRCULATION_ONLY) {
    rows.push(...circulationRows(circulation, { supplemental: true }));
  }

  return baseModel(level, headline, {
    level,
    rows,
    explanation,
    redundancy,
    showTurnover,
    evaluated: true,
    warningIds,
    adequateBy: assessment.adequateBy ?? null,
    passingPaths: [...passing],
  });
}

// Every line of text the card shows, in order (tests and the renderer's change signature).
export function cardText(model) {
  if (!model) return [];
  return [
    'Filtration',
    `${model.headline.icon} ${model.headline.text}`.trim(),
    ...model.rows.map((line) => line.text),
    ...model.explanation,
    ...(model.redundancy ? [model.redundancy] : []),
    model.note,
  ];
}
