# Post-audit remediation and AdSense readiness

Date: 2026-10-25. Follows the October 2026 post-hardening audit ("ready with limited follow-up work"; no P0/P1).

Live checks ran from GitHub-hosted runners. The agent sandbox's network policy denies thetankguide.com and the Cloudinary API, and the Cloudflare account was not connected, so nothing below comes from a Cloudflare or Cloudinary dashboard. No form was submitted, no email was sent, no image was uploaded or deleted, and no preset or Cloudflare rule was changed.

## Corrected

| Problem | Fix | Where |
|---|---|---|
| Site Validation, Cross-Browser and Stocking Advisor live verify failed before any test ran: `ubuntu-latest` became Ubuntu 26.04 and Playwright 1.57 refuses it (`Playwright does not support chromium on ubuntu26.04-x64`). This is why the Site Validation check on #2264 was red. | Pinned the Playwright workflows to `ubuntu-24.04` (no Playwright upgrade needed). | PR #2265 |
| Workflows ran with implicit token permissions. | `permissions: contents: read` on every workflow. | PR #2265 |
| Cache Verify failed nightly: it pushed reports straight to `main`, which the read-only token refuses. Security Headers Verify did the same but hid the failure. | Both now publish to the job summary and an artifact only. | PR #2265 |
| Site Validation's job id `guard` was shared with footer-lock, so it could not be a required check. | Job named `Site Validation`. | PR #2265 |
| Security Headers Verify checked only the home page. | Checks 5 pages, the HTTP/www redirects, and a read-only Chromium probe for violations of the site's own CSP. | PR #2265 |
| `main` had no required status check, so #2264 merged with Site Validation red. | **Owner action pending.** The check is ready to require (see Merge protection); the agent's API proxy refuses ruleset writes. | Ruleset 9018467 |
| A valid confirmation Turnstile token could send any recipient an email carrying attacker-written name/tank text. | Sanitized echo, per-recipient and daily caps, durable dedup (see Confirmation email). | PR (confirmation email) |

## CI and cross-browser results (ubuntu-24.04)

- Site Validation (Chromium, 4 workers): 176 passed, 5 skipped; unit suite passed.
- Cross-Browser Tests: Firefox 176 passed, 5 skipped; WebKit 176 passed, 5 skipped (run 40147858599).
- Security Headers Verify (new probe): passed; 0 violations of the site's CSP on the 5 pages.
- PR #2265 squash-merged as `0ff0d9f`.
- Stocking Advisor Live Verify: passed. Cache Verify: passed. Ads.txt audit and footer-lock: passed.
- Local run before the change (Chromium): 316 unit tests and 176 browser tests passed, 5 skipped.

## Merge protection

Ruleset "Main Branch Protection – The Tank Guide" (id 9018467, active on the default branch) before this work: no deletion, no force-push, pull request required (0 approvals), linear history. **No required status checks** — the reason #2264 could merge red.

