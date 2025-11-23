/**
 * TTG CMP Consent Bridge
 *
 * Maps TCF consent from Google Funding Choices to Google Consent Mode.
 * Bridges the IAB TCF v2 interface with Google's ad consent signals.
 *
 * Usage: <script src="/js/ttg-cmp-consent-bridge.js" defer></script>
 * Place at end of body, after Funding Choices has loaded.
 */
(function(){
  // Helper: map TCF consent to our single "ads granted" flag.
  // We consider "granted" only when Purpose 1 (storage) AND Purpose 4 (select personalised ads)
  // are consented. If you want to allow NON-personalised ads when only Purpose 1 is granted,
  // set allowNPA=true below.
  var allowNPA = true; // if true, we'll treat Purpose 1 only as "granted" for showing slots (Google will serve NPA ads).

  function setAdConsent(granted){
    // Google CMP interface (Funding Choices) - set consent for ads_storage and ad_user_data
    var consentState = granted ? 'granted' : 'denied';
    var payload = {
      'ad_storage': consentState,
      'ad_user_data': consentState,
      'ad_personalization': consentState
    };
    if (typeof window.__ttgUpdateConsentState__ === 'function') {
      window.__ttgUpdateConsentState__(payload);
    } else if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', payload);
    } else {
      (window.__ttgDeferredConsentUpdates__ = window.__ttgDeferredConsentUpdates__ || []).push(payload);
    }
  }

  function hookTCF(){
    // Funding Choices exposes the IAB TCF v2 interface.
    // We hook into it to map Purpose consent to Google consent mode.
    if (typeof __tcfapi !== 'function') return;

    __tcfapi('addEventListener', 2, function(tcData, success){
      if(!success || !tcData || tcData.eventStatus !== 'tcloaded') return;

      // Purpose IDs: 1 = Storage and Access, 4 = Select Personalised Ads
      var p1 = tcData.purpose && tcData.purpose.consents ? tcData.purpose.consents[1] : false;
      var p4 = tcData.purpose && tcData.purpose.consents ? tcData.purpose.consents[4] : false;

      var granted = allowNPA ? (p1 && (p4 || true)) : (p1 && p4);
      setAdConsent(granted);
    });
  }

  // Initialize once Funding Choices loads the TCF stub
  if (typeof __tcfapi === 'function') {
    hookTCF();
  } else {
    window.addEventListener('tcfapiReady', hookTCF, { once: true });
  }
})();
