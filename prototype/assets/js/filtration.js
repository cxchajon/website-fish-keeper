(() => {
  if (!location.pathname.includes('/prototype/stocking-prototype.html')) return;

  window.disableLegacyFiltrationSummary = true;

  const legacySummaryEl = document.getElementById('filtration-summary');
  if (legacySummaryEl) {
    legacySummaryEl.setAttribute('hidden', '');
    legacySummaryEl.setAttribute('data-proto-hide', '');
  }
})();
