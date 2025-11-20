import { BEHAVIOR_TAGS } from '/js/logic/behaviorTags.js';

// Species data - loaded asynchronously for Safari compatibility
let speciesV2Raw = [];
let speciesLoadPromise = null;
let speciesInitialized = false;

// Start loading species data immediately (non-blocking)
function loadSpeciesData() {
  if (speciesLoadPromise) {
    return speciesLoadPromise;
  }

  speciesLoadPromise = (async () => {
    try {
      const speciesResponse = await fetch('/data/stocking-advisor/species.v2.json');
      if (!speciesResponse.ok) {
        throw new Error(`HTTP ${speciesResponse.status}: ${speciesResponse.statusText}`);
      }
      speciesV2Raw = await speciesResponse.json();
      if (!Array.isArray(speciesV2Raw)) {
        console.error('[species-adapter] Invalid species data format, expected array');
        speciesV2Raw = [];
      }
    } catch (error) {
      console.error('[species-adapter] Failed to load species data:', error);
      speciesV2Raw = [];
    }
  })();

  return speciesLoadPromise;
}

// Start loading immediately when module is imported
loadSpeciesData();

const LEGACY_BASE = Object.freeze({
  'amano-shrimp': Object.freeze({
    id: 'amano',
    scientific_name: 'Caridina multidentata',
    category: 'shrimp',
    adult_size_in: 2.0,
    min_tank_length_in: 12,
    temperature: Object.freeze({ min_f: 68, max_f: 78 }),
    ph: Object.freeze({ min: 6.5, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 5, max_dGH: 12 }),
    kH: Object.freeze({ min_dKH: 1, max_dKH: 8 }),
    salinity: 'fresh',
    flow: 'moderate',
    blackwater: 'neutral',
    tags: Object.freeze(['algae_specialist', 'invert_safe']),
    behavior: undefined,
    group: null,
    min_group: null,
    invert_safe: true,
    mouth_size_in: null,
    ph_sensitive: false,
  }),
  'betta-female': Object.freeze({
    id: 'betta_female',
    scientific_name: 'Betta splendens',
    category: 'fish',
    adult_size_in: 2.25,
    min_tank_length_in: 16,
    temperature: Object.freeze({ min_f: 75, max_f: 82 }),
    ph: Object.freeze({ min: 6.0, max: 8.0 }),
    gH: Object.freeze({ min_dGH: 5, max_dGH: 19 }),
    kH: Object.freeze({ min_dKH: 2, max_dKH: 10 }),
    salinity: 'fresh',
    flow: 'low',
    blackwater: 'neutral',
    tags: Object.freeze(['betta', 'labyrinth', 'fin_sensitive']),
    behavior: undefined,
    group: null,
    min_group: 1,
    invert_safe: false,
    mouth_size_in: 0.25,
    ph_sensitive: false,
  }),
  'betta-male': Object.freeze({
    id: 'betta_male',
    scientific_name: 'Betta splendens',
    category: 'fish',
    adult_size_in: 2.6,
    min_tank_length_in: 16,
    temperature: Object.freeze({ min_f: 75, max_f: 82 }),
    ph: Object.freeze({ min: 6.0, max: 8.0 }),
    gH: Object.freeze({ min_dGH: 5, max_dGH: 19 }),
    kH: Object.freeze({ min_dKH: 2, max_dKH: 10 }),
    salinity: 'fresh',
    flow: 'low',
    blackwater: 'neutral',
    tags: Object.freeze(['betta', 'betta_male', 'labyrinth', 'fin_sensitive', 'long_fins', 'slow_long_fins', 'aggressive']),
    behavior: Object.freeze([
      BEHAVIOR_TAGS.LONG_FIN_VULNERABLE,
      BEHAVIOR_TAGS.SLOW_SWIMMER,
      BEHAVIOR_TAGS.TERRITORIAL,
    ]),
    group: null,
    min_group: 1,
    invert_safe: false,
    mouth_size_in: 0.3,
    ph_sensitive: false,
  }),
  'bronze-corydoras': Object.freeze({
    id: 'cory_bronze',
    scientific_name: 'Corydoras aeneus',
    category: 'fish',
    adult_size_in: 2.5,
    min_tank_length_in: 36,
    temperature: Object.freeze({ min_f: 68, max_f: 80 }),
    ph: Object.freeze({ min: 6.0, max: 8.0 }),
    gH: Object.freeze({ min_dGH: 5, max_dGH: 19 }),
    kH: Object.freeze({ min_dKH: 3, max_dKH: 15 }),
    salinity: 'fresh',
    flow: 'moderate',
    blackwater: 'neutral',
    tags: Object.freeze(['shoaler', 'bottom_dweller', 'invert_safe']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 5 }),
    min_group: 5,
    invert_safe: true,
    mouth_size_in: 0.15,
    ph_sensitive: false,
  }),
  'cardinal-tetra': Object.freeze({
    id: 'cardinal',
    scientific_name: 'Paracheirodon axelrodi',
    category: 'fish',
    adult_size_in: 2.0,
    min_tank_length_in: 24,
    temperature: Object.freeze({ min_f: 74, max_f: 80 }),
    ph: Object.freeze({ min: 4.5, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 1, max_dGH: 12 }),
    kH: Object.freeze({ min_dKH: 0, max_dKH: 4 }),
    salinity: 'fresh',
    flow: 'low',
    blackwater: 'prefers',
    tags: Object.freeze(['shoaler', 'fin_sensitive', 'nano']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 6 }),
    min_group: 6,
    invert_safe: false,
    mouth_size_in: 0.15,
    ph_sensitive: true,
  }),
  'cherry-barb': Object.freeze({
    id: 'cherrybarb',
    scientific_name: 'Puntius titteya',
    category: 'fish',
    adult_size_in: 2.0,
    min_tank_length_in: 30,
    temperature: Object.freeze({ min_f: 73, max_f: 80 }),
    ph: Object.freeze({ min: 6.0, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 5, max_dGH: 15 }),
    kH: Object.freeze({ min_dKH: 2, max_dKH: 10 }),
    salinity: 'fresh',
    flow: 'moderate',
    blackwater: 'neutral',
    tags: Object.freeze(['shoaler']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 6 }),
    min_group: 6,
    invert_safe: false,
    mouth_size_in: 0.2,
    ph_sensitive: false,
  }),
  'cherry-shrimp': Object.freeze({
    id: 'neocaridina',
    scientific_name: 'Neocaridina davidi',
    category: 'shrimp',
    adult_size_in: 1.2,
    min_tank_length_in: 12,
    temperature: Object.freeze({ min_f: 68, max_f: 78 }),
    ph: Object.freeze({ min: 6.5, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 6, max_dGH: 12 }),
    kH: Object.freeze({ min_dKH: 2, max_dKH: 8 }),
    salinity: 'fresh',
    flow: 'low',
    blackwater: 'neutral',
    tags: Object.freeze(['invert_safe']),
    behavior: undefined,
    group: null,
    min_group: null,
    invert_safe: true,
    mouth_size_in: null,
    ph_sensitive: true,
  }),
  'chili-rasbora': Object.freeze({
    id: 'chili',
    scientific_name: 'Boraras brigittae',
    category: 'fish',
    adult_size_in: 0.8,
    min_tank_length_in: 18,
    temperature: Object.freeze({ min_f: 72, max_f: 80 }),
    ph: Object.freeze({ min: 5.0, max: 7.0 }),
    gH: Object.freeze({ min_dGH: 0, max_dGH: 8 }),
    kH: Object.freeze({ min_dKH: 0, max_dKH: 4 }),
    salinity: 'fresh',
    flow: 'low',
    blackwater: 'prefers',
    tags: Object.freeze(['shoaler', 'nano']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 8 }),
    min_group: 8,
    invert_safe: true,
    mouth_size_in: 0.05,
    ph_sensitive: true,
  }),
  'dwarf-gourami': Object.freeze({
    id: 'dgourami',
    scientific_name: 'Trichogaster lalius',
    category: 'fish',
    adult_size_in: 3.5,
    min_tank_length_in: 24,
    temperature: Object.freeze({ min_f: 72, max_f: 82 }),
    ph: Object.freeze({ min: 6.0, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 4, max_dGH: 15 }),
    kH: Object.freeze({ min_dKH: 2, max_dKH: 8 }),
    salinity: 'fresh',
    flow: 'low',
    blackwater: 'neutral',
    tags: Object.freeze(['labyrinth', 'fin_sensitive']),
    behavior: undefined,
    group: null,
    min_group: 1,
    invert_safe: false,
    mouth_size_in: 0.3,
    ph_sensitive: false,
  }),
  'guppy-male': Object.freeze({
    id: 'guppy_male',
    scientific_name: 'Poecilia reticulata',
    category: 'fish',
    adult_size_in: 1.4,
    min_tank_length_in: 20,
    temperature: Object.freeze({ min_f: 72, max_f: 82 }),
    ph: Object.freeze({ min: 7.0, max: 8.2 }),
    gH: Object.freeze({ min_dGH: 8, max_dGH: 20 }),
    kH: Object.freeze({ min_dKH: 4, max_dKH: 12 }),
    salinity: 'fresh',
    flow: 'moderate',
    blackwater: 'neutral',
    tags: Object.freeze(['livebearer', 'fin_sensitive']),
    behavior: undefined,
    group: null,
    min_group: 1,
    invert_safe: false,
    mouth_size_in: 0.15,
    ph_sensitive: false,
  }),
  'harlequin-rasbora': Object.freeze({
    id: 'harlequin',
    scientific_name: 'Trigonostigma heteromorpha',
    category: 'fish',
    adult_size_in: 2.0,
    min_tank_length_in: 24,
    temperature: Object.freeze({ min_f: 72, max_f: 80 }),
    ph: Object.freeze({ min: 6.0, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 2, max_dGH: 15 }),
    kH: Object.freeze({ min_dKH: 2, max_dKH: 8 }),
    salinity: 'fresh',
    flow: 'moderate',
    blackwater: 'prefers',
    tags: Object.freeze(['shoaler']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 6 }),
    min_group: 6,
    invert_safe: false,
    mouth_size_in: 0.2,
    ph_sensitive: false,
  }),
  'kuhli-loach': Object.freeze({
    id: 'kuhli',
    scientific_name: 'Pangio kuhlii',
    category: 'fish',
    adult_size_in: 4.0,
    min_tank_length_in: 36,
    temperature: Object.freeze({ min_f: 74, max_f: 80 }),
    ph: Object.freeze({ min: 5.5, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 2, max_dGH: 12 }),
    kH: Object.freeze({ min_dKH: 1, max_dKH: 8 }),
    salinity: 'fresh',
    flow: 'low',
    blackwater: 'prefers',
    tags: Object.freeze(['shoaler', 'bottom_dweller', 'nocturnal', 'invert_safe']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 5 }),
    min_group: 5,
    invert_safe: true,
    mouth_size_in: 0.1,
    ph_sensitive: false,
  }),
  'neon-tetra': Object.freeze({
    id: 'neon',
    scientific_name: 'Paracheirodon innesi',
    category: 'fish',
    adult_size_in: 1.3,
    min_tank_length_in: 24,
    temperature: Object.freeze({ min_f: 70, max_f: 77 }),
    ph: Object.freeze({ min: 4.5, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 1, max_dGH: 12 }),
    kH: Object.freeze({ min_dKH: 1, max_dKH: 8 }),
    salinity: 'fresh',
    flow: 'low',
    blackwater: 'prefers',
    tags: Object.freeze(['shoaler', 'fin_sensitive', 'nano']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 6 }),
    min_group: 6,
    invert_safe: false,
    mouth_size_in: 0.1,
    ph_sensitive: true,
  }),
  'nerite-snail': Object.freeze({
    id: 'nerite',
    scientific_name: 'Neritina spp.',
    category: 'snail',
    adult_size_in: 1.2,
    min_tank_length_in: 12,
    temperature: Object.freeze({ min_f: 72, max_f: 78 }),
    ph: Object.freeze({ min: 7.0, max: 8.5 }),
    gH: Object.freeze({ min_dGH: 8, max_dGH: 20 }),
    kH: Object.freeze({ min_dKH: 4, max_dKH: 12 }),
    salinity: 'dual',
    flow: 'moderate',
    blackwater: 'neutral',
    tags: Object.freeze(['algae_specialist', 'invert_safe']),
    behavior: undefined,
    group: null,
    min_group: null,
    invert_safe: true,
    mouth_size_in: null,
    ph_sensitive: false,
  }),
  'otocinclus': Object.freeze({
    id: 'otocinclus',
    scientific_name: 'Otocinclus spp.',
    category: 'fish',
    adult_size_in: 1.8,
    min_tank_length_in: 24,
    temperature: Object.freeze({ min_f: 72, max_f: 79 }),
    ph: Object.freeze({ min: 6.5, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 5, max_dGH: 15 }),
    kH: Object.freeze({ min_dKH: 2, max_dKH: 10 }),
    salinity: 'fresh',
    flow: 'moderate',
    blackwater: 'neutral',
    tags: Object.freeze(['shoaler', 'bottom_dweller', 'algae_specialist', 'invert_safe']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 5 }),
    min_group: 5,
    invert_safe: true,
    mouth_size_in: null,
    ph_sensitive: false,
  }),
  'panda-corydoras': Object.freeze({
    id: 'cory_panda',
    scientific_name: 'Corydoras panda',
    category: 'fish',
    adult_size_in: 2.0,
    min_tank_length_in: 30,
    temperature: Object.freeze({ min_f: 69, max_f: 77 }),
    ph: Object.freeze({ min: 6.0, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 1, max_dGH: 12 }),
    kH: Object.freeze({ min_dKH: 1, max_dKH: 8 }),
    salinity: 'fresh',
    flow: 'moderate',
    blackwater: 'prefers',
    tags: Object.freeze(['shoaler', 'bottom_dweller', 'invert_safe']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 5 }),
    min_group: 5,
    invert_safe: true,
    mouth_size_in: 0.1,
    ph_sensitive: false,
  }),
  'pearl-gourami': Object.freeze({
    id: 'pgourami',
    scientific_name: 'Trichopodus leerii',
    category: 'fish',
    adult_size_in: 4.5,
    min_tank_length_in: 36,
    temperature: Object.freeze({ min_f: 77, max_f: 82 }),
    ph: Object.freeze({ min: 5.5, max: 7.5 }),
    gH: Object.freeze({ min_dGH: 5, max_dGH: 19 }),
    kH: Object.freeze({ min_dKH: 2, max_dKH: 10 }),
    salinity: 'fresh',
    flow: 'low',
    blackwater: 'prefers',
    tags: Object.freeze(['labyrinth', 'fin_sensitive']),
    behavior: undefined,
    group: Object.freeze({ type: 'harem', min: 3, ratio: { m: 1, f: 2 } }),
    min_group: 3,
    invert_safe: false,
    mouth_size_in: 0.5,
    ph_sensitive: false,
  }),
  'rummynose-tetra': Object.freeze({
    id: 'rummynose',
    scientific_name: 'Hemigrammus/Petitella spp.',
    category: 'fish',
    adult_size_in: 2.5,
    min_tank_length_in: 30,
    temperature: Object.freeze({ min_f: 75, max_f: 81 }),
    ph: Object.freeze({ min: 5.5, max: 7.0 }),
    gH: Object.freeze({ min_dGH: 2, max_dGH: 15 }),
    kH: Object.freeze({ min_dKH: 1, max_dKH: 8 }),
    salinity: 'fresh',
    flow: 'moderate',
    blackwater: 'requires',
    tags: Object.freeze(['shoaler', 'fast_swimmer']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 10 }),
    min_group: 10,
    invert_safe: false,
    mouth_size_in: 0.2,
    ph_sensitive: true,
  }),
  'tiger-barb': Object.freeze({
    id: 'tiger_barb',
    scientific_name: 'Puntigrus tetrazona',
    category: 'fish',
    adult_size_in: 3.0,
    min_tank_length_in: 36,
    temperature: Object.freeze({ min_f: 72, max_f: 82 }),
    ph: Object.freeze({ min: 6.0, max: 8.0 }),
    gH: Object.freeze({ min_dGH: 5, max_dGH: 19 }),
    kH: Object.freeze({ min_dKH: 4, max_dKH: 15 }),
    salinity: 'fresh',
    flow: 'high',
    blackwater: 'neutral',
    tags: Object.freeze(['shoaler', 'schooling_shoaler', 'fast_swimmer', 'fin_nipper', 'semi_aggressive']),
    behavior: Object.freeze([
      BEHAVIOR_TAGS.FIN_NIPPER,
      BEHAVIOR_TAGS.FAST_ACTIVE,
      BEHAVIOR_TAGS.SHOALING,
    ]),
    group: Object.freeze({ type: 'shoal', min: 6 }),
    min_group: 6,
    invert_safe: false,
    mouth_size_in: 0.3,
    ph_sensitive: false,
  }),
  'zebra-danio': Object.freeze({
    id: 'zebra',
    scientific_name: 'Danio rerio',
    category: 'fish',
    adult_size_in: 2.0,
    min_tank_length_in: 30,
    temperature: Object.freeze({ min_f: 64, max_f: 75 }),
    ph: Object.freeze({ min: 6.5, max: 8.0 }),
    gH: Object.freeze({ min_dGH: 5, max_dGH: 19 }),
    kH: Object.freeze({ min_dKH: 4, max_dKH: 15 }),
    salinity: 'fresh',
    flow: 'high',
    blackwater: 'neutral',
    tags: Object.freeze(['shoaler', 'fast_swimmer', 'fin_nipper']),
    behavior: undefined,
    group: Object.freeze({ type: 'shoal', min: 6 }),
    min_group: 6,
    invert_safe: false,
    mouth_size_in: 0.2,
    ph_sensitive: false,
  }),
});

