(() => {
  const NAV_VERSION = '1.1.0';
  const NAV_PLACEHOLDER_ID = 'site-nav';

  if (window.__TTG_NAV_LOADER__) {
    return;
  }
  window.__TTG_NAV_LOADER__ = true;

  function normalizePath(path) {
    if (!path) {
      return '/';
    }
    try {
      const url = new URL(path, window.location.origin);
      let pathname = url.pathname.replace(/\/+$/u, '');
      if (pathname === '' || pathname === '/' || pathname === '/index.html') {
        return '/';
      }
      return pathname;
    } catch (error) {
      console.warn('Failed to normalise path', path, error);
      return path;
    }
  }

  function markActiveLinks(root) {
    if (!root) {
      return;
    }
    const here = normalizePath(window.location.pathname);
    const links = root.querySelectorAll('.nav__list a');
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) {
        return;
      }
      const target = normalizePath(href);
      if (target === here) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function initNav() {
    const header = document.querySelector('.site-header');
    if (!header || header.dataset.navReady === 'true') {
      return;
    }
    const toggle = header.querySelector('.nav-toggle');
    const nav = header.querySelector('#primary-nav');
    const backdrop = header.querySelector('.nav-backdrop');
    if (!toggle || !nav || !backdrop) {
      return;
    }

    function closeMenu(focusEl) {
      header.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      backdrop.setAttribute('hidden', '');
      document.removeEventListener('keydown', onKeydown);
      if (focusEl && typeof focusEl.focus === 'function') {
        focusEl.focus({ preventScroll: true });
      }
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        closeMenu(toggle);
      }
    }

    function openMenu() {
      header.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      backdrop.removeAttribute('hidden');
      document.addEventListener('keydown', onKeydown);
      const firstLink = nav.querySelector('a');
      if (firstLink instanceof HTMLElement) {
        firstLink.focus({ preventScroll: true });
      }
    }

    toggle.addEventListener('click', () => {
      if (header.classList.contains('is-open')) {
        closeMenu(toggle);
      } else {
        openMenu();
      }
    });

    backdrop.addEventListener('click', () => {
      closeMenu(toggle);
    });

    nav.addEventListener('click', (event) => {
      const link = event.target instanceof HTMLElement ? event.target.closest('a') : null;
      if (!link) {
        return;
      }
      if (window.matchMedia('(min-width: 768px)').matches) {
        return;
      }
      closeMenu();
    });

    window.addEventListener('resize', () => {
      if (window.matchMedia('(min-width: 768px)').matches) {
        closeMenu();
      }
    });

    markActiveLinks(header);
    header.dataset.navReady = 'true';
  }

  async function mountNav() {
    const host = document.getElementById(NAV_PLACEHOLDER_ID);
    const legacy = document.getElementById('global-nav');
    const target = host ?? legacy;

    if (!target) {
      initNav();
      return;
    }

    try {
      const response = await fetch(`nav.html?v=${NAV_VERSION}`, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Failed to fetch nav: ${response.status}`);
      }
      const markup = await response.text();
      target.outerHTML = markup;
      initNav();
    } catch (error) {
      console.error('Navigation failed to initialise', error);
      initNav();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountNav);
  } else {
    mountNav();
  }
})();
