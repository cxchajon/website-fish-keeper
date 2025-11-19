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

  var gtag = window.gtag || function(){ (window.dataLayer = window.dataLayer || []).push(arguments); };

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

  function invokeCmpOpen(){
    var api = window.googlefc || (window.googlefc = {});
    var openers = ['showConsentPreferences', 'showCmpDialog', 'showDialog'];
    for (var i = 0; i < openers.length; i++){
      var fn = openers[i];
      if (typeof api[fn] === 'function'){
        api[fn]();
        return true;
      }
    }
    // Funding Choices exposes the standard TCF hook with a lowercase "i" in "Ui".
    // The previous call used an uppercase "I", which prevented the preferences
    // panel from opening when users clicked "Manage preferences".
    if (typeof window.__tcfapi === 'function'){
      window.__tcfapi('displayConsentUi', 0, function(){});
      return true;
    }
    return false;
  }

  function queueCmpOpen(){
    var api = window.googlefc || (window.googlefc = {});
    api.callbackQueue = api.callbackQueue || [];
    api.callbackQueue.push(function(){ invokeCmpOpen(); });
    return true;
  }

  function showFundingChoicesDialog(){
    if (invokeCmpOpen()) return true;
    if (window.googlefc) return queueCmpOpen();
    console.warn('Funding Choices CMP is not available yet.');
    return false;
  }

  // Expose the shared CMP helpers for utility pages (e.g., cookie-settings.html).
  // These reuse the same Funding Choices hooks used elsewhere on the site so
  // cookie management stays consistent with the main CMP bridge.
  var ttgConsentBridge = (window.ttgConsentBridge = window.ttgConsentBridge || {});
  ttgConsentBridge.showFundingChoicesDialog = showFundingChoicesDialog;
  ttgConsentBridge.resetStoredConsent = resetStoredConsent;

  function resetStoredConsent(){
    var deniedState = {
      ad_storage:'denied',
      analytics_storage:'denied',
      ad_user_data:'denied',
      ad_personalization:'denied',
      advertising:false,
      analytics:false,
      ts: now()
    };

    try { localStorage.removeItem(STORE_KEY); } catch(e){}
    try { localStorage.removeItem('ttgConsent'); } catch(e){}
    document.cookie = STORE_KEY + '=; Max-Age=0; Path=/; SameSite=Lax';

    if (typeof gtag === 'function'){
      gtag('consent','update', deniedState);
    }
    applyAdConsentState(false);

    var api = window.googlefc || (window.googlefc = {});
    if (api && typeof api.reset === 'function'){
      api.reset();
    } else if (typeof window.__tcfapi === 'function'){
      window.__tcfapi('revokeAllChoices', 0, function(){});
    }
  }
})();
