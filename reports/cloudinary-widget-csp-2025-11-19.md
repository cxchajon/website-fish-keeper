# Cloudinary widget load failure (feature-your-tank)

## Observation
- Cloudinary upload widget script referenced in `feature-your-tank.html` (`https://widget.cloudinary.com/v2.0/global/all.js`) never loads and page shows fallback error.
- Attempted to fetch live response headers for `feature-your-tank.html` and Cloudinary widget from within CI environment, but outbound proxy returned `403 Forbidden (envoy)` for both, preventing live header capture.
- Repository security templates show a strict sitewide CSP in `hardening/_headers` with minimal allowances (recaptcha, formspree, YouTube/Vimeo). No Cloudinary origins are permitted in `script-src`, `connect-src`, `img-src`, or `frame-src`.

## Relevant policy (current template)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data: https://www.gstatic.com/recaptcha/ https://www.google.com/recaptcha/; font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com; connect-src 'self' https://formspree.io https://www.google.com/recaptcha/; frame-src 'self' https://player.vimeo.com https://www.youtube-nocookie.com https://www.youtube.com; child-src 'self' https://player.vimeo.com https://www.youtube-nocookie.com https://www.youtube.com; frame-ancestors 'none'; form-action 'self' https://formspree.io; base-uri 'self'; object-src 'none'; upgrade-insecure-requests
```

## Diagnosis
- `script-src` blocks `https://widget.cloudinary.com`, so the widget JS file never loads.
- `connect-src` lacks Cloudinary API/upload endpoints (e.g., `https://api.cloudinary.com`, `https://res.cloudinary.com`, `https://widget.cloudinary.com`), so even if the script loaded, network calls would fail.
- `frame-src`/`child-src` omit `https://widget.cloudinary.com`, preventing the widget iframe from opening.
- `img-src` omits Cloudinary asset domains (e.g., `https://res.cloudinary.com`), which would break previews/thumbnails.
- `frame-ancestors 'none'` only affects embedding this page elsewhere, not the widget frame it opens, so it is not the blocker.

## Minimal CSP patch to allow the widget
Add only the Cloudinary origins needed by the widget while keeping the rest of the policy intact:
```
script-src ... https://widget.cloudinary.com;
connect-src ... https://widget.cloudinary.com https://api.cloudinary.com https://res.cloudinary.com;
frame-src ... https://widget.cloudinary.com;
img-src ... https://res.cloudinary.com data:;
```
(Leave other directives as-is.)

## Next steps
- Publish the updated CSP via your hosting config (Netlify/Cloudflare headers). After deployment, re-test the form: the Cloudinary widget script should load, the iframe should open, and uploads should complete.
