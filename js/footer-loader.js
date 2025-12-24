(() => {
  const FOOTER_HOST_ID = 'site-footer';
  const CANONICAL_FOOTER_SRC = '/footer.html?v=1.5.2';
  const LEGAL_LINKS_SELECTOR = '.legal-links';
  const INHOUSE_AD_SELECTOR = '.inhouse-ad-wrap';

  const getFooterSource = (host) => {
    const candidate = (host.dataset.footerSrc || '').trim();
    if (candidate.length > 0) {
      return candidate;
    }

    host.dataset.footerSrc = CANONICAL_FOOTER_SRC;
    return CANONICAL_FOOTER_SRC;
  };

  const sanitizeHtml = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const moveLegalLinksBelowInhouseAd = () => {
    const legalLinks = document.querySelector(LEGAL_LINKS_SELECTOR);
    const inhouseAd = document.querySelector(INHOUSE_AD_SELECTOR);

    if (!legalLinks || !inhouseAd || !inhouseAd.parentNode) {
      return;
    }

    // Keep the legal links grouped with their noscript fallback if it exists.
    const fragment = document.createDocumentFragment();
    const noscriptFallback =
      legalLinks.nextElementSibling && legalLinks.nextElementSibling.tagName === 'NOSCRIPT'
        ? legalLinks.nextElementSibling
        : null;

    fragment.appendChild(legalLinks);
    if (noscriptFallback) {
      fragment.appendChild(noscriptFallback);
    }

    const { parentNode } = inhouseAd;
    const nextNode = inhouseAd.nextSibling;

    if (nextNode) {
      parentNode.insertBefore(fragment, nextNode);
    } else {
      parentNode.appendChild(fragment);
    }
  };

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
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        moveLegalLinksBelowInhouseAd();
        void injectFooter();
      },
      { once: true }
    );
  } else {
    moveLegalLinksBelowInhouseAd();
    void injectFooter();
  }
})();
