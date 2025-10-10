const FILTER_TYPES = [
  { value: 'HOB', label: 'HOB' },
  { value: 'Canister', label: 'Canister' },
  { value: 'Sponge', label: 'Sponge' },
];

const DRAWER_ID = 'filter-drawer-panel';
const DEFAULT_FILTER = Object.freeze({ kind: 'HOB', gph: 0, headLossPct: 0, model: '' });

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatGph(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num);
}

function formatTurnover(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.0';
  return Math.max(num, 0).toFixed(1);
}

function ensureTrigger(container) {
  if (!container) return null;
  let button = container.querySelector('[data-role="filtration-toggle"]');
  if (button) {
    return button;
  }
  button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-trigger-button';
  button.dataset.role = 'filtration-toggle';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', DRAWER_ID);

  const topLine = document.createElement('span');
  topLine.className = 'filter-trigger-line';

  const label = document.createElement('span');
  label.className = 'filter-trigger-label';
  label.textContent = 'Filtration ⚙️';

  const chevron = document.createElement('span');
  chevron.className = 'filter-trigger-chevron';
  chevron.dataset.role = 'filtration-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '▾';

  topLine.appendChild(label);
  topLine.appendChild(chevron);

  const summary = document.createElement('span');
  summary.className = 'filter-trigger-summary';
  summary.dataset.role = 'filtration-summary';
  summary.textContent = 'Filtration: 0 GPH • 0.0×/h ⚙️';

  button.appendChild(topLine);
  button.appendChild(summary);
  container.innerHTML = '';
  container.appendChild(button);
  return button;
}

function createRowElement() {
  const row = document.createElement('div');
  row.className = 'filter-drawer__row';
  row.dataset.filterIndex = '0';

  const typeField = document.createElement('div');
  typeField.className = 'filter-field';
  const typeLabel = document.createElement('label');
  typeLabel.textContent = 'Filter Type';
  const select = document.createElement('select');
  select.dataset.role = 'filter-kind';
  for (const option of FILTER_TYPES) {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    select.appendChild(opt);
  }
  typeField.appendChild(typeLabel);
  typeField.appendChild(select);

  const gphField = document.createElement('div');
  gphField.className = 'filter-field';
  const gphLabel = document.createElement('label');
  gphLabel.textContent = 'Rated Flow (GPH)';
  const gphInput = document.createElement('input');
  gphInput.type = 'number';
  gphInput.min = '1';
  gphInput.max = '1500';
  gphInput.step = '1';
  gphInput.placeholder = 'e.g. 300';
  gphInput.dataset.role = 'filter-gph';
  gphField.appendChild(gphLabel);
  gphField.appendChild(gphInput);

  const headField = document.createElement('div');
  headField.className = 'filter-field filter-field--slider';
  const headLabel = document.createElement('label');
  headLabel.innerHTML = 'Head Loss (%) <span data-role="filter-head-display">0%</span>';
  const headInput = document.createElement('input');
  headInput.type = 'range';
  headInput.min = '0';
  headInput.max = '40';
  headInput.step = '1';
  headInput.value = '0';
  headInput.dataset.role = 'filter-head';
  headField.appendChild(headLabel);
  headField.appendChild(headInput);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'filter-row-remove';
  removeBtn.dataset.role = 'filter-remove';
  removeBtn.setAttribute('aria-label', 'Remove filter');
  removeBtn.textContent = '🗑️';

  row.appendChild(typeField);
  row.appendChild(gphField);
  row.appendChild(headField);
  row.appendChild(removeBtn);
  return row;
}

function ensureDrawer(host) {
  if (!host) return null;
  let drawer = host.querySelector('[data-role="filter-drawer"]');
  if (drawer) {
    return drawer;
  }
  drawer = document.createElement('div');
  drawer.className = 'filter-drawer';
  drawer.dataset.role = 'filter-drawer';
  drawer.id = DRAWER_ID;
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');

  const intro = document.createElement('div');
  intro.className = 'filter-drawer__intro';
  const title = document.createElement('h3');
  title.className = 'filter-drawer__title';
  title.textContent = 'Filter Setup';
  const desc = document.createElement('p');
  desc.className = 'filter-drawer__desc';
  desc.textContent = 'Choose a filter(s) to estimate how much water flow your tank has per hour.';
  intro.appendChild(title);
  intro.appendChild(desc);

  const rows = document.createElement('div');
  rows.className = 'filter-drawer__rows';
  rows.dataset.role = 'filter-rows';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'filter-drawer__add';
  addBtn.dataset.role = 'filter-add';
  addBtn.textContent = '+ Add Another Filter';

  const results = document.createElement('div');
  results.className = 'filter-drawer__results';
  results.innerHTML = `
    <div class="filter-result-line">
      <span>Total Flow</span>
      <span data-field="filter-total">0 GPH</span>
    </div>
    <div class="filter-result-line">
      <span>Turnover</span>
      <span data-field="filter-turnover">0.0×/h</span>
    </div>
    <div class="filter-result-status">
      <span class="chip" data-role="filter-status">Add filter flow to estimate turnover.</span>
    </div>
  `;

  drawer.appendChild(intro);
  drawer.appendChild(rows);
  drawer.appendChild(addBtn);
  drawer.appendChild(results);
  host.appendChild(drawer);
  return drawer;
}

