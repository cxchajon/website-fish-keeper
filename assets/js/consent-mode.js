(function () {
  var STORE_KEY = 'ttgConsentV2';
  var EXP_DAYS  = 365;
  var LEGAL_PATHS = ['/privacy-legal.html', '/terms.html', '/copyright-dmca.html'];
  var ON_LEGAL_PAGE = LEGAL_PATHS.indexOf(location.pathname) !== -1;
  function now(){ return Date.now(); }
  function createDeniedPayload(){
    return {
      ad_storage:'denied',
      analytics_storage:'denied',
      ad_user_data:'denied',
      ad_personalization:'denied'
    };
  }
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

  function normalizeConsent(stored){
    if (!stored || typeof stored !== 'object') return null;

    var advertisingGranted = stored.ad_storage === 'granted' ||
      stored.ad_personalization === 'granted' ||
      stored.ad_user_data === 'granted' ||
      stored.advertising === true;
    var analyticsGranted = stored.analytics_storage === 'granted' || stored.analytics === true;

    return {
      ad_storage: advertisingGranted ? 'granted' : 'denied',
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      ad_user_data: advertisingGranted ? 'granted' : 'denied',
      ad_personalization: advertisingGranted ? 'granted' : 'denied',
      advertising: advertisingGranted,
      analytics: analyticsGranted,
      ts: stored.ts || now()
    };
  }

  function buildConsentState(prefs){
    var analyticsGranted = !!(prefs && prefs.analytics);
    var advertisingGranted = !!(prefs && prefs.advertising);

    return {
      ad_storage: advertisingGranted ? 'granted' : 'denied',
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      ad_user_data: advertisingGranted ? 'granted' : 'denied',
      ad_personalization: advertisingGranted ? 'granted' : 'denied',
      advertising: advertisingGranted,
      analytics: analyticsGranted,
      ts: now()
    };
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
      return normalizeConsent(stored);
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
  var gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  if (typeof window.gtag !== 'function') {
    window.gtag = gtag;
  }

  var consentQueue = window.__ttgDeferredConsentUpdates__ = window.__ttgDeferredConsentUpdates__ || [];

  function createDeniedState(){
    return Object.assign(createDeniedPayload(), {
      advertising:false,
      analytics:false,
      ts: now()
    });
  }

  function buildUpdatePayload(state){
    return {
      ad_storage: state && state.ad_storage === 'granted' ? 'granted' : 'denied',
      analytics_storage: state && state.analytics_storage === 'granted' ? 'granted' : 'denied',
      ad_user_data: state && state.ad_user_data === 'granted' ? 'granted' : 'denied',
      ad_personalization: state && state.ad_personalization === 'granted' ? 'granted' : 'denied'
    };
  }

  function applyGaConsent(state, options){
    var deniedPayload = createDeniedPayload();
    var updatePayload = buildUpdatePayload(state);
    var defaultOnly = options && options.defaultOnly;
    var skipDefault = options && options.applyDefault === false;

    if (typeof window.gtag === 'function'){
      if (!skipDefault) window.gtag('consent','default', deniedPayload);
      if (!defaultOnly) window.gtag('consent','update', updatePayload);
    } else {
      consentQueue.push({ type: 'default', payload: deniedPayload });
      if (!defaultOnly) consentQueue.push({ type: 'update', payload: updatePayload });
    }
  }

  function emitConsentUpdate(state){
    window.__TTG_CONSENT_STATE__ = Object.assign({}, state);
    try {
      window.dispatchEvent(new CustomEvent('ttg-consent-updated', { detail: state }));
    } catch (e) {}
  }

  function applyAdConsentState(granted){
    var adsGranted = !!granted;
    document.documentElement.setAttribute('data-ad-consent', adsGranted ? 'granted' : 'denied');
    var toggle = function(){ document.body.classList.toggle('is-ads-disabled', !adsGranted); };
    if (document.body) toggle(); else document.addEventListener('DOMContentLoaded', toggle);
  }

  function applyAndEmit(state, options){
    window.__TTG_CONSENT_STATE__ = Object.assign({}, state);
    applyGaConsent(state, options);
    emitConsentUpdate(state);
  }

  function ensureConsentState(){
    var savedConsent = ON_LEGAL_PAGE ? null : loadConsent();
    var baseState = savedConsent ? Object.assign({}, savedConsent) : createDeniedState();
    if (ON_LEGAL_PAGE) baseState = createDeniedState();

    applyAdConsentState(baseState.ad_storage === 'granted');
    applyAndEmit(baseState, savedConsent ? {} : { defaultOnly: true });
    setBannerOpen(inEEA && !savedConsent);

    return savedConsent;
  }

  var savedConsent = ensureConsentState();

  window.__ttgUpdateConsentState__ = function(state){
    var normalized = normalizeConsent(state) || createDeniedState();
    applyAdConsentState(normalized.ad_storage === 'granted');
    applyAndEmit(normalized);
  };

  function updateConsentFromPrefs(prefs){
    var state = buildConsentState(prefs);
    saveConsent(state);
    applyAdConsentState(state.ad_storage === 'granted');
    applyAndEmit(state);
    setBannerOpen(false);
    return state;
  }

  function acceptAll(){
    updateConsentFromPrefs({ analytics: true, advertising: true });
  }

  function rejectPersonalized(){
    updateConsentFromPrefs({ analytics: false, advertising: false });
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

  var ttgConsent = (window.ttgConsent = window.ttgConsent || {});
  ttgConsent.readConsent = loadConsent;
  ttgConsent.updateConsentFromToggles = function(prefs){ return updateConsentFromPrefs(prefs); };
  ttgConsent.defaultDenied = createDeniedState;

  function resetStoredConsent(){
    var deniedState = createDeniedState();

    try { localStorage.removeItem(STORE_KEY); } catch(e){}
    try { localStorage.removeItem('ttgConsent'); } catch(e){}
    document.cookie = STORE_KEY + '=; Max-Age=0; Path=/; SameSite=Lax';

    applyAndEmit(deniedState);
    applyAdConsentState(false);

    var api = window.googlefc || (window.googlefc = {});
    if (api && typeof api.reset === 'function'){
      api.reset();
    } else if (typeof window.__tcfapi === 'function'){
      window.__tcfapi('revokeAllChoices', 0, function(){});
    }
  }
})();
