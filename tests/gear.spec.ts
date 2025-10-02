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
  await page.goto(`${baseURL}/gear/`);
  return consoleErrors;
}

const selectTankSize = async (page, value: string) => {
  await page.selectOption('#context-tank-size', value);
};

test('gear guide loads without console errors', async ({ page }) => {
  const errors = await gotoGear(page);
  await expect(errors).toEqual([]);
  await expect(page.locator('[data-testid="context-bar"]')).toBeVisible();
  await expect(page.locator('[data-testid="recommended-stack"] .recommended-card')).toHaveCount(4);
});

test('context changes update filtration list', async ({ page }) => {
  await gotoGear(page);
  await selectTankSize(page, '75g');
  await page.selectOption('#context-bio-load', 'Heavy');
  const filtrationAccordion = page.locator('[data-testid="accordion-filtration"]');
  await expect(filtrationAccordion).toBeVisible();
  const cards = filtrationAccordion.locator('.product-card');
  await expect(cards.first()).toBeVisible();
});

test('why this pick drawer opens from recommended card', async ({ page }) => {
  await gotoGear(page);
  await page.locator('[data-testid="recommended-stack"] .recommended-card .btn.secondary').first().click();
  const drawer = page.locator('[data-testid="why-pick-drawer"]');
  await expect(drawer).toBeVisible();
  await expect(drawer).not.toHaveClass(/is-hidden/);
  await drawer.locator('button', { hasText: 'Close' }).click();
  await expect(drawer).toHaveClass(/is-hidden/);
});

test('tank smart modal toggles from CTA', async ({ page }) => {
  await gotoGear(page);
  await page.click('text=How to Buy a Tank Smart');
  const modal = page.locator('[data-testid="tank-smart-modal"]');
  await expect(modal).toHaveClass(/is-open/);
  await modal.locator('button', { hasText: 'Close' }).click();
  await expect(modal).not.toHaveClass(/is-open/);
});
