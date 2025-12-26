const FEMALE_BETTA_IDS = new Set(['betta_female', 'betta-female']);
const MALE_BETTA_IDS = new Set(['betta_male', 'betta-male']);
const BETTA_IDS = new Set([...FEMALE_BETTA_IDS, ...MALE_BETTA_IDS]);
const FIN_NIPPER_TAG = 'fin_nipper';
const BETTA_SHAPE_TRIGGER_TAG = 'betta_shape_trigger';

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.toLowerCase();
  return String(value).toLowerCase();
};

const resolveEntryId = (entry) =>
  normalizeId(entry?.id ?? entry?.species?.id ?? entry?.species?.slug ?? entry?.slug);

const toQuantity = (entry) => {
  const qty = Number(entry?.qty ?? entry?.quantity ?? entry?.count ?? 0);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
};

const normalizeContextEntry = (entry, source) => {
  if (!entry) return null;
  const qty = toQuantity(entry);
  if (qty <= 0) return null;
  const id = resolveEntryId(entry);
  if (!id) return null;
  const species = entry.species ?? null;
  return { id, qty, species, source };
};

const gatherContext = (entries = [], candidate = null) => {
  const list = [];
  for (const item of Array.isArray(entries) ? entries : []) {
    const normalized = normalizeContextEntry(item, 'stock');
    if (normalized) {
      list.push(normalized);
    }
  }
  if (candidate) {
    const normalizedCandidate = normalizeContextEntry(candidate, 'candidate');
    if (normalizedCandidate) {
      list.push(normalizedCandidate);
    }
  }
  return list;
};

const hasFinNipper = (context) => {
  for (const item of context) {
    if (!item || BETTA_IDS.has(item.id)) {
      continue;
    }
    const tags = Array.isArray(item.species?.tags) ? item.species.tags : [];
    if (tags.some((tag) => typeof tag === 'string' && tag.toLowerCase() === FIN_NIPPER_TAG)) {
      return true;
    }
  }
  return false;
};

const hasBettaShapeTriggerMate = (context) => {
  for (const item of context) {
    if (!item || BETTA_IDS.has(item.id)) {
      continue;
    }
    const tags = Array.isArray(item.species?.tags) ? item.species.tags : [];
    if (tags.some((tag) => typeof tag === 'string' && tag.toLowerCase() === BETTA_SHAPE_TRIGGER_TAG)) {
      return true;
    }
  }
  return false;
};

const createFemaleSororityWarning = () => {
  const message =
    'Female bettas should only be kept together in groups of 5 or more to diffuse aggression. 2–4 is high risk of fighting and stress.';
  return {
    id: 'betta.femaleGroupTooSmall',
    severity: 'danger',
    icon: 'alert',
    kind: 'behavior',
    chips: ['Aggression'],
    title: 'Female bettas: group too small',
    message,
    text: `Female bettas: group too small — ${message}`,
  };
};

const createFinNipperWarning = () => {
  const message = 'Fin-nipping species can shred betta fins and cause severe stress or injury.';
  return {
    id: 'betta.finNippers',
    severity: 'danger',
    icon: 'alert',
    kind: 'compatibility',
    chips: ['Compatibility'],
    title: 'Fin-nippers present with betta',
    message,
    text: `Fin-nippers present with betta — ${message}`,
  };
};

const createBettaShapeTriggerWarning = () => {
  const message =
    'Male bettas may attack fish with long fins or similar body profiles. Use heavy cover, monitor closely, and be prepared to separate.';
  return {
    id: 'betta.shapeTrigger',
    severity: 'danger',
    icon: 'alert',
    kind: 'compatibility',
    chips: ['Compatibility'],
    title: 'Betta aggression risk: fin-shape / silhouette trigger',
    message,
    text: `Betta aggression risk: fin-shape / silhouette trigger — ${message}`,
  };
};

export const rule_betta_female_sorority = ({ entries, candidate } = {}) => {
  const context = gatherContext(entries, candidate);
  if (!context.some((item) => FEMALE_BETTA_IDS.has(item.id))) {
    return [];
  }

  const totalQty = context.reduce(
    (sum, item) => (FEMALE_BETTA_IDS.has(item.id) ? sum + item.qty : sum),
    0,
  );

  if (totalQty < 2 || totalQty > 4) {
    return [];
  }

  return [createFemaleSororityWarning()];
};

export const rule_betta_fin_nippers = ({ entries, candidate } = {}) => {
  const context = gatherContext(entries, candidate);
  if (!context.some((item) => BETTA_IDS.has(item.id))) {
    return [];
  }

  if (!hasFinNipper(context)) {
    return [];
  }

  return [createFinNipperWarning()];
};

export const rule_betta_shape_trigger = ({ entries, candidate } = {}) => {
  const context = gatherContext(entries, candidate);
  if (!context.some((item) => MALE_BETTA_IDS.has(item.id))) {
    return [];
  }

  if (!hasBettaShapeTriggerMate(context)) {
    return [];
  }

  return [createBettaShapeTriggerWarning()];
};

const WARNING_RULES = Object.freeze([
  rule_betta_female_sorority,
  rule_betta_fin_nippers,
  rule_betta_shape_trigger,
]);

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
