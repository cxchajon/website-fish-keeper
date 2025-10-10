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

const LINK_ORDER = [
  { text: 'Home', href: '/' },
  { text: 'Stocking Advisor', href: '/stocking.html' },
  { text: 'Gear', href: '/gear/' },
  { text: 'Cycling Coach', href: '/params.html' },
  { text: 'Feature Your Tank', href: '/feature-your-tank.html' },
  { text: 'Media', href: '/media.html' },
  { text: 'Store', href: '/store.html' },
  { text: 'About', href: '/about.html' },
  { text: 'Contact & Feedback', href: '/contact-feedback.html' },
  { text: 'Privacy & Legal', href: '/privacy-legal.html' },
  { text: 'Terms of Use', href: '/terms.html' },
  { text: 'Copyright & DMCA', href: '/copyright-dmca.html' },
];

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

async function goto(page, route: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto(`${baseURL}${route}`);
  return errors;
}

async function expectLinkOrder(listLocator) {
  await expect(listLocator).toHaveCount(LINK_ORDER.length);
  const anchors = await listLocator.elementHandles();
  for (let i = 0; i < LINK_ORDER.length; i += 1) {
    const anchor = anchors[i];
    const text = (await anchor.textContent())?.trim();
    const href = await anchor.getAttribute('href');
    expect(text).toBe(LINK_ORDER[i].text);
    expect(href).toBe(LINK_ORDER[i].href);
  }
}

test('index page remains nav-free', async ({ page }) => {
  const errors = await goto(page, '/index.html');
  const nav = page.locator('#global-nav');
  await expect(nav).toHaveCount(0);
  await expect(errors).toEqual([]);
});

test('shared nav renders with correct link order and active states', async ({ page }) => {
  const errors = await goto(page, '/about.html');
  await expect(errors).toEqual([]);

  const nav = page.locator('#global-nav');
  await expect(nav).toBeVisible();

  const desktopLinks = page.locator('#global-nav .nav-links a');
  await expectLinkOrder(desktopLinks);

  const drawerLinks = page.locator('#global-nav #ttg-drawer .drawer-nav a');
  await expectLinkOrder(drawerLinks);

  const inlineActive = desktopLinks.filter({ hasText: 'About' }).first();
  await expect(inlineActive).toHaveAttribute('aria-current', 'page');

  await page.locator('#hamburger').click();
  const drawerActive = drawerLinks.filter({ hasText: 'About' }).first();
  await expect(drawerActive).toHaveAttribute('aria-current', 'page');
});

test('drawer toggles, supports escape/overlay/link close, and manages focus/scroll-lock', async ({ page }) => {
  await goto(page, '/feature-your-tank.html');
  await expect(page.locator('#global-nav')).toBeVisible();

  const hamburger = page.locator('#hamburger');
  const drawer = page.locator('#ttg-drawer');
  const html = page.locator('html');
  const closeButton = drawer.locator('.drawer-close');
  const firstLink = drawer.locator('.drawer-nav a').first();

  await expect(hamburger).toBeVisible();
  await hamburger.click();
  await expect(drawer).toHaveAttribute('data-open', 'true');
  await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
  await expect(html).toHaveAttribute('data-scroll-lock', 'on');
  await page.waitForFunction(() => document.activeElement?.matches('#ttg-drawer .drawer-nav a, #ttg-drawer .drawer-close'));

  await page.keyboard.press('Escape');
  await expect(drawer).not.toHaveAttribute('data-open', 'true');
  await expect(html).not.toHaveAttribute('data-scroll-lock', 'on');
  await page.waitForFunction(() => document.activeElement?.id === 'hamburger');

  await hamburger.click();
  await expect(drawer).toHaveAttribute('data-open', 'true');

  await drawer.dispatchEvent('click');
  await expect(drawer).not.toHaveAttribute('data-open', 'true');

  await hamburger.click();
  await closeButton.click();
  await expect(drawer).not.toHaveAttribute('data-open', 'true');

  await hamburger.click();
  await expect(drawer).toHaveAttribute('data-open', 'true');
  await page.evaluate(() => {
    const link = document.querySelector('#ttg-drawer .drawer-nav a');
    link?.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await firstLink.click();
  await expect(drawer).not.toHaveAttribute('data-open', 'true');
});

test('noscript fallback appears when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/about.html`);
  const noscriptNav = page.locator('#site-nav .nav-noscript');
  await expect(noscriptNav).toBeVisible();
  const fallbackLinks = noscriptNav.locator('a');
  await expect(fallbackLinks).toHaveCount(LINK_ORDER.length + 1); // includes brand link
  await expect(fallbackLinks.nth(1)).toHaveText('Home');

  await page.goto(`${baseURL}/media.html`);
  await expect(page.locator('#site-nav .nav-noscript')).toBeVisible();

  await context.close();
});
