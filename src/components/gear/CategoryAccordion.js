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

const AERATION_INFO =
  'Air pumps and airstones boost oxygenation, stabilize gas exchange, and provide gentle circulation. Use check valves to prevent back-siphon, splitters/manifolds for multiple lines, and consider battery backup for power outages.';

const AERATION_PLACEHOLDER_TITLES = new Set([
  'VIVOSUN 4-Inch Air Stone Disc',
  'Pawfly 1-Inch Air Stone Cylinder 4-Pack',
  'Penn-Plax Check Valves 6-Pack',
  'UPETTOOLS Stainless Inline Check Valve',
  'Pawfly Standard Airline Tubing 25 FT',
  'hygger 4-Way Air Control Valve',
  'HITOP Rechargeable Battery Air Pump',
  'Cobalt Aquatics Rescue Air DC Pump',
]);

const SUBSCRIPT_DIGIT_MAP = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
};

const AERATION_SUBCATEGORY_ALIASES = {
  'air-pump': 'air-pumps',
  'air-pumps': 'air-pumps',
  'airline-accessory': 'airline-accessories',
  'airline-accessories': 'airline-accessories',
  'air-pump-accessory': 'airline-accessories',
  'air-pump-accessories': 'airline-accessories',
  'co2-accessory': 'co2-accessories',
  'co2-accessories': 'co2-accessories',
  'co-2-accessory': 'co2-accessories',
  'co-2-accessories': 'co2-accessories',
  'co2-gear': 'co2-accessories',
};

const AERATION_SUBCATEGORY_SOURCE_FIELDS = [
  'subcategory_key',
  'Subcategory_Key',
  'subcategoryKey',
  'SubcategoryKey',
  'subcategory_slug',
  'Subcategory_Slug',
  'SubcategorySlug',
  'sub_category',
  'Sub_Category',
  'subcategory',
  'Subcategory',
  'Bucket',
  'bucket',
  'Item_Category',
  'item_category',
  'itemCategory',
  'Category_Key',
  'category_key',
];

const AERATION_GROUPS = [
  {
    key: 'air-pumps',
    id: 'air-pumps',
    label: 'Air Pumps',
  },
  {
    key: 'airline-accessories',
    id: 'airline-accessories',
    label: 'Air Pump Accessories',
    renderContent: ({ items }) => createAirlineAccessoryList(items),
  },
  {
    key: 'co2-accessories',
    id: 'co2-accessories',
    label: 'CO₂ Accessories',
  },
];

let hasWarnedUnknownAerationGroups = false;

function slugifyId(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
}

function normaliseAerationSubcategorySlug(value = '') {
  if (!value) {
    return '';
  }
  const baseSlug = String(value)
    .normalize('NFKD')
    .replace(/[₀-₉]/g, (char) => SUBSCRIPT_DIGIT_MAP[char] ?? char)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
  if (!baseSlug) {
    return '';
  }
  return AERATION_SUBCATEGORY_ALIASES[baseSlug] ?? baseSlug;
}

function deriveAerationSubcategory(item = {}) {
  for (const field of AERATION_SUBCATEGORY_SOURCE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(item, field)) {
      const rawValue = item[field];
      const key = normaliseAerationSubcategorySlug(rawValue);
      if (key) {
        return { key, rawValue };
      }
    }
  }
  return { key: '', rawValue: '' };
}

function groupAerationItems(items = []) {
  const groups = AERATION_GROUPS.reduce((accumulator, group) => {
    accumulator[group.key] = [];
    return accumulator;
  }, {});
  const unknownItems = [];
  const unknownKeys = new Set();

  items.forEach((item) => {
    const { key, rawValue } = deriveAerationSubcategory(item);
    if (key && Object.prototype.hasOwnProperty.call(groups, key)) {
      groups[key].push(item);
      return;
    }

    unknownItems.push(item);
    if (rawValue) {
      unknownKeys.add(String(rawValue));
    } else if (key) {
      unknownKeys.add(String(key));
    } else {
      unknownKeys.add('[unknown]');
    }
  });

  return { groups, unknownItems, unknownKeys };
}

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

