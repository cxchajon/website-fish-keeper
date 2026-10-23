import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const CLOUDINARY_WIDGET_URL = 'https://widget.cloudinary.com/v2.0/global/all.js';
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const AUTHORIZER_ENDPOINT = 'https://ttg-upload-authorizer.example';
const FEATURE_SCRIPT = await readFile(new URL('../assets/js/feature-your-tank.js', import.meta.url), 'utf8');

function configuredFeatureScript({
  signedUploadsEnabled = true,
  uploadAuthorizerEndpoint = AUTHORIZER_ENDPOINT,
  uploadTurnstileSiteKey = '0x4AAAAA-test-site-key',
  uploadTurnstileAction = 'ttg_upload_authorize'
} = {}) {
  return FEATURE_SCRIPT
    .replace(/signedUploadsEnabled:\s*(?:true|false),/, `signedUploadsEnabled: ${JSON.stringify(signedUploadsEnabled)},`)
    .replace(
      "uploadAuthorizerEndpoint: 'https://ttg-upload-authorizer.fishkeepinglifeco.workers.dev',",
      `uploadAuthorizerEndpoint: ${JSON.stringify(uploadAuthorizerEndpoint)},`
    )
    .replace(/uploadTurnstileSiteKey:\s*'[^']*',/, `uploadTurnstileSiteKey: ${JSON.stringify(uploadTurnstileSiteKey)},`)
    .replace("uploadTurnstileAction: 'ttg_upload_authorize',", `uploadTurnstileAction: ${JSON.stringify(uploadTurnstileAction)},`);
}

async function configureFeatureScript(page, config) {
  await page.route(/\/assets\/js\/feature-your-tank\.js(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: configuredFeatureScript(config)
    });
  });
}

async function revealPhotoStep(page) {
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
}

async function assertNoUnsignedWidget(page) {
  const widgets = await page.evaluate(() => window.__ttgUploadWidgets);
  expect(widgets.filter((widget) => widget.options.uploadPreset === 'feature-your-tank')).toHaveLength(0);
  expect(widgets.filter((widget) => widget.opened && widget.options.uploadPreset === 'feature-your-tank')).toHaveLength(0);
}

