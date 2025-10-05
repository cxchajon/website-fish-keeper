(function () {
  const TAG = 'fishkeepingli-20';
  const CANONICAL_PATTERN = new RegExp(
    '^https://www\\.amazon\\.com/dp/[A-Z0-9]{10}/\\?tag=' + TAG + '(?:$|&.*$)'
  );

  function buildFromASIN(asin) {
    if (!asin) {
      return '';
    }
    const normalized = String(asin).trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(normalized)) {
      return '';
    }
    return `https://www.amazon.com/dp/${normalized}/?tag=${TAG}`;
  }

  function isCanonical(url) {
    if (typeof url !== 'string' || !url) {
      return false;
    }
    return CANONICAL_PATTERN.test(url.trim());
  }

  window.AffiliateLinkBuilder = {
    buildFromASIN,
    isCanonical,
  };
})();
