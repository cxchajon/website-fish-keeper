import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const CANONICAL_VERSION = '1.5.2';
const CANONICAL_SCRIPT_SRC = `/js/footer-loader.js?v=${CANONICAL_VERSION}`;
const CANONICAL_FOOTER_SRC = `/footer.html?v=${CANONICAL_VERSION}`;
const ALLOWED_SOCIAL_CLASS_TOKENS = new Set(['social-strip', 'under-social']);
const EXPECTED_SOCIAL_HREFS = [
  'https://www.instagram.com/FishKeepingLifeCo',
  'https://www.tiktok.com/@FishKeepingLifeCo',
  'https://www.facebook.com/fishkeepinglifeco',
  'https://chatgpt.com/g/g-69012624c9688191b98c2623badff18d-the-tank-guide-assistant-by-fishkeepinglifeco',
  'https://x.com/fishkeepinglife',
  'https://www.youtube.com/@fishkeepinglifeco',
];
const EXPECTED_NAV_HREFS = [
  '/privacy-legal.html',
  '/terms.html',
  '/trust-security.html',
  '/cookie-settings.html',
  '/cookie-settings.html',
  '/contact-feedback.html',
  '/store.html',
  '/copyright-dmca.html',
];

const parseAttributes = (attrString) => {
  const attributes = {};
  const attrPattern = /(\w[\w-]*)="([^"]*)"/g;
  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = attrPattern.exec(attrString)) !== null) {
    attributes[match[1]] = match[2];
  }
  return attributes;
};

const extractBlock = (text, startMarker) => {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) {
    return null;
  }
  const endIndex = text.indexOf('</div>', startIndex);
  if (endIndex === -1) {
    return null;
  }
  return text.slice(startIndex, endIndex);
};

const gitLsFiles = () => {
  const output = execSync('git ls-files "*.html"', { encoding: 'utf8' }).trim();
  return output ? output.split('\n') : [];
};

const isPage = (relativePath) => {
  if (!relativePath.endsWith('.html')) {
    return false;
  }

  if (relativePath === 'footer.html' || relativePath === 'nav.html') {
    return false;
  }

  if (relativePath.startsWith('includes/') || relativePath.startsWith('archive/') || relativePath.startsWith('templates/')) {
    return false;
  }

  if (relativePath.startsWith('legacy/') || relativePath.startsWith('AUDIT/') || relativePath.startsWith('docs/')) {
    return false;
  }

  if (relativePath.startsWith('reports/') || relativePath.startsWith('tests/') || relativePath.startsWith('dist/')) {
    return false;
  }

  if (relativePath.startsWith('assets/') || relativePath.startsWith('scripts/') || relativePath.startsWith('src/')) {
    return false;
  }

  if (relativePath.includes('/backups/')) {
    return false;
  }

  if (!relativePath.includes('/')) {
    return true;
  }

  const allowedPrefixes = ['blogs/', 'gear/', 'pages/', 'university/'];
  return allowedPrefixes.some((prefix) => relativePath.startsWith(prefix));
};

const lineNumber = (lines, index) => {
  let count = 0;
  for (let i = 0; i < lines.length; i += 1) {
    count += lines[i].length + 1; // include newline
    if (count > index) {
      return i + 1;
    }
  }
  return lines.length;
};

