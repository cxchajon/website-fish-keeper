#!/usr/bin/env node
import fs from 'fs';
import fsp from 'fs/promises';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(REPO_ROOT, '_codex_sync', 'trim');
const HAR_PATH = path.join(OUTPUT_DIR, 'runtime_network.har');
const CONSOLE_PATH = path.join(OUTPUT_DIR, 'runtime_console.txt');
const REPORT_PATH = path.join(OUTPUT_DIR, 'runtime_report.json');

const TOOLTIP_SELECTOR = "[data-tooltip-id], [data-info-id], [data-info], [data-tooltip], [data-tooltip-text], [data-tt]";

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function lookupContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function parseRedirects(filePath) {
  const redirects = new Map();
  if (!fs.existsSync(filePath)) {
    return redirects;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
      return;
    }
    const [from, to, statusPart] = parts;
    const status = Number.parseInt(statusPart, 10) || 301;
    redirects.set(from, { to, status });
  });
  return redirects;
}

async function createServer(rootDir, redirects, port) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      let pathname = url.pathname;
      if (redirects.has(pathname)) {
        const rule = redirects.get(pathname);
        res.statusCode = rule.status || 301;
        res.setHeader('Location', rule.to);
        res.end();
        return;
      }

      let normalized = path.posix.normalize(pathname);
      if (normalized === '/' || normalized === '') {
        normalized = '/index.html';
      } else if (normalized.endsWith('/')) {
        normalized = `${normalized}index.html`;
      }
      if (normalized.startsWith('../')) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      const filePath = path.join(rootDir, normalized.slice(1));
      const data = await fsp.readFile(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', lookupContentType(filePath));
      res.end(data);
    } catch (error) {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  await new Promise((resolve) => {
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
}

async function waitForTooltipOpen(page, selector) {
  await page.waitForFunction((sel) => {
    const trigger = document.querySelector(sel);
    if (!trigger) {
      return false;
    }
    const doc = trigger.ownerDocument || document;
    const id = trigger.dataset.tooltipId || trigger.dataset.infoId || trigger.getAttribute('aria-controls');
    const tip = id ? doc.getElementById(id) : null;
    if (!tip) {
      return false;
    }
    if (!trigger.getAttribute('aria-controls') && tip.id) {
      trigger.setAttribute('aria-controls', tip.id);
    }
    return tip.getAttribute('data-open') === 'true' && tip.hidden === false;
  }, selector, { timeout: 1500 }).catch(() => {});
}

async function getTooltipState(page, selector) {
  return page.evaluate((sel) => {
    const trigger = document.querySelector(sel);
    if (!trigger) {
      return { exists: false, open: false, id: null };
    }
    const doc = trigger.ownerDocument || document;
    const id = trigger.dataset.tooltipId || trigger.dataset.infoId || trigger.getAttribute('aria-controls');
    const tip = id ? doc.getElementById(id) : null;
    if (!tip) {
      return { exists: false, open: false, id };
    }
    return {
      exists: true,
      id: tip.id || id,
      open: tip.getAttribute('data-open') === 'true' && tip.hidden === false,
    };
  }, selector);
}

async function focusMatches(page, selector) {
  return page.evaluate((sel) => {
    const trigger = document.querySelector(sel);
    return !!trigger && document.activeElement === trigger;
  }, selector);
}

async function testTooltip(page) {
  const trigger = await page.$(TOOLTIP_SELECTOR);
  if (!trigger) {
    return { tested: false, pass: true, reason: 'no tooltip triggers found' };
  }
  const marker = `tooltip-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const markerSelector = `[data-tooltip-test-marker="${marker}"]`;
  await trigger.evaluate((el, value) => {
    el.setAttribute('data-tooltip-test-marker', value);
  }, marker);

  await trigger.focus();
  await page.waitForTimeout(100);

  const steps = {};

  await trigger.click();
  await waitForTooltipOpen(page, markerSelector);
  const clickState = await getTooltipState(page, markerSelector);
  steps.clickOpens = clickState.exists && clickState.open;

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  const escapeState = await getTooltipState(page, markerSelector);
  steps.escapeCloses = escapeState.exists && !escapeState.open;
  steps.focusAfterEscape = await focusMatches(page, markerSelector);

  await trigger.focus();
  await page.keyboard.press('Enter');
  await waitForTooltipOpen(page, markerSelector);
  const keyboardState = await getTooltipState(page, markerSelector);
  steps.keyboardOpens = keyboardState.exists && keyboardState.open;

  await trigger.click();
  await page.waitForTimeout(120);
  const secondState = await getTooltipState(page, markerSelector);
  steps.secondClickCloses = secondState.exists && !secondState.open;

  steps.focusAfterClose = await focusMatches(page, markerSelector);
  steps.noLingeringPanels = await page.evaluate(() => {
    return !document.querySelector('[data-tooltip-panel][data-open="true"]');
  });

  await trigger.evaluate((el) => {
    el.removeAttribute('data-tooltip-test-marker');
  });

  const pass = Object.values(steps).every(Boolean);
  return {
    tested: true,
    triggerSelector: markerSelector,
    steps,
    pass,
  };
}

async function run() {
  await fsp.mkdir(OUTPUT_DIR, { recursive: true });

  const port = 4173;
  const redirects = parseRedirects(path.join(REPO_ROOT, '_redirects'));
  const server = await createServer(REPO_ROOT, redirects, port);
  const baseURL = `http://127.0.0.1:${port}`;

  const consoleEntries = [];
  const reportPages = [];

  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    await closeServer(server);
    const message = `Playwright launch failed: ${error.message}`;
    await fsp.writeFile(CONSOLE_PATH, `${message}\n`, 'utf-8');
    await fsp.writeFile(REPORT_PATH, JSON.stringify({ baseURL, overallPass: false, pages: [], error: { message, name: error.name } }, null, 2), 'utf-8');
    await fsp.writeFile(HAR_PATH, JSON.stringify({ error: message }, null, 2), 'utf-8');
    return;
  }

  const context = await browser.newContext({
    recordHar: { path: HAR_PATH, content: 'omit' },
  });

  const pagesToVisit = [
    { path: '/', expectStatus: 200 },
    { path: '/gear/', expectStatus: 200 },
    { path: '/stocking-advisor.html', expectStatus: 200 },
    { path: '/params.html', expectStatus: 200 },
    { path: '/media.html', expectStatus: 200 },
    { path: '/about.html', expectStatus: 200 },
    { path: '/contact-feedback.html', expectStatus: 200 },
    { path: '/404.html', expectStatus: 301, finalPath: '/' },
  ];

  try {
    for (const spec of pagesToVisit) {
      const page = await context.newPage();
      const pageErrors = [];
      const missingResources = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const entry = { page: spec.path, type: 'console', text: msg.text() };
          consoleEntries.push(entry);
          pageErrors.push(entry);
        }
      });
      page.on('pageerror', (error) => {
        const entry = { page: spec.path, type: 'pageerror', text: error.message };
        consoleEntries.push(entry);
        pageErrors.push(entry);
      });
      page.on('response', (response) => {
        if (response.status() === 404) {
          missingResources.push(response.url());
        }
      });

      const url = `${baseURL}${spec.path}`;
      const navResponse = await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      let statusChain = [];
      if (navResponse) {
        let request = navResponse.request();
        while (request) {
          const response = request.response();
          if (response) {
            statusChain.unshift({ url: response.url(), status: response.status() });
          }
          request = request.redirectedFrom();
        }
      }

      const finalUrl = page.url();
      const finalStatus = statusChain.length ? statusChain[statusChain.length - 1].status : navResponse?.status() ?? null;
      let statusPass = false;
      let redirectPass = true;

      if (spec.expectStatus === 301) {
        const sawRedirect = statusChain.some((entry) => entry.status === 301);
        statusPass = sawRedirect && finalStatus === 200;
        redirectPass = sawRedirect && finalUrl === `${baseURL}${spec.finalPath || '/'}`;
      } else {
        statusPass = finalStatus === spec.expectStatus;
        redirectPass = finalUrl === `${baseURL}${spec.path}`;
      }

      const tooltip = await testTooltip(page);

      reportPages.push({
        path: spec.path,
        url,
        finalUrl,
        expectedStatus: spec.expectStatus,
        finalStatus,
        statusChain,
        statusPass,
        redirectPass,
        missingResources,
        consoleErrors: pageErrors,
        tooltip,
      });

      await page.close();
    }
  } finally {
    await browser.close();
    await closeServer(server);
  }

  const overallPass = reportPages.every((entry) => {
    const { statusPass, missingResources, consoleErrors, tooltip } = entry;
    const tooltipOk = !tooltip.tested || tooltip.pass;
    return statusPass && entry.redirectPass && missingResources.length === 0 && consoleErrors.length === 0 && tooltipOk;
  });

  const consoleText = consoleEntries
    .map((entry) => `[${entry.type.toUpperCase()}][${entry.page}] ${entry.text}`)
    .join('\n');
  await fsp.writeFile(CONSOLE_PATH, consoleText, 'utf-8');
  await fsp.writeFile(REPORT_PATH, JSON.stringify({ baseURL, overallPass, pages: reportPages }, null, 2), 'utf-8');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
