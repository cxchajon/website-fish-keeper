(function () {
  const body = document.querySelector('body.page--prototype-home');
  if (!body) return;

  const openButton = body.querySelector('#how-it-works-button');
  const overlay = body.querySelector('[data-how-it-works-overlay]');
  const modal = overlay ? overlay.querySelector('.how-it-works-modal') : null;
  const closeButtons = overlay ? Array.from(overlay.querySelectorAll('[data-close-modal]')) : [];
  const bodyScrollLockClass = 'body--modal-open';

  const focusableSelectors = [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled])',
    'input[type="text"]:not([disabled])',
    'input[type="radio"]:not([disabled])',
    'input[type="checkbox"]:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  if (!openButton || !overlay || !modal) {
    return;
  }

  let lastFocusedElement = null;

  const setAriaState = (expanded) => {
    openButton.setAttribute('aria-expanded', String(expanded));
    overlay.setAttribute('aria-hidden', String(!expanded));
  };

  const getFocusableItems = () => Array.from(modal.querySelectorAll(focusableSelectors));

  const focusFirstElement = () => {
    const focusableItems = getFocusableItems();
    const target = focusableItems.length ? focusableItems[0] : modal;
    target.focus({ preventScroll: true });
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableItems = getFocusableItems();
    if (!focusableItems.length) {
      event.preventDefault();
      modal.focus({ preventScroll: true });
      return;
    }

    const first = focusableItems[0];
    const last = focusableItems[focusableItems.length - 1];

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  };

  const closeModal = () => {
    if (overlay.hidden) return;

    overlay.classList.remove('is-visible');

    const finalizeClose = () => {
      overlay.hidden = true;
      overlay.removeEventListener('transitionend', finalizeClose);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finalizeClose();
    } else {
      overlay.addEventListener('transitionend', finalizeClose, { once: true });
      window.setTimeout(finalizeClose, 350);
    }

    body.classList.remove(bodyScrollLockClass);
    document.removeEventListener('keydown', handleKeydown, true);
    setAriaState(false);

    if (lastFocusedElement) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  };

  const openModal = () => {
    if (!overlay.hidden) return;

    lastFocusedElement = document.activeElement;
    overlay.hidden = false;
    window.requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
    });

    body.classList.add(bodyScrollLockClass);
    document.addEventListener('keydown', handleKeydown, true);
    setAriaState(true);

    window.setTimeout(focusFirstElement, 50);
  };

  openButton.addEventListener('click', openModal);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', closeModal);
  });
})();
