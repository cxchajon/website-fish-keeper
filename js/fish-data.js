// js/fish-data.js
// Baseline aggression: 0 (very peaceful) → 100 (very aggressive)
// These are general community-aquarium heuristics, not hard lab values.

window.DEMO_FISH = [
  // Peaceful schooling tetras/rasboras generally 8–14
  { id:"neon_tetra",        name:"Neon tetra",                 points:1.0,  min:6,  aggression:10 },
  { id:"cardinal_tetra",    name:"Cardinal tetra",             points:1.2,  min:6,  aggression:12 },
  { id:"ember_tetra",       name:"Ember tetra",                points:0.9,  min:8,  aggression:8  },
  { id:"rummynose_tetra",   name:"Rummy-nose tetra",           points:1.4,  min:8,  aggression:12 },
  { id:"black_skirt_tetra", name:"Black skirt tetra",          points:2.0,  min:6,  aggression:22 }, // can nip
  { id:"harlequin_rasbora", name:"Harlequin rasbora",          points:1.0,  min:6,  aggression:10 },
  { id:"chili_rasbora",     name:"Chili rasbora",              points:0.6,  min:10, aggression:8  },
  { id:"zebra_danio",       name:"Zebra danio",                points:1.2,  min:6,  aggression:20 }, // boisterous
  { id:"white_cloud",       name:"White cloud mountain minnow",points:1.0,  min:6,  aggression:8  },
  { id:"cherry_barb",       name:"Cherry barb",                points:2.0,  min:6,  aggression:15 },

  // Livebearers
  { id:"guppy",             name:"Guppy (male)",               points:1.6,  min:3,  aggression:18 }, // mild nipper, long-fin
  { id:"platy",             name:"Platy",                      points:3.0,  min:3,  aggression:12 },
  { id:"molly",             name:"Molly",                      points:4.0,  min:3,  aggression:18 },
  { id:"swordtail",         name:"Swordtail",                  points:4.5,  min:3,  aggression:22 },

  // Gouramis (labyrinth fish)
  { id:"dwarf_gourami",     name:"Dwarf gourami",              points:5.0,  min:1,  aggression:35 },
  { id:"honey_gourami",     name:"Honey gourami",              points:3.5,  min:1,  aggression:20 },
  { id:"pearl_gourami",     name:"Pearl gourami",              points:7.0,  min:1,  aggression:25 },

  // Centerpiece / semi-aggressive
  { id:"betta_male",        name:"Betta (male)",               points:6.0,  min:1,  aggression:70 }, // baseline—conflicts handled separately
  { id:"tiger_barb",        name:"Tiger barb",                 points:2.5,  min:6,  aggression:45 }, // nippy

  // Bottom dwellers & algae crew (very peaceful)
  { id:"cory_small",        name:"Corydoras (small)",          points:2.2,  min:6,  aggression:5  },
  { id:"cory_panda",        name:"Corydoras panda",            points:2.4,  min:6,  aggression:5  },
  { id:"kuhli_loach",       name:"Kuhli loach",                points:2.5,  min:5,  aggression:5  },
  { id:"otocinclus",        name:"Otocinclus",                 points:1.2,  min:6,  aggression:5  },
  { id:"bristlenose_pleco", name:"Bristlenose pleco",          points:8.0,  min:1,  aggression:12 },

  // Rainbows / larger community
  { id:"praecox_rainbow",   name:"Dwarf rainbowfish (Praecox)",points:4.5,  min:6,  aggression:20 },

  // Cichlids (community-safe dwarfs vs. angels)
  { id:"angelfish",         name:"Angelfish",                  points:10.0, min:1,  aggression:55 },
  { id:"apistogramma",      name:"Apistogramma (pair)",        points:6.0,  min:1,  aggression:40 },
  { id:"ram_cichlid",       name:"Ram cichlid (German blue)",  points:5.0,  min:1,  aggression:35 },

  // Inverts
  { id:"amano_shrimp",      name:"Amano shrimp",               points:0.5,  min:3,  aggression:0  },
  { id:"cherry_shrimp",     name:"Cherry shrimp",              points:0.3,  min:6,  aggression:0  },
  { id:"nerite_snail",      name:"Nerite snail",               points:0.4,  min:1,  aggression:0  },
  { id:"mystery_snail",     name:"Mystery snail",              points:0.8,  min:1,  aggression:0  }
];