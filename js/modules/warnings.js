// js/modules/warnings.js
// Aggression + environment warnings, with Env Fit bar.
// Your rules:
// • Edge-touching ranges → WARNING
// • WARNING if overlap < 5.0 °F, or < 1.0 pH
// • INFO if overlap within 5–7 °F, or 1.0–1.5 pH
// • Temp shown as whole numbers; pH to 1 decimal
// • Missing data: fallback table or console snippet (no UI noise)
// • Quantities ignored
// • If any species has { sensitive: true } → thresholds +2 °F / +0.2 pH
// • Env Fit bar starts at 0% and only fills when there are ≥2 species.

import { toArray } from './utils.js?v=930';
import { readStock } from './stock.js?v=930';
import { renderBioload } from './bioload.js?v=930';

/* ---------------- Config ---------------- */
function cfg(key, def){
  const root = (window.CONFIG && typeof window.CONFIG === 'object') ? window.CONFIG : {};
  return (key in root) ? root[key] : def;
}
const BASE_TEMP_WARN_LT   = cfg('TEMP_WARN_LT', 5.0);
const BASE_TEMP_INFO_MAX  = cfg('TEMP_INFO_MAX', 7.0);
const BASE_PH_WARN_LT     = cfg('PH_WARN_LT', 1.0);
const BASE_PH_INFO_MAX    = cfg('PH_INFO_MAX', 1.5);
const SENS_TEMP_BUMP = cfg('SENS_TEMP_BUMP', 2.0);
const SENS_PH_BUMP   = cfg('SENS_PH_BUMP', 0.2);

