import { TANK_SIZES, getTankById, getTankLabel } from './utils.js';

const diag = (globalThis.__gearDiag = globalThis.__gearDiag || {
  scriptsLoaded: false,
  dataLoaded: false,
  ready: false,
  errors: [],
});

diag.page = 'gear';
diag.scriptsLoaded = true;

if (!Array.isArray(diag.errors)) {
  diag.errors = [];
}

const AMAZON_ASSOCIATE_TAG = 'thetankguide-20';
const AMAZON_REF_PARAM = 'ttg_gear';

const gearItemIndex = new Map();
let amazonClickBound = false;

function registerGearItem(item) {
  if (!item || !item.id) {
    return item;
  }
  const next = { ...item };
  gearItemIndex.set(next.id, next);
  return next;
}

function withAmazonVendor(item, vendor = {}) {
  const amazonVendor = {
    ...vendor,
  };
  const next = {
    ...item,
    vendor: {
      ...(item.vendor || {}),
      amazon: amazonVendor,
    },
  };
  return registerGearItem(next);
}

function getGearItem(itemId) {
  if (!itemId) return null;
  return gearItemIndex.get(itemId) ?? null;
}

function resolveAmazonVariant(item, variantId) {
  if (!item) return null;
  if (!variantId) return item.vendor?.amazon ?? null;
  const variants = Array.isArray(item.variants) ? item.variants : [];
  const variant = variants.find((entry) => entry && entry.id === variantId);
  if (!variant) {
    return item.vendor?.amazon ?? null;
  }
  if (variant.vendor?.amazon) {
    return variant.vendor.amazon;
  }
  const { asin, url } = variant;
  if (!asin && !url) {
    return item.vendor?.amazon ?? null;
  }
  return { asin, url };
}

function applyAmazonTracking(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url, 'https://www.amazon.com');
  } catch (error) {
    recordError('amazon_url_parse', error);
    return null;
  }

  if (AMAZON_ASSOCIATE_TAG) {
    parsed.searchParams.set('tag', AMAZON_ASSOCIATE_TAG);
  }
  if (AMAZON_REF_PARAM) {
    parsed.searchParams.set('ref', AMAZON_REF_PARAM);
  }

  return parsed.toString();
}

export function buildAmazonUrl(itemId, variantId, region = 'US') {
  void region; // Region support placeholder
  const item = getGearItem(itemId);
  if (!item) return null;
  const vendor = resolveAmazonVariant(item, variantId);
  if (!vendor) return null;

  if (vendor.url) {
    return applyAmazonTracking(vendor.url);
  }

  if (!vendor.asin) {
    return null;
  }

  const asin = String(vendor.asin).trim();
  if (!asin) {
    return null;
  }

  const baseUrl = `https://www.amazon.com/dp/${encodeURIComponent(asin)}`;
  return applyAmazonTracking(baseUrl);
}

const CANONICAL_TANK_IDS = new Set(TANK_SIZES.map((tank) => tank.id));

const tankProductCatalog = new Map([
  ['5g', []],
  [
    '10g',
    [
      withAmazonVendor(
        { id: 'tank10std', model: 'Aqueon 10 Gallon Standard', type: 'Standard', includes: '—', price: 69.99 },
        { url: 'https://amzn.to/3QLb10g' },
      ),
      withAmazonVendor(
        { id: 'tank10rim', model: 'Lifegard Low Iron 10G', type: 'Rimless', includes: 'mat', price: 129.99 },
        { url: 'https://amzn.to/3QKx2c4' },
      ),
    ],
  ],
  ['15g', []],
  [
    '20h',
    [
      withAmazonVendor(
        { id: 'tank20std', model: 'Aqueon 20 Gallon High', type: 'Standard', includes: '—', price: 139.99 },
        { url: 'https://amzn.to/3wZqYxp' },
      ),
      withAmazonVendor(
        { id: 'tank20aio', model: 'Fluval Flex 23G', type: 'All-in-One', includes: 'pump, media', price: 279.99 },
        { url: 'https://amzn.to/3QK2hVj' },
      ),
    ],
  ],
  [
    '20l',
    [
      withAmazonVendor(
        { id: 'tank20long', model: 'Aqueon 20 Gallon Long', type: 'Long', includes: '—', price: 149.99 },
        { url: 'https://amzn.to/4gl6i4z' },
      ),
    ],
  ],
  [
    '29g',
    [
      withAmazonVendor(
        { id: 'tank29std', model: 'Aqueon 29 Gallon', type: 'Standard', includes: '—', price: 179.99 },
        { url: 'https://amzn.to/3QQgB2C' },
      ),
      withAmazonVendor(
        { id: 'tank29rim', model: 'Seapora 29 Rimless', type: 'Rimless', includes: 'mat', price: 279.99 },
        { url: 'https://amzn.to/4hJmfZb' },
      ),
    ],
  ],
  [
    '40b',
    [
      withAmazonVendor(
        { id: 'tank40bre', model: 'Aqueon 40 Breeder', type: 'Breeder', includes: '—', price: 239.99 },
        { url: 'https://amzn.to/4gkKd99' },
      ),
      withAmazonVendor(
        { id: 'tank40rim', model: 'Innovative Marine NUVO 40', type: 'All-in-One', includes: 'media baskets', price: 449.99 },
        { url: 'https://amzn.to/3y8d18G' },
      ),
    ],
  ],
  [
    '55g',
    [
      withAmazonVendor(
        { id: 'tank55std', model: 'Aqueon 55 Gallon', type: 'Standard', includes: '—', price: 329.99 },
        { url: 'https://amzn.to/4gkLzT7' },
      ),
    ],
  ],
  [
    '75g',
    [
      withAmazonVendor(
        { id: 'tank75std', model: 'Aqueon 75 Gallon', type: 'Standard', includes: '—', price: 409.99 },
        { url: 'https://amzn.to/3y8h30d' },
      ),
    ],
  ],
  [
    '125g',
    [
      withAmazonVendor(
        { id: 'tank125std', model: 'Marineland 125 Gallon', type: 'Standard', includes: '—', price: 799.99 },
        { url: 'https://amzn.to/3W3JBjZ' },
      ),
    ],
  ],
]);

