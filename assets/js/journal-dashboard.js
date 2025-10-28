const root = document.querySelector('.journal-dashboard');

if (root) {
  (async () => {
    const panels = {
      nitrate: root.querySelector('#nitrate-panel'),
      dosing: root.querySelector('#dosing-panel'),
      maint: root.querySelector('#maint-panel')
    };

    const tabs = Array.from(root.querySelectorAll('.journal-dashboard__tab'));
    const loadingClass = 'journal-dashboard__hidden';

    const hideLoading = panel => {
      const loader = panel?.querySelector('.journal-dashboard__loading');
      if (loader) {
        loader.classList.add(loadingClass);
        loader.setAttribute('aria-hidden', 'true');
      }
    };

    const ensureMessage = (panel, text, type = 'empty') => {
      if (!panel) return;
      let message = panel.querySelector(`.journal-dashboard__${type}`);
      if (!message) {
        message = document.createElement('p');
        message.className = `journal-dashboard__${type}`;
        const note = panel.querySelector('.journal-dashboard__note');
        if (note) {
          note.before(message);
        } else {
          panel.append(message);
        }
      }
      message.textContent = text;
    };

    const clearMessages = panel => {
      panel?.querySelectorAll('.journal-dashboard__empty, .journal-dashboard__error').forEach(el => el.remove());
    };

    const showChartUnavailable = () => {
      Object.values(panels).forEach(panel => {
        if (!panel) return;
        panel.innerHTML = '<p class="journal-dashboard__error">Charts unavailable (Chart.js not loaded).</p>';
      });
    };

    let Chart;
    try {
      ({ Chart } = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.esm.js'));
    } catch (esmError) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        Chart = window.Chart;
      } catch (umdError) {
        showChartUnavailable();
        console.error('Chart.js failed to load', esmError, umdError);
        return;
      }
    }

    if (!Chart) {
      showChartUnavailable();
      console.error('Chart.js is unavailable');
      return;
    }

    const DAY_MS = 86_400_000;
    const now = new Date();
    const currentYear = now.getFullYear();
    const detectedColumns = new Set();

    const normaliseKey = key => key.replace(/[\s_-]+/g, '').toLowerCase();

    const splitSegments = value =>
      String(value ?? '')
        .split(/[\u2022\u2027\u00B7•·]+/)
        .map(segment => segment.trim())
        .filter(Boolean);

    const maintenanceKeywords = /(water change|trim|clean|scrape|filter|vacuum|maint|glass|wipe)/i;
    const waterChangeKeywords = /(water change|\bwc\b)/i;

    const dedupe = items => {
      const unique = [];
      items.forEach(item => {
        if (!item) return;
        const lower = item.toLowerCase();
        if (!unique.some(existing => existing.toLowerCase() === lower)) {
          unique.push(item);
        }
      });
      return unique;
    };

    const buildMaintenanceNotes = (categoryText, initialWc, quickFactsText, extras, flaggedMaintenance) => {
      const quickSegments = splitSegments(quickFactsText);
      const categoryIsMaintenance = /maint/i.test(categoryText || '');
      let wcFlag = initialWc;
      if (!wcFlag && quickSegments.some(segment => waterChangeKeywords.test(segment))) {
        wcFlag = true;
      }
      if (!wcFlag && waterChangeKeywords.test(categoryText || '')) {
        wcFlag = true;
      }
      const hasMaintenanceKeyword = quickSegments.some(segment => maintenanceKeywords.test(segment));
      const isMaintenance =
        wcFlag || categoryIsMaintenance || hasMaintenanceKeyword || flaggedMaintenance || extras.length > 0;
      if (!isMaintenance) {
        return { wc: wcFlag, notes: [] };
      }

      const includeFullQuickFacts = wcFlag || categoryIsMaintenance;
      const quickFactNotes = includeFullQuickFacts
        ? quickSegments
        : quickSegments.filter(segment => maintenanceKeywords.test(segment));
      const combined = dedupe([...quickFactNotes, ...extras]);
      return { wc: wcFlag, notes: combined };
    };

    const parseBoolean = value => {
      if (value == null) return false;
      const text = String(value).trim().toLowerCase();
      if (!text) return false;
      return ['true', 'yes', 'y', '1', '✓', 'done'].includes(text);
    };

    const parseNumber = value => {
      if (value == null) return null;
      const text = String(value).trim();
      if (!text) return null;
      const numeric = Number(text.replace(/[^0-9.+-]/g, ''));
      return Number.isFinite(numeric) ? numeric : null;
    };

    const titleCase = value =>
      value
        .split(/[\s_\-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    const coerceDate = raw => {
      if (!raw) return null;
      const text = String(raw).trim();
      if (!text) return null;

      let date;
      const isoMatch = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
      if (isoMatch) {
        const [, y, m, d] = isoMatch.map(Number);
        date = new Date(y, m - 1, d);
      } else {
        const shortMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
        if (shortMatch) {
          let [, m, d, y] = shortMatch;
          const month = Number(m);
          const day = Number(d);
          let year;
          if (y) {
            year = Number(y.length === 2 ? `20${y}` : y);
          } else {
            year = currentYear;
          }
          date = new Date(year, month - 1, day);
        } else {
          const hasYear = /\b\d{4}\b/.test(text);
          const seedYear = currentYear;
          date = new Date(hasYear ? text : `${text} ${seedYear}`);
          if (Number.isNaN(date.getTime()) && !hasYear) {
            date = new Date(`${text} ${seedYear - 1}`);
          }
        }
      }

      if (!date || Number.isNaN(date.getTime())) {
        return null;
      }

      if (date.getFullYear() < currentYear - 2) {
        date.setFullYear(currentYear);
      }

      if (date - now > 45 * DAY_MS) {
        date.setFullYear(date.getFullYear() - 1);
      }

      return date;
    };

    const parseCsv = text => {
      const rows = [];
      let current = '';
      let inQuotes = false;
      const pushValue = (row, value) => {
        row.push(value.trim());
      };
      const pushRow = row => {
        if (row.length > 0) {
          rows.push(row);
        }
      };

      let row = [];
      for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (char === '"') {
          const next = text[i + 1];
          if (inQuotes && next === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          pushValue(row, current);
          current = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
          if (char === '\r' && text[i + 1] === '\n') {
            i += 1;
          }
          pushValue(row, current);
          pushRow(row);
          row = [];
          current = '';
        } else {
          current += char;
        }
      }

      if (current.length || row.length) {
        pushValue(row, current);
        pushRow(row);
      }

      return rows;
    };

    const normaliseRows = rawRows => {
      if (!rawRows.length) return [];
      const headers = rawRows[0].map(value => ({
        raw: value,
        key: normaliseKey(value)
      }));
      const dataRows = rawRows.slice(1);

      const findColumn = aliases =>
        headers.findIndex(header => aliases.some(alias => header.key === normaliseKey(alias)));

      const colIndex = {
        date: findColumn(['date', 'entrydate', 'logged', 'logdate']),
        nitrate: findColumn(['nitrate', 'nitrateppm', 'no3', 'nitrate(ppm)']),
        thrive: findColumn(['thrive', 'thriveplus', 'thrive_pumps', 'thrivepumps']),
        excel: findColumn(['excel', 'excelcaps', 'excel_dose', 'seachemexcel']),
        wc: findColumn(['waterchange', 'water_change', 'wc', 'waterchanges']),
        category: findColumn(['category']),
        quickfacts: findColumn(['quickfacts', 'quick_facts'])
      };

      Object.entries(colIndex).forEach(([key, index]) => {
        if (index >= 0) {
          detectedColumns.add(key);
        }
      });

      const knownKeys = new Set(Object.values(colIndex).filter(i => i >= 0).map(i => headers[i].key));

      return dataRows
        .map(columns => {
          const getValue = index => (index >= 0 ? columns[index] ?? '' : '');
          const date = coerceDate(getValue(colIndex.date));
          if (!date) {
            return null;
          }

          const nitrate = parseNumber(getValue(colIndex.nitrate));
          const thrive = parseNumber(getValue(colIndex.thrive));
          const excel = parseNumber(getValue(colIndex.excel));
          let wc = parseBoolean(getValue(colIndex.wc));
          const categoryText = getValue(colIndex.category);
          const quickFactsText = getValue(colIndex.quickfacts);

          const extras = [];
          let flaggedMaintenance = false;
          headers.forEach((header, headerIndex) => {
            if (knownKeys.has(header.key)) return;
            const rawValue = columns[headerIndex];
            if (rawValue == null) return;
            const trimmed = String(rawValue).trim();
            if (!trimmed) return;
            if (parseBoolean(trimmed) && trimmed.length <= 5) {
              extras.push(titleCase(header.raw));
              flaggedMaintenance = true;
            } else if (maintenanceKeywords.test(trimmed)) {
              extras.push(`${titleCase(header.raw)}: ${trimmed}`);
              flaggedMaintenance = true;
            }
          });

          const maintenance = buildMaintenanceNotes(categoryText, wc, quickFactsText, extras, flaggedMaintenance);
          wc = maintenance.wc;

          return {
            date,
            nitrate: nitrate ?? null,
            thrive: thrive ?? null,
            excel: excel ?? null,
            wc,
            notes: maintenance.notes,
            category: categoryText?.trim() || ''
          };
        })
        .filter(Boolean);
    };

    const fetchJournalData = async () => {
      try {
        const response = await fetch('/data/journal.csv', {
          cache: 'no-store',
          headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' }
        });
        if (!response.ok) {
          throw new Error(`CSV request failed with status ${response.status}`);
        }
        const text = await response.text();
        const rows = parseCsv(text);
        const entries = normaliseRows(rows);
        if (entries.length) {
          return entries;
        }
        throw new Error('CSV contained no usable rows');
      } catch (csvError) {
        try {
          const jsonResponse = await fetch('/data/journal.json', { cache: 'no-store' });
          if (!jsonResponse.ok) {
            throw new Error(`JSON request failed with status ${jsonResponse.status}`);
          }
          const jsonData = await jsonResponse.json();
          if (!Array.isArray(jsonData)) {
            throw new Error('JSON data malformed');
          }
          detectedColumns.add('json');
          return jsonData
            .map(entry => {
              const date = coerceDate(entry.date || entry.logged || entry.logDate);
              if (!date) return null;
              const nitrate = parseNumber(entry.nitrate ?? entry.nitrate_ppm ?? entry.no3);
              const thrive = parseNumber(entry.thrive ?? entry.thrive_plus ?? entry.thrive_pumps);
              const excel = parseNumber(entry.excel ?? entry.excel_caps ?? entry.excel_dose);
              let wc = parseBoolean(entry.water_change ?? entry.wc);
              const categoryText = entry.category || entry.type || '';
              const quickFactsText = entry.quick_facts || entry.quickfacts || '';

              const extras = [];
              let flaggedMaintenance = false;
              Object.entries(entry).forEach(([key, value]) => {
                if (
                  [
                    'date',
                    'logged',
                    'logDate',
                    'nitrate',
                    'nitrate_ppm',
                    'no3',
                    'thrive',
                    'thrive_plus',
                    'thrive_pumps',
                    'excel',
                    'excel_caps',
                    'excel_dose',
                    'water_change',
                    'wc',
                    'category',
                    'quick_facts',
                    'quickfacts',
                    'time',
                    'ramble',
                    'notes',
                    'tags',
                    'media'
                  ].includes(key)
                ) {
                  return;
                }
                if (value == null || value === '') return;
                const text = String(value).trim();
                if (!text) return;
                if (parseBoolean(text) && text.length <= 5) {
                  extras.push(titleCase(key));
                  flaggedMaintenance = true;
                } else if (maintenanceKeywords.test(text)) {
                  extras.push(`${titleCase(key)}: ${text}`);
                  flaggedMaintenance = true;
                }
              });

              const maintenance = buildMaintenanceNotes(categoryText, wc, quickFactsText, extras, flaggedMaintenance);
              wc = maintenance.wc;

              return {
                date,
                nitrate: nitrate ?? null,
                thrive: thrive ?? null,
                excel: excel ?? null,
                wc,
                notes: maintenance.notes,
                category: categoryText?.trim() || ''
              };
            })
            .filter(Boolean);
        } catch (jsonError) {
          console.error('Failed to load journal data', csvError, jsonError);
          return [];
        }
      }
    };

    const entries = await fetchJournalData();
    if (!entries.length) {
      Object.values(panels).forEach(panel => {
        if (!panel) return;
        hideLoading(panel);
        clearMessages(panel);
        ensureMessage(panel, 'No journal entries found yet.', 'empty');
      });
      return;
    }

    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    const nitrateEntries = entries.filter(entry => entry.nitrate !== null);
    const dosingEntries = entries.filter(entry => entry.thrive !== null || entry.excel !== null);

    if (!nitrateEntries.length) {
      const panel = panels.nitrate;
      hideLoading(panel);
      clearMessages(panel);
      ensureMessage(panel, 'Nitrate readings are not available yet.', 'empty');
    }

    if (!dosingEntries.some(entry => (entry.thrive ?? 0) || (entry.excel ?? 0))) {
      const tab = tabs.find(button => button.dataset.panel === 'dosing');
      if (tab) {
        tab.classList.add('journal-dashboard__hidden');
        tab.setAttribute('aria-hidden', 'true');
        tab.setAttribute('tabindex', '-1');
      }
      const panel = panels.dosing;
      panel?.classList.add('journal-dashboard__hidden');
      panel?.setAttribute('hidden', '');
      hideLoading(panel);
      clearMessages(panel);
      ensureMessage(panel, 'Dosing data is not available in the current journal export.', 'empty');
    }

    const maintenanceEntries = entries.filter(entry => entry.wc || (entry.notes && entry.notes.length));

    const shortDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit' });
    const longDateFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const formatWeekRange = (start, end) => {
      const startLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(start);
      const endLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(end);
      return `${startLabel}–${endLabel}`;
    };

    const startOfWeek = date => {
      const clone = new Date(date);
      const day = clone.getDay();
      const diff = (day + 6) % 7; // Monday start
      clone.setDate(clone.getDate() - diff);
      clone.setHours(0, 0, 0, 0);
      return clone;
    };

    const groupWeeklyTotals = data => {
      const totals = new Map();
      data.forEach(entry => {
        if (entry.thrive == null && entry.excel == null) return;
        const thriveAmount = entry.thrive ?? 0;
        const excelAmount = entry.excel ?? 0;
        if (!thriveAmount && !excelAmount) return;
        const start = startOfWeek(entry.date);
        const key = start.getTime();
        const bucket = totals.get(key) || {
          start,
          end: new Date(start.getTime() + 6 * DAY_MS),
          thrive: 0,
          excel: 0
        };
        bucket.thrive += thriveAmount;
        bucket.excel += excelAmount;
        totals.set(key, bucket);
      });
      return Array.from(totals.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
    };

    const responsiveTicksPlugin = {
      id: 'responsiveTicks',
      beforeLayout: chart => {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const xScale = chart.options.scales?.x;
        if (xScale) {
          xScale.ticks = xScale.ticks || {};
          xScale.ticks.autoSkip = !isMobile;
          xScale.ticks.maxRotation = isMobile ? 32 : 0;
          xScale.ticks.minRotation = isMobile ? 32 : 0;
        }
      }
    };

    const hoverLinePlugin = {
      id: 'hoverLine',
      afterDatasetsDraw: chart => {
        const active = chart.tooltip?.getActiveElements();
        if (!active || !active.length) return;
        const { ctx, chartArea } = chart;
        const x = active[0]?.element?.x;
        if (!x) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
      }
    };

    const referenceLinePlugin = {
      id: 'referenceLine',
      afterDatasetsDraw: chart => {
        const targetValue = 20;
        const yScale = chart.scales?.y;
        if (!yScale) return;
        const y = yScale.getPixelForValue(targetValue);
        if (!Number.isFinite(y)) return;
        const { ctx, chartArea } = chart;
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
        ctx.restore();
      }
    };

    const state = {
      charts: {
        nitrate: null,
        dosing: null
      },
      initialised: {
        nitrate: false,
        dosing: false,
        maint: false
      }
    };

    const initNitrateChart = () => {
      if (state.initialised.nitrate || !panels.nitrate || !nitrateEntries.length) {
        state.initialised.nitrate = true;
        hideLoading(panels.nitrate);
        return;
      }
      const labels = nitrateEntries.map(entry => shortDateFormatter.format(entry.date));
      const data = nitrateEntries.map(entry => entry.nitrate);
      const pointColors = nitrateEntries.map(entry => (entry.wc ? '#f97316' : '#3b82f6'));

      hideLoading(panels.nitrate);
      clearMessages(panels.nitrate);

      const context = root.querySelector('#nitrateChart');
      state.charts.nitrate = new Chart(context, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Nitrate (ppm)',
              data,
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.18)',
              fill: false,
              tension: 0.25,
              borderWidth: 2,
              pointBackgroundColor: pointColors,
              pointBorderColor: pointColors,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointHitRadius: 14
            }
          ]
        },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              grid: {
                display: true,
                color: 'rgba(71, 85, 105, 0.35)'
              },
              ticks: {
                color: 'rgba(226, 232, 240, 0.9)',
                font: { size: 11 }
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                display: true,
                color: 'rgba(71, 85, 105, 0.35)'
              },
              ticks: {
                color: 'rgba(226, 232, 240, 0.9)',
                font: { size: 12 }
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: context => {
                  const index = context.dataIndex;
                  const entry = nitrateEntries[index];
                  let label = `Nitrate: ${context.formattedValue} ppm`;
                  if (entry?.wc) {
                    label += ' • Water change';
                  }
                  return label;
                },
                footer: context => {
                  const index = context[0]?.dataIndex;
                  if (index == null) return '';
                  return longDateFormatter.format(nitrateEntries[index].date);
                }
              }
            }
          }
        },
        plugins: [responsiveTicksPlugin, hoverLinePlugin, referenceLinePlugin]
      });

      state.initialised.nitrate = true;
    };

    const initDosingChart = () => {
      if (state.initialised.dosing || !panels.dosing) {
        state.initialised.dosing = true;
        return;
      }

      const weekly = groupWeeklyTotals(entries);
      if (!weekly.length) {
        hideLoading(panels.dosing);
        clearMessages(panels.dosing);
        ensureMessage(panels.dosing, 'Dosing totals are not available for the selected period.', 'empty');
        state.initialised.dosing = true;
        return;
      }

      const labels = weekly.map(range => formatWeekRange(range.start, range.end));
      const thriveData = weekly.map(range => Number(range.thrive.toFixed(2)));
      const excelData = weekly.map(range => Number(range.excel.toFixed(2)));

      hideLoading(panels.dosing);
      clearMessages(panels.dosing);

      const context = root.querySelector('#dosingChart');
      state.charts.dosing = new Chart(context, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Thrive Plus (pumps)',
              data: thriveData,
              backgroundColor: 'rgba(34, 197, 94, 0.7)',
              borderColor: 'rgba(34, 197, 94, 1)',
              borderWidth: 1,
              borderRadius: { topLeft: 6, topRight: 6 },
              borderSkipped: false
            },
            {
              label: 'Seachem Excel (caps)',
              data: excelData,
              backgroundColor: 'rgba(168, 85, 247, 0.7)',
              borderColor: 'rgba(168, 85, 247, 1)',
              borderWidth: 1,
              borderRadius: { topLeft: 6, topRight: 6 },
              borderSkipped: false
            }
          ]
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              stacked: false,
              grid: {
                display: true,
                color: 'rgba(71, 85, 105, 0.3)'
              },
              ticks: {
                color: 'rgba(226, 232, 240, 0.9)',
                font: { size: 11 }
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(71, 85, 105, 0.3)'
              },
              ticks: {
                color: 'rgba(226, 232, 240, 0.9)',
                font: { size: 12 }
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: 'rgba(226, 232, 240, 0.95)',
                usePointStyle: true
              }
            },
            tooltip: {
              callbacks: {
                label: context => `${context.dataset.label}: ${context.formattedValue}`
              }
            }
          }
        },
        plugins: [responsiveTicksPlugin, hoverLinePlugin]
      });

      state.initialised.dosing = true;
    };

    const initMaintenance = () => {
      if (state.initialised.maint || !panels.maint) {
        state.initialised.maint = true;
        return;
      }
      hideLoading(panels.maint);
      const list = panels.maint.querySelector('#maintenanceList');
      if (!maintenanceEntries.length) {
        ensureMessage(panels.maint, 'No maintenance entries logged yet.', 'empty');
        state.initialised.maint = true;
        return;
      }

      list.innerHTML = '';
      maintenanceEntries
        .slice()
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .forEach(entry => {
          const item = document.createElement('li');
          item.className = 'journal-dashboard__timeline-item';
          const date = document.createElement('span');
          date.className = 'journal-dashboard__timeline-date';
          date.textContent = longDateFormatter.format(entry.date);

          const title = document.createElement('p');
          title.className = 'journal-dashboard__timeline-label';
          title.textContent = entry.wc ? 'Water change' : entry.category || 'Maintenance';

          item.append(date, title);

          const notes = [];
          if (entry.notes?.length) {
            notes.push(...entry.notes);
          }
          if (entry.wc && !entry.notes?.length) {
            notes.push('Performed full or partial water change');
          }

          if (notes.length) {
            const noteList = document.createElement('ul');
            noteList.className = 'journal-dashboard__timeline-notes';
            notes.forEach(note => {
              const noteItem = document.createElement('li');
              noteItem.textContent = note;
              noteList.append(noteItem);
            });
            item.append(noteList);
          }

          list.append(item);
        });

      state.initialised.maint = true;
    };

    const getVisibleTabs = () => tabs.filter(tab => !tab.classList.contains('journal-dashboard__hidden'));

    const activateTab = (slug, focus = false) => {
      const visibleTabs = getVisibleTabs();
      visibleTabs.forEach((tab, index) => {
        const isActive = tab.dataset.panel === slug;
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

      if (slug === 'nitrate') {
        initNitrateChart();
        state.charts.nitrate?.resize();
      } else if (slug === 'dosing') {
        initDosingChart();
        state.charts.dosing?.resize();
      } else if (slug === 'maint') {
        initMaintenance();
      }
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.classList.contains('journal-dashboard__hidden')) return;
        activateTab(tab.dataset.panel);
      });
      tab.addEventListener('keydown', event => {
        const allowed = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
        if (!allowed.includes(event.key)) return;
        const visibleTabs = getVisibleTabs();
        const currentIndex = visibleTabs.indexOf(tab);
        if (currentIndex === -1) return;
        event.preventDefault();
        let nextIndex = currentIndex;
        if (event.key === 'ArrowRight') {
          nextIndex = (currentIndex + 1) % visibleTabs.length;
        } else if (event.key === 'ArrowLeft') {
          nextIndex = (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = visibleTabs.length - 1;
        }
        const nextTab = visibleTabs[nextIndex];
        if (nextTab) {
          activateTab(nextTab.dataset.panel, true);
        }
      });
    });

    initNitrateChart();
    activateTab(getVisibleTabs()[0]?.dataset.panel || 'maint');

    window.addEventListener('orientationchange', () => {
      if (state.charts.nitrate) {
        state.charts.nitrate.resize();
      }
      if (state.charts.dosing) {
        state.charts.dosing.resize();
      }
    });
  })();
}
