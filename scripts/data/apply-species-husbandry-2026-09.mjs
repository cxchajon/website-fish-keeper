// One-off data migration (Phase 2A, 2026-09): fills the species-specific husbandry fields the
// Stocking Advisor engine needs for the 24 species.v2.json records that had no legacy record.
// Values were cross-checked against several care references (see `husbandry_review.sources`);
// where references disagreed the more conservative (welfare-first) figure was used and the
// disagreement recorded in `husbandry_review.notes`. Re-running is idempotent.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../../data/stocking-advisor/species.v2.json', import.meta.url));
const REVIEWED = '2026-09-26';

// size = upper end of the normal adult range (inches); liters / lengthIn = single-species minimum.
const UPDATES = {
  'assassin-snail': {
    scientific_name: 'Anentome helena', category: 'snail', adult_size_in: 1.2, min_tank_liters: 38,
    min_tank_length_in: null, tank_length_not_applicable: true, addTags: ['snail_risk'],
    sources: ['Aquarium Co-Op care guide', 'The Shrimp Farm care guide', 'Shrimp and Snail Breeder (aquariumbreeder.com)', 'Wikipedia: Anentome helena'],
    notes: 'Minimum volume: 5 gal cited as absolute minimum, 10 gal as a stable starting point; 10 gal (38 L) used. Eats snails its size or smaller and can overpower larger snails; generally safe with healthy adult shrimp (risk to moulting shrimp/shrimplets). Crawling invertebrate: no swimming-length requirement.',
  },
  'bamboo-shrimp': {
    scientific_name: 'Atyopsis moluccensis', category: 'shrimp', adult_size_in: 3.0, min_tank_liters: 76, min_tank_length_in: 24,
    sources: ['The Shrimp Farm care guide', 'Aquarium Tidings care guide', 'Shrimp and Snail Breeder (aquariumbreeder.com)', 'ShrimpKeepers species profile'],
    notes: 'Adult size 2–3 in (some report 3.5 in). Minimum 20 US gal (76 L); one source gives 20 imperial gal (90 L). Long tank preferred for the sustained current it filter-feeds from; 24 in = 20 gal footprint.',
  },
  'blue-ram': {
    scientific_name: 'Mikrogeophagus ramirezi', adult_size_in: 3.0, min_tank_liters: 75, min_tank_length_in: 24, addTags: ['territorial'],
    sources: ['Aquarium Co-Op ram care guide', 'Tropical Fish Hobbyist Magazine', 'FishLore profile', 'Cichlid Room Companion'],
    notes: 'Minimum volume 60 L/60 cm (one source) vs 20 gal/75 L (others); 75 L used. Males are territorial, especially when spawning. Needs 80–86 °F, which v2 already reflects.',
  },
  'bolivian-ram': {
    scientific_name: 'Mikrogeophagus altispinosus', adult_size_in: 3.2, min_tank_liters: 110, min_tank_length_in: 32,
    sources: ['Seriously Fish species profile', 'AquaInfo profile', 'Aquatic Arts profile', 'Wikipedia: Mikrogeophagus altispinosus'],
    notes: 'Previous v2 minimum was 75 L. References give 80 cm (~30 gal) for a pair and 120 cm for a group; 80 cm / ~110 L used.',
  },
  'bristlenose-pleco': {
    scientific_name: 'Ancistrus sp. (usually traded as A. cf. cirrhosus)', adult_size_in: 5.0, min_tank_liters: 100, min_tank_length_in: 24, addTags: ['territorial'],
    sources: ['PlanetCatfish forum/profile', 'Aquascapedia profile', 'Aqua-Fish.net profile', 'Wikipedia: Ancistrus'],
    notes: 'Adult size 4–6 in (13 cm typical maximum). Minimum volume cited from 45 L to 113 L; 75 L/60 cm is the most common minimum and v2 notes already recommended 100 L — 100 L used. Males defend caves/territory from other males.',
  },
  'celestial-pearl-danio': {
    scientific_name: 'Danio margaritatus', adult_size_in: 1.2, min_tank_liters: 54, min_tank_length_in: 24,
    sources: ['Tetra Fishkeeper blog', 'Aquadiction species profile', 'KJE Aquatics', 'Glassbox Diaries care guide'],
    notes: 'Minimum volume 40 L (10 gal) vs 54 L; 54 L used. Length taken from the standard 54 L (60 cm) footprint because no reference gives a separate length. Group of 6 minimum, 10+ recommended.',
  },
  'cockatoo-cichlid': {
    scientific_name: 'Apistogramma cacatuoides', adult_size_in: 3.5, min_tank_liters: 76, min_tank_length_in: 24, addTags: ['territorial'],
    sources: ['Aquarium Co-Op Apistogramma guide', 'FishLore profile', 'Wikipedia: Apistogramma cacatuoides', 'Guidarium profile'],
    notes: 'Males to 8–9 cm, females smaller. Minimum 60 L/60 cm (one source) vs 20 gal (76 L) per pair; 76 L used. Males territorial; best as harem.',
  },
  'ember-tetra': {
    scientific_name: 'Hyphessobrycon amandae', adult_size_in: 1.2, min_tank_liters: 45, min_tank_length_in: 20,
    sources: ['Aquarium Co-Op care guide', 'FishLore profile', 'Green Aqua profile', 'Wikipedia: Ember tetra'],
    notes: 'Minimum 38–45 L; 45 L used. No reference gives a separate length; 20 in = standard 10 gal footprint.',
  },
  'freshwater-angelfish': {
    scientific_name: 'Pterophyllum scalare', adult_size_in: 6.0, min_tank_liters: 150, min_tank_length_in: 40, addTags: ['cichlid', 'territorial', 'longfin_target'],
    sources: ['Seriously Fish species profile', 'AquaInfo profile', 'Tropical Fish Hobbyist Magazine', 'Aquarium Co-Op care guide', 'Tetra Fishkeeper blog'],
    notes: 'Body length 12–15 cm, height with fins ~20–25 cm. Minimum footprint 100 × 40 × 50 cm (Seriously Fish) up to 150 cm for groups (AquaInfo); single adult 30 gal minimum, pairs/groups 55–75 gal. 150 L and 100 cm (40 in) used; tanks should also be at least 50 cm (20 in) tall — height is not checked by the engine. Long fins are a target for fin-nippers (e.g. tiger barbs). Eats small fish such as neon tetras as it matures.',
  },
  'ghost-shrimp': {
    scientific_name: 'Palaemonetes paludosus (syn. Palaemon paludosus)', category: 'shrimp', adult_size_in: 1.6, min_tank_liters: 19, min_tank_length_in: 12,
    sources: ['FishLore profile', 'Shrimp and Snail Breeder (aquariumbreeder.com)', 'Guidarium profile', 'Wikipedia: Palaemon paludosus'],
    notes: 'Adult ~1.5 in (4 cm max). Minimum 19 L with at least 30 cm length. Adults eat larvae and small shrimplets of other shrimp.',
  },
  'glass-catfish': {
    scientific_name: 'Kryptopterus vitreolus', adult_size_in: 3.2, min_tank_liters: 114, min_tank_length_in: 36,
    sources: ['Seriously Fish species profile', 'FishLore profile', 'Fishkeeping World care sheet', 'Wikipedia: Kryptopterus vitreolus'],
    notes: 'Adults 6.5–8 cm SL (8–10 cm TL reported). Minimum cited as 75 L (20 gal) by some, 30 gal (114 L) by most; 114 L used, 36 in = standard 30 gal footprint. Must be kept in a group of 6+.',
  },
  'hillstream-loach': {
    scientific_name: 'Sewellia lineolata', adult_size_in: 2.8, min_tank_liters: 100, min_tank_length_in: 32,
    sources: ['Aquarium Co-Op hillstream loach guide', 'Aquatic Arts care guide', 'LiveAquaria profile', 'AquariumLesson profile'],
    notes: 'Minimum volume cited as 20 gal, 26 gal (100 L)/80 cm, and 30 gal; 100 L / 80 cm used. Cool (64–75 °F), fast, well-oxygenated water.',
  },
  'honey-gourami': {
    scientific_name: 'Trichogaster chuna', adult_size_in: 2.0, min_tank_liters: 54, min_tank_length_in: 24,
    sources: ['Seriously Fish species profile', 'Tetra Fishkeeper blog', 'Tropical Fish Hobbyist Magazine', 'Aquarium Co-Op care guide'],
    notes: 'Usually 1.5–2 in (rarely 2.75 in). Minimum 40–54 L for a pair; 54 L used with a 60 × 30 cm footprint.',
  },
  'keyhole-cichlid': {
    scientific_name: 'Cleithracara maronii', adult_size_in: 4.7, min_tank_liters: 115, min_tank_length_in: 36,
    sources: ['Seriously Fish species profile', 'Fishkeeper UK profile', 'Aqua-Fish.net profile', 'River Park Aquatics'],
    notes: 'Adults 10–12 cm (some sources 15 cm). Minimum base 90 × 30 cm; one source recommends 75 gal. v2 115 L retained with 90 cm (36 in) length.',
  },
  'kribensis': {
    scientific_name: 'Pelvicachromis pulcher', adult_size_in: 4.0, min_tank_liters: 120, min_tank_length_in: 32, addTags: ['territorial'],
    sources: ['Seriously Fish species profile', 'AquaInfo profile', 'The Aquarium Adviser', 'AquariumLesson profile'],
    notes: 'Males ~10 cm, females 6–7 cm. Minimum cited as 60–75 L for a pair up to 120 L / 80 cm; 120 L / 80 cm used because pairs become very territorial when breeding.',
  },
  'molly': {
    scientific_name: 'Poecilia sphenops (trade mollies are often hybrids with P. latipinna / P. velifera)', adult_size_in: 4.0, min_tank_liters: 75, min_tank_length_in: 36, schoolingMinimum: 3, addTags: ['livebearer'],
    sources: ['Seriously Fish species profile', 'FishLore profile', 'Aquariadise care sheet', 'Aquendium care guide'],
    notes: 'Adults 6–10 cm. Minimum 75 L (20 gal), 20–30 gal for groups; one source requires 90 cm length — 36 in used. Needs hard, alkaline water (GH 10–30, pH 7.5–8.4). Keep at least 1 male : 2 females.',
  },
  'mystery-snail': {
    scientific_name: 'Pomacea diffusa', category: 'snail', adult_size_in: 2.0, min_tank_liters: 38,
    min_tank_length_in: null, tank_length_not_applicable: true,
    sources: ['Aquarium Co-Op care guide', 'The Shrimp Farm care guide', 'Fishkeeping World profile', 'Tropical Fish Keeping'],
    notes: 'Shell 4–5 cm wide, 4.5–6.5 cm tall. Minimum cited as 5 gal for one or two, 10 gal for the first snail more commonly; 10 gal (38 L) used. Crawling invertebrate: no swimming-length requirement.',
  },
  'pea-puffer': {
    scientific_name: 'Carinotetraodon travancoricus', adult_size_in: 1.4, min_tank_liters: 19, min_tank_length_in: 12, addTags: ['territorial', 'fin_nipper', 'snail_risk'],
    sources: ['Seriously Fish species profile', 'Aquarium Co-Op care guide', 'FishLore (aquarium magazine)', 'Puffer Fish Enthusiasts Worldwide'],
    notes: 'Max 3.5 cm TL, usually ~2.5 cm. Single fish: 30 × 20 × 20 cm (12.6 L) minimum up to 5 gal per puffer; 5 gal (19 L) used for one. Groups of 6 need 15–20 gal — the engine checks a single-species minimum only. Territorial, nips fins, eats snails and shrimp.',
  },
  'platy': {
    scientific_name: 'Xiphophorus maculatus', adult_size_in: 2.8, min_tank_liters: 54, min_tank_length_in: 24, schoolingMinimum: 3, addTags: ['livebearer'],
    sources: ['Seriously Fish species profile', 'Wikipedia: Platy (fish)', 'AquariumLife profile', 'Aquatic Arts profile'],
    notes: 'Adults 5–7 cm. Minimum cited as 10 gal for a trio, 54 L, and (one source) 20 gal; 54 L / 60 cm used — the 20 gal figure was not corroborated. Keep at least a trio with more females than males.',
  },
  'pygmy-corydoras': {
    scientific_name: 'Corydoras pygmaeus', adult_size_in: 1.2, min_tank_liters: 38, min_tank_length_in: 18,
    sources: ['Aquarium Co-Op care guide', 'Aquariadise care sheet', 'Fishkeeping World profile', 'Guidarium profile'],
    notes: 'Adults 2–3 cm (some sources to 4 cm). Minimum 38 L with 45 cm length (previous v2 value 20 L was below every reference). Group of 6–8+.',
  },
  'ramshorn-snail': {
    scientific_name: 'Planorbella duryi (other Planorbidae are also sold as ramshorns)', category: 'snail', adult_size_in: 1.0, min_tank_liters: 19,
    min_tank_length_in: null, tank_length_not_applicable: true,
    sources: ['The Shrimp Farm care guide', 'Garnelio profiles', 'Aquarium Source care guide', 'Wikipedia: Planorbella duryi'],
    notes: 'P. duryi shell ~2–2.5 cm; the larger Planorbarius corneus reaches 4 cm. Minimum 5 gal (19 L) — previous v2 value 5 L was below every reference. Crawling invertebrate: no swimming-length requirement.',
  },
  'swordtail': {
    scientific_name: 'Xiphophorus hellerii', adult_size_in: 5.0, min_tank_liters: 75, min_tank_length_in: 36, schoolingMinimum: 3, addTags: ['livebearer'],
    sources: ['Fishkeeper UK profile', 'Aquatic Arts profile', 'EasyClean Aquatics encyclopedia', 'Aqulator care guide'],
    notes: 'Females 12–13 cm; males ~10 cm plus sword. Minimum 75 L and a 3 ft (90 cm) tank length for this fast, active swimmer. Keep at least a trio.',
  },
  'upside-down-catfish': {
    scientific_name: 'Synodontis nigriventris', adult_size_in: 4.0, min_tank_liters: 100, min_tank_length_in: 30,
    sources: ['Seriously Fish species profile', 'FishLore profile', 'Wikipedia: Synodontis nigriventris', 'Real Aquatics profile'],
    notes: 'Max 9.6 cm. Minimum 70 L (75 × 30 × 30 cm) for one; 100 L for the small group it should be kept in; 100 L / 75 cm used. Group of 3–5+.',
  },
  'white-cloud-mountain-minnow': {
    scientific_name: 'Tanichthys albonubes', adult_size_in: 2.0, min_tank_liters: 40, min_tank_length_in: 24,
    sources: ['FishBase summary', 'FishLore profile', 'Practical Fishkeeping', 'Aquadiction species profile'],
    notes: 'Up to 5 cm. Minimum 10 gal (38–40 L) with 60 cm length (FishBase). Cool water, thrives at 64–72 °F.',
  },
};