function ensureCanonicalTank(id) {
  if (!id || !CANONICAL_TANK_IDS.has(id)) {
    return null;
  }
  return getTankById(id);
}

function getCanonicalDimensions(idOrTank) {
  const tank = typeof idOrTank === 'string' ? ensureCanonicalTank(idOrTank) : idOrTank;
  if (!tank) {
    return { l: 0, w: 0, h: 0 };
  }
  const dims =
    tank.dimensionsIn ??
    tank.dimensions_in ?? {
      l: tank.lengthIn,
      w: tank.widthIn,
      h: tank.heightIn,
    };
  const pick = (value, fallback) => (Number.isFinite(value) ? value : Number.isFinite(fallback) ? fallback : 0);
  return {
    l: pick(dims?.l, tank.lengthIn),
    w: pick(dims?.w, tank.widthIn),
    h: pick(dims?.h, tank.heightIn),
  };
}

function canonicalDimsArray(idOrTank) {
  const dims = getCanonicalDimensions(idOrTank);
  const round2 = (value) => Math.round(value * 100) / 100;
  return [round2(dims.l), round2(dims.w), round2(dims.h)];
}

function formatInches(value) {
  if (!Number.isFinite(value)) {
    return '';
  }
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return rounded.toFixed(2).replace(/\.0+$/, '').replace(/0+$/, '');
}

function populateTankSelectOptions(select) {
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- Select --';
  select.appendChild(placeholder);

  TANK_SIZES.forEach(({ id, label }) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label;
    select.appendChild(option);
  });

  if (CANONICAL_TANK_IDS.has(previous)) {
    select.value = previous;
  }
}

const filtersCatalog = [
  withAmazonVendor(
    { id: 'ac50', model: 'AquaClear 50', type: 'HOB', gph: 200, rated: [20, 50], media: 'Medium', maint: 'Easy', price: 54.99 },
    { url: 'https://amzn.to/3QHWkvF' },
  ),
  withAmazonVendor(
    { id: 'ac70', model: 'AquaClear 70', type: 'HOB', gph: 300, rated: [40, 70], media: 'High', maint: 'Easy', price: 79.99 },
    { url: 'https://amzn.to/3wZl3fy' },
  ),
  withAmazonVendor(
    { id: 'fl107', model: 'Fluval 107 Canister', type: 'Canister', gph: 145, rated: [10, 30], media: 'Medium', maint: 'Moderate', price: 99.99 },
    { url: 'https://amzn.to/3QMv5yC' },
  ),
  withAmazonVendor(
    { id: 'fl207', model: 'Fluval 207 Canister', type: 'Canister', gph: 206, rated: [20, 45], media: 'Medium', maint: 'Moderate', price: 139.99 },
    { url: 'https://amzn.to/3wXlzgL' },
  ),
  withAmazonVendor(
    { id: 'fl307', model: 'Fluval 307 Canister', type: 'Canister', gph: 303, rated: [40, 70], media: 'High', maint: 'Moderate', price: 189.99 },
    { url: 'https://amzn.to/4hKiCKz' },
  ),
  withAmazonVendor(
    { id: 'tidal55', model: 'Seachem Tidal 55', type: 'HOB', gph: 250, rated: [35, 55], media: 'High', maint: 'Easy', price: 94.99 },
    { url: 'https://amzn.to/3W1fG1v' },
  ),
  withAmazonVendor(
    { id: 'spongeL', model: 'Aquaneat Dual Sponge', type: 'Sponge', gph: 120, rated: [10, 40], media: 'Low', maint: 'Easy', price: 19.99 },
    { url: 'https://amzn.to/3QLfLRo' },
  ),
];

const lightsCatalog = [
  withAmazonVendor(
    { id: 'nicrew24', model: 'NICREW ClassicLED Plus 24"', coverage: [24, 30], levels: ['low', 'med'], par12: 45, control: 'Inline dimmer', power: 24, price: 62.99 },
    { url: 'https://amzn.to/3y7XcV0' },
  ),
  withAmazonVendor(
    { id: 'nicrew30', model: 'NICREW ClassicLED Plus 30"', coverage: [30, 36], levels: ['low', 'med'], par12: 48, control: 'Inline dimmer', power: 27, price: 66.99 },
    { url: 'https://amzn.to/3QLh3nU' },
  ),
  withAmazonVendor(
    { id: 'finnex24', model: 'Finnex Planted+ 24/7 30"', coverage: [30, 36], levels: ['med', 'high'], par12: 70, control: 'Programmable', power: 33, price: 139.99 },
    { url: 'https://amzn.to/3QK6oNg' },
  ),
  withAmazonVendor(
    { id: 'fluval24', model: 'Fluval Plant 3.0 24"', coverage: [24, 30], levels: ['med', 'high'], par12: 110, control: 'App', power: 32, price: 224.99 },
    { url: 'https://amzn.to/4gkcc5A' },
  ),
  withAmazonVendor(
    { id: 'fluval36', model: 'Fluval Plant 3.0 36"', coverage: [36, 42], levels: ['med', 'high'], par12: 123, control: 'App', power: 46, price: 279.99 },
    { url: 'https://amzn.to/3QLhrc6' },
  ),
  withAmazonVendor(
    { id: 'chihiros30', model: 'Chihiros WRGB II 30"', coverage: [30, 36], levels: ['high'], par12: 150, control: 'App', power: 67, price: 199.99 },
    { url: 'https://amzn.to/3y9e5ob' },
  ),
];

