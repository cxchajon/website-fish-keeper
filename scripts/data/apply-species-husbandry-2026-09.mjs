// Data migration for the 24 species.v2.json records that have no legacy (js/fish-data.js) record.
// Writes the reviewed husbandry fields and their provenance. Field meanings and the source-selection
// policy are defined in data/stocking-advisor/SPECIES_DATA_POLICY.md — read that before editing.
//
// Re-running is idempotent: fields written by earlier runs are removed and re-inserted.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../../data/stocking-advisor/species.v2.json', import.meta.url));
const REVIEWED = '2026-09-26';
const POLICY_VERSION = '2026-09-26';

// Verification methods (see policy): direct page access to most care references was blocked from the
// review environment, so values were read from search-engine extracts of the cited page.
const EXTRACT = 'search-extract';   // search result attributed the claim to this exact page
const SUMMARY = 'search-summary';   // claim appeared in a multi-source search summary listing this page;
                                    // exact page attribution not confirmed — corroboration only
const REVIEWER = 'reviewer-reported';

const src = (tier, title, url, fields, claim, verification = EXTRACT) => ({
  title, url, tier, reviewed: REVIEWED, verification, fields, claim,
});

const SF = (slug) => `https://www.seriouslyfish.com/species/${slug}`;

// Per species. `tank` holds the canonical tank-size selection; `sources` every source consulted.
const SPECIES = {
  'assassin-snail': {
    scientific_name: 'Anentome helena', category: 'snail',
    adult_size_in: 1.0, adult_size_basis: 'shell_length',
    min_tank_liters: 19, min_tank_basis: 'pair', min_tank_length_in: null, min_tank_length_basis: 'not_applicable',
    canonical_tank_source: 'The Shrimp Farm — Assassin Snail care',
    addTags: ['snail_risk'],
    sources: [
      src(3, 'The Shrimp Farm — Assassin Snail (Clea helena) Care', 'https://www.theshrimpfarm.com/posts/assassin-snail-care/', ['min_tank_liters', 'adult_size_in', 'snail_risk'], '5 gallons or up is fine for one or two assassin snails; they eat other snails; reach about 1 in.', SUMMARY),
      src(2, 'Aquarium Co-Op — Care Guide for Assassin Snails', 'https://www.aquariumcoop.com/blogs/aquarium/assassin-snail', ['snail_risk'], 'Snail-eating snail used to control pest snails; shrimp safety debated (risk to shrimplets/moulting shrimp).', SUMMARY),
    ],
    disagreements: 'Minimum volume: 5 gal (one or two) vs 10 gal “comfortable starting point” in other guides; 5 gal selected per policy (tier-3 specialist retained over general guides).',
    notes: 'Crawling invertebrate: no swimming-length requirement.',
  },
  'bamboo-shrimp': {
    scientific_name: 'Atyopsis moluccensis', category: 'shrimp',
    adult_size_in: 3.0, adult_size_basis: 'body_length',
    min_tank_liters: 76, min_tank_basis: 'group', min_tank_length_in: 24, min_tank_length_basis: 'inferred_standard_tank',
    canonical_tank_source: 'The Shrimp Farm — Bamboo Shrimp care',
    sources: [
      src(3, 'The Shrimp Farm — Bamboo Shrimp Care 101', 'https://www.theshrimpfarm.com/posts/bamboo-shrimp-care/', ['min_tank_liters', 'adult_size_in', 'flow'], 'At least around 20 gallons to keep a group; heavy water flow needed for filter feeding; 2–3 in.'),
    ],
    disagreements: 'Some guides cite 20 imperial gal (90 L); not selected (lower tier).',
    notes: 'No source gives base dimensions; length is the 24 in footprint of a standard 20 US gal tank (flagged as inferred).',
  },
  'blue-ram': {
    scientific_name: 'Mikrogeophagus ramirezi', category: 'fish',
    adult_size_in: 3.0, adult_size_basis: 'total_length',
    min_tank_liters: 54, min_tank_basis: 'pair', min_tank_length_in: 24, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Mikrogeophagus ramirezi',
    addTags: ['territorial'],
    sources: [
      src(1, 'Seriously Fish — Mikrogeophagus ramirezi (Ram)', SF('mikrogeophagus-ramirezi/'), ['min_tank_liters', 'min_tank_length_in'], 'A base of 60 × 30 cm or equivalent is sufficient for a single pair (54 L).'),
      src(2, 'Aquarium Co-Op — Care Guide for German Blue Rams', 'https://www.aquariumcoop.com/blogs/aquarium/ram-cichlid-care-guide', ['adult_size_in', 'temperature'], '2–3 in; 80–86 °F.', SUMMARY),
    ],
    disagreements: 'Other guides give 20 gal (75 L); Seriously Fish (tier 1) selected.',
  },
  'bolivian-ram': {
    scientific_name: 'Mikrogeophagus altispinosus', category: 'fish',
    adult_size_in: 3.2, adult_size_basis: 'maximum_length_unspecified',
    min_tank_liters: 182, min_tank_basis: 'pair', min_tank_length_in: 36, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Mikrogeophagus altispinosus',
    sources: [
      src(1, 'Seriously Fish — Mikrogeophagus altispinosus (Bolivian Ram)', SF('mikrogeophagus-altispinosus'), ['min_tank_liters', 'min_tank_length_in', 'adult_size_in', 'group'], 'Base of at least 90 × 45 cm for an individual or a pair (182 L); a mixed group of 6–8 only in 120 cm+ tanks; max ~8 cm.'),
    ],
    disagreements: 'Other references give 80 cm / ~110 L for a pair; Seriously Fish (tier 1) selected. Reviewer also reported 182 L / 36 × 18 in.',
  },
  'bristlenose-pleco': {
    scientific_name: 'Ancistrus sp. (usually traded as A. cf. cirrhosus)', category: 'fish',
    adult_size_in: 5.0, adult_size_basis: 'total_length',
    min_tank_liters: 54, min_tank_basis: 'pair', min_tank_length_in: 24, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Ancistrus sp. 3',
    addTags: ['territorial'],
    sources: [
      src(1, "Seriously Fish — Ancistrus sp. '3' (Common Bristlenose)", SF('ancistrus-cf-cirrhosus/'), ['min_tank_liters', 'min_tank_length_in'], 'A base of 60 × 30 cm or equivalent houses a single specimen or breeding pair; larger for a group.'),
      src(4, 'PlanetCatfish forum — Bristlenose aquarium size discussion', 'https://planetcatfish.com/forum/viewtopic.php?t=49047', ['adult_size_in'], 'Adults to about 13 cm.', SUMMARY),
    ],
    disagreements: 'General guides range 45–113 L and the original v2 note said 100 L; Seriously Fish (tier 1) selected. Males defend territory from each other.',
  },
  'celestial-pearl-danio': {
    scientific_name: 'Danio margaritatus (syn. Celestichthys margaritatus)', category: 'fish',
    adult_size_in: 0.8, adult_size_basis: 'standard_length',
    min_tank_liters: 41, min_tank_basis: 'group', min_tank_length_in: 18, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Celestichthys margaritatus',
    sources: [
      src(1, "Seriously Fish — Celestichthys margaritatus (Celestial Pearl 'Danio')", SF('celestichthys-margaritatus'), ['min_tank_liters', 'min_tank_length_in', 'adult_size_in'], 'Read directly by the production review: 21 mm (0.8 in) SL; aquarium base 45 × 30 cm (18 × 12 in), ~41 L (11 US gal); a group should not be kept in a smaller footprint because dominant males can be combative.', REVIEWER),
      src(1, 'Seriously Fish — Celestichthys erythromicron', SF('celestichthys-erythromicron'), [], 'Different species: its profile gives 60 × 30 cm (~54 L). Recorded only to document the earlier mix-up.', REVIEWER),
      src(2, 'Tetra Fishkeeper blog — Celestial pearl danio', 'https://blog.tetra.net/en-en/celestial-pearl-danio-danio-margaritatus/', ['group'], 'Keep in groups of at least 6.', SUMMARY),
    ],
    notes: 'Corrected 2026-09: the former 54 L / 24 in value came from search extracts that had conflated this page with the C. erythromicron profile (60 × 30 cm, ~54 L). A direct read of both profiles distinguished them; the C. margaritatus figures (45 × 30 cm, ~41 L, 21 mm SL) are now used.',
  },
  'cockatoo-cichlid': {
    scientific_name: 'Apistogramma cacatuoides', category: 'fish',
    adult_size_in: 3.5, adult_size_basis: 'total_length',
    min_tank_liters: 54, min_tank_basis: 'pair', min_tank_length_in: 24, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Apistogramma cacatuoides',
    addTags: ['territorial'],
    sources: [
      src(1, 'Seriously Fish — Apistogramma cacatuoides (Cockatoo Cichlid)', SF('apistogramma-cacatuoides'), ['min_tank_liters', 'min_tank_length_in'], 'Base of 60 × 30 cm or more acceptable for a single pair; a group needs more space.'),
      src(2, 'Aquarium Co-Op — Apistogramma dwarf cichlid care guide', 'https://www.aquariumcoop.com/blogs/aquarium/apistogramma-dwarf-cichlid', ['adult_size_in'], 'Males to about 3–3.5 in.', SUMMARY),
    ],
    disagreements: 'Some guides give 20 gal (76 L) per pair; Seriously Fish (tier 1) selected.',
  },
  'ember-tetra': {
    scientific_name: 'Hyphessobrycon amandae', category: 'fish',
    adult_size_in: 1.2, adult_size_basis: 'total_length',
    min_tank_liters: 41, min_tank_basis: 'group', min_tank_length_in: 18, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Hyphessobrycon amandae',
    sources: [
      src(1, 'Seriously Fish — Hyphessobrycon amandae (Ember Tetra)', SF('hyphessobrycon-amandae'), ['min_tank_liters', 'min_tank_length_in'], 'Base dimensions of at least 45 × 30 cm or equivalent (41 L by the site’s L × W × W convention).'),
      src(2, 'Aquarium Co-Op — Care Guide for Ember Tetras', 'https://www.aquariumcoop.com/blogs/aquarium/ember-tetra', ['adult_size_in', 'group'], 'Nano schooling fish under ~0.8–1.2 in; keep a group of at least 6.', SUMMARY),
    ],
  },
  'freshwater-angelfish': {
    scientific_name: 'Pterophyllum scalare', category: 'fish',
    adult_size_in: 6.0, adult_size_basis: 'standard_length',
    min_tank_liters: 200, min_tank_basis: 'unspecified', min_tank_length_in: 39, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Pterophyllum scalare',
    addTags: ['cichlid', 'territorial', 'longfin_target'],
    sources: [
      src(1, 'Seriously Fish — Pterophyllum “scalare” (Angelfish)', SF('pterophyllum-scalare'), ['min_tank_liters', 'min_tank_length_in', 'adult_size_in'], 'An aquarium measuring 100 × 40 × 50 cm (39 × 16 in base, ~200 L) should be the smallest considered; max 150 mm SL.'),
      src(2, 'Aquarium Co-Op — Care Guide for Freshwater Angelfish', 'https://www.aquariumcoop.com/blogs/aquarium/angelfish-care-guide', ['min_tank_liters'], 'In a 29-gallon community tank keep no more than four adult angelfish.'),
      src(2, 'AquaInfo — Pterophyllum scalare', 'https://aquainfo.nl/en/article/pterophyllum-scalare-angelfish/', ['min_tank_length_in'], 'Groups need ~150 cm length and 50–60 cm height.', SUMMARY),
    ],
    disagreements: 'Genuine conflict: Seriously Fish (≈200 L, 100 cm) vs Aquarium Co-Op (up to four adults in 29 gal ≈ 110 L, 30 in). Seriously Fish selected per policy (tier 1, explicit dimensions); the Co-Op figure is retained here. Tanks should also be ≥50 cm tall — height is not checked by the engine.',
  },
  'ghost-shrimp': {
    scientific_name: 'Palaemonetes paludosus (syn. Palaemon paludosus)', category: 'shrimp',
    adult_size_in: 1.6, adult_size_basis: 'body_length',
    min_tank_liters: 38, min_tank_basis: 'unspecified', min_tank_length_in: 11.8, min_tank_length_basis: 'source',
    canonical_tank_source: 'Aqueon — Freshwater Shrimp Care Guide (volume); Guidarium (length, tier 4)',
    sources: [
      src(2, 'Aqueon — Freshwater Shrimp Care Guide', 'https://www.aqueon.com/resources/care-guides/shrimp-freshwater', ['min_tank_liters'], 'Names basic ghost shrimp (Palaemonetes paludosus); larger species such as ghost, Amano and bamboo shrimp can be kept in aquariums of 10 to 55 gallons.'),
      src(4, 'FishLore — Ghost Shrimp Care', 'https://www.fishlore.com/profile-ghostshrimp.htm', ['min_tank_liters'], 'Minimum aquarium size 5 gallons; about three per gallon.', SUMMARY),
      src(4, 'Guidarium — Ghost Shrimp', 'https://guidarium.com/fishes/ghost-shrimp', ['min_tank_length_in', 'adult_size_in'], 'Minimum 19 L with a tank length of at least 30 cm; about 4 cm.', SUMMARY),
      src(3, 'The Shrimp Farm — Ghost Shrimp (Palaemon) Care', 'https://www.theshrimpfarm.com/posts/shrimp-caresheet-ghost-shrimp-palaemonetes-sp/', ['shrimp_risk'], 'Adults eat larvae and small shrimplets.', SUMMARY),
    ],
    disagreements: 'Volume: Aqueon (tier 2, 10–55 gal range → 10 gal minimum) replaces FishLore’s 5 gal (tier 4).',
    notes: 'LIMITATION: the tank length and adult size still rest on a tier-4 source (Guidarium); no stronger source gives a footprint, and no source gives a social minimum, so none is set.',
    open_question: true,
  },
  'glass-catfish': {
    scientific_name: 'Kryptopterus vitreolus', category: 'fish',
    adult_size_in: 3.2, adult_size_basis: 'standard_length',
    min_tank_liters: 81, min_tank_basis: 'group', min_tank_length_in: 36, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Kryptopterus vitreolus',
    sources: [
      src(1, 'Seriously Fish — Kryptopterus vitreolus (Glass Catfish)', SF('kryptopterus-vitreolus/'), ['min_tank_liters', 'min_tank_length_in', 'group'], 'Base of 90 × 30 cm or equivalent should be the smallest considered (81 L); a group of 6+ is the minimum.'),
      src(4, 'Wikipedia — Kryptopterus vitreolus', 'https://en.wikipedia.org/wiki/Kryptopterus_vitreolus', ['adult_size_in'], 'Up to ~8 cm SL, usually ~6.5 cm.', SUMMARY),
    ],
    disagreements: 'Other guides give 20–30 gal; Seriously Fish (tier 1) selected. Reviewer also reported 81 L / 36 × 12 in.',
  },
  'hillstream-loach': {
    scientific_name: 'Sewellia lineolata', category: 'fish',
    adult_size_in: 2.8, adult_size_basis: 'total_length',
    min_tank_liters: 68, min_tank_basis: 'unspecified', min_tank_length_in: 29.5, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Sewellia lineolata',
    sources: [
      src(1, 'Seriously Fish — Sewellia lineolata (Tiger Hillstream Loach)', SF('sewellia-lineolata'), ['min_tank_liters', 'min_tank_length_in', 'flow'], 'Minimum base dimensions of 75 × 30 cm (68 L by the site’s convention); strong, well-oxygenated flow.'),
      src(2, 'Aquarium Co-Op — Hillstream loach care guide', 'https://www.aquariumcoop.com/blogs/aquarium/hillstream-loaches', ['adult_size_in', 'temperature'], 'Up to ~2–3 in; cooler water.', SUMMARY),
    ],
    disagreements: 'General guides give 20–30 gal / 80 cm; Seriously Fish (tier 1) selected.',
  },
  'honey-gourami': {
    scientific_name: 'Trichogaster chuna', category: 'fish',
    adult_size_in: 2.2, adult_size_basis: 'standard_length',
    min_tank_liters: 54, min_tank_basis: 'pair_or_small_group', min_tank_length_in: 24, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Trichogaster chuna',
    socialMinimum: 4,
    sources: [
      src(1, 'Seriously Fish — Trichogaster chuna (Honey Gourami)', SF('trichogaster-chuna'), ['min_tank_liters', 'min_tank_length_in', 'adult_size_in', 'social_minimum', 'blackwater'], 'Read directly by the production review: 55 mm (2.2 in) SL; base 60 × 30 cm (24 × 12 in), ~54 L (14 US gal), sufficient for a pair or small group; not a schooling fish but benefits from conspecifics — buy no fewer than 4–6; dried leaf litter recommended, tannins released during decomposition are thought beneficial.', REVIEWER),
      src(2, 'Aquarium Co-Op — Care Guide for Honey Gouramis', 'https://www.aquariumcoop.com/blogs/aquarium/honey-gourami', ['min_tank_liters'], 'A single honey gourami can live in a 5- or 10-gallon tank; a group of three does better in 20 gallons.'),
    ],
    disagreements: 'Aquarium Co-Op allows 5–10 gal for a single fish; Seriously Fish (tier 1) selected.',
    notes: 'Not a schooling species (schoolingMinimum stays 1). socialMinimum 4 = lowest figure of Seriously Fish’s “no fewer than 4–6” conspecific recommendation. Blackwater left unassessed: “tannins … thought beneficial” is weaker than the engine’s “prefers”, which warns whenever tannins are off.',
  },
  'keyhole-cichlid': {
    scientific_name: 'Cleithracara maronii', category: 'fish',
    adult_size_in: 4.7, adult_size_basis: 'total_length',
    min_tank_liters: 81, min_tank_basis: 'unspecified', min_tank_length_in: 36, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Cleithracara maronii',
    sources: [
      src(1, 'Seriously Fish — Cleithracara maronii (Keyhole Cichlid)', SF('cleithracara-maronii'), ['min_tank_liters', 'min_tank_length_in'], 'Base dimensions of 90 × 30 cm or equivalent should be the smallest considered (81 L).'),
      src(2, 'Fishkeeper UK — Keyhole Cichlid', 'https://www.fishkeeper.co.uk/fish/freshwater/cichlids/keyhole-cichlid', ['adult_size_in'], 'Adults 10–12 cm.', SUMMARY),
    ],
    disagreements: 'One general guide recommends 75 gal; not selected (lower tier).',
  },
  'kribensis': {
    scientific_name: 'Pelvicachromis pulcher', category: 'fish',
    adult_size_in: 4.0, adult_size_basis: 'total_length',
    min_tank_liters: 76, min_tank_basis: 'pair', min_tank_length_in: 31.5, min_tank_length_basis: 'source',
    canonical_tank_source: 'Aquarium Co-Op (volume) + AquaInfo (length); Seriously Fish lists no tank size',
    addTags: ['territorial'],
    sources: [
      src(1, 'Seriously Fish — Pelvicachromis pulcher (Kribensis)', SF('pelvicachromis-pulcher/'), [], 'Tank base listed as “not recorded”.'),
      src(2, 'Aquarium Co-Op — Top 10 cichlids for 29-gallon tanks', 'https://www.aquariumcoop.com/blogs/aquarium/top-10-cichlids', ['min_tank_liters'], 'A breeding pair in a 20-gallon tank, or a group of four to five in a 29-gallon.'),
      src(2, 'AquaInfo — Pelvicachromis pulcher', 'https://aquainfo.nl/en/article/pelvicachromis-pulcher-kribensis/', ['min_tank_length_in', 'adult_size_in'], 'Minimum aquarium length 80 cm because pairs become aggressive with young; males ~10 cm.'),
    ],
    disagreements: 'Same-tier sources disagree on footprint: Co-Op’s 20 gal pair tank (typically 24–30 in long) vs AquaInfo’s explicit 80 cm length. Per policy the explicit horizontal dimension (AquaInfo) sets length and the only explicit volume (Co-Op) sets volume.',
  },
  'molly': {
    scientific_name: 'Poecilia sphenops (trade mollies are often hybrids with P. latipinna / P. velifera)', category: 'fish',
    adult_size_in: 4.0, adult_size_basis: 'total_length',
    min_tank_liters: 81, min_tank_basis: 'unspecified', min_tank_length_in: 36, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Poecilia sphenops',
    schoolingMinimum: 1, addTags: ['livebearer'],
    sex_ratio_guidance: 'If both sexes are kept, at least 2–3 females per male.',
    sources: [
      src(1, 'Seriously Fish — Poecilia sphenops (Short-finned Molly)', SF('poecilia-sphenops'), ['min_tank_liters', 'min_tank_length_in', 'gH', 'pH'], 'Smallest recommended tank base 90 × 30 cm (81 L); hard, alkaline water.'),
      src(2, 'Aquarium Co-Op — Care Guide for Mollies', 'https://www.aquariumcoop.com/blogs/aquarium/molly-fish-care', ['sex_ratio_guidance'], 'Get at least two to three females for every male.'),
    ],
    disagreements: 'General guides give 20 gal (75 L); Seriously Fish (tier 1) selected. “1 male : 2–3 females” is sex-ratio guidance, not a schooling minimum.',
  },
  'mystery-snail': {
    scientific_name: 'Pomacea diffusa', category: 'snail',
    adult_size_in: 2.5, adult_size_basis: 'shell_diameter',
    min_tank_liters: 19, min_tank_basis: 'pair', min_tank_length_in: null, min_tank_length_basis: 'not_applicable',
    canonical_tank_source: 'Aquarium Co-Op — Mystery Snail care',
    sources: [
      src(2, 'Aquarium Co-Op — Care Guide for Mystery Snails', 'https://www.aquariumcoop.com/blogs/aquarium/mystery-snail', ['min_tank_liters'], 'One or two mystery snails can live in a 5-gallon aquarium or larger with a tight-fitting lid.', SUMMARY),
      src(3, 'The Shrimp Farm — Mystery Snail Aquarium Care 101', 'https://www.theshrimpfarm.com/posts/mystery-snail-care/', ['adult_size_in', 'min_tank_liters'], 'Up to golf-ball size (~2.5 in); rule of thumb 10 gal for the first snail plus 2 gal per additional snail.', SUMMARY),
    ],
    disagreements: '5 gal (Co-Op, tier 2) vs 10 gal (Shrimp Farm, tier 3); Co-Op selected per policy.',
    notes: 'Crawling invertebrate: no swimming-length requirement.',
  },
  'pea-puffer': {
    scientific_name: 'Carinotetraodon travancoricus', category: 'fish',
    adult_size_in: 1.0, adult_size_basis: 'total_length',
    min_tank_liters: 13, min_tank_basis: 'single', min_tank_length_in: 12, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Carinotetraodon travancoricus',
    addTags: ['territorial', 'fin_nipper', 'snail_risk'],
    sources: [
      src(1, 'Seriously Fish — Carinotetraodon travancoricus (Dwarf Puffer)', SF('carinotetraodon-travancoricus/'), ['min_tank_liters', 'min_tank_length_in', 'adult_size_in'], 'A single fish can be kept in a tank as small as 30 × 20 × 20 cm (12.6 L); groups need 2–3 gal per puffer; adult ~1 in.'),
      src(2, 'Aquarium Co-Op — Pea Puffer care guide', 'https://www.aquariumcoop.com/blogs/aquarium/pea-puffer', ['snail_risk', 'shrimp_risk', 'fin_nipper'], 'Eats snails; fin-nipping and territorial; best in a species tank.', SUMMARY),
    ],
    disagreements: 'General guides give 5 gal per puffer; Seriously Fish (tier 1) selected. The engine checks a single-species minimum only — group volume (2–3 gal per puffer) is not scaled.',
  },
  'platy': {
    scientific_name: 'Xiphophorus maculatus', category: 'fish',
    adult_size_in: 2.8, adult_size_basis: 'total_length',
    min_tank_liters: 54, min_tank_basis: 'unspecified', min_tank_length_in: 24, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Xiphophorus maculatus',
    schoolingMinimum: 1, addTags: ['livebearer'],
    sex_ratio_guidance: 'If both sexes are kept, at least 2 females per male.',
    sources: [
      src(1, 'Seriously Fish — Xiphophorus maculatus (Platy)', SF('xiphophorus-maculatus'), ['min_tank_liters', 'min_tank_length_in'], 'Base 60 × 30 cm (~54 L).'),
      src(2, 'Aquarium Co-Op — Care Guide for Platy Fish', 'https://www.aquariumcoop.com/blogs/aquarium/platy-care-guide', ['sex_ratio_guidance'], 'A group of three to six is a good starting point; keep at least two females per male.'),
    ],
    disagreements: '“Three to six” is a starting suggestion and 1 : 2 a sex ratio — neither is encoded as a schooling minimum.',
  },
  'pygmy-corydoras': {
    scientific_name: 'Corydoras pygmaeus', category: 'fish',
    adult_size_in: 1.2, adult_size_basis: 'total_length',
    min_tank_liters: 41, min_tank_basis: 'group', min_tank_length_in: 18, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Corydoras pygmaeus',
    schoolingMinimum: 6,
    sources: [
      src(1, 'Seriously Fish — Corydoras pygmaeus (Pygmy Cory)', SF('corydoras-pygmaeus/'), ['min_tank_liters', 'min_tank_length_in', 'group'], 'A large group can be kept in 45 × 30 × 30 cm (~41 L); buy at least 6, preferably 10+.'),
      src(2, 'Aquarium Co-Op — Care Guide for Pygmy Corydoras', 'https://www.aquariumcoop.com/blogs/aquarium/pygmy-corydoras', ['adult_size_in'], 'About 1 in.', SUMMARY),
    ],
    disagreements: 'Previous group minimum 8 came from the original v2 record; Seriously Fish states at least 6 (10+ preferred).',
  },
  'ramshorn-snail': {
    scientific_name: 'Planorbella duryi (other Planorbidae are also sold as ramshorns)', category: 'snail',
    adult_size_in: 1.0, adult_size_basis: 'shell_diameter',
    min_tank_liters: 19, min_tank_basis: 'group', min_tank_length_in: null, min_tank_length_basis: 'not_applicable',
    canonical_tank_source: 'The Shrimp Farm — Ramshorn Snail care',
    sources: [
      src(3, 'The Shrimp Farm — Ramshorn Snail Care Guide', 'https://www.theshrimpfarm.com/posts/ramshorn-snail-care/', ['min_tank_liters'], 'A few can live in 2.5 gal; at least 5 gal recommended.'),
      src(4, 'Wikipedia — Planorbella duryi', 'https://en.wikipedia.org/wiki/Planorbella_duryi', ['adult_size_in'], 'Shell about 2–2.5 cm.', SUMMARY),
    ],
    notes: 'Crawling invertebrate: no swimming-length requirement.',
  },
  'swordtail': {
    scientific_name: 'Xiphophorus hellerii', category: 'fish',
    adult_size_in: 6.3, adult_size_basis: 'total_length',
    min_tank_liters: 108, min_tank_basis: 'unspecified', min_tank_length_in: 48, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Xiphophorus hellerii',
    schoolingMinimum: 1, addTags: ['livebearer'],
    sex_ratio_guidance: 'If both sexes are kept, more females than males.',
    sources: [
      src(1, 'Seriously Fish — Xiphophorus hellerii (Green Swordtail)', SF('xiphophorus-hellerii/'), ['min_tank_liters', 'min_tank_length_in', 'adult_size_in'], 'Surface dimensions of 120 × 30 cm (48 × 12 in) or equivalent should be the smallest considered (108 L); males to 14 cm, females to 16 cm TL.'),
      src(2, 'Fishkeeper UK — Swordtail', 'https://www.fishkeeper.co.uk/fish/freshwater/livebearers/swordtail', ['min_tank_length_in'], 'Minimum 3 ft (90 cm) tank length.', SUMMARY),
    ],
    disagreements: 'General guides give 75 L / 90 cm; Seriously Fish (tier 1) selected. Reviewer also reported 108 L / 48 × 12 in.',
  },
  'upside-down-catfish': {
    scientific_name: 'Synodontis nigriventris', category: 'fish',
    adult_size_in: 3.9, adult_size_basis: 'standard_length',
    min_tank_liters: 70, min_tank_basis: 'single', min_tank_length_in: 30, min_tank_length_basis: 'source',
    canonical_tank_source: 'Seriously Fish — Synodontis nigriventris',
    schoolingMinimum: 1, socialMinimum: 4,
    sources: [
      src(1, 'Seriously Fish — Synodontis nigriventris (Upside-down Catfish)', SF('synodontis-nigriventris'), ['min_tank_liters', 'min_tank_length_in', 'adult_size_in', 'social_minimum'], 'Read directly by the production review: ~100 mm (3.9 in) SL; 30 × 12 × 12 in (75 × 30 × 30 cm), ~70 L for one specimen; should really be kept in a group — groups of at least 3–4 recommended.', REVIEWER),
      src(2, 'FishBase — Synodontis nigriventris', 'https://www.fishbase.se/summary/Synodontis-nigriventris.html', ['min_tank_length_in', 'social_minimum', 'adult_size_in'], 'Max 9.6 cm TL; keep in groups of 5 or more; minimum aquarium size 80 cm.', REVIEWER),
    ],
    disagreements: 'Seriously Fish (tier 1): 75 cm / 70 L for one fish, groups of at least 3–4. FishBase (tier 2): 80 cm minimum, groups of 5+. Per policy tier 1 sets each field: length 30 in, volume 70 L, social minimum 4 (upper figure of the source’s own “3–4”). FishBase values retained here, not averaged.',
    notes: 'MODELLING GAP: the only sourced volume is for a single specimen, while the species should be kept in a group; no source gives a group volume, so none is invented. The engine checks this single-specimen minimum; group size is covered by socialMinimum.',
  },
  'white-cloud-mountain-minnow': {
    scientific_name: 'Tanichthys albonubes', category: 'fish',
    adult_size_in: 2.0, adult_size_basis: 'total_length',
    min_tank_liters: 38, min_tank_basis: 'group', min_tank_length_in: 23.6, min_tank_length_basis: 'source',
    canonical_tank_source: 'Aquarium Co-Op (volume) + FishBase (length); Seriously Fish value not retrievable',
    sources: [
      src(2, 'Aquarium Co-Op — Care Guide for White Cloud Mountain Minnows', 'https://www.aquariumcoop.com/blogs/aquarium/white-cloud-mountain-minnow-care', ['min_tank_liters', 'group'], 'Keep a group of at least six in a 10-gallon tank or larger.', SUMMARY),
      src(2, 'FishBase — Tanichthys albonubes', 'https://www.fishbase.org/summary/4758', ['min_tank_length_in'], 'Minimum aquarium size 60 cm.'),
      src(4, 'FishLore — White Cloud Mountain Minnow', 'https://www.fishlore.com/Profiles-WhiteClouds.htm', ['adult_size_in', 'temperature'], 'Up to 2 in; cool water 64–72 °F.', SUMMARY),
    ],
  },
};

