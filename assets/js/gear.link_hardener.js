(function () {
  const params = new URLSearchParams(window.location.search);
  const devMode = params.get('dev') === 'true';
  const ASIN_PATTERN = /^[A-Z0-9]{10}$/;

  function logWarning(message, extra) {
    if (!devMode) {
      return;
    }
    // eslint-disable-next-line no-console
    console.warn('[gear.link_hardener]', message, extra || '');
  }

  function disableAnchor(anchor) {
    if (!anchor) {
      return;
    }
    anchor.removeAttribute('href');
    anchor.setAttribute('disabled', '');
    anchor.classList.add('is-disabled');
    anchor.setAttribute('aria-disabled', 'true');
    anchor.setAttribute('title', 'Link unavailable');
    anchor.tabIndex = -1;
  }

  function enableAnchor(anchor) {
    if (!anchor) {
      return;
    }
    anchor.removeAttribute('disabled');
    anchor.classList.remove('is-disabled');
    anchor.removeAttribute('aria-disabled');
    anchor.removeAttribute('title');
    anchor.tabIndex = 0;
  }

  function processCard(card) {
    const result = {
      card,
      status: 'ok',
      asin: '',
      rebuilt: false,
      message: '',
      href: '',
      category: card.dataset.category || 'Unknown',
      name: card.querySelector('h3')?.textContent?.trim() || 'Unnamed product',
    };

    const asin = (card.dataset.asin || '').trim().toUpperCase();
    result.asin = asin;
    if (asin) {
      card.dataset.asin = asin;
    }

    const anchor =
      card.querySelector('[data-action="buy-amazon"]') ||
      card.querySelector('a.buy-amazon');

    if (!anchor) {
      result.status = 'error';
      result.message = 'Missing Amazon anchor';
      card.dataset.linkState = result.status;
      logWarning('Missing Amazon anchor on card', card);
      return result;
    }

    const hasValidAsin = ASIN_PATTERN.test(asin);
    if (!hasValidAsin) {
      result.status = 'error';
      result.message = 'Missing or invalid ASIN';
      disableAnchor(anchor);
      logWarning('Disabled Amazon link due to missing/invalid ASIN', { asin, card });
      card.dataset.linkState = result.status;
      result.href = '';
      return result;
    }

    const builder = window.AffiliateLinkBuilder;
    if (!builder || typeof builder.buildFromASIN !== 'function') {
      result.status = 'error';
      result.message = 'AffiliateLinkBuilder unavailable';
      card.dataset.linkState = result.status;
      logWarning('AffiliateLinkBuilder missing from window', window.AffiliateLinkBuilder);
      return result;
    }

    const canonicalHref = builder.buildFromASIN(asin);
    const currentHref = anchor.getAttribute('href') || '';

    if (!builder.isCanonical(currentHref)) {
      anchor.href = canonicalHref;
      result.status = 'warn';
      result.rebuilt = true;
      result.message = 'Link rebuilt to canonical format';
      logWarning('Rebuilt Amazon link to canonical', { asin, from: currentHref, to: canonicalHref });
    } else {
      result.status = 'ok';
      result.message = 'Canonical link verified';
    }

    enableAnchor(anchor);
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    result.href = anchor.getAttribute('href') || canonicalHref;
    card.dataset.linkState = result.status;
    return result;
  }

  function normalizeCards(cards) {
    const list = Array.isArray(cards) ? cards : Array.from(cards || []);
    const results = list.map(processCard);
    window.__gearLinkHardenerReport = results;
    document.dispatchEvent(
      new CustomEvent('gear:links-hardened', { detail: { results } })
    );
    return results;
  }

  function initialRun() {
    normalizeCards(document.querySelectorAll('[data-card]'));
  }

  document.addEventListener('gear:rendered', (event) => {
    const cards = event?.detail?.cards;
    normalizeCards(cards || document.querySelectorAll('[data-card]'));
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initialRun();
  } else {
    document.addEventListener('DOMContentLoaded', initialRun);
  }

  window.__rehardenLinks = function __rehardenLinks() {
    normalizeCards(document.querySelectorAll('[data-card]'));
  };
})();