const heatersCatalog = [
  withAmazonVendor(
    { id: 'aq50', model: 'Aqueon Preset 50W', type: 'Glass', watts: 50, range: [10, 20], safety: '—', price: 24.99 },
    { url: 'https://amzn.to/3W1kP4R' },
  ),
  withAmazonVendor(
    { id: 'aq100', model: 'Aqueon Preset 100W', type: 'Glass', watts: 100, range: [20, 30], safety: '—', price: 29.99 },
    { url: 'https://amzn.to/3W1lVb9' },
  ),
  withAmazonVendor(
    { id: 'tetra150', model: 'Tetra HT 150W', type: 'Glass', watts: 150, range: [30, 55], safety: 'Indicator light', price: 32.99 },
    { url: 'https://amzn.to/4hJGkKC' },
  ),
  withAmazonVendor(
    { id: 'finnex200', model: 'Finnex HPS 200W', type: 'Titanium', watts: 200, range: [40, 75], safety: 'Auto shutoff', price: 59.99 },
    { url: 'https://amzn.to/3wZU8i4' },
  ),
  withAmazonVendor(
    { id: 'hygger300', model: 'Hygger Digital 300W', type: 'Titanium', watts: 300, range: [55, 100], safety: 'Dry-run protect', price: 72.99 },
    { url: 'https://amzn.to/3y7ZauA' },
  ),
];

const addOnCatalog = [
  withAmazonVendor(
    { id: 'timer1', title: 'BN-LINK WiFi Timer', blurb: 'Automate lights and other gear', price: 18.99 },
    { url: 'https://amzn.to/4gkJb6Z' },
  ),
  withAmazonVendor(
    { id: 'baffle1', title: 'Fluval Spray Bar Kit', blurb: 'Diffuse flow from canisters', price: 21.99 },
    { url: 'https://amzn.to/4gp5AyQ' },
  ),
  withAmazonVendor(
    { id: 'gfci1', title: 'GE 6-Outlet GFCI Strip', blurb: 'Safety for humid fish rooms', price: 34.99 },
    { url: 'https://amzn.to/3QLfXef' },
  ),
];

diag.dataLoaded = true;

const state = {
  tankId: '',
  gallons: 0,
  tankLength: null,
  plantLevel: 'med',
  tankCompare: [],
  filterCompare: [],
  lightCompare: [],
  heaterCompare: [],
  cart: [],
};

const els = {};

function recordError(context, error) {
  const message = `${context}: ${error && error.message ? error.message : String(error)}`;
  diag.errors.push(message);
  console.error('[TTG gear]', message, error);
}

function showError(message) {
  if (els.error) {
    els.error.textContent = message;
    els.error.hidden = false;
  }
}

function formatPrice(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function dimsToText(dims) {
  if (!Array.isArray(dims) || dims.length < 3) {
    return '—';
  }
  const [l, w, h] = dims;
  const parts = [formatInches(l), formatInches(w), formatInches(h)].map((value) => (value ? value : '0'));
  return `${parts[0]}×${parts[1]}×${parts[2]}`;
}

function inferTankLength(tankId) {
  const dims = canonicalDimsArray(tankId);
  const length = dims[0];
  return Number.isFinite(length) && length > 0 ? length : null;
}

function ensureArrayOfObjects(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => item && typeof item === 'object');
}

function resolveCartItemUrl(item) {
  if (!item) return null;
  const url = buildAmazonUrl(item.itemId || item.id, item.variantId || null);
  if (url) {
    return url;
  }
  if (typeof item.legacyLink === 'string' && item.legacyLink) {
    return item.legacyLink;
  }
  return null;
}

function handleAmazonLinkClick(event) {
  const anchor = event.target.closest('a.btn-gear');
  if (!anchor) return;
  const itemId = anchor.dataset.itemId || anchor.getAttribute('data-item-id');
  const variantId = anchor.dataset.variantId || anchor.getAttribute('data-variant-id') || null;
  const url = buildAmazonUrl(itemId, variantId || null);
  if (!url) {
    event.preventDefault();
    anchor.removeAttribute('href');
    anchor.classList.add('is-disabled');
    anchor.setAttribute('aria-disabled', 'true');
    return;
  }
  if (anchor.href !== url) {
    anchor.href = url;
  }
  anchor.classList.remove('is-disabled');
  anchor.removeAttribute('aria-disabled');
}

function gatherCartLinks() {
  const urls = [];
  state.cart.forEach((item) => {
    const count = Math.max(1, Number(item.qty) || 1);
    for (let i = 0; i < count; i += 1) {
      const url = resolveCartItemUrl(item);
      if (url) {
        urls.push(url);
      }
    }
  });
  return urls;
}

function createBadge(text) {
  const span = document.createElement('span');
  span.className = 'chip';
  span.textContent = text;
  return span;
}

