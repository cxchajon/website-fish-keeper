import { getTooltipContent } from './tooltip-content.js';
const TOOLTIP_TRIGGER_SELECTOR = '[data-tooltip-id], [data-info-id], [data-info], [data-tooltip], [data-tooltip-text], [data-tt]';
const BOUND_FLAG = 'ttgTooltipBound';
const DEFAULT_INLINE_CLASS = 'ttg-tooltip';
const DEFAULT_OFFSET_X = 6;
const DEFAULT_OFFSET_Y = 6;
const EDGE_GUTTER = 8;
const OUTSIDE_EVENTS = ['pointerdown', 'mousedown', 'touchstart'];

let activeState = null;

function tipHasContent(tip) {
  if (!(tip instanceof HTMLElement)) {
    return false;
  }
  if (tip.childElementCount > 0) {
    return true;
  }
  const text = (tip.textContent || '').trim();
  return text.length > 0;
}

function applyRegistryContent(trigger, tip, scope) {
  if (!(trigger instanceof HTMLElement) || !(tip instanceof HTMLElement)) {
    return false;
  }
  const doc = getDocument(scope);
  const keyCandidates = [
    trigger.dataset.info,
    trigger.getAttribute('data-info-key'),
    tip.dataset.info,
    tip.getAttribute('data-info-key'),
  ];
  const rawKey = keyCandidates.find((value) => typeof value === 'string' && value.trim());
  if (!rawKey) {
    return tipHasContent(tip);
  }
  const key = rawKey.trim().toLowerCase();
  trigger.dataset.info = key;
  tip.dataset.info = key;
  const entry = getTooltipContent(key);
  if (!entry) {
    return tipHasContent(tip);
  }
  const { title, body = [], bullets = [], ariaLabel, label } = entry;
  const lines = Array.isArray(body) ? body.filter((line) => typeof line === 'string' && line.trim()) : [];
  const points = Array.isArray(bullets) ? bullets.filter((line) => typeof line === 'string' && line.trim()) : [];
  const hasContent = Boolean(title) || lines.length > 0 || points.length > 0;
  if (!hasContent) {
    return false;
  }
  if (tip.dataset.tooltipRendered === key && tipHasContent(tip)) {
    return true;
  }
  tip.innerHTML = '';
  tip.dataset.tooltipRendered = key;
  if (title) {
    const heading = doc.createElement('strong');
    heading.className = 'ttg-tooltip__title';
    heading.textContent = title;
    tip.appendChild(heading);
  }
  lines.forEach((line) => {
    const paragraph = doc.createElement('p');
    paragraph.className = 'ttg-tooltip__body';
    paragraph.textContent = line;
    tip.appendChild(paragraph);
  });
  if (points.length) {
    const list = doc.createElement('ul');
    list.className = 'ttg-tooltip__list';
    points.forEach((line) => {
      const item = doc.createElement('li');
      item.textContent = line;
      list.appendChild(item);
    });
    tip.appendChild(list);
  }
  const announcedLabel = ariaLabel || label;
  if (announcedLabel && !trigger.getAttribute('aria-label')) {
    trigger.setAttribute('aria-label', announcedLabel);
  }
  if (announcedLabel && !trigger.getAttribute('title')) {
    trigger.setAttribute('title', announcedLabel);
  }
  return tipHasContent(tip);
}

function hideTrigger(trigger, tip) {
  if (!(trigger instanceof HTMLElement)) {
    return;
  }
  if (activeState && activeState.trigger === trigger) {
    closeActive({ restoreFocus: false });
  }
  trigger.setAttribute('hidden', '');
  trigger.setAttribute('aria-hidden', 'true');
  trigger.setAttribute('aria-disabled', 'true');
  trigger.classList.add('ttg-tooltip-hidden');
  if (tip instanceof HTMLElement) {
    ensureHidden(tip, true);
  }
}

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
    if (typeof text === 'string' && text.length) {
      tip = createInlineTooltip(doc, tipId, text);
    } else if (trigger.dataset.info || trigger.getAttribute('data-info-key')) {
      tip = createInlineTooltip(doc, tipId, '');
    } else {
      return null;
    }
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

