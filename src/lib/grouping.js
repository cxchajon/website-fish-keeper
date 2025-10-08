const LENGTH_RANGE_TO_BUCKET = new Map([
  ['12-20', 'l-12-20'],
  ['20-24', 'l-20-24'],
  ['24-30', 'l-24-30'],
  ['30-36', 'l-30-36'],
  ['36-48', 'l-36-48'],
  ['48-up', 'l-48-up'],
]);

export const LENGTH_BUCKETS = [
  { id: 'l-12-20', label: 'Recommended Lights for 12–20 Inch Tanks', items: [] },
  { id: 'l-20-24', label: 'Recommended Lights for 20–24 Inch Tanks', items: [] },
  { id: 'l-24-30', label: 'Recommended Lights for 24–30 Inch Tanks', items: [] },
  { id: 'l-30-36', label: 'Recommended Lights for 30–36 Inch Tanks', items: [] },
  { id: 'l-36-48', label: 'Recommended Lights for 36–48 Inch Tanks', items: [] },
  { id: 'l-48-up', label: 'Recommended Lights for 48+ Inch Tanks', items: [] },
];

function normalizeLengthRange(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u2012-\u2015\u2212]/g, '-')
    .replace(/\s+/g, '')
    .replace(/\+$/, '-up');
}

export function bucketizeByLength(lights = []) {
  const buckets = LENGTH_BUCKETS.map((bucket) => ({ ...bucket, items: [] }));
  const bucketMap = new Map(buckets.map((bucket) => [bucket.id, bucket]));

  lights.forEach((light) => {
    if (!light) {
      return;
    }
    const rawRange = normalizeLengthRange(light.length_range ?? light.lengthRange ?? '');
    const bucketId = LENGTH_RANGE_TO_BUCKET.get(rawRange);
    if (!bucketId || !bucketMap.has(bucketId)) {
      return;
    }
    bucketMap.get(bucketId).items.push(light);
  });

  return buckets;
}

export function resolveBucketId(lengthRange = '') {
  const normalized = normalizeLengthRange(lengthRange);
  return LENGTH_RANGE_TO_BUCKET.get(normalized) ?? '';
}

export const LENGTH_RANGE_VALUES = Array.from(LENGTH_RANGE_TO_BUCKET.keys());
