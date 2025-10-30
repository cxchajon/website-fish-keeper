const STORAGE_KEY = 'ttg_dev_debug_ui_v1';
const BODY_CLASS = 'debug-on';
const ON_VALUE = 'on';
const OFF_VALUE = 'off';
const listeners = new Set();
let debugEnabled = false;
let badgeEl = null;

function readInitialState() {
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (stored === ON_VALUE) {
      return true;
    }
    if (stored === OFF_VALUE) {
      return false;
    }
  } catch (err) {
    console.warn('TTG devtools: unable to read debug flag', err);
  }
  return false;
}

function persistState(enabled) {
  try {
    const value = enabled ? ON_VALUE : OFF_VALUE;
    window.localStorage?.setItem(STORAGE_KEY, value);
  } catch (err) {
    console.warn('TTG devtools: unable to persist debug flag', err);
  }
}

function ensureBody(action) {
  if (document.body) {
    action(document.body);
    return;
  }
  window.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      action(document.body);
    }
  }, { once: true });
}

function ensureBadge() {
  if (badgeEl && badgeEl.isConnected) {
    return badgeEl;
  }
  const el = document.createElement('div');
  el.className = 'proto-debug-badge';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = 'DEV DEBUG';
  el.hidden = true;
  ensureBody((body) => {
    body.appendChild(el);
  });
  badgeEl = el;
  return badgeEl;
}

function syncBadge(enabled) {
  const badge = ensureBadge();
  if (badge) {
    badge.hidden = !enabled;
  }
}

function applyBodyClass(enabled) {
  ensureBody((body) => {
    body.classList.toggle(BODY_CLASS, enabled);
  });
}

function notifyListeners(enabled) {
  listeners.forEach((callback) => {
    try {
      callback(enabled);
    } catch (err) {
      console.error('TTG devtools: listener error', err);
    }
  });
}

function setDebugState(enabled) {
  const normalized = Boolean(enabled);
  if (debugEnabled === normalized) {
    return debugEnabled;
  }
  debugEnabled = normalized;
  persistState(debugEnabled);
  applyBodyClass(debugEnabled);
  syncBadge(debugEnabled);
  notifyListeners(debugEnabled);
  return debugEnabled;
}

function toggleDebugState() {
  setDebugState(!debugEnabled);
}

function handleKeydown(event) {
  const isModifierCombo = event.ctrlKey || event.metaKey;
  if (!isModifierCombo || !event.shiftKey) {
    return;
  }
  const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  if (event.code !== 'KeyD' && key !== 'd') {
    return;
  }
  event.preventDefault();
  toggleDebugState();
}

function onDebugToggle(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  listeners.add(callback);
  callback(debugEnabled);
  return () => {
    listeners.delete(callback);
  };
}

function isDebugEnabled() {
  return debugEnabled;
}

function enableDebug() {
  setDebugState(true);
}

function disableDebug() {
  setDebugState(false);
}

// Initialize state synchronously so dependent modules can query immediately.
debugEnabled = readInitialState();
applyBodyClass(debugEnabled);
syncBadge(debugEnabled);

window.addEventListener('keydown', handleKeydown, { capture: false });

export { isDebugEnabled, onDebugToggle, enableDebug as enableDebugUI, disableDebug as disableDebugUI, toggleDebugState as toggleDebugUI };
