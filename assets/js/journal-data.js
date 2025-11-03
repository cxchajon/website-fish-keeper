const CSV_URL = '/data/journal.csv';
const JSON_URL = '/data/journal.json';

function resolveField(source, keys) {
  if (!source) {
    return '';
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] != null) {
      return String(source[key]);
    }
  }
  return '';
}

function parseCSV(text) {
  const rows = [];
  let field = '';
  let row = [];
  let insideQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (insideQuote) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          insideQuote = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      insideQuote = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const [header, ...body] = rows;
  return body
    .filter((columns) => columns.some((value) => value && value.trim() !== ''))
    .map((columns) => {
      const item = {};
      header.forEach((key, index) => {
        const normalisedKey = (key ?? '').trim();
        item[normalisedKey] = columns[index] ?? '';
      });
      return item;
    });
}

function safeNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const numeric = Number(trimmed.replace(/[^0-9.+-]/gu, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseNitrateFromText(text) {
  if (!text) {
    return null;
  }
  const normalised = text.replace(/[–—]/gu, '-');
  const lower = normalised.toLowerCase();
  const markerIndex = lower.indexOf('nitrate');
  if (markerIndex === -1) {
    return null;
  }
  const snippet = normalised.slice(markerIndex, markerIndex + 160);

  const ppmNumber = snippet.match(/(\d+(?:\.\d+)?)\s*ppm/iu);
  if (ppmNumber) {
    return Number(ppmNumber[1]);
  }

  const rangeMatch = snippet.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/iu);
  if (rangeMatch) {
    return Number(rangeMatch[1]);
  }

  const inequalityMatch = snippet.match(/(?:<=|≤|under|less than)\s*(\d+(?:\.\d+)?)/iu);
  if (inequalityMatch) {
    return Number(inequalityMatch[1]);
  }

  const approxMatch = snippet.match(/~\s*(\d+(?:\.\d+)?)/iu);
  if (approxMatch) {
    return Number(approxMatch[1]);
  }

  const directNumber = snippet.match(/(\d+(?:\.\d+)?)/u);
  if (directNumber) {
    return Number(directNumber[1]);
  }

  return null;
}

function toDateObject(dateISO) {
  if (!dateISO) {
    return null;
  }
  const [yearStr, monthStr, dayStr] = dateISO.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10) - 1;
  const day = Number.parseInt(dayStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(year, month, day);
}

function detectWaterChange(text, tags) {
  if (text && /water\s*change/iu.test(text)) {
    return true;
  }
  return tags.some((tag) => tag.includes('water')); 
}

function parseTags(rawTags) {
  if (!rawTags) {
    return [];
  }
  return rawTags
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);
}

function parseDosingFromText(text) {
  if (!text) {
    return { thrivePumps: 0, excelTotal: 0 };
  }
  const lower = text.toLowerCase();
  const pumpPattern = /(\d+(?:\.\d+)?)\s*(?:pump|pumps)/gu;
  let thrivePumps = 0;
  let pumpMatch;
  while ((pumpMatch = pumpPattern.exec(lower)) !== null) {
    thrivePumps += Number(pumpMatch[1]);
  }

  const capPattern = /(\d+(?:\.\d+)?)\s*(?:cap(?:ful)?(?:s)?)/gu;
  let excelCaps = 0;
  let capMatch;
  while ((capMatch = capPattern.exec(lower)) !== null) {
    excelCaps += Number(capMatch[1]);
  }

  const spotDosePattern = /spot[-\s]?dose(?:d)?/gu;
  const spotHits = lower.match(spotDosePattern);
  const spotTotal = spotHits ? spotHits.length * 0.5 : 0;

  if (/capful\s*\+\s*spot/iu.test(lower)) {
    // Capture patterns like "capful + spot" where "spot dose" may be missing.
    excelCaps += 0.5;
  }

  if (/spot\s*dose\s*\+\s*1\s*cap/iu.test(lower)) {
    // Already accounted for in regex above but keep to avoid double counting.
  }

  const excelTotal = excelCaps + spotTotal;
  return { thrivePumps, excelTotal };
}

function determineMaintenanceType(text, tags, category) {
  const source = text.toLowerCase();
  const patterns = [
    { test: /water\s*change/iu, label: 'Water change' },
    { test: /trim|prune|cut back/iu, label: 'Plant trim' },
    { test: /glass|wipe|scraper/iu, label: 'Glass clean' },
    { test: /filter|sump/iu, label: 'Filter service' },
    { test: /vac|siphon/iu, label: 'Gravel vac' }
  ];
  for (const { test, label } of patterns) {
    if (test.test(source)) {
      return label;
    }
  }

  if (tags.includes('cleaning')) {
    return 'Cleaning';
  }
  if (tags.includes('maintenance')) {
    return 'Maintenance';
  }
  if (/maintenance/iu.test(category)) {
    return 'Maintenance';
  }
  return 'Upkeep';
}

