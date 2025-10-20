(() => {
  const NAV_VERSION = '1.1.0';
  const NAV_PLACEHOLDER_ID = 'site-nav';
  const HOME_PATH = '/index.html';
  const PRIVACY_SECTION_IDS = [
    'privacy-policy',
    'cookies-tracking',
    'affiliate-disclosure',
    'adsense-disclaimer',
    'terms-of-use',
    'disclaimer',
    'copyright-dmca',
    'accessibility',
    'contact',
    'effective-date'
  ];

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

  function toCanonicalPath(path) {
    const normalized = normalizePath(path);
    const map = {
      '/': HOME_PATH,
      '/index.html': HOME_PATH,
      '/index': HOME_PATH,
      '/stocking.html': '/stocking.html',
      '/stocking-advisor': '/stocking.html',
      '/stocking-advisor.html': '/stocking.html',
      '/gear': '/gear/index.html',
      '/gear/': '/gear/index.html',
      '/gear/index.html': '/gear/index.html',
      '/media': '/media.html',
      '/media.html': '/media.html',
      '/feature-your-tank': '/feature-your-tank.html',
      '/feature-your-tank.html': '/feature-your-tank.html',
      '/contact': '/contact-feedback.html',
      '/contact-feedback': '/contact-feedback.html',
      '/contact-feedback.html': '/contact-feedback.html',
      '/about': '/about.html',
      '/about.html': '/about.html',
      '/privacy-legal': '/privacy-legal.html',
      '/privacy-legal.html': '/privacy-legal.html',
      '/terms': '/terms.html',
      '/terms.html': '/terms.html',
      '/trust-security': '/trust-security.html',
      '/trust-security.html': '/trust-security.html',
      '/copyright-dmca': '/copyright-dmca.html',
      '/copyright-dmca.html': '/copyright-dmca.html',
      '/store': '/store.html',
      '/store.html': '/store.html'
    };
    return map[normalized] ?? normalized;
  }

  function markActiveLinks(root) {
    const here = toCanonicalPath(window.location.pathname);
    const links = root.querySelectorAll('.links a, #ttg-drawer a');
    links.forEach((link) => {
      link.removeAttribute('aria-current');
    });
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) {
        return;
      }
      const target = toCanonicalPath(href);
      if (target === here) {
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function initNav() {
    const root = document.getElementById('global-nav');
    if (!root || root.dataset.navReady === 'true') {
      return;
    }

    const openBtn = root.querySelector('#ttg-nav-open');
    const closeBtn = root.querySelector('#drawer-close');
    const overlay = root.querySelector('#ttg-overlay');
    const drawer = root.querySelector('#ttg-drawer');

    if (!openBtn || !overlay || !drawer) {
      return;
    }

    let previousFocus = null;
    let drawerFocusables = [];

    const getDrawerFocusables = () => {
      if (!drawer) {
        return [];
      }
      const nodes = Array.from(
        drawer.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => node instanceof HTMLElement && !node.hasAttribute('disabled'));
      const firstIndex = nodes.findIndex((node) => node.id === 'drawer-first');
      if (firstIndex > 0) {
        const [firstNode] = nodes.splice(firstIndex, 1);
        nodes.unshift(firstNode);
      }
      return nodes;
    };

    const focusFirstInDrawer = () => {
      drawerFocusables = getDrawerFocusables();
      const target = drawer.querySelector('#drawer-first');
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
        return;
      }
      const first = drawerFocusables[0];
      if (first instanceof HTMLElement) {
        first.focus({ preventScroll: true });
      }
    };

    const closeDrawer = () => {
      if (root.getAttribute('data-open') !== 'true') {
        return;
      }
      root.removeAttribute('data-open');
      drawer.classList.remove('is-open');
      drawer.removeAttribute('data-open');
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
      drawerFocusables = [];
    };

    const openDrawer = () => {
      if (root.getAttribute('data-open') === 'true') {
        return;
      }
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      root.setAttribute('data-open', 'true');
      drawer.classList.add('is-open');
      drawer.setAttribute('data-open', 'true');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      drawer.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      document.documentElement.dataset.scrollLock = 'on';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      window.requestAnimationFrame(() => {
        focusFirstInDrawer();
      });
    };

    const handleOutsidePointer = (event) => {
      if (root.getAttribute('data-open') !== 'true') {
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) {
        return;
      }
      if (drawer.contains(target) || (openBtn instanceof HTMLElement && openBtn.contains(target))) {
        return;
      }
      closeDrawer();
    };

    const handleKeydown = (event) => {
      if (root.getAttribute('data-open') !== 'true') {
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
      drawerFocusables = getDrawerFocusables();
      if (drawerFocusables.length === 0) {
        return;
      }
      const first = drawerFocusables[0];
      const last = drawerFocusables[drawerFocusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !drawer.contains(active)) {
          event.preventDefault();
          if (last instanceof HTMLElement) {
            last.focus({ preventScroll: true });
          }
        }
        return;
      }
      if (active === last) {
        event.preventDefault();
        if (first instanceof HTMLElement) {
          first.focus({ preventScroll: true });
        }
        return;
      }
      if (!drawer.contains(active)) {
        event.preventDefault();
        if (first instanceof HTMLElement) {
          first.focus({ preventScroll: true });
        }
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

    if (!root.__ttgKeyHandler) {
      document.addEventListener('keydown', handleKeydown);
      root.__ttgKeyHandler = handleKeydown;
    }

    if (!root.__ttgOutsideHandler) {
      document.addEventListener('pointerdown', handleOutsidePointer, true);
      document.addEventListener('click', handleOutsidePointer, true);
      root.__ttgOutsideHandler = handleOutsidePointer;
    }

    markActiveLinks(root);
    root.dataset.navReady = 'true';
    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function extractNav(markup) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(markup, 'text/html');
      const nav = doc.querySelector('#global-nav');
      if (nav) {
        return nav;
      }
    } catch (error) {
      console.warn('Nav parser fallback', error);
    }

    const template = document.createElement('template');
    template.innerHTML = markup;
    return template.content.querySelector('#global-nav');
  }

  async function mountNav() {
    const host = document.getElementById(NAV_PLACEHOLDER_ID);
    if (!host) {
      return;
    }
    try {
      const response = await fetch(`/nav.html?v=${NAV_VERSION}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch nav: ${response.status}`);
      }
      const markup = await response.text();
      const nav = extractNav(markup);
      if (nav) {
        host.replaceWith(nav);
        initNav();
        return;
      }

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
  window.__TTG_PRIVACY_SECTION_IDS__ = PRIVACY_SECTION_IDS;

  // Found bindings at js/nav.js:342-371 (contextmenu/drag)
  // Found bindings at footer.html:85-107 (contextmenu/drag)

  const deterrentState = {
    enabled:
      typeof window.__RIGHT_CLICK_DETERRENT__ === 'boolean'
        ? window.__RIGHT_CLICK_DETERRENT__
        : false,
    handlersAttached: false,
    handleContextMenu: null,
    handleDragStart: null
  };

  const attachDeterrentListeners = () => {
    if (deterrentState.handlersAttached) {
      return;
    }
    deterrentState.handleContextMenu = (event) => {
      const targetTag = event.target && event.target.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') {
        return;
      }
      event.preventDefault();
    };
    deterrentState.handleDragStart = (event) => {
      if (event.target && event.target.tagName === 'IMG') {
        event.preventDefault();
      }
    };
    document.addEventListener('contextmenu', deterrentState.handleContextMenu);
    document.addEventListener('dragstart', deterrentState.handleDragStart);
    deterrentState.handlersAttached = true;
  };

  const detachDeterrentListeners = () => {
    if (!deterrentState.handlersAttached) {
      return;
    }
    if (deterrentState.handleContextMenu) {
      document.removeEventListener('contextmenu', deterrentState.handleContextMenu);
    }
    if (deterrentState.handleDragStart) {
      document.removeEventListener('dragstart', deterrentState.handleDragStart);
    }
    deterrentState.handlersAttached = false;
  };

  const updateDeterrent = (isEnabled) => {
    if (isEnabled) {
      attachDeterrentListeners();
    } else {
      detachDeterrentListeners();
    }
  };

  if (typeof window.__RIGHT_CLICK_DETERRENT__ !== 'boolean') {
    window.__RIGHT_CLICK_DETERRENT__ = deterrentState.enabled;
  } else {
    deterrentState.enabled = Boolean(window.__RIGHT_CLICK_DETERRENT__);
  }

  Object.defineProperty(window, '__RIGHT_CLICK_DETERRENT__', {
    configurable: true,
    enumerable: true,
    get() {
      return deterrentState.enabled;
    },
    set(value) {
      const nextValue = Boolean(value);
      if (nextValue === deterrentState.enabled) {
        return;
      }
      deterrentState.enabled = nextValue;
      updateDeterrent(nextValue);
    }
  });

  const featureFlags = window.__TTG_FEATURE_FLAGS__ || (window.__TTG_FEATURE_FLAGS__ = {});
  if (!Object.prototype.hasOwnProperty.call(featureFlags, 'enableRightClickBlock')) {
    featureFlags.enableRightClickBlock = deterrentState.enabled;
  }
  Object.defineProperty(featureFlags, 'enableRightClickBlock', {
    configurable: true,
    enumerable: true,
    get() {
      return window.__RIGHT_CLICK_DETERRENT__;
    },
    set(value) {
      window.__RIGHT_CLICK_DETERRENT__ = value;
    }
  });

  // Feature-flagged deterrent (OFF by default). Attach/remove listeners based on flag.
  updateDeterrent(deterrentState.enabled);
})();
