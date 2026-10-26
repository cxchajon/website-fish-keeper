// Guards the manual Google AdSense rollout (hybrid house ads + manual Display units).
// - The homepage stays ad-free: no AdSense loader, no Google ad units, no house-ad containers.
// - Auto ads stay off in code: no page-level/Auto ads snippet, no units in shared nav/footer includes.
// - Manual units exist only where they were reviewed, with the dashboard slot IDs below.
// - Converted pages load the AdSense loader once and request each unit once (js/google-ads.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(ROOT + path, 'utf8');
const PUBLISHER = 'ca-pub-9905718149811880';
const LOADER = /<script[^>]+src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"]*"/g;
const RETIRED_SLOTS = ['8979116676'];

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
const CONVERTED_BLOGS = [...BLOG_BATCH_2, ...BLOG_HOUSEPLANTS];

// Excluded from the blog batch: its products slot needs a separate affiliate-advertising decision.
const EXCLUDED_BLOG = 'neocaridina-shrimp-diet-biofilm-guide/index.html';

// page -> data-ad-slot values that page may carry. Adding a unit anywhere else must update this list.
const MANUAL_UNITS = {
  [BLOG_PILOT]: [BLOG_END_OF_ARTICLE],
  'gear/index.html': ['1762971638'], // TTG_Gear_Bottom
  'stocking-advisor.html': ['9758352395'], // TTG_StockingAdvisor_Bottom
  ...Object.fromEntries(CONVERTED_BLOGS.map((path) => [path, [BLOG_END_OF_ARTICLE]])),
};

// data-full-width-responsive per page. Every blog unit is 'false', like the pilot: the ad stays
// responsive inside the article column instead of expanding to the viewport edges. The tool pages'
// containers already span the viewport.
const FULL_WIDTH = {
  [BLOG_PILOT]: 'false',
  'gear/index.html': 'true',
  'stocking-advisor.html': 'true',
  ...Object.fromEntries(CONVERTED_BLOGS.map((path) => [path, 'false'])),
};

// House-ad slots on the converted pages that stay house ads in this phase.
const KEPT_HOUSE_ADS = {
  [BLOG_PILOT]: [],
  'gear/index.html': ['ad-gear-top'],
  'stocking-advisor.html': ['ad-stocking-top', 'ad-stocking-mid'],
  ...Object.fromEntries(CONVERTED_BLOGS.map((path) => [path, []])),
};

// Every house-ad slot still on the site. Converting or removing one must update this list.
const REMAINING_HOUSE_ADS = {
  'about.html': ['ad-about-books', 'ad-about-beginners', 'ad-about-footer-top'],
  'assistant.html': ['ad-assistant-mid', 'ad-assistant-bottom'],
  'community-tanks.html': ['ad-community-tanks-store'],
  'cycling-coach/index.html': ['ad-cycling-top', 'ad-cycling-bottom'],
  'gear/index.html': ['ad-gear-top'],
  'media.html': ['ad-media-feature-your-tank', 'ad-media-faq-top'],
  'neocaridina-shrimp-diet-biofilm-guide/index.html': ['ad-neocaridina-diet-products-rotator'],
  'podcast/index.html': ['ad-podcast-top', 'ad-podcast-bottom'],
  'stocking-advisor.html': ['ad-stocking-top', 'ad-stocking-mid'],
  'tanks/project-tank-000.html': ['ad-project-tank-000-bottom'],
  'tools/snail-stock-recommender.html': ['ad-snail-recommender-bottom'],
  'university/index.html': ['ad-university-waterchem-top', 'ad-university-waterchem-bottom'],
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

    const units = [...html.matchAll(/<aside class="ttg-gad" id="[^"]+" aria-label="Advertisement">\s*<p class="ttg-gad__label" aria-hidden="true">Advertisement<\/p>\s*<ins class="adsbygoogle"([^>]*)><\/ins>\s*<\/aside>/g)];
    assert.equal(units.length, slots.length, 'each unit sits in a .ttg-gad container');
    for (const [, attrs] of units) {
      assert.match(attrs, new RegExp(`data-ad-client="${PUBLISHER}"`));
      assert.match(attrs, /data-ad-format="auto"/);
      assert.match(attrs, new RegExp(`data-full-width-responsive="${FULL_WIDTH[path]}"`));
    }
    assert.equal((html.match(/<ins class="adsbygoogle"/g) || []).length, slots.length, 'no stray <ins> units');

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
});

test('google-ads.css never caps or clips ad height and only collapses unfilled units', () => {
  const css = read('css/google-ads.css');
  assert.ok(!/max-height:(?!\s*none\s*;)/.test(css), 'no max-height caps');
  assert.ok(!/overflow:\s*(hidden|clip)/.test(css), 'no overflow clipping');
  assert.match(css, /data-ad-status="unfilled"/);
  assert.ok(!/data-ad-status="filled"\][^{]*\{[^}]*display:\s*none/.test(css), 'filled ads are never hidden');
});

test('every converted blog article carries the pilot consent stack and loader verbatim', () => {
  const pilotStack = consentStack(read(BLOG_PILOT));
  assert.match(pilotStack, LOADER);
  for (const path of CONVERTED_BLOGS) {
    assert.equal(consentStack(read(path)), pilotStack, path);
  }
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

test('excluded blog article keeps its house ad and has no Google unit', () => {
  const html = read(EXCLUDED_BLOG);
  assert.deepEqual(houseAdIds(html), ['ad-neocaridina-diet-products-rotator']);
  assert.ok(!html.includes('adsbygoogle'));
});
