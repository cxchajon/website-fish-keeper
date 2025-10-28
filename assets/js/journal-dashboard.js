// Auto-generated dashboard bundle
// Contains data adapter and interactive logic
const EXCEL_SPOT_EQUIVALENT = 0.5;
const TARGET_NO3 = 20;
const CHART_DIMENSION_LIMITS = {
  minWidth: 360,
  maxWidth: 1120,
  viewportPadding: 48,
  fallbackWidth: 720,
  minHeight: 340,
  maxHeight: 720,
  heightRatio: 0.6
};

function computeChartDimensions(container) {
  if (typeof window === 'undefined') {
    return { width: CHART_DIMENSION_LIMITS.fallbackWidth, height: CHART_DIMENSION_LIMITS.minHeight };
  }
  const viewportWidth = Math.max(document.documentElement?.clientWidth || 0, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement?.clientHeight || 0, window.innerHeight || 0);
  const availableWidth = viewportWidth - CHART_DIMENSION_LIMITS.viewportPadding;
  const width = Math.min(
    CHART_DIMENSION_LIMITS.maxWidth,
    Math.max(CHART_DIMENSION_LIMITS.minWidth, availableWidth || CHART_DIMENSION_LIMITS.fallbackWidth)
  );
  const desiredHeight = viewportHeight ? viewportHeight * CHART_DIMENSION_LIMITS.heightRatio : CHART_DIMENSION_LIMITS.minHeight;
  const height = Math.round(
    Math.max(
      CHART_DIMENSION_LIMITS.minHeight,
      Math.min(desiredHeight || CHART_DIMENSION_LIMITS.minHeight, CHART_DIMENSION_LIMITS.maxHeight)
    )
  );
  if (container) {
    container.style.setProperty('--chart-height', `${height}px`);
  }
  return { width, height };
}

function toDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDateLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

function extractNitrate(segment) {
  if (!segment || !/nitrate/i.test(segment)) {
    return null;
  }
  const cleaned = segment.replace(/nitrate[:\s-]*/i, '').replace(/ppm/gi, 'ppm');
  const approxRegexes = [
    /≈\s*(\d+(?:\.\d+)?)/i,
    /closer to\s*(\d+(?:\.\d+)?)/i,
    /about\s*(\d+(?:\.\d+)?)/i,
    /around\s*(\d+(?:\.\d+)?)/i,
    /~\s*(\d+(?:\.\d+)?)/i,
    /approx(?:\.|imately)?\s*(\d+(?:\.\d+)?)/i
  ];
  let approxValue = null;
  for (const regex of approxRegexes) {
    const match = cleaned.match(regex);
    if (match) {
      approxValue = Number(match[1]);
      break;
    }
  }
  let range = null;
  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:–|-|to)\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    range = [Number(rangeMatch[1]), Number(rangeMatch[2])];
  }
  let singleValue = null;
  const ppmMatch = cleaned.match(/(~?\d+(?:\.\d+)?)\s*ppm/i);
  if (ppmMatch) {
    singleValue = Number(ppmMatch[1].replace('~', ''));
  }
  if (!singleValue && !range) {
    const strayMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (strayMatch) {
      singleValue = Number(strayMatch[1]);
    }
  }
  let chosen = null;
  if (approxValue != null) {
    chosen = approxValue;
  } else if (range) {
    chosen = (range[0] + range[1]) / 2;
  } else if (singleValue != null) {
    chosen = singleValue;
  }
  if (chosen == null) {
    return null;
  }
  const tooltipParts = [];
  if (range) {
    tooltipParts.push(`Range: ${range[0]}–${range[1]} ppm`);
    tooltipParts.push(`Avg ${(Math.round(((range[0] + range[1]) / 2) * 10) / 10).toFixed(1)}`);
  }
  if (approxValue != null) {
    tooltipParts.push(`Approx: ${approxValue} ppm`);
  }
  const tooltip = tooltipParts.length ? tooltipParts.join(' • ') : null;
  return {
    value: chosen,
    tooltip,
    range,
    raw: segment.trim()
  };
}

