/* js/aggression.js
   Aggression logic for the Stocking Advisor.
*/
(function (global) {
  const baseMap = {
    betta_male: 70, tiger_barb: 55, angelfish: 50, dwarf_gourami: 35,
    honey_gourami: 25, pearl_gourami: 30, guppy: 15, cherry_barb: 20,
    black_skirt_tetra: 25, zebra_danio: 25, cardinal_tetra: 20, neon_tetra: 15,
    ember_tetra: 10, rummynose_tetra: 20, harlequin_rasbora: 15, chili_rasbora: 10,
    white_cloud: 10, cory_small: 10, cory_panda: 10, kuhli_loach: 10, otocinclus: 5,
    bristlenose_pleco: 15, praecox_rainbow: 25, apistogramma: 40, ram_cichlid: 40,
    amano_shrimp: 0, cherry_shrimp: 0, nerite_snail: 0, mystery_snail: 0
  };

  /** Option 2: Math.max(base, Math.min(100, conflict + 10)) */
  function option2(base, conflict) {
    const boosted = Math.min(100, (conflict || 0) + 10);
    return Math.max(base || 0, boosted);
  }

  /** Overlap helper: returns [lo,hi] if overlap exists; true if not enough info; null if no overlap. */
  function overlap(ranges) {
    if (!Array.isArray(ranges)) return null;
    const valid = ranges.filter(r =>
      Array.isArray(r) && r.length === 2 && Number.isFinite(r[0]) && Number.isFinite(r[1])
    );
    if (valid.length < 2) return true;
    const lo = Math.max(...valid.map(r => Math.min(r[0], r[1])));
    const hi = Math.min(...valid.map(r => Math.max(r[0], r[1])));
    return (lo <= hi) ? [lo, hi] : null;
  }

  function fishById(fishList, id) {
    return Array.isArray(fishList) ? fishList.find(f => f.id === id) : undefined;
  }

  /** Per-entry conflict score (0–100). Set options.ignoreSchooling=true to omit the under-schooling bump. */
  function conflictForEntry(entry, stock, fishList, gallons, options = {}) {
    const NIPPER_IDS   = new Set(['tiger_barb','black_skirt_tetra','zebra_danio','guppy']);
    const LONG_FIN_IDS = new Set(['betta_male','guppy','angelfish','pearl_gourami']);
    const GOURAMI_IDS  = new Set(['dwarf_gourami','honey_gourami','pearl_gourami']);

    let conflict = 0;
    const qty = Math.max(1, Math.floor(entry?.qty || 0));
    const id  = entry?.id;
    if (!id || !Array.isArray(stock)) return 0;

    const count = (findId) => (stock.find(s => s.id === findId)?.qty) || 0;
    const hasAny = (set) => stock.some(s => set.has(s.id) && s.qty > 0);
    const g = Number(gallons || 0);

    const recMin = fishById(fishList, id)?.min ?? 1;
    const isSchooling = recMin >= 6;
    const isLongFin   = LONG_FIN_IDS.has(id);

    // Key conflict rules
    if (id === 'betta_male' && qty > 1) conflict = Math.max(conflict, 90);
    if (id === 'betta_male' && count('tiger_barb') > 0) conflict = Math.max(conflict, 75);
    if (isLongFin && hasAny(NIPPER_IDS)) conflict = Math.max(conflict, 70);

    if ((id === 'apistogramma' || id === 'ram_cichlid') && g < 20)
      conflict = Math.max(conflict, 55);

    if ((id === 'betta_male' && hasAny(GOURAMI_IDS)) ||
        (GOURAMI_IDS.has(id) && count('betta_male') > 0))
      conflict = Math.max(conflict, 60);

    const aggressiveHere = stock.some(s =>
      ['betta_male','apistogramma','ram_cichlid','dwarf_gourami','honey_gourami','pearl_gourami'].includes(s.id) && s.qty > 0
    );
    if ((id === 'amano_shrimp' || id === 'cherry_shrimp') && aggressiveHere)
      conflict = Math.max(conflict, 60);

    if (id === 'angelfish' && g > 0 && g < 29)
      conflict = Math.max(conflict, 55);

    // Under-schooling penalty — optionally ignored for overall meter
    if (!options.ignoreSchooling && isSchooling && qty < recMin)
      conflict = Math.max(conflict, 40);

    return conflict;
  }

  /** Per-species aggression (Option 2), 0–100 (includes schooling penalty) */
  function speciesAggression(entry, stock, fishList, gallons) {
    const id = entry?.id;
    const base = baseMap[id] ?? 0;
    const conf = conflictForEntry(entry, stock, fishList, gallons, { ignoreSchooling: false });
    return option2(base, conf);
  }

  /** OVERALL METER: quantity-weighted average of *conflicts only* (+10), ignoring the schooling penalty */
  function overallAverageConflict(stock, fishList, gallons) {
    if (!Array.isArray(stock) || stock.length === 0) return 0;
    let total = 0, totalQty = 0;
    stock.forEach(e => {
      const qty = Math.max(1, Math.floor(e.qty || 0));
      const conf = conflictForEntry(e, stock, fishList, gallons, { ignoreSchooling: true });
      const boosted = Math.min(100, (conf || 0) + 10);
      total += boosted * qty;
      totalQty += qty;
    });
    return totalQty ? Math.round(total / totalQty) : 0;
  }

  /** Warnings list (still includes schooling mismatch) */
  function checkIssues(stock, fishList, gallons) {
    const issues = [];
    if (!Array.isArray(stock) || !Array.isArray(fishList)) return issues;

    const BETTA_MALE_ID = 'betta_male';
    const TIGER_BARB_ID = 'tiger_barb';
    const ANGELFISH_ID  = 'angelfish';
    const NIPPER_IDS    = new Set(['tiger_barb','black_skirt_tetra','zebra_danio','guppy']);
    const LONG_FIN_IDS  = new Set(['betta_male','guppy','angelfish','pearl_gourami']);
    const GOURAMI_IDS   = new Set(['dwarf_gourami','honey_gourami','pearl_gourami']);
    const SHRIMP_IDS    = new Set(['amano_shrimp','cherry_shrimp']);
    const AGGRESSIVE_IDS= new Set([BETTA_MALE_ID,'apistogramma','ram_cichlid',...GOURAMI_IDS]);

    let maleBettas=0, tigerBarbs=0, hasNippers=false, hasLongFins=false,
        hasGourami=false, hasShrimp=false, hasAggressive=false,
        hasAngelfish=false, hasApisto=false, hasRam=false;

    const temps=[], phs=[];
    stock.forEach(it => {
      const q = Math.max(1, Math.floor(it.qty || 0));
      if (q < 1) return;
      const f = fishById(fishList, it.id);
      if (!f) return;
      if (Array.isArray(f.temp)) temps.push(f.temp);
      if (Array.isArray(f.ph))   phs.push(f.ph);
      if (it.id === BETTA_MALE_ID) maleBettas += q;
      if (it.id === TIGER_BARB_ID) tigerBarbs += q;
      if (NIPPER_IDS.has(it.id))   hasNippers = true;
      if (LONG_FIN_IDS.has(it.id)) hasLongFins = true;
      if (GOURAMI_IDS.has(it.id))  hasGourami = true;
      if (SHRIMP_IDS.has(it.id))   hasShrimp = true;
      if (AGGRESSIVE_IDS.has(it.id)) hasAggressive = true;
      if (it.id === 'apistogramma') hasApisto = true;
      if (it.id === 'ram_cichlid')  hasRam = true;
      if (it.id === ANGELFISH_ID)   hasAngelfish = true;
    });

    const g = Number(gallons || 0);

    if (maleBettas >= 2)
      issues.push({severity:'danger', message:'Multiple male Bettas selected — extremely high aggression risk. Keep exactly one male Betta per tank.'});

    if (maleBettas >= 1 && tigerBarbs >= 1)
      issues.push({severity:'warning', message:'Betta with Tiger Barbs — barbs are notorious fin-nippers and will harass long-finned fish.'});

    if (hasNippers && hasLongFins)
      issues.push({severity:'warning', message:'Fin-nipping species detected with long-finned fish — high risk of torn fins and stress.'});

    if (g > 0 && g < 20 && (hasApisto || hasRam))
      issues.push({severity:'caution', message:'Dwarf cichlids in tanks under 20 gallons — may become aggressive or stressed. Aim for ~20g+ with hiding spots.'});

    if (maleBettas >= 1 && hasGourami)
      issues.push({severity:'caution', message:'Betta with Gourami-family fish — risk of rivalry and aggression.'});

    if (hasShrimp && hasAggressive)
      issues.push({severity:'caution', message:'Shrimp may be hunted or harassed by Bettas, Cichlids, or Gouramis. Provide heavy cover or avoid mixing.'});

    if (g > 0 && g < 29 && hasAngelfish)
      issues.push({severity:'caution', message:'Angelfish in tanks under 29 gallons may become stunted or aggressive. Recommend 29g+ tall tanks.'});

    const t = overlap(temps);
    const p = overlap(phs);
    if (t === null) issues.push({severity:'warning', message:'Selected species have non-overlapping temperature ranges.'});
    if (p === null) issues.push({severity:'warning', message:'Selected species have non-overlapping pH ranges.'});

    // Schooling mismatch note remains here (for user guidance)
    stock.forEach(e => {
      const f = fishById(fishList, e.id);
      if (!f) return;
      if ((f.min ?? 1) >= 6 && e.qty < f.min) {
        issues.push({severity:'caution', message:`${f.name}: schooling species below recommended group size (${e.qty}/${f.min}).`});
      }
    });

    return issues;
  }

  const Aggression = {
    baseMap,
    option2,
    overlap,
    conflictForEntry,
    speciesAggression,
    overallAverageConflict,
    checkIssues
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Aggression;
  } else {
    global.Aggression = Aggression;
  }
})(this);