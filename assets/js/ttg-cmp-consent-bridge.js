/**
 * TTG CMP Consent Bridge - Placeholder
 *
 * This file ensures the ttgConsentBridge object exists for pages that expect it.
 * The main consent functionality is provided by consent-mode.js which creates
 * and populates the ttgConsentBridge object with actual implementations.
 *
 * This placeholder prevents errors if this script loads before consent-mode.js.
 */
(function() {
  'use strict';

  // Ensure the bridge object exists
  var bridge = window.ttgConsentBridge = window.ttgConsentBridge || {};

  // Provide no-op fallbacks for methods that might be called
  // These will be overwritten by consent-mode.js when it loads
  if (typeof bridge.showFundingChoicesDialog !== 'function') {
    bridge.showFundingChoicesDialog = function() {
      console.warn('ttgConsentBridge.showFundingChoicesDialog: consent-mode.js not loaded yet');
      return false;
    };
  }

  if (typeof bridge.resetStoredConsent !== 'function') {
    bridge.resetStoredConsent = function() {
      console.warn('ttgConsentBridge.resetStoredConsent: consent-mode.js not loaded yet');
    };
  }
})();
