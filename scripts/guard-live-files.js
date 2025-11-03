// Fails if a commit modifies live files while PR title or branch mentions experimental work
// and always fails if changes under /experiments/ also touch live UI files.
// Safe to run locally and in CI.
import { execSync } from 'node:child_process';

const inCi = Boolean(process.env.GITHUB_BASE_REF && process.env.GITHUB_SHA);
const DIFF_RANGE = inCi
  ? `origin/${process.env.GITHUB_BASE_REF}...${process.env.GITHUB_SHA}`
  : null;

function getChangedFiles(range) {
  try {
    const command = range ? `git diff --name-only ${range}` : 'git diff --name-only --cached';
    const output = execSync(command, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    if (output.length || range) {
      return output;
    }
    // Fallback to unstaged changes when nothing is staged.
    return execSync('git diff --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch (error) {
    console.error('[Guard] Unable to compute changed files:', error.message);
    process.exit(1);
  }
}

const changed = getChangedFiles(DIFF_RANGE);

const LIVE_GUARDED = [
  'stocking/',
  'assets/js/',
  'assets/css/',
  'js/',
  'css/',
];

const SAFE_SHARED_PREFIXES = ['assets/js/env/'];

const isGuardedLivePath = (path) => {
  if (SAFE_SHARED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return false;
  }
  return LIVE_GUARDED.some((root) => path.startsWith(root));
};

const EXPERIMENT_FILES = changed.filter((p) => p.startsWith('experiments/'));
const LIVE_TOUCHED = changed.filter((p) => isGuardedLivePath(p));

if (EXPERIMENT_FILES.length && LIVE_TOUCHED.length) {
  console.error('[Guard] Experiment commit also touches live files:\n' + LIVE_TOUCHED.join('\n'));
  process.exit(1);
}

const CI_TITLE = (process.env.PR_TITLE || '').toLowerCase();
const CI_BRANCH = (process.env.GITHUB_HEAD_REF || process.env.BRANCH_NAME || '').toLowerCase();
const mentionsExperiments =
  CI_TITLE.includes('experiment') ||
  CI_BRANCH.includes('experiment') ||
  CI_TITLE.includes('proto-home') ||
  CI_BRANCH.includes('proto-home');

if (mentionsExperiments && LIVE_TOUCHED.length) {
  console.error('[Guard] Experiment PR/branch cannot modify live files:\n' + LIVE_TOUCHED.join('\n'));
  process.exit(1);
}
