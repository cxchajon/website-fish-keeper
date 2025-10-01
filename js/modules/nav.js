const NAV_VERSION = '1.3.2';
const NAV_ENDPOINT = `/nav.html?v=${NAV_VERSION}`;
const SKIP_PATHS = new Set(['/', '/index.html']);
const OVERLAY_HIDE_DELAY = 320;
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const normalizePath = (value) => {
  try {
    const url = new URL(value, window.location.origin);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return path === '/' ? '/index.html' : path;
  } catch (error) {
    return value;
  }
};

const markCurrentLinks = (root, current) => {
  root.querySelectorAll('.links a, #ttg-drawer a').forEach((link) => {
    const hrefAttr = link.getAttribute('href');
    if (!hrefAttr) return;
    if (normalizePath(hrefAttr) === current) {
      link.setAttribute('aria-current', 'page');
    }
  });
};

const getFocusableElements = (container) => {
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
};

const attachInteractions = (root) => {
  const openBtn = root.querySelector('#ttg-nav-open');
  const closeBtn = root.querySelector('#ttg-nav-close');
  const overlay = root.querySelector('#ttg-overlay');
  const drawer = root.querySelector('#ttg-drawer');

  if (!drawer || !overlay || !openBtn) return;

  const docEl = document.documentElement;
  const body = document.body;
  let previousFocus = null;
  let prevDocOverflow = docEl.style.overflow || '';
  let prevBodyOverflow = body.style.overflow || '';
  let overlayHideTimer = null;
  let focusableElements = [];

  root.setAttribute('data-open', 'false');
  openBtn.setAttribute('aria-expanded', 'false');
  drawer.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('hidden', '');

  const focusFirstInteractive = () => {
    focusableElements = getFocusableElements(drawer);
    const preferred = drawer.querySelector('.drawer a');
    const target =
      (preferred && focusableElements.includes(preferred) && preferred) ||
      focusableElements[0] ||
      drawer;
    if (typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
  };

  const close = (options = {}) => {
    if (root.getAttribute('data-open') !== 'true') return;
    const { returnFocus = true } = options;
    root.setAttribute('data-open', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    openBtn.setAttribute('aria-expanded', 'false');
    docEl.style.overflow = prevDocOverflow;
    body.style.overflow = prevBodyOverflow;
    focusableElements = [];
    overlayHideTimer = window.setTimeout(() => {
      if (root.getAttribute('data-open') !== 'true') {
        overlay.setAttribute('hidden', '');
      }
    }, OVERLAY_HIDE_DELAY);

    if (returnFocus) {
      const target = previousFocus && typeof previousFocus.focus === 'function'
        ? previousFocus
        : openBtn;
      window.requestAnimationFrame(() => {
        target.focus({ preventScroll: true });
      });
    }

    previousFocus = null;
  };

  const open = () => {
    if (root.getAttribute('data-open') === 'true') return;
    window.clearTimeout(overlayHideTimer);
    previousFocus = document.activeElement;
    prevDocOverflow = docEl.style.overflow || '';
    prevBodyOverflow = body.style.overflow || '';
    root.setAttribute('data-open', 'true');
    overlay.removeAttribute('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    openBtn.setAttribute('aria-expanded', 'true');
    docEl.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      focusFirstInteractive();
    });
  };

  const handleKeydown = (event) => {
    if (root.getAttribute('data-open') === 'true' && event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (root.getAttribute('data-open') === 'true' && event.key === 'Tab') {
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
  };

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', () => close());
  overlay?.addEventListener('click', () => close());
  drawer.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link) {
      close({ returnFocus: false });
    }
  });
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('focusin', (event) => {
    if (root.getAttribute('data-open') !== 'true') return;
    if (!drawer.contains(event.target)) {
      focusableElements = getFocusableElements(drawer);
      const target = focusableElements[0] || drawer;
      if (typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    }
  });
};

const placeholder = document.getElementById('site-nav');
if (placeholder) {
  const currentPath = normalizePath(window.location.pathname || '/');
  if (SKIP_PATHS.has(currentPath)) {
    placeholder.remove();
  } else {
    fetch(NAV_ENDPOINT)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch nav');
        }
        return response.text();
      })
      .then((html) => {
        placeholder.outerHTML = html;
        const root = document.getElementById('global-nav');
        if (!root) return;
        markCurrentLinks(root, currentPath);
        attachInteractions(root);
      })
      .catch(() => {
        placeholder.remove();
      });
  }
}
