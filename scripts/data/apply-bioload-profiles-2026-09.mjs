// Data migration: writes the bioload model inputs (`bioload_profile`) into every species.v2.json
// record. The model and the meaning of each class are defined in data/stocking-advisor/BIOLOAD_MODEL.md
// — read that before changing a class here.
//
// The former `bioload` multiplier/components block is left in place but no calculation reads it: the
// site serves /js/* with a one-year immutable cache and nested module imports carry no version, so a
// returning visitor may still run the previous adapter, which requires that block.
//
// Re-running is idempotent: an existing `bioload_profile` is replaced.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../../data/stocking-advisor/species.v2.json', import.meta.url));

const LOW_GRAZER = 'Grazes biofilm, algae and detritus already produced in the tank rather than relying on added food, so it adds less new nitrogen than a fed animal of the same size.';

// body_build (fish only): elongate | slender | standard | deep | disc. Invertebrates: null.
// waste_class: low | standard | high — a non-standard class carries its rationale.
const PROFILES = {
  // Fish — elongate
  'kuhli-loach': { body_build: 'elongate' },
  // Fish — slender
  'zebra-danio': { body_build: 'slender' },
  'white-cloud-mountain-minnow': { body_build: 'slender' },
  'glass-catfish': { body_build: 'slender' },
  'guppy-male': { body_build: 'slender' },
  'hillstream-loach': { body_build: 'slender' },
  // Fish — standard
  'neon-tetra': { body_build: 'standard' },
  'cardinal-tetra': { body_build: 'standard' },
  'ember-tetra': { body_build: 'standard' },
  'rummynose-tetra': { body_build: 'standard' },
  'harlequin-rasbora': { body_build: 'standard' },
  'chili-rasbora': { body_build: 'standard' },
  'celestial-pearl-danio': { body_build: 'standard' },
  'cherry-barb': { body_build: 'standard' },
  'swordtail': { body_build: 'standard' },
  'betta-male': { body_build: 'standard' },
  'betta-female': { body_build: 'standard' },
  'kribensis': { body_build: 'standard' },
  'cockatoo-cichlid': { body_build: 'standard' },
  'otocinclus': { body_build: 'standard', waste_class: 'low', rationale: `${LOW_GRAZER} Otocinclus feed mainly on biofilm and soft algae.` },
  // Fish — deep
  'tiger-barb': { body_build: 'deep' },
  'bronze-corydoras': { body_build: 'deep' },
  'panda-corydoras': { body_build: 'deep' },
  'pygmy-corydoras': { body_build: 'deep' },
  'dwarf-gourami': { body_build: 'deep' },
  'pearl-gourami': { body_build: 'deep' },
  'honey-gourami': { body_build: 'deep' },
  'blue-ram': { body_build: 'deep' },
  'bolivian-ram': { body_build: 'deep' },
  'keyhole-cichlid': { body_build: 'deep' },
  'molly': { body_build: 'deep' },
  'platy': { body_build: 'deep' },
  'upside-down-catfish': { body_build: 'deep' },
  'bristlenose-pleco': { body_build: 'deep', waste_class: 'high', rationale: 'Loricariid grazer that rasps algae and wood and eats vegetable foods with a high food throughput, producing heavy solid waste for its size.' },
  'pea-puffer': { body_build: 'deep', waste_class: 'high', rationale: 'Carnivore fed snails and frozen meaty foods; messy feeder with high-protein food and leftovers, so waste is high for its size.' },
  // Fish — disc
  'freshwater-angelfish': { body_build: 'disc' },
  // Invertebrates (body_build does not apply)
  'cherry-shrimp': { waste_class: 'low', rationale: LOW_GRAZER },
  'amano-shrimp': { waste_class: 'low', rationale: LOW_GRAZER },
  'bamboo-shrimp': { waste_class: 'low', rationale: 'Filter feeder that fans suspended particles from the current rather than eating added food.' },
  'ghost-shrimp': {},
  'nerite-snail': { waste_class: 'low', rationale: `${LOW_GRAZER} Nerites graze algae films.` },
  'ramshorn-snail': { waste_class: 'low', rationale: `${LOW_GRAZER} Ramshorns graze algae, biofilm and decaying plant matter.` },
  'mystery-snail': {},
  'assassin-snail': {},
};

const records = JSON.parse(readFileSync(FILE, 'utf8'));
const slugs = records.map((record) => record.slug);
const missing = slugs.filter((slug) => !PROFILES[slug]);
const unknown = Object.keys(PROFILES).filter((slug) => !slugs.includes(slug));
if (missing.length || unknown.length) {
  throw new Error(`profile/record mismatch — missing: ${missing.join(', ')}; unknown: ${unknown.join(', ')}`);
}

function profileFor(record) {
  const input = PROFILES[record.slug];
  const profile = {
    body_build: input.body_build ?? null,
    waste_class: input.waste_class ?? 'standard',
  };
  if (input.rationale) profile.rationale = input.rationale;
  return profile;
}

// Records are formatted by hand (4-space record indent), so the profile is inserted as text directly
// after the record's `bioload` block.
const PROFILE_BLOCK = /\n {4}"bioload_profile": \{\n[\s\S]*?\n {4}\},/;
const BIOLOAD_BLOCK = /\n {4}"bioload": \{\n[\s\S]*?\n {4}\},/;
let text = readFileSync(FILE, 'utf8');
let cursor = 0;
for (const record of records) {
  const start = text.indexOf(`"slug": ${JSON.stringify(record.slug)}`, cursor);
  if (start < 0) throw new Error(`record ${record.slug} not found`);
  const nextRecord = text.indexOf('"slug": ', start + 1);
  const end = nextRecord < 0 ? text.length : nextRecord;
  const body = text.slice(start, end).replace(PROFILE_BLOCK, '');
  if (!BIOLOAD_BLOCK.test(body)) throw new Error(`${record.slug}: no bioload block`);
  const json = JSON.stringify(profileFor(record), null, 2).replace(/\n/g, '\n    ');
  const replaced = body.replace(BIOLOAD_BLOCK, (block) => `${block}\n    "bioload_profile": ${json},`);
  text = text.slice(0, start) + replaced + text.slice(end);
  cursor = start + replaced.length;
}

JSON.parse(text);
writeFileSync(FILE, text);
console.log(`bioload_profile written for ${records.length} records`);
