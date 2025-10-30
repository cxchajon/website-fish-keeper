const FEMALE_BETTA_ID = 'betta_female';
const BETTA_IDS = new Set([FEMALE_BETTA_ID, 'betta_male']);
const FIN_NIPPER_TAG = 'fin_nipper';

function toQuantity(entry) {
  const qty = Number(entry?.qty ?? entry?.quantity ?? 0);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function normalizeContextEntry(entry, source) {
  if (!entry || !entry.species) {
    return null;
  }
  const id = entry.species.id || entry.id;
  if (typeof id !== 'string' || !id) {
    return null;
  }
  const qty = toQuantity(entry);
  if (qty <= 0) {
    return null;
  }
  return {
    id,
    qty,
    species: entry.species,
    source,
  };
}

function gatherContext(entries = [], candidate = null) {
  const list = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const normalized = normalizeContextEntry(entry, 'stock');
    if (normalized) {
      list.push(normalized);
    }
  }
  if (candidate) {
    const normalized = normalizeContextEntry(candidate, 'candidate');
    if (normalized) {
      list.push(normalized);
    }
  }
  return list;
}

function hasFinNipper(context) {
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
}

function createFemaleSororityWarning() {
  const message = 'Female bettas should only be kept together in groups of 5 or more to diffuse aggression. 2–4 is high risk of fighting and stress.';
  return {
    id: 'betta.femaleGroupTooSmall',
    severity: 'danger',
    icon: 'alert',
    kind: 'behavior',
    title: 'Female bettas: group too small',
    message,
    text: `Female bettas: group too small — ${message}`,
  };
}

function createFinNipperWarning() {
  const message = 'Fin-nipping species can shred betta fins and cause severe stress or injury.';
  return {
    id: 'betta.finNippers',
    severity: 'danger',
    icon: 'alert',
    kind: 'compatibility',
    title: 'Fin-nippers present with betta',
    message,
    text: `Fin-nippers present with betta — ${message}`,
  };
}

export function evaluateStockWarnings({ entries = [], candidate = null } = {}) {
  const context = gatherContext(entries, candidate);
  if (!context.length) {
    return [];
  }

  const warnings = [];

  const femaleQty = context.reduce((sum, item) => (item.id === FEMALE_BETTA_ID ? sum + item.qty : sum), 0);
  if (femaleQty >= 2 && femaleQty <= 4) {
    warnings.push(createFemaleSororityWarning());
  }

  const bettaPresent = context.some((item) => BETTA_IDS.has(item.id));
  if (bettaPresent && hasFinNipper(context)) {
    warnings.push(createFinNipperWarning());
  }

  return warnings;
}

export default { evaluateStockWarnings };