const lint = () => {
  const files = gitLsFiles();
  const issues = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');

    if (file === 'footer.html') {
      if (/<meta\s+name="robots"/i.test(text)) {
        issues.push({ file, message: 'Remove <meta name="robots"> from footer.html.' });
      }

      if (/<style\b/i.test(text)) {
        issues.push({ file, message: 'Inline <style> blocks are not allowed in footer.html.' });
      }

      const socialBlock = extractBlock(text, '<div class="community-links');
      if (!socialBlock) {
        issues.push({ file, message: 'Missing social link strip container.' });
      } else {
        const socialAnchors = [...socialBlock.matchAll(/<a\s+([^>]+)>/gi)];
        if (socialAnchors.length !== EXPECTED_SOCIAL_HREFS.length) {
          issues.push({ file, message: `Expected ${EXPECTED_SOCIAL_HREFS.length} social anchors, found ${socialAnchors.length}.` });
        }
        socialAnchors.forEach((match, index) => {
          const attrs = parseAttributes(match[1]);
          const expectedHref = EXPECTED_SOCIAL_HREFS[index];
          if (!expectedHref) {
            issues.push({ file, message: `Unexpected extra social link: ${attrs.href || '<missing>'}.` });
            return;
          }
          if (attrs.href !== expectedHref) {
            issues.push({ file, message: `Unexpected social href at position ${index + 1}: ${attrs.href || '<missing>'}.` });
          }
          if (attrs.target !== '_blank') {
            issues.push({ file, message: `Social link ${expectedHref} must use target="_blank".` });
          }
          if (!attrs.rel || !attrs.rel.includes('noopener') || !attrs.rel.includes('noreferrer')) {
            issues.push({ file, message: `Social link ${expectedHref} must include rel="noopener noreferrer".` });
          }
          if (!attrs['aria-label']) {
            issues.push({ file, message: `Social link ${expectedHref} missing aria-label.` });
          }
        });
      }

      const navStart = text.indexOf('<nav class="footer-links"');
      if (navStart === -1) {
        issues.push({ file, message: 'Missing legal nav block.' });
      } else {
        const navEnd = text.indexOf('</nav>', navStart);
        const navBlock = navEnd === -1 ? null : text.slice(navStart, navEnd);
        if (!navBlock) {
          issues.push({ file, message: 'Legal nav block is not properly closed.' });
        } else {
          const navAnchors = [...navBlock.matchAll(/<a\s+([^>]+)>/gi)];
          const navHrefs = navAnchors.map((match) => parseAttributes(match[1]).href || '');
          if (navHrefs.length !== EXPECTED_NAV_HREFS.length) {
            issues.push({ file, message: `Expected ${EXPECTED_NAV_HREFS.length} legal links, found ${navHrefs.length}.` });
          } else {
            EXPECTED_NAV_HREFS.forEach((expectedHref, index) => {
              if (navHrefs[index] !== expectedHref) {
                issues.push({ file, message: `Legal link ${index + 1} expected ${expectedHref} but found ${navHrefs[index]}.` });
              }
            });
          }
        }
      }

      if (!text.includes('Shop our books on Amazon')) {
        issues.push({ file, message: 'Amazon CTA text missing.' });
      }

      if (!text.includes('href="https://share.google/y5TcoQZSNh6EUvhqb"')) {
        issues.push({ file, message: 'Powered by link for FishKeepingLifeCo is missing or incorrect.' });
      }

      if (!text.includes('href="https://www.google.com/search?q=FishKeepingLifeCo+The+Tank+Guide"')) {
        issues.push({ file, message: 'Powered by link for The Tank Guide search is missing or incorrect.' });
      }
    }

    if (file !== 'footer.html' && /<footer\b/i.test(text)) {
      issues.push({ file, message: 'Inline <footer> markup detected outside canonical footer.' });
    }

    const forbiddenPartialMatch = text.match(/footer-[^"'>]+\.html/gi);
    if (forbiddenPartialMatch) {
      issues.push({ file, message: 'Legacy footer fragment reference detected (footer-*.html).' });
    }

    if (/includes\/footer/i.test(text)) {
      issues.push({ file, message: 'Legacy footer include reference detected.' });
    }

    const classMatches = text.matchAll(/class="([^"]*social[^"]*)"/gi);
    for (const match of classMatches) {
      const raw = match[1];
      const tokens = raw.split(/\s+/);
      for (const token of tokens) {
        if (!token) {
          continue;
        }
        if (token.toLowerCase().includes('social') && !ALLOWED_SOCIAL_CLASS_TOKENS.has(token)) {
          const idx = text.indexOf(raw, match.index);
          const line = lineNumber(lines, idx);
          issues.push({ file, message: `Unexpected class token "${token}" containing 'social'.`, line });
        }
      }
    }

    if (!isPage(file)) {
      continue;
    }

    const placeholderMatches = [...text.matchAll(/<div\s+id="site-footer"/gi)];
    if (placeholderMatches.length === 0) {
      issues.push({ file, message: 'Missing <div id="site-footer"> placeholder.' });
    } else if (placeholderMatches.length > 1) {
      issues.push({ file, message: `Multiple footer placeholders found (${placeholderMatches.length}).` });
    }

    const scriptMatches = [...text.matchAll(/<script[^>]+src="([^"]*footer-loader\.js[^"]*)"[^>]*>/gi)];
    if (scriptMatches.length === 0) {
      issues.push({ file, message: 'Missing footer loader script include.' });
    } else {
      for (const match of scriptMatches) {
        const src = match[1];
        if (src !== CANONICAL_SCRIPT_SRC) {
          const idx = text.indexOf(src, match.index);
          const line = lineNumber(lines, idx);
          issues.push({ file, message: `Footer loader script uses unexpected src "${src}".`, line });
        }
      }
    }

    if (placeholderMatches.length === 1) {
      const placeholderIndex = placeholderMatches[0].index ?? text.indexOf('<div id="site-footer"');
      const dataAttrMatch = text.slice(placeholderIndex, placeholderIndex + 200).match(/data-footer-src="([^"]+)"/i);
      if (!dataAttrMatch) {
        const line = lineNumber(lines, placeholderIndex);
        issues.push({ file, message: 'Footer placeholder missing data-footer-src attribute.', line });
      } else if (dataAttrMatch[1] !== CANONICAL_FOOTER_SRC) {
        const line = lineNumber(lines, placeholderIndex);
        issues.push({ file, message: `Footer placeholder uses unexpected data-footer-src "${dataAttrMatch[1]}".`, line });
      }

      const scriptIndex = text.indexOf(CANONICAL_SCRIPT_SRC);
      if (scriptIndex !== -1 && scriptIndex > placeholderIndex) {
        const line = lineNumber(lines, scriptIndex);
        issues.push({ file, message: 'Footer loader script must appear before the placeholder.', line });
      }
    }
  }

  if (issues.length > 0) {
    console.error('Footer lint failures:');
    for (const issue of issues) {
      if (issue.line) {
        console.error(` - ${issue.file}:${issue.line} — ${issue.message}`);
      } else {
        console.error(` - ${issue.file} — ${issue.message}`);
      }
    }
    process.exitCode = 1;
  }
};

lint();