test.describe('Feature Your Tank upload mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(CLOUDINARY_WIDGET_URL, async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          window.cloudinary = {
            createUploadWidget(options, callback) {
              const widget = { options, callback, opened: false };
              window.__ttgUploadWidgets.push(widget);
              window.__ttgUploadWidgetOptions = options;
              window.__ttgUploadWidgetCallback = callback;
              return {
                open() {
                  widget.opened = true;
                  window.__ttgUploadWidgetOpened = true;
                }
              };
            }
          };
          window.__ttgUploadWidgets = [];
        `
      });
    });
    await page.route(TURNSTILE_URL, async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          window.turnstile = {
            reset() {},
            render(_target, options) {
              window.__ttgTurnstileRenders = window.__ttgTurnstileRenders || [];
              window.__ttgTurnstileRenders.push(options);
              queueMicrotask(() => options.callback(
                options.action === 'ttg_confirmation'
                  ? 'confirmation-turnstile-token'
                  : 'dedicated-upload-turnstile-token'
              ));
              return 'test-widget';
            },
            remove() {}
          };
        `
      });
    });
  });

  test('keeps the existing unsigned widget and previews while signed uploads are disabled', async ({ page }) => {
    const authorizerRequests = [];
    await configureFeatureScript(page, { signedUploadsEnabled: false });
    await page.on('request', (request) => {
      if (request.url().includes('ttg-upload-authorizer')) authorizerRequests.push(request.url());
    });

    await page.goto('/submit-your-tank.html');
    await revealPhotoStep(page);
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

  const failClosedScenarios = [
    {
      name: 'the dedicated Turnstile site key is missing',
      config: { uploadTurnstileSiteKey: '' }
    },
    {
      name: 'the authorization endpoint is invalid',
      config: { uploadAuthorizerEndpoint: 'http://ttg-upload-authorizer.example' }
    },
    {
      name: 'the authorization Worker is unavailable',
      authorize: (route) => route.abort('failed')
    },
    {
      name: 'the Worker returns an expired session',
      authorize: (route) => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          session: {
            id: 'session-000000000000000000000001',
            token: 's'.repeat(43),
            expiresAt: Date.now() - 1,
            maxUploads: 5
          }
        })
      })
    },
    {
      name: 'the Worker rejects authorization',
      authorize: (route) => route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false })
      })
    },
    {
      name: 'the Worker response is missing session data',
      authorize: (route) => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      })
    },
    {
      name: 'the Worker response is malformed',
      authorize: (route) => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, session: { id: 'malformed' } })
      })
    }
  ];

  for (const scenario of failClosedScenarios) {
    test(`never creates or opens an unsigned uploader when signed mode is selected and ${scenario.name}`, async ({ page }) => {
      await configureFeatureScript(page, scenario.config);
      if (scenario.authorize) {
        await page.route(`${AUTHORIZER_ENDPOINT}/authorize`, scenario.authorize);
      }

      await page.goto('/submit-your-tank.html');
      await revealPhotoStep(page);
      await page.locator('#photoUploadTrigger').click();

      await expect(page.locator('#errorMessage')).toContainText('Secure photo upload');
      await assertNoUnsignedWidget(page);
      expect(await page.evaluate(() => window.__ttgUploadWidgets)).toHaveLength(0);
    });
  }

  test('never opens an unsigned uploader after signed signature preparation fails', async ({ page }) => {
    await configureFeatureScript(page);
    await page.route(`${AUTHORIZER_ENDPOINT}/authorize`, (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        session: {
          id: 'session-000000000000000000000001',
          token: 's'.repeat(43),
          expiresAt: Date.now() + 60_000,
          maxUploads: 5
        }
      })
    }));
    await page.route(`${AUTHORIZER_ENDPOINT}/prepare`, (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, cloudName: 'fishkeepinglifeco', uploadParams: {} })
    }));

    await page.goto('/submit-your-tank.html');
    await revealPhotoStep(page);
    await page.locator('#photoUploadTrigger').click();
    await expect.poll(() => page.evaluate(() => window.__ttgUploadWidgets.length)).toBe(1);

    await page.evaluate(async () => {
      window.__ttgPrepareCallbackCount = 0;
      const signedWidget = window.__ttgUploadWidgets[0];
      await signedWidget.options.prepareUploadParams(
        () => { window.__ttgPrepareCallbackCount += 1; },
        { timestamp: 1_700_000_000 }
      );
    });

    const widgets = await page.evaluate(() => window.__ttgUploadWidgets);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].options.uploadPreset).toBe('feature-your-tank-signed-v1');
    expect(await page.evaluate(() => window.__ttgPrepareCallbackCount)).toBe(0);
    await expect(page.locator('#errorMessage')).toContainText('Secure upload preparation failed.');
    await assertNoUnsignedWidget(page);
  });

  test('renders visitor-controlled review details as text, not HTML', async ({ page }) => {
    await configureFeatureScript(page, { signedUploadsEnabled: false });
    await page.goto('/submit-your-tank.html');
    await page.locator('#nextBtn').click();
    await page.locator('#name').fill('<img src=x onerror=alert(1)>');
    await page.locator('#email').fill('safe@example.invalid');
    await page.locator('#tank_name').fill('<b>Untrusted tank</b>');
    await page.locator('#tank_size').fill('29');
    await page.locator('input[name="environment"][value="planted"]').check();
    await page.locator('#newTankConfirm').check();
    await page.locator('#nextBtn').click();

    await page.locator('#photoUploadTrigger').click();
    await page.evaluate(() => {
      for (let index = 0; index < 3; index += 1) {
        window.__ttgUploadWidgetCallback(null, {
          event: 'success',
          info: {
            secure_url: `https://res.cloudinary.com/fishkeepinglifeco/image/upload/mock-${index}.jpg`,
            public_id: `mock-${index}`,
            width: 1200,
            height: 800
          }
        });
      }
    });
    await page.locator('#nextBtn').click();
    await page.locator('#licenseConfirm').check();
    await page.locator('#guidelinesConfirm').check();
    await page.locator('#contactConsent').check();
    await page.locator('#pricingConfirm').check();
    await page.locator('#nextBtn').click();

    await expect(page.locator('#reviewList')).toContainText('<img src=x onerror=alert(1)>');
    await expect(page.locator('#reviewList')).toContainText('<b>Untrusted tank</b>');
    expect(await page.locator('#reviewList img').count()).toBe(0);
    expect(await page.locator('#reviewList b').count()).toBe(0);
  });

  test('uses a fresh confirmation-only token after successful Formspree submission', async ({ page }) => {
    const formspreeRequests = [];
    const confirmationRequests = [];
    await configureFeatureScript(page);
    await page.route(`${AUTHORIZER_ENDPOINT}/authorize`, (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        session: {
          id: 'session-000000000000000000000001',
          token: 's'.repeat(43),
          expiresAt: Date.now() + 60_000,
          maxUploads: 5
        }
      })
    }));
    await page.route('https://formspree.io/f/xangqlww', async (route) => {
      formspreeRequests.push(route.request());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route('https://ttg-confirmation-email.fishkeepinglifeco.workers.dev/confirm', async (route) => {
      confirmationRequests.push(route.request());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/submit-your-tank.html');
    await page.locator('#nextBtn').click();
    await page.locator('#name').fill('Staging Tester');
    await page.locator('#email').fill('staging@example.invalid');
    await page.locator('#tank_name').fill('Mocked Staging Tank');
    await page.locator('#tank_size').fill('29');
    await page.locator('input[name="environment"][value="planted"]').check();
    await page.locator('#newTankConfirm').check();
    await page.locator('#nextBtn').click();

    await page.locator('#photoUploadTrigger').click();
    await expect.poll(() => page.evaluate(() => window.__ttgUploadWidgets.length)).toBe(1);
    await page.evaluate(() => {
      for (let index = 0; index < 3; index += 1) {
        window.__ttgUploadWidgetCallback(null, {
          event: 'success',
          info: {
            secure_url: `https://res.cloudinary.com/fishkeepinglifeco/image/upload/mock-${index}.jpg`,
            public_id: `mock-${index}`,
            width: 1200,
            height: 800
          }
        });
      }
    });
    await expect(page.locator('#selectedFiles')).toContainText('3 photos selected');
    await page.locator('#nextBtn').click();
    await page.locator('#licenseConfirm').check();
    await page.locator('#guidelinesConfirm').check();
    await page.locator('#contactConsent').check();
    await page.locator('#pricingConfirm').check();
    await page.locator('#nextBtn').click();
    await page.evaluate(() => {
      const token = document.createElement('input');
      token.name = 'cf-turnstile-response';
      token.value = 'formspree-turnstile-token';
      document.querySelector('#featureForm').append(token);
    });

    await page.locator('#nextBtn').dblclick();
    await expect(page.locator('.ft-step[data-step="6"]')).toBeVisible();

    expect(formspreeRequests).toHaveLength(1);
    expect(formspreeRequests[0].postData() || '').toContain('formspree-turnstile-token');
    expect(confirmationRequests).toHaveLength(1);
    expect(JSON.parse(confirmationRequests[0].postData())).toMatchObject({
      email: 'staging@example.invalid',
      turnstileToken: 'confirmation-turnstile-token'
    });
    expect(await page.evaluate(() => window.__ttgTurnstileRenders.map((options) => options.action))).toEqual([
      'ttg_upload_authorize',
      'ttg_confirmation'
    ]);
  });

});
