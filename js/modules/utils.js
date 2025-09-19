// js/modules/utils.js

// convert unknown input to a safe array
export function toArray(x){ 
  return Array.isArray(x) ? x : x ? [x] : []; 
}

// normalize text (lowercase, trim, etc.)
export function norm(s){ 
  return (s||'').toString().trim().toLowerCase(); 
}

// canonicalize a species name for comparisons
export function canonName(s){
  return norm(s)
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .replace(/\s*\([^)]*\)\s*/g,' ')
    .trim();
}

// Safari-safe quantity parsing (always returns 1–999)
export function safeQty(raw){
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    let n = Math.floor(raw);
    if(n < 1) n = 1;
    if(n > 999) n = 999;
    return n;
  }
  const s = (raw==null ? '' : String(raw)).replace(/[^\d]/g,'').slice(0,3);
  let n2 = parseInt(s,10);
  if(isNaN(n2) || n2 < 1) n2 = 1;
  if(n2 > 999) n2 = 999;
  return n2;
}

// Format species names nicely (for display in Current Stock)
export function formatName(raw){
  if(!raw) return '';
  return raw
    .replace(/[_-]+/g,' ')         // underscores/dashes → space
    .replace(/\s+/g,' ')           // collapse multiple spaces
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase()); // capitalize each word
}