function detectWaterChange(text) {
  if (!text) return null;
  if (!/(water change|\bwc\b)/i.test(text)) {
    return null;
  }
  const sumpMatch = text.match(/(~?\d+(?:\.\d+)?)%\s*sump/i);
  const displayMatch = text.match(/(~?\d+(?:\.\d+)?)%\s*display/i);
  const sumpPct = sumpMatch ? Number(sumpMatch[1].replace('~', '')) : null;
  const displayPct = displayMatch ? Number(displayMatch[1].replace('~', '')) : null;
  return {
    hasChange: true,
    sumpPct,
    displayPct
  };
}

function extractThrive(text) {
  if (!text) return 0;
  let total = 0;
  const pumpMatches = text.matchAll(/(\d+(?:\.\d+)?)\s*pump/gi);
  for (const match of pumpMatches) {
    const count = Number(match[1]);
    if (!Number.isNaN(count)) {
      total += count;
    }
  }
  return total;
}

function extractExcel(text) {
  if (!text || !/excel/i.test(text)) {
    return { total: 0, details: [] };
  }
  let total = 0;
  const details = [];
  const numericCaps = [...text.matchAll(/(\d+(?:\.\d+)?)\s*cap(?:ful|s)?/gi)];
  for (const match of numericCaps) {
    const amount = Number(match[1]);
    if (!Number.isNaN(amount)) {
      total += amount;
      details.push(`${amount} cap${amount === 1 ? '' : 's'}`);
    }
  }
  const cleaned = text.replace(/\d+(?:\.\d+)?\s*cap(?:ful|s)?/gi, '');
  const soloCaps = cleaned.match(/\bcap(?:ful)?\b/gi);
  if (soloCaps) {
    total += soloCaps.length;
    soloCaps.forEach(() => details.push('1 cap'));
  }
  const spotMatches = text.match(/spot(?:\s*dose)?/gi);
  if (spotMatches) {
    total += spotMatches.length * EXCEL_SPOT_EQUIVALENT;
    spotMatches.forEach(() => details.push(`${EXCEL_SPOT_EQUIVALENT} cap (spot)`));
  }
  return { total, details };
}

const maintenancePatterns = [
  { regex: /trim|prune/i, type: 'Trim' },
  { regex: /glass|scraper/i, type: 'Glass Cleaning' },
  { regex: /filter/i, type: 'Filter Maintenance' },
  { regex: /replant/i, type: 'Replant' },
  { regex: /bba/i, type: 'BBA Treatment' }
];

function extractMaintenanceSegments(text) {
  if (!text) return [];
  const segments = text.split(/[·•]/).map((segment) => segment.trim()).filter(Boolean);
  const events = [];
  const seen = new Map();
  for (const segment of segments) {
    for (const { regex, type } of maintenancePatterns) {
      if (regex.test(segment)) {
        const existing = seen.get(type);
        if (!existing || segment.length < existing.length) {
          seen.set(type, segment);
        }
      }
    }
  }
  for (const [type, details] of seen.entries()) {
    events.push({ type, details });
  }
  return events;
}

function parseEntry(entry) {
  const combined = [entry.quick_facts, entry.ramble].filter(Boolean).join(' · ');
  const segments = combined.split(/[·•]/).map((segment) => segment.trim()).filter(Boolean);
  let nitrateInfo = null;
  for (const segment of segments) {
    if (/nitrate/i.test(segment)) {
      nitrateInfo = extractNitrate(segment);
      if (nitrateInfo) break;
    }
  }
  const waterChange = detectWaterChange(combined);
  const thrive = extractThrive(combined);
  const excel = extractExcel(combined);
  const maintenance = extractMaintenanceSegments(combined);
  return {
    nitrate: nitrateInfo,
    waterChange,
    thrive,
    excel,
    maintenance
  };
}

