// The Tank Guide — Resilient Nav Loader + A11y (homepage excluded)
(() => {
  const SITE_NAV_ID = 'site-nav';
  const NAV_URL = '/nav.html';

  // Skip mounting on the homepage (nav-free hero)
  const path = new URL(location.href).pathname.replace(/\/index\.html$/, '/');
  if (path === '/') return;

  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const enhance = (root) => {
    // Active link state
    qsa('[data-canonical]', root).forEach(a => {
      const canon = a.getAttribute('data-canonical');
      if (canon === path) a.setAttribute('aria-current', 'page');
    });

    const skipLink = root.querySelector('.skip-link');
    if (skipLink) {
      let targetId = document.querySelector('main[id]')?.id;
      if (!targetId) {
        const mainEl = document.querySelector('main');
        if (mainEl) {
          if (!mainEl.id) {
            mainEl.id = 'main-content';
          }
          targetId = mainEl.id;
        } else {
          const roleMain = document.querySelector('[role="main"]');
          if (roleMain) {
            if (!roleMain.id) {
              roleMain.id = 'main-content';
            }
            targetId = roleMain.id;
          }
        }
      }
      if (targetId) skipLink.setAttribute('href', `#${targetId}`);
    }

    // Drawer behavior
    const html = document.documentElement;
    const hamburger = root.querySelector('#hamburger');
    const drawer = root.querySelector('#ttg-drawer');
    const closeBtn = drawer?.querySelector('.drawer-close');
    const firstLink = drawer?.querySelector('.drawer-nav a');

    const open = () => {
      drawer?.setAttribute('data-open', 'true');
      hamburger?.setAttribute('aria-expanded', 'true');
      html.setAttribute('data-scroll-lock', 'on');
      (firstLink || closeBtn)?.focus();
    };

    const close = () => {
      drawer?.removeAttribute('data-open');
      hamburger?.setAttribute('aria-expanded', 'false');
      html.removeAttribute('data-scroll-lock');
      hamburger?.focus();
    };

    hamburger?.addEventListener('click', () => {
      const isOpen = drawer?.getAttribute('data-open') === 'true';
      isOpen ? close() : open();
    });
    closeBtn?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer?.getAttribute('data-open') === 'true') close();
    });
    drawer?.addEventListener('click', (e) => { if (e.target === drawer) close(); });
    drawer?.querySelectorAll('.drawer-nav a').forEach(a => a.addEventListener('click', close));
  };

  const mount = async () => {
    const host = document.getElementById(SITE_NAV_ID);
    if (!host) return;

    try {
      const res = await fetch(NAV_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Fetch ${NAV_URL} failed: ${res.status}`);
      const html = await res.text();
      const tpl = document.createElement('template');
      tpl.innerHTML = html.trim();
      const header = tpl.content.querySelector('#global-nav');
      if (!header) throw new Error('global-nav not found in nav.html');
      host.replaceChildren(header);
      enhance(header);
    } catch (err) {
      // If noscript fallback exists, leave it. If empty, inject minimal emergency nav.
      if (!host.firstElementChild) {
        host.innerHTML = `
          <nav class="nav-emergency" aria-label="Primary">
            <a class="brand" href="/">The Tank Guide</a>
            <a href="/stocking.html">Stocking Advisor</a>
            <a href="/gear/">Gear</a>
            <a href="/params.html">Cycling Coach</a>
            <a href="/feature-your-tank.html">Feature Your Tank</a>
            <a href="/media.html">Media</a>
            <a href="/store.html">Store</a>
            <a href="/about.html">About</a>
            <a href="/contact-feedback.html">Contact & Feedback</a>
            <a href="/privacy-legal.html">Privacy & Legal</a>
            <a href="/terms.html">Terms of Use</a>
            <a href="/copyright-dmca.html">Copyright & DMCA</a>
          </nav>`;
      }
      console.warn('[nav] fallback mode:', err);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
