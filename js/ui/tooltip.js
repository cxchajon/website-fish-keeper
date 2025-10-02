const INFO_BTN_BOUND_ATTR = 'tipBound';
const OUTSIDE_EVENTS = ['pointerdown', 'mousedown', 'touchstart'];
const GAP = 10;
const MARGIN = 8;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getViewportBox() {
  const vv = window.visualViewport;
  if (vv) {
    return {
      left: vv.offsetLeft ?? vv.pageLeft ?? 0,
      top: vv.offsetTop ?? vv.pageTop ?? 0,
      width: vv.width ?? window.innerWidth,
      height: vv.height ?? window.innerHeight,
      viewport: vv,
    };
  }
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    viewport: null,
  };
}

function ensureButtonClasses(btn) {
  if (!btn.classList.contains('icon-button')) {
    btn.classList.add('icon-button');
  }
  if (!btn.classList.contains('info')) {
    btn.classList.add('info');
  }
  if (!btn.classList.contains('info-btn')) {
    btn.classList.add('info-btn');
  }
}

export function initInfoTooltips() {
  const buttons = Array.from(document.querySelectorAll('[data-role="info-btn"]'));
  if (!buttons.length) {
    return;
  }

  buttons.forEach((button) => {
    if (button.dataset[INFO_BTN_BOUND_ATTR] === '1') {
      return;
    }
    const tipId = button.dataset.infoId;
    if (!tipId) {
      return;
    }
    const tip = document.getElementById(tipId);
    if (!tip) {
      return;
    }

    const freshBtn = button.cloneNode(true);
    ensureButtonClasses(freshBtn);
    freshBtn.dataset[INFO_BTN_BOUND_ATTR] = '1';
    if (!freshBtn.hasAttribute('type')) {
      freshBtn.setAttribute('type', 'button');
    }
    const expanded = freshBtn.getAttribute('aria-expanded') === 'true';
    freshBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    freshBtn.setAttribute('aria-controls', tipId);
    button.replaceWith(freshBtn);

    tip.setAttribute('role', tip.getAttribute('role') || 'tooltip');
    tip.dataset.role = tip.dataset.role || 'info-tip';
    tip.hidden = true;
    tip.setAttribute('aria-hidden', 'true');
    if (tip.parentElement !== document.body) {
      document.body.appendChild(tip);
    }

    let open = false;
    let activeViewport = null;

    const applyState = () => {
      freshBtn.classList.toggle('is-open', open);
      freshBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      tip.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (!open) {
        tip.hidden = true;
        tip.style.visibility = '';
        tip.style.pointerEvents = '';
        tip.style.top = '';
        tip.style.left = '';
        tip.removeAttribute('data-placement');
      }
    };

    const handleOutside = (event) => {
      if (freshBtn.contains(event.target) || tip.contains(event.target)) {
        return;
      }
      closeTip();
    };

    const handleKey = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        closeTip();
      }
    };

    const handleWindowChange = () => closeTip();
    const handleViewportChange = () => closeTip();

    const detach = () => {
      OUTSIDE_EVENTS.forEach((evt) => document.removeEventListener(evt, handleOutside, true));
      document.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('scroll', handleWindowChange);
      window.removeEventListener('resize', handleWindowChange);
      if (activeViewport) {
        activeViewport.removeEventListener('scroll', handleViewportChange);
        activeViewport.removeEventListener('resize', handleViewportChange);
        activeViewport = null;
      }
    };

    const closeTip = () => {
      if (!open) {
        return;
      }
      open = false;
      detach();
      applyState();
    };

    const placeTip = () => {
      const btnRect = freshBtn.getBoundingClientRect();
      const { left: viewportLeft, top: viewportTop, width: viewportWidth, height: viewportHeight } = getViewportBox();
      const tipWidth = tip.offsetWidth;
      const tipHeight = tip.offsetHeight;

      let top = btnRect.bottom + GAP;
      let placement = 'bottom';
      const spaceBelow = viewportTop + viewportHeight - btnRect.bottom;
      const spaceAbove = btnRect.top - viewportTop;
      if (spaceBelow < tipHeight + GAP && spaceAbove >= tipHeight + GAP) {
        top = btnRect.top - GAP - tipHeight;
        placement = 'top';
      }
      const minTop = viewportTop + MARGIN;
      const maxTop = viewportTop + viewportHeight - tipHeight - MARGIN;
      top = clamp(top, minTop, maxTop);

      let left = btnRect.left + btnRect.width / 2 - tipWidth / 2;
      const minLeft = viewportLeft + MARGIN;
      const maxLeft = viewportLeft + viewportWidth - tipWidth - MARGIN;
      left = clamp(left, minLeft, maxLeft);

      tip.style.top = `${Math.round(top)}px`;
      tip.style.left = `${Math.round(left)}px`;
      tip.dataset.placement = placement;
    };

    const attach = () => {
      OUTSIDE_EVENTS.forEach((evt) => document.addEventListener(evt, handleOutside, true));
      document.addEventListener('keydown', handleKey, true);
      window.addEventListener('scroll', handleWindowChange, { passive: true });
      window.addEventListener('resize', handleWindowChange);
      const { viewport } = getViewportBox();
      activeViewport = viewport;
      if (activeViewport) {
        activeViewport.addEventListener('scroll', handleViewportChange, { passive: true });
        activeViewport.addEventListener('resize', handleViewportChange, { passive: true });
      }
    };

    const openTip = () => {
      if (open) {
        return;
      }
      open = true;
      tip.hidden = false;
      tip.style.visibility = 'hidden';
      tip.style.pointerEvents = 'none';
      placeTip();
      tip.style.visibility = '';
      tip.style.pointerEvents = '';
      applyState();
      attach();
    };

    applyState();

    freshBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (open) {
        closeTip();
      } else {
        openTip();
      }
    });

    const observer = new MutationObserver(() => {
      if (!document.contains(freshBtn)) {
        observer.disconnect();
        closeTip();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