function openInfoModal(options) {
  const { title, message, trigger } = options;
  const modalId = `gear-info-${Math.random().toString(36).slice(2, 8)}`;
  const titleId = `${modalId}-title`;
  const descriptionId = `${modalId}-description`;
  const backdrop = createElement('div', {
    className: 'gear-info-modal',
    attrs: {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      'aria-describedby': descriptionId,
    },
  });

  const dialog = createElement('div', {
    className: 'gear-info-modal__dialog',
    attrs: { role: 'document', tabindex: '-1' },
  });

  const header = createElement('header', { className: 'gear-info-modal__header' });
  const heading = createElement('h3', {
    className: 'gear-info-modal__title',
    attrs: { id: titleId },
    text: title,
  });
  const closeButton = createElement('button', {
    className: 'gear-info-modal__close',
    text: 'Close',
    attrs: { type: 'button', 'aria-label': 'Close info' },
  });
  header.append(heading, closeButton);

  const body = createElement('div', {
    className: 'gear-info-modal__body',
    attrs: { id: descriptionId },
  });
  body.appendChild(createElement('p', { text: message }));

  dialog.append(header, body);
  backdrop.appendChild(dialog);

  const previouslyFocused = document.activeElement;

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      const focusables = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const close = () => {
    backdrop.removeEventListener('keydown', handleKeyDown);
    backdrop.remove();
    if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus();
    } else if (trigger instanceof HTMLElement) {
      trigger.focus();
    }
  };

  closeButton.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      close();
    }
  });
  backdrop.addEventListener('keydown', handleKeyDown);

  document.body.appendChild(backdrop);

  requestAnimationFrame(() => {
    const focusables = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const focusTarget = focusables[0] ?? dialog;
    focusTarget.focus();
  });
};

