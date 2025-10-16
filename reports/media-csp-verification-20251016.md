# Media Route & CSP Verification — 2025-10-16

## Context
- Canonical URL: https://thetankguide.com/media.html
- Legacy routes expected to 301 → https://thetankguide.com/media.html
- Cloudflare WAF “Skip” rule for GET/HEAD should prevent 403 responses from origin checks.
- YouTube embed IDs: QbPxRZqd4MI, zX3wGQpC4eE

## Checks

### a) Canonical page headers
```bash
$ curl -sI https://thetankguide.com/media.html
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 18:54:39 GMT
server: envoy
connection: close
```

### b) Legacy routes (should 301 → /media.html)
```bash
$ curl -sI https://thetankguide.com/media/
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 18:54:40 GMT
server: envoy
connection: close
```

```bash
$ curl -sI https://thetankguide.com/media/index.html
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 18:54:42 GMT
server: envoy
connection: close
```

### c) Meta-delivered CSP tag presence
```bash
$ curl -s https://thetankguide.com/media.html | sed -n '1,200p' | grep -i 'http-equiv="Content-Security-Policy"' -n
# (no output)
```

```bash
$ LINE=0; START=$((LINE-15)); if [ $START -lt 1 ]; then START=1; fi; END=$((LINE+15)); \
> curl -s https://thetankguide.com/media.html | awk 'NR>=1 && NR<=200{print NR": "$0}' | sed -n "${START},${END}p"
# (no output)
```

### d) YouTube <noscript> thumbnail reachability
```bash
$ curl -sI https://img.youtube.com/vi/QbPxRZqd4MI/hqdefault.jpg
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 18:55:11 GMT
server: envoy
connection: close
```

```bash
$ curl -sI https://img.youtube.com/vi/zX3wGQpC4eE/hqdefault.jpg
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 18:55:13 GMT
server: envoy
connection: close
```

### e) Quick embed-load smoke (expect 200 HTML body)
```bash
$ curl -sL https://thetankguide.com/media.html | head -n 40
# (no output)
```

## Results
- ❌ Canonical /media.html: 403 Forbidden returned to `curl -I`.
- ❌ /media/ legacy route: 403 Forbidden (expected 301 → /media.html).
- ❌ /media/index.html legacy route: 403 Forbidden (expected 301 → /media.html).
- ❌ Meta CSP tag check: 403 response prevented HTML retrieval.
- ❌ YouTube thumbnail hosts: 403 Forbidden from img.youtube.com.
- ❌ Embed load smoke: 403 Forbidden prevented content retrieval.

## Recommended Remediation
All requests still receive HTTP 403 from the Cloudflare edge (envoy), indicating the Skip rule for GET/HEAD is not covering all protection components. Review Cloudflare Managed Rules, Super Bot Fight Mode, and Rate Limiting configurations for this zone and ensure the WAF Skip rule bypasses those controls for benign verification requests using GET/HEAD.

Status: FAIL — Media route still blocked by 403; CSP and embed verification could not complete.
