import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mapFiltersForEfficiency,
  computeTurnover,
  computeAggregateEfficiency,
  computeAdjustedBioload,
  computePercent,
} from '../../prototype/assets/js/proto-filtration-math.js';
import { FISH_DB } from '../../js/fish-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, '../out');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

ensureDir(OUTPUT_DIR);

const speciesFixtures = [
  { id: 'chili', qty: 12 },
  { id: 'neon', qty: 10 },
  { id: 'otocinclus', qty: 6 },
  { id: 'harlequin', qty: 8 },
  { id: 'cory_panda', qty: 6 },
  { id: 'pgourami', qty: 2 },
  { id: 'betta_male', qty: 1 },
  { id: 'dgourami', qty: 1 },
  { id: 'amano', qty: 12 },
  { id: 'nerite', qty: 6 },
];

const speciesMap = new Map(FISH_DB.map((entry) => [entry.id, entry]));

function computeBaseLoad(stock) {
  return stock.reduce((sum, entry) => {
    const species = speciesMap.get(entry.id);
    const ge = Number.isFinite(species?.bioloadGE) ? species.bioloadGE : 0;
    const qty = Number.isFinite(entry.qty) ? entry.qty : 0;
    return sum + ge * Math.max(0, qty);
  }, 0);
}

const BASE_LOAD = computeBaseLoad(speciesFixtures);

const tanks = [20, 29, 40];
const plantedOptions = [false, true];

const FILTER_SOURCES = Object.freeze({
  PRODUCT: 'product',
  CUSTOM: 'custom',
});

function filterEntry(type, gph, source = FILTER_SOURCES.PRODUCT, id = null) {
  return {
    id,
    type,
    kind: type,
    rated_gph: gph,
    source,
  };
}

const filterScenarios = [
  { id: 'none', label: 'No filter', filters: [] },
  { id: 'sponge80', label: 'Sponge 80 GPH', filters: [filterEntry('Sponge', 80)] },
  { id: 'hob200', label: 'HOB 200 GPH', filters: [filterEntry('HOB', 200)] },
  { id: 'canister300', label: 'Canister 300 GPH', filters: [filterEntry('Canister', 300)] },
  { id: 'sponge_hob', label: 'Sponge 80 + HOB 200', filters: [filterEntry('Sponge', 80), filterEntry('HOB', 200)] },
  { id: 'hob_hob', label: 'Dual HOB 200 + 200', filters: [filterEntry('HOB', 200, FILTER_SOURCES.PRODUCT, 'hob-a'), filterEntry('HOB', 200, FILTER_SOURCES.PRODUCT, 'hob-b')] },
  { id: 'hob_canister', label: 'HOB 200 + Canister 300', filters: [filterEntry('HOB', 200, FILTER_SOURCES.PRODUCT, 'hob-main'), filterEntry('Canister', 300, FILTER_SOURCES.PRODUCT, 'canister-main')] },
  { id: 'custom60', label: 'Custom HOB 60', filters: [filterEntry('HOB', 60, FILTER_SOURCES.CUSTOM)] },
  { id: 'custom120', label: 'Custom HOB 120', filters: [filterEntry('HOB', 120, FILTER_SOURCES.CUSTOM)] },
  { id: 'custom200', label: 'Custom HOB 200', filters: [filterEntry('HOB', 200, FILTER_SOURCES.CUSTOM)] },
  { id: 'product200_custom120', label: 'Product HOB 200 + Custom HOB 120', filters: [filterEntry('HOB', 200, FILTER_SOURCES.PRODUCT, 'hob-main'), filterEntry('HOB', 120, FILTER_SOURCES.CUSTOM, 'custom-120')] },
];

function resolvePlantBonus(planted) {
  return planted ? 0.1 : 0;
}

function computeScenario({ gallons, planted, filters }) {
  const plantBonus = resolvePlantBonus(planted);
  const loadAfterPlants = BASE_LOAD * (1 - plantBonus);
  const normalized = mapFiltersForEfficiency(filters);
  const totalFlow = normalized.reduce((sum, filter) => sum + filter.gph, 0);
  const turnover = totalFlow > 0 ? computeTurnover(totalFlow, gallons) : 0;
  let efficiency = 0;
  let efficiencyDetails = [];
  if (normalized.length) {
    const aggregate = computeAggregateEfficiency(normalized, turnover);
    efficiency = aggregate.total;
    efficiencyDetails = aggregate.perFilter;
  }
  const adjusted = computeAdjustedBioload(loadAfterPlants, efficiency);
  const percent = computePercent(adjusted, gallons);
  return {
    gallons,
    planted,
    filters,
    plantBonus,
    speciesLoad: BASE_LOAD,
    loadAfterPlants,
    normalized,
    totalFlow,
    turnover,
    efficiency,
    percent,
    efficiencyDetails,
  };
}

const scenarioResults = new Map();

for (const gallons of tanks) {
  for (const planted of plantedOptions) {
    for (const scenario of filterScenarios) {
      const key = `${gallons}g-${planted ? 'planted' : 'bare'}-${scenario.id}`;
      const result = computeScenario({ gallons, planted, filters: scenario.filters });
      scenarioResults.set(key, { ...result, scenario });
    }
  }
}

