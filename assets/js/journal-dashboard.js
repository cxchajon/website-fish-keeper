(function () {
  if (!document?.body?.classList?.contains('page-journal-dashboard')) {
    return;
  }

  const root = document.getElementById('jdash');
  if (!root) {
    return;
  }

  const DAY_MS = 86_400_000;
  const fmtShort = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const fmtFull = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const fmtStat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const tabs = Array.from(root.querySelectorAll('.jdash__tab'));
  const panels = {
    nitrate: document.getElementById('panel-nitrate'),
    dosing: document.getElementById('panel-dosing'),
    maint: document.getElementById('panel-maint')
  };
  const statNodes = {
    nitrate: document.getElementById('jdash-stat-nitrate'),
    water: document.getElementById('jdash-stat-water'),
    maint: document.getElementById('jdash-stat-maint')
  };
  const canvases = {
    nitrate: document.getElementById('nitrateChart'),
    dosing: document.getElementById('dosingChart')
  };
  const maintList = document.getElementById('maintList');

  const state = {
    entries: [],
    charts: {
      nitrate: null,
      dosing: null
    }
  };

  const setStat = (key, text) => {
    const node = statNodes[key];
    if (node) {
      node.textContent = text;
    }
  };

  const clearMessages = panel => {
    panel?.querySelectorAll('.jdash__empty, .jdash__error').forEach(el => el.remove());
  };

  const ensureMessage = (panel, text, type) => {
    if (!panel) return;
    const cls = type === 'error' ? 'jdash__error' : 'jdash__empty';
    let card = panel.querySelector(`.${cls}`);
    if (!card) {
      card = document.createElement('div');
      card.className = `jdash__card ${cls}`;
      const note = panel.querySelector('.jdash__note');
      if (note) {
        panel.insertBefore(card, note);
      } else {
        panel.appendChild(card);
      }
    }
    card.textContent = text;
  };

  const persistTab = value => {
    try {
      localStorage.setItem('jdash.tab', value);
    } catch (err) {
      console.warn('Journal tab persistence unavailable', err);
    }
  };

  const restoreTab = () => {
    try {
      return localStorage.getItem('jdash.tab');
    } catch (err) {
      return null;
    }
  };

  const activate = (slug, focus) => {
    if (!panels[slug]) {
      return;
    }

    tabs.forEach((tab, index) => {
      const isActive = tab.dataset.tab === slug;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        tab.removeAttribute('tabindex');
        if (focus) {
          tab.focus();
        }
      } else {
        tab.setAttribute('tabindex', '-1');
      }
      if (isActive) {
        persistTab(slug);
      }
    });

    Object.entries(panels).forEach(([key, panel]) => {
      if (!panel) return;
      const match = key === slug;
      panel.classList.toggle('is-active', match);
      if (match) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    if (state.charts.nitrate && slug === 'nitrate') {
      state.charts.nitrate.resize();
    }
    if (state.charts.dosing && slug === 'dosing') {
      state.charts.dosing.resize();
    }

    if (window.dispatchEvent) {
      window.dispatchEvent(new Event('resize'));
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.dataset.tab, false));
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') {
        return;
      }
      event.preventDefault();
      let nextIndex = index;
      if (event.key === 'ArrowRight') {
        nextIndex = (index + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft') {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabs.length - 1;
      }
      const nextTab = tabs[nextIndex];
      if (nextTab) {
        activate(nextTab.dataset.tab, true);
      }
    });
  });

  const savedTab = restoreTab();
  if (savedTab && panels[savedTab]) {
    activate(savedTab, false);
  } else if (tabs.length) {
    activate(tabs[0].dataset.tab, false);
  }

  const splitSegments = value => {
    return (value || '')
      .split(/[\u2022\u2027\u00B7·\n]+/)
      .map(segment => segment.trim())
      .filter(Boolean);
  };

  const parseNumber = raw => {
    const num = Number(String(raw).replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(num) ? num : null;
  };

  const deriveNitrate = (row, segments) => {
    if (row.nitrate_ppm) {
      const parsed = parseNumber(row.nitrate_ppm);
      if (parsed !== null) {
        return parsed;
      }
    }
    for (const segment of segments) {
      if (!/nitrate/i.test(segment)) continue;
      const range = segment.match(/([0-9]+(?:\.[0-9]+)?)(?:\s*[\-–—]\s*([0-9]+(?:\.[0-9]+)?))?/i);
      if (range) {
        const first = parseNumber(range[1]);
        const second = parseNumber(range[2]);
        if (first !== null && second !== null) {
          return +(Math.round(((first + second) / 2) * 10) / 10);
        }
        if (first !== null) {
          return first;
        }
      }
      const single = segment.match(/(<=|≥|<=|>=|[<>≤≥])?\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (single) {
        const value = parseNumber(single[2]);
        if (value !== null) {
          return value;
        }
      }
    }
    return null;
  };

  const deriveDose = (segments, keywordPattern, extraPattern) => {
    let total = 0;
    for (const segment of segments) {
      if (!keywordPattern.test(segment)) {
        continue;
      }
      const numbers = segment.match(/[0-9]+(?:\.[0-9]+)?/g);
      if (numbers) {
        numbers.forEach(num => {
          const parsed = parseNumber(num);
          if (parsed !== null) {
            total += parsed;
          }
        });
      } else if (extraPattern && extraPattern.test(segment)) {
        total += 1;
      }
    }
    return total;
  };

  const normalize = rows => {
    const entries = [];
    rows.forEach(row => {
      if (!row || !row.date) return;
      const date = new Date(row.date + (row.time ? `T${row.time}` : ''));
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const segments = splitSegments(row.quick_facts);
      const nitrate = deriveNitrate(row, segments);
      const thrive = deriveDose(segments, /(thrive|fertilizer)/i);
      const excel = deriveDose(segments, /excel/i, /(spot dose|capful|cap\b)/i);
      const waterChange = segments.some(segment => /water change/i.test(segment));
      const maintenanceMatch = /maintenance/i.test(row.category || '') || segments.some(segment => /maintenance/i.test(segment));
      const category = row.category || '';
      const summary = segments.find(segment => /water change|maintenance|trim|filter|dosed|fed|nitrate/i.test(segment)) || row.quick_facts || row.ramble || category;
      entries.push({
        date,
        nitrate,
        thrive,
        excel,
        waterChange,
        isMaintenance: maintenanceMatch || waterChange,
        category,
        summary
      });
    });
    return entries.sort((a, b) => a.date - b.date);
  };

  const updateStats = entries => {
    if (!entries.length) {
      setStat('nitrate', 'No data yet');
      setStat('water', 'No changes logged');
      setStat('maint', 'No maintenance logged');
      return;
    }
    const newest = [...entries].sort((a, b) => b.date - a.date);
    const latestNitrate = newest.find(entry => Number.isFinite(entry.nitrate));
    if (latestNitrate) {
      const value = latestNitrate.nitrate % 1 === 0 ? latestNitrate.nitrate : latestNitrate.nitrate.toFixed(1);
      setStat('nitrate', `${value} ppm (${fmtStat.format(latestNitrate.date)})`);
    } else {
      setStat('nitrate', 'Not recorded yet');
    }

    const cutoff = Date.now() - 30 * DAY_MS;
    const changes = entries.filter(entry => entry.waterChange && entry.date.getTime() >= cutoff).length;
    if (changes > 0) {
      setStat('water', `${changes} ${changes === 1 ? 'change' : 'changes'}`);
    } else {
      setStat('water', 'None in 30 days');
    }

    const maintenance = newest.find(entry => entry.isMaintenance);
    if (maintenance) {
      const label = maintenance.category || 'Maintenance';
      setStat('maint', `${fmtStat.format(maintenance.date)} • ${label}`);
    } else {
      setStat('maint', 'No maintenance logged');
    }
  };

  const renderMaintenance = entries => {
    if (!maintList) {
      return;
    }
    maintList.innerHTML = '';
    const items = entries
      .filter(entry => entry.isMaintenance || entry.waterChange)
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'jdash__card jdash__empty';
      empty.textContent = 'No maintenance entries yet.';
      maintList.appendChild(empty);
      return;
    }

    items.forEach(entry => {
      const card = document.createElement('article');
      card.className = 'jdash__card';

      const title = document.createElement('strong');
      title.textContent = fmtStat.format(entry.date);
      card.appendChild(title);

      if (entry.category) {
        const meta = document.createElement('span');
        meta.className = 'jdash__meta';
        meta.textContent = entry.category;
        card.appendChild(meta);
      }

      if (entry.summary) {
        const summary = document.createElement('p');
        summary.className = 'jdash__summary';
        summary.textContent = entry.summary;
        card.appendChild(summary);
      }

      maintList.appendChild(card);
    });
  };

  const startOfWeek = date => {
    const clone = new Date(date);
    const day = clone.getDay();
    clone.setHours(0, 0, 0, 0);
    clone.setDate(clone.getDate() - day);
    return clone;
  };

  const buildCharts = entries => {
    const hasCanvasNitrate = canvases.nitrate instanceof HTMLCanvasElement;
    const hasCanvasDosing = canvases.dosing instanceof HTMLCanvasElement;

    if (!hasCanvasNitrate && !hasCanvasDosing) {
      return;
    }

    if (typeof window.Chart !== 'function') {
      ensureMessage(panels.nitrate, 'Charts unavailable (Chart.js not loaded).', 'error');
      ensureMessage(panels.dosing, 'Charts unavailable (Chart.js not loaded).', 'error');
      return;
    }

    const ChartLib = window.Chart;

    const annotationPlugin = window['chartjs-plugin-annotation'];
    if (annotationPlugin && typeof ChartLib.register === 'function') {
      ChartLib.register(annotationPlugin);
    }

    const crosshair = {
      id: 'jdash-crosshair',
      afterDatasetsDraw(chart) {
        const active = chart.getActiveElements?.()[0];
        if (!active) return;
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(148,163,184,0.35)';
        ctx.setLineDash([4, 4]);
        const x = active.element.x;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
      }
    };

    ChartLib.register(crosshair);

    const nitratePoints = entries
      .filter(entry => Number.isFinite(entry.nitrate))
      .map(entry => ({
        x: entry.date.getTime(),
        y: entry.nitrate,
        label: fmtFull.format(entry.date)
      }));

    const wcPoints = entries
      .filter(entry => entry.waterChange && Number.isFinite(entry.nitrate))
      .map(entry => ({
        x: entry.date.getTime(),
        y: entry.nitrate,
        label: fmtFull.format(entry.date)
      }));

    const weekMap = new Map();
    entries.forEach(entry => {
      if (!entry.thrive && !entry.excel) return;
      const start = startOfWeek(entry.date);
      const key = start.toISOString();
      const week = weekMap.get(key) || {
        start,
        label: `${fmtShort.format(start)} – ${fmtShort.format(new Date(start.getTime() + 6 * DAY_MS))}`,
        thrive: 0,
        excel: 0
      };
      week.thrive += entry.thrive || 0;
      week.excel += entry.excel || 0;
      weekMap.set(key, week);
    });
    const dosingRows = Array.from(weekMap.values()).sort((a, b) => a.start - b.start);

    if (hasCanvasNitrate) {
      clearMessages(panels.nitrate);
      if (state.charts.nitrate) {
        state.charts.nitrate.destroy();
        state.charts.nitrate = null;
      }
      if (!nitratePoints.length) {
        ensureMessage(panels.nitrate, 'No nitrate readings available yet.', 'empty');
      } else {
        state.charts.nitrate = new ChartLib(canvases.nitrate.getContext('2d'), {
          type: 'line',
          data: {
            datasets: [
              {
                label: 'Nitrate (ppm)',
                data: nitratePoints,
                tension: 0.3,
                borderColor: '#3b82f6',
                backgroundColor: '#3b82f6',
                borderWidth: 3,
                pointRadius: 4,
                pointHoverRadius: 6
              },
              {
                label: 'Water change day',
                type: 'scatter',
                data: wcPoints,
                pointRadius: 6,
                pointBackgroundColor: '#f59e0b',
                pointBorderColor: '#f59e0b'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            parsing: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
              x: {
                type: 'linear',
                ticks: {
                  callback(value) {
                    return fmtShort.format(new Date(value));
                  },
                  color: 'rgba(226,232,240,0.7)'
                },
                grid: { color: 'rgba(148,163,184,0.2)' }
              },
              y: {
                beginAtZero: true,
                suggestedMax: 25,
                title: { display: true, text: 'ppm' },
                ticks: { color: 'rgba(226,232,240,0.7)' },
                grid: { color: 'rgba(148,163,184,0.25)', borderDash: [4, 4] }
              }
            },
            plugins: {
              legend: { labels: { color: '#e2e8f0', usePointStyle: true } },
              tooltip: {
                callbacks: {
                  title(items) {
                    return items.map(item => fmtFull.format(new Date(item.parsed.x)));
                  }
                }
              },
              annotation: {
                annotations: {
                  safeBand: {
                    type: 'box',
                    yMin: 0,
                    yMax: 20,
                    backgroundColor: 'rgba(59,130,246,0.12)',
                    borderWidth: 0
                  }
                }
              }
            }
          }
        });
      }
    }

    if (hasCanvasDosing) {
      clearMessages(panels.dosing);
      if (state.charts.dosing) {
        state.charts.dosing.destroy();
        state.charts.dosing = null;
      }
      if (!dosingRows.length) {
        ensureMessage(panels.dosing, 'No dosing activity detected yet.', 'empty');
      } else {
        state.charts.dosing = new ChartLib(canvases.dosing.getContext('2d'), {
          type: 'bar',
          data: {
            labels: dosingRows.map(row => row.label),
            datasets: [
              {
                label: 'Thrive Plus (pumps)',
                data: dosingRows.map(row => row.thrive),
                backgroundColor: '#10b981',
                stack: 'dose'
              },
              {
                label: 'Seachem Excel (capfuls)',
                data: dosingRows.map(row => row.excel),
                backgroundColor: '#8b5cf6',
                stack: 'dose'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                ticks: {
                  maxRotation: 24,
                  minRotation: 24,
                  color: 'rgba(226,232,240,0.7)'
                },
                grid: { color: 'rgba(148,163,184,0.2)' }
              },
              y: {
                beginAtZero: true,
                ticks: { color: 'rgba(226,232,240,0.7)' },
                grid: { color: 'rgba(148,163,184,0.25)', borderDash: [4, 4] }
              }
            },
            plugins: {
              legend: { labels: { color: '#e2e8f0' } },
              tooltip: {
                callbacks: {
                  title(items) {
                    return items.length ? items[0].label : '';
                  }
                }
              }
            }
          }
        });
      }
    }
  };

  const handleData = rows => {
    state.entries = normalize(Array.isArray(rows) ? rows : []);
    updateStats(state.entries);
    renderMaintenance(state.entries);
    buildCharts(state.entries);
  };

  const loadJournal = () => {
    return fetch('/data/journal.json?v=1.0.0', { cache: 'no-store' }).then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load journal.json (${response.status})`);
      }
      return response.json();
    });
  };

  loadJournal()
    .then(handleData)
    .catch(error => {
      console.error('Journal dashboard failed to load', error);
      setStat('nitrate', 'Unavailable');
      setStat('water', 'Unavailable');
      setStat('maint', 'Unavailable');
      ensureMessage(panels.nitrate, 'Could not load /data/journal.json.', 'error');
      ensureMessage(panels.dosing, 'Could not load /data/journal.json.', 'error');
      if (maintList && !maintList.children.length) {
        const card = document.createElement('div');
        card.className = 'jdash__card jdash__error';
        card.textContent = 'Unable to load maintenance entries right now.';
        maintList.appendChild(card);
      }
    });

  window.JOURNAL = {
    setData(json) {
      handleData(json);
    }
  };
})();
