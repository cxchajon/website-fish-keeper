import test from 'node:test';
import assert from 'node:assert/strict';

import { makeState, recomputeAndRender } from '../assets/js/proto-filtration.js';

const EPSILON = 1e-6;

function pushFish(state, { id, ge, qty }) {
  const entry = {
    id: typeof id === 'string' ? id : `species-${state.stockList.length + 1}`,
    ge: Number.isFinite(ge) && ge > 0 ? ge : 0,
    qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
  };
  state.stockList.push(entry);
}

function pushFilter(state, filter) {
  const entry = { ...filter };
  if (!entry.type) {
    entry.type = 'HOB';
  }
  if (!entry.rated_gph && !entry.ratedGph && entry.gph) {
    entry.rated_gph = entry.gph;
  }
  state.selectedFilters.push(entry);
}

function percent(state) {
  return recomputeAndRender(state).percent;
}

test('Sponge never raises % when added after stock', () => {
  const state = makeState({ gallons: 29 });
  pushFish(state, { id: 'harlequin_rasbora', ge: 0.95, qty: 10 });
  const before = percent(state);
  pushFilter(state, { type: 'SPONGE', rated_gph: 120 });
  const after = percent(state);
  assert.ok(
    after <= before + EPSILON,
    `bioload percent should not increase when adding sponge support (before ${before}, after ${after})`,
  );
});

test('Order independence: fish then filter equals filter then fish', () => {
  const fish = { id: 'harlequin_rasbora', ge: 0.95, qty: 10 };
  const sponge = { type: 'SPONGE', rated_gph: 120 };

  const planA = makeState({ gallons: 29 });
  pushFish(planA, fish);
  percent(planA); // recompute after fish
  pushFilter(planA, sponge);
  const pctA = percent(planA);

  const planB = makeState({ gallons: 29 });
  pushFilter(planB, sponge);
  percent(planB); // recompute after filter
  pushFish(planB, fish);
  const pctB = percent(planB);

  assert.ok(
    Math.abs(pctA - pctB) <= EPSILON,
    `order independence violated: fish→filter ${pctA}, filter→fish ${pctB}`,
  );
});