function isoWeekStart(date) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay() || 7;
  if (day !== 1) {
    result.setUTCDate(result.getUTCDate() - day + 1);
  }
  return result;
}

function isoWeekLabel(startDate) {
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const format = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  return `${format.format(startDate)} – ${format.format(endDate)}`;
}

function buildWaterChangeDetails(info) {
  if (!info) return '';
  const parts = [];
  if (info.sumpPct != null) {
    parts.push(`${info.sumpPct}% sump`);
  }
  if (info.displayPct != null) {
    parts.push(`${info.displayPct}% display`);
  }
  return parts.length ? parts.join(' / ') : 'Water change';
}

function prepareDashboardData({ entries, includeLast30 = false, masterEntries = [] }) {
  if (!entries || !entries.length) {
    return {
      nitrateData: [],
      dosingData: [],
      maintenanceEvents: [],
      meta: { dateStart: null, dateEnd: null, sampleByDate: new Map() }
    };
  }
  const entryDates = entries.map((entry) => toDate(entry.date));
  const maxDate = new Date(Math.max(...entryDates.map((d) => d.getTime())));
  let relevantEntries = entries;
  if (includeLast30 && masterEntries.length) {
    const windowEnd = maxDate;
    const windowStart = new Date(windowEnd);
    windowStart.setUTCDate(windowStart.getUTCDate() - 29);
    relevantEntries = masterEntries.filter((entry) => {
      const entryDate = toDate(entry.date);
      return entryDate >= windowStart && entryDate <= windowEnd;
    });
  }
  const sorted = [...relevantEntries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDate = new Map();
  for (const entry of sorted) {
    const key = entry.date;
    let record = byDate.get(key);
    if (!record) {
      const dateObj = toDate(key);
      record = {
        dateISO: key,
        date: dateObj,
        nitrateReadings: [],
        thrive: 0,
        excel: 0,
        excelNotes: [],
        waterChange: null,
        maintenance: []
      };
      byDate.set(key, record);
    }
    const parsed = parseEntry(entry);
    if (parsed.nitrate) {
      record.nitrateReadings.push(parsed.nitrate);
    }
    if (parsed.waterChange) {
      record.waterChange = parsed.waterChange;
    }
    if (parsed.thrive) {
      record.thrive += parsed.thrive;
    }
    if (parsed.excel.total) {
      record.excel += parsed.excel.total;
      record.excelNotes.push(...parsed.excel.details);
    }
    if (parsed.maintenance.length) {
      record.maintenance.push(...parsed.maintenance);
    }
  }
  const nitrateData = [];
  const maintenanceEvents = [];
  let minDate = null;
  let maxRangeDate = null;
  const sampleByDate = new Map();
  for (const record of [...byDate.values()].sort((a, b) => a.date - b.date)) {
    const chosenReading = record.nitrateReadings.length ? record.nitrateReadings[record.nitrateReadings.length - 1] : null;
    const nitrateValue = chosenReading ? chosenReading.value : null;
    const tooltip = chosenReading ? chosenReading.tooltip || chosenReading.raw : null;
    nitrateData.push({
      dateLabel: formatDateLabel(record.date),
      dateISO: record.dateISO,
      nitrate: nitrateValue,
      nitrateDetails: tooltip,
      wc: Boolean(record.waterChange),
      sumpPct: record.waterChange ? record.waterChange.sumpPct : null,
      displayPct: record.waterChange ? record.waterChange.displayPct : null,
      thrive: Number(record.thrive.toFixed(2)),
      excelCap: Number(record.excel.toFixed(2)),
      excelNotes: record.excelNotes
    });
    if (!minDate || record.date < minDate) minDate = record.date;
    if (!maxRangeDate || record.date > maxRangeDate) maxRangeDate = record.date;
    if (record.waterChange) {
      maintenanceEvents.push({
        dateLabel: formatDateLabel(record.date),
        dateISO: record.dateISO,
        type: 'Water Change',
        details: buildWaterChangeDetails(record.waterChange),
        sumpPct: record.waterChange.sumpPct,
        displayPct: record.waterChange.displayPct
      });
    }
    if (record.maintenance.length) {
      for (const item of record.maintenance) {
        maintenanceEvents.push({
          dateLabel: formatDateLabel(record.date),
          dateISO: record.dateISO,
          type: item.type,
          details: item.details,
          sumpPct: record.waterChange ? record.waterChange.sumpPct : null,
          displayPct: record.waterChange ? record.waterChange.displayPct : null
        });
      }
    }
    sampleByDate.set(record.dateISO, {
      nitrate: nitrateValue,
      nitrateDetails: tooltip,
      thrive: Number(record.thrive.toFixed(2)),
      excelCap: Number(record.excel.toFixed(2)),
      excelNotes: record.excelNotes,
      waterChange: record.waterChange,
      maintenance: record.maintenance
    });
  }
  const dosingDataMap = new Map();
  for (const day of nitrateData) {
    const dateObj = toDate(day.dateISO);
    const weekStart = isoWeekStart(dateObj);
    const weekKey = weekStart.toISOString().slice(0, 10);
    let aggregate = dosingDataMap.get(weekKey);
    if (!aggregate) {
      aggregate = {
        weekStart,
        thrivePumps: 0,
        excelCapEquivalent: 0
      };
      dosingDataMap.set(weekKey, aggregate);
    }
    aggregate.thrivePumps += day.thrive;
    aggregate.excelCapEquivalent += day.excelCap;
  }
  const dosingData = [...dosingDataMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({
      weekKey: key,
      label: isoWeekLabel(value.weekStart),
      thrivePumps: Number(value.thrivePumps.toFixed(2)),
      excelCapEquivalent: Number(value.excelCapEquivalent.toFixed(2))
    }));
  return {
    nitrateData,
    dosingData,
    maintenanceEvents,
    meta: {
      dateStart: minDate,
      dateEnd: maxRangeDate,
      sampleByDate
    }
  };
}

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
  let resizeTimerId = null;
  window.addEventListener(
    'resize',
    () => {
      clearTimeout(resizeTimerId);
      resizeTimerId = window.setTimeout(() => {
        render();
      }, 150);
    },
    { passive: true }
  );
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
    button.className = `dashboard-tab tab-btn${state.activeTab === id ? ' is-active' : ''}`;
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
  const panel = createElement('section', 'dashboard-panel section chart-section chart--nitrate');
  panel.id = 'dashboard-panel-nitrate';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', 'dashboard-tab-nitrate');
  if (state.activeTab !== 'nitrate') panel.hidden = true;
  const heading = document.createElement('h2');
  heading.textContent = 'Nitrate Levels';
  heading.className = 'section-title';
  panel.appendChild(heading);

  const monthLabel = deriveMonthLabel(state.dataState?.meta?.dateStart, state.dataState?.meta?.dateEnd);
  panel.appendChild(
    createLegend([
      { color: '#1f6feb', label: 'Nitrate (ppm)' },
      { color: '#f59e0b', label: 'Water-change day' }
    ])
  );

  const chartWrap = createElement('div', 'dashboard-chart chart-container');
  const chartDimensions = computeChartDimensions(chartWrap);
  const hoverSummary = createHoverSummary();
  chartWrap.appendChild(hoverSummary);
  const chart = renderNitrateChart(state.dataState.nitrateData, {
    xLabel: monthLabel ? `Date (${monthLabel})` : 'Date',
    yLabel: 'ppm',
    onSummaryChange: (text) => updateHoverSummary(hoverSummary, text),
    dimensions: chartDimensions
  });
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
  const panel = createElement('section', 'dashboard-panel section chart-section chart--dosing');
  panel.id = 'dashboard-panel-dosing';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', 'dashboard-tab-dosing');
  if (state.activeTab !== 'dosing') panel.hidden = true;
  const heading = document.createElement('h2');
  heading.textContent = 'Dosing Totals';
  heading.className = 'section-title';
  panel.appendChild(heading);

  panel.appendChild(
    createLegend([
      { color: '#10b981', label: 'Thrive Plus (pumps)' },
      { color: '#8b5cf6', label: 'Seachem Excel (capfuls)' }
    ])
  );

  const chartWrap = createElement('div', 'dashboard-chart chart-container');
  const chartDimensions = computeChartDimensions(chartWrap);
  const hoverSummary = createHoverSummary();
  chartWrap.appendChild(hoverSummary);
  const chart = renderDosingChart(state.dataState.dosingData, {
    xLabel: 'Week',
    yLabel: 'Amount (pumps or caps)',
    onSummaryChange: (text) => updateHoverSummary(hoverSummary, text),
    dimensions: chartDimensions
  });
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
  const panel = createElement('section', 'dashboard-panel section chart-section chart--maintenance');
  panel.id = 'dashboard-panel-maintenance';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', 'dashboard-tab-maintenance');
  if (state.activeTab !== 'maintenance') panel.hidden = true;
  const heading = document.createElement('h2');
  heading.textContent = 'Maintenance Log';
  heading.className = 'section-title';
  panel.appendChild(heading);
  panel.appendChild(
    createLegend([
      { color: '#f59e0b', label: 'Water change' },
      { color: '#10b981', label: 'Filter maintenance' },
      { color: '#8b5cf6', label: 'Trim / replant' },
      { color: '#1f6feb', label: 'Glass cleaning' },
      { color: '#ef4444', label: 'BBA treatment' }
    ])
  );
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
      list.appendChild(li);
    });
    card.appendChild(list);
    const waterChangeMeta = day.items.find((item) => item.type === 'Water Change' && (item.sumpPct != null || item.displayPct != null));
    if (waterChangeMeta) {
      const parts = [];
      if (waterChangeMeta.sumpPct != null) parts.push(`${waterChangeMeta.sumpPct}% sump`);
      if (waterChangeMeta.displayPct != null) parts.push(`${waterChangeMeta.displayPct}% display`);
      if (parts.length) {
        const metaLine = createElement('p', 'dashboard-card__meta');
        metaLine.textContent = `Exchange: ${parts.join(' / ')}`;
        card.appendChild(metaLine);
      }
    }
    grid.appendChild(card);
  });
  return grid;
}

