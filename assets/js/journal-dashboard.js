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

    const datasets = [
      {
        label: 'Nitrate',
        data: values,
        borderColor: '#7dd3fc',
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: 'rgba(15, 23, 42, 0.85)',
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.35
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
        scales: {
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
