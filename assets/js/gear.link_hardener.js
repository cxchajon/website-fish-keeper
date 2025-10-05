(function () {
  const builder = () => window.AffiliateLinkBuilder || null;

  function disableAnchor(anchor) {
    if (!anchor) {
      return;
    }
    anchor.removeAttribute('href');
    anchor.setAttribute('disabled', '');
    anchor.setAttribute('aria-disabled', 'true');
    anchor.setAttribute('title', 'Link unavailable');
    anchor.classList.add('is-disabled');
    anchor.tabIndex = -1;
  }

  function enableAnchor(anchor) {
    if (!anchor) {
      return;
    }
    anchor.removeAttribute('disabled');
    anchor.removeAttribute('aria-disabled');
    anchor.classList.remove('is-disabled');
    anchor.removeAttribute('title');
    anchor.tabIndex = 0;
  }

  function setStatus(card, anchor, status) {
    if (card) {
      card.dataset.status = status;
    }
    if (anchor) {
      anchor.dataset.status = status;
    }
  }

  function findAnchor(card) {
    return (
      card.querySelector('[data-action="buy-amazon"]') ||
      card.querySelector('a.buy-amazon') ||
      null
    );
  }

  function processCard(card) {
    const helper = builder();
    const result = {
      card,
      status: 'error',
      asin: '',
      href: '',
      rebuilt: false,
      message: '',
      category: card?.dataset?.category || 'Unknown',
      name: card?.querySelector('h3')?.textContent?.trim() || 'Unnamed product',
    };

    if (!card || !helper) {
      result.message = helper ? 'Missing card' : 'AffiliateLinkBuilder unavailable';
      result.status = 'error';
      setStatus(card, null, 'error');
      return result;
    }

    const anchor = findAnchor(card);
    if (!anchor) {
      result.message = 'Missing Amazon anchor';
      result.status = 'error';
      setStatus(card, null, 'error');
      return result;
    }

    const rawAsin = helper.cleanASIN(card.dataset.asin);
    card.dataset.asin = rawAsin;
    result.asin = rawAsin;

    const isValid = helper.isValidASIN(rawAsin);
    let href = (anchor.getAttribute('href') || '').trim();

    if (!isValid) {
      disableAnchor(anchor);
      setStatus(card, anchor, 'error');
      result.status = 'error';
      result.message = 'Missing or invalid ASIN';
      return result;
    }

    const canonical = helper.buildFromASIN(rawAsin);
    if (!helper.isCanonical(href)) {
      href = canonical;
      result.rebuilt = true;
    }

    if (!href) {
      disableAnchor(anchor);
      setStatus(card, anchor, 'error');
      result.status = 'error';
      result.message = 'Unable to build canonical link';
      return result;
    }

    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    enableAnchor(anchor);
    setStatus(card, anchor, result.rebuilt ? 'warn' : 'ok');

    result.status = result.rebuilt ? 'warn' : 'ok';
    result.href = href;
    result.message = result.rebuilt
      ? 'Link rebuilt to canonical format'
      : 'Canonical link verified';
    return result;
  }

  function normalizeCards(cards) {
    const collection = Array.from(cards || []);
    const results = collection.map(processCard);
    window.__gearLinkHardenerReport = results;
    document.dispatchEvent(
      new CustomEvent('gear:links-hardened', { detail: { results } })
    );
    return results;
  }

  function runInitial() {
    normalizeCards(document.querySelectorAll('[data-card]'));
  }

  document.addEventListener('gear:rendered', (event) => {
    const cards = event?.detail?.cards;
    normalizeCards(cards || document.querySelectorAll('[data-card]'));
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    runInitial();
  } else {
    document.addEventListener('DOMContentLoaded', runInitial);
  }

  window.__rehardenLinks = function __rehardenLinks() {
    normalizeCards(document.querySelectorAll('[data-card]'));
  };
})();
