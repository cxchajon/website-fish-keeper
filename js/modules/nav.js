const NAV_VERSION = '1.1.0';
const NAV_ENDPOINT = `/nav.html?v=${NAV_VERSION}`;
const SKIP_PATHS = new Set(['/', '/index.html']);

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

const attachInteractions = (root) => {
  const openBtn = root.querySelector('#ttg-nav-open');
  const closeBtn = root.querySelector('#ttg-nav-close');
  const overlay = root.querySelector('#ttg-overlay');
  const drawer = root.querySelector('#ttg-drawer');

  if (!drawer) return;

  const lockBody = () => {
    document.documentElement.classList.add('ttg-nav-locked');
    document.body.classList.add('ttg-nav-locked');
  };

  const unlockBody = () => {
    document.documentElement.classList.remove('ttg-nav-locked');
    document.body.classList.remove('ttg-nav-locked');
  };

  const close = () => {
    if (root.getAttribute('data-open') !== 'true') return;
    root.setAttribute('data-open', 'false');
    overlay?.setAttribute('hidden', '');
    drawer.setAttribute('aria-hidden', 'true');
    openBtn?.setAttribute('aria-expanded', 'false');
    unlockBody();
    openBtn?.focus({ preventScroll: true });
  };

  const open = () => {
    if (root.getAttribute('data-open') === 'true') return;
    root.setAttribute('data-open', 'true');
    overlay?.removeAttribute('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    openBtn?.setAttribute('aria-expanded', 'true');
    lockBody();
    const focusTarget = drawer.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
    (focusTarget || closeBtn || drawer).focus?.({ preventScroll: true });
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      close();
    }
  };

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
  drawer.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', close);
  });
  document.addEventListener('keydown', handleKeydown);
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
