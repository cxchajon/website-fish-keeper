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

  function setSpacerHeight(root) {
    const spacer = document.getElementById('global-nav-spacer');
    if (!spacer) return;
    const height = root.offsetHeight;
    if (height > 0) {
      spacer.style.height = `${height}px`;
    }
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
    const drawerLinks = Array.from(drawer ? drawer.querySelectorAll('a') : []);
    const docEl = document.documentElement;
    const body = document.body;
    let previousFocus = null;
    let prevDocOverflow = docEl.style.overflow || '';
    let prevBodyOverflow = body.style.overflow || '';
    let overlayHideTimer = null;

    if (!overlay || !drawer || !openBtn) {
      return;
    }

    root.dataset.ttgNavReady = 'true';
    openBtn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    setSpacerHeight(root);

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
      if (drawerLinks.length) {
        window.requestAnimationFrame(() => {
          drawerLinks[0].focus();
        });
      } else {
        drawer.focus();
      }
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
      if (event.key === 'Escape' && root.dataset.open === 'true') {
        event.preventDefault();
        closeDrawer();
      }
    });

    syncActiveLinks(root);
    window.addEventListener('popstate', () => syncActiveLinks(root));
    window.addEventListener('hashchange', () => syncActiveLinks(root));
    window.addEventListener('pageshow', () => syncActiveLinks(root));
    window.addEventListener('resize', () => setSpacerHeight(root));
    window.addEventListener('load', () => setSpacerHeight(root));
    window.addEventListener('pageshow', () => setSpacerHeight(root));
  };
})();
