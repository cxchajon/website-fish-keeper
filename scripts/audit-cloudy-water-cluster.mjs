// Read-only regression check for the Cloudy Water cluster after AdSense Phase 1 Fix #4.
//
// Protects the current architecture:
//   - two retired short URLs stay minimal redirect pages to their long articles
//   - neither retired URL is listed in sitemap.xml
//   - the four strong articles stay indexable, self-canonical, on the standard
//     page shell, and are not replaced by the old generated short drafts
//
// This script only reads files. It never writes, normalizes or generates
// anything, and it makes no network requests.
//
// Usage: node scripts/audit-cloudy-water-cluster.mjs [--root <site directory>]
// --root defaults to the repository root and exists so the check can be
// exercised against scratch copies without touching the real files.

import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://thetankguide.com';
const rootFlag = process.argv.indexOf('--root');
const root = rootFlag > -1 ? path.resolve(process.argv[rootFlag + 1]) : path.resolve(import.meta.dirname, '..');

const RETIRED = [
  { slug: 'what-is-an-aquarium-bacterial-bloom', target: `${SITE}/aquarium-bacterial-bloom/` },
  { slug: 'why-is-my-aquarium-water-green', target: `${SITE}/green-aquarium-water/` },
];
const STRONG = ['aquarium-bacterial-bloom', 'green-aquarium-water', 'why-is-my-aquarium-cloudy', 'brown-aquarium-water-tannins'];

// Minimum visible words inside <main> for a strong article. When this check was
// written the four strong articles had 1,461-2,927 words, while the deleted
// generator's short drafts had 262-369 words (about 600 with the duplicated body
// some of them later carried). 1,000 sits well above any draft yet leaves the
// shortest strong article (~1,460) room for ordinary editing. It only exists to
// catch accidental replacement by a short draft, not to police article length.
const MIN_STRONG_WORDS = 1000;
// A redirect page needs only a one-line "moved" notice.
const MAX_STUB_WORDS = 40;

const failures = [];
let checks = 0;
const check = (ok, file, name, why) => {
  checks += 1;
  if (!ok) failures.push(`FAIL ${file}: ${name} (${why})`);
};

const read = (file) => {
  const abs = path.join(root, file);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
};

