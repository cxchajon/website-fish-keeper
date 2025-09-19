// js/modules/audit.js
// Scan species data for temp & pH coverage.
// - Always logs summary to console
// - Renders a debug card ONLY if URL has ?debug=1

const DEBUG = /(?:\?|&)debug=1(?:&|$)/.test(String(location.search || ''));

// ---- Helpers ----
function canon(s){
  return String(s||'')
    .toLowerCase()
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .replace(/\s*\([^)]*\)\s*/g,' ')
    .trim();
}
function firstNumber(...vals){
  for(const v of vals){
    if (v == null) continue;
    const m = String(v).match(/-?\d+(\.\d+)?/);
    if(!m) continue;
    const n = Number(m[0]);
    if(!Number.isNaN(n)) return n;
  }
  return undefined;
}
function cToF(c){ return (c*9/5)+32; }
function parseTempToF(any){
  if (any == null) return null;
  const s = String(any);
  const hasC = /(?:°?\s*C|celsius)/i.test(s);
  const hasF = /(?:°?\s*F|fahrenheit)/i.test(s);
  const nums = s.match(/-?\d+(?:\.\d+)?/g);
  if(!nums || nums.length === 0) return null;
  let min = Number(nums[0]);
  let max = (nums.length>1) ? Number(nums[1]) : min;
  if (min > max) [min,max] = [max,min];
  if (hasC && !hasF){ min=cToF(min); max=cToF(max); }
  return {min, max};
}
function hasTempRange(row){
  if (!row || typeof row !== 'object') return false;

  // Explicit F
  let minF = firstNumber(row.minTempF, row.tempMinF, row.temperatureMinF, row.tMinF, row.tempFMin);
  let maxF = firstNumber(row.maxTempF, row.tempMaxF, row.temperatureMaxF, row.tMaxF, row.tempFMax);
  if (minF!=null && maxF!=null) return true;

  // Explicit C
  let minC = firstNumber(row.minTempC, row.tempMinC, row.temperatureMinC, row.tMinC, row.tempCMin);
  let maxC = firstNumber(row.maxTempC, row.tempMaxC, row.temperatureMaxC, row.tMaxC, row.tempCMax);
  if (minC!=null && maxC!=null) return true;

  // Text fields we often see
  const fields = [
    'temp','temperature','tempRange','temperatureRange','rangeTemp',
    'minTemp','maxTemp','lowestTemp','highestTemp','temp_low','temp_high',
    'temperatureF','temperatureC'
  ];
  for (const k of fields){
    if (!(k in row)) continue;
    const r = parseTempToF(row[k]);
    if (r) return true;
  }
  return false;
}
function parsePh(any){
  if (any == null) return null;
  const nums = String(any).match(/-?\d+(?:\.\d+)?/g);
  if(!nums || nums.length === 0) return null;
  let min = Number(nums[0]);
  let max = (nums.length>1) ? Number(nums[1]) : min;
  if (min > max) [min,max] = [max,min];
  return {min,max};
}
function hasPhRange(row){
  if (!row || typeof row !== 'object') return false;

  const min = firstNumber(row.minPH, row.phMin, row.minPh, row.pHMin, row.min_pH, row.ph_low, row.pHL, row.pH_low);
  const max = firstNumber(row.maxPH, row.phMax, row.maxPh, row.pHMax, row.max_pH, row.ph_high, row.pHH, row.pH_high);
  if (min!=null && max!=null) return true;

  const fields = ['ph','pH','phRange','pHRange','water','chemistry','notes'];
  for (const k of fields){
    if (!(k in row)) continue;
    const r = parsePh(row[k]);
    if (r) return true;
  }
  return false;
}

// The handful we added as fallbacks in warnings.js (for awareness)
const FALLBACK_KEYS = new Set([
  'white cloud mountain minnow',
  'tiger barb',
  'neon tetra',
  'ram cichlid',
  'african cichlid',
]);

function extractList(src){
  if (Array.isArray(src)){
    return src.map(o=>{
      const name = (o && (o.name||o.species||o.common)) || '';
      return name ? { key: canon(name), label: name, row: o } : null;
    }).filter(Boolean);
  }
  if (src && typeof src==='object'){
    return Object.keys(src).map(k=>{
      const row = src[k]||{};
      return { key: canon(k), label: k, row };
    });
  }
  return [];
}

export function auditData(){
  const src = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
  const list = extractList(src);

  const okBoth = [];
  const missingTemp = [];
  const missingPh = [];
  const missingBoth = [];
  const usingFallback = [];

  for (const item of list){
    const hasT = hasTempRange(item.row);
    const hasP = hasPhRange(item.row);
    const inFallback = FALLBACK_KEYS.has(item.key);

    if (hasT && hasP){
      okBoth.push(item.label);
    } else if (!hasT && !hasP){
      missingBoth.push(item.label);
      if (inFallback) usingFallback.push(item.label);
    } else if (!hasT){
      missingTemp.push(item.label);
      if (inFallback) usingFallback.push(item.label);
    } else if (!hasP){
      missingPh.push(item.label);
      if (inFallback) usingFallback.push(item.label);
    }
  }

  // Console summary
  console.log('[Data Audit] Species:', list.length);
  console.log(' - OK (both temp & pH):', okBoth.length);
  console.log(' - Missing temp only:', missingTemp.length, missingTemp);
  console.log(' - Missing pH only:',   missingPh.length, missingPh);
  console.log(' - Missing BOTH:',      missingBoth.length, missingBoth);
  if (usingFallback.length){
    console.log(' - Using fallback entries present in warnings.js:', usingFallback.length, usingFallback);
  }

  // Optional debug card in the UI
  if (!DEBUG) return;

  const wrap = document.querySelector('.wrap');
  const card = document.createElement('section');
  card.className = 'card';
  card.innerHTML = `
    <h2>Data Audit (debug)</h2>
    <div style="margin-top:8px">
      <div><strong>Total species:</strong> ${list.length}</div>
      <div><strong>OK (both):</strong> ${okBoth.length}</div>
      <div><strong>Missing temp only:</strong> ${missingTemp.length}</div>
      <div><strong>Missing pH only:</strong> ${missingPh.length}</div>
      <div><strong>Missing BOTH:</strong> ${missingBoth.length}</div>
      ${usingFallback.length ? `<div><strong>Covered by fallback list:</strong> ${usingFallback.length}</div>` : ``}
    </div>
    ${missingTemp.length ? `<div style="margin-top:12px"><strong>Missing temp:</strong><br>${missingTemp.join(', ')}</div>` : ``}
    ${missingPh.length   ? `<div style="margin-top:12px"><strong>Missing pH:</strong><br>${missingPh.join(', ')}</div>`   : ``}
    ${missingBoth.length ? `<div style="margin-top:12px"><strong>Missing BOTH:</strong><br>${missingBoth.join(', ')}</div>` : ``}
    ${usingFallback.length ? `<div style="margin-top:12px"><strong>Using fallback keys:</strong><br>${usingFallback.join(', ')}</div>` : ``}
    <small class="note" style="display:block;margin-top:12px">This card only appears with <code>?debug=1</code> in the URL.</small>
  `;
  // Put it AFTER the Warnings card
  const warningsCard = document.querySelector('section.card:last-of-type');
  if (warningsCard && warningsCard.parentNode){
    warningsCard.parentNode.insertBefore(card, warningsCard.nextSibling);
  } else if (wrap){
    wrap.appendChild(card);
  }
}