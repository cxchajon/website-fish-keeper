import { defineConfig, devices } from '@playwright/test';

// Set PW_CHROMIUM_PATH to use a locally installed Chromium instead of Playwright's download.
const chromiumLaunchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: 'tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: process.env.TTG_BASE_URL ?? 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } }
  ],
  webServer: {
    command: 'node scripts/dev-server.mjs',
    env: { PORT: '8080' },
    url: 'http://localhost:8080/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
