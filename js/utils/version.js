const pad = (n) => String(n).padStart(2, '0');

const coerceDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  return null;
};

export const APP_VERSION = (() => {
  if (typeof window !== 'undefined') {
    if (typeof window.__APP_VERSION__ === 'string' && window.__APP_VERSION__.trim() !== '') {
      return window.__APP_VERSION__;
    }
  }

  const existing = typeof window !== 'undefined' ? window.__APP_BUILD__ : undefined;
  let buildTime = coerceDate(existing);
  if (!buildTime) {
    buildTime = new Date();
  }

  const version = `${buildTime.getFullYear()}${pad(buildTime.getMonth() + 1)}${pad(buildTime.getDate())}${pad(
    buildTime.getHours(),
  )}${pad(buildTime.getMinutes())}`;

  if (typeof window !== 'undefined') {
    window.__APP_BUILD__ = buildTime;
    window.__APP_VERSION__ = version;
  }

  return version;
})();
