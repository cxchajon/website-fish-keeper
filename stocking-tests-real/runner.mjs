import { readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const testDir = path.join(rootDir, '__tests__');
const outDir = path.join(rootDir, 'out');
mkdirSync(outDir, { recursive: true });

const suiteStack = [];
const rootSuite = { name: 'root', tests: [], suites: [] };
suiteStack.push(rootSuite);

const afterAllCallbacks = [];

class Expectation {
  constructor(actual) {
    this.actual = actual;
  }

  toBe(expected) {
    if (this.actual !== expected) {
      throw new Error(`Expected ${this.actual} to be ${expected}`);
    }
  }

  toBeGreaterThan(expected) {
    if (!(this.actual > expected)) {
      throw new Error(`Expected ${this.actual} > ${expected}`);
    }
  }

  toBeGreaterThanOrEqual(expected) {
    if (!(this.actual >= expected)) {
      throw new Error(`Expected ${this.actual} >= ${expected}`);
    }
  }

  toBeLessThan(expected) {
    if (!(this.actual < expected)) {
      throw new Error(`Expected ${this.actual} < ${expected}`);
    }
  }

  toBeLessThanOrEqual(expected) {
    if (!(this.actual <= expected)) {
      throw new Error(`Expected ${this.actual} <= ${expected}`);
    }
  }

  toHaveLength(len) {
    if (!this.actual || typeof this.actual.length !== 'number') {
      throw new Error('Actual value has no length property');
    }
    if (this.actual.length !== len) {
      throw new Error(`Expected length ${len} but received ${this.actual.length}`);
    }
  }

  toBeCloseTo(expected, precision = 2) {
    if (typeof this.actual !== 'number' || typeof expected !== 'number') {
      throw new Error('toBeCloseTo expects numeric values');
    }
    const diff = Math.abs(this.actual - expected);
    const margin = Math.pow(10, -precision) / 2;
    if (diff > margin) {
      throw new Error(`Expected ${this.actual} to be within ${margin} of ${expected}`);
    }
  }
}

globalThis.describe = (name, fn) => {
  const suite = { name, tests: [], suites: [], parent: suiteStack[suiteStack.length - 1] };
  suiteStack[suiteStack.length - 1].suites.push(suite);
  suiteStack.push(suite);
  try {
    fn();
  } finally {
    suiteStack.pop();
  }
};

globalThis.test = (name, fn) => {
  suiteStack[suiteStack.length - 1].tests.push({ name, fn });
};

globalThis.expect = (value) => new Expectation(value);

globalThis.afterAll = (fn) => {
  afterAllCallbacks.push(fn);
};

function discoverTests(dir) {
  const files = readdirSync(dir);
  const testFiles = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      testFiles.push(...discoverTests(fullPath));
    } else if (file.endsWith('.test.js')) {
      testFiles.push(fullPath);
    }
  }
  return testFiles.sort();
}

async function runSuite(suite, parentLabel = '') {
  const currentLabel = suite.name === 'root' ? parentLabel : (parentLabel ? `${parentLabel} > ${suite.name}` : suite.name);
  const results = [];

  for (const testCase of suite.tests) {
    const fullName = currentLabel ? `${currentLabel} > ${testCase.name}` : testCase.name;
    const start = Date.now();
    try {
      await testCase.fn();
      results.push({ name: fullName, status: 'passed', duration: Date.now() - start });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      results.push({ name: fullName, status: 'failed', error: err, duration: Date.now() - start });
    }
  }

  for (const child of suite.suites) {
    results.push(...(await runSuite(child, currentLabel)));
  }

  return results;
}

(async () => {
  const files = discoverTests(testDir);
  for (const file of files) {
    await import(pathToFileURL(file));
  }

  const results = await runSuite(rootSuite);

  for (const callback of afterAllCallbacks) {
    await callback();
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed');
  const failedCount = failed.length;
  const summary = [
    `Test files: ${files.length}`,
    `Total tests: ${results.length}`,
    `Passed: ${passed}`,
    `Failed: ${failedCount}`,
    '',
  ];

  for (const fail of failed) {
    summary.push(`FAIL: ${fail.name}`);
    summary.push(fail.error?.message ?? 'Unknown error');
    if (fail.error?.stack) {
      summary.push(fail.error.stack.split('\n').slice(1, 4).join('\n'));
    }
    summary.push('');
  }

  writeFileSync(path.join(outDir, 'jest-summary.txt'), summary.join('\n'));

  const junitLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="stocking-tests-real" tests="${results.length}" failures="${failedCount}">`,
  ];
  for (const result of results) {
    junitLines.push(`  <testcase name="${result.name}" time="${(result.duration / 1000).toFixed(3)}">`);
    if (result.status === 'failed') {
      const message = (result.error?.stack || result.error?.message || 'Error').replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
      junitLines.push(`    <failure message="${message}"/>`);
    }
    junitLines.push('  </testcase>');
  }
  junitLines.push('</testsuite>');
  writeFileSync(path.join(outDir, 'jest-junit.xml'), junitLines.join('\n'));

  if (failedCount > 0) {
    console.error(`Tests failed: ${failedCount}`);
    process.exitCode = 1;
  } else {
    console.log(`All tests passed (${results.length} tests).`);
  }
})();
