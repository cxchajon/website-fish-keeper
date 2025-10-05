(function () {
  const TAG = 'fishkeepingli-20';
  const CANONICAL_PATTERN = new RegExp(
    `^https://www\\.amazon\\.com/dp/[A-Z0-9]{10}\\?tag=${TAG}(?:$|&.*$)`
  );

  function cleanASIN(value) {
    return (value || '')
      .toString()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
  }

  function isValidASIN(value) {
    return /^[A-Z0-9]{10}$/.test(value || '');
  }

  function buildFromASIN(value) {
    const asin = cleanASIN(value);
    return isValidASIN(asin)
      ? `https://www.amazon.com/dp/${asin}?tag=${TAG}`
      : '';
  }

  function isCanonical(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    return CANONICAL_PATTERN.test(url.trim());
  }

  window.AffiliateLinkBuilder = {
    cleanASIN,
    isValidASIN,
    buildFromASIN,
    isCanonical,
  };
})();
