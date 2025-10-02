import { createElement } from './helpers.js';
import { inferBadges, scoreItem, getNormalizedBudget } from '../../utils/rankers.js';

function createRecommendedCard(slot, item, context, onSelect, onAdd) {
  if (!item) {
    return createElement('div', {
      className: 'recommended-card recommended-card--empty',
    }, [
      createElement('h3', { text: slot }),
      createElement('p', { text: 'Coming soon' }),
    ]);
  }

  const card = createElement('div', {
    className: 'recommended-card',
    attrs: { 'data-testid': `recommended-${slot.toLowerCase()}` },
  });
  const badgeList = inferBadges(item, context);
  card.append(
    createElement('header', { className: 'recommended-card__header' }, [
      createElement('span', { className: 'recommended-card__slot', text: slot }),
      createElement('h3', { text: item.Product_Name ?? 'Unnamed product' }),
    ]),
    createElement('p', { className: 'recommended-card__spec', text: item.Recommended_Specs ?? '' }),
    createElement('p', { className: 'recommended-card__notes', text: item.Notes ?? '' }),
  );

  if (badgeList.length) {
    const badgeContainer = createElement('div', { className: 'recommended-card__badges' });
    badgeList.forEach((badge) => {
      badgeContainer.appendChild(createElement('span', {
        className: 'badge',
        text: `[${badge}]`,
      }));
    });
    card.append(badgeContainer);
  }

  const actions = createElement('div', { className: 'recommended-card__actions' });
  const detailButton = createElement('button', {
    className: 'btn secondary',
    text: 'View Details',
    attrs: { type: 'button' },
  });
  detailButton.addEventListener('click', () => onSelect(item));

  const addButton = createElement('button', {
    className: 'btn primary',
    text: 'Add to Build',
    attrs: { type: 'button' },
  });
  addButton.addEventListener('click', () => onAdd(item));

  actions.append(detailButton, addButton);
  card.append(actions);

  const amazonLink = (item.Amazon_Link ?? '').trim();
  const chewyLink = (item.Chewy_Link ?? '').trim();
  if (amazonLink || chewyLink) {
    const linkGroup = createElement('div', { className: 'recommended-card__links' });
    if (amazonLink) {
      linkGroup.appendChild(
        createElement('a', {
          className: 'btn link',
          text: 'Buy on Amazon',
          attrs: {
            href: amazonLink,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }),
      );
    }
    if (chewyLink) {
      linkGroup.appendChild(
        createElement('a', {
          className: 'btn link',
          text: 'Buy on Chewy',
          attrs: {
            href: chewyLink,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }),
      );
    }
    card.append(linkGroup);
  }

  return card;
}

function selectTopItem(items, context) {
  if (!items.length) {
    return undefined;
  }
  const sorted = [...items].sort((a, b) => scoreItem(b, context) - scoreItem(a, context));
  if (context.budget !== 'Any') {
    const match = sorted.find((item) => getNormalizedBudget(item) === context.budget);
    if (match) {
      return match;
    }
  }
  return sorted[0];
}

export function RecommendedRow(rows, context, handlers) {
  const { onSelect, onAdd } = handlers;
  const container = createElement('section', {
    className: 'recommended-row',
    attrs: { 'data-testid': 'recommended-stack' },
  });

  const filterItem = selectTopItem(rows.filter((row) => row.Category === 'Filtration'), context);
  const lightItem = selectTopItem(rows.filter((row) => row.Category === 'Lighting'), context);
  const heaterItem = selectTopItem(rows.filter((row) => row.Category === 'Heating'), context);

  container.append(
    createRecommendedCard('Filter', filterItem, context, onSelect, onAdd),
    createRecommendedCard('Light', lightItem, context, onSelect, onAdd),
    createRecommendedCard('Heater', heaterItem, context, onSelect, onAdd),
    createRecommendedCard('Substrate', undefined, context, onSelect, onAdd),
  );

  return container;
}
