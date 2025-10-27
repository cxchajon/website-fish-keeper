(() => {
  if (!location.pathname.includes('/prototype/stocking-prototype.html')) return;

  window.disableLegacyFiltrationSummary = true;

  if (typeof window.renderFiltration === 'function') {
    window.renderFiltration();
  }
})();
