export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function roundTo(value, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function formatNumber(value, options = {}) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const { minimumFractionDigits = 0, maximumFractionDigits = 1 } = options;
  return value.toLocaleString(undefined, { minimumFractionDigits, maximumFractionDigits });
}

export function formatPercent(value, options = {}) {
  const defaults = { minimumFractionDigits: 0, maximumFractionDigits: 1 };
  return `${formatNumber(value * 100, { ...defaults, ...options })}%`;
}

export function sum(iterable, selector = (x) => x) {
  let total = 0;
  for (const item of iterable) {
    total += selector(item) || 0;
  }
  return total;
}

export function average(iterable, selector = (x) => x) {
  const arr = Array.from(iterable, selector).filter((value) => Number.isFinite(value));
  if (!arr.length) {
    return 0;
  }
  return sum(arr) / arr.length;
}

export function weightedAverage(items, weightSelector, valueSelector) {
  let total = 0;
  let weight = 0;
  for (const item of items) {
    const w = weightSelector(item);
    const v = valueSelector(item);
    if (!Number.isFinite(w) || !Number.isFinite(v)) {
      continue;
    }
    weight += w;
    total += w * v;
  }
  return weight > 0 ? total / weight : 0;
}

export function debounce(fn, delay = 250) {
  let frame = null;
  return (...args) => {
    if (frame) {
      clearTimeout(frame);
    }
    frame = setTimeout(() => {
      frame = null;
      fn(...args);
    }, delay);
  };
}

export function getQueryFlag(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) === '1';
}

export function createEventHub() {
  const listeners = new Map();
  return {
    on(event, handler) {
      const list = listeners.get(event) || [];
      list.push(handler);
      listeners.set(event, list);
      return () => this.off(event, handler);
    },
    off(event, handler) {
      const list = listeners.get(event);
      if (!list) return;
      listeners.set(event, list.filter((fn) => fn !== handler));
    },
    emit(event, payload) {
      const list = listeners.get(event);
      if (!list) return;
      list.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error('Event handler error', error);
        }
      });
    },
  };
}

export function describeRange([min, max], unit = '') {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return '—';
  }
  if (Math.abs(min - max) < 1e-2) {
    return `${formatNumber(min)}${unit}`;
  }
  return `${formatNumber(min)}${unit} – ${formatNumber(max)}${unit}`;
}

export function calcSeverityIcon(level) {
  switch (level) {
    case 'bad':
      return '✖';
    case 'warn':
      return '⚠';
    default:
      return '✔';
  }
}

export function severityFromDelta(delta, warnThreshold, badThreshold) {
  const abs = Math.abs(delta);
  if (abs >= badThreshold) {
    return 'bad';
  }
  if (abs >= warnThreshold) {
    return 'warn';
  }
  return 'ok';
}

export function getBandColor(percent) {
  if (percent <= 0.7) {
    return 'var(--ok)';
  }
  if (percent <= 0.9) {
    return '#f0c75a';
  }
  if (percent <= 1.1) {
    return '#ff9248';
  }
  return 'var(--bad)';
}

export function uniqueById(entries) {
  const map = new Map();
  for (const entry of entries) {
    map.set(entry.id, entry);
  }
  return Array.from(map.values());
}

export function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export function percentLabel(current, proposed) {
  return `${formatPercent(current)} → ${formatPercent(proposed)}`;
}

export function nowTimestamp() {
  return Date.now();
}

export function roundCapacity(value) {
  return Math.max(0, roundTo(value, 3));
}

export function byCommonName(a, b) {
  return a.common_name.localeCompare(b.common_name);
}

export function unique(arr) {
  return Array.from(new Set(arr));
}
