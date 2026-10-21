# `ttg-upload-authorizer`

This Worker is the server-side authorization boundary for the future signed
Cloudinary upload flow. It is not deployed or routed by this change, and the
website feature flag remains disabled by default.

Images continue from the visitor's browser directly to Cloudinary. The Worker
does not receive image bytes, original filenames, form data, or email details.
It never returns the Cloudinary API secret.

## Request flow

1. The opt-in browser code renders a dedicated `ttg_upload_authorize`
   Turnstile widget. It does not reuse the existing Formspree or confirmation
   email Turnstile token.
2. `POST /authorize` validates Turnstile `success`, the exact production
   hostname, and the exact action. It creates one private ten-minute session
   with at most five upload claims.
3. The Upload Widget invokes `prepareUploadParams` for each file. The browser
   sends only its session capability, the Widget-provided timestamp,
   `source: "uw"`, and an opaque request ID to `POST /prepare`.
4. The Durable Object maps the request ID to a server-generated random public
   ID. The first claim consumes one slot; a retry with the same request ID gets
   the same public ID without consuming another slot.
5. The Worker signs the exact Cloudinary parameters that will be uploaded:
   `context`, `overwrite=false`, server-generated `public_id`, `source=uw`,
   fixed tags, the Widget timestamp, and the fixed signed preset name.

The browser-side helper retries one transient prepare request once with the
same request ID. It does not retry 4xx responses, and it never invokes the
Widget callback after a failed authorization. The unsigned uploader is chosen
only when `signedUploadsEnabled` is explicitly `false`; a true but incomplete
signed configuration displays an error and fails closed.

## Source configuration

`wrangler.jsonc` now declares the following resources. Running `wrangler deploy
--dry-run` validates them locally but does not create or change Cloudflare
resources.

| Binding | Source configuration | Purpose |
| --- | --- | --- |
| `UPLOAD_SESSIONS` | `UploadSession` declarative export with `storage: "sqlite"` | Private session and idempotency claim store. |
| `UPLOAD_AUTH_RATE_LIMITER` | Namespace `74002`, 3 requests / 60 seconds | Limits Turnstile authorization attempts by the Worker’s IP key. |
| `UPLOAD_SIGN_RATE_LIMITER` | Namespace `74003`, 15 requests / 60 seconds | Limits signature preparation requests by the Worker’s IP key. |
| `CLOUDINARY_API_KEY` | Required encrypted Worker secret | Returned only as the Cloudinary Upload Widget API key. |
| `CLOUDINARY_API_SECRET` | Required encrypted Worker secret | Used only to make server-side signatures. |
| `TURNSTILE_SECRET_KEY` | Required encrypted Worker secret | Used only for the dedicated upload Turnstile verification. |

The two rate-limit namespace IDs are deliberately distinct, so their counters
cannot be shared accidentally. Before the first deployment, verify in the
Cloudflare dashboard that IDs `74002` and `74003` do not conflict with another
Worker in this account. Do not substitute production secrets into this
repository, source files, browser configuration, logs, or chat.

## Required dashboard setup before controlled staging

No step below has been performed by this pull request.

1. Create a new signed-only Cloudinary preset named
   `feature-your-tank-signed-v1`; leave the current unsigned
   `feature-your-tank` preset unchanged.
2. In Dynamic Folders, configure the signed preset with:
   - allowed formats `jpg,jpeg,png,webp`;
   - incoming transformation `c_limit,w_4000,h_4000/fl_force_strip`;
   - signed uploads, overwrite disabled, original filename disabled, and
     unique filename enabled;
   - `asset_folder` `feature-your-tank` with **Use asset folder as public ID
     prefix** enabled;
   - no legacy `folder`, separate `public_id_prefix`, video/raw access,
     add-ons, eager transformations, or auto-tagging.
3. Create a dedicated Turnstile widget/site key for the upload authorizer and
   restrict it to `thetankguide.com` and `www.thetankguide.com`. It must render
   with action `ttg_upload_authorize`.
4. Deploy the Worker only after setting the three values above as encrypted
   Worker secrets. Confirm that the configured Worker URL is the one used by
   staging.
5. On a staging-only website build, set `signedUploadsEnabled: true` and add
   the dedicated Turnstile site key. Keep those two changes out of production
   until a controlled end-to-end test passes.

## Rollback

The committed website flag is `false`, so this pull request cannot switch
production to signed uploads by itself. If a later staged activation fails,
deploy a website build with `signedUploadsEnabled: false`. That restores the
existing unsigned code path without changing presets, Cloudflare secrets,
Durable Object data, historical image URLs, Formspree, or the confirmation
email Worker. Do not disable the unsigned preset during the observation window.

## Tests

From this directory:

```text
npm install
npm run test
npm run check:config
```

`test:unit` uses isolated mocks for Turnstile, rate limits, and the Worker
boundary. `test:runtime` uses Cloudflare’s Vitest plugin and local `workerd`
with the actual SQLite-backed Durable Object class. The runtime tests exercise
the Durable Object inheritance contract, SQLite persistence, retry reuse,
concurrent five-slot enforcement, and expiry. Neither suite sends network
requests to Cloudinary, Turnstile, Formspree, Resend, or production.
