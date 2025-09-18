/* aggression.js — enhanced compatibility logic
   - Preserves existing Aggression.compute(...) if present
   - Appends high-severity warnings for Tiger barbs & Serpae tetras when mixed
   - Adds contextual note about swimming levels & providing cover
   - Remains WARNING-ONLY (no blocks)
*/

(function () {
  // ---- Helpers -------------------------------------------------------------

  // Lightweight swimming-level heuristics
  const RE = {
    top: /(hatchet|killifish|guppy|halfbeak|surface)/i,
    mid: /(tetra|barb|danio|rasbora|gourami|molly|platy|swordtail|rainbowfish)/i,
    bottom: /(corydoras|cory|loach|kuhli|pleco|catfish|otocinclus|shrimp)/i
  };

  function detectLevel(name) {
    if (RE.bottom.test(name)) return "bottom";
    if (RE.top.test(name)) return "top";
    if (RE.mid.test(name)) return "mid";
    return null;
  }

  // Nippy species (high-severity)
  const NIPPY_SPECIES = [
    {
      key: "tiger barb",
      re: /tiger\s*barb/i,
      msg:
        "Tiger barb: extremely nippy — best kept as a species-only group (keep 6+). Avoid slow/long-finned tankmates."
    },
    {
      key: "serpae tetra",
      re: /serpae\s*tetra/i,
      msg:
        "Serpae tetra: notoriously nippy — best as a species-only group (8+ recommended). Avoid slow/long-finned tankmates."
    }
  ];

  // Normalize stock -> [{name, qty}]
  function normalizeStock(stock) {
    if (!Array.isArray(stock)) return [];
    return stock
      .map((s) => {
        if (!s) return null;
        const name = (s.name || s.species || "").toString().trim();
        const qty = parseInt(s.qty ?? s.quantity ?? 0, 10) || 0;
        return name ? { name, qty } : null;
      })
      .filter(Boolean);
  }

  // Append our warnings into result.warnings (string[])
  function applyAddOns(result, stock /* normalized */) {
    result.warnings = Array.isArray(result.warnings) ? result.warnings : [];

    const names = stock.map((s) => s.name.toLowerCase());
    const distinctCount = new Set(names).size;

    // 1) High-severity banners for nippy species kept with others
    NIPPY_SPECIES.forEach(({ re, msg }) => {
      const present = stock.some((s) => re.test(s.name));
      const mixed = present && distinctCount > 1;
      if (mixed) {
        result.warnings.unshift(msg); // put near the top
        // Nudge the score upward a touch so the bar reflects higher risk (optional)
        if (typeof result.score === "number") result.score = Math.min(100, result.score + 10);
      }
    });

    // 2) Context note: swimming levels + cover
    const hasNippy = NIPPY_SPECIES.some((x) => stock.some((s) => x.re.test(s.name)));
    const hasBottom = stock.some((s) => /bottom/.test(detectLevel(s.name) || ""));
    if (hasNippy && hasBottom) {
      result.warnings.push(
        "Note: consider swimming levels. Mixing active mid-water nippers (Tiger barbs / Serpae tetras) with bottom dwellers (e.g., Panda Corydoras) can work in larger tanks. Provide lots of cover (plants, wood, rock) and broken sight-lines."
      );
    }

    return result;
  }

  // ---- Public API: Aggression.compute -------------------------------------
  // We either wrap an existing compute() or define a minimal one.
  const hasAggression =
    typeof window !== "undefined" &&
    window.Aggression &&
    typeof window.Aggression.compute === "function";

  if (hasAggression) {
    // Wrap existing logic
    const base = window.Aggression.compute;
    window.Aggression.compute = function (stock, ctx) {
      const norm = normalizeStock(stock);
      const res = base.call(this, stock, ctx) || {};
      return applyAddOns(res, norm);
    };
  } else {
    // Define a minimal safe default so nothing breaks
    window.Aggression = window.Aggression || {};
    window.Aggression.compute = function (stock /* [{name, qty}] */, ctx) {
      const norm = normalizeStock(stock);
      const result = {
        // score (0–100) can be consumed by your UI bar; start neutral
        score: 0,
        warnings: []
      };
      return applyAddOns(result, norm);
    };
  }

  // Optionally expose small helpers (could be handy elsewhere)
  window.AggressionUtils = Object.assign({}, window.AggressionUtils, {
    detectLevel,
    nippySpeciesList: NIPPY_SPECIES.map((n) => n.key)
  });
})();