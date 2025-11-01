(function () {
  var STORE_KEY = 'ttgConsentV2';
  var EXP_DAYS  = 365;
  var LEGAL_PATHS = ['/privacy-legal.html', '/terms.html', '/copyright-dmca.html'];
  var ON_LEGAL_PAGE = LEGAL_PATHS.indexOf(location.pathname) !== -1;
  function now(){ return Date.now(); }
  function readStoredConsent(){
    try{
      var direct = localStorage.getItem(STORE_KEY);
      if (direct) return JSON.parse(direct);
      var keys = Object.keys(localStorage||{});
      var key  = keys.find(function(k){ return /ttg.*consent/i.test(k); }) || 'ttgConsent';
      var raw  = localStorage.getItem(key);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }
  function saveConsent(obj){
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(obj));
      document.cookie = STORE_KEY + '=1; Max-Age=' + (EXP_DAYS*24*3600) + '; Path=/; SameSite=Lax';
    } catch(e){}
  }
  function loadConsent(){
    try {
      var stored = readStoredConsent();
      if (!stored) return null;
      if (stored.ts && (now() - (stored.ts||0)) > EXP_DAYS*24*3600*1000) return null;
      if (typeof stored.ad_storage === 'string') return stored;
      return {
        ad_storage: stored.advertising === true ? 'granted' : 'denied',
        analytics_storage: stored.analytics === true ? 'granted' : 'denied',
        ad_user_data: stored.advertising === true ? 'granted' : 'denied',
        ad_personalization: stored.advertising === true ? 'granted' : 'denied',
        ts: stored.ts || now()
      };
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

  function applyAdConsentState(granted){
    var adsGranted = !!granted;
    document.documentElement.setAttribute('data-ad-consent', adsGranted ? 'granted' : 'denied');
    var toggle = function(){ document.body.classList.toggle('is-ads-disabled', !adsGranted); };
    if (document.body) toggle(); else document.addEventListener('DOMContentLoaded', toggle);
  }

  (function initConsentFromStorage(){
    var stored = readStoredConsent();
    var adsGranted = !!(stored && (stored.advertising === true || stored.ad_storage === 'granted'));
    if (ON_LEGAL_PAGE) adsGranted = false;

    applyAdConsentState(adsGranted);

    if (!ON_LEGAL_PAGE && typeof gtag === 'function' && adsGranted){
      gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted'
      });
    }
  })();

  var saved = ON_LEGAL_PAGE ? null : loadConsent();
  // Default = DENIED for everyone until explicit accept
  var defaultGranted = false;

  gtag('consent', 'default', {
    ad_storage:         (saved ? saved.ad_storage         : (defaultGranted ? 'granted' : 'denied')),
    analytics_storage:  (saved ? saved.analytics_storage  : (defaultGranted ? 'granted' : 'denied')),
    ad_user_data:       (saved ? saved.ad_user_data       : (defaultGranted ? 'granted' : 'denied')),
    ad_personalization: (saved ? saved.ad_personalization : (defaultGranted ? 'granted' : 'denied'))
  });

  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);
  setBannerOpen(inEEA && !saved);

  function acceptAll(){
    var state = {
      ad_storage:'granted',
      analytics_storage:'granted',
      ad_user_data:'granted',
      ad_personalization:'granted',
      advertising:true,
      analytics:true,
      ts: now()
    };
    gtag('consent','update',state);
    saveConsent(state);
    applyAdConsentState(true);
    setBannerOpen(false);
  }
  function rejectPersonalized(){
    var state = {
      ad_storage:'denied',
      analytics_storage:'denied',
      ad_user_data:'denied',
      ad_personalization:'denied',
      advertising:false,
      analytics:false,
      ts: now()
    };
    gtag('consent','update',state);
    saveConsent(state);
    applyAdConsentState(false);
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
