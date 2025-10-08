import { createElement } from './helpers.js';
import { ProductCard } from './ProductCard.js';
import { SubTabs } from './SubTabs.js';
import { EmptyState } from './EmptyState.js';
import { inferBadges } from '../../utils/rankers.js';
import { bucketizeByLength, resolveBucketId } from '../../lib/grouping.js';

const FILTRATION_TABS = [
  { label: 'All', value: 'All' },
  { label: 'Sponge', value: 'Sponge' },
  { label: 'HOB', value: 'HOB' },
  { label: 'Canister', value: 'Canister' },
  { label: 'Internal', value: 'Internal' },
];

function createGrid(items, context, onSelect, onAdd, emptyMessage = 'No matches found. Try adjusting your filters.') {
  if (!items.length) {
    return EmptyState(emptyMessage);
  }
  const grid = createElement('div', { className: 'product-grid' });
  items.forEach((item) => {
    const badges = inferBadges(item, context);
    grid.appendChild(
      ProductCard(item, {
        badges,
        onViewDetails: onSelect,
        onAdd,
      }),
    );
  });
  return grid;
}

function filterFiltration(items, tab) {
  if (tab === 'All') {
    return items;
  }
  return items.filter((item) => {
    const type = item.Filter_Type ?? item.Product_Type ?? '';
    return new RegExp(tab, 'i').test(type);
  });
}

function normaliseLight(item) {
  const next = {
    ...item,
  };
  next.Product_Name = next.Product_Name ?? next.title ?? next.Title ?? 'Unnamed product';
  next.Notes = next.Notes ?? next.notes ?? '';
  next.Amazon_Link = next.Amazon_Link ?? next.amazon_url ?? '';
  next.rel = (next.rel ?? '').trim() || 'sponsored noopener noreferrer';
  next.product_id = next.product_id ?? next.Product_ID ?? next.Item_ID ?? '';
  const bucketId = resolveBucketId(next.length_range ?? next.lengthRange ?? next.Range_ID ?? next.rangeId ?? '');
  if (bucketId) {
    next.length_range = bucketId;
    next.rangeId = bucketId;
  } else {
    delete next.length_range;
  }
  return next;
}

function createLightingPanel(bucket, context, onSelect, onAdd) {
  const bucketId = bucket.bucket_id ?? bucket.id;
  const bucketLabel = bucket.bucket_label ?? bucket.label ?? '';
  const baseId = `lights-${bucketId}`;
  const triggerId = `${baseId}-trigger`;
  const panelId = `${baseId}-panel`;
  const anchorId = `lights-length-${bucketId}`;
  const wrapper = createElement('div', {
    className: 'lighting-group category-panel lighting-length__item',
    attrs: { 'data-range-id': bucketId, id: anchorId },
  });

  const trigger = createElement(
    'button',
    {
      className: 'lighting-length__trigger category-panel__trigger accordion-header',
      attrs: {
        type: 'button',
        id: triggerId,
        'aria-controls': panelId,
        'aria-expanded': 'false',
      },
    },
    [
      createElement('span', { className: 'lighting-length__label', text: bucketLabel }),
      createElement('span', {
        className: 'lighting-length__count',
        text: `${bucket.items.length} ${bucket.items.length === 1 ? 'pick' : 'picks'}`,
      }),
      createElement('span', {
        className: 'lighting-length__icon',
        attrs: { 'aria-hidden': 'true' },
        text: '▸',
      }),
    ],
  );

  const panel = createElement('div', {
    className: 'lighting-length__panel category-panel__body accordion-panel',
    attrs: {
      id: panelId,
      role: 'region',
      'aria-labelledby': triggerId,
      hidden: '',
      'aria-hidden': 'true',
    },
  });

  const grid = createElement('div', { className: 'product-grid' });
  bucket.items.forEach((light) => {
    const cardData = { ...light, Use_Case: bucket.label };
    grid.appendChild(
      ProductCard(cardData, {
        badges: inferBadges(light, context),
        onViewDetails: onSelect,
        onAdd,
      }),
    );
  });

  panel.appendChild(grid);

  trigger.addEventListener('click', () => {
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!expanded));
    if (expanded) {
      panel.setAttribute('hidden', '');
      panel.setAttribute('aria-hidden', 'true');
      wrapper.classList?.remove('is-open');
      const icon = trigger.querySelector('.lighting-length__icon');
      if (icon) {
        icon.textContent = '▸';
      }
    } else {
      panel.removeAttribute('hidden');
      panel.setAttribute('aria-hidden', 'false');
      wrapper.classList?.add('is-open');
      const icon = trigger.querySelector('.lighting-length__icon');
      if (icon) {
        icon.textContent = '▾';
      }
    }
  });

  wrapper.append(trigger, panel);
  return wrapper;
}

