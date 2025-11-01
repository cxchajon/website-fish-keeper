const TOOLTIP_COPY = new Map([
  [
    'planted',
    {
      title: 'Planted tank toggle',
      body: [
        'Live plants consume ammonia and nitrite, buffering waste spikes and adding oxygen.',
        'Turn this on when you keep live plants so we allow a little more bioload and widen matching parameters.',
      ],
      ariaLabel: 'More info about planted tanks',
    },
  ],
  [
    'filter-product',
    {
      title: 'Filter product list',
      body: [
        'We filter the catalog to products that suit your tank size.',
        'Picking one saves its type and rated flow so you can compare turnover instantly.',
      ],
      ariaLabel: 'More info about choosing a filter product',
    },
  ],
  [
    'rated-flow',
    {
      title: 'Rated flow (GPH)',
      body: [
        'This is the manufacturer’s gallons-per-hour specification for the filter.',
        'We auto-fill it from the product you choose; only adjust if you have a measured value.',
      ],
      ariaLabel: 'More info about rated flow',
    },
  ],
  [
    'turnover',
    {
      title: 'Estimated turnover',
      bullets: [
        'Filtration increases your tank’s capacity to process waste. The Stocking % shown here uses your effective biological capacity (RBC).',
        'Turnover = total GPH ÷ tank gallons.',
        'Targets: general 5–7×/h • active species 8×+.',
        'If turnover is low, consider upsizing filtration or adding circulation.',
        'Recheck after cycling and after major stock/plant changes.',
      ],
      ariaLabel: 'More info about estimated turnover',
    },
  ],
  [
    'filtration-pill',
    {
      title: 'Filtration summary chip',
      body: [
        'We total every filter you add and convert it into gallons per hour and estimated turnover.',
        'Sponge filters get a softer weighting because their flow is diffuse, so the turnover chip reflects that gentler output.',
      ],
      ariaLabel: 'More info about the filtration summary',
    },
  ],
  [
    'gh',
    {
      title: 'What is gH?',
      body: [
        'General hardness measures dissolved calcium and magnesium. Many fish rely on minerals for osmoregulation and bone health.',
      ],
      ariaLabel: 'More info about general hardness (gH)',
    },
  ],
  [
    'kh',
    {
      title: 'Why kH matters',
      body: [
        'Carbonate hardness buffers pH swings. Low kH makes pH unstable; high kH keeps alkaline water steady.',
      ],
      ariaLabel: 'More info about carbonate hardness (kH)',
    },
  ],
  [
    'salinity',
    {
      title: 'Salinity categories',
      body: [
        'Freshwater has negligible salt, while low and high brackish carry increasing minerals. Dual-tolerant species bridge fresh and light brackish mixes—avoid spanning extremes without them.',
      ],
      ariaLabel: 'More info about salinity categories',
    },
  ],
  [
    'blackwater',
    {
      title: 'Blackwater & tannins',
      body: [
        'Blackwater systems are stained by tannins from leaves and wood. Species that require it need the lower pH and humic compounds.',
      ],
      ariaLabel: 'More info about blackwater environments',
    },
  ],
  [
    'ph-sensitive',
    {
      title: 'pH-sensitive species',
      body: [
        'These fish are less tolerant of swings. Match pH closely and prioritize stability when parameters are tight.',
      ],
      ariaLabel: 'More info about pH-sensitive species',
    },
  ],
  [
    'env-info',
    {
      title: 'Environmental recommendations',
      body: [
        'Parameter ranges reflect the overlap across every species in your stock list.',
        'Stay inside the highlighted bands to keep the whole community comfortable.',
      ],
      ariaLabel: 'More info about environmental recommendations',
    },
  ],
  [
    'bioload',
    {
      title: 'Bioload gauge',
      body: [
        'Shows how much of your tank’s capacity is used based on species size and waste output.',
        'Staying in the green keeps extra buffer for filtration, oxygen, and future growth.',
      ],
      ariaLabel: 'More info about the bioload gauge',
    },
  ],
  [
    'aggression',
    {
      title: 'Aggression & compatibility',
      body: [
        'Estimates stress or conflict risk between the species you’ve added.',
        'Higher percentages flag territorial, nippy, or mismatched temperaments so you can plan around them.',
      ],
      ariaLabel: 'More info about the aggression gauge',
    },
  ],
]);

function normalizeKey(key) {
  return typeof key === 'string' ? key.trim().toLowerCase() : '';
}

function normalizeEntry(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const entry = { ...value };
  if (typeof entry.body === 'string') {
    entry.body = [entry.body];
  } else if (Array.isArray(entry.body)) {
    entry.body = entry.body.filter((line) => typeof line === 'string' && line.trim());
  } else {
    entry.body = [];
  }
  if (Array.isArray(entry.bullets)) {
    entry.bullets = entry.bullets.filter((line) => typeof line === 'string' && line.trim());
  } else {
    entry.bullets = [];
  }
  return entry;
}

export function getTooltipContent(key) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return null;
  }
  return TOOLTIP_COPY.get(normalized) || null;
}

export function defineTooltipContent(key, value) {
  const normalized = normalizeKey(key);
  const entry = normalizeEntry(value);
  if (!normalized || !entry) {
    return;
  }
  TOOLTIP_COPY.set(normalized, entry);
}

export function hasTooltipContent(key) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return false;
  }
  return TOOLTIP_COPY.has(normalized);
}

export function listTooltipKeys() {
  return Array.from(TOOLTIP_COPY.keys());
}

export function getOrDefineTooltipContent(key, fallback) {
  const existing = getTooltipContent(key);
  if (existing) {
    return existing;
  }
  defineTooltipContent(key, fallback);
  return getTooltipContent(key);
}

export default TOOLTIP_COPY;
