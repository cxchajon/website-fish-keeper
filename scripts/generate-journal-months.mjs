import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const MASTER_JSON_PATH = path.join(DATA_DIR, 'journal.json');
const OUTPUT_DIR = path.join(DATA_DIR, 'journal');

async function readMasterEntries() {
  const source = await fs.readFile(MASTER_JSON_PATH, 'utf8');
  const parsed = JSON.parse(source);
  if (!Array.isArray(parsed)) {
    throw new Error('Master journal JSON is not an array.');
  }
  return parsed.filter((entry) => entry && typeof entry.date === 'string' && entry.date.trim());
}

function toMonthKey(entry) {
  const date = entry.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  return date.slice(0, 7);
}

function buildSortKey(entry) {
  const date = typeof entry.date === 'string' && entry.date.trim() ? entry.date.trim() : '0000-00-00';
  let time = typeof entry.time === 'string' ? entry.time.trim() : '';
  if (time) {
    const match = time.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hour = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
      const minute = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
      time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    } else {
      time = '00:00';
    }
  } else {
    time = '00:00';
  }
  return `${date}T${time}`;
}

async function ensureCleanOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => fs.unlink(path.join(OUTPUT_DIR, entry.name)))
  );
}

async function writeMonthFile(month, entries) {
  const targetPath = path.join(OUTPUT_DIR, `${month}.json`);
  const payload = JSON.stringify(entries, null, 2);
  await fs.writeFile(targetPath, `${payload}\n`, 'utf8');
}

async function writeIndexFile(months) {
  const targetPath = path.join(OUTPUT_DIR, 'index.json');
  const payload = JSON.stringify(months, null, 2);
  await fs.writeFile(targetPath, `${payload}\n`, 'utf8');
}

async function main() {
  const masterEntries = await readMasterEntries();
  if (!masterEntries.length) {
    await ensureCleanOutputDir();
    await writeIndexFile([]);
    console.log('No journal entries found. index.json created with no months.');
    return;
  }

  const monthMap = new Map();
  masterEntries.forEach((entry) => {
    const monthKey = toMonthKey(entry);
    if (!monthKey) {
      return;
    }
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey).push(entry);
  });

  if (!monthMap.size) {
    await ensureCleanOutputDir();
    await writeIndexFile([]);
    console.log('No journal months resolved. index.json created with no months.');
    return;
  }

  const months = Array.from(monthMap.keys()).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  await ensureCleanOutputDir();

  for (const month of months) {
    const entries = monthMap.get(month);
    entries.sort((a, b) => {
      const aKey = buildSortKey(a);
      const bKey = buildSortKey(b);
      if (aKey < bKey) return 1;
      if (aKey > bKey) return -1;
      return 0;
    });
    await writeMonthFile(month, entries);
  }

  await writeIndexFile(months);
  console.log(`Created ${months.length} month file(s) plus index.json.`);
}

main().catch((error) => {
  console.error('Failed to build journal months:', error);
  process.exitCode = 1;
});