function createLightingSection(options) {
  const { items, context, onSelect, onAdd } = options;
  const container = createElement('div', { className: 'lighting-section lighting-section--length' });
  const normalizedLights = items.map((item) => normaliseLight(item));
  const buckets = bucketizeByLength(normalizedLights).filter((bucket) => bucket.items.length > 0);

  const stack = createElement('div', { className: 'lighting-length' });
  if (buckets.length) {
    buckets.forEach((bucket) => {
      stack.appendChild(createLightingPanel(bucket, context, onSelect, onAdd));
    });
  }

  container.appendChild(stack);
  return container;
}

function createCategorySection(options) {
  const { key, label, items, context, open, onToggle, onSelect, onAdd, filtrationTab, onTabChange } = options;

  const slug = key.toLowerCase();
  const panelId = `category-panel-${slug}`;
  const triggerId = `${panelId}-trigger`;
  const section = createElement('section', {
    className: `category-panel ${open ? 'is-open' : ''}`,
    attrs: { 'data-testid': `accordion-${slug}` },
  });

  const header = createElement('div', { className: 'category-panel__header' });
  const trigger = createElement('button', {
    className: 'category-panel__trigger',
    attrs: {
      type: 'button',
      id: triggerId,
      'aria-controls': panelId,
      'aria-expanded': String(open),
    },
  });
  trigger.append(
    createElement('span', { className: 'category-panel__title', text: label }),
    createElement('span', { className: 'category-panel__count', text: `${items.length} picks` }),
    createElement('span', { className: 'category-panel__icon', attrs: { 'aria-hidden': 'true' }, text: open ? '−' : '+' }),
  );

  trigger.addEventListener('click', () => {
    const willOpen = trigger.getAttribute('aria-expanded') !== 'true';
    onToggle(key, willOpen);
  });

  header.appendChild(trigger);
  section.appendChild(header);

  const body = createElement('div', {
    className: 'category-panel__body',
    attrs: {
      id: panelId,
      role: 'region',
      'aria-labelledby': triggerId,
      'aria-hidden': String(!open),
    },
  });
  if (!open) {
    body.setAttribute('hidden', '');
  }

  const emptyCategoryMessage = 'No items yet. We’re refreshing recommendations—check back soon.';
  const hasItems = items.length > 0;

  if (key === 'Filtration') {
    if (hasItems) {
      body.appendChild(
        SubTabs({
          tabs: FILTRATION_TABS,
          active: filtrationTab,
          onChange: onTabChange,
        }),
      );
    }
    const filtered = filterFiltration(items, filtrationTab);
    const emptyMessage = hasItems
      ? 'No matches found. Try adjusting your filters.'
      : emptyCategoryMessage;
    body.appendChild(createGrid(filtered, context, onSelect, onAdd, emptyMessage));
  } else if (key === 'Lighting') {
    body.appendChild(
      createLightingSection({
        items,
        context,
        onSelect,
        onAdd,
      }),
    );
  } else if (!hasItems && key === 'Substrate') {
    body.appendChild(EmptyState('Substrate recommendations coming soon.'));
  } else if (!hasItems) {
    body.appendChild(EmptyState(emptyCategoryMessage));
  } else {
    body.appendChild(createGrid(items, context, onSelect, onAdd));
  }

  section.appendChild(body);
  return section;
}

export function CategoryAccordion(groups, context, state, handlers) {
  const container = createElement('section', {
    className: 'category-accordion',
  });

  const categories = [
    { key: 'Filtration', label: 'Filtration' },
    { key: 'Lighting', label: 'Lighting' },
    { key: 'Heating', label: 'Heating' },
    { key: 'Substrate', label: 'Substrate' },
  ];

  categories.forEach(({ key, label }) => {
    const items = groups[key] ?? [];
    container.appendChild(
      createCategorySection({
        key,
        label,
        items,
        context,
        open: state.openCategory === key,
        onToggle: handlers.onToggleCategory,
        onSelect: handlers.onSelect,
        onAdd: handlers.onAdd,
        filtrationTab: state.filtrationTab,
        onTabChange: handlers.onFiltrationTab,
      }),
    );
  });

  return container;
}
