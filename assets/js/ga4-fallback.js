(function(){
  var SNIPPET_PATH = window.__TTG_GA4_PATH__ || '/includes/ga4.html';
  var HEAD = document.head || document.getElementsByTagName('head')[0];
  var ELEMENT_NODE = 1;
  var TEXT_NODE = 3;
  window.__ttgDeferredConsentUpdates__ = window.__ttgDeferredConsentUpdates__ || [];

  function ensureStub(){
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function gtag(){ window.dataLayer.push(arguments); };
    }
  }

  function cloneScript(node){
    var script = document.createElement('script');
    Array.prototype.slice.call(node.attributes).forEach(function(attr){
      script.setAttribute(attr.name, attr.value);
    });
    script.textContent = node.textContent;
    return script;
  }

  function injectSnippet(html){
    if (!HEAD) return;
    var template = document.createElement('template');
    template.innerHTML = html;
    Array.prototype.slice.call(template.content.childNodes).forEach(function(node){
      if (node.nodeType === ELEMENT_NODE && node.tagName === 'SCRIPT') {
        HEAD.appendChild(cloneScript(node));
      } else if (node.nodeType === ELEMENT_NODE || node.nodeType === TEXT_NODE) {
        HEAD.appendChild(node.cloneNode(true));
      }
    });
    window.__TTG_GA4_PRESENT__ = true;
  }

  function fetchSnippet(){
    if (window.__TTG_GA4_PRESENT__ || window.__TTG_GA4_FALLBACK_STARTED__) {
      return;
    }
    window.__TTG_GA4_FALLBACK_STARTED__ = true;
    fetch(SNIPPET_PATH, { credentials: 'same-origin' })
      .then(function(response){ return response.text(); })
      .then(injectSnippet)
      .catch(function(err){
        console.warn('[ga4-fallback] Unable to load GA4 include:', err);
      });
  }

  function ensureLoader(){
    ensureStub();
    if (window.__TTG_GA4_PRESENT__) {
      return;
    }
    fetchSnippet();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureLoader);
  } else {
    ensureLoader();
  }

  window.addEventListener('load', ensureLoader);
})();
