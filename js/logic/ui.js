import { describeRange, calcSeverityIcon, getBandColor } from './utils.js';

const INFO_COPY = {
  gh: {
    title: 'What is gH?',
    body: 'General hardness measures dissolved calcium and magnesium. Many fish rely on minerals for osmoregulation and bone health.',
  },
  kh: {
    title: 'Why kH matters',
    body: 'Carbonate hardness buffers pH swings. Low kH makes pH unstable; high kH keeps alkaline water steady.',
  },
  salinity: {
    title: 'Salinity categories',
    body: 'Freshwater has negligible salt, while low and high brackish carry increasing minerals. Dual-tolerant species bridge fresh and light brackish mixes—avoid spanning extremes without them.',
  },
  blackwater: {
    title: 'Blackwater & tannins',
    body: 'Blackwater systems are stained by tannins from leaves/wood. Species that require it need the lower pH and humic compounds.',
  },
  'ph-sensitive': {
    title: 'pH-sensitive species',
    body: 'These fish are less tolerant of swings. Match pH closely and prioritise stability when parameters are tight.',
  },
};

let dynamicPopover = null;
let activeButton = null;
let dynamicEscListener = null;

function ensureDynamicPopover() {
  if (dynamicPopover) return dynamicPopover;
  dynamicPopover = document.createElement('div');
  dynamicPopover.className = 'popover';
  dynamicPopover.setAttribute('data-hidden', 'true');
  dynamicPopover.setAttribute('role', 'dialog');
  dynamicPopover.setAttribute('aria-modal', 'false');
  dynamicPopover.dataset.testid = 'info-popover';
  document.body.appendChild(dynamicPopover);
  return dynamicPopover;
}

function hideDynamicPopover() {
  if (!dynamicPopover) return;
  dynamicPopover.setAttribute('data-hidden', 'true');
  dynamicPopover.innerHTML = '';
  activeButton?.setAttribute('aria-expanded', 'false');
  if (dynamicEscListener) {
    document.removeEventListener('keydown', dynamicEscListener);
    dynamicEscListener = null;
  }
  if (activeButton) {
    activeButton.focus();
  }
  activeButton = null;
}

function positionPopover(popover, trigger) {
  const rect = trigger.getBoundingClientRect();
  const preferredTop = rect.bottom + window.scrollY + 12;
  const left = rect.left + window.scrollX;
  popover.style.top = `${preferredTop}px`;
  popover.style.left = `${left}px`;
}

function showInfoPopover(button, info) {
  const pop = ensureDynamicPopover();
  pop.innerHTML = '';
  const title = document.createElement('strong');
  title.textContent = info.title;
  const body = document.createElement('p');
  body.style.margin = '8px 0 0';
  body.textContent = info.body;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'link-like';
  close.textContent = 'Close';
  close.setAttribute('data-popover-close', '');
  close.dataset.testid = 'info-popover-close';
  close.addEventListener('click', (event) => {
    event.preventDefault();
    hideDynamicPopover();
  });
  pop.append(title, body, close);
  positionPopover(pop, button);
  pop.setAttribute('data-hidden', 'false');
  button.setAttribute('aria-expanded', 'true');
  activeButton = button;
}

function togglePopoverFromButton(button) {
  const id = button.getAttribute('data-popover');
  if (!id) {
    return;
  }
  const popover = document.getElementById(id);
  if (!popover) return;
  const hidden = popover.getAttribute('data-hidden') !== 'false';
  let closeButton = null;
  const hide = () => {
    popover.setAttribute('data-hidden', 'true');
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', escHandler);
    document.removeEventListener('click', outsideHandler, true);
    if (closeButton) {
      closeButton.removeEventListener('click', closeHandler);
    }
    button.focus();
  };
  const escHandler = (event) => {
    if (event.key === 'Escape') {
      hide();
    }
  };
  const outsideHandler = (event) => {
    if (!popover.contains(event.target) && event.target !== button) {
      hide();
    }
  };
  const closeHandler = (event) => {
    event.preventDefault();
    hide();
  };
  if (hidden) {
    const rect = button.getBoundingClientRect();
    popover.style.top = `${rect.bottom + window.scrollY + 12}px`;
    popover.style.left = `${rect.left + window.scrollX}px`;
    popover.setAttribute('data-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', escHandler);
    document.addEventListener('click', outsideHandler, true);
    closeButton = popover.querySelector('[data-popover-close]');
    if (closeButton) {
      closeButton.addEventListener('click', closeHandler);
    }
  } else {
    hide();
  }
}

export function bindPopoverHandlers(root) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-info-key], button[data-popover]');
    if (!button) return;
    event.preventDefault();
    if (button.hasAttribute('data-popover')) {
      hideDynamicPopover();
      togglePopoverFromButton(button);
      return;
    }
    const key = button.getAttribute('data-info-key');
    const info = INFO_COPY[key];
    if (!info) return;
    if (activeButton === button) {
      hideDynamicPopover();
      return;
    }
    hideDynamicPopover();
    showInfoPopover(button, info);
    if (dynamicEscListener) {
      document.removeEventListener('keydown', dynamicEscListener);
    }
    dynamicEscListener = (event) => {
      if (event.key === 'Escape') {
        hideDynamicPopover();
      }
    };
    document.addEventListener('keydown', dynamicEscListener);
  });

  document.addEventListener('click', (event) => {
    if (!dynamicPopover || dynamicPopover.getAttribute('data-hidden') === 'true') {
      return;
    }
    if (activeButton && (event.target === activeButton || activeButton.contains(event.target))) {
      return;
    }
    if (dynamicPopover.contains(event.target)) {
      return;
    }
    hideDynamicPopover();
  });
}

