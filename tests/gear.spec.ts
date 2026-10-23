import { test, expect } from '@playwright/test';
import * as http from 'http';
import { readFile } from 'fs/promises';
import { statSync } from 'fs';
import { dirname, extname, join, normalize, resolve } from 'path';
import { fileURLToPath } from 'url';

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let baseURL = '';
let server: http.Server;

async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
    let filePath = requestUrl.pathname;
    if (filePath.endsWith('/')) {
      filePath = join(filePath, 'index.html');
    }
    if (filePath === '/' || filePath === '') {
      filePath = '/index.html';
    }
    const normalised = normalize(filePath)
      .replace(/^([/\\])+/u, '')
      .replace(/^\.\.(?:[/\\]|$)/gu, '');
    const root = resolve(__dirname, '..');
    const diskPath = join(root, normalised);
    let fileStat: ReturnType<typeof statSync> | undefined;
    try {
      fileStat = statSync(diskPath);
    } catch {
      fileStat = undefined;
    }
    if (!fileStat || fileStat.isDirectory()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const data = await readFile(diskPath);
    const contentType = mimeTypes[extname(diskPath).toLowerCase()] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.end(data);
  } catch (error) {
    res.statusCode = 500;
    res.end(String(error));
  }
}

async function startServer() {
  return new Promise<string>((resolveServer) => {
    server = http.createServer(serveStatic);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolveServer(`http://127.0.0.1:${address.port}`);
      }
    });
  });
}

test.beforeAll(async () => {
  baseURL = await startServer();
});

test.afterAll(async () => {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
});

async function gotoGear(page) {
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  // Third-party scripts and beacons (ads, analytics) are not under test and fail CORS on localhost.
  await page.route((url) => url.origin !== baseURL, (route) => route.fulfill({ status: 204, body: '' }));
  await page.goto(`${baseURL}/gear/`);
  // The bundle controller sets the current tier in the same step that binds the tier and
  // alternatives buttons, so it marks the page as interactive.
  await page.waitForFunction(() => Boolean((window as any).currentSelectedTier));
  return consoleErrors;
}

test('gear guide loads without console errors', async ({ page }) => {
  const errors = await gotoGear(page);
  await expect(page.locator('.tier-selector .tier-btn')).toHaveCount(6);
  await expect(page.locator('#gear-bundle .bundle-card').first()).toBeVisible();
  await expect(page.locator('#bundle-tier-name')).toHaveText('20 Gallon');
  expect(errors).toEqual([]);
});

test('choosing a tank size updates the gear bundle', async ({ page }) => {
  await gotoGear(page);
  await page.locator('.tier-btn[data-tier="tier_55"]').click();
  await expect(page.locator('.tier-btn[data-tier="tier_55"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.tier-btn[data-tier="tier_20"]')).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('#bundle-tier-name')).toHaveText('55 Gallon');
  await expect(page.locator('#heater-spec')).toHaveText('300W adjustable');
  await expect(page.locator('#filter-spec')).toHaveText('300-400 GPH');
});

test('see alternatives toggles the alternatives panel', async ({ page }) => {
  await gotoGear(page);
  const toggle = page.locator('.bundle-card__alts-toggle[data-alts="temp-controller"]');
  const panel = page.locator('#temp-controller-alts');
  await expect(panel).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
});

test('quick answers accordion expands and collapses', async ({ page }) => {
  await gotoGear(page);
  const trigger = page.locator('.qa-accordion__trigger').first();
  const panel = page.locator(`#${await trigger.getAttribute('aria-controls')}`);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
});
