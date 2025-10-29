import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, buildComputedState } from '../../js/logic/compute.js';
import { renderEnvCard } from '../../js/logic/envRecommend.js';

function createStubElement() {
  const classSet = new Set();
  return {
    innerHTML: '',
    dataset: {},
    style: {},
    hidden: false,
    attributes: {},
    classList: {
      add: (cls) => classSet.add(cls),
      remove: (cls) => classSet.delete(cls),
      contains: (cls) => classSet.has(cls),
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    querySelector() {
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

function setupDom({ isMobile = false } = {}) {
  const barsEl = createStubElement();
  const tipsEl = createStubElement();
  tipsEl.dataset.bound = 'true';
  const warnEl = createStubElement();

  const doc = {
    getElementById(id) {
      if (id === 'env-bars') return barsEl;
      if (id === 'env-more-tips') return tipsEl;
      if (id === 'env-warnings') return warnEl;
      return null;
    },
    querySelector() {
      return null;
    },
  };

  const win = {
    matchMedia: () => ({ matches: Boolean(isMobile) }),
  };

  const cleanup = () => {
    delete global.document;
    delete global.window;
  };

  global.document = doc;
  global.window = win;

  return { barsEl, warnEl, cleanup };
}

test('Aggression meter markup is suppressed while bioload meter remains', () => {
  const { barsEl, cleanup } = setupDom();
  try {
    const state = createDefaultState();
    state.gallons = 20;
    state.stock = [{ id: 'neon', qty: 6 }];
    const computed = buildComputedState(state);

    renderEnvCard({ stock: computed.entries, stockCount: computed.stockCount, computed });

    assert.ok(
      barsEl.innerHTML.includes('data-role="bioload-percent"'),
      'Bioload meter should render its percent field',
    );
    assert.ok(
      !barsEl.innerHTML.includes('data-role="aggression-percent"'),
      'Aggression meter percent field should not render',
    );
    assert.ok(
      !barsEl.innerHTML.includes('data-info="aggression"'),
      'Aggression info trigger should not render',
    );
  } finally {
    cleanup();
  }
});

test('Aggression conflicts still surface as warnings and chips', () => {
  const { barsEl, warnEl, cleanup } = setupDom();
  try {
    const state = createDefaultState();
    state.gallons = 29;
    state.stock = [
      { id: 'betta_male', qty: 1 },
      { id: 'tiger_barb', qty: 6 },
    ];
    const computed = buildComputedState(state);

    const env = renderEnvCard({ stock: computed.entries, stockCount: computed.stockCount, computed });

    assert.ok(
      warnEl.innerHTML.includes('Aggression conflict'),
      'Aggression warning text should still render',
    );
    assert.ok(
      barsEl.innerHTML.includes('data-kind="aggression"'),
      'Aggression chips should still render in the bars container',
    );
    assert.ok(
      !barsEl.innerHTML.includes('data-role="aggression-percent"'),
      'Aggression meter DOM should remain absent even when warnings exist',
    );
    assert.ok(
      env?.warnings?.some((warning) => warning.text.includes('Aggression conflict')),
      'Computed warnings should still include aggression conflicts',
    );
  } finally {
    cleanup();
  }
});
