(() => {
  const NAV_VERSION = '1.0.7';
  const NAV_PLACEHOLDER_ID = 'site-nav';
  const HOME_PATH = '/index.html';

  if (window.__TTG_NAV_LOADER__) {
    return;
  }
  window.__TTG_NAV_LOADER__ = true;

  function normalizePath(path) {
    if (!path) {
      return HOME_PATH;
    }
    try {
      const url = new URL(path, window.location.origin);
      let pathname = url.pathname.replace(/\/+$/u, '');
      if (pathname === '' || pathname === '/') {
        pathname = HOME_PATH;
      }
      return pathname;
    } catch (error) {
      console.warn('Failed to normalise path', path, error);
      return path;
    }
  }

  function markActiveLinks(root) {
    const here = normalizePath(window.location.pathname);
    const links = root.querySelectorAll('.links a, #ttg-drawer a');
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) {
        return;
      }
      const target = normalizePath(href);
      if (target === here || (target === HOME_PATH && here === HOME_PATH)) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function initNav() {
    const root = document.getElementById('global-nav');
    if (!root || root.dataset.navReady === 'true') {
      return;
    }

    const openBtn = root.querySelector('#ttg-nav-open');
    const closeBtn = root.querySelector('#ttg-nav-close');
    const overlay = root.querySelector('#ttg-overlay');
    const drawer = root.querySelector('#ttg-drawer');
    const focusTargets = drawer ? drawer.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])') : null;

    if (!openBtn || !overlay || !drawer) {
      return;
    }

    let previousFocus = null;

    const closeDrawer = () => {
      if (root.getAttribute('data-open') !== 'true') {
        return;
      }
      root.removeAttribute('data-open');
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      drawer.setAttribute('aria-hidden', 'true');
      openBtn.setAttribute('aria-expanded', 'false');
      delete document.documentElement.dataset.scrollLock;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      const target = openBtn instanceof HTMLElement ? openBtn : previousFocus;
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
      previousFocus = null;
    };

    const openDrawer = () => {
      if (root.getAttribute('data-open') === 'true') {
        return;
      }
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      root.setAttribute('data-open', 'true');
      drawer.classList.add('is-open');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      drawer.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      document.documentElement.dataset.scrollLock = 'on';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      window.requestAnimationFrame(() => {
        if (!focusTargets || focusTargets.length === 0) {
          return;
        }
        const first = focusTargets[0];
        if (first instanceof HTMLElement) {
          first.focus({ preventScroll: true });
        }
      });
    };

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    };

    openBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openDrawer();
    });

    closeBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      closeDrawer();
    });

    overlay.addEventListener('click', () => {
      closeDrawer();
    });

    drawer.addEventListener('click', (event) => {
      const link = event.target instanceof HTMLElement ? event.target.closest('a') : null;
      if (link) {
        closeDrawer();
      }
    });

    if (!root.__ttgEscHandler) {
      document.addEventListener('keydown', handleKeydown);
      root.__ttgEscHandler = handleKeydown;
    }

    markActiveLinks(root);
    root.dataset.navReady = 'true';
    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
  }

  async function mountNav() {
    const host = document.getElementById(NAV_PLACEHOLDER_ID);
    if (!host) {
      return;
    }
    try {
      const response = await fetch(`nav.html?v=${NAV_VERSION}`, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Failed to fetch nav: ${response.status}`);
      }
      const markup = await response.text();
      host.outerHTML = markup;
      initNav();
    } catch (error) {
      console.error('Navigation failed to initialise', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountNav);
  } else {
    mountNav();
  }

  window.ttgInitNav = initNav;
})();