function renderNitrateChart(data, options = {}) {
  const { xLabel, yLabel, onSummaryChange, dimensions } = options;
  const { width, height } = dimensions ?? computeChartDimensions();
  const margin = { top: 36, right: 32, bottom: 60, left: 60 };
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
  drawAxes(g, innerWidth, innerHeight, xScale, yScale, {
    xLabel,
    yLabel
  });
  drawReferenceLine(g, yScale, innerWidth, TARGET_NO3);
  drawNitratePath(g, data, xScale, yScale);
  drawNitrateDots(g, data, xScale, yScale, tooltip, {
    onSummaryChange
  });

  attachTooltipHandlers(svg, tooltip, () => onSummaryChange?.(null));
  return { svg, tooltip };
}

function renderDosingChart(data, options = {}) {
  const { xLabel, yLabel, onSummaryChange, dimensions } = options;
  const { width, height } = dimensions ?? computeChartDimensions();
  const margin = { top: 36, right: 32, bottom: 68, left: 64 };
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
  drawAxes(g, innerWidth, innerHeight, xScale, yScale, {
    rotateX: true,
    xLabel,
    yLabel
  });
  drawBars(g, data, xScale, yScale, tooltip, {
    onSummaryChange
  });
  attachTooltipHandlers(svg, tooltip, () => onSummaryChange?.(null));
  return { svg, tooltip };
}