function createCard({
  title,
  subtitle,
  detail,
  price,
  itemId,
  variantId = null,
  thumb,
  badges = [],
  dataset = {},
  addToCart,
  compare,
}) {
  const card = document.createElement('div');
  card.className = 'product';
  Object.entries(dataset).forEach(([key, value]) => {
    card.dataset[key] = String(value);
  });

  card.innerHTML = `
    <div class="thumb">${thumb}</div>
    <div class="title">${title}</div>
    <div class="sub">${subtitle}</div>
    ${detail ? `<div class="sub">${detail}</div>` : ''}
    <div class="price">${formatPrice(price)}</div>
    <div class="row" style="justify-content:space-between;">
      <a class="btn btn-gear" target="_blank" rel="noopener noreferrer">View on Amazon</a>
      <div class="row"></div>
    </div>
  `;

  const anchor = card.querySelector('.btn-gear');
  if (anchor) {
    if (itemId) {
      anchor.dataset.itemId = itemId;
    }
    if (variantId) {
      anchor.dataset.variantId = variantId;
    } else {
      anchor.dataset.variantId = '';
    }
    const url = buildAmazonUrl(itemId, variantId || null);
    if (url) {
      anchor.href = url;
      anchor.removeAttribute('aria-disabled');
      anchor.classList.remove('is-disabled');
    } else {
      anchor.removeAttribute('href');
      anchor.setAttribute('aria-disabled', 'true');
      anchor.classList.add('is-disabled');
    }
  }

  const buttonRow = card.querySelector('.row:last-child .row');
  const addButton = document.createElement('button');
  addButton.className = 'btn add-cart';
  addButton.type = 'button';
  addButton.textContent = 'Add to Cart';
  addButton.addEventListener('click', () => addToCart && addToCart());
  buttonRow.appendChild(addButton);

  if (compare) {
    const label = document.createElement('label');
    label.className = 'chk';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'compare-toggle';
    input.checked = Boolean(compare.checked);
    input.addEventListener('change', (event) => {
      compare.onToggle(Boolean(event.target.checked));
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode(' Compare'));
    buttonRow.appendChild(label);
  }

  if (badges.length) {
    const badgeRow = document.createElement('div');
    badgeRow.className = 'row';
    badges.forEach((text) => badgeRow.appendChild(createBadge(text)));
    card.insertBefore(badgeRow, card.querySelector('.price'));
  }

  return card;
}

function renderTankOptions() {
  const container = els.tankOptions;
  container.innerHTML = '';
  const tank = ensureCanonicalTank(state.tankId);
  if (!tank) {
    els.sizeChip.hidden = true;
    container.innerHTML = '<p class="muted">Choose a tank size to see recommended models.</p>';
    return;
  }

  const label = getTankLabel(tank.id) || `${tank.gallons} Gallon`;
  const dims = canonicalDimsArray(tank);
  const volume = Math.round((dims[0] * dims[1] * dims[2]) / 231);
  const footprint = (dims[0] * dims[1]).toFixed(0);
  const products = tankProductCatalog.get(tank.id) ?? [];
  const gallonsText = Number.isFinite(tank.gallons) ? `${tank.gallons} gal` : `~${volume} gal`;

  els.sizeChip.textContent = label;
  els.sizeChip.hidden = false;

  if (!products.length) {
    container.innerHTML = `<p class="muted">No tank data yet for ${label}.</p>`;
    return;
  }

  products.forEach((product) => {
    const card = createCard({
      itemId: product.id,
      title: product.model,
      subtitle: `${product.type} • ${dimsToText(dims)} • ${gallonsText}`,
      detail: `Includes: ${product.includes}`,
      price: product.price,
      thumb: `${product.model}\n${product.type}`,
      addToCart: () =>
        addItemToCart({
          id: product.id,
          itemId: product.id,
          title: product.model,
          category: 'Tank',
          price: product.price,
        }),
      compare: {
        checked: state.tankCompare.some((entry) => entry.id === product.id),
        onToggle: (checked) =>
          toggleTankCompare(
            {
              ...product,
              tankId: tank.id,
              tankLabel: label,
              dims,
              gallons: tank.gallons,
            },
            checked,
          ),
      },
    });
    card.dataset.footprint = footprint;
    container.appendChild(card);
  });
}

function toggleTankCompare(tank, checked) {
  const existingIndex = state.tankCompare.findIndex((entry) => entry.id === tank.id);
  if (checked) {
    if (existingIndex === -1) {
      if (state.tankCompare.length >= 3) {
        renderTankOptions();
        return;
      }
      state.tankCompare.push(tank);
    }
  } else if (existingIndex >= 0) {
    state.tankCompare.splice(existingIndex, 1);
  }
  renderTankCompare();
}

function renderTankCompare() {
  const wrap = els.tankCompareWrap;
  const body = els.tankCompareBody;
  body.innerHTML = '';
  if (state.tankCompare.length > 1) {
    wrap.hidden = false;
    state.tankCompare.forEach((tank) => {
      const volume = Math.round((tank.dims[0] * tank.dims[1] * tank.dims[2]) / 231);
      const footprint = (tank.dims[0] * tank.dims[1]).toFixed(0);
      const gallons = Number.isFinite(tank.gallons) && tank.gallons > 0 ? tank.gallons : volume;
      const heightText = formatInches(tank.dims[2]);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${tank.model}</td>
        <td>${tank.type}</td>
        <td>${dimsToText(tank.dims)}</td>
        <td>${footprint}</td>
        <td>${heightText}</td>
        <td>${gallons}</td>
        <td>${tank.includes}</td>
        <td>${formatPrice(tank.price)}</td>
      `;
      body.appendChild(row);
    });
  } else {
    wrap.hidden = true;
  }
}

function renderFilters() {
  const container = els.filterOptions;
  container.innerHTML = '';
  const gallons = state.gallons;
  if (!gallons) {
    container.innerHTML = '<p class="muted">Choose a tank size to calculate turnover.</p>';
    return;
  }

  const eligible = filtersCatalog.filter((filter) => gallons >= filter.rated[0] && gallons <= filter.rated[1]);
  if (!eligible.length) {
    container.innerHTML = '<p class="muted">No filters matched that size. Try a different gallon range.</p>';
    return;
  }

  eligible.forEach((filter) => {
    const turnover = Number((filter.gph / gallons).toFixed(1));
    const target = 8.5;
    const diff = Math.abs(turnover - target);
    let badgeText = `≈${turnover.toFixed(1)}× turnover`;
    if (diff <= 1.5) badgeText += ' • on target';
    else if (turnover < 7) badgeText += ' • boost flow';
    else if (turnover > 10.5) badgeText += ' • throttle if needed';

    const card = createCard({
      itemId: filter.id,
      title: filter.model,
      subtitle: `${filter.type.toUpperCase()} • Rated ${filter.rated[0]}–${filter.rated[1]} gal`,
      detail: `Flow ${filter.gph} GPH (${badgeText}) • Media: ${filter.media} • Maintenance: ${filter.maint}`,
      price: filter.price,
      thumb: `${filter.model}\n${filter.type}`,
      dataset: { gph: filter.gph, turnover },
      addToCart: () =>
        addItemToCart({
          id: filter.id,
          itemId: filter.id,
          title: filter.model,
          category: 'Filter',
          price: filter.price,
        }),
      compare: {
        checked: state.filterCompare.some((entry) => entry.id === filter.id),
        onToggle: (checked) => toggleFilterCompare(filter, checked),
      },
    });
    container.appendChild(card);
  });
}

function toggleFilterCompare(filter, checked) {
  const existingIndex = state.filterCompare.findIndex((entry) => entry.id === filter.id);
  if (checked) {
    if (existingIndex === -1) {
      if (state.filterCompare.length >= 3) {
        renderFilters();
        return;
      }
      state.filterCompare.push(filter);
    }
  } else if (existingIndex >= 0) {
    state.filterCompare.splice(existingIndex, 1);
  }
  renderFilterCompare();
}

function renderFilterCompare() {
  const wrap = els.filterCompareWrap;
  const body = els.filterCompareBody;
  body.innerHTML = '';
  if (state.filterCompare.length > 1) {
    wrap.hidden = false;
    state.filterCompare.forEach((filter) => {
      const turnover = state.gallons ? (filter.gph / state.gallons).toFixed(1) : '—';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${filter.model}</td>
        <td>${filter.type}</td>
        <td>${filter.rated[0]}–${filter.rated[1]} gal</td>
        <td>${filter.gph}</td>
        <td>${turnover}</td>
        <td>${filter.media}</td>
        <td>${filter.maint}</td>
        <td>${formatPrice(filter.price)}</td>
      `;
      body.appendChild(row);
    });
  } else {
    wrap.hidden = true;
  }
}

function renderLights() {
  const container = els.lightOptions;
  container.innerHTML = '';
  const plantLevel = state.plantLevel;
  if (!state.tankId) {
    els.lengthChip.hidden = true;
    container.innerHTML = '<p class="muted">Choose a tank size first.</p>';
    return;
  }

  const tankLength = state.tankLength;
  if (tankLength) {
    const lengthText = formatInches(tankLength);
    els.lengthChip.textContent = `Longest footprint: ${lengthText}\" — aim for lights covering ≥ ${lengthText}\"`;
    els.lengthChip.hidden = false;
  } else {
    els.lengthChip.hidden = true;
  }

  const eligible = lightsCatalog.filter((light) => light.levels.includes(plantLevel) && (!tankLength || tankLength <= light.coverage[1] + 0.001));
  eligible.sort((a, b) => a.coverage[0] - b.coverage[0]);

  if (!eligible.length) {
    container.innerHTML = '<p class="muted">No lights match that plant level yet. Try a different selection.</p>';
    return;
  }

  eligible.forEach((light) => {
    const coverageText = `${light.coverage[0]}–${light.coverage[1]}\" coverage`;
    let hint = 'Ideal coverage';
    if (tankLength && tankLength < light.coverage[0]) {
      hint = 'One size up for even coverage';
    } else if (tankLength && tankLength > light.coverage[1]) {
      hint = 'Requires a larger fixture';
    }
    const badge = `${coverageText} • PAR @12\": ${light.par12}`;
    const card = createCard({
      itemId: light.id,
      title: light.model,
      subtitle: `${coverageText} • Supports ${light.levels.map((level) => level.toUpperCase()).join('/')}`,
      detail: `${hint} • Control: ${light.control} • Power: ${light.power}W`,
      price: light.price,
      thumb: `${light.model}\nLighting`,
      badges: [badge, hint],
      dataset: { coverage: `${light.coverage[0]}-${light.coverage[1]}`, plant: light.levels.join(',') },
      addToCart: () =>
        addItemToCart({
          id: light.id,
          itemId: light.id,
          title: light.model,
          category: 'Light',
          price: light.price,
        }),
      compare: {
        checked: state.lightCompare.some((entry) => entry.id === light.id),
        onToggle: (checked) => toggleLightCompare(light, checked),
      },
    });
    container.appendChild(card);
  });
}

function toggleLightCompare(light, checked) {
  const existingIndex = state.lightCompare.findIndex((entry) => entry.id === light.id);
  if (checked) {
    if (existingIndex === -1) {
      if (state.lightCompare.length >= 3) {
        renderLights();
        return;
      }
      state.lightCompare.push(light);
    }
  } else if (existingIndex >= 0) {
    state.lightCompare.splice(existingIndex, 1);
  }
  renderLightCompare();
}

function renderLightCompare() {
  const wrap = els.lightCompareWrap;
  const body = els.lightCompareBody;
  body.innerHTML = '';
  if (state.lightCompare.length > 1) {
    wrap.hidden = false;
    state.lightCompare.forEach((light) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${light.model}</td>
        <td>${light.coverage[0]}–${light.coverage[1]}\"</td>
        <td>${light.levels.join(', ').toUpperCase()}</td>
        <td>${light.par12}</td>
        <td>${light.control}</td>
        <td>${light.power}W</td>
        <td>${formatPrice(light.price)}</td>
      `;
      body.appendChild(row);
    });
  } else {
    wrap.hidden = true;
  }
}

function renderHeaters() {
  const container = els.heaterOptions;
  container.innerHTML = '';
  const gallons = state.gallons;
  if (!gallons) {
    if (els.heaterTarget) els.heaterTarget.hidden = true;
    if (els.heaterRedundancy) els.heaterRedundancy.hidden = true;
    container.innerHTML = '<p class="muted">Choose a tank size to see heater wattage targets.</p>';
    return;
  }

  const targetWatts = Math.round(gallons * 4);
  const redundancy = Math.round(targetWatts / 2);
  if (els.heaterTarget) {
    els.heaterTarget.textContent = `Target: ~${targetWatts} W (≈4 W/gal)`;
    els.heaterTarget.hidden = false;
  }
  if (els.heaterRedundancy) {
    els.heaterRedundancy.textContent = `Redundancy: 2 × ${redundancy} W`;
    els.heaterRedundancy.hidden = false;
  }

  const eligible = heatersCatalog.filter((heater) => gallons >= heater.range[0] && gallons <= heater.range[1]);
  if (!eligible.length) {
    container.innerHTML = '<p class="muted">No heater matched that size. Consider two smaller heaters for redundancy.</p>';
    return;
  }

  eligible.forEach((heater) => {
    const meetsTarget = heater.watts >= targetWatts;
    const nearTarget = !meetsTarget && heater.watts >= Math.round(targetWatts * 0.8);
    const badge = meetsTarget ? 'Meets ~4 W/gal target' : nearTarget ? 'Near target — consider dual heaters' : 'Below target — use two units';
    const card = createCard({
      itemId: heater.id,
      title: heater.model,
      subtitle: `${heater.type.toUpperCase()} • ${heater.watts}W • Rated ${heater.range[0]}–${heater.range[1]} gal`,
      detail: `Safety: ${heater.safety}`,
      price: heater.price,
      thumb: `${heater.model}\n${heater.watts} W`,
      badges: [badge],
      addToCart: () =>
        addItemToCart({
          id: heater.id,
          itemId: heater.id,
          title: heater.model,
          category: 'Heater',
          price: heater.price,
        }),
      compare: {
        checked: state.heaterCompare.some((entry) => entry.id === heater.id),
        onToggle: (checked) => toggleHeaterCompare(heater, checked),
      },
    });
    card.dataset.watts = heater.watts;
    container.appendChild(card);
  });
}

function toggleHeaterCompare(heater, checked) {
  const existingIndex = state.heaterCompare.findIndex((entry) => entry.id === heater.id);
  if (checked) {
    if (existingIndex === -1) {
      if (state.heaterCompare.length >= 3) {
        renderHeaters();
        return;
      }
      state.heaterCompare.push(heater);
    }
  } else if (existingIndex >= 0) {
    state.heaterCompare.splice(existingIndex, 1);
  }
  renderHeaterCompare();
}

function renderHeaterCompare() {
  const wrap = els.heaterCompareWrap;
  const body = els.heaterCompareBody;
  body.innerHTML = '';
  if (state.heaterCompare.length > 1) {
    wrap.hidden = false;
    state.heaterCompare.forEach((heater) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${heater.model}</td>
        <td>${heater.type}</td>
        <td>${heater.watts}W</td>
        <td>${heater.range[0]}–${heater.range[1]} gal</td>
        <td>${heater.safety}</td>
        <td>${formatPrice(heater.price)}</td>
      `;
      body.appendChild(row);
    });
  } else {
    wrap.hidden = true;
  }
}

