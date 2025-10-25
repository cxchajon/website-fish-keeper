(function () {
  if (!/\/prototype\/stocking-prototype\.html$/.test(window.location.pathname)) {
    return;
  }

  const FOCUSABLE_SELECTOR = [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const state = {
    trigger: null,
    panel: null
  };

  const boundTriggers = new WeakSet();

  function findPanel(trigger) {
    let targetId = trigger.getAttribute('aria-controls');
    if (!targetId) {
      const dataTarget = trigger.getAttribute('data-proto-popover');
      if (dataTarget) {
        targetId = dataTarget;
        trigger.setAttribute('aria-controls', dataTarget);
      }
    }

    if (!targetId) {
      return null;
    }

    if (targetId.startsWith('#')) {
      targetId = targetId.slice(1);
    }

    return document.getElementById(targetId);
  }

  function ensurePanelInBody(panel) {
    if (panel && panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
  }

  function normalizeTrigger(trigger, panel) {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.add('proto-info-trigger');

    if (!panel) {
      return;
    }

    ensurePanelInBody(panel);

    if (!panel.hasAttribute('role')) {
      panel.setAttribute('role', 'dialog');
    }
    if (!panel.hasAttribute('tabindex')) {
      panel.setAttribute('tabindex', '-1');
    }
    panel.classList.remove('is-open');
    panel.setAttribute('hidden', '');

    const closeButtons = panel.querySelectorAll('[data-close]');
    closeButtons.forEach((btn, idx) => {
      if (idx === 0) {
        btn.classList.remove('dup-x');
        if (!btn.dataset.protoCloseBound) {
          btn.addEventListener('click', event => {
            event.preventDefault();
            closePopover(true);
          });
          btn.dataset.protoCloseBound = 'true';
        }
      } else {
        btn.classList.add('dup-x');
      }
    });
  }

  function focusFirst(panel) {
    const focusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
      if (el.classList.contains('dup-x')) return false;
      if (el.hasAttribute('disabled')) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      if (el.offsetParent === null && el !== panel) return false;
      return true;
    });

    const target = focusable[0] || panel;
    if (typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
  }

  function getScrollOffsets() {
    const doc = document.documentElement || document.body.parentNode;
    const body = document.body || doc;
    const fallbackScrollLeft = body && typeof body.scrollLeft === 'number' ? body.scrollLeft : 0;
    const fallbackScrollTop = body && typeof body.scrollTop === 'number' ? body.scrollTop : 0;
    const scrollX = typeof window.pageXOffset === 'number'
      ? window.pageXOffset
      : (doc && typeof doc.scrollLeft === 'number' ? doc.scrollLeft : fallbackScrollLeft);
    const scrollY = typeof window.pageYOffset === 'number'
      ? window.pageYOffset
      : (doc && typeof doc.scrollTop === 'number' ? doc.scrollTop : fallbackScrollTop);
    return { scrollX, scrollY };
  }

  function computePosition(triggerRect, panelRect) {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const spacing = 12;

    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    const placeBelow = panelRect.height + spacing <= spaceBelow || spaceBelow >= spaceAbove;

    let top = placeBelow
      ? triggerRect.bottom + spacing
      : triggerRect.top - panelRect.height - spacing;

    if (top < spacing) {
      top = spacing;
    }

    let left = triggerRect.left;
    if (left + panelRect.width > viewportWidth - spacing) {
      left = viewportWidth - panelRect.width - spacing;
    }
    if (left < spacing) {
      left = spacing;
    }

    return {
      top,
      left,
      edge: placeBelow ? 'bottom' : 'top'
    };
  }

  function applyPosition(trigger, panel) {
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const position = computePosition(triggerRect, panelRect);

    const { scrollX, scrollY } = getScrollOffsets();

    panel.style.top = `${Math.round(scrollY + position.top)}px`;
    panel.style.left = `${Math.round(scrollX + position.left)}px`;
    panel.dataset.edge = position.edge;
  }

  function reposition() {
    if (!state.trigger || !state.panel || state.panel.hasAttribute('hidden')) {
      return;
    }

    state.panel.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      if (!state.trigger || !state.panel || state.panel.hasAttribute('hidden')) {
        return;
      }
      applyPosition(state.trigger, state.panel);
      state.panel.style.visibility = '';
    });
  }

  function openPopover(trigger, panel) {
    if (state.trigger && state.trigger !== trigger) {
      closePopover(false);
    }

    if (state.trigger === trigger) {
      closePopover(true);
      return;
    }

    state.trigger = trigger;
    state.panel = panel;

    trigger.setAttribute('aria-expanded', 'true');

    panel.removeAttribute('hidden');
    panel.classList.add('is-open');
    panel.style.visibility = 'hidden';

    requestAnimationFrame(() => {
      if (!state.trigger || !state.panel) {
        return;
      }
      applyPosition(trigger, panel);
      panel.style.visibility = '';
      focusFirst(panel);
    });

    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('keydown', onDocumentKeyDown, true);
    window.addEventListener('resize', reposition, true);
    window.addEventListener('scroll', reposition, true);
  }

  function closePopover(returnFocus) {
    if (!state.trigger || !state.panel) {
      return;
    }

    const { trigger, panel } = state;

    trigger.setAttribute('aria-expanded', 'false');

    panel.classList.remove('is-open');
    panel.setAttribute('hidden', '');
    panel.style.visibility = '';
    panel.style.top = '';
    panel.style.left = '';

    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    document.removeEventListener('keydown', onDocumentKeyDown, true);
    window.removeEventListener('resize', reposition, true);
    window.removeEventListener('scroll', reposition, true);

    state.trigger = null;
    state.panel = null;

    if (returnFocus && document.contains(trigger)) {
      trigger.focus({ preventScroll: true });
    }
  }

  function onTriggerClick(event) {
    event.preventDefault();
    const trigger = event.currentTarget;
    const panel = findPanel(trigger);
    if (!panel) {
      return;
    }

    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closePopover(true);
    } else {
      openPopover(trigger, panel);
    }
  }

  function onTriggerKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.currentTarget.click();
  }

  function onDocumentPointerDown(event) {
    if (!state.panel || !state.trigger) {
      return;
    }

    if (state.panel.contains(event.target) || state.trigger.contains(event.target)) {
      return;
    }

    const otherTrigger = event.target.closest('.proto-info-trigger');
    if (otherTrigger) {
      return;
    }

    closePopover(true);
  }

  function onDocumentKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePopover(true);
    }
  }

  function initTrigger(trigger) {
    if (boundTriggers.has(trigger)) {
      return;
    }

    const panel = findPanel(trigger);
    normalizeTrigger(trigger, panel);

    trigger.addEventListener('click', onTriggerClick);
    trigger.addEventListener('keydown', onTriggerKeyDown);

    boundTriggers.add(trigger);
  }

  function initAllTriggers(root) {
    const buttons = (root || document).querySelectorAll('button.proto-info-trigger, button[aria-controls], button[data-proto-popover]');
    buttons.forEach(initTrigger);
  }

  initAllTriggers(document);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) {
          return;
        }
        if (node.matches && node.matches('button.proto-info-trigger, button[aria-controls], button[data-proto-popover]')) {
          initTrigger(node);
        }
        initAllTriggers(node);
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