const LEGACY_BIOLOAD_SCALE = 0.6; // keeps prototype math aligned with legacy GE baseline

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(Number(value ?? 0) * factor) / factor;
}

function cloneRange(range, fallback) {
  if (Array.isArray(range) && range.length === 2) {
    const [min, max] = range;
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return [Number(min), Number(max)];
    }
  }
  if (Array.isArray(fallback) && fallback.length === 2) {
    return [...fallback];
  }
  return [null, null];
}

function asNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeGroup(record, legacy) {
  const behaviorMin = asNumber(record?.behavior?.schoolingMinimum, null);
  const legacyMin = asNumber(legacy?.group?.min ?? legacy?.min_group, null);
  const min = behaviorMin && behaviorMin > 1 ? behaviorMin : legacyMin;
  if (!min || min < 1) {
    return { group: legacy?.group ? { ...legacy.group } : null, minGroup: legacy?.min_group ?? null };
  }
  const type = legacy?.group?.type || (min > 1 ? 'shoal' : null);
  const ratio = legacy?.group?.ratio ? { ...legacy.group.ratio } : undefined;
  return {
    group: type ? { type, min, ...(ratio ? { ratio } : {}) } : null,
    minGroup: min,
  };
}

function buildProtoMeta(record, normalizedBioload) {
  const predationRisks = Array.isArray(record?.behavior?.predationRisks)
    ? Object.freeze([...record.behavior.predationRisks])
    : Object.freeze([]);
  const incompatibilities = Array.isArray(record?.behavior?.incompatibilities)
    ? Object.freeze([...record.behavior.incompatibilities])
    : Object.freeze([]);
  return Object.freeze({
    slug: record.slug,
    normalizedBioload,
    bioloadComponents: Object.freeze({ ...record.bioload.components }),
    aggression: Object.freeze({
      baseline: record.aggression.baseline,
      vectors: Object.freeze({ ...record.aggression.vectors }),
    }),
    parameters: Object.freeze({
      pH: Object.freeze({
        optimal: Object.freeze(cloneRange(record.parameters?.pH?.optimal, [])),
        tolerable: Object.freeze(cloneRange(record.parameters?.pH?.tolerable, [])),
        preferred: asNumber(record.parameters?.pH?.preferred, null),
      }),
      temperature: Object.freeze({
        optimal: Object.freeze(cloneRange(record.parameters?.temperature?.optimal, [])),
        tolerable: Object.freeze(cloneRange(record.parameters?.temperature?.tolerable, [])),
        preferred: asNumber(record.parameters?.temperature?.preferred, null),
      }),
      kh: Object.freeze({
        optimal: Object.freeze(cloneRange(record.parameters?.kh?.optimal, [])),
        tolerable: Object.freeze(cloneRange(record.parameters?.kh?.tolerable, [])),
        unit: record.parameters?.kh?.unit || 'dKH',
      }),
      gh: Object.freeze({
        optimal: Object.freeze(cloneRange(record.parameters?.gh?.optimal, [])),
        tolerable: Object.freeze(cloneRange(record.parameters?.gh?.tolerable, [])),
        unit: record.parameters?.gh?.unit || 'dGH',
      }),
      flow: record.parameters?.flow || 'moderate',
    }),
    behavior: Object.freeze({
      schoolingMinimum: asNumber(record.behavior?.schoolingMinimum, null),
      territorySize: record.behavior?.territorySize ?? null,
      predationRisks,
      incompatibilities,
      notes: record.behavior?.notes || '',
    }),
    confidence: Object.freeze({ ...record.confidence }),
    sources: Object.freeze({
      primary: Object.freeze(Array.isArray(record.sources?.primary) ? [...record.sources.primary] : []),
      secondary: Object.freeze(Array.isArray(record.sources?.secondary) ? [...record.sources.secondary] : []),
      dateVerified: record.sources?.dateVerified || null,
    }),
  });
}

