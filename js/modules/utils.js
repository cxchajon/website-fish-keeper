// js/modules/utils.js
// Classic script (not a module). Exposes helpers on window so other files can use them.
(function (root) {
  // convert unknown input to a safe array
  function toArray(x){ 
    return Array.isArray(x) ? x : x ? [x] : []; 
  }

  // normalize text (lowercase, trim, etc.)
  function norm(s){ 
    return (s||'').toString().trim().toLowerCase(); 
  }

  // canonicalize a species name for comparisons
  function canonName(s){
    return norm(s)
      .replace(/[_-]+/g,' ')
      .replace(/\s+/g,' ')
      .replace(/\s*\([^)]*\)\s*/g,' ')
      .trim();
  }

  // Safari-safe quantity parsing (always returns 1–999)
  function safeQty(raw){
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

  // Format species names nicely for display
  function formatName(raw){
    if(!raw) return '';
    return raw
      .replace(/[_-]+/g,' ')          // underscores/dashes → space
      .replace(/\s+/g,' ')            // collapse multiple spaces
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase()); // capitalize each word
  }

  // expose
  root.Utils = { toArray, norm, canonName, safeQty, formatName };
  // also expose as globals for older code
  root.toArray = toArray;
  root.norm = norm;
  root.canonName = canonName;
  root.safeQty = safeQty;
  root.formatName = formatName;
})(window);