function renderAddOns() {
  const container = els.addonOptions;
  if (!container) return;
  container.innerHTML = '';
  addOnCatalog.forEach((item) => {
    const card = createCard({
      itemId: item.id,
      title: item.title,
      subtitle: item.blurb,
      detail: '',
      price: item.price,
      thumb: item.title,
      addToCart: () =>
        addItemToCart({
          id: item.id,
          itemId: item.id,
          title: item.title,
          category: 'Add-on',
          price: item.price,
        }),
    });
    container.appendChild(card);
  });
}

const CART_KEY = 'ttg_cart_v2';

function loadCartFromStorage() {
  try {
    const raw = globalThis.localStorage ? localStorage.getItem(CART_KEY) : null;
    if (!raw) {
      state.cart = [];
      return;
    }
    const parsed = JSON.parse(raw);
    state.cart = ensureArrayOfObjects(parsed).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      price: Number(item.price) || 0,
      qty: Math.max(1, Number(item.qty) || 1),
      key: item.key || item.cartKey || item.id,
      itemId: item.itemId || item.id,
      variantId: item.variantId || null,
      legacyLink:
        typeof item.link === 'string' && item.link
          ? item.link
          : typeof item.legacyLink === 'string' && item.legacyLink
            ? item.legacyLink
            : null,
    }));
  } catch (error) {
    recordError('cart_load', error);
    state.cart = [];
  }
}

