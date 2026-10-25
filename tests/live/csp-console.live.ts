// Read-only check against production (run by playwright.live.config.ts from the Security Headers
// Verify workflow). Opens key pages and records every Content-Security-Policy violation the browser
// reports, plus whether the consent, tag-manager and ads scripts loaded. It never fills or submits a
// form. Ad and click-tracking requests are aborted so the run serves no ads; CSP is enforced before
// a request reaches the network, so violations are still reported.
import { test, expect } from '@playwright/test';

const PAGES = ['/', '/media.html', '/submit-your-tank.html', '/stocking-advisor.html', '/university/'];
const AD_SERVING = /\/pagead\/(ads|adview|conversion|interaction)|doubleclick\.net|googleadservices\.com|\/pagead\/viewthroughconversion/;
const SCRIPTS = {
  fundingChoices: /fundingchoicesmessages\.google\.com/,
  gtm: /googletagmanager\.com\/gtm\.js/,
  adsense: /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/,
};

for (const path of PAGES) {
  test(`no CSP violations on ${path}`, async ({ page }) => {
    const violations: string[] = [];
    const loaded = new Set<string>();

    await page.route(AD_SERVING, (route) => route.abort());
    page.on('console', (msg) => {
      const text = msg.text();
      if (/Content[- ]Security[- ]Policy|Refused to (load|execute|connect|frame)/i.test(text)) violations.push(text);
    });
    page.on('response', (res) => {
      for (const [name, re] of Object.entries(SCRIPTS)) if (re.test(res.url()) && res.ok()) loaded.add(name);
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        console.warn(`Content-Security-Policy violation: ${e.violatedDirective} blocked ${e.blockedURI}`);
      });
    });

    const res = await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(5000);

    const csp = res?.headers()['content-security-policy'] ?? '(none)';
    test.info().annotations.push(
      { type: 'csp', description: csp },
      { type: 'scripts-loaded', description: [...loaded].sort().join(', ') || '(none)' },
      { type: 'violations', description: violations.join(' | ') || '(none)' },
    );
    console.log(`[${path}] status=${res?.status()} scripts=${[...loaded].sort().join(',') || '-'}`);
    console.log(`[${path}] csp=${csp}`);
    for (const v of violations) console.log(`[${path}] VIOLATION ${v}`);

    expect(res?.ok()).toBe(true);
    expect(violations).toEqual([]);
  });
}
