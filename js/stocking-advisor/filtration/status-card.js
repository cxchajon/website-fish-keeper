/**
 * Filtration status card — DOM renderer (sponge migration phase G).
 *
 * Renders the view model from status-view.js into the static card in the filter setup area
 * (stocking-advisor.html, [data-role="filtration-status-card"]). It reads computed.filtering only
 * and computes nothing: the verdict, tone and every figure come from the engine.
 *
 * Stable selectors (tests use these, not class names):
 *   [data-role="filtration-status-card"]        root; data-state (good|warn|bad|neutral), data-level,
 *                                               data-card-state, data-warning-ids (the engine's
 *                                               filtration warning ids, space-separated)
 *   [data-role="filtration-status-headline"]    the overall status (a polite status region)
 *   [data-role="filtration-status-paths"]       one <li data-row-kind data-path> per line
 *   [data-role="filtration-status-explanation"] short explanatory sentences
 *   [data-role="filtration-status-redundancy"]  qualitative backup line (2+ biological filters)
 *   [data-role="filtration-status-note"]        the permanent Stocking Load sentence
 */

import { buildFiltrationCardModel, cardText } from './status-view.js';

function el(tag, attrs = {}, text = null) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  if (text !== null) node.textContent = text;
  return node;
}

function signatureOf(model) {
  return JSON.stringify([model.state, model.level, model.tone, model.warningIds, cardText(model),
    model.rows.map((line) => [line.kind, line.path, line.status, line.instanceId ?? null])]);
}

function buildContent(root, model) {
  const titleId = 'filtration-status-title';
  const title = el('h3', { id: titleId, class: 'filtration-status__title' }, 'Filtration');
  root.setAttribute('aria-labelledby', titleId);

  // The headline is the only live part of the card: one short polite announcement per change.
  const headline = el('p', { class: 'filtration-status__headline', 'data-role': 'filtration-status-headline', role: 'status' });
  const icon = el('span', { class: 'filtration-status__icon', 'aria-hidden': 'true' }, model.headline.icon);
  const label = el('span', { class: 'sr-only' }, `${model.headline.iconLabel}: `);
  const text = el('span', { class: 'filtration-status__headline-text' }, model.headline.text);
  headline.append(icon, label, text);

  const parts = [title, headline];

  if (model.rows.length) {
    const list = el('ul', { class: 'filtration-status__paths', 'data-role': 'filtration-status-paths' });
    model.rows.forEach((line) => {
      const item = el('li', {
        class: 'filtration-status__row',
        'data-row-kind': line.kind,
        'data-path': line.path,
        'data-row-status': line.status ?? null,
        'data-instance-id': line.instanceId ?? null,
      }, line.text);
      list.appendChild(item);
    });
    parts.push(list);
  }

  if (model.explanation.length) {
    const explanation = el('div', { class: 'filtration-status__explanation', 'data-role': 'filtration-status-explanation' });
    model.explanation.forEach((sentence) => explanation.appendChild(el('p', {}, sentence)));
    parts.push(explanation);
  }

  if (model.redundancy) {
    parts.push(el('p', { class: 'filtration-status__redundancy', 'data-role': 'filtration-status-redundancy' }, model.redundancy));
  }

  parts.push(el('p', { class: 'filtration-status__note', 'data-role': 'filtration-status-note' }, model.note));
  root.replaceChildren(...parts);
}

/**
 * @param {Element|null} root the card element
 * @param {object|null} filtering computed.filtering, or null without a tank
 * @returns the model rendered (or null without a root)
 */
export function renderFiltrationStatusCard(root, filtering) {
  if (!root) return null;
  const model = buildFiltrationCardModel(filtering);
  const signature = signatureOf(model);
  // Unchanged result: leave the DOM alone so nothing is re-announced on unrelated recomputes.
  if (root.dataset.signature !== signature) {
    buildContent(root, model);
    root.dataset.signature = signature;
    root.dataset.state = model.tone;
    root.dataset.level = model.level;
    root.dataset.cardState = model.state;
    root.dataset.warningIds = model.warningIds.join(' ');
    root.dataset.turnover = model.showTurnover ? 'powered' : 'none';
  }
  root.hidden = false;
  return model;
}
