import { computeTurnover, TURNOVER_RECOMMENDATION } from '../src/engine.js';

describe('turnover guidance', () => {
  test('computes turnover rate and recommendation band', () => {
    const result = computeTurnover(55, 330);
    expect(result.turnoverX).toBeCloseTo(6, 1);
    expect(result.recommendation.min).toBeCloseTo(55 * TURNOVER_RECOMMENDATION.min);
    expect(result.recommendation.max).toBeCloseTo(55 * TURNOVER_RECOMMENDATION.max);
  });

  test('zero gallons produces zero turnover', () => {
    const result = computeTurnover(0, 200);
    expect(result.turnoverX).toBe(0);
    expect(result.recommendation.min).toBe(0);
    expect(result.recommendation.max).toBe(0);
  });
});
