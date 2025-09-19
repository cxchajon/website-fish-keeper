// js/aggression.js
// Aggression / compatibility engine
// Returns { warnings: Array<{text, type: 'mild'|'moderate'|'severe'|'info', category: string}>, score: 0..100 }

(function(){
  /* ----------------- helpers ----------------- */
  function norm(s){ return (s||'').toString().trim().toLowerCase(); }
  function canonName(s){
    return norm(s)
      .replace(/\s*\([^)]*\)\s*/g,' ')
      .replace(/[_-]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  function getFishByName(name){
    const key = canonName(name);
    const data = Array.isArray(window.FISH_DATA) ? window.FISH_DATA : [];
    let row = data.find(r => canonName(r.name || r.id || '') === key);
    if (!row) {
      row = data.find(r => {
        const n = canonName(r.name || r.id || '');
        return n.includes(key) || key.includes(n);
      });
    }
    return row || null;
  }

  // Name checks
  function isBettaMale(n){ const c = canonName(n); return c.includes('betta') && c.includes('male'); }
  function isTigerBarb(n){ return canonName(n).includes('tiger barb'); }

  // Flags inferred from name when not present on FISH_DATA
  function inferFlags(name){
    const c = canonName(name);

    // Fin nippers (expand as needed)
    const nippers = [
      'tiger barb','black skirt tetra','zebra danio','serpae tetra','red eye tetra'
    ];
    const isNipper = nippers.some(k => c.includes(k));

    // Long-finned / slow targets
    const longFins = [
      'betta male','angelfish','pearl gourami','dwarf gourami','honey gourami','guppy'
    ];
    const isLong = longFins.some(k => c.includes(k));

    // Semi-aggressive dwarf/angels (territorial)
    const semiAgg = (
      c.includes('angelfish') ||
      c.includes('apistogramma') ||
      c.includes('ram cichlid') || c.includes('german blue ram')
    );

    // Tankbusters / big growers
    const tankbusters = [
      'goldfish','common pleco','oscar','severum','jack dempsey','convict'
    ];
    const isTankbuster = tankbusters.some(k => c.includes(k)) ||
                         c.includes('bristlenose pleco'); // smaller, but we still size-check

    return { nipsFins: isNipper, longFins: isLong, semiAggressive: semiAgg, tankbuster: isTankbuster };
  }

  // Minimum gallons that trigger “too small” warnings
  function minGallonsFor(name){
    const c = canonName(name);
    if (c.includes('bristlenose pleco')) return 30;
    if (c.includes('angelfish'))         return 29;
    if (c.includes('goldfish')) {
      // If we ever distinguish fancy vs common, this can branch. Use 30 as safe baseline.
      return 30;
    }
    if (c.includes('common pleco'))      return 75;
    if (c.includes('oscar'))             return 75;
    if (c.includes('severum'))           return 55;
    if (c.includes('jack dempsey'))      return 55;
    if (c.includes('convict'))           return 30;
    // Semi-aggressive dwarfs — still need some space to avoid territorial pressure
    if (c.includes('apistogramma') || c.includes('ram cichlid') || c.includes('german blue ram')) return 20;
    return 0; // no special cutoff
  }

  /* ----------------- main compute ----------------- */
  function compute(stock, opts){
    const items = (Array.isArray(stock)?stock:[])
      .filter(r => r && r.name && (r.qty||0) > 0)
      .map(r => ({ name: r.name, qty: r.qty|0 }));

    const gallons = (opts && Number.isFinite(+opts.gallons)) ? +opts.gallons : 0;

    /** warnings we’ll return (structured) */
    const warnings = [];
    /** bar points — cautions add, severe forces max */
    let points = 0;
    let hasSevere = false;

    // Enrich items with flags from data or inference
    const enriched = items.map(it => {
      const row = getFishByName(it.name) || {};
      const inferred = inferFlags(it.name);
      return {
        name: it.name,
        qty:  it.qty,
        nipsFins:   row.nipsFins   ?? inferred.nipsFins,
        longFins:   row.longFins   ?? inferred.longFins,
        semiAgg:    row.semiAggressive ?? inferred.semiAggressive,
        tankbuster: row.tankbuster ?? inferred.tankbuster
      };
    });

    const distinct = Array.from(new Set(enriched.map(e => canonName(e.name))));

    // ---------- Species-only tanks: no movement, except multiple male bettas ----------
    if (distinct.length === 1) {
      const only = enriched[0];
      if (isBettaMale(only.name) && only.qty > 1) {
        warnings.push({
          text: 'Two or more **male bettas** will fight. Keep exactly **one male betta per tank**.',
          type: 'severe',
          category: 'territorial'
        });
        return { warnings, score: 100 };
      }
      return { warnings, score: 0 };
    }

    // ---------- Global hard rule: multiple male bettas anywhere = severe ----------
    for (const it of enriched){
      if (isBettaMale(it.name) && it.qty > 1){
        warnings.push({
          text: 'Multiple **male bettas** together is a **serious conflict**.',
          type: 'severe',
          category: 'territorial'
        });
        hasSevere = true;
      }
    }

    // ---------- Fin-nippers vs long-fins across different species ----------
    const anyNipper = enriched.find(e => e.nipsFins && e.qty>0);
    const anyLong   = enriched.find(e => e.longFins && e.qty>0 && (!anyNipper || canonName(e.name) !== canonName(anyNipper.name)));
    if (anyNipper && anyLong){
      warnings.push({
        text: `**Fin-nippers** (e.g., ${anyNipper.name}) will harass **long-finned/slow fish** (e.g., ${anyLong.name}).`,
        type: 'severe',
        category: 'fin-nipping'
      });
      hasSevere = true;
    }
    // Explicit: Tiger barbs + male betta
    if (enriched.some(e => isTigerBarb(e.name)) && enriched.some(e => isBettaMale(e.name))){
      warnings.push({
        text: '**Tiger barbs** will shred **male bettas** — do not mix.',
        type: 'severe',
        category: 'fin-nipping'
      });
      hasSevere = true;
    }

    // ---------- Tank size checks (tankbusters & semi-aggressive dwarfs) ----------
    for (const it of enriched){
      const need = minGallonsFor(it.name);
      if (need && gallons && gallons < need){
        // tank too small for this fish
        const isSemi = inferFlags(it.name).semiAggressive;
        const isBig  = inferFlags(it.name).tankbuster;
        if (isBig || isSemi){
          warnings.push({
            text: `${it.name}: tank is **too small** (needs ~${need}g). In cramped space this species gets **pushy/territorial**.`,
            type: 'severe',
            category: 'tank-size'
          });
          hasSevere = true;
        }
      }
    }

    // ---------- Semi-aggressive cichlids mixed (different species) => moderate ----------
    const semiSet = Array.from(new Set(
      enriched.filter(e => e.semiAgg && e.qty>0).map(e => canonName(e.name))
    ));
    if (semiSet.length >= 2){
      warnings.push({
        text: 'Mixing **semi-aggressive cichlids** (e.g., Angels, Apistos, Rams) can cause territorial spats. Provide space & cover.',
        type: 'moderate',
        category: 'territorial'
      });
      points += 40; // moderate weight
    }

    // ---------- Soft/educational cautions (optional) ----------
    // Example: zebra danio + guppy (minor nipping risk)
    const hasZebra = enriched.some(e => canonName(e.name).includes('zebra danio'));
    const hasGuppy = enriched.some(e => canonName(e.name).includes('guppy'));
    if (hasZebra && hasGuppy){
      warnings.push({
        text: '⚠️ **Zebra danios** can occasionally nip **fancy guppy** tails. Keep danios in a good-sized group to reduce this.',
        type: 'mild',
        category: 'fin-nipping'
      });
      points += 25; // mild weight
    }

    // ---------- Score finalize ----------
    let score = 0;
    if (hasSevere) score = 100;
    else score = Math.min(100, points);

    return { warnings, score };
  }

  window.Aggression = { compute };
})();