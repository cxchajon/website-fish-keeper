(function () {
  const btn = document.querySelector('[data-nav="hamburger"]');
  const drawer = document.querySelector('[data-nav="drawer"]');
  const overlay = document.querySelector('[data-nav="overlay"]');
  const links = drawer ? drawer.querySelectorAll('a, button') : [];
  const html = document.documentElement;
  const body = document.body;
  let previousFocus = null;
  let overlayHideTimer = null;
  const previousBodyStyles = {
    overflow: '',
    position: '',
  };

  if (!btn || !drawer || !overlay) {
    return;
  }

  const focusables = () => Array.from(links).filter((el) => !el.hasAttribute('disabled'));

  function showOverlay() {
    window.clearTimeout(overlayHideTimer);
    overlay.hidden = false;
    overlay.classList.add('is-open');
  }

  function hideOverlay() {
    overlay.classList.remove('is-open');
    overlayHideTimer = window.setTimeout(() => {
      if (!drawer.classList.contains('is-open')) {
        overlay.hidden = true;
      }
    }, 200);
  }

  function openDrawer() {
    if (drawer.classList.contains('is-open')) {
      return;
    }

    previousBodyStyles.overflow = body.style.overflow;
    previousBodyStyles.position = body.style.position;

    showOverlay();
    drawer.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    html.setAttribute('data-scroll-lock', 'on');
    body.style.overflow = 'hidden';
    if (!previousBodyStyles.position) {
      body.style.position = 'relative';
    }

    previousFocus = document.activeElement;

    const [firstFocusable] = focusables();
    window.requestAnimationFrame(() => {
      if (firstFocusable && typeof firstFocusable.focus === 'function') {
        firstFocusable.focus({ preventScroll: true });
      } else if (typeof drawer.focus === 'function') {
        drawer.focus({ preventScroll: true });
      }
    });
  }

  function closeDrawer() {
    if (!drawer.classList.contains('is-open')) {
      return;
    }

    hideOverlay();
    drawer.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    html.removeAttribute('data-scroll-lock');
    body.style.overflow = previousBodyStyles.overflow;
    body.style.position = previousBodyStyles.position;

    const focusTarget = previousFocus && typeof previousFocus.focus === 'function' ? previousFocus : btn;
    previousFocus = null;
    window.requestAnimationFrame(() => {
      focusTarget.focus({ preventScroll: true });
    });
  }

  function toggleDrawer() {
    if (drawer.classList.contains('is-open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  btn.addEventListener('click', (event) => {
    event.preventDefault();
    toggleDrawer();
  });

  overlay.addEventListener('click', () => {
    closeDrawer();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
      event.preventDefault();
      closeDrawer();
    }
  });

  drawer.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link) {
      closeDrawer();
    }
  });

  drawer.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !drawer.classList.contains('is-open')) {
      return;
    }

    const focusableItems = focusables();
    if (focusableItems.length === 0) {
      event.preventDefault();
      drawer.focus({ preventScroll: true });
      return;
    }

    const first = focusableItems[0];
    const last = focusableItems[focusableItems.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || active === drawer) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  });
})();
