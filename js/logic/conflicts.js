// ensure any hard rules reference IDs that exist above
export const HARD_CONFLICTS = new Set([
  'betta_male|betta_male',
  'betta_male|guppy_male',
  'betta_male|tiger_barb',
]);

// helper to build symmetric keys: a|b in alpha order
export function keyPair(a, b) {
  return [a, b].sort().join('|');
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

  const matrixKey = keyPair(a.id, b.id);
  if (HARD_CONFLICTS.has(matrixKey)) {
    result.severity = maxSeverity(result.severity, 'bad');
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

  if (aTags.has('fin_nipper') && (bTags.has('fin_sensitive') || bTags.has('betta'))) {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('Fin-nipping risk');
  }

  if (bTags.has('fin_nipper') && (aTags.has('fin_sensitive') || aTags.has('betta'))) {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('Fin-nipping risk');
  }

  if (aTags.has('territorial') || bTags.has('territorial')) {
    result.severity = maxSeverity(result.severity, 'warn');
    result.reasons.push('Territorial overlap');
  }

  if (aTags.has('shrimp_risk') && b.category === 'shrimp') {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('Predation risk (shrimp)');
  }

  if (bTags.has('shrimp_risk') && a.category === 'shrimp') {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('Predation risk (shrimp)');
  }

  if (aTags.has('snail_risk') && b.category === 'snail') {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('Predation risk (snail)');
  }

  if (bTags.has('snail_risk') && a.category === 'snail') {
    result.severity = maxSeverity(result.severity, 'bad');
    result.reasons.push('Predation risk (snail)');
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
  if (species.category === 'snail') {
    // Only a GH the user entered can be too low; an unentered GH is unknown, not soft.
    const gh = tankContext?.water?.gH;
    if (typeof gh === 'number' && Number.isFinite(gh) && gh < 6) {
      return { severity: 'warn', reason: 'Low gH risks shell health' };
    }
  }
  return { severity: 'ok', reason: '' };
}

const SUPPORTED_SALINITY = new Set(['fresh', 'brackish-low', 'brackish-high', 'dual']);
const SALINITY_MARINE_REASON = 'Not compatible – Salinity (Marine not supported)';
const SALINITY_MIX_REASON = 'Mixed fresh/brackish stock—target brackish-low or use dual-tolerant species.';

export function evaluateSalinity(candidate, tank) {
  const current = tank?.water?.salinity ?? 'fresh';
  if (current === 'marine') {
    return { severity: 'bad', reason: SALINITY_MARINE_REASON, code: 'marine' };
  }
  if (!candidate?.species) {
    if (!SUPPORTED_SALINITY.has(current)) {
      return { severity: 'bad', reason: SALINITY_MARINE_REASON, code: 'marine' };
    }
    return { severity: 'ok', reason: '', code: 'match' };
  }
  const preference = candidate.species.salinity ?? 'fresh';
  if (preference === 'marine') {
    return { severity: 'bad', reason: SALINITY_MARINE_REASON, code: 'marine' };
  }
  if (!SUPPORTED_SALINITY.has(preference) || !SUPPORTED_SALINITY.has(current)) {
    return { severity: 'bad', reason: SALINITY_MARINE_REASON, code: 'marine' };
  }
  if (preference === current) {
    return { severity: 'ok', reason: '', code: 'match' };
  }
  if (preference === 'dual' && (current === 'fresh' || current === 'brackish-low' || current === 'dual')) {
    return { severity: 'ok', reason: '', code: 'match' };
  }
  if (current === 'dual' && (preference === 'fresh' || preference === 'brackish-low' || preference === 'dual')) {
    return { severity: 'ok', reason: '', code: 'match' };
  }
  return { severity: 'warn', reason: SALINITY_MIX_REASON, code: 'mixed' };
}

// Compares a species' circulation preference with the tank's flow, only when the user has said what
// that flow is. There is no assumed "moderate" tank: unknown flow is not evaluated.
export function evaluateFlow(candidate, water) {
  if (!candidate?.species) return { severity: 'ok', reason: '' };
  const ladder = ['low', 'moderate', 'high'];
  const current = water?.flow;
  if (!ladder.includes(current)) return { severity: 'ok', reason: '', code: 'not-entered' };
  const preference = candidate.species.flow ?? 'moderate';
  const diff = Math.abs(ladder.indexOf(preference) - ladder.indexOf(current));
  if (diff >= 2) {
    return { severity: 'bad', reason: 'Flow rate unsuitable' };
  }
  if (diff === 1) {
    return { severity: 'warn', reason: 'Adjust flow pattern' };
  }
  return { severity: 'ok', reason: '' };
}

// water.blackwater: true (tannins present), false (the user said no tannins) or null/undefined (not
// entered). A preference is a tip, never a failure. A species that requires tannins is a husbandry
// requirement: it is flagged when the tank is unknown and is red only when the user said tannins are off.
export function evaluateBlackwater(candidate, water) {
  if (!candidate?.species) return { severity: 'ok', reason: '' };
  const preference = candidate.species.blackwater;
  if (!preference) return { severity: 'ok', reason: '' };
  const current = water?.blackwater;
  if (preference === 'requires') {
    if (current === true) return { severity: 'ok', reason: '' };
    if (current === false) return { severity: 'bad', reason: 'Requires tannins / blackwater' };
    return { severity: 'warn', reason: 'Needs tannin-stained (blackwater) water — plan for botanicals such as leaf litter' };
  }
  if (preference === 'prefers' && current !== true) {
    return { severity: 'ok', reason: '', tip: 'Tip: benefits from tannins' };
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

  if (group.type === 'social' && group.min && proposedTotal < group.min) {
    return {
      severity: 'warn',
      message: `Not a schooling fish, but keep ${group.min}+ together (planned ${proposedTotal})`,
    };
  }

  if (group.type === 'colony' && group.min && proposedTotal < group.min) {
    return {
      severity: 'warn',
      message: `Colony thrives at ${group.min}+ (planned ${proposedTotal})`,
    };
  }

  if (group.type === 'harem') {
    const ratio = group.ratio ?? { m: 1, f: 2 };
    const femaleId = group.femaleId ?? `${candidate.species.id}_female`;
    const females = existingList
      .filter((entry) => entry.species?.id === femaleId)
      .reduce((acc, entry) => acc + (entry.qty ?? 0), 0);
    if (females === 0) {
      return {
        severity: 'warn',
        message: 'Plan corresponding females to balance harem',
      };
    }
    const males = proposedTotal;
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
