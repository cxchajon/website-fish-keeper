import { BEHAVIOR_TAGS } from '../../logic/behaviorTags.js';
import { computeSpeciesBioload } from './bioload-model.js';

// Cache-policy marker read by the one-time stale-cache guard in stocking-advisor.html. It means "this
// copy was served under the revalidating /js/ policy (see _headers)"; it is never bumped per release.
(globalThis.__ttgRevalidatedModules ||= {})['species-adapter'] = true;

// Species data - loaded asynchronously for Safari compatibility
let speciesV2Raw = [];
let speciesLoadPromise = null;
let speciesInitialized = false;
// Outcome of loading species.v2.json: { ok, count, error }. Callers must not present results
// when ok is false (see initializeCompute in js/logic/compute.js).
let speciesLoadStatus = { ok: false, count: 0, error: 'not loaded' };

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
      if (!Array.isArray(speciesV2Raw) || speciesV2Raw.length === 0) {
        throw new Error('invalid species data format, expected a non-empty array');
      }
      speciesLoadStatus = { ok: true, count: speciesV2Raw.length, error: null };
    } catch (error) {
      console.error('[species-adapter] Failed to load species data:', error);
      speciesV2Raw = [];
      speciesLoadStatus = { ok: false, count: 0, error: error?.message || String(error) };
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
  // socialMinimum: a documented conspecific minimum for a species that does not school (e.g. honey
  // gourami, “buy no fewer than 4–6”). Represented as its own group type so it is never labelled a
  // shoal; schoolingMinimum takes precedence when both are set.
  const socialMin = asNumber(record?.behavior?.socialMinimum, null);
  if (socialMin > 1 && !(behaviorMin > 1) && !legacy?.group) {
    return { group: { type: 'social', min: socialMin }, minGroup: socialMin };
  }
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

function buildProtoMeta(record) {
  const predationRisks = Array.isArray(record?.behavior?.predationRisks)
    ? Object.freeze([...record.behavior.predationRisks])
    : Object.freeze([]);
  const incompatibilities = Array.isArray(record?.behavior?.incompatibilities)
    ? Object.freeze([...record.behavior.incompatibilities])
    : Object.freeze([]);
  return Object.freeze({
    slug: record.slug,
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

// Whether a record's own predation list says it eats `prey` ("Shrimp (juvenile)", "Snails").
// Entries such as "Predators: large fish" describe what eats this species and are ignored.
function preysOn(record, prey) {
  const risks = record?.behavior?.predationRisks;
  if (!Array.isArray(risks)) return false;
  const pattern = new RegExp(prey, 'i');
  return risks.some((risk) => typeof risk === 'string' && !/^\s*predators?\s*:/i.test(risk) && pattern.test(risk));
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Selectable fish that a record's own predation list explicitly names as prey, e.g.
// "Small fish (e.g., Neon Tetras)" → Neon Tetra. Only exact common-name matches (singular or plural)
// count — there is no size-based inference, and "Predators: …" entries are ignored.
function resolveFishPrey(record, fishNames) {
  const risks = record?.behavior?.predationRisks;
  if (!Array.isArray(risks)) return [];
  const prey = [];
  for (const risk of risks) {
    if (typeof risk !== 'string' || /^\s*predators?\s*:/i.test(risk)) continue;
    for (const { id, slug, name } of fishNames) {
      if (slug === record.slug) continue;
      const pattern = new RegExp(`\\b${escapeRegExp(name)}(e?s)?\\b`, 'i');
      if (pattern.test(risk)) prey.push({ id, evidence: risk });
    }
  }
  return prey;
}

// Fish species in the dataset, keyed for prey matching: engine id + common name without any
// parenthetical ("Blue Ram (German Blue Ram)" → "Blue Ram").
function buildFishNameIndex(records) {
  const list = [];
  for (const record of Array.isArray(records) ? records : []) {
    const legacy = LEGACY_BASE[record?.slug] || null;
    const category = record?.category ?? legacy?.category ?? null;
    if (category !== 'fish' || typeof record?.name !== 'string') continue;
    const name = record.name.replace(/\s*\(.*\)\s*/g, ' ').trim();
    if (!name) continue;
    list.push({ id: legacy?.id || record.slug.replace(/[^a-z0-9]+/gi, '_').toLowerCase(), slug: record.slug, name });
  }
  return list;
}

function mergeTags(legacyTags, recordTags) {
  const list = [];
  const seen = new Set();
  for (const source of [legacyTags, recordTags]) {
    if (!Array.isArray(source)) continue;
    for (const value of source) {
      if (typeof value !== 'string') continue;
      const tag = value.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(tag);
    }
  }
  return list;
}

// Normalises the v2 vocabulary onto the traits the engine rules read, so each concept has one
// meaning:
//   shrimp_risk / snail_risk — documented predation on shrimp / snails. Only explicit evidence
//                              counts: the v2 tag or a prey entry in behavior.predationRisks. The
//                              broad legacy invert_safe flag is NOT evidence of shrimp predation.
//                              A contradicting shrimp_safe / snail_safe tag is dropped.
//   longfin_target           — long_fins + LONG_FIN_VULNERABLE (fin-nipper target)
//   semi_nipper              — semi_aggressive (may nip long fins)
//   territorial / fin_nipper — TERRITORIAL / FIN_NIPPER behaviour
function normalizeTraits(record, legacy) {
  const tags = mergeTags(legacy?.tags, record?.tags);
  const has = (tag) => tags.includes(tag);
  const add = (tag) => { if (!has(tag)) tags.push(tag); };
  const drop = (tag) => { const index = tags.indexOf(tag); if (index >= 0) tags.splice(index, 1); };

  const shrimpRisk = has('shrimp_risk') || preysOn(record, 'shrimp');
  const snailRisk = has('snail_risk') || preysOn(record, 'snail');
  if (shrimpRisk) { add('shrimp_risk'); drop('shrimp_safe'); }
  if (snailRisk) { add('snail_risk'); drop('snail_safe'); }
  if (shrimpRisk || snailRisk) drop('invert_safe');
  if (has('longfin_target')) add('long_fins');
  if (has('semi_nipper')) add('semi_aggressive');

  const behavior = new Set(Array.isArray(legacy?.behavior) ? legacy.behavior : []);
  if (has('long_fins')) behavior.add(BEHAVIOR_TAGS.LONG_FIN_VULNERABLE);
  if (has('territorial')) behavior.add(BEHAVIOR_TAGS.TERRITORIAL);
  if (has('fin_nipper')) behavior.add(BEHAVIOR_TAGS.FIN_NIPPER);

  return {
    tags: Object.freeze(tags),
    behavior: behavior.size ? Object.freeze([...behavior]) : undefined,
    // Generic "safe with invertebrates" flag, kept separate from the predation tags above. It keeps
    // its legacy meaning where a legacy record exists; no current rule reads it for predation.
    invertSafe: typeof legacy?.invert_safe === 'boolean' ? legacy.invert_safe : !shrimpRisk && !snailRisk,
  };
}

// A value is taken from the v2 record first, then LEGACY_BASE. Missing values stay null — never a
// plausible-looking default — so validateSpeciesRecord rejects the record and the advisor shows
// the species as "could not be evaluated" instead of calculating with invented numbers.
function pick(record, legacy, key) {
  if (record?.[key] != null) return record[key];
  if (legacy?.[key] != null) return legacy[key];
  return null;
}

function rangeOrNull(range, legacyRange, minKey, maxKey) {
  if (Array.isArray(range) && range.length === 2 && range.every(Number.isFinite)) {
    return { [minKey]: range[0], [maxKey]: range[1] };
  }
  if (legacyRange && Number.isFinite(legacyRange[minKey]) && Number.isFinite(legacyRange[maxKey])) {
    return { [minKey]: legacyRange[minKey], [maxKey]: legacyRange[maxKey] };
  }
  return { [minKey]: null, [maxKey]: null };
}

function mapRecord(record, fishNames = []) {
  const legacy = LEGACY_BASE[record.slug] || null;
  const legacyId = legacy?.id || record.slug.replace(/[^a-z0-9]+/gi, '_').toLowerCase();

  const { group, minGroup } = normalizeGroup(record, legacy);
  const traits = normalizeTraits(record, legacy);
  const fishPrey = resolveFishPrey(record, fishNames);
  const tags = fishPrey.length && !traits.tags.includes('fish_risk')
    ? Object.freeze([...traits.tags, 'fish_risk'])
    : traits.tags;
  const lengthNotApplicable = record.tank_length_not_applicable === true;
  const category = pick(record, legacy, 'category');
  const adultSizeIn = pick(record, legacy, 'adult_size_in');
  const bioloadProfile = record.bioload_profile ?? null;

  const adapted = {
    id: legacyId,
    slug: record.slug,
    common_name: record.name,
    scientific_name: pick(record, legacy, 'scientific_name'),
    category,
    adult_size_in: adultSizeIn,
    min_tank_length_in: lengthNotApplicable ? null : pick(record, legacy, 'min_tank_length_in'),
    tank_length_not_applicable: lengthNotApplicable,
    min_tank_liters: pick(record, legacy, 'min_tank_liters'),
    // Sourced quantity-dependent space rule (territorial species), checked by tank suitability only.
    quantity_space: record.quantity_space ? Object.freeze({ ...record.quantity_space }) : null,
    // Field semantics: data/stocking-advisor/SPECIES_DATA_POLICY.md
    adult_size_basis: record.adult_size_basis ?? null,
    min_tank_basis: record.min_tank_basis ?? null,
    min_tank_length_basis: record.min_tank_length_basis ?? null,
    temperature: rangeOrNull(record.parameters?.temperature?.tolerable, legacy?.temperature, 'min_f', 'max_f'),
    ph: rangeOrNull(record.parameters?.pH?.tolerable, legacy?.ph, 'min', 'max'),
    gH: rangeOrNull(record.parameters?.gh?.tolerable, legacy?.gH, 'min_dGH', 'max_dGH'),
    kH: rangeOrNull(record.parameters?.kh?.tolerable, legacy?.kH, 'min_dKH', 'max_dKH'),
    salinity: deriveSalinity(record.slug, legacy),
    flow: record.parameters?.flow || legacy?.flow || null,
    blackwater: pick(record, legacy, 'blackwater'),
    aggression: Math.round(record.aggression?.baseline * 100),
    tags,
    // fish_risk: documented predation on other selectable fish (see resolveFishPrey).
    preys_on_species: Object.freeze(fishPrey.map((item) => Object.freeze({ ...item }))),
    behavior: traits.behavior,
    group,
    min_group: minGroup,
    invert_safe: traits.invertSafe,
    // No engine rule reads mouth size; left null rather than estimated for the newer species.
    mouth_size_in: legacy?.mouth_size_in ?? null,
    ph_sensitive: legacy?.ph_sensitive ?? false,
    // One model for every species (data/stocking-advisor/BIOLOAD_MODEL.md). NaN when the inputs are
    // incomplete, so validateSpeciesRecord rejects the record and the advisor flags it.
    bioload_profile: bioloadProfile ? Object.freeze({ ...bioloadProfile }) : null,
    bioloadGE: computeSpeciesBioload({ adultSizeIn, category, profile: bioloadProfile }),
    protoV2: buildProtoMeta(record),
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

  const fishNames = buildFishNameIndex(speciesV2Raw);
  ADAPTED_SPECIES = Object.freeze(speciesV2Raw.map((record) => mapRecord(record, fishNames)));
  SPECIES_BY_SLUG = new Map(ADAPTED_SPECIES.map((entry) => [entry.slug.toLowerCase(), entry]));
  speciesInitialized = true;
}

export function getSpeciesLoadStatus() {
  return { ...speciesLoadStatus };
}

export function getSpeciesListV2() {
  return ADAPTED_SPECIES.map((species) => ({
    id: species.id,
    slug: species.slug,
    name: species.common_name,
    bioloadGE: species.bioloadGE,
    aggressionScore: species.aggression,
  }));
}

export function getSpeciesBySlugV2(slug) {
  if (!slug) return null;
  const normalized = slug.toLowerCase();
  return SPECIES_BY_SLUG.get(normalized) ?? null;
}
