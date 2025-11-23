/**
 * GA4 Initialization with Consent Defaults
 *
 * Initializes Google Analytics 4 with privacy-first consent defaults.
 * Checks for stored consent and applies it before GA4 loads.
 *
 * Usage:
 * 1. Include this script before the GA4 gtag.js loader
 * 2. <script src="/js/ga4-init.js"></script>
 * 3. <script async src="https://www.googletagmanager.com/gtag/js?id=G-PTHZ5NZFVJ"></script>
 */

// Initialize dataLayer and gtag
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

// Set privacy-first consent defaults BEFORE loading GA4
// This ensures GA4 respects consent from the very first hit
gtag('consent', 'default', {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});

// Check for stored consent and apply immediately if exists
(function() {
  var STORE_KEY = 'ttgConsentV2';
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var stored = JSON.parse(raw);
      // Check expiry (365 days)
      if (stored.ts && (Date.now() - stored.ts) > 365 * 24 * 3600 * 1000) {
        return; // Expired, use defaults
      }
      // Apply stored consent
      gtag('consent', 'update', {
        ad_storage: stored.ad_storage || 'denied',
        analytics_storage: stored.analytics_storage || 'denied',
        ad_user_data: stored.ad_user_data || 'denied',
        ad_personalization: stored.ad_personalization || 'denied'
      });
    }
  } catch (e) {
    // localStorage unavailable or parse error - use defaults
  }
})();

// Configure GA4 after consent is set
gtag('js', new Date());
gtag('config', 'G-PTHZ5NZFVJ');
