const SPECIES = [
  {
    id: 'cardinal_tetra',
    common_name: 'Cardinal Tetra',
    scientific_name: 'Paracheirodon axelrodi',
    aggression: 18,
    min_group: 6,
    group: { type: 'shoal', min: 6 },
    min_tank_length_in: 24,
    temperature: [75, 82],
    pH: [5.5, 7.5],
    pH_sensitive: true,
    gH: [2, 8],
    kH: [0, 4],
    salinity: 'freshwater',
    flow: 'moderate',
    blackwater: 'prefers',
    adult_size_in: 2.0,
    density_factor: 0.008,
    tags: ['shoaler', 'nano'],
  },
  {
    id: 'betta_male',
    common_name: 'Betta splendens (male)',
    aggression: 65,
    min_group: 1,
    min_tank_length_in: 18,
    temperature: [76, 82],
    pH: [6, 7.5],
    gH: [3, 10],
    kH: [1, 5],
    salinity: 'freshwater',
    flow: 'low',
    blackwater: 'prefers',
    adult_size_in: 2.5,
    density_factor: 0.01,
    mouth_size_in: 2.5,
    invert_safe: false,
    tags: ['male_solo', 'predator_shrimp', 'fin_sensitive'],
  },
  {
    id: 'panda_cory',
    common_name: 'Corydoras panda',
    aggression: 10,
    min_group: 6,
    group: { type: 'shoal', min: 6 },
    min_tank_length_in: 30,
    temperature: [68, 77],
    pH: [6, 7.5],
    gH: [2, 10],
    kH: [1, 6],
    salinity: 'freshwater',
    flow: 'low',
    blackwater: 'prefers',
    adult_size_in: 2.0,
    density_factor: 0.01,
    tags: ['bottom', 'floor_spreader'],
  },
  {
    id: 'dwarf_cichlid',
    common_name: 'Dwarf Cichlid (Apistogramma sp.)',
    aggression: 55,
    min_group: 3,
    group: { type: 'harem', ratio: { m: 1, f: 2 }, min: 3 },
    min_tank_length_in: 32,
    temperature: [76, 82],
    pH: [5.8, 7],
    gH: [1, 8],
    kH: [0, 3],
    salinity: 'freshwater',
    flow: 'low',
    blackwater: 'requires',
    adult_size_in: 3.0,
    density_factor: 0.012,
    tags: ['territorial', 'bottom_territorial', 'predator_shrimp'],
  },
  {
    id: 'molly',
    common_name: 'Common Molly',
    aggression: 28,
    min_group: 4,
    group: { type: 'shoal', min: 4 },
    min_tank_length_in: 30,
    temperature: [72, 82],
    pH: [7, 8.5],
    gH: [8, 20],
    kH: [5, 15],
    salinity: 'brackish-low',
    flow: 'moderate',
    adult_size_in: 3.5,
    density_factor: 0.011,
    tags: ['livebearer', 'shoaler'],
  },
  {
    id: 'cherry_shrimp',
    common_name: 'Neocaridina Shrimp',
    aggression: 0,
    min_group: 10,
    group: { type: 'colony', min: 10 },
    min_tank_length_in: 12,
    temperature: [70, 78],
    pH: [6.4, 7.6],
    pH_sensitive: true,
    gH: [4, 12],
    kH: [2, 6],
    salinity: 'freshwater',
    flow: 'low',
    adult_size_in: 1.0,
    density_factor: 0.006,
    bioload_unit: 0.015,
    tags: ['invert', 'shrimp'],
  },
  {
    id: 'nerite_snail',
    common_name: 'Nerite Snail',
    aggression: 0,
    min_group: 1,
    min_tank_length_in: 16,
    temperature: [72, 78],
    pH: [7, 8.4],
    gH: [4, 18],
    kH: [3, 12],
    salinity: 'brackish-low',
    flow: 'moderate',
    adult_size_in: 1.2,
    density_factor: 0.006,
    bioload_unit: 0.08,
    tags: ['invert', 'snail'],
  },
];

export function getSpeciesById(id) {
  return SPECIES.find((species) => species.id === id) ?? null;
}

export const SPECIES_LIST = SPECIES.map((species) => ({
  id: species.id,
  name: species.common_name,
}));

export function getDefaultSpeciesId() {
  return SPECIES[0]?.id ?? null;
}

export function autoBioloadUnit(species) {
  if (!species) return 0;
  if (Number.isFinite(species.bioload_unit)) {
    return species.bioload_unit;
  }
  const size = Number.isFinite(species.adult_size_in) ? species.adult_size_in : 2.5;
  const density = Number.isFinite(species.density_factor) ? species.density_factor : 0.01;
  return size ** 3 * density;
}

export function listSensitiveSpecies(speciesEntries, parameter) {
  const results = [];
  for (const entry of speciesEntries) {
    const { species } = entry;
    if (!species) continue;
    if (parameter === 'pH' && species.pH_sensitive) {
      results.push(species.common_name);
    }
  }
  return results;
}
