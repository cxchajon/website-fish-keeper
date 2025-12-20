import { readFileSync } from 'node:fs';

const BLOG_PATH = 'blog/holiday-gift-guide-aquarium-lovers.html';
const expectedIds = ['ad-holiday-gift-guide-top', 'ad-holiday-gift-guide-footer-band'];

function extractIds(markup) {
  const regex = /<div\s+class\s*=\s*"[^"]*ttg-house-ad-slot[^"]*"[^>]*\s+id\s*=\s*"([^"]+)"/g;
  return Array.from(markup.matchAll(regex)).map((match) => match[1]);
}

function main() {
  const markup = readFileSync(BLOG_PATH, 'utf8');
  const ids = extractIds(markup);

  const missing = expectedIds.filter((id) => !ids.includes(id));
  const extras = ids.filter((id) => !expectedIds.includes(id));

  if (ids.length !== expectedIds.length || missing.length || extras.length) {
    console.error('[guard-blog-ads] Unexpected in-house ad slots detected for holiday gift guide page.');
    console.error(`Expected IDs: ${expectedIds.join(', ')}`);
    console.error(`Found IDs: ${ids.join(', ') || '(none found)'}`);
    process.exit(1);
  }
}

main();
