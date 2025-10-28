import {
  fetchJournal,
  buildMonthIndex,
  sliceByMonth,
  groupWeeklyDosing,
  extractMaintenance
} from './journal-data.js';

const state = {
  entries: [],
  months: [],
  currentMonthIndex: 0,
  includeLast30: false,
  charts: {
    nitrate: null,
    dosing: null
  }
};

const dom = {
  rangeLabel: document.querySelector('[data-range-label]'),
  monthLabel: document.querySelector('[data-month-label]'),
  toggle: document.querySelector('[data-range-toggle]'),
  navPrev: document.querySelector('[data-nav="prev"]'),
  navNext: document.querySelector('[data-nav="next"]'),
  tabs: Array.from(document.querySelectorAll('.journal-dashboard__tab')),
  panels: Array.from(document.querySelectorAll('.journal-dashboard__panel')),
  error: document.querySelector('[data-dashboard-error]'),
  status: {
    nitrate: document.querySelector('[data-status="nitrate"]'),
    dosing: document.querySelector('[data-status="dosing"]'),
    maintenance: document.querySelector('[data-status="maintenance"]')
  },
  charts: {
    nitrate: document.querySelector('[data-chart="nitrate"]'),
    dosing: document.querySelector('[data-chart="dosing"]')
  },
  maintenanceList: document.querySelector('[data-maintenance-list]')
};

const CROSSHAIR_PLUGIN = {
  id: 'ttgVerticalCrosshair',
  afterDatasetsDraw(chart) {
    const { ctx, tooltip, chartArea } = chart;
    if (!tooltip || !tooltip.getActiveElements().length) {
      return;
    }
    const activeElement = tooltip.getActiveElements()[0];
    if (!activeElement) {
      return;
    }
    const { x } = chart.getDatasetMeta(activeElement.datasetIndex).data[activeElement.index];
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  }
};

function registerChartPlugins() {
  if (typeof window.Chart === 'undefined') {
    return false;
  }
  if (!window.__TTG_JOURNAL_DASHBOARD__) {
    window.Chart.register(CROSSHAIR_PLUGIN);
    window.__TTG_JOURNAL_DASHBOARD__ = true;
    window.Chart.defaults.color = 'rgba(226, 232, 240, 0.85)';
    window.Chart.defaults.font.family = 'Inter, "Segoe UI", system-ui, sans-serif';
  }
  return true;
}

function setStatus(key, message, visible = true) {
  const target = dom.status[key];
  if (!target) {
    return;
  }
  target.textContent = message;
  target.hidden = !visible;
}

function clearStatus(key) {
  const target = dom.status[key];
  if (target) {
    target.hidden = true;
  }
}

function setError(message) {
  if (!dom.error) {
    return;
  }
  dom.error.textContent = message;
  dom.error.hidden = !message;
}

function toggleChartContainer(key, visible) {
  const container = dom.charts[key];
  if (!container) {
    return;
  }
  container.hidden = !visible;
}

function formatRange(start, end) {
  if (!start || !end) {
    return '—';
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long' });
  const dayFormatter = new Intl.DateTimeFormat('en-US', { day: 'numeric' });
  const yearFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric' });

  if (sameMonth) {
    return `${monthFormatter.format(start)} ${dayFormatter.format(start)}–${dayFormatter.format(end)}, ${yearFormatter.format(end)}`;
  }

  const startText = `${monthFormatter.format(start)} ${dayFormatter.format(start)}, ${yearFormatter.format(start)}`;
  const endText = `${monthFormatter.format(end)} ${dayFormatter.format(end)}, ${yearFormatter.format(end)}`;
  return `${startText} – ${endText}`;
}

function formatTickLabel(date) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  return formatter.format(date);
}