function drawGrid(group, width, height, xScale, yScale) {
  const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gridGroup.setAttribute('stroke', 'rgba(236, 244, 255, 0.1)');
  gridGroup.setAttribute('stroke-dasharray', '4 4');
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

function drawAxes(group, width, height, xScale, yScale, options = {}) {
  const { rotateX = false, xLabel, yLabel } = options;
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
    text.setAttribute('y', rotateX ? 22 : 26);
    text.setAttribute('fill', 'rgba(236, 244, 255, 0.9)');
    text.setAttribute('font-size', rotateX ? '13' : '14');
    text.setAttribute('font-weight', '500');
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
    text.setAttribute('fill', 'rgba(236, 244, 255, 0.85)');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-weight', '500');
    text.setAttribute('text-anchor', 'end');
    text.textContent = tick;
    yAxis.appendChild(text);
  });
  axisGroup.appendChild(yAxis);

  if (xLabel) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', width / 2);
    label.setAttribute('y', height + (rotateX ? 46 : 40));
    label.setAttribute('fill', 'rgba(236, 244, 255, 0.92)');
    label.setAttribute('font-size', '16');
    label.setAttribute('font-weight', '600');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = xLabel;
    axisGroup.appendChild(label);
  }

  if (yLabel) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', -48);
    label.setAttribute('y', height / 2);
    label.setAttribute('fill', 'rgba(236, 244, 255, 0.92)');
    label.setAttribute('font-size', '16');
    label.setAttribute('font-weight', '600');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('transform', `rotate(-90 ${-48} ${height / 2})`);
    label.textContent = yLabel;
    axisGroup.appendChild(label);
  }

  group.appendChild(axisGroup);
}

