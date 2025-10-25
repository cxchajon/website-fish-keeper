import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  allSpecies,
  getSpeciesById,
  speciesCount,
  adapterIssues,
} from '../src/adapter.js';
import {
  computeBioload,
  evaluateCompatibility,
  computeTurnover,
} from '../../stocking-tests-real/src/engine.js';
import { LcgRng, seedFromString } from '../utils/rng.js';
import { hashSpeciesLibrary } from '../utils/hash.js';
import { ensureDir, writeCsv, writeJson, writeText } from '../utils/io.js';
import { markdownTable, formatPercent, formatNumber, renderHeatmapRow } from '../utils/reporters.js';
import { appendTrendEntry, computeTrendDelta, loadTrendHistory } from '../utils/trend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const harnessRoot = path.resolve(__dirname, '..');
const packsDir = path.join(harnessRoot, 'packs');
const outDir = path.join(harnessRoot, 'out');
const repoRoot = path.resolve(harnessRoot, '..');
const reportsDir = path.join(repoRoot, 'reports');

ensureDir(outDir);
ensureDir(reportsDir);

function loadPackDefinitions() {
  const files = readdirSync(packsDir).filter((file) => file.endsWith('.json')).sort();
  const packs = [];
  for (const file of files) {
    const fullPath = path.join(packsDir, file);
    const raw = readFileSync(fullPath, 'utf8');
    const data = JSON.parse(raw);
    packs.push(data);
  }
  return packs;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function matchesFilter(species, filter = {}) {
  if (!species) return false;
  if (filter.categories) {
    const allowed = new Set(normalizeArray(filter.categories).map(String));
    if (!allowed.has(species.category)) {
      return false;
    }
  }
  if (filter.includeIds) {
    const allowed = new Set(normalizeArray(filter.includeIds).map(String));
    if (!allowed.has(species.id)) {
      return false;
    }
  }
  if (filter.excludeIds) {
    const banned = new Set(normalizeArray(filter.excludeIds).map(String));
    if (banned.has(species.id)) {
      return false;
    }
  }
  if (filter.salinity) {
    const allowed = new Set(normalizeArray(filter.salinity).map(String));
    if (!allowed.has(species.salinity)) {
      return false;
    }
  }
  if (filter.excludeSalinity) {
    const banned = new Set(normalizeArray(filter.excludeSalinity).map(String));
    if (banned.has(species.salinity)) {
      return false;
    }
  }
  if (filter.includeTagsAny) {
    const allowed = normalizeArray(filter.includeTagsAny).map((tag) => String(tag).toLowerCase());
    const hasAny = allowed.some((tag) => species.tagSet?.has(tag));
    if (!hasAny) {
      return false;
    }
  }
  if (filter.includeTagsAll) {
    const required = normalizeArray(filter.includeTagsAll).map((tag) => String(tag).toLowerCase());
    const hasAll = required.every((tag) => species.tagSet?.has(tag));
    if (!hasAll) {
      return false;
    }
  }
  if (filter.excludeTagsAny) {
    const excluded = normalizeArray(filter.excludeTagsAny).map((tag) => String(tag).toLowerCase());
    const hasExcluded = excluded.some((tag) => species.tagSet?.has(tag));
    if (hasExcluded) {
      return false;
    }
  }
  if (Number.isFinite(filter.aggressionGte)) {
    if (!(species.aggression >= filter.aggressionGte)) {
      return false;
    }
  }
  if (Number.isFinite(filter.aggressionLte)) {
    if (!(species.aggression <= filter.aggressionLte)) {
      return false;
    }
  }
  if (Number.isFinite(filter.temperatureMaxLte)) {
    if (!(Number.isFinite(species.maxTemp) && species.maxTemp <= filter.temperatureMaxLte)) {
      return false;
    }
  }
  if (Number.isFinite(filter.temperatureMinGte)) {
    if (!(Number.isFinite(species.minTemp) && species.minTemp >= filter.temperatureMinGte)) {
      return false;
    }
  }
  if (typeof filter.shrimpUnsafe === 'boolean') {
    if (species.shrimpUnsafe !== filter.shrimpUnsafe) {
      return false;
    }
  }
  if (typeof filter.invertSafe === 'boolean') {
    if (species.invertSafe !== filter.invertSafe) {
      return false;
    }
  }
  if (typeof filter.finNipper === 'boolean') {
    if (species.finNipper !== filter.finNipper) {
      return false;
    }
  }
  if (typeof filter.longFin === 'boolean') {
    if (species.longFin !== filter.longFin) {
      return false;
    }
  }
  return true;
}

function applyFilter(speciesList, filter) {
  if (!filter) {
    return [...speciesList];
  }
  if (Array.isArray(filter.anyOf)) {
    const combined = new Map();
    for (const sub of filter.anyOf) {
      for (const species of applyFilter(speciesList, sub)) {
        combined.set(species.id, species);
      }
    }
    return Array.from(combined.values());
  }
  return speciesList.filter((species) => matchesFilter(species, filter));
}

function enumeratePairs(source, target) {
  const pairs = [];
  if (source.length === 0 || target.length === 0) {
    return pairs;
  }
  const sameSet = source === target;
  if (sameSet) {
    for (let i = 0; i < source.length; i += 1) {
      for (let j = i + 1; j < target.length; j += 1) {
        const a = source[i];
        const b = target[j];
        if (a.id === b.id) continue;
        pairs.push([a, b]);
      }
    }
    return pairs;
  }
  for (const a of source) {
    for (const b of target) {
      if (a.id === b.id) continue;
      pairs.push([a, b]);
    }
  }
  return pairs;
}

function samplePairs(sourceList, targetList, sampleCount, rng) {
  const universe = enumeratePairs(sourceList, targetList);
  if (universe.length <= sampleCount) {
    return universe;
  }
  const shuffled = rng.shuffle(universe);
  return shuffled.slice(0, sampleCount);
}

function evaluatePair(a, b) {
  const entries = [];
  const qtyA = Number.isFinite(a.shoalMin) && a.shoalMin > 0 ? Math.max(1, Math.round(a.shoalMin)) : 2;
  const qtyB = Number.isFinite(b.shoalMin) && b.shoalMin > 0 ? Math.max(1, Math.round(b.shoalMin)) : 2;
  entries.push({ speciesId: a.id, count: qtyA });
  entries.push({ speciesId: b.id, count: qtyB });
  return evaluateCompatibility({ gallons: 29, planted: false, entries });
}

function blockerMatchesReason(blockers, reasonIncludes) {
  if (!Array.isArray(reasonIncludes) || reasonIncludes.length === 0) {
    return blockers.length > 0;
  }
  const needles = reasonIncludes.map((needle) => String(needle).toLowerCase());
  return blockers.some((blocker) => {
    const hay = String(blocker).toLowerCase();
    return needles.some((needle) => hay.includes(needle));
  });
}

function evaluatePlanCompatibility(plan) {
  const entries = [];
  for (const entry of plan.entries) {
    const species = getSpeciesById(entry.id ?? entry.speciesId);
    if (!species) {
      return { ok: false, blockers: [`Missing species ${entry.id ?? entry.speciesId}`] };
    }
    const qty = Number(entry.count ?? entry.qty ?? 0);
    entries.push({ speciesId: species.id, count: Math.max(1, qty) });
  }
  return evaluateCompatibility({ gallons: Number(plan.gallons) || 0, planted: Boolean(plan.planted), entries });
}

function buildBioloadExamples() {
  return [
    {
      name: '15g betta retreat',
      gallons: 15,
      entries: [
        { id: 'betta_male', count: 1 },
        { id: 'nerite', count: 1 },
        { id: 'amano', count: 3 },
      ],
    },
    {
      name: '20g community mix',
      gallons: 20,
      entries: [
        { id: 'neon', count: 10 },
        { id: 'cory_panda', count: 6 },
        { id: 'amano', count: 4 },
      ],
    },
    {
      name: '29g gourami center',
      gallons: 29,
      entries: [
        { id: 'pgourami', count: 1 },
        { id: 'harlequin', count: 10 },
        { id: 'cory_bronze', count: 6 },
      ],
    },
    {
      name: '40g active shoalers',
      gallons: 40,
      entries: [
        { id: 'zebra', count: 8 },
        { id: 'tiger_barb', count: 8 },
        { id: 'cory_bronze', count: 6 },
      ],
    },
    {
      name: '55g south american',
      gallons: 55,
      entries: [
        { id: 'cardinal', count: 18 },
        { id: 'rummynose', count: 12 },
        { id: 'cory_panda', count: 10 },
      ],
    },
    {
      name: '32g invert colony',
      gallons: 32,
      entries: [
        { id: 'neocaridina', count: 40 },
        { id: 'amano', count: 12 },
        { id: 'nerite', count: 6 },
      ],
    },
    {
      name: '75g lush planted',
      gallons: 75,
      entries: [
        { id: 'cardinal', count: 24 },
        { id: 'harlequin', count: 16 },
        { id: 'otocinclus', count: 12 },
      ],
    },
    {
      name: '24g livebearer mix',
      gallons: 24,
      entries: [
        { id: 'guppy_male', count: 8 },
        { id: 'cory_panda', count: 6 },
        { id: 'amano', count: 4 },
      ],
    },
    {
      name: '30g loach retreat',
      gallons: 30,
      entries: [
        { id: 'kuhli', count: 8 },
        { id: 'neon', count: 12 },
        { id: 'amano', count: 6 },
      ],
    },
    {
      name: '45g sorority',
      gallons: 45,
      entries: [
        { id: 'betta_female', count: 6 },
        { id: 'harlequin', count: 10 },
        { id: 'cory_panda', count: 6 },
      ],
    },
  ];
}

function buildTurnoverExamples() {
  return [
    { name: '20g hob filter', gallons: 20, gph: 120 },
    { name: '29g underpowered', gallons: 29, gph: 80 },
    { name: '29g high flow', gallons: 29, gph: 260 },
    { name: '40g balanced', gallons: 40, gph: 240 },
    { name: '55g canister', gallons: 55, gph: 440 },
    { name: '12g nano', gallons: 12, gph: 80 },
    { name: '75g dual filters', gallons: 75, gph: 520 },
    { name: '15g gentle flow', gallons: 15, gph: 40 },
    { name: '24g sponge pair', gallons: 24, gph: 110 },
    { name: '32g river scape', gallons: 32, gph: 400 },
  ];
}

function withinRange(value, min, max) {
  return value >= min && value <= max;
}

function generateFailingCombosForCsv(speciesList) {
  const pairs = [];
  for (let i = 0; i < speciesList.length; i += 1) {
    for (let j = i + 1; j < speciesList.length; j += 1) {
      const a = speciesList[i];
      const b = speciesList[j];
      const result = evaluatePair(a, b);
      if (result.blockers.length) {
        for (const blocker of result.blockers) {
          pairs.push({
            a,
            b,
            blocker,
          });
        }
      }
    }
  }
  const reasonCounts = new Map();
  for (const entry of pairs) {
    const key = entry.blocker;
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }
  const sorted = pairs
    .map((entry) => ({
      species_a_id: entry.a.id,
      species_b_id: entry.b.id,
      species_a: entry.a.commonName,
      species_b: entry.b.commonName,
      reason: entry.blocker,
      reason_frequency: reasonCounts.get(entry.blocker) ?? 1,
    }))
    .sort((a, b) => {
      if (b.reason_frequency !== a.reason_frequency) {
        return b.reason_frequency - a.reason_frequency;
      }
      if (a.reason !== b.reason) {
        return a.reason.localeCompare(b.reason);
      }
      if (a.species_a !== b.species_a) {
        return a.species_a.localeCompare(b.species_a);
      }
      return a.species_b.localeCompare(b.species_b);
    });
  return sorted;
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function run() {
  const startTime = Date.now();
  const packs = loadPackDefinitions();
  const speciesList = allSpecies();
  const totalSpecies = speciesCount();
  const runDate = new Date();
  const runId = runDate.toISOString().slice(0, 10);
  const seedValue = seedFromString(process.env.STOCKING_SEED ?? runId.replace(/-/g, ''));
  const rng = new LcgRng(seedValue);
  const libHash = hashSpeciesLibrary(speciesList);

  const dimensionStats = {};
  const dimensionNotes = [];
  const failingCombos = [];
  const planResults = [];
  let totalPairsTested = 0;
  let expectationFailures = 0;

  for (const pack of packs) {
    const stats = { tested: 0, failCount: 0, skipped: 0 };
    dimensionStats[pack.name] = stats;
    for (const test of pack.tests ?? []) {
      if (test.type === 'pairwise_incompatible' || test.type === 'pairwise_compatible') {
        const sourceList = applyFilter(speciesList, test.source);
        const targetList = applyFilter(speciesList, test.target ?? test.source);
        if (sourceList.length === 0 || targetList.length === 0) {
          stats.skipped += 1;
          if (pack.skipMessage && !dimensionNotes.includes(pack.skipMessage)) {
            dimensionNotes.push(pack.skipMessage);
          }
          continue;
        }
        const sampleCount = Number(test.sample) || 0;
        const pairs = samplePairs(sourceList, targetList, sampleCount, rng);
        if (pairs.length === 0) {
          stats.skipped += 1;
          continue;
        }
        for (const [a, b] of pairs) {
          const result = evaluatePair(a, b);
          totalPairsTested += 1;
          stats.tested += 1;
          if (result.blockers.length) {
            failingCombos.push({
              species_a: a,
              species_b: b,
              blockers: result.blockers,
            });
          }
          if (test.type === 'pairwise_incompatible') {
            const hasReason = blockerMatchesReason(result.blockers, test.reasonIncludes);
            if (!(result.ok === false && hasReason)) {
              stats.failCount += 1;
              expectationFailures += 1;
            }
          } else if (test.type === 'pairwise_compatible') {
            if (!(result.ok === true && result.blockers.length === 0)) {
              stats.failCount += 1;
              expectationFailures += 1;
            }
          }
        }
      } else if (test.type === 'plan_compatible') {
        for (const plan of test.plans ?? []) {
          const plantedStates = Array.isArray(plan.plantedStates) && plan.plantedStates.length
            ? plan.plantedStates
            : [false];
          for (const planted of plantedStates) {
            const evalPlan = { ...plan, planted };
            const result = evaluatePlanCompatibility(evalPlan);
            stats.tested += 1;
            if (!result.ok) {
              stats.failCount += 1;
              expectationFailures += 1;
            }
            planResults.push({
              name: plan.name,
              planted,
              ok: result.ok,
              blockers: result.blockers,
            });
          }
        }
      }
    }
  }

  const csvCombos = generateFailingCombosForCsv(speciesList);
  const topHighlight = csvCombos.slice(0, 20).map((entry) => ({
    'Species A': entry.species_a,
    'Species B': entry.species_b,
    Reason: entry.reason,
  }));

  const failingCsvRows = csvCombos.slice(0, 100);
  writeCsv(path.join(reportsDir, 'failing_combos.csv'),
    ['species_a_id', 'species_b_id', 'species_a', 'species_b', 'reason', 'reason_frequency'],
    failingCsvRows,
  );

  writeJson(path.join(reportsDir, 'adapter_issues.json'), adapterIssues);
  const adapterSummary = [
    '# Adapter Issues',
    '',
    `Total species: ${totalSpecies}`,
    `Species with issues: ${adapterIssues.length}`,
  ];
  if (adapterIssues.length) {
    adapterSummary.push('');
    for (const issue of adapterIssues.slice(0, 50)) {
      adapterSummary.push(`- **${issue.id}**: ${issue.issues.join('; ')}`);
    }
  }
  adapterSummary.push('');
  writeText(path.join(reportsDir, 'adapter_issues.md'), adapterSummary.join('\n'));

  const bioloadExamples = buildBioloadExamples();
  const bioloadRows = [];
  for (const example of bioloadExamples) {
    const entries = example.entries.map((item) => ({ speciesId: item.id, count: item.count }));
    const base = computeBioload({ gallons: example.gallons, planted: false, entries });
    const planted = computeBioload({ gallons: example.gallons, planted: true, entries });
    bioloadRows.push({
      Scenario: example.name,
      Gallons: example.gallons,
      'Base %': formatPercent(base.percent, 1),
      'Planted %': formatPercent(planted.percent, 1),
      Delta: formatPercent(planted.percent - base.percent, 1),
    });
  }

  const turnoverExamples = buildTurnoverExamples();
  const turnoverRows = [];
  for (const example of turnoverExamples) {
    const stats = computeTurnover(example.gallons, example.gph);
    const within = withinRange(stats.gph, stats.recommendation.min, stats.recommendation.max);
    turnoverRows.push({
      Scenario: example.name,
      Gallons: example.gallons,
      GPH: example.gph,
      'Turnover (x)': formatNumber(stats.turnoverX, 2),
      'Rec Min': Math.round(stats.recommendation.min),
      'Rec Max': Math.round(stats.recommendation.max),
      Status: within ? '✓' : stats.gph < stats.recommendation.min ? '⬇️' : '⬆️',
    });
  }

  const durationMs = Date.now() - startTime;
  const failRate = totalPairsTested > 0 ? expectationFailures / totalPairsTested : 0;

  const trendFile = path.join(reportsDir, 'trend_history.json');
  const entry = {
    runId,
    date: runDate.toISOString(),
    libHash,
    totalSpecies,
    totalPairsTested,
    failCount: expectationFailures,
    failRate,
    dimensions: {},
  };
  for (const [dimension, stats] of Object.entries(dimensionStats)) {
    entry.dimensions[dimension] = {
      tested: stats.tested,
      skipped: stats.skipped,
      failCount: stats.failCount,
    };
  }
  const historyBefore = loadTrendHistory(trendFile);
  const historyAfter = appendTrendEntry(trendFile, entry);
  const previousEntry = historyBefore.length ? historyBefore[historyBefore.length - 1] : null;
  const delta = computeTrendDelta(previousEntry, entry);

  const heatmapRows = Object.entries(dimensionStats)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dimension, stats]) => renderHeatmapRow(dimension, stats));

  const highlightTable = markdownTable(['Species A', 'Species B', 'Reason'], topHighlight);
  const bioloadTable = markdownTable(['Scenario', 'Gallons', 'Base %', 'Planted %', 'Delta'], bioloadRows);
  const turnoverTable = markdownTable(['Scenario', 'Gallons', 'GPH', 'Turnover (x)', 'Rec Min', 'Rec Max', 'Status'], turnoverRows);
  const heatmapTable = markdownTable(['Dimension', 'Tested', 'Skipped', 'Failures', 'Status'], heatmapRows);
  const planRows = planResults.map((result) => ({
    Plan: result.name,
    Planted: result.planted ? 'on' : 'off',
    Status: result.ok ? '✓' : '✗',
    Notes: result.ok ? '' : (result.blockers ?? []).join('; '),
  }));
  const planTable = planRows.length ? markdownTable(['Plan', 'Planted', 'Status', 'Notes'], planRows) : '';

  const reportLines = [];
  reportLines.push(`# Stocking Tests – Extended (${runId})`);
  reportLines.push('');
  reportLines.push('## Run summary');
  reportLines.push('');
  reportLines.push(`- Species: ${totalSpecies}`);
  reportLines.push(`- Pairs tested: ${totalPairsTested}`);
  reportLines.push(`- Expectations failed: ${expectationFailures}`);
  reportLines.push(`- Fail rate: ${(failRate * 100).toFixed(2)}%`);
  reportLines.push(`- Seed: ${seedValue}`);
  reportLines.push(`- Library hash: ${libHash.slice(0, 12)}…`);
  reportLines.push(`- Duration: ${formatDuration(durationMs)}`);
  reportLines.push('');
  reportLines.push('## Trend delta');
  reportLines.push('');
  reportLines.push(`- Species Δ: ${delta.speciesDelta >= 0 ? '+' : ''}${delta.speciesDelta}`);
  reportLines.push(`- Fail rate Δ: ${(delta.failRateDelta * 100).toFixed(2)}%`);
  reportLines.push(`- Pairs tested Δ: ${delta.pairsDelta >= 0 ? '+' : ''}${delta.pairsDelta}`);
  reportLines.push('');
  if (dimensionNotes.length) {
    reportLines.push('## Notes');
    reportLines.push('');
    for (const note of dimensionNotes) {
      reportLines.push(`- ${note}`);
    }
    reportLines.push('');
  }
  reportLines.push('## Heatmap');
  reportLines.push('');
  reportLines.push(heatmapTable);
  reportLines.push('');
  reportLines.push('## Compatibility fail highlights');
  reportLines.push('');
  reportLines.push(highlightTable);
  reportLines.push('');
  if (planTable) {
    reportLines.push('## Community sanity plans');
    reportLines.push('');
    reportLines.push(planTable);
    reportLines.push('');
  }
  reportLines.push('## Bioload spot checks (planted vs. base)');
  reportLines.push('');
  reportLines.push(bioloadTable);
  reportLines.push('');
  reportLines.push('## Turnover sanity samples');
  reportLines.push('');
  reportLines.push(turnoverTable);
  reportLines.push('');

  const reportPath = path.join(reportsDir, `stocking-tests-extended-${runId}.md`);
  writeText(reportPath, reportLines.join('\n'));

  console.log('[stocking-tests-extended] run complete');
  console.log(`  Species: ${totalSpecies}`);
  console.log(`  Pairs tested: ${totalPairsTested}`);
  console.log(`  Failures: ${expectationFailures}`);
  console.log(`  Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`  Trend entries: ${historyAfter.length}`);
}

run();
