#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    commits: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--mode=')) {
      args.mode = arg.slice('--mode='.length);
    } else if (arg === '--mode') {
      args.mode = argv[++i];
    } else if (arg.startsWith('--diff=')) {
      args.diff = arg.slice('--diff='.length);
    } else if (arg === '--diff') {
      args.diff = argv[++i];
    } else if (arg.startsWith('--commit=')) {
      args.commits.push(arg.slice('--commit='.length));
    } else if (arg === '--commit') {
      args.commits.push(argv[++i]);
    } else if (arg.startsWith('--hook=')) {
      args.hook = arg.slice('--hook='.length);
    } else if (arg === '--hook') {
      args.hook = argv[++i];
    } else if (arg.startsWith('--report-json=')) {
      args.reportJson = arg.slice('--report-json='.length);
    } else if (arg === '--report-json') {
      args.reportJson = argv[++i];
    } else if (arg === '--silent') {
      args.silent = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function getAllowPatterns(filePath) {
  const raw = readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const patterns = raw.map((pattern) => (pattern.startsWith('/') ? pattern.slice(1) : pattern));
  return patterns.map((pattern) => {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '::double::')
      .replace(/\*/g, '[^/]*')
      .replace(/::double::/g, '.*');
    return new RegExp(`^${escaped}$`);
  });
}

function unique(list) {
  return Array.from(new Set(list));
}

function runGit(command) {
  return execSync(command, { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveFiles(args) {
  if (!args.mode || args.mode === 'staged') {
    return runGit('git diff --cached --name-only --diff-filter=ACDMRTUXB');
  }
  if (args.mode === 'diff') {
    if (!args.diff) {
      throw new Error('Missing --diff <range> for diff mode');
    }
    const diffSpec = args.diff;
    if (diffSpec.includes('..')) {
      return runGit(`git diff --name-only --diff-filter=ACDMRTUXB ${diffSpec}`);
    }
    // Treat as single commit/tree-ish
    return runGit(`git diff-tree --no-commit-id --name-only -r ${diffSpec}`);
  }
  if (args.mode === 'commits') {
    if (!args.commits.length) {
      throw new Error('Provide at least one --commit <sha> for commits mode');
    }
    const files = [];
    args.commits.forEach((sha) => {
      files.push(...runGit(`git diff-tree --no-commit-id --name-only -r ${sha}`));
    });
    return unique(files);
  }
  throw new Error(`Unsupported mode: ${args.mode}`);
}

function checkFiles(files, allowRegexes) {
  const offending = files.filter((file) => !allowRegexes.some((regex) => regex.test(file)));
  return { offending, allowed: offending.length === 0 };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const hookName = args.hook || 'manual';
    const allowPath = path.resolve(process.cwd(), '.guard/prototype-allowlist.txt');
    const allowRegexes = getAllowPatterns(allowPath);
    const files = resolveFiles(args);
    const { offending, allowed } = checkFiles(files, allowRegexes);

    const report = {
      hook: hookName,
      allowed,
      totalFiles: files.length,
      disallowed: offending,
      allowlist: path.relative(process.cwd(), allowPath),
    };

    if (args.reportJson) {
      writeFileSync(args.reportJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    if (!allowed) {
      if (!args.silent) {
        const intro = `Prototype guard (${hookName}) blocked the operation.`;
        const lines = [intro, '', 'Files outside the prototype scope:', ...offending.map((file) => ` - ${file}`), '', 'Only files listed in /.guard/prototype-allowlist.txt are permitted during the gear prototype lock.', 'If this change is intentional, follow the override steps in /.guard/OVERRIDE.md.'];
        console.error(lines.join('\n'));
      }
      process.exit(1);
    } else if (!args.silent && files.length) {
      console.log(`Prototype guard (${hookName}) passed: all ${files.length} file(s) are within the allowlist.`);
    }
  } catch (error) {
    console.error(`[prototype-allowlist-check] ${error.message}`);
    process.exit(1);
  }
}

main();
