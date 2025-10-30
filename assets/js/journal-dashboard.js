(function () {
  const statusEl = document.querySelector('[data-chart-status]');
  if (statusEl) {
    statusEl.textContent = 'Loading dashboard…';
  }

  if (typeof window.Chart === 'undefined') {
    if (statusEl) {
      statusEl.textContent = 'Charts unavailable (Chart.js not loaded).';
    }
    return;
  }

  if (typeof Chart.defaults === 'object') {
    Chart.defaults.color = 'rgba(226, 232, 240, 0.85)';
    Chart.defaults.font = Chart.defaults.font || {};
    Chart.defaults.font.family = 'Inter, "Segoe UI", system-ui, sans-serif';
    Chart.defaults.font.size = 14;
    Chart.defaults.font.weight = '500';
  }

  const journalPointLabelPlugin = {
    id: 'journalPointLabels',
    defaults: {
      offset: 12,
      minSpacing: 6,
      boundaryPadding: 8,
      font: { size: 11, weight: '600' }
    },
    afterDatasetsDraw(chart) {
      const datasets = chart.data?.datasets || [];
      if (!datasets.length) {
        return;
      }

      const pluginOptions = chart.options?.plugins?.journalPointLabels || {};
      const options = mergeLabelOptions(journalPointLabelPlugin.defaults, pluginOptions);
      const fontFamily = Chart.defaults?.font?.family || 'Inter, "Segoe UI", system-ui, sans-serif';
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      if (!chartArea) {
        ctx.restore();
        return;
      }
      const placements = [];

      ctx.save();
      datasets.forEach((dataset, datasetIndex) => {
        if (!dataset || !Array.isArray(dataset.pointLabels)) {
          return;
        }

        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta || meta.hidden || meta.type !== 'line') {
          return;
        }

        const elements = meta.data || [];
        const color = dataset.labelColor || options.color || dataset.borderColor || '#ffffff';
        const fontSize = dataset.labelFontSize || options.font.size;
        const fontWeight = dataset.labelFontWeight || options.font.weight;
        const lineHeight = fontSize * 1.35;
        const baseOffset = Number.isFinite(dataset.labelOffset) ? dataset.labelOffset : options.offset;
        const alternate = dataset.labelDirection === 'alternate';

        ctx.fillStyle = color;
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'center';

        elements.forEach((element, index) => {
          const label = dataset.pointLabels[index];
          if (!element || typeof element.x !== 'number' || typeof element.y !== 'number' || !label) {
            return;
          }

          const text = String(label);
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          const textWidth = ctx.measureText(text).width;
          let x = element.x + (dataset.labelXOffset || 0);
          let y = element.y - baseOffset;

          if (alternate && index % 2 === 1) {
            y = element.y + baseOffset * 0.85;
          }

          ({ x, y } = fitLabelWithinChart({
            x,
            y,
            width: textWidth,
            height: lineHeight,
            chartArea,
            placements,
            alternate,
            elementY: element.y,
            offset: baseOffset,
            options
          }));

          ctx.fillText(text, x, y);

          placements.push({
            left: x - textWidth / 2,
            right: x + textWidth / 2,
            top: y - lineHeight,
            bottom: y
          });
        });
      });
      ctx.restore();
    }
  };

  if (typeof Chart?.register === 'function') {
    Chart.register(journalPointLabelPlugin);
  }

  function mergeLabelOptions(defaults, overrides) {
    const result = { ...defaults, font: { ...defaults.font } };
    if (!overrides || typeof overrides !== 'object') {
      return result;
    }
    if (typeof overrides.offset === 'number') {
      result.offset = overrides.offset;
    }
    if (typeof overrides.minSpacing === 'number') {
      result.minSpacing = overrides.minSpacing;
    }
    if (typeof overrides.boundaryPadding === 'number') {
      result.boundaryPadding = overrides.boundaryPadding;
    }
    if (overrides.font && typeof overrides.font === 'object') {
      result.font = { ...result.font, ...overrides.font };
    }
    if (typeof overrides.color === 'string') {
      result.color = overrides.color;
    }
    return result;
  }

  function boxesOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function fitLabelWithinChart({ x, y, width, height, chartArea, placements, elementY, options }) {
    const maxAttempts = 12;
    const step = height + (options.minSpacing || 4);
    let attempt = 0;
    let direction = y < elementY ? -1 : 1;
    if (!direction) {
      direction = -1;
    }

    const xMin = chartArea.left + (options.boundaryPadding || 0) + width / 2;
    const xMax = chartArea.right - (options.boundaryPadding || 0) - width / 2;
    let candidateX = clamp(x, xMin, xMax);
    let candidateY = y;

    while (attempt < maxAttempts) {
      let top = candidateY - height;
      let bottom = candidateY;

      if (top < chartArea.top + (options.boundaryPadding || 0)) {
        candidateY = chartArea.top + (options.boundaryPadding || 0) + height;
        top = candidateY - height;
        bottom = candidateY;
      }

      if (bottom > chartArea.bottom - (options.boundaryPadding || 0)) {
        candidateY = chartArea.bottom - (options.boundaryPadding || 0);
        top = candidateY - height;
        bottom = candidateY;
      }

      const candidateBox = {
        left: candidateX - width / 2,
        right: candidateX + width / 2,
        top,
        bottom
      };

      const overlaps = placements.some((placed) => boxesOverlap(candidateBox, placed));
      if (!overlaps) {
        return { x: candidateX, y: candidateY };
      }

      candidateY += direction * step;
      direction *= -1;
      attempt += 1;
    }

    return { x: candidateX, y: candidateY };
  }

  function parseColor(color) {
    if (!color || typeof color !== 'string') {
      return null;
    }
    if (color.startsWith('#')) {
      let hex = color.slice(1).trim();
      if (hex.length === 3) {
        hex = hex
          .split('')
          .map((char) => `${char}${char}`)
          .join('');
      }
      const numeric = Number.parseInt(hex, 16);
      if (!Number.isFinite(numeric)) {
        return null;
      }
      return {
        r: (numeric >> 16) & 255,
        g: (numeric >> 8) & 255,
        b: numeric & 255,
        a: 1
      };
    }
    const match = color.match(/rgba?\(([^)]+)\)/i);
    if (!match) {
      return null;
    }
    const parts = match[1]
      .split(',')
      .map((part) => part.trim())
      .map((part) => Number.parseFloat(part));
    if (parts.length < 3 || parts.some((value) => !Number.isFinite(value))) {
      return null;
    }
    return {
      r: parts[0],
      g: parts[1],
      b: parts[2],
      a: parts[3] ?? 1
    };
  }

  function lightenColor(color, amount = 0.2, alpha = 0.95) {
    const parsed = parseColor(color);
    if (!parsed) {
      return color;
    }
    const clampChannel = (value) => clamp(Math.round(value), 0, 255);
    const mix = (channel) => clampChannel(channel + (255 - channel) * amount);
    const r = mix(parsed.r);
    const g = mix(parsed.g);
    const b = mix(parsed.b);
    const nextAlpha = typeof alpha === 'number' ? Math.min(Math.max(alpha, 0), 1) : parsed.a;
    return `rgba(${r}, ${g}, ${b}, ${nextAlpha})`;
  }

  const dom = {
    rangeWindow: document.querySelector('[data-range-window]'),
    rangeMonth: document.querySelector('[data-range-month]'),
    toggle: document.querySelector('[data-range-toggle]'),
    rangeButtons: Array.from(document.querySelectorAll('[data-range-nav]')),
    tabs: Array.from(document.querySelectorAll('[data-tab]')),
    panels: Array.from(document.querySelectorAll('.journal-dashboard__panel')),
    maintenanceList: document.querySelector('[data-maintenance-list]'),
    error: document.querySelector('[data-dashboard-error]')
  };

  const state = {
    data: null,
    showLast30: false,
    activeTab: 'nitrate',
    monthOffset: 0,
    charts: {
      nitrate: null,
      dosing: null
    }
  };

  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  const maintenanceFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  init();

  async function init() {
    const data = await loadData();
    if (!data) {
      setError('Unable to load journal data right now.');
      return;
    }
    state.data = data;
    updateRangeLabels();
    bindControls();
    renderAll();
  }

  function setError(message) {
    if (!dom.error) {
      return;
    }
    dom.error.textContent = message || '';
    dom.error.hidden = !message;
  }

  async function loadData() {
    const fallback = window.__JOURNAL_FALLBACK__ ? JSON.parse(JSON.stringify(window.__JOURNAL_FALLBACK__)) : null;
    try {
      const response = await fetch(`/data/journal.json?t=${Date.now()}`, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      const payload = await response.json();
      const normalized = normalizeModel(payload);
      if (normalized) {
        return normalized;
      }
    } catch (error) {
      const normalizedFallback = normalizeModel(fallback);
      if (normalizedFallback) {
        return normalizedFallback;
      }
      console.error('Failed to load journal dashboard data.', error);
    }
    return null;
  }

  function normalizeModel(raw) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    if (Array.isArray(raw)) {
      return null;
    }
    const period = {
      start: raw.period?.start || null,
      end: raw.period?.end || null
    };

    const nitrate = Array.isArray(raw.nitrate)
      ? raw.nitrate
          .map((entry) => ({
            date: entry.date || null,
            ppm: typeof entry.ppm === 'number' ? entry.ppm : parseFloat(entry.ppm),
            wc: Boolean(entry.wc)
          }))
          .filter((entry) => entry.date && Number.isFinite(entry.ppm))
          .sort((a, b) => new Date(`${a.date}T00:00:00Z`).getTime() - new Date(`${b.date}T00:00:00Z`).getTime())
      : [];

    const dosing = Array.isArray(raw.dosing)
      ? raw.dosing.map((entry) => ({
          week: entry.week || '',
          label: entry.label || entry.week || '',
          thrive: typeof entry.thrive === 'number' ? entry.thrive : parseFloat(entry.thrive) || 0,
          excel: typeof entry.excel === 'number' ? entry.excel : parseFloat(entry.excel) || 0
        }))
      : [];

    const maintenance = Array.isArray(raw.maintenance)
      ? raw.maintenance
          .map((entry) => ({
            date: entry.date || null,
            type: entry.type || 'Maintenance',
            details: entry.details || ''
          }))
          .filter((entry) => entry.date)
          .sort((a, b) => new Date(`${b.date}T00:00:00Z`).getTime() - new Date(`${a.date}T00:00:00Z`).getTime())
      : [];

    if (!period.start || !period.end) {
      const first = nitrate[0]?.date;
      const last = nitrate[nitrate.length - 1]?.date;
      period.start = first || period.start;
      period.end = last || period.end;
    }

    return { period, nitrate, dosing, maintenance };
  }

  function bindControls() {
    dom.rangeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const direction = button.dataset.rangeNav === 'next' ? 1 : -1;
        state.monthOffset += direction;
        updateMonthLabel();
      });
    });

    if (dom.toggle) {
      dom.toggle.addEventListener('click', () => {
        state.showLast30 = !state.showLast30;
        dom.toggle.classList.toggle('is-active', state.showLast30);
        dom.toggle.setAttribute('aria-pressed', state.showLast30 ? 'true' : 'false');
        renderNitrateChart();
      });
    }

    dom.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        setActiveTab(tab.dataset.tab);
      });
    });
  }

  function parseISO(value) {
    if (!value) {
      return null;
    }
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function updateRangeLabels() {
    if (!state.data) {
      return;
    }
    const start = parseISO(state.data.period.start);
    const end = parseISO(state.data.period.end);
    if (dom.rangeWindow) {
      if (!start || !end) {
        dom.rangeWindow.textContent = '—';
      } else {
        const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
        const rangeText = sameMonth
          ? `${dateFormatter.format(start)} – ${dateFormatter.format(end)}, ${end.getFullYear()}`
          : `${dateFormatter.format(start)} ${start.getFullYear()} – ${dateFormatter.format(end)} ${end.getFullYear()}`;
        dom.rangeWindow.textContent = rangeText;
      }
    }
    updateMonthLabel();
  }

  function updateMonthLabel() {
    if (!dom.rangeMonth || !state.data) {
      return;
    }
    const end = parseISO(state.data.period.end);
    if (!end) {
      dom.rangeMonth.textContent = '—';
      return;
    }
    const labelDate = new Date(end);
    labelDate.setMonth(labelDate.getMonth() + state.monthOffset);
    dom.rangeMonth.textContent = monthFormatter.format(labelDate);
  }

  function renderAll() {
    renderNitrateChart();
    renderDosingChart();
    renderMaintenance();
    setActiveTab(state.activeTab);
  }

  function destroyChart(key) {
    if (state.charts[key]) {
      state.charts[key].destroy();
      state.charts[key] = null;
    }
  }

  function getNitrateSeries() {
    if (!state.data) {
      return { labels: [], values: [], markers: [] };
    }
    const endDate = parseISO(state.data.period.end);
    const cutoff = endDate ? new Date(endDate) : null;
    if (cutoff) {
      cutoff.setDate(cutoff.getDate() - 29);
    }
    const items = state.data.nitrate.filter((entry) => {
      if (!state.showLast30 || !cutoff) {
        return true;
      }
      const current = parseISO(entry.date);
      return current && current >= cutoff && current <= endDate;
    });
    const labels = items.map((entry) => dateFormatter.format(parseISO(entry.date)));
    const values = items.map((entry) => entry.ppm);
    const markers = items.map((entry) => (entry.wc ? entry.ppm : null));
    return { labels, values, markers };
  }

  function renderNitrateChart() {
    const canvas = document.getElementById('nitrateChart');
    if (!canvas) {
      return;
    }
    const { labels, values, markers } = getNitrateSeries();
    if (!labels.length) {
      destroyChart('nitrate');
      if (statusEl) {
        statusEl.textContent = 'No nitrate readings available for this range yet.';
      }
      return;
    }

    if (statusEl) {
      statusEl.textContent = '';
    }

    destroyChart('nitrate');

    const labelColor = lightenColor('#7dd3fc', 0.32, 0.96);
    const datasets = [
      {
        label: 'Nitrate',
        data: values,
        borderColor: '#7dd3fc',
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: 'rgba(15, 23, 42, 0.85)',
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.35,
        clip: false,
        pointLabels: labels,
        labelColor,
        labelFontSize: 11,
        labelFontWeight: '600',
        labelDirection: 'alternate',
        labelOffset: 14
      },
      {
        label: 'Water Change',
        data: markers,
        pointBackgroundColor: '#fb923c',
        pointBorderColor: '#fb923c',
        pointRadius: 6,
        showLine: false
      }
    ];

    const annotationConfig = window.ChartAnnotation
      ? {
          annotations: {
            target: {
              type: 'line',
              yMin: 20,
              borderColor: 'rgba(255, 255, 255, 0.5)',
              borderWidth: 1.5,
              borderDash: [6, 6],
              label: {
                content: '20 ppm guide',
                position: 'start',
                padding: 6,
                backgroundColor: 'rgba(8, 12, 24, 0.82)',
                borderColor: 'rgba(148, 163, 184, 0.45)',
                color: '#f8fafc'
              }
            }
          }
        }
      : undefined;

    state.charts.nitrate = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        layout: {
          padding: {
            top: 24,
            bottom: 16,
            left: 4,
            right: 4
          }
        },
        scales: {
          x: {
            ticks: {
              display: false
            },
            grid: {
              display: true
            }
          },
          y: {
            beginAtZero: true,
            suggestedMax: 25,
            ticks: {
              count: 4,
              callback: (value) => `${Math.round(value)} ppm`
            }
          }
        },
        plugins: {
          annotation: annotationConfig,
          legend: {
            display: false
          },
          journalPointLabels: {
            offset: 14,
            font: {
              size: 11,
              weight: '600'
            }
          }
        }
      }
    });
  }

  function renderDosingChart() {
    const canvas = document.getElementById('dosingChart');
    if (!canvas) {
      return;
    }
    const entries = state.data?.dosing || [];
    if (!entries.length) {
      destroyChart('dosing');
      return;
    }
    destroyChart('dosing');
    const labels = entries.map((entry) => entry.label);
    const thriveValues = entries.map((entry) => entry.thrive);
    const excelValues = entries.map((entry) => entry.excel);
    state.charts.dosing = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Thrive Plus (pumps)',
            data: thriveValues,
            backgroundColor: '#34d399'
          },
          {
            label: 'Seachem Excel (caps)',
            data: excelValues,
            backgroundColor: '#a855f7'
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              count: 4,
              callback: (value) => `${value}`
            }
          },
          x: {
            ticks: {
              autoSkip: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  function renderMaintenance() {
    if (!dom.maintenanceList) {
      return;
    }
    dom.maintenanceList.innerHTML = '';
    const entries = state.data?.maintenance || [];
    if (!entries.length) {
      const item = document.createElement('li');
      item.textContent = 'No maintenance events logged yet.';
      dom.maintenanceList.appendChild(item);
      return;
    }
    entries.forEach((entry) => {
      const item = document.createElement('li');
      const header = document.createElement('div');
      header.className = 'maintenance-list__header';

      const dateEl = document.createElement('span');
      dateEl.className = 'maintenance-list__date';
      const parsedDate = parseISO(entry.date);
      dateEl.textContent = parsedDate ? maintenanceFormatter.format(parsedDate) : entry.date;

      const typeEl = document.createElement('span');
      typeEl.className = 'maintenance-list__type';
      typeEl.textContent = entry.type;

      header.appendChild(dateEl);
      header.appendChild(typeEl);

      const details = document.createElement('p');
      details.className = 'maintenance-list__details';
      details.textContent = entry.details || 'Details unavailable';

      item.appendChild(header);
      item.appendChild(details);
      dom.maintenanceList.appendChild(item);
    });
  }

  function setActiveTab(target) {
    if (!target) {
      return;
    }
    state.activeTab = target;
    dom.tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === target;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    dom.panels.forEach((panel) => {
      const isActive = panel.id === `panel-${target}`;
      panel.classList.toggle('is-active', isActive);
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
    if (target === 'nitrate') {
      renderNitrateChart();
    }
    if (target === 'dosing') {
      renderDosingChart();
    }
  }
})();
