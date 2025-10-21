(function () {
  const entriesContainer = document.querySelector('[data-journal-entries]');
  const emptyState = document.querySelector('[data-journal-empty]');
  const monthSection = document.querySelector('[data-journal-month]');
  const monthTitle = document.querySelector('[data-journal-month-title]');
  const notice = document.querySelector('[data-journal-notice]');
  const navTop = document.querySelector('[data-journal-nav-top]');
  const navBottom = document.querySelector('[data-journal-nav-bottom]');
  if (!entriesContainer || !monthSection || !monthTitle) {
    return;
  }

  const navs = [navTop, navBottom].filter(Boolean);
  const monthCache = new Map();
  let availableMonths = [];
  let masterEntriesCache = null;
  let currentMonth = null;
  let isInitialLoad = true;

  navs.forEach((nav) => {
    nav.hidden = true;
    const prevButton = nav.querySelector('[data-journal-nav-prev]');
    const nextButton = nav.querySelector('[data-journal-nav-next]');
    if (prevButton) {
      prevButton.addEventListener('click', () => {
        const targetMonth = prevButton.dataset.targetMonth;
        if (targetMonth && !prevButton.disabled) {
          changeMonth(targetMonth, { pushHistory: true, noticeMonth: null });
        }
      });
    }
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        const targetMonth = nextButton.dataset.targetMonth;
        if (targetMonth && !nextButton.disabled) {
          changeMonth(targetMonth, { pushHistory: true, noticeMonth: null });
        }
      });
    }
  });

  init();

  async function init() {
    try {
      const { months, fallbackEntries } = await fetchMonthIndex();
      availableMonths = months;
      if (fallbackEntries) {
        masterEntriesCache = fallbackEntries;
      }

      if (!availableMonths.length) {
        showEmpty('Journal entries will appear here once available.');
        return;
      }

      navs.forEach((nav) => {
        nav.hidden = false;
      });

      const resolved = resolveInitialMonth();
      if (resolved.updateUrl) {
        replaceUrlMonth(resolved.month);
      }

      await changeMonth(resolved.month, {
        pushHistory: false,
        noticeMonth: resolved.noticeMonth,
        scrollToTop: false
      });

      window.addEventListener('popstate', handlePopState);
    } catch (error) {
      console.error('Failed to initialize journal view:', error);
      showEmpty('Journal entries will appear here once available.');
    } finally {
      isInitialLoad = false;
    }
  }

  async function fetchMonthIndex() {
    try {
      const response = await fetch('data/journal/index.json', { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error('index.json unavailable');
      }
      const data = await response.json();
      const months = Array.isArray(data)
        ? data.map((value) => normalizeMonthString(value)).filter(Boolean)
        : [];
      if (!months.length) {
        throw new Error('index.json empty');
      }
      return { months };
    } catch (error) {
      console.warn('Falling back to master journal.json:', error);
      const fallbackEntries = await ensureMasterEntries();
      const months = deriveMonthsFromEntries(fallbackEntries);
      return { months, fallbackEntries };
    }
  }

  function deriveMonthsFromEntries(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }
    const monthSet = new Set();
    entries.forEach((entry) => {
      if (entry && typeof entry.date === 'string') {
        const month = normalizeMonthString(entry.date.slice(0, 7));
        if (month) {
          monthSet.add(month);
        }
      }
    });
    return Array.from(monthSet).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }

  async function ensureMasterEntries() {
    if (masterEntriesCache) {
      return masterEntriesCache;
    }
    const response = await fetch('data/journal.json', { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error('Failed to load master journal JSON.');
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Master journal JSON is not an array.');
    }
    masterEntriesCache = data.filter((entry) => entry && typeof entry.date === 'string' && entry.date.trim());
    return masterEntriesCache;
  }

  function resolveInitialMonth() {
    const url = new URL(window.location.href);
    const rawMonth = url.searchParams.get('m');
    const normalized = normalizeMonthString(rawMonth);
    const latestMonth = availableMonths[0];
    if (normalized && availableMonths.includes(normalized)) {
      return {
        month: normalized,
        updateUrl: rawMonth !== normalized,
        noticeMonth: null
      };
    }

    if (normalized) {
      return {
        month: latestMonth,
        updateUrl: rawMonth !== latestMonth,
        noticeMonth: normalized
      };
    }

    return {
      month: latestMonth,
      updateUrl: rawMonth !== latestMonth,
      noticeMonth: null
    };
  }

  async function changeMonth(month, options = {}) {
    if (!month) {
      showEmpty('Journal entries will appear here once available.');
      return;
    }

    if (currentMonth === month && monthCache.has(month)) {
      if (typeof options.noticeMonth !== 'undefined') {
        updateNotice(options.noticeMonth);
      }
      updateNav(month);
      return;
    }

    try {
      const entries = await loadMonthEntries(month);
      currentMonth = month;
      renderMonth(month, entries);
      updateNav(month);
      if (typeof options.noticeMonth !== 'undefined') {
        updateNotice(options.noticeMonth);
      }
      if (options.pushHistory) {
        pushHistory(month);
      }
      if (!isInitialLoad && options.scrollToTop !== false) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    } catch (error) {
      console.error('Failed to load journal month:', error);
      showEmpty('Unable to load this month right now.');
    }
  }

  async function loadMonthEntries(month) {
    if (monthCache.has(month)) {
      return monthCache.get(month);
    }
    try {
      const response = await fetch(`data/journal/${month}.json`, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Month file missing for ${month}`);
      }
      const data = await response.json();
      const entries = Array.isArray(data) ? data : [];
      monthCache.set(month, entries);
      return entries;
    } catch (error) {
      const fallbackEntries = await ensureMasterEntries();
      const filtered = fallbackEntries.filter(
        (entry) => entry && typeof entry.date === 'string' && entry.date.startsWith(`${month}-`)
      );
      monthCache.set(month, filtered);
      return filtered;
    }
  }

  function renderMonth(month, entries) {
    const monthLabel = formatMonthLabel(month);
    monthTitle.textContent = monthLabel;
    monthSection.hidden = false;
    entriesContainer.innerHTML = '';

    if (!Array.isArray(entries) || !entries.length) {
      entriesContainer.setAttribute('hidden', 'hidden');
      if (emptyState) {
        const nearest = findNearestMonth(month);
        if (nearest) {
          const nearestLabel = formatMonthLabel(nearest);
          emptyState.innerHTML = `No entries this month. <a href="${buildMonthUrl(nearest)}">${nearestLabel}</a>`;
        } else {
          emptyState.textContent = 'No entries this month.';
        }
        emptyState.hidden = false;
      }
      return;
    }

    entriesContainer.removeAttribute('hidden');
    if (emptyState) {
      emptyState.hidden = true;
      emptyState.textContent = 'Journal entries will appear here once available.';
    }

    const sortedEntries = entries
      .filter((entry) => entry && typeof entry.date === 'string' && entry.date.trim())
      .slice()
      .sort((a, b) => {
        const aKey = buildSortKey(a);
        const bKey = buildSortKey(b);
        if (aKey < bKey) return 1;
        if (aKey > bKey) return -1;
        return 0;
      });

    const groups = [];
    sortedEntries.forEach((entry) => {
      const dateKey = entry.date.trim();
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.date !== dateKey) {
        groups.push({ date: dateKey, entries: [] });
      }
      groups[groups.length - 1].entries.push(entry);
    });

    groups.forEach((group) => {
      const daySection = document.createElement('section');
      daySection.className = 'journal-day';

      const heading = document.createElement('h3');
      heading.className = 'date-header';
      const headingId = `date-${slugify(group.date)}`;
      heading.id = headingId;
      heading.textContent = formatDisplayDate(group.date);
      daySection.setAttribute('aria-labelledby', headingId);
      daySection.appendChild(heading);

      group.entries.forEach((entry, index) => {
        const article = document.createElement('article');
        article.className = 'journal-entry';
        article.id = `entry-${slugify(group.date)}-${index + 1}`;

        if (entry.quick_facts) {
          const quickFacts = document.createElement('div');
          quickFacts.className = 'journal-quick-facts';
          const quickParagraph = document.createElement('p');
          quickParagraph.textContent = entry.quick_facts;
          quickFacts.appendChild(quickParagraph);
          article.appendChild(quickFacts);
        }

        if (entry.ramble) {
          const ramble = document.createElement('div');
          ramble.className = 'journal-ramble';
          const rambleParagraph = document.createElement('p');
          rambleParagraph.textContent = entry.ramble;
          ramble.appendChild(rambleParagraph);
          article.appendChild(ramble);
        }

        daySection.appendChild(article);
      });

      const divider = document.createElement('div');
      divider.className = 'journal-divider';
      divider.setAttribute('role', 'presentation');
      divider.setAttribute('aria-hidden', 'true');
      daySection.appendChild(divider);

      entriesContainer.appendChild(daySection);
    });
  }

  function updateNav(month) {
    const monthLabel = formatMonthLabel(month);
    navs.forEach((nav) => {
      const label = nav.querySelector('[data-journal-nav-label]');
      if (label) {
        label.textContent = monthLabel;
      }
      const prevButton = nav.querySelector('[data-journal-nav-prev]');
      const nextButton = nav.querySelector('[data-journal-nav-next]');
      const neighbors = getMonthNeighbors(month);
      setNavButton(prevButton, neighbors.older, 'prev');
      setNavButton(nextButton, neighbors.newer, 'next');
    });
  }

  function getMonthNeighbors(month) {
    const index = availableMonths.indexOf(month);
    if (index === -1) {
      return { newer: null, older: null };
    }
    const newer = index > 0 ? availableMonths[index - 1] : null;
    const older = index < availableMonths.length - 1 ? availableMonths[index + 1] : null;
    return { newer, older };
  }

  function setNavButton(button, targetMonth, type) {
    if (!button) {
      return;
    }
    if (targetMonth) {
      button.disabled = false;
      button.setAttribute('aria-disabled', 'false');
      button.dataset.targetMonth = targetMonth;
      if (type === 'prev') {
        button.textContent = `◀ ${formatMonthLabel(targetMonth)}`;
      } else {
        button.textContent = `${formatMonthLabel(targetMonth)} ▶`;
      }
    } else {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.dataset.targetMonth = '';
      button.textContent = type === 'prev' ? '◀ Previous' : 'Next ▶';
    }
  }

  function updateNotice(month) {
    if (!notice) {
      return;
    }
    if (month) {
      notice.hidden = false;
      notice.textContent = `No entries yet for ${formatMonthLabel(month)}.`;
    } else {
      notice.hidden = true;
      notice.textContent = '';
    }
  }

  function showEmpty(message) {
    currentMonth = null;
    if (monthTitle) {
      monthTitle.textContent = '';
    }
    if (entriesContainer) {
      entriesContainer.innerHTML = '';
      entriesContainer.setAttribute('hidden', 'hidden');
    }
    if (monthSection) {
      monthSection.hidden = true;
    }
    if (notice) {
      notice.hidden = true;
      notice.textContent = '';
    }
    navs.forEach((nav) => {
      nav.hidden = true;
    });
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = message;
    }
  }

  function replaceUrlMonth(month) {
    const url = new URL(window.location.href);
    url.searchParams.set('m', month);
    const newUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({ month }, '', newUrl);
  }

  function pushHistory(month) {
    const url = new URL(window.location.href);
    url.searchParams.set('m', month);
    const newUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.pushState({ month }, '', newUrl);
  }

  function handlePopState() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('m');
    const normalized = normalizeMonthString(raw);
    const latestMonth = availableMonths[0];
    if (normalized && availableMonths.includes(normalized)) {
      changeMonth(normalized, { pushHistory: false, noticeMonth: null });
    } else {
      changeMonth(latestMonth, {
        pushHistory: false,
        noticeMonth: normalized ? normalized : null
      });
    }
  }

  function findNearestMonth(month) {
    const neighbors = getMonthNeighbors(month);
    return neighbors.newer || neighbors.older || null;
  }

  function buildMonthUrl(month) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('m', month);
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  function normalizeMonthString(value) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})[-\/]?(\d{1,2})$/);
    if (!match) {
      return null;
    }
    const year = match[1];
    const month = Number.parseInt(match[2], 10);
    if (Number.isNaN(month) || month < 1 || month > 12) {
      return null;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function formatMonthLabel(month) {
    if (!month) {
      return '';
    }
    const date = new Date(`${month}-01T00:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  function buildSortKey(entry) {
    const date = typeof entry.date === 'string' && entry.date.trim() ? entry.date.trim() : '0000-00-00';
    let time = typeof entry.time === 'string' ? entry.time.trim() : '';
    if (time) {
      const match = time.match(/^(\d{1,2}):(\d{2})$/);
      if (match) {
        const hour = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
        const minute = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
        time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      } else {
        time = '00:00';
      }
    } else {
      time = '00:00';
    }
    return `${date}T${time}`;
  }

  function formatDisplayDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
})();
