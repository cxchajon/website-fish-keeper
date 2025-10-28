import { prepareDashboardData, TARGET_NO3 } from './dataAdapter.js';

const state = {
  months: [],
  currentIndex: 0,
  monthCache: new Map(),
  masterData: null,
  includeLast30: false,
  activeTab: 'nitrate',
  dataState: null,
  error: null,
  loading: false
};

const TAB_IDS = ['nitrate', 'dosing', 'maintenance'];
const TAB_LABELS = {
  nitrate: 'Nitrate Levels',
  dosing: 'Dosing Totals',
  maintenance: 'Maintenance Log'
};

const tabAria = {
  nitrate: 'Show Nitrate Levels',
  dosing: 'Show Dosing Totals',
  maintenance: 'Show Maintenance Log'
};

const iconPaths = {
  calendar: 'M7 3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1zm0 2H4v12h16V6h-3v2a1 1 0 0 1-2 0V6H9v2a1 1 0 0 1-2 0zm2-4a1 1 0 0 0-1 1v1h8V2a1 1 0 0 0-1-1z',
  droplet: 'M12 2.69 7.05 9.24a7 7 0 1 0 9.9 0z',
  beaker: 'M6 2h12v2h-1v9.44a5 5 0 1 1-10 0V4H6z',
  scissors: 'M6.5 6.5 4 3h2l2 3 2-3h2L9.5 6.5l1.76 2.64a1.5 1.5 0 1 1-1.26.78L9 7.42l-1.99 3.04a1.5 1.5 0 1 1-1.26-.78zm7.5 9.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0zm-8 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0z'
};

function init() {
  const container = document.getElementById('aquarium-dashboard');
  if (!container) return;
  state.container = container;
  state.container.classList.add('dashboard-app-mounted');
  loadMonthIndex();
}

async function loadMonthIndex() {
  updateState({ loading: true, error: null });
  try {
    const response = await fetch('/data/journal/index.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load journal index');
    const months = await response.json();
    updateState({ months, currentIndex: 0 });
    if (months.length) {
      await ensureMonthLoaded(months[0]);
    }
  } catch (error) {
    console.error(error);
    updateState({ error: 'Unable to load journal index.' });
  } finally {
    updateState({ loading: false });
  }
}

async function ensureMonthLoaded(month) {
  if (!month) return;
  if (!state.monthCache.has(month)) {
    try {
      updateState({ loading: true, error: null });
      const response = await fetch(`/data/journal/${month}.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load journal month ${month}`);
      const entries = await response.json();
      state.monthCache.set(month, entries);
    } catch (error) {
      console.error(error);
      updateState({ error: 'Unable to load journal entries.' });
    } finally {
      updateState({ loading: false });
    }
  }
  refreshDatasets();
}

async function ensureMasterData() {
  if (state.masterData || state.masterLoading) return;
  state.masterLoading = true;
  try {
    const response = await fetch('/data/journal.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load trailing journal entries');
    state.masterData = await response.json();
  } catch (error) {
    console.error(error);
    updateState({ error: 'Unable to load trailing journal entries.' });
  } finally {
    state.masterLoading = false;
  }
}

function refreshDatasets() {
  const month = state.months[state.currentIndex];
  const entries = state.monthCache.get(month);
  if (!entries) {
    render();
    return;
  }
  const datasets = prepareDashboardData({
    entries,
    includeLast30: state.includeLast30,
    masterEntries: state.includeLast30 && state.masterData ? state.masterData : []
  });
  state.dataState = datasets;
  const sample = datasets.meta?.sampleByDate?.get('2025-10-26');
  if (sample) {
    console.log('29G Dashboard sample (2025-10-26)', sample);
  }
  render();
}

function updateState(partial) {
  Object.assign(state, partial);
  render();
}

function render() {
  if (!state.container) return;
  state.container.innerHTML = '';
  state.container.appendChild(buildShell());
}

function buildShell() {
  const shell = createElement('div', 'dashboard-shell');
  shell.appendChild(buildHeader());
  if (state.error) {
    shell.appendChild(createParagraph(state.error, 'dashboard-error'));
  }
  if (state.loading && !state.dataState) {
    shell.appendChild(createParagraph('Loading dashboard…', 'dashboard-loading'));
    return shell;
  }
  if (!state.dataState || !state.dataState.nitrateData.length) {
    shell.appendChild(createParagraph('No journal data available.', 'dashboard-empty'));
    return shell;
  }
  shell.appendChild(buildTabs());
  shell.appendChild(buildPanels());
  return shell;
}

