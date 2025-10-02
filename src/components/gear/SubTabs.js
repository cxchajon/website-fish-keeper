import { createElement } from './helpers.js';

export function SubTabs(options) {
  const { tabs, active, onChange } = options;
  const container = createElement('div', { className: 'sub-tabs' });
  tabs.forEach((tab) => {
    const button = createElement('button', {
      className: `sub-tab ${tab.value === active ? 'is-active' : ''}`,
      text: tab.label,
      attrs: { type: 'button' },
    });
    button.addEventListener('click', () => onChange(tab.value));
    container.appendChild(button);
  });
  return container;
}
