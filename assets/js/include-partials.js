(() => {
  async function inject(el) {
    const src = el.getAttribute('data-include');
    if (!src) return;
    try {
      const res = await fetch(src, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Failed include: ${src}`);
      el.outerHTML = await res.text();
    } catch (e) { console.error(e); }
  }
  function run() {
    const nodes = document.querySelectorAll('[data-include]');
    nodes.forEach(inject);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
