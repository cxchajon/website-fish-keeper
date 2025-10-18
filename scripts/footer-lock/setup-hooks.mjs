import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const hooksPath = path.join(repoRoot, '.githooks');

if (!existsSync(hooksPath)) {
  console.warn('No .githooks directory present. Skipping git hooks installation.');
  process.exit(0);
}

try {
  execSync(`git config core.hooksPath ${JSON.stringify(path.relative(repoRoot, hooksPath))}`, {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  console.log('Git hooks configured to use .githooks');
} catch (error) {
  console.warn('Unable to set git hooks path automatically:', error.message);
}
