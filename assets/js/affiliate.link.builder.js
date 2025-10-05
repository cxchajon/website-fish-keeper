window.AffiliateLinkBuilder = (function(){
  const TAG = "fishkeepingli-20";
  const CANON_RX = /^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}\?tag=fishkeepingli-20(\b|&|$)/;
  function cleanASIN(s){ return (s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,10); }
  function isValidASIN(s){ return /^[A-Z0-9]{10}$/.test(s||""); }
  function buildFromASIN(s){
    const a = cleanASIN(s);
    return isValidASIN(a) ? `https://www.amazon.com/dp/${a}?tag=${TAG}` : "";
  }
  function isCanonical(u){ return CANON_RX.test(u||""); }
  return { cleanASIN, isValidASIN, buildFromASIN, isCanonical };
})();