function parseOffset(trigger) {
  const raw = typeof trigger?.dataset?.ttOffset === 'string' ? trigger.dataset.ttOffset.trim() : '';
  if (!raw) {
    return { x: DEFAULT_OFFSET_X, y: DEFAULT_OFFSET_Y };
  }
  const parts = raw.split(',').map((part) => part.trim()).filter((part) => part.length);
  if (!parts.length) {
    return { x: DEFAULT_OFFSET_X, y: DEFAULT_OFFSET_Y };
  }
  const first = parseFloat(parts[0]);
  const second = parts.length > 1 ? parseFloat(parts[1]) : Number.NaN;
  const offsetX = Number.isFinite(first) ? first : DEFAULT_OFFSET_X;
  let offsetY = Number.isFinite(second) ? second : Number.NaN;
  if (!Number.isFinite(offsetY)) {
    offsetY = Number.isFinite(first) ? first : DEFAULT_OFFSET_Y;
  }
  if (!Number.isFinite(offsetY)) {
    offsetY = DEFAULT_OFFSET_Y;
  }
  return { x: offsetX, y: offsetY };
}

function resolveOffsets(state) {
  if (!state) {
    return { x: DEFAULT_OFFSET_X, y: DEFAULT_OFFSET_Y };
  }
  if (state.trigger instanceof HTMLElement) {
    const parsed = parseOffset(state.trigger);
    if (!state.offset || state.offset.x !== parsed.x || state.offset.y !== parsed.y) {
      state.offset = parsed;
    }
    return state.offset;
  }
  if (state.offset && typeof state.offset.x === 'number' && typeof state.offset.y === 'number') {
    return state.offset;
  }
  return { x: DEFAULT_OFFSET_X, y: DEFAULT_OFFSET_Y };
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

function hasNonVisibleOverflow(style) {
  if (!style) {
    return false;
  }
  const values = [style.overflow, style.overflowX, style.overflowY];
  return values.some((value) => {
    if (!value) {
      return false;
    }
    const normalized = value.toLowerCase();
    return normalized && normalized !== 'visible' && normalized !== 'unset';
  });
}

function findOverflowAncestor(element) {
  let current = element?.parentElement || null;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (hasNonVisibleOverflow(style)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
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

function ensureTooltipPortal(state) {
  if (!state || !(state.trigger instanceof HTMLElement) || !(state.tip instanceof HTMLElement)) {
    return;
  }
  const { trigger, tip } = state;
  if ((!state.homeParent || !state.homeParent.isConnected) && tip.parentElement && tip.parentElement !== document.body) {
    state.homeParent = tip.parentElement;
  }
  if (tip.parentElement && tip.parentElement !== document.body) {
    state.homeNextSibling = tip.nextSibling || null;
  }
  const needsPortal = !!findOverflowAncestor(trigger);
  if (needsPortal) {
    if (tip.parentElement !== document.body) {
      document.body.appendChild(tip);
    }
    tip.dataset.ttgPortal = 'body';
    state.usesPortal = true;
  } else {
    state.usesPortal = false;
  }
}

function restoreTooltipHome(state) {
  if (!state || !(state.tip instanceof HTMLElement)) {
    return;
  }
  const { tip, homeParent } = state;
  const shouldRestore = tip.parentElement === document.body && homeParent instanceof Node;
  if (shouldRestore) {
    const reference = state.homeNextSibling && state.homeNextSibling.parentNode === homeParent
      ? state.homeNextSibling
      : null;
    if (reference) {
      homeParent.insertBefore(tip, reference);
    } else {
      homeParent.appendChild(tip);
    }
    state.homeNextSibling = tip.nextSibling || null;
  }
  if (tip.dataset.ttgPortal) {
    delete tip.dataset.ttgPortal;
  }
  state.usesPortal = false;
}

function isTriggerOffscreen(trigger) {
  if (!(trigger instanceof HTMLElement)) {
    return true;
  }
  const rect = trigger.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return true;
  }
  const { left, top, width, height } = getViewportBox();
  const viewportLeft = left;
  const viewportTop = top;
  const viewportRight = viewportLeft + width;
  const viewportBottom = viewportTop + height;
  return rect.right < viewportLeft || rect.left > viewportRight || rect.bottom < viewportTop || rect.top > viewportBottom;
}

function placeTooltip(state) {
  if (!state || !(state.trigger instanceof HTMLElement) || !(state.tip instanceof HTMLElement)) {
    return;
  }
  const { trigger, tip } = state;
  const offsets = resolveOffsets(state);
  const triggerRect = trigger.getBoundingClientRect();
  const pageX = window.scrollX || window.pageXOffset || 0;
  const pageY = window.scrollY || window.pageYOffset || 0;
  const viewportBox = getViewportBox();
  const viewportLeft = pageX + (viewportBox.left || 0);
  const viewportTop = pageY + (viewportBox.top || 0);
  const viewportRight = viewportLeft + viewportBox.width;
  const viewportBottom = viewportTop + viewportBox.height;

  const tipRect = tip.getBoundingClientRect();
  const tipWidth = tipRect.width;
  const tipHeight = tipRect.height;

  const gutterLeft = viewportLeft + EDGE_GUTTER;
  const gutterRight = viewportRight - EDGE_GUTTER;
  const gutterTop = viewportTop + EDGE_GUTTER;
  const gutterBottom = viewportBottom - EDGE_GUTTER;

  const minLeft = gutterLeft;
  let maxLeft = gutterRight - tipWidth;
  if (maxLeft < minLeft) {
    maxLeft = minLeft;
  }
  let left = triggerRect.left + offsets.x + pageX;
  left = clamp(left, minLeft, maxLeft);

  const minTop = gutterTop;
  let maxTop = gutterBottom - tipHeight;
  if (maxTop < minTop) {
    maxTop = minTop;
  }

  const defaultTop = triggerRect.bottom + offsets.y + pageY;
  let top = defaultTop;
  let placement = 'bottom-right';

  if (defaultTop + tipHeight > gutterBottom) {
    const aboveTop = triggerRect.top - tipHeight - offsets.y + pageY;
    const clampedAbove = clamp(aboveTop, minTop, maxTop);
    const fitsAbove = clampedAbove >= gutterTop && clampedAbove + tipHeight <= gutterBottom;
    if (fitsAbove) {
      top = clampedAbove;
      placement = 'top-right';
    } else {
      const centerTop = triggerRect.top + triggerRect.height / 2 - tipHeight / 2 + pageY;
      top = clamp(centerTop, minTop, maxTop);
      placement = 'middle-right';
    }
  } else {
    top = clamp(defaultTop, minTop, maxTop);
  }

  tip.style.top = `${Math.round(top)}px`;
  tip.style.left = `${Math.round(left)}px`;
  tip.dataset.placement = placement;
  state.placement = placement;
}

function repositionTooltip(state) {
  if (!state || state.type !== 'tooltip' || activeState !== state) {
    return;
  }
  const { tip } = state;
  if (!(tip instanceof HTMLElement) || !tip.isConnected) {
    return;
  }
  if (isTriggerOffscreen(state.trigger)) {
    closeActive({ restoreFocus: false });
    return;
  }
  ensureTooltipPortal(state);
  tip.style.visibility = 'hidden';
  tip.style.pointerEvents = 'none';
  placeTooltip(state);
  tip.style.visibility = '';
  tip.style.pointerEvents = '';
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
  restoreTooltipHome(state);

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

  if (type === 'tooltip') {
    ensureTooltipPortal(state);
  }

  ensureHidden(tip, false);
  tip.style.visibility = 'hidden';
  tip.style.pointerEvents = 'none';

  if (type === 'tooltip') {
    placeTooltip(state);
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

  const viewportBox = getViewportBox();
  const reposition = () => repositionTooltip(state);
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  if (viewportBox.viewport) {
    viewportBox.viewport.addEventListener('scroll', reposition, { passive: true });
    viewportBox.viewport.addEventListener('resize', reposition, { passive: true });
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
  state.windowHandler = reposition;
  state.viewport = viewportBox.viewport;
  state.viewportHandler = reposition;

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
    offset: parseOffset(trigger),
    homeParent: tip.parentElement || null,
    homeNextSibling: tip.nextSibling || null,
    usesPortal: false,
    placement: null,
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
  const searchRoot = root instanceof Document || typeof root?.querySelectorAll !== 'function' ? scope : root;
  if (!scope || !searchRoot) {
    return;
  }
  const triggers = Array.from(searchRoot.querySelectorAll(TOOLTIP_TRIGGER_SELECTOR));
  triggers.forEach((trigger) => {
    if (!(trigger instanceof HTMLElement)) {
      return;
    }
    const tip = resolveTooltip(trigger, scope);
    if (!tip) {
      hideTrigger(trigger);
      return;
    }
    const hasContent = applyRegistryContent(trigger, tip, scope);
    if (!hasContent) {
      hideTrigger(trigger, tip);
      return;
    }
    if (trigger.classList.contains('ttg-tooltip-hidden')) {
      trigger.classList.remove('ttg-tooltip-hidden');
    }
    trigger.removeAttribute('hidden');
    trigger.removeAttribute('aria-hidden');
    trigger.removeAttribute('aria-disabled');
    if (trigger.dataset[BOUND_FLAG] === '1') {
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
