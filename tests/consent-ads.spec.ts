import { test, expect, Page, Locator, Request, ConsoleMessage, TestInfo } from '@playwright/test';
import fs from 'fs';
import path from 'path';

interface FlowResult {
  bannerShown: boolean;
  choice: string;
  dataFlag: string | null;
  adsVisible: boolean;
  npa: boolean | null;
  placeholderVisible: boolean;
  consoleErrors: string[];
  notes: string[];
}

interface FlowConfig {
  id: string;
  label: string;
  region: 'eu';
  action: 'accept' | 'reject' | 'ignore';
  languages: string[];
  timezoneId: string;
  querySuffix: string;
}

const PAGES = [
  '/index.html',
  '/stocking-advisor.html',
  '/cycling-coach/',
  '/media.html',
  '/gear/',
  '/blogs/',
  '/community-tanks.html',
  '/submit-your-tank.html',
  '/tools/snail-stock-recommender.html',
  '/contact-feedback.html',
];

const FLOWS: FlowConfig[] = [
  {
    id: 'eu-accept',
    label: 'EU – ACCEPT',
    region: 'eu',
    action: 'accept',
    languages: ['en-GB'],
    timezoneId: 'Europe/Dublin',
    querySuffix: '?e2e=true',
  },
  {
    id: 'eu-reject',
    label: 'EU – REJECT',
    region: 'eu',
    action: 'reject',
    languages: ['en-GB'],
    timezoneId: 'Europe/Dublin',
    querySuffix: '?e2e=true',
  },
  {
    id: 'eu-ignore',
    label: 'EU – IGNORE',
    region: 'eu',
    action: 'ignore',
    languages: ['en-GB'],
    timezoneId: 'Europe/Dublin',
    querySuffix: '?e2e=true',
  },
];

const results = new Map<string, Map<string, FlowResult>>();
const pagesMissingStylesheet = new Set<string>();
// Runtime evidence goes to Playwright's disposable output directory, never into tracked files.
const reportFileName = 'consent-ads-report.md';

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function sanitizeSegment(segment: string) {
  return segment.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

async function captureState(page: Page, flowId: string, pagePath: string, state: string, testInfo: TestInfo) {
  const pageSlug = sanitizeSegment(pagePath || 'root');
  const filename = `${pageSlug}-${sanitizeSegment(state)}.png`;
  const screenshotPath = testInfo.outputPath(flowId, filename);
  await ensureDir(path.dirname(screenshotPath));
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(`${flowId}-${pageSlug}-${state}`, {
    path: screenshotPath,
    contentType: 'image/png',
  });
}

function recordResult(flowId: string, pagePath: string, data: FlowResult) {
  if (!results.has(flowId)) {
    results.set(flowId, new Map());
  }
  results.get(flowId)!.set(pagePath, data);
}

function isAdRequest(url: string) {
  return /googleads|pagead2\.googlesyndication\.com|gampad\/ads/i.test(url);
}

async function checkPlaceholderVisibility(page: Page) {
  const handles = await page.locator('.ttg-gad').elementHandles();
  let visible = false;
  for (const handle of handles) {
    const box = await handle.boundingBox();
    if (box && box.height > 0 && box.width > 0) {
      visible = true;
      break;
    }
  }
  return visible;
}

async function checkAdsVisible(page: Page) {
  const visibility = await page.evaluate(() => {
    const slots = Array.from(document.querySelectorAll('ins.adsbygoogle')) as HTMLElement[];
    return slots.some((slot) => {
      const rect = slot.getBoundingClientRect();
      return rect.height > 0 && rect.width > 0 && window.getComputedStyle(slot).display !== 'none';
    });
  });
  return visibility;
}

async function waitForAdsLibrary(page: Page) {
  const scriptLocator = page.locator('script[src*="adsbygoogle"]');
  await expect.soft(scriptLocator, 'AdSense loader script should be present').not.toHaveCount(0);
  await expect
    .poll(async () => page.evaluate(() => (window as any).adsbygoogle ? true : false), {
      message: 'window.adsbygoogle should be defined',
    })
    .toBeTruthy();
}

async function waitForDOMContentLoaded(page: Page) {
  if (page.isClosed()) return;
  const readyState = await page.evaluate(() => document.readyState);
  if (readyState === 'loading') {
    await page.waitForLoadState('domcontentloaded');
  }
}

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const { documentElement } = document;
    return documentElement.scrollWidth > documentElement.clientWidth + 4;
  });
  await expect.soft(overflow, 'Page should not overflow horizontally').toBeFalsy();
}

