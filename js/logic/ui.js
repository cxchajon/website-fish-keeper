import { describeRange, calcSeverityIcon, getBandColor } from './utils.js';

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
      infoBtn.setAttribute('data-info', item.infoKey);
      infoBtn.setAttribute('data-info-key', item.infoKey);
      infoBtn.setAttribute('aria-label', `${item.label} info`);
      infoBtn.setAttribute('title', `${item.label} info`);
      infoBtn.dataset.testid = 'info-tooltip-trigger';
      infoBtn.textContent = 'i';
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