function buildHeader() {
  const header = createElement('header', 'dashboard-hero');
  const titleWrap = createElement('div', 'dashboard-hero__title');
  const title = document.createElement('h1');
  title.textContent = '29G Aquarium Dashboard';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Data-driven view of the 29-gallon planted tank journal.';
  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);

  const meta = createElement('div', 'dashboard-hero__meta');
  meta.appendChild(createIcon('calendar', 'dashboard-hero__icon'));
  const rangeSpan = document.createElement('span');
  rangeSpan.textContent = formatRange(state.dataState?.meta?.dateStart, state.dataState?.meta?.dateEnd) || 'Loading range…';
  meta.appendChild(rangeSpan);

  const controls = createElement('div', 'dashboard-controls');
  controls.appendChild(buildMonthSwitcher());
  controls.appendChild(buildToggle());

  header.appendChild(titleWrap);
  header.appendChild(meta);
  header.appendChild(controls);
  return header;
}

function buildMonthSwitcher() {
  const wrapper = createElement('div', 'dashboard-month');
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'dashboard-month__btn';
  prevBtn.setAttribute('aria-label', 'View previous month');
  prevBtn.disabled = state.currentIndex >= state.months.length - 1;
  prevBtn.appendChild(createChevron('left'));
  prevBtn.addEventListener('click', () => {
    if (state.currentIndex >= state.months.length - 1) return;
    state.currentIndex += 1;
    ensureMonthLoaded(state.months[state.currentIndex]);
  });

  const label = createElement('p', 'dashboard-month__label');
  label.textContent = formatMonth(state.months[state.currentIndex]);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'dashboard-month__btn';
  nextBtn.setAttribute('aria-label', 'View next month');
  nextBtn.disabled = state.currentIndex === 0;
  nextBtn.appendChild(createChevron('right'));
  nextBtn.addEventListener('click', () => {
    if (state.currentIndex === 0) return;
    state.currentIndex -= 1;
    ensureMonthLoaded(state.months[state.currentIndex]);
  });

  wrapper.appendChild(prevBtn);
  wrapper.appendChild(label);
  wrapper.appendChild(nextBtn);
  return wrapper;
}

function buildToggle() {
  const label = createElement('label', 'dashboard-toggle');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = state.includeLast30;
  input.addEventListener('change', async (event) => {
    state.includeLast30 = event.target.checked;
    if (state.includeLast30) {
      await ensureMasterData();
    }
    refreshDatasets();
  });
  const text = document.createElement('span');
  text.textContent = 'Include last 30 days across months';
  label.appendChild(input);
  label.appendChild(text);
  return label;
}

function buildTabs() {
  const tabList = createElement('div', 'dashboard-tabs');
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', 'Dashboard views');
  tabList.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const idx = TAB_IDS.indexOf(state.activeTab);
    const nextIdx = (idx + direction + TAB_IDS.length) % TAB_IDS.length;
    state.activeTab = TAB_IDS[nextIdx];
    render();
    const nextButton = tabList.querySelector(`[data-tab='${state.activeTab}']`);
    if (nextButton) nextButton.focus();
  });

  TAB_IDS.forEach((id) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tab = id;
    button.setAttribute('role', 'tab');
    button.id = `dashboard-tab-${id}`;
    button.setAttribute('aria-controls', `dashboard-panel-${id}`);
    button.setAttribute('aria-label', tabAria[id]);
    button.className = `dashboard-tab${state.activeTab === id ? ' is-active' : ''}`;
    button.tabIndex = state.activeTab === id ? 0 : -1;
    button.setAttribute('aria-selected', state.activeTab === id ? 'true' : 'false');
    button.appendChild(createIcon(id === 'nitrate' ? 'droplet' : id === 'dosing' ? 'beaker' : 'scissors', 'dashboard-tab__icon'));
    const span = document.createElement('span');
    span.textContent = TAB_LABELS[id].split(' ')[0];
    button.appendChild(span);
    button.addEventListener('click', () => {
      state.activeTab = id;
      render();
    });
    tabList.appendChild(button);
  });

  return tabList;
}

