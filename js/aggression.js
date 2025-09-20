/* js/aggression.js
 * Weighted aggression/compatibility rules -> {warnings:[], score}
 * Safe to load before modules; exposes window.Aggression.compute(stock, opts)
 */
(function(){
  // ---------- helpers ----------
  function norm(s){ return (s||'').toString().trim().toLowerCase(); }
  function canonName(s){
    return norm(s).replace(/[_-]+/g,' ')
                  .replace(/\s+/g,' ')
                  .replace(/\s*\([^)]*\)\s*/g,' ')
                  .trim();
  }
  function qtyOf(stock, names){
    const want = names.map(canonName);
    let n = 0;
    stock.forEach(row=>{
      const name = canonName(row.name);
      if (want.includes(name)) n += (row.qty||0);
    });
    return n;
  }
  function hasAny(stock, names){ return qtyOf(stock, names) > 0; }

  // ---------- groups (tie to your fish-data ids/names) ----------
  const LONG_FINS = [
    'angelfish','guppy (male)','guppy','swordtail','molly',
    'pearl gourami','dwarf gourami','honey gourami'
  ];
  const BETTAS = ['betta (male)','betta male','betta'];
  const FIN_NIPPERS_STRONG = ['tiger barb','serpae tetra']; // strong nippers
  const FIN_NIPPERS_MILD   = ['black skirt tetra','zebra danio','cherry barb']; // context matters
  const TERRITORIAL_DWARF_CICHLIDS = ['apistogramma (pair)','ram cichlid (german blue)','ram cichlid'];
  const ANGELS = ['angelfish'];
  const GOURAMIS = ['pearl gourami','dwarf gourami','honey gourami'];

  // ---------- rule utils ----------
  function pushWarn(out, text, severity, type){
    // severity: 'mild' | 'moderate' | 'severe' | 'info'
    out.warnings.push({ text, severity: severity||'mild', type: type||'general' });
  }
  function addScore(out, w){ out._score += w; }

  // ---------- compute ----------
  function compute(stock, opts){
    const out = { warnings:[], score:0, _score:0 };
    const totalSpecies = stock.filter(r=> (r.qty||0) > 0).length;

    // Safety: empty or single-species community -> keep at 0 unless explicit no-go
    if (totalSpecies <= 1){
      // explicit no-go: multiple male bettas
      const bettaCount = qtyOf(stock, BETTAS);
      if (bettaCount > 1){
        pushWarn(out, 'Multiple male bettas will fight. Keep only one male betta per tank.', 'severe', 'betta');
        addScore(out, 100);
      }
      out.score = Math.max(0, Math.min(100, out._score));
      delete out._score;
      return out;
    }

    // ========== RULES ==========

    // 1) Multiple male bettas = hard stop
    const bettaCount = qtyOf(stock, BETTAS);
    if (bettaCount > 1){
      pushWarn(out, 'Multiple male bettas will fight. Keep only one male betta per tank.', 'severe', 'betta');
      addScore(out, 100);
    }

    // 2) Betta (male) with long-finned or similar-bodied fish (angels, gouramis, fancy livebearers)
    if (bettaCount >= 1 && (hasAny(stock, LONG_FINS) || hasAny(stock, ANGELS) || hasAny(stock, GOURAMIS))){
      pushWarn(out, 'Betta (male) may flare at or nip long-finned/flowy fish (angels, gouramis, fancy livebearers).', 'moderate', 'fin');
      // weight scales slightly with how many potential targets there are
      const targets = qtyOf(stock, LONG_FINS.concat(ANGELS).concat(GOURAMIS));
      addScore(out, Math.min(45, 20 + Math.ceil(targets * 2.5))); // 20–45
    }

    // 3) Strong fin-nippers with long fins
    if (hasAny(stock, FIN_NIPPERS_STRONG) && (hasAny(stock, LONG_FINS) || hasAny(stock, ANGELS) || hasAny(stock, GOURAMIS))){
      pushWarn(out, 'Strong fin-nippers (e.g., Tiger barbs) can shred long fins. Keep in large schools and avoid long-finned tankmates.', 'severe', 'fin');
      const nippers = qtyOf(stock, FIN_NIPPERS_STRONG);
      addScore(out, Math.min(55, 30 + Math.ceil(nippers * 3))); // 30–55
    }

    // 4) Mild fin-nippers with long fins
    if (hasAny(stock, FIN_NIPPERS_MILD) && (hasAny(stock, LONG_FINS) || hasAny(stock, ANGELS) || hasAny(stock, GOURAMIS))){
      pushWarn(out, 'Some schooling fish can nip long fins if under-schooled or crowded. Keep bigger schools to diffuse nipping.', 'mild', 'fin');
      const nippers = qtyOf(stock, FIN_NIPPERS_MILD);
      addScore(out, Math.min(25, 10 + Math.ceil(nippers * 1.5))); // 10–25
    }

    // 5) Angelfish or gourami territoriality toward small tetras/rasboras (contextual, mild)
    if ((hasAny(stock, ANGELS) || hasAny(stock, GOURAMIS)) &&
        (hasAny(stock, ['neon tetra','ember tetra','harlequin rasbora','chili rasbora','rummy-nose tetra','cardinal tetra']))) {
      pushWarn(out, 'Cichlids/anabantoids can become territorial; small schooling fish may be chased, especially at feeding/breeding time.', 'mild', 'territory');
      addScore(out, 12);
    }

    // 6) Dwarf cichlids with other bottom dwellers (mild–moderate)
    if (hasAny(stock, TERRITORIAL_DWARF_CICHLIDS) && hasAny(stock, ['corydoras (small)','corydoras panda','kuhli loach','otocinclus','bristlenose pleco'])){
      pushWarn(out, 'Dwarf cichlids guard territories near the bottom; provide hides/caves and sight breaks for bottom dwellers.', 'moderate', 'territory');
      addScore(out, 18);
    }

    // 7) Large school dampens intra-species nipping (bonus reducer)
    const tigerBarbCount = qtyOf(stock, ['tiger barb']);
    if (tigerBarbCount >= 10){
      // small reduction thanks to proper schooling
      addScore(out, -8); // reduce a bit
    }

    // clamp and return
    out.score = Math.max(0, Math.min(100, out._score));
    delete out._score;
    return out;
  }

  window.Aggression = { compute };
})();