(function(){
  async function inject(node){
    const url = node.getAttribute('data-include');
    if(!url) return;
    try{
      const res = await fetch(url,{cache:'no-store'});
      if(res.ok){ node.innerHTML = await res.text(); }
    }catch(_){ }
  }
  function init(){
    document.querySelectorAll('[data-include]').forEach(inject);
  }
  if(document.readyState!=="loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
