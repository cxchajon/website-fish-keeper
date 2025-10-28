const root = document.querySelector('.journal-dashboard');

if (!root) {
  // Page not present.
} else {
  const panels = {
    nitrate: root.querySelector('#panel-nitrate'),
    dosing: root.querySelector('#panel-dosing'),
    maintenance: root.querySelector('#panel-maintenance')
  };

  const placeholders = {
    nitrate: panels.nitrate?.querySelector('.journal-dashboard__placeholder'),
    dosing: panels.dosing?.querySelector('.journal-dashboard__placeholder'),
    maintenance: panels.maintenance?.querySelector('.journal-dashboard__placeholder')
  };

  const timelineList = root.querySelector('#maintenanceList');
  const tabs = Array.from(root.querySelectorAll('.journal-dashboard__tab'));

  const detectedColumns = new Set();
  let ChartLib = null;
  const charts = { nitrate: null, dosing: null };
  const rendered = { nitrate: false, dosing: false, maintenance: false };
  let normalisedEntries = [];
  let weeklySummary = [];
  let maintenanceEntries = [];

  const addMessage = (panel, type, text) => {
    if (!panel) return null;
    let message = panel.querySelector(`.journal-dashboard__${type}`);
    if (!message) {
      message = document.createElement('p');
      message.className = `journal-dashboard__${type}`;
      panel.append(message);
    }
    message.textContent = text;
    return message;
  };

  const clearMessages = panel => {
    panel?.querySelectorAll('.journal-dashboard__empty, .journal-dashboard__error').forEach(node => node.remove());
  };

  const setPlaceholderState = (panelKey, state, text) => {
    const placeholder = placeholders[panelKey];
    if (!placeholder) return;
    if (text) {
      placeholder.textContent = text;
    }
    placeholder.dataset.state = state;
  };

  const showCdnError = () => {
    ['nitrate', 'dosing', 'maintenance'].forEach(key => {
      const panel = panels[key];
      if (!panel) return;
      setPlaceholderState(key, 'loaded');
      clearMessages(panel);
      addMessage(panel, 'error', 'Charts unavailable (Chart.js not loaded).');
    });
  };

  const normaliseKey = key => String(key ?? '').trim().replace(/[\s_\-]+/g, '').toLowerCase();

  const parseCsv = text => {
    const rows = [];
    let field = '';
    let insideQuotes = false;
    let currentRow = [];

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"') {
        const next = text[i + 1];
        if (insideQuotes && next === '"') {
          field += '"';
          i += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
        continue;
      }

      if (char === ',' && !insideQuotes) {
        currentRow.push(field);
        field = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (char === '\r' && text[i + 1] === '\n') {
          i += 1;
        }
        currentRow.push(field);
        rows.push(currentRow);
        currentRow = [];
        field = '';
        continue;
      }

      field += char;
    }

    if (field !== '' || currentRow.length) {
      currentRow.push(field);
      rows.push(currentRow);
    }

    return rows;
  };

  const parseNumber = value => {
    if (value == null) return null;
    const text = String(value).trim();
    if (!text) return null;
    const rangeMatch = text.replace(/ppm/gi, '').match(/(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?/);
    if (rangeMatch) {
      const first = Number(rangeMatch[1]);
      const second = rangeMatch[2] ? Number(rangeMatch[2]) : first;
      if (Number.isFinite(first) && Number.isFinite(second)) {
        return Number(((first + second) / 2).toFixed(2));
      }
    }
    const cleaned = Number(text.replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(cleaned) ? cleaned : null;
  };

  const splitSegments = value =>
    String(value ?? '')
      .split(/[\u2022\u2027\u00B7•·]+/)
      .map(segment => segment.replace(/[.;]+$/, '').trim())
      .filter(Boolean);

  const extractThriveFromSegments = segments => {
    let total = 0;
    segments.forEach(segment => {
      if (!/(thrive|fertiliz|nilocg)/i.test(segment)) return;
      const matches = segment.matchAll(/(\d+(?:\.\d+)?)(?=\s*(?:pump|pumps))/gi);
      for (const match of matches) {
        const value = Number(match[1]);
        if (Number.isFinite(value)) {
          total += value;
        }
      }
    });
    return total;
  };

  const extractExcelFromSegments = segments => {
    let total = 0;
    segments.forEach(segment => {
      if (!/excel/i.test(segment)) return;
      const matches = segment.matchAll(/(\d+(?:\.\d+)?)(?=\s*(?:cap|caps|capful|capfuls|ml))/gi);
      for (const match of matches) {
        const value = Number(match[1]);
        if (Number.isFinite(value)) {
          total += value;
        }
      }
    });
    return total;
  };

  const extractNitrate = (rawValue, quickFacts, ramble) => {
    const direct = parseNumber(rawValue);
    if (direct != null) return direct;
    const combined = `${quickFacts || ''} ${ramble || ''}`;
    const match = combined.match(/nitrate[^\d]*(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*ppm/i);
    if (!match) return null;
    const first = Number(match[1]);
    const second = match[2] ? Number(match[2]) : first;
    if (Number.isFinite(first) && Number.isFinite(second)) {
      return Number(((first + second) / 2).toFixed(2));
    }
    return null;
  };

  const hasWaterChangeLanguage = value => /water\s*change|\bwc\b/i.test(String(value ?? ''));
  const maintenanceKeywordPattern = /(trim|clean|scrape|wipe|vacuum|filter|maint|brush|polish|replant|spot\s*dose)/i;

  const parseBoolean = value => {
    if (typeof value === 'boolean') return value;
    const text = String(value ?? '').trim().toLowerCase();
    if (!text) return false;
    return ['true', '1', 'yes', 'y', 't', '✓'].includes(text);
  };

  const parseDate = raw => {
    const now = new Date();
    const currentYear = now.getFullYear();
    if (!raw) return null;
    const text = String(raw).trim();
    if (!text) return null;

    let date;
    const iso = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (iso) {
      const [, y, m, d] = iso.map(Number);
      date = new Date(y, m - 1, d);
    } else {
      const short = text.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
      if (short) {
        let [, m, d, y] = short;
        const month = Number(m);
        const day = Number(d);
        let year = y ? Number(y.length === 2 ? `20${y}` : y) : currentYear;
        date = new Date(year, month - 1, day);
      } else {
        const guess = new Date(text);
        if (!Number.isNaN(guess)) {
          date = guess;
        }
      }
    }

    if (!date || Number.isNaN(date.getTime())) return null;

    if (date.getFullYear() < currentYear - 2) {
      date.setFullYear(currentYear);
    }

    if (date.getTime() - now.getTime() > 45 * 86400000) {
      date.setFullYear(date.getFullYear() - 1);
    }

    return date;
  };

  const loadCsv = async () => {
    const response = await fetch('/data/journal.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error(`CSV request failed: ${response.status}`);
    const text = await response.text();
    const rows = parseCsv(text).filter(row => row.some(cell => cell && cell.trim())) ;
    if (!rows.length) return [];
    const headers = rows.shift();
    const columnIndex = {};

    headers.forEach((header, index) => {
      const normalised = normaliseKey(header);
      if (!normalised) return;
      if (['date'].includes(normalised) && columnIndex.date == null) {
        columnIndex.date = index;
        detectedColumns.add(header.trim() || 'date');
      }
      if (['nitrate', 'nitrateppm', 'nitratelevel', 'nitrateppmbefore', 'nitrates'].includes(normalised) && columnIndex.nitrate == null) {
        columnIndex.nitrate = index;
        detectedColumns.add(header.trim() || 'nitrate');
      }
      if (['thrive', 'thrivepumps', 'thriveplus', 'nilocgthriveplus', 'fertpumps', 'thrivepump'].includes(normalised) && columnIndex.thrive == null) {
        columnIndex.thrive = index;
        detectedColumns.add(header.trim() || 'thrive');
      }
      if (['excel', 'excelcaps', 'excelcap', 'seachemexcel', 'excelcapfuls', 'excelml'].includes(normalised) && columnIndex.excel == null) {
        columnIndex.excel = index;
        detectedColumns.add(header.trim() || 'excel');
      }
      if (['waterchange', 'wc', 'waterchangewc', 'waterchangeflag'].includes(normalised) && columnIndex.waterChange == null) {
        columnIndex.waterChange = index;
        detectedColumns.add(header.trim() || 'water_change');
      }
    });

    return rows
      .map(row => {
        const record = headers.reduce((acc, header, index) => {
          acc[header] = row[index];
          return acc;
        }, {});
        return {
          date: columnIndex.date != null ? row[columnIndex.date] : record.date ?? record.Date,
          nitrate: columnIndex.nitrate != null ? row[columnIndex.nitrate] : record.nitrate ?? record.nitrate_ppm,
          thrive: columnIndex.thrive != null ? row[columnIndex.thrive] : record.thrive ?? record.thrive_pumps,
          excel: columnIndex.excel != null ? row[columnIndex.excel] : record.excel ?? record.excel_caps,
          wc: columnIndex.waterChange != null ? row[columnIndex.waterChange] : record.water_change ?? record.wc,
          quickFacts: record.quick_facts ?? record.quickFacts,
          ramble: record.ramble,
          category: record.category,
          tags: record.tags
        };
      })
      .filter(item => item.date);
  };

  const loadJson = async () => {
    const response = await fetch('/data/journal.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`JSON request failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  };

  const normaliseEntries = rawEntries => {
    const entries = [];

    rawEntries.forEach(item => {
      const date = parseDate(item.date);
      if (!date) return;
      const label = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
      const quickFacts = item.quickFacts ?? item.quick_facts ?? '';
      const ramble = item.ramble ?? '';
      const segments = splitSegments(quickFacts);

      const nitrate = extractNitrate(item.nitrate ?? item.nitrate_ppm ?? item['nitrate (ppm)'], quickFacts, ramble);
      const thriveColValue = parseNumber(item.thrive ?? item.thrive_pumps);
      const excelColValue = parseNumber(item.excel ?? item.excel_caps ?? item.excel_capfuls);
      const thriveFromSegments = extractThriveFromSegments(segments);
      const excelFromSegments = extractExcelFromSegments(segments);
      const thrive = Number.isFinite(thriveColValue) ? thriveColValue : thriveFromSegments;
      const excel = Number.isFinite(excelColValue) ? excelColValue : excelFromSegments;
      const wcFlag =
        parseBoolean(item.wc ?? item.water_change ?? item.waterchange) ||
        hasWaterChangeLanguage(quickFacts) ||
        hasWaterChangeLanguage(item.category) ||
        hasWaterChangeLanguage(item.tags) ||
        parseBoolean(item.wc_flag);

      const maintenanceNotes = segments.filter(segment => maintenanceKeywordPattern.test(segment));
      const isMaintenance = wcFlag || /maint/i.test(item.category ?? '') || maintenanceNotes.length > 0;

      entries.push({
        date,
        label,
        nitrate: nitrate ?? null,
        thrive: Number.isFinite(thrive) ? Number(thrive.toFixed(2)) : 0,
        excel: Number.isFinite(excel) ? Number(excel.toFixed(2)) : 0,
        wc: Boolean(wcFlag),
        maintenanceNotes,
        quickFacts,
        ramble,
        category: item.category ?? '',
        isMaintenance
      });
    });

    entries.sort((a, b) => a.date - b.date);
    return entries;
  };

  const formatDateLong = date =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);

  const weekKey = date => {
    const cloned = new Date(date.getTime());
    const day = cloned.getDay();
    const diff = (day + 6) % 7;
    cloned.setDate(cloned.getDate() - diff);
    cloned.setHours(0, 0, 0, 0);
    return cloned;
  };

  const formatRangeLabel = (start, end) => {
    if (start.getMonth() === end.getMonth()) {
      const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(start);
      return `${month} ${start.getDate()}–${end.getDate()}`;
    }
    const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start);
    const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(end);
    return `${startLabel} – ${endLabel}`;
  };

  const buildWeeklySummary = entries => {
    const groups = new Map();

    entries.forEach(entry => {
      const start = weekKey(entry.date);
      const key = start.getTime();
      if (!groups.has(key)) {
        const end = new Date(start.getTime());
        end.setDate(end.getDate() + 6);
        groups.set(key, {
          start,
          end,
          thrive: 0,
          excel: 0
        });
      }
      const group = groups.get(key);
      group.thrive += entry.thrive || 0;
      group.excel += entry.excel || 0;
    });

    return Array.from(groups.values())
      .sort((a, b) => a.start - b.start)
      .map(group => ({
        label: formatRangeLabel(group.start, group.end),
        thrive: Number(group.thrive.toFixed(2)),
        excel: Number(group.excel.toFixed(2))
      }));
  };

  const buildMaintenanceEntries = entries =>
    entries
      .filter(entry => entry.isMaintenance)
      .map(entry => ({
        date: entry.date,
        label: entry.wc ? 'Water change' : entry.category || 'Maintenance',
        notes: entry.maintenanceNotes.length
          ? entry.maintenanceNotes
          : entry.quickFacts
              .split(/[.;]+/)
              .map(segment => segment.trim())
              .filter(Boolean)
              .slice(0, 3)
      }));

  const renderMaintenance = () => {
    if (rendered.maintenance) return;
    setPlaceholderState('maintenance', 'loaded');
    clearMessages(panels.maintenance);

    if (!maintenanceEntries.length) {
      addMessage(panels.maintenance, 'empty', 'No journal entries found yet.');
      rendered.maintenance = true;
      return;
    }

    if (timelineList) {
      timelineList.removeAttribute('hidden');
      timelineList.innerHTML = '';
      maintenanceEntries.forEach(entry => {
        const item = document.createElement('li');
        item.className = 'journal-dashboard__timeline-item';

        const date = document.createElement('p');
        date.className = 'journal-dashboard__timeline-date';
        date.textContent = formatDateLong(entry.date);

        const label = document.createElement('p');
        label.className = 'journal-dashboard__timeline-label';
        label.textContent = entry.label;

        const notes = document.createElement('ul');
        notes.className = 'journal-dashboard__timeline-notes';
        entry.notes.forEach(noteText => {
          const noteItem = document.createElement('li');
          noteItem.textContent = noteText;
          notes.append(noteItem);
        });

        item.append(date, label, notes);
        timelineList.append(item);
      });
    }

    rendered.maintenance = true;
  };

  const loadChartLibrary = async () => {
    if (ChartLib) return ChartLib;
    try {
      ({ Chart: ChartLib } = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.esm.js'));
    } catch (esmError) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        ChartLib = window.Chart;
      } catch (umdError) {
        console.error('Chart.js failed to load', esmError, umdError);
        return null;
      }
    }
    return ChartLib;
  };

  const registerPlugins = Chart => {
    if (registerPlugins.done) return;
    const targetLinePlugin = {
      id: 'targetLine',
      defaults: {
        value: 20,
        label: 'Target: <20 ppm',
        color: 'rgba(96, 165, 250, 0.6)',
        lineWidth: 1,
        dash: [6, 6]
      },
      afterDraw(chart, args, opts) {
        const yScale = chart.scales.y;
        if (!yScale) return;
        const y = yScale.getPixelForValue(opts.value);
        if (!Number.isFinite(y)) return;
        const { left, right } = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.setLineDash(opts.dash);
        ctx.strokeStyle = opts.color;
        ctx.lineWidth = opts.lineWidth;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.95)';
        ctx.font = '11px "Inter", "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(opts.label, right - 8, y - 6);
        ctx.restore();
      }
    };

    const hoverLinePlugin = {
      id: 'hoverLine',
      afterDatasetsDraw(chart) {
        const tooltip = chart.tooltip;
        const active = tooltip?.getActiveElements?.() ?? [];
        if (!active.length) return;
        const { element } = active[0];
        if (!element) return;
        const { x } = element;
        const { top, bottom } = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, bottom);
        ctx.lineTo(x, top);
        ctx.stroke();
        ctx.restore();
      }
    };

    Chart.register(targetLinePlugin, hoverLinePlugin);
    registerPlugins.done = true;
  };

  const createNitrateChart = Chart => {
    if (rendered.nitrate) return;
    const canvas = root.querySelector('#nitrateChart');
    if (!canvas || !normalisedEntries.length) {
      setPlaceholderState('nitrate', 'loaded');
      clearMessages(panels.nitrate);
      addMessage(panels.nitrate, 'empty', 'No journal entries found yet.');
      rendered.nitrate = true;
      return;
    }

    setPlaceholderState('nitrate', 'loaded');
    clearMessages(panels.nitrate);

    const labels = normalisedEntries.map(entry => entry.label);
    const data = normalisedEntries.map(entry => entry.nitrate);
    const pointColors = normalisedEntries.map(entry => (entry.wc ? '#fb923c' : '#38bdf8'));
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const ticksRotation = mediaQuery.matches ? 0 : 32;

    charts.nitrate = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Nitrate (ppm)',
            data,
            borderColor: '#38bdf8',
            borderWidth: 2,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.35,
            fill: false,
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            displayColors: false,
            callbacks: {
              label(context) {
                const entry = normalisedEntries[context.dataIndex];
                const nitrateValue = context.parsed.y;
                const labelParts = [`${context.dataset.label}: ${nitrateValue ?? 'n/a'} ppm`];
                if (entry?.wc) {
                  labelParts.push('Water-change day');
                }
                return labelParts;
              }
            }
          },
          targetLine: { value: 20 }
        },
        scales: {
          x: {
            type: 'category',
            grid: { display: false },
            ticks: {
              color: 'rgba(148, 163, 184, 0.9)',
              maxRotation: ticksRotation,
              minRotation: ticksRotation,
              font: { size: 11 },
              autoSkip: mediaQuery.matches
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(30, 41, 59, 0.8)' },
            ticks: {
              color: 'rgba(148, 163, 184, 0.9)',
              font: { size: 11 }
            },
            title: {
              display: true,
              text: 'ppm',
              color: 'rgba(148, 163, 184, 0.9)',
              font: { size: 11, weight: '600' }
            }
          }
        }
      }
    });

    mediaQuery.addEventListener('change', event => {
      const rotation = event.matches ? 0 : 32;
      charts.nitrate.options.scales.x.ticks.maxRotation = rotation;
      charts.nitrate.options.scales.x.ticks.minRotation = rotation;
      charts.nitrate.options.scales.x.ticks.autoSkip = event.matches;
      charts.nitrate.update();
    });

    rendered.nitrate = true;
  };

  const createDosingChart = Chart => {
    if (rendered.dosing) return;
    const canvas = root.querySelector('#dosingChart');
    if (!canvas || !weeklySummary.length) {
      setPlaceholderState('dosing', 'loaded');
      clearMessages(panels.dosing);
      addMessage(panels.dosing, 'empty', 'No journal entries found yet.');
      rendered.dosing = true;
      return;
    }

    setPlaceholderState('dosing', 'loaded');
    clearMessages(panels.dosing);

    const labels = weeklySummary.map(group => group.label);
    const thriveData = weeklySummary.map(group => group.thrive);
    const excelData = weeklySummary.map(group => group.excel);
    const mediaQuery = window.matchMedia('(min-width: 768px)');

    charts.dosing = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Thrive+',
            data: thriveData,
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            borderRadius: { topLeft: 6, topRight: 6 }
          },
          {
            label: 'Excel',
            data: excelData,
            backgroundColor: 'rgba(168, 85, 247, 0.8)',
            borderRadius: { topLeft: 6, topRight: 6 }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: 'rgba(226, 232, 240, 0.9)',
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed.y ?? 0;
                return `${context.dataset.label}: ${value} total`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: 'rgba(148, 163, 184, 0.9)',
              font: { size: 11 },
              maxRotation: mediaQuery.matches ? 0 : 20,
              minRotation: mediaQuery.matches ? 0 : 20,
              autoSkip: mediaQuery.matches
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(30, 41, 59, 0.85)' },
            ticks: {
              color: 'rgba(148, 163, 184, 0.9)',
              font: { size: 11 }
            },
            title: {
              display: true,
              text: 'Total doses',
              color: 'rgba(148, 163, 184, 0.9)',
              font: { size: 11, weight: '600' }
            }
          }
        }
      }
    });

    mediaQuery.addEventListener('change', event => {
      const rotation = event.matches ? 0 : 20;
      charts.dosing.options.scales.x.ticks.maxRotation = rotation;
      charts.dosing.options.scales.x.ticks.minRotation = rotation;
      charts.dosing.options.scales.x.ticks.autoSkip = event.matches;
      charts.dosing.update();
    });

    rendered.dosing = true;
  };

  const showPanel = panelKey => {
    tabs.forEach(tab => {
      const isActive = tab.dataset.panel === panelKey;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });

    Object.entries(panels).forEach(([key, panel]) => {
      if (!panel) return;
      const isActive = key === panelKey;
      panel.classList.toggle('is-active', isActive);
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    if (panelKey === 'nitrate') {
      createNitrateChart(ChartLib);
    } else if (panelKey === 'dosing') {
      createDosingChart(ChartLib);
    } else if (panelKey === 'maintenance') {
      renderMaintenance();
    }
  };

  const initialiseTabs = () => {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.classList.contains('is-active')) return;
        showPanel(tab.dataset.panel);
      });
    });
  };

  const loadData = async () => {
    try {
      const csvEntries = await loadCsv();
      if (csvEntries.length) {
        return csvEntries;
      }
    } catch (error) {
      console.warn('CSV load failed, falling back to JSON', error);
    }

    try {
      const jsonEntries = await loadJson();
      if (jsonEntries.length) {
        return jsonEntries;
      }
    } catch (error) {
      console.error('JSON load failed', error);
    }

    return [];
  };

  const initialise = async () => {
    const Chart = await loadChartLibrary();
    if (!Chart) {
      showCdnError();
      return;
    }
    ChartLib = Chart;
    registerPlugins(Chart);

    const rawEntries = await loadData();
    if (detectedColumns.size) {
      window.__journalDetectedColumns = Array.from(detectedColumns);
    }

    if (!rawEntries.length) {
      ['nitrate', 'dosing', 'maintenance'].forEach(key => {
        const panel = panels[key];
        if (!panel) return;
        setPlaceholderState(key, 'loaded');
        clearMessages(panel);
        addMessage(panel, 'empty', 'No journal entries found yet.');
      });
      return;
    }

    normalisedEntries = normaliseEntries(rawEntries);
    weeklySummary = buildWeeklySummary(normalisedEntries);
    maintenanceEntries = buildMaintenanceEntries(normalisedEntries);

    initialiseTabs();
    createNitrateChart(Chart);

    window.addEventListener('orientationchange', () => {
      Object.values(charts).forEach(instance => instance?.resize());
    });
  };

  initialise();
}
