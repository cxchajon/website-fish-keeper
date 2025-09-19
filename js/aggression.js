/* Aggression & Compatibility Engine — v9
   FishkeepingLifeCo (Sep 18, 2025)

   Public API:
     window.Aggression.compute(stock, opts?)
       - stock: [{ name: "Neon tetra", qty: 6 }, ...]
       - opts (optional): { planted: boolean, gallons: number }
       -> { score: number (0–100), warnings: string[] }
*/

(function () {
  // overwrite any previous export to guarantee consistent behavior
  const Aggression = {};

  /* ----------------------- Utilities ----------------------- */
  const norm = (s) => (s || "").toString().trim().toLowerCase();
  const toArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const uniqPush = (arr, msg) => {
    if (msg && !arr.includes(msg)) arr.push(msg);
  };

  // Pull a normalized list of {name, min} from any fish-data global
  function readSpeciesMinList() {
    const src =
      window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
    if (!src) return [];

    if (Array.isArray(src)) {
      return src
        .map((o) => {
          const name = (o && (o.name || o.species || o.common)) || "";
          const min =
            parseInt(
              (o && (o.min || o.recommendedMinimum || o.minGroup || o.group)) ||
                "0",
              10
            ) || 0;
          return name ? { name, min } : null;
        })
        .filter(Boolean);
    }
    if (src && typeof src === "object") {
      return Object.keys(src).map((key) => {
        const v = src[key] || {};
        const min =
          parseInt(
            v.min || v.recommendedMinimum || v.minGroup || v.group || "0",
            10
          ) || 0;
        return { name: key, min };
      });
    }
    return [];
  }

  function buildMinLookup() {
    const map = new Map();
    readSpeciesMinList().forEach(({ name, min }) => {
      map.set(norm(name), min || 0);
    });
    return map;
  }

  /* ------------------- Species pattern sets ------------------- */

  // Nippy/high-severity mid-water species
  const NIPPY = [
    { key: "tiger barb", re: /tiger\s*barb/i, min: 6,
      msg: "Tiger barb: extremely nippy — best kept as a species-only group (6+). Avoid slow/long-finned tankmates." },
    { key: "serpae tetra", re: /serpae\s*tetra/i, min: 8,
      msg: "Serpae tetra: notoriously nippy — best as a species-only group (8+). Avoid slow/long-finned tankmates." },
  ];

  // Long-finned / flowing fins (targets for nippers)
  const LONG_FIN_RE = /(betta|angelfish|guppy|veil|long[-\s]?fin|sailfin)/i;

  // Betta male solitude and shrimp curiosity
  const BETTA_M_RE = /\bbetta\b.*\b(male|plakat|halfmoon|crowntail|veil)\b|\bbetta\s*\(male\)/i;
  const BETTA_ANY_RE = /\bbetta\b/i;

  // Shrimp / inverts
  const SHRIMP_RE = /(shrimp|cherry shrimp|neocaridina|caridina)/i;

  // Generic cichlid bucket (aggression varies, we show cautious warning)
  const CICHLID_RE =
    /(cichlid|mbuna|oscar|jack dempsey|convict|auratus|midas|flowerhorn|peacock cichlid|rams?)/i;

  // Schooling/ shoaling fallback detector
  const SCHOOLING_RE =
    /(tetra|barb|danio|rasbora|white\s*cloud|corydoras|cory|kuhli|ott?ocinclus|otocinclus|harlequin|rainbowfish)/i;

  // Levels (for context note)
  const BOTTOM_RE = /(corydoras|cory|loach|kuhli|pleco|catfish|otocinclus|shrimp)/i;
  const MID_RE =
    /(tetra|barb|danio|rasbora|gourami|molly|platy|swordtail|rainbowfish)/i;

  /* ----------------------- Core Compute ----------------------- */

  Aggression.compute = function compute(stock, opts) {
    const options = opts || {};
    const planted = !!options.planted;
    const gallons = Number(options.gallons) || 0;

    const warnings = [];
    let score = 0; // 0–100 before clamp

    const items = toArray(stock)
      .map((s) => ({
        name: (s && s.name) || "",
        qty: Math.max(0, parseInt((s && s.qty) || "0", 10) || 0),
        key: norm((s && s.name) || ""),
      }))
      .filter((s) => s.name && s.qty > 0);

    if (!items.length) return { score: 0, warnings };

    const minLookup = buildMinLookup();
    const uniqueCount = new Set(items.map((i) => i.key)).size;

    /* ---- 1) High-severity: Tiger barb & Serpae tetra ---- */
    let hasNippy = false;
    let hasBottom = false;
    let hasMidNippers = false;

    items.forEach((i) => {
      if (BOTTOM_RE.test(i.name)) hasBottom = true;
      if (MID_RE.test(i.name)) hasMidNippers = true;
    });

    NIPPY.forEach(({ re, msg, min }) => {
      const present = items.some((i) => re.test(i.name));
      if (!present) return;
      hasNippy = true;

      // Mixed with other species? recommend species-only
      if (uniqueCount > 1) {
        uniqPush(warnings, msg);
        score = Math.max(score, 75);
      }

      // Group size shortfall
      const nz = items.find((i) => re.test(i.name));
      if (nz && nz.qty < min) {
        uniqPush(
          warnings,
          `Group size: ${nz.name} below recommended group size (${nz.qty}/${min}).`
        );
        score = Math.max(score, 55);
      }
    });

    /* ---- 2) Betta rules ---- */
    const bettaMale = items.some((i) => BETTA_M_RE.test(i.name));
    const bettaAny = bettaMale || items.some((i) => BETTA_ANY_RE.test(i.name));
    if (bettaMale && uniqueCount > 1) {
      uniqPush(
        warnings,
        "Betta (male): typically solitary — keep alone or with very cautious tankmates; avoid fin-nippers and bright/long-finned fish."
      );
      score = Math.max(score, 65);
    }

    /* ---- 3) Fin-nipping combos ---- */
    const hasLongFin = items.some((i) => LONG_FIN_RE.test(i.name));
    const hasNipperSpecies = hasNippy || items.some((i) => /(barb|serpae|tiger)/i.test(i.name));
    if (hasLongFin && hasNipperSpecies && uniqueCount > 1) {
      uniqPush(
        warnings,
        "Fin-nipping risk: long-finned species with known nippers (barbs/serpae/tiger) often leads to torn fins."
      );
      score += 18;
    }

    /* ---- 4) Shrimp mixing ---- */
    const hasShrimp = items.some((i) => SHRIMP_RE.test(i.name));
    const shrimpPredators = bettaAny ||
      items.some((i) => /(barb|gourami|cichlid|angelfish)/i.test(i.name));
    if (hasShrimp && shrimpPredators) {
      uniqPush(
        warnings,
        "Shrimp may be hunted or harassed by Bettas, Barbs, Gouramis, Cichlids, or Angelfish. Provide dense cover or avoid mixing."
      );
      score += 22;
    }

    /* ---- 5) Generic cichlid caution in community mixes ---- */
    const hasCichlid = items.some((i) => CICHLID_RE.test(i.name));
    const mixingCommunity = hasCichlid && uniqueCount > 1;
    if (mixingCommunity) {
      uniqPush(
        warnings,
        "Cichlid mix: many cichlids are territorial or aggressive — research species compatibility carefully; avoid small or delicate community fish."
      );
      score = Math.max(score, 60);
    }

    /* ---- 6) Schooling/ shoaling minimum sizes ---- */
    items.forEach((i) => {
      const key = i.key;
      let rec = minLookup.get(key) || 0;

      // fallback heuristic if not provided by data
      if (!rec && SCHOOLING_RE.test(i.name)) {
        rec = /cory|corydoras|kuhli|otocinclus/i.test(i.name) ? 6 : 6;
      }

      if (rec && i.qty < rec) {
        uniqPush(
          warnings,
          `${i.name}: schooling species below recommended group size (${i.qty}/${rec}).`
        );
        score += 10;
      }
    });

    /* ---- 7) Swim-level + cover note ---- */
    if (hasNippy && hasBottom) {
      uniqPush(
        warnings,
        "Note: consider swimming levels. Mixing active mid-water nippers (e.g., Tiger barbs / Serpae tetras) with bottom dwellers (e.g., Corydoras) can work in larger tanks — provide lots of cover and broken sight-lines."
      );
    }

    /* ---- 8) Light baseline variety factor ---- */
    score += Math.max(0, (uniqueCount - 4) * 2);

    /* ---- 9) Planted / volume reductions ---- */
    if (planted) score -= 8;
    if (gallons >= 40) score -= 6;
    if (gallons >= 75) score -= 10;

    /* ---- Final clamp ---- */
    score = Math.round(clamp01(score / 100) * 100);

    // Ensure meaningful floor for serious situations
    if ((bettaMale && uniqueCount > 1) || (hasNippy && uniqueCount > 1)) {
      score = Math.max(score, 65);
    }
    if (shrimpPredators && hasShrimp) {
      score = Math.max(score, 55);
    }

    return { score, warnings };
  };

  window.Aggression = Aggression;
})();