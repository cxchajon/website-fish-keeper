// Guard for non-browser environments
if (typeof window === 'undefined' || typeof document === 'undefined') {
  throw new Error('info-tooltip.js requires a browser environment');
}

const BADGE_SELECTOR = '.info-badge';
const TOOLTIP_ID = 'proto-info-tooltip';
const OFFSET = 8;
const GUTTER = 12;

let tooltipEl = null;
let tooltipBody = null;
let activeTrigger = null;
let bound = false;
let outsideHandler = null;
let scrollHandler = null;
let resizeHandler = null;
let removalObserver = null;

function ensureTooltipElement() {
  if (tooltipEl && tooltipEl.isConnected) {
    return tooltipEl;
  }
  tooltipEl = document.getElementById(TOOLTIP_ID);
  if (tooltipEl && tooltipEl.isConnected) {
    tooltipBody = tooltipEl.querySelector('.proto-info-tooltip__body') || tooltipEl;
    return tooltipEl;
  }
  const tip = document.createElement('div');
  tip.id = TOOLTIP_ID;
  tip.className = 'proto-info-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('hidden', '');
  const body = document.createElement('p');
  body.className = 'proto-info-tooltip__body';
  tip.appendChild(body);
  (document.body || document.documentElement).appendChild(tip);
  tooltipEl = tip;
  tooltipBody = body;
  return tip;
}

function getTooltipText(trigger) {
  if (!(trigger instanceof HTMLElement)) {
    return '';
  }
  const tip = trigger.dataset.tip || trigger.dataset.tooltip;
  return typeof tip === 'string' ? tip.trim() : '';
}

function setExpanded(trigger, value) {
  if (!(trigger instanceof HTMLElement)) {
    return;
  }
  trigger.setAttribute('aria-expanded', value ? 'true' : 'false');
  trigger.classList.toggle('is-open', Boolean(value));
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function placeTooltip(trigger) {
  if (!(trigger instanceof HTMLElement) || !tooltipEl || tooltipEl.hasAttribute('hidden')) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const tipRect = tooltipEl.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  let left = rect.left + rect.width / 2 - tipRect.width / 2 + window.scrollX;
  let top = rect.bottom + OFFSET + window.scrollY;

  if (top + tipRect.height > window.scrollY + viewportHeight - GUTTER) {
    top = rect.top - tipRect.height - OFFSET + window.scrollY;
  }

  left = clamp(left, window.scrollX + GUTTER, window.scrollX + viewportWidth - tipRect.width - GUTTER);
  top = clamp(top, window.scrollY + GUTTER, window.scrollY + viewportHeight - tipRect.height - GUTTER);

  tooltipEl.style.left = `${Math.round(left)}px`;
  tooltipEl.style.top = `${Math.round(top)}px`;
}

function attachActiveHandlers() {
  if (outsideHandler) {
    return;
  }
  outsideHandler = (event) => {
    if (!tooltipEl || tooltipEl.hasAttribute('hidden')) {
      return;
    }
    const target = event.target;
    if (tooltipEl.contains(target)) {
      return;
    }
    if (activeTrigger && activeTrigger.contains(target)) {
      return;
    }
    closeTooltip({ restoreFocus: false });
  };
  scrollHandler = () => {
    if (activeTrigger) {
      placeTooltip(activeTrigger);
    }
  };
  resizeHandler = () => {
    if (activeTrigger) {
      placeTooltip(activeTrigger);
    }
  };
  document.addEventListener('pointerdown', outsideHandler, true);
  window.addEventListener('scroll', scrollHandler, true);
  window.addEventListener('resize', resizeHandler);
}

function detachActiveHandlers() {
  if (outsideHandler) {
    document.removeEventListener('pointerdown', outsideHandler, true);
    outsideHandler = null;
  }
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler, true);
    scrollHandler = null;
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
}

