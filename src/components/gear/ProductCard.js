import { createElement } from './helpers.js';
import { Badges } from './Badges.js';

function slugify(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function ProductCard(item, options = {}) {
  const { badges = [], onViewDetails, onAdd } = options;
  const card = createElement('article', {
    className: 'product-card',
    attrs: {
      'data-testid': `card-${slugify(item.Product_Name ?? 'item')}`,
    },
  });

  card.append(
    createElement('header', { className: 'product-card__header' }, [
      createElement('h3', { text: item.Product_Name ?? 'Unnamed product' }),
      createElement('p', { className: 'product-card__use', text: item.Use_Case ?? '' }),
    ]),
    createElement('p', { className: 'product-card__spec', text: item.Recommended_Specs ?? '' }),
    Badges(badges),
  );

  if (item.Notes) {
    card.append(createElement('p', { className: 'product-card__notes', text: item.Notes }));
  }

  const actions = createElement('div', { className: 'product-card__actions' });

  const detailsButton = createElement('button', {
    className: 'btn secondary',
    text: 'View Details',
    attrs: { type: 'button' },
  });
  detailsButton.addEventListener('click', () => {
    onViewDetails?.(item);
  });

  const addButton = createElement('button', {
    className: 'btn primary',
    text: 'Add to Build',
    attrs: { type: 'button' },
  });
  addButton.addEventListener('click', () => {
    onAdd?.(item);
  });

  actions.append(detailsButton, addButton);
  card.append(actions);

  return card;
}
