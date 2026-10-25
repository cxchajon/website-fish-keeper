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

Run every command from `cloudflare-workers/ttg-confirmation-email` on an up-to-date `main`, signed in to the Cloudflare account that owns `ttg-confirmation-email` (`npx wrangler whoami`). The PowerShell below works on Windows PowerShell 5.1 and PowerShell 7.

1. **Check the code.** `npm ci; npm test; npm run check:config`. That runs 35 Node unit tests, 7 Workers-runtime ledger tests, and a dry run listing `CONFIRM_LEDGER`, `CONFIRM_RATE_LIMITER` and `DAILY_DELIVERY_CAP`.
2. **Record the rollback point.** Run `npx wrangler deployments list` and note the version ID currently serving 100%. The 2026-10-23 closeout recorded `255ae13a-6ed8-4c25-9ff6-6bd0209bbc84`; trust the list over that note.
3. **Check the existing secrets.** Run `npx wrangler secret list`. It shows names only. `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` must be listed. If `CONFIRM_DEDUP_KEY` is already listed, skip step 4 and do not rotate it.
4. **Create `CONFIRM_DEDUP_KEY`.** This generates 32 random bytes as hex and pipes them straight into Wrangler, so the value is never printed or written to disk:

   ```powershell
   $bytes = New-Object byte[] 32
   [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   (($bytes | ForEach-Object { $_.ToString('x2') }) -join '') | npx wrangler secret put CONFIRM_DEDUP_KEY
   Remove-Variable bytes
   ```

   `wrangler secret put` publishes a new version of the code that is **already deployed**, with the secret added. The current code ignores the new secret, so this step changes no behaviour and does not publish the new code. Confirm with `npx wrangler secret list`: three names are listed.
5. **Deploy.** Run `npx wrangler deploy`. Its output must list `env.CONFIRM_LEDGER (ConfirmationLedger)` as a Durable Object. The SQLite class is declared through `exports` in `wrangler.jsonc`, which Wrangler 4.151 supports as the replacement for a `migrations` block (the two cannot be combined). The upload-authorizer uses the same form. Note the new version ID.
6. **Verify production without sending email.** Run the **Confirmation Email Live Verify** workflow (Actions → Run workflow). Every probe is rejected before Resend. The preflight must carry `X-Confirmation-Policy: abuse-limits-v1`; without it, the previous Worker is still serving. The bogus-token probe must return 400 "Security check failed"; a 503 means the ledger binding or `CONFIRM_DEDUP_KEY` is missing. Then run `npx wrangler tail` while loading `/submit-your-tank.html`, and check there are no exceptions and no `Confirmation ledger is not configured` lines.
7. **Watch the next real submission.** A real visitor submission should produce one email and one `/reserve` call in the logs. Do not create a test submission on the live form.

`DAILY_DELIVERY_CAP` is 50 per rolling 24 hours. Keep it at or below the Resend plan's daily allowance, which the plan page in the Resend dashboard shows (the free plan allows 100 a day). Change it in `wrangler.jsonc` and redeploy.

## Rollback

If the abuse limits cause unexpected email failures, first try `npx wrangler rollback <previous-version-id>`. The website works with either version. Cloudflare can refuse a rollback across a Durable Object change. In that case, redeploy the previous Worker from git: `git checkout 169a5cb -- worker.js wrangler.jsonc && npx wrangler deploy`, then restore the files. Removing the ledger deletes only its hashed rows, which expire within 24 hours anyway. This path has not been exercised against production.

If the strict validation causes unexpected email failures, roll back the Worker to the immediately previous Worker version first. The new browser widget is compatible with the previous Worker because that version accepted successful Turnstile tokens without requiring an action. Then investigate the Turnstile hostname/action response before retrying the Worker deployment.
