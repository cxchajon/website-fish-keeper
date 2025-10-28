import { filterByGallons, loadFiltersCatalog } from '../products/catalog-loader.js';

function getFilterProductRefs() {
  const selectEl =
    document.querySelector('#filterProduct') ||
    document.querySelector('[data-ui="filter-product"]') ||
    document.querySelector('select[name="filter-product"]') ||
    document.querySelector('#filter-product');
  const noMatchEl = document.querySelector('.no-products');

  return { selectEl, noMatchEl };
}

function resolveGallonsSource() {
  return (
    document.querySelector('[data-ui="tank-gallons"]') ||
    document.querySelector('[data-role="tank-size"]') ||
    document.querySelector('select[name="tank-size"]') ||
    document.querySelector('#tank-size')
  );
}

export async function refreshFilterProductDropdown(gallons) {
  const { selectEl, noMatchEl } = getFilterProductRefs();
  const tag = '[filter-product]';
  if (!selectEl) {
    console.error(`${tag} select element not found (check selector)`, {
      selectors: '#filterProduct, [data-ui="filter-product"], select[name="filter-product"], #filter-product',
      path: location.pathname,
    });
    return;
  }

  let list;
  try {
    list = await loadFiltersCatalog();
  } catch (error) {
    console.warn(`${tag} load failed; using empty list`, error);
    list = [];
  }

  const safeList = Array.isArray(list) ? list.slice() : [];
  const gallonsNumber = Number(gallons);
  const hasGallons = Number.isFinite(gallonsNumber);
  const { items: filtered, fallback: usedFallback } = filterByGallons(safeList, hasGallons ? gallonsNumber : null, {
    withMeta: true,
  });
  const toShow = Array.isArray(filtered) && filtered.length ? filtered.slice() : [];

  const hasConsoleGroup = typeof console.group === 'function';
  if (hasConsoleGroup) {
    console.group(tag, 'render');
  }
  console.log('gallons', hasGallons ? gallonsNumber : gallons, 'listCount', safeList.length);

  selectEl.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Select a product —';
  placeholder.disabled = true;
  placeholder.selected = true;
  selectEl.appendChild(placeholder);

  toShow.forEach((item) => {
    if (!item) return;
    const option = document.createElement('option');
    const brand = item.brand || 'Unknown';
    const model = item.model || item.name || '';
    const gph = Number.isFinite(item.gphRated) ? Number(item.gphRated) : Number(item.gph) || 0;
    const typeToken = (item.typeDeclared || item.type || 'HOB').toUpperCase();
    const labelParts = [];
    if (brand) {
      labelParts.push(brand);
    }
    if (model) {
      labelParts.push(model);
    }
    const baseLabel = labelParts.join(' ').trim() || item.id || brand;
    option.value = item.id || baseLabel.toLowerCase().replace(/\s+/g, '-');
    option.textContent = `${baseLabel} — ${gph} GPH${typeToken ? ` (${typeToken})` : ''}`;
    option.dataset.type = typeToken;
    option.dataset.typeDeclared = typeToken;
    option.dataset.brand = brand;
    option.dataset.gphRated = String(gph || 0);
    if (Number.isFinite(item?.minGallons)) {
      option.dataset.minG = String(Math.round(item.minGallons));
    }
    if (Number.isFinite(item?.maxGallons)) {
      option.dataset.maxG = String(Math.round(item.maxGallons));
    }
    if (item.url) {
      option.dataset.url = item.url;
    }
    selectEl.appendChild(option);
  });

  const optionCount = selectEl.options.length;
  const hasOptions = optionCount > 1;

  if (hasOptions) {
    noMatchEl?.classList.add('hidden');
    selectEl.style.display = 'block';
    selectEl.style.opacity = '1';
  } else {
    noMatchEl?.classList.remove('hidden');
    selectEl.style.display = 'none';
    selectEl.style.opacity = '0';
  }

  console.log(`${tag}`, 'Updated element:', selectEl, 'Options:', optionCount);
  console.log('rendered options', optionCount, '(filtered:', toShow.length, ')');
  if (typeof console.groupEnd === 'function') {
    console.groupEnd();
  }

  selectEl.dataset.fallback = usedFallback ? 'true' : 'false';
}

document.addEventListener('DOMContentLoaded', () => {
  const getGallons = () => {
    const source = resolveGallonsSource();
    const value = Number(source?.value || source?.dataset?.gallons || source?.textContent || '0');
    return Number.isFinite(value) && value > 0 ? value : 29;
  };

  refreshFilterProductDropdown(getGallons()).catch((error) => {
    console.error('[filter-product] initial render failed', error);
  });

  document.addEventListener('change', (event) => {
    const matches = event.target?.matches?.(
      '[data-ui="tank-size"], [data-role="tank-size"], select[name="tank-size"], #tank-size',
    );
    if (!matches) {
      return;
    }
    window.setTimeout(() => {
      refreshFilterProductDropdown(getGallons()).catch((error) => {
        console.error('[filter-product] refresh failed after tank-size change', error);
      });
    }, 0);
  });
});