function drawReferenceLine(group, yScale, width, value) {
  const y = yScale.map(value);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', '0');
  line.setAttribute('x2', width);
  line.setAttribute('y1', y);
  line.setAttribute('y2', y);
  line.setAttribute('stroke', '#1f6feb33');
  line.setAttribute('stroke-dasharray', '6 6');
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
  path.setAttribute('stroke', '#1f6feb');
  path.setAttribute('stroke-width', '3');
  group.appendChild(path);
}

function drawNitrateDots(group, data, xScale, yScale, tooltip, options = {}) {
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
    circle.setAttribute('r', point.wc ? 7 : 5);
    circle.setAttribute('fill', point.wc ? '#f59e0b' : '#1f6feb');
    circle.setAttribute('stroke', point.wc ? '#b45309' : '#1e3a8a');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('tabindex', '0');
    circle.setAttribute('role', 'img');
    circle.setAttribute(
      'aria-label',
      point.wc
        ? `${point.dateLabel}: Water change marker`
        : `${point.dateLabel}: Nitrate ${point.nitrate != null ? point.nitrate.toFixed(1) : 'unknown'} ppm`
    );
    const showHandler = (event) => {
      showTooltip(event, tooltip, buildNitrateTooltip(point), point.wc ? '#f59e0b' : '#1f6feb');
      options.onSummaryChange?.(formatNitrateSummary(point));
    };
    const hideHandler = () => {
      hideTooltip(tooltip);
      options.onSummaryChange?.(null);
    };
    circle.addEventListener('pointerenter', showHandler);
    circle.addEventListener('pointerleave', hideHandler);
    circle.addEventListener('pointerdown', showHandler);
    circle.addEventListener('pointercancel', hideHandler);
    circle.addEventListener('focus', showHandler);
    circle.addEventListener('blur', hideHandler);
    group.appendChild(circle);
  });
}

