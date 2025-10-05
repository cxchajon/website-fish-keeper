(function(){
  function harden(){
    document.querySelectorAll('[data-card]').forEach(card=>{
      const asin = AffiliateLinkBuilder.cleanASIN(card.getAttribute('data-asin')||"");
      const btn  = card.querySelector('[data-action="buy-amazon"]');
      if(!btn) return;
      let href = (btn.getAttribute('href')||"").trim();
      if(!AffiliateLinkBuilder.isCanonical(href)) href = AffiliateLinkBuilder.buildFromASIN(asin);
      if(!href){
        btn.setAttribute('disabled','disabled');
        btn.classList.add('is-disabled');
        btn.setAttribute('title','Link unavailable');
        card.dataset.status = "error";
      } else {
        btn.setAttribute('href', href);
        btn.setAttribute('target','_blank');
        btn.setAttribute('rel','noopener noreferrer');
        card.dataset.status = "ok";
      }
    });
  }
  window.__rehardenLinks = harden;
  // auto-run after DOM ready (in case renderer ran before defer)
  if(document.readyState !== 'loading') harden();
  else document.addEventListener('DOMContentLoaded', harden);
})();