// Species whose v2 record already carried the legacy-classification tag in LEGACY_BASE only.
const ORIGINAL_TAG_FIXES = { 'guppy-male': ['livebearer'] };

// The JSON is hand-formatted, so edit it textually per record instead of re-serialising it.
let text = readFileSync(FILE, 'utf8');
const records = JSON.parse(text);
const seen = new Set();

function recordBounds(source, slug) {
  const marker = `"slug": "${slug}",`;
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`slug not found: ${slug}`);
  const start = source.lastIndexOf('\n  {', at);
  const next = source.indexOf('\n  {', at);
  return [start, next < 0 ? source.lastIndexOf('\n]') : next];
}

const fieldLines = (update) => {
  const review = {
    date: REVIEWED,
    sources: update.sources,
    notes: update.notes,
  };
  const lines = [
    ['scientific_name', update.scientific_name],
    ['category', update.category ?? 'fish'],
    ['adult_size_in', update.adult_size_in],
    ['min_tank_liters', update.min_tank_liters],
    ['min_tank_length_in', update.min_tank_length_in],
    ...(update.tank_length_not_applicable ? [['tank_length_not_applicable', true]] : []),
    // None of the 24 require tannins; several tolerate them. Reviewed value, not a default.
    ['blackwater', 'neutral'],
  ].map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  const reviewJson = JSON.stringify(review, null, 2).replace(/\n/g, '\n    ');
  lines.push(`    "husbandry_review": ${reviewJson},`);
  return lines.join('\n');
};