// Livebearer tag belongs on the male guppy's v2 record too (it was only in LEGACY_BASE).
const ORIGINAL_TAG_FIXES = { 'guppy-male': ['livebearer'] };

const REVIEWED_KEYS = [
  'scientific_name', 'category', 'adult_size_in', 'adult_size_basis', 'min_tank_liters', 'min_tank_basis',
  'min_tank_length_in', 'min_tank_length_basis', 'tank_length_not_applicable', 'blackwater', 'sex_ratio_guidance',
];

function recordBounds(source, slug) {
  const at = source.indexOf(`"slug": "${slug}",`);
  if (at < 0) throw new Error(`slug not found: ${slug}`);
  const start = source.lastIndexOf('\n  {', at);
  const next = source.indexOf('\n  {', at);
  return [start, next < 0 ? source.lastIndexOf('\n]') : next];
}

function stripReviewed(block) {
  let out = block;
  for (const key of REVIEWED_KEYS) {
    out = out.replace(new RegExp(`\\n    "${key}": [^\\n]*,(?=\\n)`, 'g'), '');
  }
  // Remove a previous husbandry_review object (4-space indented key, closing "    },").
  out = out.replace(/\n {4}"husbandry_review": \{[\s\S]*?\n {4}\},(?=\n)/, '');
  return out;
}

