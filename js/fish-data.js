(function () {
  // Tags used by logic:
  // - longfin, predator, shrimp, nipper, cichlid
  // - schooling, bottom, nano, tiny

  const DB = [
    // Bettas & Gourami
    { id:'betta_m', name:'Betta (male)', aggression:0.7, bioload:1.6, temp:[76,82], pH:[6.0,7.5], schoolMin:1, soloOK:true, tags:['anabantoid','longfin','predator'], advisory:'Territorial. Best kept solo or with carefully chosen tankmates; avoid fin‑nippers and flashy long‑fins.' },
    { id:'betta_f', name:'Betta (female)', aggression:0.45, bioload:1.3, temp:[76,82], pH:[6.0,7.5], schoolMin:1, soloOK:true, tags:['anabantoid'], advisory:'Can be semi‑aggressive. Monitor with similar-sized, peaceful tankmates.' },
    { id:'dgourami', name:'Dwarf Gourami', aggression:0.45, bioload:2.2, temp:[77,82], pH:[6.0,7.8], schoolMin:1, soloOK:true, tags:['anabantoid','longfin'], advisory:'Peaceful to semi‑aggressive; avoid nippy tankmates.' },
    { id:'pgourami', name:'Pearl Gourami', aggression:0.35, bioload:3.5, temp:[75,82], pH:[6.0,7.5], schoolMin:1, soloOK:true, tags:['anabantoid','longfin'], advisory:'Generally peaceful; long fins vulnerable to nippers.' },

    // Tetras & Rasboras
    { id:'cardinal', name:'Cardinal Tetra', aggression:0.2, bioload:0.25, temp:[75,82], pH:[5.5,7.0], schoolMin:6, soloOK:false, tags:['schooling','nano'], advisory:'Peaceful schooling fish; keep in groups of 6+ (more is better).' },
    { id:'neon', name:'Neon Tetra', aggression:0.2, bioload:0.2, temp:[72,80], pH:[6.0,7.5], schoolMin:6, soloOK:false, tags:['schooling','nano'], advisory:'Peaceful schooling fish; keep 6+.' },
    { id:'ember', name:'Ember Tetra', aggression:0.15, bioload:0.15, temp:[73,82], pH:[5.5,7.5], schoolMin:8, soloOK:false, tags:['schooling','nano','tiny'], advisory:'Tiny, peaceful; best in larger groups.' },
    { id:'rummynose', name:'Rummy-nose Tetra', aggression:0.2, bioload:0.35, temp:[75,82], pH:[5.5,7.0], schoolMin:8, soloOK:false, tags:['schooling'], advisory:'Great shoaler; needs stable warm water.' },
    { id:'harlequin', name:'Harlequin Rasbora', aggression:0.2, bioload:0.3, temp:[72,80], pH:[6.0,7.8], schoolMin:6, soloOK:false, tags:['schooling'], advisory:'Peaceful; keep 6+.' },
    { id:'chili', name:'Chili Rasbora', aggression:0.1, bioload:0.1, temp:[73,82], pH:[5.0,7.4], schoolMin:10, soloOK:false, tags:['schooling','nano','tiny'], advisory:'Very small; keep 10+.' },

    // Barbs, Danios (Tiger Barb = classic nipper)
    { id:'tigerbarb', name:'Tiger Barb', aggression:0.5, bioload:0.7, temp:[72,82], pH:[6.0,7.8], schoolMin:8, soloOK:false, tags:['schooling','nipper'], advisory:'Energetic fin‑nipper. Keep in larger groups; avoid long‑fins.' },
    { id:'cherrybarb', name:'Cherry Barb', aggression:0.25, bioload:0.35, temp:[73,80], pH:[6.2,7.6], schoolMin:6, soloOK:false, tags:['schooling'], advisory:'Peaceful barb; keep 6+.' },
    { id:'zebra', name:'Zebra Danio', aggression:0.25, bioload:0.4, temp:[65,78], pH:[6.0,8.0], schoolMin:6, soloOK:false, tags:['schooling','coolwater','nipper'], advisory:'Active; may nip long fins.' },

    // Corydoras / bottom
    { id:'cory_panda', name:'Corydoras (Panda)', aggression:0.05, bioload:0.5, temp:[68,77], pH:[6.0,7.5], schoolMin:6, soloOK:false, tags:['schooling','bottom'], advisory:'Peaceful bottom dweller; keep 6+.' },
    { id:'cory_bronze', name:'Corydoras (Bronze)', aggression:0.05, bioload:0.6, temp:[72,82], pH:[5.8,7.8], schoolMin:6, soloOK:false, tags:['schooling','bottom'], advisory:'Peaceful; keep 6+.' },
    { id:'kuhli', name:'Kuhli Loach', aggression:0.1, bioload:0.6, temp:[75,82], pH:[5.5,7.5], schoolMin:6, soloOK:false, tags:['bottom'], advisory:'Shy; provide hides; best in groups.' },

    // Algae/cleaners
    { id:'otocinclus', name:'Otocinclus', aggression:0.05, bioload:0.15, temp:[72,80], pH:[6.0,7.5], schoolMin:6, soloOK:false, tags:['algae','schooling','bottom'], advisory:'Sensitive; needs mature tank; keep 6+.' },

    // Shrimp & snails
    { id:'amano', name:'Amano Shrimp', aggression:0.05, bioload:0.05, temp:[68,78], pH:[6.2,7.8], schoolMin:6, soloOK:false, tags:['shrimp','algae'], advisory:'Great cleaner; needs cover with larger fish.' },
    { id:'neocaridina', name:'Cherry Shrimp (Neocaridina)', aggression:0.05, bioload:0.03, temp:[68,78], pH:[6.4,8.0], schoolMin:10, soloOK:false, tags:['shrimp','tiny'], advisory:'Small and prey-sized; dense plants help.' },
    { id:'nerite', name:'Nerite Snail', aggression:0.0, bioload:0.08, temp:[72,78], pH:[6.8,8.2], schoolMin:1, soloOK:true, tags:['snail','algae'], advisory:'Peaceful; great algae eater.' },
    { id:'mysterysnail', name:'Mystery Snail', aggression:0.0, bioload:0.25, temp:[68,78], pH:[7.0,8.0], schoolMin:1, soloOK:true, tags:['snail'], advisory:'Peaceful; mind bioload.' },

    // Livebearers & others
    { id:'guppy_m', name:'Guppy (male)', aggression:0.15, bioload:0.25, temp:[72,80], pH:[6.6,8.0], schoolMin:3, soloOK:false, tags:['livebearer','longfin','nano'], advisory:'Long fins; avoid nippers.' },
    { id:'endlers', name:"Endler's Livebearer", aggression:0.15, bioload:0.2, temp:[72,80], pH:[6.6,8.0], schoolMin:6, soloOK:false, tags:['livebearer','nano','longfin'], advisory:'Small, flashy; avoid nippers.' },

    // Larger community markers
    { id:'angelfish', name:'Angelfish', aggression:0.45, bioload:6.0, temp:[76,82], pH:[6.2,7.6], schoolMin:1, soloOK:true, tags:['cichlid','predator','longfin'], advisory:'Semi-aggressive predator. May eat small fish/shrimp; avoid nippy tankmates.' },
  ];

  window.FISH_DB = DB;
})(); 