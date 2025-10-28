const EXCEL_SPOT_EQUIVALENT = 0.5;
const TARGET_NO3 = 20;

function toDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDateLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

export {
  EXCEL_SPOT_EQUIVALENT,
  TARGET_NO3,
  prepareDashboardData
};
