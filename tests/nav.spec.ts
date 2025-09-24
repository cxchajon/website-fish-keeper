import { test, expect } from '@playwright/test';
import * as http from 'http';
import { readFile } from 'fs/promises';
import { statSync } from 'fs';
import { dirname, extname, join, normalize, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

let baseURL = '';
let server: http.Server;

async function startServer() {
  const root = resolve(__dirname, '..');
  server = http.createServer(async (req, res) => {
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
      const diskPath = join(root, normalised);
      let stats: ReturnType<typeof statSync> | undefined;
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
      const contentType = mimeTypes[extname(diskPath).toLowerCase()] ?? 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.end(data);
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
  });

  await new Promise<void>((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
  const address = server.address();
  if (address && typeof address === 'object') {
    baseURL = `http://127.0.0.1:${address.port}`;
  } else {
    throw new Error('Failed to start static server');
  }
}

async function stopServer() {
  await new Promise<void>((resolveServer) => server.close(() => resolveServer()));
}

test.beforeAll(async () => {
  await startServer();
});

test.afterAll(async () => {
  await stopServer();
});

async function gotoAbout(page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto(`${baseURL}/about.html`);
  return errors;
}

test('drawer opens on hamburger click and locks scroll', async ({ page }) => {
  const errors = await gotoAbout(page);
  await expect(errors).toEqual([]);

  const hamburger = page.locator('[data-nav="hamburger"]');
  const drawer = page.locator('[data-nav="drawer"]');
  const overlay = page.locator('[data-nav="overlay"]');

  await hamburger.click();
  await expect(drawer).toHaveClass(/is-open/);
  await expect(overlay).toHaveClass(/is-open/);

  await expect(page.locator('html')).toHaveAttribute('data-scroll-lock', 'on');
  const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
  expect(bodyOverflow).toBe('hidden');
});

test('overlay click closes the drawer', async ({ page }) => {
  await gotoAbout(page);
  const hamburger = page.locator('[data-nav="hamburger"]');
  const drawer = page.locator('[data-nav="drawer"]');
  const overlay = page.locator('[data-nav="overlay"]');

  await hamburger.click();
  await expect(drawer).toHaveClass(/is-open/);
  await overlay.click();
  await expect(drawer).not.toHaveClass(/is-open/);
  await expect(page.locator('html')).not.toHaveAttribute('data-scroll-lock', 'on');
});

test('escape key closes the drawer and restores focus', async ({ page }) => {
  await gotoAbout(page);
  const hamburger = page.locator('[data-nav="hamburger"]');
  const drawer = page.locator('[data-nav="drawer"]');

  await hamburger.click();
  await expect(drawer).toHaveClass(/is-open/);

  await page.keyboard.press('Escape');
  await expect(drawer).not.toHaveClass(/is-open/);
  await page.waitForFunction(() => document.activeElement?.dataset.nav === 'hamburger');
  const expanded = await hamburger.getAttribute('aria-expanded');
  expect(expanded).toBe('false');
});

test('About link is marked active inline and in the drawer', async ({ page }) => {
  await gotoAbout(page);
  const inlineActive = page.locator('.site-links .nav__link[aria-current="page"]');
  await expect(inlineActive).toHaveText('About');

  await page.locator('[data-nav="hamburger"]').click();
  const drawerActive = page.locator('[data-nav="drawer"] .nav__link[aria-current="page"]');
  await expect(drawerActive).toHaveText('About');
});

test('nav layers sit above main content', async ({ page }) => {
  await gotoAbout(page);
  await page.locator('[data-nav="hamburger"]').click();

  const { overlayZ, drawerZ } = await page.evaluate(() => {
    const overlayEl = document.querySelector('[data-nav="overlay"]');
    const drawerEl = document.querySelector('[data-nav="drawer"]');
    const overlayStyle = overlayEl ? window.getComputedStyle(overlayEl).zIndex : '0';
    const drawerStyle = drawerEl ? window.getComputedStyle(drawerEl).zIndex : '0';
    return {
      overlayZ: Number(overlayStyle || '0'),
      drawerZ: Number(drawerStyle || '0'),
    };
  });

  expect(overlayZ).toBeGreaterThanOrEqual(9998);
  expect(drawerZ).toBeGreaterThan(overlayZ);
});
