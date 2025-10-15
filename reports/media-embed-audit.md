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

---

## 6. Production validation attempt — October 15, 2025
- **Deployment & cache purge:** Unable to perform merge/deploy or trigger CDN cache purge from within the constrained CI sandbox. Documented requirement for Cloudflare/Netlify "Purge Everything" post-merge.
- **Response header capture:** `curl -I https://thetankguide.com/media.html` from the sandbox returned `HTTP/1.1 403 Forbidden` due to egress restrictions, so live CSP headers could not be confirmed. Recommend rerunning the header check from an environment with public internet access after production deploy.
- **Visual checks:** Browser automation is blocked from reaching the production origin, preventing confirmation of iframe rendering on desktop/mobile or capturing refreshed screenshots. Request manual QA in a real browser with cleared cache/private window post-purge.
- **Regression guard:** Without production access, DevTools console review for CSP violations could not be completed. Suggest capturing console logs during the manual QA pass.
- **Next actions:**
  1. Merge Part 1 PR to `main`, monitor deployment pipeline until production update completes.
  2. Execute CDN cache purge (Cloudflare/Netlify depending on active provider) and record timestamp/operator.
  3. Re-run header verification and visual checks, ensuring `frame-src` includes both `https://www.youtube-nocookie.com` and `https://www.youtube.com`.
  4. Update this report with final CSP lines, screenshot evidence, and PR comment once production validation is confirmed.
  5. Optionally align all embeds to `youtube-nocookie.com` while keeping both hosts in CSP for resilience.

## 7. November 2025 follow-up — page-scoped CSP override & diagnostics
- **Header inventory:** Active emitters remain `hardening/_headers`, `hardening/netlify.toml`, `hardening/vercel.json`, and `hardening/nginx.conf`. Each now defines a `/media.html` override that delivers a single CSP tuned for YouTube alongside the original global policy for the rest of the site.【F:hardening/_headers†L1-L24】【F:hardening/netlify.toml†L1-L31】【F:hardening/vercel.json†L1-L45】【F:hardening/nginx.conf†L1-L54】
- **Effective CSP contents:** The page-scoped policy whitelists only the resources `/media.html` actually loads: default self, inline scripts/styles, Google consent tooling and analytics loaders, Cloudflare beacon, and YouTube frames/poster images. Frame ancestors are limited to `'self'` so the page can still appear in first-party navigation chrome.【F:hardening/_headers†L19-L24】【F:media.html†L470-L484】【F:media.html†L649-L662】
- **Diagnostics guard:** Added `/diag/headers.html` so we can confirm CDN precedence. It performs a `HEAD` fetch for `/media.html`, counts how many CSP headers land in the response, and prints them in-order so we can spot rogue intermediaries. Remove once production verification is complete.【F:diag/headers.html†L1-L69】
- **Next validation steps:**
  1. Deploy preview: confirm `/diag/headers.html` reports a single CSP and copy the exact string into this report.
  2. Capture refreshed desktop (≥1280px) and mobile (~390px) screenshots of `/media.html` showing both embeds rendering.
  3. After production launch and CDN purge, repeat the header capture plus screenshots and document timestamps + asset paths here.
  4. File a follow-up issue to deduplicate header sources so future CSP adjustments propagate consistently.