function saveCartToStorage() {
  try {
    if (!globalThis.localStorage) return;
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  } catch (error) {
    recordError('cart_save', error);
  }
}

function addItemToCart(item) {
  if (!item || !item.id) return;
  const itemId = item.itemId || item.id;
  const variantId = item.variantId || null;
  const legacyLink = item.link || item.legacyLink || null;
  const key = item.key || item.cartKey || (variantId ? `${item.id}::${variantId}` : item.id);
  const existing = state.cart.find((entry) => entry.key === key || entry.id === key);
  if (existing) {
    existing.qty = Math.max(1, Number(existing.qty) || 1) + 1;
    existing.itemId = existing.itemId || itemId;
    existing.variantId = existing.variantId || variantId;
    existing.legacyLink = existing.legacyLink || legacyLink;
    existing.title = existing.title || item.title;
    existing.category = existing.category || item.category;
    existing.price = Number(existing.price) || Number(item.price) || 0;
    existing.key = existing.key || key;
  } else {
    state.cart.push({
      id: item.id,
      title: item.title,
      category: item.category,
      price: Number(item.price) || 0,
      qty: 1,
      itemId,
      variantId,
      legacyLink,
      key,
    });
  }
  saveCartToStorage();
  renderCart();
}

function changeCartQty(key, delta) {
  const item = state.cart.find((entry) => entry.key === key || entry.id === key);
  if (!item) return;
  const next = Math.max(1, (Number(item.qty) || 1) + delta);
  item.qty = next;
  saveCartToStorage();
  renderCart();
}

