import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { prepareDashboardData } from './src/dataAdapter.js';
import { loadJournalMonth, loadMonthIndex, repoRoot } from './src/journalLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outJs = path.join(repoRoot, 'assets/js/journal-dashboard.js');
const outCss = path.join(repoRoot, 'assets/css/journal-dashboard.css');

await fs.mkdir(path.dirname(outJs), { recursive: true });
await fs.mkdir(path.dirname(outCss), { recursive: true });

const adapterSource = await fs.readFile(path.join(__dirname, 'src/dataAdapter.js'), 'utf8');
const mainSource = await fs.readFile(path.join(__dirname, 'src/main.js'), 'utf8');

const adapterStripped = adapterSource.replace(/export\s*\{[^}]+\};?/g, '').trim();
const mainStripped = mainSource
  .replace(/import\s*\{[^}]+\}\s*from\s*'\.\/dataAdapter\.js';?/g, '')
  .trim();

const banner = `// Auto-generated dashboard bundle\n// Contains data adapter and interactive logic\n`;
const bundle = `${banner}${adapterStripped}\n\n${mainStripped}\n`;
await fs.writeFile(outJs, bundle, 'utf8');

const cssSource = await fs.readFile(path.join(__dirname, 'src/styles.css'), 'utf8');
await fs.writeFile(outCss, cssSource, 'utf8');

// Validation: ensure weekly totals match aggregated daily totals for latest month.
const monthIndex = await loadMonthIndex();
if (!monthIndex.length) {
  throw new Error('No journal months found.');
}
const latestMonth = monthIndex[0];
const latestEntries = await loadJournalMonth(latestMonth);
const datasets = prepareDashboardData({ entries: latestEntries });
const dailyThrive = datasets.nitrateData.reduce((sum, day) => sum + day.thrive, 0);
const weeklyThrive = datasets.dosingData.reduce((sum, week) => sum + week.thrivePumps, 0);
assert(Math.abs(dailyThrive - weeklyThrive) < 1e-6, 'Weekly Thrive total mismatch');
const dailyExcel = datasets.nitrateData.reduce((sum, day) => sum + day.excelCap, 0);
const weeklyExcel = datasets.dosingData.reduce((sum, week) => sum + week.excelCapEquivalent, 0);
assert(Math.abs(dailyExcel - weeklyExcel) < 1e-6, 'Weekly Excel total mismatch');

console.log(`Built dashboard bundle for ${latestMonth}`);
