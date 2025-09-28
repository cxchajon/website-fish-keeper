# The Tank Guide — End-to-End UI Tests (Playwright)

## Prereqs
- Node.js 18+ recommended

## Install
- `npm install`
- `npx playwright install`

## Run the test suite
- `npm test` — headless run across Chromium, Firefox, and WebKit
- `npm run test:headed` — watch the browser interactions live
- `npm run test:debug` — open the Playwright Inspector for step-through debugging
- `npm run test:report` — open the HTML report generated in `./playwright-report`

## Targeting different environments
- Default base URL is https://thetankguide.com
- Override via environment variable, e.g. `TTG_BASE=http://localhost:5173 npm run test:headed`

## Implementation notes
- Footer social links load dynamically; the suite includes a short wait before asserting attributes.
- Session storage assertions only run after the "See Gear" flow triggers navigation.

## Troubleshooting selectors
Key selectors exercised by the suite:
- `#ttg-howitworks-opener`, `.ttg-howitworks-link`, `.ttg-overlay`
- `#ttg-nav-open`, `#ttg-drawer`
- `input[name="gallons"]`, `input[name="planted"]`, `button:has-text("See Gear")`
- `#consent_feature`, `#submit_feature`
- Footer anchors targeting Instagram, TikTok, YouTube, Facebook, Amazon

If elements change, update the selectors in `tests/e2e.spec.js` with similarly resilient fallbacks.

## Continuous integration
- A GitHub Actions workflow (`.github/workflows/playwright.yml`) can be added to run `npm install`, `npx playwright install`, and `npm test` on pull requests. Follow the conventions in this README if you decide to enable it later.
