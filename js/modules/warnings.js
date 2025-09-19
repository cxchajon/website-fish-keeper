// js/modules/warnings.js
// Calculates temp / pH overlap warnings and a 0–100 "environment fit" score.

import { toArray, canonName } from './utils.js';

// === Tunables ===
// Base "narrow overlap" thresholds (friendly to community fish)
const BASE_TEMP_WARN = 5;    // degrees F of overlap considered "narrow"
const BASE_PH_WARN   = 0.5;  // pH units of overlap considered "narrow"

// Extra tightening only for sensitive species (scaleless + dwarf cichlids)
const SENSITIVE_TEMP_PAD = 1;   // °F
const SENSITIVE_PH_PAD   = 0.1; // pH units

// --- Helpers ---
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
  return hi - lo; // negative => no overlap
}

function speciesLabel(sp) {
  return (sp && sp.name) || 'Unknown';
}

// --- Core compute ---
export function computeEnvironmentWarnings(stock) {
  const items = toArray(stock).filter(r => r && r.name && (r.qty || 0) > 0);

  // NEW: empty tank -> 0%
  if (items.length === 0) {
    return { warnings: [], score: 0 };
  }

  const warnings = [];

  // pairwise compare all species in stock
  for (let i = 0; i < items.length; i++) {
    const aName = items[i].name;
    const aSp = findSpeciesByName(aName);
    const aTemp = adjustedRange(aSp, 'temp');
    const aPh   = adjustedRange(aSp, 'ph');

    for (let j = i + 1; j < items.length; j++) {
      const bName = items[j].name;
      const bSp = findSpeciesByName(bName);
      const bTemp = adjustedRange(bSp, 'temp');
      const bPh   = adjustedRange(bSp, 'ph');

      // Temperature checks
      const tW = overlapWidth(aTemp, bTemp);
      if (tW == null) continue; // skip if either missing data
      if (tW < 0) {
        warnings.push(`No **temperature** overlap: ${speciesLabel(aSp)} ↔ ${speciesLabel(bSp)}.`);
      } else if (tW < BASE_TEMP_WARN) {
        warnings.push(`**Tight temperature window** (${tW.toFixed(1)}°F): ${speciesLabel(aSp)} ↔ ${speciesLabel(bSp)}.`);
      }

      // pH checks (only if both have pH data)
      const pW = overlapWidth(aPh, bPh);
      if (pW != null) {
        if (pW < 0) {
          warnings.push(`No **pH** overlap: ${speciesLabel(aSp)} ↔ ${speciesLabel(bSp)}.`);
        } else if (pW < BASE_PH_WARN) {
          warnings.push(`**Tight pH window** (${pW.toFixed(2)}): ${speciesLabel(aSp)} ↔ ${speciesLabel(bSp)}.`);
        }
      }
    }
  }

  // Score: start at 100, subtract for issues (only if there is stock)
  let score = 100;
  const hardHits = warnings.filter(w => w.includes('No **temperature** overlap') || w.includes('No **pH** overlap')).length;
  const softHits = warnings.length - hardHits;

  score -= hardHits * 25; // hard conflicts hurt a lot
  score -= softHits * 7;  // narrow windows are lighter dings
  if (score < 0) score = 0;

  return { warnings, score };
}

// For convenience if someone attaches to window
export const Environment = { compute: computeEnvironmentWarnings };
if (!window.Environment) window.Environment = Environment;