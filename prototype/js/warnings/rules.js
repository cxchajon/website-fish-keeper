const FEMALE_BETTA_IDS = new Set(['betta_female', 'betta-female']);
const MALE_BETTA_IDS = new Set(['betta_male', 'betta-male']);
const BETTA_IDS = new Set([...FEMALE_BETTA_IDS, ...MALE_BETTA_IDS]);
const FIN_NIPPER_TAG = 'fin_nipper';

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.toLowerCase();
  return String(value).toLowerCase();
};

const resolveEntryId = (entry) => normalizeId(entry?.id ?? entry?.species?.id ?? entry?.species?.slug);

const isFemaleBetta = (entry) => FEMALE_BETTA_IDS.has(resolveEntryId(entry));

const isBetta = (entry) => BETTA_IDS.has(resolveEntryId(entry));

const numericQty = (entry) => {
  const qty = Number(entry?.qty ?? entry?.quantity ?? 0);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
};

const gatherContext = (entries = [], candidate = null) => {
  const list = [];
  for (const item of entries) {
    if (!item) continue;
    const qty = numericQty(item);
    if (qty <= 0) continue;
    const species = item.species ?? null;
    const id = normalizeId(item.id ?? species?.id ?? species?.slug);
    list.push({ id, qty, species, source: 'stock' });
  }
  if (candidate?.species) {
    const qty = numericQty(candidate);
    if (qty > 0) {
      const species = candidate.species;
      const id = normalizeId(candidate.id ?? species?.id ?? species?.slug);
      list.push({ id, qty, species, source: 'candidate' });
    }
  }
  return list;
};

export const rule_betta_female_sorority = ({ entries, candidate }) => {
  const context = gatherContext(entries, candidate);
  if (!context.some(isFemaleBetta)) {
    return [];
  }
  const totalQty = context.reduce((sum, item) => {
    if (!isFemaleBetta(item)) return sum;
    return sum + item.qty;
  }, 0);
  if (totalQty < 2 || totalQty > 4) {
    return [];
  }

  const message = 'Female bettas should only be kept together in groups of 5 or more to diffuse aggression. 2–4 is high risk of fighting and stress.';
  const text = `Female bettas: group too small — ${message}`;
  return [
    {
      id: 'betta.femaleGroupTooSmall',
      severity: 'danger',
      icon: 'alert',
      kind: 'behavior',
      chips: ['Aggression'],
      title: 'Female bettas: group too small',
      message,
      text,
    },
  ];
};

export const rule_betta_fin_nippers = ({ entries, candidate }) => {
  const context = gatherContext(entries, candidate);
  const hasBetta = context.some((item) => isBetta(item));
  if (!hasBetta) {
    return [];
  }
  const hasFinNipper = context.some((item) => {
    if (isBetta(item)) return false;
    if (item.qty <= 0) return false;
    const tags = Array.isArray(item.species?.tags) ? item.species.tags : [];
    return tags.some((tag) => typeof tag === 'string' && tag.toLowerCase() === FIN_NIPPER_TAG);
  });
  if (!hasFinNipper) {
    return [];
  }
  const message = 'Fin-nipping species can shred betta fins and cause severe stress or injury.';
  const text = `Fin-nippers present with betta — ${message}`;
  return [
    {
      id: 'betta.finNippers',
      severity: 'danger',
      icon: 'alert',
      kind: 'compatibility',
      chips: ['Compatibility'],
      title: 'Fin-nippers present with betta',
      message,
      text,
    },
  ];
};

const WARNING_RULES = [rule_betta_female_sorority, rule_betta_fin_nippers];

export const evaluateWarningRules = (context) => {
  if (!context || typeof context !== 'object') {
    return [];
  }
  const results = [];
  for (const rule of WARNING_RULES) {
    try {
      const value = rule(context) || [];
      if (Array.isArray(value) && value.length > 0) {
        results.push(...value);
      }
    } catch (_error) {
      // swallow rule failures to avoid breaking prototype builds
    }
  }
  return results;
};

export default WARNING_RULES;
