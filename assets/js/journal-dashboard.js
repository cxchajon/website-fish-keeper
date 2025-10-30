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

    const ctx = canvas.getContext('2d');
    const datasets = createNitrateDatasets({ labels, values, markers });
    const annotation = getNitrateAnnotation();
    const suggestedMax = getSuggestedMax(values);
    const options = getNitrateChartOptions({ annotation, suggestedMax });

    if (!state.charts.nitrate) {
      state.charts.nitrate = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets
        },
        options
      });
      return;
    }

    const chart = state.charts.nitrate;
    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.options = options;
    chart.config.options = options;
    chart.update();
  }

  function createNitrateDatasets({ labels, values, markers }) {
    const compact = isCompactViewport();
    const skipDense = labels.length > (compact ? 11 : 16);
    const lineColor = '#38bdf8';
    const pointColor = '#0ea5e9';
    const labelColor = lightenColor('#e0f2ff', 0.12, 1);
    const strokeColor = 'rgba(7, 12, 24, 0.92)';

    return [
      {
        label: 'Nitrate',
        data: values,
        pointLabels: labels,
        borderColor: lineColor,
        backgroundColor: lineColor,
        borderWidth: 3,
        tension: 0.35,
        fill: false,
        spanGaps: true,
        clip: false,
        pointBackgroundColor: pointColor,
        pointHoverBackgroundColor: pointColor,
        pointBorderColor: '#0f172a',
        pointBorderWidth: 2,
        pointRadius: (context) => (context?.chart?.width || 0) < 540 ? 5 : 4,
        pointHoverRadius: (context) => (context?.chart?.width || 0) < 540 ? 7 : 6,
        pointHitRadius: 10,
        datalabels: {
          display: true,
          color: labelColor,
          textAlign: 'left',
          position: 'auto',
          alternate: true,
          offset: compact ? 16 : 20,
          xOffset: compact ? 6 : 10,
          minSpacing: compact ? 6 : 8,
          boundaryPadding: 12,
          shadowColor: 'rgba(6, 12, 24, 0.6)',
          shadowBlur: 6,
          textStrokeColor: strokeColor,
          textStrokeWidth: 3,
          font: {
            size: compact ? 10 : 11,
            weight: '600'
          },
          formatter(value, context) {
            const dataset = context.dataset || {};
            const label = Array.isArray(dataset.pointLabels) ? dataset.pointLabels[context.dataIndex] : null;
            if (!label) {
              return '';
            }
            if (skipDense && context.dataIndex % 2 === 1) {
              return '';
            }
            const elements = context.meta?.data || [];
            const current = elements[context.dataIndex];
            const previous = elements[context.dataIndex - 1];
            if (previous && current) {
              const spacing = Math.abs(current.x - previous.x);
              const threshold = compact ? 32 : 28;
              if (spacing < threshold && context.dataIndex % 2 === 1) {
                return '';
              }
            }
            return label;
          }
        }
      },
      {
        label: 'Water Change',
        data: markers,
        type: 'scatter',
        pointBackgroundColor: '#fb923c',
        pointBorderColor: lightenColor('#fb923c', 0.18, 1),
        pointRadius: (context) => (context?.chart?.width || 0) < 540 ? 5 : 4,
        pointHoverRadius: (context) => (context?.chart?.width || 0) < 540 ? 7 : 6,
        pointBorderWidth: 2,
        pointHitRadius: 10,
        showLine: false,
        datalabels: {
          display: false
        }
      }
    ];
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

  function getNitrateChartOptions({ annotation, suggestedMax }) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: getAnimationOptions(),
      layout: {
        padding: {
          top: 32,
          bottom: 24,
          left: 18,
          right: 18
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
            color: 'rgba(80, 118, 184, 0.32)',
            lineWidth: 1,
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
            color: 'rgba(226, 232, 240, 0.88)',
            callback: (value) => `${Math.round(value)} ppm`
          },
          border: {
            display: false
          },
          grid: {
            color: 'rgba(76, 112, 176, 0.25)',
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
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label(context) {
              const value = context.parsed?.y ?? context.parsed;
              if (!Number.isFinite(value)) {
                return '';
              }
              const label = context.dataset?.label ? `${context.dataset.label}: ` : '';
              return `${label}${value} ppm`;
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
    const labels = entries.map((entry) => entry.label);
    const thriveValues = entries.map((entry) => entry.thrive);
    const excelValues = entries.map((entry) => entry.excel);
    const datasets = [
      {
        label: 'Thrive Plus (pumps)',
        data: thriveValues,
        backgroundColor: 'rgba(52, 211, 153, 0.88)',
        hoverBackgroundColor: 'rgba(16, 185, 129, 0.95)',
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 36
      },
      {
        label: 'Seachem Excel (caps)',
        data: excelValues,
        backgroundColor: 'rgba(168, 85, 247, 0.86)',
        hoverBackgroundColor: 'rgba(147, 51, 234, 0.94)',
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 36
      }
    ];
    const options = getDosingChartOptions(labels);

    if (!state.charts.dosing) {
      state.charts.dosing = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets
        },
        options
      });
      return;
    }

    const chart = state.charts.dosing;
    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.options = options;
    chart.config.options = options;
    chart.update();
  }

  function getDosingChartOptions(labels) {
    const dense = Array.isArray(labels) && labels.length > 6;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: getAnimationOptions(),
      layout: {
        padding: {
          top: 24,
          right: 16,
          bottom: 24,
          left: 16
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            autoSkip: dense,
            maxRotation: 0,
            color: 'rgba(226, 232, 240, 0.78)',
            padding: 8,
            font: {
              size: 12
            }
          },
          border: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(76, 112, 176, 0.22)',
            drawTicks: false
          },
          border: {
            display: false
          },
          ticks: {
            padding: 10,
            color: 'rgba(226, 232, 240, 0.82)',
            callback: (value) => `${value}`
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 12,
            padding: 14,
            color: 'rgba(226, 232, 240, 0.88)',
            font: {
              size: 12,
              weight: '600'
            }
          }
        },
        tooltip: {
          intersect: false,
          mode: 'index',
          backgroundColor: 'rgba(9, 17, 32, 0.94)',
          borderColor: 'rgba(120, 196, 255, 0.35)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#f8fafc',
          displayColors: false,
          padding: 12
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
