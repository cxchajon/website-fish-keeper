// js/modules/warnings.js
// Aggression + environment warnings. Uses bioload.js for the bar.

import { toArray } from './utils.js';
import { readStock } from './stock.js';
import { renderBioload } from './bioload.js';

/* ===== Canon + dataset lookup ===== */
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

/* ===== Temp & pH parsing ===== */
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

function readTempRangeF(row){
  if (!row || typeof row !== 'object') return null;

  // explicit °F
  let minF = firstNumber(row.minTempF, row.tempMinF, row.tMinF, row.temperatureMinF, row.tempFMin);
  let maxF = firstNumber(row.maxTempF, row.tempMaxF, row.tMaxF, row.temperatureMaxF, row.tempFMax);
  if (minF!=null && maxF!=null){
    if (minF > maxF) [minF, maxF] = [maxF, minF];
    return { min:minF, max:maxF };
  }

  // °C → °F
  let minC = firstNumber(row.minTempC, row.tempMinC, row.tMinC, row.temperatureMinC, row.tempCMin);
  let maxC = firstNumber(row.maxTempC, row.tempMaxC, row.tMaxC, row.temperatureMaxC, row.tempCMax);
  if (minC!=null && maxC!=null){
    if (minC > maxC) [minC, maxC] = [maxC, minC];
    return { min:cToF(minC), max:cToF(maxC) };
  }

  // generic / strings
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
function readPhRange(row){
  if (!row || typeof row !== 'object') return null;

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
  return null;
}

/* ===== Overlap ===== */
function overlap(ranges){
  const valid = ranges.filter(r=>r && r.min!=null && r.max!=null);
  if (!valid.length) return null;
  let lo = -Infinity, hi = Infinity;
  for (const r of valid){ lo = Math.max(lo, r.min); hi = Math.min(hi, r.max); }
  return { min: lo, max: hi, count: valid.length };
}

/* ===== Main renderer ===== */
export function renderWarnings(){
  const box = document.getElementById('aggression-warnings') || document.getElementById('warnings');
  if (!box) return;

  box.innerHTML = '';

  const stock = readStock(); // [{name, qty}]
  const names = stock.map(s=>s.name);

  // A) Aggression (external module)
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
    const t = readTempRangeF(row);
    const p = readPhRange(row);
    if (t) tempRanges.push(t);
    if (p) phRanges.push(p);
  }

  const msgs = [];
  if (tempRanges.length >= 2){
    const ov = overlap(tempRanges);
    if (!ov || ov.max < ov.min){
      msgs.push('⚠️ Temperature ranges do not overlap across selected species.');
    } else {
      const span = ov.max - ov.min;
      if (span <= 2){
        msgs.push(`ℹ️ Temperature overlap is very tight: ${ov.min.toFixed(1)}–${ov.max.toFixed(1)} °F.`);
      } else if (span <= 4){
        msgs.push(`ℹ️ Temperature overlap is somewhat narrow: ${ov.min.toFixed(1)}–${ov.max.toFixed(1)} °F.`);
      }
    }
  }
  if (phRanges.length >= 2){
    const ov = overlap(phRanges);
    if (!ov || ov.max < ov.min){
      msgs.push('⚠️ pH ranges do not overlap across selected species.');
    } else {
      const span = ov.max - ov.min;
      if (span <= 0.2){
        msgs.push(`ℹ️ pH overlap is very tight: ${ov.min.toFixed(1)}–${ov.max.toFixed(1)}.`);
      } else if (span <= 0.4){
        msgs.push(`ℹ️ pH overlap is somewhat narrow: ${ov.min.toFixed(1)}–${ov.max.toFixed(1)}.`);
      }
    }
  }

  const allWarnings = [...toArray(res.warnings), ...msgs];
  allWarnings.forEach(w=>{
    const d = document.createElement('div');
    d.textContent = w;
    box.appendChild(d);
  });

  // Aggression bar
  const bar = document.getElementById('aggBarFill');
  if (bar && typeof res.score === 'number') {
    bar.style.width = Math.min(100, Math.max(0, res.score)) + '%';
  }
}

/* Public: refresh full UI (warnings + bioload) */
export function renderAll(){
  renderWarnings();
  renderBioload();
}