function normaliseEntries(rawEntries) {
  return rawEntries
    .map((row) => {
      const dateISO = (row.date ?? '').trim();
      const date = toDateObject(dateISO);
      if (!date) {
        return null;
      }

      const quickFacts = resolveField(row, ['quick_facts', 'quickFacts', 'Action/Observation', 'action_observation']).trim();
      const ramble = resolveField(row, ['ramble', 'notes_results', 'Notes/Results', 'notesResults']).trim();
      const combined = [quickFacts, ramble].filter(Boolean).join(' ');
      const nitrateColumn = safeNumber(row.nitrate_ppm);
      const nitrate = nitrateColumn ?? parseNitrateFromText(combined) ?? parseNitrateFromText(quickFacts);
      const tags = parseTags(row.tags);
      const waterChange = detectWaterChange(combined, tags);
      const dosing = parseDosingFromText(combined);

      return {
        date,
        dateISO,
        category: (row.category ?? '').trim(),
        quickFacts,
        ramble,
        quick_facts: quickFacts,
        notes_results: ramble,
        nitrate,
        waterChange,
        tags,
        thrivePumps: dosing.thrivePumps,
        excelTotal: dosing.excelTotal,
        text: combined
      };
    })
    .filter((entry) => entry !== null)
    .sort((a, b) => a.date - b.date);
}

async function fetchCSV() {
  const response = await fetch(CSV_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`CSV request failed with status ${response.status}`);
  }
  const text = await response.text();
  if (!text.trim()) {
    return [];
  }
  const parsed = parseCSV(text);
  return normaliseEntries(parsed);
}

async function fetchJSON() {
  const response = await fetch(JSON_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`JSON request failed with status ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }
  return normaliseEntries(data);
}

export async function fetchJournal() {
  try {
    const entries = await fetchCSV();
    if (entries.length) {
      return entries;
    }
  } catch (error) {
    console.warn('Failed to load journal CSV, falling back to JSON', error);
  }

  try {
    return await fetchJSON();
  } catch (error) {
    console.error('Failed to load journal data', error);
    return [];
  }
}

export function buildMonthIndex(entries) {
  const monthMap = new Map();
  entries.forEach((entry) => {
    const year = entry.date.getFullYear();
    const month = entry.date.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key,
        year,
        month: month + 1,
        label: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))
      });
    }
  });
  return Array.from(monthMap.values()).sort((a, b) => {
    if (a.year === b.year) {
      return a.month - b.month;
    }
    return a.year - b.year;
  });
}

export function sliceByMonth(entries, monthInfo, includeLast30 = false) {
  if (!monthInfo) {
    return { entries: [], rangeStart: null, rangeEnd: null, monthStart: null, monthEnd: null };
  }
  const monthStart = new Date(monthInfo.year, monthInfo.month - 1, 1);
  const monthEnd = new Date(monthInfo.year, monthInfo.month, 0);

  const monthEntries = entries.filter((entry) => entry.date >= monthStart && entry.date <= monthEnd);
  if (!includeLast30 || monthEntries.length === 0) {
    const rangeStart = monthEntries[0]?.date ?? monthStart;
    const rangeEnd = monthEntries[monthEntries.length - 1]?.date ?? monthEnd;
    return { entries: monthEntries, rangeStart, rangeEnd, monthStart, monthEnd };
  }

  const rangeEnd = monthEntries[monthEntries.length - 1].date;
  const rangeStartCandidate = new Date(rangeEnd);
  rangeStartCandidate.setDate(rangeStartCandidate.getDate() - 29);
  const rangeEntries = entries.filter((entry) => entry.date >= rangeStartCandidate && entry.date <= rangeEnd);
  const rangeStart = rangeEntries[0]?.date ?? rangeStartCandidate;
  return { entries: rangeEntries, rangeStart, rangeEnd, monthStart, monthEnd };
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day + 6) % 7; // Monday as first day
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatWeekRange(start, end) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit' });
  return `${formatter.format(start)}–${formatter.format(end)}`;
}

export function groupWeeklyDosing(entries, rangeStart, rangeEnd) {
  if (!rangeStart || !rangeEnd) {
    return [];
  }
  const weeks = [];
  const cursor = startOfWeek(rangeStart);
  const last = endOfWeek(rangeEnd);
  let weekIndex = 1;

  while (cursor <= last) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const totals = entries.reduce(
      (acc, entry) => {
        if (entry.date >= weekStart && entry.date <= weekEnd) {
          acc.thrive += entry.thrivePumps;
          acc.excel += entry.excelTotal;
        }
        return acc;
      },
      { thrive: 0, excel: 0 }
    );

    const labelStart = weekStart < rangeStart ? rangeStart : weekStart;
    const labelEnd = weekEnd > rangeEnd ? rangeEnd : weekEnd;

    weeks.push({
      label: `Week ${weekIndex} (${formatWeekRange(labelStart, labelEnd)})`,
      thrive: Number(totals.thrive.toFixed(2)),
      excel: Number(totals.excel.toFixed(2))
    });

    weekIndex += 1;
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

export function extractMaintenance(entries) {
  return entries
    .filter((entry) => {
      if (entry.tags.includes('maintenance') || entry.tags.includes('cleaning')) {
        return true;
      }
      if (/maintenance/iu.test(entry.category)) {
        return true;
      }
      return /trim|prune|water\s*change|wipe|scrub|filter|sump/iu.test(entry.text);
    })
    .map((entry) => {
      const type = determineMaintenanceType(entry.text || '', entry.tags, entry.category);
      return {
        date: entry.date,
        dateISO: entry.dateISO,
        type,
        summary: entry.quickFacts || entry.ramble || type,
        details: entry.ramble && entry.ramble !== entry.quickFacts ? entry.ramble : '',
        quickFacts: entry.quickFacts
      };
    })
    .sort((a, b) => b.date - a.date);
}
