# `ttg-upload-authorizer`

This Worker is Phase 1 of The Tank Guide's signed Cloudinary upload design. It is not routed or used by the production website in this pull request.

## What it does

1. `POST /authorize` validates one upload-specific Turnstile token.
2. It checks `success`, the exact production hostname, and the `ttg_upload_authorize` action.
3. On success, it creates a private Durable Object session which expires after ten minutes and can authorize at most five assets.
4. `POST /prepare` consumes one session slot and returns a Cloudinary Upload Widget `prepareUploadParams` response containing server-owned parameters and a SHA-1 upload signature.
5. The browser then uploads bytes directly to Cloudinary. No image data is sent through this Worker.

The session capability is an opaque ID plus a random token. It is intended to live only in browser memory. The Cloudinary signature is valid under Cloudinary's one-hour timestamp rule, but its fixed random public ID and `overwrite=false` mean replay cannot create additional assets with new IDs.

## Deployment bindings

Create these bindings before deploying. Do not commit values to GitHub.

| Binding | Type | Notes |
| --- | --- | --- |
| `CLOUDINARY_API_KEY` | Worker secret | Returned only to the future Upload Widget; Cloudinary treats API keys as public identifiers, but keeping it out of repository configuration avoids accidental copying. |
| `CLOUDINARY_API_SECRET` | Worker secret | Required only by this Worker to generate Cloudinary signatures. |
| `TURNSTILE_SECRET_KEY` | Worker secret | The secret paired with the upload-specific Turnstile widget. |
| `UPLOAD_SESSIONS` | SQLite-backed Durable Object namespace | Bound to `UploadSession`; migration `v1` creates it. |
| `UPLOAD_AUTH_RATE_LIMITER` | Worker Rate Limiting binding | Configure 3 requests per 60 seconds per IP key. |
| `UPLOAD_SIGN_RATE_LIMITER` | Worker Rate Limiting binding | Configure 15 requests per 60 seconds per IP key. |

The two rate-limit namespace IDs are account-specific and intentionally absent from `wrangler.jsonc`. The code treats a missing binding as a safe `503`, not an unprotected upload route.

## Required Cloudinary dashboard work before activation

Create a new signed-only preset named `feature-your-tank-signed-v1`. Do not alter the working `feature-your-tank` preset during this phase. Configure the new preset to preserve the current protections:

- Allowed formats: `jpg,jpeg,png,webp`
- Incoming transformation: `c_limit,w_4000,h_4000/fl_force_strip`
- Signed upload mode
- `overwrite` disabled
- Original filename use disabled and unique filenames enabled
- No video, raw uploads, add-ons, eager transformations, or auto-tagging
- The current `feature-your-tank` asset destination convention

This Worker signs the current legacy `folder` convention, `feature-your-tank`. Before activation, compare it against the Cloudinary dashboard. If the account uses Dynamic Folders, change the one server-owned destination field to `assetFolder` in both `uploadParams()` and the approved signed preset; do not send both fields.

Cloudinary applies directly supplied signed parameters ahead of most preset values. That is why the Worker creates and signs every security-relevant parameter and accepts no browser-supplied Cloudinary upload fields.

## Future website integration (not included here)

The upload-step widget will:

1. obtain one `ttg_upload_authorize` Turnstile token;
2. call `/authorize` once;
3. keep the session ID and token only in memory;
4. call `/prepare` from the official Upload Widget `prepareUploadParams` callback once per file;
5. pass the response's `signature`, `apiKey`, and `uploadParams` to the callback.

The current Formspree token and post-Formspree fresh confirmation-email token remain independent. Upload authorization must not reset or consume either one.

## Migration, observation, and rollback

1. Deploy this Worker with no public route, then verify it through a controlled Worker URL using staging Turnstile credentials.
2. Create and verify the signed Cloudinary preset separately.
3. Add the website integration behind a reversible feature flag in a later pull request.
4. Perform one authorized end-to-end test, including metadata stripping verification on actual stored bytes.
5. Observe authorization failures, Cloudinary usage, pending assets, Formspree results, and confirmation emails for seven days.
6. Keep the current unsigned preset available during the observation window.
7. Roll back by disabling the new client feature flag; do not modify existing assets or URLs.
8. Only after the observation window and owner approval, disable the old unsigned preset. Do not re-enable an unsigned preset as an automatic rollback action.

## Test command

Run `node --test cloudflare-workers/ttg-upload-authorizer/test/*.test.mjs` from the repository root. Tests use only mocked Turnstile, Durable Object, rate-limit, and time resources; they make no Cloudinary, email, or production calls.
