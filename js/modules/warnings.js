// js/modules/warnings.js
// Environment Fit (Temp & pH overlap)
// - 0 species  -> 0%
// - 1 species  -> 0% (no comparison yet)
// - 2+ species -> score grows by pairwise quality
// Any no-overlap in temp or pH collapses the pair score to 0.
// Includes tolerant species matching (exact OR substring either way).

import { toArray, canonName } from './utils.js';

// ===== Tunables =====
const BASE_TEMP_WARN = 5;    // °F — overlap < 5°F is "tight"
const BASE_PH_WARN   = 0.5;  // pH — overlap < 0.5 is "tight"

const SENSITIVE_TEMP_PAD = 1;   // extra tighten for sensitive species
const SENSITIVE_PH_PAD   = 0.1; // pH units

// ===== Helpers =====
function findSpeciesByName(name) {
  const data = window.FISH_DATA || [];
  const key = canonName(name);
  if (!key) return null;

  // 1) exact canonical match
  let found = data.find(row => canonName(row.name || row.id || '') === key);

  // 2) tolerant fallback: substring in either direction
  if (!found) {
    found = data.find(row => {
      const n = canonName(row.name || row.id || '');
      return n.includes(key) || key.includes(n);
    });
  }

  return found || null;
}

function adjustedRange(sp, key) {
  // key: 'temp' or 'ph'
  const rng = sp && Array.isArray(sp[key]) ? sp[key] : null;
  if (!rng || rng.length !== 2) return null;
  let [min, max] = rng;
  if (sp.sensitive) {
    if (key === 'temp') { min += SENSITIVE_TEMP_PAD; max -= SENSITIVE_TEMP_PAD; }
    if (key === 'ph')   { min += SENSITIVE_PH_PAD;   max -= SENSITIVE_PH_PAD;   }
  }
  if (min > max) [min, max] = [max, min]; // safety
  return [min, max];
}

function overlapWidth(aRange, bRange) {
  if (!aRange || !bRange) return null;
  const [aMin, aMax] = aRange;
  const [bMin, bMax] = bRange;
  const lo = Math.max(aMin, bMin);
  const hi = Math.min(aMax, bMax);
  return hi - lo; // negative => no overlap; 0 => edge-touch (tight)
}

function speciesLabel(sp) {
  return (sp && sp.name) || 'Unknown';
}

// Per-pair quality score in [0..1], plus warnings.
// IMPORTANT: use MIN(tempScore, phScore) so any hard miss -> 0.
function scorePair(aSp, bSp, warnings) {
  const aT = adjustedRange(aSp, 'temp');
  const bT = adjustedRange(bSp, 'temp');
  const aP = adjustedRange(aSp, 'ph');
  const bP = adjustedRange(bSp, 'ph');

  // Temperature component
  let tScore = 0.8; // neutral default if data missing
  const tW = overlapWidth(aT, bT);
  if (tW != null) {
    if (tW < 0) {
      tScore = 0.0;
      warnings.push(`No **temperature** overlap: ${speciesLabel(aSp)} ↔ ${speciesLabel(bSp)}.`);
    } else if (tW < BASE_TEMP_WARN) {
      tScore = 0.6;
      warnings.push(`**Tight temperature window** (${tW.toFixed(1)}°F): ${speciesLabel(aSp)} ↔ ${speciesLabel(bSp)}.`);
    } else {
      tScore = 1.0;
    }
  }

  // pH component
  let pScore = 0.9; // neutral default if data missing
  const pW = overlapWidth(aP, bP);
  if (pW != null) {
    if (pW < 0) {
      pScore = 0.0;
      warnings.push(`No **pH** overlap: ${speciesLabel(aSp)} ↔ ${speciesLabel(bSp)}.`);
    } else if (pW < BASE_PH_WARN) {
      pScore = 0.7;
      warnings.push(`**Tight pH window** (${pW.toFixed(2)}): ${speciesLabel(aSp)} ↔ ${speciesLabel(bSp)}.`);
    } else {
      pScore = 1.0;
    }
  }

  return Math.min(tScore, pScore);
}

// ===== Core compute =====
export function computeEnvironmentWarnings(stock) {
  const items = toArray(stock).filter(r => r && r.name && (r.qty || 0) > 0);

  if (items.length === 0) return { warnings: [], score: 0 };
  if (items.length === 1) return { warnings: [], score: 0 };

  const warnings = [];
  let qualitySum = 0;
  let pairCount = 0;

  for (let i = 0; i < items.length; i++) {
    const aSp = findSpeciesByName(items[i].name);
    if (!aSp) continue;

    for (let j = i + 1; j < items.length; j++) {
      const bSp = findSpeciesByName(items[j].name);
      if (!bSp) continue;

      const q = scorePair(aSp, bSp, warnings);
      qualitySum += q;
      pairCount++;
    }
  }

  if (pairCount === 0) return { warnings, score: 0 };

  const avgQuality = qualitySum / pairCount; // 0..1
  const score = Math.max(0, Math.min(100, Math.round(avgQuality * 100)));
  return { warnings, score };
}

// Optional global handle
export const Environment = { compute: computeEnvironmentWarnings };
if (!window.Environment) window.Environment = Environment;