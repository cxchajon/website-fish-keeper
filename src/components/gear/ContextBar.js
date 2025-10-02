import { createElement } from './helpers.js';

const TANK_SIZES = ['5g', '10g', '20g', '20 Long', '29g', '40 Breeder', '55g', '75g', '90g', '110g', '125g'];
const BIO_LOAD = ['Light', 'Moderate', 'Heavy'];
const BUDGET = ['Any', 'Budget', 'Mid', 'Premium'];

export function ContextBar(context, onChange) {
  const bar = createElement('section', {
    className: 'context-bar',
    attrs: { 'data-testid': 'context-bar' },
  });

  const tankSelect = createElement('select', {
    className: 'context-input',
    attrs: { id: 'context-tank-size' },
  });
  TANK_SIZES.forEach((size) => {
    const option = createElement('option', {
      text: size,
      attrs: { value: size },
    });
    if (size === context.tankSize) {
      option.selected = true;
    }
    tankSelect.appendChild(option);
  });
  tankSelect.addEventListener('change', () => {
    onChange({ ...context, tankSize: tankSelect.value });
  });

  const plantedToggle = createElement('button', {
    className: `context-toggle ${context.planted ? 'is-active' : ''}`,
    text: context.planted ? 'Planted: Yes' : 'Planted: No',
    attrs: { type: 'button', 'aria-pressed': String(context.planted) },
  });
  plantedToggle.addEventListener('click', () => {
    onChange({ ...context, planted: !context.planted });
  });

  const bioSelect = createElement('select', {
    className: 'context-input',
    attrs: { id: 'context-bio-load' },
  });
  BIO_LOAD.forEach((load) => {
    const option = createElement('option', {
      text: load,
      attrs: { value: load },
    });
    if (load === context.bioLoad) {
      option.selected = true;
    }
    bioSelect.appendChild(option);
  });
  bioSelect.addEventListener('change', () => {
    onChange({ ...context, bioLoad: bioSelect.value });
  });

  const budgetSelect = createElement('select', {
    className: 'context-input',
    attrs: { id: 'context-budget' },
  });
  BUDGET.forEach((tier) => {
    const option = createElement('option', {
      text: tier,
      attrs: { value: tier },
    });
    if (tier === context.budget) {
      option.selected = true;
    }
    budgetSelect.appendChild(option);
  });
  budgetSelect.addEventListener('change', () => {
    onChange({ ...context, budget: budgetSelect.value });
  });

  bar.append(
    createElement('div', { className: 'context-field' }, [
      createElement('label', { attrs: { for: 'context-tank-size' }, text: 'Tank Size' }),
      tankSelect,
    ]),
    createElement('div', { className: 'context-field' }, [
      createElement('span', { className: 'field-label', text: 'Planted' }),
      plantedToggle,
    ]),
    createElement('div', { className: 'context-field' }, [
      createElement('label', { attrs: { for: 'context-bio-load' }, text: 'Bio-Load' }),
      bioSelect,
    ]),
    createElement('div', { className: 'context-field' }, [
      createElement('label', { attrs: { for: 'context-budget' }, text: 'Budget' }),
      budgetSelect,
    ]),
  );

  return bar;
}
