// Guard: remove legacy Filtration summary card from the prototype page
(() => {
  const inProto = () => location.pathname.includes('/prototype/stocking-prototype.html');
  if (!inProto()) return;

  const removeLegacySummary = () => {
    // Direct/known selectors
    document
      .querySelectorAll('#filtration-summary, .filtration-summary, [data-card="filtration-summary"]')
      .forEach((node) => node.remove());

    // Heuristic: any card whose header text is exactly "Filtration",
    // but which is NOT the chip bar container nor the Filter Setup card.
    const cards = document.querySelectorAll('section.card,div.card,article.card');
    cards.forEach((section) => {
      const titleEl = section.querySelector('header h2, header h3, header .card-title, header');
      const title = titleEl?.textContent?.trim()?.toLowerCase();
      const isFilterSetup = section.classList.contains('filter-setup') || section.id === 'filter-setup';
      const containsChips = Boolean(section.querySelector('.chip, .pill, .chip-pills'));
      if (title === 'filtration' && !isFilterSetup && !containsChips) {
        section.remove();
      }
    });
  };

  const run = () => {
    removeLegacySummary();
    // watch for late template insertions
    const mo = new MutationObserver(removeLegacySummary);
    mo.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
