(function () {
  const CATEGORY_LABELS = {
    Filtration: 'Filtration',
    Lighting: 'Lighting',
    Heating: 'Heating',
    Substrate: 'Substrate',
  };
  const CATEGORY_ORDER = ['Filtration', 'Lighting', 'Heating', 'Substrate'];
  const CSV_URL = '/data/gear_master.csv';

  const root = document.getElementById('gear-root');
  if (!root) {
    return;
  }

  const state = {
    rows: [],
    filter: 'All',
  };

  const sections = new Map();
  let filterSelect;

  function createBaseLayout() {
    root.innerHTML = '';

    const heading = document.createElement('h1');
    heading.className = 'gear-page__title';
    heading.textContent = 'Gear Guide';
    root.appendChild(heading);

    const controls = document.createElement('div');
    controls.className = 'gear-controls';

    const label = document.createElement('label');
    label.className = 'gear-controls__label';
    label.setAttribute('for', 'gear-category-filter');
    label.textContent = 'Filter by category';

    filterSelect = document.createElement('select');
    filterSelect.id = 'gear-category-filter';
    filterSelect.className = 'gear-controls__select';

    const optionAll = document.createElement('option');
    optionAll.value = 'All';
    optionAll.textContent = 'All gear';
    filterSelect.appendChild(optionAll);

    CATEGORY_ORDER.forEach((key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = CATEGORY_LABELS[key];
      filterSelect.appendChild(option);
    });

    filterSelect.addEventListener('change', () => {
      state.filter = filterSelect.value;
      applyFilter();
    });

    controls.appendChild(label);
    controls.appendChild(filterSelect);
    root.appendChild(controls);

    const sectionsHost = document.createElement('div');
    sectionsHost.className = 'gear-sections';

    CATEGORY_ORDER.forEach((key) => {
      const section = document.createElement('section');
      section.className = 'gear-category';
      section.dataset.category = key;

      const header = document.createElement('header');
      header.className = 'gear-category__header';

      const title = document.createElement('h2');
      title.className = 'gear-category__title';
      title.textContent = CATEGORY_LABELS[key];
      header.appendChild(title);

      section.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'product-grid';
      grid.dataset.categoryGrid = key;
      section.appendChild(grid);

      const empty = document.createElement('p');
      empty.className = 'gear-category__empty';
      empty.textContent = 'No items yet — coming soon.';
      empty.hidden = true;
      section.appendChild(empty);

      sections.set(key, { section, grid, empty });
      sectionsHost.appendChild(section);
    });

    root.appendChild(sectionsHost);
  }

  function parseCSV(text) {
    const rows = [];
    const cells = [];
    let current = '';
    let inQuotes = false;
    const pushCell = () => {
      cells.push(current);
      current = '';
    };
    const pushRow = () => {
      rows.push(cells.slice());
      cells.length = 0;
    };

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        pushCell();
      } else if (char === '\r') {
        continue;
      } else if (char === '\n') {
        pushCell();
        if (cells.length > 1 || cells[0] !== '') {
          pushRow();
        } else {
          cells.length = 0;
        }
      } else {
        current += char;
      }
    }
    if (current !== '' || cells.length) {
      pushCell();
      pushRow();
    }
    return rows;
  }

  function toObjects(table) {
    if (!table.length) {
      return [];
    }
    const header = table[0].map((value) => value.trim());
    const objects = [];
    for (let i = 1; i < table.length; i += 1) {
      const row = table[i];
      if (row.length === 1 && row[0] === '') {
        continue;
      }
      const entry = {};
      header.forEach((key, index) => {
        entry[key] = row[index] ? row[index].trim() : '';
      });
      objects.push(entry);
    }
    return objects;
  }

  function truncate(text, limit) {
    if (!text || text.length <= limit) {
      return text || '';
    }
    const slice = text.slice(0, limit);
    const lastSpace = slice.lastIndexOf(' ');
    const base = lastSpace > 60 ? slice.slice(0, lastSpace) : slice;
    return `${base}\u2026`;
  }

  function createCard(row) {
    const card = document.createElement('article');
    card.className = 'product-card gear-card';
    if (row.ASIN) {
      card.dataset.asin = row.ASIN;
    }
    if (row.Category) {
      card.dataset.category = row.Category;
    }
    if (row.Product_Type) {
      card.dataset.productType = row.Product_Type;
    }
    card.setAttribute('data-testid', 'gear-card');

    const header = document.createElement('div');
    header.className = 'product-card__header';

    const title = document.createElement('h3');
    title.textContent = row.Product_Name || 'Unnamed product';
    header.appendChild(title);

    if (row.Product_Type) {
      const meta = document.createElement('p');
      meta.className = 'gear-card__meta';
      meta.textContent = row.Product_Type;
      header.appendChild(meta);
    }

    card.appendChild(header);

    const badges = document.createElement('div');
    badges.className = 'badges';
    const isPlantReady = typeof row.Plant_Ready === 'string' && row.Plant_Ready.trim().toLowerCase() === 'yes';
    if (isPlantReady) {
      const badge = document.createElement('span');
      badge.className = 'badge badge--plant';
      badge.textContent = 'Plant-Ready';
      badges.appendChild(badge);
    }
    if (badges.children.length) {
      card.appendChild(badges);
    }

    if (row.Notes) {
      const notes = document.createElement('p');
      notes.className = 'product-card__notes';
      notes.textContent = truncate(row.Notes, 110);
      card.appendChild(notes);
    }

    const links = document.createElement('div');
    links.className = 'product-card__links';
    const button = document.createElement('a');
    button.className = 'btn primary gear-card__cta';
    button.textContent = 'View on Amazon';
    if (row.Amazon_Link) {
      button.href = row.Amazon_Link;
      button.target = '_blank';
      button.rel = 'noopener noreferrer';
    } else {
      button.setAttribute('aria-disabled', 'true');
      button.classList.add('is-disabled');
      button.tabIndex = -1;
    }
    links.appendChild(button);
    card.appendChild(links);

    return card;
  }

  function render() {
    const cards = [];
    sections.forEach(({ grid, empty }) => {
      grid.innerHTML = '';
      empty.hidden = true;
    });

    const allowed = new Set(CATEGORY_ORDER);
    const grouped = new Map();
    CATEGORY_ORDER.forEach((key) => grouped.set(key, []));

    state.rows.forEach((row) => {
      if (!allowed.has(row.Category)) {
        return;
      }
      grouped.get(row.Category).push(row);
    });

    grouped.forEach((entries, category) => {
      const ref = sections.get(category);
      if (!ref) {
        return;
      }
      if (!entries.length) {
        ref.empty.hidden = false;
        ref.section.setAttribute('data-has-items', 'false');
        return;
      }
      ref.section.setAttribute('data-has-items', 'true');
      entries.forEach((entry) => {
        const card = createCard(entry);
        ref.grid.appendChild(card);
        cards.push(card);
      });
    });

    applyFilter();
    document.dispatchEvent(new CustomEvent('gear:rendered', { detail: { cards } }));
  }

  function applyFilter() {
    sections.forEach(({ section }) => {
      const category = section.dataset.category;
      const shouldShow = state.filter === 'All' || state.filter === category;
      section.hidden = !shouldShow;
    });
  }

  async function loadData() {
    try {
      const response = await fetch(CSV_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load gear data: ${response.status}`);
      }
      const text = await response.text();
      const table = parseCSV(text);
      const objects = toObjects(table);
      state.rows = objects;
      render();
    } catch (error) {
      const message = document.createElement('p');
      message.className = 'gear-error';
      message.textContent = 'Unable to load gear data right now. Please try again later.';
      root.appendChild(message);
      // eslint-disable-next-line no-console
      console.error('[gear.render] load failed', error);
    }
  }

  createBaseLayout();
  loadData();
})();