const attrs = (tag) => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)].map((m) => [m[1].toLowerCase(), m[3] ?? m[4]])
);
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => attrs(m[0]));
const metas = (html, key, value) => tags(html, 'meta').filter((a) => (a[key] ?? '').toLowerCase() === value);
const canonicals = (html) => tags(html, 'link').filter((a) => (a.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'));
const visibleWords = (fragment) => fragment
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .split(/\s+/)
  .filter(Boolean).length;
const jsonLdBlocks = (html) => [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const schemaTypes = (node, found = new Set()) => {
  if (Array.isArray(node)) node.forEach((n) => schemaTypes(n, found));
  else if (node && typeof node === 'object') {
    [].concat(node['@type'] ?? []).forEach((t) => found.add(t));
    Object.values(node).forEach((v) => schemaTypes(v, found));
  }
  return found;
};

// --- Retired URLs: minimal redirect pages ---------------------------------
for (const { slug, target } of RETIRED) {
  const file = `${slug}/index.html`;
  const html = read(file);
  check(html !== null, file, 'redirect page exists', 'file not found');
  if (html === null) continue;

  const refresh = metas(html, 'http-equiv', 'refresh');
  const refreshMatch = refresh.length === 1 && (refresh[0].content ?? '').match(/^\s*(\d+)\s*;\s*url\s*=\s*(\S+)\s*$/i);
  check(refresh.length === 1, file, 'exactly one meta refresh', `found ${refresh.length}`);
  check(Boolean(refreshMatch) && refreshMatch[1] === '0', file, 'meta refresh delay is 0', `content="${refresh[0]?.content ?? ''}"`);
  check(Boolean(refreshMatch) && refreshMatch[2] === target, file, 'meta refresh points to the long article', `expected ${target}`);

  const canon = canonicals(html);
  check(canon.length === 1 && canon[0].href === target, file, 'canonical points to the long article', `found ${canon.map((c) => c.href).join(', ') || 'none'}`);

  const replaces = [...html.matchAll(/location\.replace\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  check(replaces.length === 1 && replaces[0] === target, file, 'location.replace points to the long article', `found ${replaces.join(', ') || 'none'}`);

  const links = tags(html, 'a').map((a) => a.href);
  check(links.length === 1 && links[0] === target, file, 'exactly one fallback link to the long article', `found ${links.join(', ') || 'none'}`);

  check(jsonLdBlocks(html).length === 0, file, 'no JSON-LD structured data', 'ld+json block present');
  check(!/BlogPosting|"@type"\s*:\s*"Article"/.test(html), file, 'no BlogPosting/Article schema', 'schema type present');
  check(metas(html, 'name', 'robots').length === 0, file, 'no robots meta', 'robots meta present');

  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const leftovers = ['blog-body', 'cluster-nav', 'site-shell', 'tg-figure', '<article', '<h1', '<h2'].filter((m) => html.includes(m));
  check(leftovers.length === 0, file, 'no old article body or generated cluster markup', `found ${leftovers.join(', ')}`);
  const stubWords = visibleWords(body);
  check(stubWords <= MAX_STUB_WORDS, file, 'redirect page carries only a short notice', `${stubWords} visible words`);
}

// --- Sitemap retirement state ---------------------------------------------
const sitemap = read('sitemap.xml');
check(sitemap !== null, 'sitemap.xml', 'sitemap exists', 'file not found');
if (sitemap !== null) {
  const locs = new Set([...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]));
  for (const { slug } of RETIRED) {
    check(!locs.has(`${SITE}/${slug}/`), 'sitemap.xml', `retired URL absent: /${slug}/`, 'URL is listed');
  }
  for (const slug of STRONG) {
    check(locs.has(`${SITE}/${slug}/`), 'sitemap.xml', `strong article present: /${slug}/`, 'URL is missing');
  }
}

// --- Strong articles stay intact ------------------------------------------
for (const slug of STRONG) {
  const file = `${slug}/index.html`;
  const url = `${SITE}/${slug}/`;
  const html = read(file);
  check(html !== null, file, 'article exists', 'file not found');
  if (html === null) continue;

  const canon = canonicals(html);
  check(canon.length === 1 && canon[0].href === url, file, 'self-canonical', `found ${canon.map((c) => c.href).join(', ') || 'none'}`);

  const robots = [...metas(html, 'name', 'robots'), ...metas(html, 'name', 'googlebot')].map((a) => (a.content ?? '').toLowerCase());
  check(!robots.some((r) => /\b(noindex|none)\b/.test(r)), file, 'robots directives permit indexing', `robots="${robots.join(' | ')}"`);
  check(!metas(html, 'http-equiv', 'refresh').length, file, 'not turned into a redirect', 'meta refresh present');

  let types = new Set();
  let parsed = true;
  for (const block of jsonLdBlocks(html)) {
    try { schemaTypes(JSON.parse(block), types); } catch { parsed = false; }
  }
  check(parsed, file, 'JSON-LD parses', 'invalid JSON-LD block');
  check(types.has('BlogPosting'), file, 'JSON-LD includes BlogPosting', `types: ${[...types].join(', ') || 'none'}`);

  check(/\bid=["']site-nav["']/.test(html), file, 'standard navigation host (id="site-nav")', 'missing');
  check(tags(html, 'script').some((a) => /consent-mode\.js/.test(a.src ?? '')), file, 'consent-mode.js referenced', 'missing');

  const fingerprints = ['class="site-shell"', 'cluster-nav'].filter((m) => html.includes(m));
  check(fingerprints.length === 0, file, 'no obsolete generator fingerprints', `found ${fingerprints.join(', ')}`);

  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? '';
  const words = visibleWords(main);
  check(words >= MIN_STRONG_WORDS, file, `substantial article content (>= ${MIN_STRONG_WORDS} words in <main>)`, `${words} words`);
}

if (failures.length) {
  console.error(`Cloudy Water audit FAILED: ${failures.length} of ${checks} checks failed.`);
  failures.forEach((f) => console.error(`  ${f}`));
  process.exitCode = 1;
} else {
  console.log(`Cloudy Water audit passed: ${checks} checks. Retired URLs redirect correctly, are out of the sitemap, and the 4 strong articles are intact.`);
}
