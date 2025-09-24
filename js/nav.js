(() => {
  const doc = document;
  const docEl = doc.documentElement;
  const state = { observer: null };

  function normalizePath(pathname) {
    if (!pathname) {
      return '/';
    }
    let normalized = pathname;
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    normalized = normalized.replace(/index\.html$/i, '');
    normalized = normalized.replace(/\/+$/, '');
    if (normalized === '') {
      normalized = '/';
    }
    return normalized.toLowerCase();
  }

  function markActiveLinks(root) {
    const current = normalizePath(window.location.pathname);
    const links = root.querySelectorAll('.nav__link');

    links.forEach((link) => {
      try {
        const url = new URL(link.getAttribute('href'), window.location.href);
        if (url.origin !== window.location.origin) {
          link.removeAttribute('aria-current');
          return;
        }
        const linkPath = normalizePath(url.pathname);
        if (linkPath === current) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      } catch (error) {
        link.removeAttribute('aria-current');
      }
    });
  }

  function bindNav() {
    const root = doc.getElementById('global-nav');
    if (!root || root.dataset.navBound === 'true') {
      return root && root.dataset.navBound === 'true';
    }

    const openBtn = root.querySelector('#ttg-nav-open');
    const closeBtn = root.querySelector('#ttg-nav-close');
    const overlay = root.querySelector('#ttg-overlay');
    const drawer = root.querySelector('#ttg-drawer');

    if (!openBtn || !closeBtn || !overlay || !drawer) {
      return false;
    }

    root.dataset.navBound = 'true';
    markActiveLinks(root);

    let previousFocus = null;

    function focusFirstLink() {
      const first = drawer.querySelector('a, button');
      if (!first) {
        return;
      }
      requestAnimationFrame(() => {
        if (typeof first.focus === 'function') {
          first.focus({ preventScroll: true });
        }
      });
    }

    function closeNav() {
      if (!root.hasAttribute('data-open')) {
        return;
      }
      root.removeAttribute('data-open');
      openBtn.setAttribute('aria-expanded', 'false');
      docEl.style.overflow = '';
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus({ preventScroll: true });
      } else {
        openBtn.focus({ preventScroll: true });
      }
      previousFocus = null;
    }

    function openNav() {
      if (root.getAttribute('data-open') === 'true') {
        return;
      }
      previousFocus = doc.activeElement;
      root.setAttribute('data-open', 'true');
      openBtn.setAttribute('aria-expanded', 'true');
      docEl.style.overflow = 'hidden';
      focusFirstLink();
    }

    function handleEscape(event) {
      if (event.key === 'Escape' && root.getAttribute('data-open') === 'true') {
        event.preventDefault();
        closeNav();
      }
    }

    openBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openNav();
    });

    closeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      closeNav();
    });

    overlay.addEventListener('click', () => {
      closeNav();
    });

    doc.addEventListener('keydown', handleEscape);

    drawer.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (link) {
        closeNav();
      }
    });

    return true;
  }

  function watchForNav() {
    if (bindNav()) {
      return;
    }

    if (state.observer) {
      return;
    }

    state.observer = new MutationObserver(() => {
      if (bindNav()) {
        state.observer.disconnect();
        state.observer = null;
      }
    });

    state.observer.observe(doc.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  watchForNav();
  doc.addEventListener('DOMContentLoaded', bindNav);
  window.initTTGNav = bindNav;
})();
