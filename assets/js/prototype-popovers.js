/* eslint-disable */
(() => {
  // Guard: prototype route only
  if (!/\/prototype\/stocking-prototype\.html$/.test(location.pathname)) return;

  const SELECTOR_TRIGGER = '[aria-controls][data-popover="info"], .info-btn[aria-controls], .tooltip-trigger[aria-controls]';
  let open = null;             // currently open panel
  let justOpenedAt = 0;        // timestamp to ignore first outside click

  function q(id) { return document.getElementById(id); }

  // Utility: clamp number
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // Position the panel near the trigger (fixed so it stays in viewport)
  function positionPanel(trigger, panel) {
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const margin = 12;

    let top = t.bottom + margin;
    let left = t.left;

    // If panel would flow off the right, nudge left
    if (left + p.width + margin > window.innerWidth) {
      left = window.innerWidth - p.width - margin;
    }
    // If panel would go below viewport, place above trigger
    if (top + p.height + margin > window.innerHeight) {
      top = t.top - p.height - margin;
    }
    top = clamp(top, margin, window.innerHeight - p.height - margin);
    left = clamp(left, margin, window.innerWidth - p.width - margin);

    Object.assign(panel.style, {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      zIndex: '10020'
    });
  }

  function openPanel(trigger, panel) {
    // ARIA & visibility
    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('role', panel.getAttribute('role') || 'dialog');

    // Remove any duplicate X buttons (keep first)
    const xs = panel.querySelectorAll('.popover-close,[data-close="popover"]');
    if (xs.length > 1) {
      xs.forEach((x, i) => { if (i > 0) x.remove(); });
    }
    // Ensure a close control exists
    let closeBtn = panel.querySelector('.popover-close,[data-close="popover"]');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.className = 'popover-close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.textContent = '×';
      (panel.querySelector('.popover-header') || panel).prepend(closeBtn);
    }
    // Wire close once
    if (!panel.dataset.wiredClose) {
      closeBtn.addEventListener('click', (e) => { e.preventDefault(); closePanel(trigger, panel); });
      panel.dataset.wiredClose = '1';
    }

    positionPanel(trigger, panel);
    (closeBtn || panel).focus?.({ preventScroll: true });

    open = { trigger, panel };
    justOpenedAt = performance.now();
  }

  function closePanel(trigger, panel) {
    trigger.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    open = null;
    trigger.focus?.({ preventScroll: true });
  }

  function toggle(trigger) {
    const id = trigger.getAttribute('aria-controls');
    if (!id) return;
    const panel = q(id);
    if (!panel) return;

    // Ensure trigger semantics
    trigger.setAttribute('aria-haspopup', 'dialog');
    if (!trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'false');

    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    expanded ? closePanel(trigger, panel) : openPanel(trigger, panel);
  }

  // Delegated pointer + keyboard handlers
  document.addEventListener('pointerup', (e) => {
    const trigger = e.target.closest(SELECTOR_TRIGGER);
    if (!trigger) return;
    e.preventDefault();
    e.stopPropagation();
    toggle(trigger);
  });

  document.addEventListener('keydown', (e) => {
    const trigger = e.target.closest(SELECTOR_TRIGGER);
    if (!trigger) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(trigger);
    }
  });

  // Outside click / ESC to close
  document.addEventListener('pointerdown', (e) => {
    if (!open) return;
    // Ignore the first outside event that follows an open (prevents instant close)
    if (performance.now() - justOpenedAt < 250) return;
    if (e.target.closest('[role="dialog"],[data-popover-panel]')) return;
    if (e.target.closest(SELECTOR_TRIGGER) === open.trigger) return;
    closePanel(open.trigger, open.panel);
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel(open.trigger, open.panel);
    }
  });

  // Initial ARIA cleanup & hide all panels
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(SELECTOR_TRIGGER).forEach(btn => {
      btn.setAttribute('aria-haspopup', 'dialog');
      if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('[id][data-popover-panel], .popover-panel').forEach(p => {
      p.hidden = true;
      p.setAttribute('role', p.getAttribute('role') || 'dialog');
      p.style.zIndex = '10020';
    });
  });
})();
