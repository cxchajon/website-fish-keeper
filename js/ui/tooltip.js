const TOOLTIP_TRIGGER_SELECTOR = '[data-tooltip-id], [data-info-id], [data-tooltip], [data-tooltip-text], [data-tt]';
const BOUND_FLAG = 'ttgTooltipBound';
const DEFAULT_INLINE_CLASS = 'ttg-tooltip';
const GAP = 10;
const MARGIN = 8;
const OUTSIDE_EVENTS = ['pointerdown', 'mousedown', 'touchstart'];

let activeState = null;

function getDocument(scope) {
  if (scope instanceof Document) {
    return scope;
  }
  if (scope && scope.ownerDocument) {
    return scope.ownerDocument;
  }
  return document;
}

function createInlineTooltip(doc, id, text) {
  const tip = doc.createElement('div');
  tip.id = id;
  tip.className = DEFAULT_INLINE_CLASS;
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('data-tooltip-panel', 'inline');
  tip.hidden = true;
  tip.textContent = text;
  (doc.body || document.body).appendChild(tip);
  return tip;
}

function normalizeTooltipElement(trigger, tip) {
  if (!(tip instanceof HTMLElement)) {
    return tip;
  }
  if (tip.classList.contains('tt')) {
    tip.classList.remove('tt');
  }
  if (tip.classList.contains('ui-tip')) {
    tip.classList.remove('ui-tip');
  }
  if (!tip.hasAttribute('data-tooltip-panel')) {
    tip.setAttribute('data-tooltip-panel', 'inline');
  }
  const typeHint = (trigger.dataset.tooltipType || tip.dataset.tooltipType || '').toLowerCase();
  const role = (tip.getAttribute('role') || '').toLowerCase();
  if (typeHint !== 'dialog' && role !== 'dialog' && !tip.classList.contains(DEFAULT_INLINE_CLASS)) {
    tip.classList.add(DEFAULT_INLINE_CLASS);
  }
  return tip;
}

function resolveTooltip(trigger, scope) {
  const doc = getDocument(scope);
  let tipId = trigger.dataset.tooltipId || trigger.dataset.infoId || trigger.getAttribute('aria-controls');
  if (!tipId) {
    const base = trigger.id ? `${trigger.id}-tip` : `ttg-tip-${Math.random().toString(36).slice(2, 9)}`;
    tipId = base;
    trigger.dataset.tooltipId = tipId;
  }
  let tip = doc.getElementById(tipId);
  if (!tip) {
    const text = trigger.dataset.tooltip || trigger.dataset.tooltipText || trigger.dataset.tt || trigger.getAttribute('data-tt');
    if (!text) {
      return null;
    }
    tip = createInlineTooltip(doc, tipId, text);
  }
  if (!tip.id) {
    tip.id = tipId;
  }
  normalizeTooltipElement(trigger, tip);
  trigger.dataset.tooltipId = tip.id;
  trigger.dataset.infoId = tip.id;
  return tip;
}

function collectInertTargets(tip) {
  const records = [];
  const doc = getDocument(tip);
  const explicit = Array.from(doc.querySelectorAll('[data-tooltip-inert-target]'));
  const targets = explicit.length ? explicit : Array.from((doc.body || document.body).children);
  targets.forEach((el) => {
    if (!(el instanceof HTMLElement)) {
      return;
    }
    if (el === tip || el.contains(tip) || tip.contains(el)) {
      return;
    }
    const record = { element: el, wasInert: !!el.inert, ariaHidden: el.getAttribute('aria-hidden') };
    if (!record.wasInert && 'inert' in el) {
      el.inert = true;
    }
    if (record.ariaHidden == null) {
      el.setAttribute('aria-hidden', 'true');
    }
    records.push(record);
  });
  return records;
}

