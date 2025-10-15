# /media.html Embed Rollback (2025-10-22)

## Summary
- Purpose: restore the YouTube embed on `/media.html` by temporarily removing blocking security headers for that path only.
- Scope: Cloudflare Transform Rule named **Media Page CSP Override** targeting `/media.html` on `thetankguide.com` and `www.thetankguide.com`.
- Change: update the rule to remove `Content-Security-Policy` and `X-Frame-Options` while keeping the existing `Referrer-Policy`, `X-Content-Type-Options`, and `Permissions-Policy` headers.

## Cloudflare Steps
1. Go to **Rules → Transform Rules → Modify Response Header** in the Cloudflare dashboard.
2. Select **Media Page CSP Override** (filter: `http.request.uri.path equals "/media.html"`).
3. Update the actions to:
   - Remove header `Content-Security-Policy`.
   - Remove header `X-Frame-Options`.
   - Set header `Referrer-Policy` to `strict-origin-when-cross-origin`.
   - Set header `X-Content-Type-Options` to `nosniff`.
   - Set header `Permissions-Policy` to `autoplay=(self "https://www.youtube.com"), fullscreen=(self "https://www.youtube.com")`.
4. Deploy the change and purge the page cache.

## Validation
- Hard-reload `https://thetankguide.com/media.html` on desktop and mobile.
- Confirm the embedded YouTube player renders and plays.
- Verify response headers (DevTools → Network → media.html → Headers) show **no `Content-Security-Policy`** and **no `X-Frame-Options`**, with the remaining headers present.
- Check DevTools Console for absence of CSP violations.
- Spot-check other pages (e.g., `/`, `/gear.html`) to ensure their security headers remain unchanged.

## Follow-up TODO
- Draft a minimal, YouTube-friendly CSP for `/media.html` and re-enable it once the regression cause is fully understood.
