(function(){
  const NAV_READY_ATTR = 'data-mnav-ready';
  const DESKTOP_QUERY = '(min-width: 768px)';

  function normalizePath(path){
    if (!path) return '/';
    try {
      const url = new URL(path, window.location.origin);
      let pathname = url.pathname.replace(/\/+$/u, '');
      if (!pathname || pathname === '/' || pathname === '/index.html') {
        return '/';
      }
      return pathname;
    } catch (error) {
      console.warn('Failed to normalise path', path, error);
      return path;
    }
  }

  function markActiveLinks(header){
    if (!header) return;
    const current = normalizePath(window.location.pathname);
    const linkGroups = [
      ...header.querySelectorAll('.nav__list a'),
      ...header.querySelectorAll('.mnav-list a')
    ];
    linkGroups.forEach((link)=>{
      const href = link.getAttribute('href');
      if (!href) return;
      const target = normalizePath(href);
      if (target === current) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function setupMobileNav(){
    const header = document.querySelector('.site-header');
    if (!header || header.getAttribute(NAV_READY_ATTR) === 'true') {
      return false;
    }

    const toggle = header.querySelector('.nav-toggle');
    const nav = header.querySelector('#primary-nav');
    const backdrop = header.querySelector('.mnav-backdrop');
    const panel = header.querySelector('.mnav-panel');
    if (!toggle || !nav || !backdrop || !panel) {
      return false;
    }

    const panelLinks = Array.from(panel.querySelectorAll('a'));

    function isDesktop(){
      return window.matchMedia(DESKTOP_QUERY).matches;
    }

    function closeMenu(returnFocus){
      header.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      backdrop.setAttribute('hidden', '');
      panel.setAttribute('hidden', '');
      document.removeEventListener('keydown', onKeydown);
      if (returnFocus && typeof returnFocus.focus === 'function') {
        returnFocus.focus({ preventScroll: true });
      }
    }

    function openMenu(){
      header.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      backdrop.removeAttribute('hidden');
      panel.removeAttribute('hidden');
      document.addEventListener('keydown', onKeydown);
      const firstLink = panel.querySelector('a');
      if (firstLink && typeof firstLink.focus === 'function') {
        firstLink.focus({ preventScroll: true });
      }
    }

    function onKeydown(event){
      if (event.key === 'Escape') {
        closeMenu(toggle);
      }
    }

    toggle.addEventListener('click', ()=>{
      if (header.classList.contains('is-open')) {
        closeMenu(toggle);
      } else {
        openMenu();
      }
    });

    backdrop.addEventListener('click', ()=> closeMenu(toggle));

    panelLinks.forEach((link)=>{
      link.addEventListener('click', ()=> closeMenu());
    });

    window.addEventListener('resize', ()=>{
      if (isDesktop()) {
        closeMenu();
      }
    });

    markActiveLinks(header);
    header.setAttribute(NAV_READY_ATTR, 'true');
    return true;
  }

  function init(){
    if (setupMobileNav()) {
      return;
    }

    const observer = new MutationObserver(()=>{
      if (setupMobileNav()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
