# Media Route & CSP Verification — Round 2 (2025-10-16)

## 1. Canonical route
```
$ curl -sI https://thetankguide.com/media.html
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 19:08:06 GMT
server: envoy
connection: close
```

## 2. Legacy redirects
```
$ curl -sI https://thetankguide.com/media/
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 19:08:08 GMT
server: envoy
connection: close
```
```
$ curl -sI https://thetankguide.com/media/index.html
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 19:08:10 GMT
server: envoy
connection: close
```

## 3. Meta CSP tag validation
```
$ curl -s https://thetankguide.com/media.html | grep -i 'http-equiv="Content-Security-Policy"' -n
```
*(No output — request blocked)*

## 4. YouTube thumbnail reachability
```
$ curl -sI https://img.youtube.com/vi/QbPxRZqd4MI/hqdefault.jpg
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 19:08:14 GMT
server: envoy
connection: close
```
```
$ curl -sI https://img.youtube.com/vi/zX3wGQpC4eE/hqdefault.jpg
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 19:08:16 GMT
server: envoy
connection: close
```

## 5. Embed smoke check (first 40 lines of body)
```
$ curl -sL https://thetankguide.com/media.html | head -n 40
```
*(No output — request blocked)*

## 6. Result Summary
- ❌ /media.html returns 403 Forbidden
- ❌ /media/ and /media/index.html do not redirect (blocked with 403)
- ❌ CSP tag not verifiable (request blocked)
- ❌ YouTube thumbnails inaccessible (403)

**Status:** FAIL — Cloudflare bypass rule still blocking media route and assets.