async function checkNoOverlap(page: Page) {
  const overlap = await page.evaluate(() => {
    const units = Array.from(document.querySelectorAll('.ttg-gad')) as HTMLElement[];
    return units.some((unit) => {
      const rect = unit.getBoundingClientRect();
      return rect.left < 0 || rect.right > window.innerWidth || rect.top < 0;
    });
  });
  await expect.soft(overlap, 'Ad units should remain within viewport bounds').toBeFalsy();
}

async function focusTrapActive(page: Page, banner: Locator) {
  const focusableCount = await banner.evaluate((root) => {
    const selectors = ['button', 'a[href]', 'input', 'select', 'textarea', '[tabindex]'];
    return Array.from(root.querySelectorAll<HTMLElement>(selectors.join(','))).filter((el) =>
      !el.hasAttribute('disabled') &&
      el.tabIndex >= 0 &&
      window.getComputedStyle(el).display !== 'none' &&
      window.getComputedStyle(el).visibility !== 'hidden'
    ).length;
  });

  if (!focusableCount) {
    return false;
  }

  await page.locator('body').click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < Math.min(focusableCount + 2, 10); i += 1) {
    await page.keyboard.press('Tab');
    const within = await banner.evaluate((root) => root.contains(document.activeElement));
    if (!within) {
      return false;
    }
  }
  return true;
}

async function locateConsentBanner(page: Page): Promise<{ locator: Locator; found: boolean }> {
  const candidates = [
    '[data-consent="gdpr"]',
    '[id*="consent"]',
    '[class*="consent"]',
    '[aria-label*="consent"]',
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      return { locator, found: true };
    }
  }

  return { locator: page.locator('body'), found: false };
}

async function locateButton(container: Locator, pattern: RegExp) {
  const button = container.getByRole('button', { name: pattern }).first();
  if ((await button.count()) > 0) {
    return button;
  }
  const link = container.getByRole('link', { name: pattern }).first();
  if ((await link.count()) > 0) {
    return link;
  }
  const fallbackButton = container.locator('button').filter({ hasText: pattern }).first();
  if ((await fallbackButton.count()) > 0) {
    return fallbackButton;
  }
  return container.locator('*').filter({ hasText: pattern }).first();
}

async function getConsentDataset(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement as HTMLElement & { dataset: Record<string, string> };
    const bodyDataset = (document.body as HTMLElement & { dataset: Record<string, string> }).dataset || {};
    const htmlDataset = doc.dataset || {};
    return htmlDataset.adConsent || bodyDataset.adConsent || null;
  });
}

async function snapshotLocalStorage(page: Page) {
  return page.evaluate(() => {
    const store: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) {
        store[key] = window.localStorage.getItem(key) ?? '';
      }
    }
    return store;
  });
}

async function verifyStylesheet(page: Page, pagePath: string) {
  const hasSheet = await page.locator('link[href*="css/site.css"]').count();
  if (!hasSheet) {
    pagesMissingStylesheet.add(pagePath);
  }
}

function formatNotes(notes: string[]) {
  if (!notes.length) return '—';
  return notes.join('; ');
}

