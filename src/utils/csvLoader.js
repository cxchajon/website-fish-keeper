const DEFAULT_FILES = [
  { category: 'Filtration', path: '/data/gear_filtration.csv' },
  { category: 'Aeration', path: '/data/gear_aeration.csv' },
  { category: 'Lighting', path: '/data/gear_lighting.csv' },
  { category: 'Heating', path: '/data/gear_heating.csv' },
];

function normaliseHeader(header) {
  return header.trim();
}

export function parseCSV(text) {
  const rows = [];
  const headers = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '\r') {
      continue;
    }
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else if (inQuotes && text[i - 1] === '\\') {
        current = `${current.slice(0, -1)}"`;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(current);
      if (!headers.length) {
        for (const header of row) {
          headers.push(normaliseHeader(header));
        }
      } else if (row.some((cell) => cell.length > 0)) {
        const entry = {};
        headers.forEach((header, index) => {
          entry[header] = row[index] !== undefined ? row[index] : '';
        });
        rows.push(entry);
      }
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    if (!headers.length) {
      for (const header of row) {
        headers.push(normaliseHeader(header));
      }
    } else if (row.some((cell) => cell.length > 0)) {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = row[index] !== undefined ? row[index] : '';
      });
      rows.push(entry);
    }
  }

  return rows;
}

async function fetchJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function fetchCSV(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  const text = await response.text();
  const lastModified = response.headers.get('last-modified') ?? undefined;
  return { rows: parseCSV(text), lastModified };
}

export async function loadGear(navUrl = '/data/master_nav.json') {
  let manifest;
  try {
    manifest = await fetchJSON(navUrl);
  } catch (error) {
    manifest = undefined;
  }

  const files = manifest?.files?.length ? manifest.files : DEFAULT_FILES;
  const sources = [];
  const rows = [];
  const timestamps = [];

  for (const file of files) {
    try {
      const { rows: csvRows, lastModified } = await fetchCSV(file.path);
      csvRows.forEach((entry) => {
        if (!entry.Category && file.category) {
          entry.Category = file.category;
        }
        if ((entry.Category ?? file.category) === 'Lighting') {
          const title = entry.Product_Name || entry.title || entry.Title || entry.Option_Label || '';
          const notes = entry.Notes || entry.notes || '';
          const amazon = entry.Amazon_Link || entry.amazon_link || entry.amazon_url || entry.amazonUrl || '';
          const rel = entry.rel || entry.Rel || '';
          entry.product_id = entry.product_id || entry.Product_ID || entry.Item_ID || '';
          entry.title = title;
          entry.Product_Name = title;
          entry.Notes = notes;
          entry.amazon_url = amazon;
          entry.Amazon_Link = amazon;
          entry.rel = rel || 'sponsored noopener noreferrer';
          entry.length_range = (entry.length_range || entry.lengthRange || entry.Range_ID || '')
            .toString()
            .trim()
            .replace(/[\u2012-\u2015\u2212]/g, '-')
            .replace(/\s+/g, '')
            .replace(/\+$/, '-up');
        }
        rows.push(entry);
      });
      sources.push({ category: file.category ?? 'Unknown', path: file.path });
      if (lastModified) {
        timestamps.push(new Date(lastModified));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  let generatedAt = manifest?.generated_at;
  if (!generatedAt && timestamps.length) {
    const latest = timestamps.sort((a, b) => b.getTime() - a.getTime())[0];
    generatedAt = latest?.toISOString();
  }

  return {
    rows,
    sources,
    generatedAt,
  };
}
