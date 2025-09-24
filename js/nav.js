(() => {
  function initNav() {
    const btn = document.querySelector('[data-nav="hamburger"]');
    const drawer = document.querySelector('[data-nav="drawer"]');
    const overlay = document.querySelector('[data-nav="overlay"]');
    const focusables = drawer ? drawer.querySelectorAll('a,button,[tabindex]:not([tabindex="-1"])') : [];
    let previousFocus = null;

    if (!btn || !drawer || !overlay) {
      return;
    }

    function isOpen() {
      return drawer.classList.contains('is-open');
    }

    function focusFirstItem() {
      if (!focusables || focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      if (first && typeof first.focus === 'function') {
        first.focus({ preventScroll: true });
      }
    }

    function openDrawer() {
      if (isOpen()) {
        return;
      }
      previousFocus = document.activeElement;
      drawer.classList.add('is-open');
      overlay.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      document.documentElement.dataset.scrollLock = 'on';
      focusFirstItem();
    }

    function closeDrawer() {
      if (!isOpen()) {
        return;
      }
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      delete document.documentElement.dataset.scrollLock;
      if (btn && typeof btn.focus === 'function') {
        btn.focus({ preventScroll: true });
      } else if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
      previousFocus = null;
    }

    function toggleDrawer() {
      if (isOpen()) {
        closeDrawer();
      } else {
        openDrawer();
      }
    }

    function handleKeydown(event) {
      if (!isOpen()) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      if (!focusables || focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (!drawer.contains(active) || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (!drawer.contains(active) || active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      toggleDrawer();
    });

    overlay.addEventListener('click', () => {
      closeDrawer();
    });

    document.addEventListener('keydown', handleKeydown);

    drawer.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (link) {
        closeDrawer();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
  } else {
    initNav();
  }
})();
