# /media.html Embed Rollback (2025-10-22)

## Summary
- Purpose: restore the YouTube embed on `/media.html` by applying a page-specific CSP that still blocks unneeded origins.
- Scope: Cloudflare Transform Rule named **Media Page CSP Override** targeting `/media.html` on `thetankguide.com` and `www.thetankguide.com`.
- Change: replace the removed CSP with a YouTube-permitting version while still stripping `X-Frame-Options` and keeping the existing `Referrer-Policy`, `X-Content-Type-Options`, and `Permissions-Policy` headers.

## Cloudflare Steps
1. Go to **Rules → Transform Rules → Modify Response Header** in the Cloudflare dashboard.
2. Select **Media Page CSP Override** (filter: `http.request.uri.path equals "/media.html"`).
3. Update the actions to:
   - Set header `Content-Security-Policy` to `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https://www.gstatic.com/recaptcha/ https://www.google.com/recaptcha/; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https://formspree.io https://www.google.com/recaptcha/; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; form-action 'self' https://formspree.io; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; upgrade-insecure-requests`.
   - Remove header `X-Frame-Options`.
   - Set header `Referrer-Policy` to `strict-origin-when-cross-origin`.
   - Set header `X-Content-Type-Options` to `nosniff`.
   - Set header `Permissions-Policy` to `autoplay=(self "https://www.youtube.com"), fullscreen=(self "https://www.youtube.com")`.
4. Deploy the change and purge the page cache.

## Validation
- Hard-reload `https://thetankguide.com/media.html` on desktop and mobile.
- Confirm the embedded YouTube player renders and plays.
- Verify response headers (DevTools → Network → media.html → Headers) show the updated CSP string (with `frame-src` including YouTube) and **no `X-Frame-Options`**, with the remaining headers present.
- Check DevTools Console for absence of CSP violations.
- Spot-check other pages (e.g., `/`, `/gear.html`) to ensure their security headers remain unchanged.

## Follow-up TODO
- Maintain this page-scoped CSP template and revisit when global CSP automation supports per-page overrides.
