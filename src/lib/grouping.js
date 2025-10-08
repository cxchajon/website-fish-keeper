const ORDERED_LENGTH_BUCKET_IDS = [
  '12-18',
  '18-24',
  '24-30',
  '30-36',
  '36-48',
  '48-55',
  '55-75',
  '75-up',
];

function formatRangeLabel(rangeId) {
  if (!rangeId) {
    return '';
  }
  if (rangeId.endsWith('-up')) {
    const start = rangeId.replace('-up', '');
    return `Recommended Lights for ${start}+ inch Tanks`;
  }
  const [start, end] = rangeId.split('-');
  const dash = '\u2013';
  return `Recommended Lights for ${start}${dash}${end} inch Tanks`;
}

const LENGTH_BUCKETS = ORDERED_LENGTH_BUCKET_IDS.map((bucketId) => ({
  id: bucketId,
  bucket_id: bucketId,
  label: formatRangeLabel(bucketId),
  bucket_label: formatRangeLabel(bucketId),
  items: [],
}));

export const LENGTH_BUCKET_SET = new Set(ORDERED_LENGTH_BUCKET_IDS);

const LENGTH_RANGE_ALIAS_ENTRIES = LENGTH_BUCKETS.flatMap((bucket) => {
  const base = bucket.bucket_id;
  const baseNoDash = base.replace(/-/g, '');
  const entries = [
    [bucket.bucket_id, bucket.bucket_id],
    [base, bucket.bucket_id],
    [base.replace(/-/g, '_'), bucket.bucket_id],
    [baseNoDash, bucket.bucket_id],
    [`l-${base}`, bucket.bucket_id],
    [`l_${base}`, bucket.bucket_id],
    [`l${base}`, bucket.bucket_id],
    [`l${baseNoDash}`, bucket.bucket_id],
  ];
  if (base.endsWith('-up')) {
    const start = base.replace('-up', '');
    entries.push(
      [`${start}up`, bucket.bucket_id],
      [`${start}+`, bucket.bucket_id],
      [`${start}-up`, bucket.bucket_id],
      [`${start}_up`, bucket.bucket_id],
      [`l${start}up`, bucket.bucket_id],
      [`l${start}+`, bucket.bucket_id],
      [`l-${start}up`, bucket.bucket_id],
    );
  }
  return entries;
});

const LEGACY_RANGE_ALIASES = [
  ['l-12-20', '12-18'],
  ['12-20', '12-18'],
  ['l-20-24', '18-24'],
  ['20-24', '18-24'],
  ['l-24-32', '24-30'],
  ['24-32', '24-30'],
  ['l-48-up', '48-55'],
  ['48-up', '48-55'],
];

const LENGTH_RANGE_TO_BUCKET = new Map([...LENGTH_RANGE_ALIAS_ENTRIES, ...LEGACY_RANGE_ALIASES]);

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

  const stripped = next.replace(/^l[-_]?/, '');
  if (LENGTH_RANGE_TO_BUCKET.has(stripped)) {
    return LENGTH_RANGE_TO_BUCKET.get(stripped);
  }

  if (LENGTH_BUCKET_SET.has(stripped)) {
    return stripped;
  }

  if (LENGTH_BUCKET_SET.has(next)) {
    return next;
  }

  const shortMatch = next.match(/^(\d{2})(?:-|to)?(\d{2})$/);
  if (shortMatch) {
    const candidate = `${shortMatch[1]}-${shortMatch[2]}`;
    return LENGTH_BUCKET_SET.has(candidate) ? candidate : '';
  }

  const upMatch = next.match(/^(?:l-)?(\d{2})(?:-)?(?:up)$/);
  if (upMatch) {
    const candidate = `${upMatch[1]}-up`;
    return LENGTH_BUCKET_SET.has(candidate) ? candidate : '';
  }

  return LENGTH_BUCKET_SET.has(next) ? next : '';
}

export function bucketizeByLength(lights = []) {
  const buckets = LENGTH_BUCKETS.map((bucket) => ({ ...bucket, items: [] }));
  const bucketMap = new Map(buckets.map((bucket) => [bucket.bucket_id, bucket]));

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

export const LENGTH_RANGE_VALUES = Array.from(ORDERED_LENGTH_BUCKET_IDS);

export function getLightsByLength(lights = []) {
  const buckets = bucketizeByLength(lights);
  const initial = LENGTH_BUCKETS.reduce(
    (acc, bucket) => {
      acc[bucket.bucket_id] = [];
      return acc;
    },
    {},
  );

  return buckets.reduce((acc, bucket) => {
    acc[bucket.bucket_id] = bucket.items.slice();
    return acc;
  }, initial);
}

export { LENGTH_BUCKETS };
