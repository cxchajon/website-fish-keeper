// js/modules/warnings.js
import { toArray } from './utils.js';
import { renderBioload } from './bioload.js';
import { readStock } from './stock.js';

/* -------- helpers to read species data -------- */

function canonNameLocal(s){
  return (s||'').toString().trim().toLowerCase()
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .replace(/\s*\([^)]*\)\s*/g,' ')
    .trim();
}

// pull the species row out of the global dataset
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
    // try exact keys first, then canonical
    const row = src[name] || src[key] || null;
    if (row) return row;
  }
  return null;
}

function firstNumber(...vals){
  for(const v of vals){
    if (v == null) continue;
    const n = Number(String(v).match(/-?\d+(\.\d+)?/)?.[0]);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function cToF(c){
  return (c * 9/5) + 32;
}

function readTempRangeF(row){
  if (!row || typeof row !== 'object') return null;

  // Prefer explicit Fahrenheit if present
  let minF = firstNumber(row.minTempF, row.tempMinF, row.minF, row.tMinF, row.tempFMin);
  let maxF = firstNumber(row.maxTempF, row.tempMaxF, row.maxF, row.tMaxF, row.tempFMax);

  // Fall back to Celsius, convert to F
  let minC = firstNumber(row.minTempC, row.tempMinC, row.minC, row.tMinC, row.tempCMin);
  let maxC = firstNumber(row.maxTempC, row.tempMaxC, row.maxC, row.tMaxC, row.tempCMax);

  if ((minF==null || maxF==null) && (minC!=null || maxC!=null)){
    if (minC!=null) minF = cToF(minC);
    if (maxC!=null) maxF = cToF(maxC);
  }

  if (minF==null || maxF==null) return null;
  if (minF > maxF) [minF, maxF] = [maxF, minF];
  return { min: minF, max: maxF };
}

function readPhRange(row){
  if (!row || typeof row !== 'object') return null;
  let min = firstNumber(row.minPH, row.phMin, row.minPh, row.pHMin, row.min_pH);
  let max = firstNumber(row.maxPH, row.phMax, row.maxPh, row.pHMax, row.max_pH);
  if (min==null || max==null) return null;
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

function overlap(ranges){
  // ranges: [{min, max}, ...] → compute common overlap
  if (!ranges.length) return null;
  let lo = -Infinity, hi = Infinity, count = 0;
  for (const r of ranges){
    if (!r || r.min==null || r.max==null) continue;
    lo = Math.max(lo, r.min);
    hi = Math.min(hi, r.max);
    count++;
  }
  if (count === 0) return null;
  return { min: lo, max: hi, count };
}

/* -------- main warnings render -------- */

export function renderWarnings(){
  const box = document.getElementById('aggression-warnings') || document.getElementById('warnings');
  if (!box) return;

  box.innerHTML = '';

  const stock = readStock(); // [{name, qty}]
  const names = stock.map(s=>s.name);

  // ---- A) Aggression (existing logic via global Aggression) ----
  let res = { warnings: [], score: 0 };
  if (window.Aggression && typeof window.Aggression.compute === 'function') {
    try {
      res = window.Aggression.compute(stock, {
        planted: !!document.getElementById('planted')?.checked,
        gallons: parseFloat(document.getElementById('gallons')?.value || '0') || 0
      }) || res;
    } catch(e){}
  }

  // ---- B) Environment overlap (Temperature & pH) ----
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

  // Temperature overlap in °F
  if (tempRanges.length >= 2){
    const ov = overlap(tempRanges);
    if (!ov || ov.max < ov.min){
      msgs.push('⚠️ Temperature ranges do not overlap across selected species (conflict). Consider choosing species with closer temperature needs.');
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
      msgs.push('⚠️ pH ranges do not overlap across selected species (conflict). Consider species with closer pH requirements.');
    } else {
      const span = ov.max - ov.min;
      if (span <= 0.2){
        msgs.push(`ℹ️ pH overlap is very tight: ${ov.min.toFixed(1)}–${ov.max.toFixed(1)}.`);
      } else if (span <= 0.4){
        msgs.push(`ℹ️ pH overlap is somewhat narrow: ${ov.min.toFixed(1)}–${ov.max.toFixed(1)}.`);
      }
    }
  }

  // merge: aggression messages first (as before), then env messages
  const allWarnings = [...toArray(res.warnings), ...msgs];

  allWarnings.forEach(w=>{
    const d = document.createElement('div');
    d.textContent = w;
    box.appendChild(d);
  });

  // update aggression bar
  const bar = document.getElementById('aggBarFill');
  if (bar && typeof res.score === 'number') {
    const prev = parseFloat(bar.style.width || '0');
    const next = Math.min(100, Math.max(0, res.score));
    bar.style.width = next + '%';

    // tiny pulse when value changes meaningfully
    if (Math.abs(next - prev) > 0.5) {
      bar.classList.remove('pulse');
      void bar.offsetWidth;
      bar.classList.add('pulse');
      setTimeout(()=> bar.classList.remove('pulse'), 500);
    }
  }
}

// One call that refreshes everything UI-wise
export function renderAll(){
  renderWarnings();
  renderBioload();
}