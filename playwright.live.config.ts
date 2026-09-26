import { defineConfig, devices } from '@playwright/test';

// Read-only checks against the live site, run only by the manual Stocking Advisor live-verify
// workflow. No web server: tests go to BASE_URL (production by default).
// Set PW_CHROMIUM_PATH to use a locally installed Chromium instead of Playwright's download.
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: 'tests/live',
  testMatch: '*.live.ts',
  timeout: 60000,
  expect: { timeout: 15000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'https://thetankguide.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], launchOptions } }],
});