function removeCartItem(key) {
  state.cart = state.cart.filter((entry) => entry.key !== key && entry.id !== key);
  saveCartToStorage();
  renderCart();
}

function clearCart() {
  if (!state.cart.length) return;
  state.cart = [];
  saveCartToStorage();
  renderCart();
}

function renderCart() {
  const list = els.cartItems;
  list.innerHTML = '';
  let total = 0;
  let count = 0;
  state.cart.forEach((item) => {
    const qty = Math.max(1, Number(item.qty) || 1);
    total += (Number(item.price) || 0) * qty;
    count += qty;
    const line = document.createElement('div');
    line.className = 'cart-line';
    line.innerHTML = `
      <div class="title">${item.title}</div>
      <div class="sub">${item.category} • Qty: ${qty}</div>
      <div class="row">
        <a class="btn btn-gear" target="_blank" rel="noopener noreferrer">View on Amazon</a>
        <div class="cart-actions">
          <button class="ghost-btn" type="button" data-action="dec">−</button>
          <button class="ghost-btn" type="button" data-action="inc">+</button>
          <button class="ghost-btn" type="button" data-action="remove">Remove</button>
        </div>
      </div>
    `;
    const anchor = line.querySelector('.btn-gear');
    if (anchor) {
      if (item.itemId || item.id) {
        anchor.dataset.itemId = item.itemId || item.id;
      }
      if (item.variantId) {
        anchor.dataset.variantId = item.variantId;
      } else {
        anchor.dataset.variantId = '';
      }
      const url = resolveCartItemUrl(item);
      if (url) {
        anchor.href = url;
        anchor.classList.remove('is-disabled');
        anchor.removeAttribute('aria-disabled');
      } else {
        anchor.removeAttribute('href');
        anchor.classList.add('is-disabled');
        anchor.setAttribute('aria-disabled', 'true');
      }
    }
    const actions = line.querySelector('.cart-actions');
    const cartKey = item.key || item.id;
    actions.querySelector('[data-action="dec"]').addEventListener('click', () => changeCartQty(cartKey, -1));
    actions.querySelector('[data-action="inc"]').addEventListener('click', () => changeCartQty(cartKey, 1));
    actions.querySelector('[data-action="remove"]').addEventListener('click', () => removeCartItem(cartKey));
    list.appendChild(line);
  });

  els.cartCount.textContent = String(count);
  els.cartTotal.textContent = total.toFixed(2);
  els.cartBuyAll.disabled = state.cart.length === 0;
  els.cartClear.disabled = state.cart.length === 0;
  updateCartModalContent();
}

function updateCartModalContent() {
  if (els.modalBackdrop.hidden) {
    return;
  }
  const items = state.cart;
  const list = els.modalList;
  const textarea = els.modalTextarea;
  const status = els.modalCopyStatus;
  list.innerHTML = '';
  const urls = gatherCartLinks();
  items.forEach((item) => {
    const line = document.createElement('div');
    line.className = 'row';
    line.innerHTML = `<div>${item.title} × ${item.qty}</div><a class="btn-gear" target="_blank" rel="noopener noreferrer">Open</a>`;
    const anchor = line.querySelector('.btn-gear');
    if (anchor) {
      if (item.itemId || item.id) {
        anchor.dataset.itemId = item.itemId || item.id;
      }
      if (item.variantId) {
        anchor.dataset.variantId = item.variantId;
      } else {
        anchor.dataset.variantId = '';
      }
      const url = resolveCartItemUrl(item);
      if (url) {
        anchor.href = url;
        anchor.classList.remove('is-disabled');
        anchor.removeAttribute('aria-disabled');
      } else {
        anchor.removeAttribute('href');
        anchor.classList.add('is-disabled');
        anchor.setAttribute('aria-disabled', 'true');
      }
    }
    list.appendChild(line);
  });
  textarea.value = urls.join('\n');
  status.textContent = urls.length ? '' : 'Cart is empty — add items to enable bulk actions.';
}

function openCartModal() {
  if (!state.cart.length) {
    els.modalCopyStatus.textContent = 'Cart is empty — add items first.';
  }
  els.modalBackdrop.hidden = false;
  updateCartModalContent();
}

function closeCartModal() {
  els.modalBackdrop.hidden = true;
}

function openAllLinks() {
  const urls = gatherCartLinks();
  const status = els.modalCopyStatus;
  if (!urls.length) {
    status.textContent = 'Cart is empty — nothing to open.';
    return;
  }
  const blocked = [];
  urls.forEach((url) => {
    const win = window.open(url, '_blank', 'noopener');
    if (!win) {
      blocked.push(url);
    }
  });
  status.textContent = blocked.length
    ? 'Some popups were blocked. Copy the list below and paste manually.'
    : `Opened ${urls.length} link(s).`;
}

