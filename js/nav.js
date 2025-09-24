(function () {
  const OVERLAY_HIDE_DELAY = 320;
  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  function normalizePath(path) {
    try {
      path = new URL(path, window.location.origin).pathname;
    } catch (error) {
      path = path || '/';
    }

    path = path.replace(/index\.html$/i, '');
    path = path.replace(/\/+$/g, '');

    if (!path) {
      return '/';
    }

    return path;
  }

  function syncActiveLinks(root) {
    const current = normalizePath(window.location.pathname);
    const linkNodes = root.querySelectorAll('.links a, #ttg-drawer a');

    linkNodes.forEach((link) => {
      const target = normalizePath(link.getAttribute('href') || '');
      if (target === current) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function getFocusableElements(container) {
    if (!container) return [];
    const elements = container.querySelectorAll(FOCUSABLE_SELECTOR);
    return Array.from(elements).filter((element) => {
      if (element.hasAttribute('disabled')) return false;
      if (element.getAttribute('aria-hidden') === 'true') return false;
      if (element.tabIndex === -1) return false;
      return !!(
        element.offsetWidth ||
        element.offsetHeight ||
        element.getClientRects().length
      );
    });
  }

  window.__initTTGNav = function __initTTGNav() {
    const root = document.getElementById('global-nav');
    if (!root || root.dataset.ttgNavReady === 'true') {
      return;
    }

    const overlay = root.querySelector('#ttg-overlay');
    const drawer = root.querySelector('#ttg-drawer');
    const openBtn = root.querySelector('#ttg-nav-open');
    const closeBtn = root.querySelector('#ttg-nav-close');
    const docEl = document.documentElement;
    const body = document.body;
    let previousFocus = null;
    let prevDocOverflow = docEl.style.overflow || '';
    let prevBodyOverflow = body.style.overflow || '';
    let overlayHideTimer = null;
    let focusableElements = [];

    if (!overlay || !drawer || !openBtn) {
      return;
    }

    root.dataset.ttgNavReady = 'true';
    openBtn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;

    function openDrawer() {
      if (root.dataset.open === 'true') return;
      window.clearTimeout(overlayHideTimer);
      overlay.hidden = false;
      previousFocus = document.activeElement;
      prevDocOverflow = docEl.style.overflow || '';
      prevBodyOverflow = body.style.overflow || '';
      root.dataset.open = 'true';
      drawer.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      docEl.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      window.requestAnimationFrame(() => {
        focusableElements = getFocusableElements(drawer);
        const preferred = drawer.querySelector('.drawer a');
        const target =
          (preferred && focusableElements.includes(preferred) && preferred) ||
          focusableElements[0] ||
          drawer;
        if (typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
      });
    }

    function closeDrawer(options = {}) {
      if (root.dataset.open !== 'true') return;
      const { returnFocus = true } = options;
      root.dataset.open = 'false';
      drawer.setAttribute('aria-hidden', 'true');
      openBtn.setAttribute('aria-expanded', 'false');
      docEl.style.overflow = prevDocOverflow;
      body.style.overflow = prevBodyOverflow;
      overlayHideTimer = window.setTimeout(() => {
        if (root.dataset.open !== 'true') {
          overlay.hidden = true;
        }
      }, OVERLAY_HIDE_DELAY);
      focusableElements = [];
      if (returnFocus && previousFocus) {
        window.requestAnimationFrame(() => {
          if (typeof previousFocus.focus === 'function') {
            previousFocus.focus();
          } else {
            openBtn.focus();
          }
        });
      }
      previousFocus = null;
    }

    openBtn.addEventListener('click', openDrawer);
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeDrawer());
    }
    overlay.addEventListener('click', () => closeDrawer());
    drawer.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (link) {
        closeDrawer({ returnFocus: false });
      }
    });

    document.addEventListener('keydown', (event) => {
      if (root.dataset.open === 'true' && event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (root.dataset.open === 'true' && event.key === 'Tab') {
        focusableElements = getFocusableElements(drawer);
        if (focusableElements.length === 0) {
          event.preventDefault();
          drawer.focus({ preventScroll: true });
          return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
          if (active === first || !drawer.contains(active)) {
            event.preventDefault();
            last.focus({ preventScroll: true });
          }
        } else if (active === last) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    });

    document.addEventListener('focusin', (event) => {
      if (root.dataset.open !== 'true') return;
      if (!drawer.contains(event.target)) {
        focusableElements = getFocusableElements(drawer);
        const target = focusableElements[0] || drawer;
        if (typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
      }
    });

    syncActiveLinks(root);
    window.addEventListener('popstate', () => syncActiveLinks(root));
    window.addEventListener('hashchange', () => syncActiveLinks(root));
    window.addEventListener('pageshow', () => syncActiveLinks(root));
  };
})();
