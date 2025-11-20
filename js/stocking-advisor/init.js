document.documentElement.classList.add('prototype-mode');

if (typeof window !== 'undefined' && typeof window.shouldRestoreVariantFocus !== 'function') {
  window.shouldRestoreVariantFocus = () => false;
}

const fireProtoEvent = (eventName) => {
  if (!eventName) return;
  try {
    const analytics = window.saProtoAnalytics;
    if (analytics && typeof analytics.emit === 'function') {
      analytics.emit(eventName);
      return;
    }

    const dataLayer = window.dataLayer;
    if (Array.isArray(dataLayer) && typeof dataLayer.push === 'function') {
      dataLayer.push({ event: eventName });
    }
  } catch (error) {
    // Silently swallow to avoid breaking prototype experiences
  }
};

const BIOLOAD_TIP_TEXT =
  "Shows how much of your tank's capacity is used based on species size and waste output. Staying in the green keeps extra buffer for filtration, oxygen, and future growth.";

const upgradeInfoBadge = (node, tipText) => {
  if (!(node instanceof HTMLElement)) {
    return null;
  }
  if (node.classList.contains('info-badge')) {
    node.classList.add('info-btn');
    if (!node.dataset.tip && tipText) {
      node.dataset.tip = tipText;
    }
    if (!node.hasAttribute('role')) {
      node.setAttribute('role', 'button');
    }
    if (!node.hasAttribute('tabindex')) {
      node.setAttribute('tabindex', '0');
    }
    node.setAttribute('aria-expanded', node.getAttribute('aria-expanded') || 'false');
    if (!node.textContent || !node.textContent.trim()) {
      node.textContent = 'i';
    }
    return node;
  }

  const replacement = document.createElement('span');
  replacement.className = 'info-badge info-btn';
  replacement.setAttribute('role', 'button');
  replacement.setAttribute('tabindex', '0');
  replacement.setAttribute('aria-expanded', 'false');

  const ariaLabel = node.getAttribute('aria-label');
  if (ariaLabel) {
    replacement.setAttribute('aria-label', ariaLabel);
  }

  if (tipText) {
    replacement.dataset.tip = tipText;
  } else if (node.dataset.tip || node.dataset.tooltip) {
    replacement.dataset.tip = (node.dataset.tip || node.dataset.tooltip || '').trim();
  }

  replacement.textContent = (node.textContent || 'i').trim() || 'i';

  node.replaceWith(replacement);
  return replacement;
};

const syncBioloadBadges = (root = document) => {
  if (!root) return;

  const selectors = [
    '.ttg-tooltip-trigger[data-info="bioload"]',
    'button.info-btn[data-info="bioload"]',
    '[data-role="info-btn"][data-info="bioload"]',
  ];

  selectors.forEach((selector) => {
    root.querySelectorAll(selector).forEach((node) => {
      const upgraded = upgradeInfoBadge(node, BIOLOAD_TIP_TEXT);
      if (upgraded instanceof HTMLElement) {
        upgraded.classList.remove('ttg-tooltip-trigger');
        upgraded.removeAttribute('data-tooltip-id');
        upgraded.dataset.info = 'bioload';
        upgraded.setAttribute('data-info-target', '#bioload-info-panel');
        upgraded.setAttribute('aria-controls', 'bioload-info-panel');
        upgraded.setAttribute('aria-haspopup', 'dialog');
        upgraded.setAttribute('aria-expanded', upgraded.getAttribute('aria-expanded') === 'true' ? 'true' : 'false');
        upgraded.setAttribute('type', 'button');
        upgraded.id = 'bioload-info-btn';
      }
    });
  });

  root.querySelectorAll('.info-badge[data-info="bioload"]').forEach((node) => {
    if (node instanceof HTMLElement) {
      node.dataset.tip = node.dataset.tip || BIOLOAD_TIP_TEXT;
      node.setAttribute('data-info-target', '#bioload-info-panel');
      node.setAttribute('aria-controls', 'bioload-info-panel');
      node.setAttribute('aria-haspopup', 'dialog');
    }
  });
};

const observeBioloadBadgeRenders = () => {
  const envBars = document.getElementById('env-bars');
  if (!envBars) return;

  const applySync = () => {
    syncBioloadBadges(envBars);
    const tooltips = window.TTGProtoTooltips;
    if (tooltips && typeof tooltips.close === 'function') {
      tooltips.close();
    }
  };

  applySync();

  if (typeof MutationObserver !== 'function') {
    return;
  }

  const observer = new MutationObserver(() => {
    applySync();
  });

  observer.observe(envBars, { childList: true, subtree: true });

  window.addEventListener(
    'beforeunload',
    () => {
      observer.disconnect();
    },
    { once: true },
  );
};

