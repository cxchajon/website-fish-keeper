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
 *
 * A unit that is not rendered (display:none at the current screen width, e.g. a compact unit
 * hidden on very narrow phones) is not requested, because Google cannot size it. It is requested
 * once later if a resize makes it visible. Each push names its unit ({ element }), because a bare
 * push() fills the first unfilled <ins> on the page, which could be the hidden one.
 */
(function () {
  if (window.__TTG_GAD_INIT__) return;
  window.__TTG_GAD_INIT__ = true;

  var waitingForResize = false;
  var resizeQueued = false;

  function isRendered(ins) {
    return ins.getClientRects().length > 0 && ins.offsetWidth > 0;
  }

  function init() {
    if (document.documentElement.getAttribute('data-ad-consent') === 'denied') return;

    var deferred = 0;
    var units = document.querySelectorAll('.ttg-gad ins.adsbygoogle');
    for (var i = 0; i < units.length; i += 1) {
      var ins = units[i];
      // Google marks processed units with data-adsbygoogle-status; never push one twice.
      if (ins.hasAttribute('data-adsbygoogle-status') || ins.getAttribute('data-ttg-gad') === 'requested') continue;
      if (!isRendered(ins)) {
        deferred += 1;
        continue;
      }
      ins.setAttribute('data-ttg-gad', 'requested');
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({ element: ins });
      } catch (e) {
        if (window.console) console.warn('[google-ads] push failed', e);
      }
    }

    if (deferred && !waitingForResize) {
      waitingForResize = true;
      window.addEventListener('resize', onResize);
    } else if (!deferred && waitingForResize) {
      waitingForResize = false;
      window.removeEventListener('resize', onResize);
    }
  }

  function onResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    window.requestAnimationFrame(function () {
      resizeQueued = false;
      init();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
