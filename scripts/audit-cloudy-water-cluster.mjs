import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const slugs = ['why-is-my-aquarium-cloudy','what-is-an-aquarium-bacterial-bloom','why-is-my-aquarium-water-green','brown-aquarium-water-tannins'];
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');

for (const slug of slugs) {
  const file = path.join(root, slug, 'index.html');
  assert.ok(fs.existsSync(file), `${slug} must resolve to index.html`);
  const html = fs.readFileSync(file, 'utf8');
  const canonical = `https://thetankguide.com/${slug}/`;
  assert.match(html, new RegExp(`<link rel="canonical" href="${canonical}"`));
  assert.match(html, /<meta name="robots" content="index, follow">/);
  assert.doesNotMatch(html, /noindex/i);
  assert.match(sitemap, new RegExp(`<loc>${canonical}</loc>`));
  assert.match(html, /<nav aria-label="Breadcrumb"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  const match = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  assert.ok(match, `${slug} needs JSON-LD`);
  JSON.parse(match[1]);
  for (const other of slugs) {
    if (other !== slug) assert.match(html, new RegExp(`href="/${other}/"`), `${slug} must link to ${other}`);
  }
  for (const src of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    if (src[1].startsWith('/')) assert.ok(fs.existsSync(path.join(root, src[1])), `${slug} image missing: ${src[1]}`);
  }
}

console.log(`Cloudy Water cluster audit passed for ${slugs.length} pages.`);
