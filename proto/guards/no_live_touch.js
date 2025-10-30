#!/usr/bin/env node
import { execSync } from 'node:child_process';
import process from 'node:process';

function listStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.error('[proto-guard] Failed to read staged files:', error?.message || error);
    process.exit(1);
  }
}

function isPrototypePath(file) {
  if (!file) return true;
  const normalized = file.replace(/^\.\//, '');
  if (!normalized) return true;
  const [firstSegment] = normalized.split('/');
  if (!firstSegment) return true;
  const lower = firstSegment.toLowerCase();
  return lower.startsWith('proto'); // covers proto/, prototype/, proto_* files
}

function main() {
  const staged = listStagedFiles();
  if (!staged.length) {
    process.exit(0);
  }
  const offenders = staged.filter((file) => !isPrototypePath(file));
  if (offenders.length) {
    console.error('\n[proto-guard] Blocking commit: detected staged files outside prototype scope.');
    for (const file of offenders) {
      console.error(`  • ${file}`);
    }
    console.error('\nOnly files whose first path segment begins with "proto" or "prototype" may be committed on this branch.');
    process.exit(2);
  }
}

main();
