const TOKENS = Object.freeze({
  UNSTABLE_SORORITY: 'UNSTABLE_SORORITY',
  FATAL_INCOMPATIBLE_BETTA_MALE: 'FATAL_INCOMPATIBLE_BETTA_MALE',
});

function resolveSlug(spec) {
  if (!spec) return '';
  if (typeof spec.slug === 'string') return spec.slug.toLowerCase();
  if (typeof spec.id === 'string') return spec.id.toLowerCase();
  return '';
}

function toGallons(ctx) {
  if (!ctx) return 0;
  if (Number.isFinite(ctx.gallons)) return Number(ctx.gallons);
  if (Number.isFinite(ctx.tankGallons)) return Number(ctx.tankGallons);
  if (Number.isFinite(ctx?.tank?.gallons)) return Number(ctx.tank.gallons);
  if (Number.isFinite(ctx?.tank?.displayGallons)) return Number(ctx.tank.displayGallons);
  return 0;
}

function baseAggression(spec) {
  if (Number.isFinite(spec?.protoV2?.aggression?.baseline)) {
    return spec.protoV2.aggression.baseline;
  }
  if (Number.isFinite(spec?.aggression)) {
    return Number(spec.aggression) / 100;
  }
  return 0.3;
}

export function calcAggression(spec, qty, ctx = {}) {
  const slug = resolveSlug(spec);
  const count = Number(qty) > 0 ? Number(qty) : 0;
  const tokens = [];

  if (slug === 'betta-male' || slug === 'betta_male') {
    if (count > 1) {
      return Object.freeze({ error: TOKENS.FATAL_INCOMPATIBLE_BETTA_MALE });
    }
    return Object.freeze({
      base: baseAggression(spec),
      value: baseAggression(spec),
      tokens: Object.freeze(tokens),
    });
  }

  if (slug === 'tiger-barb' || slug === 'tiger_barb') {
    let value = 0.55;
    if (count >= 10) {
      value = 0.45;
    } else if (count >= 6) {
      value = 0.55;
    } else if (count >= 3) {
      value = 0.75;
    } else if (count > 0) {
      value = 0.85;
    } else {
      value = baseAggression(spec);
    }
    return Object.freeze({
      base: baseAggression(spec),
      value,
      tokens: Object.freeze(tokens),
    });
  }

  if (slug === 'betta-female' || slug === 'betta_female') {
    const gallons = toGallons(ctx);
    let value = baseAggression(spec);
    if (count === 1) {
      value = 0.3;
    } else if (count >= 5 && gallons >= 20) {
      value = 0.6;
    } else if (count >= 2) {
      value = 0.9;
      tokens.push(TOKENS.UNSTABLE_SORORITY);
    }
    return Object.freeze({
      base: baseAggression(spec),
      value,
      tokens: Object.freeze(tokens),
    });
  }

  return Object.freeze({
    base: baseAggression(spec),
    value: baseAggression(spec),
    tokens: Object.freeze(tokens),
  });
}

export const AGGRESSION_TOKENS = TOKENS;
