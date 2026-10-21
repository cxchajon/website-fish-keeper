import { expect, test } from '@playwright/test';

const CLOUDINARY_WIDGET_URL = 'https://widget.cloudinary.com/v2.0/global/all.js';
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

test.describe('Feature Your Tank unsigned fallback', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(CLOUDINARY_WIDGET_URL, async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          window.cloudinary = {
            createUploadWidget(options, callback) {
              window.__ttgUploadWidgetOptions = options;
              window.__ttgUploadWidgetCallback = callback;
              return {
                open() { window.__ttgUploadWidgetOpened = true; }
              };
            }
          };
        `
      });
    });
    await page.route(TURNSTILE_URL, async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: 'window.turnstile = { reset() {}, render() { return "test-widget"; }, remove() {} };'
      });
    });
  });

  test('keeps the existing unsigned widget and previews while signed uploads are disabled', async ({ page }) => {
    const authorizerRequests = [];
    await page.on('request', (request) => {
      if (request.url().includes('ttg-upload-authorizer')) authorizerRequests.push(request.url());
    });

    await page.goto('/submit-your-tank.html');
    await page.evaluate(() => {
      document.querySelectorAll('.ft-step').forEach((step) => {
        step.hidden = true;
        step.style.display = 'none';
      });
      const featureStep = document.querySelector('.ft-step[data-step="3"]');
      featureStep.hidden = false;
      featureStep.style.display = 'block';
    });
    await expect(page.locator('#photoUploadTrigger')).toBeVisible();
    await expect(page.locator('#uploadSecurityCheck')).toBeHidden();

    const options = await page.evaluate(() => window.__ttgUploadWidgetOptions);
    expect(options.uploadPreset).toBe('feature-your-tank');
    expect(options.folder).toBe('feature-your-tank');
    expect(options.tags).toEqual(['tank-submission']);
    expect(options.prepareUploadParams).toBeUndefined();

    await page.locator('#photoUploadTrigger').click();
    await expect.poll(() => page.evaluate(() => window.__ttgUploadWidgetOpened)).toBe(true);

    await page.evaluate(() => {
      window.__ttgUploadWidgetCallback(null, {
        event: 'success',
        info: {
          secure_url: 'https://res.cloudinary.com/fishkeepinglifeco/image/upload/feature-your-tank/test.jpg',
          public_id: 'feature-your-tank/test',
          width: 1200,
          height: 800
        }
      });
    });

    await expect(page.locator('#selectedFiles')).toContainText('1 photo selected');
    await expect(page.locator('#selectedFiles img')).toHaveCount(1);
    expect(authorizerRequests).toEqual([]);
  });
});
