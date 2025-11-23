/**
 * Google CMP (Funding Choices) Bootstrap
 *
 * Required bootstrap script for Google's Consent Management Platform.
 * Signals CMP presence by creating a hidden iframe.
 *
 * Usage: <script src="/js/google-cmp-bootstrap.js" defer></script>
 * Place after the Funding Choices script tag.
 */
(function() {
  function signalGooglefcPresent() {
    if (!window.frames['googlefcPresent']) {
      if (document.body) {
        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'display:none';
        iframe.name = 'googlefcPresent';
        document.body.appendChild(iframe);
      } else {
        setTimeout(signalGooglefcPresent, 0);
      }
    }
  }
  signalGooglefcPresent();
})();
