import { createElement } from './helpers.js';
import { ProductCard } from './ProductCard.js';
import { SubTabs } from './SubTabs.js';
import { EmptyState } from './EmptyState.js';
import { inferBadges } from '../../utils/rankers.js';
import { getTankHeightInches } from '../../utils/tankDimensions.js';

const FILTRATION_TABS = [
  { label: 'All', value: 'All' },
  { label: 'Sponge', value: 'Sponge' },
  { label: 'HOB', value: 'HOB' },
  { label: 'Canister', value: 'Canister' },
  { label: 'Internal', value: 'Internal' },
];

const LIGHT_GROUP_DEFAULTS = {
  shallow_8_12: {
    label: 'Low Light (Shallow 8–12″)',
    anchor: 'light-depth-8-12',
  },
  standard_13_18: {
    label: 'Medium Light (Standard 13–18″)',
    anchor: 'light-depth-13-18',
  },
  deep_19_24: {
    label: 'High Light (Deep 19–24″)',
    anchor: 'light-depth-19-24',
  },
  xl_25_plus: {
    label: 'High-Output (Extra-Deep 25″+)',
    anchor: 'light-depth-25-plus',
  },
};

const LIGHT_GROUP_ORDER = ['shallow_8_12', 'standard_13_18', 'deep_19_24', 'xl_25_plus'];

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

function getLightGroupMeta(id) {
  const defaults = LIGHT_GROUP_DEFAULTS[id] ?? {};
  return {
    id,
    label: defaults.label ?? 'Lighting',
    anchor: defaults.anchor ?? `light-depth-${id ?? 'group'}`,
  };
}

function normaliseNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function groupLightingItems(items) {
  const groups = new Map();
  LIGHT_GROUP_ORDER.forEach((id) => {
    const meta = getLightGroupMeta(id);
    groups.set(id, {
      ...meta,
      depth: null,
      items: [],
    });
  });
  items.forEach((item) => {
    const rawId = item.group_id ?? '';
    const id = LIGHT_GROUP_ORDER.includes(rawId) ? rawId : rawId || 'standard_13_18';
    if (!groups.has(id)) {
      groups.set(id, {
        ...getLightGroupMeta(id),
        depth: null,
        items: [],
      });
    }
    const group = groups.get(id);
    group.label = item.group_label || group.label;
    group.anchor = item.group_anchor || group.anchor;
    const depthValue = normaliseNumber(item.depth_in);
    group.depth = depthValue ?? group.depth;
    group.items.push(item);
  });
  return groups;
}

function getDepthGroupForHeight(height) {
  if (!Number.isFinite(height)) {
    return '';
  }
  if (height <= 12) {
    return 'shallow_8_12';
  }
  if (height <= 18) {
    return 'standard_13_18';
  }
  if (height <= 24) {
    return 'deep_19_24';
  }
  return 'xl_25_plus';
}

function deriveHighlightedLightGroup(context) {
  const height = getTankHeightInches(context?.tankSize);
  return getDepthGroupForHeight(height);
}

function createLightingFilters(groups, activeFilter, onFilterChange) {
  const filterBar = createElement('div', { className: 'lighting-filters' });
  LIGHT_GROUP_ORDER.forEach((groupId) => {
    const group = groups.get(groupId) ?? { ...getLightGroupMeta(groupId), items: [] };
    const hasItems = Array.isArray(group.items) && group.items.length > 0;
    const chip = createElement('button', {
      className: `lighting-chip ${activeFilter === groupId ? 'is-active' : ''} ${
        hasItems ? '' : 'is-empty'
      }`.trim(),
      text: group.label,
      attrs: {
        type: 'button',
        'data-group-id': groupId,
        'aria-pressed': String(activeFilter === groupId),
        'data-has-items': String(hasItems),
      },
    });
    chip.addEventListener('click', () => {
      if (typeof onFilterChange !== 'function') {
        return;
      }
      onFilterChange(groupId, group.anchor);
    });
    filterBar.appendChild(chip);
  });
  return filterBar;
}

function createLightingGroup(group, isHighlighted, context, onSelect, onAdd) {
  const wrapper = createElement('div', {
    className: `lighting-group ${isHighlighted ? 'is-highlighted' : ''}`,
    attrs: {
      'data-group-id': group.id,
    },
  });
  wrapper.append(
    createElement('h3', {
      className: 'lighting-group__title',
      text: group.label,
      attrs: { id: group.anchor },
    }),
    createGrid(
      group.items,
      context,
      onSelect,
      onAdd,
      'No lights available in this depth range yet. Check back soon.',
    ),
  );
  return wrapper;
}

function createLightingSection(options) {
  const { items, context, onSelect, onAdd, filter, onFilterChange } = options;
  const container = createElement('div', { className: 'lighting-section' });
  const groups = groupLightingItems(items);
  container.appendChild(createLightingFilters(groups, filter, onFilterChange));

  const highlightId = deriveHighlightedLightGroup(context);
  const orderedIds = LIGHT_GROUP_ORDER.filter((id) => groups.has(id));
  const visibleIds = filter ? orderedIds.filter((id) => id === filter && groups.has(id)) : orderedIds;

  if (!visibleIds.length) {
    container.appendChild(EmptyState('No lights available for this depth yet. Check back soon.'));
    return container;
  }

  const stack = createElement('div', { className: 'lighting-groups' });
  visibleIds.forEach((id) => {
    const group = groups.get(id);
    stack.appendChild(createLightingGroup(group, highlightId === id, context, onSelect, onAdd));
  });
  container.appendChild(stack);
  return container;
}

function createCategorySection(options) {
  const {
    key,
    label,
    items,
    context,
    open,
    onToggle,
    onSelect,
    onAdd,
    filtrationTab,
    onTabChange,
    lightingFilter,
    onLightingFilter,
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
        filter: lightingFilter,
        onFilterChange: onLightingFilter,
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
        lightingFilter: state.lightingFilter,
        onLightingFilter: handlers.onLightingFilter,
      }),
    );
  });

  return container;
}
