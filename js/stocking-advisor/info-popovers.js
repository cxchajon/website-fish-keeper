const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const BODY_LOCK_CLASS = 'proto-popover-overlay-open';
const OVERLAY_ID = 'proto-info-overlay';
const OVERLAY_ACTIVE_CLASS = 'is-active';
const PANEL_OPEN_CLASS = 'is-open';
const POINTER_GUARD_ATTR = 'data-info-pointer-ts';
const POINTER_GUARD_WINDOW = 400;
const VIEWPORT_GUTTER = 12;

function getFocusable(panel) {
  return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));
}

function focusFirst(panel) {
  const focusable = getFocusable(panel);
  const target = focusable.find((el) => typeof el.focus === 'function') || panel;
  if (typeof target.focus === 'function') {
    target.focus({ preventScroll: true });
  }
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function initInfoPopovers(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || !doc.addEventListener) {
    return () => {};
  }

  const win = doc.defaultView || globalThis;
  const HostHTMLElement = win?.HTMLElement || globalThis.HTMLElement || null;

  const state = {
    trigger: null,
    panel: null,
  };

  const body = doc.body;
  let overlayRoot = null;
  let overlayBackdrop = null;

  const ensureOverlay = () => {
    if (overlayRoot && overlayRoot.isConnected) {
      return overlayRoot;
    }

    let root = doc.getElementById(OVERLAY_ID);
    if (!root) {
      root = doc.createElement('div');
      root.id = OVERLAY_ID;
      root.className = 'proto-info-overlay';
      root.setAttribute('hidden', '');
      root.setAttribute('aria-hidden', 'true');

      const backdrop = doc.createElement('div');
      backdrop.className = 'proto-info-overlay__backdrop';
      backdrop.setAttribute('data-overlay-backdrop', '');
      root.appendChild(backdrop);

      (doc.body || doc.documentElement).appendChild(root);
    }

    overlayRoot = root;
    overlayBackdrop = overlayRoot.querySelector('[data-overlay-backdrop]');
    if (!overlayBackdrop) {
      overlayBackdrop = doc.createElement('div');
      overlayBackdrop.className = 'proto-info-overlay__backdrop';
      overlayBackdrop.setAttribute('data-overlay-backdrop', '');
      overlayRoot.insertBefore(overlayBackdrop, overlayRoot.firstChild);
    }

    if (!overlayRoot.dataset.overlayBound) {
      overlayBackdrop.addEventListener('pointerdown', () => {
        closePanel(true);
      });
      overlayRoot.dataset.overlayBound = '1';
    }

    return overlayRoot;
  };

  const resetAria = (trigger, expanded) => {
    if (trigger) {
      trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
  };

  const lockScroll = () => {
    if (body && body.classList) {
      body.classList.add(BODY_LOCK_CLASS);
    }
  };

  const unlockScroll = () => {
    if (body && body.classList) {
      body.classList.remove(BODY_LOCK_CLASS);
    }
  };

  const clearPanelStyles = (panel) => {
    if (!panel || !panel.style) return;
    panel.style.top = '';
    panel.style.left = '';
    panel.style.right = '';
    panel.style.bottom = '';
    panel.style.visibility = '';
    panel.removeAttribute('data-overlay-placement');
  };

  const positionPanel = (trigger, panel) => {
    if (!trigger || !panel) {
      return;
    }

    const overlay = ensureOverlay();
    if (!overlay || !overlay.isConnected) {
      return;
    }

    const viewport = win?.visualViewport || null;
    const viewportWidth = viewport?.width ?? win.innerWidth ?? doc.documentElement.clientWidth ?? panel.offsetWidth;
    const viewportHeight = viewport?.height ?? win.innerHeight ?? doc.documentElement.clientHeight ?? panel.offsetHeight;
    const offsetLeft = viewport?.offsetLeft ?? 0;
    const offsetTop = viewport?.offsetTop ?? 0;

    const triggerRect = trigger.getBoundingClientRect();

    // Temporarily ensure visibility for measurement
    const prevVisibility = panel.style.visibility;
    panel.style.visibility = 'hidden';
    const panelRect = panel.getBoundingClientRect();
    panel.style.visibility = prevVisibility;

    let placement = 'bottom';
    let top = triggerRect.bottom + VIEWPORT_GUTTER;
    const fitsBelow = top + panelRect.height <= offsetTop + viewportHeight - VIEWPORT_GUTTER;

    if (!fitsBelow) {
      const candidateTop = triggerRect.top - VIEWPORT_GUTTER - panelRect.height;
      if (candidateTop >= offsetTop + VIEWPORT_GUTTER) {
        placement = 'top';
        top = candidateTop;
      } else {
        placement = 'center';
      }
    }

    let left = triggerRect.left + triggerRect.width / 2 - panelRect.width / 2;

    const minLeft = offsetLeft + VIEWPORT_GUTTER;
    const maxLeft = offsetLeft + viewportWidth - VIEWPORT_GUTTER - panelRect.width;
    const minTop = offsetTop + VIEWPORT_GUTTER;
    const maxTop = offsetTop + viewportHeight - VIEWPORT_GUTTER - panelRect.height;

    if (placement === 'center') {
      const centerTop = offsetTop + (viewportHeight - panelRect.height) / 2;
      const centerLeft = offsetLeft + (viewportWidth - panelRect.width) / 2;
      top = clamp(centerTop, minTop, maxTop);
      left = clamp(centerLeft, minLeft, maxLeft);
    } else {
      top = clamp(top, minTop, maxTop);
      left = clamp(left, minLeft, maxLeft);
    }

    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.dataset.overlayPlacement = placement;
  };

  const repositionActive = () => {
    if (state.trigger && state.panel) {
      positionPanel(state.trigger, state.panel);
    }
  };

  const trapFocus = (event) => {
    if (!state.panel || event.key !== 'Tab') {
      return;
    }

    const focusable = getFocusable(state.panel).filter((el) => {
      if (el.hasAttribute('disabled')) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      return true;
    });

    if (!focusable.length) {
      event.preventDefault();
      focusFirst(state.panel);
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = doc.activeElement;

    if (event.shiftKey) {
      if (active === first || !state.panel.contains(active)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
      return;
    }

    if (active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  const onDocumentKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel(true);
      return;
    }

    trapFocus(event);
  };

  const onDocumentPointerDown = (event) => {
    if (!state.panel) {
      return;
    }

    if (state.panel.contains(event.target)) {
      return;
    }

    if (state.trigger && state.trigger.contains(event.target)) {
      return;
    }

    closePanel(true);
  };

  const closePanel = (restoreFocus = true) => {
    if (!state.panel || !state.trigger) {
      return;
    }

    const { panel, trigger } = state;

    resetAria(trigger, false);
    panel.classList.remove(PANEL_OPEN_CLASS);
    panel.setAttribute('hidden', '');
    clearPanelStyles(panel);

    doc.removeEventListener('pointerdown', onDocumentPointerDown, true);
    doc.removeEventListener('keydown', onDocumentKeydown, true);
    win.removeEventListener('resize', repositionActive, true);
    win.removeEventListener('scroll', repositionActive, true);

    if (overlayRoot && overlayRoot.isConnected) {
      overlayRoot.classList.remove(OVERLAY_ACTIVE_CLASS);
      overlayRoot.setAttribute('aria-hidden', 'true');
      overlayRoot.setAttribute('hidden', '');
    }

    unlockScroll();

    state.panel = null;
    state.trigger = null;

    if (restoreFocus && trigger && typeof trigger.focus === 'function') {
      trigger.focus({ preventScroll: true });
    }
  };

  const ensurePanelBasics = (panel) => {
    if (!panel) return;
    if (!panel.hasAttribute('role')) {
      panel.setAttribute('role', 'dialog');
    }
    if (!panel.hasAttribute('aria-modal')) {
      panel.setAttribute('aria-modal', 'false');
    }
    if (!panel.hasAttribute('tabindex')) {
      panel.setAttribute('tabindex', '-1');
    }
  };

  const openPanel = (trigger, panel) => {
    if (state.panel === panel) {
      closePanel(true);
      return;
    }

    if (state.panel) {
      closePanel(false);
    }

    state.trigger = trigger;
    state.panel = panel;

    ensurePanelBasics(panel);
    resetAria(trigger, true);

    const overlay = ensureOverlay();
    if (overlay && !overlay.contains(panel)) {
      overlay.appendChild(panel);
    }

    overlay?.classList.add(OVERLAY_ACTIVE_CLASS);
    overlay?.setAttribute('aria-hidden', 'false');
    overlay?.removeAttribute('hidden');

    panel.style.visibility = 'hidden';
    panel.removeAttribute('hidden');
    panel.classList.add(PANEL_OPEN_CLASS);

    lockScroll();

    requestAnimationFrame(() => {
      if (!state.panel || state.panel !== panel) {
        return;
      }
      positionPanel(trigger, panel);
      panel.style.visibility = '';
      focusFirst(panel);
    });

    doc.addEventListener('pointerdown', onDocumentPointerDown, true);
    doc.addEventListener('keydown', onDocumentKeydown, true);
    win.addEventListener('resize', repositionActive, true);
    win.addEventListener('scroll', repositionActive, true);
  };

  const findPanel = (trigger) => {
    if (!trigger) return null;

    const selector = trigger.getAttribute('data-info-target');
    if (selector) {
      try {
        return doc.querySelector(selector);
      } catch (_error) {
        return null;
      }
    }

    const controlsId = trigger.getAttribute('aria-controls');
    if (controlsId) {
      return doc.getElementById(controlsId);
    }

    return null;
  };

  const normalizeTrigger = (trigger) => {
    if (!trigger) {
      return;
    }

    if (HostHTMLElement && !(trigger instanceof HostHTMLElement)) {
      return;
    }

    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', trigger.getAttribute('aria-expanded') === 'true' ? 'true' : 'false');

    if (!trigger.getAttribute('data-info-target')) {
      const controlsId = trigger.getAttribute('aria-controls');
      if (controlsId) {
        trigger.setAttribute('data-info-target', `#${controlsId}`);
      }
    }

    const panel = findPanel(trigger);
    if (panel && panel.id && !trigger.getAttribute('aria-controls')) {
      trigger.setAttribute('aria-controls', panel.id);
    }
  };

  const wasPointerHandledRecently = (trigger) => {
    const stamp = Number(trigger?.getAttribute(POINTER_GUARD_ATTR) || 0);
    return Number.isFinite(stamp) && stamp > 0 && Date.now() - stamp < POINTER_GUARD_WINDOW;
  };

  const markPointerHandled = (trigger) => {
    if (!trigger) return;
    const timestamp = Date.now();
    trigger.setAttribute(POINTER_GUARD_ATTR, String(timestamp));
    win.setTimeout?.(() => {
      if (trigger.getAttribute(POINTER_GUARD_ATTR) === String(timestamp)) {
        trigger.removeAttribute(POINTER_GUARD_ATTR);
      }
    }, POINTER_GUARD_WINDOW);
  };

  const toggleForTrigger = (trigger, viaKeyboard = false) => {
    const panel = findPanel(trigger);
    if (!panel) {
      return;
    }

    normalizeTrigger(trigger);
    ensurePanelBasics(panel);

    const isHidden = panel.hasAttribute('hidden');
    if (isHidden || state.panel !== panel) {
      openPanel(trigger, panel);
    } else {
      closePanel(viaKeyboard);
    }
  };

  const onTriggerPointerUp = (event) => {
    const trigger = event.currentTarget;
    if (!trigger) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    markPointerHandled(trigger);
    toggleForTrigger(trigger, false);
  };

  const onTriggerClick = (event) => {
    const trigger = event.currentTarget;
    if (!trigger) {
      return;
    }

    if (wasPointerHandledRecently(trigger)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    toggleForTrigger(trigger, event.detail === 0);
  };

  const onTriggerKeydown = (event) => {
    const trigger = event.currentTarget;
    if (!trigger) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleForTrigger(trigger, true);
      return;
    }

    if (event.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      closePanel(true);
    }
  };

  const boundTriggers = new WeakSet();

  const bindTrigger = (trigger) => {
    if (!trigger || boundTriggers.has(trigger)) {
      return;
    }

    normalizeTrigger(trigger);

    trigger.addEventListener('pointerup', onTriggerPointerUp, { passive: false });
    trigger.addEventListener('click', onTriggerClick, { passive: false });
    trigger.addEventListener('keydown', onTriggerKeydown);

    boundTriggers.add(trigger);
  };

  const applyToNode = (node) => {
    const ElementCtor = doc.defaultView?.Element || globalThis.Element;
    if (!ElementCtor || !(node instanceof ElementCtor)) {
      return;
    }

    if (node.matches?.('[data-info-target]')) {
      bindTrigger(node);
    }

    node.querySelectorAll?.('[data-info-target]').forEach((child) => bindTrigger(child));
  };

  const triggers = Array.from(doc.querySelectorAll('[data-info-target]'));
  triggers.forEach(bindTrigger);

  let observer = null;
  const ObserverCtor = doc.defaultView?.MutationObserver || globalThis.MutationObserver;
  if (ObserverCtor && (doc.body || doc.documentElement)) {
    observer = new ObserverCtor((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes?.forEach?.((node) => applyToNode(node));
      }
    });
    observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
  }

  const handleCloseClick = (event) => {
    const closer = event.target?.closest?.('[data-info-close]');
    if (!closer) {
      return;
    }

    event.preventDefault();
    closePanel(true);
  };

  doc.addEventListener('click', handleCloseClick);

  return () => {
    closePanel(false);
    observer?.disconnect?.();
    doc.removeEventListener('click', handleCloseClick);
    triggers.forEach((trigger) => {
      trigger.removeEventListener('pointerup', onTriggerPointerUp);
      trigger.removeEventListener('click', onTriggerClick);
      trigger.removeEventListener('keydown', onTriggerKeydown);
    });
  };
}

function autoInit() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  if (!document.querySelector('[data-proto-popover]')) {
    return;
  }
  initInfoPopovers(document);
}

if (typeof window !== 'undefined') {
  window.__TTGInfoPopovers = initInfoPopovers;
}

autoInit();
