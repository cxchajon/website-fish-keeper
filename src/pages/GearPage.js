import { loadGear } from '../utils/csvLoader.js';
import { CONTEXT_DEFAULTS, scoreItem, getNormalizedBudget } from '../utils/rankers.js';
import { clearElement, createElement } from '../components/gear/helpers.js';
import { ContextBar } from '../components/gear/ContextBar.js';
import { RecommendedRow } from '../components/gear/RecommendedRow.js';
import { CategoryAccordion } from '../components/gear/CategoryAccordion.js';
import { WhyPickDrawer } from '../components/gear/WhyPickDrawer.js';
import { TankSmartModal } from '../components/gear/TankSmartModal.js';

const OPEN_CATEGORY_STORAGE_KEY = 'ttg.gear.openCategory';
const STOCKING_STORAGE_KEY = 'ttg_stocking_state';

function readStoredOpenCategory() {
  try {
    return sessionStorage.getItem(OPEN_CATEGORY_STORAGE_KEY) || '';
  } catch (error) {
    return '';
  }
}

function persistOpenCategory(value) {
  try {
    if (value) {
      sessionStorage.setItem(OPEN_CATEGORY_STORAGE_KEY, value);
    } else {
      sessionStorage.removeItem(OPEN_CATEGORY_STORAGE_KEY);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to persist open category state', error);
  }
}

function deriveTankSizeFromStocking(tank = {}) {
  const gallons = Number.parseFloat(tank.gallons_total);
  if (!Number.isFinite(gallons)) {
    return '';
  }
  if (gallons >= 18 && gallons <= 22) {
    if (typeof tank.length_in === 'number' && tank.length_in >= 28) {
      return '20 Long';
    }
    return '20g';
  }
  const options = [
    { label: '5g', value: 5 },
    { label: '10g', value: 10 },
    { label: '20g', value: 20 },
    { label: '29g', value: 29 },
    { label: '40 Breeder', value: 40 },
    { label: '55g', value: 55 },
    { label: '75g', value: 75 },
    { label: '90g', value: 90 },
    { label: '110g', value: 110 },
    { label: '125g', value: 125 },
  ];
  let closest = '';
  let diff = Number.POSITIVE_INFINITY;
  options.forEach((option) => {
    const delta = Math.abs(option.value - gallons);
    if (delta < diff) {
      diff = delta;
      closest = option.label;
    }
  });
  return closest;
}

function deriveBioLoadFromStocking(stock = {}) {
  if (stock.flags?.heavy_stock) {
    return 'Heavy';
  }
  const band = String(stock.targets?.turnover_band || '').toLowerCase();
  if (band.includes('low')) {
    return 'Light';
  }
  if (band.includes('high')) {
    return 'Heavy';
  }
  return '';
}

function deriveContextFromStocking(stock) {
  if (!stock || typeof stock !== 'object') {
    return null;
  }
  const next = {};
  const tankSize = deriveTankSizeFromStocking(stock.tank);
  if (tankSize) {
    next.tankSize = tankSize;
  }
  const bioLoad = deriveBioLoadFromStocking(stock);
  if (bioLoad) {
    next.bioLoad = bioLoad;
  }
  return Object.keys(next).length ? next : null;
}

function hydrateFromStocking() {
  let raw = null;
  try {
    raw = sessionStorage.getItem(STOCKING_STORAGE_KEY);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Stocking state unreadable', error);
    return null;
  }
  if (!raw) {
    return null;
  }
  let snapshot = null;
  try {
    snapshot = JSON.parse(raw);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Stocking state unreadable', error);
    return null;
  }
  if (snapshot?.tank && typeof snapshot.tank === 'object' && 'planted' in snapshot.tank) {
    snapshot.tank = { ...snapshot.tank };
    delete snapshot.tank.planted;
  }
  const contextPatch = deriveContextFromStocking(snapshot);
  const patch = { stocking: snapshot };
  if (contextPatch) {
    patch.context = { ...state.context, ...contextPatch };
  }
  setState(patch);
  try {
    sessionStorage.removeItem(STOCKING_STORAGE_KEY);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to clear stocking state', error);
  }
  return snapshot;
}

const state = {
  loading: true,
  error: null,
  rows: [],
  context: { ...CONTEXT_DEFAULTS },
  openCategory: readStoredOpenCategory(),
  filtrationTab: 'All',
  selectedItem: null,
  showModal: false,
  alternatives: { Budget: null, Mid: null, Premium: null },
  build: [],
  toast: null,
  stocking: null,
};

const root = document.getElementById('gear-root');
let toastTimeout = null;

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }
  if (state.showModal) {
    event.preventDefault();
    setState({ showModal: false });
  } else if (state.selectedItem) {
    event.preventDefault();
    setState({ selectedItem: null });
  }
});