function drawBars(group, data, xScale, yScale, tooltip, options = {}) {
  const thriveColor = '#10b981';
  const excelColor = '#8b5cf6';
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
    thriveRect.setAttribute('rx', '4');
    thriveRect.setAttribute('ry', '4');
    thriveRect.setAttribute('fill', thriveColor);
    thriveRect.setAttribute('tabindex', '0');
    thriveRect.setAttribute('role', 'img');
    thriveRect.setAttribute(
      'aria-label',
      `${item.label}: Thrive ${item.thrivePumps.toFixed(2)} pumps`
    );
    const showThrive = (event) => {
      showTooltip(event, tooltip, buildDosingTooltip(item), thriveColor);
      options.onSummaryChange?.(formatDosingSummary(item));
    };
    const hideHandler = () => {
      hideTooltip(tooltip);
      options.onSummaryChange?.(null);
    };
    thriveRect.addEventListener('pointerenter', showThrive);
    thriveRect.addEventListener('pointerleave', hideHandler);
    thriveRect.addEventListener('pointerdown', showThrive);
    thriveRect.addEventListener('pointercancel', hideHandler);
    thriveRect.addEventListener('focus', showThrive);
    thriveRect.addEventListener('blur', hideHandler);
    group.appendChild(thriveRect);

    const excelRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    excelRect.setAttribute('x', x + width / 2 + 4);
    excelRect.setAttribute('y', yScale.map(item.excelCapEquivalent));
    excelRect.setAttribute('width', width / 2 - 4);
    excelRect.setAttribute('height', excelHeight);
    excelRect.setAttribute('rx', '4');
    excelRect.setAttribute('ry', '4');
    excelRect.setAttribute('fill', excelColor);
    excelRect.setAttribute('tabindex', '0');
    excelRect.setAttribute('role', 'img');
    excelRect.setAttribute(
      'aria-label',
      `${item.label}: Excel ${item.excelCapEquivalent.toFixed(2)} cap equivalents`
    );
    const showExcel = (event) => {
      showTooltip(event, tooltip, buildDosingTooltip(item), excelColor);
      options.onSummaryChange?.(formatDosingSummary(item));
    };
    excelRect.addEventListener('pointerenter', showExcel);
    excelRect.addEventListener('pointerleave', hideHandler);
    excelRect.addEventListener('pointerdown', showExcel);
    excelRect.addEventListener('pointercancel', hideHandler);
    excelRect.addEventListener('focus', showExcel);
    excelRect.addEventListener('blur', hideHandler);
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

function showTooltip(event, tooltip, content, accentColor) {
  tooltip.innerHTML = content;
  tooltip.style.setProperty('--tooltip-accent', accentColor || '#1f6feb');
  tooltip.style.opacity = '1';
  let clientX = event?.clientX;
  let clientY = event?.clientY;
  if ((clientX == null || clientY == null) && event?.target) {
    const rect = event.target.getBoundingClientRect?.();
    if (rect) {
      clientX = rect.left + rect.width / 2;
      clientY = rect.top + rect.height / 2;
    }
  }
  if (event?.pointerType === 'touch') {
    event.preventDefault?.();
  }
  tooltip.style.left = `${(clientX ?? 0) + 16}px`;
  tooltip.style.top = `${(clientY ?? 0) - 16}px`;
}

function hideTooltip(tooltip) {
  tooltip.style.opacity = '0';
}

function attachTooltipHandlers(svg, tooltip, onLeave) {
  const handleLeave = () => {
    hideTooltip(tooltip);
    onLeave?.();
  };
  svg.addEventListener('mouseleave', handleLeave);
  svg.addEventListener('pointerleave', handleLeave);
  svg.addEventListener('pointercancel', handleLeave);
  svg.addEventListener('touchend', handleLeave);
}

function createSvg(width, height) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.style.width = '100%';
  svg.style.height = '100%';
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
  tooltip.style.setProperty('--tooltip-accent', '#1f6feb');
  return tooltip;
}

