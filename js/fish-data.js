/* Global species database for FishkeepingLifeCo calculator.
   Exposes window.FISH_DB = [...]. Keep ids stable; adjust fields freely.
   Fields:
   - id, name
   - aggression (0..1 higher = more aggressive)
   - bioload (relative unit per fish)
   - temp: [minF, maxF]
   - pH: [min, max]
   - schoolMin (recommended group size), soloOK (true for solitary)
   - tags: ['anabantoid','longfin','shrimp','snail','predator', ...]
   - aliases: search helpers
*/

(function () {
  const DB = [
    // Bettas & Gourami
    { id:'betta_m', name:'Betta (male)', aggression:0.7, bioload:1.6, temp:[76,82], pH:[6.0,7.5], schoolMin:1, soloOK:true, tags:['anabantoid','longfin','predator'], aliases:['betta','siamese fighting fish','male betta'] },
    { id:'betta_f', name:'Betta (female)', aggression:0.45, bioload:1.3, temp:[76,82], pH:[6.0,7.5], schoolMin:1, soloOK:true, tags:['anabantoid'], aliases:['female betta'] },
    { id:'dgourami', name:'Dwarf Gourami', aggression:0.45, bioload:2.2, temp:[77,82], pH:[6.0,7.8], schoolMin:1, soloOK:true, tags:['anabantoid','longfin'], aliases:['colisa lalia'] },
    { id:'pgourami', name:'Pearl Gourami', aggression:0.35, bioload:3.5, temp:[75,82], pH:[6.0,7.5], schoolMin:1, soloOK:true, tags:['anabantoid','longfin'], aliases:['trichopodus leerii'] },

    // Tetras & Rasboras
    { id:'cardinal', name:'Cardinal Tetra', aggression:0.2, bioload:0.25, temp:[75,82], pH:[5.5,7.0], schoolMin:6, soloOK:false, tags:['schooling','nano'], aliases:['paracheirodon axelrodi'] },
    { id:'neon', name:'Neon Tetra', aggression:0.2, bioload:0.2, temp:[72,80], pH:[6.0,7.5], schoolMin:6, soloOK:false, tags:['schooling','nano'] },
    { id:'ember', name:'Ember Tetra', aggression:0.15, bioload:0.15, temp:[73,82], pH:[5.5,7.5], schoolMin:8, soloOK:false, tags:['schooling','nano','tiny'] },
    { id:'rummynose', name:'Rummy-nose Tetra', aggression:0.2, bioload:0.35, temp:[75,82], pH:[5.5,7.0], schoolMin:8, soloOK:false, tags:['schooling'] },
    { id:'harlequin', name:'Harlequin Rasbora', aggression:0.2, bioload:0.3, temp:[72,80], pH:[6.0,7.8], schoolMin:6, soloOK:false, tags:['schooling'] },
    { id:'chili', name:'Chili Rasbora', aggression:0.1, bioload:0.1, temp:[73,82], pH:[5.0,7.4], schoolMin:10, soloOK:false, tags:['schooling','nano','tiny'] },

    // Barbs, Danio
    { id:'cherrybarb', name:'Cherry Barb', aggression:0.25, bioload:0.35, temp:[73,80], pH:[6.2,7.6], schoolMin:6, soloOK:false, tags:['schooling'] },
    { id:'zebra', name:'Zebra Danio', aggression:0.25, bioload:0.4, temp:[65,78], pH:[6.0,8.0], schoolMin:6, soloOK:false, tags:['schooling','coolwater'] },

    // Corydoras / bottom
    { id:'cory_panda', name:'Corydoras (Panda)', aggression:0.05, bioload:0.5, temp:[68,77], pH:[6.0,7.5], schoolMin:6, soloOK:false, tags:['schooling','bottom'] },
    { id:'cory_bronze', name:'Corydoras (Bronze)', aggression:0.05, bioload:0.6, temp:[72,82], pH:[5.8,7.8], schoolMin:6, soloOK:false, tags:['schooling','bottom'] },
    { id:'otocinclus', name:'Otocinclus', aggression:0.05, bioload:0.15, temp:[72,80], pH:[6.0,7.5], schoolMin:6, soloOK:false, tags:['algae','schooling','bottom'] },
    { id:'kuhli', name:'Kuhli Loach', aggression:0.1, bioload:0.6, temp:[75,82], pH:[5.5,7.5], schoolMin:6, soloOK:false, tags:['bottom'] },

    // Shrimp & snails
    { id:'amano', name:'Amano Shrimp', aggression:0.05, bioload:0.05, temp:[68,78], pH:[6.2,7.8], schoolMin:6, soloOK:false, tags:['shrimp','algae'] },
    { id:'neocaridina', name:'Cherry Shrimp (Neocaridina)', aggression:0.05, bioload:0.03, temp:[68,78], pH:[6.4,8.0], schoolMin:10, soloOK:false, tags:['shrimp','tiny'] },
    { id:'nerite', name:'Nerite Snail', aggression:0.0, bioload:0.08, temp:[72,78], pH:[6.8,8.2], schoolMin:1, soloOK:true, tags:['snail','algae'] },
    { id:'mysterysnail', name:'Mystery Snail', aggression:0.0, bioload:0.25, temp:[68,78], pH:[7.0,8.0], schoolMin:1, soloOK:true, tags:['snail'] },

    // Livebearers & others
    { id:'guppy_m', name:'Guppy (male)', aggression:0.15, bioload:0.25, temp:[72,80], pH:[6.6,8.0], schoolMin:3, soloOK:false, tags:['livebearer','longfin','nano'] },
    { id:'endlers', name:'Endler\'s Livebearer', aggression:0.15, bioload:0.2, temp:[72,80], pH:[6.6,8.0], schoolMin:6, soloOK:false, tags:['livebearer','nano'] },

    // Larger community markers
    { id:'angelfish', name:'Angelfish', aggression:0.45, bioload:6.0, temp:[76,82], pH:[6.2,7.6], schoolMin:1, soloOK:true, tags:['cichlid','predator','longfin'] },
  ];

  // Expose
  window.FISH_DB = DB;
})();