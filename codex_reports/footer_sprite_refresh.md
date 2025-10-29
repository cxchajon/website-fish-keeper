# Footer Sprite Versioning & Footer Loader Preload

## Summary
- Added `?v=1.3.5` cache-busting token and explicit `xlink:href` fallbacks to every `<use>` reference for `/assets/sprite.socials.svg` in `footer.html`.
- Injected a single `<link rel="preload" href="/footer.html?v=1.4.9" as="fetch" crossorigin="anonymous">` tag into each HTML document that boots the canonical footer loader.
- Regenerated `.footer.lock.json` so the hash guard tracks the new footer HTML signature.

## Cloudflare Cache Purge
- Action required post-deploy: purge `/assets/sprite.socials.svg` via the Cloudflare dashboard or API to propagate the new querystring requirements.
- Sandbox note: direct Cloudflare API access is unavailable here, so no automated purge call could be executed.

## Verification
- `APPROVED_FOOTER_CHANGE=1 npm run footer:lint`
- `APPROVED_FOOTER_CHANGE=1 npm run footer:verify`

## Screenshots
- Not applicable — markup-only update with no rendered visual changes.