function getResult(gallons, planted, scenarioId) {
  const key = `${gallons}g-${planted ? 'planted' : 'bare'}-${scenarioId}`;
  return scenarioResults.get(key);
}

const guardrailResults = [];
const mismatches = [];

function registerGuardrail(name, checkFn) {
  const issues = checkFn();
  if (issues.length) {
    mismatches.push(...issues);
  }
  guardrailResults.push({ name, passed: issues.length === 0, issues });
}

registerGuardrail('Base bioload independent of filtration', () => {
  const issues = [];
  for (const [key, result] of scenarioResults) {
    if (Math.abs(result.speciesLoad - BASE_LOAD) > 1e-6) {
      issues.push({
        scenario: key,
        check: 'production-invariant',
        expected: BASE_LOAD,
        got: result.speciesLoad,
        message: 'Species base load should not change with filtration.',
      });
    }
  }
  return issues;
});

const monotonicOrder = ['none', 'sponge80', 'hob200', 'canister300', 'sponge_hob', 'hob_hob', 'hob_canister'];

registerGuardrail('Utilization decreases with additional filtration', () => {
  const issues = [];
  for (const gallons of tanks) {
    for (const planted of plantedOptions) {
      let previousPercent = null;
      for (const scenarioId of monotonicOrder) {
        const res = getResult(gallons, planted, scenarioId);
        if (!res) continue;
        if (previousPercent != null && res.percent - previousPercent > 0.01) {
          issues.push({
            scenario: `${gallons}g-${planted ? 'planted' : 'bare'}-${scenarioId}`,
            check: 'utilization-monotonic',
            expected: `<= ${previousPercent.toFixed(3)}`,
            got: res.percent,
            message: 'Bioload percent should not increase when adding filtration.',
          });
        }
        previousPercent = res.percent;
      }
    }
  }
  return issues;
});

const diminishingSequences = [
  ['none', 'hob200', 'hob_canister'],
  ['none', 'sponge80', 'sponge_hob'],
  ['none', 'hob200', 'hob_hob'],
];

registerGuardrail('Diminishing returns from stacking filters', () => {
  const issues = [];
  for (const gallons of tanks) {
    for (const planted of plantedOptions) {
      for (const sequence of diminishingSequences) {
        const [baselineId, firstId, secondId] = sequence;
        const baseline = getResult(gallons, planted, baselineId);
        const first = getResult(gallons, planted, firstId);
        const second = getResult(gallons, planted, secondId);
        if (!baseline || !first || !second) continue;
        const improvementOne = baseline.percent - first.percent;
        const improvementTwo = first.percent - second.percent;
        if (improvementTwo - improvementOne > 0.5) {
          issues.push({
            scenario: `${gallons}g-${planted ? 'planted' : 'bare'}-${secondId}`,
            check: 'diminishing-returns',
            expected: `Second improvement <= first (${improvementOne.toFixed(3)}%)`,
            got: `${improvementTwo.toFixed(3)}%`,
            message: 'Stacking filters should yield diminishing returns.',
          });
        }
      }
    }
  }
  return issues;
});

registerGuardrail('Custom filters follow same pipeline', () => {
  const issues = [];
  for (const gallons of tanks) {
    for (const planted of plantedOptions) {
      const product = getResult(gallons, planted, 'hob200');
      const custom = getResult(gallons, planted, 'custom200');
      if (!product || !custom) continue;
      const diff = Math.abs(product.percent - custom.percent);
      if (diff > 0.5) {
        issues.push({
          scenario: `${gallons}g-${planted ? 'planted' : 'bare'}-custom200`,
          check: 'custom-pipeline',
          expected: `Within 0.5% of product percent (${product.percent.toFixed(3)})`,
          got: custom.percent,
          message: 'Custom filter percent diverged from catalog filter.',
        });
      }
    }
  }
  return issues;
});

registerGuardrail('Planted tanks provide modest relief', () => {
  const issues = [];
  for (const gallons of tanks) {
    for (const scenario of filterScenarios) {
      const bare = getResult(gallons, false, scenario.id);
      const planted = getResult(gallons, true, scenario.id);
      if (!bare || !planted) continue;
      if (!(planted.percent < bare.percent)) {
        issues.push({
          scenario: `${gallons}g-planted-${scenario.id}`,
          check: 'planted-relief',
          expected: `< ${bare.percent.toFixed(3)}`,
          got: planted.percent,
          message: 'Planted toggle should reduce percent utilization.',
        });
      }
      const reduction = bare.percent - planted.percent;
      if (reduction > 25) {
        issues.push({
          scenario: `${gallons}g-planted-${scenario.id}`,
          check: 'planted-relief-excessive',
          expected: 'Reduction <= 25%',
          got: `${reduction.toFixed(3)}%`,
          message: 'Planted relief should remain modest.',
        });
      }
    }
  }
  return issues;
});

