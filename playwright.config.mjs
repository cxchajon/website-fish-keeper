import { defineConfig, devices } from '@playwright/test';

const DEFAULT_PORT = process.env.PORT || 4173;
const DEFAULT_BASE = `http://localhost:${DEFAULT_PORT}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || DEFAULT_BASE;
const shouldStartServer = !process.env.PLAYWRIGHT_BASE_URL && !process.env.PLAYWRIGHT_SKIP_WEB_SERVER;

export default defineConfig({
  testDir: './tests',
  retries: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    headless: true,
    baseURL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'iphone-12',
      use: {
        ...devices['iPhone 12'],
      },
    },
  ],
  webServer: shouldStartServer
    ? {
        command: `node scripts/dev-server.mjs`,
        url: `${DEFAULT_BASE}/stocking.html`,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      }
    : undefined,
});
