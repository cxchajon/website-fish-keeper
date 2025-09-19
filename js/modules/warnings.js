// js/modules/warnings.js
// Environment Fit (Temp & pH overlap) — warnings + score that only
// starts growing once there are 2+ species. A hard no-overlap in temp/pH
// now collapses the pair score to 0 (min of temp & pH).

import { toArray, canonName } from './utils.js';

// ========= Tunables (friendly defaults) =========
const BASE_TEMP_WARN = 5;    // °F — overlap < 5°F is "tight"
const BASE_PH_WARN   = 0.5;  // pH — overlap < 0.5 is "tight"

// Extra tightening only for sensitive species (scaleless + dwarf cichlids)
const SENSITIVE_TEMP_PAD = 1;   // °F
const SENSITIVE_PH_PAD   = 0.1; // pH units

// ========= Helpers =========
function findSpeciesByName(name) {
  const key = canonName(name);
  const src = window.FISH_DATA || [];
  for (let i = 0; i < src.length; i++) {
    const row = src[i];
    const n = canonName(row.name || row.id || '');
    if (n === key) return row;
  }
  return null;
}

function adjustedRange(sp, key) {
  // key is "temp" or "ph"
  const rng = sp && Array.isArray(sp[key]) ? sp[key] : null;
  if (!rng || rng.length !== 2) return null;
  let [min, max] = rng;
  if (sp.sensitive) {
    if (key === 'temp') {
      min = min + SENSITIVE_TEMP_PAD;
      max = max - SENSITIVE_TEMP_PAD;
    } else if (key === 'ph') {
      min = min + SENSITIVE_PH_PAD;
      max = max - SENSITIVE_PH_PAD;
    }
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
  return hi - lo; // negative => no overlap; 0 => edge-touch (counts as tight)
}

function speciesLabel(sp) {
  return (sp && sp.name) || 'Unknown';
}

// Per-pair quality score in [0..1], plus warnings
// IMPORTANT CHANGE: we return MIN(tempScore, phScore) so any hard miss -> 0.
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

  // HARDENED: use worst side so any no-overlap collapses the pair score
  return Math.min(tScore, pScore);
}

// ========= Core compute =========
export function computeEnvironmentWarnings(stock) {
  const items = toArray(stock).filter(r => r && r.name && (r.qty || 0) > 0);

  // 0 species -> 0%
  if (items.length === 0) return { warnings: [], score: 0 };

  // 1 species -> 0% (no env comparison yet)
  if (items.length === 1) return { warnings: [], score: 0 };

  // 2+ species -> score by average pairwise quality
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