registerGuardrail('Filtration relief capped at 0.6', () => {
  const issues = [];
  for (const [key, result] of scenarioResults) {
    if (result.efficiency - 0.6 > 1e-6) {
      issues.push({
        scenario: key,
        check: 'efficiency-cap',
        expected: '<= 0.6',
        got: result.efficiency,
        message: 'Efficiency exceeded 0.6 cap.',
      });
    }
  }
  return issues;
});

registerGuardrail('Turnover derated to delivered flow', () => {
  const issues = [];
  for (const [key, result] of scenarioResults) {
    if (!result.normalized.length) continue;
    const rated = result.filters.reduce((sum, filter) => sum + (Number(filter.rated_gph) || 0), 0);
    const ratio = rated > 0 ? result.totalFlow / rated : 1;
    if (Math.abs(ratio - 0.65) > 0.1) {
      issues.push({
        scenario: key,
        check: 'turnover-derate',
        expected: 'Total flow ≈ 65% of rated GPH',
        got: `ratio=${ratio.toFixed(3)}`,
        message: 'Rated GPH is not derated before efficiency.',
      });
    }
  }
  return issues;
});

registerGuardrail('Combined relief uses multiplicative aggregation', () => {
  const issues = [];
  for (const [key, result] of scenarioResults) {
    if (result.efficiencyDetails.length <= 1) continue;
    const expected = 1 - result.efficiencyDetails.reduce((prod, item) => prod * (1 - item.efficiency), 1);
    if (result.efficiency - expected > 0.05) {
      issues.push({
        scenario: key,
        check: 'aggregation-multiplicative',
        expected: expected,
        got: result.efficiency,
        message: 'Combined relief should use multiplicative aggregation.',
      });
    }
    if (result.efficiency > 0.6 + 1e-6) {
      issues.push({
        scenario: key,
        check: 'aggregation-cap',
        expected: '<= 0.6',
        got: result.efficiency,
        message: 'Combined relief exceeded cap.',
      });
    }
  }
  return issues;
});

const scenarioPassStatus = new Map();
for (const [key, result] of scenarioResults) {
  scenarioPassStatus.set(key, true);
}
for (const issue of mismatches) {
  const { scenario } = issue;
  if (scenario && scenarioPassStatus.has(scenario)) {
    scenarioPassStatus.set(scenario, false);
  }
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

let summaryMarkdown = '| Tank | Planted | Filter | Percent Used | Efficiency | Turnover | Status |\n';
summaryMarkdown += '|------|---------|--------|--------------|------------|----------|--------|\n';
for (const gallons of tanks) {
  for (const planted of plantedOptions) {
    for (const scenario of filterScenarios) {
      const res = getResult(gallons, planted, scenario.id);
      if (!res) continue;
      const key = `${gallons}g-${planted ? 'planted' : 'bare'}-${scenario.id}`;
      const status = scenarioPassStatus.get(key) ? 'PASS' : 'FAIL';
      summaryMarkdown += `| ${gallons}g | ${planted ? 'Yes' : 'No'} | ${scenario.label} | ${formatPercent(res.percent)} | ${res.efficiency.toFixed(3)} | ${res.turnover.toFixed(2)} | ${status} |\n`;
    }
  }
}

fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.md'), summaryMarkdown, 'utf8');

fs.writeFileSync(path.join(OUTPUT_DIR, 'mismatches.json'), JSON.stringify(mismatches, null, 2), 'utf8');

function buildJUnit(testResults) {
  const cases = testResults.map((result) => {
    const attrs = `classname="crosscheck" name="${result.name.replace(/"/g, '\\"')}"`;
    if (result.passed) {
      return `    <testcase ${attrs} />`;
    }
    const message = result.issues.map((issue) => `${issue.scenario}: ${issue.message}`).join('\n');
    return `    <testcase ${attrs}>\n      <failure message="${message.replace(/"/g, '\\"')}">` +
      `<![CDATA[${JSON.stringify(result.issues, null, 2)}]]></failure>\n    </testcase>`;
  });
  const failures = testResults.filter((t) => !t.passed).length;
  const tests = testResults.length;
  return `<testsuite name="crosscheck" tests="${tests}" failures="${failures}">\n${cases.join('\n')}\n</testsuite>\n`;
}

const junitXml = buildJUnit(guardrailResults);
fs.writeFileSync(path.join(OUTPUT_DIR, 'junit.xml'), junitXml, 'utf8');

const baseLoadLine = `Base species load (GE): ${BASE_LOAD.toFixed(3)}`;
const plantedLine = `Plant bonus (planted=true): ${(resolvePlantBonus(true) * 100).toFixed(1)}%`;
const totalScenariosLine = `Scenarios evaluated: ${scenarioResults.size}`;
const failingScenarios = [...scenarioPassStatus.entries()].filter(([, status]) => !status).length;
const failingLine = `Scenarios failing guardrails: ${failingScenarios}`;

const consoleSummary = [baseLoadLine, plantedLine, totalScenariosLine, failingLine].join('\n');

console.log(consoleSummary);

