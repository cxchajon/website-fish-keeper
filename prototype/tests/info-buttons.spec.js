import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, '../js/info-popovers.js');

const MARKUP = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Prototype Info Buttons Test</title>
      <style>
        body { margin: 0; font-family: system-ui, sans-serif; }
      </style>
    </head>
    <body class="proto-stock">
      <div class="env-bars">
        <div class="env-bar">
          <button
            id="bioload-info-btn"
            class="info-btn"
            type="button"
            data-info-target="#bioload-info-panel"
            aria-controls="bioload-info-panel"
            aria-haspopup="dialog"
            aria-expanded="false"
          >i</button>
        </div>
      </div>
      <div class="turnover">
        <button
          id="turnover-info-btn"
          class="info-btn"
          type="button"
          data-info-target="#turnover-info-panel"
          aria-controls="turnover-info-panel"
          aria-haspopup="dialog"
          aria-expanded="false"
        >i</button>
      </div>
      <div
        id="bioload-info-panel"
        class="proto-info-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bioload-info-title"
        hidden
      >
        <div class="proto-info-panel__surface" data-info-surface>
          <header class="proto-info-panel__header">
            <h3 id="bioload-info-title" class="proto-info-panel__title">Bioload capacity guide</h3>
            <button type="button" data-info-close aria-label="Close">×</button>
          </header>
          <div class="proto-info-panel__body">
            <p>Filtration increases your tank’s capacity to process waste.</p>
            <button type="button" id="panel-focus">Focus check</button>
          </div>
        </div>
      </div>
      <div
        id="turnover-info-panel"
        class="proto-info-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="turnover-info-title"
        hidden
      >
        <div class="proto-info-panel__surface" data-info-surface>
          <header class="proto-info-panel__header">
            <h3 id="turnover-info-title" class="proto-info-panel__title">Turnover targets</h3>
            <button type="button" data-info-close aria-label="Close">×</button>
          </header>
          <div class="proto-info-panel__body">
            <ul>
              <li>Turnover compares filter flow to aquarium volume.</li>
              <li>General community tanks thrive around 5–7× per hour.</li>
            </ul>
          </div>
        </div>
      </div>
    </body>
  </html>
`;

async function mountPrototype(page) {
  await page.goto('about:blank');
  await page.setContent(MARKUP, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    history.replaceState({}, '', '/prototype/stocking-prototype.html');
  });
  await page.addScriptTag({ path: scriptPath, type: 'module' });
  await page.evaluate(() => {
    if (window.__TTGInfoPopovers) {
      window.__TTGInfoPopovers(document);
    }
  });
}

test.describe('prototype info buttons', () => {
  test('bioload and turnover panels open and close', async ({ page }) => {
    await mountPrototype(page);

    const bioloadPanel = page.locator('#bioload-info-panel');
    const bioloadBtn = page.locator('#bioload-info-btn');

    await expect(bioloadPanel).toBeHidden();
    await bioloadBtn.click();
    await expect(bioloadPanel).toBeVisible();
    await expect(bioloadBtn).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(bioloadPanel).toBeHidden();
    await expect(bioloadBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(bioloadBtn).toBeFocused();

    const turnoverBtn = page.locator('#turnover-info-btn');
    const turnoverPanel = page.locator('#turnover-info-panel');

    await turnoverBtn.click();
    await expect(turnoverPanel).toBeVisible();
    await expect(turnoverBtn).toHaveAttribute('aria-expanded', 'true');
  });

  test('event delegation opens targets for new triggers', async ({ page }) => {
    await mountPrototype(page);

    await page.evaluate(() => {
      const extra = document.createElement('button');
      extra.type = 'button';
      extra.id = 'extra-info';
      extra.textContent = 'Extra trigger';
      extra.setAttribute('data-info-target', '#bioload-info-panel');
      document.body.appendChild(extra);
    });

    const extraTrigger = page.locator('#extra-info');
    await extraTrigger.click();
    await expect(page.locator('#bioload-info-panel')).toBeVisible();
  });
});
