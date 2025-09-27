import { clamp } from './utils.js';

const HARD_CONFLICT_MATRIX = new Map([
  ['betta_male|guppy_male', 'bad'],
  ['guppy_male|betta_male', 'bad'],
  ['goldfish|tropical', 'bad'],
  ['tropical|goldfish', 'bad'],
]);

function pairKey(a, b) {
  return `${a}|${b}`;
}

function applyLengthBuffer(severity, tankLength, lengthA, lengthB) {
  if (severity === 'ok') {
    return severity;
  }
  const threshold = Math.min(lengthA || 0, lengthB || 0) * 1.5;
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return severity;
  }
  if (tankLength >= threshold) {
    if (severity === 'bad') return 'warn';
    if (severity === 'warn') return 'ok';
  }
  return severity;
}

function maxSeverity(current, next) {
  const order = ['ok', 'warn', 'bad'];
  return order[Math.max(order.indexOf(current), order.indexOf(next))];
}

export function evaluatePair(candidate, incumbent, tankContext) {
  const result = {
    severity: 'ok',
    reasons: [],
  };
  if (!candidate?.species || !incumbent?.species) {
    return result;
  }
  const a = candidate.species;
  const b = incumbent.species;

  const matrixKey = pairKey(a.id, b.id);
  const matrixReverseKey = pairKey(a.category ?? a.id, b.category ?? b.id);
  const matrixSeverity = HARD_CONFLICT_MATRIX.get(matrixKey) || HARD_CONFLICT_MATRIX.get(matrixReverseKey);
  if (matrixSeverity) {
    result.severity = maxSeverity(result.severity, matrixSeverity);
    result.reasons.push('Known conflict pairing');
  }

  const diff = Math.abs((a.aggression ?? 30) - (b.aggression ?? 30));
  if (diff > 40) {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('High aggression mismatch');
  } else if (diff > 20) {
    result.severity = maxSeverity(result.severity, 'warn');
    result.reasons.push('Temperament gap');
  }

  const aTags = new Set(a.tags ?? []);
  const bTags = new Set(b.tags ?? []);

  if (aTags.has('fin_nipper') && (bTags.has('fin_sensitive') || bTags.has('longfin'))) {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('Fin-nipping risk');
  }

  if (bTags.has('fin_nipper') && (aTags.has('fin_sensitive') || aTags.has('longfin'))) {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('Fin-nipping risk');
  }

  if (aTags.has('territorial') || bTags.has('territorial')) {
    result.severity = maxSeverity(result.severity, 'warn');
    result.reasons.push('Territorial overlap');
  }

  if (aTags.has('predator_shrimp') && bTags.has('invert')) {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('Predation risk (shrimp)');
  }

  if (bTags.has('predator_shrimp') && aTags.has('invert')) {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('Predation risk (shrimp)');
  }

  const tankLength = tankContext?.length ?? 0;
  const buffered = applyLengthBuffer(result.severity, tankLength, a.min_tank_length_in, b.min_tank_length_in);
  if (buffered !== result.severity) {
    result.severity = buffered;
    result.reasons.push('Extra swim length eases tension');
  }

  return result;
}

export function evaluateInvertSafety(species, tankContext) {
  if (!species) return { severity: 'ok', reason: '' };
  const tags = new Set(species.tags ?? []);
  if (tags.has('invert')) {
    if ((tankContext?.water?.gH ?? 0) < 3 && tags.has('snail')) {
      return { severity: 'warn', reason: 'Low gH risks shell health' };
    }
    return { severity: 'ok', reason: '' };
  }
  return { severity: 'ok', reason: '' };
}

export function beginnerInvertBlock(candidate, existingList, beginnerMode) {
  if (!beginnerMode) {
    return { severity: 'ok', reason: '' };
  }
  if (!candidate?.species) {
    return { severity: 'ok', reason: '' };
  }
  const tags = new Set(candidate.species.tags ?? []);
  const mouth = candidate.species.mouth_size_in ?? candidate.species.adult_size_in ?? 0;
  if (mouth >= 4 && !candidate.species.invert_safe) {
    return { severity: 'bad', reason: 'Large predator unsafe with inverts' };
  }
  if (mouth >= 2.5 && !candidate.species.invert_safe) {
    const hasShrimp = existingList.some((entry) => (entry.species?.tags ?? []).includes('shrimp'));
    if (hasShrimp) {
      return { severity: 'bad', reason: 'Shrimp risk due to mouth size' };
    }
  }
  return { severity: 'ok', reason: '' };
}

export function evaluateSalinity(candidate, tank) {
  if (!candidate?.species) return { severity: 'ok', reason: '' };
  const salinity = candidate.species.salinity ?? 'freshwater';
  const current = tank?.water?.salinity ?? 'freshwater';
  if (salinity === current) {
    return { severity: 'ok', reason: '' };
  }
  const hierarchy = ['freshwater', 'brackish-low', 'brackish-high', 'marine'];
  const diff = Math.abs(hierarchy.indexOf(salinity) - hierarchy.indexOf(current));
  if (diff >= 2) {
    return { severity: 'bad', reason: 'Salinity mismatch' };
  }
  if (diff === 1) {
    return { severity: 'warn', reason: 'Borderline salinity mix' };
  }
  return { severity: 'ok', reason: '' };
}

export function evaluateFlow(candidate, water) {
  if (!candidate?.species) return { severity: 'ok', reason: '' };
  const preference = candidate.species.flow ?? 'moderate';
  const current = water?.flow ?? 'moderate';
  const ladder = ['low', 'moderate', 'high'];
  const diff = Math.abs(ladder.indexOf(preference) - ladder.indexOf(current));
  if (diff >= 2) {
    return { severity: 'bad', reason: 'Flow rate unsuitable' };
  }
  if (diff === 1) {
    return { severity: 'warn', reason: 'Adjust flow pattern' };
  }
  return { severity: 'ok', reason: '' };
}

export function evaluateBlackwater(candidate, water) {
  if (!candidate?.species) return { severity: 'ok', reason: '' };
  const preference = candidate.species.blackwater;
  if (!preference) return { severity: 'ok', reason: '' };
  const active = Boolean(water?.blackwater);
  if (preference === 'requires' && !active) {
    return { severity: 'bad', reason: 'Requires tannins / blackwater' };
  }
  if (preference === 'prefers' && !active) {
    return { severity: 'warn', reason: 'Prefers tannin-rich water' };
  }
  return { severity: 'ok', reason: '' };
}

export function checkGroupRule(candidate, existingList) {
  if (!candidate?.species?.group) {
    return null;
  }
  const { group } = candidate.species;
  const total = existingList
    .filter((entry) => entry.species?.id === candidate.species.id)
    .reduce((acc, entry) => acc + (entry.qty ?? 0), 0);
  const proposedTotal = total + (candidate.qty ?? 0);

  if (group.type === 'shoal' && group.min && proposedTotal < group.min) {
    return {
      severity: 'warn',
      message: `Needs ${group.min}+ group (planned ${proposedTotal})`,
    };
  }

  if (group.type === 'harem') {
    const males = proposedTotal;
    const females = existingList
      .filter((entry) => entry.species?.id === `${candidate.species.id}_female`)
      .reduce((acc, entry) => acc + (entry.qty ?? 0), 0);
    const ratio = group.ratio ?? { m: 1, f: 2 };
    const needFemales = Math.ceil((males * (ratio.f ?? 2)) / (ratio.m ?? 1));
    if (needFemales > females) {
      return {
        severity: 'bad',
        message: `Harem: ${males}♂ need ≥${needFemales}♀ (have ${females})`,
      };
    }
  }

  return null;
}
