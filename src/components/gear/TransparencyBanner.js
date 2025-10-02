import { createElement } from './helpers.js';

export function TransparencyBanner() {
  const wrapper = createElement('section', {
    className: 'transparency-banner',
    attrs: { 'data-testid': 'transparency-banner' },
  });
  wrapper.append(
    createElement('p', {
      text: 'We recommend buying standard tanks during dollar-per-gallon sales and investing more in equipment.',
    }),
    createElement('p', {
      text: 'Bigger tanks are more stable and easier for beginners.',
    }),
  );
  return wrapper;
}
