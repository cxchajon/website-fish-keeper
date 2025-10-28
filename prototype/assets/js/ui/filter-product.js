import { FALLBACK_LIST, loadFilterCatalogRaw } from '../products/catalog-loader.js';

function findSelectEl() {
  return (
    document.querySelector('[data-ui="filter-product"]') ||
    document.querySelector('select[name="filter-product"]') ||
    document.querySelector('#filter-product') ||
    document.querySelector('select[name="filterProduct"]') ||
    document.querySelector('#filterProduct')
  );
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
  const selectEl = findSelectEl();
  const tag = '[filter-product]';
  if (!selectEl) {
    console.error(`${tag} select element not found (check selector)`, {
      selectors: '[data-ui="filter-product"], select[name="filter-product"], #filter-product',
      path: location.pathname,
    });
    return;
  }

  let list;
  try {
    list = await loadFilterCatalogRaw();
  } catch (error) {
    console.warn(`${tag} load failed, forcing fallback list`, error);
    list = null;
  }

  const safeList = Array.isArray(list) && list.length ? list : FALLBACK_LIST;
  if (!Array.isArray(list) || !list.length) {
    console.info(`${tag} loader returned empty payload; using FALLBACK_LIST`, {
      source: 'refresh-filter-product',
      path: location.pathname,
    });
  }

  const toSlice = Array.isArray(safeList) ? safeList.slice() : [];
  const gallonsNumber = Number(gallons);
  const hasGallons = Number.isFinite(gallonsNumber);
  const filtered = toSlice.filter((item) => {
    const min = Number.isFinite(item?.minGallons) ? item.minGallons : -Infinity;
    const max = Number.isFinite(item?.maxGallons) ? item.maxGallons : Infinity;
    if (!hasGallons) return true;
    return gallonsNumber >= min && gallonsNumber <= max;
  });

  const toShow = filtered.length ? filtered : toSlice;

  const hasConsoleGroup = typeof console.group === 'function';
  if (hasConsoleGroup) {
    console.group(tag, 'render');
  }
  console.log('gallons', hasGallons ? gallonsNumber : gallons, 'listCount', toSlice.length);

  selectEl.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Select a product —';
  placeholder.disabled = true;
  placeholder.selected = true;
  selectEl.appendChild(placeholder);

  toShow
    .slice()
    .sort((a, b) =>
      (a?.type || '').localeCompare(b?.type || '') ||
      (a?.brand || '').localeCompare(b?.brand || '') ||
      (Number(a?.gphRated) || 0) - (Number(b?.gphRated) || 0)
    )
    .forEach((item) => {
      if (!item) return;
      const option = document.createElement('option');
      const brand = item.brand || 'Unknown';
      const model = item.model || '';
      const type = item.type ? ` (${item.type})` : '';
      const gph = Number.isFinite(item.gphRated) ? item.gphRated : Number(item.gph) || 0;
      option.value = item.id || `${brand.toLowerCase()}-${model.toLowerCase()}`;
      option.textContent = `${brand} ${model}`.trim() + ` — ${gph} GPH${type}`;
      option.dataset.type = (item.type || 'UNKNOWN').toUpperCase();
      option.dataset.brand = brand;
      option.dataset.gphRated = gph || 0;
      if (Number.isFinite(item?.minGallons)) {
        option.dataset.minG = String(item.minGallons);
      }
      if (Number.isFinite(item?.maxGallons)) {
        option.dataset.maxG = String(item.maxGallons);
      }
      selectEl.appendChild(option);
    });

  console.log('rendered options', selectEl.options.length, '(filtered:', filtered.length, ')');
  if (typeof console.groupEnd === 'function') {
    console.groupEnd();
  }
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

