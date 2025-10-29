(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (!window.location || !window.location.pathname || !window.location.pathname.includes('/prototype/')) {
    return;
  }

  const AGGRESSION_SELECTORS = [
    '[data-role="aggression-percent"]',
    '.meter--aggression',
    '.aggression-meter',
    '[data-metric="aggression"]',
  ];

  function pruneAggressionMeter(root) {
    if (!root) return;

    const toRemove = new Set();

    AGGRESSION_SELECTORS.forEach((selector) => {
      root.querySelectorAll(selector).forEach((node) => {
        toRemove.add(node);
        const bar = node.closest('.env-bar');
        if (bar) {
          toRemove.add(bar);
        }
      });
    });

    root.querySelectorAll('[data-info="aggression"]').forEach((infoBtn) => {
      const container = infoBtn.closest('.env-bar');
      if (container) {
        toRemove.add(container);
      }
      toRemove.add(infoBtn);
    });

    toRemove.forEach((node) => {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  function init() {
    const barsRoot = document.getElementById('env-bars');
    if (!barsRoot) {
      return;
    }

    pruneAggressionMeter(barsRoot);

    const observer = new MutationObserver(() => {
      pruneAggressionMeter(barsRoot);
    });

    observer.observe(barsRoot, { childList: true, subtree: true });

    window.addEventListener('beforeunload', () => {
      observer.disconnect();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