function fieldBlock(spec) {
  const fields = {
    scientific_name: spec.scientific_name,
    category: spec.category,
    adult_size_in: spec.adult_size_in,
    adult_size_basis: spec.adult_size_basis,
    min_tank_liters: spec.min_tank_liters,
    min_tank_basis: spec.min_tank_basis,
    min_tank_length_in: spec.min_tank_length_in,
    min_tank_length_basis: spec.min_tank_length_basis,
  };
  if (spec.min_tank_length_basis === 'not_applicable') fields.tank_length_not_applicable = true;
  // Not assessed: none of the cited sources makes a tannin/blackwater claim for these species.
  fields.blackwater = null;
  if (spec.sex_ratio_guidance) fields.sex_ratio_guidance = spec.sex_ratio_guidance;
  const lines = Object.entries(fields).map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  const review = {
    policy_version: POLICY_VERSION,
    reviewed: REVIEWED,
    canonical_tank_source: spec.canonical_tank_source,
    sources: spec.sources,
    ...(spec.disagreements ? { disagreements: spec.disagreements } : {}),
    ...(spec.notes ? { notes: spec.notes } : {}),
    open_question: spec.open_question === true,
  };
  lines.push(`    "husbandry_review": ${JSON.stringify(review, null, 2).replace(/\n/g, '\n    ')},`);
  return lines.join('\n');
}