function updateRow(row, filter, index, isSolo) {
  if (!row) return;
  row.dataset.filterIndex = String(index);
  const select = row.querySelector('[data-role="filter-kind"]');
  const gphInput = row.querySelector('[data-role="filter-gph"]');
  const headInput = row.querySelector('[data-role="filter-head"]');
  const headDisplay = row.querySelector('[data-role="filter-head-display"]');
  const removeBtn = row.querySelector('[data-role="filter-remove"]');

  if (select) {
    const value = filter?.kind || DEFAULT_FILTER.kind;
    if (FILTER_TYPES.some((type) => type.value === value)) {
      select.value = value;
    } else {
      select.value = DEFAULT_FILTER.kind;
    }
  }
  if (gphInput) {
    const gphValue = Number(filter?.gph);
    gphInput.value = Number.isFinite(gphValue) && gphValue > 0 ? String(Math.round(gphValue)) : '';
  }
  if (headInput) {
    const headValue = Number(filter?.headLossPct);
    const clamped = Number.isFinite(headValue) ? Math.min(Math.max(Math.round(headValue), 0), 40) : 0;
    headInput.value = String(clamped);
    if (headDisplay) {
      headDisplay.textContent = `${clamped}%`;
    }
  }
  if (removeBtn) {
    removeBtn.disabled = Boolean(isSolo);
    removeBtn.setAttribute('aria-disabled', isSolo ? 'true' : 'false');
  }
}

function updateResults(drawer, metrics) {
  if (!drawer) return;
  const totalEl = drawer.querySelector('[data-field="filter-total"]');
  const turnoverEl = drawer.querySelector('[data-field="filter-turnover"]');
  const statusChip = drawer.querySelector('[data-role="filter-status"]');
  const total = formatGph(metrics?.deliveredTotal ?? metrics?.totalGph ?? 0);
  const turnover = formatTurnover(metrics?.turnover ?? 0);
  if (totalEl) {
    totalEl.textContent = `${total} GPH`;
  }
  if (turnoverEl) {
    turnoverEl.textContent = `${turnover}×/h`;
  }
  if (statusChip) {
    const tone = metrics?.status?.tone;
    statusChip.textContent = metrics?.status?.text || 'Add filter flow to estimate turnover.';
    if (tone === 'warn' || tone === 'bad') {
      statusChip.dataset.tone = tone;
    } else {
      statusChip.removeAttribute('data-tone');
    }
  }
}

export function renderFiltrationTrigger(container, { metrics = null, open = false, warning = false } = {}) {
  const button = ensureTrigger(container);
  if (!button) return;
  const chevron = button.querySelector('[data-role="filtration-chevron"]');
  const summary = button.querySelector('[data-role="filtration-summary"]');
  const total = formatGph(metrics?.deliveredTotal ?? metrics?.totalGph ?? 0);
  const turnover = formatTurnover(metrics?.turnover ?? 0);
  if (summary) {
    summary.textContent = `Filtration: ${total} GPH • ${turnover}×/h ⚙️`;
  }
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.classList.toggle('is-open', Boolean(open));
  if (chevron) {
    chevron.classList.toggle('is-open', Boolean(open));
  }
  if (warning) {
    button.dataset.warning = 'true';
    button.title = 'Turnover target not met';
  } else {
    button.removeAttribute('data-warning');
    button.removeAttribute('title');
  }
}

export function renderFiltrationDrawer(host, { filters = [], metrics = null, open = false } = {}) {
  if (!host) return;
  host.classList.toggle('is-open', Boolean(open));
  const drawer = ensureDrawer(host);
  if (!drawer) return;
  drawer.hidden = !open;
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  const rowsContainer = drawer.querySelector('[data-role="filter-rows"]');
  if (!rowsContainer) return;

  const list = Array.isArray(filters) && filters.length ? filters : [DEFAULT_FILTER];
  const desired = list.length;
  while (rowsContainer.children.length < desired) {
    rowsContainer.appendChild(createRowElement());
  }
  while (rowsContainer.children.length > desired) {
    rowsContainer.removeChild(rowsContainer.lastElementChild);
  }
  const isSolo = desired === 1;
  Array.from(rowsContainer.children).forEach((row, index) => {
    updateRow(row, list[index] || DEFAULT_FILTER, index, isSolo);
  });
  updateResults(drawer, metrics);
}

