/* Aggression & Compatibility Engine — v8
   FishkeepingLifeCo (Sep 18, 2025)

   Public API:
     window.Aggression.compute(stock, opts?)
       - stock: [{ name: "Neon tetra", qty: 6 }, ...]
       - opts (optional):
           { planted: boolean, gallons: number }
       -> { score: number (0–100), warnings: string[] }

   Notes:
   • Reads optional global species data to get recommended minimums:
       FISH_DATA | fishData | fish_list | SPECIES
     Accepts either an array or a map. If none found, uses heuristics.
*/

(function () {
  if (window.Aggression && typeof window.Aggression.compute === "function") {
    // Replace existing to ensure consistent behavior
    // (If you prefer to keep old behavior, comment out this early return.)
    // return;
  }

  const Aggression = {};

  /* ----------------------- Utilities ----------------------- */
  const norm = (s) => (s || "").toString().trim().toLowerCase();

  function toArray(x) {
    return Array.isArray(x) ? x : x ? [x] : [];
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  // Pull a normalized list of {name, min} from any fish-data global
  function readSpeciesMinList() {
    const src =
      window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;

    if (!src) return [];

    // Array form
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

    // Map form { "Neon tetra": {min: 6}, ... }
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

  // Build a quick lookup for recommended minimums
  function buildMinLookup() {
    const minList = readSpeciesMinList();
    const map = new Map();
    minList.forEach(({ name, min }) => {
      if (name) map.set(norm(name), min || 0);
    });
    return map;
  }

  /* ----------------------- Heuristics ----------------------- */

  // Schooling/ shoaling patterns (fallback if no data found)
  const SCHOOLING_RE =
    /(tetra|barb|danio|rasbora|white\s*cloud|corydoras|cory|kuhli|ott?ocinclus|otocinclus|harlequin)/i;

  // Bottom dwellers (for swim-level note)
  const BOTTOM_RE =
    /(corydoras|cory|loach|kuhli|pleco|catfish|otocinclus|shrimp)/i;

  // Nippy/high-severity species
  const NIPPY = [
    {
      key: "tiger barb",
      re: /tiger\s*barb/i,
      min: 6,
      msg:
        "Tiger barb: extremely nippy — best kept as a species-only group (6+). Avoid slow or long-finned tankmates.",
    },
    {
      key: "serpae tetra",
      re: /serpae\s*tetra/i,
      min: 8,
      msg:
        "Serpae tetra: notoriously nippy — best as a species-only group (8+). Avoid slow or long-finned tankmates.",
    },
  ];

  // Lightweight swim-level labels (used only for context rules)
  const LEVEL = {
    TOP: /(hatchet|killifish|guppy|halfbeak|surface)/i,
    MID: /(tetra|barb|danio|rasbora|gourami|molly|platy|swordtail|rainbowfish)/i,
    BOTTOM: BOTTOM_RE,
  };
  function detectLevel(name) {
    if (LEVEL.BOTTOM.test(name)) return "bottom";
    if (LEVEL.TOP.test(name)) return "top";
    if (LEVEL.MID.test(name)) return "mid";
    return null;
  }

  /* ----------------------- Core Compute ----------------------- */

  Aggression.compute = function compute(stock, opts) {
    const options = opts || {};
    const planted = !!options.planted;
    const gallons = Number(options.gallons) || 0;

    const warnings = [];
    let score = 0; // 0–100

    const items = toArray(stock)
      .map((s) => ({
        name: (s && s.name) || "",
        qty: Math.max(0, parseInt((s && s.qty) || "0", 10) || 0),
        key: norm((s && s.name) || ""),
      }))
      .filter((s) => s.name && s.qty > 0);

    if (!items.length) return { score: 0, warnings };

    const uniqueCount = new Set(items.map((x) => x.key)).size;

    // Build min lookup from data; fallback to heuristics
    const minLookup = buildMinLookup();

    // 1) Nippy species: high-severity if mixed with other species
    let hasNippy = false;
    NIPPY.forEach(({ re, msg, min }) => {
      const present = items.some((i) => re.test(i.name));
      if (!present) return;

      hasNippy = true;

      // Species-only recommendation if mixed tank
      if (uniqueCount > 1) {
        warnings.push(msg);
        score = Math.max(score, 0.75 * 100); // bump to 75 immediately
      }

      // Group size reinforcement
      const nz = items.find((i) => re.test(i.name));
      if (nz && nz.qty < min) {
        warnings.push(
          `Group size: ${nz.name} below recommended group size (${nz.qty}/${min}).`
        );
        score = Math.max(score, 0.55 * 100);
      }
    });

    // 2) Schooling group-size checks (light to medium severity)
    items.forEach((i) => {
      const key = i.key;
      let rec = minLookup.get(key) || 0;

      if (!rec && SCHOOLING_RE.test(i.name)) {
        // fallback heuristic if not in data
        rec = /cory|corydoras|kuhli|otocinclus/i.test(i.name) ? 6 : 6;
      }

      if (rec && i.qty < rec) {
        warnings.push(
          `${i.name}: schooling species below recommended group size (${i.qty}/${rec}).`
        );
        score += 10; // additive, but overall capped later
      }
    });

    // 3) Swim-level context note (only if nippy present + bottom dwellers)
    const hasBottom = items.some((i) => BOTTOM_RE.test(i.name));
    if (hasNippy && hasBottom) {
      warnings.push(
        "Note: consider swimming levels. Mixing active mid-water nippers (e.g., Tiger barbs / Serpae tetras) with bottom dwellers (e.g., Panda Corydoras) can work in larger tanks — provide lots of cover (plants, wood, rock) and broken sight-lines."
      );
    }

    // 4) Very rough baseline: more species variety can slightly raise risk
    // (This is gentle; real conflicts should come from rules above.)
    score += Math.max(0, (uniqueCount - 4) * 2); // +2 per species beyond 4

    // 5) Adjustments for planted tanks / large volume (minor reductions)
    if (planted) score -= 5;
    if (gallons >= 40) score -= 5;

    // Clamp and return
    score = Math.round(clamp01(score / 100) * 100); // normalize in case it went over
    // If any high-severity was triggered, ensure a solid minimum
    if (hasNippy && uniqueCount > 1) score = Math.max(score, 75);

    return { score, warnings };
  };

  window.Aggression = Aggression;
})();