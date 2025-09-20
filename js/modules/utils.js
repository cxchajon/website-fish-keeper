// js/modules/utils.js
export function norm(s){ return (s||'').toString().trim().toLowerCase(); }
export function canonName(s){
  return norm(s).replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\s*\([^)]*\)\s*/g,' ').trim();
}

// Always returns 1..999; works on numbers and strings (Safari-safe)
export function safeQty(raw){
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    let n = Math.floor(raw);
    if (n < 1) n = 1; if (n > 999) n = 999;
    return n;
  }
  const s = (raw==null ? '' : String(raw)).replace(/[^\d]/g,'').slice(0,3);
  let n = parseInt(s,10);
  if (!Number.isFinite(n) || n < 1) n = 1; if (n > 999) n = 999;
  return n;
}