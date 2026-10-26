import { readFileSync } from 'node:fs';

// The holiday gift guide carries exactly one ad position: the former footer-band house ad, now the
// manual Google unit TTG_Blog_EndOfArticle. Any extra ad container (house ad or Google) fails.
const BLOG_PATH = 'blog/holiday-gift-guide-aquarium-lovers.html';
const expectedIds = ['ad-blog-end-of-article'];
const expectedSlots = ['5598495275'];

function extractIds(markup) {
  const regex = /<(?:div|aside)\b[^>]*\b(?:ttg-house-ad-slot|ttg-gad)\b[^>]*>/g;
  return Array.from(markup.matchAll(regex)).map((match) => (match[0].match(/\bid\s*=\s*"([^"]+)"/) || [])[1]);
}

function extractSlots(markup) {
  return Array.from(markup.matchAll(/data-ad-slot="([^"]*)"/g)).map((match) => match[1]);
}

function main() {
  const markup = readFileSync(BLOG_PATH, 'utf8');
  const ids = extractIds(markup);
  const slots = extractSlots(markup);

  const missing = expectedIds.filter((id) => !ids.includes(id));
  const extras = ids.filter((id) => !expectedIds.includes(id));

  if (ids.length !== expectedIds.length || missing.length || extras.length || slots.join() !== expectedSlots.join()) {
    console.error('[guard-blog-ads] Unexpected ad slots detected for holiday gift guide page.');
    console.error(`Expected IDs: ${expectedIds.join(', ')} (slot ${expectedSlots.join(', ')})`);
    console.error(`Found IDs: ${ids.join(', ') || '(none found)'}; slots: ${slots.join(', ') || '(none)'}`);
    process.exit(1);
  }
}

main();
