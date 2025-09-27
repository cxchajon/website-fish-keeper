import { validateSpeciesRecord } from "./logic/speciesSchema.js";

/* Tag enums recognized by logic:
   "betta","livebearer","labyrinth","algae_specialist","nano",
   "shoaler","bottom_dweller","fast_swimmer","nocturnal","territorial",
   "fin_nipper","fin_sensitive","predator_shrimp","predator_snail","invert_safe","cichlid"
*/
export const FISH_DB = [
  { id:"betta_male", common_name:"Siamese Fighting Fish (Male Betta)", scientific_name:"Betta splendens", category:"fish",
    adult_size_in:2.6, min_tank_length_in:16, temperature:{min_f:75,max_f:82}, ph:{min:6.0,max:8.0},
    gH:{min_dGH:5,max_dGH:19}, kH:{min_dKH:2,max_dKH:10}, salinity:"fresh", flow:"low", blackwater:"neutral",
    aggression:70, tags:["betta","labyrinth","fin_sensitive"], invert_safe:false, mouth_size_in:0.3, bioload_unit:0.5 },
  { id:"betta_female", common_name:"Siamese Fighting Fish (Female Betta)", scientific_name:"Betta splendens", category:"fish",
    adult_size_in:2.25, min_tank_length_in:16, temperature:{min_f:75,max_f:82}, ph:{min:6.0,max:8.0},
    gH:{min_dGH:5,max_dGH:19}, kH:{min_dKH:2,max_dKH:10}, salinity:"fresh", flow:"low", blackwater:"neutral",
    aggression:40, tags:["betta","labyrinth","fin_sensitive"], invert_safe:false, mouth_size_in:0.25,
    group:{type:"colony",min:5}, bioload_unit:0.5 },
  { id:"dgourami", common_name:"Dwarf Gourami", scientific_name:"Trichogaster lalius", category:"fish",
    adult_size_in:3.5, min_tank_length_in:24, temperature:{min_f:72,max_f:82}, ph:{min:6.0,max:7.5},
    gH:{min_dGH:4,max_dGH:15}, kH:{min_dKH:2,max_dKH:8}, salinity:"fresh", flow:"low", blackwater:"neutral",
    aggression:30, tags:["labyrinth","fin_sensitive"], invert_safe:false, mouth_size_in:0.3, bioload_unit:0.6 },
  { id:"pgourami", common_name:"Pearl Gourami", scientific_name:"Trichopodus leerii", category:"fish",
    adult_size_in:4.5, min_tank_length_in:36, temperature:{min_f:77,max_f:82}, ph:{min:5.5,max:7.5},
    gH:{min_dGH:5,max_dGH:19}, kH:{min_dKH:2,max_dKH:10}, salinity:"fresh", flow:"low", blackwater:"prefers",
    aggression:20, tags:["labyrinth","fin_sensitive"], group:{type:"harem",min:3,ratio:{m:1,f:2}}, invert_safe:false, mouth_size_in:0.5, bioload_unit:1.0 },
  { id:"cardinal", common_name:"Cardinal Tetra", scientific_name:"Paracheirodon axelrodi", category:"fish",
    adult_size_in:2.0, min_tank_length_in:24, temperature:{min_f:74,max_f:80}, ph:{min:4.5,max:7.5},
    gH:{min_dGH:1,max_dGH:12}, kH:{min_dKH:0,max_dKH:4}, salinity:"fresh", flow:"low", blackwater:"prefers",
    aggression:5, tags:["shoaler","fin_sensitive","nano"], group:{type:"shoal",min:6}, invert_safe:false, mouth_size_in:0.15, ph_sensitive:true, bioload_unit:0.2 },
  { id:"neon", common_name:"Neon Tetra", scientific_name:"Paracheirodon innesi", category:"fish",
    adult_size_in:1.3, min_tank_length_in:24, temperature:{min_f:70,max_f:77}, ph:{min:4.5,max:7.5},
    gH:{min_dGH:1,max_dGH:12}, kH:{min_dKH:1,max_dKH:8}, salinity:"fresh", flow:"low", blackwater:"prefers",
    aggression:5, tags:["shoaler","fin_sensitive","nano"], group:{type:"shoal",min:6}, invert_safe:false, mouth_size_in:0.1, ph_sensitive:true, bioload_unit:0.15 },
  { id:"rummynose", common_name:"Rummynose Tetra", scientific_name:"Hemigrammus/Petitella spp.", category:"fish",
    adult_size_in:2.5, min_tank_length_in:30, temperature:{min_f:75,max_f:81}, ph:{min:5.5,max:7.0},
    gH:{min_dGH:2,max_dGH:15}, kH:{min_dKH:1,max_dKH:8}, salinity:"fresh", flow:"moderate", blackwater:"requires",
    aggression:5, tags:["shoaler","fast_swimmer"], group:{type:"shoal",min:10}, invert_safe:false, mouth_size_in:0.2, ph_sensitive:true, bioload_unit:0.3 },
  { id:"harlequin", common_name:"Harlequin Rasbora", scientific_name:"Trigonostigma heteromorpha", category:"fish",
    adult_size_in:2.0, min_tank_length_in:24, temperature:{min_f:72,max_f:80}, ph:{min:6.0,max:7.5},
    gH:{min_dGH:2,max_dGH:15}, kH:{min_dKH:2,max_dKH:8}, salinity:"fresh", flow:"moderate", blackwater:"prefers",
    aggression:5, tags:["shoaler"], group:{type:"shoal",min:6}, invert_safe:false, mouth_size_in:0.2, bioload_unit:0.2 },
  { id:"chili", common_name:"Chili Rasbora", scientific_name:"Boraras brigittae", category:"fish",
    adult_size_in:0.8, min_tank_length_in:18, temperature:{min_f:72,max_f:80}, ph:{min:5.0,max:7.0},
    gH:{min_dGH:0,max_dGH:8}, kH:{min_dKH:0,max_dKH:4}, salinity:"fresh", flow:"low", blackwater:"prefers",
    aggression:0, tags:["shoaler","nano"], group:{type:"shoal",min:8}, invert_safe:true, mouth_size_in:0.05, ph_sensitive:true, bioload_unit:0.05 },
  { id:"tigerbarb", common_name:"Tiger Barb", scientific_name:"Puntigrus tetrazona", category:"fish",
    adult_size_in:3.0, min_tank_length_in:36, temperature:{min_f:72,max_f:82}, ph:{min:6.0,max:8.0},
    gH:{min_dGH:5,max_dGH:19}, kH:{min_dKH:4,max_dKH:15}, salinity:"fresh", flow:"high", blackwater:"neutral",
    aggression:55, tags:["shoaler","fast_swimmer","fin_nipper"], group:{type:"shoal",min:8}, invert_safe:false, mouth_size_in:0.3, bioload_unit:0.8 },
  { id:"cherrybarb", common_name:"Cherry Barb", scientific_name:"Puntius titteya", category:"fish",
    adult_size_in:2.0, min_tank_length_in:30, temperature:{min_f:73,max_f:80}, ph:{min:6.0,max:7.5},
    gH:{min_dGH:5,max_dGH:15}, kH:{min_dKH:2,max_dKH:10}, salinity:"fresh", flow:"moderate", blackwater:"neutral",
    aggression:10, tags:["shoaler"], group:{type:"shoal",min:6}, invert_safe:false, mouth_size_in:0.2, bioload_unit:0.3 },
  { id:"zebra", common_name:"Zebra Danio", scientific_name:"Danio rerio", category:"fish",
    adult_size_in:2.0, min_tank_length_in:30, temperature:{min_f:64,max_f:75}, ph:{min:6.5,max:8.0},
    gH:{min_dGH:5,max_dGH:19}, kH:{min_dKH:4,max_dKH:15}, salinity:"fresh", flow:"high", blackwater:"neutral",
    aggression:15, tags:["shoaler","fast_swimmer","fin_nipper"], group:{type:"shoal",min:6}, invert_safe:false, mouth_size_in:0.2, bioload_unit:0.4 },
  { id:"cory_panda", common_name:"Panda Corydoras", scientific_name:"Corydoras panda", category:"fish",
    adult_size_in:2.0, min_tank_length_in:30, temperature:{min_f:69,max_f:77}, ph:{min:6.0,max:7.5},
    gH:{min_dGH:1,max_dGH:12}, kH:{min_dKH:1,max_dKH:8}, salinity:"fresh", flow:"moderate", blackwater:"prefers",
    aggression:0, tags:["shoaler","bottom_dweller","invert_safe"], group:{type:"shoal",min:5}, invert_safe:true, mouth_size_in:0.1, bioload_unit:0.3 },
  { id:"cory_bronze", common_name:"Bronze Corydoras", scientific_name:"Corydoras aeneus", category:"fish",
    adult_size_in:2.5, min_tank_length_in:36, temperature:{min_f:68,max_f:80}, ph:{min:6.0,max:8.0},
    gH:{min_dGH:5,max_dGH:19}, kH:{min_dKH:3,max_dKH:15}, salinity:"fresh", flow:"moderate", blackwater:"neutral",
    aggression:0, tags:["shoaler","bottom_dweller","invert_safe"], group:{type:"shoal",min:5}, invert_safe:true, mouth_size_in:0.15, bioload_unit:0.4 },
  { id:"kuhli", common_name:"Kuhli Loach", scientific_name:"Pangio kuhlii", category:"fish",
    adult_size_in:4.0, min_tank_length_in:36, temperature:{min_f:74,max_f:80}, ph:{min:5.5,max:7.5},
    gH:{min_dGH:2,max_dGH:12}, kH:{min_dKH:1,max_dKH:8}, salinity:"fresh", flow:"low", blackwater:"prefers",
    aggression:0, tags:["shoaler","bottom_dweller","nocturnal","invert_safe"], group:{type:"shoal",min:5}, invert_safe:true, mouth_size_in:0.1, bioload_unit:0.5 },
  { id:"otocinclus", common_name:"Otocinclus (Oto Cat)", scientific_name:"Otocinclus spp.", category:"fish",
    adult_size_in:1.8, min_tank_length_in:24, temperature:{min_f:72,max_f:79}, ph:{min:6.5,max:7.5},
    gH:{min_dGH:5,max_dGH:15}, kH:{min_dKH:2,max_dKH:10}, salinity:"fresh", flow:"moderate", blackwater:"neutral",
    aggression:0, tags:["shoaler","bottom_dweller","algae_specialist","invert_safe"], group:{type:"shoal",min:5}, invert_safe:true, bioload_unit:0.2 },
  { id:"amano", common_name:"Amano Shrimp", scientific_name:"Caridina multidentata", category:"shrimp",
    adult_size_in:2.0, min_tank_length_in:12, temperature:{min_f:68,max_f:78}, ph:{min:6.5,max:7.5},
    gH:{min_dGH:5,max_dGH:12}, kH:{min_dKH:1,max_dKH:8}, salinity:"fresh", flow:"moderate", blackwater:"neutral",
    aggression:0, tags:["algae_specialist","invert_safe"], invert_safe:true, bioload_unit:0.02 },
  { id:"neocaridina", common_name:"Cherry Shrimp", scientific_name:"Neocaridina davidi", category:"shrimp",
    adult_size_in:1.2, min_tank_length_in:12, temperature:{min_f:68,max_f:78}, ph:{min:6.5,max:7.5},
    gH:{min_dGH:6,max_dGH:12}, kH:{min_dKH:2,max_dKH:8}, salinity:"fresh", flow:"low", blackwater:"neutral",
    aggression:0, tags:["invert_safe"], invert_safe:true, ph_sensitive:true, bioload_unit:0.01 },
  { id:"nerite", common_name:"Nerite Snail", scientific_name:"Neritina spp.", category:"snail",
    adult_size_in:1.2, min_tank_length_in:12, temperature:{min_f:72,max_f:78}, ph:{min:7.0,max:8.5},
    gH:{min_dGH:8,max_dGH:20}, kH:{min_dKH:4,max_dKH:12}, salinity:"dual", flow:"moderate", blackwater:"neutral",
    aggression:0, tags:["algae_specialist","invert_safe"], invert_safe:true, bioload_unit:0.03 },
  { id:"guppy_male", common_name:"Guppy (Male)", scientific_name:"Poecilia reticulata", category:"fish",
    adult_size_in:1.4, min_tank_length_in:20, temperature:{min_f:72,max_f:82}, ph:{min:7.0,max:8.2},
    gH:{min_dGH:8,max_dGH:20}, kH:{min_dKH:4,max_dKH:12}, salinity:"fresh", flow:"moderate", blackwater:"neutral",
    aggression:10, tags:["livebearer","fin_sensitive"], invert_safe:false, mouth_size_in:0.15, bioload_unit:0.3 }
];

// one-time validation; console-warn any rejects
(function auditDB(){
  let ok = 0;
  const bad = [];
  let marine = 0;
  for (const s of FISH_DB){
    if (s.salinity === 'marine') {
      marine += 1;
    }
    const r = validateSpeciesRecord(s);
    if (r === true) ok += 1; else bad.push({ id: s.id, reason: r });
  }
  console.info(`[StockingAdvisor] Species loaded: ${ok}/${FISH_DB.length}; marine excluded`);
  if (marine > 0) console.warn('Marine entries skipped:', marine);
  if (bad.length) console.warn('Species schema rejects:', bad);
})();
