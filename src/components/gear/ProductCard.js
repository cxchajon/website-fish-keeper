import { createElement } from './helpers.js';
import { Badges } from './Badges.js';

function slugify(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function ProductCard(item, options = {}) {
  const { badges = [], onViewDetails, onAdd } = options;
  const slugSource = item.product_id ?? item.Product_ID ?? item.Item_ID ?? item.Product_Name ?? item.title ?? 'item';
  const card = createElement('article', {
    className: 'product-card',
    attrs: {
      'data-testid': `card-${slugify(slugSource)}`,
    },
  });

  card.append(
    createElement('header', { className: 'product-card__header' }, [
      createElement('h3', { text: item.Product_Name ?? item.title ?? 'Unnamed product' }),
      createElement('p', { className: 'product-card__use', text: item.Use_Case ?? item.use_case ?? '' }),
    ]),
    createElement('p', { className: 'product-card__spec', text: item.Recommended_Specs ?? '' }),
    Badges(badges),
  );

  const notes = item.Notes ?? item.notes;
  if (notes) {
    card.append(createElement('p', { className: 'product-card__notes', text: notes }));
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

  const links = [];
  const amazonLink = (item.Amazon_Link ?? item.amazon_url ?? '').trim();
  const chewyLink = (item.Chewy_Link ?? '').trim();
  if (amazonLink) {
    const rel = (item.rel ?? '').trim();
    const amazonRel = rel && rel.includes('sponsored') ? rel : 'sponsored noopener noreferrer';
    links.push(
      createElement('a', {
        className: 'product-card__link',
        text: 'Buy on Amazon',
        attrs: {
          href: amazonLink,
          target: '_blank',
          rel: amazonRel,
        },
      }),
    );
  }
  if (chewyLink) {
    links.push(
      createElement('a', {
        className: 'product-card__link',
        text: 'Buy on Chewy',
        attrs: {
          href: chewyLink,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    );
  }

  if (links.length) {
    const linkGroup = createElement('div', { className: 'product-card__links' });
    links.forEach((link) => linkGroup.appendChild(link));
    card.append(linkGroup);
  }

  return card;
}
