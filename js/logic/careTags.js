export const CARE_TAG_LABELS = {
  sens: 'Sensitive',
  hardy: 'Hardy',
  shy: 'Shy',
  messy: 'Messy',
  nocturnal: 'Nocturnal',
  shoaler: 'Shoaler',
  schooling_shoaler: 'Schooling shoaler',
  bottom_dweller: 'Bottom dweller',
  nano: 'Nano species',
  algae_eater: 'Algae eater',
  algae_specialist: 'Algae specialist',
  copper_sensitive: 'Copper-sensitive',
  fin_sensitive: 'Fin-sensitive',
  fin_nipper: 'Fin nipper',
  long_fins: 'Long fins',
  slow_long_fins: 'Slow long fins',
  slow_swimmer: 'Slow swimmer',
  fast_swimmer: 'Fast swimmer',
  livebearer: 'Livebearer',
  labyrinth: 'Labyrinth fish',
  betta: 'Betta',
  betta_male: 'Betta (male)',
  aggressive: 'Aggressive',
  semi_aggressive: 'Semi-aggressive',
  territorial: 'Territorial',
  invert_safe: 'Invert-safe',
  predator_shrimp: 'Shrimp predator',
  predator_snail: 'Snail predator',
  cichlid: 'Cichlid',
  zones: 'Flow zones needed',
  mix: 'Fresh + brackish mix',
  req: 'Blackwater required',
};

function normalizeKey(tag) {
  if (tag == null) return '';
  const str = String(tag).trim();
  return str.toLowerCase();
}

export function formatCareTagLabel(tag) {
  const key = normalizeKey(tag);
  if (!key) return '';
  return CARE_TAG_LABELS[key] ?? String(tag);
}