const setupHowItWorksModal = () => {
  const trigger =
    document.querySelector('.sa-proto-howitworks-trigger') ||
    document.querySelector('[data-sa-proto-modal-trigger="how-it-works"]');
  const modal =
    document.getElementById('sa-proto-howitworks') ||
    document.querySelector('[data-sa-proto-modal]');
  if (!trigger || !modal) return;

  const closeButton = modal.querySelector('[data-sa-proto-modal-close]');
  const announcer = document.querySelector('[data-sa-proto-modal-announcer]');
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea',
    'input',
    'select',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  let lastFocusedElement = null;
  let closeTimer = null;
  let focusTimer = null;

  const setExpanded = (state) => {
    trigger.setAttribute('aria-expanded', state ? 'true' : 'false');
  };

  const announceOpen = () => {
    if (announcer) {
      announcer.textContent = 'How it works dialog opened.';
    }
  };

  const focusTrap = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = modal.querySelectorAll(focusableSelectors);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleEscape = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
  };

  const openModal = () => {
    if (modal.classList.contains('is-active')) return;

    lastFocusedElement = document.activeElement;
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
    if (focusTimer) {
      window.clearTimeout(focusTimer);
      focusTimer = null;
    }

    modal.hidden = false;
    document.body.classList.add('sa-proto-modal-open');

    requestAnimationFrame(() => {
      modal.classList.add('is-active');
      closeButton?.focus();
    });

    setExpanded(true);
    announceOpen();
    fireProtoEvent('sa_proto_how_it_works_opened');

    modal.addEventListener('keydown', focusTrap);
    document.addEventListener('keydown', handleEscape);
  };

  const finishClose = () => {
    modal.hidden = true;
  };

  const closeModal = () => {
    if (!modal.classList.contains('is-active')) return;

    modal.classList.remove('is-active');
    document.body.classList.remove('sa-proto-modal-open');
    setExpanded(false);
    fireProtoEvent('sa_proto_how_it_works_closed');

    if (announcer) {
      announcer.textContent = '';
    }

    modal.removeEventListener('keydown', focusTrap);
    document.removeEventListener('keydown', handleEscape);

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) {
      finishClose();
    } else {
      closeTimer = window.setTimeout(() => {
        finishClose();
        closeTimer = null;
      }, 240);
    }

    const returnFocus = () => {
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      } else {
        trigger.focus();
      }
    };

    const focusDelay = prefersReducedMotion ? 0 : 260;
    focusTimer = window.setTimeout(() => {
      returnFocus();
      focusTimer = null;
    }, focusDelay);
  };

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openModal();
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openModal();
    }
  });

  closeButton?.addEventListener('click', (event) => {
    event.preventDefault();
    closeModal();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
};

const setupFeatureCta = () => {
  const cta = document.querySelector('.sa-proto-feature-primary[data-sa-proto-feature-cta]');
  if (!cta) return;

  cta.addEventListener('click', () => {
    fireProtoEvent('sa_proto_feature_tank_cta_clicked');
  });
};

const removeFiltrationSummaryInfo = () => {
  const host = document.getElementById('filtration-trigger');
  if (!host) return;

  const INFO_SELECTOR = '[data-role="filtration-info"]';
  const PANEL_ID = 'filtration-pill-tip';

  const prune = () => {
    const infoTrigger = host.querySelector(INFO_SELECTOR);
    if (infoTrigger) {
      // Filtration summary info trigger selectors:
      // - #filtration-trigger [data-role="filtration-info"]
      // - .info-btn.ttg-tooltip-trigger[aria-controls="filtration-pill-tip"]
      // Associated panel id: "filtration-pill-tip"
      const panelId = infoTrigger.getAttribute('aria-controls') || PANEL_ID;
      infoTrigger.remove();
      if (panelId) {
        const panel = document.getElementById(panelId);
        panel?.remove();
      }
    } else {
      const strayPanel = document.getElementById(PANEL_ID);
      strayPanel?.remove();
    }
  };

  prune();

  const observer = new MutationObserver(() => {
    const hasTrigger = host.querySelector(INFO_SELECTOR);
    const hasPanel = document.getElementById(PANEL_ID);
    if (!hasTrigger && !hasPanel) {
      return;
    }
    prune();
  });

  observer.observe(host, { childList: true, subtree: true });

  window.addEventListener('beforeunload', () => observer.disconnect(), { once: true });
};

const stripPrototypeDiagnostics = () => {
  const selectors = ['.dev-debug', '[data-proto-debug]'];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      node.remove();
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  setupHowItWorksModal();
  setupFeatureCta();
  removeFiltrationSummaryInfo();
  stripPrototypeDiagnostics();
  syncBioloadBadges(document);
  observeBioloadBadgeRenders();
});

const adSlots = document.querySelectorAll('[data-prototype-ad]');
adSlots.forEach((slot) => {
  slot.setAttribute('role', 'complementary');
  slot.setAttribute('aria-label', 'Advertisement placeholder');
});
