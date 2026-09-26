import { defineConfig, devices } from '@playwright/test';

// Focused production gate for the Stocking Advisor species pipeline. Independent of the main
// Playwright suite: it starts its own static server and runs only tests/stocking-advisor-gate.spec.ts.
// Set PW_CHROMIUM_PATH to use a locally installed Chromium instead of Playwright's download.
const PORT = 4174;
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: 'tests',
  testMatch: 'stocking-advisor-gate.spec.ts',
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tests/support/static-server.mjs',
    url: `http://127.0.0.1:${PORT}/stocking-advisor.html`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'], launchOptions } },
  ],
});
