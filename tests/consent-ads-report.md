# Consent & AdSense Audit Report

_This file is a placeholder. `tests/consent-ads.spec.ts` writes its report to Playwright's output directory (`test-results/consent-ads-report.md` by default), never to this tracked file._

The report is produced by the EU flows, which need Google's EEA/UK consent message (see the spec):

`TTG_BASE_URL=https://thetankguide.com npm run test:consent:eu`

The US flows (`npm run test:consent:us`) run in the PR suite and produce no report.