function formatFullDate(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function destroyChart(key) {
  const instance = state.charts[key];
  if (instance) {
    instance.destroy();
    state.charts[key] = null;
  }
}

function updateNitrateChart(entries) {
  if (typeof window.Chart === 'undefined') {
    setStatus('nitrate', 'Charts unavailable (Chart.js not loaded).', true);
    toggleChartContainer('nitrate', false);
    destroyChart('nitrate');
    return;
  }

  const nitrateEntries = entries.filter((entry) => typeof entry.nitrate === 'number');
  if (!nitrateEntries.length) {
    destroyChart('nitrate');
    toggleChartContainer('nitrate', false);
    setStatus('nitrate', 'No nitrate readings recorded in this range yet.', true);
    return;
  }

  clearStatus('nitrate');
  toggleChartContainer('nitrate', true);

  const labels = nitrateEntries.map((entry) => formatTickLabel(entry.date));
  const values = nitrateEntries.map((entry) => entry.nitrate);
  const waterMarkers = nitrateEntries.map((entry) => (entry.waterChange ? entry.nitrate : null));
  const targetLine = nitrateEntries.map(() => 20);
  const maxValue = Math.max(...values, 24);
  const tickRotation = window.innerWidth < 620 ? 35 : 0;

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Nitrate (ppm)',
          data: values,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          borderWidth: 3,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#1d4ed8',
          fill: false
        },
        {
          label: 'Target: <20 ppm',
          data: targetLine,
          borderColor: 'rgba(250, 204, 21, 0.8)',
          borderDash: [6, 6],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false
        },
        {
          label: 'Water change',
          data: waterMarkers,
          type: 'line',
          borderWidth: 0,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#fb923c',
          pointBorderColor: '#0f172a',
          showLine: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title(context) {
              return context[0]?.label ?? '';
            },
            label(context) {
              if (context.dataset.label === 'Nitrate (ppm)') {
                return `Nitrate: ${context.parsed.y} ppm`;
              }
              if (context.dataset.label === 'Water change' && context.parsed.y !== null) {
                return 'Water change';
              }
              if (context.dataset.label === 'Target: <20 ppm') {
                return undefined;
              }
              return undefined;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(30, 58, 138, 0.22)'
          },
          ticks: {
            color: 'rgba(226, 232, 240, 0.88)',
            maxRotation: tickRotation,
            minRotation: tickRotation
          }
        },
        y: {
          beginAtZero: true,
          suggestedMax: Math.ceil(maxValue + 5),
          grid: {
            color: 'rgba(30, 64, 175, 0.2)'
          },
          ticks: {
            color: 'rgba(226, 232, 240, 0.88)'
          },
          title: {
            display: true,
            text: 'ppm',
            color: 'rgba(191, 219, 254, 0.85)'
          }
        }
      }
    }
  };

  if (!state.charts.nitrate) {
    state.charts.nitrate = new window.Chart(dom.charts.nitrate.querySelector('canvas'), config);
  } else {
    const chart = state.charts.nitrate;
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.data.datasets[1].data = targetLine;
    chart.data.datasets[2].data = waterMarkers;
    chart.options.scales.x.ticks.maxRotation = tickRotation;
    chart.options.scales.x.ticks.minRotation = tickRotation;
    chart.options.scales.y.suggestedMax = Math.ceil(maxValue + 5);
    chart.update();
  }
}

