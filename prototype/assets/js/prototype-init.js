// proto-guard: ensure legacy filtration summary card cannot render
(() => {
  const kill = () => {
    const suspects = [
      '#filtration-summary',
      '.card[data-card="filtration-summary"]',
      'section.card.filtration-summary'
    ];
    document.querySelectorAll(suspects.join(',')).forEach((node) => node.remove());

    document.querySelectorAll('section.card').forEach((section) => {
      const header = section.querySelector('header, .card-title');
      const title = header?.textContent?.trim()?.toLowerCase();
      if (title === 'filtration' && !section.matches('.filter-setup, .chipbar-host')) {
        section.remove();
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kill);
  } else {
    kill();
  }

  // in case a builder inserts it late
  const mo = new MutationObserver(() => kill());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