async function copyAllLinks() {
  const urls = gatherCartLinks();
  const status = els.modalCopyStatus;
  if (!urls.length) {
    status.textContent = 'Cart is empty — nothing to copy.';
    return;
  }
  const text = urls.join('\n');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Links copied to clipboard!';
    } else {
      els.modalTextarea.removeAttribute('readonly');
      els.modalTextarea.select();
      const success = document.execCommand('copy');
      els.modalTextarea.setAttribute('readonly', 'true');
      status.textContent = success ? 'Links copied to clipboard!' : 'Copy failed — select and copy manually.';
    }
  } catch (error) {
    recordError('copy_links', error);
    els.modalTextarea.setAttribute('readonly', 'true');
    status.textContent = 'Copy failed — select the list manually.';
  }
}

function bindEvents() {
  els.tankSelect.addEventListener('change', () => {
    state.tankId = els.tankSelect.value;
    const selectedTank = ensureCanonicalTank(state.tankId);
    state.gallons = selectedTank?.gallons ?? 0;
    state.tankLength = selectedTank ? inferTankLength(selectedTank.id) : null;
    state.tankCompare = [];
    state.filterCompare = [];
    state.lightCompare = [];
    state.heaterCompare = [];
    renderTankOptions();
    renderTankCompare();
    renderFilters();
    renderFilterCompare();
    renderLights();
    renderLightCompare();
    renderHeaters();
    renderHeaterCompare();
  });

  els.plantSelect.addEventListener('change', () => {
    state.plantLevel = els.plantSelect.value;
    renderLights();
    renderLightCompare();
  });

  els.cartBuyAll.addEventListener('click', () => {
    openCartModal();
  });

  els.cartClear.addEventListener('click', () => {
    clearCart();
  });

  els.modalClose.addEventListener('click', () => {
    closeCartModal();
  });

  els.modalBackdrop.addEventListener('click', (event) => {
    if (event.target === els.modalBackdrop) {
      closeCartModal();
    }
  });

  els.modalOpenAll.addEventListener('click', () => {
    openAllLinks();
  });

  els.modalCopy.addEventListener('click', () => {
    copyAllLinks();
  });

  if (!amazonClickBound) {
    document.addEventListener('click', handleAmazonLinkClick);
    amazonClickBound = true;
  }
}

function cacheElements() {
  Object.assign(els, {
    tankSelect: document.getElementById('tank-size'),
    sizeChip: document.getElementById('size-chip'),
    tankOptions: document.getElementById('tank-options'),
    tankCompareWrap: document.getElementById('tank-compare'),
    tankCompareBody: document.getElementById('tank-compare-body'),
    filterOptions: document.getElementById('filter-options'),
    filterCompareWrap: document.getElementById('filter-compare'),
    filterCompareBody: document.getElementById('filter-compare-body'),
    lightOptions: document.getElementById('light-options'),
    lightCompareWrap: document.getElementById('light-compare'),
    lightCompareBody: document.getElementById('light-compare-body'),
    heaterOptions: document.getElementById('heater-options'),
    heaterCompareWrap: document.getElementById('heater-compare'),
    heaterCompareBody: document.getElementById('heater-compare-body'),
    heaterTarget: document.getElementById('heater-target'),
    heaterRedundancy: document.getElementById('heater-redundancy'),
    plantSelect: document.getElementById('plant-level'),
    lengthChip: document.getElementById('length-chip'),
    addonOptions: document.getElementById('addon-options'),
    cartCount: document.getElementById('cart-count'),
    cartTotal: document.getElementById('cart-total'),
    cartItems: document.getElementById('cart-items'),
    cartBuyAll: document.getElementById('cart-buy-all'),
    cartClear: document.getElementById('cart-clear'),
    modalBackdrop: document.getElementById('cart-modal-backdrop'),
    modalList: document.getElementById('cart-modal-list'),
    modalTextarea: document.getElementById('cart-modal-textarea'),
    modalCopyStatus: document.getElementById('cart-modal-copy-status'),
    modalClose: document.getElementById('cart-modal-close'),
    modalOpenAll: document.getElementById('cart-open-all'),
    modalCopy: document.getElementById('cart-copy'),
    error: document.getElementById('gear-error'),
  });

  const missing = Object.entries(els)
    .filter(([, el]) => !el)
    .map(([key]) => key);
  if (missing.length) {
    showError('Page failed to initialise — missing DOM nodes.');
    recordError('missing_elements', missing.join(', '));
    throw new Error(`Missing DOM nodes: ${missing.join(', ')}`);
  }
}

function initialise() {
  try {
    cacheElements();
    populateTankSelectOptions(els.tankSelect);
    state.tankId = CANONICAL_TANK_IDS.has(els.tankSelect.value) ? els.tankSelect.value : '';
    const selectedTank = ensureCanonicalTank(state.tankId);
    state.gallons = selectedTank?.gallons ?? 0;
    state.tankLength = selectedTank ? inferTankLength(selectedTank.id) : null;
    state.plantLevel = els.plantSelect.value || 'med';
    renderAddOns();
    loadCartFromStorage();
    bindEvents();
    renderTankOptions();
    renderTankCompare();
    renderFilters();
    renderFilterCompare();
    renderLights();
    renderLightCompare();
    renderHeaters();
    renderHeaterCompare();
    renderCart();
    diag.ready = true;
  } catch (error) {
    recordError('init', error);
    showError('We were unable to start the gear advisor. Please refresh or try again later.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialise, { once: true });
} else {
  initialise();
}
