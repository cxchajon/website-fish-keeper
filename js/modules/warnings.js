// js/modules/warnings.js
import { toArray } from './utils.js';
import { renderBioload } from './bioload.js';
import { readStock } from './stock.js';

/* ========== Helpers ========== */
function canonNameLocal(s){
  return (s||'').toString().trim().toLowerCase()
    .replace(/[_-]+/g,' ').replace(/\s+/g,' ')
    .replace(/\s*\([^)]*\)\s*/g,' ').trim();
}
function cToF(c){ return (c*9/5)+32; }
function firstNumber(...vals){
  for (const v of vals){
    if (v==null) continue;
    const m = String(v).match(/-?\d+(\.\d+)?/);
    if (!m) continue;
    const n = Number(m[0]);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/** Try to pull the species row out of whatever global dataset you have */
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

/** Parse a temperature range from MANY possible shapes; return {min,max} in °F or null */
function parseTempToF(any){
  if (any == null) return null;
  const s = String(any);

  // detect unit hints
  const hasC = /(?:°?\s*C|celsius)/i.test(s);
  const hasF = /(?:°?\s*F|fahrenheit)/i.test(s);

  // get up to two numbers (range)
  const nums = s.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return null;

  let min = Number(nums[0]);
  let max = (nums.length > 1) ? Number(nums[1]) : min;

  // Swap if reversed
  if (min > max) [min, max] = [max, min];

  // If Celsius, convert
  if (hasC && !hasF) {
    min = cToF(min); max = cToF(max);
  }

  // If no explicit unit: we’ll try to infer later using field name; for now assume °F
  return { min, max, assumedF: !hasC && !hasF };
}

/** Parse pH range from strings or numbers; return {min,max} or null */
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

/** Read temp range in °F from a row with many possible field names */
function readTempRangeF(row){
  if (!row || typeof row !== 'object') return null;

  // Candidate fields — add more here if your data uses different keys
  const fields = [
    // explicit F
    'minTempF','maxTempF','tempMinF','tempMaxF','tMinF','tMaxF','temperatureMinF','temperatureMaxF',
    // generic / strings, often include units
    'temp','temperature','tempRange','temperatureRange','rangeTemp','temperatureF','temperatureC',
    'minTemp','maxTemp','lowestTemp','highestTemp','temp_low','temp_high'
  ];

  // Try direct F first
  let gotMinF, gotMaxF;
  gotMinF = firstNumber(row.minTempF, row.tempMinF, row.tMinF, row.temperatureMinF, row.tempFMin);
  gotMaxF = firstNumber(row.maxTempF, row.tempMaxF, row.tMaxF, row.temperatureMaxF, row.tempFMax);
  if (gotMinF!=null && gotMaxF!=null) {
    if (gotMinF > gotMaxF) [gotMinF, gotMaxF] = [gotMaxF, gotMinF];
    return { min: gotMinF, max: gotMaxF };
  }

  // Try C pairs
  let minC = firstNumber(row.minTempC, row.tempMinC, row.tMinC, row.temperatureMinC, row.tempCMin);
  let maxC = firstNumber(row.maxTempC, row.tempMaxC, row.tMaxC, row.temperatureMaxC, row.tempCMax);
  if (minC!=null && maxC!=null){
    if (minC > maxC) [minC, maxC] = [maxC, minC];
    return { min: cToF(minC), max: cToF(maxC) };
  }

  // Try strings / generic fields
  for (const key of fields){
    if (!(key in row)) continue;
    const r = parseTempToF(row[key]);
    if (r){
      // If we "assumedF" but field name suggests C, convert
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

/** Read pH range from many possible fields */
function readPhRange(row){
  if (!row || typeof row !== 'object') return null;

  // Common keys
  const min = firstNumber(row.minPH, row.phMin, row.minPh, row.pHMin, row.min_pH, row.ph_low, row.pHL, row.pH_low);
  const max = firstNumber(row.maxPH, row.phMax, row.maxPh, row.pHMax, row.max_pH, row.ph_high, row.pHH, row.pH_high);
  if (min!=null && max!=null){
    const a = Math.min(min, max), b = Math.max(min, max);
    return { min:a, max:b };
  }

  // Strings
  const fields = ['ph','pH','phRange','pHRange','water','chemistry','notes'];
  for (const key of fields){
    if (!(key in row)) continue;
    const r = parsePh(row[key]);
    if (r) return r;
  }
  return null;
}

/** Compute overlap (intersection) across many ranges */
function overlap(ranges){
  const valid = ranges.filter(r=>r && r.min!=null && r.max!=null);
  if (!valid.length) return null;
  let lo = -Infinity, hi = Infinity;
  for (const r of valid){
    lo = Math.max(lo, r.min);
    hi = Math.min(hi, r.max);
  }
  return { min: lo, max: hi, count: valid.length };
}

/* ========== Main renderer ========== */
export function renderWarnings(){
  const box = document.getElementById('aggression-warnings') || document.getElementById('warnings');
  if (!box) return;

  box.innerHTML = '';

  const stock = readStock(); // [{name, qty}]
  const names = stock.map(s=>s.name);

  // A) Aggression (existing logic)
  let res = { warnings: [], score: 0 };
  if (window.Aggression && typeof window.Aggression.compute === 'function') {
    try {
      res = window.Aggression.compute(stock, {
        planted: !!document.getElementById('planted')?.checked,
        gallons: parseFloat(document.getElementById('gallons')?.value || '0') || 0
      }) || res;
    } catch(e){}
  }

  // B) Environment overlap (Temperature & pH)
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

  // Temp °F overlap
  if (tempRanges.length >= 2){
    const ov = overlap(tempRanges);
    if (!ov || ov.max < ov.min){
      msgs.push('⚠️ Temperature ranges do not overlap across selected species. Consider species with closer temperature needs.');
    } else {
      const span = ov.max - ov.min;
      if (span <= 2){
        msgs.push(`ℹ️ Temperature overlap is very tight: ${ov.min.toFixed(1)}–${ov.max.toFixed(1)} °F.`);
      } else if (span <= 4){
        msgs.push(`ℹ️ Temperature overlap is somewhat narrow: ${ov.min.toFixed(1)}–${ov.max.toFixed(1)} °F.`);
      }
    }
  }

  // pH overlap
  if (phRanges.length >= 2){
    const ov = overlap(phRanges);
    if (!ov || ov.max < ov.min){
      msgs.push('⚠️ pH ranges do not overlap across selected species. Consider species with closer pH requirements.');
    } else {
      const span = ov.max - ov.min;
      if (span <= 0.2){
        msgs.push(`ℹ️ pH overlap is very tight: ${ov.min.toFixed(1)}–${ov.max.toFixed(1)}.`);
      } else if (span <= 0.4){
        msgs.push(`ℹ️ pH overlap is somewhat narrow: ${ov.min.toFixed(1)}–${ov.max.toFixed(1)}.`);
      }
    }
  }

  // Combine aggression + environment warnings
  const allWarnings = [...toArray(res.warnings), ...msgs];
  allWarnings.forEach(w=>{
    const d = document.createElement('div');
    d.textContent = w;
    box.appendChild(d);
  });

  // Aggression bar
  const bar = document.getElementById('aggBarFill');
  if (bar && typeof res.score === 'number') {
    const prev = parseFloat(bar.style.width || '0');
    const next = Math.min(100, Math.max(0, res.score));
    bar.style.width = next + '%';
    if (Math.abs(next - prev) > 0.5) {
      bar.classList.remove('pulse'); void bar.offsetWidth; bar.classList.add('pulse');
      setTimeout(()=> bar.classList.remove('pulse'), 500);
    }
  }
}

/** Refresh everything UI-wise */
export function renderAll(){
  renderWarnings();
  renderBioload();
}