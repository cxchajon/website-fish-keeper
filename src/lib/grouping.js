const LENGTH_BUCKETS = [
  { id: 'l-12-20', label: 'Recommended Lights for 12–20 inch Tanks', items: [] },
  { id: 'l-20-24', label: 'Recommended Lights for 20–24 inch Tanks', items: [] },
  { id: 'l-24-30', label: 'Recommended Lights for 24–30 inch Tanks', items: [] },
  { id: 'l-30-36', label: 'Recommended Lights for 30–36 inch Tanks', items: [] },
  { id: 'l-36-48', label: 'Recommended Lights for 36–48 inch Tanks', items: [] },
  { id: 'l-48-up', label: 'Recommended Lights for 48 inch and Up', items: [] },
];

export const LENGTH_BUCKET_SET = new Set(LENGTH_BUCKETS.map((bucket) => bucket.id));

const LENGTH_RANGE_ALIAS_ENTRIES = LENGTH_BUCKETS.flatMap((bucket) => {
  const base = bucket.id.replace(/^l-/, '');
  const baseNoDash = base.replace(/-/g, '');
  const entries = [
    [bucket.id, bucket.id],
    [base, bucket.id],
    [base.replace(/-/g, '_'), bucket.id],
    [baseNoDash, bucket.id],
    [`l${base}`, bucket.id],
    [`l_${base}`, bucket.id],
    [`l${baseNoDash}`, bucket.id],
  ];
  if (base.endsWith('-up')) {
    const start = base.replace('-up', '');
    entries.push(
      [`${start}up`, bucket.id],
      [`${start}+`, bucket.id],
      [`${start}-up`, bucket.id],
      [`${start}_up`, bucket.id],
      [`l${start}up`, bucket.id],
      [`l${start}+`, bucket.id],
      [`l-${start}up`, bucket.id],
    );
  }
  return entries;
});

const LENGTH_RANGE_TO_BUCKET = new Map(LENGTH_RANGE_ALIAS_ENTRIES);

function normalizeLengthRange(value = '') {
  let next = value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u2012-\u2015\u2212]/g, '-')
    .replace(/[“”"′″]/g, '')
    .replace(/inches?$/g, '')
    .replace(/inch$/g, '')
    .replace(/in$/g, '')
    .replace(/tanks?$/g, '')
    .replace(/^lights?[-_]?/, '')
    .replace(/^light[-_]?/, '')
    .replace(/^range[-_]?/, '')
    .replace(/^bucket[-_]?/, '')
    .replace(/^group[-_]?/, '')
    .replace(/\s+/g, '')
    .replace(/_/g, '-')
    .replace(/\+$/, 'up');

  if (!next) {
    return '';
  }

  if (LENGTH_RANGE_TO_BUCKET.has(next)) {
    next = LENGTH_RANGE_TO_BUCKET.get(next);
  }

  if (next.startsWith('l') && !next.startsWith('l-')) {
    next = `l-${next.slice(1)}`;
  }
  if (next.startsWith('-')) {
    next = `l${next}`;
  }

  if (LENGTH_RANGE_TO_BUCKET.has(next)) {
    next = LENGTH_RANGE_TO_BUCKET.get(next);
  }

  const standardMatch = next.match(/^l-(\d{2})-(\d{2})$/);
  if (standardMatch) {
    return LENGTH_BUCKET_SET.has(next) ? next : '';
  }

  const shortMatch = next.match(/^(\d{2})-(\d{2})$/);
  if (shortMatch) {
    const candidate = `l-${shortMatch[1]}-${shortMatch[2]}`;
    return LENGTH_BUCKET_SET.has(candidate) ? candidate : '';
  }

  const upMatch = next.match(/^(?:l-)?(\d{2})(?:-)?(?:up)$/);
  if (upMatch) {
    const candidate = `l-${upMatch[1]}-up`;
    return LENGTH_BUCKET_SET.has(candidate) ? candidate : '';
  }

  return LENGTH_BUCKET_SET.has(next) ? next : '';
}

export function bucketizeByLength(lights = []) {
  const buckets = LENGTH_BUCKETS.map((bucket) => ({ ...bucket, items: [] }));
  const bucketMap = new Map(buckets.map((bucket) => [bucket.id, bucket]));

  lights.forEach((light) => {
    if (!light) {
      return;
    }
    const bucketId = normalizeLengthRange(light.length_range ?? light.lengthRange ?? light.rangeId ?? '');
    if (!bucketId || !bucketMap.has(bucketId)) {
      return;
    }
    bucketMap.get(bucketId).items.push({ ...light, length_range: bucketId });
  });

  return buckets;
}

export function resolveBucketId(lengthRange = '') {
  const normalized = normalizeLengthRange(lengthRange);
  return LENGTH_BUCKET_SET.has(normalized) ? normalized : '';
}

export const LENGTH_RANGE_VALUES = Array.from(LENGTH_BUCKET_SET);

export function getLightsByLength(lights = []) {
  const buckets = bucketizeByLength(lights);
  const initial = LENGTH_BUCKETS.reduce(
    (acc, bucket) => {
      acc[bucket.id] = [];
      return acc;
    },
    {},
  );

  return buckets.reduce((acc, bucket) => {
    acc[bucket.id] = bucket.items.slice();
    return acc;
  }, initial);
}

export { LENGTH_BUCKETS };