for (const record of records) {
  const update = UPDATES[record.slug];
  const extraTags = [...(update?.addTags ?? []), ...(ORIGINAL_TAG_FIXES[record.slug] ?? [])]
    .filter((tag) => !record.tags.includes(tag));
  if (!update && !extraTags.length) continue;
  const [from, to] = recordBounds(text, record.slug);
  let block = text.slice(from, to);
  if (extraTags.length) {
    block = block.replace(/("tags": \[)([\s\S]*?)(\n    \])/, (_, open, body, close) =>
      `${open}${body},\n${extraTags.map((tag) => `      ${JSON.stringify(tag)}`).join(',\n')}${close}`);
  }
  if (update) {
    seen.add(record.slug);
    if (!('husbandry_review' in record)) {
      // min_tank_liters moves up with the other reviewed fields; drop the old line.
      block = block.replace(/\n    "min_tank_liters": [\d.]+,/, '');
      block = block.replace(/(\n    "id": "[^"]+",)/, `$1\n${fieldLines(update)}`);
    }
    if (update.schoolingMinimum) {
      block = block.replace(/"schoolingMinimum": \d+/, `"schoolingMinimum": ${update.schoolingMinimum}`);
    }
  }
  text = text.slice(0, from) + block + text.slice(to);
}
const missing = Object.keys(UPDATES).filter((slug) => !seen.has(slug));
if (missing.length) throw new Error(`unknown slugs: ${missing.join(', ')}`);
JSON.parse(text); // must still be valid JSON
writeFileSync(FILE, text);
console.log(`updated ${seen.size} species`);
