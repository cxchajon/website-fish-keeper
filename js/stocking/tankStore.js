import { EVENTS, dispatchEvent } from './events.js';
import { getTankById, canonicalizeFilterType } from '../utils.js';

const roundTo = (value, precision) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const EMPTY_DIMENSIONS_IN = Object.freeze({ l: null, w: null, h: null });
const EMPTY_DIMENSIONS_CM = Object.freeze({ l: null, w: null, h: null });
const EMPTY_DIMS = Object.freeze({ w: null, d: null, h: null });

const EMPTY = Object.freeze({
  id: null,
  label: '',
  gallons: 0,
  liters: 0,
  lengthIn: null,
  widthIn: null,
  heightIn: null,
  dims: EMPTY_DIMS,
  dimensionsIn: EMPTY_DIMENSIONS_IN,
  dimensionsCm: EMPTY_DIMENSIONS_CM,
  filledWeightLbs: 0,
  emptyWeightLbs: 0,
});

let currentTank = EMPTY;
const subscribers = new Set();

const FILTER_STORAGE_KEY = 'ttg.stocking.filters.v1';

function ensureNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function ensurePositiveNumber(value) {
  const num = ensureNumber(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function formatCentimeters(inches) {
  const value = ensureNumber(inches);
  if (value == null) return null;
  return roundTo(value * 2.54, 2);
}

function hasChanged(next) {
  if (currentTank === next) return false;
  const fields = ['id', 'label', 'gallons', 'liters', 'lengthIn', 'widthIn', 'heightIn'];
  for (const key of fields) {
    if (currentTank[key] !== next[key]) {
      return true;
    }
  }
  return false;
}

function freezeRecord(record) {
  return Object.freeze({
    ...record,
    dims: Object.freeze({ ...EMPTY_DIMS, ...(record.dims ?? {}) }),
    dimensionsIn: Object.freeze({ ...EMPTY_DIMENSIONS_IN, ...(record.dimensionsIn ?? {}) }),
    dimensionsCm: Object.freeze({ ...EMPTY_DIMENSIONS_CM, ...(record.dimensionsCm ?? {}) }),
  });
}

export function normalizeTankPreset(preset) {
  if (!preset) return null;
  const canonical = preset.id ? getTankById(preset.id) : null;
  const gallons = ensureNumber(preset.gallons ?? canonical?.gallons);
  const liters = ensureNumber(preset.liters ?? canonical?.liters);
  const dims = preset.dims ?? canonical?.dims ?? null;
  const legacyDims = preset.dimensions_in ?? preset.dimensionsIn ?? null;
  const lengthIn = ensurePositiveNumber(
    preset.lengthIn ?? dims?.w ?? legacyDims?.l ?? canonical?.lengthIn
  );
  const widthIn = ensurePositiveNumber(
    preset.widthIn ?? dims?.d ?? legacyDims?.w ?? canonical?.widthIn
  );
  const heightIn = ensurePositiveNumber(
    preset.heightIn ?? dims?.h ?? legacyDims?.h ?? canonical?.heightIn
  );

  if (
    gallons == null || liters == null ||
    lengthIn == null || widthIn == null || heightIn == null
  ) {
    console.error('[TankStore] Tank preset missing numeric dimensions:', preset?.id ?? preset?.label ?? preset);
    return null;
  }

  const filledWeight = ensureNumber(preset.filled_weight_lbs ?? canonical?.filled_weight_lbs) ?? 0;
  const emptyWeight = ensureNumber(preset.empty_weight_lbs ?? canonical?.empty_weight_lbs) ?? 0;

  const dimensionsIn = {
    l: lengthIn,
    w: widthIn,
    h: heightIn,
  };
  const dimensionsCm = {
    l: formatCentimeters(lengthIn),
    w: formatCentimeters(widthIn),
    h: formatCentimeters(heightIn),
  };
  const dimsRecord = {
    w: lengthIn,
    d: widthIn,
    h: heightIn,
  };

  return freezeRecord({
    id: preset.id ?? canonical?.id ?? null,
    label: String(preset.label ?? canonical?.label ?? ''),
    gallons,
    liters,
    lengthIn,
    widthIn,
    heightIn,
    dims: dimsRecord,
    dimensionsIn,
    dimensionsCm,
    filledWeightLbs: filledWeight,
    emptyWeightLbs: emptyWeight,
  });
}

export function getTankSnapshot() {
  return currentTank;
}

function resolvePresetCandidate(preset) {
  if (!preset) return null;
  if (typeof preset === 'string') {
    return getTankById(preset);
  }
  if (preset && typeof preset === 'object' && preset.id) {
    const canonical = getTankById(preset.id);
    if (canonical) {
      return { ...canonical, ...preset };
    }
  }
  return preset;
}

export function setTank(preset) {
  const resolved = resolvePresetCandidate(preset);
  const normalized = resolved ? normalizeTankPreset(resolved) : null;
  const next = normalized ?? EMPTY;
  if (!hasChanged(next)) {
    return currentTank;
  }
  currentTank = next;
  const snapshot = getTankSnapshot();
  for (const listener of subscribers) {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('[TankStore] Listener error:', error);
    }
  }
  dispatchEvent(EVENTS.TANK_CHANGED, { tank: snapshot });
  return snapshot;
}

export function subscribeTank(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export const EMPTY_TANK = EMPTY;

function parseFiltersPayload(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object');
  } catch (_error) {
    return [];
  }
}

function normalizeStoredFilter(filter) {
  if (!filter || typeof filter !== 'object') {
    return null;
  }
  const id = typeof filter.id === 'string' && filter.id.trim() ? filter.id.trim() : null;
  const type = canonicalizeFilterType(filter.type ?? filter.kind);
  const value = Number(filter.rated_gph ?? filter.gph);
  const rated = Number.isFinite(value) && value > 0 ? Math.min(Math.round(value), 1500) : 0;
  return { id, type, rated_gph: rated };
}

export function loadFilterSnapshot() {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    return parseFiltersPayload(raw)
      .map((item) => normalizeStoredFilter(item))
      .filter((item) => item);
  } catch (_error) {
    return [];
  }
}

export function saveFilterSnapshot(filters) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const normalized = Array.isArray(filters)
      ? filters.map((item) => normalizeStoredFilter(item)).filter((item) => item)
      : [];
    if (normalized.length === 0) {
      localStorage.removeItem(FILTER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(normalized));
  } catch (_error) {
    /* no-op */
  }
}
