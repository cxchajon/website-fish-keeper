(function () {
  var STORE_KEY = 'ttgConsentV2';
  var EXP_DAYS  = 365;
  function now(){ return Date.now(); }
  function saveConsent(obj){
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(obj));
      document.cookie = STORE_KEY + '=1; Max-Age=' + (EXP_DAYS*24*3600) + '; Path=/; SameSite=Lax';
    } catch(e){}
  }
  function loadConsent(){
    try {
      var v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!v) return null;
      if ((now() - (v.ts||0)) > EXP_DAYS*24*3600*1000) return null;
      return v;
    } catch(e){ return null; }
  }
  function setBannerOpen(open){
    var el = document.querySelector('[data-consent-banner]');
    if (el) el.classList.toggle('is-open', !!open);
  }
  var EEA_UK_CH = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","GB","CH"];
  var regionParam = new URLSearchParams(location.search).get('region');
  var tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
  var tzHintsEU = /(europe\/|gmt|bst|cet|cest)/.test(tz);
  var inEEA = regionParam ? EEA_UK_CH.indexOf(regionParam.toUpperCase()) !== -1 : tzHintsEU;

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var saved = loadConsent();
  var defaultGranted = !inEEA;

  gtag('consent', 'default', {
    ad_storage:         (saved ? saved.ad_storage         : (defaultGranted ? 'granted' : 'denied')),
    analytics_storage:  (saved ? saved.analytics_storage  : (defaultGranted ? 'granted' : 'denied')),
    ad_user_data:       (saved ? saved.ad_user_data       : (defaultGranted ? 'granted' : 'denied')),
    ad_personalization: (saved ? saved.ad_personalization : (defaultGranted ? 'granted' : 'denied'))
  });

  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);

  function setAdsDisabled(disabled){
    document.documentElement.classList.toggle('is-ads-disabled', !!disabled);
  }
  if (saved) setAdsDisabled(false);
  setBannerOpen(inEEA && !saved);

  function acceptAll(){
    var state = {
      ad_storage:'granted',
      analytics_storage:'granted',
      ad_user_data:'granted',
      ad_personalization:'granted',
      ts: now()
    };
    gtag('consent','update',state);
    saveConsent(state);
    setAdsDisabled(false);
    setBannerOpen(false);
  }
  function rejectPersonalized(){
    var state = {
      ad_storage:'granted',
      analytics_storage:'denied',
      ad_user_data:'denied',
      ad_personalization:'denied',
      ts: now()
    };
    gtag('consent','update',state);
    saveConsent(state);
    setAdsDisabled(false);
    setBannerOpen(false);
  }
  window.acceptAll = acceptAll;
  window.rejectPersonalized = rejectPersonalized;

  function wire(){
    document.querySelectorAll('.js-consent-accept').forEach(function(b){ b.addEventListener('click', acceptAll); });
    document.querySelectorAll('.js-consent-reject').forEach(function(b){ b.addEventListener('click', rejectPersonalized); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