**Owner action (2 minutes):** the agent could read the ruleset but not write it (the session's GitHub proxy refuses writes to the rulesets API). In GitHub → Settings → Rules → Rulesets → "Main Branch Protection – The Tank Guide":

1. Tick **Require status checks to pass**.
2. Leave **Require branches to be up to date before merging** unticked.
3. **Add checks** → type `Site Validation` → choose the one from **GitHub Actions** (the job name since PR #2265; do not pick `guard`, which footer-lock also uses).
4. Leave the bypass list and every other rule unchanged, then **Save changes**.

Equivalent API body: add this to the existing `rules` array with `PUT /repos/cxchajon/website-fish-keeper/rulesets/9018467`:
`{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":false,"do_not_enforce_on_create":false,"required_status_checks":[{"context":"Site Validation","integration_id":15368}]}}`

No approval requirement should be added; single-maintainer merges keep working.

Emergency recovery (once the check is required): repository admins have "always" bypass. A red check blocks the normal merge button; an admin can still tick "Merge without waiting for requirements to be met (bypass rules)" for a deliberate emergency merge. Integration id 1144995 also has "always" bypass and could not be identified from this session. If it is the Claude GitHub App, merges it performs through the API are not held by the required check. The owner should decide whether it keeps that bypass (Settings → Rules → Rulesets → the main ruleset → Bypass list).

## Cloudflare headers (live, 2026-10-25, from GitHub runners)

| Check | Result |
|---|---|
| HTTP → HTTPS | 301 for apex and www |
| Canonical host | `https://www` → 301 → `https://thetankguide.com` (path kept); `http://www` → `https://www` → apex |
| HSTS | `max-age=63072000; includeSubDomains; preload` on all 5 pages |
| CSP | `object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https://formspree.io; upgrade-insecure-requests`, identical on all 5 pages |
| X-Content-Type-Options | `nosniff` |
| Frame protection | `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `geolocation=(), camera=(), microphone=()` |
| Consistency | Identical across `/`, `/media.html`, `/submit-your-tank.html`, `/stocking-advisor.html`, `/university/` |

Media Page CSP Override: **not in effect.** `/media.html` serves the same CSP as every other page, and Chromium reported no violation of the site's policy on it while AdSense, Funding Choices and GTM all loaded. No Cloudflare change was needed or made. Whether a disabled rule still exists in the dashboard was NOT VERIFIED (no Cloudflare access).

The probe saw CSP messages on `/submit-your-tank.html` from the Cloudflare Turnstile iframe's own policy (it blocks an internal `data:` fetch). They do not come from this site's headers and do not affect the form.

## Confirmation email

See `cloudflare-workers/ttg-confirmation-email/DEPLOYMENT.md` → "Abuse limits". Summary:

- Name and tank name are echoed only when they read like a name. Links, domains, email addresses, phone numbers, HTML, invisible/bidi characters and phishing words cause a fallback to fixed wording. HTML is never accepted, and every echoed value is escaped.
- A SQLite Durable Object keeps HMAC hashes only, deleted after 24 h. Limits: 1 email per recipient+tank, 3 per recipient, 50 site-wide (configurable) per rolling 24 h. Repeats report success without sending. Resend also gets an `Idempotency-Key`.
- Turnstile hostname/action checks, the per-IP rate limit, sender and reply-to are unchanged; missing configuration fails closed.
- Residual risk: a person who solves Turnstile on the real site can still send one fixed-wording confirmation to an address of their choice, at most 3 per address per day. Binding confirmations to a verified Formspree submission needs a backend redesign.
- Tests: 35 Node unit tests (malicious text, repeats, caps, failures, legitimate confirmations) and 7 Workers-runtime ledger tests (concurrency, caps, release, 24 h expiry).
- **Not deployed.** The owner must set `CONFIRM_DEDUP_KEY` first; then follow DEPLOYMENT.md.

## Cloudinary signed preset `feature-your-tank-signed-v1`

The earlier forensic test stands: a synthetic EXIF/GPS JPEG uploaded through the signed path had its metadata removed from the stored original. That evidence covers that tested asset.

The **current** preset configuration was NOT VERIFIED in this session. No Admin API credentials are available to the agent, and the Cloudinary API host is denied by the sandbox network policy. Each item below still needs a dashboard or Admin API read-back by the owner:

1. Signing mode Signed — NOT VERIFIED
2. Allowed formats jpg, jpeg, png, webp — NOT VERIFIED
3. Incoming transformation size limit (`c_limit,w_4000,h_4000`) — NOT VERIFIED
4. `fl_force_strip` — NOT VERIFIED
5. Overwrite disabled — NOT VERIFIED on the preset. The Worker signs `overwrite=false` per upload, which Cloudinary enforces regardless.
6. Public IDs — the Worker signs a server-generated `public_id`, which the client cannot change without breaking the signature (verified in code and tests).
7. Asset folder — set by the preset (Dynamic Folders) — NOT VERIFIED
8. Video/raw bypass — NOT VERIFIED. `resource_type` is part of the upload URL, not the signature, so a client holding a valid signature could aim it at `/video/upload` or `/raw/upload`. The preset's allowed formats should reject non-image formats, but a raw upload of a `.jpg` would skip incoming transformations, including the strip. Confirm in staging or with a non-destructive Admin API listing of `raw` and `video` resources in the feature folder.

Still open: IPTC/XMP stripping and oversized-image behaviour.

## AdSense technical readiness

Confirmed on the live site (GitHub runner, US region): Consent Mode v2 defaults are first in `<head>`, and Funding Choices, GTM and AdSense scripts load on `/`, `/media.html`, `/submit-your-tank.html`, `/stocking-advisor.html` and `/university/` with no CSP violations of the site's policy. `ads.txt` is served with the expected publisher line (Ads.txt Delivery Audit green). `robots.txt` allows all and points to the sitemap. All 90 sitemap URLs map to existing pages. Every sitemap page has a viewport tag, a Consent Mode default and the Funding Choices tag, and the pages checked link to Privacy and Terms. Navigation, footer, media, university and stocking-advisor tests pass in Chromium and Firefox.

Not verified: the EU consent dialog in a real EU session (the `@consent-eu` tests are excluded from CI), and Google's own mobile-usability report. Security readiness does not guarantee AdSense approval.

## Lower-priority findings (triage)

| Finding | Assessment | Recommendation |
|---|---|---|
| Dormant `feature-tank-api` Worker (`workers/`) | LOW. Never deployed per its config (`database_id = "TBD"`), and excluded from the published site. Keeping it means stale Stripe/admin code that could be deployed by mistake. | Delete the directory in a dedicated PR after the owner confirms it is abandoned. |
| Public project folders | LOW. The repo is public, so nothing is newly exposed. `research/`, `hardening/`, `docs/`, `dist/`, `src/`, `cloudflare-workers/` and `stocking-tests-extended/` are still published by Pages (underscore folders are not). No page references them. `tools/` is live (`/tools/snail-stock-recommender.html` is linked). | Add the unreferenced folders, not `tools/`, to `_config.yml` `exclude` in a dedicated PR. |
| Dev-only dependency advisories | LOW. `npm audit --omit=dev`: 0. The 10 advisories (7 high) are in stylelint/Playwright tooling and never ship to visitors. | Run `npm audit fix` in a routine dependency PR and keep Site Validation green. |
| Contact form spam | LOW. Formspree with a custom honeypot `hp_website`. Formspree only filters its own `_gotcha` field natively. | Rename the honeypot to `_gotcha` or enable Formspree's spam filtering. |
| Cloudinary abandoned uploads | LOW. Signed uploads are tagged `ttg-pending`/`ttg-batch-*`. Uploads from abandoned submissions stay. | Monthly review or Admin API cleanup of old `ttg-pending` assets (owner-approved, never automatic deletion). |
| Durable Object cleanup (upload sessions) | LOW. One `UploadSession` object per upload session, never deleted; it holds only hashes and counters. | Add an alarm that calls `deleteAll()` after session expiry. |
| Workflow permissions | Fixed in PR #2265. | — |
| Public Stocking Advisor resources | INFORMATIONAL. Species data and modules are meant to be public; live verify passed. | None. |
| `actions/*@v4` on Node 20 (runner warning) | INFORMATIONAL. GitHub forces Node 24. | Bump to v5 in a routine PR. |

## October 29 Cloudinary observation

No scheduled task for this observation exists among the claude.ai scheduled tasks visible to this session; it may be a Cowork desktop task, which this session cannot list. The window is documented in the 2026-10-23 closeout and the upload-authorizer README. Production uses signed uploads (`signedUploadsEnabled: true`). The legacy unsigned preset `feature-your-tank` was not touched and is still named in the public script.

Retirement checklist (after 2026-10-29, with separate owner approval):

- [ ] Cloudinary: no assets created through the unsigned `feature-your-tank` preset since signed activation (filter by upload preset/folder, read-only).
- [ ] Every Feature Your Tank submission since activation has signed-upload photo URLs (Formspree inbox).
- [ ] No upload-authorizer errors or 5xx spikes in Worker logs; no confirmation-email failures reported by visitors.
- [ ] Current signed-preset settings read back (items 1–8 above), including the raw/video question.
- [ ] Rollback is still possible: decide whether to keep the unsigned preset disabled rather than deleted for a period.
- [ ] Then, in one owner-approved change: disable the unsigned preset in Cloudinary and remove the unsigned code path and `cloudinaryUploadPreset` from `assets/js/feature-your-tank.js`.
