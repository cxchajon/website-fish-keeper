# Confirmation email security closeout

Date: 2026-10-23

## Production result

- Website change merged through PR #2259 (`b1dbc2b`).
- Production confirmation Worker deployed as version `255ae13a-6ed8-4c25-9ff6-6bd0209bbc84`.
- The live submission page loads the confirmation-only Turnstile container and the action `ttg_confirmation`.
- The existing Formspree token, upload-authorization token, and confirmation-email token remain separate.
- Existing encrypted Worker bindings remain named `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY`; values were not read, recorded, or changed.

## Enforced controls

- The confirmation Worker accepts only the apex and `www` production origins.
- It calls Turnstile Siteverify server-side and requires `success === true`, an allowed hostname, and the exact `ttg_confirmation` action.
- It rejects missing, malformed, expired, replayed, wrong-hostname, and wrong-action verification results before Resend can be called.
- Per-IP confirmation rate limiting is active at five requests per minute.
- Visitor-controlled review and confirmation details are rendered as text nodes, not HTML.

## Verification evidence

- Repository unit suite: 316 passed.
- Upload-authorizer tests: 19 unit and 4 Workers-runtime tests passed.
- Confirmation Worker tests: 10 passed.
- Signed-upload flow tests: 9 passed.
- GitHub Site Validation, Ads.txt Delivery Audit, and footer lock checks passed for PR #2259.
- Live rejection checks: untrusted origin returned HTTP 403; invalid synthetic data from the allowed origin returned HTTP 400 before Siteverify or Resend.

No form was submitted, no email was sent, and no image was uploaded during this closeout.

## Rollback

If confirmation delivery fails unexpectedly, roll back only `ttg-confirmation-email` to the immediately previous production version `20b32b3e-7b63-4dbc-8f52-c23389b177bf`, then investigate the Turnstile verification response. The updated browser widget remains compatible with that prior Worker.

## Deferred follow-up

- Observe signed uploads and confirmation delivery through 2026-10-29 before considering the legacy unsigned upload preset for retirement. Do not disable it during the observation window.
- Add server-side, global confirmation-email idempotency; the current browser-side promise and per-IP rate limit do not prevent all cross-device or cross-IP duplicate sends.
- Keep the existing Cloudinary metadata and oversized-image verification work separate from this change.
- Review repository governance separately: required PR approvals/status checks and scheduled workflow write permissions need explicit owner policy decisions.
