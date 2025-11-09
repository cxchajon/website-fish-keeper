import { test, expect } from '@playwright/test';
import http from 'http';
import { readFile } from 'fs/promises';
import { statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

let server;
let baseURL = '';

async function startServer() {
  const root = path.resolve(__dirname, '..');
  server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      let filePath = requestUrl.pathname;
      if (filePath.endsWith('/')) {
        filePath = path.join(filePath, 'index.html');
      }
      if (filePath === '/' || filePath === '') {
        filePath = '/index.html';
      }
      const normalised = path
        .normalize(filePath)
        .replace(/^([/\\])+/u, '')
        .replace(/^\.\.(?:[/\\]|$)/gu, '');
      const diskPath = path.join(root, normalised);
      let stats;
      try {
        stats = statSync(diskPath);
      } catch {
        stats = undefined;
      }
      if (!stats || stats.isDirectory()) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const data = await readFile(diskPath);
      const contentType = mimeTypes[path.extname(diskPath).toLowerCase()] ?? 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.end(data);
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address && typeof address === 'object') {
    baseURL = `http://127.0.0.1:${address.port}`;
  } else {
    throw new Error('Failed to start static server');
  }
}

async function stopServer() {
  await new Promise((resolve) => server.close(() => resolve()));
}

test.beforeAll(async () => {
  await startServer();
});

test.afterAll(async () => {
  await stopServer();
});

async function gotoAndVerify(page, route, theme) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  const cssResponsePromise = page.waitForResponse((response) =>
    response.url().includes('css/style.css?v=1.0.10')
  );

  await page.goto(`${baseURL}${route}`);
  const cssResponse = await cssResponsePromise;
  expect(cssResponse.status(), `${route} should load css/style.css`).toBe(200);

  const nav = page.locator('#global-nav');
  await expect(nav, `${route} should render the shared nav`).toBeVisible();
  const navPosition = await nav.evaluate((element) => window.getComputedStyle(element).position);
  expect(navPosition).toBe('relative');

  const hamburger = page.locator('#ttg-nav-open');
  const brand = page.locator('#global-nav .brand');
  await expect(hamburger).toBeVisible();
  await expect(brand).toBeVisible();
  const [hambBox, brandBox] = await Promise.all([hamburger.boundingBox(), brand.boundingBox()]);
  expect(hambBox).not.toBeNull();
  expect(brandBox).not.toBeNull();
  if (hambBox && brandBox) {
    expect(hambBox.x).toBeLessThan(brandBox.x);
  }

  const drawer = page.locator('#ttg-drawer');
  const overlay = page.locator('#ttg-overlay');
  await hamburger.click();
  await expect(nav).toHaveAttribute('data-open', 'true');
  await expect(drawer).toHaveClass(/is-open/);
  await expect(overlay).toHaveClass(/is-open/);

  const drawerZ = await drawer.evaluate((element) => Number(window.getComputedStyle(element).zIndex) || 0);
  const overlayZ = await overlay.evaluate((element) => Number(window.getComputedStyle(element).zIndex) || 0);
  const card = page.locator('.card').first();
  let cardZ = 0;
  if (await card.count()) {
    cardZ = await card.evaluate((element) => Number(window.getComputedStyle(element).zIndex) || 0);
  }
  expect(drawerZ).toBeGreaterThan(cardZ);
  expect(overlayZ).toBeGreaterThan(cardZ);

  await overlay.click();
  await expect(nav).not.toHaveAttribute('data-open', 'true');
  await expect(drawer).not.toHaveClass(/is-open/);

  await hamburger.click();
  await expect(nav).toHaveAttribute('data-open', 'true');
  await page.keyboard.press('Escape');
  await expect(nav).not.toHaveAttribute('data-open', 'true');

  const background = await page.evaluate(() => window.getComputedStyle(document.body).backgroundImage || '');
  if (theme === 'dark') {
    expect(background).toMatch(/rgb\(9, 20, 33|rgb\(10, 15, 24/);
  } else {
    expect(background).toMatch(/rgb\(14, 94, 139|rgb\(20, 119, 168/);
  }

  await expect(errors, `${route} should not log console errors`).toEqual([]);
}

test('stocking, gear, and media share the nav layout', async ({ page }) => {
  await gotoAndVerify(page, '/stocking-advisor.html', 'dark');
  await gotoAndVerify(page, '/gear/', 'dark');
  await gotoAndVerify(page, '/media.html', 'light');
});

test('index page remains free of the global nav', async ({ page }) => {
  const cssResponsePromise = page.waitForResponse((response) =>
    response.url().includes('css/style.css?v=1.0.10')
  );
  await page.goto(`${baseURL}/index.html`);
  const cssResponse = await cssResponsePromise;
  expect(cssResponse.status(), 'index should load css/style.css').toBe(200);
  await expect(page.locator('#global-nav')).toHaveCount(0);
});
