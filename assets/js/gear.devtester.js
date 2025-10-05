(function(){
  function devMode(){ return new URLSearchParams(location.search).has('dev'); }
  function summarize(){
    const cards = Array.from(document.querySelectorAll('[data-card]'));
    let ok=0, warn=0, err=0;
    const rows = cards.map(c=>{
      const btn = c.querySelector('[data-action="buy-amazon"]');
      const href = btn ? (btn.getAttribute('href')||"") : "";
      const asin = c.getAttribute('data-asin')||"";
      let status = "OK";
      if(!asin || !/^[A-Z0-9]{10}$/.test(asin)) status = "ERROR";
      else if(!window.AffiliateLinkBuilder.isCanonical(href)) status = "WARN";
      if(status==="OK") ok++; else if(status==="WARN") warn++; else err++;
      const title = (c.querySelector('.gear-card__title')||{}).textContent||"";
      return {Category:"Heating", Product_Name:title, ASIN:asin, href, status};
    });
    return {ok,warn,err,rows};
  }
  function panel(){
    const wrap = document.createElement('div');
    wrap.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:9999;background:#0b1220;color:#fff;border:1px solid #2b3a55;border-radius:8px;padding:10px 12px;font:12px/1.3 system-ui;box-shadow:0 6px 20px rgba(0,0,0,.35)";
    wrap.id = "devtester-panel";
    document.body.appendChild(wrap);
    function render(){
      const {ok,warn,err,rows} = summarize();
      wrap.innerHTML = `<strong>Dev Tester</strong><br>OK: ${ok} &nbsp; WARN: ${warn} &nbsp; ERROR: ${err} &nbsp; <button id="dev-copy" style="margin-left:8px">Copy</button>`;
      const btn = wrap.querySelector('#dev-copy');
      btn.onclick = () => {
        const text = rows.map(r=>`${r.status}\t${r.Category}\t${r.Product_Name}\t${r.ASIN}\t${r.href}`).join('\n');
        navigator.clipboard.writeText(text);
      };
      console.table(rows);
    }
    render();
    return {render};
  }
  function init(){
    if(!devMode()) return;
    const p = panel();
    window.__devTesterInit = p.render;
  }
  if(document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
