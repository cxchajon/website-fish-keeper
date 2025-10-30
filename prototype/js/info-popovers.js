const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

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

export function initInfoPopovers(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || !doc.addEventListener) {
    return () => {};
  }

  const HostHTMLElement = doc.defaultView?.HTMLElement || globalThis.HTMLElement || null;
  const state = {
    trigger: null,
    panel: null,
  };

  const body = doc.body;

  const resetAria = (trigger, expanded) => {
    if (trigger) {
      trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
  };

  const closePanel = (restoreFocus = true) => {
    if (!state.panel || !state.trigger) {
      return;
    }

    const { panel, trigger } = state;

    resetAria(trigger, false);
    panel.setAttribute('hidden', '');
    panel.classList.remove('is-open');

    doc.removeEventListener('pointerdown', onDocumentPointerDown, true);
    doc.removeEventListener('keydown', onDocumentKeydown, true);

    if (body && body.classList) {
      body.classList.remove('proto-info-panel-open');
    }

    state.panel = null;
    state.trigger = null;

    if (restoreFocus && trigger && typeof trigger.focus === 'function') {
      trigger.focus({ preventScroll: true });
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

  const ensurePanelBasics = (panel) => {
    if (!panel) return;
    if (!panel.hasAttribute('role')) {
      panel.setAttribute('role', 'dialog');
    }
    if (!panel.hasAttribute('aria-modal')) {
      panel.setAttribute('aria-modal', 'true');
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

    panel.classList.add('is-open');
    panel.removeAttribute('hidden');

    if (body && body.classList) {
      body.classList.add('proto-info-panel-open');
    }

    doc.addEventListener('pointerdown', onDocumentPointerDown, true);
    doc.addEventListener('keydown', onDocumentKeydown, true);

    focusFirst(panel);
  };

  const findPanel = (trigger) => {
    if (!trigger) return null;
    const selector = trigger.getAttribute('data-info-target');
    if (!selector) return null;
    try {
      return doc.querySelector(selector);
    } catch (_error) {
      return null;
    }
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

    const panel = findPanel(trigger);
    if (panel && !trigger.getAttribute('aria-controls')) {
      if (panel.id) {
        trigger.setAttribute('aria-controls', panel.id);
      }
    }
  };

  const handleTriggerClick = (event) => {
    const trigger = event.target?.closest?.('[data-info-target]');
    if (!trigger) {
      return;
    }

    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();

    const panel = findPanel(trigger);
    if (!panel) {
      return;
    }

    normalizeTrigger(trigger);
    ensurePanelBasics(panel);

    if (event.type === 'keydown') {
      trigger.click();
      return;
    }

    if (panel.hasAttribute('hidden')) {
      openPanel(trigger, panel);
    } else if (state.panel === panel) {
      closePanel(true);
    } else {
      openPanel(trigger, panel);
    }
  };

  const handleCloseClick = (event) => {
    const closer = event.target?.closest?.('[data-info-close]');
    if (!closer) {
      return;
    }

    event.preventDefault();
    closePanel(true);
  };

  const applyToNode = (node) => {
    const ElementCtor = doc.defaultView?.Element || globalThis.Element;
    if (!ElementCtor || !(node instanceof ElementCtor)) {
      return;
    }
    if (typeof node.matches === 'function' && node.matches('[data-info-target]')) {
      normalizeTrigger(node);
    }
    if (typeof node.querySelectorAll === 'function') {
      node.querySelectorAll('[data-info-target]').forEach((child) => normalizeTrigger(child));
    }
  };

  const triggers = Array.from(doc.querySelectorAll('[data-info-target]'));
  triggers.forEach(normalizeTrigger);

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

  doc.addEventListener('click', handleTriggerClick);
  doc.addEventListener('keydown', handleTriggerClick);
  doc.addEventListener('click', handleCloseClick);

  return () => {
    closePanel(false);
    doc.removeEventListener('click', handleTriggerClick);
    doc.removeEventListener('keydown', handleTriggerClick);
    doc.removeEventListener('click', handleCloseClick);
    observer?.disconnect?.();
  };
}

function autoInit() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  if (!window.location?.pathname?.includes('/prototype/stocking-prototype.html')) {
    return;
  }
  initInfoPopovers(document);
}

if (typeof window !== 'undefined') {
  window.__TTGInfoPopovers = initInfoPopovers;
}

autoInit();
