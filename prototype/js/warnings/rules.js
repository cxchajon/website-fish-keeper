const FEMALE_BETTA_IDS = new Set(['betta_female', 'betta-female']);
const FIN_NIPPER_TAG = 'fin_nipper';

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.toLowerCase();
  return String(value).toLowerCase();
};

const isFemaleBetta = (entry) => {
  const id = normalizeId(entry?.id ?? entry?.species?.id ?? entry?.species?.slug);
  return FEMALE_BETTA_IDS.has(id);
};

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

export const rule_betta_female_sorority = ({ entries, candidate, tank }) => {
  const context = gatherContext(entries, candidate);
  if (!context.some(isFemaleBetta)) {
    return [];
  }
  const totalQty = context.reduce((sum, item) => {
    if (!isFemaleBetta(item)) return sum;
    return sum + item.qty;
  }, 0);
  if (totalQty < 2) {
    return [];
  }
  const gallons = Number(tank?.gallons ?? tank?.displayGallons ?? 0) || 0;
  const warnings = [];
  if (totalQty >= 2 && totalQty < 5) {
    warnings.push({
      id: 'betta_female_sorority_lowcount',
      severity: 'danger',
      icon: 'alert',
      kind: 'behavior',
      chips: ['Aggression', 'Territoriality'],
      text: 'Female Betta groups under 5 are unstable and often fight. Keep a single female, or a sorority of 5+ in 20g+ with dense cover.',
      help: 'Sororities require careful setup: 5–7+ females, 20g+ footprint, heavy planting/hardscape, multiple line-of-sight breaks, and close observation.',
    });
  }
  if (totalQty >= 2 && gallons > 0 && gallons < 20) {
    warnings.push({
      id: 'betta_female_sorority_tank_too_small',
      severity: 'warn',
      icon: 'alert',
      kind: 'behavior',
      chips: ['Space', 'Aggression'],
      text: 'A sorority of 5+ female Bettas is risky in tanks under 20 gallons. Increase space and provide heavy planting/hiding.',
    });
  }
  return warnings;
};

export const rule_betta_female_finnipper = ({ entries, candidate }) => {
  const context = gatherContext(entries, candidate);
  const hasBetta = context.some((item) => isFemaleBetta(item));
  if (!hasBetta) {
    return [];
  }
  const hasFinNipper = context.some((item) => {
    if (isFemaleBetta(item)) return false;
    if (item.qty <= 0) return false;
    const tags = Array.isArray(item.species?.tags) ? item.species.tags : [];
    return tags.some((tag) => typeof tag === 'string' && tag.toLowerCase() === FIN_NIPPER_TAG);
  });
  if (!hasFinNipper) {
    return [];
  }
  return [
    {
      id: 'betta_female_finnipper_conflict',
      severity: 'warn',
      icon: 'alert',
      kind: 'compatibility',
      chips: ['Compatibility'],
      text: 'Fin-nippers (e.g., Tiger Barbs, Serpae Tetras) may harass Bettas and damage fins. Avoid this combination.',
    },
  ];
};

const WARNING_RULES = [rule_betta_female_sorority, rule_betta_female_finnipper];

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