let text = readFileSync(FILE, 'utf8');
const records = JSON.parse(text);
const seen = new Set();
for (const record of records) {
  const spec = SPECIES[record.slug];
  const extraTags = [...(spec?.addTags ?? []), ...(ORIGINAL_TAG_FIXES[record.slug] ?? [])]
    .filter((tag) => !record.tags.includes(tag));
  if (!spec && !extraTags.length) continue;
  const [from, to] = recordBounds(text, record.slug);
  let block = text.slice(from, to);
  if (extraTags.length) {
    block = block.replace(/("tags": \[)([\s\S]*?)(\n {4}\])/, (_, open, body, close) =>
      `${open}${body},\n${extraTags.map((tag) => `      ${JSON.stringify(tag)}`).join(',\n')}${close}`);
  }
  if (spec) {
    seen.add(record.slug);
    block = stripReviewed(block);
    block = block.replace(/\n {4}"min_tank_liters": [\d.]+,/, '');
    block = block.replace(/(\n {4}"id": "[^"]+",)/, `$1\n${fieldBlock(spec)}`);
    if (spec.schoolingMinimum) {
      block = block.replace(/"schoolingMinimum": \d+/, `"schoolingMinimum": ${spec.schoolingMinimum}`);
    }
    // socialMinimum: documented conspecific minimum for a non-schooling species (see policy).
    block = block.replace(/\n {6}"socialMinimum": \d+,/, '');
    if (spec.socialMinimum) {
      block = block.replace(/(\n {6}"schoolingMinimum": \d+,)/, `$1\n      "socialMinimum": ${spec.socialMinimum},`);
    }
  }
  text = text.slice(0, from) + block + text.slice(to);
}
const missing = Object.keys(SPECIES).filter((slug) => !seen.has(slug));
if (missing.length) throw new Error(`unknown slugs: ${missing.join(', ')}`);
JSON.parse(text);
writeFileSync(FILE, text);
console.log(`updated ${seen.size} species`);