function releaseInertTargets(records = []) {
  records.forEach((record) => {
    const { element, wasInert, ariaHidden } = record;
    if (!(element instanceof HTMLElement)) {
      return;
    }
    if (!wasInert && 'inert' in element) {
      element.inert = false;
    }
    if (ariaHidden == null) {
      element.removeAttribute('aria-hidden');
    } else {
      element.setAttribute('aria-hidden', ariaHidden);
    }
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getViewportBox() {
  const vv = window.visualViewport;
  if (vv) {
    return {
      left: vv.offsetLeft ?? vv.pageLeft ?? 0,
      top: vv.offsetTop ?? vv.pageTop ?? 0,
      width: vv.width ?? window.innerWidth,
      height: vv.height ?? window.innerHeight,
      viewport: vv,
    };
  }
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    viewport: null,
  };
}

function getFocusableElements(container) {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  return Array.from(container.querySelectorAll(selector)).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function ensureHidden(tip, hidden = true) {
  tip.hidden = hidden;
  tip.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) {
    tip.setAttribute('data-open', 'false');
    tip.setAttribute('tabindex', '-1');
    tip.style.pointerEvents = '';
    tip.style.visibility = '';
    tip.style.top = '';
    tip.style.left = '';
    tip.removeAttribute('data-placement');
  } else {
    tip.setAttribute('data-open', 'true');
    if (!tip.hasAttribute('tabindex')) {
      tip.setAttribute('tabindex', '-1');
    }
  }
}

function determineType(tip) {
  if ((tip.getAttribute('role') || '').toLowerCase() === 'dialog') {
    return 'dialog';
  }
  if ((tip.dataset.tooltipType || '').toLowerCase() === 'dialog') {
    tip.setAttribute('role', 'dialog');
    return 'dialog';
  }
  if (!tip.hasAttribute('role')) {
    tip.setAttribute('role', 'tooltip');
  }
  return 'tooltip';
}

function placeTooltip(trigger, tip) {
  const btnRect = trigger.getBoundingClientRect();
  const { left: viewportLeft, top: viewportTop, width: viewportWidth, height: viewportHeight } = getViewportBox();
  const tipWidth = tip.offsetWidth;
  const tipHeight = tip.offsetHeight;

  let top = btnRect.bottom + GAP;
  let placement = 'bottom';
  const spaceBelow = viewportTop + viewportHeight - btnRect.bottom;
  const spaceAbove = btnRect.top - viewportTop;
  if (spaceBelow < tipHeight + GAP && spaceAbove >= tipHeight + GAP) {
    top = btnRect.top - GAP - tipHeight;
    placement = 'top';
  }
  const minTop = viewportTop + MARGIN;
  const maxTop = viewportTop + viewportHeight - tipHeight - MARGIN;
  top = clamp(top, minTop, maxTop);

  let left = btnRect.left + btnRect.width / 2 - tipWidth / 2;
  const minLeft = viewportLeft + MARGIN;
  const maxLeft = viewportLeft + viewportWidth - tipWidth - MARGIN;
  left = clamp(left, minLeft, maxLeft);

  tip.style.top = `${Math.round(top)}px`;
  tip.style.left = `${Math.round(left)}px`;
  tip.dataset.placement = placement;
}

function closeActive(options = {}) {
  if (!activeState) {
    return;
  }
  const { restoreFocus = true } = options;
  const state = activeState;
  activeState = null;

  const { trigger, tip, type, focusTrap, outsideHandler, keyHandler, viewport, inertRecords } = state;

  OUTSIDE_EVENTS.forEach((evt) => document.removeEventListener(evt, outsideHandler, true));
  document.removeEventListener('keydown', keyHandler, true);
  if (focusTrap) {
    tip.removeEventListener('keydown', focusTrap);
  }
  if (viewport) {
    viewport.removeEventListener('scroll', state.viewportHandler);
    viewport.removeEventListener('resize', state.viewportHandler);
  }
  window.removeEventListener('scroll', state.windowHandler, true);
  window.removeEventListener('resize', state.windowHandler);

  trigger.classList.remove('is-open');
  trigger.setAttribute('aria-expanded', 'false');
  ensureHidden(tip, true);

  trigger.dispatchEvent(new CustomEvent('ttg:tooltip-close', {
    bubbles: true,
    detail: { trigger, tip, type },
  }));

  if (type === 'dialog') {
    document.documentElement.classList.remove('ttg-tooltip-lock');
    document.body.classList.remove('ttg-tooltip-lock');
    releaseInertTargets(inertRecords);
  }

  if (restoreFocus && state.lastFocus && typeof state.lastFocus.focus === 'function') {
    try {
      state.lastFocus.focus({ preventScroll: true });
    } catch (error) {
      // ignore
    }
  } else if (restoreFocus) {
    try {
      trigger.focus({ preventScroll: true });
    } catch (error) {
      // ignore
    }
  }
}

function handleGlobalEscape(event) {
  if (event.key === 'Escape' || event.key === 'Esc') {
    event.stopPropagation();
    closeActive();
  }
}

function handleOutsideEvent(event) {
  if (!activeState) {
    return;
  }
  const { trigger, tip, type } = activeState;
  if (trigger.contains(event.target) || tip.contains(event.target)) {
    if (type === 'dialog') {
      const overlay = event.target.closest('[data-tooltip-backdrop]');
      if (overlay) {
        event.preventDefault();
        closeActive();
      }
    }
    return;
  }
  closeActive();
}

function trapFocusFactory(tip) {
  return function handleTrap(event) {
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = getFocusableElements(tip);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
}

function openTooltip(state) {
  if (activeState && activeState !== state) {
    closeActive({ restoreFocus: false });
  } else if (activeState === state) {
    return;
  }

  const { trigger, tip, type } = state;

  state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;

  ensureHidden(tip, false);
  tip.style.visibility = 'hidden';
  tip.style.pointerEvents = 'none';

  if (type === 'tooltip') {
    placeTooltip(trigger, tip);
  }

  tip.style.visibility = '';
  tip.style.pointerEvents = '';

  trigger.classList.add('is-open');
  trigger.setAttribute('aria-expanded', 'true');

  trigger.dispatchEvent(new CustomEvent('ttg:tooltip-open', {
    bubbles: true,
    detail: { trigger, tip, type },
  }));

  const outsideHandler = handleOutsideEvent;
  const keyHandler = handleGlobalEscape;

  OUTSIDE_EVENTS.forEach((evt) => document.addEventListener(evt, outsideHandler, true));
  document.addEventListener('keydown', keyHandler, true);

  const windowHandler = () => closeActive({ restoreFocus: false });
  const viewportBox = getViewportBox();
  const viewportHandler = () => closeActive({ restoreFocus: false });
  window.addEventListener('scroll', windowHandler, true);
  window.addEventListener('resize', windowHandler);
  if (viewportBox.viewport) {
    viewportBox.viewport.addEventListener('scroll', viewportHandler, { passive: true });
    viewportBox.viewport.addEventListener('resize', viewportHandler, { passive: true });
  }

  let focusTrap = null;
  if (type === 'dialog') {
    document.documentElement.classList.add('ttg-tooltip-lock');
    document.body.classList.add('ttg-tooltip-lock');
    state.inertRecords = collectInertTargets(tip);
    focusTrap = trapFocusFactory(tip);
    tip.addEventListener('keydown', focusTrap);
    const focusable = getFocusableElements(tip);
    const initial = tip.querySelector('[data-tooltip-initial-focus]');
    const target = (initial instanceof HTMLElement && !initial.hasAttribute('disabled'))
      ? initial
      : (focusable[0] || tip);
    try {
      target.focus({ preventScroll: true });
    } catch (error) {
      // ignore
    }
  } else {
    if (!trigger.hasAttribute('aria-describedby')) {
      trigger.setAttribute('aria-describedby', tip.id);
    }
    try {
      trigger.focus({ preventScroll: true });
    } catch (error) {
      // ignore
    }
  }

  state.outsideHandler = outsideHandler;
  state.keyHandler = keyHandler;
  state.focusTrap = focusTrap;
  state.windowHandler = windowHandler;
  state.viewport = viewportBox.viewport;
  state.viewportHandler = viewportHandler;

  activeState = state;
}

function bindCloseElements(state) {
  const { tip } = state;
  tip.querySelectorAll('[data-tooltip-close]').forEach((closeBtn) => {
    closeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      closeActive();
    });
  });
  tip.addEventListener('keydown', (event) => {
    if ((event.key === 'Escape' || event.key === 'Esc') && activeState === state) {
      event.stopPropagation();
      closeActive();
    }
  });
}

function prepareTrigger(trigger, tip) {
  const type = determineType(tip);
  ensureHidden(tip, true);

  if (!trigger.getAttribute('type') && trigger.tagName === 'BUTTON') {
    trigger.setAttribute('type', 'button');
  }
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', tip.id);
  trigger.setAttribute('data-tooltip-type', type);
  if (type === 'dialog') {
    trigger.setAttribute('aria-haspopup', 'dialog');
  } else {
    trigger.setAttribute('aria-haspopup', 'true');
  }

  const state = {
    trigger,
    tip,
    type,
    lastFocus: trigger,
    outsideHandler: null,
    keyHandler: null,
    focusTrap: null,
    windowHandler: null,
    viewport: null,
    viewportHandler: null,
    inertRecords: null,
  };

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (activeState === state) {
      closeActive();
    } else {
      openTooltip(state);
    }
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeState === state) {
        closeActive();
      } else {
        openTooltip(state);
      }
    } else if ((event.key === 'Escape' || event.key === 'Esc') && activeState === state) {
      event.preventDefault();
      closeActive();
    }
  });

  bindCloseElements(state);
  trigger.dataset[BOUND_FLAG] = '1';
  return state;
}

export function initInfoTooltips(root = document) {
  const scope = root instanceof Document ? root : (root?.ownerDocument || document);
  const triggers = Array.from(scope.querySelectorAll(TOOLTIP_TRIGGER_SELECTOR));
  triggers.forEach((trigger) => {
    if (!(trigger instanceof HTMLElement)) {
      return;
    }
    if (trigger.dataset[BOUND_FLAG] === '1') {
      return;
    }
    const tip = resolveTooltip(trigger, scope);
    if (!tip) {
      return;
    }
    prepareTrigger(trigger, tip);
  });
}

export function closeAllInfoTooltips() {
  closeActive({ restoreFocus: false });
}

if (typeof window !== 'undefined') {
  window.ttgTooltips = window.ttgTooltips || {};
  window.ttgTooltips.initInfoTooltips = initInfoTooltips;
  window.ttgTooltips.closeAllInfoTooltips = closeAllInfoTooltips;
}
