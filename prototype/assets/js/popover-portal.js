(() => {
  const root = document.getElementById('ttg-popover-root');
  if (!root) return;

  const VP_PAD = 8; // keep this many px inside viewport
  const GAP_MOBILE = 6;
  const GAP_DESK = 8;

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  const gap = () => (isMobile() ? GAP_MOBILE : GAP_DESK);

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /** Compute best position near trigger with tight gap and on-screen clamping */
  function computePosition(triggerRect, panelRect) {
    const g = gap();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    // Prefer bottom-start; fall back to top-start if not enough space
    const preferBottom =
      (triggerRect.bottom + g + panelRect.height + VP_PAD) <= vh;

    let top = preferBottom
      ? triggerRect.bottom + g
      : triggerRect.top - panelRect.height - g;

    // Start at left aligned to trigger, clamp into viewport with padding
    let left = triggerRect.left;

    // If panel would overflow right, shift left; if overflow left, clamp rightwards
    left = clamp(left, VP_PAD, vw - panelRect.width - VP_PAD);

    // If the chosen side still overflows (extreme cases), force to other side
    if (!preferBottom && top < VP_PAD) {
      top = clamp(triggerRect.bottom + g, VP_PAD, vh - panelRect.height - VP_PAD);
    } else {
      top = clamp(top, VP_PAD, vh - panelRect.height - VP_PAD);
    }

    // arrow offsets (optional)
    const arrowLeft = clamp((triggerRect.left + triggerRect.width/2) - left - 5, 10, panelRect.width - 10);
    const arrowTop = preferBottom ? -5 : panelRect.height - 5; // top or bottom

    return { top, left, preferBottom, arrowLeft, arrowTop };
  }

  function placePanel(trigger, panel) {
    // Ensure we can measure
    panel.style.visibility = 'hidden';
    panel.style.display = 'block';
    panel.dataset.arrow = 'true';

    // Measure after in DOM
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();

    const pos = computePosition(t, p);
    panel.style.top = `${Math.round(window.scrollY + pos.top)}px`;
    panel.style.left = `${Math.round(window.scrollX + pos.left)}px`;
    panel.style.setProperty('--arrow-left', `${Math.round(pos.arrowLeft)}px`);
    panel.style.setProperty('--arrow-top', `${Math.round(pos.arrowTop)}px`);

    panel.style.visibility = 'visible';
  }

  function openPopover(trigger, panel) {
    // semantics
    const isTooltip = (panel.getAttribute('role') || '').toLowerCase() === 'tooltip';
    if (!isTooltip) panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.classList.add('ttg-popover-panel');

    // portal
    root.appendChild(panel);
    root.removeAttribute('aria-hidden');

    placePanel(trigger, panel);
    trigger.setAttribute('aria-expanded', 'true');

    // Close handlers
    const onDocClick = (e) => { if (!panel.contains(e.target) && e.target !== trigger) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onScroll = () => placePanel(trigger, panel);
    const onResize = () => placePanel(trigger, panel);

    function close() {
      trigger.setAttribute('aria-expanded', 'false');
      (trigger._ttgOriginalHost || document.body).appendChild(panel);
      panel.style.display = 'none';
      root.setAttribute('aria-hidden', 'true');
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    }

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);  // capture scroll from containers too
    window.addEventListener('resize', onResize);

    trigger._ttgClose = close;
  }

  function bind(trigger) {
    const id = trigger.getAttribute('aria-controls');
    if (!id) return;
    const panel = document.getElementById(id);
    if (!panel) return;

    if (!trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'false');
    if (!trigger._ttgOriginalHost) trigger._ttgOriginalHost = panel.parentElement;

    const toggle = (e) => {
      e.preventDefault();
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      if (expanded && trigger._ttgClose) trigger._ttgClose();
      else openPopover(trigger, panel);
      trigger.focus({ preventScroll: true });
    };
    trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') toggle(e);
    });
  }

  // (Re)bind known info triggers
  const triggers = document.querySelectorAll(
    '#stocking-tip-btn, .ttg-info-btn, .tooltip-trigger, [aria-haspopup="dialog"], [aria-controls]'
  );
  triggers.forEach(bind);
})();
