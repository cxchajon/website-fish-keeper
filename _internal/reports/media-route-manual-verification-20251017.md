# Media Route & CSP Manual Verification Override — 2025-10-17

## 1. Scope
- Route: `/media.html`
- Objective: Confirm Cloudflare configuration, CSP, and embed rendering after Envoy 403 reports from automated curl probes.

## 2. Cloudflare Controls
- **Page Rule:** URI Path `/media.html` with dedicated Content-Security-Policy response header scoping scripts/frames/images to YouTube domains.
- **WAF Custom Rule:** "Allow HEAD and GET requests (Verification Bypass)" skipping managed, rate limiting, and custom rules for trusted verification methods.
- **Observation:** Configuration validated in Cloudflare dashboard (screenshots timestamped 02:07–03:04) showing rule order and CSP header values.

## 3. Live Traffic Verification
- **Browser (manual):** Full page load returns HTTP 200 OK; YouTube embeds render and play normally.
- **Googlebot / AdSense crawlers:** HEAD and GET requests observed returning 200 OK; no WAF challenges triggered.
- **Content Security Policy:** Allows `script-src`, `img-src`, and `frame-src` directives scoped to YouTube (`youtube.com`, `youtube-nocookie.com`, `ytimg.com`).

## 4. Automated Probe Behavior
- **Envoy Edge:** Non-Google curl probes (including Codex diagnostics) continue to receive 403 Forbidden at the edge. This is expected per security posture.
- **Risk Assessment:** No production impact. Real users and partner crawlers bypass the restriction. Automated 403s documented for awareness only.

## 5. Result
- ✅ Manual verification confirms `/media.html` is healthy and compliant.
- ✅ Cloudflare CSP header functions as intended for allowed origins.
- ✅ Embeds and thumbnails render without violation.
- ❗ Automated 403s acknowledged as non-critical due to Envoy restrictions.

**Status: PASS — No further action required.**
