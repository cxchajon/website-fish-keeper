import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve('.');
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'playwright-report',
  'test-results'
]);
const TEXT_EXTENSIONS = new Set([
  '.cjs', '.conf', '.css', '.csv', '.hbs', '.htm', '.html', '.js', '.json',
  '.liquid', '.md', '.mjs', '.njk', '.ps1', '.py', '.sh', '.svg', '.toml',
  '.ts', '.tsx', '.txt', '.webmanifest', '.xml', '.yaml', '.yml'
]);
const UNINTENDED_CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

async function collectTextFiles(directory, files = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectTextFiles(absolutePath, files);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolutePath);
    }
  }

  return files;
}

function locate(source, offset) {
  const before = source.slice(0, offset);
  const lines = before.split('\n');
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

export async function assertNoUnintendedControlCharacters(root = ROOT) {
  const files = await collectTextFiles(root);
  const findings = [];

  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    UNINTENDED_CONTROL_CHARACTER.lastIndex = 0;

    for (const match of source.matchAll(UNINTENDED_CONTROL_CHARACTER)) {
      const { line, column } = locate(source, match.index);
      findings.push({
        file: path.relative(root, file),
        line,
        column,
        codePoint: `U+${match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
      });
    }
  }

  if (findings.length > 0) {
    const details = findings
      .map(({ file, line, column, codePoint }) => ` - ${file}:${line}:${column} ${codePoint}`)
      .join('\n');
    throw new Error(`Unintended control characters detected:\n${details}`);
  }

  console.log(`Control-character audit passed (${files.length} text files scanned).`);
}

const invokedDirectly = typeof process !== 'undefined'
  && process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  assertNoUnintendedControlCharacters().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