function createInfoButton(options) {
  const { label, message } = options;
  const button = createElement('button', {
    className: 'category-panel__info-btn',
    text: 'i',
    attrs: { type: 'button', 'aria-label': `${label} info` },
  });
  button.addEventListener('click', () => {
    openInfoModal({ title: label, message, trigger: button });
  });
  return button;
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

function isPlaceholderAerationItem(item = {}) {
  const title = (item.Product_Name ?? item.title ?? item.Title ?? '').trim();
  if (!title) {
    return false;
  }
  return AERATION_PLACEHOLDER_TITLES.has(title);
}

function normaliseAerationItem(item) {
  const next = { ...item };
  next.Product_Name = next.Product_Name ?? next.title ?? next.Title ?? 'Unnamed product';
  next.Use_Case = next.Use_Case ?? next.use_case ?? '';
  next.Recommended_Specs = next.Recommended_Specs ?? next.recommended_specs ?? '';
  next.Notes = next.Notes ?? next.notes ?? '';
  next.Amazon_Link = next.Amazon_Link ?? next.amazon_url ?? '';
  next.rel = (next.rel ?? '').trim() || 'sponsored noopener noreferrer';
  next.product_id = next.product_id ?? next.Product_ID ?? next.Item_ID ?? '';
  const bucketRaw = next.Bucket ?? next.bucket ?? next.Subcategory ?? next.subcategory ?? '';
  next.bucket = String(bucketRaw).trim();
  const categoryKey =
    next.Item_Category ??
    next.item_category ??
    next.Category_Key ??
    next.category_key ??
    next.category ??
    '';
  next.itemCategory = String(categoryKey).trim().toLowerCase() || 'air-accessory';
  return next;
}

function createAirlineAccessoryCard(item) {
  const slugSource =
    item.product_id ?? item.Product_ID ?? item.Item_ID ?? item.Product_Name ?? item.title ?? 'item';
  const slug = slugifyId(slugSource) || 'item';
  const card = createElement('article', {
    className: 'product-card aeration-accessory-card',
    attrs: { 'data-testid': `card-${slug}` },
  });

  card.append(
    createElement('h3', { className: 'aeration-accessory-card__title', text: item.Product_Name ?? 'Unnamed product' }),
    item.Notes ? createElement('p', { className: 'aeration-accessory-card__description', text: item.Notes }) : null,
  );

  const amazonLink = (item.Amazon_Link ?? item.amazon_url ?? '').trim();
  if (amazonLink) {
    const rel = (item.rel ?? '').trim() || 'sponsored noopener noreferrer';
    const actions = createElement('div', { className: 'aeration-accessory-card__actions' });
    actions.appendChild(
      createElement('a', {
        className: 'btn primary',
        text: 'Buy on Amazon',
        attrs: {
          href: amazonLink,
          target: '_blank',
          rel,
        },
      }),
    );
    card.append(actions);
  }

  return card;
}

function createAirlineAccessoryList(items = []) {
  const grid = createElement('div', { className: 'product-grid aeration-accessory-grid' });
  items.forEach((item) => {
    grid.appendChild(createAirlineAccessoryCard(item));
  });
  return grid;
}

function createAerationSubItem(options) {
  const { id, label, items, context, onSelect, onAdd, showCount = true, renderContent } = options;
  const baseId = `${id}-subaccordion`;
  const triggerId = `${baseId}-trigger`;
  const panelId = `${baseId}-panel`;
  const hasItems = Array.isArray(items) && items.length > 0;

  const triggerChildren = [createElement('span', { className: 'bucket-list__label', text: label })];
  if (showCount && hasItems) {
    triggerChildren.push(
      createElement('span', {
        className: 'bucket-list__count',
        text: `${items.length} ${items.length === 1 ? 'pick' : 'picks'}`,
      }),
    );
  }
  triggerChildren.push(
    createElement('span', { className: 'bucket-list__icon', attrs: { 'aria-hidden': 'true' }, text: '▸' }),
  );

  const triggerAttrs = {
    type: 'button',
    id: triggerId,
    'aria-expanded': 'false',
  };

  if (hasItems) {
    triggerAttrs['aria-controls'] = panelId;
  } else {
    triggerAttrs['aria-disabled'] = 'true';
    triggerAttrs.disabled = '';
  }

  const trigger = createElement(
    'button',
    {
      className: 'bucket-list__trigger',
      attrs: triggerAttrs,
    },
    triggerChildren,
  );

  const wrapper = createElement('div', { className: 'bucket-list__item aeration-subaccordion__item' });

  if (!hasItems) {
    wrapper.appendChild(trigger);
    return wrapper;
  }

  const panel = createElement('div', {
    className: 'bucket-list__panel',
    attrs: {
      id: panelId,
      role: 'region',
      'aria-labelledby': triggerId,
      hidden: '',
      'aria-hidden': 'true',
    },
  });

  const content =
    typeof renderContent === 'function'
      ? renderContent({ items, context, onSelect, onAdd })
      : createGrid(items, context, onSelect, onAdd);

  if (content) {
    panel.appendChild(content);
  }

  trigger.addEventListener('click', () => {
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    const nextExpanded = !expanded;
    trigger.setAttribute('aria-expanded', String(nextExpanded));
    const icon = trigger.querySelector('.bucket-list__icon');
    if (nextExpanded) {
      panel.removeAttribute('hidden');
      panel.setAttribute('aria-hidden', 'false');
      wrapper.classList?.add('is-open');
      if (icon) {
        icon.textContent = '▾';
      }
    } else {
      panel.setAttribute('hidden', '');
      panel.setAttribute('aria-hidden', 'true');
      wrapper.classList?.remove('is-open');
      if (icon) {
        icon.textContent = '▸';
      }
    }
  });

  wrapper.append(trigger, panel);
  return wrapper;
}

function createAerationSection(options) {
  const { items = [], context, onSelect, onAdd } = options;
  const container = createElement('div', { className: 'bucket-section aeration-section' });
  const { groups, unknownItems, unknownKeys } = groupAerationItems(items);

  const subAccordion = createElement('div', { className: 'bucket-list aeration-subaccordion' });

  AERATION_GROUPS.forEach((group) => {
    const groupedItems = groups[group.key] ?? [];
    const subItemOptions = {
      id: group.id,
      label: group.label,
      items: groupedItems,
      context,
      onSelect,
      onAdd,
    };

    if (group.showCount === false) {
      subItemOptions.showCount = false;
    }

    if (typeof group.renderContent === 'function') {
      subItemOptions.renderContent = () =>
        group.renderContent({ items: groupedItems, context, onSelect, onAdd });
    }

    subAccordion.appendChild(createAerationSubItem(subItemOptions));
  });

  container.appendChild(subAccordion);

  if (unknownItems.length > 0 && !hasWarnedUnknownAerationGroups) {
    // eslint-disable-next-line no-console
    console.warn('Unknown Air & Aeration subcategory items', Array.from(unknownKeys));
    hasWarnedUnknownAerationGroups = true;
  }

  return container;
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
  const {
    key,
    label,
    info,
    items,
    context,
    open,
    onToggle,
    onSelect,
    onAdd,
    filtrationTab,
    onTabChange,
  } = options;

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
  if (info && key === 'Aeration') {
    header.appendChild(createInfoButton({ label, message: info }));
  }
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

  if (info && key !== 'Aeration') {
    body.appendChild(createElement('p', { className: 'category-panel__info', text: info }));
  }

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
  } else if (key === 'Aeration' && hasItems) {
    body.appendChild(
      createAerationSection({
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
    { key: 'Heating', label: 'Heaters' },
    { key: 'Filtration', label: 'Filters' },
    { key: 'Aeration', label: 'Air & Aeration', info: AERATION_INFO },
    { key: 'Lighting', label: 'Lights' },
    { key: 'Substrate', label: 'Substrate' },
  ];

  categories.forEach(({ key, label, info: categoryInfo }) => {
    let items = groups[key] ?? [];
    if (key === 'Aeration') {
      items = items
        .map((item) => normaliseAerationItem(item))
        .filter((item) => item !== null && !isPlaceholderAerationItem(item));
    }
    if (key === 'Aeration' && items.length === 0) {
      return;
    }
    container.appendChild(
      createCategorySection({
        key,
        label,
        info: categoryInfo,
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
