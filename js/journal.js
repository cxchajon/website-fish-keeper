(function () {
  const entriesContainer = document.querySelector('[data-journal-entries]');
  const emptyState = document.querySelector('[data-journal-empty]');
  if (!entriesContainer) {
    return;
  }

  fetch('data/journal.csv', { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to load journal data.');
      }
      return response.text();
    })
    .then((csvText) => {
      const rows = parseCSV(csvText);
      if (!rows.length) {
        showEmpty();
        return;
      }

      const sortedRows = rows
        .filter((row) => row.date)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

      if (!sortedRows.length) {
        showEmpty();
        return;
      }

      const groups = [];

      sortedRows.forEach((row) => {
        const dateKey = row.date.trim();
        if (!dateKey) {
          return;
        }

        const lastGroup = groups[groups.length - 1];
        if (!lastGroup || lastGroup.date !== dateKey) {
          groups.push({ date: dateKey, entries: [] });
        }

        groups[groups.length - 1].entries.push(row);
      });

      groups.forEach((group) => {
        const daySection = document.createElement('section');
        daySection.className = 'journal-day';

        const heading = document.createElement('h2');
        heading.className = 'date-header';
        const headingId = `date-${slugify(group.date)}`;
        heading.id = headingId;
        heading.textContent = formatDisplayDate(group.date);
        daySection.setAttribute('aria-labelledby', headingId);
        daySection.appendChild(heading);

        group.entries.forEach((row, index) => {
          const entry = document.createElement('article');
          entry.className = 'journal-entry';
          entry.id = `entry-${slugify(group.date)}-${index + 1}`;
          daySection.appendChild(entry);

          if (row.quick_facts) {
            const quickFacts = document.createElement('div');
            quickFacts.className = 'journal-quick-facts';

            const quickParagraph = document.createElement('p');
            quickParagraph.textContent = row.quick_facts;
            quickFacts.appendChild(quickParagraph);
            entry.appendChild(quickFacts);
          }

          if (row.ramble) {
            const ramble = document.createElement('div');
            ramble.className = 'journal-ramble';

            const rambleParagraph = document.createElement('p');
            rambleParagraph.textContent = row.ramble;
            ramble.appendChild(rambleParagraph);
            entry.appendChild(ramble);
          }
        });

        const divider = document.createElement('div');
        divider.className = 'journal-divider';
        divider.setAttribute('role', 'presentation');
        divider.setAttribute('aria-hidden', 'true');
        daySection.appendChild(divider);

        entriesContainer.appendChild(daySection);
      });

      entriesContainer.removeAttribute('hidden');
      if (emptyState) {
        emptyState.hidden = true;
      }
    })
    .catch(() => {
      showEmpty();
    });

  function showEmpty() {
    if (entriesContainer) {
      entriesContainer.innerHTML = '';
      entriesContainer.setAttribute('hidden', 'hidden');
    }
    if (emptyState) {
      emptyState.hidden = false;
    }
  }

  function parseCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length <= 1) {
      return [];
    }

    const headers = splitCSVLine(lines[0]);
    const dataLines = lines.slice(1);

    return dataLines
      .map((line) => splitCSVLine(line))
      .filter((cells) => cells.length)
      .map((cells) => {
        const entry = {};
        headers.forEach((header, index) => {
          entry[header] = (cells[index] || '').trim();
        });
        return entry;
      });
  }

  function splitCSVLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    cells.push(current);
    return cells;
  }

  function formatDisplayDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
})();
