(() => {
  const DATA_URL = '/data/university_sources.json?v=2025-10-19';
  const GRID_SELECTOR = '[data-uni-grid]';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function hexToRgbTuple(value) {
    if (typeof value !== 'string') return null;
    const hex = value.trim().replace(/^#/u, '');
    if (!/^([a-f\d]{3}|[a-f\d]{6})$/iu.test(hex)) return null;
    const normalized = hex.length === 3
      ? hex.split('').map((char) => char + char).join('')
      : hex;
    const int = parseInt(normalized, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return [r, g, b];
  }

  function normaliseId(input, fallbackIndex) {
    if (typeof input === 'string' && input.trim()) {
      return input.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || `school-${fallbackIndex}`;
    }
    return `school-${fallbackIndex}`;
  }

  function createCard(entry, index) {
    if (!entry || typeof entry !== 'object') return null;
    const id = normaliseId(entry.id, index + 1);
    const card = document.createElement('article');
    card.className = 'uni-card';
    card.setAttribute('data-uni-card', id);

    const titleId = `${id}-title`;
    card.setAttribute('aria-labelledby', titleId);

    if (entry.accent) {
      const rgb = hexToRgbTuple(entry.accent);
      card.style.setProperty('--uni-accent', entry.accent);
      if (rgb) {
        card.style.setProperty('--uni-accent-rgb', `${rgb[0]} ${rgb[1]} ${rgb[2]}`);
      }
    }

    if (entry.badge) {
      const badge = document.createElement('p');
      badge.className = 'uni-card__badge';
      badge.textContent = entry.badge;
      card.appendChild(badge);
    }

    const title = document.createElement('h3');
    title.className = 'uni-card__title';
    title.id = titleId;
    title.textContent = entry.name || 'New Study Track';
    card.appendChild(title);

    if (entry.summary) {
      const summary = document.createElement('p');
      summary.className = 'uni-card__summary';
      summary.textContent = entry.summary;
      card.appendChild(summary);
    }

    if (Array.isArray(entry.focus) && entry.focus.length > 0) {
      const list = document.createElement('ul');
      list.className = 'uni-card__list';
      entry.focus.forEach((item) => {
        if (!item) return;
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
      if (list.childElementCount > 0) {
        card.appendChild(list);
      }
    }

    if (entry.cta && entry.cta.href && entry.cta.label) {
      const ctaWrap = document.createElement('div');
      ctaWrap.className = 'uni-card__cta';

      const link = document.createElement('a');
      link.className = 'uni-card__link';
      link.href = entry.cta.href;
      link.textContent = entry.cta.label;

      try {
        const url = new URL(entry.cta.href, window.location.origin);
        if (url.origin !== window.location.origin) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } catch (_) {
        // Non-URL values fall back to default behaviour (likely fragment or relative path)
      }

      ctaWrap.appendChild(link);
      card.appendChild(ctaWrap);
    }

    return card;
  }

  async function loadUniversityData(grid) {
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch university sources: ${response.status}`);
      }
      const payload = await response.json();
      const schools = Array.isArray(payload?.schools) ? payload.schools : [];

      grid.textContent = '';
      if (schools.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'uni-card-grid__empty';
        empty.textContent = 'New hybrid pathways are being finalised. Check back soon!';
        grid.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      schools.forEach((school, index) => {
        const card = createCard(school, index);
        if (card) {
          fragment.appendChild(card);
        }
      });

      if (!fragment.childElementCount) {
        const empty = document.createElement('p');
        empty.className = 'uni-card-grid__empty';
        empty.textContent = 'University cards are unavailable at the moment. Please refresh to retry.';
        grid.appendChild(empty);
        return;
      }

      grid.appendChild(fragment);
    } catch (error) {
      console.error('University data failed to load', error);
      grid.textContent = '';
      const fallback = document.createElement('p');
      fallback.className = 'uni-card-grid__empty';
      fallback.textContent = 'We couldn\'t load the study tracks right now. Reload or try again later.';
      grid.appendChild(fallback);
    }
  }

  ready(() => {
    const grid = document.querySelector(GRID_SELECTOR);
    if (!grid) return;
    loadUniversityData(grid);
  });
})();