function createLegend(items = []) {
  const legend = createElement('div', 'legend');
  legend.setAttribute('role', 'list');
  items.forEach((item) => {
    const legendItem = createElement('span', 'legend-item');
    legendItem.setAttribute('role', 'listitem');
    const swatch = createElement('span', 'legend-swatch');
    swatch.style.setProperty('--swatch', item.color);
    swatch.setAttribute('role', 'img');
    swatch.setAttribute('aria-label', `${item.label} color`);
    const label = createElement('span', 'legend-label');
    label.textContent = item.label;
    legendItem.appendChild(swatch);
    legendItem.appendChild(label);
    legend.appendChild(legendItem);
  });
  return legend;
}

function createHoverSummary() {
  const summary = createElement('div', 'hover-summary');
  summary.setAttribute('aria-live', 'polite');
  summary.setAttribute('role', 'status');
  summary.setAttribute('aria-hidden', 'true');
  summary.hidden = true;
  return summary;
}

function updateHoverSummary(element, text) {
  if (!element) return;
  if (text) {
    element.textContent = text;
    element.hidden = false;
    element.setAttribute('aria-hidden', 'false');
  } else {
    element.textContent = '';
    element.hidden = true;
    element.setAttribute('aria-hidden', 'true');
  }
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

function deriveMonthLabel(start, end) {
  const startDate = start instanceof Date ? start : start ? new Date(start) : null;
  const endDate = end instanceof Date ? end : end ? new Date(end) : null;
  const reference = endDate || startDate;
  if (!reference) return '';
  const sameMonth =
    startDate && endDate
      ? startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()
      : true;
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
  if (sameMonth) {
    return formatter.format(reference);
  }
  if (startDate && endDate) {
    const startFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
    return `${startFormatter.format(startDate)} – ${formatter.format(endDate)}`;
  }
  return formatter.format(reference);
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

function formatNumber(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) return '';
  const fixed = Number(value).toFixed(decimals);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function formatExcelSummary(point) {
  if (!point) return '';
  if (!Array.isArray(point.excelNotes) || !point.excelNotes.length) {
    if (point.excelCap > 0) {
      const value = formatNumber(point.excelCap, 2);
      const plural = Math.abs(point.excelCap - 1) < 0.01 ? 'capful' : 'capfuls';
      return `${value} ${plural}`.trim();
    }
    return '';
  }
  const normalized = point.excelNotes
    .map((note) => {
      if (!note) return '';
      if (/spot/i.test(note)) return 'spot';
      const cleaned = note.replace(/\(spot\)/i, '').replace(/cap eq\./i, 'cap eq.');
      return cleaned.trim().replace(/\bCaps\b/, 'caps').replace(/\bCap\b/, 'cap');
    })
    .filter(Boolean);
  if (!normalized.length) {
    return formatExcelSummary({ excelCap: point.excelCap });
  }
  return normalized.join(' + ');
}

function formatNitrateSummary(point) {
  if (!point) return '';
  const date = point.dateISO ? new Date(point.dateISO) : null;
  const dateLabel = date
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : point.dateLabel;
  const nitrateValue = point.nitrate != null ? `${formatNumber(point.nitrate, 1)} ppm` : '—';
  const parts = [`${dateLabel} — Nitrate: ${nitrateValue}`];
  if (point.thrive > 0) {
    parts.push(`Thrive: ${formatNumber(point.thrive, 2)} pumps`);
  }
  if (point.excelCap > 0) {
    const excelText = formatExcelSummary(point);
    if (excelText) {
      parts.push(`Excel: ${excelText}`);
    }
  }
  if (point.wc) {
    parts.push('Water change');
  }
  return parts.join(' | ');
}

function formatDosingSummary(item) {
  if (!item) return '';
  const thrive = formatNumber(item.thrivePumps, 2) || '0';
  const excel = formatNumber(item.excelCapEquivalent, 2) || '0';
  return `${item.label} — Thrive: ${thrive} pumps • Excel: ${excel} capfuls`;
}

document.addEventListener('DOMContentLoaded', init);
