import { chromium } from '@playwright/test';

async function test() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    console.log('Creating context...');
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    console.log('Navigating to Stocking Advisor...');
    await page.goto('https://thetankguide.com/stocking-advisor.html', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    const title = await page.title();
    console.log('Page title:', title);

    // Wait for key elements
    await page.waitForSelector('#tank-size', { timeout: 10000 });
    console.log('✓ Tank size selector found');

    await page.waitForSelector('#plan-species', { timeout: 10000 });
    console.log('✓ Species selector found');

    console.log('✓ Browser test successful!');
  } catch (error) {
    console.error('✗ Browser test failed:', error.message);
  } finally {
    await browser.close();
  }
}

test().catch(console.error);