function groupRows(rows, context) {
  const categories = {
    Heating: [],
    Filtration: [],
    Aeration: [],
    Lighting: [],
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
  const previousCategory = state.openCategory;
  Object.assign(state, patch);
  if (patch.openCategory !== undefined && previousCategory !== state.openCategory) {
    persistOpenCategory(state.openCategory);
  }
  if (patch.context && state.selectedItem) {
    state.alternatives = computeAlternatives(state.selectedItem);
  }
  render();
}

function scrollToAnchor(anchor) {
  if (!anchor) {
    return;
  }
  requestAnimationFrame(() => {
    const target = document.getElementById(anchor);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function handleSelectItem(item) {
  const alternatives = computeAlternatives(item);
  setState({ selectedItem: item, alternatives });
}

function handleAddToBuild(item) {
  if (!item) {
    return;
  }

  const entry = {
    name: item.Product_Name ?? 'Unnamed product',
    category: item.Category ?? '',
    specs: item.Recommended_Specs ?? '',
    link: item.Amazon_Link ?? item.Chewy_Link ?? '',
  };

  window.__build = window.__build || [];
  window.__build.push(entry);

  const nextBuild = [...state.build, entry];
  setState({ build: nextBuild });
  showToast('Added to Build');
}

function GearList(build = []) {
  const container = createElement('div', {
    className: 'build-context',
    attrs: { 'data-testid': 'gear-list' },
  });

  container.appendChild(
    createElement('div', {
      className: 'gl-head',
      text: 'Gear List',
    }),
  );

  const count = build.length;
  container.appendChild(
    createElement('div', {
      className: 'gl-count',
      text: `${count} ${count === 1 ? 'item' : 'items'}`,
    }),
  );

  if (count === 0) {
    container.appendChild(
      createElement('div', {
        className: 'gl-empty',
        text: 'Your selected items will appear here.',
      }),
    );
    return container;
  }

  const list = createElement('ul', { className: 'gl-items' });
  build.forEach((item, index) => {
    const key =
      item?.id ??
      item?.slug ??
      item?.title ??
      item?.name ??
      item?.Product_Name ??
      item?.link ??
      `item-${index}`;
    const listItem = createElement('li', {
      text: item?.title ?? item?.name ?? item?.Product_Name ?? 'Unnamed product',
    });
    listItem.setAttribute('data-key', key);
    list.appendChild(listItem);
  });

  container.appendChild(list);

  return container;
}

function showToast(message) {
  if (!message) {
    return;
  }

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    setState({ toast: null });
    toastTimeout = null;
  }, 2400);

  setState({ toast: message });
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

function Toast(message) {
  return createElement('div', {
    className: 'gear-toast',
    text: message,
    attrs: { role: 'status', 'aria-live': 'polite' },
  });
}

function GearTopAd() {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(document.createComment(' === TTG_GearTop (under hero/blurb) === '));

  const container = createElement('div', {
    className: 'ttg-adunit ttg-adunit--top',
    attrs: { id: 'ad-top-gear', 'aria-label': 'Advertisement' },
  });

  const slot = createElement('ins', {
    className: 'adsbygoogle',
    attrs: {
      style: 'display:block',
      'data-ad-client': 'ca-pub-9905718149811880',
      'data-ad-slot': '7692943403',
      'data-ad-format': 'auto',
      'data-full-width-responsive': 'true',
    },
  });

  const script = createElement('script', {
    text: '(adsbygoogle = window.adsbygoogle || []).push({});',
  });

  container.append(slot, script);
  fragment.appendChild(container);
  return fragment;
}

function render() {
  if (!root) {
    return;
  }
  clearElement(root);

  const page = createElement('div', { className: 'gear-wrap' });
  page.appendChild(GearTopAd());

  if (state.loading) {
    page.appendChild(createElement('p', { text: 'Loading gear recommendations...' }));
    root.appendChild(page);
    return;
  }

  if (state.error) {
    page.appendChild(createElement('p', { text: state.error }));
    root.appendChild(page);
    return;
  }

  const groups = groupRows(state.rows, state.context);

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
    contextBar,
    actions,
    RecommendedRow(state.rows, state.context, {
      onSelect: handleSelectItem,
      onAdd: handleAddToBuild,
    }),
    CategoryAccordion(
      groups,
      state.context,
      {
        openCategory: state.openCategory,
        filtrationTab: state.filtrationTab,
      },
      {
        onToggleCategory: (key, open) => {
          if (open) {
            setState({ openCategory: key });
          } else if (state.openCategory === key) {
            setState({ openCategory: '' });
          }
        },
        onSelect: handleSelectItem,
        onAdd: handleAddToBuild,
        onFiltrationTab: (tab) => setState({ filtrationTab: tab }),
      },
    ),
    GearList(state.build),
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

  if (state.toast) {
    page.appendChild(Toast(state.toast));
  }

  root.appendChild(page);

  if (state.selectedItem) {
    const drawer = page.querySelector('[data-testid="why-pick-drawer"]');
    const focusTarget = drawer?.querySelector('[data-focus-default]') ?? drawer?.querySelector('button');
    if (focusTarget) {
      focusTarget.focus();
    }
  }
}

async function init() {
  hydrateFromStocking();
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
