import { createElement } from './helpers.js';

export function Badges(list) {
  if (!list || !list.length) {
    return createElement('div', { className: 'badges' });
  }
  const container = createElement('div', { className: 'badges' });
  list.forEach((badge) => {
    container.appendChild(
      createElement('span', {
        className: 'badge',
        text: `[${badge}]`,
      }),
    );
  });
  return container;
}
