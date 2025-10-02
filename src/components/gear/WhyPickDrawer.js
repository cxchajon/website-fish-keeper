import { createElement } from './helpers.js';
import { getNormalizedBudget, getTankLabels } from '../../utils/rankers.js';

function buildRationale(item, context) {
  const bullets = [];
  const tanks = getTankLabels(item);
  if (tanks.includes(context.tankSize)) {
    bullets.push(`Sized for ${context.tankSize} setups.`);
  }
  if (context.planted && /yes/i.test(item.Plant_Ready ?? '')) {
    bullets.push('Supports planted aquariums.');
  }
  if (context.bioLoad === 'Heavy' && /canister|high flow|fx/i.test(`${item.Filter_Type} ${item.Notes}`)) {
    bullets.push('Handles higher bio-load with strong turnover.');
  }
  const price = getNormalizedBudget(item);
  if (context.budget === price) {
    bullets.push(`Matches your ${price.toLowerCase()} budget focus.`);
  } else if (price !== 'Any') {
    bullets.push(`${price} tier pick for added flexibility.`);
  }
  if (item.Notes) {
    bullets.push(item.Notes);
  }
  return bullets;
}

function alternativeList(alternatives, onSelect) {
  const container = createElement('div', { className: 'drawer-alternatives' });
  Object.entries(alternatives).forEach(([tier, candidate]) => {
    const row = createElement('div', { className: 'drawer-alternative' });
    row.append(
      createElement('span', { className: 'drawer-alternative__tier', text: tier }),
      createElement('span', { className: 'drawer-alternative__name', text: candidate ? candidate.Product_Name : 'No alternative yet' }),
    );
    if (candidate) {
      const button = createElement('button', {
        className: 'btn link',
        text: 'View',
        attrs: { type: 'button' },
      });
      button.addEventListener('click', () => onSelect(candidate));
      row.appendChild(button);
    }
    container.appendChild(row);
  });
  return container;
}

export function WhyPickDrawer(options) {
  const { item, context, alternatives, onClose, onSelectAlternative } = options;
  const drawer = createElement('aside', {
    className: 'why-pick-drawer',
    attrs: { 'data-testid': 'why-pick-drawer', 'aria-hidden': 'true' },
  });

  if (!item) {
    drawer.classList.add('is-hidden');
    drawer.setAttribute('aria-hidden', 'true');
    return drawer;
  }

  drawer.setAttribute('aria-hidden', 'false');

  const closeButton = createElement('button', {
    className: 'btn icon',
    text: 'Close',
    attrs: { type: 'button', 'aria-label': 'Close drawer' },
  });
  closeButton.addEventListener('click', onClose);

  const header = createElement('div', { className: 'why-pick-drawer__header' }, [
    createElement('h3', { text: `Why this pick: ${item.Product_Name}` }),
    closeButton,
  ]);

  const rationale = buildRationale(item, context);
  const list = createElement('ul', { className: 'why-pick-drawer__list' });
  rationale.forEach((bullet) => {
    list.appendChild(createElement('li', { text: bullet }));
  });

  drawer.append(
    header,
    list,
    alternativeList(alternatives, onSelectAlternative),
  );

  return drawer;
}
