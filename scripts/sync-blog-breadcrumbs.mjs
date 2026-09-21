import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const HOME_URL = 'https://thetankguide.com/';
const BLOGS_URL = 'https://thetankguide.com/blogs/';
const CHECK_ONLY = process.argv.includes('--check');
const SKIPPED_DIRECTORIES = new Set(['.git', '_codex_sync', 'dist', 'node_modules']);

function decodeHtml(value) {
  return value.replace(/<[^>]*>/g, '')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? Number.parseInt(code.slice(1), 16) : Number(code)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function renderBlogBreadcrumb(title) {
  return `<nav aria-label="Breadcrumb" class="breadcrumb blog-breadcrumb"><ol><li><a href="${HOME_URL}">Home</a></li><li aria-hidden="true">/</li><li><a href="${BLOGS_URL}">Blogs</a></li><li aria-hidden="true">/</li><li aria-current="page">${escapeHtml(title)}</li></ol></nav>`;
}

export function blogBreadcrumbItems(title, articleUrl) {
  return [
    { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
    { '@type': 'ListItem', position: 2, name: 'Blogs', item: BLOGS_URL },
    { '@type': 'ListItem', position: 3, name: title, item: articleUrl }
  ];
}

function findJsonObjectRange(source, typeIndex) {
  let start = typeIndex;
  while (start >= 0 && source[start] !== '{') start -= 1;
  if (start < 0) throw new Error('Could not find the start of BreadcrumbList JSON-LD');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return [start, index + 1];
  }
  throw new Error('Could not find the end of BreadcrumbList JSON-LD');
}

function updateSchema(html, title, articleUrl, relativePath) {
  const matches = [...html.matchAll(/"@type"\s*:\s*"BreadcrumbList"/g)];
  if (matches.length !== 1) throw new Error(`${relativePath}: expected one BreadcrumbList, found ${matches.length}`);
  const [start, end] = findJsonObjectRange(html, matches[0].index);
  const breadcrumb = JSON.parse(html.slice(start, end));
  breadcrumb.itemListElement = blogBreadcrumbItems(title, articleUrl);
  return `${html.slice(0, start)}${JSON.stringify(breadcrumb)}${html.slice(end)}`;
}

function updateVisibleBreadcrumb(html, title, relativePath) {
  const pattern = /<nav\b(?=[^>]*class="[^"]*\bblog-breadcrumb\b[^"]*")[\s\S]*?<\/nav>/gi;
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 1) throw new Error(`${relativePath}: duplicate visible blog breadcrumbs`);
  if (matches.length === 1) return html.replace(pattern, renderBlogBreadcrumb(title));
  const mainPattern = /<main\b[^>]*\bclass="[^"]*\barticle-layout\b[^"]*"[^>]*>/i;
  if (!mainPattern.test(html)) throw new Error(`${relativePath}: cannot place the visible breadcrumb before the article`);
  return html.replace(mainPattern, `${renderBlogBreadcrumb(title)}\n  $&`);
}

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) files.push(...await htmlFiles(path.join(directory, entry.name)));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path.join(directory, entry.name));
  }
  return files;
}

function isBlogArticle(html, relativePath) {
  return relativePath !== 'blogs/index.html' && (html.includes('blog-breadcrumb') || html.includes('"BlogPosting"'));
}

async function run() {
  const changed = [];
  let checked = 0;
  for (const file of await htmlFiles(ROOT)) {
    const relativePath = path.relative(ROOT, file);
    const original = await fs.readFile(file, 'utf8');
    if (!isBlogArticle(original, relativePath)) continue;
    const titleMatch = original.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const canonicalMatch = original.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["'](https:\/\/thetankguide\.com\/[^"']+)["'][^>]*>/i)
      ?? original.match(/<link\b[^>]*href=["'](https:\/\/thetankguide\.com\/[^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
    if (!titleMatch || !canonicalMatch) throw new Error(`${relativePath}: missing h1 or canonical URL`);
    const title = decodeHtml(titleMatch[1]);
    let updated = updateVisibleBreadcrumb(original, title, relativePath);
    updated = updateSchema(updated, title, canonicalMatch[1], relativePath);
    checked += 1;
    if (updated !== original) {
      changed.push(relativePath);
      if (!CHECK_ONLY) await fs.writeFile(file, updated);
    }
  }
  if (CHECK_ONLY && changed.length) throw new Error(`${changed.length} blog article(s) have non-standard breadcrumbs:\n${changed.join('\n')}`);
  console.log(`${CHECK_ONLY ? 'Validated' : 'Synchronized'} ${checked} blog article breadcrumbs${changed.length ? ` (${changed.length} updated)` : ''}.`);
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
