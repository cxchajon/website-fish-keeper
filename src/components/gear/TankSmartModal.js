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
    attrs: {
      'data-testid': 'tank-smart-modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-hidden': String(!open),
    },
  });

  const dialog = createElement('div', {
    className: 'tank-smart-modal__dialog',
    attrs: { role: 'document', tabindex: '-1' },
  });
  const header = createElement('header', { className: 'tank-smart-modal__header' }, [
    createElement('h3', { text: 'How to Buy a Tank Smart' }),
    createElement('button', {
      className: 'btn icon',
      text: 'Close',
      attrs: { type: 'button', 'aria-label': 'Close modal', 'data-focus-default': 'true' },
    }),
  ]);
  dialog.append(
    header,
    (() => {
      const list = createElement('ul');
      BULLETS.forEach((bullet) => {
        list.appendChild(createElement('li', { text: bullet }));
      });
      return list;
    })(),
  );
  const closeButton = header.querySelector('button');
  closeButton.addEventListener('click', onClose);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Tab') {
      const focusables = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  backdrop.addEventListener('keydown', handleKeyDown);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      onClose();
    }
  });

  backdrop.appendChild(dialog);

  if (open) {
    requestAnimationFrame(() => {
      const focusables = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const focusTarget = focusables[0] ?? dialog;
      focusTarget.focus();
    });
  }

  return backdrop;
}
