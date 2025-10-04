const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INCLUDE_EXT = new Set(['.html', '.htm', '.js', '.jsx', '.ts', '.tsx']);
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.vercel', 'backups', '.git']);

const amazonHostRe = /https?:\/\/(?:www\.)?amazon\.[a-z.]+\/\S*/i;
const amznShortRe = /https?:\/\/amzn\.to\/\S*/i;

// crude but effective anchor-with-image detector (handles nested tags)
const anchorRe = /<a\b[^>]*href\s*=\s*(['\"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
const hasImgRe = /<img\b[^>]*>/i;

// helper to check rel contains required tokens
const needsTokens = (rel) => {
  const want = ['sponsored', 'noopener', 'noreferrer'];
  const have = (rel || '').toLowerCase().split(/\s+/).filter(Boolean);
  const miss = want.filter(t => !have.includes(t));
  return { have, miss, ok: miss.length === 0 };
};

const results = {
  scannedFiles: 0,
  anchorsChecked: 0,
  violations: [],
  compliant: 0,
  shortLinks: [],
  report: [],
};

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!EXCLUDE_DIRS.has(e.name)) walk(path.join(dir, e.name));
      continue;
    }
    const ext = path.extname(e.name).toLowerCase();
    if (!INCLUDE_EXT.has(ext)) continue;
    const file = path.join(dir, e.name);
    verifyFile(file);
  }
}

function verifyFile(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch { return; }
  results.scannedFiles++;

  let m;
  while ((m = anchorRe.exec(text))) {
    const raw = m[0]; const href = m[2]; const inner = m[3];
    const isAmazon = amazonHostRe.test(href) || amznShortRe.test(href);
    if (!isAmazon) continue;

    // image-based?
    if (!hasImgRe.test(inner)) continue;

    results.anchorsChecked++;

    // Pull rel/target quickly (best-effort; AST in real patcher)
    const relMatch = raw.match(/\brel\s*=\s*(['\"])(.*?)\1/i);
    const targetMatch = raw.match(/\btarget\s*=\s*(['\"])(.*?)\1/i);
    const relVal = relMatch ? relMatch[2] : '';
    const targetVal = targetMatch ? targetMatch[2] : '';

    const tcheck = targetVal === '_blank';
    const rcheck = needsTokens(relVal);

    const short = amznShortRe.test(href);
    if (short) results.shortLinks.push({ file, href });

    if (tcheck && rcheck.ok) {
      results.compliant++;
    } else {
      results.violations.push({
        file,
        href,
        missingRelTokens: rcheck.miss,
        targetOk: tcheck,
      });
    }

    results.report.push({
      file,
      href,
      hasImg: true,
      rel: relVal,
      target: targetVal || '(none)',
      shortLink: short,
      ok: tcheck && rcheck.ok,
    });
  }
}

walk(ROOT);

const summaryPath = path.join(ROOT, 'tests', 'amazon-image-link-summary.json');
fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));

const violations = results.violations.length;
const msg = `[amazon-image-links] files=${results.scannedFiles} anchors=${results.anchorsChecked} ok=${results.compliant} violations=${violations} shortLinks=${results.shortLinks.length}`;
console.log(msg);
if (violations > 0) {
  console.log('Violations:');
  results.violations.slice(0, 25).forEach(v =>
    console.log(`- ${v.file} :: ${v.href} :: missing rel tokens [${v.missingRelTokens.join(', ')}], targetOk=${v.targetOk}`));
  process.exitCode = 1;
}

// --- Add to package.json "scripts" (merge safely) ---
// "audit:amazon:img": "node tests/verify-amazon-image-links.cjs"

// --- Helper CSS (only if you inserted disclosures and no style exists) ---
// .affiliate-note{font-size:.9rem;opacity:.8;margin:.25rem 0 .5rem}
