// ---------- Google Consent Mode v2: defaults + handlers ----------
(function () {
  // Create dataLayer/gtag stub early
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // EEA + UK + Switzerland ISO codes
  var EEA_UK_CH = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","GB","CH"];

  // Dev override: ?region=GB forces EEA behavior for testing
  var regionParam = new URLSearchParams(location.search).get('region');
  var inEEA = regionParam ? EEA_UK_CH.indexOf(regionParam.toUpperCase()) !== -1 : false;

  // Default states: granted outside EEA, denied inside
  gtag('consent', 'default', {
    ad_storage:         inEEA ? 'denied' : 'granted',
    analytics_storage:  inEEA ? 'denied' : 'granted',
    ad_user_data:       inEEA ? 'denied' : 'granted',
    ad_personalization: inEEA ? 'denied' : 'granted'
  });

  // Privacy-preserving defaults
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);

  function setAdsDisabled(disabled) {
    document.documentElement.classList.toggle('is-ads-disabled', !!disabled);
  }

  // Public handlers
  function acceptAll() {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    });
    setAdsDisabled(false);
  }

  function rejectPersonalized() {
    gtag('consent', 'update', {
      ad_storage: 'granted', // allow non-personalized ads
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    setAdsDisabled(false);
  }

  window.acceptAll = acceptAll;
  window.rejectPersonalized = rejectPersonalized;

  function wireBannerButtons() {
    var acc = document.querySelectorAll('.js-consent-accept');
    var rej = document.querySelectorAll('.js-consent-reject');
    acc.forEach(function(btn){ btn.addEventListener('click', acceptAll); });
    rej.forEach(function(btn){ btn.addEventListener('click', rejectPersonalized); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireBannerButtons);
  } else {
    wireBannerButtons();
  }
})();
