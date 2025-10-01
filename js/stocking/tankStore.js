import { EVENTS, dispatchEvent } from './events.js';

const roundTo = (value, precision) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const EMPTY = Object.freeze({
  id: null,
  label: '',
  gallons: 0,
  liters: 0,
  lengthIn: 0,
  widthIn: 0,
  heightIn: 0,
  dimensionsIn: Object.freeze({ l: 0, w: 0, h: 0 }),
  dimensionsCm: Object.freeze({ l: 0, w: 0, h: 0 }),
  filledWeightLbs: 0,
  emptyWeightLbs: 0,
});

let currentTank = EMPTY;
const subscribers = new Set();

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
    dimensionsIn: Object.freeze({ ...record.dimensionsIn }),
    dimensionsCm: Object.freeze({ ...record.dimensionsCm }),
  });
}

export function normalizeTankPreset(preset) {
  if (!preset) return null;
  const gallons = ensureNumber(preset.gallons);
  const liters = ensureNumber(preset.liters);
  const lengthIn = ensureNumber(preset.lengthIn ?? preset.dimensions_in?.l);
  const widthIn = ensureNumber(preset.widthIn ?? preset.dimensions_in?.w);
  const heightIn = ensureNumber(preset.heightIn ?? preset.dimensions_in?.h);

  if (
    gallons == null || liters == null ||
    lengthIn == null || widthIn == null || heightIn == null
  ) {
    console.error('[TankStore] Tank preset missing numeric dimensions:', preset?.id ?? preset?.label ?? preset);
    return null;
  }

  const filledWeight = ensureNumber(preset.filled_weight_lbs) ?? 0;
  const emptyWeight = ensureNumber(preset.empty_weight_lbs) ?? 0;

  const dimensionsIn = {
    l: lengthIn,
    w: widthIn,
    h: heightIn,
  };
  const dimensionsCm = {
    l: formatCentimeters(lengthIn) ?? 0,
    w: formatCentimeters(widthIn) ?? 0,
    h: formatCentimeters(heightIn) ?? 0,
  };

  return freezeRecord({
    id: preset.id ?? null,
    label: String(preset.label ?? ''),
    gallons,
    liters,
    lengthIn,
    widthIn,
    heightIn,
    dimensionsIn,
    dimensionsCm,
    filledWeightLbs: filledWeight,
    emptyWeightLbs: emptyWeight,
  });
}

export function getTankSnapshot() {
  return currentTank;
}

export function setTank(preset) {
  const normalized = preset ? normalizeTankPreset(preset) : EMPTY;
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
