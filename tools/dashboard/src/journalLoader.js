import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');

async function loadJournalMonth(month) {
  const file = path.join(repoRoot, 'data/journal', `${month}.json`);
  const contents = await readFile(file, 'utf8');
  return JSON.parse(contents);
}

async function loadJournalMaster() {
  const file = path.join(repoRoot, 'data/journal.json');
  const contents = await readFile(file, 'utf8');
  return JSON.parse(contents);
}

async function loadMonthIndex() {
  const file = path.join(repoRoot, 'data/journal/index.json');
  const contents = await readFile(file, 'utf8');
  return JSON.parse(contents);
}

export { loadJournalMaster, loadJournalMonth, loadMonthIndex, repoRoot };