function deriveSalinity(slug, legacy) {
  if (legacy?.salinity) {
    return legacy.salinity;
  }
  if (slug === 'nerite-snail') {
    return 'dual';
  }
  return 'fresh';
}

function deriveInvertSafety(record, legacy) {
  const risks = record?.behavior?.predationRisks;
  if (Array.isArray(risks) && risks.some((risk) => /shrimp|snail|invert/i.test(risk))) {
    return false;
  }
  if (typeof legacy?.invert_safe === 'boolean') {
    return legacy.invert_safe;
  }
  return true;
}

function mapRecord(record) {
  const legacy = LEGACY_BASE[record.slug] || null;
  const legacyId = legacy?.id || record.slug.replace(/[^a-z0-9]+/gi, '_').toLowerCase();

  const normalizedBioload = round(record.bioload.multiplier);
  const legacyBioload = round(normalizedBioload * LEGACY_BIOLOAD_SCALE);
  const [tempMin, tempMax] = cloneRange(record.parameters?.temperature?.tolerable, legacy?.temperature && [legacy.temperature.min_f, legacy.temperature.max_f]);
  const [phMin, phMax] = cloneRange(record.parameters?.pH?.tolerable, legacy?.ph && [legacy.ph.min, legacy.ph.max]);
  const [ghMin, ghMax] = cloneRange(record.parameters?.gh?.tolerable, legacy?.gH && [legacy.gH.min_dGH, legacy.gH.max_dGH]);
  const [khMin, khMax] = cloneRange(record.parameters?.kh?.tolerable, legacy?.kH && [legacy.kH.min_dKH, legacy.kH.max_dKH]);

  const { group, minGroup } = normalizeGroup(record, legacy);

  const adapted = {
    id: legacyId,
    slug: record.slug,
    common_name: record.name,
    scientific_name: legacy?.scientific_name || '',
    category: legacy?.category || 'fish',
    adult_size_in: legacy?.adult_size_in ?? 2.5,
    min_tank_length_in: legacy?.min_tank_length_in ?? 24,
    temperature: {
      min_f: asNumber(tempMin, legacy?.temperature?.min_f ?? 72),
      max_f: asNumber(tempMax, legacy?.temperature?.max_f ?? 78),
    },
    ph: {
      min: asNumber(phMin, legacy?.ph?.min ?? 6.0),
      max: asNumber(phMax, legacy?.ph?.max ?? 7.5),
    },
    gH: {
      min_dGH: asNumber(ghMin, legacy?.gH?.min_dGH ?? 3),
      max_dGH: asNumber(ghMax, legacy?.gH?.max_dGH ?? 12),
    },
    kH: {
      min_dKH: asNumber(khMin, legacy?.kH?.min_dKH ?? 2),
      max_dKH: asNumber(khMax, legacy?.kH?.max_dKH ?? 8),
    },
    salinity: deriveSalinity(record.slug, legacy),
    flow: record.parameters?.flow || legacy?.flow || 'moderate',
    blackwater: legacy?.blackwater || 'neutral',
    aggression: Math.round(record.aggression?.baseline * 100),
    tags: Array.isArray(legacy?.tags) ? [...legacy.tags] : [],
    behavior: Array.isArray(legacy?.behavior) ? [...legacy.behavior] : undefined,
    group,
    min_group: minGroup,
    invert_safe: deriveInvertSafety(record, legacy),
    mouth_size_in: legacy?.mouth_size_in ?? null,
    ph_sensitive: legacy?.ph_sensitive ?? false,
    bioloadGE: legacyBioload,
    protoV2: buildProtoMeta(record, normalizedBioload),
  };

  return Object.freeze(adapted);
}

// Species collections - built after initialization
let ADAPTED_SPECIES = [];
let SPECIES_BY_SLUG = new Map();

/**
 * Initialize species data - must be called before using getSpeciesListV2/getSpeciesBySlugV2
 * Safe to call multiple times (idempotent)
 */
export async function initializeSpecies() {
  if (speciesInitialized) {
    return;
  }

  await loadSpeciesData();

  ADAPTED_SPECIES = Object.freeze(speciesV2Raw.map(mapRecord));
  SPECIES_BY_SLUG = new Map(ADAPTED_SPECIES.map((entry) => [entry.slug.toLowerCase(), entry]));
  speciesInitialized = true;
}

export function getSpeciesListV2() {
  return ADAPTED_SPECIES.map((species) => ({
    id: species.id,
    slug: species.slug,
    name: species.common_name,
    normalizedBioload: species.protoV2.normalizedBioload,
    aggressionScore: species.aggression,
  }));
}

export function getSpeciesBySlugV2(slug) {
  if (!slug) return null;
  const normalized = slug.toLowerCase();
  return SPECIES_BY_SLUG.get(normalized) ?? null;
}
