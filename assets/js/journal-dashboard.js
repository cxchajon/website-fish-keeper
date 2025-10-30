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

  const reduceMotionQuery = safeMatchMedia('(prefers-reduced-motion: reduce)');

  const chartBackgroundPlugin = {
    id: 'jdChartBackground',
    defaults: { color: '#101b33' },
    beforeDraw(chart, args, pluginOptions) {
      const ctx = chart.ctx;
      const area = chart.chartArea;
      if (!ctx || !area) {
        return;
      }

      const color = pluginOptions?.color || chartBackgroundPlugin.defaults.color;
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(area.left, area.top, area.width, area.height);
      ctx.restore();
    }
  };

  if (typeof Chart?.register === 'function') {
    Chart.register(chartBackgroundPlugin);
  }

  const dom = {
    rangeWindow: document.querySelector('[data-range-window]'),
    rangeMonth: document.querySelector('[data-range-month]'),
    toggle: document.querySelector('[data-range-toggle]'),
    rangeButtons: Array.from(document.querySelectorAll('[data-range-nav]')),
    tabs: Array.from(document.querySelectorAll('[data-tab]')),
    panels: Array.from(document.querySelectorAll('.journal-dashboard__panel')),
    error: document.querySelector('[data-dashboard-error]'),
    densityChips: Array.from(document.querySelectorAll('[data-density]')),
    groupChips: Array.from(document.querySelectorAll('[data-group]')),
    focusModal: document.querySelector('[data-focus-modal]'),
    focusOpen: document.querySelector('[data-focus-open]'),
    focusClose: Array.from(document.querySelectorAll('[data-focus-close]')),
    focusChartWrap: document.querySelector('[data-focus-chart]'),
    maintenanceStatus: document.querySelector('[data-maintenance-status]')
  };

  const state = {
    data: null,
    showLast30: false,
    activeTab: 'nitrate',
    monthOffset: 0,
    density: 'compact',
    groupMode: 'daily',
    charts: {
      nitrate: null,
      nitrateFocus: null,
      dosingThrive: null,
      dosingExcel: null,
      maintenance: null
    }
  };

  let focusReturnElement = null;

  const STORAGE_KEYS = {
    density: 'jd-density-mode',
    groupMode: 'jd-group-mode'
  };

  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  const maintenanceFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (reduceMotionQuery && typeof reduceMotionQuery.addEventListener === 'function') {
    reduceMotionQuery.addEventListener('change', () => {
      const animation = getAnimationOptions();
      Object.values(state.charts).forEach((chart) => {
        if (chart) {
          chart.options.animation = animation;
          chart.update();
        }
      });
    });
  }

  init();

  function safeMatchMedia(query) {
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia(query);
    }
    return null;
  }

  function getAnimationOptions() {
    return reduceMotionQuery?.matches
      ? false
      : {
          duration: 600,
          easing: 'easeOutQuart'
        };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
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

  async function init() {
    const data = await loadData();
    if (!data) {
      setError('Unable to load journal data right now.');
      return;
    }
    state.data = data;
    loadSettings();
    syncDensityUI();
    syncGroupUI();
    updateRangeLabels();
    bindControls();
    renderAll();
  }

  function loadSettings() {
    try {
      const density = localStorage.getItem(STORAGE_KEYS.density);
      if (density === 'comfortable' || density === 'expanded' || density === 'compact') {
        state.density = density;
      }
      const groupMode = localStorage.getItem(STORAGE_KEYS.groupMode);
      if (groupMode === 'weekly' || groupMode === 'daily') {
        state.groupMode = groupMode;
      }
    } catch (error) {
      console.warn('Unable to load dashboard preferences.', error);
    }
  }

  function saveSetting(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Unable to persist dashboard preference.', error);
    }
  }

  function setError(message) {
    if (!dom.error) {
      return;
    }
    dom.error.textContent = message || '';
    dom.error.hidden = !message;
  }

  function syncDensityUI() {
    dom.densityChips.forEach((chip) => {
      const isActive = chip.dataset.density === state.density;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function syncGroupUI() {
    dom.groupChips.forEach((chip) => {
      const isActive = chip.dataset.group === state.groupMode;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
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
        if (state.charts.nitrateFocus) {
          renderFocusChart();
        }
      });
    }

    dom.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        setActiveTab(tab.dataset.tab);
      });
    });

    dom.densityChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const value = chip.dataset.density;
        if (!value || value === state.density) {
          return;
        }
        state.density = value;
        saveSetting(STORAGE_KEYS.density, value);
        syncDensityUI();
        renderAll();
      });
    });

    dom.groupChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const value = chip.dataset.group;
        if (!value || value === state.groupMode) {
          return;
        }
        state.groupMode = value;
        saveSetting(STORAGE_KEYS.groupMode, value);
        syncGroupUI();
        renderAll();
      });
    });

    if (dom.focusOpen) {
      dom.focusOpen.addEventListener('click', openFocusModal);
    }

    dom.focusClose.forEach((trigger) => {
      trigger.addEventListener('click', closeFocusModal);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && dom.focusModal && !dom.focusModal.hasAttribute('hidden')) {
        event.preventDefault();
        closeFocusModal();
      }
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
    renderDosingCharts();
    renderMaintenanceTimeline();
    if (state.charts.nitrateFocus) {
      renderFocusChart();
    }
    setActiveTab(state.activeTab);
  }

  function destroyChart(key) {
    if (state.charts[key]) {
      state.charts[key].destroy();
      state.charts[key] = null;
    }
  }

  function getNitrateSeries({ focus = false } = {}) {
    if (!state.data) {
      return { points: [] };
    }

    const densityLimit = focus ? Infinity : getDensityLimit('nitrate');
    const endDate = parseISO(state.data.period.end);
    const cutoff = endDate ? new Date(endDate) : null;
    if (cutoff) {
      cutoff.setDate(cutoff.getDate() - 29);
    }

    let items = state.data.nitrate.filter((entry) => {
      if (focus || !state.showLast30 || !cutoff) {
        return true;
      }
      const current = parseISO(entry.date);
      return current && current >= cutoff && current <= endDate;
    });

    if (!focus && Number.isFinite(densityLimit) && items.length > densityLimit) {
      items = items.slice(items.length - densityLimit);
    }

    if (state.groupMode === 'weekly') {
      items = groupNitrateByWeek(items);
    } else {
      items = items
        .map((entry) => {
          const parsed = parseISO(entry.date);
          const label = parsed ? dateFormatter.format(parsed) : entry.date;
          return {
            label,
            tooltip: `${label} · ${entry.ppm} ppm`,
            value: entry.ppm,
            marker: entry.wc ? entry.ppm : null,
            date: entry.date,
            wc: entry.wc
          };
        })
        .filter((item) => Number.isFinite(item.value));
    }

    if (focus && Number.isFinite(densityLimit) && items.length > densityLimit && state.groupMode === 'daily') {
      // Focus mode still respects density limit when daily data is extremely long to prevent crashes.
      items = items.slice(items.length - densityLimit * 2);
    }

    return { points: items };
  }

  function getDensityLimit(type) {
    const base = state.density;
    if (base === 'expanded') {
      return 48;
    }
    if (base === 'comfortable') {
      return type === 'nitrate' ? 18 : 16;
    }
    return type === 'nitrate' ? 10 : 12;
  }

  function groupNitrateByWeek(items) {
    const buckets = new Map();
    items.forEach((entry) => {
      const parsed = parseISO(entry.date);
      if (!parsed) {
        return;
      }
      const { year, week } = getIsoWeek(parsed);
      const key = `${year}-W${week}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          week,
          year,
          total: 0,
          count: 0,
          start: parsed,
          end: parsed,
          wc: Boolean(entry.wc)
        });
      }
      const bucket = buckets.get(key);
      bucket.total += entry.ppm || 0;
      bucket.count += Number.isFinite(entry.ppm) ? 1 : 0;
      bucket.start = bucket.start && bucket.start < parsed ? bucket.start : parsed;
      bucket.end = bucket.end && bucket.end > parsed ? bucket.end : parsed;
      bucket.wc = bucket.wc || Boolean(entry.wc);
    });

    const sorted = Array.from(buckets.values()).sort((a, b) => a.start - b.start);
    return sorted.map((bucket) => {
      const average = bucket.count ? Number.parseFloat((bucket.total / bucket.count).toFixed(1)) : 0;
      const rangeStart = maintenanceFormatter.format(bucket.start);
      const rangeEnd = maintenanceFormatter.format(bucket.end);
      const label = `Week ${bucket.week}`;
      return {
        label,
        tooltip: `${label} · ${rangeStart} – ${rangeEnd}`,
        value: average,
        marker: bucket.wc ? average : null,
        date: `${bucket.year}-W${bucket.week}`,
        wc: bucket.wc
      };
    });
  }

  function getIsoWeek(date) {
    const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(((copy - yearStart) / 86400000 + 1) / 7);
    return { year: copy.getUTCFullYear(), week: weekNumber };
  }

  function getLabelStep(count) {
    const width = typeof window !== 'undefined' ? window.innerWidth || 0 : 0;
    if (state.density === 'expanded') {
      return width < 480 ? 1 : 1;
    }
    if (state.density === 'comfortable') {
      return width <= 420 ? 2 : 1;
    }
    if (width <= 360) {
      return 3;
    }
    if (width <= 768) {
      return 2;
    }
    return count > 14 ? 2 : 1;
  }

  function getRollingAverage(values, windowSize) {
    if (!Array.isArray(values) || values.length === 0) {
      return [];
    }
    const size = Math.max(1, windowSize);
    return values.map((value, index) => {
      let sum = 0;
      let count = 0;
      for (let offset = 0; offset < size; offset += 1) {
        const target = index - offset;
        if (target < 0) {
          break;
        }
        const current = values[target];
        if (Number.isFinite(current)) {
          sum += current;
          count += 1;
        }
      }
      if (!count) {
        return null;
      }
      return Number.parseFloat((sum / count).toFixed(1));
    });
  }

  function renderNitrateChart() {
    const canvas = document.getElementById('nitrateChart');
    if (!canvas) {
      return;
    }
    const { points } = getNitrateSeries();
    if (!points.length) {
      destroyChart('nitrate');
      if (statusEl) {
        statusEl.textContent = 'No nitrate readings available for this range yet.';
      }
      return;
    }

    if (statusEl) {
      statusEl.textContent = '';
    }

    const ctx = canvas.getContext('2d');
    const datasets = createNitrateDatasets(points);
    const annotation = getNitrateAnnotation();
    const values = points.map((point) => point.value);
    const suggestedMax = getSuggestedMax(values);
    const options = getNitrateChartOptions({ annotation, suggestedMax, focus: false });

    if (!state.charts.nitrate) {
      state.charts.nitrate = new Chart(ctx, {
        type: 'line',
        data: {
          labels: points.map((point) => point.label),
          datasets
        },
        options
      });
      return;
    }

    const chart = state.charts.nitrate;
    chart.data.labels = points.map((point) => point.label);
    chart.data.datasets = datasets;
    chart.options = options;
    chart.config.options = options;
    chart.update();
  }

  function createNitrateDatasets(points, { focus = false } = {}) {
    const compact = isCompactViewport();
    const step = focus ? 1 : getLabelStep(points.length);
    const lineColor = focus ? '#38bdf8' : '#4cc9f0';
    const pointColor = focus ? '#0ea5e9' : '#22d3ee';
    const labelColor = lightenColor('#e0f2ff', 0.05, 1);
    const strokeColor = 'rgba(6, 12, 24, 0.92)';

    const dataset = {
      label: 'Nitrate',
      data: points.map((point) => point.value),
      pointLabels: points.map((point) => point.label),
      tooltips: points.map((point) => point.tooltip),
      borderColor: lineColor,
      backgroundColor: lineColor,
      borderWidth: focus ? 4 : 3.5,
      tension: 0.32,
      fill: false,
      spanGaps: true,
      clip: false,
      pointBackgroundColor: pointColor,
      pointHoverBackgroundColor: pointColor,
      pointBorderColor: '#061225',
      pointBorderWidth: 2,
      pointRadius: (context) => {
        const width = context?.chart?.width || 0;
        const base = width < 540 ? 6 : 5;
        return focus ? base + 1 : base;
      },
      pointHoverRadius: (context) => {
        const width = context?.chart?.width || 0;
        const base = width < 540 ? 8 : 7;
        return focus ? base + 1 : base;
      },
      pointHitRadius: 12,
      datalabels: {
        display: true,
        color: labelColor,
        align: (ctx) => (ctx.dataIndex % 2 === 0 ? 'end' : 'start'),
        anchor: (ctx) => (ctx.dataIndex % 2 === 0 ? 'end' : 'start'),
        offset: focus ? 16 : compact ? 18 : 20,
        clamp: false,
        clip: false,
        padding: { top: 4, bottom: 4, left: 6, right: 6 },
        textStrokeColor: strokeColor,
        textStrokeWidth: 3,
        font: {
          size: focus ? 12 : compact ? 10 : 11,
          weight: '600'
        },
        formatter(value, context) {
          const labels = context.dataset?.pointLabels || [];
          const label = labels[context.dataIndex];
          if (!label) {
            return '';
          }
          if (!focus && step > 1 && context.dataIndex % step !== 0) {
            return '';
          }
          const elements = context.meta?.data || [];
          const current = elements[context.dataIndex];
          const previous = elements[context.dataIndex - 1];
          if (!focus && previous && current) {
            const spacing = Math.abs(current.x - previous.x);
            const minSpacing = compact ? 28 : 34;
            if (spacing < minSpacing && context.dataIndex % 2 === 1) {
              return '';
            }
          }
          return label;
        }
      }
    };

    const markerDataset = {
      label: 'Water Change',
      data: points.map((point) => point.marker),
      type: 'scatter',
      pointBackgroundColor: '#fb923c',
      pointBorderColor: lightenColor('#fb923c', 0.2, 1),
      pointRadius: (context) => {
        const width = context?.chart?.width || 0;
        const base = width < 540 ? 6 : 5;
        return focus ? base + 1 : base;
      },
      pointHoverRadius: (context) => {
        const width = context?.chart?.width || 0;
        const base = width < 540 ? 8 : 7;
        return focus ? base + 1 : base;
      },
      pointBorderWidth: 2,
      pointHitRadius: 12,
      showLine: false,
      datalabels: {
        display: false
      }
    };

    const datasets = [dataset, markerDataset];

    if (focus) {
      const rolling = getRollingAverage(points.map((point) => point.value), 3);
      datasets.push({
        label: '3-pt avg',
        data: rolling,
        borderColor: 'rgba(129, 140, 248, 0.9)',
        borderWidth: 2,
        borderDash: [6, 6],
        pointRadius: 0,
        spanGaps: true,
        tension: 0.3,
        fill: false,
        datalabels: {
          display: false
        }
      });
    }

    return datasets;
  }

  function getNitrateAnnotation() {
    if (!window.ChartAnnotation) {
      return undefined;
    }
    return {
      annotations: {
        target: {
          type: 'line',
          yMin: 20,
          yMax: 20,
          borderColor: 'rgba(226, 232, 240, 0.35)',
          borderWidth: 1.5,
          borderDash: [6, 6],
          label: {
            content: '20 ppm guide',
            position: 'start',
            padding: 6,
            color: '#e2e8f0',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            borderColor: 'rgba(148, 163, 184, 0.42)',
            borderWidth: 1,
            font: {
              family: Chart.defaults?.font?.family || 'Inter, "Segoe UI", system-ui, sans-serif',
              size: 11,
              weight: '600'
            }
          }
        }
      }
    };
  }

  function getSuggestedMax(values) {
    if (!Array.isArray(values) || !values.length) {
      return 25;
    }
    const maxValue = values.reduce((acc, value) => {
      if (Number.isFinite(value) && value > acc) {
        return value;
      }
      return acc;
    }, 0);
    if (!Number.isFinite(maxValue)) {
      return 25;
    }
    const padded = Math.ceil((maxValue + 4) / 5) * 5;
    return Math.max(25, padded);
  }

  function getNitrateChartOptions({ annotation, suggestedMax, focus }) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: getAnimationOptions(),
      layout: {
        padding: {
          top: focus ? 40 : 32,
          bottom: focus ? 36 : 24,
          left: focus ? 24 : 18,
          right: focus ? 24 : 18
        }
      },
      interaction: {
        intersect: false,
        mode: 'nearest'
      },
      scales: {
        x: {
          ticks: {
            display: false
          },
          border: {
            display: false
          },
          grid: {
            color: 'rgba(120, 162, 226, 0.22)',
            lineWidth: 1.2,
            drawBorder: false,
            tickLength: 0
          }
        },
        y: {
          beginAtZero: true,
          suggestedMax,
          ticks: {
            count: 5,
            padding: 10,
            color: 'rgba(234, 240, 255, 0.9)',
            callback: (value) => `${Math.round(value)} ppm`
          },
          border: {
            display: false
          },
          grid: {
            color: 'rgba(113, 155, 214, 0.28)',
            lineWidth: 1.1,
            drawTicks: false
          }
        }
      },
      elements: {
        line: {
          borderCapStyle: 'round',
          borderJoinStyle: 'round'
        },
        point: {
          hoverBorderWidth: 2
        }
      },
      plugins: {
        annotation,
        legend: {
          display: false
        },
        tooltip: {
          intersect: false,
          mode: 'nearest',
          backgroundColor: 'rgba(9, 17, 32, 0.94)',
          borderColor: 'rgba(120, 196, 255, 0.35)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#f8fafc',
          displayColors: false,
          padding: focus ? 16 : 12,
          cornerRadius: 10,
          callbacks: {
            label(context) {
              const value = context.parsed?.y ?? context.parsed;
              if (!Number.isFinite(value)) {
                return '';
              }
              const dataset = context.dataset || {};
              const label = dataset?.tooltips ? dataset.tooltips[context.dataIndex] : null;
              if (typeof label === 'string') {
                return label;
              }
              const prefix = dataset?.label ? `${dataset.label}: ` : '';
              return `${prefix}${value} ppm`;
            }
          }
        },
        datalabels: {
          display: false
        },
        jdChartBackground: {
          color: '#101b33'
        }
      }
    };
  }

  function isCompactViewport() {
    if (typeof window === 'undefined') {
      return false;
    }
    const width = window.innerWidth || document.documentElement?.clientWidth || 0;
    return width <= 420;
  }

  function renderDosingCharts() {
    const thriveCanvas = document.getElementById('dosingThriveChart');
    const excelCanvas = document.getElementById('dosingExcelChart');
    const entries = getDosingSeries();
    if (!thriveCanvas || !excelCanvas) {
      return;
    }

    if (!entries.labels.length) {
      destroyChart('dosingThrive');
      destroyChart('dosingExcel');
      return;
    }

    const thriveConfig = createMiniBarConfig({
      canvas: thriveCanvas,
      chartKey: 'dosingThrive',
      label: 'Thrive pumps',
      values: entries.thrive,
      labels: entries.labels,
      color: 'rgba(34, 197, 94, 0.88)',
      hover: 'rgba(16, 185, 129, 0.95)'
    });

    const excelConfig = createMiniBarConfig({
      canvas: excelCanvas,
      chartKey: 'dosingExcel',
      label: 'Excel capfuls',
      values: entries.excel,
      labels: entries.labels,
      color: 'rgba(129, 140, 248, 0.9)',
      hover: 'rgba(99, 102, 241, 0.95)'
    });

    updateMiniChart(thriveConfig);
    updateMiniChart(excelConfig);
  }

  function getDosingSeries() {
    const items = state.data?.dosing || [];
    if (!items.length) {
      return { labels: [], thrive: [], excel: [] };
    }
    const limit = getDensityLimit('dosing');
    const normalized = state.groupMode === 'weekly' ? groupDosingByWeek(items) : items.slice();
    const trimmed = normalized.length > limit ? normalized.slice(normalized.length - limit) : normalized;
    const labels = trimmed.map((entry) => entry.label || entry.week || 'Week');
    const thrive = trimmed.map((entry) => {
      const value = Number.isFinite(entry.thrive) ? entry.thrive : Number.parseFloat(entry.thrive);
      return Number.isFinite(value) ? value : 0;
    });
    const excel = trimmed.map((entry) => {
      const value = Number.isFinite(entry.excel) ? entry.excel : Number.parseFloat(entry.excel);
      return Number.isFinite(value) ? value : 0;
    });
    return { labels, thrive, excel };
  }

  function groupDosingByWeek(items) {
    const map = new Map();
    items.forEach((entry, index) => {
      const key = entry.week || entry.label || `Week-${index}`;
      if (!map.has(key)) {
        map.set(key, {
          label: entry.label || entry.week || `Week ${index + 1}`,
          week: entry.week || key,
          thrive: 0,
          excel: 0,
          order: index
        });
      }
      const bucket = map.get(key);
      const thriveValue = Number.isFinite(entry.thrive) ? entry.thrive : parseFloat(entry.thrive) || 0;
      const excelValue = Number.isFinite(entry.excel) ? entry.excel : parseFloat(entry.excel) || 0;
      bucket.thrive += thriveValue;
      bucket.excel += excelValue;
    });
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }

  function createMiniBarConfig({ canvas, chartKey, label, values, labels, color, hover }) {
    return {
      canvas,
      chartKey,
      config: {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label,
              data: values,
              backgroundColor: color,
              hoverBackgroundColor: hover,
              borderRadius: 8,
              borderSkipped: false,
              maxBarThickness: 34
            }
          ]
        },
        options: getMiniBarOptions(labels)
      }
    };
  }

  function getMiniBarOptions(labels) {
    const dense = Array.isArray(labels) && labels.length > 6;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: getAnimationOptions(),
      layout: {
        padding: {
          top: 16,
          right: 12,
          bottom: 20,
          left: 12
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            display: !dense,
            color: 'rgba(214, 228, 255, 0.76)',
            font: {
              size: 11
            }
          },
          border: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(118, 156, 222, 0.22)',
            drawTicks: false
          },
          border: {
            display: false
          },
          ticks: {
            padding: 8,
            color: 'rgba(230, 240, 255, 0.85)',
            font: {
              size: 11
            }
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        datalabels: {
          display: true,
          color: 'rgba(234, 242, 255, 0.88)',
          align: 'end',
          anchor: 'end',
          offset: 6,
          font: {
            size: 11,
            weight: '600'
          },
          formatter(value, context) {
            if (!Number.isFinite(value)) {
              return '';
            }
            if (dense && context.dataIndex % 2 === 1) {
              return '';
            }
            return value;
          }
        },
        tooltip: {
          backgroundColor: 'rgba(8, 16, 32, 0.94)',
          borderColor: 'rgba(120, 196, 255, 0.3)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#f8fafc',
          displayColors: false,
          padding: 10
        },
        jdChartBackground: {
          color: '#0f1a33'
        }
      }
    };
  }

  function updateMiniChart({ canvas, chartKey, config }) {
    const ctx = canvas.getContext('2d');
    const existing = state.charts[chartKey];
    if (!existing) {
      state.charts[chartKey] = new Chart(ctx, config);
      return;
    }
    existing.data = config.data;
    existing.options = config.options;
    existing.config.data = config.data;
    existing.config.options = config.options;
    existing.update();
  }

  function renderMaintenanceTimeline() {
    const canvas = document.getElementById('maintenanceChart');
    if (!canvas) {
      return;
    }
    const status = dom.maintenanceStatus;
    const events = state.data?.maintenance || [];
    if (!events.length) {
      destroyChart('maintenance');
      if (status) {
        status.textContent = 'No maintenance events logged yet.';
      }
      return;
    }

    if (status) {
      status.textContent = '';
    }

    const series = events
      .map((entry) => {
        const date = parseISO(entry.date);
        if (!date) {
          return null;
        }
        return {
          x: date.getTime(),
          y: 0,
          type: entry.type,
          details: entry.details || '—',
          dateLabel: maintenanceFormatter.format(date)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.x - b.x);

    const options = getMaintenanceOptions(series);
    const data = {
      datasets: [
        {
          type: 'scatter',
          data: series,
          pointBackgroundColor: series.map((point) => getMaintenanceColor(point.type)),
          pointBorderColor: 'rgba(15, 23, 42, 0.9)',
          pointBorderWidth: 2,
          pointRadius: (context) => ((context?.chart?.width || 0) < 520 ? 6 : 5),
          pointHoverRadius: (context) => ((context?.chart?.width || 0) < 520 ? 9 : 8),
          datalabels: {
            display: true,
            align: 'top',
            anchor: 'end',
            offset: 12,
            color: 'rgba(228, 238, 255, 0.88)',
            backgroundColor: 'rgba(11, 22, 40, 0.88)',
            borderRadius: 999,
            padding: { top: 4, bottom: 4, left: 10, right: 10 },
            font: {
              size: 10,
              weight: '600'
            },
            formatter(value) {
              return value?.type || '';
            }
          }
        }
      ]
    };

    if (!state.charts.maintenance) {
      state.charts.maintenance = new Chart(canvas.getContext('2d'), {
        type: 'scatter',
        data,
        options
      });
      return;
    }

    const chart = state.charts.maintenance;
    chart.data = data;
    chart.options = options;
    chart.config.data = data;
    chart.config.options = options;
    chart.update();
  }

  function getMaintenanceOptions(series) {
    const minTime = series[0]?.x;
    const maxTime = series[series.length - 1]?.x;
    const padding = 1000 * 60 * 60 * 24 * 2;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: getAnimationOptions(),
      parsing: false,
      scales: {
        x: {
          type: 'linear',
          min: minTime - padding,
          max: maxTime + padding,
          grid: {
            color: 'rgba(108, 148, 214, 0.24)',
            drawTicks: false
          },
          ticks: {
            color: 'rgba(214, 228, 255, 0.7)',
            maxRotation: 0,
            autoSkip: true,
            callback(value) {
              if (!Number.isFinite(value)) {
                return '';
              }
              return dateFormatter.format(new Date(value));
            }
          },
          border: {
            display: false
          }
        },
        y: {
          display: false,
          min: -1,
          max: 1
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(8, 16, 32, 0.94)',
          borderColor: 'rgba(120, 196, 255, 0.3)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#f8fafc',
          padding: 12,
          callbacks: {
            title(context) {
              const point = context[0]?.raw;
              return point?.dateLabel || '';
            },
            label(context) {
              const point = context.raw;
              if (!point) {
                return '';
              }
              return `${point.type}: ${point.details}`;
            }
          }
        },
        jdChartBackground: {
          color: '#101b33'
        }
      }
    };
  }

  function getMaintenanceColor(type) {
    const normalized = String(type || '').toLowerCase();
    if (normalized.includes('trim')) {
      return 'rgba(248, 113, 113, 0.92)';
    }
    if (normalized.includes('filter')) {
      return 'rgba(129, 140, 248, 0.9)';
    }
    if (normalized.includes('dose') || normalized.includes('fert')) {
      return 'rgba(16, 185, 129, 0.92)';
    }
    return 'rgba(250, 204, 21, 0.9)';
  }

  function openFocusModal() {
    if (!dom.focusModal) {
      return;
    }
    focusReturnElement = document.activeElement;
    dom.focusModal.removeAttribute('hidden');
    document.body.classList.add('is-focus-open');
    renderFocusChart();
    const closeTrigger = dom.focusClose[0];
    if (closeTrigger) {
      closeTrigger.focus();
    }
  }

  function closeFocusModal() {
    if (!dom.focusModal) {
      return;
    }
    dom.focusModal.setAttribute('hidden', '');
    document.body.classList.remove('is-focus-open');
    destroyChart('nitrateFocus');
    if (focusReturnElement && typeof focusReturnElement.focus === 'function') {
      focusReturnElement.focus();
    }
    focusReturnElement = null;
  }

  function renderFocusChart() {
    const canvas = document.getElementById('nitrateFocusChart');
    if (!canvas) {
      return;
    }
    const { points } = getNitrateSeries({ focus: true });
    if (!points.length) {
      destroyChart('nitrateFocus');
      return;
    }
    const datasets = createNitrateDatasets(points, { focus: true });
    const values = points.map((point) => point.value);
    const options = getNitrateChartOptions({
      annotation: getNitrateAnnotation(),
      suggestedMax: getSuggestedMax(values),
      focus: true
    });

    if (!state.charts.nitrateFocus) {
      state.charts.nitrateFocus = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: points.map((point) => point.label),
          datasets
        },
        options
      });
      return;
    }

    const chart = state.charts.nitrateFocus;
    chart.data.labels = points.map((point) => point.label);
    chart.data.datasets = datasets;
    chart.options = options;
    chart.config.options = options;
    chart.update();
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
      renderDosingCharts();
    }
    if (target === 'maintenance') {
      renderMaintenanceTimeline();
    }
  }
})();
