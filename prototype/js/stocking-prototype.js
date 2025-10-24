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

    const getButton = (scope) => scope?.querySelector('[data-info-btn]');
    const getPopover = (scope) => scope?.querySelector('[data-info-pop]');

    let openScope = null;

    const closeScope = (scope, { returnFocus = true } = {}) => {
      if (!scope) return;
      const btn = getButton(scope);
      const pop = getPopover(scope);

      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
      }
      if (pop && !pop.hidden) {
        pop.hidden = true;
      }
      scope.classList.remove('is-open');

      if (returnFocus && btn && typeof btn.focus === 'function') {
        btn.focus();
      }

      if (openScope === scope) {
        openScope = null;
      }
    };

    const openScopeFor = (scope) => {
      if (!scope) return;
      const btn = getButton(scope);
      const pop = getPopover(scope);
      if (!btn || !pop) return;

      pop.hidden = false;
      scope.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      openScope = scope;
    };

    scopeRoot.addEventListener('click', (event) => {
      const closeTrigger = event.target.closest('[data-info-close]');
      if (closeTrigger && scopeRoot.contains(closeTrigger)) {
        const scope = closeTrigger.closest('[data-info-scope]');
        if (scope) {
          event.preventDefault();
          event.stopPropagation();
          closeScope(scope);
        }
        return;
      }

      const btn = event.target.closest('[data-info-btn]');
      if (!btn || !scopeRoot.contains(btn)) return;

      const scope = btn.closest('[data-info-scope]');
      if (!scope) return;

      event.preventDefault();
      event.stopPropagation();

      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        closeScope(scope);
        return;
      }

      if (openScope && openScope !== scope) {
        closeScope(openScope, { returnFocus: false });
      }

      openScopeFor(scope);
    });

    document.addEventListener('click', (event) => {
      if (!openScope) return;
      if (!scopeRoot.contains(event.target)) {
        closeScope(openScope);
        return;
      }

      if (openScope.contains(event.target)) {
        return;
      }

      closeScope(openScope);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !openScope) return;
      event.preventDefault();
      closeScope(openScope);
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
