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

const LINK_ORDER = [
  'Home',
  'Stocking Advisor',
  'Gear',
  'Cycling Coach',
  'Feature Your Tank',
  'Media',
  'Store',
  'About',
  'Contact & Feedback',
  'Privacy & Legal',
  'Terms of Use',
  'Copyright & DMCA',
];

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

async function expectNav(page, route) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.goto(`${baseURL}${route}`);
  await expect(errors, `${route} should be error free`).toEqual([]);

  const nav = page.locator('#global-nav');
  await expect(nav, `${route} should render global nav`).toBeVisible();

  const desktopLinks = nav.locator('.nav-links a');
  await expect(desktopLinks).toHaveCount(LINK_ORDER.length);
  const desktopTexts = (await desktopLinks.allTextContents()).map((value) => value.trim());
  await expect(desktopTexts).toEqual(LINK_ORDER);

  const drawerLinks = nav.locator('#ttg-drawer .drawer-nav a');
  const drawerTexts = (await drawerLinks.allTextContents()).map((value) => value.trim());
  await expect(drawerTexts).toEqual(LINK_ORDER);

  return { nav, desktopLinks, drawerLinks };
}

test('stocking, gear, and media share the nav layout', async ({ page }) => {
  await expectNav(page, '/stocking.html');
  await expectNav(page, '/gear/');
  await expectNav(page, '/media.html');
});

test('hamburger toggles drawer state and scroll lock', async ({ page }) => {
  await expectNav(page, '/stocking.html');
  const hamburger = page.locator('#hamburger');
  const drawer = page.locator('#ttg-drawer');
  const html = page.locator('html');

  await hamburger.click();
  await expect(drawer).toHaveAttribute('data-open', 'true');
  await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
  await expect(html).toHaveAttribute('data-scroll-lock', 'on');

  await page.keyboard.press('Escape');
  await expect(drawer).not.toHaveAttribute('data-open', 'true');
  await expect(html).not.toHaveAttribute('data-scroll-lock', 'on');
});

test('index page stays nav-free and noscript fallback renders elsewhere', async ({ page, browser }) => {
  await page.goto(`${baseURL}/`);
  await expect(page.locator('#global-nav')).toHaveCount(0);

  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto(`${baseURL}/contact-feedback.html`);
  const noscript = staticPage.locator('#site-nav .nav-noscript');
  await expect(noscript).toBeVisible();
  const fallbackTexts = (await noscript.locator('a').allTextContents()).map((value) => value.trim());
  await expect(fallbackTexts).toContain('Contact & Feedback');
  await context.close();
});
