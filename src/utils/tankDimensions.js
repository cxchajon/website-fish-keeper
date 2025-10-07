const TANK_HEIGHTS = new Map([
  ['5g', 10.5],
  ['10g', 12.6],
  ['20g', 16.75],
  ['20 Long', 12.75],
  ['29g', 18.75],
  ['40 Breeder', 16.75],
  ['55g', 21],
  ['75g', 21.25],
  ['90g', 25],
  ['110g', 30],
  ['125g', 21],
]);

export function getTankHeightInches(label) {
  if (!label) {
    return null;
  }
  const height = TANK_HEIGHTS.get(label);
  if (typeof height === 'number' && Number.isFinite(height)) {
    return height;
  }
  return null;
}
