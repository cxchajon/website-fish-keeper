/*
 * Manual Google AdSense units.
 *
 * Requests each adsbygoogle <ins> element inside a .ttg-gad container exactly once.
 * No refresh, no retries, no Auto ads and no units are injected; the markup on the page is
 * the only source of ad positions. The AdSense loader itself stays in the "TTG consent stack"
 * in <head>, so Consent Mode v2 defaults and Google's CMP (Funding Choices) govern every request.
 *
 * The one site-level signal honoured here is the first-party opt-out from /cookie-settings.html:
 * when consent-mode.js marks <html data-ad-consent="denied">, no ad is requested and
 * css/google-ads.css hides the container.
 */
(function () {
  if (window.__TTG_GAD_INIT__) return;
  window.__TTG_GAD_INIT__ = true;

  function init() {
    if (document.documentElement.getAttribute('data-ad-consent') === 'denied') return;

    var units = document.querySelectorAll('.ttg-gad ins.adsbygoogle');
    for (var i = 0; i < units.length; i += 1) {
      var ins = units[i];
      // Google marks processed units with data-adsbygoogle-status; never push one twice.
      if (ins.hasAttribute('data-adsbygoogle-status') || ins.getAttribute('data-ttg-gad') === 'requested') continue;
      ins.setAttribute('data-ttg-gad', 'requested');
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        if (window.console) console.warn('[google-ads] push failed', e);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