async function runViewportChecks(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await assertNoOverflow(page);
  await checkNoOverlap(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow(page);
  await checkNoOverlap(page);
  await page.setViewportSize({ width: 1440, height: 900 });
}

// US and EU flows are separate groups, so a failure in one region never skips the other.
//
// EU: Google's CMP (Funding Choices) serves its consent message only on the registered domain to
// visitors in the EEA, UK or Switzerland, so these flows cannot pass on a local server or a US CI
// runner. They run on their own (npm run test:consent:eu) against the live site from such a
// location, e.g. TTG_BASE_URL=https://thetankguide.com.
//
// US: Google shows no consent banner; the site's own Cookie Settings page records the visitor's
// choice. Those flows are deterministic and run in the PR suite (npm run test:consent:us).
const US_CONTEXT = { locale: 'en-US', timezoneId: 'America/New_York', viewport: { width: 1440, height: 900 } };
const EEA_UK_CH_REGIONS = ['DE', 'FR', 'IE', 'GB', 'CH', 'NO'];

async function blockThirdParty(page: Page) {
  // Ads, the CMP and analytics are Google's, not under test here; answer them with empty bodies.
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
    (route) => route.fulfill({ status: 204, body: '' }),
  );
}

async function readConsentState(page: Page) {
  return page.evaluate(() => {
    let stored: Record<string, unknown> | null = null;
    try {
      stored = JSON.parse(localStorage.getItem('ttgConsentV2') || 'null');
    } catch {
      stored = null;
    }
    return {
      adConsent: document.documentElement.getAttribute('data-ad-consent'),
      adsDisabled: document.body.classList.contains('is-ads-disabled'),
      stored,
    };
  });
}

// What js/google-ads.js did with the page's manual units: how many it requested and how many are shown.
async function readGoogleUnits(page: Page) {
  return page.evaluate(() => {
    const units = Array.from(document.querySelectorAll('.ttg-gad')) as HTMLElement[];
    return {
      total: units.length,
      requested: document.querySelectorAll('.ttg-gad ins.adsbygoogle[data-ttg-gad="requested"]').length,
      pushes: ((window as any).adsbygoogle || []).length,
      visible: units.filter((unit) => window.getComputedStyle(unit).display !== 'none').length,
    };
  });
}

async function expectConsentAcrossPages(page: Page, adConsent: 'granted' | 'denied') {
  let unitsSeen = 0;
  for (const pagePath of PAGES) {
    await page.goto(pagePath, { waitUntil: 'load' });
    await expect
      .poll(() => readConsentState(page), { message: `${pagePath} keeps the saved choice` })
      .toMatchObject({ adConsent, adsDisabled: adConsent === 'denied' });

    const units = await readGoogleUnits(page);
    unitsSeen += units.total;
    if (adConsent === 'denied') {
      // An opted-out visitor triggers no Google ad request, and the containers stay hidden.
      expect(units, `${pagePath}: no ad requests after opting out`).toMatchObject({ requested: 0, pushes: 0, visible: 0 });
    } else if (units.total) {
      expect(units.requested, `${pagePath}: rendered units are requested`).toBeGreaterThan(0);
      expect(units.pushes, `${pagePath}: one push per requested unit`).toBe(units.requested);
    }
  }
  expect(unitsSeen, 'the audited pages carry manual units').toBeGreaterThan(0);
}

