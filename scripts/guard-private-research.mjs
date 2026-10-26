import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const RESEARCH_ROOT = 'research/';
const CONFIG_PATH = path.join(ROOT, '_config.yml');
const DIST_RESEARCH_PATH = path.join(ROOT, 'dist', 'research');

function trackedResearchFiles() {
  return execFileSync('git', ['ls-files', '--', RESEARCH_ROOT], {
    cwd: ROOT,
    encoding: 'utf8'
  })
    .split(/\r?\n/)
    .filter(Boolean);
}

function configExcludesResearch() {
  const config = readFileSync(CONFIG_PATH, 'utf8');
  return /^\s*-\s+research\/$/m.test(config);
}

const failures = [];
const tracked = trackedResearchFiles();

if (tracked.length) {
  failures.push(`private research is tracked: ${tracked.join(', ')}`);
}

if (!configExcludesResearch()) {
  failures.push('_config.yml must exclude research/');
}

if (existsSync(DIST_RESEARCH_PATH)) {
  failures.push('production output contains dist/research');
}

if (failures.length) {
  console.error('[Private research guard] ' + failures.join('; '));
  process.exit(1);
}

console.log('Private research guard passed: no private research is tracked or published.');
