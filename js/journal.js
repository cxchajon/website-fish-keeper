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

      const dateCounts = Object.create(null);

      sortedRows.forEach((row, index) => {
        const section = document.createElement('section');
        section.className = 'journal-entry';

        const dateKey = row.date.trim();
        const count = (dateCounts[dateKey] || 0) + 1;
        dateCounts[dateKey] = count;
        const entryId = `entry-${dateKey}${count > 1 ? `-${count}` : ''}`;

        const heading = document.createElement('h2');
        heading.className = 'journal-date';
        heading.id = entryId;
        heading.textContent = formatDisplayDate(row.date);
        section.setAttribute('aria-labelledby', entryId);
        section.appendChild(heading);

        if (row.quick_facts) {
          const quickFacts = document.createElement('div');
          quickFacts.className = 'journal-quick-facts';

          const quickParagraph = document.createElement('p');
          const label = document.createElement('strong');
          label.textContent = 'Quick Facts:';
          quickParagraph.appendChild(label);
          quickParagraph.appendChild(document.createTextNode(` ${row.quick_facts}`));
          quickFacts.appendChild(quickParagraph);
          section.appendChild(quickFacts);
        }

        if (row.ramble) {
          const ramble = document.createElement('div');
          ramble.className = 'journal-ramble';

          const rambleParagraph = document.createElement('p');
          rambleParagraph.textContent = row.ramble;
          ramble.appendChild(rambleParagraph);
          section.appendChild(ramble);
        }

        const divider = document.createElement('div');
        divider.className = 'journal-divider';
        divider.setAttribute('role', 'presentation');
        divider.setAttribute('aria-hidden', 'true');
        section.appendChild(divider);

        entriesContainer.appendChild(section);
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
})();
