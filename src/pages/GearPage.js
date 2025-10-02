import { loadGear } from '../utils/csvLoader.js';
import { CONTEXT_DEFAULTS, scoreItem, getNormalizedBudget } from '../utils/rankers.js';
import { clearElement, createElement } from '../components/gear/helpers.js';
import { TransparencyBanner } from '../components/gear/TransparencyBanner.js';
import { ContextBar } from '../components/gear/ContextBar.js';
import { RecommendedRow } from '../components/gear/RecommendedRow.js';
import { CategoryAccordion } from '../components/gear/CategoryAccordion.js';
import { WhyPickDrawer } from '../components/gear/WhyPickDrawer.js';
import { TankSmartModal } from '../components/gear/TankSmartModal.js';

const state = {
  loading: true,
  error: null,
  rows: [],
  context: { ...CONTEXT_DEFAULTS },
  openCategory: 'Filtration',
  filtrationTab: 'All',
  selectedItem: null,
  showModal: false,
  alternatives: { Budget: null, Mid: null, Premium: null },
};

const root = document.getElementById('gear-root');

function groupRows(rows, context) {
  const categories = {
    Filtration: [],
    Lighting: [],
    Heating: [],
    Substrate: [],
  };
  rows.forEach((row) => {
    const category = row.Category ?? 'Filtration';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(row);
  });
  Object.keys(categories).forEach((key) => {
    categories[key] = categories[key].sort((a, b) => scoreItem(b, context) - scoreItem(a, context));
  });
  return categories;
}

function setState(patch) {
  Object.assign(state, patch);
  if (patch.context && state.selectedItem) {
    state.alternatives = computeAlternatives(state.selectedItem);
  }
  render();
}

function handleSelectItem(item) {
  const alternatives = computeAlternatives(item);
  setState({ selectedItem: item, alternatives });
}

function computeAlternatives(item) {
  if (!item) {
    return { Budget: null, Mid: null, Premium: null };
  }
  const sameCategory = state.rows.filter((row) => row.Category === item.Category && row !== item);
  const tiers = ['Budget', 'Mid', 'Premium'];
  const alt = {};
  tiers.forEach((tier) => {
    const candidates = sameCategory.filter((row) => getNormalizedBudget(row) === tier);
    if (candidates.length) {
      alt[tier] = candidates.sort((a, b) => scoreItem(b, state.context) - scoreItem(a, state.context))[0];
    } else {
      alt[tier] = null;
    }
  });
  return alt;
}

function render() {
  if (!root) {
    return;
  }
  clearElement(root);

  if (state.loading) {
    root.appendChild(createElement('p', { text: 'Loading gear recommendations...' }));
    return;
  }

  if (state.error) {
    root.appendChild(createElement('p', { text: state.error }));
    return;
  }

  const groups = groupRows(state.rows, state.context);

  const page = createElement('div', { className: 'gear-wrap' });
  const contextBar = ContextBar(state.context, (context) => setState({ context }));
  const actions = createElement('div', { className: 'context-actions' });
  const modalButton = createElement('button', {
    className: 'btn tertiary',
    text: 'How to Buy a Tank Smart',
    attrs: { type: 'button' },
  });
  modalButton.addEventListener('click', () => setState({ showModal: true }));
  actions.appendChild(modalButton);

  page.append(
    TransparencyBanner(),
    contextBar,
    actions,
    RecommendedRow(state.rows, state.context, {
      onSelect: handleSelectItem,
      onAdd: () => {
        // eslint-disable-next-line no-console
        console.info('Add to Build clicked - feature coming soon');
      },
    }),
    CategoryAccordion(
      groups,
      state.context,
      { openCategory: state.openCategory, filtrationTab: state.filtrationTab },
      {
        onToggleCategory: (key, open) => {
          if (open) {
            setState({ openCategory: key });
          } else if (state.openCategory === key) {
            setState({ openCategory: '' });
          }
        },
        onSelect: handleSelectItem,
        onAdd: () => {
          // eslint-disable-next-line no-console
          console.info('Add to Build clicked - feature coming soon');
        },
        onFiltrationTab: (tab) => setState({ filtrationTab: tab }),
      },
    ),
    WhyPickDrawer({
      item: state.selectedItem,
      context: state.context,
      alternatives: state.alternatives,
      onClose: () => setState({ selectedItem: null }),
      onSelectAlternative: (candidate) => handleSelectItem(candidate),
    }),
    TankSmartModal({
      open: state.showModal,
      onClose: () => setState({ showModal: false }),
    }),
  );

  root.appendChild(page);
}

async function init() {
  try {
    const { rows } = await loadGear();
    state.rows = rows;
    state.loading = false;
    render();
  } catch (error) {
    state.loading = false;
    state.error = 'Failed to load gear data. Please try again later.';
    render();
  }
}

init();
render();
