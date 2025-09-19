/* aggression.js — v8
   Source of truth for extra aggression guidance.
   - High-severity mix warnings for Tiger barbs & Serpae tetras
   - Swimming-level note when nippy mid-water fish are mixed with bottom dwellers
   - Non-breaking: wraps existing Aggression.compute if present, or defines a safe default
*/
(function () {
  const RE = {
    top: /(hatchet|killifish|guppy|halfbeak|surface)/i,
    mid: /(tetra|barb|danio|rasbora|gourami|molly|platy|swordtail|rainbowfish)/i,
    bottom: /(corydoras|cory|loach|kuhli|pleco|catfish|otocinclus|shrimp)/i
  };
  function detectLevel(name){
    if (RE.bottom.test(name)) return "bottom";
    if (RE.top.test(name))    return "top";
    if (RE.mid.test(name))    return "mid";
    return null;
  }

  const NIPPY = [
    { key:"tiger barb",  re:/tiger\s*barb/i,
      msg:"Tiger barb: extremely nippy — best kept as a species-only group (keep 6+). Avoid slow/long-finned tankmates." },
    { key:"serpae tetra",re:/serpae\s*tetra/i,
      msg:"Serpae tetra: notoriously nippy — best as a species-only group (8+ recommended). Avoid slow/long-finned tankmates." }
  ];

  function normalizeStock(stock){
    if(!Array.isArray(stock)) return [];
    return stock.map(s=>{
      const name = (s?.name ?? s?.species ?? "").toString().trim();
      const qty  = parseInt(s?.qty ?? s?.quantity ?? 0, 10) || 0;
      return name ? { name, qty } : null;
    }).filter(Boolean);
  }

  function applyAddOns(result, stock){
    result = result || {};
    result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
    if (typeof result.score !== "number") result.score = 0;

    const speciesSet = new Set(stock.map(s => s.name.toLowerCase()));
    const isMixed = speciesSet.size > 1;

    // High-severity when mixed with others
    NIPPY.forEach(({re,msg})=>{
      const present = stock.some(s => re.test(s.name));
      if (present && isMixed){
        result.warnings.unshift(msg);
        result.score = Math.min(100, result.score + 10); // mild bump
      }
    });

    // Swimming levels note: nippy mid-water + bottom dwellers
    const hasNippy = NIPPY.some(n => stock.some(s => n.re.test(s.name)));
    const hasBottom = stock.some(s => detectLevel(s.name) === "bottom");
    if (hasNippy && hasBottom){
      result.warnings.push(
        "Note: consider swimming levels. Mixing active mid-water nippers (Tiger barbs / Serpae tetras) with bottom dwellers (e.g., Panda Corydoras) can work in larger tanks. Provide lots of cover (plants, wood, rock) and broken sight-lines."
      );
    }

    return result;
  }

  const hasAggression = typeof window !== "undefined"
    && window.Aggression && typeof window.Aggression.compute === "function";

  if (hasAggression){
    const base = window.Aggression.compute;
    window.Aggression.compute = function(stock, ctx){
      const norm = normalizeStock(stock);
      const res = base.call(this, stock, ctx) || {};
      return applyAddOns(res, norm);
    };
  } else {
    window.Aggression = window.Aggression || {};
    window.Aggression.compute = function(stock){
      const norm = normalizeStock(stock);
      return applyAddOns({ score: 0, warnings: [] }, norm);
    };
  }

  // Optional helpers
  window.AggressionUtils = Object.assign({}, window.AggressionUtils, {
    detectLevel,
    nippySpecies: NIPPY.map(n => n.key)
  });
})();