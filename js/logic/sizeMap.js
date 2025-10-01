import { TANK_SIZES, getTankById, normalizeLegacyTankSelection } from '../utils.js';

const LEGACY_VARIANT_IDS = new Map([
  ['5-standard', '5g'],
  ['10-standard', '10g'],
  ['15-standard', '15g'],
  ['20-high', '20h'],
  ['20-long', '20l'],
  ['29-standard', '29g'],
  ['40-breeder', '40b'],
  ['55-standard', '55g'],
  ['75-standard', '75g'],
  ['125-standard', '125g'],
]);

const GALLON_TO_ID = (() => {
  const map = new Map();
  for (const tank of TANK_SIZES) {
    if (!map.has(tank.gallons)) {
      map.set(tank.gallons, tank.id);
    }
  }
  if (map.has(20)) {
    map.set(20, '20l');
  }
  return map;
})();

function getDimensionsIn(tank) {
  if (!tank) return { l: 0, w: 0, h: 0 };
  const dims =
    tank.dimensionsIn ??
    tank.dimensions_in ?? {
      l: tank.lengthIn,
      w: tank.widthIn,
      h: tank.heightIn,
    };
  return {
    l: Number.isFinite(dims?.l) ? dims.l : Number.isFinite(tank.lengthIn) ? tank.lengthIn : 0,
    w: Number.isFinite(dims?.w) ? dims.w : Number.isFinite(tank.widthIn) ? tank.widthIn : 0,
    h: Number.isFinite(dims?.h) ? dims.h : Number.isFinite(tank.heightIn) ? tank.heightIn : 0,
  };
}

function createVariantFromTank(tank) {
  if (!tank) return null;
  const dims = getDimensionsIn(tank);
  return {
    id: tank.id,
    name: tank.label,
    gallons: Number.isFinite(tank.gallons) ? tank.gallons : 0,
    liters: Number.isFinite(tank.liters) ? tank.liters : 0,
    length: dims.l,
    width: dims.w,
    height: dims.h,
    profile: 'standard',
    default: true,
  };
}

function normalizeTankId(raw) {
  if (raw == null) {
    return null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    if (LEGACY_VARIANT_IDS.has(trimmed)) {
      return LEGACY_VARIANT_IDS.get(trimmed);
    }
    const normalized = normalizeLegacyTankSelection(trimmed);
    return normalized ?? null;
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (GALLON_TO_ID.has(raw)) {
      return GALLON_TO_ID.get(raw);
    }
    return normalizeLegacyTankSelection(String(raw));
  }

  return null;
}

function resolveTank(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (typeof raw.tankId === 'string') {
      const idFromTank = normalizeTankId(raw.tankId);
      if (idFromTank) {
        const tank = getTankById(idFromTank);
        if (tank) {
          return tank;
        }
      }
    }

    if (typeof raw.id === 'string') {
      const idFromId = normalizeTankId(raw.id);
      if (idFromId) {
        const tank = getTankById(idFromId);
        if (tank) {
          return tank;
        }
      }
    }

    if ('gallons' in raw) {
      const fromGallons = resolveTank(raw.gallons);
      if (fromGallons) {
        return fromGallons;
      }
    }

    if ('value' in raw) {
      const fromValue = resolveTank(raw.value);
      if (fromValue) {
        return fromValue;
      }
    }

    return null;
  }

  const normalizedId = normalizeTankId(raw);
  if (!normalizedId) {
    return null;
  }
  return getTankById(normalizedId);
}

export function getTankVariants(input) {
  const tank = resolveTank(input);
  if (!tank) {
    return [];
  }
  const variant = createVariantFromTank(tank);
  return variant ? [variant] : [];
}

export function pickTankVariant({ tankId = null, gallons = null, speciesEntries = [], manualSelection = null } = {}) {
  const manualTank = resolveTank(manualSelection);
  if (manualTank) {
    return createVariantFromTank(manualTank);
  }

  const resolved = resolveTank({ tankId, gallons });
  if (resolved) {
    return createVariantFromTank(resolved);
  }

  // Legacy behaviour expected a fallback variant; attempt to infer from gallons when provided.
  if (Number.isFinite(gallons)) {
    const fallback = resolveTank(gallons);
    if (fallback) {
      return createVariantFromTank(fallback);
    }
  }

  // speciesEntries no longer influence variant selection, but keep signature stable.
  void speciesEntries;
  return null;
}

export function formatVariant(variant) {
  if (!variant) return '—';
  const { length, width, height } = variant;
  const dims = [length, width, height].filter((value) => Number.isFinite(value));
  if (!dims.length) {
    return '—';
  }
  return `${dims[0]}″ × ${dims[1]}″ × ${dims[2]}″`;
}

export function describeVariant(variant) {
  if (!variant) return '—';
  return `${variant.name} (${formatVariant(variant)})`;
}

