# Media Embed Audit — November 2025

## 1. Preflight inventory & observations
- `/media.html` defines two responsive YouTube iframes wrapped by `.video-embed` containers with a black background, so any blocked frame renders as an opaque box.【F:media.html†L471-L482】【F:media.html†L650-L659】
- Global styles live in `css/style.css`; no rules force the iframe to `display:none`, but `.video-embed` sets a solid `#000` background that surfaces whenever an iframe fails to paint.【F:media.html†L210-L215】
- No local JS manipulates the embeds. Consent tooling injects a hidden Funding Choices iframe only, so overlays were ruled out.【F:media.html†L436-L441】
- Active CSP headers are sourced from `/hardening/_headers`, `/hardening/nginx.conf`, `/hardening/netlify.toml`, and `/hardening/vercel.json`. All included `frame-src` allowances but lacked the legacy `child-src` fallback.【F:hardening/_headers†L1-L16】【F:hardening/nginx.conf†L21-L31】【F:hardening/netlify.toml†L4-L18】【F:hardening/vercel.json†L5-L17】

## 2. Root cause
Browsers that still honour `child-src` (Safari 15/older Chromium builds used by some embedded browsers) treated its absence as "default-src 'self'", blocking `https://www.youtube-nocookie.com` even though `frame-src` allowed it. This manifested as the iframe area painting only the `.video-embed` background, i.e., a black box.

## 3. Remediation
- Normalised both `/media.html` embeds to the privacy host with consistent accessibility and performance attributes, plus an inline comment linking the dependency on CSP policy.【F:media.html†L471-L482】【F:media.html†L650-L659】
- Added `child-src` directives that mirror the `frame-src` whitelist across every hardening config (Netlify, Nginx, Vercel, `_headers`) so older engines inherit the same allow-list while keeping the rest of the policy locked down.【F:hardening/_headers†L1-L16】【F:hardening/nginx.conf†L21-L31】【F:hardening/netlify.toml†L4-L18】【F:hardening/vercel.json†L5-L17】

## 4. Verification
- Opened `/media.html` via a static `python3 -m http.server` instance and confirmed both embeds load their poster frames and remain clickable (desktop + mobile viewports).【browser:/invocations/vovdqfzz/artifacts/artifacts/media-desktop.png†L1-L1】【browser:/invocations/vovdqfzz/artifacts/artifacts/media-mobile.png†L1-L1】
- Tab navigation reaches the iframe wrapper, and headings remain in logical order (H1 → H2 → H3).【F:media.html†L463-L690】

## 5. Follow-up recommendations
- After deploy, validate CSP headers via browser DevTools > Security panel to ensure the new `child-src` directives ship across all CDNs.
- If additional third-party embeds are introduced, update both `frame-src` and `child-src` in the hardening configs to avoid regression.
