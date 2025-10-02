import { createElement } from './helpers.js';

export function EmptyState(message) {
  return createElement('div', { className: 'empty-state', text: message });
}
