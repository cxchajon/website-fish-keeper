import { createElement } from './helpers.js';

const BULLETS = [
  'Watch for dollar-per-gallon sales',
  'Invest in equipment first',
  'Bigger = easier (more stable)',
];

export function TankSmartModal(options) {
  const { open, onClose } = options;
  const backdrop = createElement('div', {
    className: `tank-smart-modal ${open ? 'is-open' : ''}`,
    attrs: { 'data-testid': 'tank-smart-modal', role: 'dialog', 'aria-modal': 'true' },
  });

  const dialog = createElement('div', { className: 'tank-smart-modal__dialog' });
  dialog.append(
    createElement('header', { className: 'tank-smart-modal__header' }, [
      createElement('h3', { text: 'How to Buy a Tank Smart' }),
      createElement('button', {
        className: 'btn icon',
        text: 'Close',
        attrs: { type: 'button', 'aria-label': 'Close modal' },
      }),
    ]),
    (() => {
      const list = createElement('ul');
      BULLETS.forEach((bullet) => {
        list.appendChild(createElement('li', { text: bullet }));
      });
      return list;
    })(),
  );
  dialog.querySelector('button').addEventListener('click', onClose);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      onClose();
    }
  });

  backdrop.appendChild(dialog);
  return backdrop;
}
