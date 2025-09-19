/* Aggression & Compatibility Engine — v9.1
   FishkeepingLifeCo (Sep 18, 2025)

   Public API:
     window.Aggression.compute(stock, opts?)
       - stock: [{ name: "Neon tetra", qty: 6 }, ...]
       - opts (optional): { planted: boolean, gallons: number }
       -> { score: 0–100, warnings: string[] }
*/

(function () {
  const Aggression = {};

  /* ----------------------- Utilities ----------------------- */
  const norm = (s) => (s || "").toString().trim().toLowerCase();
  const toArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const uniqPush = (arr, msg) => { if (msg && !arr.includes(msg)) arr.push(msg); };

  // Normalize a display name for matching (handles underscores/dashes/extra spaces)
  function canonName(s) {
    return norm(s)
      .replace(/[_-]+/g, " ")        // tiger_barb -> tiger barb
      .replace(/\s+/g, " ")          // collapse spaces
      .replace(/\s*\([^)]*\)\s*/g, " ") // remove simple parenthetical qualifiers
      .trim();
  }
  function nameMatch(name, re) {
    return re.test(canonName(name));
  }

  // Species data -> {name,min}
  function readSpeciesMinList() {
    const src = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
    if (!src) return [];
    if (Array.isArray(src)) {
      return src.map(o => {
        const name = (o && (o.name || o.species || o.common)) || "";
        const min  = parseInt((o && (o.min || o.recommendedMinimum || o.minGroup || o.group)) || "0", 10) || 0;
        return name ? { name, min } : null;
      }).filter(Boolean);
    }
    if (src && typeof src === "object") {
      return Object.keys(src).map(key => {
        const v = src[key] || {};
        const min = parseInt(v.min || v.recommendedMinimum || v.minGroup || v.group || "0", 10) || 0;
        return { name: key, min };
      });
    }
    return [];
  }
  function buildMinLookup() {
    const map = new Map();
    readSpeciesMinList().forEach(({ name, min }) => map.set(canonName(name), min || 0));
    return map;
  }

  /* ------------------- Pattern sets (all regex run on canonName) ------------------- */
  const NIPPY = [
    { key: "tiger barb",   re: /(^| )tiger barb( |$)/i,  min: 6,
      msg: "Tiger barb: extremely nippy — best kept as a species-only group (6+). Avoid slow/long-finned tankmates." },
    { key: "serpae tetra", re: /(^| )serpae tetra( |$)/i, min: 8,
      msg: "Serpae tetra: notoriously nippy — best as a species-only group (8+). Avoid slow/long-finned tankmates." },
  ];
  const LONG_FIN_RE   = /(betta|angelfish|guppy|veil|long fin|sailfin)/i;
  const BETTA_M_RE    = /(betta .*male|betta \(male\)|betta .*halfmoon|betta .*crowntail|betta .*plakat|betta .*veil)/i;
  const BETTA_ANY_RE  = /(^| )betta( |$)/i;
  const SHRIMP_RE     = /(shrimp|neocaridina|caridina)/i;
  const CICHLID_RE    = /(cichlid|mbuna|oscar|jack dempsey|convict|auratus|midas|flowerhorn|peacock cichlid|ram|rams)/i;
  const SCHOOLING_RE  = /(tetra|barb|danio|rasbora|white cloud|corydoras|cory|kuhli|otocinclus|harlequin|rainbowfish)/i;
  const BOTTOM_RE     = /(corydoras|cory|loach|kuhli|pleco|catfish|otocinclus|shrimp)/i;
  const MID_RE        = /(tetra|barb|danio|rasbora|gourami|molly|platy|swordtail|rainbowfish)/i;

  /* ----------------------- Core Compute ----------------------- */
  Aggression.compute = function compute(stock, opts) {
    const options = opts || {};
    const planted = !!options.planted;
    const gallons = Number(options.gallons) || 0;

    const warnings = [];
    let score = 0;

    const items = toArray(stock).map(s => {
      const name = (s && s.name) || "";
      return {
        name,
        qty: Math.max(0, parseInt((s && s.qty) || "0", 10) || 0),
        key: canonName(name)
      };
    }).filter(s => s.name && s.qty > 0);

    if (!items.length) return { score: 0, warnings };

    const minLookup   = buildMinLookup();
    const uniqueCount = new Set(items.map(i => i.key)).size;

    let hasNippy = false;
    let hasBottom = false;

    items.forEach(i => { if (nameMatch(i.name, BOTTOM_RE)) hasBottom = true; });

    // 1) Nippy species rules
    NIPPY.forEach(({ re, msg, min }) => {
      const present = items.some(i => nameMatch(i.name, re));
      if (!present) return;
      hasNippy = true;

      if (uniqueCount > 1) {
        uniqPush(warnings, msg);
        score = Math.max(score, 75);
      }
      const nz = items.find(i => nameMatch(i.name, re));
      if (nz && nz.qty < min) {
        uniqPush(warnings, `Group size: ${nz.name} below recommended group size (${nz.qty}/${min}).`);
        score = Math.max(score, 55);
      }
    });

    // 2) Betta
    const bettaMale = items.some(i => nameMatch(i.name, BETTA_M_RE));
    const bettaAny  = bettaMale || items.some(i => nameMatch(i.name, BETTA_ANY_RE));
    if (bettaMale && uniqueCount > 1) {
      uniqPush(warnings, "Betta (male): typically solitary — keep alone or with very cautious tankmates; avoid fin-nippers and long-finned/bright fish.");
      score = Math.max(score, 65);
    }

    // 3) Fin-nipping combos (nippers + long-fin)
    const hasLongFin = items.some(i => nameMatch(i.name, LONG_FIN_RE));
    const hasNipperSpecies = hasNippy || items.some(i => /barb|serpae|tiger/.test(canonName(i.name)));
    if (hasLongFin && hasNipperSpecies && uniqueCount > 1) {
      uniqPush(warnings, "Fin-nipping risk: long-finned species with known nippers (barbs/serpae/tiger) often leads to torn fins.");
      score += 18;
    }

    // 4) Shrimp mixing
    const hasShrimp = items.some(i => nameMatch(i.name, SHRIMP_RE));
    const shrimpPredators = bettaAny || items.some(i => /(barb|gourami|cichlid|angelfish)/i.test(canonName(i.name)));
    if (hasShrimp && shrimpPredators) {
      uniqPush(warnings, "Shrimp may be hunted or harassed by Bettas, Barbs, Gouramis, Cichlids, or Angelfish. Provide dense cover or avoid mixing.");
      score += 22;
    }

    // 5) Cichlid caution
    const hasCichlid = items.some(i => nameMatch(i.name, CICHLID_RE));
    if (hasCichlid && uniqueCount > 1) {
      uniqPush(warnings, "Cichlid mix: many cichlids are territorial or aggressive — research species compatibility carefully; avoid small/delicate community fish.");
      score = Math.max(score, 60);
    }

    // 6) Schooling/ shoaling minimums (data first, heuristic fallback)
    items.forEach(i => {
      let rec = minLookup.get(i.key) || 0;
      if (!rec && nameMatch(i.name, SCHOOLING_RE)) {
        rec = /cory|corydoras|kuhli|otocinclus/.test(i.key) ? 6 : 6;
      }
      if (rec && i.qty < rec) {
        uniqPush(warnings, `${i.name}: schooling species below recommended group size (${i.qty}/${rec}).`);
        score += 10;
      }
    });

    // 7) Swim-level + cover note
    if (hasNippy && hasBottom) {
      uniqPush(warnings, "Note: consider swimming levels. Mixing active mid-water nippers (e.g., Tiger barbs / Serpae tetras) with bottom dwellers (e.g., Corydoras) can work in larger tanks — provide lots of cover and broken sight-lines.");
    }

    // 8) Variety factor
    score += Math.max(0, (uniqueCount - 4) * 2);

    // 9) Planted / volume reductions
    if (planted) score -= 8;
    if (gallons >= 40) score -= 6;
    if (gallons >= 75) score -= 10;

    // Final clamp + floors
    score = Math.round(clamp01(score / 100) * 100);
    if ((bettaMale && uniqueCount > 1) || (hasNippy && uniqueCount > 1)) score = Math.max(score, 65);
    if (hasShrimp && shrimpPredators) score = Math.max(score, 55);

    return { score, warnings };
  };

  window.Aggression = Aggression;
})();