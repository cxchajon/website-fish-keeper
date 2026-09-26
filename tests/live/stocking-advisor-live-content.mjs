// Read-only production check: confirms the bodies fetched by stocking-advisor-live-headers.sh are the
// Phase 2B files. Exits non-zero if any check fails. Appends its results to live-verify/summary.md.
import { readFileSync, appendFileSync } from 'node:fs';

const OUT = process.env.OUT_DIR || 'live-verify';
const body = (name) => readFileSync(`${OUT}/body/${name}`, 'utf8');

const html = body('stocking-advisor.html');
const species = JSON.parse(body('species.v2.json'));
const model = body('bioload-model.js');
const adapter = body('species-adapter.v2.js');
const stocking = body('stocking.js');
const legacy = body('compute.legacy.js');

const byId = (id) => species.find((record) => record.id === id);
const checks = [
  ['HTML has the new bioload copy (adult size, body shape, waste output)',
    html.includes('from each species’ adult size, body shape, and waste output')],
  ['HTML no longer has the old activity-multiplier copy', !html.includes('activity multipliers')],
  ['HTML has the stale-cache recovery guard', html.includes('ttg-advisor-cache-refresh')],
  ['species.v2.json has exactly 44 species', Array.isArray(species) && species.length === 44],
  ['Angelfish display name is "Angelfish"', byId('freshwater_angelfish')?.name === 'Angelfish'],
  ['Pea Puffer has quantity_space', Number(byId('pea_puffer')?.quantity_space?.liters_per_fish) > 0],
  ['every species has bioload_profile', species.every((record) => record.bioload_profile)],
  ['bioload-model.js is the unified model', model.includes('export function computeSpeciesBioload')
    && model.includes('BUILD_FACTORS') && model.includes('WASTE_FACTORS')],
  ['species-adapter.v2.js sets the revalidation marker', adapter.includes("['species-adapter'] = true")],
  ['compute.legacy.js sets the revalidation marker', legacy.includes("['compute-legacy'] = true")],
  ['stocking.js keeps the species-data load-failure alert', stocking.includes("alert.id = 'species-data-error'")
    && stocking.includes('Species data failed to load')],
];

const lines = ['## Content checks', '', '| check | result |', '|---|---|'];
for (const [label, ok] of checks) lines.push(`| ${label} | ${ok ? 'PASS' : 'FAIL'} |`);
lines.push('');
appendFileSync(`${OUT}/summary.md`, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));

if (checks.some(([, ok]) => !ok)) process.exit(1);
