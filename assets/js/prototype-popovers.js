(() => {
  // Only on prototype route
  if (!/\/prototype\/stocking-prototype\.html$/.test(location.pathname)) return;

  const TRIGGER_SEL =
    '[aria-controls][data-popover="info"], .info-btn[aria-controls], .tooltip-trigger[aria-controls], .ttg-info[aria-controls]';

  let current = null;          // {trigger, panel}
  let openedAt = 0;            // timestamp to ignore first outside event

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function panelOf(trigger) {
    const id = trigger.getAttribute('aria-controls');
    return id ? document.getElementById(id) : null;
  }

  function place(trigger, panel) {
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const m = 12;
    let top = t.bottom + m;
    let left = t.left;

    if (left + p.width + m > innerWidth) left = innerWidth - p.width - m;
    if (top + p.height + m > innerHeight) top = t.top - p.height - m;

    top = clamp(top, m, innerHeight - p.height - m);
    left = clamp(left, m, innerWidth - p.width - m);

    Object.assign(panel.style, {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      zIndex: '10020'
    });
  }

  function ensureClose(panel) {
    // Remove duplicates, keep first if present
    const closes = panel.querySelectorAll('.popover-close,[data-close="popover"]');
    closes.forEach((btn, i) => { if (i > 0) btn.remove(); });

    let btn = panel.querySelector('.popover-close,[data-close="popover"]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'popover-close';
      btn.setAttribute('aria-label', 'Close');
      btn.textContent = '×';
      (panel.querySelector('.popover-header') || panel).prepend(btn);
    }
    if (!panel.dataset.closeWired) {
      btn.addEventListener('click', (e) => { e.preventDefault(); if (current) close(current.trigger, current.panel); });
      panel.dataset.closeWired = '1';
    }
  }

  function open(trigger, panel) {
    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    panel.setAttribute('role', panel.getAttribute('role') || 'dialog');
    panel.setAttribute('aria-modal', 'false');
    ensureClose(panel);
    place(trigger, panel);
    current = { trigger, panel };
    openedAt = performance.now();
    panel.querySelector('.popover-close')?.focus?.({ preventScroll: true });
  }

  function close(trigger, panel) {
    trigger.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    current = null;
    trigger.focus?.({ preventScroll: true });
  }

  function toggle(trigger) {
    const panel = panelOf(trigger);
    if (!panel) return;
    trigger.setAttribute('aria-haspopup', 'dialog');
    if (!trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'false');
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    expanded ? close(trigger, panel) : open(trigger, panel);
  }

  // Delegated pointer/keyboard
  document.addEventListener('pointerup', (e) => {
    const t = e.target.closest(TRIGGER_SEL);
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    toggle(t);
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target.closest(TRIGGER_SEL);
    if (!t) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(t); }
  });

  // Outside close & ESC (ignore first outside after open)
  document.addEventListener('pointerdown', (e) => {
    if (!current) return;
    if (performance.now() - openedAt < 250) return;
    if (e.target.closest(TRIGGER_SEL) === current.trigger) return;
    if (e.target.closest('[role="dialog"],[data-popover-panel]')) return;
    close(current.trigger, current.panel);
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) { e.preventDefault(); close(current.trigger, current.panel); }
  });

  // Initial ARIA cleanup
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(TRIGGER_SEL).forEach(btn => {
      btn.setAttribute('aria-haspopup', 'dialog');
      if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
      // make sure triggers are buttons for a11y if they were <span>
      if (btn.tagName === 'SPAN') { btn.setAttribute('role', 'button'); btn.tabIndex = 0; }
    });
    document.querySelectorAll('[id][data-popover-panel], .popover-panel').forEach(p => {
      p.hidden = true;
      p.setAttribute('role', p.getAttribute('role') || 'dialog');
      p.style.zIndex = '10020';
    });
  });

})();
