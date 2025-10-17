(() => {
  const FOOTER_HOST_ID = 'site-footer';

  const getFooterSource = (host) => {
    const { footerSrc } = host.dataset;
    return footerSrc && footerSrc.trim().length > 0 ? footerSrc : '/footer.html?v=1.3.4';
  };

  const sanitizeHtml = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const injectFooter = async () => {
    const host = document.getElementById(FOOTER_HOST_ID);
    if (!host) {
      return;
    }

    const src = getFooterSource(host);

    try {
      const response = await fetch(src, { cache: 'no-cache' });
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