function cloneFilter(filter) {
  if (!filter || typeof filter !== 'object') {
    return { ...DEFAULT_FILTER };
  }
  return {
    kind: typeof filter.kind === 'string' ? filter.kind : DEFAULT_FILTER.kind,
    gph: toNumber(filter.gph),
    headLossPct: toNumber(filter.headLossPct),
    model: typeof filter.model === 'string' ? filter.model : '',
  };
}

export function bindFiltrationEvents(ctx, onFiltersChange = () => {}) {
  if (!ctx || typeof ctx !== 'object') {
    return;
  }
  const trigger = ctx.trigger;
  const host = ctx.host;
  if (!trigger || !host) {
    return;
  }

  const getFilters = () => {
    if (typeof ctx.getFilters === 'function') {
      const value = ctx.getFilters();
      return Array.isArray(value) ? value.map(cloneFilter) : [];
    }
    return [];
  };

  const emitFilters = (filters) => {
    if (typeof onFiltersChange === 'function') {
      onFiltersChange(filters.map(cloneFilter));
    }
  };

  const handleToggle = (event) => {
    const button = event.target.closest('[data-role="filtration-toggle"]');
    if (!button) return;
    event.preventDefault();
    const nextOpen = !ctx.open;
    ctx.open = nextOpen;
    if (typeof ctx.onToggle === 'function') {
      ctx.onToggle(nextOpen);
    }
  };

  const refreshFromDom = () => {
    const rows = host.querySelectorAll('[data-filter-index]');
    const current = getFilters();
    const next = Array.from(rows).map((row, index) => {
      const select = row.querySelector('[data-role="filter-kind"]');
      const gphInput = row.querySelector('[data-role="filter-gph"]');
      const headInput = row.querySelector('[data-role="filter-head"]');
      const prev = current[index] || DEFAULT_FILTER;
      return {
        kind: select?.value || prev.kind || DEFAULT_FILTER.kind,
        gph: toNumber(gphInput?.value),
        headLossPct: toNumber(headInput?.value),
        model: typeof prev.model === 'string' ? prev.model : '',
      };
    });
    emitFilters(next);
  };

  const handleInput = (event) => {
    const target = event.target;
    if (!target) return;
    const row = target.closest('[data-filter-index]');
    if (!row) return;
    if (target.dataset.role === 'filter-head') {
      const display = row.querySelector('[data-role="filter-head-display"]');
      if (display) {
        const value = Math.min(Math.max(Math.round(Number(target.value) || 0), 0), 40);
        display.textContent = `${value}%`;
      }
    }
    if (
      target.dataset.role === 'filter-kind'
      || target.dataset.role === 'filter-gph'
      || target.dataset.role === 'filter-head'
    ) {
      refreshFromDom();
    }
  };

  const handleClick = (event) => {
    const addBtn = event.target.closest('[data-role="filter-add"]');
    if (addBtn) {
      event.preventDefault();
      const next = getFilters();
      next.push({ ...DEFAULT_FILTER });
      emitFilters(next);
      return;
    }
    const removeBtn = event.target.closest('[data-role="filter-remove"]');
    if (removeBtn) {
      event.preventDefault();
      const row = removeBtn.closest('[data-filter-index]');
      if (!row) return;
      const index = Number(row.dataset.filterIndex) || 0;
      const current = getFilters();
      if (current.length <= 1) {
        const next = [{ ...DEFAULT_FILTER }];
        emitFilters(next);
        return;
      }
      const next = current.filter((_, idx) => idx !== index);
      emitFilters(next);
    }
  };

  const handleOutside = (event) => {
    if (!ctx.open) return;
    const target = event.target;
    if (trigger.contains(target) || host.contains(target)) {
      return;
    }
    ctx.open = false;
    if (typeof ctx.onToggle === 'function') {
      ctx.onToggle(false);
    }
  };

  const handleKey = (event) => {
    if (event.key === 'Escape' && ctx.open) {
      ctx.open = false;
      if (typeof ctx.onToggle === 'function') {
        ctx.onToggle(false);
      }
    }
  };

  trigger.addEventListener('click', handleToggle);
  host.addEventListener('input', handleInput);
  host.addEventListener('change', handleInput);
  host.addEventListener('click', handleClick);
  document.addEventListener('pointerdown', handleOutside, true);
  document.addEventListener('keydown', handleKey);
}