/* ---------------- Helpers ---------------- */
function canonNameLocal(s){
  return (s||'').toString().trim().toLowerCase()
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .replace(/\s*\([^)]*\)\s*/g,' ')
    .trim();
}
function firstNumber(...vals){
  for (const v of vals){
    if (v == null) continue;
    const m = String(v).match(/-?\d+(\.\d+)?/);
    if (!m) continue;
    const n = Number(m[0]);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}
function lookupDataFor(name){
  const key = canonNameLocal(name);
  const src = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
  if (!src) return null;
  if (Array.isArray(src)) {
    for (let i=0;i<src.length;i++){
      const row = src[i] || {};
      const n = canonNameLocal(row.name || row.species || row.common || '');
      if (n === key) return row;
    }
  } else if (typeof src === 'object') {
    return src[name] || src[key] || null;
  }
  return null;
}

/* ---------------- Fallback data (silent) ---------------- */
const FALLBACK_DATA = {
  'white cloud mountain minnow': { minTempF: 57, maxTempF: 72, minPH: 6.0, maxPH: 8.0 },
  'tiger barb':                   { minTempF: 72, maxTempF: 82, minPH: 6.0, maxPH: 7.5 },
  'neon tetra':                   { minTempF: 72, maxTempF: 80, minPH: 5.0, maxPH: 6.5 },
  'ram cichlid':                  { minTempF: 78, maxTempF: 86, minPH: 5.0, maxPH: 7.0 },
  'african cichlid':              { minTempF: 74, maxTempF: 82, minPH: 7.8, maxPH: 8.5 },
};

/* ---------------- Temp & pH parsing ---------------- */
function cToF(c){ return (c*9/5)+32; }
function parseTempToF(any){
  if (any == null) return null;
  const s = String(any);
  const hasC = /(?:°?\s*C|celsius)/i.test(s);
  const hasF = /(?:°?\s*F|fahrenheit)/i.test(s);
  const nums = s.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  let min = Number(nums[0]);
  let max = (nums.length > 1) ? Number(nums[1]) : min;
  if (min > max) [min, max] = [max, min];
  if (hasC && !hasF){ min=cToF(min); max=cToF(max); }
  return { min, max, assumedF: !hasC && !hasF };
}
function readTempRangeF(row, speciesName){
  if (!row || typeof row !== 'object') {
    const fb = FALLBACK_DATA[canonNameLocal(speciesName)];
    if (fb) return { min: fb.minTempF, max: fb.maxTempF };
    return null;
  }
  let minF = firstNumber(row.minTempF, row.tempMinF, row.tMinF, row.temperatureMinF, row.tempFMin);
  let maxF = firstNumber(row.maxTempF, row.tempMaxF, row.tMaxF, row.temperatureMaxF, row.tempFMax);
  if (minF!=null && maxF!=null){
    if (minF > maxF) [minF, maxF] = [maxF, minF];
    return { min:minF, max:maxF };
  }
  let minC = firstNumber(row.minTempC, row.tempMinC, row.tMinC, row.temperatureMinC, row.tempCMin);
  let maxC = firstNumber(row.maxTempC, row.tempMaxC, row.tMaxC, row.temperatureMaxC, row.tempCMax);
  if (minC!=null && maxC!=null){
    if (minC > maxC) [minC, maxC] = [maxC, minC];
    return { min:cToF(minC), max:cToF(maxC) };
  }
  const fields = [
    'temp','temperature','tempRange','temperatureRange','rangeTemp',
    'minTemp','maxTemp','lowestTemp','highestTemp','temp_low','temp_high',
    'temperatureF','temperatureC'
  ];
  for (const key of fields){
    if (!(key in row)) continue;
    const r = parseTempToF(row[key]);
    if (r){
      const looksC = /c(elsius)?/i.test(key);
      const looksF = /f(ahrenheit)?/i.test(key);
      let {min,max} = r;
      if (r.assumedF && looksC && !looksF){ min=cToF(min); max=cToF(max); }
      if (min > max) [min,max] = [max,min];
      return { min, max };
    }
  }
  const fb = FALLBACK_DATA[canonNameLocal(speciesName)];
  if (fb) return { min: fb.minTempF, max: fb.maxTempF };
  console.log(`[fish-data] Add temp for "${speciesName}": { minTempF: X, maxTempF: Y }`);
  return null;
}
function parsePh(any){
  if (any == null) return null;
  const s = String(any);
  const nums = s.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  let min = Number(nums[0]);
  let max = (nums.length > 1) ? Number(nums[1]) : min;
  if (min > max) [min, max] = [max, min];
  return { min, max };
}
function readPhRange(row, speciesName){
  if (!row || typeof row !== 'object') {
    const fb = FALLBACK_DATA[canonNameLocal(speciesName)];
    if (fb) return { min: fb.minPH, max: fb.maxPH };
    return null;
  }
  const min = firstNumber(row.minPH, row.phMin, row.minPh, row.pHMin, row.min_pH, row.ph_low, row.pHL, row.pH_low);
  const max = firstNumber(row.maxPH, row.phMax, row.maxPh, row.pHMax, row.max_pH, row.ph_high, row.pHH, row.pH_high);
  if (min!=null && max!=null){
    return { min: Math.min(min,max), max: Math.max(min,max) };
  }
  const fields = ['ph','pH','phRange','pHRange','water','chemistry','notes'];
  for (const key of fields){
    if (!(key in row)) continue;
    const r = parsePh(row[key]);
    if (r) return r;
  }
  const fb = FALLBACK_DATA[canonNameLocal(speciesName)];
  if (fb) return { min: fb.minPH, max: fb.maxPH };
  console.log(`[fish-data] Add pH for "${speciesName}": { minPH: A, maxPH: B }`);
  return null;
}

/* ---------------- Overlap & formatting ---------------- */
function overlap(ranges){
  const valid = ranges.filter(r=>r && r.min!=null && r.max!=null);
  if (!valid.length) return null;
  let lo = -Infinity, hi = Infinity;
  for (const r of valid){ lo = Math.max(lo, r.min); hi = Math.min(hi, r.max); }
  return { min: lo, max: hi, count: valid.length };
}
function spanWidth(r){ return (r ? r.max - r.min : -Infinity); }
function fmtTemp(n){ return Math.round(n); }
function fmtPh(n){ return Number(n).toFixed(1); }

/* ---------------- Sensitive ---------------- */
function anySensitive(speciesNames){
  for (const name of speciesNames){
    const row = lookupDataFor(name);
    if (row && (row.sensitive === true || row.sensitivity === 'high')) return true;
  }
  return false;
}

/* ---------------- Env Fit score (0–100) ---------------- */
function envFitScore(tempOv, phOv, tempInfoMax, phInfoMax){
  const tempWidth = tempOv ? Math.max(0, spanWidth(tempOv)) : 0;
  const phWidth   = phOv   ? Math.max(0, spanWidth(phOv))   : 0;
  function score(width, okMax){
    if (width <= 0) return 0;
    if (width >= okMax) return 100;
    return Math.round((width / okMax) * 100);
  }
  const tScore = score(tempWidth, tempInfoMax);
  const pScore = score(phWidth,   phInfoMax);
  return Math.min(tScore, pScore);
}

/* ---------------- Main renderer ---------------- */
export function renderWarnings(){
  const box = document.getElementById('aggression-warnings') || document.getElementById('warnings');
  if (!box) return;
  box.innerHTML = '';

  const stock = readStock();
  const names = stock.map(s=>s.name);

  // Sensitive bumps
  const sens = anySensitive(names);
  const TEMP_WARN_LT  = BASE_TEMP_WARN_LT  + (sens ? SENS_TEMP_BUMP : 0);
  const TEMP_INFO_MAX = BASE_TEMP_INFO_MAX + (sens ? SENS_TEMP_BUMP : 0);
  const PH_WARN_LT    = BASE_PH_WARN_LT    + (sens ? SENS_PH_BUMP   : 0);
  const PH_INFO_MAX   = BASE_PH_INFO_MAX   + (sens ? SENS_PH_BUMP   : 0);

  // A) Aggression module
  let res = { warnings: [], score: 0 };
  if (window.Aggression && typeof window.Aggression.compute === 'function') {
    try {
      res = window.Aggression.compute(stock, {
        planted: !!document.getElementById('planted')?.checked,
        gallons: parseFloat(document.getElementById('gallons')?.value || '0') || 0
      }) || res;
    } catch(e){}
  }

  // B) Environment overlap
  const tempRanges = [];
  const phRanges   = [];
  for (const n of names){
    const row = lookupDataFor(n);
    const t = readTempRangeF(row, n);
    const p = readPhRange(row, n);
    if (t) tempRanges.push(t);
    if (p) phRanges.push(p);
  }

  const msgs = [];

  // Temperature
  if (tempRanges.length >= 2){
    const ov = overlap(tempRanges);
    if (!ov || ov.max < ov.min){
      msgs.push('⚠️ Temperature ranges do not overlap.');
    } else {
      const w = Math.max(0, spanWidth(ov));
      if (w < TEMP_WARN_LT){
        msgs.push('⚠️ Temperature overlap too narrow.');
      } else if (w <= TEMP_INFO_MAX){
        msgs.push(`ℹ️ Temperature overlap is somewhat narrow: ${fmtTemp(ov.min)}–${fmtTemp(ov.max)} °F.`);
      }
    }
  }

  // pH
  if (phRanges.length >= 2){
    const ov = overlap(phRanges);
    if (!ov || ov.max < ov.min){
      msgs.push('⚠️ pH ranges do not overlap.');
    } else {
      const w = Math.max(0, spanWidth(ov));
      if (w < PH_WARN_LT){
        msgs.push('⚠️ pH overlap too narrow.');
      } else if (w <= PH_INFO_MAX){
        msgs.push(`ℹ️ pH overlap is somewhat narrow: ${fmtPh(ov.min)}–${fmtPh(ov.max)}.`);
      }
    }
  }

  // Render messages
  const allWarnings = [...toArray(res.warnings), ...msgs];
  allWarnings.forEach(w=>{
    const d = document.createElement('div');
    d.textContent = w;
    box.appendChild(d);
  });

  // Aggression bar
  const aggBar = document.getElementById('aggBarFill');
  if (aggBar && typeof res.score === 'number') {
    aggBar.style.width = Math.min(100, Math.max(0, res.score)) + '%';
  }

  // Environment Fit bar — starts at 0% until we have at least 2 species
  const envBar = document.getElementById('envBarFill');
  if (envBar){
    if (names.length < 2){
      envBar.style.width = '0%';
    } else {
      const tOv = (tempRanges.length >= 2) ? overlap(tempRanges) : null;
      const pOv = (phRanges.length   >= 2) ? overlap(phRanges)   : null;
      const fit = envFitScore(tOv, pOv, TEMP_INFO_MAX, PH_INFO_MAX);
      envBar.style.width = Math.min(100, Math.max(0, fit)) + '%';
      envBar.classList.remove('pulse'); void envBar.offsetWidth; envBar.classList.add('pulse');
      setTimeout(()=> envBar.classList.remove('pulse'), 500);
    }
  }
}

/* Public: refresh full UI (warnings + bioload) */
export function renderAll(){
  renderWarnings();
  renderBioload();
} 