import { test, expect } from '@playwright/test';
import * as http from 'http';
import { readFile } from 'fs/promises';
import { statSync } from 'fs';
import * as path from 'path';

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

test.beforeAll(async () => {
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
      const contentType = mimeTypes[path.extname(diskPath).toLowerCase()] ?? 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.end(data);
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address && typeof address === 'object') {
    baseURL = `http://127.0.0.1:${address.port}`;
  } else {
    throw new Error('Failed to start static server');
  }
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function gotoGear(page) {
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  await page.goto(`${baseURL}/gear.html`);
  return consoleErrors;
}

const tankSizeOption = async (page, value: string) => {
  await page.selectOption('#tank-size', value);
};

test('gear page loads without console errors', async ({ page }) => {
  const errors = await gotoGear(page);
  await expect(errors, 'No console errors expected on load').toEqual([]);
});

test('filter list renders for 29 gallons and computes turnover', async ({ page }) => {
  await gotoGear(page);
  await tankSizeOption(page, '29');
  const filterCards = page.locator('#filter-options .product');
  await expect(filterCards).toHaveCountGreaterThan(0);
  const first = filterCards.first();
  const gph = Number(await first.getAttribute('data-gph'));
  const turnover = Number(await first.getAttribute('data-turnover'));
  expect(gph).toBeGreaterThan(0);
  expect(turnover).toBeGreaterThan(0);
  expect(Math.abs(turnover - gph / 29)).toBeLessThan(0.2);
});

test('medium plant level suggests one size up lighting', async ({ page }) => {
  await gotoGear(page);
  await tankSizeOption(page, '29');
  await page.selectOption('#plant-level', 'med');
  const suggestion = page.locator('#light-options .product:has-text("One size up for even coverage")');
  await expect(suggestion.first()).toBeVisible();
});

test('adding items updates cart count and total', async ({ page }) => {
  await gotoGear(page);
  await tankSizeOption(page, '29');
  await page.locator('#tank-options .product button.add-cart').first().click();
  await page.locator('#filter-options .product button.add-cart').first().click();
  await expect(page.locator('#cart-count')).toHaveText('2');
  const totalText = await page.locator('#cart-total').textContent();
  expect(totalText).not.toBeNull();
  const total = Number(totalText);
  expect(total).toBeCloseTo(234.98, 2);
});

test('copy all links produces newline separated URLs', async ({ page }) => {
  await gotoGear(page);
  await tankSizeOption(page, '29');
  await page.locator('#tank-options .product button.add-cart').first().click();
  await page.locator('#filter-options .product button.add-cart').first().click();
  await page.click('#cart-buy-all');
  await expect(page.locator('#cart-modal-backdrop')).toBeVisible();
  const textarea = page.locator('#cart-modal-textarea');
  await expect(textarea).toHaveValue(/\n/);
  await page.click('#cart-copy');
  const status = await page.locator('#cart-modal-copy-status').innerText();
  expect(status.trim().length).toBeGreaterThan(0);
});
