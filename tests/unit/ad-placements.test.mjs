// Guards the manual Google AdSense rollout (hybrid house ads + manual Display units).
// - The homepage stays ad-free: no AdSense loader, no Google ad units, no house-ad containers.
// - The About page is reserved for FishKeepingLifeCo promotions: house ads only, no AdSense loader or Google units.
// - Auto ads stay off in code: no page-level/Auto ads snippet, no units in shared nav/footer includes.
// - Manual units exist only where they were reviewed, with the dashboard slot IDs below.
// - Converted pages load the AdSense loader once and request each unit once (js/google-ads.js).
// - Every interactive tool still shows a rotating FishKeepingLifeCo house ad first.
// - Google units carry only Google's permitted label wording, "Advertisements".
// - The approved end state stays fixed: 55 Google units (41 blog), 11 house ads, retired ad scripts gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(ROOT + path, 'utf8');
const PUBLISHER = 'ca-pub-9905718149811880';
const LOADER = /<script[^>]+src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"]*"/g;
const RETIRED_SLOTS = ['8979116676'];
// Google permits only "Advertisements" or "Sponsored Links" as publisher labels on its ads
// (AdSense ad placement policies, https://support.google.com/adsense/answer/1346295).
const GOOGLE_AD_LABEL = 'Advertisements';

const BLOG_PILOT = 'blogs/aquarium-heater-safety-temperature-controllers.html';
const BLOG_END_OF_ARTICLE = '5598495275'; // TTG_Blog_EndOfArticle

// Blog articles converted after the pilot: each article's one house-ad slot became
// TTG_Blog_EndOfArticle in the same position, configured exactly like the pilot.
const BLOG_BATCH_2 = [
  'acclimating-shrimp-after-shipping-guide/index.html',
  'aquarium-bacterial-bloom/index.html',
  'aquarium-fertilizers-guide-liquid-root-tabs/index.html',
  'aquarium-gh-kh-ph-explained/index.html',
  'aquarium-livestock-sourcing-comparison/index.html',
  'aquarium-plants-remove-nitrates/index.html',
  'aquarium-worms-and-bugs/index.html',
  'aquashella-2026-experience/index.html',
  'beginner-carpeting-plants-low-tech/index.html',
  'best-beginner-aquarium-plants/index.html',
  'blog/holiday-gift-guide-aquarium-lovers.html',
  'blogs/aquarium-filtration-for-beginners.html',
  'blogs/betta-fish-in-a-community-tank.html',
  'blogs/blackbeard/index.html',
  'blogs/nitrogen-cycle/index.html',
  'blogs/purigen/index.html',
  'blogs/sick-fish-ich-freshwater-disease-guide/index.html',
  'brown-aquarium-water-tannins/index.html',
  'buying-shrimp-online-process-guide/index.html',
  'cool-down-fish-tank/index.html',
  'dangerous-aquarium-hitchhikers/index.html',
  'diy-freshwater-sump-design-29-gallon/index.html',
  'diy-sump-lessons-learned.html',
  'first-year-of-fishkeepinglifeco/index.html',
  'freshwater-aquarium-clean-up-crew-snail-welfare.html',
  'green-aquarium-water/index.html',
  'hard-water-vs-soft-water-aquarium-fish/index.html',
  'high-tech-vs-low-tech-planted-aquarium/index.html',
  'how-houseplants-grow-in-aquarium-water/index.html',
  'how-to-raise-lower-aquarium-gh-kh-ph/index.html',
  'neocaridina-shrimp-care/index.html',
  'planted-aquarium-substrate-guide-aquasoil-dirt/index.html',
  'prevent-aquarium-hitchhikers/index.html',
  'reduce-aquarium-nitrates-pothos-guide.html',
  'undergravel-filters-planted-tank-case-study/index.html',
  'why-goldfish-are-misunderstood/index.html',
  'why-is-my-aquarium-cloudy/index.html',
];

