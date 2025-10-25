(function () {
  if (!/\/prototype\/stocking-prototype\.html$/.test(location.pathname)) return;

  const CLOSE_SEL = '.info-popover__close, .popover-close, [data-close="popover"], button[aria-label="Close"]';

  function ensureSingleClose(panel) {
    const header = panel.querySelector('.info-popover__header, .popover-header, header') || panel;
    const closes = header.querySelectorAll(CLOSE_SEL);
    let primary = closes[0] || null;

    if (closes.length > 1) {
      closes.forEach((btn, idx) => { if (idx > 0) btn.remove(); });
    }

    if (!primary) {
      primary = document.createElement('button');
      primary.type = 'button';
      primary.className = 'info-popover__close';
      primary.textContent = '×';
      primary.setAttribute('aria-label', 'Close');
      primary.setAttribute('title', 'Close');
      primary.dataset.close = 'popover';
      primary.dataset.infoClose = '';
      header.appendChild(primary);
    } else {
      primary.type = 'button';
      if (!primary.classList.contains('info-popover__close')) {
        primary.classList.add('info-popover__close');
      }
      if (!primary.hasAttribute('aria-label')) primary.setAttribute('aria-label', 'Close');
      if (!primary.hasAttribute('title')) primary.setAttribute('title', 'Close');
      if (!primary.dataset.close) primary.dataset.close = 'popover';
      if (!primary.dataset.infoClose) primary.dataset.infoClose = '';
      if ((primary.textContent || '').trim().length !== 1) primary.textContent = '×';
    }

    // Normalize any other close glyphs lingering in the panel (defensive)
    panel.querySelectorAll(CLOSE_SEL).forEach((btn) => {
      if ((btn.textContent || '').trim().length !== 1) btn.textContent = '×';
    });

    return primary;
  }

  // 1) Ensure portal root
  let root = document.getElementById('ttg-popover-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'ttg-popover-root';
    root.setAttribute('aria-hidden', 'true');
    document.body.prepend(root);
  }

  // Utilities
  const VP_PAD = 8;
  const GAP_MOBILE = 6, GAP_DESK = 8;
  const isMobile = () => matchMedia('(max-width: 768px)').matches;
  const gap = () => (isMobile() ? GAP_MOBILE : GAP_DESK);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  // Resolve the panel for a trigger:
  function resolvePanel(trigger) {
    // 1) Prefer aria-controls
    const id = trigger.getAttribute('aria-controls');
    if (id) {
      const byId = document.getElementById(id);
      if (byId) return byId;
    }
    // 2) data-popover-target="#id"
    const tSel = trigger.getAttribute('data-popover-target');
    if (tSel) {
      const any = document.querySelector(tSel);
      if (any) return any;
    }
    // 3) Next sibling that looks like a popover/tooltip
    let sib = trigger.nextElementSibling;
    while (sib) {
      const role = (sib.getAttribute('role') || '').toLowerCase();
      if (
        role === 'tooltip' ||
        sib.hasAttribute('data-popover') ||
        sib.classList.contains('popover') ||
        sib.classList.contains('tooltip')
      ) {
        return sib;
      }
      sib = sib.nextElementSibling;
    }
    // 4) Last resort: closest descendant marked data-popover within same parent
    const cand = trigger.parentElement?.querySelector('[role="tooltip"],[data-popover],.tooltip,.popover');
    return cand || null;
  }

  function computePosition(triggerRect, panelRect) {
    const g = gap();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    // Prefer bottom if enough room
    const preferBottom = (triggerRect.bottom + g + panelRect.height + VP_PAD) <= vh;

    let top = preferBottom
      ? triggerRect.bottom + g
      : triggerRect.top - panelRect.height - g;

    let left = triggerRect.left;
    left = clamp(left, VP_PAD, vw - panelRect.width - VP_PAD);

    // Clamp vertically
    top = clamp(top, VP_PAD, vh - panelRect.height - VP_PAD);

    const arrowLeft = clamp((triggerRect.left + triggerRect.width / 2) - left - 5, 10, panelRect.width - 10);
    return { top, left, preferBottom, arrowLeft };
  }

  function place(trigger, panel) {
    // Reveal for measurement
    panel.style.visibility = 'hidden';
    panel.style.display = 'block';

    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();

    const pos = computePosition(t, p);
    panel.style.top = `${Math.round(window.scrollY + pos.top)}px`;
    panel.style.left = `${Math.round(window.scrollX + pos.left)}px`;
    panel.style.visibility = 'visible';
  }

  function close(trigger, panel) {
    trigger.setAttribute('aria-expanded', 'false');
    if (trigger._ttgOriginalHost) trigger._ttgOriginalHost.appendChild(panel);
    panel.style.display = 'none';
    root.setAttribute('aria-hidden', 'true');

    if (panel._ttgCloseBtn && panel._ttgCloseHandler) {
      panel._ttgCloseBtn.removeEventListener('click', panel._ttgCloseHandler);
      panel._ttgCloseBtn = null;
      panel._ttgCloseHandler = null;
    }

    document.removeEventListener('mousedown', panel._onDocClick);
    document.removeEventListener('keydown', panel._onKey);
    window.removeEventListener('scroll', panel._onReposition, true);
    window.removeEventListener('resize', panel._onReposition);
  }

  function open(trigger, panel) {
    if (!panel.classList.contains('ttg-popover-panel')) panel.classList.add('ttg-popover-panel');

    if (!trigger._ttgOriginalHost) trigger._ttgOriginalHost = panel.parentElement;
    root.appendChild(panel);
    root.removeAttribute('aria-hidden');

    // Accessibility: use dialog semantics for multi-line content
    const role = (panel.getAttribute('role') || '').toLowerCase();
    if (!role || role === 'tooltip') panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');

    place(trigger, panel);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.focus({ preventScroll: true });

    const closeBtn = ensureSingleClose(panel);
    if (closeBtn) {
      if (panel._ttgCloseBtn && panel._ttgCloseBtn !== closeBtn && panel._ttgCloseHandler) {
        panel._ttgCloseBtn.removeEventListener('click', panel._ttgCloseHandler);
      }

      const handler = (e) => {
        e.preventDefault();
        close(trigger, panel);
      };

      closeBtn.addEventListener('click', handler);
      panel._ttgCloseBtn = closeBtn;
      panel._ttgCloseHandler = handler;
    }

    panel._onDocClick = (e) => {
      if (!panel.contains(e.target) && e.target !== trigger) close(trigger, panel);
    };
    panel._onKey = (e) => { if (e.key === 'Escape') close(trigger, panel); };
    panel._onReposition = () => place(trigger, panel);

    document.addEventListener('mousedown', panel._onDocClick);
    document.addEventListener('keydown', panel._onKey);
    window.addEventListener('scroll', panel._onReposition, true);
    window.addEventListener('resize', panel._onReposition);
  }

  function bindTrigger(trigger) {
    const panel = resolvePanel(trigger);
    if (!panel) {
      const path = trigger.id
        ? `#${trigger.id}`
        : trigger.className
          ? `.${String(trigger.className).trim().replace(/\s+/g, '.')}`
          : trigger.tagName.toLowerCase();
      const label = trigger.getAttribute('aria-label') || trigger.textContent?.trim() || 'unknown trigger';
      console.warn('[TTG proto] popover trigger missing panel:', { path, label });
      return;
    }

    if (!trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'false');
    // Ensure each trigger bound once
    if (trigger._ttgBound) return;
    trigger._ttgBound = true;

    const toggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (trigger.dataset.lock) return;
      trigger.dataset.lock = '1';
      setTimeout(() => { delete trigger.dataset.lock; }, 200);
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      expanded ? close(trigger, panel) : open(trigger, panel);
    };

    trigger.addEventListener('click', toggle, false);
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') toggle(e);
      if (e.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
        e.preventDefault(); close(trigger, panel);
      }
    }, false);
    trigger.addEventListener('touchend', (e) => {
      toggle(e);
    }, { passive: false });
  }

  function bindAll() {
    const sel = [
      '#stocking-tip-btn',
      '.ttg-info-btn',
      '.tooltip-trigger',
      '[data-info]',
      '[aria-haspopup][aria-controls]',
      '[data-popover-target]'
    ].join(',');
    const triggers = document.querySelectorAll(sel);

    if (!triggers.length) {
      console.warn('[TTG proto] no info-popover triggers found; aborting binder');
      return;
    }

    triggers.forEach(bindTrigger);
  }

  // Initial bind after network idle-ish
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll);
  } else {
    bindAll();
  }

  // Rebind on DOM mutations (prototype’s UI flips between compact/expanded)
  const mo = new MutationObserver((muts) => {
    // If nodes added or attributes affecting visibility changed, try rebinding
    for (const m of muts) {
      if (m.type === 'childList' && (m.addedNodes?.length || m.removedNodes?.length)) {
        bindAll();
        break;
      }
      if (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'hidden' || m.attributeName === 'style')) {
        bindAll();
        break;
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });

  // Debug: surface number of bound triggers (visible in console)
  setTimeout(() => {
    const count = document.querySelectorAll('[aria-expanded]').length;
    console.info('[TTG proto] info-popovers bound:', count);
  }, 500);
})();
