(() => {
  const root = document.getElementById('ttg-popover-root');
  if (!root) return;

  const FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const OUTSIDE_EVENTS = ['pointerdown', 'mousedown', 'touchstart'];
  let current = null;
  let repositionQueued = false;

  const focusFirst = (panel) => {
    if (!panel) return;
    const focusable = panel.querySelectorAll(FOCUSABLE_SELECTORS);
    for (const element of focusable) {
      if (element instanceof HTMLElement && !element.hasAttribute('disabled')) {
        try {
          element.focus({ preventScroll: true });
          return;
        } catch (error) {
          // ignore focus errors
        }
      }
    }
    if (typeof panel.focus === 'function') {
      try {
        panel.focus({ preventScroll: true });
      } catch (error) {
        // ignore focus errors
      }
    }
  };

  const placePanel = (trigger, panel) => {
    if (!trigger || !panel) return;
    const triggerRect = trigger.getBoundingClientRect();
    const gap = 8;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    panel.style.left = '0px';
    panel.style.top = '0px';
    const panelRect = panel.getBoundingClientRect();

    const minX = window.scrollX + 8;
    const maxX = window.scrollX + viewportWidth - panelRect.width - 8;
    const left = Math.round(Math.min(Math.max(window.scrollX + triggerRect.left, minX), Math.max(minX, maxX)));

    let top = window.scrollY + triggerRect.bottom + gap;
    let placement = 'bottom';

    const maxY = window.scrollY + viewportHeight - panelRect.height - gap;
    if (top > maxY && triggerRect.top - panelRect.height - gap >= 8) {
      top = Math.round(window.scrollY + triggerRect.top - panelRect.height - gap);
      placement = 'top';
    } else {
      top = Math.round(Math.min(top, Math.max(window.scrollY + 8, maxY)));
    }

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.dataset.infoPlacement = placement;
  };

  const queueReposition = () => {
    if (!current || repositionQueued) return;
    repositionQueued = true;
    requestAnimationFrame(() => {
      repositionQueued = false;
      if (current) {
        placePanel(current.trigger, current.panel);
      }
    });
  };

  const closeCurrent = (options = {}) => {
    const { returnFocus = true } = options;
    if (!current) return;
    const { trigger, panel, scope, previousFocus, onDocClick, onKeyDown, onCloseBtn } = current;

    OUTSIDE_EVENTS.forEach((evt) => document.removeEventListener(evt, onDocClick, true));
    document.removeEventListener('keydown', onKeyDown, true);

    const closeButtons = panel.querySelectorAll('[data-info-close]');
    closeButtons.forEach((btn) => btn.removeEventListener('click', onCloseBtn));

    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-open');
    trigger._ttgClose = null;

    scope?.classList.remove('is-open');
    scope?.removeAttribute('data-info-open');

    panel.classList.remove('is-open');
    panel.style.display = 'none';
    panel.style.visibility = '';
    panel.style.left = '';
    panel.style.top = '';
    panel.removeAttribute('data-info-placement');
    panel.removeAttribute('data-info-open');
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');

    const host = panel.__ttgOriginalHost || document.body;
    const next = panel.__ttgOriginalNext;
    if (host instanceof HTMLElement) {
      if (next && next.parentElement === host) {
        host.insertBefore(panel, next);
      } else {
        host.appendChild(panel);
      }
    }

    if (!root.querySelector('.ttg-popover-panel')) {
      root.setAttribute('aria-hidden', 'true');
    }

    if (returnFocus) {
      const focusTarget = (previousFocus && typeof previousFocus.focus === 'function') ? previousFocus : trigger;
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        // ignore focus errors
      }
    }

    current = null;
  };

  const openPopover = (trigger, panel) => {
    if (!trigger || !panel) return;
    if (current && current.panel === panel) {
      closeCurrent();
      return;
    }
    if (current && current.panel !== panel) {
      closeCurrent({ returnFocus: false });
    }

    const scope = trigger.closest('[data-info-scope]');
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;

    if (!panel.__ttgOriginalHost) {
      panel.__ttgOriginalHost = panel.parentElement;
      panel.__ttgOriginalNext = panel.nextSibling;
    }

    const role = panel.getAttribute('role');
    panel.setAttribute('role', role === 'tooltip' ? 'dialog' : role || 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.classList.add('ttg-popover-panel');

    root.appendChild(panel);
    root.removeAttribute('aria-hidden');

    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');
    scope?.classList.add('is-open');
    scope?.setAttribute('data-info-open', 'true');

    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('is-open');
    panel.setAttribute('data-info-open', 'true');
    panel.style.display = 'block';
    panel.style.visibility = 'hidden';

    const onDocClick = (event) => {
      const target = event.target;
      if (panel.contains(target) || trigger.contains(target)) {
        return;
      }
      closeCurrent();
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        closeCurrent();
      }
    };

    const onCloseBtn = (event) => {
      event.preventDefault();
      closeCurrent();
    };

    OUTSIDE_EVENTS.forEach((evt) => document.addEventListener(evt, onDocClick, true));
    document.addEventListener('keydown', onKeyDown, true);

    const closeButtons = panel.querySelectorAll('[data-info-close]');
    closeButtons.forEach((btn) => btn.addEventListener('click', onCloseBtn));

    current = {
      trigger,
      panel,
      scope,
      previousFocus,
      onDocClick,
      onKeyDown,
      onCloseBtn,
    };
    trigger._ttgClose = () => closeCurrent();

    requestAnimationFrame(() => {
      placePanel(trigger, panel);
      panel.style.visibility = 'visible';
      focusFirst(panel);
    });
  };

  const bind = (trigger) => {
    if (!(trigger instanceof HTMLElement)) return;
    const controlsId = trigger.getAttribute('aria-controls');
    if (!controlsId) return;
    const panel = document.getElementById(controlsId);
    if (!panel) return;

    if (!trigger.hasAttribute('aria-expanded')) {
      trigger.setAttribute('aria-expanded', 'false');
    }

    if (trigger.tagName !== 'BUTTON') {
      trigger.setAttribute('role', trigger.getAttribute('role') || 'button');
      trigger.setAttribute('tabindex', trigger.hasAttribute('tabindex') ? trigger.getAttribute('tabindex') : '0');
    }

    const toggle = (event) => {
      event.preventDefault();
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        if (typeof trigger._ttgClose === 'function') {
          trigger._ttgClose();
        } else if (current && current.trigger === trigger) {
          closeCurrent();
        }
      } else {
        openPopover(trigger, panel);
      }
      try {
        trigger.focus({ preventScroll: true });
      } catch (error) {
        // ignore focus errors
      }
    };

    trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        toggle(event);
      } else if ((event.key === 'Escape' || event.key === 'Esc') && current && current.trigger === trigger) {
        event.preventDefault();
        closeCurrent();
      }
    });
  };

  const triggers = document.querySelectorAll(
    '#stocking-tip-btn, .ttg-info-btn, .tooltip-trigger, [aria-haspopup="dialog"], [aria-controls]'
  );
  triggers.forEach(bind);

  window.addEventListener('resize', queueReposition);
  window.addEventListener('scroll', queueReposition, true);
})();