function ensureRemovalObserver() {
  if (removalObserver || typeof MutationObserver !== 'function') {
    return;
  }
  removalObserver = new MutationObserver(() => {
    if (activeTrigger && !activeTrigger.isConnected) {
      closeTooltip({ restoreFocus: false });
    }
  });
  removalObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function writeTooltipText(text) {
  const tooltip = ensureTooltipElement();
  if (tooltipBody && tooltipBody.isConnected) {
    tooltipBody.textContent = text;
  } else {
    tooltip.textContent = text;
  }
}

function openTooltip(trigger) {
  if (!(trigger instanceof HTMLElement)) {
    return;
  }
  const text = getTooltipText(trigger);
  if (!text) {
    closeTooltip({ restoreFocus: false });
    return;
  }
  if (activeTrigger && activeTrigger !== trigger) {
    closeTooltip({ restoreFocus: false });
  }
  const tooltip = ensureTooltipElement();
  writeTooltipText(text);
  tooltip.style.visibility = 'hidden';
  tooltip.removeAttribute('hidden');
  activeTrigger = trigger;
  setExpanded(trigger, true);
  attachActiveHandlers();
  requestAnimationFrame(() => {
    placeTooltip(trigger);
    tooltip.style.visibility = 'visible';
  });
}

function closeTooltip({ restoreFocus = false } = {}) {
  if (!tooltipEl || !activeTrigger) {
    if (tooltipEl && !tooltipEl.hasAttribute('hidden')) {
      tooltipEl.setAttribute('hidden', '');
    }
    return;
  }
  tooltipEl.setAttribute('hidden', '');
  tooltipEl.style.visibility = '';
  if (tooltipBody && tooltipBody.isConnected) {
    tooltipBody.textContent = '';
  }
  setExpanded(activeTrigger, false);
  const triggerToFocus = activeTrigger;
  activeTrigger = null;
  detachActiveHandlers();
  if (restoreFocus && triggerToFocus && typeof triggerToFocus.focus === 'function') {
    triggerToFocus.focus({ preventScroll: true });
  }
}

function toggleTooltip(trigger, { viaKeyboard = false } = {}) {
  if (!(trigger instanceof HTMLElement)) {
    return;
  }
  if (activeTrigger === trigger) {
    closeTooltip({ restoreFocus: viaKeyboard });
  } else {
    openTooltip(trigger);
  }
}

function handleDocumentClick(event) {
  const trigger = event.target instanceof Element ? event.target.closest(BADGE_SELECTOR) : null;
  if (!trigger) {
    return;
  }
  event.preventDefault();
  toggleTooltip(trigger, { viaKeyboard: false });
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    if (activeTrigger) {
      event.preventDefault();
      closeTooltip({ restoreFocus: true });
    }
    return;
  }
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }
  const trigger = event.target instanceof Element ? event.target.closest(BADGE_SELECTOR) : null;
  if (!trigger) {
    return;
  }
  event.preventDefault();
  toggleTooltip(trigger, { viaKeyboard: true });
}

function handleExternalClose() {
  closeTooltip({ restoreFocus: false });
}

function init() {
  if (bound) {
    return;
  }
  bound = true;
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown, true);
  ensureRemovalObserver();
  [
    'ttg:proto:render',
    'ttg:proto:rerender',
    'sa:proto:render',
    'sa:proto:rerender',
    'ttg:route-change',
    'sa:route-change',
    'proto:rerender',
  ].forEach((eventName) => {
    document.addEventListener(eventName, handleExternalClose);
  });
}

const api = {
  init,
  close: () => closeTooltip({ restoreFocus: false }),
  refresh: () => {
    if (activeTrigger) {
      placeTooltip(activeTrigger);
    }
  },
};

window.TTGProtoTooltips = Object.freeze(api);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

window.addEventListener('beforeunload', () => {
  detachActiveHandlers();
  if (removalObserver) {
    removalObserver.disconnect();
    removalObserver = null;
  }
});