function formatRangeForKey(key, range) {
  if (!Array.isArray(range) || !Number.isFinite(range[0]) || !Number.isFinite(range[1])) {
    return '—';
  }
  switch (key) {
    case 'temperature':
      return describeRange(range, '°F');
    case 'gH':
    case 'kH':
      return describeRange(range, ' d');
    default:
      return describeRange(range, '');
  }
}

export function renderConditions(list, items) {
  list.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'condition-item';
    li.dataset.state = item.severity;
    const rawKey = typeof item.key === 'string' ? item.key.trim() : '';
    const normalizedKey = rawKey.toLowerCase();
    if (normalizedKey) {
      const envField = `env-${normalizedKey}`;
      li.dataset.field = envField;
    }

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = item.label;
    if (item.infoKey) {
      const infoBtn = document.createElement('button');
      infoBtn.className = 'info-btn ttg-tooltip-trigger';
      infoBtn.type = 'button';
      infoBtn.setAttribute('data-info-key', item.infoKey);
      infoBtn.setAttribute('aria-label', `${item.label} info`);
      infoBtn.textContent = 'i';
      infoBtn.dataset.testid = 'info-popover-trigger';
      label.appendChild(infoBtn);
    }

    const value = document.createElement('div');
    value.className = 'value';
    if (normalizedKey) {
      const envField = `env-${normalizedKey}`;
      value.dataset.field = envField;
      value.dataset.role = envField;
      value.dataset.env = normalizedKey;
    }
    const rangeText = formatRangeForKey(item.key, item.range);
    const icon = document.createElement('span');
    icon.className = 'condition-icon';
    icon.textContent = calcSeverityIcon(item.severity);

    const rangeSpan = document.createElement('span');
    rangeSpan.textContent = rangeText;
    const bullet = document.createElement('span');
    bullet.textContent = '•';
    bullet.style.opacity = '0.6';
    const actualSpan = document.createElement('span');
    actualSpan.textContent = item.actual ?? '—';
    if (normalizedKey) {
      const envField = `env-${normalizedKey}`;
      actualSpan.dataset.field = envField;
      actualSpan.dataset.role = envField;
      actualSpan.dataset.env = normalizedKey;
    }
    const hintSpan = document.createElement('span');
    hintSpan.textContent = item.hint;
    value.append(rangeSpan, bullet, actualSpan, icon, hintSpan);
    if (item.extra) {
      const extra = document.createElement('span');
      extra.className = 'secondary-text';
      extra.textContent = item.extra;
      value.appendChild(extra);
    }

    li.append(label, value);
    list.appendChild(li);
  }
}

export function renderBioloadBar(fill, ghost, text, data) {
  const current = clampPercent(data.currentPercent);
  const proposed = clampPercent(data.proposedPercent);
  fill.style.width = `${Math.min(current, 1) * 100}%`;
  fill.style.background = getBandColor(proposed);
  ghost.style.width = `${Math.min(proposed, 1.25) * 100}%`;
  text.textContent = data.text;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function renderAggressionBar(fill, text, data) {
  const width = clampPercent(data.score / 100);
  fill.style.width = `${Math.min(width, 1) * 100}%`;
  const color = data.severity === 'bad' ? 'var(--bad)' : data.severity === 'warn' ? '#f4b400' : 'rgba(255,255,255,0.25)';
  fill.style.background = color;
  text.textContent = data.label;
}

export function renderStatus(strip, status) {
  strip.dataset.state = status.severity;
  strip.textContent = status.label;
}

export function renderChips(container, chips) {
  container.innerHTML = '';
  for (const chip of chips) {
    const node = document.createElement('span');
    node.className = 'chip';
    if (chip.tone) {
      node.dataset.tone = chip.tone;
    }
    node.textContent = chip.text;
    container.appendChild(node);
  }
}

export function renderStockList(list, entries, onRemove) {
  list.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'secondary-text';
    empty.textContent = 'No species yet. Add a fish or invertebrate to begin.';
    list.appendChild(empty);
    return;
  }
  for (const entry of entries) {
    const li = document.createElement('li');
    li.className = 'stock-item';
    li.dataset.role = 'stock-row';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = entry.species.common_name;
    const qty = document.createElement('span');
    qty.className = 'secondary-text';
    qty.textContent = `Qty: ${entry.qty}`;
    meta.append(name, qty);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.dataset.action = 'remove';
    remove.dataset.role = 'remove-stock';
    remove.addEventListener('click', () => onRemove(entry));
    li.append(meta, remove);
    list.appendChild(li);
  }
}