function updateDosingChart(entries, rangeStart, rangeEnd) {
  if (typeof window.Chart === 'undefined') {
    setStatus('dosing', 'Charts unavailable (Chart.js not loaded).', true);
    toggleChartContainer('dosing', false);
    destroyChart('dosing');
    return;
  }

  const weeks = groupWeeklyDosing(entries, rangeStart, rangeEnd);
  const hasData = weeks.some((week) => week.thrive > 0 || week.excel > 0);
  if (!hasData) {
    destroyChart('dosing');
    toggleChartContainer('dosing', false);
    setStatus('dosing', 'No dosing activity logged in this range.', true);
    return;
  }

  clearStatus('dosing');
  toggleChartContainer('dosing', true);

  const labels = weeks.map((week) => week.label);
  const thriveData = weeks.map((week) => week.thrive);
  const excelData = weeks.map((week) => week.excel);

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Thrive+ (pumps)',
          data: thriveData,
          backgroundColor: 'rgba(34, 197, 94, 0.75)',
          borderRadius: 6,
          barPercentage: 0.6
        },
        {
          label: 'Excel (capfuls eqv.)',
          data: excelData,
          backgroundColor: 'rgba(147, 51, 234, 0.75)',
          borderRadius: 6,
          barPercentage: 0.6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: false,
          ticks: {
            color: 'rgba(226, 232, 240, 0.88)',
            maxRotation: window.innerWidth < 620 ? 24 : 0,
            minRotation: window.innerWidth < 620 ? 24 : 0
          },
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(30, 64, 175, 0.2)'
          },
          ticks: {
            color: 'rgba(226, 232, 240, 0.88)'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: 'rgba(226, 232, 240, 0.9)'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label(context) {
              const unit = context.dataset.label.includes('Thrive') ? 'pumps' : 'capfuls eqv.';
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ${unit}`;
            }
          }
        }
      }
    }
  };

  if (!state.charts.dosing) {
    state.charts.dosing = new window.Chart(dom.charts.dosing.querySelector('canvas'), config);
  } else {
    const chart = state.charts.dosing;
    chart.data.labels = labels;
    chart.data.datasets[0].data = thriveData;
    chart.data.datasets[1].data = excelData;
    chart.update();
  }
}

function renderMaintenance(entries) {
  const items = extractMaintenance(entries);
  if (!items.length) {
    setStatus('maintenance', 'No maintenance notes recorded in this range.', true);
    dom.maintenanceList.innerHTML = '';
    dom.maintenanceList.hidden = true;
    return;
  }

  clearStatus('maintenance');
  dom.maintenanceList.hidden = false;
  dom.maintenanceList.innerHTML = items
    .map((item) => {
      const summary = item.summary || item.type;
      const details = item.details ? `<p class="journal-dashboard__maintenance-details">${item.details}</p>` : '';
      return `
        <li class="journal-dashboard__maintenance-item">
          <div class="journal-dashboard__maintenance-header">
            <time class="journal-dashboard__maintenance-date" datetime="${item.dateISO}">${formatFullDate(item.date)}</time>
            <span class="journal-dashboard__maintenance-type">${item.type}</span>
          </div>
          <p class="journal-dashboard__maintenance-summary">${summary}</p>
          ${details}
        </li>
      `;
    })
    .join('');
}

function updateRangeDisplay(monthInfo, rangeStart, rangeEnd) {
  if (dom.rangeLabel) {
    dom.rangeLabel.textContent = formatRange(rangeStart, rangeEnd);
  }
  if (dom.monthLabel) {
    dom.monthLabel.textContent = monthInfo?.label ?? '—';
  }
}

function renderActiveRange() {
  const month = state.months[state.currentMonthIndex];
  const { entries, rangeStart, rangeEnd } = sliceByMonth(state.entries, month, state.includeLast30);
  updateRangeDisplay(month, rangeStart, rangeEnd);
  updateNitrateChart(entries);
  updateDosingChart(entries, rangeStart, rangeEnd);
  renderMaintenance(entries);
}

function handleNav(direction) {
  if (direction === 'prev' && state.currentMonthIndex > 0) {
    state.currentMonthIndex -= 1;
  }
  if (direction === 'next' && state.currentMonthIndex < state.months.length - 1) {
    state.currentMonthIndex += 1;
  }
  updateNavControls();
  renderActiveRange();
}

function updateNavControls() {
  if (dom.navPrev) {
    dom.navPrev.disabled = state.currentMonthIndex === 0;
  }
  if (dom.navNext) {
    dom.navNext.disabled = state.currentMonthIndex >= state.months.length - 1;
  }
}

function handleToggle() {
  state.includeLast30 = !state.includeLast30;
  if (dom.toggle) {
    dom.toggle.setAttribute('aria-pressed', String(state.includeLast30));
  }
  renderActiveRange();
}

function setActiveTab(targetTab) {
  dom.tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === targetTab;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive) {
      tab.focus({ preventScroll: true });
    }
  });

  dom.panels.forEach((panel) => {
    const match = panel.id === `panel-${targetTab}`;
    panel.toggleAttribute('hidden', !match);
    panel.classList.toggle('is-active', match);
  });
}

function handleTabClick(event) {
  const button = event.currentTarget;
  if (!button || button.dataset.tab === undefined) {
    return;
  }
  setActiveTab(button.dataset.tab);
}

function handleTabKeydown(event) {
  const currentIndex = dom.tabs.indexOf(event.currentTarget);
  if (currentIndex === -1) {
    return;
  }
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    const nextIndex = (currentIndex + 1) % dom.tabs.length;
    setActiveTab(dom.tabs[nextIndex].dataset.tab);
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    const prevIndex = (currentIndex - 1 + dom.tabs.length) % dom.tabs.length;
    setActiveTab(dom.tabs[prevIndex].dataset.tab);
  }
}

async function init() {
  const chartReady = registerChartPlugins();
  setStatus('nitrate', chartReady ? 'Loading chart…' : 'Charts unavailable (Chart.js not loaded).', true);
  setStatus('dosing', chartReady ? 'Loading chart…' : 'Charts unavailable (Chart.js not loaded).', true);
  setStatus('maintenance', 'Loading entries…', true);

  const entries = await fetchJournal();
  if (!entries.length) {
    setError('No journal entries are available yet. Check back soon!');
    toggleChartContainer('nitrate', false);
    toggleChartContainer('dosing', false);
    return;
  }

  state.entries = entries;
  state.months = buildMonthIndex(entries);
  state.currentMonthIndex = state.months.length - 1;
  updateNavControls();
  if (dom.toggle) {
    dom.toggle.setAttribute('aria-pressed', 'false');
  }

  renderActiveRange();

  if (dom.navPrev) {
    dom.navPrev.addEventListener('click', () => handleNav('prev'));
  }
  if (dom.navNext) {
    dom.navNext.addEventListener('click', () => handleNav('next'));
  }
  if (dom.toggle) {
    dom.toggle.addEventListener('click', handleToggle);
  }

  dom.tabs.forEach((tab) => {
    tab.addEventListener('click', handleTabClick);
    tab.addEventListener('keydown', handleTabKeydown);
  });

  setActiveTab('nitrate');
  setError('');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init().catch((error) => {
    console.error('Failed to initialise journal dashboard', error);
    setError('Unable to initialise the dashboard. Please try again later.');
  });
}
