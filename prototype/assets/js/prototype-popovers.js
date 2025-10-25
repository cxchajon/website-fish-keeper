// PROTOTYPE-ONLY popover binder (no deps)
(() => {
  function inPrototype() {
    return location.pathname.includes('/prototype/stocking-prototype.html');
  }
  if (!inPrototype()) return;

  const OPEN = 'is-open';
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const byId = id => document.getElementById(id);

  function place(trigger, panel) {
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    let top = t.bottom + 8 + scrollY;
    let left = Math.max(12, Math.min(t.left + scrollX, vw - p.width - 12));
    if (top + p.height - scrollY > vh) top = t.top - p.height - 8 + scrollY;
    panel.style.position = 'absolute';
    panel.style.left = `${left}px`;
    panel.style.top  = `${Math.max(12, top)}px`;
    panel.style.zIndex = '1100';
  }

  function focusFirst(panel) {
    const first = panel.querySelector('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    (first || panel).focus({ preventScroll: true });
  }

  function open(trigger, panel) {
    trigger.setAttribute('aria-expanded', 'true');
    panel.removeAttribute('hidden');
    panel.classList.add(OPEN);
    if (!panel.hasAttribute('role')) panel.setAttribute('role','dialog');
    if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex','-1');

    requestAnimationFrame(() => {
      place(trigger, panel);
      focusFirst(panel);
    });

    const outside = e => { if (!panel.contains(e.target) && e.target !== trigger) close(trigger, panel); };
    const esc = e => { if (e.key === 'Escape') close(trigger, panel); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', esc, true);
    panel._clean = () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', esc, true);
    };
  }

  function close(trigger, panel) {
    trigger.setAttribute('aria-expanded','false');
    panel.classList.remove(OPEN);
    panel.setAttribute('hidden','');
    panel._clean && panel._clean();
    trigger.focus({ preventScroll:true });
  }

  function bindTrigger(trigger) {
    const id = trigger.getAttribute('aria-controls') || trigger.dataset.protoPopover;
    const panel = id && byId(id);
    if (!panel) return;

    // de-dup close icons
    const closeButtons = panel.querySelectorAll('[data-close], .ttg-popover-close, .popover-close, button[aria-label="Close"]');
    closeButtons.forEach((b, i) => { if (i > 0) b.classList.add('dup-x'); });
    const closeBtn = closeButtons[0] || panel.querySelector('button') || null;
    if (closeBtn) {
      closeBtn.type = 'button';
      closeBtn.setAttribute('data-close','');
      closeBtn.addEventListener('click', e => { e.preventDefault(); close(trigger, panel); });
    }

    trigger.setAttribute('aria-haspopup','dialog');
    trigger.setAttribute('aria-expanded','false');

    const toggle = e => {
      e.preventDefault();
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      expanded ? close(trigger, panel) : open(trigger, panel);
    };
    trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') toggle(e);
    });

    const reposition = () => { if (panel.classList.contains(OPEN)) place(trigger, panel); };
    addEventListener('resize', reposition);
    addEventListener('scroll', reposition, { passive:true });
  }

  function init() {
    const triggers = [
      ...qsa('[data-proto-popover]'),
      ...qsa('.proto-info-trigger')
    ];
    triggers.forEach(bindTrigger);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