test.describe('Consent and AdSense behavior audit — US', { tag: '@consent-us' }, () => {
  test('US – ACCEPT', async ({ browser }) => {
    const context = await browser.newContext(US_CONTEXT);
    const page = await context.newPage();
    await blockThirdParty(page);

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    // Consent Mode v2 defaults are the first dataLayer entries, ahead of Google Tag Manager:
    // granted by default, denied (with wait_for_update) for the EEA, UK and Switzerland.
    const dataLayer = await page.evaluate(() =>
      ((window as any).dataLayer || []).map((entry: any) => Array.from(entry.length !== undefined ? entry : [entry])),
    );
    const defaults = dataLayer.filter((entry: any[]) => entry[0] === 'consent' && entry[1] === 'default');
    expect(defaults).toHaveLength(2);
    expect(defaults[0][2]).toMatchObject({ ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
    expect(defaults[0][2].region).toBeUndefined();
    expect(defaults[1][2]).toMatchObject({ ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 });
    expect(defaults[1][2].region).toEqual(expect.arrayContaining(EEA_UK_CH_REGIONS));
    const gtmIndex = dataLayer.findIndex((entry: any[]) => entry[0] && entry[0].event === 'gtm.js');
    expect(gtmIndex).toBeGreaterThan(dataLayer.indexOf(defaults[1]));

    // No first-party choice is saved yet, so ads are not suppressed.
    await expect.poll(() => readConsentState(page)).toMatchObject({ adConsent: 'unset', adsDisabled: false, stored: null });

    await page.goto('/cookie-settings.html', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Allow all' }).click();
    await expect.poll(() => readConsentState(page)).toMatchObject({
      adConsent: 'granted',
      stored: { ad_storage: 'granted', advertising: true },
    });

    await expectConsentAcrossPages(page, 'granted');
    await context.close();
  });

  test('US – OPT OUT', async ({ browser }) => {
    const context = await browser.newContext(US_CONTEXT);
    const page = await context.newPage();
    await blockThirdParty(page);

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const optOutLink = page.locator('footer').getByRole('link', { name: 'Do Not Sell or Share My Personal Information' });
    await optOutLink.click();
    await expect(page).toHaveURL(/\/cookie-settings\.html#do-not-sell$/);
    await expect(page.getByRole('heading', { name: 'Do Not Sell or Share My Personal Information' })).toBeVisible();

    await page.getByRole('button', { name: 'Reject non-essential' }).click();
    await expect.poll(() => readConsentState(page)).toMatchObject({
      adConsent: 'denied',
      adsDisabled: true,
      stored: { ad_storage: 'denied', advertising: false },
    });

    await expectConsentAcrossPages(page, 'denied');
    await context.close();
  });
});

test.describe('Consent and AdSense behavior audit — EU', { tag: '@consent-eu' }, () => {
  test.describe.configure({ mode: 'serial', retries: 0 });

  for (const flow of FLOWS) {
    test(flow.label, async ({ browser }, testInfo) => {
      test.setTimeout(45_000);
      const context = await browser.newContext({
        locale: flow.languages[0],
        timezoneId: flow.timezoneId,
        viewport: { width: 1440, height: 900 },
      });

      await context.addInitScript((langs: string[]) => {
        Object.defineProperty(navigator, 'languages', {
          get: () => langs,
        });
        window.localStorage.clear();
        window.sessionStorage.clear();
      }, flow.languages);

      const page = await context.newPage();

      const primaryPage = PAGES[0];
      for (const pagePath of PAGES) {
        const currentRequests: string[] = [];
        const consoleErrors: string[] = [];
        const notes: string[] = [];

        const requestListener = (request: Request) => {
          const url = request.url();
          if (isAdRequest(url)) {
            currentRequests.push(url);
          }
        };
        const consoleListener = (msg: ConsoleMessage) => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        };

        page.on('request', requestListener);
        page.on('console', consoleListener);

        const targetUrl = `${pagePath}${flow.querySuffix}`;
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await waitForDOMContentLoaded(page);
        await runViewportChecks(page);
        if (pagePath === '/index.html') {
          // The homepage is intentionally ad-free: the CMP and Consent Mode run there, AdSense does not.
          await expect(page.locator('script[src*="adsbygoogle"]')).toHaveCount(0);
        } else {
          await waitForAdsLibrary(page);
        }
        await verifyStylesheet(page, pagePath);
        await captureState(page, flow.id, pagePath, 'loaded', testInfo);

        const bannerLookup = await locateConsentBanner(page);
        const banner = bannerLookup.locator;
        const bannerVisible = bannerLookup.found ? await banner.isVisible() : false;
        expect.soft(bannerVisible, 'Consent banner should be visible on first load').toBeTruthy();
        if (!bannerLookup.found) {
          notes.push('Consent banner selector not found');
        }

        let choice = 'none';
        let expectedConsent: 'granted' | 'denied' | null = null;

        if (pagePath === primaryPage) {
          if (flow.action === 'accept') {
            const acceptButton = await locateButton(banner, /accept|agree|allow/i);
            const acceptButtonCount = await acceptButton.count();
            expect.soft(acceptButtonCount, 'Accept button should exist').toBeGreaterThan(0);
            if (bannerLookup.found) {
              await acceptButton.focus();
            }
            await captureState(page, flow.id, pagePath, 'before-accept', testInfo);
            await acceptButton.click();
            await captureState(page, flow.id, pagePath, 'after-accept', testInfo);
            const bannerAfterAccept = bannerLookup.found ? await banner.isVisible() : false;
            expect.soft(bannerAfterAccept, 'Banner should close after accepting').toBeFalsy();
            expectedConsent = 'granted';
            choice = 'Accept';
          } else if (flow.action === 'reject') {
            const rejectButton = await locateButton(banner, /reject|decline|disagree|opt\s*out|manage/i);
            const rejectButtonCount = await rejectButton.count();
            expect.soft(rejectButtonCount, 'Reject/Manage button should exist').toBeGreaterThan(0);
            if (bannerLookup.found) {
              await rejectButton.focus();
            }
            await captureState(page, flow.id, pagePath, 'before-reject', testInfo);
            await rejectButton.click();

            const secondaryReject = await locateButton(page.locator('body'), /reject all|confirm choices|save choices|deny/i);
            const secondaryCount = await secondaryReject.count();
            if (secondaryCount > 0 && (await secondaryReject.isVisible())) {
              await secondaryReject.focus();
              await captureState(page, flow.id, pagePath, 'reject-choices', testInfo);
              await secondaryReject.click();
            }
            await captureState(page, flow.id, pagePath, 'after-reject', testInfo);
            const bannerAfterReject = bannerLookup.found ? await banner.isVisible() : false;
            expect.soft(bannerAfterReject, 'Banner should close after rejecting').toBeFalsy();
            expectedConsent = 'denied';
            choice = 'Reject';
          } else if (flow.action === 'ignore') {
            choice = 'Ignore';
            await page.waitForTimeout(3000);
            await captureState(page, flow.id, pagePath, 'after-ignore-wait', testInfo);
            if (bannerLookup.found) {
              const trap = await focusTrapActive(page, banner);
              if (!trap) {
                notes.push('Banner may not retain keyboard focus');
              }
            } else {
              notes.push('Unable to test focus trap without banner');
            }
            expectedConsent = null;
          }
        } else {
          // Persistence checks on subsequent pages
          if (flow.action === 'ignore') {
            const bannerStillVisible = bannerLookup.found ? await banner.isVisible() : false;
            expect.soft(bannerStillVisible, 'Banner should remain visible when ignored').toBeTruthy();
          } else {
            const bannerStillVisible = bannerLookup.found ? await banner.isVisible() : false;
            expect.soft(bannerStillVisible, 'Banner should stay dismissed on new pages').toBeFalsy();
          }
          await captureState(page, flow.id, pagePath, 'persistence', testInfo);
        }

        const datasetValue = await getConsentDataset(page);
        const storageSnapshot = await snapshotLocalStorage(page);
        const placeholdersVisible = await checkPlaceholderVisibility(page);
        const adsVisible = await checkAdsVisible(page);

        const storageKeys = Object.keys(storageSnapshot);

        if (expectedConsent) {
          expect.soft(datasetValue, 'Consent dataset should match expected state').toBe(expectedConsent);
          expect.soft(storageKeys.length, 'LocalStorage should record consent state').toBeGreaterThan(0);
        }

        if (pagePath === '/index.html') {
          expect.soft(adsVisible, 'The homepage never renders ads').toBeFalsy();
        } else if (flow.action === 'accept') {
          expect.soft(adsVisible, 'Ads should render after acceptance').toBeTruthy();
        }

        if (flow.action === 'reject') {
          expect.soft(placeholdersVisible, 'Ad placeholders must remain visible after rejection').toBeTruthy();
        }

        if (flow.action === 'ignore') {
          expect.soft(adsVisible, 'Ads should not load without consent').toBeFalsy();
          expect.soft(storageKeys.length, 'LocalStorage should remain empty without consent').toBe(0);
        }

        const npa = currentRequests.length
          ? currentRequests.some((url) => {
              try {
                const parsed = new URL(url);
                return parsed.searchParams.get('npa') === '1';
              } catch (error) {
                return false;
              }
            })
          : null;

        if ((flow.action === 'reject') && currentRequests.length) {
          expect.soft(npa, 'NPA flag should be present for rejected consent').toBe(true);
        }

        if ((flow.action === 'accept') && currentRequests.length) {
          expect.soft(npa, 'Personalized requests should omit npa=1').not.toBe(true);
        }

        if (flow.action === 'ignore') {
          expect.soft(currentRequests.length, 'No ad requests should fire without consent').toBe(0);
        }

        if (!placeholdersVisible) {
          notes.push('Ad placeholders not visible');
        }

        if (consoleErrors.length) {
          notes.push('Console errors detected');
        }

        const result: FlowResult = {
          bannerShown: bannerVisible,
          choice,
          dataFlag: datasetValue,
          adsVisible,
          npa,
          placeholderVisible: placeholdersVisible,
          consoleErrors,
          notes,
        };

        recordResult(flow.id, pagePath, result);

        page.off('request', requestListener);
        page.off('console', consoleListener);
      }

      await context.close();
    });
  }

  test.afterAll(async ({}, workerInfo) => {
    const reportPath = path.join(workerInfo.project.outputDir, reportFileName);
    const lines: string[] = [];
    lines.push('# Consent & AdSense Audit Report');
    lines.push('');
    lines.push('This report is generated by `tests/consent-ads.spec.ts`.');
    lines.push('');
    for (const flow of FLOWS) {
      lines.push(`## ${flow.label}`);
      lines.push('');
      lines.push('| Page | BannerShown | Choice | DataFlag | AdsVisible | NPA | PlaceholderVisible | ConsoleErrors | Notes |');
      lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
      const flowResults = results.get(flow.id) || new Map();
      for (const pagePath of PAGES) {
        const entry = flowResults.get(pagePath);
        if (!entry) {
          lines.push(`| ${pagePath} | — | — | — | — | — | — | — | — |`);
          continue;
        }
        const errorSummary = entry.consoleErrors.length ? entry.consoleErrors.join('<br>') : 'None';
        const npaValue = entry.npa === null ? '—' : entry.npa ? 'Yes' : 'No';
        lines.push(
          `| ${pagePath} | ${entry.bannerShown ? 'Yes' : 'No'} | ${entry.choice || '—'} | ${entry.dataFlag ?? '—'} | ${
            entry.adsVisible ? 'Yes' : 'No'
          } | ${npaValue} | ${entry.placeholderVisible ? 'Yes' : 'No'} | ${errorSummary} | ${formatNotes(entry.notes)} |`,
        );
      }
      lines.push('');
    }

    lines.push('## Pages missing css/site.css');
    lines.push('');
    if (pagesMissingStylesheet.size) {
      for (const pagePath of Array.from(pagesMissingStylesheet)) {
        lines.push(`- ${pagePath}`);
      }
    } else {
      lines.push('- None');
    }

    const rejectNotes: string[] = [];
    for (const flow of ['eu-reject']) {
      const flowResults = results.get(flow) || new Map();
      for (const pagePath of flowResults.keys()) {
        const entry = flowResults.get(pagePath);
        if (entry && !entry.placeholderVisible) {
          rejectNotes.push(`${flow} :: ${pagePath}`);
        }
      }
    }

    lines.push('');
    lines.push('## Pages where placeholders disappeared after reject');
    lines.push('');
    if (rejectNotes.length) {
      for (const note of rejectNotes) {
        lines.push(`- ${note}`);
      }
    } else {
      lines.push('- None observed');
    }

    await ensureDir(path.dirname(reportPath));
    await fs.promises.writeFile(reportPath, lines.join('\n'), 'utf8');
  });
});