// Held back from batch 2 until their .blog-body stopped overflowing the viewport between about
// 641px and 830px wide. With that layout fixed, each article's one house-ad slot became
// TTG_Blog_EndOfArticle in the same position, configured exactly like the pilot.
const BLOG_HOUSEPLANTS = ['best-houseplants-for-aquariums/index.html', 'growing-houseplants-in-aquarium/index.html'];
// Phase B2 (owner-approved): the shrimp-diet article's affiliate-product rotator became
// TTG_Blog_EndOfArticle in the same position. Its in-article affiliate links stay.
const BLOG_NEOCARIDINA_DIET = 'neocaridina-shrimp-diet-biofilm-guide/index.html';
const CONVERTED_BLOGS = [...BLOG_BATCH_2, ...BLOG_HOUSEPLANTS, BLOG_NEOCARIDINA_DIET];

// page -> data-ad-slot values that page may carry. Adding a unit anywhere else must update this list.
const MANUAL_UNITS = {
  [BLOG_PILOT]: [BLOG_END_OF_ARTICLE],
  'gear/index.html': ['1762971638'], // TTG_Gear_Bottom
  'stocking-advisor.html': ['5996977454', '9758352395'], // TTG_StockingAdvisor_Mid, TTG_StockingAdvisor_Bottom
  'cycling-coach/index.html': ['2094490843'], // TTG_CyclingCoach_Bottom
  // Phase B1: content and hub pages.
  'assistant.html': ['8930237876', '9864045598'], // TTG_Assistant_Mid, TTG_Assistant_Bottom
  'media.html': ['6497764235'], // TTG_MediaProto_FAQ_Top
  'podcast/index.html': ['3569730759'], // TTG_Podcast_Bottom
  'tanks/project-tank-000.html': ['6308794025'], // project-tank-000
  'university/index.html': ['8925377095'], // TTG_University_Bottom (not the historical 4602491969)
  // Phase B4: four approved bottom placements.
  'blogs/index.html': ['2584786291'], // TTG_Blog_Index_Bottom
  'community-tanks.html': ['7026806218'], // TTG_Community_Tanks_Bottom
  'submit-your-tank.html': ['5713724546'], // TTG_Submit_Your_Tank_Bottom
  'tools/snail-stock-recommender.html': ['9397606658'], // TTG_Snail_Recommender_Bottom
  ...Object.fromEntries(CONVERTED_BLOGS.map((path) => [path, [BLOG_END_OF_ARTICLE]])),
};

// data-full-width-responsive per page for its flexible (data-ad-format="auto") units. Every blog
// unit is 'false', like the pilot: the ad stays responsive inside the article column instead of
// expanding to the viewport edges. The tool pages' bottom containers already span the viewport.
const FULL_WIDTH = {
  [BLOG_PILOT]: 'false',
  'gear/index.html': 'true',
  'stocking-advisor.html': 'true',
  'cycling-coach/index.html': 'true',
  'assistant.html': 'true',
  'podcast/index.html': 'true',
  // Kept inside the article / content column: the University shell clips overflow.
  'tanks/project-tank-000.html': 'false',
  'university/index.html': 'false',
  'blogs/index.html': 'false',
  'community-tanks.html': 'true',
  'submit-your-tank.html': 'false',
  'tools/snail-stock-recommender.html': 'true',
  ...Object.fromEntries(CONVERTED_BLOGS.map((path) => [path, 'false'])),
};

