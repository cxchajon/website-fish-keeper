(() => {
  const FOOTER_HOST_ID = 'site-footer';
  const CANONICAL_FOOTER_SRC = '/footer.html?v=1.4.8';

  const getFooterSource = (host) => {
    const candidate = (host.dataset.footerSrc || '').trim();
    if (candidate.length > 0) {
      return candidate;
    }

    host.dataset.footerSrc = CANONICAL_FOOTER_SRC;
    return CANONICAL_FOOTER_SRC;
  };

  const sanitizeHtml = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const injectFooter = async () => {
    const host = document.getElementById(FOOTER_HOST_ID);
    if (!host) {
      return;
    }

    const src = getFooterSource(host);

    try {
      const response = await fetch(src, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load footer: ${response.status}`);
      }
      const html = await response.text();
      const cleaned = sanitizeHtml(html);
      host.outerHTML = cleaned;
    } catch (error) {
      console.error('[Footer] load failed:', error);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter, { once: true });
  } else {
    void injectFooter();
  }
})();
