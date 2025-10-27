(() => {
  if (!location.pathname.includes('/prototype/stocking-prototype.html')) return;

  if (typeof window !== 'undefined') {
    window.disableLegacyFiltrationCard = true;
    if (typeof window.renderLegacyFiltration === 'function') {
      window.renderLegacyFiltration = () => {};
    }
    if (typeof window.renderLegacyFiltrationSummary === 'function') {
      window.renderLegacyFiltrationSummary = () => {};
    }
  }

  window.renderFiltration?.();
})();