// Compact middle units use Google's "exact size per screen width" responsive code instead of
// data-ad-format="auto": a size class on the <ins>, sized only by inline rules on the page
// (Google does not support those rules in external stylesheets) and hidden where no size fits.
const COMPACT_UNITS = {
  'stocking-advisor.html': [
    {
      id: 'ad-stocking-mid',
      slot: '5996977454', // TTG_StockingAdvisor_Mid
      sizeClass: 'ttg_stocking_mid',
      // [media query or null for the base rule, width, height]
      sizes: [
        [null, 320, 100],
        ['(min-width: 520px)', 468, 60],
        ['(min-width: 800px)', 728, 90],
      ],
      hiddenBelow: '(max-width: 359px)',
    },
  ],
  // Same sizes and breakpoints: both content columns are at least 320px wide from a 360px viewport.
  'assistant.html': [
    {
      id: 'ad-assistant-mid',
      slot: '8930237876', // TTG_Assistant_Mid
      sizeClass: 'ttg_assistant_mid',
      sizes: [
        [null, 320, 100],
        ['(min-width: 520px)', 468, 60],
        ['(min-width: 800px)', 728, 90],
      ],
      hiddenBelow: '(max-width: 359px)',
    },
  ],
  'media.html': [
    {
      id: 'ad-media-faq-top',
      slot: '6497764235', // TTG_MediaProto_FAQ_Top
      sizeClass: 'ttg_media_faq_top',
      sizes: [
        [null, 320, 100],
        ['(min-width: 520px)', 468, 60],
        ['(min-width: 800px)', 728, 90],
      ],
      hiddenBelow: '(max-width: 359px)',
    },
  ],
};
// Phase B1 converted exactly these six house-ad positions on content and hub pages.
const PHASE_B1_CONVERSIONS = {
  'assistant.html': ['ad-assistant-mid', 'ad-assistant-bottom'],
  'media.html': ['ad-media-faq-top'],
  'podcast/index.html': ['ad-podcast-bottom'],
  'tanks/project-tank-000.html': ['ad-project-tank-000-bottom'],
  'university/index.html': ['ad-university-waterchem-bottom'],
};
const PHASE_B1_PAGES = Object.keys(PHASE_B1_CONVERSIONS);
const PHASE_B4_PAGES = [
  'blogs/index.html',
  'community-tanks.html',
  'submit-your-tank.html',
  'tools/snail-stock-recommender.html',
];
const compactSlots = (path) => (COMPACT_UNITS[path] || []).map((unit) => unit.slot);

// House-ad slots on the converted pages that stay house ads in this phase.
const KEPT_HOUSE_ADS = {
  [BLOG_PILOT]: [],
  'gear/index.html': ['ad-gear-top'],
  'stocking-advisor.html': ['ad-stocking-top'],
  'cycling-coach/index.html': ['ad-cycling-top'],
  'assistant.html': [],
  'media.html': ['ad-media-feature-your-tank'],
  'podcast/index.html': ['ad-podcast-top'],
  'tanks/project-tank-000.html': [],
  'university/index.html': ['ad-university-waterchem-top'],
  'blogs/index.html': [],
  'community-tanks.html': ['ad-community-tanks-store'],
  'submit-your-tank.html': [],
  'tools/snail-stock-recommender.html': ['ad-snail-recommender-bottom'],
  ...Object.fromEntries(CONVERTED_BLOGS.map((path) => [path, []])),
};

// Every house-ad slot still on the site. Converting or removing one must update this list.
const REMAINING_HOUSE_ADS = {
  'about.html': ['ad-about-books', 'ad-about-beginners', 'ad-about-footer-top'],
  'community-tanks.html': ['ad-community-tanks-store'],
  'cycling-coach/index.html': ['ad-cycling-top'],
  'gear/index.html': ['ad-gear-top'],
  'media.html': ['ad-media-feature-your-tank'],
  'podcast/index.html': ['ad-podcast-top'],
  'stocking-advisor.html': ['ad-stocking-top'],
  'tools/snail-stock-recommender.html': ['ad-snail-recommender-bottom'],
  'university/index.html': ['ad-university-waterchem-top'],
};

const HTML_FILES = execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter((path) => path && !path.startsWith('dist/') && !path.startsWith('_internal/'));

