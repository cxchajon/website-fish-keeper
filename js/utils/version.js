export const APP_VERSION = (() => {
  const t = (typeof window !== 'undefined' && window.__APP_BUILD__) || new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const v = `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}${pad(t.getHours())}${pad(t.getMinutes())}`;
  return v;
})();
