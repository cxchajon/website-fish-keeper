# Confirmation Worker deployment

## Required configuration

- Keep `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` as Worker secrets.
- The existing production Turnstile widget with site key `0x4AAAAAAFYL1izh-TK-lIa9` must allow `thetankguide.com` and `www.thetankguide.com`.
- No secret, preset, or Cloudinary configuration change is required.

## Safe deployment order

1. Publish the website revision first and confirm `/submit-your-tank.html` loads `feature-your-tank.js?v=1.0.9`.
2. Confirm the page still has its unchanged Formspree Turnstile widget and that the new confirmation-only container is present.
3. Deploy the confirmation Worker revision second.
4. Run a staging or controlled test submission only after the Worker deployment: Formspree must succeed first, then the page must obtain a `ttg_confirmation` token before it calls `/confirm`.
5. Verify that wrong hostname/action, replayed, and expired tokens return a generic security failure and do not create Resend mail.

The website must be published first because the strict Worker will reject tokens from the older page, which did not carry the `ttg_confirmation` action. Existing visitors with an already-open old page may receive the normal submission-success message but have their confirmation email delayed until they reload and receive the new script.

## Rollback

If the strict validation causes unexpected email failures, roll back the Worker to the immediately previous Worker version first. The new browser widget is compatible with the previous Worker because that version accepted successful Turnstile tokens without requiring an action. Then investigate the Turnstile hostname/action response before retrying the Worker deployment.
