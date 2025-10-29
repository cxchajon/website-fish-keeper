import { ASSET_ROOT, IS_PROTOTYPE_BUILD } from '../../../assets/js/env/asset-roots.js';

const PROTOTYPE_SEGMENT = '/prototype/';
const PROTO_BODY_CLASS = 'proto-stock';

const matchesPrototypeLocation = () => {
  if (typeof location === 'undefined' || typeof location.pathname !== 'string') {
    return false;
  }
  return location.pathname.includes(PROTOTYPE_SEGMENT);
};

const bodyHasPrototypeClass = () => {
  if (typeof document === 'undefined') return false;
  try {
    const body = document.body;
    const docEl = document.documentElement;
    return Boolean(
      (body && body.classList && body.classList.contains(PROTO_BODY_CLASS)) ||
        (docEl && docEl.classList && (docEl.classList.contains(PROTO_BODY_CLASS) || docEl.classList.contains('prototype-mode'))),
    );
  } catch (_error) {
    return false;
  }
};

const assetRootMatchesPrototype = typeof ASSET_ROOT === 'string' && ASSET_ROOT.includes(PROTOTYPE_SEGMENT);

const inPrototype =
  assetRootMatchesPrototype ||
  IS_PROTOTYPE_BUILD ||
  matchesPrototypeLocation() ||
  bodyHasPrototypeClass();

if (typeof window !== 'undefined' && typeof document !== 'undefined' && inPrototype && window.__TTG_BLOCK_INIT__ !== true) {
  const AGGRESSION_SELECTORS = [
    '[data-role="aggression-percent"]',
    '.meter--aggression',
    '.aggression-meter',
    '[data-metric="aggression"]',
  ];

  const pruneAggressionMeter = (root) => {
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
  };

  const init = () => {
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
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}