const adSlots = (html) => [...html.matchAll(/data-ad-slot="([^"]*)"/g)].map((m) => m[1]);
const houseAdIds = (html) =>
  [...html.matchAll(/<div\b[^>]*\bttg-house-ad-slot\b[^>]*>/g)].map((m) => (m[0].match(/\bid="([^"]+)"/) || [])[1]);
const consentStack = (html) =>
  html.slice(html.indexOf('<!-- TTG consent stack START'), html.indexOf('<!-- TTG consent stack END -->'));

test('homepage has no AdSense loader, Google ad units or house-ad containers', () => {
  const html = read('index.html');
  assert.equal((html.match(LOADER) || []).length, 0, 'AdSense loader must not be on the homepage');
  for (const marker of [
    'adsbygoogle',
    'data-ad-slot',
    'data-ad-client',
    'ttg-gad',
    'ttg-house-ad-slot',
    'ttg-ad-slot',
    'data-ttg-ad-rotator',
    'data-house-ad',
    'inhouse-ad',
    'google-ads.js',
    'ad-rotator.js',
    'house-ads.js',
  ]) {
    assert.ok(!html.includes(marker), `homepage must not contain "${marker}"`);
  }
});

test('homepage keeps Consent Mode v2 defaults, Funding Choices and GTM', () => {
  const html = read('index.html');
  assert.match(html, /gtag\('consent', 'default'/);
  assert.match(html, /fundingchoicesmessages\.google\.com\/i\/pub-9905718149811880/);
  assert.match(html, /GTM-KTRVCMQN/);
  assert.match(html, /\/assets\/js\/consent-mode\.js/);
});

test('shared includes inject no ads site-wide', () => {
  for (const path of ['nav.html', 'footer.html', 'js/nav.js', 'js/footer-loader.js', 'assets/js/consent-mode.js', 'js/google-ads.js']) {
    const text = read(path);
    assert.ok(!/<ins[^>]+adsbygoogle/.test(text), `${path} must not contain ad units`);
    assert.ok(!/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle/.test(text), `${path} must not load AdSense`);
  }
  // The initializer only fills units already in the page; it never creates them.
  assert.ok(!/createElement\(\s*['"]ins['"]/.test(read('js/google-ads.js')));
});

test('no Auto ads / page-level ads code and no retired or foreign ad IDs', () => {
  for (const path of HTML_FILES) {
    const html = read(path);
    assert.ok(!/enable_page_level_ads|google_ad_client|overlays\s*:\s*\{/.test(html), `${path} must not enable Auto ads`);
    for (const slot of RETIRED_SLOTS) assert.ok(!html.includes(slot), `${path} must not use retired slot ${slot}`);
    for (const m of html.matchAll(/data-ad-client="([^"]*)"/g)) assert.equal(m[1], PUBLISHER, path);
    for (const m of html.matchAll(/adsbygoogle\.js\?client=([^"&]*)/g)) assert.equal(m[1], PUBLISHER, path);
  }
});

test('manual ad units appear only on reviewed pages with their dashboard slot IDs', () => {
  for (const path of HTML_FILES) {
    const slots = adSlots(read(path));
    assert.deepEqual(slots, MANUAL_UNITS[path] || [], `${path} has unreviewed data-ad-slot values`);
  }
});

for (const [path, slots] of Object.entries(MANUAL_UNITS)) {
  test(`${path}: one loader, one request per unit, scoped container`, () => {
    const html = read(path);
    assert.equal((html.match(LOADER) || []).length, 1, 'AdSense loader exactly once');
    const loaderAt = html.search(LOADER);
    assert.ok(html.indexOf('/assets/js/consent-mode.js') < loaderAt, 'loader stays after the consent stack');
    assert.ok(html.indexOf("gtag('consent', 'default'") < loaderAt, 'Consent Mode defaults precede the loader');

    const units = [...html.matchAll(new RegExp(String.raw`<aside class="ttg-gad" id="([^"]+)" aria-label="${GOOGLE_AD_LABEL}">\s*<p class="ttg-gad__label" aria-hidden="true">${GOOGLE_AD_LABEL}<\/p>\s*<ins class="adsbygoogle( [a-z0-9_]+)?"([^>]*)><\/ins>\s*<\/aside>`, 'g'))];
    assert.equal(units.length, slots.length, 'each unit sits in a .ttg-gad container');
    const compact = COMPACT_UNITS[path] || [];
    for (const [, id, sizeClass, attrs] of units) {
      assert.match(attrs, new RegExp(`data-ad-client="${PUBLISHER}"`));
      const spec = compact.find((unit) => unit.id === id);
      if (spec) {
        // Compact units: fixed per-width sizes from the page's inline rules, never the flexible format.
        assert.equal(sizeClass, ` ${spec.sizeClass}`, `${id} carries its size class`);
        assert.match(attrs, new RegExp(`data-ad-slot="${spec.slot}"`), `${id} uses its own unit`);
        assert.ok(!/data-ad-format|data-full-width-responsive|style=/.test(attrs), `${id} is not a flexible unit`);
      } else {
        assert.equal(sizeClass, undefined, `${id} is a flexible unit without a size class`);
        assert.ok(!compactSlots(path).some((slot) => attrs.includes(`"${slot}"`)), `${id} does not reuse a compact unit`);
        assert.match(attrs, /data-ad-format="auto"/);
        assert.match(attrs, new RegExp(`data-full-width-responsive="${FULL_WIDTH[path]}"`));
      }
    }
    assert.equal(units.filter(([, id]) => compact.some((unit) => unit.id === id)).length, compact.length, 'every compact unit is present');
    assert.equal((html.match(/<ins class="adsbygoogle[ "]/g) || []).length, slots.length, 'no stray <ins> units');

    // Units are requested only by js/google-ads.js — no inline push() loops on the page.
    assert.equal((html.match(/\/js\/google-ads\.js\?v=[^"]+"/g) || []).length, 1, 'initializer linked once');
    assert.equal((html.match(/\/css\/google-ads\.css\?v=[^"]+"/g) || []).length, 1, 'stylesheet linked once');
    assert.ok(!/adsbygoogle\s*=\s*window\.adsbygoogle|adsbygoogle\s*\|\|\s*\[\]\)\.push/.test(html), 'no inline adsbygoogle.push()');

    // Converted units are not legacy slots, so house-ad rotators and empty-slot overlays skip them.
    for (const [unit] of units) {
      assert.ok(!/ttg-ad-slot|ttg-house-ad-slot|data-ttg-ad-rotator|data-ad-label/.test(unit));
    }
    assert.deepEqual(houseAdIds(html), KEPT_HOUSE_ADS[path], 'remaining house-ad slots are unchanged');
  });
}

test('google-ads.js requests each unit at most once and honours the first-party opt-out', () => {
  const js = read('js/google-ads.js');
  assert.match(js, /__TTG_GAD_INIT__/);
  assert.match(js, /data-adsbygoogle-status/);
  assert.match(js, /data-ad-consent'\) === 'denied'/);
  assert.ok(!/setInterval|setTimeout/.test(js), 'no refresh or retry timers');
  // A unit hidden at the current width is not requested (Google cannot size it), and each push
  // names its unit so a bare push() cannot fill the hidden one in its place.
  assert.match(js, /getClientRects\(\)\.length > 0 && ins\.offsetWidth > 0/);
  assert.match(js, /\.push\(\{ element: ins \}\)/);
  assert.ok(!/\.push\(\{\}\)/.test(js), 'no bare push()');
});

for (const [path, units] of Object.entries(COMPACT_UNITS)) {
  test(`${path}: compact units are sized only by inline exact-size rules`, () => {
    const html = read(path);
    const style = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    for (const unit of units) {
      const scope = `#${unit.id} .${unit.sizeClass}`;
      for (const [media, width, height] of unit.sizes) {
        const rule = `${scope} { ${media ? '' : 'display: block; '}width: ${width}px; height: ${height}px; }`;
        assert.ok(style.includes(media ? `@media ${media} { ${rule} }` : rule), `${unit.id}: ${media || 'base'} ${width}x${height}`);
      }
      assert.match(style, new RegExp(`@media ${unit.hiddenBelow.replace(/[()]/g, '\\$&')} \\{\\s*#${unit.id},\\s*#${unit.id} \\.${unit.sizeClass} \\{ display: none; \\}`), `${unit.id} hidden below the smallest size`);
      // The shared stylesheet must not size or crop compact units.
      assert.ok(!read('css/google-ads.css').includes(unit.sizeClass));
    }
  });
}

test('interactive tools show a FishKeepingLifeCo rotating house ad before any Google unit', () => {
  const containers = /<(?:div|aside)\b[^>]*\b(ttg-house-ad-slot|ttg-gad)\b[^>]*>/g;
  for (const path of ['stocking-advisor.html', 'gear/index.html', 'cycling-coach/index.html', 'tools/snail-stock-recommender.html']) {
    const html = read(path);
    const [first] = [...html.matchAll(containers)];
    assert.ok(first && first[1] === 'ttg-house-ad-slot', `${path}: first ad is a house ad`);
    assert.match(first[0], /data-ttg-ad-rotator="true"/, `${path}: first ad rotates`);
  }
});

test('google-ads.css never caps or clips ad height and only collapses unfilled units', () => {
  const css = read('css/google-ads.css');
  assert.ok(!/max-height:(?!\s*none\s*;)/.test(css), 'no max-height caps');
  assert.ok(!/overflow:\s*(hidden|clip)/.test(css), 'no overflow clipping');
  assert.match(css, /data-ad-status="unfilled"/);
  assert.ok(!/data-ad-status="filled"\][^{]*\{[^}]*display:\s*none/.test(css), 'filled ads are never hidden');
});

test('every approved Google-ad page carries the pilot consent stack and loader verbatim', () => {
  const pilotStack = consentStack(read(BLOG_PILOT));
  assert.match(pilotStack, LOADER);
  // The podcast page gained its loader in Phase B1; its stack must now match the pilot exactly.
  for (const path of [...CONVERTED_BLOGS, ...PHASE_B1_PAGES, ...PHASE_B4_PAGES]) {
    assert.equal(consentStack(read(path)), pilotStack, path);
  }
});

test('every Google unit is labelled "Advertisements"; house ads keep their own markup', () => {
  let labelled = 0;
  for (const path of HTML_FILES) {
    const html = read(path);
    const containers = [...html.matchAll(/<aside class="ttg-gad"[^>]*>/g)].map((m) => m[0]);
    const labels = [...html.matchAll(/<p class="ttg-gad__label"[^>]*>([^<]*)<\/p>/g)].map((m) => m[1]);
    assert.equal(labels.length, containers.length, `${path}: one visible label per Google unit`);
    for (const tag of containers) assert.match(tag, new RegExp(`aria-label="${GOOGLE_AD_LABEL}"`), `${path}: accessible name`);
    for (const text of labels) assert.equal(text, GOOGLE_AD_LABEL, `${path}: visible label wording`);
    // The label belongs to Google units only; FishKeepingLifeCo house ads never carry it.
    for (const m of html.matchAll(/<div\b[^>]*\bttg-house-ad-slot\b[\s\S]*?<\/div>/g)) {
      assert.ok(!m[0].includes('ttg-gad__label'), `${path}: house ad without a Google label`);
    }
    labelled += labels.length;
  }
  const expected = Object.values(MANUAL_UNITS).reduce((sum, slots) => sum + slots.length, 0);
  assert.equal(labelled, expected, 'every approved unit, and only those, is labelled');
});

test('Phase B1 converted exactly six house-ad positions, in place, to Google units', () => {
  let converted = 0;
  for (const [path, ids] of Object.entries(PHASE_B1_CONVERSIONS)) {
    const html = read(path);
    const gads = [...html.matchAll(/<aside class="ttg-gad" id="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(gads, ids, `${path}: Google units keep the original position IDs`);
    for (const id of ids) assert.ok(!houseAdIds(html).includes(id), `${path}: ${id} is no longer a house ad`);
    converted += ids.length;
  }
  assert.equal(converted, 6);
  const remaining = Object.values(REMAINING_HOUSE_ADS).reduce((sum, ids) => sum + ids.length, 0);
  // Phase B1 took the inventory from 18 to 12; Phase B2 converted the Neocaridina rotator (11).
  assert.equal(remaining, 11, 'remaining house-ad inventory');
  // The historical University Water Chemistry unit must not be used in place of TTG_University_Bottom.
  assert.ok(!read('university/index.html').includes('4602491969'));
  // Project Tank's only rotator was its bottom slot, so the page no longer loads the rotator itself.
  assert.ok(!read('tanks/project-tank-000.html').includes('ad-rotator.js'));
});

test('remaining house-ad slots are exactly the expected inventory', () => {
  const found = {};
  for (const path of HTML_FILES) {
    const ids = houseAdIds(read(path));
    if (ids.length) found[path] = ids;
  }
  assert.deepEqual(found, REMAINING_HOUSE_ADS);
});

test('houseplant articles replaced their rotators and keep .blog-body inside the column', () => {
  for (const path of BLOG_HOUSEPLANTS) {
    const html = read(path);
    assert.deepEqual(houseAdIds(html), [], path);
    assert.ok(!/data-ttg-ad-rotator|ttg-ad-banner-link|ad-[a-z-]+-rotator"/.test(html), `${path} keeps no rotator markup`);
    // Without an explicit width the column-flex .blog-body shrink-wraps to the 760px comparison
    // table and overflows the viewport between about 641px and 830px, cropping the ad.
    assert.match(html, /\.blog-body \{ box-sizing: border-box; width: 100%; \}/, `${path} keeps the .blog-body width fix`);
  }
});

test('every blog article with a Google unit uses TTG_Blog_EndOfArticle (41 articles)', () => {
  const blogs = [BLOG_PILOT, ...CONVERTED_BLOGS];
  assert.equal(new Set(blogs).size, 41);
  for (const path of blogs) assert.deepEqual(adSlots(read(path)), [BLOG_END_OF_ARTICLE], path);
});

test('Neocaridina diet article: rotator replaced in place, affiliate content kept', () => {
  const html = read(BLOG_NEOCARIDINA_DIET);
  assert.deepEqual(houseAdIds(html), []);
  assert.ok(!/data-ttg-ad-rotator|neocaridina-shrimp-diet-products\.json|ad-neocaridina-diet-products-rotator"/.test(html), 'no rotator left');
  // Same position: after the FAQ, before the author byline.
  const unit = html.indexOf('<aside class="ttg-gad" id="ad-blog-end-of-article"');
  assert.ok(html.lastIndexOf('u-faq-item', unit) > -1 && unit < html.indexOf('class="ttg-author-byline"'));
  // The article's own Amazon affiliate links (all in the text) are unchanged; only the banner's went.
  const affiliate = [...html.matchAll(/https:\/\/www\.amazon\.com\/dp\/([A-Z0-9]+)[^"]*tag=fishkeepingli-20/g)].map((m) => m[1]);
  assert.deepEqual(affiliate, ['B00KB9LPYK', 'B00L0UBFUI', 'B001XRR26E', 'B00U7Q9HKG', 'B0FXFFH16X']);
});

test('About page and the interactive tools keep their FishKeepingLifeCo house ads only', () => {
  assert.deepEqual(houseAdIds(read('about.html')), ['ad-about-books', 'ad-about-beginners', 'ad-about-footer-top']);
  assert.deepEqual(adSlots(read('about.html')), [], 'no Google units on the About page');
  assert.ok(!read('about.html').includes('ttg-gad'));
});

// Owner decision: About is permanently reserved for FishKeepingLifeCo promotions, so it carries no
// Google ad code at all. Without the loader, Auto ads could not place ads there even if re-enabled.
test('About page has no AdSense loader or Google ad code but keeps the consent stack', () => {
  const html = read('about.html');
  assert.equal((html.match(LOADER) || []).length, 0, 'AdSense loader must not be on the About page');
  assert.ok(!/pagead2\.googlesyndication\.com/.test(html), 'no AdSense script of any kind');
  assert.ok(!/<ins\b[^>]*adsbygoogle/.test(html), 'no Google ad units');
  assert.ok(!/data-ad-client|data-ad-slot|google-ads\.(js|css)|adsbygoogle\s*=|adsbygoogle\)\.push/.test(html), 'no unit config or pushes');
  const stack = consentStack(html);
  assert.match(stack, /gtag\('consent', 'default'/);
  assert.ok(stack.indexOf("gtag('consent', 'default'") < stack.indexOf('fundingchoicesmessages'), 'Consent Mode defaults stay first');
  assert.match(stack, /fundingchoicesmessages\.google\.com\/i\/pub-9905718149811880/);
  assert.match(stack, /googlefcPresent/);
  assert.match(stack, /GTM-KTRVCMQN/);
  assert.match(stack, /\/assets\/js\/consent-mode\.js/);
  assert.match(html, /googletagmanager\.com\/ns\.html\?id=GTM-KTRVCMQN/, 'GTM noscript fallback');
});

// Phase B3 cleanup: the approved end state of the manual rollout.
test('approved inventory: 55 Google units, 41 on TTG_Blog_EndOfArticle, 11 house ads', () => {
  let units = 0;
  let blogUnits = 0;
  let houseAds = 0;
  for (const path of HTML_FILES) {
    const html = read(path);
    const slots = adSlots(html);
    units += slots.length;
    blogUnits += slots.filter((slot) => slot === BLOG_END_OF_ARTICLE).length;
    houseAds += houseAdIds(html).length;
  }
  assert.equal(units, 55, 'manual Google units site-wide');
  assert.equal(blogUnits, 41, 'TTG_Blog_EndOfArticle units site-wide');
  assert.equal(houseAds, 11, 'FishKeepingLifeCo house ads site-wide');
});

test('the AdSense loader appears only on pages with approved units', () => {
  const withLoader = HTML_FILES.filter((path) => (read(path).match(LOADER) || []).length > 0).sort();
  assert.deepEqual(withLoader, Object.keys(MANUAL_UNITS).sort());
});

test('every remaining house ad rotates the shared manifest every 10 seconds', () => {
  const manifest = JSON.parse(read('assets/ads/manifest.json'));
  assert.ok(manifest.length >= 2, 'the shared manifest has banners to rotate');
  for (const entry of manifest) {
    assert.ok(existsSync(ROOT + entry.src.slice(1)), `${entry.src} exists`);
  }
  for (const [path, ids] of Object.entries(REMAINING_HOUSE_ADS)) {
    const html = read(path);
    for (const id of ids) {
      const tag = html.match(new RegExp(`<div\\b[^>]*\\bid="${id}"[^>]*>`));
      assert.ok(tag, `${path}: ${id} present`);
      assert.match(tag[0], /data-ttg-ad-rotator="true"/, `${path}: ${id} rotates`);
      assert.match(tag[0], /data-ttg-ad-manifest="\/assets\/ads\/manifest\.json"/, `${path}: ${id} manifest`);
      assert.match(tag[0], /data-ttg-ad-interval="10000"/, `${path}: ${id} interval`);
    }
    assert.ok((html.match(/ad-rotator\.js/g) || []).length <= 1, `${path}: rotator linked at most once`);
  }
  // Pages without their own <script> tag get the rotator from js/nav.js, which skips it when present.
  const nav = read('js/nav.js');
  assert.match(nav, /AD_ROTATOR_SRC = '\/assets\/js\/ad-rotator\.js/);
  assert.match(nav, /hasAdRotatorScript\(\)/);
});

test('retired ad tracking and house-ad scripts stay removed', () => {
  for (const path of ['js/ad-slot-view-tracking.js', 'dist/js/ad-slot-view-tracking.min.js', 'assets/js/house-ads.js']) {
    assert.ok(!existsSync(ROOT + path), `${path} is retired`);
  }
  for (const path of [...HTML_FILES, 'js/nav.js', 'scripts/build-prod.mjs']) {
    const text = read(path);
    assert.ok(!/ad-slot-view-tracking|house-ads\.js|data-house-ad=/.test(text), `${path} references a retired ad script`);
  }
  // The Phase B2 affiliate manifest is kept for a separate owner decision but no page uses it.
  assert.ok(existsSync(ROOT + 'assets/ads/neocaridina-shrimp-diet-products.json'));
  for (const path of HTML_FILES) assert.ok(!read(path).includes('neocaridina-shrimp-diet-products.json'), path);
});
