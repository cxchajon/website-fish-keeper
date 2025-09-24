// Updated: Streamlined navigation initialization for consistent drawer behavior, focus handoff, and scroll locking.
(function () {
  const OVERLAY_HIDE_DELAY = 320;

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

  window.__initTTGNav = function __initTTGNav() {
    const root = document.getElementById('global-nav');
    if (!root || root.dataset.ttgNavReady === 'true') {
      return;
    }

    const overlay = root.querySelector('#ttg-overlay');
    const drawer = root.querySelector('#ttg-drawer');
    const openBtn = root.querySelector('#ttg-nav-open');
    const closeBtn = root.querySelector('#ttg-nav-close');
    const body = document.body;
    let previousFocus = null;
    let overlayHideTimer = null;
    let scrollPosition = 0;
    const prevBodyStyles = {
      position: '',
      top: '',
      width: '',
      left: '',
      right: '',
      overflow: '',
    };

    if (!overlay || !drawer || !openBtn) {
      return;
    }

    root.dataset.ttgNavReady = 'true';
    openBtn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;

    function lockBodyScroll() {
      scrollPosition = window.scrollY || window.pageYOffset || 0;
      prevBodyStyles.position = body.style.position || '';
      prevBodyStyles.top = body.style.top || '';
      prevBodyStyles.left = body.style.left || '';
      prevBodyStyles.right = body.style.right || '';
      prevBodyStyles.width = body.style.width || '';
      prevBodyStyles.overflow = body.style.overflow || '';
      body.style.position = 'fixed';
      body.style.top = `-${scrollPosition}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    }

    function unlockBodyScroll() {
      body.style.position = prevBodyStyles.position;
      body.style.top = prevBodyStyles.top;
      body.style.left = prevBodyStyles.left;
      body.style.right = prevBodyStyles.right;
      body.style.width = prevBodyStyles.width;
      body.style.overflow = prevBodyStyles.overflow;
      window.scrollTo(0, scrollPosition);
    }

    function openDrawer() {
      if (root.dataset.open === 'true') return;
      window.clearTimeout(overlayHideTimer);
      overlay.hidden = false;
      previousFocus = document.activeElement;
      root.dataset.open = 'true';
      drawer.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      lockBodyScroll();
      window.requestAnimationFrame(() => {
        const target = drawer.querySelector('.drawer a') || drawer;
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
      unlockBodyScroll();
      overlayHideTimer = window.setTimeout(() => {
        if (root.dataset.open !== 'true') {
          overlay.hidden = true;
        }
      }, OVERLAY_HIDE_DELAY);
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
    });

    syncActiveLinks(root);
    window.addEventListener('popstate', () => syncActiveLinks(root));
    window.addEventListener('hashchange', () => syncActiveLinks(root));
    window.addEventListener('pageshow', () => syncActiveLinks(root));
  };
})();
