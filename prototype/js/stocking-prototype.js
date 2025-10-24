(() => {
  document.documentElement.classList.add('prototype-mode');

  const fireProtoEvent = (eventName) => {
    if (!eventName) return;
    try {
      const analytics = window.saProtoAnalytics;
      if (analytics && typeof analytics.emit === 'function') {
        analytics.emit(eventName);
        return;
      }

      const dataLayer = window.dataLayer;
      if (Array.isArray(dataLayer) && typeof dataLayer.push === 'function') {
        dataLayer.push({ event: eventName });
      }
    } catch (error) {
      // Silently swallow to avoid breaking prototype experiences
    }
  };

  const setupHowItWorksModal = () => {
    const trigger =
      document.querySelector('.sa-proto-howitworks-trigger') ||
      document.querySelector('[data-sa-proto-modal-trigger="how-it-works"]');
    const modal =
      document.getElementById('sa-proto-howitworks') ||
      document.querySelector('[data-sa-proto-modal]');
    if (!trigger || !modal) return;

    const closeButton = modal.querySelector('[data-sa-proto-modal-close]');
    const announcer = document.querySelector('[data-sa-proto-modal-announcer]');
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea',
      'input',
      'select',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    let lastFocusedElement = null;
    let closeTimer = null;
    let focusTimer = null;

    const setExpanded = (state) => {
      trigger.setAttribute('aria-expanded', state ? 'true' : 'false');
    };

    const announceOpen = () => {
      if (announcer) {
        announcer.textContent = 'How it works dialog opened.';
      }
    };

    const focusTrap = (event) => {
      if (event.key !== 'Tab') return;
      const focusable = modal.querySelectorAll(focusableSelectors);
      if (!focusable.length) return;

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

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    };

    const openModal = () => {
      if (modal.classList.contains('is-active')) return;

      lastFocusedElement = document.activeElement;
      if (closeTimer) {
        window.clearTimeout(closeTimer);
        closeTimer = null;
      }
      if (focusTimer) {
        window.clearTimeout(focusTimer);
        focusTimer = null;
      }

      modal.hidden = false;
      document.body.classList.add('sa-proto-modal-open');

      requestAnimationFrame(() => {
        modal.classList.add('is-active');
        closeButton?.focus();
      });

      setExpanded(true);
      announceOpen();
      fireProtoEvent('sa_proto_how_it_works_opened');

      modal.addEventListener('keydown', focusTrap);
      document.addEventListener('keydown', handleEscape);
    };

    const finishClose = () => {
      modal.hidden = true;
    };

    const closeModal = () => {
      if (!modal.classList.contains('is-active')) return;

      modal.classList.remove('is-active');
      document.body.classList.remove('sa-proto-modal-open');
      setExpanded(false);
      fireProtoEvent('sa_proto_how_it_works_closed');

      if (announcer) {
        announcer.textContent = '';
      }

      modal.removeEventListener('keydown', focusTrap);
      document.removeEventListener('keydown', handleEscape);

      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (prefersReducedMotion) {
        finishClose();
      } else {
        closeTimer = window.setTimeout(() => {
          finishClose();
          closeTimer = null;
        }, 240);
      }

      const returnFocus = () => {
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
          lastFocusedElement.focus();
        } else {
          trigger.focus();
        }
      };

      const focusDelay = prefersReducedMotion ? 0 : 260;
      focusTimer = window.setTimeout(() => {
        returnFocus();
        focusTimer = null;
      }, focusDelay);
    };

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openModal();
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal();
      }
    });

    closeButton?.addEventListener('click', (event) => {
      event.preventDefault();
      closeModal();
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  };

  const initInfoPopovers = () => {
    const scopeRoot = document.querySelector('.prototype-stock-page');
    if (!scopeRoot) return;

    const SCOPE_SELECTOR = '[data-info-scope]';
    const BUTTON_SELECTOR = '[data-info-btn]';
    const POPOVER_SELECTOR = '[data-info-pop]';
    const OUTSIDE_EVENTS = ['pointerdown', 'mousedown', 'touchstart'];

    let idCounter = 0;
    let openState = null;

    const getElements = (scope) => {
      if (!scope) return null;
      const trigger = scope.querySelector(BUTTON_SELECTOR);
      const popover = scope.querySelector(POPOVER_SELECTOR);
      if (!(trigger instanceof HTMLElement) || !(popover instanceof HTMLElement)) {
        return null;
      }
      return { scope, trigger, popover };
    };

    const ensureIds = (pair) => {
      if (!pair) return;
      const { trigger, popover } = pair;
      if (!trigger.id) {
        idCounter += 1;
        trigger.id = `proto-info-trigger-${idCounter}`;
      }
      if (!popover.id) {
        popover.id = `${trigger.id}-popover`;
      }
    };

    const applyAria = (pair) => {
      if (!pair) return;
      const { trigger, popover } = pair;
      trigger.setAttribute('type', trigger.getAttribute('type') || 'button');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', popover.id);
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-describedby', popover.id);
      trigger.classList.remove('is-open');

      popover.setAttribute('role', popover.getAttribute('role') || 'tooltip');
      popover.setAttribute('tabindex', popover.getAttribute('tabindex') || '-1');
      popover.setAttribute('aria-hidden', 'true');
      popover.removeAttribute('aria-modal');
      popover.hidden = true;
      popover.classList.remove('is-open');
      delete popover.dataset.infoPlacement;
    };

    const hidePopover = (pair) => {
      if (!pair) return;
      const { scope, trigger, popover } = pair;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.classList.remove('is-open');
      scope.classList.remove('is-open');
      scope.removeAttribute('data-info-open');
      popover.hidden = true;
      popover.setAttribute('aria-hidden', 'true');
      popover.classList.remove('is-open');
      popover.removeAttribute('data-info-open');
      popover.removeAttribute('data-info-placement');
      popover.style.left = '';
      popover.style.top = '';
      popover.style.minWidth = '';
      popover.style.maxWidth = '';
      popover.style.visibility = '';
      popover.style.pointerEvents = '';
    };

    const repositionActive = () => {
      if (!openState) return;
      const { scope, trigger, popover } = openState;
      if (popover.hidden) {
        return;
      }

      const gap = Number.parseFloat(popover.dataset.infoGap || '10');
      const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
      const gutter = 12;

      popover.style.visibility = 'hidden';
      popover.style.pointerEvents = 'none';
      popover.style.left = '0px';
      popover.style.top = '0px';

      const computedMax = Math.min(320, Math.max(180, viewportWidth - (gutter * 2)));
      const computedMin = Math.min(240, computedMax);
      popover.style.maxWidth = `${computedMax}px`;
      popover.style.minWidth = `${computedMin}px`;

      const scopeRect = scope.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();

      let viewportLeft = triggerRect.left + (triggerRect.width / 2) - (popRect.width / 2);
      viewportLeft = Math.max(gutter, Math.min(viewportLeft, viewportWidth - popRect.width - gutter));
      const relativeLeft = viewportLeft - scopeRect.left;

      let placement = 'bottom';
      let viewportTop = triggerRect.bottom + gap;
      if (viewportTop + popRect.height > viewportHeight - gutter && (triggerRect.top - gap - popRect.height) > gutter) {
        placement = 'top';
        viewportTop = triggerRect.top - gap - popRect.height;
      }
      const relativeTop = viewportTop - scopeRect.top;

      popover.style.left = `${Math.round(relativeLeft)}px`;
      popover.style.top = `${Math.round(relativeTop)}px`;
      popover.dataset.infoPlacement = placement;
      popover.style.visibility = '';
      popover.style.pointerEvents = '';
    };

    const detachGlobalListeners = () => {
      OUTSIDE_EVENTS.forEach((evt) => document.removeEventListener(evt, handleOutside, true));
      document.removeEventListener('keydown', handleEscape, true);
      window.removeEventListener('resize', repositionActive);
      window.removeEventListener('scroll', repositionActive, true);
    };

    const closeActive = ({ returnFocus = true } = {}) => {
      if (!openState) return;
      const { trigger, popover, scope, lastFocus } = openState;
      hidePopover(openState);
      detachGlobalListeners();

      const focusTarget = returnFocus && (lastFocus instanceof HTMLElement ? lastFocus : trigger);
      openState = null;

      if (focusTarget && typeof focusTarget.focus === 'function') {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch (error) {
          // ignore focus errors
        }
      }
    };

    const handleOutside = (event) => {
      if (!openState) return;
      const { scope } = openState;
      if (scope.contains(event.target)) {
        return;
      }
      closeActive();
    };

    const handleEscape = (event) => {
      if (!openState) return;
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        event.stopPropagation();
        closeActive();
      }
    };

    const openScope = (pair) => {
      if (!pair) return;
      if (openState && openState.scope === pair.scope) {
        closeActive();
        return;
      }
      if (openState && openState.scope !== pair.scope) {
        closeActive({ returnFocus: false });
      }

      const { scope, trigger, popover } = pair;
      const lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;

      popover.hidden = false;
      popover.setAttribute('aria-hidden', 'false');
      popover.classList.add('is-open');
      popover.setAttribute('data-info-open', 'true');

      scope.classList.add('is-open');
      scope.setAttribute('data-info-open', 'true');

      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('is-open');

      openState = { scope, trigger, popover, lastFocus };

      repositionActive();

      try {
        trigger.focus({ preventScroll: true });
      } catch (error) {
        // ignore focus errors
      }

      OUTSIDE_EVENTS.forEach((evt) => document.addEventListener(evt, handleOutside, true));
      document.addEventListener('keydown', handleEscape, true);
      window.addEventListener('resize', repositionActive);
      window.addEventListener('scroll', repositionActive, true);
    };

    const handleTriggerClick = (event) => {
      const trigger = event.currentTarget;
      const scope = trigger.closest(SCOPE_SELECTOR);
      const pair = getElements(scope);
      if (!pair) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openScope(pair);
    };

    const handleTriggerKeydown = (event) => {
      const trigger = event.currentTarget;
      const scope = trigger.closest(SCOPE_SELECTOR);
      const pair = getElements(scope);
      if (!pair) {
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openScope(pair);
      } else if ((event.key === 'Escape' || event.key === 'Esc') && openState && openState.scope === scope) {
        event.preventDefault();
        closeActive();
      }
    };

    const bindCloseButtons = (pair) => {
      const { popover } = pair;
      popover.querySelectorAll('[data-info-close]').forEach((closeBtn) => {
        closeBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          closeActive();
        });
      });

      popover.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
          if (openState && openState.popover === popover) {
            event.preventDefault();
            event.stopPropagation();
            closeActive();
          }
        }
      });
    };

    const stopEvent = (event) => {
      event.stopPropagation();
    };

    scopeRoot.querySelectorAll(SCOPE_SELECTOR).forEach((scope) => {
      const pair = getElements(scope);
      if (!pair) {
        return;
      }

      ensureIds(pair);
      applyAria(pair);
      bindCloseButtons(pair);

      const { trigger, popover } = pair;

      trigger.addEventListener('click', handleTriggerClick);
      trigger.addEventListener('keydown', handleTriggerKeydown);
      trigger.addEventListener('pointerdown', stopEvent);
      trigger.addEventListener('mousedown', stopEvent);

      popover.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    });
  };

  const setupFeatureCta = () => {
    const cta = document.querySelector('.sa-proto-feature-primary[data-sa-proto-feature-cta]');
    if (!cta) return;

    cta.addEventListener('click', () => {
      fireProtoEvent('sa_proto_feature_tank_cta_clicked');
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    setupHowItWorksModal();
    initInfoPopovers();
    setupFeatureCta();
  });

  const adSlots = document.querySelectorAll('[data-prototype-ad]');
  adSlots.forEach((slot) => {
    slot.setAttribute('role', 'complementary');
    slot.setAttribute('aria-label', 'Advertisement placeholder');
  });

  window.addEventListener('load', () => {
    const plantedToggle = document.querySelector('#stocking-planted');
    if (!plantedToggle) return;

    const status = document.getElementById('stocking-status');
    if (status) {
      status.setAttribute('aria-live', 'polite');
    }

    plantedToggle.addEventListener('change', () => {
      document.querySelector('main.stocking-page')?.classList.toggle('is-planted', plantedToggle.checked);
    });
  });
})();
