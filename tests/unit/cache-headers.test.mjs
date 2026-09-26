// Guards the Cloudflare Pages `_headers` cache policy for code and data the Stocking Advisor loads.
// /js/ file names are not content-hashed and ES-module imports carry no version, so JavaScript and
// the data it reads must revalidate; an immutable cache would leave returning visitors on old code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TEXT = readFileSync(ROOT + '_headers', 'utf8');

// [{ pattern, headers: [[name, value]] }] in file order.
function parseRules(text) {
  const rules = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\S/.test(line)) {
      rules.push({ pattern: line.trim(), headers: [] });
    } else if (rules.length) {
      const index = line.indexOf(':');
      rules.at(-1).headers.push([line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim()]);
    }
  }
  return rules;
}

// Cloudflare Pages splat: `*` matches any run of characters.
const matches = (pattern, path) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(path);
const RULES = parseRules(TEXT);

// Cloudflare joins a header set by several matching rules with commas, which for Cache-Control
// yields contradictory directives — so each path must receive exactly one Cache-Control.
function cacheControlFor(path) {
  const values = RULES.filter((rule) => matches(rule.pattern, path))
    .flatMap((rule) => rule.headers.filter(([name]) => name === 'cache-control').map(([, value]) => value));
  assert.ok(values.length <= 1, `${path} gets ${values.length} Cache-Control values: ${values.join(' | ')}`);
  return values[0] ?? null;
}

const ADVISOR_CODE = [
  '/js/logic/compute.js',
  '/js/logic/compute.legacy.js',
  '/js/stocking.js',
  '/js/stocking-advisor/logic/species-adapter.v2.js',
  '/js/stocking-advisor/logic/bioload-model.js',
  '/js/stocking-advisor/filtration/math.js',
];

test('JavaScript is never cached as immutable or long-lived', () => {
  for (const path of ADVISOR_CODE) {
    const value = cacheControlFor(path);
    assert.ok(value, `${path} has no explicit Cache-Control`);
    assert.doesNotMatch(value, /immutable/, path);
    assert.match(value, /max-age=0\b/, path);
    assert.match(value, /must-revalidate|no-cache/, path);
  }
});

test('the species dataset revalidates like the code that reads it', () => {
  const value = cacheControlFor('/data/stocking-advisor/species.v2.json');
  assert.ok(value, 'species.v2.json has no explicit Cache-Control');
  assert.doesNotMatch(value, /immutable/);
  assert.match(value, /max-age=0\b/);
  assert.match(value, /must-revalidate|no-cache/);
});

test('HTML, image and font caching are unchanged; no path gets two Cache-Control values', () => {
  assert.equal(cacheControlFor('/stocking-advisor.html'), 'public, max-age=3600, must-revalidate');
  assert.equal(cacheControlFor('/assets/img/logo.png'), 'public, max-age=31536000, immutable');
  assert.equal(cacheControlFor('/assets/fonts/inter.woff2'), 'public, max-age=31536000, immutable');
  for (const path of ['/css/style.css', '/assets/js/consent-mode.js', '/ads.txt']) cacheControlFor(path);
});

test('site-wide security headers are still present', () => {
  const global = RULES.find((rule) => rule.pattern === '/*');
  assert.deepEqual(Object.fromEntries(global.headers), {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'x-xss-protection': '1; mode=block',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'geolocation=(), microphone=(), camera=()',
  });
});
