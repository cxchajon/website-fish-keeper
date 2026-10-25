# Confirmation Worker deployment

## Required configuration

- Keep `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` as Worker secrets.
- `CONFIRM_DEDUP_KEY` (Worker secret, at least 32 characters) keys the hashes the abuse ledger stores. Create it once with `openssl rand -hex 32 | npx wrangler secret put CONFIRM_DEDUP_KEY`. Rotating it only resets the 24-hour limits.
- The `CONFIRM_LEDGER` Durable Object (`ConfirmationLedger`, SQLite storage) is declared in `wrangler.jsonc` and is created by the deploy itself.
- `DAILY_DELIVERY_CAP` (plain var, default 50) is the site-wide limit on confirmation emails per rolling 24 hours. Keep it at or below the Resend plan's daily allowance.
- The existing production Turnstile widget with site key `0x4AAAAAAFYL1izh-TK-lIa9` must allow `thetankguide.com` and `www.thetankguide.com`.
- No secret, preset, or Cloudinary configuration change is required.

## Safe deployment order

1. Publish the website revision first and confirm `/submit-your-tank.html` loads `feature-your-tank.js?v=1.0.9`.
2. Confirm the page still has its unchanged Formspree Turnstile widget and that the new confirmation-only container is present.
3. Deploy the confirmation Worker revision second.
4. Run a staging or controlled test submission only after the Worker deployment: Formspree must succeed first, then the page must obtain a `ttg_confirmation` token before it calls `/confirm`.
5. Verify that wrong hostname/action, replayed, and expired tokens return a generic security failure and do not create Resend mail.

The website must be published first because the strict Worker will reject tokens from the older page, which did not carry the `ttg_confirmation` action. Existing visitors with an already-open old page may receive the normal submission-success message but have their confirmation email delayed until they reload and receive the new script.

## Abuse limits (October 2026)

A valid `ttg_confirmation` Turnstile token proves that a person solved a challenge on thetankguide.com. It does not prove that the address belongs to them, or that a Formspree submission happened. The Worker therefore also:

- echoes the visitor's name and tank name only when they read like a name: letters, digits, spaces and `' . , & ( ) # + -`, with no domain, email address, phone number, invisible or bidirectional characters, or instruction words such as "verify", "password", "click" or "call" (60 and 80 characters at most). Otherwise the email falls back to "Hi there" and leaves out the tank line. HTML is never accepted, and every echoed value is escaped.
- sends at most one email per recipient and tank name in 24 hours. A repeat returns `{ ok: true }` without sending, and Resend gets the same `Idempotency-Key`. If Resend returns an error, the reservation is released so the visitor can retry. After a network failure the email may have gone out, so the reservation stays and counts toward the limits.
- sends at most 3 emails per recipient, and `DAILY_DELIVERY_CAP` emails site-wide, per rolling 24 hours. A request over a limit gets a generic 429. The page then tells the visitor their confirmation may be delayed, and the Formspree submission is unaffected.
- keeps the per-IP rate limit, strict Turnstile hostname/action checks, the fixed sender and the fixed reply-to.
- fails closed (503, no email) if the ledger binding or `CONFIRM_DEDUP_KEY` is missing, or if the ledger is unavailable.

The ledger stores only HMAC-SHA256 hashes of the recipient address, and of the address with the tank name, plus a timestamp. It never stores addresses, names or tank names. Rows are deleted 24 hours after the send, both on the next request and by a Durable Object alarm. Their only purpose is enforcing the limits above.

Residual risk: someone who solves Turnstile on the real site can still send one fixed-wording confirmation to an address they choose, at most 3 per address per day. Tying confirmations to a verified Formspree submission would mean the Worker submitting to Formspree itself or verifying a signed receipt. That is a backend redesign and has not been done.

## Deploying the abuse limits

1. Run `npm ci && npm test && npm run check:config` in this directory. The unit tests run in Node, and the ledger tests run in the Workers runtime.
2. Set `CONFIRM_DEDUP_KEY` (see above) before deploying. Without it, the new version sends no email.
3. Note the current version for rollback: `npx wrangler deployments list`. The 2026-10-23 closeout recorded production as `255ae13a-6ed8-4c25-9ff6-6bd0209bbc84`; use whatever the list shows at deploy time.
4. Run `npx wrangler deploy`. The website needs no change, because the request and response contract is unchanged.
5. Check the Worker logs for `Confirmation ledger is not configured`. A real submission should produce one email and one `/reserve` ledger call.

## Rollback

If the abuse limits cause unexpected email failures, first try `npx wrangler rollback <previous-version-id>`. The website works with either version. Cloudflare can refuse a rollback across a Durable Object change. In that case, redeploy the previous Worker from git: `git checkout 169a5cb -- worker.js wrangler.jsonc && npx wrangler deploy`, then restore the files. Removing the ledger deletes only its hashed rows, which expire within 24 hours anyway. This path has not been exercised against production.

If the strict validation causes unexpected email failures, roll back the Worker to the immediately previous Worker version first. The new browser widget is compatible with the previous Worker because that version accepted successful Turnstile tokens without requiring an action. Then investigate the Turnstile hostname/action response before retrying the Worker deployment.
