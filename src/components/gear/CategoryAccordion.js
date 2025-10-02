import { createElement } from './helpers.js';
import { ProductCard } from './ProductCard.js';
import { SubTabs } from './SubTabs.js';
import { EmptyState } from './EmptyState.js';
import { inferBadges } from '../../utils/rankers.js';

const FILTRATION_TABS = [
  { label: 'All', value: 'All' },
  { label: 'Sponge', value: 'Sponge' },
  { label: 'HOB', value: 'HOB' },
  { label: 'Canister', value: 'Canister' },
  { label: 'Internal', value: 'Internal' },
];

function createGrid(items, context, onSelect, onAdd) {
  if (!items.length) {
    return EmptyState('No matches found. Try adjusting your filters.');
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
  } = options;

  const details = createElement('details', {
    className: 'category-panel',
    attrs: { 'data-testid': `accordion-${key.toLowerCase()}` },
  });
  details.open = open;
  details.addEventListener('toggle', () => {
    onToggle(key, details.open);
  });

  const summary = createElement('summary', { className: 'category-panel__header' }, [
    createElement('h2', { text: label }),
    createElement('span', { className: 'category-panel__count', text: `${items.length} picks` }),
  ]);
  details.appendChild(summary);

  const body = createElement('div', { className: 'category-panel__body' });
  if (key === 'Filtration') {
    body.appendChild(
      SubTabs({
        tabs: FILTRATION_TABS,
        active: filtrationTab,
        onChange: onTabChange,
      }),
    );
    const filtered = filterFiltration(items, filtrationTab);
    body.appendChild(createGrid(filtered, context, onSelect, onAdd));
  } else if (!items.length && key === 'Substrate') {
    body.appendChild(EmptyState('Substrate recommendations coming soon.'));
  } else {
    body.appendChild(createGrid(items, context, onSelect, onAdd));
  }

  details.appendChild(body);
  return details;
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