function buildPanels() {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(buildNitratePanel());
  fragment.appendChild(buildDosingPanel());
  fragment.appendChild(buildMaintenancePanel());
  return fragment;
}

function buildNitratePanel() {
  const panel = createElement('section', 'dashboard-panel');
  panel.id = 'dashboard-panel-nitrate';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', 'dashboard-tab-nitrate');
  if (state.activeTab !== 'nitrate') panel.hidden = true;
  const heading = document.createElement('h2');
  heading.textContent = 'Nitrate Levels';
  panel.appendChild(heading);

  const chartWrap = createElement('div', 'dashboard-chart chart-block');
  const chart = renderNitrateChart(state.dataState.nitrateData);
  chartWrap.appendChild(chart.svg);
  chartWrap.appendChild(chart.tooltip);
  panel.appendChild(chartWrap);

  panel.appendChild(buildNitrateTable());
  return panel;
}

function buildNitrateTable() {
  const table = document.createElement('table');
  table.className = 'dashboard-table sr-only';
  const caption = document.createElement('caption');
  caption.className = 'sr-only';
  caption.textContent = 'Daily nitrate, dosing, and water change values';
  table.appendChild(caption);
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th scope="col">Date</th><th scope="col">Nitrate (ppm)</th><th scope="col">Thrive (pumps)</th><th scope="col">Excel (cap eq.)</th><th scope="col">Water Change</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  state.dataState.nitrateData.forEach((day) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${day.dateLabel}</td><td>${day.nitrate != null ? day.nitrate.toFixed(1) : '—'}</td><td>${day.thrive.toFixed(2)}</td><td>${day.excelCap.toFixed(2)}</td><td>${formatWaterChange(day)}</td>`;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

function buildDosingPanel() {
  const panel = createElement('section', 'dashboard-panel');
  panel.id = 'dashboard-panel-dosing';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', 'dashboard-tab-dosing');
  if (state.activeTab !== 'dosing') panel.hidden = true;
  const heading = document.createElement('h2');
  heading.textContent = 'Dosing Totals';
  panel.appendChild(heading);

  const chartWrap = createElement('div', 'dashboard-chart chart-block');
  const chart = renderDosingChart(state.dataState.dosingData);
  chartWrap.appendChild(chart.svg);
  chartWrap.appendChild(chart.tooltip);
  panel.appendChild(chartWrap);

  const table = document.createElement('table');
  table.className = 'dashboard-table sr-only';
  const caption = document.createElement('caption');
  caption.className = 'sr-only';
  caption.textContent = 'Weekly Thrive and Excel dosing totals';
  table.appendChild(caption);
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th scope="col">Week</th><th scope="col">Thrive (pumps)</th><th scope="col">Excel (cap eq.)</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  state.dataState.dosingData.forEach((week) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${week.label}</td><td>${week.thrivePumps.toFixed(2)}</td><td>${week.excelCapEquivalent.toFixed(2)}</td>`;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  panel.appendChild(table);
  return panel;
}

function buildMaintenancePanel() {
  const panel = createElement('section', 'dashboard-panel');
  panel.id = 'dashboard-panel-maintenance';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', 'dashboard-tab-maintenance');
  if (state.activeTab !== 'maintenance') panel.hidden = true;
  const heading = document.createElement('h2');
  heading.textContent = 'Maintenance Log';
  panel.appendChild(heading);
  panel.appendChild(renderMaintenanceCards(state.dataState.maintenanceEvents));
  return panel;
}

function renderMaintenanceCards(events) {
  const grid = createElement('div', 'dashboard-maintenance-grid');
  if (!events.length) {
    grid.appendChild(createParagraph('No maintenance logged in this range.', 'dashboard-empty'));
    return grid;
  }
  const grouped = new Map();
  events.forEach((event) => {
    if (!grouped.has(event.dateISO)) {
      grouped.set(event.dateISO, { dateISO: event.dateISO, dateLabel: event.dateLabel, items: [] });
    }
    grouped.get(event.dateISO).items.push(event);
  });
  [...grouped.values()].sort((a, b) => (a.dateISO > b.dateISO ? 1 : -1)).forEach((day) => {
    const card = createElement('article', 'dashboard-card');
    const header = createElement('header', 'dashboard-card__header');
    const hasWaterChange = day.items.some((item) => item.type === 'Water Change');
    header.appendChild(createIcon(hasWaterChange ? 'droplet' : 'scissors', 'dashboard-card__icon'));
    const title = document.createElement('h3');
    title.textContent = day.dateLabel;
    header.appendChild(title);
    card.appendChild(header);
    const list = createElement('ul', 'dashboard-card__list');
    day.items.forEach((item, index) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="dashboard-card__type">${item.type}</span><span class="dashboard-card__details">${item.details}</span>`;
      if (item.type === 'Water Change' && (item.sumpPct != null || item.displayPct != null)) {
        const extra = document.createElement('span');
        extra.className = 'dashboard-card__details';
        extra.textContent = `${item.sumpPct != null ? `${item.sumpPct}% sump` : ''}${item.displayPct != null ? ` / ${item.displayPct}% display` : ''}`.trim();
        li.appendChild(extra);
      }
      list.appendChild(li);
    });
    card.appendChild(list);
    grid.appendChild(card);
  });
  return grid;
}

function renderNitrateChart(data) {
  const width = 720;
  const height = 280;
  const margin = { top: 24, right: 32, bottom: 36, left: 48 };
  const svg = createSvg(width, height);
  const tooltip = createTooltip();
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
  svg.appendChild(g);

  const xScale = createBandScale(data.map((d) => d.dateLabel), innerWidth);
  const nitrateValues = data.map((d) => (d.nitrate != null ? d.nitrate : null)).filter((v) => v != null);
  const yMax = Math.max(TARGET_NO3, Math.ceil(Math.max(...nitrateValues, 0) / 5) * 5 + 5 || 20);
  const yScale = createLinearScale([0, yMax], innerHeight);

  drawGrid(g, innerWidth, innerHeight, xScale, yScale);
  drawAxes(g, innerWidth, innerHeight, xScale, yScale);
  drawReferenceLine(g, yScale, innerWidth, TARGET_NO3);
  drawNitratePath(g, data, xScale, yScale);
  drawNitrateDots(g, data, xScale, yScale, tooltip);

  attachTooltipHandlers(svg, tooltip);
  return { svg, tooltip };
}

function renderDosingChart(data) {
  const width = 720;
  const height = 280;
  const margin = { top: 24, right: 32, bottom: 56, left: 48 };
  const svg = createSvg(width, height);
  const tooltip = createTooltip();
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
  svg.appendChild(g);

  const xScale = createBandScale(data.map((d) => d.label), innerWidth, 0.2);
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.thrivePumps, d.excelCapEquivalent)),
    0
  );
  const yScale = createLinearScale([0, Math.ceil(maxValue / 2) * 2 + 2 || 10], innerHeight);

  drawGrid(g, innerWidth, innerHeight, xScale, yScale);
  drawAxes(g, innerWidth, innerHeight, xScale, yScale, true);
  drawBars(g, data, xScale, yScale, tooltip);
  attachTooltipHandlers(svg, tooltip);
  return { svg, tooltip };
}

function drawGrid(group, width, height, xScale, yScale) {
  const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gridGroup.setAttribute('stroke', 'rgba(255,255,255,0.15)');
  gridGroup.setAttribute('stroke-dasharray', '3 3');
  const yTicks = yScale.ticks(5);
  yTicks.forEach((tick) => {
    const y = yScale.map(tick);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('x2', width);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    gridGroup.appendChild(line);
  });
  group.appendChild(gridGroup);
}

function drawAxes(group, width, height, xScale, yScale, rotateX = false) {
  const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  axisGroup.setAttribute('class', 'dashboard-axis');
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  xAxis.setAttribute('transform', `translate(0, ${height})`);
  xScale.values.forEach((value, index) => {
    const x = xScale.position(index) + xScale.bandwidth / 2;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('x2', x);
    line.setAttribute('y1', 0);
    line.setAttribute('y2', 6);
    xAxis.appendChild(line);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', rotateX ? 20 : 24);
    text.setAttribute('fill', 'rgba(255,255,255,0.75)');
    text.setAttribute('font-size', '12');
    text.setAttribute('text-anchor', rotateX ? 'end' : 'middle');
    if (rotateX) {
      text.setAttribute('transform', `rotate(-25 ${x} ${height + 20})`);
    }
    text.textContent = value;
    xAxis.appendChild(text);
  });
  axisGroup.appendChild(xAxis);

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  yScale.ticks(5).forEach((tick) => {
    const y = yScale.map(tick);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', -6);
    line.setAttribute('x2', 0);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    yAxis.appendChild(line);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', -10);
    text.setAttribute('y', y + 4);
    text.setAttribute('fill', 'rgba(255,255,255,0.75)');
    text.setAttribute('font-size', '12');
    text.setAttribute('text-anchor', 'end');
    text.textContent = tick;
    yAxis.appendChild(text);
  });
  axisGroup.appendChild(yAxis);
  group.appendChild(axisGroup);
}

function drawReferenceLine(group, yScale, width, value) {
  const y = yScale.map(value);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', '0');
  line.setAttribute('x2', width);
  line.setAttribute('y1', y);
  line.setAttribute('y2', y);
  line.setAttribute('stroke', 'rgba(255,255,255,0.4)');
  line.setAttribute('stroke-dasharray', '4 4');
  group.appendChild(line);
}

function drawNitratePath(group, data, xScale, yScale) {
  const pathData = [];
  data.forEach((point, index) => {
    if (point.nitrate == null) return;
    const x = xScale.position(index) + xScale.bandwidth / 2;
    const y = yScale.map(point.nitrate);
    pathData.push(`${pathData.length ? 'L' : 'M'}${x},${y}`);
  });
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData.join(' '));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#8ee0ff');
  path.setAttribute('stroke-width', '3');
  group.appendChild(path);
}

function drawNitrateDots(group, data, xScale, yScale, tooltip) {
  let lastValid = null;
  data.forEach((point, index) => {
    if (point.nitrate != null) {
      lastValid = point.nitrate;
    } else if (!point.wc) {
      return;
    }
    const displayValue = point.nitrate != null ? point.nitrate : lastValid ?? TARGET_NO3;
    const x = xScale.position(index) + xScale.bandwidth / 2;
    const y = yScale.map(displayValue);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', point.wc ? 6 : 4);
    circle.setAttribute('fill', point.wc ? '#9de2b6' : '#66d1f6');
    circle.setAttribute('stroke', '#041730');
    circle.setAttribute('stroke-width', '2');
    circle.addEventListener('mouseenter', (event) => showTooltip(event, tooltip, buildNitrateTooltip(point)));
    circle.addEventListener('mouseleave', () => hideTooltip(tooltip));
    circle.addEventListener('focus', (event) => showTooltip(event, tooltip, buildNitrateTooltip(point)));
    circle.addEventListener('blur', () => hideTooltip(tooltip));
    group.appendChild(circle);
  });
}

function drawBars(group, data, xScale, yScale, tooltip) {
  data.forEach((item, index) => {
    const x = xScale.position(index);
    const width = xScale.bandwidth;
    const thriveHeight = yScale.map(0) - yScale.map(item.thrivePumps);
    const excelHeight = yScale.map(0) - yScale.map(item.excelCapEquivalent);

    const thriveRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    thriveRect.setAttribute('x', x);
    thriveRect.setAttribute('y', yScale.map(item.thrivePumps));
    thriveRect.setAttribute('width', width / 2 - 4);
    thriveRect.setAttribute('height', thriveHeight);
    thriveRect.setAttribute('fill', '#66d1f6');
    thriveRect.addEventListener('mouseenter', (event) => showTooltip(event, tooltip, buildDosingTooltip(item)));
    thriveRect.addEventListener('mouseleave', () => hideTooltip(tooltip));
    group.appendChild(thriveRect);

    const excelRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    excelRect.setAttribute('x', x + width / 2 + 4);
    excelRect.setAttribute('y', yScale.map(item.excelCapEquivalent));
    excelRect.setAttribute('width', width / 2 - 4);
    excelRect.setAttribute('height', excelHeight);
    excelRect.setAttribute('fill', '#9de2b6');
    excelRect.addEventListener('mouseenter', (event) => showTooltip(event, tooltip, buildDosingTooltip(item)));
    excelRect.addEventListener('mouseleave', () => hideTooltip(tooltip));
    group.appendChild(excelRect);
  });
}

function buildNitrateTooltip(point) {
  return `
    <p class="dashboard-tooltip__title">${point.dateLabel}</p>
    <p class="dashboard-tooltip__value"><span>Nitrate:</span> ${point.nitrate.toFixed(1)} ppm</p>
    <p class="dashboard-tooltip__value"><span>Thrive:</span> ${point.thrive.toFixed(2)} pumps</p>
    <p class="dashboard-tooltip__value"><span>Excel:</span> ${point.excelCap.toFixed(2)} cap eq.</p>
    ${point.nitrateDetails ? `<p class="dashboard-tooltip__note">${point.nitrateDetails}</p>` : ''}
    ${point.wc ? `<p class="dashboard-tooltip__note">Water change ${formatWaterChange(point)}</p>` : ''}
  `;
}

function buildDosingTooltip(item) {
  return `
    <p class="dashboard-tooltip__title">${item.label}</p>
    <p class="dashboard-tooltip__value"><span>Thrive:</span> ${item.thrivePumps.toFixed(2)} pumps</p>
    <p class="dashboard-tooltip__value"><span>Excel:</span> ${item.excelCapEquivalent.toFixed(2)} cap eq.</p>
  `;
}

function showTooltip(event, tooltip, content) {
  tooltip.innerHTML = content;
  tooltip.style.opacity = '1';
  const { clientX, clientY } = event;
  tooltip.style.left = `${clientX + 16}px`;
  tooltip.style.top = `${clientY - 16}px`;
}

function hideTooltip(tooltip) {
  tooltip.style.opacity = '0';
}

function attachTooltipHandlers(svg, tooltip) {
  svg.addEventListener('mouseleave', () => hideTooltip(tooltip));
}

function createSvg(width, height) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Chart visualization');
  return svg;
}

function createTooltip() {
  const tooltip = createElement('div', 'dashboard-tooltip');
  tooltip.style.position = 'fixed';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.opacity = '0';
  tooltip.style.transition = 'opacity 0.15s ease';
  return tooltip;
}

function createBandScale(values, width, padding = 0.1) {
  const step = width / (values.length || 1);
  const band = step * (1 - padding * 2);
  return {
    values,
    bandwidth: band,
    position(index) {
      return index * step + step * padding;
    }
  };
}

function createLinearScale(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = [range, 0];
  return {
    map(value) {
      if (d1 === d0) return r0;
      return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
    },
    ticks(count) {
      const step = (d1 - d0) / count;
      const ticks = [];
      for (let i = 0; i <= count; i += 1) {
        ticks.push(Math.round((d0 + step * i) * 10) / 10);
      }
      return ticks;
    }
  };
}

function createElement(tag, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function createParagraph(text, className) {
  const p = document.createElement('p');
  if (className) p.className = className;
  p.textContent = text;
  return p;
}

function createChevron(direction) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  if (direction === 'left') {
    path.setAttribute('d', 'M15 18l-6-6 6-6');
  } else {
    path.setAttribute('d', 'M9 6l6 6-6 6');
  }
  svg.appendChild(path);
  return svg;
}

function createIcon(name, className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.classList.add(className);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', name === 'droplet' ? 'currentColor' : 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('d', iconPaths[name] || iconPaths.calendar);
  svg.appendChild(path);
  return svg;
}

function formatRange(start, end) {
  if (!start || !end) return '';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear();
  const sameMonth = sameYear && startDate.getUTCMonth() === endDate.getUTCMonth();
  const formatterMonth = new Intl.DateTimeFormat(undefined, { month: 'long' });
  const formatterDay = new Intl.DateTimeFormat(undefined, { day: 'numeric' });
  if (sameMonth) {
    return `${formatterMonth.format(startDate)} ${formatterDay.format(startDate)} – ${formatterDay.format(endDate)}, ${endDate.getUTCFullYear()}`;
  }
  if (sameYear) {
    const monthDay = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' });
    return `${monthDay.format(startDate)} – ${monthDay.format(endDate)}, ${endDate.getUTCFullYear()}`;
  }
  const full = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  return `${full.format(startDate)} – ${full.format(endDate)}`;
}

function formatMonth(month) {
  if (!month) return '';
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1, 1));
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  return formatter.format(date);
}

function formatWaterChange(day) {
  const parts = [];
  if (day.sumpPct != null) parts.push(`${day.sumpPct}% sump`);
  if (day.displayPct != null) parts.push(`${day.displayPct}% display`);
  return parts.length ? parts.join(' / ') : 'Yes';
}

document.addEventListener('DOMContentLoaded', init);
