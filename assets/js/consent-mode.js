/*
 * First-party consent helpers.
 *
 * Google Consent Mode v2 defaults are NOT set here. Every page sets them in an
 * inline, synchronous block at the top of <head>, before Funding Choices, GTM and
 * AdSense (see "TTG consent stack"). Google's CMP (Funding Choices) is the only
 * source of Google consent updates; this file never calls
 * gtag('consent', ...), does not translate TCF signals and does not detect regions.
 *
 * What remains here:
 *   - the first-party preference record used by /cookie-settings.html
 *     (site state only; it is not sent to Google Consent Mode)
 *   - the is-ads-disabled / data-ad-consent CSS state
 *   - helpers that open or reset the Funding Choices dialog (never auto-invoked)
 */
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

  function createDeniedState(){
    return Object.assign(createDeniedPayload(), {
      advertising:false,
      analytics:false,
      ts: now()
    });
  }

  function emitConsentUpdate(state){
    window.__TTG_CONSENT_STATE__ = Object.assign({}, state);
    try {
      window.dispatchEvent(new CustomEvent('ttg-consent-updated', { detail: state }));
    } catch (e) {}
  }

  // CSS state: ad units are dimmed/hidden only when the visitor has explicitly
  // declined advertising on /cookie-settings.html (or on legal pages). Without a
  // saved first-party choice, Google's CMP and Consent Mode decide ad behaviour.
  function applyAdConsentState(status){
    document.documentElement.setAttribute('data-ad-consent', status);
    var disabled = status === 'denied';
    var toggle = function(){ document.body.classList.toggle('is-ads-disabled', disabled); };
    if (document.body) toggle(); else document.addEventListener('DOMContentLoaded', toggle);
  }

  function ensureConsentState(){
    var savedConsent = ON_LEGAL_PAGE ? null : loadConsent();
    var baseState = savedConsent ? Object.assign({}, savedConsent) : createDeniedState();

    if (ON_LEGAL_PAGE) applyAdConsentState('denied');
    else if (savedConsent) applyAdConsentState(savedConsent.ad_storage === 'granted' ? 'granted' : 'denied');
    else applyAdConsentState('unset');

    // Internal state + event only; never a Google consent call.
    emitConsentUpdate(baseState);

    return savedConsent;
  }

  ensureConsentState();

  function updateConsentFromPrefs(prefs){
    var state = buildConsentState(prefs);
    saveConsent(state);
    applyAdConsentState(state.ad_storage === 'granted' ? 'granted' : 'denied');
    emitConsentUpdate(state);
    return state;
  }

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

  // Shared CMP helpers for utility pages (e.g., cookie-settings.html). They call
  // Google's Funding Choices API directly; there is no custom TCF bridge.
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

    emitConsentUpdate(deniedState);
    applyAdConsentState('unset');

    var api = window.googlefc || (window.googlefc = {});
    if (api && typeof api.reset === 'function'){
      api.reset();
    } else if (typeof window.__tcfapi === 'function'){
      window.__tcfapi('revokeAllChoices', 0, function(){});
    }
  }
})();
